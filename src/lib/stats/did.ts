import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import { binaryCode, positiveLevel } from './binaryCoding'

export interface DidCoefRow { term: string; b: number; se: number; t: number; p: number; ciLow: number; ciHigh: number }
export interface DidResult {
  coefRows: DidCoefRow[]   // po, po:tr — builder relabels (Treated main effect absorbed by the within transform)
  seType: 'clustered' | 'classical'
  ciLevel: number; alpha: number
  // Overall model F (within fit): statistic + its numerator/denominator df + p — rendered as F(df1, df2), p.
  // df1/df2/p are NA-guarded (null) so a degenerate fit em-dashes instead of printing NaN.
  withinR2: number; fStat: number; fDf1: number | null; fDf2: number | null; fP: number | null
  // Pre-trends signal: pre-period (post=0) leads-and-lags joint F of treated×time interactions — null when the
  // pre window has too few periods/cells to fit the interaction (NA-guarded). A small p flags diverging pre-trends.
  preTrend: { F: number; df1: number; df2: number; p: number } | null
  nObs: number; nEntities: number; nExcluded: number
  figTrendsPng: Uint8Array<ArrayBuffer>
}

// Option-B entity fixed effects: plm within on (po + po:tr). The time-invariant Treated main effect (tr) is
// absorbed by the within transform — only Post and Treated×Post are estimable. Clustered-by-entity SE via
// plm::vcovHC(arellano/HC1) (same recipe as the FE/Hausman siblings); classical = stats::vcov. tr/po are 0/1.
const R_DID = String.raw`
d <- data.frame(.entity = cluster, .timev = timev, .y = y, po = po, tr = tr, stringsAsFactors = FALSE)
pd  <- plm::pdata.frame(d, index = c('.entity', '.timev'))
fit <- plm::plm(.y ~ po + po:tr, data = pd, model = 'within')
V  <- if (se_clustered) plm::vcovHC(fit, method = 'arellano', type = 'HC1', cluster = 'group') else stats::vcov(fit)
ct <- lmtest::coeftest(fit, vcov. = V)
ci <- lmtest::coefci(fit, vcov. = V, level = ci_level)
labs <- rownames(ct)
coef_rows <- lapply(seq_along(labs), function(i) list(
  term = labs[i], b = ct[i, 1], se = ct[i, 2], t = ct[i, 3], p = ct[i, 4], ciLow = ci[i, 1], ciHigh = ci[i, 2]))
s <- summary(fit)
fst <- s$fstatistic
# Overall within-F: statistic + numerator/denominator df + p, each NA→NULL so a degenerate fit em-dashes downstream.
naNull <- function(v) { v <- unname(v); if (length(v) != 1 || is.na(v) || !is.finite(v)) NULL else v }
# Pre-trends signal: on the pre-treatment window (po == 0), a base-lm leads-and-lags joint F — does the treated
# group's outcome diverge across pre-periods? Compare lm(y ~ tr * factor(time)) vs lm(y ~ tr + factor(time)) via
# anova(): the F tests whether the treated×time interactions are jointly 0 (parallel pre-trends). NA → NULL when
# the pre window has < 2 time levels or the cells can't support the interaction (then no signal is reported).
pre <- d[d$po == 0, ]
pt <- tryCatch({
  if (length(unique(pre$.timev)) < 2 || length(unique(pre$tr)) < 2) NULL else {
    pre$.tf <- factor(pre$.timev)
    full <- stats::lm(.y ~ tr * .tf, data = pre)
    red  <- stats::lm(.y ~ tr + .tf, data = pre)
    an <- stats::anova(red, full)
    fval <- an[['F']][2]
    if (is.na(fval)) NULL else list(F = fval, df1 = an[['Df']][2], df2 = an[['Res.Df']][2], p = an[['Pr(>F)']][2])
  }
}, error = function(e) NULL)
list(coef_rows = coef_rows, within_r2 = unname(s$r.squared['rsq']),
  f_stat = unname(fst$statistic), f_df1 = naNull(fst$parameter[1]), f_df2 = naNull(fst$parameter[2]), f_p = naNull(fst$p.value),
  pre_trend = pt, n_obs = nrow(d), n_entities = plm::pdim(fit)$nT$n)`

// Parallel-trends plot: mean outcome over time by treatment group, with treatment onset marked.
const R_TRENDS = String.raw`
agg <- aggregate(yy ~ tt + grp, data = data.frame(yy = y, tt = timev, grp = ifelse(tr == 1, 'Treated', 'Control')), FUN = mean)
onset <- min(timev[po == 1])
print(ggplot2::ggplot(agg, ggplot2::aes(x = tt, y = yy, colour = grp, group = grp)) +
  ggplot2::geom_vline(xintercept = onset, colour = '#9cc2ec', linetype = 'dashed') +
  ggplot2::geom_line() + ggplot2::geom_point() +
  ggplot2::scale_colour_manual(values = c(Control = '#0c447c', Treated = '#c8781e')) +
  ggplot2::labs(x = 'Time', y = 'Mean outcome', colour = NULL))`

interface RawDid {
  coef_rows: DidCoefRow[]; within_r2: number; f_stat: number; n_obs: number; n_entities: number
  f_df1: number | null; f_df2: number | null; f_p: number | null
  pre_trend: { F: number; df1: number; df2: number; p: number } | null
}

const levelsOf = (data: Dataset, col: string): string[] =>
  [...new Set(data.rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '').map(String))].sort()

export async function runDid(
  engine: Engine, data: Dataset, outcomeCol: string, treatmentCol: string, periodCol: string, entityCol: string, timeCol: string,
  opts: { seClustered?: boolean; ciLevel?: number; alpha?: number } = {},
): Promise<DidResult> {
  const seClustered = opts.seClustered ?? true
  const ciLvl = opts.ciLevel ?? 0.95
  const alpha = opts.alpha ?? 0.05
  const present = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== ''
  const trLevels = levelsOf(data, treatmentCol)
  const poLevels = levelsOf(data, periodCol)
  if (trLevels.length !== 2) throw new Error('Difference-in-differences needs a treatment with exactly 2 groups.')
  if (poLevels.length !== 2) throw new Error('Difference-in-differences needs a pre/post period with exactly 2 levels.')
  const rows = data.rows.filter((r) =>
    typeof r[outcomeCol] === 'number' && Number.isFinite(r[outcomeCol] as number)
    && present(r[treatmentCol]) && present(r[periodCol]) && present(r[entityCol]) && present(r[timeCol]))
  const nExcluded = data.rows.length - rows.length
  // Code treatment + period to 0/1 by the POSITIVE level (treated / post), not alphabetical order — "pre"/"post"
  // sorts post<pre, which would flip the DiD sign. binaryCode handles 0/1, yes/no, pre/post, treated/control.
  const trPos = positiveLevel(trLevels); const poPos = positiveLevel(poLevels)
  const tr = rows.map((r) => binaryCode(r[treatmentCol], trPos))
  const po = rows.map((r) => binaryCode(r[periodCol], poPos))
  // 2×2 structural guard: every treat×post cell populated
  const cells = new Set(rows.map((_, i) => `${tr[i]}-${po[i]}`))
  if (cells.size < 4) throw new Error('Difference-in-differences needs observations in all four treated×period cells.')
  // Ordered numeric x-axis for the trends plot: the real value when every time is numeric (e.g. year), else the
  // rank of each distinct value in sorted order — so ISO-date strings / ordinal labels plot in order, not as NaN.
  const rawTime = rows.map((r) => r[timeCol])
  const allNumericTime = rawTime.every((v) => typeof v === 'number' && Number.isFinite(v))
  const timeOrder = allNumericTime ? null : [...new Set(rawTime.map(String))].sort()
  const env = {
    y: rows.map((r) => r[outcomeCol] as number),
    tr, po,
    cluster: rows.map((r) => String(r[entityCol])),
    timev: allNumericTime ? (rawTime as number[]) : rawTime.map((v) => timeOrder!.indexOf(String(v)) + 1),
    se_clustered: seClustered, ci_level: ciLvl,
  }
  const raw = await engine.runJson<RawDid>(R_DID, env)
  const figTrendsPng = await engine.capturePlot(R_TRENDS, 600, 450, env)
  return {
    coefRows: raw.coef_rows, seType: seClustered ? 'clustered' : 'classical',
    ciLevel: ciLvl, alpha, withinR2: raw.within_r2, fStat: raw.f_stat,
    fDf1: raw.f_df1 ?? null, fDf2: raw.f_df2 ?? null, fP: raw.f_p ?? null,
    preTrend: raw.pre_trend ?? null,
    nObs: raw.n_obs, nEntities: raw.n_entities, nExcluded, figTrendsPng,
  }
}
