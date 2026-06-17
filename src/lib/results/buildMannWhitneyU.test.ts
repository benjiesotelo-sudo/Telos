import { describe, it, expect } from 'vitest'
import { buildMannWhitneyU } from './buildMannWhitneyU'
import { MANN_WHITNEY_U as spec } from '../registry/mannWhitneyU'
import type { MannWhitneyUResult } from '../stats/mannWhitneyU'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const overlap: MannWhitneyUResult = { // cross-verified overlap12 numbers
  ranks: [
    { group: 'control', n: 6, meanRank: 4.5, sumRanks: 27, median: 70.5, iqr: 3.25 },
    { group: 'treatment', n: 6, meanRank: 8.5, sumRanks: 51, median: 76, iqr: 5.5 },
  ],
  u: 6, z: -1.92153785, p: 0.0649350649, rankBiserial: -0.666666667,
  rankBiserialLow: -0.9023481, rankBiserialHigh: -0.1240779, // effectsize::rank_biserial(ci=0.95) — native R ≡ WebR
  hodgesLehmann: -6, hlLow: -12, hlHigh: 1, // wilcox.test(conf.int=TRUE)$estimate / $conf.int
  alpha: 0.05, tails: 'two.sided', nExcluded: 0, figurePng: png,
}

describe('buildMannWhitneyU', () => {
  const c = buildMannWhitneyU(spec, overlap)
  it('Table 1: per-group rank rows at 2 dp, with median + IQR descriptives', () => {
    expect(c.tables[0].spec.id).toBe('rank-summary')
    expect(c.tables[0].rows).toEqual([
      { group: 'control', n: 6, meanRank: '4.50', median: '70.50', iqr: '3.25', sumRanks: '27.00' },
      { group: 'treatment', n: 6, meanRank: '8.50', median: '76.00', iqr: '5.50', sumRanks: '51.00' },
    ])
    expect(c.tables[0].spec.columns.map((col) => col.key)).toEqual(['group', 'n', 'meanRank', 'median', 'iqr', 'sumRanks'])
  })
  it('Table 2: U · Z · p · r-with-CI with U+2212 minuses (no df), then the Hodges-Lehmann span row', () => {
    expect(c.tables[1].rows).toEqual([
      { u: '6', z: '−1.92', p: '.065', r: '−0.67 [−0.90, −0.12]' },
      { _kind: 'span', u: 'Hodges-Lehmann median difference = −6.00, 95% CI [−12.00, 1.00]' },
    ])
    expect(c.tables[1].spec.columns.map((col) => col.key)).toEqual(['u', 'z', 'p', 'r'])
  })
  it('carries the plain rank-biserial note and the boxplot figure', () => {
    expect(c.note).toEqual({ kind: 'plain', text: 'r is the rank-biserial effect size. The Hodges-Lehmann estimate is the median of all between-group score differences (a location shift); its CI is from the same wilcox.test.' })
    expect(c.figures).toEqual([{ caption: 'Distribution by group', type: 'boxplot', png }])
    expect(c.nExcluded).toBe(0)
  })
  it('fills the APA exemplar (p ≥ .001 branch) with the rank-biserial CI', () => {
    expect(c.apa).toBe('A Mann-Whitney U test gave U=6, Z=−1.92, p = .065, r=−.67 [−.90, −.12].')
  })
  it('Hodges-Lehmann span renders em-dash NA when the CI is unavailable (guarded null)', () => {
    const c3 = buildMannWhitneyU(spec, { ...overlap, hodgesLehmann: null, hlLow: null, hlHigh: null })
    expect(c3.tables[1].rows[1]).toEqual({ _kind: 'span', u: 'Hodges-Lehmann median difference = —, 95% CI [—, —]' })
  })
  it('p-clause flips to p < .001; a midrank U renders at 2 dp', () => {
    const c2 = buildMannWhitneyU(spec, { ...overlap, u: 6.5, p: 0.0004 })
    expect(c2.apa).toContain('U=6.50')
    expect(c2.apa).toContain('p < .001')
    expect(c2.tables[1].rows[0].p).toBe('<.001')
  })
})
