import { useCallback, useEffect, useState } from 'react'
import { useTeamContext } from '../TeamLayout'
import { supabase } from '../../lib/supabaseClient'
import { rpcErrorMessage } from '../../lib/rpcErrors'
import { fmtEur, fmtDate } from '../../lib/format'
import type { Fee } from '../../lib/team'

function statusLabel(status: string): string | null {
  if (status === 'paid') return 'Maksettu'
  if (status === 'archived') return 'Arkistoitu'
  return null
}

export function MyFeesPage() {
  const { team, myMember } = useTeamContext()
  const [fees, setFees] = useState<Fee[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!myMember) { setFees([]); return }
    const { data, error: err } = await supabase
      .from('fees')
      .select('*')
      .eq('member_id', myMember.id)
      .order('occurred_at', { ascending: false })
    if (err) { setError('Sakkojen lataus epäonnistui.'); return }
    setFees(data ?? [])
  }, [myMember])

  useEffect(() => { load() }, [load])

  async function handleSuggestRemoval(fee: Fee) {
    const comment = prompt(`Poistoehdotus: "${fee.reason}"\n\nKirjoita kommentti (pakollinen):`)
    if (!comment || !comment.trim()) return
    try {
      const { error: err } = await supabase.rpc('suggest_removal', {
        p_team_id: fee.team_id,
        p_fee_id: fee.id,
        p_comment: comment.trim(),
      })
      if (err) throw err
      alert('✅ Poistoehdotus lähetetty!')
    } catch (err) {
      alert(rpcErrorMessage(err))
    }
  }

  async function handleSuggestPaid(fee: Fee) {
    const comment = prompt(`Maksettu-ehdotus: "${fee.reason}"\n\nKirjoita kommentti (pakollinen):`)
    if (!comment || !comment.trim()) return
    try {
      const { error: err } = await supabase.rpc('suggest_mark_paid', {
        p_team_id: fee.team_id,
        p_fee_id: fee.id,
        p_comment: comment.trim(),
      })
      if (err) throw err
      alert('✅ Maksettu-ehdotus lähetetty!')
    } catch (err) {
      alert(rpcErrorMessage(err))
    }
  }

  async function handleSuggestAllPaid(teamId: string, total: number) {
    const comment = prompt(
      `Merkitään kaikki aktiiviset sakot (yhteensä ${fmtEur(total)}) maksetuksi.\n\nKirjoita kommentti (pakollinen):`,
    )
    if (!comment || !comment.trim()) return
    try {
      const { error: err } = await supabase.rpc('suggest_mark_all_paid', {
        p_team_id: teamId,
        p_comment: comment.trim(),
      })
      if (err) throw err
      alert('✅ Ehdotus kaikkien sakkojen merkitsemisestä maksetuksi lähetetty!')
    } catch (err) {
      alert(rpcErrorMessage(err))
    }
  }

  if (fees === null) {
    return <div className="page"><div className="loading">Ladataan...</div></div>
  }

  if (!myMember) {
    return (
      <div className="page">
        <div className="card"><div className="empty">Et ole tämän joukkueen jäsen, joten sinulla ei ole omia sakkoja.</div></div>
      </div>
    )
  }

  const active = fees.filter((f) => f.status === 'active')
  const other = fees.filter((f) => f.status !== 'active')
  const total = active.reduce((sum, f) => sum + Number(f.amount), 0)
  const isZero = total === 0

  return (
    <div className="page">
      {error && <div className="msg msg-err" style={{ display: 'block' }}>{error}</div>}

      <div className="card">
        <div className={`total-amount ${isZero ? 'zero' : ''}`}>{fmtEur(total)}</div>
        <div className="total-label">Omat aktiiviset sakot · {myMember.username}</div>
        {active.length > 0 && (
          <button
            className="btn btn-success"
            style={{ marginTop: 14 }}
            onClick={() => handleSuggestAllPaid(team.id, total)}
          >
            ✅ Merkitse kaikki maksetuksi
          </button>
        )}
      </div>

      {active.length === 0 ? (
        <div className="card"><div className="empty" style={{ padding: '12px 0' }}>Ei aktiivisia sakkoja 🎉</div></div>
      ) : (
        <div className="card">
          <h2>Aktiiviset sakot</h2>
          {active.map((f) => (
            <div className="fee-item" key={f.id}>
              <div style={{ flex: 1 }}>
                <div className="fee-reason">{f.reason}</div>
                <div className="fee-meta">{fmtDate(f.occurred_at)} · {f.added_by}</div>
                <div className="fee-actions-inline">
                  <button className="btn-sm btn-sm-ghost" onClick={() => handleSuggestRemoval(f)}>🗑 Poistoehdotus</button>
                  <button className="btn-sm btn-sm-ghost" onClick={() => handleSuggestPaid(f)}>✅ Maksettu-ehdotus</button>
                </div>
              </div>
              <div className="fee-right">
                <div className="fee-amount">{fmtEur(f.amount)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {other.length > 0 && (
        <div className="card">
          <h2>Historia</h2>
          {other.map((f) => {
            const label = statusLabel(f.status)
            return (
              <div className="fee-item" key={f.id}>
                <div>
                  <div className="fee-reason">{f.reason}</div>
                  <div className="fee-meta">{fmtDate(f.occurred_at)} · {f.added_by}</div>
                </div>
                <div className="fee-right">
                  <div className="fee-amount">{fmtEur(f.amount)}</div>
                  {label && <div className={`fee-status ${f.status}`}>{label}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
