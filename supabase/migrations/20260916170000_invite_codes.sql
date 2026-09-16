-- ============================================================
-- Joukkueen sakot — kutsukoodijärjestelmä
-- ============================================================
-- Poistaa avoimen liittymisen: aiemmin join_team otti vastaan
-- team_id:n ja kuka tahansa kirjautunut käyttäjä näki kaikkien
-- aktiivisten joukkueiden NIMET valmiina listana liittymismodaalissa
-- (teams_select-RLS salli is_active=true -rivit kenelle tahansa,
-- riippumatta jäsenyydestä). Nyt liittyminen vaatii 8-merkkisen
-- kutsukoodin, jonka TeamAdmin jakaa joukkueen ulkopuolella (esim.
-- WhatsApp/Discord) — joukkueiden olemassaoloa tai nimiä ei enää
-- listata kenellekään joka ei jo ole jäsen (tai GlobalAdmin).
--
-- invite_code on suojattu KAKSI kertaa:
--  1) sarakekohtainen GRANT-esto: authenticated/anon eivät voi lukea
--     teams.invite_code -saraketta ollenkaan suoralla SELECTillä,
--     vaikka RLS päästäisi rivin läpi (esim. oman joukkueen rivi).
--     Koodi paljastuu vain get_invite_code()-funktion kautta, joka
--     tekee oman TeamAdmin/GlobalAdmin-tarkistuksensa.
--  2) join_team itse on SECURITY DEFINER ja ohittaa RLS:n kokonaan
--     koodin täsmäytyksessä, joten kutsuja ei tarvitse koskaan lukea
--     teams-riviä suoraan liittyäkseen.
-- ============================================================

create or replace function public.generate_invite_code()
returns text
language plpgsql volatile as $$
declare
  -- Ei O/0/I/1/L-sekaannusta aiheuttavia merkkejä.
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
  end loop;
  return result;
end;
$$;

alter table public.teams add column invite_code text;
update public.teams set invite_code = public.generate_invite_code() where invite_code is null;
alter table public.teams alter column invite_code set not null;
alter table public.teams alter column invite_code set default public.generate_invite_code();
create unique index teams_invite_code_idx on public.teams (invite_code);

comment on column public.teams.invite_code is
  'Kutsukoodi liittymiseen. Ei koskaan luettavissa suoraan (ks. sarake-REVOKE alla) — vain get_invite_code()/regenerate_invite_code() kautta.';

-- Sarakekohtainen esto: kukaan (anon/authenticated) ei saa lukea
-- invite_code-saraketta suoralla .select()-kutsulla, vaikka rivi itse
-- olisi RLS:n mukaan näkyvä (esim. oman joukkueensa rivi).
--
-- HUOM: pelkkä "revoke select (invite_code) ..." EI riitä — Supabasen
-- oletus-ACL myöntää authenticated/anon-rooleille koko taulun kattavan
-- SELECT-oikeuden (ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES),
-- ja taulutason SELECT-oikeus kattaa kaikki sarakkeet riippumatta
-- sarakekohtaisesta REVOKEsta — Postgres ei "kavenna" laajempaa oikeutta
-- kapeammalla revokella. Siksi koko taulutason SELECT perutaan ensin ja
-- myönnetään sitten uudelleen vain turvallisille sarakkeille.
revoke select on public.teams from anon, authenticated;
grant select (
  id, name, is_active, vote_threshold, allow_player_suggest,
  currency_symbol, season_name, max_fee_amount, created_at
) on public.teams to authenticated;

-- Joukkueiden listaus tiukemmaksi: vain oman joukkueen jäsen (tai
-- GlobalAdmin, jonka is_team_member ohittaa aina) näkee teams-rivin
-- ollenkaan. Ei enää "is_active OR ..." -oikotietä, joka päästi
-- kenet tahansa selaamaan kaikkien aktiivisten joukkueiden nimiä.
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select using (public.is_team_member(auth.uid(), id));

-- ---------- Kutsukoodin näyttäminen/uusiminen (Hallinta) ----------

create or replace function public.get_invite_code(p_team_id uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_code text;
begin
  if not public.has_team_role(auth.uid(), p_team_id, 'teamadmin') then
    raise exception 'unauthorized';
  end if;
  select invite_code into v_code from public.teams where id = p_team_id;
  return v_code;
end;
$$;

create or replace function public.regenerate_invite_code(p_team_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if not public.has_team_role(auth.uid(), p_team_id, 'teamadmin') then
    raise exception 'unauthorized';
  end if;
  v_code := public.generate_invite_code();
  update public.teams set invite_code = v_code where id = p_team_id;
  perform public.log_audit(p_team_id, 'REGENERATE_INVITE_CODE', jsonb_build_object('teamId', p_team_id));
  return v_code;
end;
$$;

grant execute on function public.get_invite_code(uuid) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;

-- ---------- create_team palauttaa nyt myös kutsukoodin ----------

drop function if exists public.create_team(text, text);

create or replace function public.create_team(p_name text, p_creator_username text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid;
  v_code text;
  v_name text := trim(p_name);
  v_username text := trim(p_creator_username);
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if v_name = '' or v_username = '' then raise exception 'missing_fields'; end if;

  insert into public.teams (name) values (v_name) returning id, invite_code into v_team_id, v_code;

  insert into public.team_members (team_id, user_id, username, role, status)
  values (v_team_id, auth.uid(), v_username, 'teamadmin', 'active');

  perform public.log_audit(v_team_id, 'CREATE_TEAM',
    jsonb_build_object('teamId', v_team_id, 'teamName', v_name, 'creatorUsername', v_username));
  return jsonb_build_object('teamId', v_team_id, 'inviteCode', v_code);
end;
$$;

grant execute on function public.create_team(text, text) to authenticated;

-- ---------- join_team ottaa nyt kutsukoodin, ei team_id:tä ----------

drop function if exists public.join_team(uuid, text);

create or replace function public.join_team(p_invite_code text, p_username text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_username text := trim(p_username);
  v_code text := upper(trim(p_invite_code));
  v_team_id uuid;
  v_left public.team_members;
  v_existing public.team_members;
  v_collision boolean;
  v_migrated int := 0;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if v_code = '' or v_username = '' then raise exception 'missing_fields'; end if;

  select id into v_team_id from public.teams where invite_code = v_code and is_active;
  if v_team_id is null then raise exception 'invalid_invite_code'; end if;

  if exists (
    select 1 from public.team_members
    where team_id = v_team_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'already_member';
  end if;

  select * into v_left from public.team_members
  where team_id = v_team_id and user_id = auth.uid() and status = 'left'
  limit 1;

  if found then
    select exists (
      select 1 from public.team_members
      where team_id = v_team_id and lower(username) = lower(v_username) and id <> v_left.id
    ) into v_collision;
    if v_collision then raise exception 'username_taken'; end if;

    update public.team_members
      set status = 'active', role = 'player', username = v_username
      where id = v_left.id;

    perform public.log_audit(v_team_id, 'REJOIN_TEAM', jsonb_build_object('teamId', v_team_id, 'username', v_username));
    return jsonb_build_object('claimed', false, 'migratedFees', 0);
  end if;

  select * into v_existing from public.team_members
  where team_id = v_team_id and lower(username) = lower(v_username)
  limit 1;

  if found then
    if v_existing.user_id is not null then
      raise exception 'username_taken';
    end if;

    update public.team_members
      set user_id = auth.uid(), status = 'active'
      where id = v_existing.id;

    select count(*) into v_migrated from public.fees where member_id = v_existing.id;
    perform public.log_audit(v_team_id, 'CLAIM_SHADOW_PROFILE',
      jsonb_build_object('teamId', v_team_id, 'username', v_username, 'migratedFees', v_migrated));
    return jsonb_build_object('claimed', true, 'migratedFees', v_migrated);
  end if;

  insert into public.team_members (team_id, user_id, username, role, status)
  values (v_team_id, auth.uid(), v_username, 'player', 'active');

  perform public.log_audit(v_team_id, 'JOIN_TEAM', jsonb_build_object('teamId', v_team_id, 'username', v_username));
  return jsonb_build_object('claimed', false, 'migratedFees', 0);
end;
$$;

grant execute on function public.join_team(text, text) to authenticated;
