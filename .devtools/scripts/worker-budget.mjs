#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'

const { values } = parseArgs({ options: { 'gzip-kib': { type: 'string' } } })
const limit = Number(values['gzip-kib'])

const fail = (message) => {
  console.error(`✖ ${message}`)
  process.exit(1)
}

if (!limit) fail('usage: worker-budget.mjs --gzip-kib <number>')

const { stdout, stderr, status } = spawnSync('pnpm', ['exec', 'wrangler', 'deploy', '--dry-run'], {
  encoding: 'utf8'
})
if (status !== 0) fail(`wrangler deploy --dry-run failed:\n${stdout}${stderr}`)

const [, size, unit] = stdout.match(/Total Upload:.*gzip: ([\d.]+) (KiB|MiB)/) ?? []
if (!size) fail(`no gzip size in wrangler's output:\n${stdout}`)

const kib = Number(size) * (unit === 'MiB' ? 1024 : 1)
if (kib > limit) fail(`worker budget: ${kib} KiB gzipped, over the budget of ${limit} KiB`)
console.log(`✔ worker budget: ${kib} of ${limit} KiB gzipped`)
