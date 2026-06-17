import { describe, it, expect } from 'vitest'
import { buildRdd } from './buildRdd'
import { RDD } from '../registry/rdd'
import type { RddResult } from '../stats/rdd'

const mock = (over: Partial<RddResult> = {}): RddResult => ({
  estimate: 9.897029, se: 0.2058503, z: 47.9908, p: 1e-9, ciLow: 9.475461, ciHigh: 10.28238,
  bandwidth: 8.659617, nLeft: 18, nRight: 16, cutoff: 50, polyOrder: 1,
  bwSelect: 'mserd', kernel: 'Triangular',
  mccrary: { t: 0.07806802, p: 0.9377739 },
  ciLevel: 0.95, alpha: 0.05, nObs: 200, nExcluded: 0,
  figRdPng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
  ...over,
})

describe('buildRdd', () => {
  // modelsummary coef table: one term row → estimate / (SE) / [CI] stacked; z/p drop from the visible cell.
  it('stacks the single RD treatment effect as estimate / (SE) / [CI] (no z/p in the cell)', () => {
    const rows = buildRdd(RDD, mock()).tables[0].rows
    expect(rows.slice(0, 3)).toEqual([
      { _kind: 'coef', term: 'RD treatment effect', est: '9.90' },
      { _kind: 'se', term: '', est: '(0.21)' },
      { _kind: 'ci', term: '', est: '[9.48, 10.28]' },
    ])
    const cells = JSON.stringify(rows)
    expect(cells).not.toContain('47.99') // z dropped from the visible table
  })
  it('a rule then the GOF footer = Bandwidth + N (left) + N (right) (no R²/AIC/etc — rdrobust has no method)', () => {
    const rows = buildRdd(RDD, mock()).tables[0].rows
    expect(rows.slice(3)).toEqual([
      { _kind: 'rule' },
      { _kind: 'gof', term: 'Bandwidth', est: '8.66' },
      { _kind: 'gof', term: 'N (left)', est: '18' },
      { _kind: 'gof', term: 'N (right)', est: '16' },
    ])
  })
  it('APA reports the estimate at the cutoff with literal 95% CI (report-only)', () => {
    expect(buildRdd(RDD, mock()).apa).toBe('At the cutoff, the treatment effect was 9.90, 95% CI [9.48, 10.28], p < .001.')
  })
  it('note carries the robust inference + bandwidth-selector/kernel labels (static prefix from the spec)', () => {
    const note = buildRdd(RDD, mock()).note!
    expect(note.kind).toBe(RDD.tableNote!.kind)
    expect(note.text).toContain(RDD.tableNote!.text)
    expect(RDD.tableNote!.text).toContain('robust')
    expect(RDD.tableNote!.text).toContain('mserd')
    expect(RDD.tableNote!.text).toContain('triangular')
  })
  it('note surfaces the live cutoff value', () => {
    expect(buildRdd(RDD, mock()).note!.text).toContain('Cutoff = 50.00')
    expect(buildRdd(RDD, mock({ cutoff: 0 })).note!.text).toContain('Cutoff = 0.00')
  })
  it('note adds the McCrary density manipulation test (jackknife-robust t/p) cited per McCrary', () => {
    const text = buildRdd(RDD, mock()).note!.text
    expect(text).toContain('McCrary density manipulation test: t = 0.08, p = .938')
    expect(text).toContain('(McCrary, 2008)')
  })
  it('McCrary NA → em-dash (guarded null)', () => {
    const text = buildRdd(RDD, mock({ mccrary: { t: null, p: null } })).note!.text
    expect(text).toContain('McCrary density manipulation test: t = —, p = —')
  })
  it('howToRead is taken verbatim from the spec (no α threading)', () => {
    const c = buildRdd(RDD, mock())
    expect(c.howToRead).toBe(RDD.howToRead)
    expect(c.howToRead).not.toContain('significance threshold')
  })
})
