import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_STATUSES = ['draft', 'active', 'finished']

export async function PATCH(
  request: Request,
  { params }: { params: { eventId: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  if (body.status !== undefined) {
    if (!ALLOWED_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: 'Ongeldige status.' }, { status: 400 })
    }
    updates.status = body.status
  }

  if (body.config !== undefined) {
    updates.config = body.config
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Niets om op te slaan.' }, { status: 400 })
  }

  // Huidige status opzoeken vóór de wijziging, nodig om te bepalen of dit een
  // "afgerond -> concept"-overgang is (dan resetten we de geschiedenis).
  const { data: existingEvent } = await supabase
    .from('events')
    .select('status')
    .eq('id', params.eventId)
    .single()

  const { data: event, error } = await supabase
    .from('events')
    .update(updates)
    .eq('id', params.eventId)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Wijzigen mislukt. Ben je organizer/owner van deze community?' },
      { status: 403 }
    )
  }

  // Zodra een event (opnieuw) actief wordt, tonen we de vakjes weer verborgen —
  // handig om na een playtest (via concept) fris opnieuw te beginnen.
  if (updates.status === 'active') {
    await supabase.from('board_tile_reveals').delete().eq('event_id', params.eventId)
  }

  // Gaat een afgerond event terug naar concept, dan wissen we ook de volledige
  // geschiedenis — een nieuwe poging begint dan echt vanaf nul.
  if (updates.status === 'draft' && existingEvent?.status === 'finished') {
    await supabase.from('progress_updates').delete().eq('event_id', params.eventId)
  }

  return NextResponse.json({ event })
}

export async function DELETE(
  request: Request,
  { params }: { params: { eventId: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  // Server-side afdwingen (niet alleen de knop verbergen): alleen een OWNER van
  // de community mag een event verwijderen, en alleen als het nog een concept is.
  const { data: existing } = await supabase
    .from('events')
    .select('id, status, community_id')
    .eq('id', params.eventId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Event niet gevonden.' }, { status: 404 })
  }

  const { data: membership } = await supabase
    .from('community_members')
    .select('role')
    .eq('community_id', existing.community_id)
    .eq('profile_id', user.id)
    .single()

  if (membership?.role !== 'owner') {
    return NextResponse.json(
      { error: 'Alleen de owner van de community mag een event verwijderen.' },
      { status: 403 }
    )
  }

  if (existing.status !== 'draft') {
    return NextResponse.json(
      { error: 'Alleen een event met status Concept kan verwijderd worden. Zet het event eerst terug naar Concept.' },
      { status: 409 }
    )
  }

  const { error } = await supabase.from('events').delete().eq('id', params.eventId)

  if (error) {
    return NextResponse.json(
      { error: 'Verwijderen mislukt. Alleen owners mogen concept-events verwijderen.' },
      { status: 403 }
    )
  }

  return NextResponse.json({ success: true })
}

