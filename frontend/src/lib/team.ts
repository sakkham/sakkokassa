import type { Database } from './database.types'

// invite_code ja public_view_token ovat tarkoituksella pois: molemmat
// sarakkeet on lukittu tietokannassa (ei SELECT-oikeutta authenticated-
// roolille) ja paljastuvat vain omien RPC:idensä kautta (ks. migraatiot
// 20260916170000 ja 20260917100000), joten niitä ei koskaan saa suoraan
// .select()-kyselyllä — Omit pitää TypeScriptin rehellisenä siitä, etteivät
// kentät ole oikeasti saatavilla.
export type Team = Omit<Database['public']['Tables']['teams']['Row'], 'invite_code' | 'public_view_token'>
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

/** Poimii sakkolistasta arkistoitujen kausien nimet, uusin ensin —
 * käytetään Historia-näkymien kausisuodattimeen (Omat sakot, Joukkue). */
export function seasonLabelsOf(fees: Fee[]): string[] {
  const latestArchivedAt = new Map<string, string>()
  for (const f of fees) {
    if (f.status !== 'archived' || !f.season_label) continue
    const prev = latestArchivedAt.get(f.season_label)
    if (!prev || (f.archived_at ?? '') > prev) latestArchivedAt.set(f.season_label, f.archived_at ?? '')
  }
  return [...latestArchivedAt.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([label]) => label)
}
