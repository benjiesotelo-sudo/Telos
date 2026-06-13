import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { MultipleLinearResult } from '../stats/multipleLinearRegression'
import type { CardContent } from './builders'
import { f, fdf, fp } from '../format/apa'

export function buildMultipleLinearRegression(spec: TestSpec, r: MultipleLinearResult): CardContent {
  // R1 + recorded decision 8: intercept β/VIF blank '' (ghost row); standardize off → predictor β cells '—';
  // k = 1 (vif null) → predictor VIF cells '—'.
  const coefRows = r.terms.map((x) => {
    const isInt = x.term === '(Intercept)'
    return {
      term: x.term, b: f(x.b), se: f(x.se),
      beta: isInt ? '' : r.standardize ? f(x.beta!) : '—',
      t: f(x.t), p: fp(x.p), ci: `[${f(x.ciLow)}, ${f(x.ciHigh)}]`,
      vif: isInt ? '' : x.vif == null ? '—' : f(x.vif),
    }
  })
  const first = r.terms.find((x) => x.term !== '(Intercept)')! // APA "predictor X" = first coefficient row (recorded decision 3)
  const apa = spec.apaTemplate
    .replace('{r2}', f(r.r2)).replace('{df1}', fdf(r.df1)).replace('{df2}', fdf(r.df2)).replace('{f}', f(r.f))
    .replace('p={p}', r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`)
    .replace('predictor X', `predictor ${first.term}`)
    .replace('{b}', f(first.b))
    .replace('p={p2}', first.p < 0.001 ? 'p<.001' : `p=${fp(first.p)}`)
  const [figResiduals, figCoef] = figuresOf(spec) // #11: residual diagnostics, then the coefficient plot
  return {
    tables: [
      { spec: spec.tables[0], rows: [{ r2: f(r.r2), adjR2: f(r.adjR2), f: f(r.f), df1: fdf(r.df1), df2: fdf(r.df2), p: fp(r.p) }] },
      { spec: spec.tables[1], rows: coefRows },
    ],
    note: spec.tableNote ?? null,
    figures: [
      { caption: figResiduals.caption, type: figResiduals.type, file: figResiduals.file, png: r.figResidualsPng },
      { caption: figCoef.caption, type: figCoef.type, file: figCoef.file, png: r.figCoefPlotPng },
    ],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
