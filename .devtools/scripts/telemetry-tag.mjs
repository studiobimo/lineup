// Prints the account tag the Worker logs for a handle (ADR-0026), to look a customer up in the logs:
//   TELEMETRY_SALT=... node .devtools/scripts/telemetry-tag.mjs <handle>
// It must stay the same as accountTag in packages/api/src/telemetry/routes.ts, which a test checks.
import { createHmac } from 'node:crypto'

const salt = process.env.TELEMETRY_SALT
const handle = process.argv[2]?.trim().replace(/^@+/, '').toLowerCase()

if (!salt || !handle) {
  console.error('Usage: TELEMETRY_SALT=... node telemetry-tag.mjs <handle>')
  process.exit(1)
}

console.log(createHmac('sha256', salt).update(handle).digest('hex').slice(0, 12))
