import { problemCodes } from 'lineup-contract'
import { describe, expect, it } from 'vitest'

import provider from '@/locales/en/provider.json'

import { answer, ProviderRequestError, worthRetrying } from './api'

const problem = (status: number, code: string) => ({
  type: 'about:blank',
  title: code,
  status,
  code,
  requestId: 'id'
})

const respond = (body: unknown, status: number) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status })

describe('answer', () => {
  it('reads the body of a success', async () => {
    await expect(answer(Promise.resolve(respond({ ok: true }, 200)))).resolves.toEqual({ ok: true })
  })

  it('takes no body from a 204', async () => {
    await expect(answer(Promise.resolve(respond(undefined, 204)))).resolves.toBeUndefined()
  })

  it('turns a refusal into its problem', async () => {
    const error = await answer(Promise.resolve(respond(problem(401, 'key_rejected'), 401))).catch(
      (caught: unknown) => caught
    )
    expect(error).toBeInstanceOf(ProviderRequestError)
    expect((error as ProviderRequestError).problem?.code).toBe('key_rejected')
  })

  it('keeps going past a failure that is not a problem at all', async () => {
    const error = await answer(Promise.resolve(new Response('<html>', { status: 500 }))).catch(
      (caught: unknown) => caught
    )
    expect((error as ProviderRequestError).problem).toBeUndefined()
  })

  it('treats a request that never arrived as offline', async () => {
    const error = await answer(Promise.reject(new TypeError('failed'))).catch(
      (caught: unknown) => caught
    )
    expect((error as ProviderRequestError).message).toBe('offline')
  })
})

describe('worthRetrying', () => {
  const failure = (status: number) =>
    new ProviderRequestError({ ...problem(status, 'internal'), code: 'internal' })

  it('retries what might go through, a few times', () => {
    expect(worthRetrying(0, new ProviderRequestError())).toBe(true)
    expect(worthRetrying(1, failure(502))).toBe(true)
    expect(worthRetrying(2, failure(502))).toBe(false)
  })

  it('does not repeat what was refused', () => {
    expect(worthRetrying(0, failure(401))).toBe(false)
    expect(worthRetrying(0, failure(422))).toBe(false)
  })
})

describe('the strings', () => {
  it('say something for every problem the API can answer with', () => {
    for (const code of problemCodes) expect(provider.problems).toHaveProperty(code)
  })
})
