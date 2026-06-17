import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { FriedmanResult } from '../stats/friedman'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa } from '../format/apa'

export function buildFriedman(spec: TestSpec, r: FriedmanResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{df}', fdf(r.df))
    .replace('{chi2}', f(r.chi2))
    .replace('p={p}', `p ${fpApa(r.p)}`)
    .replace('{w}', f01(r.w)).replace('{wlo}', f01(r.wLow)).replace('{whi}', f01(r.wHigh))
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: r.ranks.map((rk) => ({ condition: rk.condition, meanRank: f(rk.meanRank) })) },
      { spec: spec.tables[1], rows: [{ chi2: f(r.chi2), df: fdf(r.df), p: fp(r.p), w: `${f(r.w)} [${f(r.wLow)}, ${f(r.wHigh)}]` }] },
      { spec: spec.tables[2], rows: r.posthoc.map((ph) => ({ pair: ph.pair, padj: fp(ph.pAdj) })) },
    ],
    note: null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
