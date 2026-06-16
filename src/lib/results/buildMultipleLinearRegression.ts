import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { MultipleLinearResult } from '../stats/multipleLinearRegression'
import type { CardContent } from './builders'
import { f, f01, fdf, fpApa } from '../format/apa'

// modelsummary coef table (design 2026-06-16) — merges the old Model fit + Coefficients into one stacked table.
// Per term: estimate row (B in 'est', β in 'beta', VIF in 'vif') → muted (SE) row → muted [CI] row. Then a rule,
// then one gof row per spec.tables[0].gof (the old Model fit footer). No significance stars (D1); t/p/z drop from cells.
// R1 + recorded decision 8: intercept β/VIF stay blank ('' ghost cells). standardize off → predictor β cells '—',
// on → filled. k = 1 (vif null) → predictor VIF cells '—'. β/VIF render only on the estimate row (blank on se/ci).
export function buildMultipleLinearRegression(spec: TestSpec, r: MultipleLinearResult): CardContent {
  const t = spec.tables[0]
  const gofValue: Record<string, string> = {
    n: String(r.n), r2: f(r.r2), adjr2: f(r.adjR2), f: f(r.f),
    rmse: f(r.rmse), aic: f(r.aic), bic: f(r.bic), ll: f(r.logLik),
  }
  const rows: Record<string, string | number>[] = [
    ...r.terms.flatMap((x) => {
      const isInt = x.term === '(Intercept)'
      const beta = isInt ? '' : r.standardize ? f(x.beta!) : '—'
      const vif = isInt ? '' : x.vif == null ? '—' : f(x.vif)
      return [
        { _kind: 'coef', term: x.term, est: f(x.b), beta, vif },
        { _kind: 'se', term: '', est: `(${f(x.se)})`, beta: '', vif: '' },
        { _kind: 'ci', term: '', est: `[${f(x.ciLow)}, ${f(x.ciHigh)}]`, beta: '', vif: '' },
      ]
    }),
    { _kind: 'rule' },
    ...t.gof!.map((g) => ({ _kind: 'gof', term: g.label, est: gofValue[g.key] })),
  ]
  const first = r.terms.find((x) => x.term !== '(Intercept)')! // APA "predictor X" = first coefficient row (recorded decision 3)
  const apa = spec.apaTemplate
    .replace('{r2}', f01(r.r2)).replace('{df1}', fdf(r.df1)).replace('{df2}', fdf(r.df2)).replace('{f}', f(r.f))
    .replace('p {p}', `p ${fpApa(r.p)}`)
    .replace('predictor X', `predictor ${first.term}`)
    .replace('{b}', f(first.b))
    .replace('p {p2}', `p ${fpApa(first.p)}`)
  const [figResiduals, figCoef] = figuresOf(spec) // #11: residual diagnostics, then the coefficient plot
  return {
    tables: [{ spec: t, rows }],
    note: spec.tableNote ?? null,
    figures: [
      { caption: figResiduals.caption, type: figResiduals.type, file: figResiduals.file, png: r.figResidualsPng },
      { caption: figCoef.caption, type: figCoef.type, file: figCoef.file, png: r.figCoefPlotPng },
    ],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
