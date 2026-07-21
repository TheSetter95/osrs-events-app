'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function BingoConfigForm({
  eventId,
  currentGridSize,
}: {
  eventId: string
  currentGridSize: number
}) {
  const [gridSize, setGridSize] = useState(currentGridSize)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)

    await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { gridSize } }),
    })

    setLoading(false)
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="panel-dark"
      style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}
    >
      <label className="field-label" style={{ margin: 0 }}>
        Bordformaat:
      </label>
      <input
        type="number"
        min={3}
        max={10}
        value={gridSize}
        onChange={(e) => setGridSize(Number(e.target.value))}
        className="input"
        style={{ width: 70 }}
      />
      <span className="text-muted" style={{ fontSize: 13 }}>
        × {gridSize} = {gridSize * gridSize} vakjes
      </span>
      <button type="submit" disabled={loading} className="btn btn-sm">
        Opslaan
      </button>
    </form>
  )
}
