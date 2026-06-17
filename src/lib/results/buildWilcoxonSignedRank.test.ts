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
  v: 0, z: -2.20139816, p: 0.03125, r: -1, rLow: -1, rHigh: -1, method: 'Wilcoxon signed rank exact test',
  hl: -11.5, hlLow: -17, hlHigh: -9,   // wilcox.test(conf.int=TRUE)$estimate / $conf.int — exact path on paired.csv
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
  it('Table 2: one row under the literal V / W header, U+2212 minuses; r carries its 95% CI; HL median diff + CI column', () => {
    expect(c.tables[1].rows).toEqual([{ v: '0.00', z: '−2.20', p: '.031', r: '−1.00 [−1.00, −1.00]', hl: '−11.50 [−17.00, −9.00]' }])
  })
  it('Table 2: HL column em-dashes any null bound (R could not compute the CI)', () => {
    const cn = buildWilcoxonSignedRank(spec, { ...base, hl: -11.5, hlLow: null, hlHigh: null })
    expect(cn.tables[1].rows[0].hl).toBe('−11.50 [—, —]')
    const cnAll = buildWilcoxonSignedRank(spec, { ...base, hl: null, hlLow: null, hlHigh: null })
    expect(cnAll.tables[1].rows[0].hl).toBe('— [—, —]')
  })
  it('NO note (the drawn card has none); excluded pairs and how-to-read carry through', () => {
    expect(c.note).toBeNull()
    expect(c.nExcluded).toBe(2)
    expect(c.howToRead).toBe(spec.howToRead + ' Your significance threshold (α) is 0.05.')
  })
  it('APA now reports V/W (Theme-4 completeness) alongside Z, p, r with its CI', () => {
    expect(c.apa).toBe('A Wilcoxon signed-rank test gave V=0.00, Z=−2.20, p = .031, r=−1.00 [−1.00, −1.00].')
  })
  it('figure carries the difference type for alt-text and export naming', () => {
    expect(c.figures).toEqual([{ caption: 'Change per case', type: 'difference', png: base.figurePng }])
  })
  it('p-clause branch: tiny p renders p<.001 in table and sentence; midrank V keeps 2 dp; non-degenerate r CI renders both bounds', () => {
    // tied fixture: r=−0.857143, native-R rank_biserial(ci=0.95) CI = [−0.974404, −0.373210]
    const c2 = buildWilcoxonSignedRank(spec, { ...base, v: 1.5, p: 0.0002, r: -0.857143, rLow: -0.974404, rHigh: -0.373210 })
    expect(c2.tables[1].rows[0]).toMatchObject({ v: '1.50', p: '<.001', r: '−0.86 [−0.97, −0.37]' })
    expect(c2.apa).toContain('V=1.50, Z=−2.20, p < .001, r=−.86 [−.97, −.37].')
  })
})
