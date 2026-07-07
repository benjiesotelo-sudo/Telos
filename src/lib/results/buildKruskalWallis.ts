import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { KruskalWallisResult } from '../stats/kruskalWallis'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa, fx } from '../format/apa'

export function buildKruskalWallis(spec: TestSpec, r: KruskalWallisResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{df}', fdf(r.df)).replace('{h}', f(r.h))
    .replace('{p}', fpApa(r.p))
    .replace('{eps2}', f01(r.eps2)).replace('{eps2lo}', f01(r.eps2Low)).replace('{eps2hi}', f01(r.eps2High))
  const fig = figuresOf(spec)[0]
  // U8-T4: rank-summary rows span 3+ groups, so meanRank/median/iqr have no single run-level value —
  // report the low/high group across each, same aggregate-framing precedent as multiple-linear-regression's
  // vifMax (explainers.consistency.test.ts's AGGREGATE_ALLOWLIST comment). n is summed across groups instead
  // (a genuine single total-N value). The strongest (smallest-p_adj) Dunn pair anchors both padj and z.
  const totalN = r.ranks.reduce((s, g) => s + g.n, 0)
  const byMeanRank = [...r.ranks].sort((a, b) => a.meanRank - b.meanRank)
  const byMedian = [...r.ranks].sort((a, b) => (a.median ?? 0) - (b.median ?? 0))
  const byIqr = [...r.ranks].sort((a, b) => (a.iqr ?? 0) - (b.iqr ?? 0))
  const strongest = r.posthoc.length ? [...r.posthoc].sort((a, b) => a.pAdj - b.pAdj)[0] : null
  return {
    tables: [
      { spec: spec.tables[0], rows: r.ranks.map((g) => ({ group: g.group, n: g.n, median: fx(g.median, f), iqr: fx(g.iqr, f), meanRank: f(g.meanRank) })) },
      { spec: spec.tables[1], rows: [{ h: f(r.h), df: fdf(r.df), p: fp(r.p), eps2: `${f(r.eps2)} [${f(r.eps2Low)}, ${f(r.eps2High)}]` }] },
      { spec: spec.tables[2], rows: r.posthoc.map((d) => ({ pair: d.pair, z: f(d.z), padj: fp(d.pAdj) })) },
    ],
    note: null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
    values: {
      h: f(r.h), df: fdf(r.df), p: fpApa(r.p), eps2: f(r.eps2), eps2lo: f(r.eps2Low), eps2hi: f(r.eps2High),
      n: String(totalN), alpha: String(r.alpha),
      meanRankLowGroup: byMeanRank[0].group, meanRankLowVal: f(byMeanRank[0].meanRank),
      meanRankHighGroup: byMeanRank[byMeanRank.length - 1].group, meanRankHighVal: f(byMeanRank[byMeanRank.length - 1].meanRank),
      medianLowGroup: byMedian[0].group, medianLowVal: fx(byMedian[0].median, f),
      medianHighGroup: byMedian[byMedian.length - 1].group, medianHighVal: fx(byMedian[byMedian.length - 1].median, f),
      iqrLowGroup: byIqr[0].group, iqrLowVal: fx(byIqr[0].iqr, f),
      iqrHighGroup: byIqr[byIqr.length - 1].group, iqrHighVal: fx(byIqr[byIqr.length - 1].iqr, f),
      padj: strongest ? fp(strongest.pAdj) : undefined,
      padjPair: strongest?.pair,
      z: strongest ? f(strongest.z) : undefined,
    },
  }
}
