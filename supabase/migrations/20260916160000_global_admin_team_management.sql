-- ============================================================
-- Joukkueen sakot — Globaali ylläpito: joukkueiden poisto/palautus
-- ============================================================
-- Uusi ominaisuus (ei ollut vanhassa Code.gs:ssä lainkaan — Teams.IsActive
-- oli olemassa mutta mikään funktio ei koskaan muuttanut sitä). Poisto on
-- tarkoituksella PEHMEÄ (is_active=false), ei rivien oikea poisto: kaikki
-- historia (jäsenet, sakot, ehdotukset, auditlogi) säilyy ennallaan ja
-- toiminto on palautettavissa. Aito CASCADE-poisto tuhoaisi pysyvästi
-- mahdollisesti merkittävän sakkohistorian yhden klikkauksen takana,
-- mikä ei ole perusteltua kun pehmeä poisto saavuttaa saman käytännön
-- lopputuloksen (joukkue katoaa kaikilta paitsi GlobalAdminilta).
--
-- Poiston vaikutus toteutetaan keskitetysti: is_team_member()/team_role()
-- vaativat nyt myös teams.is_active:n ei-admin-käyttäjiltä (GlobalAdmin
-- ohittaa tämän aina, kuten ennenkin). Koska lähes kaikki kirjoitus-RPC:t
-- ja RLS-lukupolitiikat nojaavat näihin apufunktioihin, poistettu joukkue
-- katoaa automaattisesti sekä sen jäsenten dashboardilta että suorilta
-- URL-yrityksiltä ilman että jokaista RPC:tä pitäisi erikseen korjata.
--
-- Poikkeus: suggest_fee/suggest_removal/suggest_mark_paid/
-- suggest_mark_all_paid/vote_on_suggestion tekevät oman suoran
-- team_members-haun (eivät kutsu is_team_member/has_team_role omaa
-- jäsenyyttään tarkistaessaan), joten niihin lisätään sama
-- teams.is_active-ehto erikseen. join_team saa vastaavan tarkistuksen
-- ihan alkuun (ei liitytä poistettuun joukkueeseen).
-- ============================================================

-- ---------- Apufunktioiden korjaus ----------

create or replace function public.team_role(p_user uuid, p_team uuid)
returns text
language sql stable security definer set search_path = public as $$
  select tm.role from public.team_members tm
  join public.teams t on t.id = tm.team_id
  where tm.team_id = p_team and tm.user_id = p_user and tm.status = 'active' and t.is_active
  limit 1;
$$;

-- coalesce: team_role() palauttaa NULLin kun jäsenyyttä ei löydy (esim.
-- joukkue poistettu) — ilman coalescea "false or null" = null, ja
-- "if not has_team_role(...)" kohtelisi NULLia kuin false:a PL/pgSQL:ssä,
-- eli valtuutustarkistus ei laukeaisi ollenkaan. Pakotetaan aina boolean.
create or replace function public.has_team_role(p_user uuid, p_team uuid, variadic p_roles text[])
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_global_admin(p_user) or coalesce(public.team_role(p_user, p_team) = any(p_roles), false);
$$;

create or replace function public.is_team_member(p_user uuid, p_team uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_global_admin(p_user) or exists (
    select 1 from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.team_id = p_team and tm.user_id = p_user and tm.status = 'active' and t.is_active
  );
$$;

-- ---------- Suoraan team_members-taulua lukevat RPC:t ----------

create or replace function public.suggest_fee(
  p_team_id uuid, p_target_member_id uuid, p_amount numeric, p_reason text, p_fee_date date default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.team_members;
  v_is_admin boolean := public.is_global_admin(auth.uid());
  v_settings public.teams;
  v_is_self boolean;
  v_reason text := trim(p_reason);
  v_fee_id uuid;
  v_sug_id uuid;
begin
  select tm.* into v_actor from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.team_id = p_team_id and tm.user_id = auth.uid() and tm.status = 'active' and t.is_active;
  if v_actor is null then raise exception 'not_member'; end if;
  if p_target_member_id is null or p_amount is null or v_reason = '' then
    raise exception 'missing_fields';
  end if;
  if not exists (select 1 from public.team_members where id = p_target_member_id and team_id = p_team_id) then
    raise exception 'member_not_found';
  end if;

  select * into v_settings from public.teams where id = p_team_id;

  if not v_settings.allow_player_suggest and v_actor.role = 'player' and not v_is_admin then
    raise exception 'player_suggest_disabled';
  end if;

  v_is_self := (v_actor.id = p_target_member_id);

  if not v_is_self and not v_is_admin and v_actor.role <> 'teamadmin' then
    if p_amount > v_settings.max_fee_amount then
      raise exception 'exceeds_max_fee';
    end if;
  end if;

  if v_is_self then
    insert into public.fees (team_id, member_id, amount, reason, occurred_at, added_by, status)
    values (p_team_id, p_target_member_id, p_amount, v_reason, public.parse_fee_date(p_fee_date),
            v_actor.username || ' (oma ilmoitus)', 'active')
    returning id into v_fee_id;

    perform public.log_audit(p_team_id, 'SELF_REPORT_FEE',
      jsonb_build_object('feeId', v_fee_id, 'teamId', p_team_id, 'amount', p_amount, 'reason', v_reason));
    return jsonb_build_object('autoApproved', true, 'feeId', v_fee_id);
  end if;

  insert into public.suggestions (team_id, target_member_id, suggested_by_member_id, type, amount, reason, fee_date, status)
  values (p_team_id, p_target_member_id, v_actor.id, 'new_fee', p_amount, v_reason, p_fee_date, 'pending')
  returning id into v_sug_id;

  perform public.log_audit(p_team_id, 'SUGGEST_FEE',
    jsonb_build_object('suggestionId', v_sug_id, 'teamId', p_team_id, 'targetMemberId', p_target_member_id,
      'amount', p_amount, 'reason', v_reason));
  return jsonb_build_object('autoApproved', false, 'suggestionId', v_sug_id);
end;
$$;

create or replace function public.suggest_removal(p_team_id uuid, p_fee_id uuid, p_comment text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.team_members;
  v_fee public.fees;
  v_comment text := trim(p_comment);
  v_sug_id uuid;
begin
  select tm.* into v_actor from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.team_id = p_team_id and tm.user_id = auth.uid() and tm.status = 'active' and t.is_active;
  if v_actor is null then raise exception 'not_member'; end if;
  if p_fee_id is null or v_comment = '' then raise exception 'missing_fields'; end if;

  select * into v_fee from public.fees where id = p_fee_id and team_id = p_team_id;
  if v_fee is null then raise exception 'fee_not_found'; end if;

  insert into public.suggestions
    (team_id, target_member_id, suggested_by_member_id, type, amount, reason, related_fee_id, comment, status)
  values (p_team_id, v_fee.member_id, v_actor.id, 'removal', v_fee.amount, v_fee.reason, v_fee.id, v_comment, 'pending')
  returning id into v_sug_id;

  perform public.log_audit(p_team_id, 'SUGGEST_REMOVAL',
    jsonb_build_object('suggestionId', v_sug_id, 'teamId', p_team_id, 'feeId', p_fee_id, 'comment', v_comment));
  return v_sug_id;
end;
$$;

create or replace function public.suggest_mark_paid(p_team_id uuid, p_fee_id uuid, p_comment text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.team_members;
  v_fee public.fees;
  v_comment text := trim(p_comment);
  v_sug_id uuid;
begin
  select tm.* into v_actor from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.team_id = p_team_id and tm.user_id = auth.uid() and tm.status = 'active' and t.is_active;
  if v_actor is null then raise exception 'not_member'; end if;
  if p_fee_id is null or v_comment = '' then raise exception 'missing_fields'; end if;

  select * into v_fee from public.fees where id = p_fee_id and team_id = p_team_id;
  if v_fee is null then raise exception 'fee_not_found'; end if;

  insert into public.suggestions
    (team_id, target_member_id, suggested_by_member_id, type, amount, reason, related_fee_id, comment, status)
  values (p_team_id, v_fee.member_id, v_actor.id, 'mark_paid', v_fee.amount, v_fee.reason, v_fee.id, v_comment, 'pending')
  returning id into v_sug_id;

  perform public.log_audit(p_team_id, 'SUGGEST_MARK_PAID',
    jsonb_build_object('suggestionId', v_sug_id, 'teamId', p_team_id, 'feeId', p_fee_id, 'comment', v_comment));
  return v_sug_id;
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
  select tm.* into v_actor from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.team_id = p_team_id and tm.user_id = auth.uid() and tm.status = 'active' and t.is_active;
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

create or replace function public.vote_on_suggestion(
  p_team_id uuid, p_suggestion_id uuid, p_approve boolean, p_comment text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_sug public.suggestions;
  v_actor public.team_members;
  v_is_admin boolean := public.is_global_admin(auth.uid());
  v_is_teamadmin boolean;
  v_is_approver boolean;
  v_is_target boolean;
  v_admin_only_type boolean;
  v_vote_count int;
  v_approved boolean;
  v_threshold int;
begin
  select * into v_sug from public.suggestions where id = p_suggestion_id and team_id = p_team_id;
  if v_sug is null then raise exception 'suggestion_not_found'; end if;

  v_admin_only_type := v_sug.type in ('mark_paid', 'mark_all_paid');

  select tm.* into v_actor from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.team_id = p_team_id and tm.user_id = auth.uid() and tm.status = 'active' and t.is_active;

  v_is_teamadmin := v_is_admin or (v_actor is not null and v_actor.role = 'teamadmin');
  v_is_approver  := v_actor is not null and v_actor.role = 'approver' and not v_admin_only_type;
  v_is_target    := v_actor is not null and v_actor.id = v_sug.target_member_id;

  if not (v_is_admin or v_is_teamadmin or v_is_approver or v_is_target) then
    raise exception 'unauthorized';
  end if;
  if v_sug.status <> 'pending' then
    raise exception 'already_resolved';
  end if;
  if v_actor is not null and v_sug.suggested_by_member_id = v_actor.id then
    raise exception 'cannot_vote_own';
  end if;
  if v_actor is not null and exists (
    select 1 from public.suggestion_votes where suggestion_id = p_suggestion_id and member_id = v_actor.id
  ) then
    raise exception 'already_voted';
  end if;

  if v_is_target then
    if not p_approve then raise exception 'cannot_reject_own'; end if;
    insert into public.suggestion_votes (suggestion_id, member_id) values (p_suggestion_id, v_actor.id);
    update public.suggestions set status = 'approved', resolved_at = now() where id = p_suggestion_id;
    perform public.apply_suggestion(v_sug);
    perform public.log_audit(p_team_id, 'SELF_APPROVE_SUGGESTION',
      jsonb_build_object('suggestionId', p_suggestion_id, 'teamId', p_team_id));
    return jsonb_build_object('approved', true, 'selfApproved', true);
  end if;

  if not p_approve then
    if not (v_is_admin or v_is_teamadmin) then raise exception 'unauthorized_reject'; end if;
    update public.suggestions
      set status = 'rejected', comment = coalesce(nullif(trim(p_comment), ''), comment)
      where id = p_suggestion_id;
    perform public.log_audit(p_team_id, 'REJECT_SUGGESTION',
      jsonb_build_object('suggestionId', p_suggestion_id, 'teamId', p_team_id));
    return jsonb_build_object('approved', false, 'selfApproved', false);
  end if;

  if v_actor is not null then
    insert into public.suggestion_votes (suggestion_id, member_id) values (p_suggestion_id, v_actor.id);
  end if;

  select count(*) into v_vote_count from public.suggestion_votes where suggestion_id = p_suggestion_id;
  select vote_threshold into v_threshold from public.teams where id = p_team_id;
  v_approved := v_is_admin or v_is_teamadmin or (not v_admin_only_type and v_vote_count >= v_threshold);

  if v_approved then
    update public.suggestions set status = 'approved', resolved_at = now() where id = p_suggestion_id;
    perform public.apply_suggestion(v_sug);
  end if;

  perform public.log_audit(p_team_id, 'VOTE_SUGGESTION',
    jsonb_build_object('suggestionId', p_suggestion_id, 'teamId', p_team_id, 'approve', p_approve, 'approved', v_approved));
  return jsonb_build_object('approved', v_approved, 'selfApproved', false);
end;
$$;

create or replace function public.join_team(p_team_id uuid, p_username text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_username text := trim(p_username);
  v_left public.team_members;
  v_existing public.team_members;
  v_collision boolean;
  v_migrated int := 0;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if v_username = '' then raise exception 'missing_fields'; end if;
  if not exists (select 1 from public.teams where id = p_team_id and is_active) then
    raise exception 'not_found';
  end if;

  if exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'already_member';
  end if;

  select * into v_left from public.team_members
  where team_id = p_team_id and user_id = auth.uid() and status = 'left'
  limit 1;

  if found then
    select exists (
      select 1 from public.team_members
      where team_id = p_team_id and lower(username) = lower(v_username) and id <> v_left.id
    ) into v_collision;
    if v_collision then raise exception 'username_taken'; end if;

    update public.team_members
      set status = 'active', role = 'player', username = v_username
      where id = v_left.id;

    perform public.log_audit(p_team_id, 'REJOIN_TEAM', jsonb_build_object('teamId', p_team_id, 'username', v_username));
    return jsonb_build_object('claimed', false, 'migratedFees', 0);
  end if;

  select * into v_existing from public.team_members
  where team_id = p_team_id and lower(username) = lower(v_username)
  limit 1;

  if found then
    if v_existing.user_id is not null then
      raise exception 'username_taken';
    end if;

    update public.team_members
      set user_id = auth.uid(), status = 'active'
      where id = v_existing.id;

    select count(*) into v_migrated from public.fees where member_id = v_existing.id;
    perform public.log_audit(p_team_id, 'CLAIM_SHADOW_PROFILE',
      jsonb_build_object('teamId', p_team_id, 'username', v_username, 'migratedFees', v_migrated));
    return jsonb_build_object('claimed', true, 'migratedFees', v_migrated);
  end if;

  insert into public.team_members (team_id, user_id, username, role, status)
  values (p_team_id, auth.uid(), v_username, 'player', 'active');

  perform public.log_audit(p_team_id, 'JOIN_TEAM', jsonb_build_object('teamId', p_team_id, 'username', v_username));
  return jsonb_build_object('claimed', false, 'migratedFees', 0);
end;
$$;

-- ---------- Uusi: joukkueen poisto/palautus (GlobalAdmin) ----------

create or replace function public.set_team_active(p_team_id uuid, p_is_active boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  if not public.is_global_admin(auth.uid()) then raise exception 'unauthorized'; end if;

  select name into v_name from public.teams where id = p_team_id;
  if v_name is null then raise exception 'not_found'; end if;

  update public.teams set is_active = p_is_active where id = p_team_id;
  perform public.log_audit(p_team_id, case when p_is_active then 'RESTORE_TEAM' else 'DELETE_TEAM' end,
    jsonb_build_object('teamId', p_team_id, 'teamName', v_name));
end;
$$;

grant execute on function public.set_team_active(uuid, boolean) to authenticated;
