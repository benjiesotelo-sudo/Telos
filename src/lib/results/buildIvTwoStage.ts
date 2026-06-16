import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { IvResult } from '../stats/ivTwoStage'
import type { CardContent } from './builders'
import { f, fp, fpApa } from '../format/apa'

// modelsummary coef table (design 2026-06-16): the 2SLS table becomes a side-by-side OLS|2SLS coef table (SHAPE B).
// Per term: estimate {ols,iv} row → muted (SE) row → muted [CI] row. Then a rule, the gof footer (Num.Obs/RMSE/F),
// then span rows for the §2.8 diagnostics (weak-IV F, Wu–Hausman, Sargan). NO stars (D1). ivreg has NO aic/bic/logLik.
// The First-stage table (Table 1) stays a classic table, unchanged.
export function buildIvTwoStage(spec: TestSpec, r: IvResult): CardContent {
  const firstStageRows = r.firstStage.map((x) => ({ instrument: x.instrument, coef: f(x.coef), se: f(x.se), partialF: f(x.partialF), p: fp(x.p) }))
  const t2 = spec.tables[1]
  const gofValue: Record<string, string> = { n: String(r.nObs), rmse: f(r.rmse), structF: f(r.structF) }
  const sargan = r.sargan == null ? '— (just-identified)' : `${f(r.sargan)}, p ${fpApa(r.sarganP ?? 1)}`
  const coefRows: Record<string, string | number>[] = [
    ...r.coefRows.flatMap((x) => [
      { _kind: 'coef', term: x.term, ols: f(x.olsB), iv: f(x.b) },
      { _kind: 'se', term: '', ols: `(${f(x.olsSe)})`, iv: `(${f(x.se)})` },
      { _kind: 'ci', term: '', ols: `[${f(x.olsCiLow)}, ${f(x.olsCiHigh)}]`, iv: `[${f(x.ciLow)}, ${f(x.ciHigh)}]` },
    ]),
    { _kind: 'rule' },
    ...t2.gof!.map((g) => ({ _kind: 'gof', term: g.label, iv: gofValue[g.key] })),
    // §2.8 diagnostics surfaced as full-width span rows (weak instruments, Wu–Hausman, Sargan).
    { _kind: 'span', term: `Weak-instrument F = ${f(r.weakF)}, p ${fpApa(r.weakP)} (rule of thumb: F > 10)` },
    { _kind: 'span', term: `Wu–Hausman = ${f(r.wuF)}, p ${fpApa(r.wuP)}` },
    { _kind: 'span', term: `Sargan: ${sargan}` },
  ]
  const endo = r.endogenous[0]
  const endoCoef = r.coefRows.find((x) => x.term === endo)
  const apa = spec.apaTemplate
    .replace('for X was', `for ${endo ?? 'the endogenous regressor'} was`)
    .replace('{b}', endoCoef ? f(endoCoef.b) : '—')
    .replace('p {p}', `p ${endoCoef ? fpApa(endoCoef.p) : '—'}`)
    .replace('{f}', f(r.weakF))
  const figs = figuresOf(spec)
  return {
    tables: [
      { spec: spec.tables[0], rows: firstStageRows },
      { spec: t2, rows: coefRows },
    ],
    note: spec.tableNote ?? null,
    figures: [{ caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figCoefPng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
