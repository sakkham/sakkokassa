import { Modal } from './Modal'
import { fmtEur, fmtDate } from '../lib/format'
import type { Fee, TeamMember } from '../lib/team'

interface PlayerFeesModalProps {
  member: TeamMember
  active: Fee[]
  other: Fee[]
  activeTotal: number
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

export function PlayerFeesModal({ member, active, other, activeTotal, canManage, onClose, onDeleteFee }: PlayerFeesModalProps) {
  const isZero = activeTotal === 0
  return (
    <Modal title={`💸 ${member.username}`} onClose={onClose}>
      <div style={{ fontSize: 28, fontWeight: 800, color: isZero ? '#2d6a4f' : '#e63946', marginBottom: 4 }}>
        {fmtEur(activeTotal)}
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
                <div className="fee-amount">{fmtEur(f.amount)}</div>
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
          <div className="section-title">Historia</div>
          {other.map((f) => (
            <div className="fee-item" key={f.id}>
              <div>
                <div className="fee-reason" style={{ color: '#aaa' }}>{f.reason}</div>
                <div className="fee-meta">{fmtDate(f.occurred_at)}</div>
              </div>
              <div className="fee-right">
                <div className="fee-amount" style={{ color: '#aaa' }}>{fmtEur(f.amount)}</div>
                <div className={`fee-status ${f.status}`}>{statusLabel(f)}</div>
              </div>
            </div>
          ))}
        </>
      )}

      {active.length === 0 && other.length === 0 && <div className="empty">Ei sakkoja.</div>}
    </Modal>
  )
}
