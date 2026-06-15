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
  it('single RD-estimate row with bandwidth, estimate, robust inference, N(left/right)', () => {
    expect(buildRdd(RDD, mock()).tables[0].rows[0]).toEqual({
      bandwidth: '8.66', estimate: '9.90', se: '0.21', z: '47.99', p: '<.001', ci: '[9.48, 10.28]', n: '18 / 16',
    })
  })
  it('APA reports the estimate at the cutoff with literal 95% CI (report-only)', () => {
    expect(buildRdd(RDD, mock()).apa).toBe('At the cutoff, the treatment effect was 9.90, 95% CI [9.48, 10.28], p < .001.')
  })
  it('note is null (no drawn table note)', () => {
    expect(buildRdd(RDD, mock()).note).toBeNull()
  })
  it('howToRead is taken verbatim from the spec (no α threading)', () => {
    const c = buildRdd(RDD, mock())
    expect(c.howToRead).toBe(RDD.howToRead)
    expect(c.howToRead).not.toContain('significance threshold')
  })
})
