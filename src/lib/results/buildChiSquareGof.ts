import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { ChiSquareGofResult } from '../stats/chiSquareGof'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa } from '../format/apa'

export function buildChiSquareGof(spec: TestSpec, r: ChiSquareGofResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{df}', fdf(r.df)) // the drawn "k−1" slot carries the real df at runtime (recorded decision 2)
    .replace('{n}', String(r.n)).replace('{chisq}', f(r.chisq))
    .replace('{p}', fpApa(r.p))
    .replace('{w}', f01(r.w))
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: r.rows.map((x) => ({ category: x.category, observed: x.observed, expected: f(x.expected), stdres: f(x.stdRes) })) },
      { spec: spec.tables[1], rows: [{ chisq: f(r.chisq), df: fdf(r.df), p: fp(r.p), w: f(r.w) }] },
    ],
    note: spec.tableNote ?? null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
