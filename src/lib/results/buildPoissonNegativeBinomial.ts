import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { PoissonNbResult } from '../stats/poissonNegativeBinomial'
import type { CardContent } from './builders'
import { f, fdf, fp, fpApa } from '../format/apa'

// SE (and B) cells: fall back to 3-decimal precision when the value rounds to 0.00 at 2 dp (|x| < 0.01).
const fCoef = (n: number) => Math.abs(n) < 0.01 ? (n < 0 ? '−' : '') + Math.abs(n).toFixed(3) : f(n)

export function buildPoissonNegativeBinomial(spec: TestSpec, r: PoissonNbResult): CardContent {
  const pct = Math.round(r.ciLevel * 100)
  const ciLabel = `${pct}% CI (IRR)`
  // Convention 10 / recorded decision 10: the Dispersion cell carries the Pearson ratio (Poisson) or theta (NB) —
  // same drawn column either way; the card-literal note explains the swap.
  const coefRows = r.terms.map((x) => ({
    term: x.term, b: fCoef(x.b), se: fCoef(x.se), z: f(x.z), p: fp(x.p),
    irr: f(x.irr), ci: `[${f(x.irrLow)}, ${f(x.irrHigh)}]`,
  }))
  const first = r.terms.find((x) => x.term !== '(Intercept)')! // APA "Predictor X" = first coefficient row (recorded decision 3)
  const apa = spec.apaTemplate
    .replace('Predictor X', `Predictor ${first.term}`)
    .replace('{irr}', f(first.irr))
    .replace('95% CI', `${pct}% CI`)
    .replace('{ciLow}', f(first.irrLow)).replace('{ciHigh}', f(first.irrHigh))
    .replace('{p}', fpApa(first.p))
  const fig = figuresOf(spec)[0]
  const t2cols = spec.tables[1].columns.map((c) => c.key === 'ci' ? { ...c, label: ciLabel } : c)
  // Dispersion note is model-aware: Poisson advises on the ratio; NB describes theta.
  const note: CardContent['note'] = r.model === 'negative binomial'
    ? { kind: 'assume', text: 'Dispersion cell = theta (the negative binomial overdispersion parameter); larger theta means the model is less over-dispersed relative to Poisson.' }
    : (spec.tableNote ?? null)
  return {
    tables: [
      { spec: spec.tables[0], rows: [{ aic: f(r.aic), dev: f(r.deviance), df: fdf(r.dfResid), dispersion: f(r.dispersion) }] },
      { spec: { ...spec.tables[1], columns: t2cols }, rows: coefRows },
    ],
    note,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figResidualsPng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
