import type { TeamMember } from '../lib/team'

interface MemberRoleRowProps {
  member: TeamMember
  role: string
  disabled: boolean
  isSelf: boolean
  onChange: (memberId: string, role: string) => void
  onRemove: (member: TeamMember) => void
}

/** Yhden jäsenen rivi roolinvalitsimella. Ei omaa tallennuspainiketta —
 * kaikkien jäsenten roolimuutokset tallennetaan yhdellä yhteisellä
 * napilla (ks. TeamAdminPage), jotta usean roolin muokkaus on sujuvaa.
 * Poistonappi puuttuu omalta riviltä — itse poistutaan Omat sakot
 * -sivun kautta, ei tästä listasta. */
export function MemberRoleRow({ member, role, disabled, isSelf, onChange, onRemove }: MemberRoleRowProps) {
  return (
    <div className="member-row">
      <div className="member-info">
        <div className="player-name">{member.username}</div>
        <div className="player-sub">{member.user_id ? 'Rekisteröitynyt' : '⚠️ ei rekisteröity'}</div>
      </div>
      <div className="member-role-controls">
        <select
          className="member-role-sel"
          value={role}
          onChange={(e) => onChange(member.id, e.target.value)}
          disabled={disabled}
        >
          <option value="player">Pelaaja</option>
          <option value="approver">Hyväksyjä</option>
          <option value="teamadmin">Ylläpitäjä</option>
        </select>
        {!isSelf && (
          <button
            className="btn-sm btn-sm-ghost"
            style={{ fontSize: 11 }}
            onClick={() => onRemove(member)}
            disabled={disabled}
            title="Poista jäsen"
          >
            🗑
          </button>
        )}
      </div>
    </div>
  )
}
