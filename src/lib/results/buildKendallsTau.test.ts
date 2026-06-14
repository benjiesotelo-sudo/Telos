import { describe, it, expect } from 'vitest'
import { buildKendallsTau } from './buildKendallsTau'
import { KENDALLS_TAU } from '../registry/kendallsTau'
import type { KendallsTauResult } from '../stats/kendallsTau'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const res: KendallsTauResult = { varA: 'satisfaction', varB: 'motivation',
  tau: 0.512, z: 3.456, p: 0.00055, n: 40, nExcluded: 0, figurePng: png }

describe('buildKendallsTau', () => {
  it('fills the correlation row per format conventions', () => {
    const c = buildKendallsTau(KENDALLS_TAU, res)
    expect(c.tables[0].rows).toEqual([{ pair: 'satisfaction – motivation', tau: '0.51', z: '3.46', p: '<.001', n: 40 }])
    expect(c.note).toBeNull()
    expect(c.figures[0].file).toBe('scatter')
  })
  it('APA is a full sentence mirroring Spearman; tiny p becomes p<.001', () => {
    const c = buildKendallsTau(KENDALLS_TAU, res)
    expect(c.apa).toBe("A Kendall's tau correlation gave τ=.51, p < .001, N=40.")
  })
})
