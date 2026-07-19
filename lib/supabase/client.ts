import { createBrowserClient } from '@supabase/ssr'

// Deze client gebruik je in components die in de browser draaien
// (bv. de "Inloggen met Discord"-knop).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
