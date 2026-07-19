'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

type Member = {
  id: string
  role: 'owner' | 'organizer' | 'member'
  profiles: { id: string; username: string | null; avatar_url: string | null } | null
}

type SearchResult = {
  id: string
  username: string | null
  avatar_url: string | null
  discord_id: string | null
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  organizer: 'Organizer',
  member: 'Member',
}

export default function MembersManager({
  slug,
  initialMembers,
  currentUserId,
}: {
  slug: string
  initialMembers: Member[]
  currentUserId: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [newRole, setNewRole] = useState<'owner' | 'organizer' | 'member'>('member')
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    if (query.trim().length < 2) return
    setSearching(true)
    const res = await fetch(`/api/profiles/search?q=${encodeURIComponent(query)}`)
    const result = await res.json()
    setResults(result.profiles ?? [])
    setSearching(false)
  }

  async function handleAdd(profileId: string) {
    setError(null)
    const res = await fetch(`/api/communities/${slug}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, role: newRole }),
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error ?? 'Er ging iets mis.')
      return
    }

    setQuery('')
    setResults([])
    router.refresh()
  }

  async function handleRoleChange(memberId: string, role: string) {
    setError(null)
    const res = await fetch(`/api/communities/${slug}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error ?? 'Er ging iets mis.')
      return
    }

    router.refresh()
  }

  async function handleRemove(memberId: string) {
    if (!confirm('Dit lid verwijderen uit de community?')) return
    setError(null)
    const res = await fetch(`/api/communities/${slug}/members/${memberId}`, {
      method: 'DELETE',
    })
    const result = await res.json()

    if (!res.ok) {
      setError(result.error ?? 'Er ging iets mis.')
      return
    }

    router.refresh()
  }

  return (
    <div>
      {error && <p className="error-text">{error}</p>}

      <h2>Leden</h2>
      {initialMembers.map((m) => (
        <div key={m.id} className="card-row">
          {m.profiles?.avatar_url && (
            <img src={m.profiles.avatar_url} alt="" width={28} height={28} className="avatar" />
          )}
          <span style={{ flex: 1 }}>
            {m.profiles?.username ?? 'Onbekende gebruiker'}
            {m.profiles?.id === currentUserId && ' (jij)'}
          </span>

          <select
            value={m.role}
            onChange={(e) => handleRoleChange(m.id, e.target.value)}
            className="input"
            style={{ width: 'auto' }}
          >
            <option value="owner">Owner</option>
            <option value="organizer">Organizer</option>
            <option value="member">Member</option>
          </select>

          <button onClick={() => handleRemove(m.id)} className="btn-link">
            verwijder
          </button>
        </div>
      ))}

      <h3 style={{ marginTop: 24 }}>Lid toevoegen</h3>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Zoek op gebruikersnaam..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input"
        />
        <select
          value={newRole}
          onChange={(e) => setNewRole(e.target.value as any)}
          className="input"
          style={{ width: 'auto' }}
        >
          <option value="member">Member</option>
          <option value="organizer">Organizer</option>
          <option value="owner">Owner</option>
        </select>
        <button type="submit" disabled={searching} className="btn" style={{ whiteSpace: 'nowrap' }}>
          Zoek
        </button>
      </form>

      {results.length > 0 && (
        <div>
          {results.map((r) => (
            <div key={r.id} className="card-row">
              {r.avatar_url && <img src={r.avatar_url} alt="" width={24} height={24} className="avatar" />}
              <span style={{ flex: 1 }}>{r.username ?? 'Onbekend'}</span>
              <button onClick={() => handleAdd(r.id)} className="btn btn-success btn-sm">
                Toevoegen als {ROLE_LABELS[newRole]}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-muted" style={{ fontSize: 13, marginTop: 8 }}>
        Let op: iemand moet minstens één keer op de website hebben ingelogd met Discord
        voordat je ze kan toevoegen (anders bestaat er nog geen profiel om te vinden).
      </p>
    </div>
  )
}
