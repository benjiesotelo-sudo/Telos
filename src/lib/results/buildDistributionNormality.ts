import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { DistributionNormalityResult, VariableNormality } from '../stats/distributionNormality'
import type { CardContent } from './builders'
import { f, f01, fp, fpApa, fx } from '../format/apa'

export function buildDistributionNormality(spec: TestSpec, r: DistributionNormalityResult): CardContent {
  // skew/kurtosis are per-variable (shared across both test rows, like N); excess kurtosis (psych type 3, normal = 0).
  const row = (v: VariableNormality, test: string, letter: 'W' | 'D', stat: number | null, p: number | null) =>
    ({ variable: v.variable, test, statistic: `${letter} ${fx(stat, f)}`, n: stat == null ? '—' : v.n, p: fx(p, fp), skew: fx(v.skew, f), kurtosis: fx(v.kurtosis, f) })
  const skipped = r.variables.filter((v) => v.shapiro.W == null)
  const note = skipped.length
    ? `${spec.tableNote!.text} ${skipped.map((v) => `Shapiro-Wilk not computed for ${v.variable}: N = ${v.n} is outside that range.`).join(' ')}`
    : spec.tableNote!.text
  const sentence = (v: VariableNormality) => spec.apaTemplate
    .replace('{w}', fx(v.shapiro.W, f01))
    .replace('{p}', v.shapiro.p != null && Number.isFinite(v.shapiro.p) ? fpApa(v.shapiro.p) : '—')
  const [histSpec, qqSpec] = figuresOf(spec)
  return {
    tables: [{ spec: spec.tables[0], rows: r.variables.flatMap((v) => [
      row(v, 'Shapiro-Wilk', 'W', v.shapiro.W, v.shapiro.p),
      row(v, 'K–S (Lilliefors)', 'D', v.ks.D, v.ks.p),
    ]) }],
    note: { kind: spec.tableNote!.kind, text: note },
    // per-variable caption/type so export names never collide across variables (the summary-statistics pattern)
    figures: r.variables.flatMap((v) => [
      { caption: `${histSpec.caption} — ${v.variable}`, type: `${histSpec.type}_${v.variable}`, png: v.histogramPng },
      { caption: `${qqSpec.caption} — ${v.variable}`, type: `${qqSpec.type}_${v.variable}`, png: v.qqPng },
    ]),
    howToRead: spec.howToRead,
    apa: r.variables.length === 1 ? sentence(r.variables[0]) : r.variables.map((v) => `${v.variable}: ${sentence(v)}`).join(' '),
    nExcluded: 0, // the per-variable N column carries missingness (the summary-statistics recorded decision)
  }
}
