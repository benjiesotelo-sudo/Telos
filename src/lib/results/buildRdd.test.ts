import { describe, it, expect } from 'vitest'
import { buildRdd } from './buildRdd'
import { RDD } from '../registry/rdd'
import type { RddResult } from '../stats/rdd'

const mock = (over: Partial<RddResult> = {}): RddResult => ({
  estimate: 9.897029, se: 0.2058503, z: 47.9908, p: 1e-9, ciLow: 9.475461, ciHigh: 10.28238,
  bandwidth: 8.659617, nLeft: 18, nRight: 16, cutoff: 50, polyOrder: 1,
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
  it('note carries the robust bias-corrected inference labeling', () => {
    expect(buildRdd(RDD, mock()).note).toEqual(RDD.tableNote)
    expect(RDD.tableNote!.text).toContain('robust')
  })
  it('howToRead is taken verbatim from the spec (no α threading)', () => {
    const c = buildRdd(RDD, mock())
    expect(c.howToRead).toBe(RDD.howToRead)
    expect(c.howToRead).not.toContain('significance threshold')
  })
})
