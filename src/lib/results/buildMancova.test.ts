import { describe, it, expect } from 'vitest'
import { buildMancova } from './buildMancova'
import { MANCOVA as spec } from '../registry/mancova'
import type { MancovaResult } from '../stats/mancova'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

// Spike numbers: outcome+outcome2 ~ baseline + group (Pillai)
const spikeResult: MancovaResult = {
  multivariate: [
    // covariate row
    { effect: 'baseline', stat: 0.55, f: 20.0, df1: 2, df2: 114, p: 0.00001,
      pillai: 0.55, pillaiF: 20.0, pillaiDf1: 2, pillaiDf2: 114, pillaiP: 0.00001 },
    // factor row — spike values
    { effect: 'group', stat: 0.367525003974141, f: 6.30374133529023, df1: 4, df2: 112,
      p: 0.000130150921618041,
      pillai: 0.367525003974141, pillaiF: 6.30374133529023,
      pillaiDf1: 4, pillaiDf2: 112, pillaiP: 0.000130150921618041 },
  ],
  followups: [
    { dv: 'outcome', f: 8.0678942699764, df1: 2, df2: 56, p: 0.000833763379568619, pes: 0.223686312530096 },
    { dv: 'outcome2', f: 7.47387842662194, df1: 2, df2: 56, p: 0.00132733951909915, pes: 0.21 },
  ],
  slopes: [{ term: 'baseline × group', p: 0.875021940147328 }],
  statistic: 'Pillai',
  alpha: 0.05,
  nExcluded: 0,
  figurePng: png,
}

describe('buildMancova', () => {
  const c = buildMancova(spec, spikeResult)

  it('Table 1 multivariate rows: effect / stat / f / df1 / df2 / p formatted', () => {
    expect(c.tables[0].spec.id).toBe('multivariate')
    expect(c.tables[0].rows).toHaveLength(2)
    expect(c.tables[0].rows[1]).toEqual({
      effect: 'group', stat: '0.37', f: '6.30', df1: '4', df2: '112', p: '<.001',
    })
    expect(c.tables[0].rows[0].effect).toBe('baseline')
  })

  it('Table 2 follow-up rows: dv / f / df1 / df2 / p / pes formatted', () => {
    expect(c.tables[1].spec.id).toBe('univariate-followups')
    expect(c.tables[1].rows[0]).toEqual({
      dv: 'outcome', f: '8.07', df1: '2', df2: '56', p: '<.001', pes: '0.22',
    })
    expect(c.tables[1].rows[1].dv).toBe('outcome2')
  })

  it('APA from selected stat (Pillai): V=.37, F(4,112)=6.30, p < .001', () => {
    expect(c.apa).toBe(
      "A MANCOVA gave a covariate-adjusted group effect, Pillai's V=.37, F(4,112)=6.30, p < .001.",
    )
  })

  it('note carries card assume text plus slopes p clause', () => {
    expect(c.note!.kind).toBe('assume')
    expect(c.note!.text).toContain('assumption checks include homogeneity of regression slopes for each covariate.')
    expect(c.note!.text).toContain('slopes p(baseline × group)=.875')
  })

  it('figure caption and type match spec', () => {
    expect(c.figures[0]).toEqual({ caption: 'Adjusted means per outcome', type: 'adjusted means plot faceted by DV', file: 'adjusted-means', png })
  })

  it('nExcluded passes through', () => {
    expect(c.nExcluded).toBe(0)
  })

  it('Wilks-selected result: APA uses Wilks label and selected stat values (owner ruling)', () => {
    const wilksResult: MancovaResult = {
      ...spikeResult,
      statistic: 'Wilks',
      multivariate: [
        spikeResult.multivariate[0],
        { ...spikeResult.multivariate[1], stat: 0.634151614316368, f: 5.80, p: 0.000130150921618041 },
      ],
    }
    const c2 = buildMancova(spec, wilksResult)
    expect(c2.apa).toContain("Wilks' Λ=.63")
    expect(c2.apa).toContain('F(4,112)=5.80')
  })

  it('p≥.001 branch formats p properly', () => {
    const marginal: MancovaResult = {
      ...spikeResult,
      multivariate: [
        spikeResult.multivariate[0],
        { ...spikeResult.multivariate[1], p: 0.0456789 },
      ],
    }
    const c3 = buildMancova(spec, marginal)
    expect(c3.apa).toContain('p = .046')
  })
})
