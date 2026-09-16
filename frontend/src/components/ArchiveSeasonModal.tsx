import { useState } from 'react'
import { Modal } from './Modal'
import { supabase } from '../lib/supabaseClient'
import { rpcErrorMessage } from '../lib/rpcErrors'

interface ArchiveSeasonModalProps {
  teamId: string
  onClose: () => void
  onArchived: () => void
}

export function ArchiveSeasonModal({ teamId, onClose, onArchived }: ArchiveSeasonModalProps) {
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    setError('')
    setBusy(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('archive_season', { p_team_id: teamId })
      if (rpcError) throw rpcError
      setOk(`✅ Arkistoitu ${data ?? 0} sakkoa.`)
      setTimeout(onArchived, 1200)
    } catch (err) {
      setError(rpcErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="📦 Arkistoi kausi" onClose={onClose}>
      <p style={{ fontSize: 14, color: '#555', marginBottom: 18, lineHeight: 1.6 }}>
        Tämä merkitsee kaikki aktiiviset sakot arkistoiduiksi. Saldot nollaantuvat mutta historia säilyy. Toimintoa ei voi peruuttaa.
      </p>
      {error && <div className="msg msg-err" style={{ display: 'block' }}>{error}</div>}
      {ok && <div className="msg msg-ok" style={{ display: 'block' }}>{ok}</div>}
      <button className="btn btn-danger" onClick={handleConfirm} disabled={busy}>Kyllä, arkistoi kausi</button>
      <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>Peruuta</button>
    </Modal>
  )
}
