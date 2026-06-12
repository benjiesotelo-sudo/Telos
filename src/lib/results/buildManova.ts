import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { ManovaResult } from '../stats/manova'
import type { CardContent } from './builders'
import { f, fdf, fp } from '../format/apa'

export function buildManova(spec: TestSpec, r: ManovaResult): CardContent {
  // APA ALWAYS from Pillai fields of the first effect row (recorded decision 1).
  const mv = r.multivariate[0]
  const apa = spec.apaTemplate
    .replace('{v}', f(mv.pillai))
    .replace('{df1}', fdf(mv.pillaiDf1))
    .replace('{df2}', fdf(mv.pillaiDf2))
    .replace('{f}', f(mv.pillaiF))
    .replace('p={p}', mv.pillaiP < 0.001 ? 'p<.001' : `p=${fp(mv.pillaiP)}`)

  const fig = figuresOf(spec)[0]

  // Table 1: multivariate tests
  const multivariateRows = r.multivariate.map((row) => ({
    effect: row.effect,
    stat: f(row.stat),
    f: f(row.f),
    df1: fdf(row.df1),
    df2: fdf(row.df2),
    p: fp(row.p),
  }))

  const tables: CardContent['tables'] = [
    { spec: spec.tables[0], rows: multivariateRows },
  ]

  // Table 2: follow-up univariate ANOVAs — OMITTED when toggle off (followups list empty).
  if (r.followups.length > 0) {
    tables.push({
      spec: spec.tables[1],
      rows: r.followups.map((row) => ({
        dv: row.dv,
        f: f(row.f),
        df1: fdf(row.df1),
        df2: fdf(row.df2),
        p: fp(row.p),
        pes: f(row.pes),
      })),
    })
  }

  return {
    tables,
    note: null, // NO tableNote (plan: card has none)
    figures: [{ caption: fig.caption, type: fig.type, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
