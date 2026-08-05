import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'

export async function POST() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  // Genereer een lange, willekeurige sleutel. We slaan alleen de hash op —
  // de echte sleutel wordt maar één keer getoond, net als een wachtwoord.
  const token = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(token).digest('hex')

  const { error } = await supabase.from('plugin_tokens').insert({
    profile_id: user.id,
    token_hash: tokenHash,
  })

  if (error) {
    return NextResponse.json({ error: 'Aanmaken mislukt: ' + error.message }, { status: 500 })
  }

  return NextResponse.json({ token })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  // Verwijdert alle plugin-sleutels van deze gebruiker (simpel "alles intrekken")
  const { error } = await supabase.from('plugin_tokens').delete().eq('profile_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Intrekken mislukt.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
