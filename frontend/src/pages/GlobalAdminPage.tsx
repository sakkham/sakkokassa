import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { rpcErrorMessage } from '../lib/rpcErrors'
import { TEAM_SAFE_COLUMNS, type Team } from '../lib/team'
import type { Database } from '../lib/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

export function GlobalAdminPage() {
  const { profile } = useAuth()
  const [teams, setTeams] = useState<Team[] | null>(null)
  const [users, setUsers] = useState<Profile[] | null>(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const load = useCallback(async () => {
    setError('')
    const [{ data: teamRows, error: teamErr }, { data: userRows, error: userErr }] = await Promise.all([
      supabase.from('teams').select(TEAM_SAFE_COLUMNS).order('name'),
      supabase.from('profiles').select('*').order('username'),
    ])
    if (teamErr || userErr) { setError('Latausvirhe.'); return }
    setTeams(teamRows ?? [])
    setUsers(userRows ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  if (!profile) {
    return <div className="page"><div className="loading">Ladataan...</div></div>
  }

  if (profile.globalRole !== 'admin') {
    return (
      <div className="page">
        <div className="card"><div className="empty">Sinulla ei ole oikeutta tähän näkymään.</div></div>
      </div>
    )
  }

  async function toggleTeamActive(team: Team) {
    const makeActive = !team.is_active
    const verb = makeActive ? 'palauttaa' : 'poistaa'
    if (!confirm(`Haluatko varmasti ${verb} joukkueen "${team.name}"?`)) return
    setError('')
    setOk('')
    try {
      const { error: err } = await supabase.rpc('set_team_active', { p_team_id: team.id, p_is_active: makeActive })
      if (err) throw err
      setOk(makeActive ? `✅ Joukkue "${team.name}" palautettu.` : `✅ Joukkue "${team.name}" poistettu.`)
      load()
    } catch (err) {
      setError(rpcErrorMessage(err))
    }
  }

  async function toggleGlobalAdmin(user: Profile) {
    const makeAdmin = user.global_role !== 'admin'
    const verb = makeAdmin ? 'tehdä Global Adminiksi' : 'poistaa Global Admin -oikeudet käyttäjältä'
    if (!confirm(`Haluatko ${verb}: ${user.username}?`)) return
    setError('')
    setOk('')
    try {
      const { error: err } = await supabase.rpc('set_global_admin', { p_target_user_id: user.id, p_make_admin: makeAdmin })
      if (err) throw err
      setOk(`✅ ${user.username}: ${makeAdmin ? 'tehty Global Adminiksi' : 'Global Admin -oikeudet poistettu'}.`)
      load()
    } catch (err) {
      setError(rpcErrorMessage(err))
    }
  }

  return (
    <>
      <AppHeader title="🌐 Globaali ylläpito" backTo="/dashboard" />
      <div className="page">
        {error && <div className="msg msg-err" style={{ display: 'block' }}>{error}</div>}
        {ok && <div className="msg msg-ok" style={{ display: 'block' }}>{ok}</div>}

        <div className="card">
          <h2>🏆 Joukkueet</h2>
          {teams === null ? (
            <div className="loading">Ladataan...</div>
          ) : teams.length === 0 ? (
            <div className="empty">Ei joukkueita.</div>
          ) : (
            teams.map((t) => (
              <div className="member-row" key={t.id}>
                <div className="member-info">
                  <div className="player-name">{t.name}</div>
                  <div className="player-sub">{t.is_active ? 'Aktiivinen' : '🗑 Poistettu'}</div>
                </div>
                <div className="member-role-controls">
                  <Link to={`/team/${t.id}`} className="btn-sm btn-sm-ghost">Avaa →</Link>
                  <button
                    className={`btn-sm ${t.is_active ? 'btn-sm-reject' : 'btn-sm-approve'}`}
                    onClick={() => toggleTeamActive(t)}
                  >
                    {t.is_active ? '🗑 Poista' : '♻️ Palauta'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h2>👥 Käyttäjien hallinta</h2>
          {users === null ? (
            <div className="loading">Ladataan...</div>
          ) : users.length === 0 ? (
            <div className="empty">Ei käyttäjiä.</div>
          ) : (
            users.map((u) => {
              const isGlobalAdmin = u.global_role === 'admin'
              const isMe = u.id === profile.id
              return (
                <div className="player-row" style={{ cursor: 'default' }} key={u.id}>
                  <div>
                    <div className="player-name">{u.username}</div>
                    <div className="player-sub">{isGlobalAdmin ? '🌐 Global Admin' : 'Käyttäjä'}</div>
                  </div>
                  <button
                    className={`btn-sm ${isGlobalAdmin ? 'btn-sm-reject' : 'btn-sm-ghost'}`}
                    onClick={() => toggleGlobalAdmin(u)}
                    disabled={isMe}
                    title={isMe ? 'Et voi muokata omia oikeuksiasi' : undefined}
                  >
                    {isGlobalAdmin ? 'Poista admin' : 'Tee admin'}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
