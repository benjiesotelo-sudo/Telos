import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { OneWayAnovaResult } from '../stats/oneWayAnova'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa, fx } from '../format/apa'
import { posthocTableRows } from '../stats/posthoc'

export function buildOneWayAnova(spec: TestSpec, r: OneWayAnovaResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{df1}', fdf(r.dfB)).replace('{df2}', fdf(r.dfW)).replace('{f}', f(r.f))
    .replace('{p}', fpApa(r.p))
    .replace('{eta2}', f01(r.eta2))
    .replace('{posthoc}', r.posthocMethod)
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: r.desc.map((g) => ({ group: g.group, n: g.n, m: f(g.m), sd: f(g.sd) })) },
      { spec: spec.tables[1], rows: [
        { source: 'Between', ss: f(r.ssB), df: fdf(r.dfB), ms: f(r.msB), f: f(r.f), p: fp(r.p), eta2: f(r.eta2) },
        { source: 'Within', ss: f(r.ssW), df: fdf(r.dfW), ms: f(r.msW), f: '', p: '', eta2: '' }, // card draws empty cells
      ] },
      { spec: spec.tables[2], rows: posthocTableRows(r.posthoc, { f, fp }) },
    ],
    note: { kind: 'assume', text: `${spec.tableNote!.text} (Levene F=${fx(r.levene.F, f)}, p=${fx(r.levene.p, fp)} · Shapiro W=${fx(r.shapiro.W, f)}, p=${fx(r.shapiro.p, fp)})${r.levene.p != null && r.levene.p < 0.05 ? " — equal variances look doubtful; consider Welch's ANOVA" : ''}` }, // design §4.4: suggest, never auto-switch
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
