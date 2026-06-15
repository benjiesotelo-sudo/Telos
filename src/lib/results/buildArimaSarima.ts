import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { ArimaSarimaResult } from '../stats/arimaSarima'
import type { CardContent } from './builders'
import { f, fpApa } from '../format/apa'

export function buildArimaSarima(spec: TestSpec, r: ArimaSarimaResult): CardContent {
  // {pdq} → p,d,q · {PDQ} → P,D,Q (with [s] suffix when a seasonal period > 1 is in play).
  const pdq = `${r.p},${r.d},${r.q}`
  const PDQ = `${r.P},${r.D},${r.Q}` + (r.s > 1 ? `[${r.s}]` : '')
  const summaryRows = r.coefs.map((c) => ({
    term: c.term, estimate: f(c.estimate), se: f(c.se),
    ci: `[${f(c.ciLow)}, ${f(c.ciHigh)}]`,
  }))
  const diagnosticRows = [{
    aic: f(r.aic), bic: f(r.bic), loglik: f(r.loglik), sigma2: f(r.sigma2),
    ljungbox_p: fpApa(r.ljungboxP),
  }]
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
      { spec: spec.tables[1], rows: diagnosticRows },
      { spec: spec.tables[2], rows: forecastRows },
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
