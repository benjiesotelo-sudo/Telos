import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runKruskalWallis } from './kruskalWallis'
import { loadAnovaFixture } from './fixtures/anova'
import type { Dataset } from './types'

describe('runKruskalWallis', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike known answers from anova fixture (group x outcome)', async () => {
    const r = await runKruskalWallis(engine, loadAnovaFixture(), 'outcome', 'group')
    // H, df, p (spike-verified native R 4.6.0)
    expect(r.h).toBeCloseTo(6.56495733622387, 6)
    expect(r.df).toBe(2)
    expect(r.p).toBeCloseTo(0.0375351043416359, 6)
    // epsilon-squared
    expect(r.eps2).toBeCloseTo(0.111270463325828, 6)
    // ε² CI — effectsize::rank_epsilon_squared(ci=0.95) with set.seed(42); one-sided, upper pinned at 1.00 (native R ≡ WebR)
    expect(r.eps2Low).toBeCloseTo(0.0257699314, 3)
    expect(r.eps2High).toBeCloseTo(1, 3)
    // rank summary
    expect(r.ranks).toHaveLength(3)
    const control = r.ranks.find((x) => x.group === 'control')!
    expect(control.n).toBe(20)
    expect(control.meanRank).toBeCloseTo(24.9, 6)
    const drugA = r.ranks.find((x) => x.group === 'drug_a')!
    expect(drugA.meanRank).toBeCloseTo(28.15, 6)
    const drugB = r.ranks.find((x) => x.group === 'drug_b')!
    expect(drugB.meanRank).toBeCloseTo(38.45, 6)
    // Dunn post-hoc (holm)
    expect(r.posthoc).toHaveLength(3)
    const cd = r.posthoc.find((x) => x.pair === 'control - drug_a')!
    expect(cd.z).toBeCloseTo(0.588572301903464, 6)
    expect(cd.pAdj).toBeCloseTo(0.556148218919164, 6)
    const cb = r.posthoc.find((x) => x.pair === 'control - drug_b')!
    expect(cb.z).toBeCloseTo(2.4538937510129, 6)
    expect(cb.pAdj).toBeCloseTo(0.0423956188352741, 6)
    const ab = r.posthoc.find((x) => x.pair === 'drug_a - drug_b')!
    expect(ab.z).toBeCloseTo(1.86532144910944, 6)
    expect(ab.pAdj).toBeCloseTo(0.124272720791776, 6)
    // no exclusions on this fixture
    expect(r.nExcluded).toBe(0)
    // figure is a valid PNG
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('listwise: excludes rows with missing/non-finite outcome or blank group', async () => {
    const ds: Dataset = { columns: ['group', 'outcome'], rows: [
      { group: 'a', outcome: 1 }, { group: 'a', outcome: 2 }, { group: 'a', outcome: 3 },
      { group: 'b', outcome: 4 }, { group: 'b', outcome: 5 }, { group: 'b', outcome: 6 },
      { group: 'c', outcome: 7 }, { group: 'c', outcome: 8 }, { group: 'c', outcome: 9 },
      { group: 'a', outcome: null }, { group: null, outcome: 10 },
    ] }
    const r = await runKruskalWallis(engine, ds, 'outcome', 'group')
    expect(r.nExcluded).toBe(2)
    expect(r.ranks.reduce((s, x) => s + x.n, 0)).toBe(9)
  }, 300_000)
})
