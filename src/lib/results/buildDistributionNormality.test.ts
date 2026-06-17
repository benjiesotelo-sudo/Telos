import { describe, it, expect } from 'vitest'
import { buildDistributionNormality } from './buildDistributionNormality'
import { DISTRIBUTION_NORMALITY as spec } from '../registry/distributionNormality'
import type { DistributionNormalityResult, VariableNormality } from '../stats/distributionNormality'

const png = (b: number) => new Uint8Array([b, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const scoreVar: VariableNormality = {
  variable: 'score', n: 12, shapiro: { W: 0.963261809, p: 0.829180865 }, ks: { D: 0.146181269, p: 0.681426721 },
  skew: 0.1143992142, kurtosis: -1.4922046390, // psych::describe type 3, excess kurtosis (native R 4.6.0 on long12)
  nExcluded: 2, histogramPng: png(1), qqPng: png(2),
}
const anxietyVar: VariableNormality = {
  variable: 'anxiety', n: 11, shapiro: { W: 0.985295280, p: 0.988459795 }, ks: { D: 0.079371235, p: 1 },
  skew: 0.1234803294, kurtosis: -1.2705455920, // native R 4.6.0 on the 11-value anxiety set
  nExcluded: 1, histogramPng: png(3), qqPng: png(4),
}
const single: DistributionNormalityResult = { variables: [scoreVar] }
const multi: DistributionNormalityResult = { variables: [scoreVar, anxietyVar] }

describe('buildDistributionNormality', () => {
  const c = buildDistributionNormality(spec, single)
  it('single variable: two rows with the Variable column, statistic letter + value, shared N, fp p, per-variable skew/kurtosis', () => {
    expect(c.tables).toHaveLength(1)
    expect(c.tables[0].spec).toBe(spec.tables[0])
    expect(c.tables[0].rows).toEqual([
      { variable: 'score', test: 'Shapiro-Wilk', statistic: 'W 0.96', n: 12, p: '.829', skew: '0.11', kurtosis: '−1.49' },
      { variable: 'score', test: 'K–S (Lilliefors)', statistic: 'D 0.15', n: 12, p: '.681', skew: '0.11', kurtosis: '−1.49' },
    ])
  })
  it('single variable: plain card note verbatim, plain APA exemplar fill, N column carries missingness', () => {
    expect(c.note).toEqual({ kind: 'plain', text: spec.tableNote!.text })
    expect(c.apa).toBe('Normality was assessed with the Shapiro-Wilk test, W = .96, p = .829.')
    expect(c.nExcluded).toBe(0) // per-variable N carries missingness (the summary-statistics recorded decision)
    expect(c.howToRead).toBe(spec.howToRead)
  })
  it('figures are per-variable named for collision-free export (the summary-statistics pattern)', () => {
    expect(c.figures.map((g) => ({ caption: g.caption, type: g.type }))).toEqual([
      { caption: 'Distribution shape — score', type: 'histogram_score' },
      { caption: 'Distribution shape — score', type: 'qq_score' },
    ])
    expect(c.figures[0].png).toBe(scoreVar.histogramPng)
    expect(c.figures[1].png).toBe(scoreVar.qqPng)
  })
  it('two variables: four rows in variable order, four figures, per-variable APA sentences', () => {
    const m = buildDistributionNormality(spec, multi)
    expect(m.tables[0].rows).toEqual([
      { variable: 'score', test: 'Shapiro-Wilk', statistic: 'W 0.96', n: 12, p: '.829', skew: '0.11', kurtosis: '−1.49' },
      { variable: 'score', test: 'K–S (Lilliefors)', statistic: 'D 0.15', n: 12, p: '.681', skew: '0.11', kurtosis: '−1.49' },
      { variable: 'anxiety', test: 'Shapiro-Wilk', statistic: 'W 0.99', n: 11, p: '.988', skew: '0.12', kurtosis: '−1.27' },
      { variable: 'anxiety', test: 'K–S (Lilliefors)', statistic: 'D 0.08', n: 11, p: '1.000', skew: '0.12', kurtosis: '−1.27' },
    ])
    expect(m.figures.map((g) => g.type)).toEqual(['histogram_score', 'qq_score', 'histogram_anxiety', 'qq_anxiety'])
    expect(m.apa).toBe(
      'score: Normality was assessed with the Shapiro-Wilk test, W = .96, p = .829. ' +
      'anxiety: Normality was assessed with the Shapiro-Wilk test, W = .99, p = .988.')
  })
  it('out-of-range Shapiro → em-dash cells for that variable only, reason folded into the note', () => {
    const big: VariableNormality = { ...anxietyVar, variable: 'reaction', n: 6000, shapiro: { W: null, p: null } }
    const m = buildDistributionNormality(spec, { variables: [scoreVar, big] })
    expect(m.tables[0].rows[2]).toEqual({ variable: 'reaction', test: 'Shapiro-Wilk', statistic: 'W —', n: '—', p: '—', skew: '0.12', kurtosis: '−1.27' })
    expect(m.tables[0].rows[3]).toEqual({ variable: 'reaction', test: 'K–S (Lilliefors)', statistic: 'D 0.08', n: 6000, p: '1.000', skew: '0.12', kurtosis: '−1.27' })
    expect(m.note).toEqual({ kind: 'plain', text: `${spec.tableNote!.text} Shapiro-Wilk not computed for reaction: N = 6000 is outside that range.` })
    expect(m.apa).toBe(
      'score: Normality was assessed with the Shapiro-Wilk test, W = .96, p = .829. ' +
      'reaction: Normality was assessed with the Shapiro-Wilk test, W = —, p —.')
  })
  it('p-clause rule: tiny Shapiro p reads "p < .001"', () => {
    const c3 = buildDistributionNormality(spec, { variables: [{ ...scoreVar, shapiro: { W: 0.5, p: 0.0001 } }] })
    expect(c3.apa).toBe('Normality was assessed with the Shapiro-Wilk test, W = .50, p < .001.')
  })
  it('guarded K–S (N below 5) → em-dash K–S row, note unchanged', () => {
    const c4 = buildDistributionNormality(spec, { variables: [{ ...scoreVar, n: 4, ks: { D: null, p: null } }] })
    expect(c4.tables[0].rows[1]).toEqual({ variable: 'score', test: 'K–S (Lilliefors)', statistic: 'D —', n: '—', p: '—', skew: '0.11', kurtosis: '−1.49' })
    expect(c4.note).toEqual({ kind: 'plain', text: spec.tableNote!.text })
  })
})
