import { useEffect, useState, type FormEvent } from 'react'
import { useTeamContext } from '../TeamLayout'
import { supabase } from '../../lib/supabaseClient'
import { rpcErrorMessage } from '../../lib/rpcErrors'
import { fmtEur } from '../../lib/format'
import type { FeeType, TeamMember } from '../../lib/team'

const CUSTOM_REASON = '__custom__'

function todayStr(): string {
  return new Date().toLocaleDateString('sv') // YYYY-MM-DD
}

export function SuggestPage() {
  const { team, myMember } = useTeamContext()
  const [members, setMembers] = useState<TeamMember[] | null>(null)
  const [feeTypes, setFeeTypes] = useState<FeeType[] | null>(null)

  const [target, setTarget] = useState('')
  const [reasonSel, setReasonSel] = useState(CUSTOM_REASON)
  const [customReason, setCustomReason] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayStr())
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: memberRows }, { data: feeTypeRows }] = await Promise.all([
        supabase.from('team_members').select('*').eq('team_id', team.id).eq('status', 'active'),
        supabase.from('fee_types').select('*').eq('team_id', team.id),
      ])
      setMembers(memberRows ?? [])
      setFeeTypes(feeTypeRows ?? [])
      setTarget(myMember ? myMember.id : (memberRows?.[0]?.id ?? ''))
      if (feeTypeRows && feeTypeRows.length > 0) {
        setReasonSel(feeTypeRows[0].reason)
        setAmount(String(feeTypeRows[0].default_amount))
      }
    }
    load()
  }, [team.id, myMember])

  function handleReasonChange(value: string) {
    setReasonSel(value)
    if (value === CUSTOM_REASON) {
      setAmount('')
    } else {
      const ft = feeTypes?.find((f) => f.reason === value)
      if (ft) setAmount(String(ft.default_amount))
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setOk('')
    const reason = reasonSel === CUSTOM_REASON ? customReason.trim() : reasonSel
    if (!target || !reason || !amount) { setError('Täytä kaikki kentät.'); return }

    setBusy(true)
    try {
      const { data, error: err } = await supabase.rpc('suggest_fee', {
        p_team_id: team.id,
        p_target_member_id: target,
        p_amount: parseFloat(amount),
        p_reason: reason,
        p_fee_date: date,
      })
      if (err) throw err
      const result = data as { autoApproved?: boolean } | null
      setOk(
        result?.autoApproved
          ? '✅ Oma sakko kirjattu automaattisesti!'
          : '✅ Ehdotus lähetetty! Odottaa hyväksyntää.',
      )
      setCustomReason('')
    } catch (err) {
      setError(rpcErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (members === null || feeTypes === null) {
    return <div className="page"><div className="loading">Ladataan...</div></div>
  }

  return (
    <div className="page">
      <div className="card">
        <h2>Ehdota sakkoa</h2>
        {ok && <div className="msg msg-ok" style={{ display: 'block' }}>{ok}</div>}
        {error && <div className="msg msg-err" style={{ display: 'block' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <label htmlFor="sug-target">Pelaaja</label>
          <select id="sug-target" value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.username}
                {myMember && m.id === myMember.id ? ' (minä)' : ''}
                {!m.user_id ? ' ⚠️' : ''}
              </option>
            ))}
          </select>

          <label htmlFor="sug-reason">Syy</label>
          <select id="sug-reason" value={reasonSel} onChange={(e) => handleReasonChange(e.target.value)} disabled={busy}>
            {feeTypes.map((f) => (
              <option key={f.id} value={f.reason}>{f.reason} ({fmtEur(f.default_amount)})</option>
            ))}
            <option value={CUSTOM_REASON}>Muu (oma syy)...</option>
          </select>
          {reasonSel === CUSTOM_REASON && (
            <>
              <label htmlFor="sug-custom-reason">Oma syy</label>
              <input
                id="sug-custom-reason"
                type="text"
                placeholder="Kirjoita syy..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                disabled={busy}
              />
            </>
          )}

          <label htmlFor="sug-amount">Summa (€)</label>
          <input
            id="sug-amount"
            type="number"
            min="0"
            step="0.5"
            placeholder="esim. 2.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={busy}
          />

          <label htmlFor="sug-date">
            Päivämäärä <span style={{ fontWeight: 400, color: '#aaa' }}>(oletuksena tänään)</span>
          </label>
          <input id="sug-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />

          <button className="btn btn-primary" type="submit" disabled={busy}>Lähetä ehdotus</button>
        </form>
      </div>
      <div className="card card-muted">
        <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
          💡 <strong>Huom:</strong> Jos ehdotat sakkoa itsellesi, se hyväksytään automaattisesti. Muut ehdotukset
          vaativat {team.vote_threshold} hyväksyjän äänen tai joukkueen ylläpitäjän hyväksynnän.
        </div>
      </div>
    </div>
  )
}
