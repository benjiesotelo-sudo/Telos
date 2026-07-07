import type { TestSpec } from '../registry/types'
import type { OneSampleTTestResult } from '../stats/oneSampleTTest'
import type { CardContent } from './builders'
import { minus, f, f1, fdf, fp, fpApa, fx } from '../format/apa'
import { verdictClause } from '../format/verdict'

const tailsNote = (t: string) => t === 'two.sided' ? '' : ` This was a one-tailed test (${t}).`

export function buildOneSampleTTest(spec: TestSpec, r: OneSampleTTestResult): CardContent {
  const pct = Math.round(r.ciLevel * 100)
  const ciLabel = `${pct}% CI`
  const apa = spec.apaTemplate
    .replace('{m}', f1(r.mean)).replace('{mu0}', minus(String(r.mu0)))
    .replace('{df}', fdf(r.df)).replace('{t}', f(r.t))
    .replace('{p}', fpApa(r.p))
    .replace('{d}', f(r.cohensD)).replace('{dlo}', f(r.cohensDLow)).replace('{dhi}', f(r.cohensDHigh))
  // Both CI columns (mean-diff + effect-size) follow the same pattern: registry holds the 95% default literal, the builder swaps in the adjustable level.
  const t2cols = spec.tables[1].columns.map((c) => c.key === 'ci' ? { ...c, label: ciLabel } : c.key === 'd' ? { ...c, label: c.label.replace('95% CI', ciLabel) } : c)
  return {
    tables: [
      { spec: spec.tables[0], rows: [{ variable: r.variable, n: r.n, mean: f(r.mean), sd: f(r.sd), se: f(r.se) }] },
      { spec: { ...spec.tables[1], columns: t2cols }, rows: [{ mu0: minus(String(r.mu0)), t: f(r.t), df: fdf(r.df), p: fp(r.p), mdiff: f(r.meanDiff), ci: `[${f(r.ci[0])}, ${f(r.ci[1])}]`, d: `${f(r.cohensD)} [${f(r.cohensDLow)}, ${f(r.cohensDHigh)}]` }] },
    ],
    note: { kind: 'assume', text: `${spec.tableNote!.text} (Shapiro-Wilk W=${fx(r.shapiro.W, f)}, p=${fx(r.shapiro.p, fp)})${verdictClause(r.shapiro.p, r.alpha, 'normality looks reasonable', 'normality looks doubtful; interpret the effect size and CI with extra caution')}` },
    figures: [{ caption: spec.figures![0].caption, type: spec.figures![0].type, png: r.figurePng }],
    howToRead: spec.howToRead.replace('95% CI', ciLabel) + ` Your significance threshold (α) is ${r.alpha}.` + tailsNote(r.tails),
    apa,
    nExcluded: r.nExcluded,
    // U8-T4: keyed to match the 'one-sample-t-test' EXPLAINERS entries in registry/explainers.ts.
    // Reuses the same formatted strings assembled above for the table/apa output.
    values: {
      variable: r.variable, n: String(r.n), mean: f(r.mean), sd: f(r.sd), se: f(r.se),
      mu0: minus(String(r.mu0)), t: f(r.t), df: fdf(r.df), p: fpApa(r.p), mdiff: f(r.meanDiff),
      ci: `[${f(r.ci[0])}, ${f(r.ci[1])}]`, d: f(r.cohensD), dlo: f(r.cohensDLow), dhi: f(r.cohensDHigh),
    },
  }
}
