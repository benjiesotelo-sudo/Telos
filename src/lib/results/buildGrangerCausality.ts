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
  // R1 gap-fix: lag-order selection table (vars::VARselect) — advisory only, the Granger test above still
  // uses the fixed max-lag option.
  const lagRows = r.lagRows.map((row) => ({ lag: row.lag, aic: f(row.aic), bic: f(row.bic), hq: f(row.hq) }))
  const selectedAicRow = r.lagRows.find((row) => row.lag === r.aicLag)
  return {
    tables: [{ spec: spec.tables[0], rows }, { spec: spec.tables[1], rows: lagRows }],
    note: spec.tableNote ?? null,
    figures: [
      { caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figCrossSeriesPng },
    ],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
    // A5 (U8-T4): the X→Y row stands in for the two-direction table (matches the APA line's lead direction);
    // the AIC-minimizing lag row stands in for the lag-selection table.
    values: {
      direction: xy.direction, f: f(xy.f), df: `${fdf(xy.df1)}, ${fdf(xy.df2)}`, p: fp(xy.p),
      // R1 gap-fix: matches the new lag-selection table's registry column keys exactly (lag/aic/bic/hq) —
      // the AIC-minimizing row stands in for the whole table, same aggregate precedent as elsewhere.
      lag: selectedAicRow ? String(selectedAicRow.lag) : undefined,
      aic: selectedAicRow ? f(selectedAicRow.aic) : undefined,
      bic: selectedAicRow ? f(selectedAicRow.bic) : undefined,
      hq: selectedAicRow ? f(selectedAicRow.hq) : undefined,
    },
  }
}
