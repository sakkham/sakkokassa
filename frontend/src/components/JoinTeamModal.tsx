import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { supabase } from '../lib/supabaseClient'
import { rpcErrorMessage } from '../lib/rpcErrors'
import { fetchActiveTeams, type ActiveTeam } from '../lib/teams'

interface JoinTeamModalProps {
  defaultUsername: string
  excludeTeamIds: Set<string>
  onClose: () => void
  onJoined: () => void
}

export function JoinTeamModal({ defaultUsername, excludeTeamIds, onClose, onJoined }: JoinTeamModalProps) {
  const [teams, setTeams] = useState<ActiveTeam[] | null>(null)
  const [teamId, setTeamId] = useState('')
  const [username, setUsername] = useState(defaultUsername)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetchActiveTeams()
      .then((all) => {
        const joinable = all.filter((t) => !excludeTeamIds.has(t.id))
        setTeams(joinable)
        if (joinable.length > 0) setTeamId(joinable[0].id)
      })
      .catch(() => setError('Yhteysvirhe.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!teamId || !username.trim()) { setError('Valitse joukkue ja syötä käyttäjänimi.'); return }

    setBusy(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('join_team', {
        p_team_id: teamId,
        p_username: username.trim(),
      })
      if (rpcError) throw rpcError
      const claimed = (data as { claimed?: boolean } | null)?.claimed
      setOk(claimed ? '✅ Tili yhdistetty olemassa olevaan profiiliin!' : '✅ Liittyminen onnistui!')
      setTimeout(onJoined, 1200)
    } catch (err) {
      setError(rpcErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="➕ Liity joukkueeseen" onClose={onClose}>
      {error && <div className="msg msg-err" style={{ display: 'block' }}>{error}</div>}
      {ok && <div className="msg msg-ok" style={{ display: 'block' }}>{ok}</div>}

      {teams === null ? (
        <div className="loading">Ladataan...</div>
      ) : teams.length === 0 ? (
        <div className="empty">Ei liittymiskelpoisia joukkueita.</div>
      ) : (
        <form onSubmit={handleSubmit}>
          <label htmlFor="jt-team">Valitse joukkue</label>
          <select id="jt-team" value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={busy}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <label htmlFor="jt-username">Käyttäjänimi joukkueessa</label>
          <input
            id="jt-username"
            type="text"
            placeholder="esim. Matti M."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={busy}
          />
          <div className="msg msg-info" style={{ display: 'block' }}>
            💡 Jos sinulle on jo lisätty sakkoja tällä käyttäjänimellä, tilisi liitetään niihin automaattisesti.
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>Liity</button>
        </form>
      )}
    </Modal>
  )
}
