-- ============================================================
-- Joukkueen sakot — kirjoitusfunktiot (RPC)
-- ============================================================
-- Kaikki kirjoitukset (INSERT/UPDATE/DELETE) tehdään näiden
-- SECURITY DEFINER -funktioiden kautta — ne ohittavat RLS:n ja
-- tekevät itse samat oikeustarkistukset kuin vanha Code.gs teki
-- (esim. _hasTeamRole, _isGlobalAdmin). Frontend kutsuu näitä
-- supabase.rpc('funktion_nimi', {...}).
--
-- Virheet palautetaan `raise exception '<koodi>'` -muodossa samoilla
-- koodeilla kuin vanha errMsg()-mäppäys Index.html:ssä käytti
-- (esim. 'unauthorized', 'missing_fields', 'already_voted') — sama
-- suomenkielinen virheviestitaulukko voidaan siis käyttää sellaisenaan
-- frontendissä (error.message Supabase-vastauksesta).
--
-- TURVALLISUUSHUOMIO: Postgresissa funktion EXECUTE-oikeus on
-- oletuksena PUBLIC:lla (kaikilla rooleilla), ellei sitä nimenomaisesti
-- perata pois. Tämän tiedoston lopussa jokaiselle asiakaspuolelta
-- kutsuttavalle funktiolle myönnetään EXECUTE vain `authenticated`-
-- roolille, ja sisäisille apufunktioille (apply_suggestion, log_audit,
-- parse_fee_date, display_name) sekä edellisen migraation trigger-
-- funktiolle (handle_new_user) oikeus perutaan PUBLIC:lta kokonaan,
-- koska niitä ei ole tarkoitettu kutsuttavaksi suoraan asiakkaalta.
-- ============================================================

-- ============================================================
-- APUFUNKTIOT (eivät julkisia RPC-nimiä — käytetään vain muiden
-- funktioiden sisältä)
-- ============================================================

-- Kirjaa toimintolokiin; ei koskaan kaada varsinaista operaatiota
-- vaikka lokitus epäonnistuisi (vastaa Code.gs:n audit()-funktion
-- try/catch-nielaisua).
create or replace function public.log_audit(p_team_id uuid, p_action text, p_details jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (team_id, actor_id, action, details)
  values (p_team_id, auth.uid(), p_action, p_details);
exception when others then
  null;
end;
$$;

-- Sakon päivämäärän muunto: puolipäivä UTC:ssa, jotta aikavyöhyke ei
-- siirrä päivää väärin (vastaa Code.gs:n _parseFeeDate). NULL -> nyt.
create or replace function public.parse_fee_date(p_date date)
returns timestamptz
language sql stable as $$
  select coalesce((p_date::text || ' 12:00:00+00')::timestamptz, now());
$$;

-- Näyttönimi joukkueen kontekstissa: joukkueen oma käyttäjänimi jos
-- käyttäjä on (yhä) jäsen, muuten profiilin globaali tunnus.
-- Vastaa Code.gs:n toistuvaa "member ? member.Username : actorUserID" -kaavaa.
create or replace function public.display_name(p_team_id uuid, p_user_id uuid)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select username from public.team_members
       where team_id = p_team_id and user_id = p_user_id and status = 'active' limit 1),
    (select username from public.profiles where id = p_user_id)
  );
$$;

-- Suorittaa hyväksytyn ehdotuksen vaikutuksen (vastaa Code.gs:n
-- _applySuggestion). Ei julkinen RPC — kutsutaan vain vote_on_suggestion:ista.
-- related_fee_id osoittaa suoraan kohdesakkoon, joten poisto/maksettu ei
-- voi enää osua väärään riviin kuten vanha syy+summa-täsmäytys saattoi.
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
  end if;
end;
$$;

-- ============================================================
-- TEAMS
-- ============================================================

create or replace function public.create_team(p_name text, p_creator_username text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid;
  v_name text := trim(p_name);
  v_username text := trim(p_creator_username);
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if v_name = '' or v_username = '' then raise exception 'missing_fields'; end if;

  insert into public.teams (name) values (v_name) returning id into v_team_id;

  insert into public.team_members (team_id, user_id, username, role, status)
  values (v_team_id, auth.uid(), v_username, 'teamadmin', 'active');

  perform public.log_audit(v_team_id, 'CREATE_TEAM',
    jsonb_build_object('teamId', v_team_id, 'teamName', v_name, 'creatorUsername', v_username));
  return v_team_id;
end;
$$;

-- Liittyminen joukkueeseen. Käsittelee kolme tapausta samassa
-- järjestyksessä kuin vanha joinTeam(): 1) oma vanha "left"-rivi
-- (uudelleenliittyminen), 2) olemassa oleva shadow-profiili samalla
-- nimellä (vaatiminen — sakot siirtyvät automaattisesti koska ne
-- viittaavat member_id:hen), 3) täysin uusi jäsenyys.
--
-- HUOM (tietoinen korjaus vanhaan verrattuna): vanha koodi vertasi
-- "onko nimi varattu" -tarkistuksessa myös käyttäjän OMAA vanhaa
-- left-riviä, jolloin uudelleenliittyminen samalla nimellä olisi
-- virheellisesti palauttanut "username_taken". Tässä versiossa oma
-- vanha rivi jätetään pois törmäystarkistuksesta.
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

create or replace function public.leave_team(p_team_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from public.team_members
    where team_id = p_team_id and user_id = auth.uid() and status = 'active';
  if v_id is null then raise exception 'not_member'; end if;

  update public.team_members set status = 'left' where id = v_id;
  perform public.log_audit(p_team_id, 'LEAVE_TEAM', jsonb_build_object('teamId', p_team_id));
end;
$$;

-- p_member_id = team_members.id (frontendillä on tämä jo rosterista,
-- joten ei tarvita vanhan koodin UserID/username-arvausta).
create or replace function public.set_team_role(p_team_id uuid, p_member_id uuid, p_new_role text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_old_role text;
begin
  if not public.has_team_role(auth.uid(), p_team_id, 'teamadmin') then
    raise exception 'unauthorized';
  end if;
  if p_new_role not in ('player','approver','teamadmin') then
    raise exception 'invalid_role';
  end if;

  select role into v_old_role from public.team_members
    where id = p_member_id and team_id = p_team_id;
  if v_old_role is null then raise exception 'member_not_found'; end if;

  update public.team_members set role = p_new_role where id = p_member_id;
  perform public.log_audit(p_team_id, 'SET_TEAM_ROLE',
    jsonb_build_object('teamId', p_team_id, 'memberId', p_member_id, 'oldRole', v_old_role, 'newRole', p_new_role));
end;
$$;

create or replace function public.set_global_admin(p_target_user_id uuid, p_make_admin boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_global_admin(auth.uid()) then raise exception 'unauthorized'; end if;
  if not exists (select 1 from public.profiles where id = p_target_user_id) then
    raise exception 'user_not_found';
  end if;

  update public.profiles set global_role = case when p_make_admin then 'admin' else 'user' end
    where id = p_target_user_id;
  perform public.log_audit(null, 'SET_GLOBAL_ADMIN',
    jsonb_build_object('targetUserId', p_target_user_id, 'makeAdmin', p_make_admin));
end;
$$;

-- ============================================================
-- FEES
-- ============================================================

create or replace function public.add_fee(
  p_team_id uuid, p_target_member_id uuid, p_amount numeric, p_reason text,
  p_quantity int default 1, p_fee_date date default null
) returns uuid[]
language plpgsql security definer set search_path = public as $$
declare
  v_reason text := trim(p_reason);
  v_added_by text;
  v_qty int := greatest(1, least(99, coalesce(p_quantity, 1)));
  v_ts timestamptz := public.parse_fee_date(p_fee_date);
  v_ids uuid[] := '{}';
  v_id uuid;
begin
  if not public.has_team_role(auth.uid(), p_team_id, 'teamadmin') then
    raise exception 'unauthorized';
  end if;
  if p_target_member_id is null or p_amount is null or v_reason = '' then
    raise exception 'missing_fields';
  end if;
  if not exists (select 1 from public.team_members where id = p_target_member_id and team_id = p_team_id) then
    raise exception 'member_not_found';
  end if;

  v_added_by := public.display_name(p_team_id, auth.uid());

  for i in 1..v_qty loop
    insert into public.fees (team_id, member_id, amount, reason, occurred_at, added_by, status)
    values (p_team_id, p_target_member_id, p_amount, v_reason, v_ts, v_added_by, 'active')
    returning id into v_id;
    v_ids := array_append(v_ids, v_id);
  end loop;

  perform public.log_audit(p_team_id, 'ADD_FEE',
    jsonb_build_object('feeIds', v_ids, 'teamId', p_team_id, 'targetMemberId', p_target_member_id,
      'amount', p_amount, 'reason', v_reason, 'qty', v_qty));
  return v_ids;
end;
$$;

-- Lisää sakon käyttäjänimelle joka ei ole vielä rekisteröitynyt —
-- luo tarvittaessa shadow-jäsenyyden (user_id NULL).
create or replace function public.add_fee_to_username(
  p_team_id uuid, p_target_username text, p_amount numeric, p_reason text,
  p_quantity int default 1, p_fee_date date default null
) returns uuid[]
language plpgsql security definer set search_path = public as $$
declare
  v_username text := trim(p_target_username);
  v_reason text := trim(p_reason);
  v_member_id uuid;
  v_added_by text;
  v_qty int := greatest(1, least(99, coalesce(p_quantity, 1)));
  v_ts timestamptz := public.parse_fee_date(p_fee_date);
  v_ids uuid[] := '{}';
  v_id uuid;
begin
  if not public.has_team_role(auth.uid(), p_team_id, 'teamadmin') then
    raise exception 'unauthorized';
  end if;
  if v_username = '' or p_amount is null or v_reason = '' then
    raise exception 'missing_fields';
  end if;

  select id into v_member_id from public.team_members
    where team_id = p_team_id and lower(username) = lower(v_username);

  if v_member_id is null then
    insert into public.team_members (team_id, user_id, username, role, status)
    values (p_team_id, null, v_username, 'player', 'active')
    returning id into v_member_id;
  end if;

  v_added_by := public.display_name(p_team_id, auth.uid());

  for i in 1..v_qty loop
    insert into public.fees (team_id, member_id, amount, reason, occurred_at, added_by, status)
    values (p_team_id, v_member_id, p_amount, v_reason, v_ts, v_added_by, 'active')
    returning id into v_id;
    v_ids := array_append(v_ids, v_id);
  end loop;

  perform public.log_audit(p_team_id, 'ADD_FEE_TO_USERNAME',
    jsonb_build_object('feeIds', v_ids, 'teamId', p_team_id, 'targetUsername', v_username,
      'amount', p_amount, 'reason', v_reason, 'qty', v_qty));
  return v_ids;
end;
$$;

create or replace function public.delete_fee(p_team_id uuid, p_fee_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_team_role(auth.uid(), p_team_id, 'teamadmin') then
    raise exception 'unauthorized';
  end if;
  if not exists (select 1 from public.fees where id = p_fee_id and team_id = p_team_id) then
    raise exception 'fee_not_found';
  end if;

  update public.fees set status = 'deleted' where id = p_fee_id;
  perform public.log_audit(p_team_id, 'DELETE_FEE', jsonb_build_object('feeId', p_fee_id, 'teamId', p_team_id));
end;
$$;

create or replace function public.archive_season(p_team_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not public.has_team_role(auth.uid(), p_team_id, 'teamadmin') then
    raise exception 'unauthorized';
  end if;

  with updated as (
    update public.fees set status = 'archived'
    where team_id = p_team_id and status = 'active'
    returning 1
  )
  select count(*) into v_count from updated;

  perform public.log_audit(p_team_id, 'ARCHIVE_SEASON', jsonb_build_object('teamId', p_team_id, 'feesArchived', v_count));
  return v_count;
end;
$$;

create or replace function public.bulk_move_fees(p_team_id uuid, p_from_member_id uuid, p_to_member_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not public.has_team_role(auth.uid(), p_team_id, 'teamadmin') then
    raise exception 'unauthorized';
  end if;
  if not exists (select 1 from public.team_members where id = p_to_member_id and team_id = p_team_id) then
    raise exception 'member_not_found';
  end if;

  with updated as (
    update public.fees set member_id = p_to_member_id
    where team_id = p_team_id and member_id = p_from_member_id
    returning 1
  )
  select count(*) into v_count from updated;

  perform public.log_audit(p_team_id, 'BULK_MOVE_FEES',
    jsonb_build_object('teamId', p_team_id, 'fromMemberId', p_from_member_id, 'toMemberId', p_to_member_id, 'count', v_count));
  return v_count;
end;
$$;

-- ============================================================
-- FEE_TYPES (sakkotyypit)
-- ============================================================

-- Uusi syy luodaan; jo olemassa oleva sama syy (per joukkue) päivittää
-- vain oletussumman sen sijaan että epäonnistuisi UNIQUE-törmäykseen —
-- selkeämpi käytös kuin vanha koodi, jossa duplikaatit olisivat olleet
-- mahdollisia rivien tasolla.
create or replace function public.add_fee_type(p_team_id uuid, p_reason text, p_default_amount numeric)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_reason text := trim(p_reason);
  v_id uuid;
begin
  if not public.has_team_role(auth.uid(), p_team_id, 'teamadmin') then
    raise exception 'unauthorized';
  end if;
  if v_reason = '' or p_default_amount is null or p_default_amount < 0 then
    raise exception 'missing_fields';
  end if;

  insert into public.fee_types (team_id, reason, default_amount)
  values (p_team_id, v_reason, p_default_amount)
  on conflict (team_id, reason) do update set default_amount = excluded.default_amount
  returning id into v_id;

  perform public.log_audit(p_team_id, 'ADD_FEELIST_ITEM',
    jsonb_build_object('teamId', p_team_id, 'reason', v_reason, 'defaultAmount', p_default_amount));
  return v_id;
end;
$$;

create or replace function public.delete_fee_type(p_fee_type_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid;
  v_reason text;
begin
  select team_id, reason into v_team_id, v_reason from public.fee_types where id = p_fee_type_id;
  if v_team_id is null then raise exception 'not_found'; end if;
  if not public.has_team_role(auth.uid(), v_team_id, 'teamadmin') then
    raise exception 'unauthorized';
  end if;

  delete from public.fee_types where id = p_fee_type_id;
  perform public.log_audit(v_team_id, 'DELETE_FEELIST_ITEM', jsonb_build_object('teamId', v_team_id, 'reason', v_reason));
end;
$$;

-- ============================================================
-- TEAM SETTINGS
-- Osittainen päivitys: NULL-parametri = "älä muuta tätä asetusta".
-- Lukeminen ei tarvitse RPC:tä — teams-rivi on jo luettavissa RLS:n
-- kautta joukkueen jäsenille.
-- ============================================================

create or replace function public.save_team_settings(
  p_team_id uuid,
  p_vote_threshold int default null,
  p_allow_player_suggest boolean default null,
  p_currency_symbol text default null,
  p_season_name text default null,
  p_max_fee_amount numeric default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_team_role(auth.uid(), p_team_id, 'teamadmin') then
    raise exception 'unauthorized';
  end if;
  if p_vote_threshold is not null and (p_vote_threshold < 1 or p_vote_threshold > 20) then
    raise exception 'invalid_vote_threshold';
  end if;
  if p_max_fee_amount is not null and p_max_fee_amount < 1 then
    raise exception 'invalid_max_fee';
  end if;

  update public.teams set
    vote_threshold = coalesce(p_vote_threshold, vote_threshold),
    allow_player_suggest = coalesce(p_allow_player_suggest, allow_player_suggest),
    currency_symbol = coalesce(nullif(trim(p_currency_symbol), ''), currency_symbol),
    season_name = coalesce(p_season_name, season_name),
    max_fee_amount = coalesce(p_max_fee_amount, max_fee_amount)
  where id = p_team_id;

  perform public.log_audit(p_team_id, 'SAVE_TEAM_SETTINGS', jsonb_build_object(
    'teamId', p_team_id, 'voteThreshold', p_vote_threshold, 'allowPlayerSuggest', p_allow_player_suggest,
    'currencySymbol', p_currency_symbol, 'seasonName', p_season_name, 'maxFeeAmount', p_max_fee_amount));
end;
$$;

-- ============================================================
-- SUGGESTIONS (ehdotukset ja äänestys)
-- ============================================================

-- HUOM: toisin kuin vanha koodi, tämä vaatii ehdottajalta oikean
-- joukkuejäsenyyden (ei riitä pelkkä GlobalAdmin-oikeus ilman
-- jäsenyyttä) — ehdotukset viittaavat aina team_members-riviin, ja
-- jäsenyydettömän adminin tapauksessa oikea työkalu on add_fee, joka
-- lisää sakon suoraan ilman äänestystä.
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
  select * into v_actor from public.team_members
    where team_id = p_team_id and user_id = auth.uid() and status = 'active';
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
  select * into v_actor from public.team_members
    where team_id = p_team_id and user_id = auth.uid() and status = 'active';
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
  select * into v_actor from public.team_members
    where team_id = p_team_id and user_id = auth.uid() and status = 'active';
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

-- Äänestys. Kohde saa aina hyväksyä oman sakkonsa suoraan. TeamAdmin/
-- GlobalAdmin hyväksyy/hylkää suoraan. Approver/Player-äänet kartuttavat
-- suggestion_votes-taulua kunnes joukkueen vote_threshold täyttyy, jolloin
-- ehdotus hyväksytään automaattisesti (apply_suggestion). Jäsenyydetön
-- GlobalAdmin voi äänestää (hyväksyntä astuu voimaan heti) ilman että
-- ääni tallentuu suggestion_votes-tauluun, koska taulun member_id ei
-- salli NULL-arvoa eikä sen laskentaa admin-hyväksynnässä muutenkaan tarvita.
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
  v_vote_count int;
  v_approved boolean;
  v_threshold int;
begin
  select * into v_sug from public.suggestions where id = p_suggestion_id and team_id = p_team_id;
  if v_sug is null then raise exception 'suggestion_not_found'; end if;

  select * into v_actor from public.team_members
    where team_id = p_team_id and user_id = auth.uid() and status = 'active';

  v_is_teamadmin := v_is_admin or (v_actor is not null and v_actor.role = 'teamadmin');
  v_is_approver  := v_actor is not null and v_actor.role = 'approver';
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
  v_approved := v_is_admin or v_is_teamadmin or v_vote_count >= v_threshold;

  if v_approved then
    update public.suggestions set status = 'approved', resolved_at = now() where id = p_suggestion_id;
    perform public.apply_suggestion(v_sug);
  end if;

  perform public.log_audit(p_team_id, 'VOTE_SUGGESTION',
    jsonb_build_object('suggestionId', p_suggestion_id, 'teamId', p_team_id, 'approve', p_approve, 'approved', v_approved));
  return jsonb_build_object('approved', v_approved, 'selfApproved', false);
end;
$$;

-- ============================================================
-- OIKEUKSIEN SIIVOUS
-- Postgresissa funktion EXECUTE on oletuksena PUBLIC:lla — perutaan
-- se sisäisiltä apufunktioilta (ja edellisen migraation trigger-
-- funktiolta), ja myönnetään julkiset RPC:t vain authenticated-roolille.
-- ============================================================
revoke execute on function public.log_audit(uuid, text, jsonb) from public;
revoke execute on function public.parse_fee_date(date) from public;
revoke execute on function public.display_name(uuid, uuid) from public;
revoke execute on function public.apply_suggestion(public.suggestions) from public;
revoke execute on function public.handle_new_user() from public;

grant execute on function public.create_team(text, text) to authenticated;
grant execute on function public.join_team(uuid, text) to authenticated;
grant execute on function public.leave_team(uuid) to authenticated;
grant execute on function public.set_team_role(uuid, uuid, text) to authenticated;
grant execute on function public.set_global_admin(uuid, boolean) to authenticated;
grant execute on function public.add_fee(uuid, uuid, numeric, text, int, date) to authenticated;
grant execute on function public.add_fee_to_username(uuid, text, numeric, text, int, date) to authenticated;
grant execute on function public.delete_fee(uuid, uuid) to authenticated;
grant execute on function public.archive_season(uuid) to authenticated;
grant execute on function public.bulk_move_fees(uuid, uuid, uuid) to authenticated;
grant execute on function public.add_fee_type(uuid, text, numeric) to authenticated;
grant execute on function public.delete_fee_type(uuid) to authenticated;
grant execute on function public.save_team_settings(uuid, int, boolean, text, text, numeric) to authenticated;
grant execute on function public.suggest_fee(uuid, uuid, numeric, text, date) to authenticated;
grant execute on function public.suggest_removal(uuid, uuid, text) to authenticated;
grant execute on function public.suggest_mark_paid(uuid, uuid, text) to authenticated;
grant execute on function public.vote_on_suggestion(uuid, uuid, boolean, text) to authenticated;
