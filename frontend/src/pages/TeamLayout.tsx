import { Outlet, useParams } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { TeamTabs } from '../components/TeamTabs'

/** Joukkuekontekstin kehys: otsikko + välilehdet + alisivun sisältö.
 * Joukkueen tiedot (nimi, oma rooli) haetaan Supabasesta myöhemmässä
 * vaiheessa — teamId tulee toistaiseksi suoraan URL:sta. */
export function TeamLayout() {
  const { teamId } = useParams<{ teamId: string }>()

  if (!teamId) return null

  return (
    <>
      <AppHeader title="Joukkue" />
      <TeamTabs teamId={teamId} />
      <Outlet />
    </>
  )
}
