import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runWilcoxonSignedRank } from './wilcoxonSignedRank'
import type { Dataset } from './types'

// pre6/post6 (diffs A−B = −9,−11,−10,−13,−12,−17: no ties, no zeros) + two incomplete rows (listwise pairs: EXCLUDED, never coerced).
const paired: Dataset = { columns: ['pre', 'post'], rows: [
  { pre: 72, post: 81 }, { pre: 68, post: 79 }, { pre: 75, post: 85 }, { pre: 70, post: 83 }, { pre: 66, post: 78 }, { pre: 71, post: 88 },
  { pre: null, post: 90 }, { pre: 70, post: 'absent' },
] }

// Spike's tiedpre6/tiedpost6 diffs A−B = −2,−1,−3,+1,−3,−6 (tied |d|: {1,1} and {3,3} → midranks). Signed-rank stats depend only on the diffs.
const tied: Dataset = { columns: ['pre', 'post'], rows: [
  { pre: 10, post: 12 }, { pre: 10, post: 11 }, { pre: 10, post: 13 }, { pre: 10, post: 9 }, { pre: 10, post: 13 }, { pre: 10, post: 16 },
] }

describe('runWilcoxonSignedRank', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('default path: exact p, coin Z, rank-biserial r, per-sign rank summary, listwise pairs, difference figure', async () => {
    const r = await runWilcoxonSignedRank(engine, paired, 'pre', 'post', true)
    expect(r.nExcluded).toBe(2)
    expect(r.ranks).toEqual([
      { sign: 'Positive', n: 0, meanRank: null, sumRanks: 0 },
      { sign: 'Negative', n: 6, meanRank: 3.5, sumRanks: 21 },
      { sign: 'Ties', n: 0, meanRank: null, sumRanks: 0 },
    ])
    expect(r.v).toBe(0)
    expect(r.p).toBeCloseTo(0.03125, 5)      // exact 2/64 — 'Wilcoxon signed rank exact test'
    expect(r.method).toContain('exact')
    expect(r.z).toBeCloseTo(-2.20140, 4)     // coin::wilcoxsign_test (asymptotic) — card-specified mix with the exact p
    expect(r.r).toBeCloseTo(-1, 6)           // rank_biserial: complete separation
    expect(r.rLow).toBeCloseTo(-1, 3)        // effectsize::rank_biserial(paired=TRUE, ci=0.95)$CI_low — native R ≡ WebR (degenerate at full separation)
    expect(r.rHigh).toBeCloseTo(-1, 3)       // $CI_high
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('continuity toggle maps to correct= on the asymptotic path (exact=FALSE): both positions', async () => {
    const on = await runWilcoxonSignedRank(engine, paired, 'pre', 'post', true, true)
    expect(on.v).toBe(0)
    expect(on.p).toBeCloseTo(0.03603, 4)
    const off = await runWilcoxonSignedRank(engine, paired, 'pre', 'post', false, true)
    expect(off.p).toBeCloseTo(0.02771, 4)    // = the coin Z p (uncorrected normal approximation)
    expect(off.z).toBeCloseTo(-2.20140, 4)   // Z ignores correct= — always coin's standardized statistic
  })

  it('tied diffs: midrank V=1.5, exact-with-ties p (R 4.6.0 — spike-verified in BOTH environments, no warning)', async () => {
    const r = await runWilcoxonSignedRank(engine, tied, 'pre', 'post', true)
    expect(r.ranks).toEqual([
      { sign: 'Positive', n: 1, meanRank: 1.5, sumRanks: 1.5 },
      { sign: 'Negative', n: 5, meanRank: 3.9, sumRanks: 19.5 },
      { sign: 'Ties', n: 0, meanRank: null, sumRanks: 0 },
    ])
    expect(r.v).toBe(1.5)
    expect(r.p).toBeCloseTo(0.09375, 5)      // exact 6/64 — verified by full 2^6 sign-flip enumeration
    expect(r.method).toContain('exact')
    expect(r.z).toBeCloseTo(-1.89737, 4)
    expect(r.r).toBeCloseTo(-0.857143, 5)
    expect(r.rLow).toBeCloseTo(-0.974404, 3)  // effectsize::rank_biserial(paired=TRUE, ci=0.95) — native R ≡ WebR (discriminating CI)
    expect(r.rHigh).toBeCloseTo(-0.373210, 3)
    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('tied diffs, asymptotic path: both continuity positions', async () => {
    const on = await runWilcoxonSignedRank(engine, tied, 'pre', 'post', true, true)
    expect(on.v).toBe(1.5)
    expect(on.p).toBeCloseTo(0.07314, 4)
    const off = await runWilcoxonSignedRank(engine, tied, 'pre', 'post', false, true)
    expect(off.p).toBeCloseTo(0.05778, 4)
  })
})
