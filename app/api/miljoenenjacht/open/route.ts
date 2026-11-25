import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const ERRORS: Record<string, { status: number; message: string }> = {
  geen_team: { status: 404, message: 'Dit team hoort niet bij dit event.' },
  niet_actief: { status: 409, message: 'Dit event is niet actief, er kunnen nu geen koffers geopend worden.' },
  geen_pulls: { status: 409, message: 'Dit team heeft geen pulls meer. Voltooi eerst een opdracht.' },
  koffer_bestaat_niet: { status: 404, message: 'Deze koffer bestaat niet.' },
  koffer_al_open: { status: 409, message: 'Deze koffer is al geopend door een ander team.' },
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const eventId = body?.eventId
  const teamId = body?.teamId
  const caseNumber = Number(body?.caseNumber)

  if (typeof eventId !== 'string' || typeof teamId !== 'string' || !Number.isInteger(caseNumber) || caseNumber < 1) {
    return NextResponse.json({ error: 'Ongeldige invoer.' }, { status: 400 })
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, type, community_id')
    .eq('id', eventId)
    .single()

  if (!event || event.type !== 'miljoenenjacht') {
    return NextResponse.json({ error: 'Event niet gevonden.' }, { status: 404 })
  }

  // Mag deze gebruiker namens dit team een koffer openen? Alleen als teamlid, of als organizer/owner.
  const [{ data: membership }, { data: profile }] = await Promise.all([
    supabase
      .from('community_members')
      .select('role')
      .eq('community_id', event.community_id)
      .eq('profile_id', user.id)
      .single(),
    supabase.from('profiles').select('discord_id').eq('id', user.id).single(),
  ])

  if (!membership) {
    return NextResponse.json({ error: 'Je bent geen lid van deze community.' }, { status: 403 })
  }

  const isManager = membership.role === 'owner' || membership.role === 'organizer'
  const admin = createAdminClient()

  if (!isManager) {
    if (!profile?.discord_id) {
      return NextResponse.json({ error: 'Je bent geen lid van dit team.' }, { status: 403 })
    }
    const { data: participant } = await admin
      .from('participants')
      .select('id')
      .eq('team_id', teamId)
      .eq('event_id', eventId)
      .eq('discord_id', profile.discord_id)
      .maybeSingle()

    if (!participant) {
      return NextResponse.json({ error: 'Je bent geen lid van dit team.' }, { status: 403 })
    }
  }

  const { data, error } = await admin.rpc('mj_open_case', {
    p_event: eventId,
    p_team: teamId,
    p_case: caseNumber,
    p_profile: user.id,
  })

  if (error) {
    const code = Object.keys(ERRORS).find((c) => error.message.includes(c))
    if (code) {
      return NextResponse.json({ error: ERRORS[code].message }, { status: ERRORS[code].status })
    }
    console.error('mj_open_case mislukt:', error)
    return NextResponse.json({ error: 'Koffer openen mislukt.' }, { status: 500 })
  }

  return NextResponse.json({ result: data })
}
