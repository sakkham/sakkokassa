import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { CreateTeamModal } from '../components/CreateTeamModal'
import { JoinTeamModal } from '../components/JoinTeamModal'
import { SettingsModal } from '../components/SettingsModal'
import { useAuth } from '../context/AuthContext'
import { fetchDashboardTeams, type TeamSummary } from '../lib/teams'
import { fmtEur } from '../lib/format'
import { roleClass, roleLabel } from '../lib/team'

export function DashboardPage() {
  const { profile, logout } = useAuth()
  const [teams, setTeams] = useState<TeamSummary[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [modal, setModal] = useState<'join' | 'create' | 'settings' | null>(null)

  const load = useCallback(async () => {
    if (!profile) return
    setLoadError('')
    try {
      const result = await fetchDashboardTeams(profile.id, profile.globalRole === 'admin', profile.username)
      setTeams(result)
    } catch {
      setLoadError('Joukkueiden lataus epäonnistui.')
    }
  }, [profile])

  useEffect(() => { load() }, [load])

  function handleModalSuccess() {
    setModal(null)
    load()
  }

  return (
    <>
      <AppHeader
        title="⚽ Joukkueen sakot"
        subtitle={profile?.username ?? 'Ladataan...'}
        actions={
          <>
            <button className="header-icon-btn" title="Asetukset" onClick={() => setModal('settings')}>⚙️</button>
            <button className="header-icon-btn" title="Kirjaudu ulos" onClick={logout}>🚪</button>
          </>
        }
      />
      <div className="page">
        {loadError && <div className="msg msg-err" style={{ display: 'block' }}>{loadError}</div>}

        {teams === null ? (
          <div className="loading">Ladataan...</div>
        ) : teams.length === 0 ? (
          <div className="card">
            <div className="empty" style={{ padding: '20px 0' }}>
              Sinulla ei ole joukkueita.<br />Liity joukkueeseen alla.
            </div>
          </div>
        ) : (
          teams.map((t) => {
            const isZero = t.myFeeSum === 0
            return (
              <Link key={t.teamId} to={`/team/${t.teamId}`} className="team-card">
                <div className="team-card-header">
                  <div className="team-card-name">{t.teamName}</div>
                  <div className={`team-card-role ${roleClass(t.role)}`}>{roleLabel(t.role)}</div>
                </div>
                <div className={`team-card-sum ${isZero ? 'zero' : ''}`}>{fmtEur(t.myFeeSum)}</div>
                <div style={{ fontSize: 12, color: '#aaa' }}>omat aktiiviset sakot · {t.username}</div>
                <div className="team-card-footer">
                  <span className="btn-sm btn-sm-ghost">Avaa →</span>
                </div>
              </Link>
            )
          })
        )}

        <div
          className="card card-muted"
          style={{ textAlign: 'center', padding: 16, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}
        >
          <button className="btn btn-outline" style={{ width: 'auto', padding: '11px 20px' }} onClick={() => setModal('join')}>
            ➕ Liity joukkueeseen
          </button>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '11px 20px' }} onClick={() => setModal('create')}>
            🏆 Luo joukkue
          </button>
        </div>

        {profile?.globalRole === 'admin' && (
          <div style={{ textAlign: 'center', marginTop: 4 }}>
            <Link to="/admin" className="btn btn-outline-danger" style={{ display: 'inline-block', width: 'auto', padding: '10px 20px', fontSize: 13 }}>
              🌐 Globaali ylläpito
            </Link>
          </div>
        )}
      </div>

      {modal === 'join' && profile && (
        <JoinTeamModal
          defaultUsername={profile.username}
          excludeTeamIds={new Set((teams ?? []).filter((t) => !t.isVirtualAdmin).map((t) => t.teamId))}
          onClose={() => setModal(null)}
          onJoined={handleModalSuccess}
        />
      )}
      {modal === 'create' && profile && (
        <CreateTeamModal
          defaultUsername={profile.username}
          onClose={() => setModal(null)}
          onCreated={handleModalSuccess}
        />
      )}
      {modal === 'settings' && profile && (
        <SettingsModal username={profile.username} onClose={() => setModal(null)} />
      )}
    </>
  )
}
