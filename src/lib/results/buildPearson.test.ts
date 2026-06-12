import { describe, it, expect } from 'vitest'
import { buildPearson } from './buildPearson'
import { PEARSON } from '../registry/pearson'
import type { PearsonResult } from '../stats/pearson'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const res: PearsonResult = { varA: 'hours_studied', varB: 'exam_score',
  r: 0.61234, t: 4.7789, df: 38, p: 0.0000271, ciLow: 0.3712, ciHigh: 0.7741, n: 40, nExcluded: 0, figurePng: png }

describe('buildPearson', () => {
  it('fills the correlation row per format conventions', () => {
    const c = buildPearson(PEARSON, res)
    expect(c.tables[0].rows).toEqual([{ pair: 'hours_studied – exam_score', r: '0.61', ci: '[0.37, 0.77]', t: '4.78', df: '38', p: '<.001', n: 40 }])
    expect(c.note).toBeNull()
    expect(c.figures[0].file).toBe('scatter')
  })
  it('APA substitutes names + values; tiny p becomes p<.001', () => {
    const c = buildPearson(PEARSON, res)
    expect(c.apa).toBe('hours_studied and exam_score were correlated, r(38)=0.61, p<.001, 95% CI [0.37, 0.77].')
  })
})
