'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type AcceptedItem = { item_id: number; item_name: string }
type Stage = {
  id: string
  stage_order: number
  label: string
  required_quantity: number
  accepted_items: AcceptedItem[]
}
type Submission = {
  id: string
  stage_id: string
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

// Bepaalt clientside op welke stap een racer zit -- zelfde logica als de server,
// puur voor de weergave (de server checkt dit zelf nogmaals bij het indienen).
function getCurrentStage(
  stages: Stage[],
  submissions: Submission[],
  racerId: string,
  mode: 'team' | 'individual'
) {
  const key = mode === 'team' ? 'team_id' : 'participant_id'
  let current = 0 // index in sorted stages

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    const stageSubs = submissions.filter((s) => s.stage_id === stage.id && s.status !== 'rejected')
    const total = stageSubs
      .filter((s) => (s as any)[key] === racerId)
      .reduce((sum, s) => sum + s.quantity, 0)

    if (total >= stage.required_quantity) {
      current = i + 1
    } else {
      break
    }
  }
  return current // index van de stap waar racer nu aan werkt (0-based)
}

export default function GauntletBoard({
  stages,
  submissions,
  teams,
  participants,
  mode,
  myTeamIds,
  myParticipantIds,
  isOwner,
}: {
  stages: Stage[]
  submissions: Submission[]
  teams: Team[]
  participants: Participant[]
  mode: 'team' | 'individual'
  myTeamIds: string[]
  myParticipantIds: string[]
  isOwner: boolean
}) {
  const router = useRouter()
  const sortedStages = [...stages].sort((a, b) => a.stage_order - b.stage_order)
  const racers = mode === 'team' ? teams : participants
  const myEligibleRacerIds = mode === 'team' ? myTeamIds : myParticipantIds

  const [formOpenFor, setFormOpenFor] = useState<string | null>(null)
  const [asRacerId, setAsRacerId] = useState<string>(myEligibleRacerIds[0] ?? '')
  const [quantity, setQuantity] = useState(1)
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  function racerName(racerId: string) {
    if (mode === 'team') {
      const t = teams.find((x) => x.id === racerId)
      return t ? displayTeamName(t.name) : 'Onbekend team'
    }
    const p = participants.find((x) => x.id === racerId)
    return p?.display_name ?? 'Onbekende deelnemer'
  }

  async function handleSubmit(stageId: string) {
    setError(null)
    setLoading(true)

    const body: any = { stageId, quantity, screenshotUrl }
    if (mode === 'team') body.teamId = asRacerId
    else body.participantId = asRacerId

    const res = await fetch('/api/gauntlet-submissions', {
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
    await fetch(`/api/gauntlet-submissions/${submissionId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason: action === 'reject' ? rejectReason : undefined }),
    })
    setRejectingId(null)
    setRejectReason('')
    router.refresh()
  }

  const allPending = submissions.filter((s) => s.status === 'pending')

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Ladder per racer */}
      <div className="panel-dark" style={{ padding: 12 }}>
        <strong>Voortgang</strong>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {racers.map((racer) => {
            const currentIndex = getCurrentStage(sortedStages, submissions, racer.id, mode)
            const finished = currentIndex >= sortedStages.length
            const currentStage = sortedStages[currentIndex]

            const currentStageTotal = currentStage
              ? submissions
                  .filter(
                    (s) =>
                      s.stage_id === currentStage.id &&
                      s.status !== 'rejected' &&
                      (mode === 'team' ? s.team_id : s.participant_id) === racer.id
                  )
                  .reduce((sum, s) => sum + s.quantity, 0)
              : 0

            const canSubmitHere = !finished && myEligibleRacerIds.includes(racer.id)

            return (
              <div key={racer.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span>
                    <strong>{mode === 'team' ? displayTeamName((racer as Team).name) : (racer as Participant).display_name}</strong>{' '}
                    {finished ? (
                      <span className="badge badge-success">🏆 Voltooid</span>
                    ) : (
                      <span className="text-muted" style={{ fontSize: 12 }}>
                        Stap {currentIndex + 1}/{sortedStages.length}: {currentStage?.label}
                      </span>
                    )}
                  </span>
                  {canSubmitHere && (
                    <button
                      onClick={() => {
                        setFormOpenFor(formOpenFor === racer.id ? null : racer.id)
                        setAsRacerId(racer.id)
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      📸 Insturen
                    </button>
                  )}
                </div>

                {!finished && currentStage && (
                  <div style={{ height: 8, background: 'rgba(0,0,0,0.4)', borderRadius: 6, overflow: 'hidden', marginTop: 4 }}>
                    <div
                      style={{
                        width: `${Math.min(100, (currentStageTotal / currentStage.required_quantity) * 100)}%`,
                        height: '100%',
                        background: 'var(--success)',
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                )}

                {formOpenFor === racer.id && currentStage && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {error && <p className="error-text">{error}</p>}
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
                      onClick={() => handleSubmit(currentStage.id)}
                      disabled={loading || !screenshotUrl.trim()}
                      className="btn btn-sm"
                      style={{ alignSelf: 'flex-start' }}
                    >
                      {loading ? 'Bezig...' : 'Insturen'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Owner: openstaande screenshots */}
      {isOwner && allPending.length > 0 && (
        <div className="panel-dark" style={{ padding: 12 }}>
          <strong>Te beoordelen ({allPending.length})</strong>
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 8, fontSize: 12 }}>
            {allPending.map((s) => {
              const stage = sortedStages.find((st) => st.id === s.stage_id)
              const racerId = mode === 'team' ? s.team_id : s.participant_id
              return (
                <li key={s.id} style={{ padding: '6px 0', borderTop: '1px solid rgba(184,134,59,0.2)' }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span>
                      📸 {racerId ? racerName(racerId) : 'Onbekend'} — {stage?.label} ({s.quantity}x), door{' '}
                      {s.submitterName}
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
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
