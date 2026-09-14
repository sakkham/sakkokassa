import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { supabase } from '../lib/supabaseClient'
import { rpcErrorMessage } from '../lib/rpcErrors'

interface CreateTeamModalProps {
  defaultUsername: string
  onClose: () => void
  onCreated: () => void
}

export function CreateTeamModal({ defaultUsername, onClose, onCreated }: CreateTeamModalProps) {
  const [teamName, setTeamName] = useState('')
  const [username, setUsername] = useState(defaultUsername)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!teamName.trim()) { setError('Syötä joukkueen nimi.'); return }
    if (!username.trim()) { setError('Syötä käyttäjänimesi joukkueessa.'); return }

    setBusy(true)
    try {
      const { error: rpcError } = await supabase.rpc('create_team', {
        p_name: teamName.trim(),
        p_creator_username: username.trim(),
      })
      if (rpcError) throw rpcError
      setOk('✅ Joukkue luotu! Olet nyt joukkueen ylläpitäjä.')
      setTimeout(onCreated, 1200)
    } catch (err) {
      setError(rpcErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="🏆 Luo uusi joukkue" onClose={onClose}>
      {error && <div className="msg msg-err" style={{ display: 'block' }}>{error}</div>}
      {ok && <div className="msg msg-ok" style={{ display: 'block' }}>{ok}</div>}
      <form onSubmit={handleSubmit}>
        <label htmlFor="ct-name">Joukkueen nimi</label>
        <input
          id="ct-name"
          type="text"
          placeholder="esim. FC Nokia U18"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          disabled={busy}
          autoFocus
        />
        <label htmlFor="ct-username">Oma käyttäjänimesi joukkueessa</label>
        <input
          id="ct-username"
          type="text"
          placeholder="esim. Matti M."
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={busy}
        />
        <div className="msg msg-info" style={{ display: 'block' }}>
          💡 Saat automaattisesti joukkueen ylläpitäjän oikeudet.
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>Luo joukkue</button>
      </form>
    </Modal>
  )
}
