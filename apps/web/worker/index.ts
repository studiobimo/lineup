import { createApi } from 'lineup-api'

// Only /api/* reaches the Worker: wrangler.jsonc's run_worker_first.
export default createApi()
