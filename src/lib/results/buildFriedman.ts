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
  // U8-T4: rank-summary rows span 2+ conditions, so meanRank has no single run-level value — report the
  // low/high condition, same aggregate-framing precedent as multiple-linear-regression's vifMax. The
  // strongest (smallest-p_adj) Nemenyi pair anchors padj.
  const byMeanRank = [...r.ranks].sort((a, b) => a.meanRank - b.meanRank)
  const strongest = r.posthoc.length ? [...r.posthoc].sort((a, b) => a.pAdj - b.pAdj)[0] : null
  return {
    tables: [
      { spec: spec.tables[0], rows: r.ranks.map((rk) => ({ condition: rk.condition, meanRank: f(rk.meanRank) })) },
      { spec: spec.tables[1], rows: [{ chi2: f(r.chi2), df: fdf(r.df), p: fp(r.p), w: `${f(r.w)} [${f(r.wLow)}, ${f(r.wHigh)}]` }] },
      { spec: spec.tables[2], rows: r.posthoc.map((ph) => ({ pair: ph.pair, padj: fp(ph.pAdj) })) },
    ],
    note: null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    // R1 gap-fix: N subjects was computed but never rendered — appended at render time (like the α clause
    // already here), so no registry/docs/specs/telos_test_outputs.html change is needed (this card has no tableNote).
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}. N = ${r.n} subjects.`,
    apa,
    nExcluded: r.nExcluded,
    values: {
      chi2: f(r.chi2), df: fdf(r.df), p: fpApa(r.p), w: f(r.w), wlo: f(r.wLow), whi: f(r.wHigh),
      conditionNames: r.ranks.map((rk) => rk.condition).join(', '),
      meanRankLowCond: byMeanRank[0].condition, meanRankLowVal: f(byMeanRank[0].meanRank),
      meanRankHighCond: byMeanRank[byMeanRank.length - 1].condition, meanRankHighVal: f(byMeanRank[byMeanRank.length - 1].meanRank),
      padj: strongest ? fp(strongest.pAdj) : undefined,
      padjPair: strongest?.pair,
      n: String(r.n),
    },
  }
}
