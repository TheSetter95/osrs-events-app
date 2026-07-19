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

  return NextResponse.json({ event })
}

