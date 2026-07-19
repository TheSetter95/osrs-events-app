'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function GanzebordConfigForm({
  eventId,
  currentBoardSize,
}: {
  eventId: string
  currentBoardSize: number
}) {
  const [boardSize, setBoardSize] = useState(currentBoardSize)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)

    await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { boardSize } }),
    })

    setLoading(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="panel-dark" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
      <label className="field-label" style={{ margin: 0 }}>Aantal vakjes op het bord:</label>
      <input
        type="number"
        min={10}
        max={200}
        value={boardSize}
        onChange={(e) => setBoardSize(Number(e.target.value))}
        className="input"
        style={{ width: 80 }}
      />
      <button type="submit" disabled={loading} className="btn btn-sm">
        Opslaan
      </button>
    </form>
  )
}
