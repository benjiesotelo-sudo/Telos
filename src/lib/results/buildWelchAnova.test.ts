import { describe, it, expect } from 'vitest'
import { buildWelchAnova } from './buildWelchAnova'
import { WELCH_ANOVA as spec } from '../registry/welchAnova'
import type { WelchAnovaResult } from '../stats/welchAnova'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

// Spike known-answer result (native R 4.6.0, fixture outcome ~ group)
const spikeResult: WelchAnovaResult = {
  desc: [
    { group: 'control', n: 20, m: 31.42, sd: 5.23 },
    { group: 'drug_a', n: 20, m: 32.79, sd: 4.87 },
    { group: 'drug_b', n: 20, m: 35.12, sd: 6.01 },
  ],
  f: 2.57990466333335,
  df1: 2,
  df2: 37.9023295774865,
  p: 0.0890313047549131,
  posthoc: [
    { pair: 'control - drug_a', diff: -1.37, pAdj: 0.82, ciLo: -6.9179984409316, ciHi: 4.1779984409316 },
    { pair: 'control - drug_b', diff: -3.70, pAdj: 0.15, ciLo: -7.9, ciHi: 0.5 },
    { pair: 'drug_a - drug_b', diff: -2.33, pAdj: 0.45, ciLo: -5.86, ciHi: 1.2 },
  ],
  shapiro: [
    { group: 'control', W: 0.9668813597, p: 0.6881436515 },
    { group: 'drug_a', W: 0.9046305145, p: 0.0504050340 },
    { group: 'drug_b', W: 0.9228936756, p: 0.1126539309 },
  ],
  alpha: 0.05,
  nExcluded: 0,
  figurePng: png,
}

describe('buildWelchAnova', () => {
  const c = buildWelchAnova(spec, spikeResult)

  it('Table 1: descriptives rows (3 groups, N integer, M/SD at 2 dp)', () => {
    expect(c.tables[0].spec.id).toBe('descriptives')
    expect(c.tables[0].rows[0]).toMatchObject({ group: 'control', n: 20 })
    expect(c.tables[0].rows.length).toBe(3)
  })

  it("Table 2: Welch's ANOVA row — df2 renders '37.90' (fractional via fdf)", () => {
    expect(c.tables[1].spec.id).toBe('welch-anova')
    expect(c.tables[1].rows).toEqual([{ f: '2.58', df1: '2', df2: '37.90', p: '.089' }])
  })

  it('Table 3: Games-Howell post-hoc — NO SE column, pair/mdiff/padj/ci only', () => {
    expect(c.tables[2].spec.id).toBe('posthoc')
    expect(c.tables[2].spec.columns.map((col) => col.key)).toEqual(['pair', 'mdiff', 'padj', 'ci'])
    const row = c.tables[2].rows[0]
    expect(row.pair).toBe('control - drug_a')
    expect(row.mdiff).toBe('−1.37')
    expect(row.padj).toBe('.820')
    expect(row.ci).toBe('[−6.92, 4.18]')
  })

  it('APA string: neutral verb, p spaced (p ≥ .001 branch)', () => {
    expect(c.apa).toBe("Welch's ANOVA gave F(2,37.90)=2.58, p = .089.")
  })

  it('p<.001 branch renders correctly', () => {
    const c2 = buildWelchAnova(spec, { ...spikeResult, p: 0.0004 })
    expect(c2.apa).toContain('p < .001')
  })

  it('note is an assume-note: static tableNote + per-group Shapiro-Wilk W/p (em-dash NA via fx)', () => {
    expect(c.note).toEqual({
      kind: 'assume',
      text: "Welch's adjusts the degrees of freedom so equal variances are not assumed (df2 is fractional); within-group normality is still assumed and checked with Shapiro-Wilk per group. (Shapiro per group: control W=0.97, p=.688; drug_a W=0.90, p=.050; drug_b W=0.92, p=.113)",
    })
  })

  it('Shapiro per-group NA renders as em-dash via fx (W/p null → —)', () => {
    const c2 = buildWelchAnova(spec, { ...spikeResult, shapiro: [{ group: 'tiny', W: null, p: null }] })
    expect(c2.note!.text).toContain('tiny W=—, p=—')
  })

  it('figure carries caption, type, and png bytes', () => {
    expect(c.figures).toEqual([{ caption: 'Group means', type: 'means plot with 95% CI error bars', file: 'means-plot', png }])
  })

  it('nExcluded passthrough', () => {
    expect(c.nExcluded).toBe(0)
  })
})
