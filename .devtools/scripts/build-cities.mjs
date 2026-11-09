import { readFileSync, writeFileSync } from 'node:fs'

const MIN_POPULATION = 100_000
const OUTPUT = 'apps/web/src/features/planner/cities.json'
const round = (degrees) => Math.round(Number(degrees) * 100) / 100

const cities = readFileSync(process.argv[2], 'utf8')
  .trim()
  .split('\n')
  .map((line) => line.split('\t'))
  .filter((row) => Number(row[14]) >= MIN_POPULATION && !row[7].startsWith('PPLX'))
  .map((row) => [row[1], row[8], round(row[4]), round(row[5])])
  .sort(([one], [other]) => (one < other ? -1 : 1))

writeFileSync(OUTPUT, `${JSON.stringify(cities)}\n`)
console.log(`${cities.length} cities in ${OUTPUT}`)
