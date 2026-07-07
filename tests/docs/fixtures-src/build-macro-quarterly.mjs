// build-macro-quarterly.mjs - W3: a macroeconomic time series (quarterly, 1995Q1-2024Q4, 120 obs).
// Deterministic - no Math.random, byte-identical on every run.
//
// gdp_growth oscillates around 2.5% on an 8-year business cycle (stationary by construction - a
// clean ADF/KPSS story). unemployment reacts to LAST quarter's gdp_growth (Okun's law), which bakes
// in a genuine gdp_growth -> unemployment Granger direction. inflation is procyclical (reacts to the
// SAME quarter's gdp_growth). All three series are bounded combinations of a sinusoid + noise, so
// none carries a unit root - VAR/IRF/FEVD run cleanly on all three together.
//
// Usage: `node tests/docs/fixtures-src/build-macro-quarterly.mjs` -> writes tests/e2e/fixtures/macro-quarterly.csv
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const NQ = 120 // 1995Q1 .. 2024Q4
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

const quarterDate = (t) => {
  const year = 1995 + Math.floor(t / 4)
  const month = String((t % 4) * 3 + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

const rows = [['quarter', 'gdp_growth', 'inflation', 'unemployment']]
let prevGdp = 2.5
for (let t = 0; t < NQ; t++) {
  const cycle = Math.sin((2 * Math.PI * t) / 32) * 1.5 // 8-year cycle
  const gdp_growth = 2.5 + cycle + jit(t, 1) * 0.5
  const inflation = 2.0 + 0.35 * gdp_growth + jit(t, 2) * 0.4
  const unemployment = 6.0 - 0.75 * prevGdp + jit(t, 3) * 0.3 // Okun's law, lag 1 -> Granger gdp->unemp
  rows.push([quarterDate(t), r2(gdp_growth), r2(inflation), r2(Math.max(2.5, unemployment))])
  prevGdp = gdp_growth
}

writeFileSync(join(here, '..', '..', '..', 'tests', 'e2e', 'fixtures', 'macro-quarterly.csv'), rows.map((r) => r.join(',')).join('\n') + '\n')
console.log(`macro-quarterly.csv: ${rows.length - 1} rows, ${rows[0].length} columns`)
