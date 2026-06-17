import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { ArimaSarimaResult } from '../stats/arimaSarima'
import type { CardContent } from './builders'
import { f, fp, fpApa, fx, fdf } from '../format/apa'

// modelsummary coef table (design 2026-06-16): Table 1 (Model summary) + Table 2 (diagnostics)
// merge into ONE stacked coef table. Per ARIMA term: estimate row → muted (SE) → muted [CI].
// Then a rule, then one gof row per spec.tables[0].gof. No significance stars (D1) — ARIMA has
// no per-coef z/p anyway. Forecast stays a classic table; the σ² + Ljung–Box p move to the footer.
export function buildArimaSarima(spec: TestSpec, r: ArimaSarimaResult): CardContent {
  const t = spec.tables[0]
  // {pdq} → p,d,q · {PDQ} → P,D,Q (with [s] suffix when a seasonal period > 1 is in play).
  const pdq = `${r.p},${r.d},${r.q}`
  const PDQ = `${r.P},${r.D},${r.Q}` + (r.s > 1 ? `[${r.s}]` : '')
  const gofValue: Record<string, string> = {
    n: String(r.n), sigma2: f(r.sigma2), ljungbox: fp(r.ljungboxP),
    aic: f(r.aic), bic: f(r.bic), ll: f(r.loglik),
  }
  // Ljung–Box residual-autocorrelation span row (econometrics convention; cf. buildIvTwoStage span rows):
  // Q(df) with the chosen lag and p. Q/df NA → em-dash via fx().
  const lbDf = fx(r.ljungboxDf, fdf)
  const ljungbox = `Ljung–Box Q(${lbDf}) = ${fx(r.ljungboxQ, f)}, p ${fpApa(r.ljungboxP)} (lag ${fx(r.ljungboxLag, fdf)}, residual autocorrelation)`
  const summaryRows: Record<string, string | number>[] = [
    ...r.coefs.flatMap((c) => [
      { _kind: 'coef', term: c.term, est: f(c.estimate) },
      { _kind: 'se', term: '', est: `(${f(c.se)})` },
      { _kind: 'ci', term: '', est: `[${f(c.ciLow)}, ${f(c.ciHigh)}]` },
    ]),
    { _kind: 'rule' },
    ...t.gof!.map((g) => ({ _kind: 'gof', term: g.label, est: gofValue[g.key] })),
    { _kind: 'span', term: ljungbox },
  ]
  const forecastRows = r.forecastRows.map((fr) => ({
    period: fr.period, forecast: f(fr.forecast),
    pi80: `[${f(fr.lo80)}, ${f(fr.hi80)}]`, pi95: `[${f(fr.lo95)}, ${f(fr.hi95)}]`,
  }))
  const apa = spec.apaTemplate
    .replace('{pdq}', pdq).replace('{PDQ}', PDQ)
    .replace('{aic}', f(r.aic)).replace('{ljungbox_p}', fpApa(r.ljungboxP))
  const figs = figuresOf(spec)
  return {
    tables: [
      { spec: spec.tables[0], rows: summaryRows },
      { spec: spec.tables[1], rows: forecastRows },
    ],
    note: spec.tableNote ?? null,
    figures: [
      { caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figForecastPng },
      { caption: figs[1].caption, type: figs[1].type, file: figs[1].file, png: r.figResidualsPng },
    ],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
