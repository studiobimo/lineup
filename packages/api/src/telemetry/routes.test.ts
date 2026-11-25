/// <reference types="node" />
import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

import { problemSchema } from 'lineup-contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createApi } from '../app'
import { accountTag } from './routes'

const run = promisify(execFile)
const SCRIPT = resolve(process.cwd(), '../../.devtools/scripts/telemetry-tag.mjs')
const TAG = 'lineup.account.tag'
const PATH = '/api/v1/telemetry/publish-delay'

const event = {
  eventId: '2f1c4b6e-8f0e-4b1c-9d57-0c5d6a1b2c3d',
  scheduledFor: '2030-01-01T10:00:00Z',
  publishedAt: '2030-01-01T10:03:20Z',
  delaySeconds: 200,
  kind: 'carousel',
  images: 2,
  videos: 1,
  totalBytes: 9_000_000,
  largestVideoBytes: 7_000_000,
  largestVideoSeconds: 12.5,
  appVersion: 'v0.5.0',
  account: 'studio.bimo'
}

// ~keep The logged names are dotted and lowercase, OpenTelemetry style, and the body stays camelCase.
const names = [
  'event.name',
  'lineup.post.id',
  'lineup.post.scheduled_for',
  'lineup.post.published_at',
  'lineup.post.delay_seconds',
  'lineup.post.media_kind',
  'lineup.post.image_count',
  'lineup.post.video_count',
  'lineup.post.total_bytes',
  'lineup.post.largest_video_bytes',
  'lineup.post.largest_video_seconds',
  'lineup.account.tag',
  'service.version'
]

let limit: ReturnType<typeof vi.fn>
let log: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  salt = 'a-long-random-salt'
  limit = vi.fn(async () => ({ success: true }))
  log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => vi.restoreAllMocks())

let salt: string | undefined

const post = (body: unknown = event, headers: Record<string, string> = {}) =>
  createApi().request(
    PATH,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost', ...headers }
    },
    { TELEMETRY_RATE_LIMIT: { limit }, TELEMETRY_SALT: salt }
  )

const lines = () =>
  log.mock.calls.map(([line]: unknown[]) => JSON.parse(String(line)) as Record<string, unknown>)
const logged = () =>
  lines().filter((line: Record<string, unknown>) => line['event.name'] === 'lineup.publish_delay')

describe('POST /telemetry/publish-delay', () => {
  it('answers 204 and writes one line with exactly the allowed attributes', async () => {
    const response = await post()
    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(logged()).toHaveLength(1)
    expect(Object.keys(logged()[0]).toSorted()).toEqual(names.toSorted())
    expect(logged()[0]).toMatchObject({
      'lineup.post.id': event.eventId,
      'lineup.post.delay_seconds': 200,
      'lineup.post.media_kind': 'carousel',
      'lineup.post.video_count': 1,
      'lineup.post.largest_video_seconds': 12.5,
      'service.version': 'v0.5.0',
      [TAG]: expect.stringMatching(/^[0-9a-f]{12}$/)
    })
  })

  it('logs a tag of the account and never the handle, in a line, an error or the answer', async () => {
    const response = await post()
    const everything = JSON.stringify(log.mock.calls) + (await response.text())
    expect(everything).not.toContain('studio.bimo')
    expect(logged()[0][TAG]).toBe(await accountTag('studio.bimo', 'a-long-random-salt'))
  })

  it('gives one handle one tag, another handle another, and another salt another', async () => {
    await post()
    await post()
    await post({ ...event, account: 'someone.else' })
    salt = 'another-salt'
    await post()
    const [first, again, other, resalted] = logged().map(
      (line: Record<string, unknown>) => line[TAG]
    )
    expect(again).toBe(first)
    expect(other).not.toBe(first)
    expect(resalted).not.toBe(first)
  })

  it('matches the script that looks a customer up', async () => {
    const { stdout } = await run(process.execPath, [SCRIPT, 'studio.bimo'], {
      env: { ...process.env, TELEMETRY_SALT: 'a-long-random-salt' }
    })
    expect(stdout.trim()).toBe(await accountTag('studio.bimo', 'a-long-random-salt'))
  })

  it('logs no account at all without a salt, and without an error', async () => {
    salt = undefined
    const response = await post()
    expect(response.status).toBe(204)
    expect(logged()[0]).not.toHaveProperty(TAG)
    expect(JSON.stringify(log.mock.calls)).not.toContain('studio.bimo')
  })
})

describe('POST /telemetry/publish-delay, continued', () => {
  it('logs no account for an event that has none', async () => {
    await post({ ...event, account: undefined })
    expect(logged()[0]).not.toHaveProperty(TAG)
  })
})

describe('POST /telemetry/publish-delay, requests it refuses or limits', () => {
  it('refuses a handle that is not trimmed and lowercased', async () => {
    expect((await post({ ...event, account: ' Studio.Bimo ' })).status).toBe(400)
  })

  it('needs no key and no cookie', async () => {
    const response = await post(event, { Cookie: '' })
    expect(response.status).toBe(204)
  })

  it('refuses a body with a field it does not list, and logs nothing of it', async () => {
    const response = await post({ ...event, caption: 'a secret caption', username: 'someone' })
    expect(response.status).toBe(400)
    expect(problemSchema.parse(await response.json()).code).toBe('validation')
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret caption|someone/)
    expect(logged()).toHaveLength(0)
  })

  it('refuses a body that is not valid', async () => {
    expect((await post({ ...event, kind: 'story' })).status).toBe(400)
    expect((await post({ ...event, eventId: 'post_1' })).status).toBe(400)
  })

  it('refuses a request from another site', async () => {
    const response = await post(event, { Origin: 'https://elsewhere.example' })
    expect(response.status).toBe(403)
    expect(logged()).toHaveLength(0)
  })

  it('limits by address, and says how long to wait', async () => {
    limit.mockResolvedValue({ success: false })
    const response = await post(event, { 'cf-connecting-ip': '203.0.113.9' })
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
    expect(limit).toHaveBeenCalledWith({ key: '203.0.113.9' })
    expect(logged()).toHaveLength(0)
  })

  it('keeps the address out of the line', async () => {
    await post(event, { 'cf-connecting-ip': '203.0.113.9' })
    expect(JSON.stringify(log.mock.calls)).not.toContain('203.0.113.9')
  })
})
