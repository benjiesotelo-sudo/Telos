import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { VarResult } from '../stats/var'
import type { CardContent } from './builders'
import { f, f01, fp } from '../format/apa'

export function buildVar(spec: TestSpec, r: VarResult): CardContent {
  const lagRows = r.lagRows.map((row) => ({
    lag: row.lag, aic: f(row.aic), bic: f(row.bic), hq: f(row.hq),
  }))
  // The "Equation / lagged term" column shows the equation it belongs to alongside the lagged term.
  const coefRows = r.coefRows.map((row) => ({
    term: `${row.equation}: ${row.term}`, estimate: f(row.estimate),
    se: f(row.se), t: f(row.t), p: fp(row.p),
  }))
  const fevdRows = r.fevdRows.map((row) => ({
    variable: row.variable, impulse: row.impulse, share: f01(row.share),
  }))
  const apa = spec.apaTemplate.replace('{p}', String(r.selectedLag))
  const figs = figuresOf(spec)
  return {
    tables: [
      { spec: spec.tables[0], rows: lagRows },
      { spec: spec.tables[1], rows: coefRows },
      { spec: spec.tables[2], rows: fevdRows },
    ],
    note: spec.tableNote ?? null,
    figures: [
      { caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figIrfPng },
    ],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
