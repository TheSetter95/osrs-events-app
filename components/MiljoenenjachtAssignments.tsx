'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Team = { id: string; name: string }
type Assignment = {
  id: string
  position: number
  title: string
  description: string | null
  image_url: string | null
  wiki_url: string | null
  effect_type: 'geen' | 'verzamel_item'
  requirements?: { id: string; label: string; required_quantity: number }[]
}
type Completion = { assignment_id: string; team_id: string }

function displayTeamName(name: string) {
  const stripped = name.replace(/^Team\s+\d+\s*/i, '').trim()
  return stripped || name
}

// De opdrachtenlijst voor alle spelers. Organizers kunnen opdrachten zonder item-controle
// ("geen") handmatig afvinken voor een team; dat geeft het team ook 1 pull.
export default function MiljoenenjachtAssignments({
  assignments,
  teams,
  completions,
  canManage,
  eventStatus,
}: {
  assignments: Assignment[]
  teams: Team[]
  completions: Completion[]
  canManage: boolean
  eventStatus: string
}) {
  const router = useRouter()
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '')
  const [busyId, setBusyId] = useState<string | null>(null)

  async function toggle(assignmentId: string) {
    if (!canManage || !teamId) return
    setBusyId(assignmentId)
    await fetch('/api/mj-completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId, teamId }),
    })
    setBusyId(null)
    router.refresh()
  }

  const sorted = [...assignments].sort((a, b) => a.position - b.position)

  return (
    <div className="panel-dark" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <strong>📋 Opdrachten ({sorted.length})</strong>
        {canManage && teams.length > 0 && eventStatus === 'active' && (
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <label className="field-label" style={{ margin: 0 }}>
              Afvinken voor team:
            </label>
            <select className="input" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {displayTeamName(t.name)}
                </option>
              ))}
            </select>
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-muted" style={{ fontSize: 13 }}>
          Er zijn nog geen opdrachten ingesteld.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map((a) => {
            const doneTeams = completions.filter((c) => c.assignment_id === a.id).map((c) => c.team_id)
            const doneByActing = doneTeams.includes(teamId)
            return (
              <li
                key={a.id}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '8px 0',
                  borderTop: '1px solid rgba(184, 134, 59, 0.2)',
                }}
              >
                {a.image_url && (
                  <img src={a.image_url} alt="" width={32} height={32} style={{ objectFit: 'contain', marginTop: 2 }} />
                )}
                <div style={{ flex: 1 }}>
                  <strong>
                    {a.position}. {a.title}
                  </strong>
                  {a.description && (
                    <div className="text-muted" style={{ fontSize: 13 }}>
                      {a.description}
                    </div>
                  )}
                  {a.effect_type === 'verzamel_item' && a.requirements && a.requirements.length > 0 && (
                    <div className="text-muted" style={{ fontSize: 12 }}>
                      🎯 {a.requirements.map((r) => `${r.required_quantity}× ${r.label}`).join(' · ')}
                    </div>
                  )}
                  {doneTeams.length > 0 && (
                    <div style={{ fontSize: 12, marginTop: 2 }}>
                      ✅ {doneTeams.map((id) => displayTeamName(teams.find((t) => t.id === id)?.name ?? '?')).join(', ')}
                    </div>
                  )}
                </div>
                {canManage && eventStatus === 'active' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busyId === a.id || !teamId}
                    onClick={() => toggle(a.id)}
                  >
                    {doneByActing ? 'Terugzetten' : 'Afvinken'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
