import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { KruskalWallisResult } from '../stats/kruskalWallis'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa } from '../format/apa'

export function buildKruskalWallis(spec: TestSpec, r: KruskalWallisResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{df}', fdf(r.df)).replace('{h}', f(r.h))
    .replace('{p}', fpApa(r.p))
    .replace('{eps2}', f01(r.eps2))
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: r.ranks.map((g) => ({ group: g.group, n: g.n, meanRank: f(g.meanRank) })) },
      { spec: spec.tables[1], rows: [{ h: f(r.h), df: fdf(r.df), p: fp(r.p), eps2: f(r.eps2) }] },
      { spec: spec.tables[2], rows: r.posthoc.map((d) => ({ pair: d.pair, z: f(d.z), padj: fp(d.pAdj) })) },
    ],
    note: null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
