import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { ManovaResult } from '../stats/manova'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa, fx } from '../format/apa'

export function buildManova(spec: TestSpec, r: ManovaResult): CardContent {
  // APA from the SELECTED statistic's fields (owner ruling: option b).
  const mv = r.multivariate[0]
  const statLabel = r.statistic === 'Wilks' ? "Wilks' Λ" : "Pillai's V"
  const apa = spec.apaTemplate
    .replace("Pillai's V", statLabel)
    .replace('{v}', f01(mv.stat))
    .replace('{df1}', fdf(mv.df1))
    .replace('{df2}', fdf(mv.df2))
    .replace('{f}', f(mv.f))
    .replace('{p}', fpApa(mv.p))

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
        pes: `${f(row.pes)} [${f(row.pesLow)}, ${f(row.pesHigh)}]`, // partial η² with one-sided CI (per follow-up DV)
      })),
    })
  }

  // Assume-note: registry static text + runtime Box's M (heplots::boxM). Mirrors buildOneWayAnova; em-dash NA via fx().
  const bm = r.boxM
  return {
    tables,
    note: { kind: 'assume', text: `${spec.tableNote!.text} (Box's M χ²=${fx(bm.chisq, f)}, df=${fx(bm.df, fdf)}, p=${fx(bm.p, fp)})`, afterTableId: spec.tableNote?.afterTableId },
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
