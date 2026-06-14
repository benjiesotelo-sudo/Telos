import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import { POSTHOC_EMM_R, type PosthocRow } from './posthoc'
import { ADJMEANS_R, type AdjustedMeanRow } from './adjustedMeans'

export interface AncovaTableRow {
  source: string; ss: number; df: number; ms: number; f: number; p: number; pes: number
}
export interface SlopeCheck { term: string; p: number }
export interface AncovaResult {
  rows: AncovaTableRow[]
  dfRes: number
  adjusted: AdjustedMeanRow[]
  posthoc: PosthocRow[]
  slopes: SlopeCheck[]
  levene: { F: number | null; p: number | null }
  ciLevel: number
  alpha: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

// Type III via car::Anova(type=3) on lm with contr.sum contrasts for every factor.
// Prepend POSTHOC_EMM_R + ADJMEANS_R before running.
const R_STATS = String.raw`
d <- data.frame(y = y)
for (i in seq_along(covnames)) d[[covnames[i]]] <- covs_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(fnames)) d[[fnames[i]]] <- factor(fvals_flat[((i - 1) * n + 1):(i * n)])
ctr <- setNames(lapply(fnames, function(x) 'contr.sum'), fnames)
frhs <- paste(fnames, collapse = ' * ')
m <- lm(as.formula(paste('y ~', paste(covnames, collapse = ' + '), '+', frhs)), data = d, contrasts = ctr)
a3 <- car::Anova(m, type = 3)
pes <- effectsize::eta_squared(a3, partial = TRUE)
terms <- setdiff(rownames(a3), c('(Intercept)', 'Residuals'))
ssr <- a3['Residuals', 'Sum Sq']; dfr <- a3['Residuals', 'Df']
rows <- lapply(terms, function(t) list(source = gsub(':', ' × ', t),
  ss = a3[t, 'Sum Sq'], df = a3[t, 'Df'], ms = a3[t, 'Sum Sq'] / a3[t, 'Df'],
  f = a3[t, 'F value'], p = a3[t, 'Pr(>F)'],
  pes = pes$Eta2_partial[match(t, pes$Parameter)]))
dfres <- dfr
emm <- emmeans::emmeans(m, as.formula(paste('~', frhs)), level = level)
adj <- .telos_adjmeans(emm)
ph <- .telos_posthoc(emm, 'tukey', level)
mi <- lm(as.formula(paste('y ~ (', paste(covnames, collapse = ' + '), ') * (', frhs, ')')), data = d, contrasts = ctr)
ai <- car::Anova(mi, type = 3)
slope_terms <- grep(':', setdiff(rownames(ai), c('(Intercept)', 'Residuals')), value = TRUE)
slope_terms <- slope_terms[vapply(slope_terms, function(t) any(startsWith(t, paste0(covnames, ':'))) ||
  any(vapply(covnames, function(cv) grepl(cv, t, fixed = TRUE), logical(1))), logical(1))]
slopes <- lapply(slope_terms, function(t) list(term = gsub(':', ' × ', t), p = ai[t, 'Pr(>F)']))
cellf <- interaction(d[fnames], sep = ' × ')
lev <- tryCatch({ ls <- summary(aov(abs(y - ave(y, cellf, FUN = median)) ~ cellf))[[1]]
  list(F = ls[1, 'F value'], p = ls[1, 'Pr(>F)']) }, error = function(e) list(F = NULL, p = NULL))
list(rows = rows, dfRes = dfres, adjusted = adj, posthoc = ph, slopes = slopes, levene = lev)`

// Adjusted means pointrange plot — self-contained, uses same env as R_STATS.
// Reconstructs the lm+emmeans to get the emm data frame.
const R_FIGURE = String.raw`
d <- data.frame(y = y)
for (i in seq_along(covnames)) d[[covnames[i]]] <- covs_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(fnames)) d[[fnames[i]]] <- factor(fvals_flat[((i - 1) * n + 1):(i * n)])
ctr <- setNames(lapply(fnames, function(x) 'contr.sum'), fnames)
frhs <- paste(fnames, collapse = ' * ')
m <- lm(as.formula(paste('y ~', paste(covnames, collapse = ' + '), '+', frhs)), data = d, contrasts = ctr)
emm_df <- as.data.frame(emmeans::emmeans(m, as.formula(paste('~', frhs)), level = level))
g_cols <- setdiff(names(emm_df), c('emmean', 'SE', 'df', 'lower.CL', 'upper.CL'))
if (length(g_cols) > 1) {
  emm_df$g_lbl <- do.call(paste, c(emm_df[g_cols], sep = ' × '))
} else {
  emm_df$g_lbl <- as.character(emm_df[[g_cols[1]]])
}
print(ggplot2::ggplot(emm_df, ggplot2::aes(g_lbl, emmean)) +
  ggplot2::geom_pointrange(ggplot2::aes(ymin = lower.CL, ymax = upper.CL), colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL))`

interface RawResult {
  rows: AncovaTableRow[]
  dfRes: number
  adjusted: AdjustedMeanRow[]
  posthoc: PosthocRow[]
  slopes: SlopeCheck[]
  levene: { F: number | null; p: number | null }
}

export async function runAncova(
  engine: Engine, data: Dataset,
  outcome: string, factors: string[], covariates: string[], level = 0.95, alpha = 0.05,
): Promise<AncovaResult> {
  // Listwise: numeric-finite for outcome + all covariates; non-blank for all factors
  const rows = data.rows.filter((r) => {
    if (typeof r[outcome] !== 'number' || !Number.isFinite(r[outcome] as number)) return false
    for (const cov of covariates) {
      if (typeof r[cov] !== 'number' || !Number.isFinite(r[cov] as number)) return false
    }
    for (const fac of factors) {
      if (r[fac] == null || String(r[fac]).trim() === '') return false
    }
    return true
  })
  const nExcluded = data.rows.length - rows.length
  const n = rows.length

  const env = {
    y: rows.map((r) => r[outcome] as number),
    covnames: covariates,
    covs_flat: covariates.flatMap((cov) => rows.map((r) => r[cov] as number)),
    fnames: factors,
    fvals_flat: factors.flatMap((fac) => rows.map((r) => String(r[fac]))),
    n,
    level,
  }

  const s = await engine.runJson<RawResult>(`${POSTHOC_EMM_R}\n${ADJMEANS_R}\n${R_STATS}`, env)
  const figurePng = await engine.capturePlot(R_FIGURE, 600, 450, env)

  return { ...s, ciLevel: level, alpha, nExcluded, figurePng }
}
