import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: { participantId: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('id', params.participantId)

  if (error) {
    return NextResponse.json({ error: 'Verwijderen mislukt.' }, { status: 403 })
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(
  request: Request,
  { params }: { params: { participantId: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const { teamId } = await request.json()

  const { data: participant, error } = await supabase
    .from('participants')
    .update({ team_id: teamId ?? null })
    .eq('id', params.participantId)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Toewijzen mislukt. Ben je organizer/owner van deze community?' },
      { status: 403 }
    )
  }

  return NextResponse.json({ participant })
}
