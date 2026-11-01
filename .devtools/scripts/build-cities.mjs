// Writes the city list that turns a photo's position into a name, from GeoNames (CC BY 4.0). The
// data changes slowly and the app ships what this writes, so run it by hand, from the repo root:
//
//   curl -sSfLO https://download.geonames.org/export/dump/cities15000.zip
//   unzip cities15000.zip && node .devtools/scripts/build-cities.mjs cities15000.txt
//   pnpm exec prettier --write apps/web/src/features/planner/cities.json
//
// A city of 100,000 people is the place a photo is "from". Smaller ones only turn a trip into a
// scatter of suburbs, and they would make the list several times the size.
import { readFileSync, writeFileSync } from 'node:fs'

const MIN_POPULATION = 100_000
const OUTPUT = 'apps/web/src/features/planner/cities.json'
// Two decimals of a degree is a kilometre or so: all a city's position needs.
const round = (degrees) => Math.round(Number(degrees) * 100) / 100

const cities = readFileSync(process.argv[2], 'utf8')
  .trim()
  .split('\n')
  .map((line) => line.split('\t'))
  // PPLX is a part of a city, not a city.
  .filter((row) => Number(row[14]) >= MIN_POPULATION && !row[7].startsWith('PPLX'))
  .map((row) => [row[1], row[8], round(row[4]), round(row[5])])
  .sort(([one], [other]) => (one < other ? -1 : 1))

writeFileSync(OUTPUT, `${JSON.stringify(cities)}\n`)
console.log(`${cities.length} cities in ${OUTPUT}`)
