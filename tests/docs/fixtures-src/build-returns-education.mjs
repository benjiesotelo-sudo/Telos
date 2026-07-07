// build-returns-education.mjs - W3: returns-to-education IV/2SLS (labor-economics domain, a
// Card-style instrument). 250 workers. Deterministic - no Math.random.
//
//   wage      <- 9*education + 7*ability(unobserved confounder) + noise
//   education <- 0.5*mother_education + 0.8*ability + noise
//
// mother_education drives education but is excluded from wage directly -> a valid instrument.
// OLS on education is biased upward (ability sits in wage's error term, correlated with education);
// 2SLS on mother_education recovers the ~9 effect. experience is an included control.
//
// Usage: `node tests/docs/fixtures-src/build-returns-education.mjs` -> writes tests/e2e/fixtures/returns-education.csv
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const N = 250
const r2 = (x) => Math.round(x * 100) / 100
function hash01(n, s) {
  let h = (Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(s ^ 0xc2b2ae35, 0x27d4eb2f)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 2246822519)
  h ^= h >>> 13
  h = Math.imul(h, 3266489917)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
const jit = (n, s) => hash01(n, s) * 2 - 1 // -1..+1

const rows = [['wage', 'education', 'mother_education', 'experience']]
for (let n = 1; n <= N; n++) {
  const ability = 2 * jit(n, 1) // -2..+2, unobserved confounder
  const experience = 2 + (n % 25)
  const mother_education = 8 + (n % 9) + 0.4 * jit(n, 2) // instrument, exogenous
  const education = 8 + 0.5 * mother_education + 0.8 * ability + 0.5 * jit(n, 3)
  const wage = 250 + 9 * education + 7 * ability + 0.6 * experience + 3 * jit(n, 4)
  rows.push([r2(wage), r2(education), r2(mother_education), experience])
}

writeFileSync(join(here, '..', '..', '..', 'tests', 'e2e', 'fixtures', 'returns-education.csv'), rows.map((r) => r.join(',')).join('\n') + '\n')
console.log(`returns-education.csv: ${rows.length - 1} rows, ${rows[0].length} columns`)
