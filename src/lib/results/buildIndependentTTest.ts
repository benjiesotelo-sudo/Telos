import type { TestSpec } from '../registry/types'
import type { TTestResult } from '../stats/types'
import type { CardContent } from './builders'
import { f, f1, fdf, fp, fpApa, fx } from '../format/apa'

export function buildIndependentTTest(spec: TestSpec, r: TTestResult): CardContent {
  const [g1, g2] = r.groupStats
  const pct = Math.round(r.ciLevel * 100)
  const ciLabel = `${pct}% CI`
  const apa = spec.apaTemplate
    .replace('{g1}', g1.group).replace('{m1}', f1(g1.mean)).replace('{sd1}', f1(g1.sd))
    .replace('{g2}', g2.group).replace('{m2}', f1(g2.mean)).replace('{sd2}', f1(g2.sd))
    .replace('{df}', fdf(r.df)).replace('{t}', f(r.t))
    .replace('{p}', fpApa(r.p))
    .replace('{d}', f(r.cohensD))
  const t2cols = spec.tables[1].columns.map((c) => c.key === 'ci' ? { ...c, label: ciLabel } : c)
  return {
    tables: [
      { spec: spec.tables[0], rows: r.groupStats.map((g) => ({ group: g.group, n: g.n, mean: f(g.mean), sd: f(g.sd), se: f(g.se) })) },
      { spec: { ...spec.tables[1], columns: t2cols }, rows: [{ contrast: r.contrast, t: f(r.t), df: fdf(r.df), p: fp(r.p), mdiff: f(r.meanDiff), ci: `[${f(r.ci[0])}, ${f(r.ci[1])}]`, d: f(r.cohensD) }] },
    ],
    note: { kind: 'assume', text: `${spec.assumptionNote} (Levene F=${fx(r.levene.F, f)}, p=${fx(r.levene.p, fp)} · ${r.test === 'welch' ? 'Welch' : 'pooled'} test)` },
    figures: [{ caption: spec.figure!.caption, type: spec.figure!.type, png: r.figurePng }],
    howToRead: spec.howToRead.replace('95% CI', ciLabel).replace('(e.g. .05)', `(e.g. ${r.alpha})`),
    apa,
    nExcluded: r.nExcluded,
  }
}
