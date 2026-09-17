import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTeamContext } from '../TeamLayout'
import { supabase } from '../../lib/supabaseClient'
import { rpcErrorMessage } from '../../lib/rpcErrors'
import { fmtEur, fmtDate } from '../../lib/format'
import { PlayerFeesModal } from '../../components/PlayerFeesModal'
import type { Fee, TeamMember } from '../../lib/team'

type View = 'players' | 'days'

interface PlayerSummary {
  member: TeamMember
  active: Fee[]
  other: Fee[]
  activeTotal: number
}

export function TeamFeesPage() {
  const { team, canManage } = useTeamContext()
  const [members, setMembers] = useState<TeamMember[] | null>(null)
  const [fees, setFees] = useState<Fee[] | null>(null)
  const [view, setView] = useState<View>('players')
  const [openMemberId, setOpenMemberId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    const [{ data: memberRows, error: memberErr }, { data: feeRows, error: feeErr }] = await Promise.all([
      supabase.from('team_members').select('*').eq('team_id', team.id),
      supabase.from('fees').select('*').eq('team_id', team.id),
    ])
    if (memberErr || feeErr) { setError('Sakkojen lataus epäonnistui.'); return }
    setMembers(memberRows ?? [])
    setFees(feeRows ?? [])
  }, [team.id])

  useEffect(() => { load() }, [load])

  const summaries = useMemo<PlayerSummary[]>(() => {
    if (!members || !fees) return []
    const map = new Map<string, PlayerSummary>()
    const memberMap = new Map(members.map((m) => [m.id, m]))

    function ensure(memberId: string): PlayerSummary | null {
      let entry = map.get(memberId)
      if (!entry) {
        const member = memberMap.get(memberId)
        if (!member) return null
        entry = { member, active: [], other: [], activeTotal: 0 }
        map.set(memberId, entry)
      }
      return entry
    }

    // Kaikki nykyiset aktiiviset jäsenet näkyvät listassa vaikka heillä
    // ei olisi vielä yhtään sakkoa (vanha sovellus näytti tässä vain
    // rekisteröimättömät nollasakolliset jäsenet, ei rekisteröityjä —
    // korjattu tässä johdonmukaiseksi).
    for (const m of members) {
      if (m.status === 'active') ensure(m.id)
    }
    for (const f of fees) {
      const entry = ensure(f.member_id)
      if (!entry) continue
      if (f.status === 'active') {
        entry.active.push(f)
        entry.activeTotal += Number(f.amount)
      } else {
        entry.other.push(f)
      }
    }

    return [...map.values()].sort((a, b) => b.activeTotal - a.activeTotal)
  }, [members, fees])

  const dayGroups = useMemo<[string, Fee[]][]>(() => {
    if (!fees) return []
    const active = fees
      .filter((f) => f.status === 'active')
      .slice()
      .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    const groups = new Map<string, Fee[]>()
    for (const f of active) {
      const day = fmtDate(f.occurred_at)
      if (!groups.has(day)) groups.set(day, [])
      groups.get(day)!.push(f)
    }
    return [...groups.entries()]
  }, [fees])

  const usernameFor = useCallback(
    (memberId: string) => members?.find((m) => m.id === memberId)?.username ?? memberId,
    [members],
  )

  async function handleDeleteFee(fee: Fee) {
    if (!confirm('Poistetaanko sakko?')) return
    try {
      const { error: err } = await supabase.rpc('delete_fee', { p_team_id: team.id, p_fee_id: fee.id })
      if (err) throw err
      setOpenMemberId(null)
      load()
    } catch (err) {
      alert(rpcErrorMessage(err))
    }
  }

  if (members === null || fees === null) {
    return <div className="page"><div className="loading">Ladataan...</div></div>
  }

  const openSummary = summaries.find((s) => s.member.id === openMemberId)

  return (
    <div className="page">
      {error && <div className="msg msg-err" style={{ display: 'block' }}>{error}</div>}

      <div className="card">
        <h2>Sakkokassa</h2>
        <div className="view-toggle">
          <button
            className={`view-toggle-btn ${view === 'players' ? 'active' : ''}`}
            onClick={() => setView('players')}
          >
            👤 Pelaajittain
          </button>
          <button
            className={`view-toggle-btn ${view === 'days' ? 'active' : ''}`}
            onClick={() => setView('days')}
          >
            📅 Päivittäin
          </button>
        </div>

        {view === 'players' ? (
          summaries.length === 0 ? (
            <div className="empty">Ei vielä sakkoja.</div>
          ) : (
            summaries.map((s) => {
              const isZero = s.activeTotal === 0
              return (
                <div className="player-row" key={s.member.id} onClick={() => setOpenMemberId(s.member.id)}>
                  <div>
                    <div className="player-name">
                      {s.member.username}
                      {!s.member.user_id && <span style={{ fontSize: 10, color: '#aaa' }}> (ei rekist.)</span>}
                    </div>
                    <div className="player-sub">{s.active.length} aktiivista sakkoa</div>
                  </div>
                  <div className={`player-total ${isZero ? 'zero' : ''}`}>{fmtEur(s.activeTotal, team.currency_symbol)}</div>
                </div>
              )
            })
          )
        ) : dayGroups.length === 0 ? (
          <div className="empty">Ei aktiivisia sakkoja.</div>
        ) : (
          dayGroups.map(([day, dayFees]) => {
            const dayTotal = dayFees.reduce((sum, f) => sum + Number(f.amount), 0)
            return (
              <div key={day}>
                <div className="day-header">
                  <span>{day}</span>
                  <span className="day-total">{fmtEur(dayTotal, team.currency_symbol)}</span>
                </div>
                {dayFees.map((f) => (
                  <div className="fee-item" key={f.id}>
                    <div style={{ flex: 1 }}>
                      <div className="fee-reason">{usernameFor(f.member_id)} — {f.reason}</div>
                      <div className="fee-meta">{f.added_by}</div>
                    </div>
                    <div className="fee-right">
                      <div className="fee-amount">{fmtEur(f.amount, team.currency_symbol)}</div>
                      {canManage && (
                        <button
                          className="btn-sm btn-sm-ghost"
                          style={{ marginTop: 4, fontSize: 10 }}
                          onClick={() => handleDeleteFee(f)}
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>

      {openSummary && (
        <PlayerFeesModal
          key={openSummary.member.id}
          member={openSummary.member}
          active={openSummary.active}
          other={openSummary.other}
          activeTotal={openSummary.activeTotal}
          currencySymbol={team.currency_symbol}
          canManage={canManage}
          onClose={() => setOpenMemberId(null)}
          onDeleteFee={handleDeleteFee}
        />
      )}
    </div>
  )
}
