'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GauntletConfigForm({
  eventId,
  currentMode,
}: {
  eventId: string
  currentMode: 'team' | 'individual'
}) {
  const [mode, setMode] = useState(currentMode)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleChange(newMode: 'team' | 'individual') {
    setMode(newMode)
    setLoading(true)
    await fetch(`/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: { mode: newMode } }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="panel-dark" style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
      <label className="field-label" style={{ margin: 0 }}>Modus:</label>
      <select
        value={mode}
        onChange={(e) => handleChange(e.target.value as 'team' | 'individual')}
        disabled={loading}
        className="input"
        style={{ width: 'auto' }}
      >
        <option value="team">Per team</option>
        <option value="individual">Individueel</option>
      </select>
      <span className="text-muted" style={{ fontSize: 12 }}>
        Kan je beter niet meer wijzigen zodra er al voortgang is
      </span>
    </div>
  )
}
