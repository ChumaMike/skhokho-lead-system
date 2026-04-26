import { verifySvixSignature } from '../../../lib/svixVerify'
import { createHmac } from 'node:crypto'

describe('verifySvixSignature', () => {
  const secret = 'whsec_' + Buffer.from('my-test-secret').toString('base64')
  const id = 'msg_abc'
  const timestamp = '1700000000'
  const body = '{"event":"test"}'

  function makeSig(secretParam: string): string {
    const decoded = Buffer.from(secretParam.replace(/^whsec_/, ''), 'base64')
    const sig = createHmac('sha256', decoded).update(`${id}.${timestamp}.${body}`).digest('base64')
    return `v1,${sig}`
  }

  it('accepts a valid signature', () => {
    expect(verifySvixSignature({ id, timestamp, signature: makeSig(secret), body, secret })).toBe(true)
  })

  it('rejects a tampered body', () => {
    expect(verifySvixSignature({ id, timestamp, signature: makeSig(secret), body: '{"event":"changed"}', secret })).toBe(false)
  })

  it('rejects a wrong secret', () => {
    const other = 'whsec_' + Buffer.from('different').toString('base64')
    expect(verifySvixSignature({ id, timestamp, signature: makeSig(other), body, secret })).toBe(false)
  })

  it('rejects a malformed signature header', () => {
    expect(verifySvixSignature({ id, timestamp, signature: 'garbage', body, secret })).toBe(false)
  })

  it('accepts when one of multiple space-separated signatures is valid', () => {
    const valid = makeSig(secret)
    expect(verifySvixSignature({ id, timestamp, signature: `v1,fakefake ${valid}`, body, secret })).toBe(true)
  })
})
