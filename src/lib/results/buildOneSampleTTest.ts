import type { TestSpec } from '../registry/types'
import type { OneSampleTTestResult } from '../stats/oneSampleTTest'
import type { CardContent } from './builders'
import { minus, f, f1, fdf, fp, fpApa, fx } from '../format/apa'

const tailsNote = (t: string) => t === 'two.sided' ? '' : ` This was a one-tailed test (${t}).`

export function buildOneSampleTTest(spec: TestSpec, r: OneSampleTTestResult): CardContent {
  const pct = Math.round(r.ciLevel * 100)
  const ciLabel = `${pct}% CI`
  const apa = spec.apaTemplate
    .replace('{m}', f1(r.mean)).replace('{mu0}', minus(String(r.mu0)))
    .replace('{df}', fdf(r.df)).replace('{t}', f(r.t))
    .replace('{p}', fpApa(r.p))
    .replace('{d}', f(r.cohensD))
  const t2cols = spec.tables[1].columns.map((c) => c.key === 'ci' ? { ...c, label: ciLabel } : c)
  return {
    tables: [
      { spec: spec.tables[0], rows: [{ variable: r.variable, n: r.n, mean: f(r.mean), sd: f(r.sd), se: f(r.se) }] },
      { spec: { ...spec.tables[1], columns: t2cols }, rows: [{ mu0: minus(String(r.mu0)), t: f(r.t), df: fdf(r.df), p: fp(r.p), mdiff: f(r.meanDiff), ci: `[${f(r.ci[0])}, ${f(r.ci[1])}]`, d: f(r.cohensD) }] },
    ],
    note: { kind: 'assume', text: `${spec.tableNote!.text} (Shapiro-Wilk W=${fx(r.shapiro.W, f)}, p=${fx(r.shapiro.p, fp)})` },
    figures: [{ caption: spec.figures![0].caption, type: spec.figures![0].type, png: r.figurePng }],
    howToRead: spec.howToRead.replace('95% CI', ciLabel) + ` Your significance threshold (α) is ${r.alpha}.` + tailsNote(r.tails),
    apa,
    nExcluded: r.nExcluded,
  }
}
