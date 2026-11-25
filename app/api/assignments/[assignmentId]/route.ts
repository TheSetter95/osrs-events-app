import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { validateAssignment } from '@/lib/assignmentValidation'

// Wijzigen en verwijderen mag alleen de maker van de opdracht (of een sitebeheerder).
// Dat wordt in de database afgedwongen; de route geeft alleen een nette melding terug.

export async function PATCH(
  request: Request,
  { params }: { params: { assignmentId: string } }
) {
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
    .update(result.value)
    .eq('id', params.assignmentId)
    .select()
    .single()

  if (error || !assignment) {
    return NextResponse.json(
      { error: 'Wijzigen mislukt. Alleen de maker van een opdracht mag die aanpassen.' },
      { status: 403 }
    )
  }

  return NextResponse.json({ assignment })
}

export async function DELETE(
  request: Request,
  { params }: { params: { assignmentId: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Je moet ingelogd zijn.' }, { status: 401 })
  }

  const { data: deleted, error } = await supabase
    .from('assignment_templates')
    .delete()
    .eq('id', params.assignmentId)
    .select('id')

  if (error || !deleted || deleted.length === 0) {
    return NextResponse.json(
      { error: 'Verwijderen mislukt. Alleen de maker van een opdracht mag die verwijderen.' },
      { status: 403 }
    )
  }

  return NextResponse.json({ success: true })
}
