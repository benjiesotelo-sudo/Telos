import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface RankSummaryRow { group: string; n: number; meanRank: number; sumRanks: number }
export interface MannWhitneyUResult {
  ranks: [RankSummaryRow, RankSummaryRow]
  u: number; z: number; p: number; rankBiserial: number
  alpha: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

const R_STATS = String.raw`
g <- factor(group); lv <- levels(g)
df <- data.frame(score = score, g = g)
rk <- rank(score)  # pooled midranks — base equivalent of the card's "dplyr rank + group_by/summarise"
ranks <- lapply(lv, function(l) { v <- rk[g == l]; list(group = l, n = length(v), meanRank = mean(v), sumRanks = sum(v)) })
# Default run keeps wilcox.test's own path choice (R 4.6.0: EXACT at these N, even with ties — spike fact 1).
# correct= only matters on the asymptotic branch; force_approx pins exact=FALSE so the known-answer tests can
# verify both toggle positions (large-N/tied data reaches that branch on its own in real runs).
res <- if (force_approx) wilcox.test(score ~ g, data = df, exact = FALSE, correct = continuity)
       else wilcox.test(score ~ g, data = df, correct = continuity)
# wilcox.test W IS the Mann-Whitney U for the FIRST factor level (alphabetical) — spike-verified.
z <- as.numeric(coin::statistic(coin::wilcox_test(score ~ g, data = df)))  # asymptotic standardized Z (card R map)
r <- as.numeric(effectsize::rank_biserial(score ~ g, data = df)$r_rank_biserial)
list(ranks = ranks, u = unname(res$statistic), z = z, p = res$p.value, rankBiserial = r)`

// Same boxplot as the t-test's (card figure type: boxplot); print() renders into the active png() device.
const R_BOXPLOT = String.raw`
print(ggplot2::ggplot(data.frame(group = factor(group), score = score), ggplot2::aes(group, score)) +
  ggplot2::geom_boxplot(fill = '#9cc2ec', colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL))`

interface RawStats { ranks: RankSummaryRow[]; u: number; z: number; p: number; rankBiserial: number }

/** forceApprox is test-only (and the implicit large-N path): exact=FALSE pins the branch where correct= matters. */
export async function runMannWhitneyU(engine: Engine, data: Dataset, outcome: string, group: string,
  continuity: boolean, forceApprox = false, alpha = 0.05): Promise<MannWhitneyUResult> {
  // Per-test listwise (spec step-4a default): drop rows missing/non-numeric in either role column.
  const rows = data.rows.filter((r) =>
    typeof r[outcome] === 'number' && Number.isFinite(r[outcome] as number) && r[group] != null && String(r[group]).trim() !== '')
  const nExcluded = data.rows.length - rows.length
  const env = { score: rows.map((r) => r[outcome] as number), group: rows.map((r) => String(r[group])), continuity, force_approx: forceApprox }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_BOXPLOT, 600, 450, env)
  return { ranks: [s.ranks[0], s.ranks[1]], u: s.u, z: s.z, p: s.p, rankBiserial: s.rankBiserial, alpha, nExcluded, figurePng }
}
