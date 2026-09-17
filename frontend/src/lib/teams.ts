import { supabase } from './supabaseClient'

export interface TeamSummary {
  teamId: string
  teamName: string
  role: string
  username: string
  myFeeSum: number
  currencySymbol: string
  /** GlobalAdmin katsomassa joukkuetta, jonka jäsen hän ei ole — ei omaa
   * jäsenrivi/sakkohistoriaa, näytetään silti hallintaoikeudet. */
  isVirtualAdmin: boolean
}

export interface ActiveTeam {
  id: string
  name: string
  currencySymbol: string
}

/** Kaikki aktiiviset joukkueet. Käytännössä vain GlobalAdmin saa tästä
 * mitään — RLS (is_team_member) suodattaa muilta pois kaikki joukkueet
 * joiden jäseniä he eivät ole. Liittyminen ei enää käytä tätä (ks.
 * JoinTeamModal) — kutsukoodijärjestelmän jälkeen ei ole tarkoituskaan
 * näyttää joukkueiden nimiä kenellekään ennen liittymistä. */
export async function fetchActiveTeams(): Promise<ActiveTeam[]> {
  const { data, error } = await supabase.from('teams').select('id, name, currency_symbol').eq('is_active', true)
  if (error) throw error
  return (data ?? []).map((t) => ({ id: t.id, name: t.name, currencySymbol: t.currency_symbol }))
}

/** Dashboardin joukkuelista: omat jäsenyydet + (GlobalAdminille) loput
 * aktiiviset joukkueet, joissa hän ei ole vielä jäsen. Vastaa vanhan
 * Code.gs:n getMyTeams()-funktiota, ilman odottavien ehdotusten laskentaa
 * (ei vielä tarpeen dashboardissa). */
export async function fetchDashboardTeams(
  userId: string,
  isGlobalAdmin: boolean,
  fallbackUsername: string,
): Promise<TeamSummary[]> {
  const { data: memberships, error: memErr } = await supabase
    .from('team_members')
    .select('id, team_id, username, role, teams(name, currency_symbol)')
    .eq('user_id', userId)
    .eq('status', 'active')
  if (memErr) throw memErr

  const rows = memberships ?? []
  const memberTeamIds = new Set(rows.map((m) => m.team_id))

  const memberIds = rows.map((m) => m.id)
  const feeSumByMember = new Map<string, number>()
  if (memberIds.length > 0) {
    const { data: fees, error: feesErr } = await supabase
      .from('fees')
      .select('member_id, amount')
      .in('member_id', memberIds)
      .eq('status', 'active')
    if (feesErr) throw feesErr
    for (const f of fees ?? []) {
      feeSumByMember.set(f.member_id, (feeSumByMember.get(f.member_id) ?? 0) + Number(f.amount))
    }
  }

  const fromMemberships: TeamSummary[] = rows.map((m) => ({
    teamId: m.team_id,
    teamName: m.teams?.name ?? m.team_id,
    role: m.role,
    username: m.username,
    myFeeSum: feeSumByMember.get(m.id) ?? 0,
    currencySymbol: m.teams?.currency_symbol ?? '€',
    isVirtualAdmin: false,
  }))

  if (!isGlobalAdmin) return fromMemberships

  const allActive = await fetchActiveTeams()
  const extra: TeamSummary[] = allActive
    .filter((t) => !memberTeamIds.has(t.id))
    .map((t) => ({
      teamId: t.id,
      teamName: t.name,
      role: 'teamadmin',
      username: fallbackUsername,
      myFeeSum: 0,
      currencySymbol: t.currencySymbol,
      isVirtualAdmin: true,
    }))

  return [...fromMemberships, ...extra]
}
