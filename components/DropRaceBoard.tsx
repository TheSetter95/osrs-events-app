'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type AcceptedItem = { item_id: number; item_name: string }
type Race = {
  id: string
  label: string
  required_quantity: number
  mode: 'team' | 'individual'
  status: 'open' | 'pending_claim' | 'completed'
  winning_team_id: string | null
  winning_participant_id: string | null
  accepted_items: AcceptedItem[]
}
type Submission = {
  id: string
  race_id: string
  team_id: string | null
  participant_id: string | null
  quantity: number
  status: 'confirmed' | 'pending' | 'rejected'
  screenshot_url: string | null
  rejection_reason: string | null
  submitterName: string
}
type Team = { id: string; name: string }
type Participant = { id: string; display_name: string | null }

function displayTeamName(name: string) {
  const stripped = name.replace(/^Team\s+\d+\s*/i, '').trim()
  return stripped || name
}

export default function DropRaceBoard({
  races,
  submissions,
  teams,
  participants,
  myTeamIds,
  myParticipantIds,
  isOwner,
}: {
  races: Race[]
  submissions: Submission[]
  teams: Team[]
  participants: Participant[]
  myTeamIds: string[]
  myParticipantIds: string[]
  isOwner: boolean
}) {
  const router = useRouter()
  const [formOpenFor, setFormOpenFor] = useState<string | null>(null)
  const [asRacerId, setAsRacerId] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  function racerName(mode: 'team' | 'individual', racerId: string) {
    if (mode === 'team') {
      const t = teams.find((x) => x.id === racerId)
      return t ? displayTeamName(t.name) : 'Onbekend team'
    }
    const p = participants.find((x) => x.id === racerId)
    return p?.display_name ?? 'Onbekende deelnemer'
  }

  async function handleSubmit(raceId: string, mode: 'team' | 'individual') {
    setError(null)
    setLoading(true)

    const body: any = { raceId, quantity, screenshotUrl }
    if (mode === 'team') body.teamId = asRacerId
    else body.participantId = asRacerId

    const res = await fetch('/api/drop-race-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const result = await res.json()

    setLoading(false)

    if (!res.ok) {
      setError(result.error ?? 'Er ging iets mis.')
      return
    }

    setFormOpenFor(null)
    setQuantity(1)
    setScreenshotUrl('')
    router.refresh()
  }

  async function handleReview(submissionId: string, action: 'confirm' | 'reject') {
    await fetch(`/api/drop-race-submissions/${submissionId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason: action === 'reject' ? rejectReason : undefined }),
    })
    setRejectingId(null)
    setRejectReason('')
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 16 }}>
      {races.map((race) => {
        const raceSubmissions = submissions.filter((s) => s.race_id === race.id)

        const racerIds =
          race.mode === 'team'
            ? teams.map((t) => t.id)
            : participants.map((p) => p.id)

        const totals: Record<string, number> = {}
        for (const id of racerIds) totals[id] = 0
        for (const s of raceSubmissions) {
          if (s.status === 'rejected') continue
          const key = race.mode === 'team' ? s.team_id : s.participant_id
          if (key) totals[key] = (totals[key] ?? 0) + s.quantity
        }

        const sortedRacers = [...racerIds].sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0))

        const myEligibleRacerIds = race.mode === 'team' ? myTeamIds : myParticipantIds
        const canSubmit = race.status !== 'completed' && myEligibleRacerIds.length > 0

        const winnerId = race.winning_team_id ?? race.winning_participant_id

        return (
          <div key={race.id} className="panel-dark" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <strong title={race.accepted_items.map((a) => a.item_name).join(', ')}>
                🏁 {race.label}
                <span className="text-muted" style={{ fontSize: 12, marginLeft: 6 }}>
                  ({race.required_quantity}x, {race.mode === 'team' ? 'per team' : 'individueel'})
                </span>
              </strong>

              {race.status === 'completed' && winnerId && (
                <span className="badge badge-success">🏆 Gewonnen door {racerName(race.mode, winnerId)}</span>
              )}
              {race.status === 'pending_claim' && winnerId && (
                <span className="badge badge-muted">⏳ {racerName(race.mode, winnerId)} claimt, in afwachting</span>
              )}

              {canSubmit && (
                <button
                  onClick={() => {
                    setFormOpenFor(formOpenFor === race.id ? null : race.id)
                    setAsRacerId(myEligibleRacerIds[0])
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  📸 Screenshot insturen
                </button>
              )}
            </div>

            {formOpenFor === race.id && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {error && <p className="error-text">{error}</p>}
                {myEligibleRacerIds.length > 1 && (
                  <select value={asRacerId} onChange={(e) => setAsRacerId(e.target.value)} className="input">
                    {myEligibleRacerIds.map((id) => (
                      <option key={id} value={id}>
                        {racerName(race.mode, id)}
                      </option>
                    ))}
                  </select>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <label className="field-label" style={{ margin: 0 }}>Aantal:</label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="input"
                    style={{ width: 70 }}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Link naar screenshot"
                  value={screenshotUrl}
                  onChange={(e) => setScreenshotUrl(e.target.value)}
                  className="input"
                />
                <button
                  onClick={() => handleSubmit(race.id, race.mode)}
                  disabled={loading || !screenshotUrl.trim()}
                  className="btn btn-sm"
                  style={{ alignSelf: 'flex-start' }}
                >
                  {loading ? 'Bezig...' : 'Insturen'}
                </button>
              </div>
            )}

            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sortedRacers.map((racerId) => {
                const total = totals[racerId] ?? 0
                const pct = Math.min(100, (total / race.required_quantity) * 100)
                return (
                  <div key={racerId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 110, fontSize: 12, flexShrink: 0 }}>{racerName(race.mode, racerId)}</span>
                    <div style={{ flex: 1, height: 10, background: 'rgba(0,0,0,0.4)', borderRadius: 6, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: racerId === winnerId ? 'var(--gold-light)' : 'var(--success)',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                    <span className="text-muted" style={{ fontSize: 11, width: 50, textAlign: 'right' }}>
                      {total}/{race.required_quantity}
                    </span>
                  </div>
                )
              })}
            </div>

            {isOwner && raceSubmissions.some((s) => s.status === 'pending') && (
              <ul style={{ listStyle: 'none', padding: 0, marginTop: 10, fontSize: 12 }}>
                {raceSubmissions
                  .filter((s) => s.status === 'pending')
                  .map((s) => (
                    <li key={s.id} style={{ padding: '6px 0', borderTop: '1px solid rgba(184,134,59,0.2)' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>
                          📸 {racerName(race.mode, (race.mode === 'team' ? s.team_id : s.participant_id) ?? '')} —{' '}
                          {s.quantity}x, door {s.submitterName}
                        </span>
                        {s.screenshot_url && (
                          <a href={s.screenshot_url} target="_blank" rel="noopener noreferrer">
                            bekijk
                          </a>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                        <button onClick={() => handleReview(s.id, 'confirm')} className="btn btn-success btn-sm">
                          ✅ Bevestigen
                        </button>
                        {rejectingId === s.id ? (
                          <>
                            <input
                              type="text"
                              placeholder="Reden (optioneel)"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              className="input"
                              style={{ width: 160 }}
                            />
                            <button onClick={() => handleReview(s.id, 'reject')} className="btn btn-danger btn-sm">
                              Bevestig afwijzing
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setRejectingId(s.id)}
                            className="btn btn-sm"
                            style={{ background: 'transparent', border: '1px solid var(--danger-light)', color: 'var(--danger-light)' }}
                          >
                            ❌ Afwijzen
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
