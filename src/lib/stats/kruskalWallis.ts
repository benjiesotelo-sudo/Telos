import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface RankSummaryRow { group: string; n: number; meanRank: number }
export interface DunnRow { pair: string; z: number; pAdj: number }
export interface KruskalWallisResult {
  ranks: RankSummaryRow[]
  h: number; df: number; p: number; eps2: number
  posthoc: DunnRow[]
  alpha: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

const R_STATS = String.raw`
gf <- factor(g)
kw <- kruskal.test(y ~ gf)
rk <- rank(y)
ranks <- lapply(levels(gf), function(l) { v <- rk[gf == l]; list(group = l, n = length(v), meanRank = mean(v)) })
n <- length(y); h <- unname(kw$statistic)
eps2 <- h * (n + 1) / (n^2 - 1)  # equivalent to effectsize::rank_epsilon_squared (spike-proven)
dn <- rstatix::dunn_test(data.frame(y = y, g = gf), y ~ g, p.adjust.method = 'holm')
ph <- lapply(seq_len(nrow(dn)), function(i) list(pair = paste(dn$group1[i], '-', dn$group2[i]),
  z = dn$statistic[i], pAdj = dn$p.adj[i]))
list(ranks = ranks, h = h, df = unname(kw$parameter), p = kw$p.value, eps2 = eps2, posthoc = ph)`

// Same boxplot as the Mann-Whitney U (card figure type: boxplot); print() renders into the active png() device.
const R_BOXPLOT = String.raw`
print(ggplot2::ggplot(data.frame(group = factor(g), score = y), ggplot2::aes(group, score)) +
  ggplot2::geom_boxplot(fill = '#9cc2ec', colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL))`

interface RawStats { ranks: RankSummaryRow[]; h: number; df: number; p: number; eps2: number; posthoc: DunnRow[] }

export async function runKruskalWallis(engine: Engine, data: Dataset, outcome: string, group: string, alpha = 0.05): Promise<KruskalWallisResult> {
  // Per-test listwise: drop rows missing/non-numeric in either role column.
  const rows = data.rows.filter((r) =>
    typeof r[outcome] === 'number' && Number.isFinite(r[outcome] as number) && r[group] != null && String(r[group]).trim() !== '')
  const nExcluded = data.rows.length - rows.length
  const env = { y: rows.map((r) => r[outcome] as number), g: rows.map((r) => String(r[group])) }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_BOXPLOT, 600, 450, env)
  return { ...s, alpha, nExcluded, figurePng }
}
