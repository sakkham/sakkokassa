import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { supabase } from '../lib/supabaseClient'
import { toSyntheticEmail, MIN_PASSWORD_LENGTH } from '../lib/auth'
import { authErrorMessage } from '../lib/authErrors'

interface SettingsModalProps {
  username: string
  onClose: () => void
}

export function SettingsModal({ username, onClose }: SettingsModalProps) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setOk('')
    if (!oldPassword || !newPassword || !newPassword2) { setError('Täytä kaikki kentät.'); return }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Salasanan tulee olla vähintään ${MIN_PASSWORD_LENGTH} merkkiä.`)
      return
    }
    if (newPassword !== newPassword2) { setError('Uudet salasanat eivät täsmää.'); return }

    setBusy(true)
    try {
      // Nykyisen salasanan vahvistus: kirjaudutaan sillä uudelleen ennen
      // vaihtoa (Supabasen updateUser ei itse vaadi vanhaa salasanaa).
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: toSyntheticEmail(username),
        password: oldPassword,
      })
      if (signInErr) { setError('Nykyinen salasana on väärin.'); setBusy(false); return }

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
      if (updateErr) throw updateErr

      setOk('✅ Salasana vaihdettu!')
      setOldPassword('')
      setNewPassword('')
      setNewPassword2('')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="⚙️ Asetukset" onClose={onClose}>
      <div className="section-title">Vaihda salasana</div>
      {error && <div className="msg msg-err" style={{ display: 'block' }}>{error}</div>}
      {ok && <div className="msg msg-ok" style={{ display: 'block' }}>{ok}</div>}
      <form onSubmit={handleSubmit}>
        <label htmlFor="old-password">Nykyinen salasana</label>
        <input
          id="old-password"
          type="password"
          autoComplete="current-password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          disabled={busy}
        />
        <label htmlFor="new-password">Uusi salasana</label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={busy}
        />
        <label htmlFor="new-password2">Vahvista uusi salasana</label>
        <input
          id="new-password2"
          type="password"
          autoComplete="new-password"
          value={newPassword2}
          onChange={(e) => setNewPassword2(e.target.value)}
          disabled={busy}
        />
        <button className="btn btn-primary" type="submit" disabled={busy}>Vaihda salasana</button>
      </form>
    </Modal>
  )
}
