import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface FeCoefRow { term: string; b: number; se: number; t: number; p: number; ciLow: number; ciHigh: number }
export interface FixedEffectsResult {
  coefRows: FeCoefRow[]
  withinR2: number; adjR2: number; fStat: number; fDf1: number; fDf2: number; fP: number
  nObs: number; nEntities: number
  poolF: number; poolP: number          // §2.8 poolability: F-test of individual effects (within vs pooling)
  effect: string; seType: 'clustered' | 'classical'
  ciLevel: number; alpha: number
  nExcluded: number
  figCoefPng: Uint8Array<ArrayBuffer>
}

const EFFECT_MAP: Record<string, string> = { entity: 'individual', time: 'time', 'two-way': 'twoways' }

// Inputs (env): entity (char), timev (char — panel index, order-irrelevant for within), y (num),
//   x_flat (regressors, column-major), xnames, k, n_obs, effect_arg, se_clustered, ci_level.
const R_FE = String.raw`
xnames <- xnames[seq_len(k)]
df <- data.frame(.entity = entity, .timev = timev, .y = y, stringsAsFactors = FALSE)
for (i in seq_len(k)) df[[xnames[i]]] <- x_flat[((i - 1L) * n_obs + 1L):(i * n_obs)]
pdat <- plm::pdata.frame(df, index = c('.entity', '.timev'))
form <- as.formula(paste('.y ~', paste(xnames, collapse = ' + ')))
fit <- plm::plm(form, data = pdat, model = 'within', effect = effect_arg)
if (length(coef(fit)) == 0L) stop('No estimable within-entity predictors — every regressor is time-invariant within entities.')
V  <- if (se_clustered) plm::vcovHC(fit, method = 'arellano', type = 'HC1', cluster = 'group') else stats::vcov(fit)
ct <- lmtest::coeftest(fit, vcov. = V)
ci <- lmtest::coefci(fit, vcov. = V, level = ci_level)
labs <- rownames(ct)
coef_rows <- lapply(seq_along(labs), function(i) list(
  term = labs[i], b = ct[i, 1], se = ct[i, 2], t = ct[i, 3], p = ct[i, 4], ciLow = ci[i, 1], ciHigh = ci[i, 2]))
s   <- summary(fit)
fst <- s$fstatistic
pooled <- plm::plm(form, data = pdat, model = 'pooling')
pf <- plm::pFtest(fit, pooled)
list(
  coef_rows = coef_rows,
  within_r2 = unname(s$r.squared['rsq']), adj_r2 = unname(s$r.squared['adjrsq']),
  f_stat = unname(fst$statistic), f_df1 = unname(fst$parameter[1]), f_df2 = unname(fst$parameter[2]), f_p = unname(fst$p.value),
  n_obs = nrow(df), n_entities = plm::pdim(fit)$nT$n,
  pool_f = unname(pf$statistic), pool_p = unname(pf$p.value)
)`

const R_FE_PLOT = String.raw`
xnames <- xnames[seq_len(k)]
df <- data.frame(.entity = entity, .timev = timev, .y = y, stringsAsFactors = FALSE)
for (i in seq_len(k)) df[[xnames[i]]] <- x_flat[((i - 1L) * n_obs + 1L):(i * n_obs)]
pdat <- plm::pdata.frame(df, index = c('.entity', '.timev'))
form <- as.formula(paste('.y ~', paste(xnames, collapse = ' + ')))
fit <- plm::plm(form, data = pdat, model = 'within', effect = effect_arg)
V   <- if (se_clustered) plm::vcovHC(fit, method = 'arellano', type = 'HC1', cluster = 'group') else stats::vcov(fit)
ci  <- lmtest::coefci(fit, vcov. = V, level = ci_level)
est <- coef(fit); labs <- names(est)
pf  <- data.frame(term = labs, b = unname(est), lo = ci[, 1], hi = ci[, 2])
pf$term <- factor(pf$term, levels = rev(labs))
print(ggplot2::ggplot(pf, ggplot2::aes(x = b, y = term)) +
  ggplot2::geom_vline(xintercept = 0, colour = '#9cc2ec', linetype = 'dashed') +
  ggplot2::geom_pointrange(ggplot2::aes(xmin = lo, xmax = hi), colour = '#0c447c') +
  ggplot2::labs(x = paste0('Within estimate (', round(ci_level * 100), '% CI)'), y = NULL))`

interface RawFe {
  coef_rows: FeCoefRow[]
  within_r2: number; adj_r2: number; f_stat: number; f_df1: number; f_df2: number; f_p: number
  n_obs: number; n_entities: number; pool_f: number; pool_p: number
}

export async function runFixedEffects(
  engine: Engine, data: Dataset, entityCol: string, timeCol: string, outcomeCol: string, regressorCols: string[],
  opts: { effect?: string; seClustered?: boolean; ciLevel?: number; alpha?: number } = {},
): Promise<FixedEffectsResult> {
  const effect = opts.effect ?? 'entity'
  const seClustered = opts.seClustered ?? true
  const ciLvl = opts.ciLevel ?? 0.95
  const alpha = opts.alpha ?? 0.05
  const present = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== ''
  // Listwise: entity + time present, outcome + every regressor numeric-finite (mirrors plm's complete-case fit).
  const rows = data.rows.filter((r) =>
    present(r[entityCol]) && present(r[timeCol])
    && typeof r[outcomeCol] === 'number' && Number.isFinite(r[outcomeCol] as number)
    && regressorCols.every((c) => typeof r[c] === 'number' && Number.isFinite(r[c] as number)))
  const nExcluded = data.rows.length - rows.length
  if (new Set(rows.map((r) => String(r[entityCol]))).size < 2) throw new Error('Fixed effects needs at least 2 entities.')
  if (new Set(rows.map((r) => String(r[timeCol]))).size < 2) throw new Error('Fixed effects needs at least 2 time periods.')
  if (rows.length < regressorCols.length + 2) throw new Error(`Too few complete observations (${rows.length}) for ${regressorCols.length} regressor(s).`)
  const nObs = rows.length
  const env = {
    entity: rows.map((r) => String(r[entityCol])),
    timev: rows.map((r) => String(r[timeCol])),
    y: rows.map((r) => r[outcomeCol] as number),
    x_flat: regressorCols.flatMap((c) => rows.map((r) => r[c] as number)),
    xnames: regressorCols, k: regressorCols.length, n_obs: nObs,
    effect_arg: EFFECT_MAP[effect] ?? 'individual', se_clustered: seClustered, ci_level: ciLvl,
  }
  const raw = await engine.runJson<RawFe>(R_FE, env)
  const figCoefPng = await engine.capturePlot(R_FE_PLOT, 600, 450, env)
  return {
    coefRows: raw.coef_rows, withinR2: raw.within_r2, adjR2: raw.adj_r2,
    fStat: raw.f_stat, fDf1: raw.f_df1, fDf2: raw.f_df2, fP: raw.f_p,
    nObs: raw.n_obs, nEntities: raw.n_entities, poolF: raw.pool_f, poolP: raw.pool_p,
    effect, seType: seClustered ? 'clustered' : 'classical', ciLevel: ciLvl, alpha, nExcluded, figCoefPng,
  }
}
