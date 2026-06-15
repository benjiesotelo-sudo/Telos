import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { GrangerResult } from '../stats/grangerCausality'
import type { CardContent } from './builders'
import { f, fdf, fp, fpApa } from '../format/apa'

export function buildGrangerCausality(spec: TestSpec, r: GrangerResult): CardContent {
  const [xy, yx] = r.rows
  const rows = r.rows.map((row) => ({
    direction: row.direction, f: f(row.f),
    df: `${fdf(row.df1)}, ${fdf(row.df2)}`, p: fp(row.p),
  }))
  const apa = spec.apaTemplate
    .replace('{df1xy}', fdf(xy.df1)).replace('{df2xy}', fdf(xy.df2))
    .replace('{fxy}', f(xy.f)).replace('{pxy}', fpApa(xy.p))
    .replace('{df1yx}', fdf(yx.df1)).replace('{df2yx}', fdf(yx.df2))
    .replace('{fyx}', f(yx.f)).replace('{pyx}', fpApa(yx.p))
    .replace('{lag}', String(r.maxLag))
  const figs = figuresOf(spec)
  return {
    tables: [{ spec: spec.tables[0], rows }],
    note: spec.tableNote ?? null,
    figures: [
      { caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figCrossSeriesPng },
    ],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
