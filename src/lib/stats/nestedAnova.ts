import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import { nestedLevelReuse } from '../eligibility/eligibility'

export interface NestedAnovaRow {
  source: string   // 'A' or 'B' (display substituted in builder)
  ss: number; df: number; ms: number; f: number; p: number
  omega2: number | null
  omega2Low: number | null; omega2High: number | null  // effectsize::omega_squared(ci=level) one-sided CI; null when not estimable
  errDf: number    // denominator df for this row's F ratio
}

export interface NestedDescRow { group: string; n: number; m: number; sd: number }  // per top-level (factor) group
export interface NestedAnovaResult {
  rows: NestedAnovaRow[]
  desc: NestedDescRow[]            // per top-level (factor) group: N / M / SD
  levene: { F: number | null; p: number | null }   // Levene (median-centered) on the top-level factor
  shapiro: { W: number | null; p: number | null }  // Shapiro-Wilk on the model residuals
  factor: string; nested: string  // role column names — the builder renders them as source labels
  nesting: 'random' | 'fixed'     // passed through from runNestedAnova for conditional note
  crossed: string[]   // child labels that appear under >1 parent (nestedLevelReuse)
  alpha: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

const R_STATS = String.raw`
af <- factor(a); bf <- factor(b)
m <- aov(y ~ af / bf)
s <- summary(m)[[1]]; rownames(s) <- trimws(rownames(s))
msA <- s['af', 'Mean Sq']; msB <- s['af:bf', 'Mean Sq']; msR <- s['Residuals', 'Mean Sq']
dfA <- s['af', 'Df']; dfB <- s['af:bf', 'Df']; dfR <- s['Residuals', 'Df']
fA <- if (random) msA / msB else msA / msR
pA <- pf(fA, dfA, if (random) dfB else dfR, lower.tail = FALSE)
fB <- msB / msR; pB <- pf(fB, dfB, dfR, lower.tail = FALSE)
os <- tryCatch(effectsize::omega_squared(m, partial = FALSE, ci = 0.95), error = function(e) NULL)
o2 <- if (is.null(os)) c(NA, NA) else as.numeric(os$Omega2)
o2lo <- if (is.null(os)) c(NA, NA) else as.numeric(os$CI_low)
o2hi <- if (is.null(os)) c(NA, NA) else as.numeric(os$CI_high)
# Descriptives per top-level (factor) group: N / M / SD
desc <- lapply(levels(af), function(l) { v <- y[af == l]; list(group = l, n = length(v), m = mean(v), sd = sd(v)) })
# Levene (median-centered) on the top-level factor; Shapiro-Wilk on the nested-model residuals (guard small/large N).
lev <- tryCatch({ lf <- summary(aov(abs(y - ave(y, af, FUN = median)) ~ af))[[1]]
  list(F = lf[1, 'F value'], p = lf[1, 'Pr(>F)']) }, error = function(e) list(F = NULL, p = NULL))
rsd <- residuals(m); nr <- length(rsd)
sw <- if (nr >= 3 && nr <= 5000) tryCatch(shapiro.test(rsd), error = function(e) NULL) else NULL
list(desc = desc,
  levene = lev,
  shapiro = list(W = if (is.null(sw)) NA_real_ else unname(sw$statistic), p = if (is.null(sw)) NA_real_ else sw$p.value),
  rows = list(
  list(source = 'A', ss = s['af', 'Sum Sq'], df = dfA, ms = msA, f = fA, p = pA,
    omega2 = if (is.na(o2[1])) NULL else o2[1],
    omega2Low = if (is.na(o2lo[1])) NULL else o2lo[1], omega2High = if (is.na(o2hi[1])) NULL else o2hi[1],
    errDf = if (random) dfB else dfR),
  list(source = 'B', ss = s['af:bf', 'Sum Sq'], df = dfB, ms = msB, f = fB, p = pB,
    omega2 = if (is.na(o2[2])) NULL else o2[2],
    omega2Low = if (is.na(o2lo[2])) NULL else o2lo[2], omega2High = if (is.na(o2hi[2])) NULL else o2hi[2],
    errDf = dfR)))`

const R_FIGURE = String.raw`
cellm <- aggregate(list(m = y), by = list(a = af, b = bf), FUN = mean)
nc <- aggregate(list(n = y), by = list(a = af, b = bf), FUN = length)
sdv <- aggregate(list(s = y), by = list(a = af, b = bf), FUN = sd)
cellm$lo <- cellm$m - qt(0.975, nc$n - 1) * sdv$s / sqrt(nc$n)
cellm$hi <- cellm$m + qt(0.975, nc$n - 1) * sdv$s / sqrt(nc$n)
print(ggplot2::ggplot(cellm, ggplot2::aes(a, m, colour = b)) +
  ggplot2::geom_pointrange(ggplot2::aes(ymin = lo, ymax = hi), position = ggplot2::position_dodge(width = 0.5)) +
  ggplot2::labs(x = NULL, y = NULL, colour = NULL))`

interface RawStats {
  rows: NestedAnovaRow[]
  desc: NestedDescRow[]
  levene: { F: number | null; p: number | null }
  shapiro: { W: number | null; p: number | null }
}

export async function runNestedAnova(
  engine: Engine, data: Dataset,
  outcome: string, factor: string, nested: string,
  random: boolean, alpha = 0.05,
): Promise<NestedAnovaResult> {
  const rows = data.rows.filter((r) =>
    typeof r[outcome] === 'number' && Number.isFinite(r[outcome] as number)
    && r[factor] != null && String(r[factor]).trim() !== ''
    && r[nested] != null && String(r[nested]).trim() !== '')
  const nExcluded = data.rows.length - rows.length
  const crossed = nestedLevelReuse(data, factor, nested)
  const env = {
    y: rows.map((r) => r[outcome] as number),
    a: rows.map((r) => String(r[factor])),
    b: rows.map((r) => String(r[nested])),
    random,
  }
  const s = await engine.runJson<RawStats>(`${R_STATS}`, env)
  // Re-run R figure using the same factors (af/bf still in scope from R_STATS)
  const figureCode = `${R_STATS}\n${R_FIGURE}`
  const figurePng = await engine.capturePlot(figureCode, 600, 450, env)
  return { rows: s.rows, desc: s.desc, levene: s.levene, shapiro: s.shapiro, factor, nested, nesting: random ? 'random' : 'fixed', crossed, alpha, nExcluded, figurePng }
}
