import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: { tileId: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const { error } = await supabase.from('board_tiles').delete().eq('id', params.tileId)

  if (error) {
    return NextResponse.json({ error: 'Verwijderen mislukt.' }, { status: 403 })
  }

  return NextResponse.json({ success: true })
}
