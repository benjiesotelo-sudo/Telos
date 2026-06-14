import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { MixedAnovaResult } from '../stats/mixedAnova'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa } from '../format/apa'
import { posthocTableRows } from '../stats/posthoc'

export function buildMixedAnova(spec: TestSpec, r: MixedAnovaResult): CardContent {
  const inter = r.anovaRows[2]  // interaction row drives the APA
  // Derive display names: between from betweenName (title-case), within from row 1 source stripped of ' (within)'
  const betweenDisplay = r.betweenName.charAt(0).toUpperCase() + r.betweenName.slice(1)
  const withinDisplay = r.anovaRows[1].source.replace(/\s*\(within\)\s*$/i, '')
  const apa = spec.apaTemplate
    .replace('{between_name}', betweenDisplay)
    .replace('{within_name}', withinDisplay)
    .replace('{df1}', fdf(inter.df1)).replace('{df2}', fdf(inter.df2)).replace('{f}', f(inter.f))
    .replace('p {p}', `p ${fpApa(inter.p)}`)
    .replace('{pes}', f01(inter.pes))

  // Note anchors after the sphericity table (before posthoc) when sphericity rows are present.
  // When sphericity is absent (2-level within factor), the note renders after the ANOVA table.
  const showSphericity = r.sphericity.length > 0
  const note: CardContent['note'] = {
    kind: 'assume',
    text: spec.tableNote!.text,
    ...(showSphericity ? { afterTableId: 'sphericity' } : { afterTableId: 'mixed-anova' }),
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
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
