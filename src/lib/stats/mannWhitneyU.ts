import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface RankSummaryRow { group: string; n: number; meanRank: number; median: number; iqr: number; sumRanks: number }
export interface MannWhitneyUResult {
  ranks: [RankSummaryRow, RankSummaryRow]
  u: number; z: number; p: number; rankBiserial: number
  rankBiserialLow: number; rankBiserialHigh: number  // effect-size CI (APA-7: report r WITH its CI); complete separation pins both to ±1 (boundary)
  hodgesLehmann: number | null; hlLow: number | null; hlHigh: number | null  // wilcox.test(conf.int=TRUE)$estimate / $conf.int — same branch as the test (APA-7: location-shift estimate + CI); guarded NA→null
  alpha: number
  tails: string
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

const R_STATS = String.raw`
g <- factor(group); lv <- levels(g)
df <- data.frame(score = score, g = g)
rk <- rank(score)  # pooled midranks — base equivalent of the card's "dplyr rank + group_by/summarise"
# Per-group median + IQR (APA-7 nonparametric descriptives): type-7 quantiles, the R/IQR() default — spike ground truth.
ranks <- lapply(lv, function(l) { v <- score[g == l]; r <- rk[g == l]; list(group = l, n = length(r), meanRank = mean(r), median = median(v), iqr = IQR(v), sumRanks = sum(r)) })
# Default run keeps wilcox.test's own path choice (R 4.6.0: EXACT at these N, even with ties — spike fact 1).
# correct= only matters on the asymptotic branch; force_approx pins exact=FALSE so the known-answer tests can
# verify both toggle positions (large-N/tied data reaches that branch on its own in real runs).
# conf.int=TRUE adds the Hodges-Lehmann location-shift estimate + CI on the SAME branch the test uses (spike: HL=-12, CI[-17,-7] on study.csv).
res <- if (force_approx) suppressWarnings(wilcox.test(score ~ g, data = df, exact = FALSE, correct = continuity, alternative = alternative, conf.int = TRUE))
       else suppressWarnings(wilcox.test(score ~ g, data = df, correct = continuity, alternative = alternative, conf.int = TRUE))
hl <- unname(res$estimate); hlci <- res$conf.int  # NA/Inf → null in the engine's JSON serializer (guarded)
# wilcox.test W IS the Mann-Whitney U for the FIRST factor level (alphabetical) — spike-verified.
z <- as.numeric(coin::statistic(coin::wilcox_test(score ~ g, data = df)))  # asymptotic standardized Z (card R map)
# effectsize::rank_biserial(ci=) reports r WITH its 95% CI (APA-7); complete separation pins r and both bounds to ±1 (boundary, spike-confirmed).
rb <- effectsize::rank_biserial(score ~ g, data = df, ci = 0.95)
list(ranks = ranks, u = unname(res$statistic), z = z, p = res$p.value,
  rankBiserial = rb$r_rank_biserial, rankBiserialLow = rb$CI_low, rankBiserialHigh = rb$CI_high,
  hodgesLehmann = hl, hlLow = hlci[1], hlHigh = hlci[2])`

// Same boxplot as the t-test's (card figure type: boxplot); print() renders into the active png() device.
const R_BOXPLOT = String.raw`
print(ggplot2::ggplot(data.frame(group = factor(group), score = score), ggplot2::aes(group, score)) +
  ggplot2::geom_boxplot(fill = '#9cc2ec', colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL))`

interface RawStats { ranks: RankSummaryRow[]; u: number; z: number; p: number; rankBiserial: number; rankBiserialLow: number; rankBiserialHigh: number; hodgesLehmann: number | null; hlLow: number | null; hlHigh: number | null }

/** forceApprox is test-only (and the implicit large-N path): exact=FALSE pins the branch where correct= matters. */
export async function runMannWhitneyU(engine: Engine, data: Dataset, outcome: string, group: string,
  continuity: boolean, forceApprox = false, alpha = 0.05, alternative = 'two.sided'): Promise<MannWhitneyUResult> {
  // Per-test listwise (spec step-4a default): drop rows missing/non-numeric in either role column.
  const rows = data.rows.filter((r) =>
    typeof r[outcome] === 'number' && Number.isFinite(r[outcome] as number) && r[group] != null && String(r[group]).trim() !== '')
  const nExcluded = data.rows.length - rows.length
  const env = { score: rows.map((r) => r[outcome] as number), group: rows.map((r) => String(r[group])), continuity, force_approx: forceApprox, alternative }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_BOXPLOT, 600, 450, env)
  return { ranks: [s.ranks[0], s.ranks[1]], u: s.u, z: s.z, p: s.p, rankBiserial: s.rankBiserial,
    rankBiserialLow: s.rankBiserialLow, rankBiserialHigh: s.rankBiserialHigh,
    hodgesLehmann: s.hodgesLehmann, hlLow: s.hlLow, hlHigh: s.hlHigh, alpha, tails: alternative, nExcluded, figurePng }
}
