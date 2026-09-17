import { useState } from 'react'
import { Modal } from './Modal'
import { fmtEur, fmtDate } from '../lib/format'
import { seasonLabelsOf, type Fee, type TeamMember } from '../lib/team'

interface PlayerFeesModalProps {
  member: TeamMember
  active: Fee[]
  other: Fee[]
  activeTotal: number
  currencySymbol: string
  canManage: boolean
  onClose: () => void
  onDeleteFee: (fee: Fee) => void
}

function statusLabel(f: Fee): string {
  if (f.status === 'paid') return 'Maksettu'
  if (f.status === 'archived') return f.season_label ? `Arkist. · ${f.season_label}` : 'Arkist.'
  if (f.status === 'deleted') return 'Poistettu'
  return f.status
}

export function PlayerFeesModal({ member, active, other, activeTotal, currencySymbol, canManage, onClose, onDeleteFee }: PlayerFeesModalProps) {
  const [seasonFilter, setSeasonFilter] = useState('')
  const isZero = activeTotal === 0
  const seasons = seasonLabelsOf(other)
  const visibleOther = seasonFilter ? other.filter((f) => f.season_label === seasonFilter) : other
  return (
    <Modal title={`💸 ${member.username}`} onClose={onClose}>
      <div style={{ fontSize: 28, fontWeight: 800, color: isZero ? '#2d6a4f' : '#e63946', marginBottom: 4 }}>
        {fmtEur(activeTotal, currencySymbol)}
      </div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>aktiiviset sakot</div>

      {active.length > 0 && (
        <>
          <div className="section-title">Aktiiviset</div>
          {active.map((f) => (
            <div className="fee-item" key={f.id}>
              <div>
                <div className="fee-reason">{f.reason}</div>
                <div className="fee-meta">{fmtDate(f.occurred_at)} · {f.added_by}</div>
              </div>
              <div className="fee-right">
                <div className="fee-amount">{fmtEur(f.amount, currencySymbol)}</div>
                {canManage && (
                  <button
                    className="btn-sm btn-sm-ghost"
                    style={{ marginTop: 4, fontSize: 10 }}
                    onClick={() => onDeleteFee(f)}
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {other.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div className="section-title">Historia</div>
            {seasons.length > 1 && (
              <select
                aria-label="Suodata kaudella"
                value={seasonFilter}
                onChange={(e) => setSeasonFilter(e.target.value)}
                style={{ maxWidth: 140, fontSize: 12 }}
              >
                <option value="">Kaikki kaudet</option>
                {seasons.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
          </div>
          {visibleOther.length === 0 ? (
            <div className="empty" style={{ padding: '8px 0' }}>Ei sakkoja tältä kaudelta.</div>
          ) : (
            visibleOther.map((f) => (
              <div className="fee-item" key={f.id}>
                <div>
                  <div className="fee-reason" style={{ color: '#aaa' }}>{f.reason}</div>
                  <div className="fee-meta">{fmtDate(f.occurred_at)}</div>
                </div>
                <div className="fee-right">
                  <div className="fee-amount" style={{ color: '#aaa' }}>{fmtEur(f.amount, currencySymbol)}</div>
                  <div className={`fee-status ${f.status}`}>{statusLabel(f)}</div>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {active.length === 0 && other.length === 0 && <div className="empty">Ei sakkoja.</div>}
    </Modal>
  )
}
