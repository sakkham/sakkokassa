-- ============================================================
-- Sakkokassa — ylläpitäjän suora "merkitse maksetuksi" + oman
-- ehdotuksen peruutus
-- ============================================================
-- Havaittu ongelma: "Maksettu"-tyyppiset ehdotukset vaativat
-- ylläpitäjän hyväksynnän, mutta cannot_vote_own estää ehdotuksen
-- TEKIJÄÄ äänestämästä siihen ollenkaan — myös silloin kun tekijä on
-- itse ehdotuksen kohde (tavallisin tapaus: pelaaja painaa "Maksettu-
-- ehdotus" omaan sakkoonsa). Yhden ylläpitäjän joukkueessa, jos juuri
-- se ylläpitäjä on tekijä, ehdotusta ei voi hyväksyä KUKAAN. Samasta
-- syystä mikä tahansa ehdotus jää ikuisesti roikkumaan "Odottaa"-
-- listalle jos kukaan muu ei koskaan äänestä, eikä tekijä voi itse
-- perua sitä.
--
-- Ratkaisu on kaksiosainen:
--  1) Ylläpitäjä saa suoran, ehdotusjärjestelmän ohittavan "merkitse
--     maksetuksi" -toiminnon — täsmälleen samalla periaatteella kuin
--     heillä on jo suora sakon lisäys (add_fee/add_fee_to_username) ja
--     poisto (delete_fee). Sekä yksittäiselle sakolle että kaikille
--     kerralla per jäsen.
--  2) Ehdotuksen tekijä saa perua oman, vielä käsittelemättömän
--     ehdotuksensa — turvallista koska mitään sakkoa ei ole vielä
--     muutettu, ei siis avaa cannot_vote_own:n suojaamaa kiertotietä.
-- ============================================================

-- ---------- 1) Suora merkitse maksetuksi (ylläpitäjä) ----------

create or replace function public.mark_fee_paid(p_team_id uuid, p_fee_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.has_team_role(auth.uid(), p_team_id, 'teamadmin') then
    raise exception 'unauthorized';
  end if;

  select status into v_status from public.fees where id = p_fee_id and team_id = p_team_id;
  if v_status is null then raise exception 'fee_not_found'; end if;
  if v_status <> 'active' then raise exception 'fee_not_active'; end if;

  update public.fees set status = 'paid' where id = p_fee_id;
  perform public.log_audit(p_team_id, 'MARK_FEE_PAID', jsonb_build_object('feeId', p_fee_id, 'teamId', p_team_id));
end;
$$;

create or replace function public.mark_all_fees_paid(p_team_id uuid, p_member_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not public.has_team_role(auth.uid(), p_team_id, 'teamadmin') then
    raise exception 'unauthorized';
  end if;
  if not exists (select 1 from public.team_members where id = p_member_id and team_id = p_team_id) then
    raise exception 'member_not_found';
  end if;

  with updated as (
    update public.fees set status = 'paid'
    where member_id = p_member_id and status = 'active'
    returning 1
  )
  select count(*) into v_count from updated;
  if v_count = 0 then raise exception 'no_active_fees'; end if;

  perform public.log_audit(p_team_id, 'MARK_ALL_FEES_PAID',
    jsonb_build_object('memberId', p_member_id, 'teamId', p_team_id, 'count', v_count));
  return v_count;
end;
$$;

grant execute on function public.mark_fee_paid(uuid, uuid) to authenticated;
grant execute on function public.mark_all_fees_paid(uuid, uuid) to authenticated;

-- ---------- 2) Oman ehdotuksen peruutus ----------

alter table public.suggestions
  drop constraint suggestions_status_check,
  add constraint suggestions_status_check check (status in ('pending','approved','rejected','cancelled'));

create or replace function public.cancel_suggestion(p_team_id uuid, p_suggestion_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_sug public.suggestions;
  v_actor public.team_members;
begin
  select * into v_sug from public.suggestions where id = p_suggestion_id and team_id = p_team_id;
  if v_sug is null then raise exception 'suggestion_not_found'; end if;

  select * into v_actor from public.team_members
    where team_id = p_team_id and user_id = auth.uid() and status = 'active';
  if v_actor is null or v_sug.suggested_by_member_id <> v_actor.id then
    raise exception 'not_suggester';
  end if;
  if v_sug.status <> 'pending' then raise exception 'already_resolved'; end if;

  update public.suggestions set status = 'cancelled' where id = p_suggestion_id;
  perform public.log_audit(p_team_id, 'CANCEL_SUGGESTION',
    jsonb_build_object('suggestionId', p_suggestion_id, 'teamId', p_team_id));
end;
$$;

grant execute on function public.cancel_suggestion(uuid, uuid) to authenticated;
