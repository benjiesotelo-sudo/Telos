import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface GroupDescRow { group: string; n: number; m: number; sd: number }
export interface GamesHowellRow { pair: string; diff: number; pAdj: number; ciLo: number; ciHi: number }
export interface WelchAnovaResult {
  desc: GroupDescRow[]
  f: number; df1: number; df2: number; p: number
  posthoc: GamesHowellRow[]
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

const R_STATS = String.raw`
gf <- factor(g)
res <- oneway.test(y ~ gf, var.equal = FALSE)
desc <- lapply(levels(gf), function(l) { v <- y[gf == l]; list(group = l, n = length(v), m = mean(v), sd = sd(v)) })
gh <- rstatix::games_howell_test(data.frame(y = y, g = gf), y ~ g)
ph <- lapply(seq_len(nrow(gh)), function(i) list(pair = paste(gh$group1[i], '-', gh$group2[i]),
  diff = -gh$estimate[i], pAdj = gh$p.adj[i], ciLo = -gh$conf.high[i], ciHi = -gh$conf.low[i]))
list(desc = desc, f = unname(res$statistic), df1 = unname(res$parameter[1]), df2 = unname(res$parameter[2]),
  p = res$p.value, posthoc = ph)`

// Means plot with t-based 95% CI error bars (card figure; no Hmisc — computed in R).
const R_FIGURE = String.raw`
gf <- factor(g)
agg <- data.frame(g = levels(gf), m = as.numeric(tapply(y, gf, mean)))
n <- as.numeric(tapply(y, gf, length)); sdv <- as.numeric(tapply(y, gf, sd))
se <- sdv / sqrt(n); tq <- qt(0.975, n - 1)
agg$lo <- agg$m - tq * se; agg$hi <- agg$m + tq * se
print(ggplot2::ggplot(agg, ggplot2::aes(g, m)) +
  ggplot2::geom_pointrange(ggplot2::aes(ymin = lo, ymax = hi), colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL))`

interface RawStats { desc: GroupDescRow[]; f: number; df1: number; df2: number; p: number; posthoc: GamesHowellRow[] }

export async function runWelchAnova(engine: Engine, data: Dataset, outcome: string, factor: string): Promise<WelchAnovaResult> {
  // Per-test listwise: drop rows missing/non-numeric in outcome or blank in factor.
  const rows = data.rows.filter((r) =>
    typeof r[outcome] === 'number' && Number.isFinite(r[outcome] as number) && r[factor] != null && String(r[factor]).trim() !== '')
  const nExcluded = data.rows.length - rows.length
  const env = { y: rows.map((r) => r[outcome] as number), g: rows.map((r) => String(r[factor])) }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_FIGURE, 600, 450, env)
  return { ...s, nExcluded, figurePng }
}
