import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { DistributionNormalityResult } from '../stats/distributionNormality'
import type { CardContent } from './builders'
import { f, fp, fx } from '../format/apa'

export function buildDistributionNormality(spec: TestSpec, r: DistributionNormalityResult): CardContent {
  const row = (test: string, letter: 'W' | 'D', stat: number | null, p: number | null) =>
    ({ test, statistic: `${letter} ${fx(stat, f)}`, n: stat == null ? '—' : r.n, p: fx(p, fp) })
  const note = r.shapiro.W == null
    ? `${spec.tableNote!.text} Shapiro-Wilk not computed: N = ${r.n} is outside that range.`
    : spec.tableNote!.text
  const apa = spec.apaTemplate
    .replace('{w}', fx(r.shapiro.W, f))
    .replace('p = {p}', r.shapiro.p != null && r.shapiro.p < 0.001 ? 'p < .001' : `p = ${fx(r.shapiro.p, fp)}`)
  return {
    tables: [{ spec: spec.tables[0], rows: [row('Shapiro-Wilk', 'W', r.shapiro.W, r.shapiro.p), row('K–S (Lilliefors)', 'D', r.ks.D, r.ks.p)] }],
    note: { kind: spec.tableNote!.kind, text: note },
    figures: figuresOf(spec).map((g, i) => ({ caption: g.caption, type: g.type, png: i === 0 ? r.histogramPng : r.qqPng })),
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
