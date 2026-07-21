'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ProfileSettings({
  userId,
  currentOsrsUsername,
}: {
  userId: string
  currentOsrsUsername: string | null
}) {
  const [osrsUsername, setOsrsUsername] = useState(currentOsrsUsername ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    setLoading(true)

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ osrs_username: osrsUsername.trim() || null })
      .eq('id', userId)

    setLoading(false)

    if (updateError) {
      setError('Opslaan mislukt: ' + updateError.message)
      return
    }

    setSaved(true)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="panel-dark" style={{ maxWidth: 360 }}>
      <label className="field-label">Jouw OSRS-naam</label>
      <input
        type="text"
        placeholder="bv. Zezima"
        value={osrsUsername}
        onChange={(e) => setOsrsUsername(e.target.value)}
        className="input"
        style={{ marginBottom: 12 }}
      />
      <p className="text-muted" style={{ fontSize: 12, marginTop: -6, marginBottom: 12 }}>
        Deze naam wordt overal op de site gebruikt in plaats van je Discord-naam, en
        automatisch voorgesteld als je je via <code>/aanmelden</code> aanmeldt voor een
        event.
      </p>

      {error && <p className="error-text">{error}</p>}
      {saved && !error && <p style={{ color: 'var(--success-light)', fontSize: 13 }}>Opgeslagen!</p>}

      <button type="submit" disabled={loading} className="btn">
        {loading ? 'Bezig...' : 'Opslaan'}
      </button>
    </form>
  )
}
