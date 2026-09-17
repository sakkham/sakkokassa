import { useCallback, useEffect, useState } from 'react'
import { useTeamContext } from '../TeamLayout'
import { supabase } from '../../lib/supabaseClient'
import { rpcErrorMessage } from '../../lib/rpcErrors'
import { fmtEur } from '../../lib/format'
import type { FeeType, TeamMember } from '../../lib/team'
import { AddFeeModal } from '../../components/AddFeeModal'
import { BulkMoveFeesModal } from '../../components/BulkMoveFeesModal'
import { ArchiveSeasonModal } from '../../components/ArchiveSeasonModal'
import { AddFeeTypeModal } from '../../components/AddFeeTypeModal'
import { MemberRoleRow } from '../../components/MemberRoleRow'

type ModalKind = 'addfee' | 'bulkmove' | 'archive' | 'addfeetype' | null

export function TeamAdminPage() {
  const { team, myMember, canManage, refreshTeam } = useTeamContext()
  const [members, setMembers] = useState<TeamMember[] | null>(null)
  const [feeTypes, setFeeTypes] = useState<FeeType[] | null>(null)
  const [modal, setModal] = useState<ModalKind>(null)

  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [regenerating, setRegenerating] = useState(false)

  const [publicViewToken, setPublicViewToken] = useState<string | null>(null)
  const [publicViewCopied, setPublicViewCopied] = useState(false)
  const [publicViewError, setPublicViewError] = useState('')
  const [publicViewBusy, setPublicViewBusy] = useState(false)

  const [roleEdits, setRoleEdits] = useState<Record<string, string>>({})
  const [membersError, setMembersError] = useState('')
  const [membersOk, setMembersOk] = useState('')
  const [savingRoles, setSavingRoles] = useState(false)

  const [voteThreshold, setVoteThreshold] = useState(team.vote_threshold)
  const [allowPlayerSuggest, setAllowPlayerSuggest] = useState(team.allow_player_suggest)
  const [maxFee, setMaxFee] = useState(String(team.max_fee_amount))
  const [currency, setCurrency] = useState(team.currency_symbol)
  const [seasonName, setSeasonName] = useState(team.season_name)
  // Arkistointi nollaa season_namen palvelimella (uusi, nimeämätön kausi
  // alkaa) — pidä lomakkeen kenttä synkassa sen sijaan että se jäisi
  // näyttämään juuri arkistoitua, jo vanhentunutta nimeä.
  useEffect(() => { setSeasonName(team.season_name) }, [team.season_name])
  const [settingsError, setSettingsError] = useState('')
  const [settingsOk, setSettingsOk] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  const load = useCallback(async () => {
    const [{ data: memberRows }, { data: feeTypeRows }, { data: codeData, error: codeErr }, { data: viewTokenData, error: viewTokenErr }] =
      await Promise.all([
        supabase.from('team_members').select('*').eq('team_id', team.id).eq('status', 'active'),
        supabase.from('fee_types').select('*').eq('team_id', team.id),
        supabase.rpc('get_invite_code', { p_team_id: team.id }),
        supabase.rpc('get_public_view_token', { p_team_id: team.id }),
      ])
    setMembers(memberRows ?? [])
    setRoleEdits(Object.fromEntries((memberRows ?? []).map((m) => [m.id, m.role])))
    setFeeTypes(feeTypeRows ?? [])
    if (!codeErr) setInviteCode(codeData ?? null)
    if (!viewTokenErr) setPublicViewToken(viewTokenData ?? null)
  }, [team.id])

  useEffect(() => { load() }, [load])

  if (!canManage) {
    return (
      <div className="page">
        <div className="card"><div className="empty">Sinulla ei ole oikeutta tähän näkymään.</div></div>
      </div>
    )
  }

  function closeModalAndReload() {
    setModal(null)
    load()
  }

  function closeArchiveModalAndReload() {
    setModal(null)
    load()
    refreshTeam()
  }

  async function saveSettings() {
    setSettingsError('')
    const threshold = voteThreshold
    const maxFeeNum = parseFloat(maxFee)
    if (!threshold || threshold < 1 || threshold > 10) { setSettingsError('Äänimäärän täytyy olla 1–10.'); return }
    if (!maxFeeNum || maxFeeNum < 1) { setSettingsError('Maksimisumman täytyy olla vähintään 1.'); return }

    setSavingSettings(true)
    try {
      const { error } = await supabase.rpc('save_team_settings', {
        p_team_id: team.id,
        p_vote_threshold: threshold,
        p_allow_player_suggest: allowPlayerSuggest,
        p_max_fee_amount: maxFeeNum,
        p_currency_symbol: currency.trim() || '€',
        p_season_name: seasonName.trim(),
      })
      if (error) throw error
      setSettingsOk('✅ Asetukset tallennettu!')
      refreshTeam()
    } catch (err) {
      setSettingsError(rpcErrorMessage(err))
    } finally {
      setSavingSettings(false)
    }
  }

  async function saveAllRoles() {
    if (!members) return
    setMembersError('')
    setMembersOk('')
    const changed = members.filter((m) => roleEdits[m.id] && roleEdits[m.id] !== m.role)
    if (changed.length === 0) { setMembersOk('Ei muutoksia.'); return }

    setSavingRoles(true)
    try {
      for (const m of changed) {
        const { error } = await supabase.rpc('set_team_role', {
          p_team_id: team.id,
          p_member_id: m.id,
          p_new_role: roleEdits[m.id],
        })
        if (error) throw error
      }
      setMembersOk('✅ Roolit päivitetty!')
      load()
    } catch (err) {
      setMembersError(rpcErrorMessage(err))
    } finally {
      setSavingRoles(false)
    }
  }

  async function handleCopyCode() {
    if (!inviteCode) return
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      // Leikepöytä ei aina saatavilla — koodi on joka tapauksessa näkyvissä.
    }
  }

  async function handleRegenerateCode() {
    if (!confirm('Luodaanko uusi kutsukoodi? Vanha koodi lakkaa toimimasta välittömästi.')) return
    setCodeError('')
    setRegenerating(true)
    try {
      const { data, error } = await supabase.rpc('regenerate_invite_code', { p_team_id: team.id })
      if (error) throw error
      setInviteCode(data)
    } catch (err) {
      setCodeError(rpcErrorMessage(err))
    } finally {
      setRegenerating(false)
    }
  }

  function publicViewUrl(token: string): string {
    return `${window.location.origin}${import.meta.env.BASE_URL}#/katso/${token}`
  }

  async function handleTogglePublicView(enabled: boolean) {
    setPublicViewError('')
    setPublicViewBusy(true)
    try {
      if (enabled) {
        const { data, error } = await supabase.rpc('regenerate_public_view_token', { p_team_id: team.id })
        if (error) throw error
        setPublicViewToken(data)
      } else {
        const { error } = await supabase.rpc('disable_public_view', { p_team_id: team.id })
        if (error) throw error
        setPublicViewToken(null)
      }
    } catch (err) {
      setPublicViewError(rpcErrorMessage(err))
    } finally {
      setPublicViewBusy(false)
    }
  }

  async function handleRegeneratePublicView() {
    if (!confirm('Luodaanko uusi katselulinkki? Vanha linkki lakkaa toimimasta välittömästi.')) return
    setPublicViewError('')
    setPublicViewBusy(true)
    try {
      const { data, error } = await supabase.rpc('regenerate_public_view_token', { p_team_id: team.id })
      if (error) throw error
      setPublicViewToken(data)
    } catch (err) {
      setPublicViewError(rpcErrorMessage(err))
    } finally {
      setPublicViewBusy(false)
    }
  }

  async function handleCopyPublicViewLink() {
    if (!publicViewToken) return
    try {
      await navigator.clipboard.writeText(publicViewUrl(publicViewToken))
      setPublicViewCopied(true)
      setTimeout(() => setPublicViewCopied(false), 2000)
    } catch {
      // Leikepöytä ei aina saatavilla — linkki on joka tapauksessa näkyvissä.
    }
  }

  async function handleRemoveMember(member: TeamMember) {
    const question = member.user_id
      ? `Poistetaanko ${member.username} joukkueesta? Hänen sakkonsa säilyvät joukkueen tiedoissa.`
      : `Poistetaanko ${member.username} listalta?`
    if (!confirm(question)) return
    setMembersError('')
    setMembersOk('')
    try {
      const { data, error } = await supabase.rpc('remove_member', { p_team_id: team.id, p_member_id: member.id })
      if (error) throw error
      const result = data as { deleted?: boolean } | null
      setMembersOk(
        result?.deleted
          ? `✅ ${member.username} poistettu.`
          : `✅ ${member.username} poistettu joukkueesta — sakot säilyvät.`,
      )
      load()
    } catch (err) {
      setMembersError(rpcErrorMessage(err))
    }
  }

  async function deleteFeeType(feeType: FeeType) {
    if (!confirm(`Poistetaanko sakkotyyppi "${feeType.reason}"?`)) return
    try {
      const { error } = await supabase.rpc('delete_fee_type', { p_fee_type_id: feeType.id })
      if (error) throw error
      load()
    } catch (err) {
      alert(rpcErrorMessage(err))
    }
  }

  return (
    <div className="page">
      <div className="card">
        <h2>🔑 Kutsukoodi</h2>
        {codeError && <div className="msg msg-err" style={{ display: 'block' }}>{codeError}</div>}
        <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
          Jaa tämä koodi joukkueen ulkopuolella (esim. WhatsApp/Discord) — sillä pelaajat pääsevät liittymään.
        </div>
        <div
          style={{
            fontSize: 26, fontWeight: 800, letterSpacing: 3, textAlign: 'center',
            background: '#f0f2f5', borderRadius: 12, padding: '14px 12px', marginBottom: 12,
          }}
        >
          {inviteCode ?? '········'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleCopyCode} disabled={!inviteCode}>
            {codeCopied ? '✅ Kopioitu!' : '📋 Kopioi'}
          </button>
          <button className="btn btn-outline-danger" style={{ flex: 1 }} onClick={handleRegenerateCode} disabled={regenerating}>
            🔄 Luo uusi koodi
          </button>
        </div>
      </div>

      <div className="card">
        <h2>🔎 Julkinen katselulinkki</h2>
        {publicViewError && <div className="msg msg-err" style={{ display: 'block' }}>{publicViewError}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Salli katselu ilman kirjautumista</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
              Näyttää pelaajien nimet ja aktiiviset sakkosummat kenelle tahansa jolla on linkki — ei sakkorivejä, ei ehdotuksia.
            </div>
          </div>
          <label className="toggle-wrap">
            <input
              type="checkbox"
              checked={!!publicViewToken}
              onChange={(e) => handleTogglePublicView(e.target.checked)}
              disabled={publicViewBusy}
            />
            <span className="toggle-slider" />
          </label>
        </div>
        {publicViewToken && (
          <>
            <div
              style={{
                fontSize: 12, wordBreak: 'break-all', background: '#f0f2f5',
                borderRadius: 12, padding: '12px', marginBottom: 12,
              }}
            >
              {publicViewUrl(publicViewToken)}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleCopyPublicViewLink}>
                {publicViewCopied ? '✅ Kopioitu!' : '📋 Kopioi linkki'}
              </button>
              <button className="btn btn-outline-danger" style={{ flex: 1 }} onClick={handleRegeneratePublicView} disabled={publicViewBusy}>
                🔄 Luo uusi linkki
              </button>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>⚡ Toiminnot</h2>
        <button className="btn btn-danger" onClick={() => setModal('addfee')}>💸 Lisää sakko suoraan</button>
        <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={() => setModal('bulkmove')}>🔀 Siirrä sakot</button>
        <button className="btn btn-outline-danger" style={{ marginTop: 8 }} onClick={() => setModal('archive')}>📦 Arkistoi kausi</button>
      </div>

      <div className="card">
        <h2>👥 Jäsenet</h2>
        {membersError && <div className="msg msg-err" style={{ display: 'block' }}>{membersError}</div>}
        {membersOk && <div className="msg msg-ok" style={{ display: 'block' }}>{membersOk}</div>}
        {members === null ? (
          <div className="loading">Ladataan...</div>
        ) : members.length === 0 ? (
          <div className="empty">Ei jäseniä.</div>
        ) : (
          <>
            {members.map((m) => (
              <MemberRoleRow
                key={m.id}
                member={m}
                role={roleEdits[m.id] ?? m.role}
                disabled={savingRoles}
                isSelf={myMember?.id === m.id}
                onChange={(memberId, role) => setRoleEdits((prev) => ({ ...prev, [memberId]: role }))}
                onRemove={handleRemoveMember}
              />
            ))}
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={saveAllRoles} disabled={savingRoles}>
              💾 Tallenna roolit
            </button>
          </>
        )}
      </div>

      <div className="card">
        <h2>⚙️ Joukkueen asetukset</h2>
        {settingsError && <div className="msg msg-err" style={{ display: 'block' }}>{settingsError}</div>}
        {settingsOk && <div className="msg msg-ok" style={{ display: 'block' }}>{settingsOk}</div>}

        <div className="section-title">Äänestys</div>
        <label>
          Hyväksyntään vaadittavat äänet
          <span style={{ fontWeight: 400, color: '#aaa' }}> — ylläpitäjä hyväksyy aina suoraan</span>
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={voteThreshold}
            onChange={(e) => setVoteThreshold(Number(e.target.value))}
            style={{ flex: 1, margin: 0, padding: 0, accentColor: '#1a1a2e', cursor: 'pointer' }}
          />
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexShrink: 0 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: '#1a1a2e', minWidth: 24, textAlign: 'center' }}>{voteThreshold}</span>
            <span style={{ fontSize: 13, color: '#aaa' }}>ääntä</span>
          </span>
        </div>

        <div className="section-title">Ehdotukset</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Pelaajat voivat ehdottaa sakkoja</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>Pois: vain hyväksyjät ja ylläpitäjät voivat ehdottaa</div>
          </div>
          <label className="toggle-wrap">
            <input type="checkbox" checked={allowPlayerSuggest} onChange={(e) => setAllowPlayerSuggest(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>

        <label htmlFor="ts-max-fee">Sakkoehdotuksen maksimisumma ({currency})</label>
        <input id="ts-max-fee" type="number" min={1} step={1} value={maxFee} onChange={(e) => setMaxFee(e.target.value)} />

        <div className="section-title">Näyttö</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: '0 0 80px' }}>
            <label htmlFor="ts-currency">Valuutta</label>
            <input id="ts-currency" type="text" maxLength={4} value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="ts-season">Kauden nimi <span style={{ fontWeight: 400, color: '#aaa' }}>(valinnainen)</span></label>
            <input id="ts-season" type="text" maxLength={40} value={seasonName} onChange={(e) => setSeasonName(e.target.value)} />
          </div>
        </div>

        <button className="btn btn-primary" onClick={saveSettings} disabled={savingSettings}>💾 Tallenna asetukset</button>
      </div>

      <div className="card">
        <h2>📋 Sakkotyypit</h2>
        {feeTypes === null ? (
          <div className="loading">Ladataan...</div>
        ) : feeTypes.length === 0 ? (
          <div className="empty" style={{ padding: '8px 0' }}>Ei sakkotyyppejä vielä.</div>
        ) : (
          feeTypes.map((f) => (
            <div className="fee-item" key={f.id}>
              <div className="fee-reason">{f.reason}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <div className="fee-amount">{fmtEur(f.default_amount)}</div>
                <button className="btn-sm btn-sm-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => deleteFeeType(f)}>🗑</button>
              </div>
            </div>
          ))
        )}
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-outline" onClick={() => setModal('addfeetype')}>+ Lisää sakkotyyppi</button>
        </div>
      </div>

      {modal === 'addfee' && members && feeTypes && (
        <AddFeeModal teamId={team.id} members={members} feeTypes={feeTypes} onClose={() => setModal(null)} onAdded={closeModalAndReload} />
      )}
      {modal === 'bulkmove' && members && (
        <BulkMoveFeesModal teamId={team.id} members={members} onClose={() => setModal(null)} onMoved={closeModalAndReload} />
      )}
      {modal === 'archive' && (
        <ArchiveSeasonModal
          teamId={team.id}
          defaultSeasonName={team.season_name}
          onClose={() => setModal(null)}
          onArchived={closeArchiveModalAndReload}
        />
      )}
      {modal === 'addfeetype' && (
        <AddFeeTypeModal teamId={team.id} onClose={() => setModal(null)} onAdded={closeModalAndReload} />
      )}
    </div>
  )
}
