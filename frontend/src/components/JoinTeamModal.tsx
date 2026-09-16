import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { supabase } from '../lib/supabaseClient'
import { rpcErrorMessage } from '../lib/rpcErrors'

interface JoinTeamModalProps {
  defaultUsername: string
  onClose: () => void
  onJoined: () => void
}

export function JoinTeamModal({ defaultUsername, onClose, onJoined }: JoinTeamModalProps) {
  const [inviteCode, setInviteCode] = useState('')
  const [username, setUsername] = useState(defaultUsername)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!inviteCode.trim() || !username.trim()) { setError('Syötä kutsukoodi ja käyttäjänimi.'); return }

    setBusy(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('join_team', {
        p_invite_code: inviteCode.trim(),
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

      <form onSubmit={handleSubmit}>
        <label htmlFor="jt-code">Kutsukoodi</label>
        <input
          id="jt-code"
          type="text"
          placeholder="esim. AB3D9KQ2"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          maxLength={8}
          style={{ textTransform: 'uppercase', letterSpacing: 1 }}
          disabled={busy}
          autoFocus
        />
        <div style={{ fontSize: 11, color: '#aaa', marginTop: -8, marginBottom: 12 }}>
          Kysy kutsukoodi joukkueesi ylläpitäjältä.
        </div>
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
    </Modal>
  )
}
