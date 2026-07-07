import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { ChiSquareGofResult } from '../stats/chiSquareGof'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa } from '../format/apa'

// A5: per-category rows (observed/expected/stdres) have no single row to bind to, so those explainers
// report the range across categories — a real aggregate of the already-computed per-category numbers.
const rangeInt = (nums: number[]) => {
  if (!nums.length) return '—'
  const lo = Math.min(...nums), hi = Math.max(...nums)
  return lo === hi ? String(lo) : `${lo}–${hi}`
}
const rangeF = (nums: number[]) => {
  if (!nums.length) return '—'
  const lo = Math.min(...nums), hi = Math.max(...nums)
  return lo === hi ? f(lo) : `${f(lo)}–${f(hi)}`
}

export function buildChiSquareGof(spec: TestSpec, r: ChiSquareGofResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{df}', fdf(r.df)) // the drawn "k−1" slot carries the real df at runtime (recorded decision 2)
    .replace('{n}', String(r.n)).replace('{chisq}', f(r.chisq))
    .replace('{p}', fpApa(r.p))
    .replace('{w}', f01(r.w)).replace('{lo}', f01(r.wLow)).replace('{hi}', f01(r.wHigh))
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: r.rows.map((x) => ({ category: x.category, observed: x.observed, expected: f(x.expected), stdres: f(x.stdRes) })) },
      { spec: spec.tables[1], rows: [{ chisq: f(r.chisq), df: fdf(r.df), p: fp(r.p), w: `${f(r.w)} [${f(r.wLow)}, ${f(r.wHigh)}]` }] },
    ],
    note: spec.tableNote ?? null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
    values: {
      category: String(r.rows.length),
      observed: rangeInt(r.rows.map((x) => x.observed)),
      expected: rangeF(r.rows.map((x) => x.expected)),
      stdres: rangeF(r.rows.map((x) => Math.abs(x.stdRes))),
      chisq: f(r.chisq), df: fdf(r.df), n: String(r.n), p: fpApa(r.p), alpha: String(r.alpha),
      w: f01(r.w), wLow: f01(r.wLow), wHigh: f01(r.wHigh),
    },
  }
}
