import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { FriedmanResult } from '../stats/friedman'
import type { CardContent } from './builders'
import { f, fdf, fp } from '../format/apa'

export function buildFriedman(spec: TestSpec, r: FriedmanResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{df}', fdf(r.df))
    .replace('{chi2}', f(r.chi2))
    .replace('p={p}', r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`)
    .replace('{w}', f(r.w))
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: r.ranks.map((rk) => ({ condition: rk.condition, meanRank: f(rk.meanRank) })) },
      { spec: spec.tables[1], rows: [{ chi2: f(r.chi2), df: fdf(r.df), p: fp(r.p), w: f(r.w) }] },
      { spec: spec.tables[2], rows: r.posthoc.map((ph) => ({ pair: ph.pair, padj: fp(ph.pAdj) })) },
    ],
    note: null,
    figures: [{ caption: fig.caption, type: fig.type, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
