'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteCommunityButton({
  slug,
  communityName,
}: {
  slug: string
  communityName: string
}) {
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete() {
    if (confirmText !== communityName) return
    setLoading(true)
    setError(null)

    const res = await fetch(`/api/communities/${slug}`, { method: 'DELETE' })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error ?? 'Er ging iets mis.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="panel-dark" style={{ marginTop: 32, border: '1px solid var(--danger)' }}>
      <h3 style={{ color: 'var(--danger-light)', fontSize: 16 }}>Gevarenzone</h3>
      <p className="text-muted" style={{ fontSize: 13 }}>
        Dit verwijdert de community en alles erin (events, teams, deelnemers,
        geschiedenis) permanent. Dit kan niet ongedaan worden gemaakt.
      </p>
      <p style={{ fontSize: 13 }}>
        Typ <strong>{communityName}</strong> om te bevestigen:
      </p>
      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        className="input"
        style={{ marginBottom: 8, maxWidth: 300 }}
      />
      {error && <p className="error-text">{error}</p>}
      <button
        onClick={handleDelete}
        disabled={confirmText !== communityName || loading}
        className="btn btn-danger"
      >
        {loading ? 'Bezig...' : 'Community permanent verwijderen'}
      </button>
    </div>
  )
}
