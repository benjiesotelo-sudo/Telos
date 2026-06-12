import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { RepeatedMeasuresAnovaResult } from '../stats/repeatedMeasuresAnova'
import type { CardContent } from './builders'
import { f, fdf, fp } from '../format/apa'
import { posthocTableRows } from '../stats/posthoc'

export function buildRepeatedMeasuresAnova(spec: TestSpec, r: RepeatedMeasuresAnovaResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{df1}', fdf(r.anova.df1)).replace('{df2}', fdf(r.anova.df2))
    .replace('{f}', f(r.anova.f))
    .replace('p={p}', r.anova.p < 0.001 ? 'p<.001' : `p=${fp(r.anova.p)}`)
    .replace('{pes}', f(r.anova.pes))
  const fig = figuresOf(spec)[0]

  // Table 2: single ANOVA row with corrected df (fdf renders '1.78'/'104.75' under GG).
  const anovaTable = {
    spec: spec.tables[1],
    rows: [{ source: r.anova.source, ss: f(r.anova.ss), df: fdf(r.anova.df1), ms: f(r.anova.ms), f: f(r.anova.f), p: fp(r.anova.p), pes: f(r.anova.pes) }],
  }

  // Table 3 (sphericity): only when sphericity rows are non-empty (3+ levels).
  const sphericityTable = r.sphericity.length > 0
    ? { spec: spec.tables[2], rows: r.sphericity.map((s) => ({ effect: s.effect, w: f(s.w), p: fp(s.p), gg: f(s.ggEps), hf: f(s.hfEps) })) }
    : null

  // Table 4 (posthoc): only when posthoc rows are non-empty (toggle was on).
  const posthocTable = r.posthoc.length > 0
    ? { spec: spec.tables[3], rows: posthocTableRows(r.posthoc, { f, fp }) }
    : null

  const tables = [
    { spec: spec.tables[0], rows: r.desc.map((d) => ({ condition: d.condition, n: d.n, m: f(d.m), sd: f(d.sd) })) },
    anovaTable,
    ...(sphericityTable ? [sphericityTable] : []),
    ...(posthocTable ? [posthocTable] : []),
  ]

  return {
    tables,
    note: spec.tableNote ?? null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
