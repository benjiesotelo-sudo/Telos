// build-sleep-caffeine.mjs - W2: a within-subject caffeine crossover (sleep-science domain).
// 40 participants, each measured at three doses (Baseline / Low / High), wide format (one row per
// participant, one column per condition) - the shape repeated-measures/mixed/paired/Friedman expect.
// Deterministic - no Math.random, byte-identical on every run.
//
// Story: caffeine dose has a DIRECTION CONTRAST across two outcomes - sleep_quality DECLINES with
// dose, reaction_time IMPROVES (gets faster) with dose. tolerance_group (Low/High) is a between-
// subjects factor for the mixed-design card: high-tolerance participants show a smaller sleep decline.
// Reaction time is right-skewed (occasional slow trials) - the nonparametric star for Friedman/Wilcoxon.
//
// Usage: `node tests/docs/fixtures-src/build-sleep-caffeine.mjs` -> writes tests/e2e/fixtures/sleep-caffeine.csv
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const N = 40
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

const rows = [[
  'participant_id', 'tolerance_group', 'sleep_baseline', 'sleep_low', 'sleep_high',
  'rt_baseline', 'rt_low', 'rt_high',
]]

for (let i = 1; i <= N; i++) {
  const tolerance_group = i % 2 === 0 ? 'High' : 'Low' // interleaved, 20/20
  const isHighTol = tolerance_group === 'High'

  const sleep_baseline = 7.4 + jit(i, 1) * 0.7
  const declineLow = isHighTol ? 0.25 : 0.55
  const declineHigh = isHighTol ? 0.7 : 1.7
  const sleep_low = sleep_baseline - declineLow + jit(i, 2) * 0.3
  const sleep_high = sleep_baseline - declineHigh + jit(i, 3) * 0.3

  // Reaction time: right-skewed via an occasional slow-trial spike, applied to every condition of a
  // given participant (a "slow responder" trait), on top of the caffeine-speeds-you-up trend.
  const spike = i % 9 === 0 ? 140 : i % 17 === 0 ? 70 : 0
  const rt_baseline = 445 + spike + jit(i, 4) * 30
  const rt_low = rt_baseline - 28 + jit(i, 5) * 18
  const rt_high = rt_baseline - 68 + jit(i, 6) * 18

  rows.push([
    `P${String(i).padStart(2, '0')}`, tolerance_group,
    r2(sleep_baseline), r2(sleep_low), r2(sleep_high),
    r2(rt_baseline), r2(rt_low), r2(rt_high),
  ])
}

writeFileSync(join(here, '..', '..', '..', 'tests', 'e2e', 'fixtures', 'sleep-caffeine.csv'), rows.map((r) => r.join(',')).join('\n') + '\n')
console.log(`sleep-caffeine.csv: ${rows.length - 1} rows, ${rows[0].length} columns`)
