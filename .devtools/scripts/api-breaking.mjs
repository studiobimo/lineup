// Fails if a document breaks `v1`: node api-breaking.mjs <before.json> <after.json>
import { readFileSync } from 'node:fs'

import { breakingChanges } from '../../packages/api/src/breaking-changes.ts'

const [before, after] = process.argv.slice(2).map((file) => JSON.parse(readFileSync(file, 'utf8')))
const found = breakingChanges(before, after)
for (const change of found) console.error(`✖ ${change}`)
if (found.length > 0) {
  console.error('These break v1, so they belong in /api/v2 (docs/API.md).')
  process.exit(1)
}
console.log('✔ api reference: nothing breaks v1')
