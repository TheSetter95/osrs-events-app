'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginButton({ redirectPath }: { redirectPath?: string }) {
  const supabase = createClient()

  async function handleLogin() {
    const next = redirectPath ? `?next=${encodeURIComponent(redirectPath)}` : ''
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback${next}`,
      },
    })
  }

  return (
    <button onClick={handleLogin} className="btn" style={{ marginTop: 8 }}>
      Inloggen met Discord
    </button>
  )
}