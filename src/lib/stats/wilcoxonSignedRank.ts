import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

const R_STATS = String.raw`
d <- a - b
rk <- rank(abs(d)); sg <- sign(d)
srow <- function(label, idx) list(sign=label, n=length(idx),
  meanRank=if (length(idx)) mean(rk[idx]) else NA_real_, sumRanks=sum(rk[idx]))
# Default path: R decides exact vs approx (R 4.6.0: EXACT even with ties — spike fact 1).
# force_approx is the known-answer hook for the asymptotic path, where correct= (the continuity pill) matters.
wt <- if (force_approx) wilcox.test(a, b, paired=TRUE, exact=FALSE, correct=continuity)
      else wilcox.test(a, b, paired=TRUE, correct=continuity)
zt <- coin::wilcoxsign_test(a ~ b)
rb <- effectsize::rank_biserial(a, b, paired=TRUE)
list(ranks=list(srow('Positive', which(sg > 0)), srow('Negative', which(sg < 0)), srow('Ties', which(sg == 0))),
  v=unname(wt$statistic), z=as.numeric(coin::statistic(zt)), p=wt$p.value,
  r=rb$r_rank_biserial, method=wt$method)`

// Difference plot ("Change per case", type: difference) — ggplot2 per the architecture doc; print() renders into png().
const R_DIFFPLOT = String.raw`
print(ggplot2::ggplot(data.frame(case = factor(seq_along(a)), d = a - b), ggplot2::aes(case, d)) +
  ggplot2::geom_col(fill = '#9cc2ec', colour = '#0c447c') +
  ggplot2::geom_hline(yintercept = 0, colour = '#0c447c') +
  ggplot2::labs(x = 'Case', y = 'Difference (A - B)'))`

export interface SignedRankRow { sign: 'Positive' | 'Negative' | 'Ties'; n: number; meanRank: number | null; sumRanks: number }
export interface WilcoxonSignedRankResult {
  ranks: [SignedRankRow, SignedRankRow, SignedRankRow]   // Positive, Negative, Ties — card row order
  v: number; z: number; p: number; r: number; method: string
  alpha: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}
interface RawStats { ranks: SignedRankRow[]; v: number; z: number; p: number; r: number; method: string }

export async function runWilcoxonSignedRank(
  engine: Engine, data: Dataset, conditionA: string, conditionB: string, continuity: boolean, forceApprox = false, alpha = 0.05,
): Promise<WilcoxonSignedRankResult> {
  // Complete pairs (card's missing-data unit): keep rows where BOTH condition columns are numeric-finite.
  const rows = data.rows.filter((r) =>
    typeof r[conditionA] === 'number' && Number.isFinite(r[conditionA] as number) &&
    typeof r[conditionB] === 'number' && Number.isFinite(r[conditionB] as number))
  const nExcluded = data.rows.length - rows.length
  const env = { a: rows.map((r) => r[conditionA] as number), b: rows.map((r) => r[conditionB] as number), continuity, force_approx: forceApprox }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_DIFFPLOT, 600, 450, env)
  return { ranks: [s.ranks[0], s.ranks[1], s.ranks[2]], v: s.v, z: s.z, p: s.p, r: s.r, method: s.method, alpha, nExcluded, figurePng }
}
