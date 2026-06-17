import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runMannWhitneyU } from './mannWhitneyU'
import type { Dataset } from './types'

// Spike fixture ovl12 (overlapping ranges, tie-free): control pooled ranks {6,2,9,4,1,5} → sum 27, U = 6.
const overlap12: Dataset = { columns: ['group', 'score'], rows: [
  { group: 'control', score: 72 }, { group: 'control', score: 68 }, { group: 'control', score: 75 },
  { group: 'control', score: 70 }, { group: 'control', score: 66 }, { group: 'control', score: 71 },
  { group: 'treatment', score: 74 }, { group: 'treatment', score: 79 }, { group: 'treatment', score: 69 },
  { group: 'treatment', score: 83 }, { group: 'treatment', score: 78 }, { group: 'treatment', score: 73 },
] }

// Spike fixture long12 (complete separation; same values as the t-test test's `unequal`) + two listwise rows.
const long12: Dataset = { columns: ['group', 'score'], rows: [
  { group: 'control', score: 72 }, { group: 'control', score: 68 }, { group: 'control', score: 75 },
  { group: 'control', score: 70 }, { group: 'control', score: 66 }, { group: 'control', score: 71 },
  { group: 'treatment', score: 81 }, { group: 'treatment', score: 79 }, { group: 'treatment', score: 85 },
  { group: 'treatment', score: 83 }, { group: 'treatment', score: 78 }, { group: 'treatment', score: 88 },
  { group: 'control', score: null }, { group: null, score: 70 }, // listwise: EXCLUDED, never coerced to 0
] }

describe('runMannWhitneyU', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('overlap12 default run: pooled rank summary, U for the first (alphabetical) level, EXACT p, coin Z, rank-biserial r, boxplot', async () => {
    const r = await runMannWhitneyU(engine, overlap12, 'score', 'group', true)
    expect(r.ranks).toEqual([
      { group: 'control', n: 6, meanRank: 4.5, sumRanks: 27, median: 70.5, iqr: 3.25 },
      { group: 'treatment', n: 6, meanRank: 8.5, sumRanks: 51, median: 76, iqr: 5.5 },
    ])
    // Hodges-Lehmann median difference + CI on the SAME wilcox.test branch (exact at these N) — native R ≡ WebR.
    expect(r.hodgesLehmann).toBeCloseTo(-6, 6)
    expect(r.hlLow).toBeCloseTo(-12, 6)
    expect(r.hlHigh).toBeCloseTo(1, 6)
    expect(r.u).toBe(6)                       // wilcox.test W = U for alphabetical-first 'control'
    expect(r.p).toBeCloseTo(0.064935, 5)      // EXACT path (= 60/924), R 4.6.0 default at these N
    expect(r.z).toBeCloseTo(-1.92154, 4)      // coin asymptotic Z — card mixes exact p with asymptotic Z
    expect(r.rankBiserial).toBeCloseTo(-0.6667, 3)
    expect(r.rankBiserialLow).toBeCloseTo(-0.9023, 3)  // effectsize::rank_biserial(ci=0.95)$CI_low  (native R ≡ WebR)
    expect(r.rankBiserialHigh).toBeCloseTo(-0.1241, 3) // $CI_high
    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('continuity toggle drives correct= on the asymptotic branch (exact=FALSE): both positions', async () => {
    const on = await runMannWhitneyU(engine, overlap12, 'score', 'group', true, true)
    const off = await runMannWhitneyU(engine, overlap12, 'score', 'group', false, true)
    expect(on.u).toBe(6); expect(off.u).toBe(6)
    expect(on.p).toBeCloseTo(0.065552, 5)
    expect(off.p).toBeCloseTo(0.054664, 5)    // equals the coin-Z normal p (uncorrected)
  })

  it('long12 (complete separation): U=0, exact p=2/924, Z, r=−1, listwise exclusion', async () => {
    const r = await runMannWhitneyU(engine, long12, 'score', 'group', true)
    expect(r.nExcluded).toBe(2)
    expect(r.ranks).toEqual([
      { group: 'control', n: 6, meanRank: 3.5, sumRanks: 21, median: 70.5, iqr: 3.25 },
      { group: 'treatment', n: 6, meanRank: 9.5, sumRanks: 57, median: 82, iqr: 5 },
    ])
    // study.csv == these 12 rows: spike ground truth HL = −12, 95% CI [−17, −7] (default/exact branch).
    expect(r.hodgesLehmann).toBeCloseTo(-12, 6)
    expect(r.hlLow).toBeCloseTo(-17, 6)
    expect(r.hlHigh).toBeCloseTo(-7, 6)
    expect(r.u).toBe(0)
    expect(r.p).toBeCloseTo(0.0021645, 6)
    expect(r.z).toBeCloseTo(-2.88231, 4)
    expect(r.rankBiserial).toBeCloseTo(-1, 6) // degenerate, complete separation
    // effectsize::rank_biserial(ci=0.95): complete separation pins r and BOTH CI bounds to −1 (boundary, spike-confirmed — not a bug)
    expect(r.rankBiserialLow).toBeCloseTo(-1, 3)
    expect(r.rankBiserialHigh).toBeCloseTo(-1, 3)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('long12 asymptotic branch: corrected vs uncorrected', async () => {
    const on = await runMannWhitneyU(engine, long12, 'score', 'group', true, true)
    const off = await runMannWhitneyU(engine, long12, 'score', 'group', false, true)
    expect(on.p).toBeCloseTo(0.005075, 5)
    expect(off.p).toBeCloseTo(0.003948, 5)
  })
})
