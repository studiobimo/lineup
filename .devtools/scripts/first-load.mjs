#!/usr/bin/env node
// Fails when the first load outgrows the PRD's limit: the script a visit downloads before any lazy
// route, which is what index.html names. The bundle budget cannot catch this, because lazy code
// counts the same there. Run it after the build.
//
//   first-load.mjs --dir dist/client --limit-kb 200
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { gzipSync } from 'node:zlib'

const { values } = parseArgs({
  options: { dir: { type: 'string' }, 'limit-kb': { type: 'string' } }
})
const limit = Number(values['limit-kb'])

const fail = (message) => {
  console.error(`✖ ${message}`)
  process.exit(1)
}

if (!values.dir || !limit) fail('usage: first-load.mjs --dir <client build> --limit-kb <number>')

const html = readFileSync(join(values.dir, 'index.html'), 'utf8')
const scripts = new Set(html.match(/assets\/[^"]+\.js/g))
if (scripts.size === 0) fail(`no scripts named in ${values.dir}/index.html`)

const bytes = [...scripts].reduce(
  (total, script) => total + gzipSync(readFileSync(join(values.dir, script)), { level: 9 }).length,
  0
)
const kb = (bytes / 1000).toFixed(1)
if (bytes > limit * 1000) fail(`first load: ${kb} kB gzipped, over the limit of ${limit} kB`)
console.log(`✔ first load: ${kb} of ${limit} kB gzipped`)
