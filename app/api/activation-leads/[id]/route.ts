import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: { status: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!['booked', 'dead'].includes(body.status)) {
    return NextResponse.json({ error: 'status must be booked or dead' }, { status: 400 })
  }

  const supabase = getSupabase()
  const { error } = await (supabase as any)
    .from('activation_leads')
    .update({ status: body.status })
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ updated: true })
}
