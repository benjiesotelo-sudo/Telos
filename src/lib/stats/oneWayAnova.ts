import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import { POSTHOC_EMM_R, type PosthocRow } from './posthoc'

export interface GroupDescRow { group: string; n: number; m: number; sd: number }
export interface OneWayAnovaResult {
  desc: GroupDescRow[]
  ssB: number; dfB: number; msB: number; f: number; p: number; eta2: number
  eta2Low: number; eta2High: number                // effect-size CI (APA-7: report η² WITH its CI); one-sided (upper pinned at 1.00), honors `level`
  ssW: number; dfW: number; msW: number
  levene: { F: number | null; p: number | null }
  shapiro: { W: number | null; p: number | null }
  posthoc: PosthocRow[]
  posthocMethod: string  // selected label e.g. 'Tukey HSD', 'Bonferroni', 'Scheffé'
  ciLevel: number
  alpha: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

const R_STATS = String.raw`
gf <- factor(g)
d <- data.frame(y = y, g = gf)
m <- aov(y ~ g, data = d)
s <- summary(m)[[1]]; rownames(s) <- trimws(rownames(s))
desc <- lapply(levels(gf), function(l) { v <- y[gf == l]; list(group = l, n = length(v), m = mean(v), sd = sd(v)) })
es <- effectsize::eta_squared(m, partial = FALSE, ci = level)
eta2 <- as.numeric(es$Eta2)
lev <- tryCatch({ ls <- summary(aov(abs(y - ave(y, gf, FUN = median)) ~ gf))[[1]]
  list(F = ls[1, 'F value'], p = ls[1, 'Pr(>F)']) }, error = function(e) list(F = NULL, p = NULL))
sh <- tryCatch({ t <- shapiro.test(residuals(m)); list(W = unname(t$statistic), p = t$p.value) },
  error = function(e) list(W = NULL, p = NULL))
ph <- .telos_posthoc(emmeans::emmeans(m, ~g), adjust, level)
list(desc = desc, ssB = s['g', 'Sum Sq'], dfB = s['g', 'Df'], msB = s['g', 'Mean Sq'],
  f = s['g', 'F value'], p = s['g', 'Pr(>F)'], eta2 = eta2,
  eta2Low = as.numeric(es$CI_low), eta2High = as.numeric(es$CI_high),
  ssW = s['Residuals', 'Sum Sq'], dfW = s['Residuals', 'Df'], msW = s['Residuals', 'Mean Sq'],
  levene = lev, shapiro = sh, posthoc = ph)`

// Means plot with t-based 95% CI error bars (card figure; no Hmisc — computed in R).
const R_FIGURE = String.raw`
gf <- factor(g)
agg <- data.frame(g = levels(gf), m = as.numeric(tapply(y, gf, mean)))
n <- as.numeric(tapply(y, gf, length)); sdv <- as.numeric(tapply(y, gf, sd))
se <- sdv / sqrt(n); tq <- qt(1 - (1 - level) / 2, n - 1)
agg$lo <- agg$m - tq * se; agg$hi <- agg$m + tq * se
print(ggplot2::ggplot(agg, ggplot2::aes(g, m)) +
  ggplot2::geom_pointrange(ggplot2::aes(ymin = lo, ymax = hi), colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL))`

export async function runOneWayAnova(engine: Engine, data: Dataset, outcome: string, factor: string,
  posthocChoice: string, level = 0.95, alpha = 0.05): Promise<OneWayAnovaResult> {
  const rows = data.rows.filter((r) =>
    typeof r[outcome] === 'number' && Number.isFinite(r[outcome] as number) && r[factor] != null && String(r[factor]).trim() !== '')
  const nExcluded = data.rows.length - rows.length
  const adjust = ({ 'Tukey HSD': 'tukey', 'Bonferroni': 'bonferroni', 'Scheffé': 'scheffe' } as Record<string, string>)[posthocChoice] ?? 'tukey'
  const env = { y: rows.map((r) => r[outcome] as number), g: rows.map((r) => String(r[factor])), adjust, level }
  const s = await engine.runJson<Omit<OneWayAnovaResult, 'nExcluded' | 'figurePng'>>(`${POSTHOC_EMM_R}\n${R_STATS}`, env)
  const figurePng = await engine.capturePlot(R_FIGURE, 600, 450, env)
  return { ...s, posthocMethod: posthocChoice, ciLevel: level, alpha, nExcluded, figurePng }
}
