import { describe, it, expect } from 'vitest'
import { buildMancova } from './buildMancova'
import { MANCOVA as spec } from '../registry/mancova'
import type { MancovaResult } from '../stats/mancova'
import { f, fdf, fpApa } from '../format/apa'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

// Spike numbers: outcome+outcome2 ~ baseline + group (Pillai)
const spikeResult: MancovaResult = {
  multivariate: [
    // covariate row
    { effect: 'baseline', stat: 0.55, f: 20.0, df1: 2, df2: 114, p: 0.00001,
      pillai: 0.55, pillaiF: 20.0, pillaiDf1: 2, pillaiDf2: 114, pillaiP: 0.00001,
      mpes: 0.2597402597, mpesLow: 0.1469755457, mpesHigh: 1 },
    // factor row — spike values
    { effect: 'group', stat: 0.367525003974141, f: 6.30374133529023, df1: 4, df2: 112,
      p: 0.000130150921618041,
      pillai: 0.367525003974141, pillaiF: 6.30374133529023,
      pillaiDf1: 4, pillaiDf2: 112, pillaiP: 0.000130150921618041,
      mpes: 0.183762502, mpesLow: 0.06867047272, mpesHigh: 1 }, // effectsize::F_to_eta2(F,df1,df2,ci=0.95) — native R verified (see mancova.test.ts)
  ],
  followups: [
    { dv: 'outcome', f: 8.0678942699764, df1: 2, df2: 56, p: 0.000833763379568619,
      pes: 0.223686312530096, pesLow: 0.0704829854754854, pesHigh: 1 },
    { dv: 'outcome2', f: 7.47387842662194, df1: 2, df2: 56, p: 0.00132733951909915,
      pes: 0.210686814019553, pesLow: 0.0610394181580081, pesHigh: 1 },
  ],
  slopes: [{ term: 'baseline × group', p: 0.875021940147328 }],
  boxM: { chisq: 11.4375273234805, df: 6, p: 0.0757594643401961 },
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
      effect: 'group', stat: '0.37', f: '6.30', df1: '4', df2: '112', p: '<.001', mpes: '0.18 [0.07, 1.00]',
    })
    expect(c.tables[0].rows[0].effect).toBe('baseline')
  })

  it('Table 2 follow-up rows: dv / f / df1 / df2 / p / pes (with one-sided CI) formatted', () => {
    expect(c.tables[1].spec.id).toBe('univariate-followups')
    expect(c.tables[1].rows[0]).toEqual({
      dv: 'outcome', f: '8.07', df1: '2', df2: '56', p: '<.001', pes: '0.22 [0.07, 1.00]',
    })
    expect(c.tables[1].rows[1]).toEqual({
      dv: 'outcome2', f: '7.47', df1: '2', df2: '56', p: '.001', pes: '0.21 [0.06, 1.00]',
    })
  })

  it('APA from selected stat (Pillai): V=.37, F(4,112)=6.30, p < .001, partial η² with its one-sided CI', () => {
    expect(c.apa).toBe(
      "A MANCOVA gave a covariate-adjusted group effect, Pillai's V=.37, F(4,112)=6.30, p < .001, partial η²=.18 [.07, 1.00].",
    )
  })

  it('note carries card assume text plus Box M and slopes p clause + plain-language verdicts (audit V: Box p=.076 met, slopes p=.875 met)', () => {
    expect(c.note!.kind).toBe('assume')
    expect(c.note!.text).toContain("assumption checks include homogeneity of covariance matrices (Box's M) and homogeneity of regression slopes for each covariate.")
    expect(c.note!.text).toContain("Box's M χ²(6)=11.44, p=.076")
    expect(c.note!.text).toContain('slopes p(baseline × group)=.875')
    expect(c.note!.text).toContain('covariance matrices look homogeneous')
    expect(c.note!.text).toContain('the regression slopes look homogeneous across groups')
  })

  it('Box M NA (null fields) renders em-dashes in the assume note; no Box-M verdict when nothing to judge', () => {
    const naResult: MancovaResult = { ...spikeResult, boxM: { chisq: null, df: null, p: null } }
    const cNa = buildMancova(spec, naResult)
    expect(cNa.note!.text).toContain("Box's M χ²(—)=—, p=—")
  })

  it('audit V: flags violated verdicts when Box M / slopes cross alpha', () => {
    const violated: MancovaResult = { ...spikeResult, boxM: { chisq: 30, df: 6, p: 0.001 }, slopes: [{ term: 'baseline × group', p: 0.01 }] }
    const cV = buildMancova(spec, violated)
    expect(cV.note!.text).toContain("covariance matrices look heterogeneous; interpret with extra caution (Pillai's trace is comparatively robust to this violation)")
    expect(cV.note!.text).toContain("at least one covariate's slope differs across groups; the covariate adjustment may not be valid")
  })

  it('figure caption and type match spec', () => {
    expect(c.figures[0]).toEqual({ caption: 'Adjusted means per outcome', type: 'adjusted means plot faceted by DV', file: 'adjusted-means', png })
  })

  it('nExcluded passes through', () => {
    expect(c.nExcluded).toBe(0)
  })

  it('values: keyed for the term-led explainers, headline = the last (factor) multivariate row', () => {
    const factorRow = spikeResult.multivariate[1] // 'group' — the last row (formula: covs + factors)
    expect(c.values).toEqual({
      effect: factorRow.effect, stat: f(factorRow.stat), statLabel: "Pillai's V",
      f: f(factorRow.f), df1: fdf(factorRow.df1), df2: fdf(factorRow.df2),
      p: fpApa(factorRow.p), pSig: 'below', alpha: '0.05',
      mpes: '.18', mpesLow: '.07', mpesHigh: '1.00',
      nDVs: '2',
    })
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
