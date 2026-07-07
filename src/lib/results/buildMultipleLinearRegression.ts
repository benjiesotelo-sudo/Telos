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
      // R1 gap-fix: β CI stacks under the β point estimate on the muted [CI] row (ApaTable renders any
      // populated cell — no new column/renderer change needed), masked by the same standardize toggle.
      const betaCi = isInt || !r.standardize || x.betaLo == null || x.betaHi == null ? '' : `[${f(x.betaLo)}, ${f(x.betaHi)}]`
      return [
        { _kind: 'coef', term: x.term, est: f(x.b), beta, vif },
        { _kind: 'se', term: '', est: `(${f(x.se)})`, beta: '', vif: '' },
        { _kind: 'ci', term: '', est: `[${f(x.ciLow)}, ${f(x.ciHigh)}]`, beta: betaCi, vif: '' },
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
  // vifMax (U8-T3) is synthesized here, not a native-R field of its own: the largest VIF across every
  // reported term (documented per T1-review MUST), reusing the exact per-term `x.vif` numbers already
  // read above — undefined (not 0/NaN) when every term's VIF is null (k = 1 predictor, VIF undefined).
  const vifs = r.terms.map((x) => x.vif).filter((v): v is number => v != null)
  const vifMax = vifs.length ? f(Math.max(...vifs)) : undefined
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
    // Keyed to match the 'multiple-linear-regression' EXPLAINERS entries (r2, vif, rmse, adjr2, aic, bic,
    // ll, n, f, est, beta) in registry/explainers.ts. est/beta come from the SAME first-predictor row
    // already picked out for the APA sentence above; beta is left absent (not "—") when standardize is
    // off, since the interpret() line then simply doesn't render (TermExplainers' undefined-guard),
    // matching how the table itself renders '—' for an off-toggle beta cell but there is no live number
    // to interpret.
    values: {
      r2: f01(r.r2), vifMax, rmse: f(r.rmse), adjr2: f(r.adjR2), aic: f(r.aic), bic: f(r.bic), ll: f(r.logLik), n: r.n, f: f(r.f),
      est: f(first.b), beta: r.standardize && first.beta != null ? f(first.beta) : undefined, term: first.term,
      betaLo: r.standardize && first.betaLo != null ? f(first.betaLo) : undefined,
      betaHi: r.standardize && first.betaHi != null ? f(first.betaHi) : undefined,
    },
  }
}
