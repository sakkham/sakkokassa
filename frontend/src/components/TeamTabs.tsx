import { NavLink } from 'react-router-dom'

interface TeamTabsProps {
  teamId: string
  canSuggest: boolean
  canApprove: boolean
  canManage: boolean
}

/** Joukkuenäkymän välilehdet. "Ehdota" piilossa pelaajalta jos joukkue on
 * estänyt pelaajien ehdotukset (canSuggest kattaa myös hyväksyjät/ylläpitäjät,
 * joita esto ei koske — ks. suggest_fee-RPC:n player_suggest_disabled-ehto),
 * "Odottaa" vain hyväksyjille/ylläpitäjille, "Hallinta" vain ylläpitäjille —
 * kuten vanhassa Index.html:ssä. */
export function TeamTabs({ teamId, canSuggest, canApprove, canManage }: TeamTabsProps) {
  const base = `/team/${teamId}`
  const tabClass = (extra?: string) => ({ isActive }: { isActive: boolean }) =>
    ['tab', isActive && 'active', extra].filter(Boolean).join(' ')

  return (
    <nav className="tabs">
      <NavLink to={base} end className={tabClass()}>Omat sakot</NavLink>
      {canSuggest && <NavLink to={`${base}/ehdota`} className={tabClass()}>Ehdota</NavLink>}
      {canApprove && <NavLink to={`${base}/odottaa`} className={tabClass()}>Odottaa</NavLink>}
      <NavLink to={`${base}/joukkue`} className={tabClass()}>Joukkue</NavLink>
      {canManage && <NavLink to={`${base}/hallinta`} className={tabClass('tab-danger')}>Hallinta</NavLink>}
    </nav>
  )
}
