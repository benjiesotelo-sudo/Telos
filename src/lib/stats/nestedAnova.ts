import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import { nestedLevelReuse } from '../eligibility/eligibility'

export interface NestedAnovaRow {
  source: string   // 'A' or 'B' (display substituted in builder)
  ss: number; df: number; ms: number; f: number; p: number
  omega2: number | null
  errDf: number    // denominator df for this row's F ratio
}

export interface NestedAnovaResult {
  rows: NestedAnovaRow[]
  factor: string; nested: string  // role column names — the builder renders them as source labels
  nesting: 'random' | 'fixed'     // passed through from runNestedAnova for conditional note
  crossed: string[]   // child labels that appear under >1 parent (nestedLevelReuse)
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
o2 <- tryCatch(as.numeric(effectsize::omega_squared(m, partial = FALSE)$Omega2), error = function(e) c(NA, NA))
list(rows = list(
  list(source = 'A', ss = s['af', 'Sum Sq'], df = dfA, ms = msA, f = fA, p = pA,
    omega2 = if (is.na(o2[1])) NULL else o2[1], errDf = if (random) dfB else dfR),
  list(source = 'B', ss = s['af:bf', 'Sum Sq'], df = dfB, ms = msB, f = fB, p = pB,
    omega2 = if (is.na(o2[2])) NULL else o2[2], errDf = dfR)))`

const R_FIGURE = String.raw`
cellm <- aggregate(list(m = y), by = list(a = af, b = bf), FUN = mean)
nc <- aggregate(list(n = y), by = list(a = af, b = bf), FUN = length)
sdv <- aggregate(list(s = y), by = list(a = af, b = bf), FUN = sd)
cellm$lo <- cellm$m - qt(0.975, nc$n - 1) * sdv$s / sqrt(nc$n)
cellm$hi <- cellm$m + qt(0.975, nc$n - 1) * sdv$s / sqrt(nc$n)
print(ggplot2::ggplot(cellm, ggplot2::aes(a, m, colour = b)) +
  ggplot2::geom_pointrange(ggplot2::aes(ymin = lo, ymax = hi), position = ggplot2::position_dodge(width = 0.5)) +
  ggplot2::labs(x = NULL, y = NULL, colour = NULL))`

interface RawStats { rows: NestedAnovaRow[] }

export async function runNestedAnova(
  engine: Engine, data: Dataset,
  outcome: string, factor: string, nested: string,
  random: boolean,
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
  return { rows: s.rows, factor, nested, nesting: random ? 'random' : 'fixed', crossed, nExcluded, figurePng }
}
