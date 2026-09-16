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
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!teamName.trim()) { setError('Syötä joukkueen nimi.'); return }
    if (!username.trim()) { setError('Syötä käyttäjänimesi joukkueessa.'); return }

    setBusy(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('create_team', {
        p_name: teamName.trim(),
        p_creator_username: username.trim(),
      })
      if (rpcError) throw rpcError
      const result = data as { teamId?: string; inviteCode?: string } | null
      setInviteCode(result?.inviteCode ?? null)
    } catch (err) {
      setError(rpcErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy() {
    if (!inviteCode) return
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
    } catch {
      // Leikepöytä ei aina saatavilla — koodi on joka tapauksessa näkyvissä.
    }
  }

  if (inviteCode) {
    return (
      <Modal title="✅ Joukkue luotu!" onClose={onCreated}>
        <p style={{ fontSize: 14, color: '#555', marginBottom: 16, lineHeight: 1.6 }}>
          Olet nyt joukkueen ylläpitäjä. Jaa tämä kutsukoodi pelaajille joukkueen ulkopuolella
          (esim. WhatsApp/Discord) — sillä he pääsevät liittymään.
        </p>
        <div
          style={{
            fontSize: 32, fontWeight: 800, letterSpacing: 4, textAlign: 'center',
            background: '#f0f2f5', borderRadius: 12, padding: '18px 12px', marginBottom: 12,
          }}
        >
          {inviteCode}
        </div>
        <button className="btn btn-outline" onClick={handleCopy} style={{ marginBottom: 12 }}>
          {copied ? '✅ Kopioitu!' : '📋 Kopioi koodi'}
        </button>
        <button className="btn btn-primary" onClick={onCreated}>Valmis</button>
      </Modal>
    )
  }

  return (
    <Modal title="🏆 Luo uusi joukkue" onClose={onClose}>
      {error && <div className="msg msg-err" style={{ display: 'block' }}>{error}</div>}
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
          💡 Saat automaattisesti joukkueen ylläpitäjän oikeudet ja kutsukoodin jaettavaksi pelaajille.
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>Luo joukkue</button>
      </form>
    </Modal>
  )
}
