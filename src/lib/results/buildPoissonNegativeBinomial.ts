import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { PoissonNbResult } from '../stats/poissonNegativeBinomial'
import type { CardContent } from './builders'
import { f, fdf, fp } from '../format/apa'

export function buildPoissonNegativeBinomial(spec: TestSpec, r: PoissonNbResult): CardContent {
  // Convention 10 / recorded decision 10: the Dispersion cell carries the Pearson ratio (Poisson) or theta (NB) —
  // same drawn column either way; the card-literal note explains the swap.
  const coefRows = r.terms.map((x) => ({
    term: x.term, b: f(x.b), se: f(x.se), z: f(x.z), p: fp(x.p),
    irr: f(x.irr), ci: `[${f(x.irrLow)}, ${f(x.irrHigh)}]`,
  }))
  const first = r.terms.find((x) => x.term !== '(Intercept)')! // APA "Predictor X" = first coefficient row (recorded decision 3)
  const apa = spec.apaTemplate
    .replace('Predictor X', `Predictor ${first.term}`)
    .replace('{irr}', f(first.irr))
    .replace('{ciLow}', f(first.irrLow)).replace('{ciHigh}', f(first.irrHigh))
    .replace('p={p}', first.p < 0.001 ? 'p<.001' : `p=${fp(first.p)}`)
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: [{ aic: f(r.aic), dev: f(r.deviance), df: fdf(r.dfResid), dispersion: f(r.dispersion) }] },
      { spec: spec.tables[1], rows: coefRows },
    ],
    note: spec.tableNote ?? null, // card-literal/static (convention 10)
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figResidualsPng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
