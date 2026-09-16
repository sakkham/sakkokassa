-- ============================================================
-- Joukkueen sakot — "merkitse kaikki maksetuksi" -ehdotus
-- ============================================================
-- Uusi ehdotustyyppi 'mark_all_paid': yksi ehdotus joka kattaa
-- ehdottajan KAIKKI senhetkiset aktiiviset sakot samassa joukkueessa.
-- Kun ehdotus hyväksytään, kaikki katetut sakot merkitään maksetuiksi
-- kerralla (yksi äänestys/hyväksyntä riittää kuittaamaan koko summan).
--
-- Katetut sakot "jäädytetään" (snapshotoidaan) suggestion_fees-tauluun
-- jo ehdotushetkellä, jotta ehdotuksen tekemisen JÄLKEEN lisätyt uudet
-- sakot eivät voi vahingossa tulla mukaan hyväksynnän yhteydessä —
-- ehdotus koskee täsmälleen niitä sakkoja jotka olivat aktiivisia kun
-- ehdotus tehtiin, ei mitä tahansa "kaikkia aktiivisia sakkoja
-- hyväksymishetkellä".
--
-- Itsensä ehdottama + itseään koskeva ehdotus ei silti voi itse
-- hyväksyä itseään — vote_on_suggestion tarkistaa cannot_vote_own
-- (suggested_by_member_id = äänestäjä) ennen kohteen itsehyväksyntä-
-- haaraa, samalla tavalla kuin suggest_mark_paid/suggest_removal jo
-- toimivat. Tämä on tarkoituksellista: muuten kuka tahansa voisi
-- yksipuolisesti merkitä omat sakkonsa maksetuiksi ilman toisen
-- vahvistusta — vaatii TeamAdminin/Approverin (tai äänikynnyksen).
-- ============================================================

alter table public.suggestions
  drop constraint suggestions_type_check,
  add constraint suggestions_type_check check (type in ('new_fee','removal','mark_paid','mark_all_paid'));

create table public.suggestion_fees (
  suggestion_id uuid not null references public.suggestions(id) on delete cascade,
  fee_id uuid not null references public.fees(id) on delete cascade,
  primary key (suggestion_id, fee_id)
);
comment on table public.suggestion_fees is 'Snapshot: mitkä sakot yksi "merkitse kaikki maksetuksi" -ehdotus (suggestions.type = mark_all_paid) kattaa.';

alter table public.suggestion_fees enable row level security;

create policy suggestion_fees_select on public.suggestion_fees
  for select using (
    exists (
      select 1 from public.suggestions s
      where s.id = suggestion_id and public.is_team_member(auth.uid(), s.team_id)
    )
  );

-- Laajennetaan apply_suggestion kattamaan uusi tyyppi. Sama funktio,
-- sama omistaja -> aiemmin peruutettu PUBLIC-execute-oikeus säilyy
-- ennallaan (CREATE OR REPLACE ei nollaa GRANT/REVOKE-tilaa).
create or replace function public.apply_suggestion(p_suggestion public.suggestions)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_display text;
begin
  if p_suggestion.type = 'new_fee' then
    v_display := public.display_name(p_suggestion.team_id, auth.uid());
    insert into public.fees (team_id, member_id, amount, reason, occurred_at, added_by, status)
    values (p_suggestion.team_id, p_suggestion.target_member_id, p_suggestion.amount, p_suggestion.reason,
            public.parse_fee_date(p_suggestion.fee_date), v_display || ' (ehdotus)', 'active');
  elsif p_suggestion.type = 'removal' then
    update public.fees set status = 'deleted'
      where id = p_suggestion.related_fee_id and status = 'active';
  elsif p_suggestion.type = 'mark_paid' then
    update public.fees set status = 'paid'
      where id = p_suggestion.related_fee_id and status = 'active';
  elsif p_suggestion.type = 'mark_all_paid' then
    update public.fees set status = 'paid'
      where status = 'active'
        and id in (select fee_id from public.suggestion_fees where suggestion_id = p_suggestion.id);
  end if;
end;
$$;

create or replace function public.suggest_mark_all_paid(p_team_id uuid, p_comment text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.team_members;
  v_comment text := trim(p_comment);
  v_sug_id uuid;
  v_total numeric(10,2);
  v_count int;
begin
  select * into v_actor from public.team_members
    where team_id = p_team_id and user_id = auth.uid() and status = 'active';
  if v_actor is null then raise exception 'not_member'; end if;
  if v_comment = '' then raise exception 'missing_fields'; end if;

  select count(*), coalesce(sum(amount), 0) into v_count, v_total
    from public.fees where member_id = v_actor.id and status = 'active';
  if v_count = 0 then raise exception 'no_active_fees'; end if;

  insert into public.suggestions (team_id, target_member_id, suggested_by_member_id, type, amount, reason, comment, status)
  values (p_team_id, v_actor.id, v_actor.id, 'mark_all_paid', v_total,
          v_count || ' sakkoa merkitään maksetuksi', v_comment, 'pending')
  returning id into v_sug_id;

  insert into public.suggestion_fees (suggestion_id, fee_id)
  select v_sug_id, id from public.fees where member_id = v_actor.id and status = 'active';

  perform public.log_audit(p_team_id, 'SUGGEST_MARK_ALL_PAID',
    jsonb_build_object('suggestionId', v_sug_id, 'teamId', p_team_id, 'count', v_count, 'total', v_total));
  return v_sug_id;
end;
$$;

grant execute on function public.suggest_mark_all_paid(uuid, text) to authenticated;
