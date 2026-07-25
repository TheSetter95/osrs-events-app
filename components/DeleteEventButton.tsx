'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteEventButton({
  eventId,
  communitySlug,
}: {
  eventId: string
  communitySlug: string
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('Dit event permanent verwijderen? Teams, deelnemers en geschiedenis gaan mee verloren.')) {
      return
    }
    setLoading(true)
    const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' })

    if (!res.ok) {
      alert('Verwijderen mislukt.')
      setLoading(false)
      return
    }

    router.push(`/communities/${communitySlug}`)
    router.refresh()
  }

  return (
    <button onClick={handleDelete} disabled={loading} className="btn btn-danger btn-sm">
      {loading ? 'Bezig...' : '🗑️ Event verwijderen'}
    </button>
  )
}
