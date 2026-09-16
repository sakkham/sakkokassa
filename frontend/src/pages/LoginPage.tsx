import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authErrorMessage } from '../lib/authErrors'
import { MIN_PASSWORD_LENGTH } from '../lib/auth'
import { Modal } from '../components/Modal'

type Step = 'username' | 'password'

export function LoginPage() {
  const { checkUsernameExists, register, login } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('username')
  const [username, setUsername] = useState('')
  const [isNewUser, setIsNewUser] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [showForgotHelp, setShowForgotHelp] = useState(false)

  async function handleUsernameSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!username.trim()) { setError('Syötä käyttäjätunnus.'); return }

    setBusy(true)
    try {
      const exists = await checkUsernameExists(username)
      setIsNewUser(!exists)
      setStep('password')
    } catch {
      setError('Yhteysvirhe. Yritä uudelleen.')
    } finally {
      setBusy(false)
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!password) { setError('Syötä salasana.'); return }
    if (isNewUser) {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Salasanan tulee olla vähintään ${MIN_PASSWORD_LENGTH} merkkiä.`)
        return
      }
      if (password !== passwordConfirm) { setError('Salasanat eivät täsmää.'); return }
    }

    setBusy(true)
    try {
      if (isNewUser) {
        await register(username, password)
        setInfo('Tili luotu! Kirjaudutaan sisään...')
      } else {
        await login(username, password)
      }
      navigate('/dashboard')
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function backToUsername() {
    setStep('username')
    setPassword('')
    setPasswordConfirm('')
    setError('')
    setInfo('')
  }

  return (
    <div className="login-wrap">
      <div className="login-logo">⚽</div>
      <div className="login-title">Joukkueen sakot</div>
      <div className="login-sub">Kirjaudu sisään tai rekisteröidy</div>
      <div className="login-card">
        <h2>{step === 'username' ? 'Kirjautuminen' : isNewUser ? 'Luo uusi tili' : 'Kirjautuminen'}</h2>

        {error && <div className="msg msg-err" style={{ display: 'block' }}>{error}</div>}
        {info && <div className="msg msg-ok" style={{ display: 'block' }}>{info}</div>}

        {step === 'username' ? (
          <form onSubmit={handleUsernameSubmit}>
            <label htmlFor="login-username">Käyttäjätunnus</label>
            <input
              id="login-username"
              type="text"
              placeholder="esim. matti123"
              autoComplete="username"
              autoCapitalize="none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
              autoFocus
            />
            <button className="btn btn-primary" type="submit" disabled={busy}>Jatka →</button>
          </form>
        ) : (
          <form onSubmit={handlePasswordSubmit}>
            <div style={{ marginBottom: 14, fontSize: 13, color: '#666' }}>
              Tunnus: <strong>{username}</strong>
            </div>
            <label htmlFor="login-password">{isNewUser ? `Valitse salasana (väh. ${MIN_PASSWORD_LENGTH} merkkiä)` : 'Salasana'}</label>
            <input
              id="login-password"
              type="password"
              placeholder="••••••"
              autoComplete={isNewUser ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              autoFocus
            />
            {isNewUser && (
              <>
                <label htmlFor="login-password-confirm">Vahvista salasana</label>
                <input
                  id="login-password-confirm"
                  type="password"
                  placeholder="••••••"
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  disabled={busy}
                />
              </>
            )}
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {isNewUser ? 'Luo tili' : 'Kirjaudu sisään'}
            </button>
            <button
              className="btn btn-outline"
              style={{ marginTop: 8 }}
              type="button"
              onClick={backToUsername}
              disabled={busy}
            >
              ← Vaihda tunnus
            </button>
            {!isNewUser && (
              <button
                type="button"
                onClick={() => setShowForgotHelp(true)}
                style={{
                  display: 'block', width: '100%', marginTop: 14, background: 'none', border: 'none',
                  color: '#888', fontSize: 13, textDecoration: 'underline', cursor: 'pointer',
                }}
              >
                Unohtuiko salasana?
              </button>
            )}
          </form>
        )}
      </div>

      {showForgotHelp && (
        <Modal title="🔑 Unohtuiko salasana?" onClose={() => setShowForgotHelp(false)}>
          <p style={{ fontSize: 14, color: '#444', lineHeight: 1.7, marginBottom: 12 }}>
            Tällä sovelluksella ei ole (vielä) automaattista salasanan palautusta. Näin pääset takaisin joukkueesi käyttäjäksi:
          </p>
          <ol style={{ fontSize: 14, color: '#444', lineHeight: 1.8, paddingLeft: 20, marginBottom: 12 }}>
            <li>Palaa takaisin ja <strong>luo uusi tili</strong> eri käyttäjätunnuksella.</li>
            <li>Liity samaan joukkueeseen uudella tunnuksella.</li>
            <li>
              Pyydä joukkueesi ylläpitäjää siirtämään vanhat sakkosi uudelle tilillesi Hallinta-sivun
              <strong> "🔀 Siirrä sakot"</strong> -toiminnolla — koko sakkohistoriasi siirtyy mukana.
            </li>
          </ol>
          <p style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6 }}>
            Vanha tunnuksesi jää joukkueen jäsenlistalle näkyviin ilman sakkoja (0,00 €) — sillä ei ole
            muuta haittaa kuin ylimääräinen rivi listassa.
          </p>
        </Modal>
      )}
    </div>
  )
}
