import { describe, it, expect } from 'vitest'
import { buildDistributionNormality } from './buildDistributionNormality'
import { DISTRIBUTION_NORMALITY as spec } from '../registry/distributionNormality'
import type { DistributionNormalityResult } from '../stats/distributionNormality'

const png = (b: number) => new Uint8Array([b, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const inRange: DistributionNormalityResult = {
  n: 12, shapiro: { W: 0.963261809, p: 0.829180865 }, ks: { D: 0.146181269, p: 0.681426721 },
  nExcluded: 2, histogramPng: png(1), qqPng: png(2),
}

describe('buildDistributionNormality', () => {
  const c = buildDistributionNormality(spec, inRange)
  it('shapes the bare-caption table: ghost-row labels, statistic letter + value, shared N, fp p', () => {
    expect(c.tables).toHaveLength(1)
    expect(c.tables[0].spec).toBe(spec.tables[0])
    expect(c.tables[0].rows).toEqual([
      { test: 'Shapiro-Wilk', statistic: 'W 0.96', n: 12, p: '.829' },
      { test: 'K–S (Lilliefors)', statistic: 'D 0.15', n: 12, p: '.681' },
    ])
  })
  it('keeps the plain card note verbatim in range and fills the APA exemplar', () => {
    expect(c.note).toEqual({ kind: 'plain', text: spec.tableNote!.text })
    expect(c.apa).toBe('Normality was assessed with the Shapiro-Wilk test, W = 0.96, p = .829.')
    expect(c.nExcluded).toBe(2)
    expect(c.howToRead).toBe(spec.howToRead)
  })
  it('carries both figures with types for alt-text and export naming', () => {
    expect(c.figures.map((g) => ({ caption: g.caption, type: g.type }))).toEqual([
      { caption: 'Distribution shape', type: 'histogram' }, { caption: 'Distribution shape', type: 'qq' },
    ])
    expect(c.figures[0].png).toBe(inRange.histogramPng)
    expect(c.figures[1].png).toBe(inRange.qqPng)
  })
  it('out-of-range Shapiro → em-dash cells, reason folded into the note, em-dash APA fill', () => {
    const c2 = buildDistributionNormality(spec, { ...inRange, n: 6000, shapiro: { W: null, p: null } })
    expect(c2.tables[0].rows[0]).toEqual({ test: 'Shapiro-Wilk', statistic: 'W —', n: '—', p: '—' })
    expect(c2.tables[0].rows[1]).toEqual({ test: 'K–S (Lilliefors)', statistic: 'D 0.15', n: 6000, p: '.681' })
    expect(c2.note).toEqual({ kind: 'plain', text: `${spec.tableNote!.text} Shapiro-Wilk not computed: N = 6000 is outside that range.` })
    expect(c2.apa).toBe('Normality was assessed with the Shapiro-Wilk test, W = —, p = —.')
  })
  it('p-clause rule: tiny Shapiro p reads "p < .001"', () => {
    const c3 = buildDistributionNormality(spec, { ...inRange, shapiro: { W: 0.5, p: 0.0001 } })
    expect(c3.apa).toBe('Normality was assessed with the Shapiro-Wilk test, W = 0.50, p < .001.')
  })
  it('guarded K–S (N below 5) → em-dash K–S row, note unchanged', () => {
    const c4 = buildDistributionNormality(spec, { ...inRange, n: 4, ks: { D: null, p: null } })
    expect(c4.tables[0].rows[1]).toEqual({ test: 'K–S (Lilliefors)', statistic: 'D —', n: '—', p: '—' })
    expect(c4.note).toEqual({ kind: 'plain', text: spec.tableNote!.text })
  })
})
