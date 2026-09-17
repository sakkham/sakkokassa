import { NavLink } from 'react-router-dom'

interface TeamTabsProps {
  teamId: string
  canSuggest: boolean
  canManage: boolean
}

/** Joukkuenäkymän välilehdet. "Ehdota" ja "Odottaa" piilossa pelaajalta jos
 * joukkue on estänyt pelaajien ehdotukset (canSuggest kattaa myös hyväksyjät/
 * ylläpitäjät, joita esto ei koske — ks. suggest_fee-RPC:n
 * player_suggest_disabled-ehto). "Odottaa" näkyy siis kaikille jotka voivat
 * ehdottaa, jotta pelaaja voi tarkistaa onko sama sakko jo odottamassa ennen
 * uuden ehdotuksen tekemistä — ei vain hyväksyjille/ylläpitäjille kuten
 * aiemmin. Äänestys-/hyväksymisoikeudet rajataan silti erikseen itse
 * Odottaa-sivulla (PendingPage), tämä säätelee vain välilehden näkyvyyttä.
 * "Hallinta" vain ylläpitäjille — kuten vanhassa Index.html:ssä. */
export function TeamTabs({ teamId, canSuggest, canManage }: TeamTabsProps) {
  const base = `/team/${teamId}`
  const tabClass = (extra?: string) => ({ isActive }: { isActive: boolean }) =>
    ['tab', isActive && 'active', extra].filter(Boolean).join(' ')

  return (
    <nav className="tabs">
      <NavLink to={base} end className={tabClass()}>Omat sakot</NavLink>
      {canSuggest && <NavLink to={`${base}/ehdota`} className={tabClass()}>Ehdota</NavLink>}
      {canSuggest && <NavLink to={`${base}/odottaa`} className={tabClass()}>Odottaa</NavLink>}
      <NavLink to={`${base}/joukkue`} className={tabClass()}>Joukkue</NavLink>
      {canManage && <NavLink to={`${base}/hallinta`} className={tabClass('tab-danger')}>Hallinta</NavLink>}
    </nav>
  )
}
