import type { Database } from './database.types'

export type Team = Database['public']['Tables']['teams']['Row']
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
