'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

type Participant = {
  id: string
  display_name: string | null
  discord_id: string | null
}

type Team = {
  id: string
  name: string
  participants: Participant[]
}

export default function TeamsManager({
  eventId,
  initialTeams,
  initialUnassigned,
  canManage,
}: {
  eventId: string
  initialTeams: Team[]
  initialUnassigned: Participant[]
  canManage: boolean
}) {
  const router = useRouter()
  const [newTeamName, setNewTeamName] = useState('')
  const [addingTeam, setAddingTeam] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [openParticipantForm, setOpenParticipantForm] = useState<string | 'none' | null>(null)
  const [participantName, setParticipantName] = useState('')
  const [participantDiscord, setParticipantDiscord] = useState('')
  const [addingParticipant, setAddingParticipant] = useState(false)

  async function handleAddTeam(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!newTeamName.trim()) return
    setAddingTeam(true)

    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, name: newTeamName }),
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error ?? 'Er ging iets mis.')
      setAddingTeam(false)
      return
    }

    setNewTeamName('')
    setAddingTeam(false)
    router.refresh()
  }

  async function handleDeleteTeam(teamId: string) {
    if (!confirm('Dit team verwijderen? Deelnemers erin worden niet verwijderd, maar raken hun team kwijt.')) return
    await fetch(`/api/teams/${teamId}`, { method: 'DELETE' })
    router.refresh()
  }

  async function handleDeleteParticipant(participantId: string) {
    if (!confirm('Deze deelnemer verwijderen?')) return
    await fetch(`/api/participants/${participantId}`, { method: 'DELETE' })
    router.refresh()
  }

  async function handleAssignParticipant(participantId: string, teamId: string) {
    await fetch(`/api/participants/${participantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: teamId || null }),
    })
    router.refresh()
  }

  async function handleAddParticipant(e: FormEvent, teamId: string | null) {
    e.preventDefault()
    setError(null)
    if (!participantName.trim()) return
    setAddingParticipant(true)

    const res = await fetch('/api/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId,
        teamId,
        displayName: participantName,
        discordId: participantDiscord,
      }),
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error ?? 'Er ging iets mis.')
      setAddingParticipant(false)
      return
    }

    setParticipantName('')
    setParticipantDiscord('')
    setOpenParticipantForm(null)
    setAddingParticipant(false)
    router.refresh()
  }

  function renderParticipant(p: Participant, currentTeamId: string) {
    return (
      <li key={p.id} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span>
          {p.display_name}
          {p.discord_id && <span className="text-muted"> ({p.discord_id})</span>}
        </span>
        {canManage && (
          <>
            <select
              value={currentTeamId}
              onChange={(e) => handleAssignParticipant(p.id, e.target.value)}
              className="input"
              style={{ width: 'auto', padding: '4px 6px', fontSize: 12 }}
            >
              <option value="">Geen team</option>
              {initialTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button onClick={() => handleDeleteParticipant(p.id)} className="btn-link">
              verwijder
            </button>
          </>
        )}
      </li>
    )
  }

  function ParticipantForm({ teamId }: { teamId: string | null }) {
    return (
      <form
        onSubmit={(e) => handleAddParticipant(e, teamId)}
        style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}
      >
        <input
          type="text"
          placeholder="OSRS-naam"
          value={participantName}
          onChange={(e) => setParticipantName(e.target.value)}
          className="input"
          style={{ flex: '1 1 140px' }}
        />
        <input
          type="text"
          placeholder="Discord ID (optioneel)"
          value={participantDiscord}
          onChange={(e) => setParticipantDiscord(e.target.value)}
          className="input"
          style={{ flex: '1 1 140px' }}
        />
        <button type="submit" disabled={addingParticipant} className="btn btn-sm">
          Toevoegen
        </button>
        <button type="button" onClick={() => setOpenParticipantForm(null)} className="btn btn-secondary btn-sm on-parchment">
          Annuleren
        </button>
      </form>
    )
  }

  return (
    <div style={{ marginTop: 32 }}>
      <h2>Teams</h2>

      {error && <p className="error-text">{error}</p>}

      {initialTeams.length === 0 && <p className="text-muted">Nog geen teams aangemaakt.</p>}

      {initialTeams.map((team) => (
        <div key={team.id} className="panel" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>{team.name}</strong>
            {canManage && (
              <button onClick={() => handleDeleteTeam(team.id)} className="btn-link">
                Verwijder team
              </button>
            )}
          </div>

          <ul style={{ marginTop: 8, paddingLeft: 18 }}>
            {team.participants.length === 0 && (
              <li className="text-muted" style={{ listStyle: 'none', marginLeft: -18 }}>
                Nog geen deelnemers
              </li>
            )}
            {team.participants.map((p) => renderParticipant(p, team.id))}
          </ul>

          {canManage && (
            <>
              {openParticipantForm === team.id ? (
                <ParticipantForm teamId={team.id} />
              ) : (
                <button
                  onClick={() => setOpenParticipantForm(team.id)}
                  className="btn btn-secondary btn-sm on-parchment"
                  style={{ marginTop: 8, borderStyle: 'dashed' }}
                >
                  + Deelnemer toevoegen
                </button>
              )}
            </>
          )}
        </div>
      ))}

      {(initialUnassigned.length > 0 || canManage) && (
        <div className="panel-dark" style={{ marginBottom: 12 }}>
          <strong>Niet ingedeeld</strong>
          <ul style={{ marginTop: 8, paddingLeft: 18 }}>
            {initialUnassigned.map((p) => renderParticipant(p, ''))}
          </ul>

          {canManage &&
            (openParticipantForm === 'none' ? (
              <ParticipantForm teamId={null} />
            ) : (
              <button
                onClick={() => setOpenParticipantForm('none')}
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 8, borderStyle: 'dashed' }}
              >
                + Deelnemer toevoegen (zonder team)
              </button>
            ))}
        </div>
      )}

      {canManage && (
        <form onSubmit={handleAddTeam} style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <input
            type="text"
            placeholder="Naam nieuw team"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            className="input"
          />
          <button type="submit" disabled={addingTeam} className="btn" style={{ whiteSpace: 'nowrap' }}>
            + Team toevoegen
          </button>
        </form>
      )}
    </div>
  )
}
