import { describe, it, expect } from 'vitest'
import { buildMannWhitneyU } from './buildMannWhitneyU'
import { MANN_WHITNEY_U as spec } from '../registry/mannWhitneyU'
import type { MannWhitneyUResult } from '../stats/mannWhitneyU'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const overlap: MannWhitneyUResult = { // cross-verified overlap12 numbers
  ranks: [
    { group: 'control', n: 6, meanRank: 4.5, sumRanks: 27 },
    { group: 'treatment', n: 6, meanRank: 8.5, sumRanks: 51 },
  ],
  u: 6, z: -1.92153785, p: 0.0649350649, rankBiserial: -0.666666667, nExcluded: 0, figurePng: png,
}

describe('buildMannWhitneyU', () => {
  const c = buildMannWhitneyU(spec, overlap)
  it('Table 1: per-group rank rows at 2 dp', () => {
    expect(c.tables[0].spec.id).toBe('rank-summary')
    expect(c.tables[0].rows).toEqual([
      { group: 'control', n: 6, meanRank: '4.50', sumRanks: '27.00' },
      { group: 'treatment', n: 6, meanRank: '8.50', sumRanks: '51.00' },
    ])
  })
  it('Table 2: U · Z · p · r with U+2212 minuses (no df, no CI)', () => {
    expect(c.tables[1].rows).toEqual([{ u: '6', z: '−1.92', p: '.065', r: '−0.67' }])
    expect(c.tables[1].spec.columns.map((col) => col.key)).toEqual(['u', 'z', 'p', 'r'])
  })
  it('carries the plain rank-biserial note and the boxplot figure', () => {
    expect(c.note).toEqual({ kind: 'plain', text: 'r is the rank-biserial effect size.' })
    expect(c.figures).toEqual([{ caption: 'Distribution by group', type: 'boxplot', png }])
    expect(c.nExcluded).toBe(0)
  })
  it('fills the APA exemplar (p ≥ .001 branch)', () => {
    expect(c.apa).toBe('A Mann-Whitney U test gave U=6, Z=−1.92, p = .065, r=−.67.')
  })
  it('p-clause flips to p < .001; a midrank U renders at 2 dp', () => {
    const c2 = buildMannWhitneyU(spec, { ...overlap, u: 6.5, p: 0.0004 })
    expect(c2.apa).toContain('U=6.50')
    expect(c2.apa).toContain('p < .001')
    expect(c2.tables[1].rows[0].p).toBe('<.001')
  })
})
