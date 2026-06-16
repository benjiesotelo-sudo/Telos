import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { SimpleLinearResult } from '../stats/simpleLinearRegression'
import type { CardContent } from './builders'
import { f, f01, fdf, fpApa } from '../format/apa'

// modelsummary coef table (design 2026-06-16) — the WORKED REFERENCE for the 13 coef tests.
// Per term: estimate row → muted (SE) row → muted [CI] row. Then a rule, then one gof row per spec.tables[0].gof.
// No significance stars anywhere (D1). β is a kept per-term column (extraCols); intercept β stays blank (convention 1).
export function buildSimpleLinearRegression(spec: TestSpec, r: SimpleLinearResult): CardContent {
  const t = spec.tables[0]
  const gofValue: Record<string, string> = {
    n: String(r.n), r2: f(r.r2), adjr2: f(r.adjR2), f: f(r.f),
    rmse: f(r.rmse), aic: f(r.aic), bic: f(r.bic), ll: f(r.logLik),
  }
  const rows: Record<string, string | number>[] = [
    ...r.terms.flatMap((x) => [
      { _kind: 'coef', term: x.term, est: f(x.b), beta: x.beta == null ? '' : f(x.beta) },
      { _kind: 'se', term: '', est: `(${f(x.se)})`, beta: '' },
      { _kind: 'ci', term: '', est: `[${f(x.ciLow)}, ${f(x.ciHigh)}]`, beta: '' },
    ]),
    { _kind: 'rule' },
    ...t.gof!.map((g) => ({ _kind: 'gof', term: g.label, est: gofValue[g.key] })),
  ]
  const pred = r.terms.find((x) => x.term !== '(Intercept)')! // APA fills from the predictor row (recorded decision 3)
  const apa = spec.apaTemplate
    .replace('{b}', f(pred.b)).replace('{df}', fdf(r.df2)).replace('{t}', f(pred.t))
    .replace('{p}', fpApa(pred.p))
    .replace('{r2}', f01(r.r2))
  const figs = figuresOf(spec)
  return {
    tables: [{ spec: t, rows }],
    note: spec.tableNote ?? null,
    figures: [
      { caption: 'Fitted-line scatter', type: figs[0].type, file: figs[0].file, png: r.figFitPng },
      { caption: 'Residual diagnostics', type: figs[1].type, file: figs[1].file, png: r.figResidualsPng },
    ],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
