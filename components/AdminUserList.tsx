'use client'

import { useState } from 'react'

type Profile = {
  id: string
  username: string | null
  osrs_username: string | null
  discord_id: string | null
  can_create_communities: boolean
  is_super_admin: boolean
}

export default function AdminUserList({
  profiles,
  currentUserId,
}: {
  profiles: Profile[]
  currentUserId: string
}) {
  const [items, setItems] = useState(profiles)
  const [savingId, setSavingId] = useState<string | null>(null)

  async function handleToggle(profileId: string, current: boolean) {
    setSavingId(profileId)

    const res = await fetch('/api/admin/toggle-permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, canCreateCommunities: !current }),
    })

    setSavingId(null)

    if (res.ok) {
      setItems((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, can_create_communities: !current } : p))
      )
    } else {
      alert('Bijwerken mislukt.')
    }
  }

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((profile) => (
        <div key={profile.id} className="card-row">
          <span style={{ flex: 1 }}>
            {profile.osrs_username || profile.username || 'Onbekend'}
            {profile.id === currentUserId && ' (jij)'}
            {profile.is_super_admin && (
              <span className="badge badge-gold" style={{ marginLeft: 8 }}>
                sitebeheerder
              </span>
            )}
          </span>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={profile.can_create_communities}
              disabled={savingId === profile.id}
              onChange={() => handleToggle(profile.id, profile.can_create_communities)}
            />
            Mag community's aanmaken
          </label>
        </div>
      ))}
    </div>
  )
}
