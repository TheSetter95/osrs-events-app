'use client'

import { useState } from 'react'

export default function InviteLinkButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    const url = `${window.location.origin}/communities/${slug}/join`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button onClick={handleCopy} className="btn btn-secondary btn-sm">
      {copied ? '✅ Gekopieerd!' : '🔗 Uitnodigingslink kopiëren'}
    </button>
  )
}
