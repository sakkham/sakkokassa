import { AppHeader } from '../components/AppHeader'
import { useAuth } from '../context/AuthContext'

/** Joukkuelistaus. Sakkosummat, roolit ja liittymis-/luontitoiminnot
 * kytketään Supabaseen myöhemmässä vaiheessa — tässä vain rakenne. */
export function DashboardPage() {
  const { profile, logout } = useAuth()

  return (
    <>
      <AppHeader
        title="⚽ Joukkueen sakot"
        subtitle={profile?.username ?? 'Ladataan...'}
        actions={
          <>
            <button className="header-icon-btn" title="Asetukset" disabled>⚙️</button>
            <button className="header-icon-btn" title="Kirjaudu ulos" onClick={logout}>🚪</button>
          </>
        }
      />
      <div className="page">
        <div className="card">
          <div className="empty" style={{ padding: '20px 0' }}>
            Joukkuelistaus rakennetaan seuraavassa vaiheessa.
          </div>
        </div>
        <div
          className="card card-muted"
          style={{ textAlign: 'center', padding: 16, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}
        >
          <button className="btn btn-outline" style={{ width: 'auto', padding: '11px 20px' }} disabled>
            ➕ Liity joukkueeseen
          </button>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '11px 20px' }} disabled>
            🏆 Luo joukkue
          </button>
        </div>
      </div>
    </>
  )
}
