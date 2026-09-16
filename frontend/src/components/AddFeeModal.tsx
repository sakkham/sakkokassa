import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { supabase } from '../lib/supabaseClient'
import { rpcErrorMessage } from '../lib/rpcErrors'
import { fmtEur } from '../lib/format'
import type { FeeType, TeamMember } from '../lib/team'

const NEW_PLAYER = '__new__'
const CUSTOM_REASON = '__custom__'

interface AddFeeModalProps {
  teamId: string
  members: TeamMember[]
  feeTypes: FeeType[]
  onClose: () => void
  onAdded: () => void
}

function todayStr(): string {
  return new Date().toLocaleDateString('sv') // YYYY-MM-DD
}

export function AddFeeModal({ teamId, members, feeTypes, onClose, onAdded }: AddFeeModalProps) {
  const [target, setTarget] = useState(members[0]?.id ?? NEW_PLAYER)
  const [newUsername, setNewUsername] = useState('')
  const [reasonSel, setReasonSel] = useState(feeTypes[0] ? feeTypes[0].reason : CUSTOM_REASON)
  const [customReason, setCustomReason] = useState('')
  const [amount, setAmount] = useState(feeTypes[0] ? String(feeTypes[0].default_amount) : '')
  const [qty, setQty] = useState(1)
  const [date, setDate] = useState(todayStr())
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  function handleReasonChange(value: string) {
    setReasonSel(value)
    if (value === CUSTOM_REASON) {
      setAmount('')
    } else {
      const ft = feeTypes.find((f) => f.reason === value)
      if (ft) setAmount(String(ft.default_amount))
    }
  }

  const numericAmount = parseFloat(amount)
  const qtyPreview = qty > 1 && numericAmount > 0 ? `${qty} × ${fmtEur(numericAmount)} = ${fmtEur(qty * numericAmount)}` : ''

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const reason = reasonSel === CUSTOM_REASON ? customReason.trim() : reasonSel
    const isNew = target === NEW_PLAYER

    if (!reason || !amount) { setError('Täytä kaikki kentät.'); return }
    if (isNew && !newUsername.trim()) { setError('Syötä käyttäjänimi.'); return }

    setBusy(true)
    try {
      const { error: rpcError } = isNew
        ? await supabase.rpc('add_fee_to_username', {
            p_team_id: teamId,
            p_target_username: newUsername.trim(),
            p_amount: numericAmount,
            p_reason: reason,
            p_quantity: qty,
            p_fee_date: date,
          })
        : await supabase.rpc('add_fee', {
            p_team_id: teamId,
            p_target_member_id: target,
            p_amount: numericAmount,
            p_reason: reason,
            p_quantity: qty,
            p_fee_date: date,
          })
      if (rpcError) throw rpcError
      setOk(qty > 1 ? `✅ ${qty} sakkoa lisätty!` : '✅ Sakko lisätty!')
      setTimeout(onAdded, 1000)
    } catch (err) {
      setError(rpcErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="💸 Lisää sakko" onClose={onClose}>
      {error && <div className="msg msg-err" style={{ display: 'block' }}>{error}</div>}
      {ok && <div className="msg msg-ok" style={{ display: 'block' }}>{ok}</div>}
      <form onSubmit={handleSubmit}>
        <label htmlFor="af-target">Pelaaja / käyttäjänimi</label>
        <select id="af-target" value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy}>
          {members.map((m) => <option key={m.id} value={m.id}>{m.username}</option>)}
          <option value={NEW_PLAYER}>+ Uusi pelaaja (ei rekisteröity)</option>
        </select>
        {target === NEW_PLAYER && (
          <>
            <label htmlFor="af-newuser">Uusi käyttäjänimi</label>
            <input
              id="af-newuser"
              type="text"
              placeholder="Kirjoita käyttäjänimi"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              disabled={busy}
            />
          </>
        )}

        <label htmlFor="af-reason">Syy</label>
        <select id="af-reason" value={reasonSel} onChange={(e) => handleReasonChange(e.target.value)} disabled={busy}>
          {feeTypes.map((f) => (
            <option key={f.id} value={f.reason}>{f.reason} ({fmtEur(f.default_amount)})</option>
          ))}
          <option value={CUSTOM_REASON}>Muu (oma syy)...</option>
        </select>
        {reasonSel === CUSTOM_REASON && (
          <>
            <label htmlFor="af-custom-reason">Oma syy</label>
            <input
              id="af-custom-reason"
              type="text"
              placeholder="Kirjoita syy..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              disabled={busy}
            />
          </>
        )}

        <label htmlFor="af-amount">Summa (€)</label>
        <input
          id="af-amount"
          type="number"
          min="0"
          step="0.5"
          placeholder="esim. 2.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={busy}
        />

        <label>Määrä</label>
        <div className="qty-stepper">
          <button type="button" className="qty-btn" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={busy}>−</button>
          <div className="qty-display">{qty}</div>
          <button type="button" className="qty-btn" onClick={() => setQty((q) => Math.min(99, q + 1))} disabled={busy}>+</button>
        </div>
        {qtyPreview && <div className="qty-total-preview">{qtyPreview}</div>}

        <label htmlFor="af-date">Päivämäärä <span style={{ fontWeight: 400, color: '#aaa' }}>(oletuksena tänään)</span></label>
        <input id="af-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />

        <button className="btn btn-danger" type="submit" disabled={busy}>Lisää sakko</button>
      </form>
    </Modal>
  )
}
