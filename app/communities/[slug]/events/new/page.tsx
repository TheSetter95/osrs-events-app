'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

const EVENT_TYPES = [
  { value: 'bingo', label: 'Bingo' },
  { value: 'ganzebord', label: 'Ganzebord' },
  { value: 'pvp_toernooi', label: 'PvP-toernooi' },
]

export default function NewEventPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const [name, setName] = useState('')
  const [type, setType] = useState('bingo')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ communitySlug: slug, name, type }),
    })

    const result = await res.json()

    if (!res.ok) {
      setError(result.error ?? 'Er ging iets mis.')
      setLoading(false)
      return
    }

    router.push(`/communities/${slug}`)
    router.refresh()
  }

  return (
    <main className="container-narrow">
      <h1>Nieuw event</h1>
      <form onSubmit={handleSubmit} className="panel-dark">
        <label className="field-label">Naam</label>
        <input
          type="text"
          placeholder="bv. Bingo Zomer 2026"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          style={{ marginBottom: 16 }}
        />

        <label className="field-label">Type event</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="input"
          style={{ marginBottom: 16 }}
        >
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" disabled={loading} className="btn">
          {loading ? 'Bezig...' : 'Event aanmaken'}
        </button>
      </form>
    </main>
  )
}
