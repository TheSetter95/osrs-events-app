'use client'

import { useState } from 'react'

export default function PluginTokenGenerator() {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setError(null)
    setLoading(true)

    const res = await fetch('/api/plugin-tokens', { method: 'POST' })
    const result = await res.json()

    setLoading(false)

    if (!res.ok) {
      setError(result.error ?? 'Er ging iets mis.')
      return
    }

    setToken(result.token)
  }

  async function handleCopy() {
    if (!token) return
    await navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleRevoke() {
    if (
      !confirm(
        'Alle bestaande plugin-sleutels intrekken? De RuneLite-plugin werkt dan niet meer tot je een nieuwe sleutel invult.'
      )
    ) {
      return
    }
    await fetch('/api/plugin-tokens', { method: 'DELETE' })
    setToken(null)
  }

  return (
    <div className="panel-dark" style={{ maxWidth: 500, marginTop: 16 }}>
      <h3 style={{ fontSize: 16, marginTop: 0 }}>🔌 RuneLite-plugin koppelen</h3>
      <p className="text-muted" style={{ fontSize: 13 }}>
        Genereer een persoonlijke sleutel om de RuneLite-plugin (binnenkort beschikbaar)
        aan jouw account te koppelen. Bewaar 'm goed — hij wordt maar één keer getoond.
      </p>

      {!token ? (
        <button onClick={handleGenerate} disabled={loading} className="btn">
          {loading ? 'Bezig...' : 'Genereer plugin-sleutel'}
        </button>
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              background: 'var(--parchment-light)',
              color: 'var(--text-on-parchment)',
              padding: 10,
              borderRadius: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              wordBreak: 'break-all',
            }}
          >
            {token}
          </div>
          <button onClick={handleCopy} className="btn btn-sm" style={{ marginTop: 8 }}>
            {copied ? '✅ Gekopieerd!' : '📋 Kopiëren'}
          </button>
        </>
      )}

      {error && <p className="error-text">{error}</p>}

      <div style={{ marginTop: 12 }}>
        <button onClick={handleRevoke} className="btn-link" style={{ fontSize: 12 }}>
          Alle plugin-sleutels intrekken
        </button>
      </div>
    </div>
  )
}
