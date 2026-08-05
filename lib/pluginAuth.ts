import { createHash } from 'crypto'
import { createAdminClient } from './supabase/admin'

// Zoekt op basis van het "Authorization: Bearer <token>"-headertje welk profiel
// erbij hoort. Retourneert null als de sleutel ongeldig/onbekend is.
export async function getProfileFromPluginToken(request: Request) {
  const authHeader = request.headers.get('authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) return null

  const tokenHash = createHash('sha256').update(token).digest('hex')
  const supabaseAdmin = createAdminClient()

  const { data: tokenRow } = await supabaseAdmin
    .from('plugin_tokens')
    .select('id, profile_id')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!tokenRow) return null

  // Bijhouden wanneer de sleutel voor het laatst gebruikt is (puur informatief)
  await supabaseAdmin
    .from('plugin_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', tokenRow.id)

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, discord_id, username, osrs_username')
    .eq('id', tokenRow.profile_id)
    .single()

  return profile
}
