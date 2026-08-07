'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Submission = {
  id: string
  requirement_id: string
  quantity: number
  source: 'plugin' | 'screenshot'
  status: 'confirmed' | 'pending' | 'rejected'
  screenshot_url: string | null
  rejection_reason: string | null
  created_at: string
  submitterName: string
}

type Requirement = {
  id: string
  label: string
  required_quantity: number
  accepted_items?: { item_id: number; item_name: string }[]
}

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'zojuist'
  if (minutes < 60) return `${minutes} min geleden`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} uur geleden`
  const days = Math.floor(hours / 24)
  return `${days} dag${days === 1 ? '' : 'en'} geleden`
}

export default function ItemSubmissionsPanel({
  requirements,
  submissions,
  teamId,
  canSubmit,
  isOwner,
}: {
  requirements: Requirement[]
  submissions: Submission[]
  teamId: string | null
  canSubmit: boolean
  isOwner: boolean
}) {
  const router = useRouter()
  const [formOpenFor, setFormOpenFor] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [screenshotUrl, setScreenshotUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  async function handleSubmitScreenshot(requirementId: string) {
    if (!teamId) return
    setError(null)
    setLoading(true)

    const res = await fetch('/api/item-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requirementId, teamId, quantity, screenshotUrl }),
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
    await fetch(`/api/item-submissions/${submissionId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason: action === 'reject' ? rejectReason : undefined }),
    })
    setRejectingId(null)
    setRejectReason('')
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
      {requirements.map((req) => {
        const reqSubmissions = submissions
          .filter((s) => s.requirement_id === req.id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

        const total = reqSubmissions
          .filter((s) => s.status !== 'rejected')
          .reduce((sum, s) => sum + s.quantity, 0)

        const hasPending = reqSubmissions.some((s) => s.status === 'pending')

        return (
          <div key={req.id} className="panel-dark" style={{ padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <strong title={(req.accepted_items ?? []).map((a) => a.item_name).join(', ')}>
                {req.label} — {total}/{req.required_quantity}
                {hasPending && (
                  <span className="text-muted" style={{ fontSize: 12, marginLeft: 6 }}>
                    ⏳ nog te bevestigen
                  </span>
                )}
              </strong>

              {canSubmit && total < req.required_quantity && (
                <button
                  onClick={() => setFormOpenFor(formOpenFor === req.id ? null : req.id)}
                  className="btn btn-secondary btn-sm"
                >
                  📸 Screenshot insturen
                </button>
              )}
            </div>

            {formOpenFor === req.id && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                  placeholder="Link naar screenshot (bv. via Gyazo, Imgur, of een Discord-berichtlink)"
                  value={screenshotUrl}
                  onChange={(e) => setScreenshotUrl(e.target.value)}
                  className="input"
                />
                <button
                  onClick={() => handleSubmitScreenshot(req.id)}
                  disabled={loading || !screenshotUrl.trim()}
                  className="btn btn-sm"
                  style={{ alignSelf: 'flex-start' }}
                >
                  {loading ? 'Bezig...' : 'Insturen'}
                </button>
              </div>
            )}

            {reqSubmissions.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, marginTop: 10, fontSize: 12 }}>
                {reqSubmissions.map((s) => (
                  <li
                    key={s.id}
                    style={{
                      padding: '6px 0',
                      borderTop: '1px solid rgba(184, 134, 59, 0.2)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>{s.source === 'plugin' ? '🔌' : '📸'}</span>
                      <strong>+{s.quantity}</strong>
                      <span className="text-muted">
                        {s.source === 'plugin' ? 'via RuneLite' : 'screenshot'} — {s.submitterName},{' '}
                        {timeAgo(s.created_at)}
                      </span>
                      {s.status === 'pending' && <span className="badge badge-muted">⏳ te beoordelen</span>}
                      {s.status === 'rejected' && <span className="badge badge-danger">❌ afgewezen</span>}
                      {s.screenshot_url && (
                        <a href={s.screenshot_url} target="_blank" rel="noopener noreferrer">
                          bekijk
                        </a>
                      )}
                    </div>

                    {s.status === 'rejected' && s.rejection_reason && (
                      <span className="text-muted" style={{ fontSize: 11 }}>
                        Reden: {s.rejection_reason}
                      </span>
                    )}

                    {isOwner && s.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
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
                          <button onClick={() => setRejectingId(s.id)} className="btn btn-secondary on-parchment btn-sm">
                            ❌ Afwijzen
                          </button>
                        )}
                      </div>
                    )}
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
