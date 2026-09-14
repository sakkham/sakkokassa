import { NavLink } from 'react-router-dom'

/** Joukkuenäkymän välilehdet. Kaikki viisi näytetään toistaiseksi aina —
 * roolikohtainen piilotus (Odottaa vain hyväksyjille, Hallinta vain
 * TeamAdminille, kuten vanhassa Index.html:ssä) lisätään kun jäsenyys-/
 * roolitieto on saatavilla joukkuekontekstista. */
export function TeamTabs({ teamId }: { teamId: string }) {
  const base = `/team/${teamId}`
  const tabClass = (extra?: string) => ({ isActive }: { isActive: boolean }) =>
    ['tab', isActive && 'active', extra].filter(Boolean).join(' ')

  return (
    <nav className="tabs">
      <NavLink to={base} end className={tabClass()}>Omat sakot</NavLink>
      <NavLink to={`${base}/ehdota`} className={tabClass()}>Ehdota</NavLink>
      <NavLink to={`${base}/odottaa`} className={tabClass()}>Odottaa</NavLink>
      <NavLink to={`${base}/joukkue`} className={tabClass()}>Joukkue</NavLink>
      <NavLink to={`${base}/hallinta`} className={tabClass('tab-danger')}>Hallinta</NavLink>
    </nav>
  )
}
