// build-minwage-employment.mjs - W3: a minimum-wage/employment DiD panel (labor-economics domain).
// 20 states (10 treated, 10 control) x 8 years (2014-2021) = 160 rows, long format.
// Deterministic - no Math.random, byte-identical on every run.
//
// Ten states raise their minimum wage in 2018 (post = year >= 2018); the other ten do not. Both
// groups share the SAME linear time trend (only the state intercept differs), so pre-treatment
// trends are parallel BY CONSTRUCTION - 4 pre-period years (2014-2017) give the pre-trends
// leads-and-lags F test real degrees of freedom. The DiD term is a clean, significant -2.0 point
// employment effect on top of that shared trend.
//
// Usage: `node tests/docs/fixtures-src/build-minwage-employment.mjs` -> writes tests/e2e/fixtures/minwage-employment.csv
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const r3 = (x) => Math.round(x * 1000) / 1000
function hash01(n, s) {
  let h = (Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(s ^ 0xc2b2ae35, 0x27d4eb2f)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 2246822519)
  h ^= h >>> 13
  h = Math.imul(h, 3266489917)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
const jit = (i, y, s) => hash01(i * 10000 + y, s) * 2 - 1 // -1..+1

const rows = [['state', 'year', 'employment', 'treated', 'post']]
for (let i = 1; i <= 20; i++) {
  const state = `state${String(i).padStart(2, '0')}`
  const treated = i <= 10 ? 1 : 0
  const stateFE = 60 + jit(i, 0, 9) * 6 // state-level intercept, independent of treatment status
  for (let y = 2014; y <= 2021; y++) {
    const k = y - 2014
    const post = y >= 2018 ? 1 : 0
    const commonTrend = 0.6 * k // SAME slope for treated and control -> parallel pre-trends
    const didEffect = -2.0 * treated * post
    const noise = 0.5 * jit(i, y, 1)
    const employment = stateFE + commonTrend + didEffect + noise
    rows.push([state, y, r3(employment), treated, post])
  }
}

writeFileSync(join(here, '..', '..', '..', 'tests', 'e2e', 'fixtures', 'minwage-employment.csv'), rows.map((r) => r.join(',')).join('\n') + '\n')
console.log(`minwage-employment.csv: ${rows.length - 1} rows, ${rows[0].length} columns`)
