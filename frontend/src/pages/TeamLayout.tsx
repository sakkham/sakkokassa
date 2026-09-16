import { useCallback, useEffect, useState } from 'react'
import { Outlet, useOutletContext, useParams } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { TeamTabs } from '../components/TeamTabs'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { TEAM_SAFE_COLUMNS, type Team, type TeamMember } from '../lib/team'

export interface TeamOutletContext {
  team: Team
  myMember: TeamMember | null
  isGlobalAdmin: boolean
  canManage: boolean
  canApprove: boolean
  refreshTeam: () => void
}

export function useTeamContext(): TeamOutletContext {
  return useOutletContext<TeamOutletContext>()
}

/** Joukkuekontekstin kehys: hakee joukkueen ja oman jäsenyyden kerran,
 * ja jakaa ne alisivuille (Outlet contextin kautta) sekä välilehtien
 * näkyvyyden päättämiseen. */
export function TeamLayout() {
  const { teamId } = useParams<{ teamId: string }>()
  const { profile } = useAuth()
  const [team, setTeam] = useState<Team | null | undefined>(undefined)
  const [myMember, setMyMember] = useState<TeamMember | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!teamId || !profile) return
    setError('')
    try {
      const [{ data: teamRow, error: teamErr }, { data: memberRow, error: memberErr }] = await Promise.all([
        supabase.from('teams').select(TEAM_SAFE_COLUMNS).eq('id', teamId).maybeSingle(),
        supabase
          .from('team_members')
          .select('*')
          .eq('team_id', teamId)
          .eq('user_id', profile.id)
          .eq('status', 'active')
          .maybeSingle(),
      ])
      if (teamErr) throw teamErr
      if (memberErr) throw memberErr
      setTeam(teamRow)
      setMyMember(memberRow)
    } catch {
      setError('Joukkueen lataus epäonnistui.')
      setTeam(null)
    }
  }, [teamId, profile])

  useEffect(() => { load() }, [load])

  if (!teamId) return null

  if (team === undefined) {
    return <div className="loading">Ladataan...</div>
  }

  if (team === null) {
    return (
      <>
        <AppHeader title="Joukkueen sakot" backTo="/dashboard" />
        <div className="page">
          <div className="card"><div className="empty">{error || 'Joukkuetta ei löydy.'}</div></div>
        </div>
      </>
    )
  }

  const isGlobalAdmin = profile?.globalRole === 'admin'

  if (!myMember && !isGlobalAdmin) {
    return (
      <>
        <AppHeader title={team.name} backTo="/dashboard" />
        <div className="page">
          <div className="card"><div className="empty">Et ole tämän joukkueen jäsen.</div></div>
        </div>
      </>
    )
  }

  const canManage = isGlobalAdmin || myMember?.role === 'teamadmin'
  const canApprove = canManage || myMember?.role === 'approver'

  return (
    <>
      <AppHeader title={team.name} backTo="/dashboard" />
      <TeamTabs teamId={teamId} canApprove={canApprove} canManage={canManage} />
      <Outlet context={{ team, myMember, isGlobalAdmin, canManage, canApprove, refreshTeam: load } satisfies TeamOutletContext} />
    </>
  )
}
