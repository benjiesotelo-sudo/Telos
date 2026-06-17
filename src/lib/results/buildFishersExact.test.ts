import { describe, it, expect } from 'vitest'
import { buildFishersExact } from './buildFishersExact'
import { FISHERS_EXACT } from '../registry/fishersExact'
import type { FishersExactResult } from '../stats/fishersExact'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const base: FishersExactResult = { rowVar: 'passed', colVar: 'gender',
  rowCats: ['no', 'yes'], colCats: ['female', 'male'],
  counts: [[8, 10, 18], [12, 10, 22], [20, 20, 40]],
  p: 0.7508, is2x2: true, or: 0.6712, ciLow: 0.1612, ciHigh: 2.7344, n: 40, alpha: 0.05, tails: 'two.sided', nExcluded: 0, figurePng: png }

describe('buildFishersExact', () => {
  it('2×2 → OR + CI cells (V em-dash) and the APA add-on before the period', () => {
    const c = buildFishersExact(FISHERS_EXACT, base)
    expect(c.tables[1].rows).toEqual([{ p: '.751', or: '0.67', ci: '[0.16, 2.73]', v: '—' }])
    expect(c.apa).toBe("A Fisher's exact test of passed by gender gave p = .751 (OR=0.67, 95% CI [0.16, 2.73]).")
  })
  it('non-2×2 → em-dash OR/CI cells, Cramér V populated, base APA only', () => {
    const c = buildFishersExact(FISHERS_EXACT, { ...base, is2x2: false, or: undefined, ciLow: undefined, ciHigh: undefined, p: 0.0834, v: 0.1986, vLow: 0, vHigh: 1 })
    expect(c.tables[1].rows).toEqual([{ p: '.083', or: '—', ci: '—', v: '0.20 [0.00, 1.00]' }])
    expect(c.apa).toBe("A Fisher's exact test of passed by gender gave p = .083.")
  })
  it('non-2×2 with missing V → em-dash V cell (guard)', () => {
    const c = buildFishersExact(FISHERS_EXACT, { ...base, is2x2: false, or: undefined, ciLow: undefined, ciHigh: undefined, p: 0.0834, v: undefined, vLow: undefined, vHigh: undefined })
    expect(c.tables[1].rows).toEqual([{ p: '.083', or: '—', ci: '—', v: '—' }])
  })
  it("the odds-ratio column is labelled as the conditional MLE", () => {
    expect(FISHERS_EXACT.tables[1].columns.find((col) => col.key === 'or')!.label).toBe('Odds ratio (cond. MLE)')
    expect(FISHERS_EXACT.tables[1].columns.find((col) => col.key === 'v')!.label).toBe("Cramér's V [95% CI]")
  })
  it('contingency cells are plain counts with margins', () => {
    const c = buildFishersExact(FISHERS_EXACT, base)
    expect(c.tables[0].rows[0]).toEqual({ rowcat: 'no', c0: '8', c1: '10', total: '18' })
    expect(c.tables[0].rows[2]).toEqual({ rowcat: 'Total', c0: '20', c1: '20', total: '40' })
  })
})
