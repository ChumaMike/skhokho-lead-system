import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { fromDbRowWithMessages } from '@/types/activation'

export async function GET() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = getSupabase() as any
  const { data: leads, error } = await supabase
    .from('activation_leads')
    .select('*, activation_messages(*)')
    .order('replied_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (leads ?? []).map((row: any) => fromDbRowWithMessages(row as Record<string, unknown>))

  return NextResponse.json(result)
}
