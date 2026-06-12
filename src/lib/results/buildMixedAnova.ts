import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { MixedAnovaResult } from '../stats/mixedAnova'
import type { CardContent } from './builders'
import { f, fdf, fp, fx } from '../format/apa'
import { posthocTableRows } from '../stats/posthoc'

export function buildMixedAnova(spec: TestSpec, r: MixedAnovaResult): CardContent {
  const inter = r.anovaRows[2]  // interaction row drives the APA
  const apa = spec.apaTemplate
    .replace('{df1}', fdf(inter.df1)).replace('{df2}', fdf(inter.df2)).replace('{f}', f(inter.f))
    .replace('p={p}', inter.p < 0.001 ? 'p<.001' : `p=${fp(inter.p)}`)
    .replace('{pes}', f(inter.pes))

  const note: CardContent['note'] = {
    kind: 'assume',
    text: `${spec.tableNote!.text} (Levene on subject means F=${fx(r.levene.F, f)}, p=${fx(r.levene.p, fp)})`,
  }

  const fig = figuresOf(spec)[0]

  // Always build all four table specs; include sphericity only when rows non-empty,
  // posthoc only when rows non-empty (toggle off or 2-level auto-omit).
  const tables: CardContent['tables'] = [
    {
      spec: spec.tables[0],
      rows: r.desc.map((d) => ({ group: d.group, condition: d.condition, n: d.n, m: f(d.m), sd: f(d.sd) })),
    },
    {
      spec: spec.tables[1],
      rows: r.anovaRows.map((row) => ({
        source: row.source,
        ss: f(row.ss),
        df: fdf(row.df1),
        ms: f(row.ms),
        f: f(row.f),
        p: fp(row.p),
        pes: f(row.pes),
      })),
    },
  ]

  if (r.sphericity.length > 0) {
    tables.push({
      spec: spec.tables[2],
      rows: r.sphericity.map((s) => ({
        effect: s.effect,
        w: f(s.w),
        p: fp(s.p),
        gg: f(s.ggEps),
        hf: f(s.hfEps),
      })),
    })
  }

  if (r.posthoc.length > 0) {
    tables.push({
      spec: spec.tables[3],
      rows: posthocTableRows(r.posthoc, { f, fp }),
    })
  }

  return {
    tables,
    note,
    figures: [{ caption: fig.caption, type: fig.type, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
