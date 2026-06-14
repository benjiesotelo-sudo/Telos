import { describe, it, expect } from 'vitest'
import { buildWilcoxonSignedRank } from './buildWilcoxonSignedRank'
import { WILCOXON_SIGNED_RANK as spec } from '../registry/wilcoxonSignedRank'
import type { WilcoxonSignedRankResult } from '../stats/wilcoxonSignedRank'

// pre6/post6 verified numbers (V=0, exact p=.03125, coin Z=−2.20139816, r=−1) + 2 excluded pairs.
const base: WilcoxonSignedRankResult = {
  ranks: [
    { sign: 'Positive', n: 0, meanRank: null, sumRanks: 0 },
    { sign: 'Negative', n: 6, meanRank: 3.5, sumRanks: 21 },
    { sign: 'Ties', n: 0, meanRank: null, sumRanks: 0 },
  ],
  v: 0, z: -2.20139816, p: 0.03125, r: -1, method: 'Wilcoxon signed rank exact test',
  alpha: 0.05, tails: 'two.sided', nExcluded: 2, figurePng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
}

describe('buildWilcoxonSignedRank', () => {
  const c = buildWilcoxonSignedRank(spec, base)
  it('Table 1: per-sign rows, em-dash mean rank for empty signs', () => {
    expect(c.tables[0].spec.id).toBe('rank-summary')
    expect(c.tables[0].rows).toEqual([
      { sign: 'Positive', n: 0, meanRank: '—', sumRanks: '—' },
      { sign: 'Negative', n: 6, meanRank: '3.50', sumRanks: '21.00' },
      { sign: 'Ties', n: 0, meanRank: '—', sumRanks: '—' },
    ])
  })
  it('Table 2: one row under the literal V / W header, U+2212 minuses', () => {
    expect(c.tables[1].rows).toEqual([{ v: '0.00', z: '−2.20', p: '.031', r: '−1.00' }])
  })
  it('NO note (the drawn card has none); excluded pairs and how-to-read carry through', () => {
    expect(c.note).toBeNull()
    expect(c.nExcluded).toBe(2)
    expect(c.howToRead).toBe(spec.howToRead + ' Your significance threshold (α) is 0.05.')
  })
  it('APA omits V/W — only Z, p, r, exactly as drawn', () => {
    expect(c.apa).toBe('A Wilcoxon signed-rank test gave Z=−2.20, p = .031, r=−1.00.')
  })
  it('figure carries the difference type for alt-text and export naming', () => {
    expect(c.figures).toEqual([{ caption: 'Change per case', type: 'difference', png: base.figurePng }])
  })
  it('p-clause branch: tiny p renders p<.001 in table and sentence; midrank V keeps 2 dp', () => {
    const c2 = buildWilcoxonSignedRank(spec, { ...base, v: 1.5, p: 0.0002 })
    expect(c2.tables[1].rows[0]).toMatchObject({ v: '1.50', p: '<.001' })
    expect(c2.apa).toContain('Z=−2.20, p < .001, r=−1.00.')
  })
})
