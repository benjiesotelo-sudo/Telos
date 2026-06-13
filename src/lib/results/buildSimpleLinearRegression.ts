import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { SimpleLinearResult } from '../stats/simpleLinearRegression'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa } from '../format/apa'

export function buildSimpleLinearRegression(spec: TestSpec, r: SimpleLinearResult): CardContent {
  // Convention 1 / recorded decision 8: intercept β renders blank '' (ghost row); no toggles on this card — β always fills.
  const coefRows = r.terms.map((x) => ({
    term: x.term, b: f(x.b), se: f(x.se),
    beta: x.beta == null ? '' : f(x.beta),
    t: f(x.t), p: fp(x.p), ci: `[${f(x.ciLow)}, ${f(x.ciHigh)}]`,
  }))
  const pred = r.terms.find((x) => x.term !== '(Intercept)')! // APA fills from the predictor row (recorded decision 3)
  const apa = spec.apaTemplate
    .replace('{b}', f(pred.b)).replace('{df}', fdf(r.df2)).replace('{t}', f(pred.t))
    .replace('{p}', fpApa(pred.p))
    .replace('{r2}', f01(r.r2))
  const figs = figuresOf(spec)
  return {
    tables: [
      { spec: spec.tables[0], rows: [{ r2: f(r.r2), adjR2: f(r.adjR2), f: f(r.f), df1: fdf(r.df1), df2: fdf(r.df2), p: fp(r.p), se: f(r.sigma) }] },
      { spec: spec.tables[1], rows: coefRows },
    ],
    note: spec.tableNote ?? null,
    figures: [
      { caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figFitPng },
      { caption: figs[1].caption, type: figs[1].type, file: figs[1].file, png: r.figResidualsPng },
    ],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
