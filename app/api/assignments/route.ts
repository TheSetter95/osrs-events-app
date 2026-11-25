import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { validateAssignment } from '@/lib/assignmentValidation'

// Nieuwe opdracht toevoegen aan de bibliotheek. De databaseregels (RLS) laten dit
// alleen toe voor owners van een community en voor sitebeheerders.
export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const result = validateAssignment(body)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const { data: assignment, error } = await supabase
    .from('assignment_templates')
    .insert({ ...result.value, created_by: user.id })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Opslaan mislukt. Alleen owners van een community mogen opdrachten toevoegen.' },
      { status: 403 }
    )
  }

  return NextResponse.json({ assignment })
}
