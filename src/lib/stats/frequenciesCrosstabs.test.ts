import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runFrequenciesCrosstabs } from './frequenciesCrosstabs'
import type { Dataset } from './types'

// The spike's region6/gender6 fixture: counts east 1 / north 2 / south 3; gender f=3, m=3.
// Rows deliberately NOT alphabetical — janitor::tabyl must emit east, north, south (spike fact 4).
const region6: Dataset = { columns: ['region', 'gender'], rows: [
  { region: 'north', gender: 'f' }, { region: 'south', gender: 'f' }, { region: 'east', gender: 'm' },
  { region: 'south', gender: 'm' }, { region: 'north', gender: 'm' }, { region: 'south', gender: 'f' },
] }
// Missing-data fixture: present-category counting is per the USED columns only.
const messy: Dataset = { columns: ['region', 'gender'], rows: [
  ...region6.rows,
  { region: null, gender: 'f' },     // region missing → excluded from every run that uses region
  { region: 'south', gender: null }, // gender missing → excluded ONLY when gender is used
] }

describe('runFrequenciesCrosstabs', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('one variable → alphabetical rows, Valid%/Total% split (equal w/o missing), cumulative valid %, bar PNG', async () => {
    const r = await runFrequenciesCrosstabs(engine, region6, ['region'])
    expect(r.kind).toBe('one')
    expect(r.freq!.map((x) => x.category)).toEqual(['east', 'north', 'south']) // tabyl alphabetical, NOT first-appearance
    expect(r.freq!.map((x) => x.n)).toEqual([1, 2, 3])
    // No missing → Valid% == Total%
    expect(r.freq![0].validPct).toBeCloseTo(16.667, 2)
    expect(r.freq![1].validPct).toBeCloseTo(33.333, 2)
    expect(r.freq![2].validPct).toBeCloseTo(50, 2)
    expect(r.freq![0].totalPct).toBeCloseTo(16.667, 2)
    expect(r.freq![1].totalPct).toBeCloseTo(33.333, 2)
    expect(r.freq![2].totalPct).toBeCloseTo(50, 2)
    expect(r.freq![0].cumValidPct).toBeCloseTo(16.667, 2)
    expect(r.freq![1].cumValidPct).toBeCloseTo(50, 2)
    expect(r.freq![2].cumValidPct).toBeCloseTo(100, 2)
    expect(r.nValid).toBe(6)
    expect(r.nTotal).toBe(6)
    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('two variables → adorned cross-tab: counts incl. totals, row %, col %, grouped-bar PNG', async () => {
    const r = await runFrequenciesCrosstabs(engine, region6, ['region', 'gender'])
    const ct = r.crosstab!
    expect(ct.rowCats).toEqual(['east', 'north', 'south'])
    expect(ct.colCats).toEqual(['f', 'm'])
    expect(ct.counts).toEqual([[0, 1, 1], [1, 1, 2], [2, 1, 3], [3, 3, 6]]) // rows east/north/south/Total × cols f/m/Total
    expect(ct.rowPct[0][1]).toBeCloseTo(100, 2)    // east,m row%
    expect(ct.rowPct[1][0]).toBeCloseTo(50, 2)     // north,f row%
    expect(ct.rowPct[2][0]).toBeCloseTo(66.667, 2) // south,f row%
    expect(ct.rowPct[3][0]).toBeCloseTo(50, 2)     // Total row row% (spike: 0.5/0.5)
    expect(ct.colPct[0][1]).toBeCloseTo(33.333, 2) // east,m col%
    expect(ct.colPct[2][0]).toBeCloseTo(66.667, 2) // south,f col%
    expect(ct.colPct[0][2]).toBeCloseTo(16.667, 2) // Total-col col% = total% marginal (spike)
    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('missing data counts per USED columns: a gender-missing row still counts for region-only', async () => {
    const one = await runFrequenciesCrosstabs(engine, messy, ['region'])
    expect(one.nExcluded).toBe(1)                        // only the null-region row drops
    expect(one.freq!.map((x) => x.n)).toEqual([1, 2, 4]) // the gender-missing south row IS counted
    const two = await runFrequenciesCrosstabs(engine, messy, ['region', 'gender'])
    expect(two.nExcluded).toBe(2)                        // both rows drop; cells return to the verified table
    expect(two.crosstab!.counts).toEqual([[0, 1, 1], [1, 1, 2], [2, 1, 3], [3, 3, 6]])
  })

  it('missing data → Valid% (over nValid 7) ≠ Total% (over nTotal 8); cum valid % runs to 100 (native-R)', async () => {
    const r = await runFrequenciesCrosstabs(engine, messy, ['region'])
    expect(r.nTotal).toBe(8)
    expect(r.nValid).toBe(7)
    expect(r.nExcluded).toBe(1)
    expect(r.freq!.map((x) => x.category)).toEqual(['east', 'north', 'south'])
    expect(r.freq!.map((x) => x.n)).toEqual([1, 2, 4])
    // Valid % = n / 7 · 100 (native-R janitor::tabyl on the present rows)
    expect(r.freq![0].validPct).toBeCloseTo(14.2857, 3)
    expect(r.freq![1].validPct).toBeCloseTo(28.5714, 3)
    expect(r.freq![2].validPct).toBeCloseTo(57.1429, 3)
    // Total % = n / 8 · 100 (grand total incl. the 1 missing)
    expect(r.freq![0].totalPct).toBeCloseTo(12.5, 3)
    expect(r.freq![1].totalPct).toBeCloseTo(25, 3)
    expect(r.freq![2].totalPct).toBeCloseTo(50, 3)
    // Cumulative valid % runs to 100 over the valid n
    expect(r.freq![0].cumValidPct).toBeCloseTo(14.2857, 3)
    expect(r.freq![1].cumValidPct).toBeCloseTo(42.8571, 3)
    expect(r.freq![2].cumValidPct).toBeCloseTo(100, 3)
  })
})
