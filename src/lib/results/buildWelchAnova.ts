import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { WelchAnovaResult } from '../stats/welchAnova'
import type { CardContent } from './builders'
import { f, fdf, fp, fpApa, fx } from '../format/apa'

export function buildWelchAnova(spec: TestSpec, r: WelchAnovaResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{df1}', fdf(r.df1)).replace('{df2}', fdf(r.df2)).replace('{f}', f(r.f))
    .replace('{p}', fpApa(r.p))
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: r.desc.map((g) => ({ group: g.group, n: g.n, m: f(g.m), sd: f(g.sd) })) },
      { spec: spec.tables[1], rows: [{ f: f(r.f), df1: fdf(r.df1), df2: fdf(r.df2), p: fp(r.p) }] },
      { spec: spec.tables[2], rows: r.posthoc.map((row) => ({
          pair: row.pair,
          mdiff: f(row.diff),
          padj: fp(row.pAdj),
          ci: `[${f(row.ciLo)}, ${f(row.ciHi)}]`,
        })) },
    ],
    note: { kind: 'assume', text: `${spec.tableNote!.text} (Shapiro per group: ${r.shapiro.map((s) => `${s.group} W=${fx(s.W, f)}, p=${fx(s.p, fp)}`).join('; ')})` }, // mirror buildOneWayAnova: static tableNote + computed per-group W/p, em-dash NA via fx()
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
