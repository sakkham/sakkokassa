import { useState } from 'react'
import { Modal } from './Modal'
import { supabase } from '../lib/supabaseClient'
import { rpcErrorMessage } from '../lib/rpcErrors'

interface ArchiveSeasonModalProps {
  teamId: string
  defaultSeasonName: string
  onClose: () => void
  onArchived: () => void
}

export function ArchiveSeasonModal({ teamId, defaultSeasonName, onClose, onArchived }: ArchiveSeasonModalProps) {
  const [seasonLabel, setSeasonLabel] = useState(defaultSeasonName)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    setError('')
    if (!seasonLabel.trim()) { setError('Anna arkistoitavalle kaudelle nimi.'); return }

    setBusy(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('archive_season', {
        p_team_id: teamId,
        p_season_label: seasonLabel.trim(),
      })
      if (rpcError) throw rpcError
      setOk(`✅ Arkistoitu ${data ?? 0} sakkoa kaudelle "${seasonLabel.trim()}".`)
      setTimeout(onArchived, 1200)
    } catch (err) {
      setError(rpcErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal title="📦 Arkistoi kausi" onClose={onClose}>
      <p style={{ fontSize: 14, color: '#555', marginBottom: 18, lineHeight: 1.6 }}>
        Tämä merkitsee kaikki aktiiviset sakot arkistoiduiksi annetulla kauden nimellä. Saldot nollaantuvat mutta
        historia säilyy, kauden nimen kera. Toimintoa ei voi peruuttaa.
      </p>
      <label htmlFor="archive-season-label">Kauden nimi</label>
      <input
        id="archive-season-label"
        type="text"
        maxLength={40}
        placeholder="esim. Kevät 2026"
        value={seasonLabel}
        onChange={(e) => setSeasonLabel(e.target.value)}
        disabled={busy}
        autoFocus
      />
      {error && <div className="msg msg-err" style={{ display: 'block' }}>{error}</div>}
      {ok && <div className="msg msg-ok" style={{ display: 'block' }}>{ok}</div>}
      <button className="btn btn-danger" style={{ marginTop: 12 }} onClick={handleConfirm} disabled={busy}>
        Kyllä, arkistoi kausi
      </button>
      <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>Peruuta</button>
    </Modal>
  )
}
