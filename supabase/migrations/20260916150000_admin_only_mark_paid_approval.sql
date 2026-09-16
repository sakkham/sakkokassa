-- ============================================================
-- Joukkueen sakot — "Maksettu"-tyyppiset ehdotukset vain ylläpitäjän
-- hyväksyttävissä, eivät äänestettävissä kynnysarvolla
-- ============================================================
-- Käyttäjän päätös: "mark_paid" ja "mark_all_paid" -ehdotukset saa
-- hyväksyä vain TeamAdmin/GlobalAdmin — tavalliset Approverit eivät
-- voi enää äänestää niitä kasaan äänikynnyksellä. "removal" (poisto-
-- pyyntö) pysyy ennallaan äänestettävänä, koska se voi koskea
-- kiistanalaista tilannetta jota halutaan voida "haastaa" yhteisön
-- äänin — maksettu-väite sen sijaan on joko tosi tai ei, ja sen
-- vahvistaminen kuuluu ylläpidolle, ei enemmistöäänestykselle.
--
-- Kohde saa silti aina hyväksyä oman sakkonsa (isTarget-itsehyväksyntä
-- ei muutu) — rajoitus koskee vain ulkopuolisten Approverien ääniä.
-- ============================================================

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

  select * into v_actor from public.team_members
    where team_id = p_team_id and user_id = auth.uid() and status = 'active';

  v_is_teamadmin := v_is_admin or (v_actor is not null and v_actor.role = 'teamadmin');
  -- Approverin äänioikeus ei koske maksettu-tyyppisiä ehdotuksia.
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
