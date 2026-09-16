import { useCallback, useEffect, useState } from 'react'
import { useTeamContext } from '../TeamLayout'
import { supabase } from '../../lib/supabaseClient'
import { rpcErrorMessage } from '../../lib/rpcErrors'
import { fmtEur, fmtDate } from '../../lib/format'
import type { TeamMember } from '../../lib/team'
import type { Database } from '../../lib/database.types'

type Suggestion = Database['public']['Tables']['suggestions']['Row']

function typeInfo(type: string): { label: string; className: string } {
  if (type === 'new_fee') return { label: 'Uusi sakko', className: 'type-newfee' }
  if (type === 'removal') return { label: 'Poistopyyntö', className: 'type-removal' }
  if (type === 'mark_paid') return { label: 'Maksettu-pyyntö', className: 'type-markpaid' }
  if (type === 'mark_all_paid') return { label: 'Maksettu (kaikki)', className: 'type-markpaid' }
  return { label: type, className: '' }
}

// "Maksettu"-tyyppiset ehdotukset saa hyväksyä vain ylläpitäjä (ei
// äänestyskynnyksellä, kuten poistopyynnöt) — maksettu-väite on joko
// tosi tai ei, eikä sitä äänestetä kasaan; poistopyyntö voi koskea
// kiistanalaista tilannetta jota halutaan voida haastaa äänin.
function isAdminOnlyType(type: string): boolean {
  return type === 'mark_paid' || type === 'mark_all_paid'
}

export function PendingPage() {
  const { team, myMember, canApprove, canManage } = useTeamContext()
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [usernames, setUsernames] = useState<Map<string, string>>(new Map())
  const [voterCounts, setVoterCounts] = useState<Map<string, number>>(new Map())
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    const [{ data: members }, { data: sugs }] = await Promise.all([
      supabase.from('team_members').select('id, username').eq('team_id', team.id),
      supabase.from('suggestions').select('*').eq('team_id', team.id).eq('status', 'pending').order('created_at', { ascending: true }),
    ])

    const nameMap = new Map<string, string>((members ?? []).map((m: Pick<TeamMember, 'id' | 'username'>) => [m.id, m.username]))
    setUsernames(nameMap)
    setSuggestions(sugs ?? [])

    const sugIds = (sugs ?? []).map((s) => s.id)
    if (sugIds.length > 0) {
      const { data: votes } = await supabase.from('suggestion_votes').select('suggestion_id, member_id').in('suggestion_id', sugIds)
      const counts = new Map<string, number>()
      const mine = new Set<string>()
      for (const v of votes ?? []) {
        counts.set(v.suggestion_id, (counts.get(v.suggestion_id) ?? 0) + 1)
        if (myMember && v.member_id === myMember.id) mine.add(v.suggestion_id)
      }
      setVoterCounts(counts)
      setMyVotes(mine)
    } else {
      setVoterCounts(new Map())
      setMyVotes(new Set())
    }
  }, [team.id, myMember])

  useEffect(() => { load() }, [load])

  async function handleVote(suggestion: Suggestion, approve: boolean) {
    let comment = ''
    if (!approve) {
      comment = prompt('Hylkäysperustelu (valinnainen):') ?? ''
    }
    try {
      const { data, error: err } = await supabase.rpc('vote_on_suggestion', {
        p_team_id: team.id,
        p_suggestion_id: suggestion.id,
        p_approve: approve,
        p_comment: comment,
      })
      if (err) throw err
      const result = data as { approved?: boolean; selfApproved?: boolean } | null
      if (result?.selfApproved) alert('✅ Sakko kuitattu!')
      else if (result?.approved) alert('✅ Ehdotus hyväksytty!')
      else if (approve) alert('👍 Ääni tallennettu.')
      else alert('Ehdotus hylätty.')
      load()
    } catch (err) {
      alert(rpcErrorMessage(err))
    }
  }

  if (suggestions === null) {
    return <div className="page"><div className="loading">Ladataan...</div></div>
  }

  return (
    <div className="page">
      {error && <div className="msg msg-err" style={{ display: 'block' }}>{error}</div>}

      {suggestions.length === 0 ? (
        <div className="card"><div className="empty">Ei odottavia ehdotuksia ✅</div></div>
      ) : (
        <div className="card">
          <h2>Odottavat ehdotukset</h2>
          {suggestions.map((s) => {
            const info = typeInfo(s.type)
            const targetName = usernames.get(s.target_member_id) ?? s.target_member_id
            const suggesterName = usernames.get(s.suggested_by_member_id) ?? s.suggested_by_member_id
            const voterCount = voterCounts.get(s.id) ?? 0
            const alreadyVoted = myVotes.has(s.id)
            const isTarget = myMember ? s.target_member_id === myMember.id : false
            const isSuggester = myMember ? s.suggested_by_member_id === myMember.id : false
            const adminOnly = isAdminOnlyType(s.type)
            const canVote = !alreadyVoted && !isSuggester && (isTarget || (adminOnly ? canManage : canApprove))

            return (
              <div className="suggestion-item" key={s.id}>
                <div className="suggestion-header">
                  <div className="suggestion-name">{targetName}</div>
                  <div className="suggestion-amount">{fmtEur(Number(s.amount))}</div>
                </div>
                <span className={`suggestion-type ${info.className}`}>{info.label}</span>
                <div className="suggestion-meta">
                  {s.reason} · ehdottaja: {suggesterName}
                  {s.fee_date ? ` · tapahtui: ${fmtDate(s.fee_date)}` : ''}
                </div>
                {s.comment && <div className="suggestion-comment">💬 {s.comment}</div>}
                <div className="suggestion-actions">
                  {canVote ? (
                    isTarget ? (
                      <button className="btn-sm btn-sm-approve" onClick={() => handleVote(s, true)}>✓ Kuittaa sakko</button>
                    ) : (
                      <>
                        <button className="btn-sm btn-sm-approve" onClick={() => handleVote(s, true)}>✓ Hyväksy</button>
                        {canManage && (
                          <button className="btn-sm btn-sm-reject" onClick={() => handleVote(s, false)}>✗ Hylkää</button>
                        )}
                      </>
                    )
                  ) : alreadyVoted ? (
                    <span style={{ fontSize: 12, color: '#aaa' }}>✓ Äänestit</span>
                  ) : (
                    <span style={{ fontSize: 12, color: '#ccc' }}>Et voi äänestää</span>
                  )}
                  {adminOnly ? (
                    <span className="votes-badge">🔒 Vain ylläpitäjä hyväksyy</span>
                  ) : (
                    <span className="votes-badge">👍 {voterCount}/{team.vote_threshold}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
