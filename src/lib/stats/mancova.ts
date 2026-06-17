import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface MultivarRow {
  effect: string
  stat: number    // chosen statistic value (Pillai or Wilks)
  f: number; df1: number; df2: number; p: number
  // Pillai fields always carried for APA (regardless of statistic choice — recorded decision 1)
  pillai: number; pillaiF: number; pillaiDf1: number; pillaiDf2: number; pillaiP: number
}
export interface UnivariateFollowupRow { dv: string; f: number; df1: number; df2: number; p: number; pes: number; pesLow: number; pesHigh: number }
export interface MancovaResult {
  multivariate: MultivarRow[]
  followups: UnivariateFollowupRow[]
  slopes: { term: string; p: number }[]   // cov × factor interaction rows (per-covariate slope check)
  statistic: string
  alpha: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

// RECORDED DEVIATION: The card's R map names car::Manova(), but car's Anova.mlm/linearHypothesis.mlm
// objects expose no programmatic stats table (statistics live only in the print method — probed during
// plan-writing). Implementation uses sequential stats::manova(cbind(DVs) ~ covariates + factors) with
// covariates FIRST and factor(s) LAST. This makes the factor row IDENTICAL to car::Manova's Type II
// factor row (spike-proven: Pillai_group 0.367525003974141 both ways). Hand-rolling Pillai/Wilks from
// eigenvalues was rejected as an unverified fresh error surface (plan Task 14 Step 2).
const R_STATS = String.raw`
d <- data.frame(row.names = seq_len(n))
for (i in seq_along(dvnames)) d[[dvnames[i]]] <- dvs_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(covnames)) d[[covnames[i]]] <- covs_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(fnames)) d[[fnames[i]]] <- factor(fvals_flat[((i - 1) * n + 1):(i * n)])
# covariates first, factor(s) last — makes factor row identical to car::Manova Type II (spike-proven)
cov_rhs <- paste(covnames, collapse = ' + ')
f_rhs <- paste(fnames, collapse = ' * ')
fml <- as.formula(paste('cbind(', paste(dvnames, collapse = ', '), ') ~', cov_rhs, '+', f_rhs))
m <- manova(fml, data = d)
grab <- function(test) { s <- summary(m, test = test)$stats; s[setdiff(rownames(s), 'Residuals'), , drop = FALSE] }
sc <- grab(statistic)
sp <- grab('Pillai')
mv <- lapply(rownames(sc), function(t) list(
  effect = gsub(':', ' × ', t),
  stat = sc[t, 2], f = sc[t, 'approx F'], df1 = sc[t, 'num Df'], df2 = sc[t, 'den Df'], p = sc[t, 'Pr(>F)'],
  pillai = sp[t, 2], pillaiF = sp[t, 'approx F'], pillaiDf1 = sp[t, 'num Df'], pillaiDf2 = sp[t, 'den Df'],
  pillaiP = sp[t, 'Pr(>F)']))
# Follow-ups per DV: aov(dv ~ covs + factors), FACTOR rows only; pes = partial η² with one-sided CI (ci=level).
# effectsize::eta_squared(partial=TRUE) matches SS/(SS+SSres); its CI_low/CI_high carry the [pct% CI] for the ES cell.
fu <- list()
for (dv in dvnames) {
  a <- aov(as.formula(paste(dv, '~', cov_rhs, '+', f_rhs)), data = d)
  s <- summary(a)[[1]]; rownames(s) <- trimws(rownames(s))
  es <- effectsize::eta_squared(a, partial = TRUE, ci = level)
  es$Parameter <- trimws(es$Parameter)
  f_terms <- fnames  # only factor terms (not covariates, not Residuals)
  for (t in f_terms) {
    if (t %in% rownames(s)) {
      ssr <- s['Residuals', 'Sum Sq']
      er <- es[es$Parameter == t, , drop = FALSE]
      fu[[length(fu) + 1]] <- list(
        dv = dv, f = s[t, 'F value'], df1 = s[t, 'Df'], df2 = s['Residuals', 'Df'],
        p = s[t, 'Pr(>F)'], pes = s[t, 'Sum Sq'] / (s[t, 'Sum Sq'] + ssr),
        pesLow = er$CI_low[1], pesHigh = er$CI_high[1])
    }
  }
}
# Slope checks: ONE extra manova fit with all cov:factor interaction terms.
# Per-covariate interaction row p appended to the assume note.
mi_rhs <- paste(c(covnames, fnames, paste(rep(covnames, each = length(fnames)), fnames, sep = ':')), collapse = ' + ')
mi_fml <- as.formula(paste('cbind(', paste(dvnames, collapse = ', '), ') ~', mi_rhs))
mi <- tryCatch(manova(mi_fml, data = d), error = function(e) NULL)
slopes <- list()
if (!is.null(mi)) {
  si <- tryCatch(summary(mi, test = statistic)$stats, error = function(e) NULL)
  if (!is.null(si)) {
    for (t in rownames(si)) {
      # keep rows that are cov:factor interactions
      if (grepl(':', t, fixed = TRUE) &&
          any(vapply(covnames, function(cv) grepl(cv, t, fixed = TRUE), logical(1)))) {
        slopes[[length(slopes) + 1]] <- list(term = gsub(':', ' × ', t), p = si[t, 'Pr(>F)'])
      }
    }
  }
}
list(multivariate = mv, followups = fu, slopes = slopes)`

// Figure: per-DV emmeans adjusted means, faceted by DV.
// Fit lm(dv ~ covs + factors) per DV; emmean/lower.CL/upper.CL from as.data.frame(emmeans(m, ~factors)).
const R_FIGURE = String.raw`
cov_rhs <- paste(covnames, collapse = ' + ')
f_rhs <- paste(fnames, collapse = ' * ')
agg <- do.call(rbind, lapply(seq_along(dvnames), function(di) {
  dv <- dvnames[di]
  v <- dvs_flat[((di - 1) * n + 1):(di * n)]
  d2 <- data.frame(y = v)
  for (i in seq_along(covnames)) d2[[covnames[i]]] <- covs_flat[((i - 1) * n + 1):(i * n)]
  for (i in seq_along(fnames)) d2[[fnames[i]]] <- factor(fvals_flat[((i - 1) * n + 1):(i * n)])
  lm_fit <- lm(as.formula(paste('y ~', cov_rhs, '+', f_rhs)), data = d2)
  em <- as.data.frame(emmeans::emmeans(lm_fit, as.formula(paste('~', fnames[1]))))
  data.frame(dv = dv, g = as.character(em[[fnames[1]]]),
             m = em$emmean, lo = em$lower.CL, hi = em$upper.CL)
}))
print(ggplot2::ggplot(agg, ggplot2::aes(g, m)) +
  ggplot2::geom_pointrange(ggplot2::aes(ymin = lo, ymax = hi), colour = '#0c447c') +
  ggplot2::facet_wrap(~dv, scales = 'free_y') +
  ggplot2::labs(x = NULL, y = NULL))`

interface RawStats {
  multivariate: MultivarRow[]
  followups: UnivariateFollowupRow[]
  slopes: { term: string; p: number }[]
}

export async function runMancova(
  engine: Engine, data: Dataset,
  outcomes: string[], factors: string[], covariates: string[],
  statisticChoice: string, alpha = 0.05, level = 0.95,
): Promise<MancovaResult> {
  // Listwise: all DVs numeric + all covariates numeric + all factors non-blank
  const rows = data.rows.filter((r) => {
    for (const dv of outcomes)
      if (typeof r[dv] !== 'number' || !Number.isFinite(r[dv] as number)) return false
    for (const cov of covariates)
      if (typeof r[cov] !== 'number' || !Number.isFinite(r[cov] as number)) return false
    for (const fac of factors)
      if (r[fac] == null || String(r[fac]).trim() === '') return false
    return true
  })
  const nExcluded = data.rows.length - rows.length
  const statistic = statisticChoice === 'Wilks' ? 'Wilks' : 'Pillai'
  const n = rows.length

  const env = {
    dvs_flat: outcomes.flatMap((dv) => rows.map((r) => r[dv] as number)),
    dvnames: outcomes,
    covs_flat: covariates.flatMap((cov) => rows.map((r) => r[cov] as number)),
    covnames: covariates,
    fvals_flat: factors.flatMap((fac) => rows.map((r) => String(r[fac]))),
    fnames: factors,
    n,
    statistic,
    level,
  }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_FIGURE, 600, 450, env)
  return { ...s, statistic, alpha, nExcluded, figurePng }
}
