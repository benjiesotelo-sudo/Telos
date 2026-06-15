import { describe, it, expect } from 'vitest'
import { buildHausmanTest } from './buildHausmanTest'
import { HAUSMAN_TEST } from '../registry/hausmanTest'
import type { HausmanResult } from '../stats/hausmanTest'

const mock = (over: Partial<HausmanResult> = {}): HausmanResult => ({
  chisq: 3.071622, df: 3, p: 0.380714,
  compareRows: [
    { term: 'leverage', feB: -5.574297, reB: -4.053601, diff: -1.520696 },
    { term: 'rd_spend', feB: 1.888007, reB: 0.547641, diff: 1.340366 },
    { term: 'size', feB: 0.140074, reB: 0.956744, diff: -0.81667 },
  ],
  alpha: 0.05, nObs: 96, nEntities: 12, nExcluded: 0,
  figCoefPng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
  ...over,
})

describe('buildHausmanTest', () => {
  it('Decision is computed from p vs α — non-significant p → RE', () => {
    expect(buildHausmanTest(HAUSMAN_TEST, mock()).tables[0].rows[0]).toEqual({ chisq: '3.07', df: '3', p: '.381', decision: 'RE' })
  })
  it('Decision flips to FE when p < α', () => {
    expect(buildHausmanTest(HAUSMAN_TEST, mock({ p: 0.012 })).tables[0].rows[0].decision).toBe('FE')
  })
  it('FE vs RE comparison rows', () => {
    expect(buildHausmanTest(HAUSMAN_TEST, mock()).tables[1].rows[0]).toEqual({ term: 'leverage', feB: '−5.57', reB: '−4.05', diff: '−1.52' })
  })
  it('APA is neutralised — reports the statistic, no "favoured" verdict', () => {
    const apa = buildHausmanTest(HAUSMAN_TEST, mock()).apa
    expect(apa).toBe('A Hausman test comparing the fixed- and random-effects estimates gave χ²(3)=3.07, p = .381.')
    expect(apa).not.toContain('favoured')
  })
})
