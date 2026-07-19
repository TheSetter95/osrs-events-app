'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Concept',
  active: 'Actief',
  finished: 'Afgerond',
}

export default function EventStatusControl({
  eventId,
  currentStatus,
}: {
  eventId: string
  currentStatus: string
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function changeStatus(status: string) {
    setLoading(true)
    await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
      <span className="badge badge-gold">{STATUS_LABELS[currentStatus] ?? currentStatus}</span>

      {currentStatus !== 'active' && (
        <button disabled={loading} onClick={() => changeStatus('active')} className="btn btn-success btn-sm">
          Zet actief
        </button>
      )}

      {currentStatus === 'active' && (
        <button disabled={loading} onClick={() => changeStatus('finished')} className="btn btn-locked btn-sm">
          Afronden
        </button>
      )}

      {currentStatus === 'finished' && (
        <button disabled={loading} onClick={() => changeStatus('draft')} className="btn btn-secondary btn-sm">
          Terug naar concept
        </button>
      )}
    </div>
  )
}
