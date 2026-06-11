import type { TestSpec } from '../registry/types'
import type { CardContent } from './builders'
import type { WilcoxonSignedRankResult } from '../stats/wilcoxonSignedRank'
import { f, fp, fx } from '../format/apa'

export function buildWilcoxonSignedRank(spec: TestSpec, r: WilcoxonSignedRankResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{z}', f(r.z))
    .replace('p={p}', r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`)
    .replace('{r}', f(r.r))
  const fig = spec.figures![0]
  return {
    tables: [
      { spec: spec.tables[0], rows: r.ranks.map((row) => ({ sign: row.sign, n: row.n, meanRank: fx(row.meanRank, f), sumRanks: f(row.sumRanks) })) },
      { spec: spec.tables[1], rows: [{ v: f(r.v), z: f(r.z), p: fp(r.p), r: f(r.r) }] },
    ],
    note: null, // the drawn Wilcoxon card has no table note (design ruling)
    figures: [{ caption: fig.caption, type: fig.type, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
