import { getSupabase } from '@/lib/supabase'
import { verifyUnsubscribeToken } from '@/lib/email'

const PAGE = (msg: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unsubscribed — Skhokho Labs</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 4rem auto; padding: 0 1rem; color: #1f2937; line-height: 1.5; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  p { color: #4b5563; }
  a { color: #16a34a; }
</style>
</head>
<body>
  <h1>${msg}</h1>
  <p>You won't receive any more emails from us. If you change your mind, just reply to any past message and we'll re-enable.</p>
  <p><a href="https://skhokholabs.xyz">skhokholabs.xyz</a></p>
</body>
</html>`

const ERROR_PAGE = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Invalid link</title></head>
<body style="font-family:system-ui;max-width:480px;margin:4rem auto;padding:0 1rem">
<h1>Invalid unsubscribe link</h1>
<p>This link looks corrupted. Email <a href="mailto:chuma@skhokholabs.xyz">chuma@skhokholabs.xyz</a> and we'll remove you manually.</p>
</body></html>`

export async function GET(request: Request) {
  const url = new URL(request.url)
  const lead = url.searchParams.get('lead')
  const token = url.searchParams.get('t')

  if (!lead || !token) {
    return new Response(ERROR_PAGE, { status: 400, headers: { 'content-type': 'text/html' } })
  }
  if (!verifyUnsubscribeToken(lead, token)) {
    return new Response(ERROR_PAGE, { status: 400, headers: { 'content-type': 'text/html' } })
  }

  const supabase = getSupabase()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('activation_leads').update({ email_status: 'unsubscribed' }).eq('id', lead)

  return new Response(PAGE("You're unsubscribed."), { status: 200, headers: { 'content-type': 'text/html' } })
}
