'use client'

import { useState, ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CommunityLogoUpload({
  communityId,
  currentLogoUrl,
}: {
  communityId: string
  currentLogoUrl: string | null
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Alleen PNG, JPG of WEBP toegestaan.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Bestand is te groot (max 2MB).')
      return
    }

    setUploading(true)

    const ext = file.name.split('.').pop()
    const path = `${communityId}/logo.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('community-logos')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      setError('Uploaden mislukt: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from('community-logos')
      .getPublicUrl(path)

    // Cache-busting: zodat de browser meteen de nieuwe versie laadt i.p.v. een oude gecachete
    const cacheBustedUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`

    const { error: updateError } = await supabase
      .from('communities')
      .update({ logo_url: cacheBustedUrl })
      .eq('id', communityId)

    setUploading(false)

    if (updateError) {
      setError('Opslaan mislukt: ' + updateError.message)
      return
    }

    router.refresh()
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '12px 0' }}>
      {currentLogoUrl && (
        <img
          src={currentLogoUrl}
          alt="Community logo"
          width={56}
          height={56}
          className="avatar"
          style={{ border: '2px solid var(--gold)', objectFit: 'cover' }}
        />
      )}
      <div>
        <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-block' }}>
          {uploading ? 'Bezig...' : currentLogoUrl ? 'Logo wijzigen' : 'Logo uploaden'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
        {error && (
          <p className="error-text" style={{ marginTop: 4 }}>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
