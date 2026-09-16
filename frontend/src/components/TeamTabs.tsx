import { NavLink } from 'react-router-dom'

interface TeamTabsProps {
  teamId: string
  canApprove: boolean
  canManage: boolean
}

/** Joukkuenäkymän välilehdet. "Odottaa" vain hyväksyjille/ylläpitäjille,
 * "Hallinta" vain ylläpitäjille — kuten vanhassa Index.html:ssä. */
export function TeamTabs({ teamId, canApprove, canManage }: TeamTabsProps) {
  const base = `/team/${teamId}`
  const tabClass = (extra?: string) => ({ isActive }: { isActive: boolean }) =>
    ['tab', isActive && 'active', extra].filter(Boolean).join(' ')

  return (
    <nav className="tabs">
      <NavLink to={base} end className={tabClass()}>Omat sakot</NavLink>
      <NavLink to={`${base}/ehdota`} className={tabClass()}>Ehdota</NavLink>
      {canApprove && <NavLink to={`${base}/odottaa`} className={tabClass()}>Odottaa</NavLink>}
      <NavLink to={`${base}/joukkue`} className={tabClass()}>Joukkue</NavLink>
      {canManage && <NavLink to={`${base}/hallinta`} className={tabClass('tab-danger')}>Hallinta</NavLink>}
    </nav>
  )
}
