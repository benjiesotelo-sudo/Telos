import { describe, it, expect } from 'vitest'
import { buildAncova } from './buildAncova'
import { ANCOVA as spec } from '../registry/ancova'
import type { AncovaResult } from '../stats/ancova'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

// Spike numbers from plan known answers (native R 4.6.0, outcome ~ baseline + group)
const spikeResult: AncovaResult = {
  rows: [
    { source: 'baseline', ss: 3012.5, df: 1, ms: 3012.5, f: 72.2282718865225, p: 1.17661542618733e-11, pes: 0.563278837216507 },
    { source: 'group',    ss: 672.89,  df: 2, ms: 336.45, f: 8.0678942699764,  p: 0.000833763379568619, pes: 0.223686312530096 },
  ],
  dfRes: 56,
  adjusted: [
    { group: 'control', mean: 31.4221627207434, se: 1.10991244962393, ciLo: 29.1987409073006, ciHi: 33.6455845341862 },
    { group: 'drug_a',  mean: 35.0220540467426, se: 1.10991244962393, ciLo: 32.7986322332998, ciHi: 37.2454758601854 },
    { group: 'drug_b',  mean: 31.8557832325141, se: 1.10991244962393, ciLo: 29.6323614190712, ciHi: 34.0792050459569 },
  ],
  posthoc: [
    { pair: 'control - drug_a', diff: -3.59989132599919, se: 1.58175880993269, pAdj: 0.0675916797250294, ciLo: -7.40807585588051, ciHi: 0.208293203882136 },
    { pair: 'control - drug_b', diff: -0.43362051177068, se: 1.58175880993269, pAdj: 0.9601543,          ciLo: -4.24180504165200, ciHi: 3.37456401811064 },
    { pair: 'drug_a - drug_b',  diff:  3.16627081422851, se: 1.58175880993269, pAdj: 0.1176,             ciLo: -0.64191371565281, ciHi: 6.97445534450983 },
  ],
  slopes: [{ term: 'baseline × group', p: 0.875021940147328 }],
  levene: { F: 0.512, p: 0.602 },
  ciLevel: 0.95,
  alpha: 0.05,
  nExcluded: 0,
  figurePng: png,
}

describe('buildAncova', () => {
  const c = buildAncova(spec, spikeResult)

  it('Table 1 (adjusted means): first row is control with formatted values', () => {
    expect(c.tables[0].spec.id).toBe('adjusted-means')
    expect(c.tables[0].rows[0]).toEqual({
      group: 'control',
      adjm: '31.42',
      se: '1.11',
      ci: '[29.20, 33.65]',
    })
  })

  it('Table 2 (ANCOVA): two rows — covariate + factor; correct formatting', () => {
    expect(c.tables[1].spec.id).toBe('ancova')
    const covRow = c.tables[1].rows[0]
    const factorRow = c.tables[1].rows[1]
    expect(covRow.source).toBe('baseline')
    expect(covRow.f).toBe('72.23')
    expect(covRow.pes).toBe('0.56')
    expect(factorRow.source).toBe('group')
    expect(factorRow.df).toBe('2')
    expect(factorRow.f).toBe('8.07')
    expect(factorRow.p).toBe('<.001')
    expect(factorRow.pes).toBe('0.22')
  })

  it('Table 3 (posthoc): first row is control - drug_a with adjusted M_diff', () => {
    expect(c.tables[2].spec.id).toBe('posthoc')
    expect(c.tables[2].rows[0]).toMatchObject({
      pair: 'control - drug_a',
      mdiff: '−3.60',
      se: '1.58',
    })
  })

  it('APA string: factor row F(2,56)=8.07, p < .001, partial η²=.22', () => {
    expect(c.apa).toBe(
      'Controlling for the covariate, an ANCOVA gave F(2,56)=8.07, p < .001, partial η²=.22.'
    )
  })

  it('note: assume kind with card text + slopes clause + Levene clause + afterTableId', () => {
    expect(c.note!.kind).toBe('assume')
    expect(c.note!.text).toContain("assumption checks: homogeneity of regression slopes (factor×covariate interaction) & Levene's; post-hoc on adjusted means.")
    expect(c.note!.text).toContain('slopes p(baseline × group)=.875')
    expect(c.note!.text).toContain('Levene F=0.51')
    expect(c.note!.afterTableId).toBe('ancova')
  })

  it('figure: adjusted means type + png', () => {
    expect(c.figures).toEqual([{ caption: 'Adjusted means', type: 'adjusted means plot (covariate-controlled, ± CI)', file: 'adjusted-means', png }])
  })

  it('nExcluded is 0', () => {
    expect(c.nExcluded).toBe(0)
  })
})
