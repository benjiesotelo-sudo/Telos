// build-scholarship.mjs - W3: a merit-scholarship RDD (education-policy domain).
// 300 students. entrance_score is a CONTINUOUS running variable (integer base + jitter, no mass
// points, so rdrobust's bandwidth selector and the half/double bandwidth-sensitivity re-estimates
// both have real density on either side of the cutoff). Deterministic - no Math.random.
//
//   scholarship = 1 if entrance_score >= 60 (the cutoff)
//   later_gpa   <- smooth trend in entrance_score + a +0.35 GPA JUMP right at the cutoff
//
// Usage: `node tests/docs/fixtures-src/build-scholarship.mjs` -> writes tests/e2e/fixtures/scholarship.csv
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const N = 300
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
const CUTOFF = 60

const rows = [['entrance_score', 'scholarship', 'later_gpa']]
for (let n = 1; n <= N; n++) {
  const entrance_score = Math.max(10, Math.min(100, ((n * 37) % 81) + 20 + jit(n, 1) * 2))
  const scholarship = entrance_score >= CUTOFF ? 1 : 0
  const later_gpa = 1.6 + 0.018 * entrance_score + (scholarship ? 0.35 : 0) + jit(n, 2) * 0.25
  rows.push([r2(entrance_score), scholarship, r2(Math.max(0.5, Math.min(4.0, later_gpa)))])
}

writeFileSync(join(here, '..', '..', '..', 'tests', 'e2e', 'fixtures', 'scholarship.csv'), rows.map((r) => r.join(',')).join('\n') + '\n')
console.log(`scholarship.csv: ${rows.length - 1} rows, ${rows[0].length} columns`)
