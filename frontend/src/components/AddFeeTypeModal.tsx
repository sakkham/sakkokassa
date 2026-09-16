import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { supabase } from '../lib/supabaseClient'
import { rpcErrorMessage } from '../lib/rpcErrors'

interface AddFeeTypeModalProps {
  teamId: string
  onClose: () => void
  onAdded: () => void
}

export function AddFeeTypeModal({ teamId, onClose, onAdded }: AddFeeTypeModalProps) {
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!reason.trim() || !amount) { setError('Täytä kaikki kentät.'); return }

    setBusy(true)
    try {
      const { error: rpcError } = await supabase.rpc('add_fee_type', {
        p_team_id: teamId,
        p_reason: reason.trim(),
        p_default_amount: parseFloat(amount),
      })
      if (rpcError) throw rpcError
      setOk('✅ Lisätty!')
      setTimeout(onAdded, 800)
    } catch (err) {
      setError(rpcErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="📋 Lisää sakkotyyppi" onClose={onClose}>
      {error && <div className="msg msg-err" style={{ display: 'block' }}>{error}</div>}
      {ok && <div className="msg msg-ok" style={{ display: 'block' }}>{ok}</div>}
      <form onSubmit={handleSubmit}>
        <label htmlFor="fl-reason">Syy</label>
        <input
          id="fl-reason"
          type="text"
          placeholder="esim. Myöhästyminen"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={busy}
        />
        <label htmlFor="fl-amount">Oletussumma (€)</label>
        <input
          id="fl-amount"
          type="number"
          min="0"
          step="0.5"
          placeholder="esim. 5.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={busy}
        />
        <button className="btn btn-primary" type="submit" disabled={busy}>Lisää</button>
      </form>
    </Modal>
  )
}
