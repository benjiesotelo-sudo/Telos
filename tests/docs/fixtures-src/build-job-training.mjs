// build-job-training.mjs - W3: a job-training program evaluation (labor-economics domain, the
// classic Lalonde-style PSM setup). 300 workers. Deterministic - no Math.random.
//
// Enrollment is PROBABILISTIC and favors lower prior_earnings (disadvantaged workers self-select
// into training) - so the naive treated/control gap in post_earnings is confounded. Matching on
// (age, education_years, prior_earnings) recovers the true ~2000 ATT. An unobserved "ability" term
// confounds both selection and the outcome, same idiom as the earlier causal.csv PSM block, so
// treated/control still OVERLAP on observed covariates (common support) and matching can balance them.
//
// Usage: `node tests/docs/fixtures-src/build-job-training.mjs` -> writes tests/e2e/fixtures/job-training.csv
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const N = 300
const r2 = (x) => Math.round(x * 100) / 100
// Deterministic well-mixed hash (MurmurHash3 finalizer) -> [0,1); see build-campus-study.mjs for why
// a linear-congruential jitter (aliased phase-shifted ramps across seeds) is unsafe here.
function hash01(n, s) {
  let h = (Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(s ^ 0xc2b2ae35, 0x27d4eb2f)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 2246822519)
  h ^= h >>> 13
  h = Math.imul(h, 3266489917)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
const jit = (n, s) => hash01(n, s) * 2 - 1 // -1..+1
const unif = (n, s = 0) => hash01(n, s + 10000) // [0,1), independent of jit(n, s)

const rows = [['age', 'education_years', 'prior_earnings', 'enrolled', 'post_earnings']]
for (let n = 1; n <= N; n++) {
  const ability = 2 * jit(n, 1) // -2..+2, unobserved confounder
  const age = 18 + (n % 40)
  const education_years = 8 + (n % 9)
  const prior_earnings = Math.max(0, 14000 + education_years * 800 + ability * 1200 + jit(n, 2) * 2500)

  // Disadvantaged workers (lower prior_earnings) self-select into training - strong enough that the
  // naive treated/control gap in post_earnings is visibly biased (Ashenfelter's-dip style: treated
  // workers start poorer, so their post_earnings base is lower too), which is the whole point of a
  // PSM demo: matching on prior_earnings/age/education recovers the true ~2000 ATT that the naive
  // comparison hides.
  const linpred = 2.6 - 0.00018 * prior_earnings + 0.25 * ability
  const p = 1 / (1 + Math.exp(-linpred))
  const enrolled = p > unif(n) ? 1 : 0

  const post_earnings = prior_earnings * 1.05 + 2000 * enrolled + 1400 * ability + jit(n, 3) * 1800
  rows.push([age, education_years, r2(prior_earnings), enrolled, r2(Math.max(0, post_earnings))])
}

writeFileSync(join(here, '..', '..', '..', 'tests', 'e2e', 'fixtures', 'job-training.csv'), rows.map((r) => r.join(',')).join('\n') + '\n')
console.log(`job-training.csv: ${rows.length - 1} rows, ${rows[0].length} columns`)
