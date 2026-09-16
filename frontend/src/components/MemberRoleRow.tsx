import type { TeamMember } from '../lib/team'

interface MemberRoleRowProps {
  member: TeamMember
  role: string
  disabled: boolean
  onChange: (memberId: string, role: string) => void
}

/** Yhden jäsenen rivi roolinvalitsimella. Ei omaa tallennuspainiketta —
 * kaikkien jäsenten roolimuutokset tallennetaan yhdellä yhteisellä
 * napilla (ks. TeamAdminPage), jotta usean roolin muokkaus on sujuvaa. */
export function MemberRoleRow({ member, role, disabled, onChange }: MemberRoleRowProps) {
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
      </div>
    </div>
  )
}
