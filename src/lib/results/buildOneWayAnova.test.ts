import { describe, it, expect } from 'vitest'
import { buildOneWayAnova } from './buildOneWayAnova'
import { ONE_WAY_ANOVA as spec } from '../registry/oneWayAnova'
import type { OneWayAnovaResult } from '../stats/oneWayAnova'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

// Spike ground-truth numbers (F=2.805, dfB=2, dfW=57, p=.069, eta2=0.0896)
const spikeResult: OneWayAnovaResult = {
  desc: [
    { group: 'control', n: 20, m: 30.695, sd: 7.23 },
    { group: 'drug_a', n: 20, m: 32.065, sd: 7.51 },
    { group: 'drug_b', n: 20, m: 35.235, sd: 6.98 },
  ],
  ssB: 260.683333333333, dfB: 2, msB: 130.341666666667,
  f: 2.80500665877123, p: 0.0688787403297547, eta2: 0.0896024935993843,
  ssW: 2648.49, dfW: 57, msW: 46.464736842105,
  levene: { F: 0.0224210736545674, p: 0.977837029926746 },
  shapiro: { W: 0.98765, p: 0.12345 },
  posthoc: [
    { pair: 'control - drug_a', diff: -1.37, se: 2.33956998597995, pAdj: 0.828376280197589, ciLo: -6.99998369176902, ciHi: 4.25998369176902 },
    { pair: 'control - drug_b', diff: -4.54, se: 2.33956998597995, pAdj: 0.151, ciLo: -10.17, ciHi: 1.09 },
    { pair: 'drug_a - drug_b', diff: -3.17, se: 2.33956998597995, pAdj: 0.371, ciLo: -8.80, ciHi: 2.46 },
  ],
  posthocMethod: 'Tukey HSD',
  ciLevel: 0.95,
  alpha: 0.05,
  nExcluded: 0,
  figurePng: png,
}

describe('buildOneWayAnova (pure, no engine)', () => {
  const c = buildOneWayAnova(spec, spikeResult)

  it('Table 1: descriptives by group', () => {
    expect(c.tables[0].spec.id).toBe('descriptives')
    expect(c.tables[0].rows).toHaveLength(3)
    expect(c.tables[0].rows[0].group).toBe('control')
    expect(c.tables[0].rows[0].n).toBe(20)
  })

  it('Table 2: ANOVA rows — Between has F and eta2; Within has empty f/p/eta2', () => {
    expect(c.tables[1].spec.id).toBe('anova')
    const between = c.tables[1].rows[0]
    expect(between.source).toBe('Between')
    expect(between.df).toBe('2')
    expect(between.f).toBe('2.81')
    expect(between.p).toBe('.069')
    expect(between.eta2).toBe('0.09')
    const within = c.tables[1].rows[1]
    expect(within.source).toBe('Within')
    expect(within.f).toBe('')
    expect(within.p).toBe('')
    expect(within.eta2).toBe('')
  })

  it('Table 3: posthoc renders control-drug_a with ci [−7.00, 4.26]', () => {
    expect(c.tables[2].spec.id).toBe('posthoc')
    const row = c.tables[2].rows.find((r) => r.pair === 'control - drug_a')!
    expect(row).toBeDefined()
    expect(row.ci).toBe('[−7.00, 4.26]')
  })

  it('APA string has spike numbers: neutral verb, selection-aware posthoc, no leading zero on eta2', () => {
    expect(c.apa).toBe('A one-way ANOVA gave F(2,57)=2.81, p = .069, η²=.09. Tukey HSD post-hoc tests showed…')
  })

  it('APA p-clause flips to p < .001 when p is tiny', () => {
    const c2 = buildOneWayAnova(spec, { ...spikeResult, p: 0.0004 })
    expect(c2.apa).toContain('p < .001')
  })

  it('APA interpolates Bonferroni when posthocMethod is Bonferroni', () => {
    const c3 = buildOneWayAnova(spec, { ...spikeResult, posthocMethod: 'Bonferroni' })
    expect(c3.apa).toContain('Bonferroni post-hoc tests showed')
  })

  it('note is assume kind with Levene + Shapiro appended; no warning when Levene p > .05', () => {
    expect(c.note!.kind).toBe('assume')
    expect(c.note!.text).toContain("assumption checks: Levene's (equal variances) & normality of residuals.")
    expect(c.note!.text).toContain('Levene F=0.02')
    expect(c.note!.text).not.toContain("Welch's ANOVA") // levene p = 0.978, not significant
  })

  it('note includes Welch suggestion when Levene p < .05', () => {
    const c3 = buildOneWayAnova(spec, { ...spikeResult, levene: { F: 4.5, p: 0.01 } })
    expect(c3.note!.text).toContain("consider Welch's ANOVA")
  })

  it('figures carries the means-plot figure', () => {
    expect(c.figures).toEqual([{ caption: 'Group means', type: 'means plot with 95% CI error bars', file: 'means-plot', png }])
  })

  it('nExcluded is 0', () => {
    expect(c.nExcluded).toBe(0)
  })
})
