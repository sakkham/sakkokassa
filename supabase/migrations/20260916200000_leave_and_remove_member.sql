-- ============================================================
-- Sakkokassa — jäsenen poistuminen ja ylläpitäjän poisto-oikeus
-- ============================================================
-- Kumpikaan toiminto ei ole aiemmin ollut käyttöliittymässä: leave_team
-- oli olemassa mutta ei kytketty mihinkään nappiin, eikä ylläpitäjällä
-- ollut mitään tapaa poistaa jäsentä listalta.
--
-- Käyttäjän vaatimus: itse poistuttaessa mahdolliset sakot eivät saa
-- kadota tai olla kierrettävissä. Alkuperäinen leave_team vain vaihtoi
-- statuksen 'left':ksi mutta säilytti user_id:n — tämä muutos korvaa
-- sen "varjoksi" muuttamisella (user_id NULL, rooli player), täsmälleen
-- sama mekanismi kuin ennalta rekisteröimättömillä pelaajilla: sakot ja
-- ehdotushistoria pysyvät member_id:n kautta muuttumattomina ja täysin
-- näkyvissä (Joukkue-sivu, Hallinta jne.) — jäsentä ei koskaan poisteta
-- rivitasolla jos siihen on sidottu dataa, sillä fees.member_id on
-- "on delete cascade" ja poistaisi sakkohistorian kokonaan.
--
-- Sama periaate koskee ylläpitäjän remove_member-toimintoa: rekisteröity
-- jäsen "poistetaan" muuttamalla varjoksi (ei koskaan poisteta riviä),
-- ja jo-varjo-jäsen poistetaan rivitasolla VAIN jos siihen ei ole
-- yhtään sakkoa tai ehdotusta sidottuna (muuten raise 'member_has_history').
--
-- Kumpikin estää myös joukkueen viimeisen ylläpitäjän poistumisen/poiston,
-- jotta joukkue ei jää koskaan ilman ketään joka voisi hallita sitä.
-- ============================================================

create or replace function public.leave_team(p_team_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_actor public.team_members;
  v_other_admins int;
begin
  select * into v_actor from public.team_members
    where team_id = p_team_id and user_id = auth.uid() and status = 'active';
  if v_actor is null then raise exception 'not_member'; end if;

  if v_actor.role = 'teamadmin' then
    select count(*) into v_other_admins from public.team_members
      where team_id = p_team_id and status = 'active' and role = 'teamadmin' and id <> v_actor.id;
    if v_other_admins = 0 then raise exception 'last_admin'; end if;
  end if;

  update public.team_members set user_id = null, role = 'player' where id = v_actor.id;
  perform public.log_audit(p_team_id, 'LEAVE_TEAM',
    jsonb_build_object('teamId', p_team_id, 'memberId', v_actor.id, 'username', v_actor.username));
end;
$$;

-- p_member_id = team_members.id. Palauttaa {deleted: true/false} —
-- false = jäsen muutettiin varjoksi (sakot säilyivät), true = tyhjä
-- varjorivi poistettiin kokonaan (ei koskaan mitään sidottua dataa).
create or replace function public.remove_member(p_team_id uuid, p_member_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_target public.team_members;
  v_other_admins int;
  v_has_history boolean;
begin
  if not public.has_team_role(auth.uid(), p_team_id, 'teamadmin') then
    raise exception 'unauthorized';
  end if;

  select * into v_target from public.team_members
    where id = p_member_id and team_id = p_team_id and status = 'active';
  if v_target is null then raise exception 'member_not_found'; end if;

  if v_target.user_id = auth.uid() then
    raise exception 'use_leave_instead';
  end if;

  if v_target.role = 'teamadmin' then
    select count(*) into v_other_admins from public.team_members
      where team_id = p_team_id and status = 'active' and role = 'teamadmin' and id <> v_target.id;
    if v_other_admins = 0 then raise exception 'last_admin'; end if;
  end if;

  if v_target.user_id is not null then
    update public.team_members set user_id = null, role = 'player' where id = v_target.id;
    perform public.log_audit(p_team_id, 'REMOVE_MEMBER',
      jsonb_build_object('teamId', p_team_id, 'memberId', v_target.id, 'username', v_target.username, 'deleted', false));
    return jsonb_build_object('deleted', false);
  end if;

  select exists(select 1 from public.fees where member_id = v_target.id)
      or exists(select 1 from public.suggestions where target_member_id = v_target.id or suggested_by_member_id = v_target.id)
    into v_has_history;
  if v_has_history then
    raise exception 'member_has_history';
  end if;

  delete from public.team_members where id = v_target.id;
  perform public.log_audit(p_team_id, 'REMOVE_MEMBER',
    jsonb_build_object('teamId', p_team_id, 'memberId', v_target.id, 'username', v_target.username, 'deleted', true));
  return jsonb_build_object('deleted', true);
end;
$$;

grant execute on function public.remove_member(uuid, uuid) to authenticated;
