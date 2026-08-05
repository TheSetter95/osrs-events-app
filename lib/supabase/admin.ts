import { createClient } from '@supabase/supabase-js'

// Let op: deze client omzeilt alle RLS-regels, net als bij de Discord-bot.
// Gebruik 'm ALLEEN in server-only routes (nooit in client components), en
// nooit de SUPABASE_SERVICE_ROLE_KEY blootstellen aan de browser.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
