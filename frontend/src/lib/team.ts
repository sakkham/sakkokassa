import type { Database } from './database.types'

// invite_code on tarkoituksella pois: sarake on lukittu tietokannassa
// (ei SELECT-oikeutta authenticated-roolille, ks. migraatio 20260916170000)
// ja paljastuu vain get_invite_code()/regenerate_invite_code()-RPC:iden
// kautta, joten sitä ei koskaan saa suoraan .select()-kyselyllä — Omit
// pitää TypeScriptin rehellisenä siitä, ettei kenttä ole oikeasti saatavilla.
export type Team = Omit<Database['public']['Tables']['teams']['Row'], 'invite_code'>
export const TEAM_SAFE_COLUMNS =
  'id, name, is_active, vote_threshold, allow_player_suggest, currency_symbol, season_name, max_fee_amount, created_at'

export type TeamMember = Database['public']['Tables']['team_members']['Row']
export type FeeType = Database['public']['Tables']['fee_types']['Row']
export type Fee = Database['public']['Tables']['fees']['Row']

export function roleLabel(role: string): string {
  if (role === 'teamadmin') return 'Ylläpitäjä'
  if (role === 'approver') return 'Hyväksyjä'
  return 'Pelaaja'
}

export function roleClass(role: string): string {
  if (role === 'teamadmin') return 'role-admin'
  if (role === 'approver') return 'role-approver'
  return ''
}
