'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function NewCommunityPage() {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/communities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })

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
    <main className="container-narrow">
      <h1>Nieuwe community</h1>
      <form onSubmit={handleSubmit} className="panel-dark">
        <label className="field-label">Naam</label>
        <input
          type="text"
          placeholder="Naam van je community"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input"
          style={{ marginBottom: 12 }}
        />
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={loading} className="btn">
          {loading ? 'Bezig...' : 'Community aanmaken'}
        </button>
      </form>
    </main>
  )
}
