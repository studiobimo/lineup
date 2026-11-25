#!/usr/bin/env node
// A fake Zernio for local development, so the provider flow (key, accounts, schedule, reschedule,
// cancel, publish, published grid) runs with no Zernio account. It implements only what
// packages/api/src/provider/zernio.ts calls, keeps everything in memory, and forgets it on exit.
//
// Run it with `make -C .devtools zernio-mock`, then set ZERNIO_BASE_URL=http://localhost:8788 in
// apps/web/.dev.vars. The Worker honours that variable only for a localhost address (zernio.ts).
//
// Environment:
//   ZERNIO_MOCK_PORT           port to listen on (default 8788)
//   ZERNIO_MOCK_PUBLISH_MS     how long a due post stays `publishing` (default 20000)
//   ZERNIO_MOCK_BAD_KEY        the one key that answers 401 (default `bad-key-401`)
// A caption containing `#fail` ends as `failed` with an error message instead of `published`.
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'

const PORT = Number(process.env.ZERNIO_MOCK_PORT ?? 8788)
const PUBLISH_MS = Number(process.env.ZERNIO_MOCK_PUBLISH_MS ?? 20_000)
const BAD_KEY = process.env.ZERNIO_MOCK_BAD_KEY ?? 'bad-key-401'
const ORIGIN = `http://localhost:${PORT}`
const MAX_UPLOAD = 100 * 1024 * 1024

const profiles = [{ _id: 'mock-profile', name: 'Mock studio' }]
const swatch = (colour) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800"><rect width="640" height="800" fill="${colour}"/></svg>`
const avatar = (colour) => ({ type: 'image/svg+xml', bytes: Buffer.from(swatch(colour)) })
const uploads = new Map([
  ['avatar-one', avatar('#c2410c')],
  ['avatar-two', avatar('#0e7490')],
  ['elsewhere-1', avatar('#4d7c0f')],
  ['elsewhere-2', avatar('#a21caf')],
  ['elsewhere-3', avatar('#be123c')]
])
const accounts = [
  ['mock-account-1', 'mock.studio', 'Mock Studio', 'avatar-one', 4210],
  ['mock-account-2', 'mock.second', 'Second Mock', 'avatar-two', 380]
].map(([_id, username, displayName, picture, followersCount]) => ({
  _id,
  platform: 'instagram',
  username,
  displayName,
  profilePicture: `${ORIGIN}/uploads/${picture}`,
  followersCount,
  isActive: true,
  needsReconnection: false
}))

// Posts made elsewhere, so the published grid has history before anything is scheduled.
const posts = new Map()
const day = 86_400_000
for (const [index, picture] of ['elsewhere-1', 'elsewhere-2', 'elsewhere-3'].entries()) {
  const publishedAt = new Date(Date.now() - (index + 1) * 2 * day).toISOString()
  const id = `external-${index + 1}`
  posts.set(id, {
    _id: id,
    origin: 'external',
    content: `A post from before Lineup, number ${index + 1}`,
    status: 'published',
    scheduledFor: publishedAt,
    mediaProductType: 'FEED',
    mediaItems: [{ type: 'image', url: `${ORIGIN}/uploads/${picture}` }],
    platforms: [
      {
        platform: 'instagram',
        accountId: accounts[0]._id,
        platformPostId: `ig-${id}`,
        platformPostUrl: `https://www.instagram.com/p/${id}/`,
        publishedAt
      }
    ]
  })
}
const idempotent = new Map()

function view(post) {
  const due = Date.parse(post.scheduledFor)
  const now = Date.now()
  if (post.origin === 'external' || post.status === 'cancelled') return post
  let status = 'scheduled'
  if (now >= due + PUBLISH_MS) status = post.content?.includes('#fail') ? 'failed' : 'published'
  else if (now >= due) status = 'publishing'
  const platforms = post.platforms.map((target) => {
    if (status === 'published') {
      const publishedAt = new Date(due + PUBLISH_MS).toISOString()
      return {
        ...target,
        platformPostId: `ig-${post._id}`,
        platformPostUrl: `https://www.instagram.com/p/${post._id}/`,
        publishedAt
      }
    }
    if (status === 'failed')
      return { ...target, errorMessage: 'The mock was asked to fail (#fail)' }
    return target
  })
  return { ...post, status, platforms }
}

const json = (response, status, body, headers = {}) => {
  response.writeHead(status, { 'Content-Type': 'application/json', ...headers })
  response.end(body === undefined ? undefined : JSON.stringify(body))
}
const fail = (response, status, error) => json(response, status, { error })

const readBody = (request) =>
  new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_UPLOAD) return reject(new Error('too large'))
      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })

const readJson = async (request) => {
  const text = (await readBody(request)).toString()
  return text ? JSON.parse(text) : {}
}

function listPosts(query) {
  const limit = Number(query.get('limit') ?? 20)
  const accountId = query.get('accountId')
  const status = query.get('status')
  const source = query.get('source')
  const found = [...posts.values()]
    .map(view)
    .filter((post) => !accountId || post.platforms.some((target) => target.accountId === accountId))
    .filter((post) => !status || post.status === status)
    .filter((post) => (source === 'external') === (post.origin === 'external'))
  const key = query.get('sortBy') === 'created-desc' ? 'createdAt' : 'scheduledFor'
  found.sort((one, other) => String(other[key] ?? '').localeCompare(String(one[key] ?? '')))
  return found.slice(0, limit)
}

const listProfilesRoute = ({ response }) => json(response, 200, { profiles })
const createApiKey = ({ response }) =>
  json(response, 201, { apiKey: { key: `mock-narrow-${randomUUID().slice(0, 8)}` } })
const listAccounts = ({ response }) => json(response, 200, { accounts })
const connectInstagram = ({ response, url }) => {
  const back = url.searchParams.get('redirect_url') ?? ORIGIN
  return json(response, 200, { authUrl: back })
}

async function presignMedia({ request, response }) {
  const { filename = 'file', contentType = 'application/octet-stream' } = await readJson(request)
  const id = `${randomUUID()}-${String(filename).replace(/[^\w.-]/g, '_')}`
  uploads.set(id, { type: contentType, bytes: undefined })
  return json(response, 200, {
    uploadUrl: `${ORIGIN}/uploads/${id}`,
    publicUrl: `${ORIGIN}/uploads/${id}`
  })
}

const listPostsRoute = ({ response, url }) =>
  json(response, 200, { posts: listPosts(url.searchParams) })

async function createPost({ request, response }) {
  const key = request.headers['idempotency-key']
  if (key && idempotent.has(key))
    return json(response, 200, { post: view(posts.get(idempotent.get(key))) })
  const body = await readJson(request)
  console.log(`POST /posts body:\n${JSON.stringify(body, null, 2)}`)
  const id = `mock-post-${randomUUID().slice(0, 8)}`
  const now = Date.now()
  posts.set(id, {
    ...body,
    _id: id,
    origin: 'zernio',
    mediaProductType: 'FEED',
    scheduledFor: body.scheduledFor ?? new Date(now).toISOString(),
    createdAt: new Date(now).toISOString(),
    status: 'scheduled'
  })
  if (key) idempotent.set(key, id)
  return json(response, 201, { post: view(posts.get(id)) })
}

async function updatePost({ request, response, id }) {
  const stored = posts.get(id)
  if (!stored) return fail(response, 404, 'Post not found')
  if (view(stored).status !== 'scheduled')
    return fail(response, 409, 'The post is already going out')
  const body = await readJson(request)
  console.log(`PUT /posts/${id} body:\n${JSON.stringify(body, null, 2)}`)
  for (const field of ['scheduledFor', 'timezone', 'content']) {
    if (body[field] !== undefined) stored[field] = body[field]
  }
  return json(response, 200, { post: view(stored) })
}

function deletePost({ response, id }) {
  if (!posts.has(id)) return fail(response, 404, 'Post not found')
  posts.delete(id)
  return json(response, 200, { message: 'Deleted' })
}

const routes = new Map([
  ['GET /profiles', listProfilesRoute],
  ['POST /api-keys', createApiKey],
  ['GET /accounts', listAccounts],
  ['GET /connect/instagram', connectInstagram],
  ['POST /media/presign', presignMedia],
  ['GET /posts', listPostsRoute],
  ['POST /posts', createPost]
])
const postRoutes = new Map([
  ['PUT', updatePost],
  ['DELETE', deletePost]
])

function authorised(request) {
  const bearer = /^Bearer (.+)$/.exec(request.headers.authorization ?? '')?.[1]
  return Boolean(bearer) && bearer !== BAD_KEY
}

async function api(request, response, url) {
  if (!authorised(request)) return fail(response, 401, 'Invalid API key')
  const path = url.pathname.replace(/^\/api\/v1/, '')
  const post = /^\/posts\/([^/]+)$/.exec(path)
  const handler = post ? postRoutes.get(request.method) : routes.get(`${request.method} ${path}`)
  if (!handler) return fail(response, 404, `The mock has no ${request.method} ${path}`)
  return handler({ request, response, url, id: post?.[1] })
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  // Chromium's private network check, when a page on another origin reaches localhost.
  'Access-Control-Allow-Private-Network': 'true'
}

async function serveUpload(request, response, id) {
  const stored = uploads.get(decodeURIComponent(id))
  if (request.method === 'PUT') {
    if (!stored) return fail(response, 404, 'Ask for an upload address first')
    stored.bytes = await readBody(request)
    console.log(`PUT /uploads/${id} (${stored.bytes.length} bytes, ${stored.type})`)
    return void response.writeHead(200).end()
  }
  if (!stored?.bytes) return fail(response, 404, 'Nothing uploaded here')
  response.writeHead(200, {
    'Content-Type': stored.type,
    'Content-Length': stored.bytes.length
  })
  return void response.end(request.method === 'HEAD' ? undefined : stored.bytes)
}

createServer(async (request, response) => {
  for (const [name, value] of Object.entries(cors)) response.setHeader(name, value)
  const url = new URL(request.url ?? '/', ORIGIN)
  try {
    if (request.method === 'OPTIONS') return void response.writeHead(204).end()
    const file = /^\/uploads\/([^/]+)$/.exec(url.pathname)
    if (file) return void (await serveUpload(request, response, file[1]))
    if (url.pathname === '/') return json(response, 200, { mock: 'zernio', badKey: BAD_KEY })
    await api(request, response, url)
  } catch (error) {
    console.error(error)
    if (!response.headersSent) fail(response, 400, String(error))
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Fake Zernio on ${ORIGIN}: any key works except "${BAD_KEY}" (401).`)
  console.log(
    `A due post is publishing for ${PUBLISH_MS / 1000}s, then published; "#fail" fails it.`
  )
})
