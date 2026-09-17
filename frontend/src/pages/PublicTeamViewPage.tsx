import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { supabase } from '../lib/supabaseClient'
import { rpcErrorMessage } from '../lib/rpcErrors'

interface PublicPlayer {
  username: string
  activeTotal: number
}

interface PublicView {
  teamName: string
  currencySymbol: string
  players: PublicPlayer[]
}

function fmtAmount(amount: number, currencySymbol: string): string {
  return amount.toFixed(2).replace('.', ',') + ' ' + currencySymbol
}

/** Julkinen, kirjautumaton katselusivu — ei RequireAuthin sisällä (ks.
 * App.tsx), joten tämä latautuu ilman kirjautumista tai istuntoa
 * ollenkaan. Näyttää tarkoituksella vain pelaajien nimet ja aktiiviset
 * sakkosummat — ei yksittäisiä sakkoja, ei ehdotuksia, eikä mitään
 * joka paljastaisi onko pelaaja rekisteröitynyt vai ei. */
export function PublicTeamViewPage() {
  const { token } = useParams<{ token: string }>()
  const [view, setView] = useState<PublicView | null | undefined>(undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!token) return
      const { data, error: err } = await supabase.rpc('get_public_team_view', { p_token: token })
      if (cancelled) return
      if (err) {
        setError(rpcErrorMessage(err))
        setView(null)
        return
      }
      setView(data as unknown as PublicView)
    }
    load()
    return () => { cancelled = true }
  }, [token])

  if (view === undefined) {
    return (
      <>
        <AppHeader title="Sakkokassa" />
        <div className="page"><div className="loading">Ladataan...</div></div>
      </>
    )
  }

  if (view === null) {
    return (
      <>
        <AppHeader title="Sakkokassa" />
        <div className="page">
          <div className="card">
            <div className="empty">{error || 'Katselulinkkiä ei löydy.'}</div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <AppHeader title={view.teamName} subtitle="👀 Julkinen katselunäkymä" />
      <div className="page">
        <div className="card">
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>
            Näyttää vain aktiiviset sakkosummat — ei yksittäisiä sakkoja eikä ehdotuksia. Kirjaudu sisään nähdäksesi lisää.
          </div>
          {view.players.length === 0 ? (
            <div className="empty">Ei pelaajia.</div>
          ) : (
            view.players.map((p) => {
              const isZero = p.activeTotal === 0
              return (
                <div className="player-row" key={p.username} style={{ cursor: 'default' }}>
                  <div>
                    <div className="player-name">{p.username}</div>
                  </div>
                  <div className={`player-total ${isZero ? 'zero' : ''}`}>{fmtAmount(p.activeTotal, view.currencySymbol)}</div>
                </div>
              )
            })
          )}
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <Link to="/" className="btn btn-outline">Kirjaudu sisään</Link>
        </div>
      </div>
    </>
  )
}
