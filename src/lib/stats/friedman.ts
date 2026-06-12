import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface RankSummaryRow { condition: string; meanRank: number }
export interface NemenyiRow { pair: string; pAdj: number }
export interface FriedmanResult {
  ranks: RankSummaryRow[]
  chi2: number; df: number; p: number; w: number
  posthoc: NemenyiRow[]
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

// Hand-rolled Nemenyi: spike-validated ≡ native PMCMRplus 1.9.12.
// PMCMRplus cannot load under WebR (Rmpfr lacks a wasm binary).
// q = (Rbar_j - Rbar_i) / sqrt(k*(k+1)/(6*n)); p = ptukey(|q|*sqrt(2), k, Inf, lower.tail=FALSE)
const R_STATS = String.raw`
mat <- matrix(scores_flat, ncol = length(conds), dimnames = list(NULL, conds))
ft <- friedman.test(mat)
k <- ncol(mat); n2 <- nrow(mat)
rk <- t(apply(mat, 1, rank)); rbar <- colMeans(rk)
ranks <- lapply(seq_len(k), function(i) list(condition = conds[i], meanRank = rbar[i]))
chi2 <- unname(ft$statistic)
w <- chi2 / (n2 * (k - 1))
ph <- list()
for (i in 1:(k - 1)) for (j in (i + 1):k) {
  q <- (rbar[j] - rbar[i]) / sqrt(k * (k + 1) / (6 * n2))
  ph[[length(ph) + 1]] <- list(pair = paste(conds[i], '-', conds[j]),
    pAdj = ptukey(abs(q) * sqrt(2), k, Inf, lower.tail = FALSE))
}
list(ranks = ranks, chi2 = chi2, df = unname(ft$parameter), p = ft$p.value, w = w, posthoc = ph)`

// Profile plot: single line of condition means ± CI — Task 9 recipe adapted for Friedman.
const R_FIGURE = String.raw`
mat <- matrix(scores_flat, ncol = length(conds), dimnames = list(NULL, conds))
mm <- colMeans(mat); sdv <- apply(mat, 2, sd); se <- sdv / sqrt(nrow(mat)); tq <- qt(0.975, nrow(mat) - 1)
agg <- data.frame(cond = factor(conds, levels = conds), m = mm, lo = mm - tq * se, hi = mm + tq * se)
print(ggplot2::ggplot(agg, ggplot2::aes(cond, m, group = 1)) + ggplot2::geom_line(colour = '#0c447c') +
  ggplot2::geom_pointrange(ggplot2::aes(ymin = lo, ymax = hi), colour = '#0c447c') + ggplot2::labs(x = NULL, y = NULL))`

interface RawStats { ranks: RankSummaryRow[]; chi2: number; df: number; p: number; w: number; posthoc: NemenyiRow[] }

export async function runFriedman(engine: Engine, data: Dataset, subject: string, measures: string[]): Promise<FriedmanResult> {
  // Listwise: keep rows where subject is non-blank AND all chosen measure columns are numeric-finite.
  const rows = data.rows.filter((r) => {
    if (r[subject] == null || String(r[subject]).trim() === '') return false
    return measures.every((m) => typeof r[m] === 'number' && Number.isFinite(r[m] as number))
  })
  const nExcluded = data.rows.length - rows.length
  const n = rows.length
  // condition-major flat array: all rows for cond[0], then cond[1], ...
  const scoresFlat = measures.flatMap((m) => rows.map((r) => r[m] as number))
  const env = { conds: measures, scores_flat: scoresFlat, n }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_FIGURE, 600, 450, env)
  return { ranks: s.ranks, chi2: s.chi2, df: s.df, p: s.p, w: s.w, posthoc: s.posthoc, nExcluded, figurePng }
}
