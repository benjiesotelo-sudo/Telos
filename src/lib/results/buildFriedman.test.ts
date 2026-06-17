import { describe, it, expect } from 'vitest'
import { buildFriedman } from './buildFriedman'
import { FRIEDMAN as spec } from '../registry/friedman'
import type { FriedmanResult } from '../stats/friedman'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

// Spike numbers from known answers (fixture score_t1/t2/t3)
const result: FriedmanResult = {
  alpha: 0.05,
  ranks: [
    { condition: 'score_t1', meanRank: 1.08333333333333 },
    { condition: 'score_t2', meanRank: 1.93333333333333 },
    { condition: 'score_t3', meanRank: 2.98333333333333 },
  ],
  chi2: 67.1882845188285,
  df: 2,
  p: 2.57187224967219e-15,
  w: 0.559902370990237,
  wLow: 0.4786111, wHigh: 1, // effectsize::kendalls_w(ci=0.95, seed 42) — native R ≡ WebR; one-sided, upper pinned at 1.00
  posthoc: [
    { pair: 'score_t1 - score_t2', pAdj: 2.83863931227479e-05 },
    { pair: 'score_t1 - score_t3', pAdj: 1.0e-10 }, // placeholder finite value
    { pair: 'score_t2 - score_t3', pAdj: 0.0012 },
  ],
  nExcluded: 0,
  figurePng: png,
}

describe('buildFriedman', () => {
  const c = buildFriedman(spec, result)

  it('Table 1: rank-summary has Condition + Mean rank only (no N column)', () => {
    expect(c.tables[0].spec.id).toBe('rank-summary')
    expect(c.tables[0].spec.columns.map((col) => col.key)).toEqual(['condition', 'meanRank'])
    expect(c.tables[0].rows).toHaveLength(3)
    expect(c.tables[0].rows[0]).toEqual({ condition: 'score_t1', meanRank: '1.08' })
    expect(c.tables[0].rows[1]).toEqual({ condition: 'score_t2', meanRank: '1.93' })
    expect(c.tables[0].rows[2]).toEqual({ condition: 'score_t3', meanRank: '2.98' })
  })

  it('Table 2: friedman test row with χ², df, p, Kendall\'s W', () => {
    expect(c.tables[1].spec.id).toBe('friedman')
    expect(c.tables[1].rows).toHaveLength(1)
    expect(c.tables[1].rows[0]).toEqual({ chi2: '67.19', df: '2', p: '<.001', w: '0.56 [0.48, 1.00]' })
  })

  it('Table 3: posthoc Nemenyi rows with pair + padj', () => {
    expect(c.tables[2].spec.id).toBe('posthoc')
    expect(c.tables[2].spec.columns.map((col) => col.key)).toEqual(['pair', 'padj'])
    expect(c.tables[2].rows[0]).toEqual({ pair: 'score_t1 - score_t2', padj: '<.001' })
    expect(c.tables[2].rows[2]).toEqual({ pair: 'score_t2 - score_t3', padj: '.001' })
  })

  it('note is null (no table note on this card)', () => {
    expect(c.note).toBeNull()
  })

  it('figure carries the profile caption and type', () => {
    expect(c.figures).toEqual([{ caption: 'Across conditions', type: 'profile / box plot', file: 'profile', png }])
  })

  it('APA string: χ²(2)=67.19, p < .001, W=.56 with its [95% CI]', () => {
    expect(c.apa).toContain('χ²(2)=67.19')
    expect(c.apa).toContain('p < .001')
    expect(c.apa).toContain('W=.56 [.48, 1.00]')
  })

  it('p ≥ .001 branch renders fpApa(p) instead of < .001', () => {
    const r2: FriedmanResult = { ...result, p: 0.0235 }
    const c2 = buildFriedman(spec, r2)
    expect(c2.apa).toContain('p = .024')
    expect(c2.tables[1].rows[0].p).toBe('.024')
  })

  it('nExcluded propagated', () => {
    expect(c.nExcluded).toBe(0)
  })
})
