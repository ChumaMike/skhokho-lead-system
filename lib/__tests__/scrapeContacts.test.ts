import { extractEmailFromHtml } from '../scrapeContacts'

describe('extractEmailFromHtml', () => {
  it('extracts a personal-looking email', () => {
    const html = '<p>Contact us: <a href="mailto:thabo@mamatsalon.co.za">thabo@mamatsalon.co.za</a></p>'
    expect(extractEmailFromHtml(html)).toBe('thabo@mamatsalon.co.za')
  })

  it('returns null when no email is present', () => {
    const html = '<p>Call us on 083 456 7890</p>'
    expect(extractEmailFromHtml(html)).toBeNull()
  })

  it('prefers personal address over generic info@', () => {
    const html = '<p>info@acme.com or directly thabo@acme.com</p>'
    expect(extractEmailFromHtml(html)).toBe('thabo@acme.com')
  })

  it('falls back to generic info@ if nothing else', () => {
    const html = '<p>Reach us at info@acme.com</p>'
    expect(extractEmailFromHtml(html)).toBe('info@acme.com')
  })

  it('ignores noise domains (sentry, example, png)', () => {
    const html = '<script>Sentry.init({dsn: "abc@sentry.io"})</script><img src="logo@2x.png">'
    expect(extractEmailFromHtml(html)).toBeNull()
  })

  it('lowercases the result', () => {
    const html = 'mailto:Thabo@Acme.COM'
    expect(extractEmailFromHtml(html)).toBe('thabo@acme.com')
  })

  it('strips emails inside <script> blocks', () => {
    const html = '<script>const x = "hidden@inside.com"</script><p>real@outside.com</p>'
    expect(extractEmailFromHtml(html)).toBe('real@outside.com')
  })
})
