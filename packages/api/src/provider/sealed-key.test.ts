import { describe, expect, it } from 'vitest'

import { seal, unseal } from './sealed-key'

const secret = (fill: number) => btoa(String.fromCharCode(...new Uint8Array(32).fill(fill)))
const env = { PROVIDER_KEY_SECRET_V1: secret(1) }
const later = new Date(Date.now() + 60_000).toISOString()
const sealed = {
  key: 'sk_the_real_key',
  last4: 'key1',
  expiresAt: later,
  profileId: 'profile',
  canPost: true
}

describe('the sealed key', () => {
  it('comes back as it went in, and shows nothing of it on the way', async () => {
    const value = await seal(sealed, env)
    expect(value).not.toContain('sk_the_real_key')
    expect(atob(value.split('.')[2].replaceAll('-', '+').replaceAll('_', '/'))).not.toContain(
      'sk_the_real_key'
    )
    expect(await unseal(value, env)).toEqual(sealed)
  })

  it('is refused once a single character has changed', async () => {
    const value = await seal(sealed, env)
    const last = value.at(-2) === 'A' ? 'B' : 'A'
    expect(await unseal(`${value.slice(0, -2)}${last}${value.at(-1)}`, env)).toBeUndefined()
  })

  it('is refused once it has expired, whatever the cookie says', async () => {
    const expired = { ...sealed, expiresAt: new Date(Date.now() - 1).toISOString() }
    expect(await unseal(await seal(expired, env), env)).toBeUndefined()
  })

  it('is refused under another secret, and when it is not a sealed value at all', async () => {
    const value = await seal(sealed, env)
    expect(await unseal(value, { PROVIDER_KEY_SECRET_V1: secret(2) })).toBeUndefined()
    expect(await unseal('nonsense', env)).toBeUndefined()
  })

  it('seals with the newest secret and still opens what an older one sealed', async () => {
    const old = await seal(sealed, env)
    const rotated = { ...env, PROVIDER_KEY_SECRET_V2: secret(2) }
    const fresh = await seal(sealed, rotated)
    expect(fresh.startsWith('2.')).toBe(true)
    expect(await unseal(old, rotated)).toEqual(sealed)
    expect(await unseal(fresh, rotated)).toEqual(sealed)
  })

  it('refuses to seal with no secret set', async () => {
    await expect(seal(sealed, {})).rejects.toThrow()
  })
})
