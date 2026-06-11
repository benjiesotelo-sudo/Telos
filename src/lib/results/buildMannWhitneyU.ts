import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { MannWhitneyUResult } from '../stats/mannWhitneyU'
import type { CardContent } from './builders'
import { f, fdf, fp } from '../format/apa'

export function buildMannWhitneyU(spec: TestSpec, r: MannWhitneyUResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{u}', fdf(r.u)).replace('{z}', f(r.z))
    .replace('p={p}', r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`)
    .replace('{r}', f(r.rankBiserial))
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: r.ranks.map((g) => ({ group: g.group, n: g.n, meanRank: f(g.meanRank), sumRanks: f(g.sumRanks) })) },
      { spec: spec.tables[1], rows: [{ u: fdf(r.u), z: f(r.z), p: fp(r.p), r: f(r.rankBiserial) }] },
    ],
    note: spec.tableNote ?? null,
    figures: [{ caption: fig.caption, type: fig.type, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
