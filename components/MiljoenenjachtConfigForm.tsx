'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function MiljoenenjachtConfigForm({
  eventId,
  currentCaseCount,
  currentAssignmentCount,
  locked,
}: {
  eventId: string
  currentCaseCount: number
  currentAssignmentCount: number
  // true zodra het event actief is: dan staan de aantallen vast
  locked: boolean
}) {
  const router = useRouter()
  const [caseCount, setCaseCount] = useState(currentCaseCount)
  const [assignmentCount, setAssignmentCount] = useState(currentAssignmentCount)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!Number.isInteger(caseCount) || caseCount < 3 || caseCount > 100) {
      setError('Kies tussen 3 en 100 koffers.')
      return
    }
    if (!Number.isInteger(assignmentCount) || assignmentCount < 1 || assignmentCount > 100) {
      setError('Kies tussen 1 en 100 opdrachten.')
      return
    }
    setLoading(true)
    const res = await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { caseCount, assignmentCount } }),
    })
    setLoading(false)
    if (!res.ok) {
      const result = await res.json().catch(() => ({}))
      setError(result.error ?? 'Opslaan mislukt.')
      return
    }
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="panel-dark" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="field-label" style={{ margin: 0 }}>
          Aantal koffers:
        </label>
        <input
          type="number"
          min={3}
          max={100}
          value={caseCount}
          onChange={(e) => setCaseCount(Number(e.target.value))}
          className="input"
          style={{ width: 80 }}
          disabled={locked}
        />
        <label className="field-label" style={{ margin: 0 }}>
          Aantal opdrachten:
        </label>
        <input
          type="number"
          min={1}
          max={100}
          value={assignmentCount}
          onChange={(e) => setAssignmentCount(Number(e.target.value))}
          className="input"
          style={{ width: 80 }}
          disabled={locked}
        />
        <button type="submit" disabled={loading || locked} className="btn btn-sm">
          Opslaan
        </button>
      </div>
      <p className="text-muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
        {locked
          ? 'Het event is actief: aantallen staan vast. Zet het event terug naar Concept om ze te wijzigen.'
          : 'Elke voltooide opdracht geeft een team 1 pull; een pull = één koffer openen. Meer opdrachten dan koffers kan, dan is niet iedere opdracht nodig.'}
      </p>
      {error && <p className="error-text">{error}</p>}
    </form>
  )
}
