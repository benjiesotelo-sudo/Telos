import { describe, it, expect } from 'vitest'
import { buildSpearman } from './buildSpearman'
import { SPEARMAN } from '../registry/spearman'
import type { SpearmanResult } from '../stats/spearman'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const res: SpearmanResult = { varA: 'satisfaction', varB: 'motivation',
  rho: 0.7321, rhoLow: 0.5942, rhoHigh: 0.8503, s: 2854.4, p: 0.00321, n: 40, alpha: 0.05, tails: 'two.sided', nExcluded: 1, figurePng: png }

describe('buildSpearman', () => {
  it('fills the row; ρ carries its bootstrap CI; S uses fdf (integers bare, ties give decimals)', () => {
    const c = buildSpearman(SPEARMAN, res)
    expect(c.tables[0].rows).toEqual([{ pair: 'satisfaction – motivation', rho: '0.73 [0.59, 0.85]', s: '2854.40', p: '.003', n: 40 }])
    expect(c.note).toEqual(SPEARMAN.tableNote)
    expect(c.nExcluded).toBe(1)
  })
  it('APA line — ρ carries its bootstrap CI', () => {
    expect(buildSpearman(SPEARMAN, res).apa).toBe('A Spearman correlation gave ρ=.73 [.59, .85], p = .003, N=40.')
  })
})
