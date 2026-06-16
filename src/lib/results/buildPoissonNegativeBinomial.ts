import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { PoissonNbResult } from '../stats/poissonNegativeBinomial'
import type { CardContent } from './builders'
import { f, fdf, fpApa } from '../format/apa'

// SE (and B) cells: fall back to 3-decimal precision when the value rounds to 0.00 at 2 dp (|x| < 0.01).
const fCoef = (n: number) => Math.abs(n) < 0.01 ? (n < 0 ? '−' : '') + Math.abs(n).toFixed(3) : f(n)

// modelsummary coef table (design 2026-06-16): the old Model fit + Coefficients merge into ONE stacked table.
// SHAPE A (exponentiated two-column B | IRR): per term a coef row (B, IRR) then a muted row — (SE) under
// Log-count (B), the IRR confidence interval under IRR. No significance stars (D1); z/p drop from the cell.
// Then a rule, then one gof row per spec.tables[0].gof. Dispersion is model-aware (Poisson ratio / NB θ) — the
// Dispersion footer label is static; the model-aware NOTE explains the swap (convention 10 / recorded decision 10).
export function buildPoissonNegativeBinomial(spec: TestSpec, r: PoissonNbResult): CardContent {
  const t = spec.tables[0]
  const gofValue: Record<string, string> = {
    n: String(r.n), dispersion: f(r.dispersion), dev: f(r.deviance), df: fdf(r.dfResid),
    ll: f(r.logLik), aic: f(r.aic), bic: f(r.bic),
  }
  const rows: Record<string, string | number>[] = [
    ...r.terms.flatMap((x) => [
      { _kind: 'coef', term: x.term, b: fCoef(x.b), irr: f(x.irr) },
      { _kind: 'se', term: '', b: `(${fCoef(x.se)})`, irr: `[${f(x.irrLow)}, ${f(x.irrHigh)}]` },
    ]),
    { _kind: 'rule' },
    ...t.gof!.map((g) => ({ _kind: 'gof', term: g.label, b: gofValue[g.key] })),
  ]
  const pct = Math.round(r.ciLevel * 100)
  const first = r.terms.find((x) => x.term !== '(Intercept)')! // APA "Predictor X" = first coefficient row (recorded decision 3)
  const apa = spec.apaTemplate
    .replace('Predictor X', `Predictor ${first.term}`)
    .replace('{irr}', f(first.irr))
    .replace('95% CI', `${pct}% CI`)
    .replace('{ciLow}', f(first.irrLow)).replace('{ciHigh}', f(first.irrHigh))
    .replace('{p}', fpApa(first.p))
  const fig = figuresOf(spec)[0]
  // Dispersion note is model-aware: Poisson advises on the ratio; NB describes theta.
  const note: CardContent['note'] = r.model === 'negative binomial'
    ? { kind: 'assume', text: 'Dispersion footer = theta (the negative binomial overdispersion parameter); larger theta means the model is less over-dispersed relative to Poisson.' }
    : (spec.tableNote ?? null)
  return {
    tables: [{ spec: t, rows }],
    note,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figResidualsPng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
