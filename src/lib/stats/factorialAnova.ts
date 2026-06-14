import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import { POSTHOC_EMM_R, type PosthocRow } from './posthoc'

export interface CellDescRow { cell: string; n: number; m: number; sd: number }
export interface AnovaRow { source: string; ss: number; df: number; ms: number; f: number; p: number; pes: number }
export interface FactorialAnovaResult {
  rows: AnovaRow[]
  desc: CellDescRow[]
  levene: { F: number | null; p: number | null }
  shapiro: { W: number | null; p: number | null }
  simpleEffects: (PosthocRow & { term: string })[]
  ciLevel: number
  alpha: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

const R_STATS = String.raw`
k <- length(fnames)
d <- data.frame(.sid = factor(seq_len(n)), y = y)
for (i in seq_len(k)) d[[fnames[i]]] <- factor(fvals_flat[((i - 1) * n + 1):(i * n)])
rhs <- paste(fnames, collapse = if (interactions) ' * ' else ' + ')
m <- suppressWarnings(suppressMessages(afex::aov_car(
  as.formula(paste('y ~', rhs, '+ Error(.sid)')), data = d, anova_table = list(es = 'pes'))))
at <- m$anova_table
a3 <- m$Anova; ssr <- a3['Residuals', 'Sum Sq']
rows <- lapply(rownames(at), function(t) list(
  source = gsub(':', ' × ', t), ss = a3[t, 'Sum Sq'], df = at[t, 'num Df'],
  ms = a3[t, 'Sum Sq'] / at[t, 'num Df'], f = at[t, 'F'], p = at[t, 'Pr(>F)'], pes = at[t, 'pes']))
cell <- interaction(d[fnames], sep = ' × ')
desc <- lapply(levels(cell), function(l) { v <- y[cell == l]; list(cell = l, n = length(v), m = mean(v), sd = sd(v)) })
lev <- tryCatch({ ls <- summary(aov(abs(y - ave(y, cell, FUN = median)) ~ cell))[[1]]
  list(F = ls[1, 'F value'], p = ls[1, 'Pr(>F)']) }, error = function(e) list(F = NULL, p = NULL))
sh <- tryCatch({ t <- shapiro.test(residuals(m$lm)); list(W = unname(t$statistic), p = t$p.value) },
  error = function(e) list(W = NULL, p = NULL))
se_rows <- list()
for (fn in fnames) {
  e <- .telos_posthoc(emmeans::emmeans(m, as.formula(paste('~', fn))), 'tukey', level)
  se_rows <- c(se_rows, lapply(e, function(r) { r$term <- fn; r }))
}
if (interactions && k >= 2) {
  emm2 <- emmeans::emmeans(m, as.formula(paste('~', fnames[1], '|', fnames[2])), level = level)
  s2 <- summary(pairs(emm2, adjust = 'bonferroni'), infer = TRUE, level = level)
  by2 <- as.character(s2[[fnames[2]]])
  se_rows <- c(se_rows, lapply(seq_len(nrow(s2)), function(i) list(
    pair = paste0(as.character(s2$contrast[i]), ' | ', by2[i]), diff = s2$estimate[i], se = s2$SE[i],
    pAdj = s2$p.value[i], ciLo = s2$lower.CL[i], ciHi = s2$upper.CL[i],
    term = paste(fnames[1], '×', fnames[2]))))
}
list(rows = rows, desc = desc, levene = lev, shapiro = sh, simpleEffects = se_rows)`

const R_FIGURE = String.raw`
a <- factor(fvals_flat[1:n]); b <- factor(fvals_flat[(n + 1):(2 * n)])
agg <- aggregate(list(m = y), by = list(a = a, b = b), FUN = mean)
print(ggplot2::ggplot(agg, ggplot2::aes(a, m, group = b, colour = b)) +
  ggplot2::geom_line() + ggplot2::geom_point() +
  ggplot2::labs(x = NULL, y = NULL, colour = fnames[2]))`

interface RawStats {
  rows: AnovaRow[]
  desc: CellDescRow[]
  levene: { F: number | null; p: number | null }
  shapiro: { W: number | null; p: number | null }
  simpleEffects: (PosthocRow & { term: string })[]
}

export async function runFactorialAnova(engine: Engine, data: Dataset, outcome: string, factors: string[],
  interactions: boolean, level = 0.95, alpha = 0.05): Promise<FactorialAnovaResult> {
  const rows = data.rows.filter((r) =>
    typeof r[outcome] === 'number' && Number.isFinite(r[outcome] as number) &&
    factors.every((f) => r[f] != null && String(r[f]).trim() !== ''))
  const nExcluded = data.rows.length - rows.length
  const n = rows.length
  // factor-major: all values of factor[0] first, then factor[1], etc.
  const fvals_flat = factors.flatMap((f) => rows.map((r) => String(r[f])))
  const env = {
    y: rows.map((r) => r[outcome] as number),
    fvals_flat,
    fnames: factors,
    n,
    interactions,
    level,
  }
  const s = await engine.runJson<RawStats>(`${POSTHOC_EMM_R}\n${R_STATS}`, env)
  const figurePng = await engine.capturePlot(R_FIGURE, 600, 450, env)
  return { ...s, ciLevel: level, alpha, nExcluded, figurePng }
}
