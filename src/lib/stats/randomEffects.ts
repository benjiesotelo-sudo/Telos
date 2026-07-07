import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface ReCoefRow { term: string; b: number; se: number; t: number; p: number; ciLow: number; ciHigh: number }
export interface RandomEffectsResult {
  coefRows: ReCoefRow[]
  r2: number; adjR2: number
  // R1 gap-fix: xtreg-convention (Stata [XT] xtreg) within/between/overall R² split, ADDITIVE alongside
  // the existing single r2/adjR2 (plm's own GLS-transformed-regression R² — a different, pre-existing
  // quantity; this split is computed independently via the standard correlation² recipe, native-R verified).
  withinR2: number; betweenR2: number; overallR2: number
  nObs: number; nEntities: number
  // Theme-4: Breusch–Pagan LM test (RE vs pooled OLS) + Swamy–Arora variance components / theta (guarded NA→null).
  bpLm: number | null; bpDf: number | null; bpP: number | null
  theta: number | null; varIdiosyncratic: number | null; varEntity: number | null
  seType: 'clustered' | 'classical'
  ciLevel: number; alpha: number
  nExcluded: number
  figCoefPng: Uint8Array<ArrayBuffer>
}

// Inputs (env): entity (char), timev (char), y (num), x_flat (regressors col-major), xnames, k, n_obs,
//   se_clustered, ci_level. Swamy-Arora random effects; clustered SE = plm::vcovHC(method='arellano').
const R_RE = String.raw`
xnames <- xnames[seq_len(k)]
df <- data.frame(.entity = entity, .timev = timev, .y = y, stringsAsFactors = FALSE)
for (i in seq_len(k)) df[[xnames[i]]] <- x_flat[((i - 1L) * n_obs + 1L):(i * n_obs)]
pdat <- plm::pdata.frame(df, index = c('.entity', '.timev'))
form <- as.formula(paste('.y ~', paste(xnames, collapse = ' + ')))
fit <- plm::plm(form, data = pdat, model = 'random')
V  <- if (se_clustered) plm::vcovHC(fit, method = 'arellano', type = 'HC1', cluster = 'group') else stats::vcov(fit)
ct <- lmtest::coeftest(fit, vcov. = V)
ci <- lmtest::coefci(fit, vcov. = V, level = ci_level)
labs <- rownames(ct)
coef_rows <- lapply(seq_along(labs), function(i) list(
  term = labs[i], b = ct[i, 1], se = ct[i, 2], t = ct[i, 3], p = ct[i, 4], ciLow = ci[i, 1], ciHigh = ci[i, 2]))
s <- summary(fit)
# Theme-4: Breusch–Pagan LM test of RE vs pooled OLS (plmtest on the pooling model). NA_real_ → JSON null (the
# helper maps non-finite to null); never emit a bare R NULL (it would serialise to an empty array, not null).
nz   <- function(v) if (length(v) == 0L || !is.finite(v[1])) NA_real_ else unname(v[1])
pooling <- plm::plm(form, data = pdat, model = 'pooling')
bp   <- tryCatch(plm::plmtest(pooling, type = 'bp'), error = function(e) NULL)
bp_lm <- if (is.null(bp)) NA_real_ else nz(bp$statistic)
bp_df <- if (is.null(bp)) NA_real_ else nz(bp$parameter)
bp_p  <- if (is.null(bp)) NA_real_ else nz(bp$p.value)
# Swamy–Arora variance components + theta (scalar for a balanced panel; first element otherwise).
ec   <- fit$ercomp
theta <- if (is.null(ec$theta)) NA_real_ else nz(as.numeric(ec$theta))
v_id  <- if (is.null(ec$sigma2)) NA_real_ else nz(unname(ec$sigma2['idios']))
v_en  <- if (is.null(ec$sigma2)) NA_real_ else nz(unname(ec$sigma2['id']))
# R1 gap-fix: within/between/overall R² (Stata xtreg convention) — correlation² of the RE-fitted linear
# predictor (intercept + raw X · RE coefficients) against demeaned / entity-mean-collapsed / raw y.
# Native-R verified against this app's own panel.csv fixture (differs from plm's own summary r.squared,
# which is a distinct GLS-transformed-regression quantity, kept unchanged above).
b_re <- coef(fit)
xb <- b_re[['(Intercept)']] + as.numeric(as.matrix(df[, xnames, drop = FALSE]) %*% b_re[xnames])
id2 <- df$.entity
dm2 <- function(v) ave(v, id2, FUN = function(x) x - mean(x))
within_r2 <- unname(cor(dm2(df$.y), dm2(xb))^2)
agg2 <- aggregate(cbind(yy, xbxb) ~ idid, data.frame(idid = id2, yy = df$.y, xbxb = xb), mean)
between_r2 <- unname(cor(agg2$yy, agg2$xbxb)^2)
overall_r2 <- unname(cor(df$.y, xb)^2)
list(
  coef_rows = coef_rows,
  r2 = unname(s$r.squared['rsq']), adj_r2 = unname(s$r.squared['adjrsq']),
  within_r2 = within_r2, between_r2 = between_r2, overall_r2 = overall_r2,
  n_obs = nrow(df), n_entities = plm::pdim(fit)$nT$n,
  bp_lm = bp_lm, bp_df = bp_df, bp_p = bp_p,
  theta = theta, var_idiosyncratic = v_id, var_entity = v_en
)`

const R_RE_PLOT = String.raw`
xnames <- xnames[seq_len(k)]
df <- data.frame(.entity = entity, .timev = timev, .y = y, stringsAsFactors = FALSE)
for (i in seq_len(k)) df[[xnames[i]]] <- x_flat[((i - 1L) * n_obs + 1L):(i * n_obs)]
pdat <- plm::pdata.frame(df, index = c('.entity', '.timev'))
form <- as.formula(paste('.y ~', paste(xnames, collapse = ' + ')))
fit <- plm::plm(form, data = pdat, model = 'random')
V   <- if (se_clustered) plm::vcovHC(fit, method = 'arellano', type = 'HC1', cluster = 'group') else stats::vcov(fit)
ci  <- lmtest::coefci(fit, vcov. = V, level = ci_level)
est <- coef(fit); labs <- names(est)
keep <- labs != '(Intercept)'
pf  <- data.frame(term = labs[keep], b = unname(est[keep]), lo = ci[keep, 1], hi = ci[keep, 2])
pf$term <- factor(pf$term, levels = rev(labs[keep]))
print(ggplot2::ggplot(pf, ggplot2::aes(x = b, y = term)) +
  ggplot2::geom_vline(xintercept = 0, colour = '#9cc2ec', linetype = 'dashed') +
  ggplot2::geom_pointrange(ggplot2::aes(xmin = lo, xmax = hi), colour = '#0c447c') +
  ggplot2::labs(x = paste0('Estimate (', round(ci_level * 100), '% CI)'), y = NULL))`

interface RawRe {
  coef_rows: ReCoefRow[]
  r2: number; adj_r2: number
  within_r2: number; between_r2: number; overall_r2: number
  n_obs: number; n_entities: number
  bp_lm: number | null; bp_df: number | null; bp_p: number | null
  theta: number | null; var_idiosyncratic: number | null; var_entity: number | null
}

export async function runRandomEffects(
  engine: Engine, data: Dataset, entityCol: string, timeCol: string, outcomeCol: string, regressorCols: string[],
  opts: { seClustered?: boolean; ciLevel?: number; alpha?: number } = {},
): Promise<RandomEffectsResult> {
  const seClustered = opts.seClustered ?? true
  const ciLvl = opts.ciLevel ?? 0.95
  const alpha = opts.alpha ?? 0.05
  const present = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== ''
  const rows = data.rows.filter((r) =>
    present(r[entityCol]) && present(r[timeCol])
    && typeof r[outcomeCol] === 'number' && Number.isFinite(r[outcomeCol] as number)
    && regressorCols.every((c) => typeof r[c] === 'number' && Number.isFinite(r[c] as number)))
  const nExcluded = data.rows.length - rows.length
  if (new Set(rows.map((r) => String(r[entityCol]))).size < 2) throw new Error('Random effects needs at least 2 entities.')
  if (new Set(rows.map((r) => String(r[timeCol]))).size < 2) throw new Error('Random effects needs at least 2 time periods.')
  if (rows.length < regressorCols.length + 2) throw new Error(`Too few complete observations (${rows.length}) for ${regressorCols.length} regressor(s).`)
  const nObs = rows.length
  const env = {
    entity: rows.map((r) => String(r[entityCol])),
    timev: rows.map((r) => String(r[timeCol])),
    y: rows.map((r) => r[outcomeCol] as number),
    x_flat: regressorCols.flatMap((c) => rows.map((r) => r[c] as number)),
    xnames: regressorCols, k: regressorCols.length, n_obs: nObs,
    se_clustered: seClustered, ci_level: ciLvl,
  }
  const raw = await engine.runJson<RawRe>(R_RE, env)
  const figCoefPng = await engine.capturePlot(R_RE_PLOT, 600, 450, env)
  return {
    coefRows: raw.coef_rows, r2: raw.r2, adjR2: raw.adj_r2,
    withinR2: raw.within_r2, betweenR2: raw.between_r2, overallR2: raw.overall_r2,
    nObs: raw.n_obs, nEntities: raw.n_entities,
    bpLm: raw.bp_lm, bpDf: raw.bp_df, bpP: raw.bp_p,
    theta: raw.theta, varIdiosyncratic: raw.var_idiosyncratic, varEntity: raw.var_entity,
    seType: seClustered ? 'clustered' : 'classical', ciLevel: ciLvl, alpha, nExcluded, figCoefPng,
  }
}
