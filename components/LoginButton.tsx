'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginButton() {
  const supabase = createClient()

  async function handleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <button onClick={handleLogin} className="btn" style={{ marginTop: 8 }}>
      Inloggen met Discord
    </button>
  )
}
