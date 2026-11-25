'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Team = { id: string; name: string }
type CaseRow = {
  case_number: number
  opened_at: string | null
  opened_by_team_id: string | null
  revealed_label: string | null
  revealed_gp: number | null
}
type Completion = { assignment_id: string; team_id: string }

function displayTeamName(name: string) {
  const stripped = name.replace(/^Team\s+\d+\s*/i, '').trim()
  return stripped || name
}

const fmt = (n: number) => n.toLocaleString('nl-NL')

export default function MiljoenenjachtBoard({
  eventId,
  eventStatus,
  cases,
  teams,
  completions,
  myTeamIds,
  canManage,
}: {
  eventId: string
  eventStatus: string
  cases: CaseRow[]
  teams: Team[]
  completions: Completion[]
  myTeamIds: string[]
  canManage: boolean
}) {
  const router = useRouter()

  // Wie mag er openen? Je eigen team(s); organizers mogen namens elk team (voor als iemand er niet bij kan zijn).
  const actingTeams = canManage ? teams : teams.filter((t) => myTeamIds.includes(t.id))
  const [teamId, setTeamId] = useState(actingTeams[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ caseNumber: number; label: string; gp: number | null } | null>(null)

  const stats = teams.map((t) => {
    const completed = completions.filter((c) => c.team_id === t.id).length
    const openedCases = cases.filter((c) => c.opened_by_team_id === t.id && c.opened_at)
    const gp = openedCases.reduce((sum, c) => sum + (c.revealed_gp ?? 0), 0)
    return {
      team: t,
      completed,
      opened: openedCases.length,
      // Een afgekeurde inzending kan een voltooide opdracht later weer weghalen; dan kan het aantal
      // geopende koffers hoger zijn dan het aantal voltooide opdrachten. Pulls zijn dan 0, nooit negatief.
      pulls: Math.max(0, completed - openedCases.length),
      gp,
    }
  })

  const myStats = stats.find((s) => s.team.id === teamId)
  const active = eventStatus === 'active'
  const canOpen = active && !!myStats && myStats.pulls > 0 && !busy

  async function handleOpen(caseNumber: number) {
    if (!canOpen || !myStats) return
    if (!confirm(`Koffer ${caseNumber} openen voor ${displayTeamName(myStats.team.name)}? Dit gebruikt 1 pull en kan niet terug.`)) {
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    const res = await fetch('/api/miljoenenjacht/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, teamId, caseNumber }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(data.error ?? 'Koffer openen mislukt.')
      router.refresh()
      return
    }
    setResult(data.result)
    router.refresh()
  }

  const teamName = (id: string | null) => {
    const t = teams.find((x) => x.id === id)
    return t ? displayTeamName(t.name) : 'onbekend team'
  }

  const sortedCases = [...cases].sort((a, b) => a.case_number - b.case_number)
  const openedCount = sortedCases.filter((c) => c.opened_at).length

  return (
    <div style={{ marginTop: 24 }}>
      {/* Stand per team */}
      <div className="panel-dark" style={{ marginBottom: 16 }}>
        <strong>Stand</strong>
        <p className="text-muted" style={{ fontSize: 12, margin: '4px 0 8px' }}>
          Elke voltooide opdracht geeft 1 pull. Met een pull open je één koffer.
        </p>
        {stats.length === 0 ? (
          <p className="text-muted">Er zijn nog geen teams.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr className="text-muted" style={{ textAlign: 'left', fontSize: 12 }}>
                <th>Team</th>
                <th>Opdrachten</th>
                <th>Koffers open</th>
                <th>Pulls over</th>
                <th>Gewonnen</th>
              </tr>
            </thead>
            <tbody>
              {[...stats]
                .sort((a, b) => b.gp - a.gp || b.completed - a.completed)
                .map((s) => (
                  <tr key={s.team.id} style={{ borderTop: '1px solid rgba(184, 134, 59, 0.2)' }}>
                    <td>
                      <strong>{displayTeamName(s.team.name)}</strong>
                    </td>
                    <td>{s.completed}</td>
                    <td>{s.opened}</td>
                    <td>{s.pulls > 0 ? <span className="badge badge-gold">{s.pulls}</span> : 0}</td>
                    <td>{fmt(s.gp)} gp</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Koffers */}
      <div className="panel-dark">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <strong>
            💼 Koffers ({openedCount}/{sortedCases.length} geopend)
          </strong>
          {actingTeams.length > 0 && (
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <label className="field-label" style={{ margin: 0 }}>
                {canManage ? 'Openen namens:' : 'Jouw team:'}
              </label>
              <select className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                {actingTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {displayTeamName(t.name)}
                  </option>
                ))}
              </select>
            </span>
          )}
        </div>

        {actingTeams.length === 0 && !canManage && (
          <p className="text-muted" style={{ fontSize: 13 }}>
            Je zit niet in een team van dit event, dus je kunt alleen meekijken.
          </p>
        )}

        {myStats && active && (
          <p style={{ fontSize: 13, margin: '8px 0' }}>
            {myStats.pulls > 0 ? (
              <>
                🎟️ <strong>{displayTeamName(myStats.team.name)}</strong> heeft{' '}
                <strong>{myStats.pulls}</strong> pull{myStats.pulls === 1 ? '' : 's'}. Klik op een gesloten koffer om
                hem te openen.
              </>
            ) : (
              <span className="text-muted">
                {displayTeamName(myStats.team.name)} heeft geen pulls. Voltooi een opdracht om een koffer te mogen
                openen.
              </span>
            )}
          </p>
        )}

        {!active && (
          <p className="text-muted" style={{ fontSize: 13 }}>
            {eventStatus === 'draft' ? 'Het event is nog niet gestart.' : 'Het event is afgerond.'}
          </p>
        )}

        {error && <p className="error-text">{error}</p>}

        {result && (
          <div
            style={{
              margin: '12px 0',
              padding: 14,
              textAlign: 'center',
              border: '1px solid var(--gold-light)',
              borderRadius: 8,
              background: 'rgba(212, 162, 79, 0.12)',
            }}
          >
            <div className="text-muted" style={{ fontSize: 12 }}>
              Koffer {result.caseNumber} bevatte…
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--gold-light)' }}>🎉 {result.label}</div>
            {result.gp !== null && <div className="text-muted">{fmt(result.gp)} gp</div>}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginTop: 12 }}>
          {sortedCases.map((c) => {
            const isOpen = !!c.opened_at
            return (
              <button
                key={c.case_number}
                type="button"
                onClick={() => !isOpen && handleOpen(c.case_number)}
                disabled={isOpen || !canOpen}
                title={isOpen ? `Geopend door ${teamName(c.opened_by_team_id)}` : `Koffer ${c.case_number}`}
                style={{
                  minHeight: 84,
                  padding: 8,
                  borderRadius: 8,
                  border: `1px solid ${isOpen ? 'rgba(184,134,59,0.25)' : 'var(--gold-dark)'}`,
                  background: isOpen ? 'rgba(0,0,0,0.25)' : 'rgba(184, 134, 59, 0.18)',
                  color: 'inherit',
                  cursor: isOpen || !canOpen ? 'default' : 'pointer',
                  opacity: isOpen ? 0.9 : 1,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 12 }} className="text-muted">
                  {isOpen ? `#${c.case_number}` : ''}
                </div>
                {isOpen ? (
                  <>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.revealed_label}</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      {teamName(c.opened_by_team_id)}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--gold-light)' }}>💼 {c.case_number}</div>
                )}
              </button>
            )
          })}
        </div>

        {sortedCases.length === 0 && (
          <p className="text-muted" style={{ fontSize: 13 }}>
            Er zijn nog geen koffers ingesteld.
          </p>
        )}
      </div>
    </div>
  )
}
