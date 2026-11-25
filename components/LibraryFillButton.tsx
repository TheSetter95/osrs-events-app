'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Vult alle lege vakjes van een concept-event willekeurig met bibliotheek-opdrachten.
export default function LibraryFillButton({ eventId }: { eventId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [difficulty, setDifficulty] = useState('')
  const [membership, setMembership] = useState('')
  const [tag, setTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFill() {
    if (!confirm('Alle lege vakjes willekeurig vullen met opdrachten uit de bibliotheek? Bestaande vakjes blijven staan.')) {
      return
    }
    setLoading(true)
    setError(null)
    setMessage(null)
    const res = await fetch('/api/assignments/fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, difficulty, membership, tag }),
    })
    const result = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(result.error ?? 'Vullen mislukt.')
      return
    }
    setMessage(result.message ?? 'Klaar.')
    router.refresh()
  }

  return (
    <div className="panel-dark" style={{ marginTop: 12 }}>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(!open)}>
        🎲 Willekeurig vullen uit bibliotheek
      </button>
      {open && (
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="">Elke moeilijkheid</option>
            <option value="makkelijk">Makkelijk</option>
            <option value="gemiddeld">Gemiddeld</option>
            <option value="moeilijk">Moeilijk</option>
          </select>
          <select className="input" value={membership} onChange={(e) => setMembership(e.target.value)}>
            <option value="">F2P en P2P</option>
            <option value="f2p">Alleen F2P-geschikt</option>
          </select>
          <input
            className="input"
            placeholder="Label (optioneel)"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            style={{ width: 160 }}
          />
          <button type="button" className="btn btn-sm" disabled={loading} onClick={handleFill}>
            {loading ? 'Bezig…' : 'Vul lege vakjes'}
          </button>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
      {message && <p style={{ fontSize: 13, color: 'var(--gold-light)' }}>{message}</p>}
      <p className="text-muted" style={{ fontSize: 12, margin: '8px 0 0' }}>
        Alleen voor owners en alleen zolang het event een Concept is. Bestaande vakjes worden niet overschreven.
      </p>
    </div>
  )
}
