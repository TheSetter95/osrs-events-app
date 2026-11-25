import { createHash } from 'crypto'
import { createAdminClient } from './supabase/admin'

// "last_used_at" is puur informatief; we schrijven het hooguit eens per 10 minuten
// weg, in plaats van bij elk verzoek (bespaart een database-write per drop).
const LAST_USED_UPDATE_INTERVAL_MS = 10 * 60 * 1000

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
    .select('id, profile_id, last_used_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (!tokenRow) return null

  const lastUsed = tokenRow.last_used_at ? new Date(tokenRow.last_used_at).getTime() : 0
  const stale = Date.now() - lastUsed > LAST_USED_UPDATE_INTERVAL_MS

  const profilePromise = supabaseAdmin
    .from('profiles')
    .select('id, discord_id, username, osrs_username')
    .eq('id', tokenRow.profile_id)
    .single()

  if (stale) {
    // Parallel met het profiel ophalen, we wachten er niet apart op.
    const [{ data: profile }] = await Promise.all([
      profilePromise,
      supabaseAdmin
        .from('plugin_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', tokenRow.id),
    ])
    return profile
  }

  const { data: profile } = await profilePromise
  return profile
}
