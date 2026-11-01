import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'

// Only /api/* reaches the Worker: wrangler.jsonc's run_worker_first. A route validates what
// it reads with the feature's schema from src/features/<name>/schema.ts, the one the client
// parses the response with.
const app = new Hono<{ Bindings: Env }>().basePath('/api')

app.use(secureHeaders())

app.get('/health', (c) => c.json({ ok: true }))

app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError((error, c) => {
  console.error(error)
  return c.json({ error: 'Internal error' }, 500)
})

export default app
