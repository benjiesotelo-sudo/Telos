// build-province-panel.mjs - W3: a provincial investment/growth panel (macro-development domain).
// 10 provinces x 10 years (2014-2023) = 100 rows, long format. Deterministic - no Math.random.
//
//   growth[p,t] = provinceFE_p + 0.9*investment - 0.4*urbanization_gap + 0.3*education_spend + noise
//
// provinceFE_p (the province intercept FE absorbs) increases with p, and so does the investment
// baseline - so the province effect CORRELATES with a regressor, which makes fixed- and random-
// effects estimates differ and the Hausman test non-trivial (same idiom as the earlier panel.csv).
//
// Usage: `node tests/docs/fixtures-src/build-province-panel.mjs` -> writes tests/e2e/fixtures/province-panel.csv
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

const rows = [['province', 'year', 'growth', 'investment', 'education_spend', 'urbanization']]
for (let i = 1; i <= 10; i++) {
  const province = `province${String(i).padStart(2, '0')}`
  const provinceFE = 1.5 + i * 0.35 // province intercept (absorbed by FE)
  const investBase = 15 + i * 1.1   // correlates with provinceFE -> FE != RE
  const eduBase = 4 + i * 0.15
  const urbanBase = 30 + i * 2
  for (let y = 2014; y <= 2023; y++) {
    const k = y - 2014
    const investment = investBase + 0.4 * k + 0.6 * jit(i, y, 1)
    const education_spend = eduBase + 0.08 * k + 0.15 * jit(i, y, 2)
    const urbanization = urbanBase + 0.8 * k + 0.5 * jit(i, y, 3)
    const noise = 0.3 * jit(i, y, 4)
    const growth = provinceFE + 0.09 * investment + 0.25 * education_spend - 0.015 * urbanization + noise
    rows.push([province, y, r3(growth), r3(investment), r3(education_spend), r3(urbanization)])
  }
}

writeFileSync(join(here, '..', '..', '..', 'tests', 'e2e', 'fixtures', 'province-panel.csv'), rows.map((r) => r.join(',')).join('\n') + '\n')
console.log(`province-panel.csv: ${rows.length - 1} rows, ${rows[0].length} columns`)
