import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { supabase } from '../lib/supabaseClient'
import { rpcErrorMessage } from '../lib/rpcErrors'
import type { TeamMember } from '../lib/team'

interface BulkMoveFeesModalProps {
  teamId: string
  members: TeamMember[]
  onClose: () => void
  onMoved: () => void
}

export function BulkMoveFeesModal({ teamId, members, onClose, onMoved }: BulkMoveFeesModalProps) {
  const [from, setFrom] = useState(members[0]?.id ?? '')
  const [to, setTo] = useState(members[1]?.id ?? members[0]?.id ?? '')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (from === to) { setError('Lähde ja kohde ovat samat.'); return }
    const fromName = members.find((m) => m.id === from)?.username ?? from
    const toName = members.find((m) => m.id === to)?.username ?? to
    if (!confirm(`Siirretäänkö kaikki sakot?\nLähde: ${fromName}\nKohde: ${toName}`)) return

    setBusy(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('bulk_move_fees', {
        p_team_id: teamId,
        p_from_member_id: from,
        p_to_member_id: to,
      })
      if (rpcError) throw rpcError
      setOk(`✅ Siirrettiin ${data ?? 0} sakkoa.`)
      setTimeout(onMoved, 1200)
    } catch (err) {
      setError(rpcErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="🔀 Siirrä sakot" onClose={onClose}>
      {error && <div className="msg msg-err" style={{ display: 'block' }}>{error}</div>}
      {ok && <div className="msg msg-ok" style={{ display: 'block' }}>{ok}</div>}
      <form onSubmit={handleSubmit}>
        <label htmlFor="bm-from">Lähde</label>
        <select id="bm-from" value={from} onChange={(e) => setFrom(e.target.value)} disabled={busy}>
          {members.map((m) => <option key={m.id} value={m.id}>{m.username}</option>)}
        </select>
        <label htmlFor="bm-to">Kohde</label>
        <select id="bm-to" value={to} onChange={(e) => setTo(e.target.value)} disabled={busy}>
          {members.map((m) => <option key={m.id} value={m.id}>{m.username}</option>)}
        </select>
        <button className="btn btn-danger" type="submit" disabled={busy}>Siirrä kaikki sakot</button>
      </form>
    </Modal>
  )
}
