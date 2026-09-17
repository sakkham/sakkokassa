-- ============================================================
-- Sakkokassa — julkinen, kirjautumaton katselulinkki joukkueelle
-- ============================================================
-- Osa käyttäjistä karsastaa tilin luomista pelkän tilanteen
-- tarkistamiseksi. Ratkaisu: TeamAdmin voi halutessaan (OLETUKSENA
-- POIS PÄÄLTÄ) kytkeä päälle jaettavan linkin, joka näyttää pelkän
-- pelaajakohtaisen aktiivisen sakkosumman — ei yksittäisiä sakkorivejä,
-- ei ehdotuksia/äänestyksiä, ei kutsukoodia, EIKÄ rekisteröitymis-
-- statusta (ei tietoa siitä onko pelaaja "oikea" tili vai varjoprofiili
-- — tämä ei ole ulkopuolisen asia). Ei vaadi kirjautumista ollenkaan,
-- ei edes anonyymitiliä — pelkkä jaettu token, sama periaate kuin
-- kutsukoodilla mutta pelkkään katseluun liittymisen sijaan.
--
-- public_view_token on NULLABLE ja NULL oletuksena (toisin kuin
-- invite_code, joka on aina olemassa) — julkinen katselu on siis
-- eksplisiittisesti opt-in per joukkue, ei koskaan päällä vahingossa.
-- Suojattu samalla sarake-GRANT-periaatteella kuin invite_code: uutta
-- saraketta ei lisätä authenticated-roolin selkeään sarakelistaan
-- (ks. migraatio 20260916170000), joten se pysyy suoran .select():n
-- ulottumattomissa oletuksena ilman erillistä REVOKEa — vain
-- get_public_view_token()-RPC (TeamAdmin-tarkistuksella) paljastaa sen.
-- ============================================================

alter table public.teams add column public_view_token text;
create unique index teams_public_view_token_idx on public.teams (public_view_token) where public_view_token is not null;

comment on column public.teams.public_view_token is
  'Valinnainen julkisen katselulinkin token. NULL = julkinen katselu pois päältä. Ei koskaan suoraan luettavissa — ks. get_public_view_token().';

-- ---------- Ylläpidon puolen hallinta ----------

create or replace function public.get_public_view_token(p_team_id uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
declare v_token text;
begin
  if not public.has_team_role(auth.uid(), p_team_id, 'teamadmin') then
    raise exception 'unauthorized';
  end if;
  select public_view_token into v_token from public.teams where id = p_team_id;
  return v_token;
end;
$$;

-- Toimii sekä "kytke päälle" että "luo uusi linkki" -toimintona: luo
-- aina tuoreen tokenin ja korvaa mahdollisen vanhan (vanha lakkaa
-- toimimasta välittömästi, kuten kutsukoodin uusinnassa).
create or replace function public.regenerate_public_view_token(p_team_id uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if not public.has_team_role(auth.uid(), p_team_id, 'teamadmin') then
    raise exception 'unauthorized';
  end if;
  v_token := public.generate_invite_code();
  update public.teams set public_view_token = v_token where id = p_team_id;
  perform public.log_audit(p_team_id, 'REGENERATE_PUBLIC_VIEW_TOKEN', jsonb_build_object('teamId', p_team_id));
  return v_token;
end;
$$;

create or replace function public.disable_public_view(p_team_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_team_role(auth.uid(), p_team_id, 'teamadmin') then
    raise exception 'unauthorized';
  end if;
  update public.teams set public_view_token = null where id = p_team_id;
  perform public.log_audit(p_team_id, 'DISABLE_PUBLIC_VIEW', jsonb_build_object('teamId', p_team_id));
end;
$$;

grant execute on function public.get_public_view_token(uuid) to authenticated;
grant execute on function public.regenerate_public_view_token(uuid) to authenticated;
grant execute on function public.disable_public_view(uuid) to authenticated;

-- ---------- Julkinen lukukutsu (ei kirjautumista) ----------
-- Tarkoituksella hyvin suppea paluuarvo: joukkueen nimi, valuutta ja
-- pelaajat aktiivisine summineen. Ei mitään muuta kannasta — ei
-- yksittäisiä sakkoja, ei user_id:tä tai muuta joka paljastaisi onko
-- pelaaja rekisteröitynyt.

create or replace function public.get_public_team_view(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_team record;
  v_players jsonb;
begin
  select id, name, currency_symbol into v_team
    from public.teams
    where public_view_token = trim(p_token) and is_active;

  if v_team.id is null then
    raise exception 'invalid_view_token';
  end if;

  select coalesce(jsonb_agg(
      jsonb_build_object('username', t.username, 'activeTotal', t.active_total)
      order by t.active_total desc, t.username asc
    ), '[]'::jsonb)
    into v_players
  from (
    select tm.id, tm.username, coalesce(sum(f.amount) filter (where f.status = 'active'), 0) as active_total
    from public.team_members tm
    left join public.fees f on f.member_id = tm.id
    where tm.team_id = v_team.id and tm.status = 'active'
    group by tm.id, tm.username
  ) t;

  return jsonb_build_object('teamName', v_team.name, 'currencySymbol', v_team.currency_symbol, 'players', v_players);
end;
$$;

grant execute on function public.get_public_team_view(text) to anon, authenticated;
