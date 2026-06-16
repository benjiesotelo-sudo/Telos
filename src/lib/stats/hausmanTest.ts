import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface HausmanCompareRow {
  term: string; feB: number; reB: number; diff: number
  // clustered (arellano HC1) SE + CI per model — surfaced for the modelsummary coef table (design 2026-06-16)
  feSe: number; feCiLow: number; feCiHigh: number
  reSe: number; reCiLow: number; reCiHigh: number
}
export interface HausmanResult {
  chisq: number; df: number; p: number
  compareRows: HausmanCompareRow[]
  feR2: number; reR2: number; ciLevel: number
  alpha: number
  nObs: number; nEntities: number
  nExcluded: number
  figCoefPng: Uint8Array<ArrayBuffer>
}

// Fits FE + RE, runs plm::phtest, aligns FE vs RE slopes. Classical Hausman (phtest default).
// Per model, clustered (arellano HC1, group) SE + 95% CI are surfaced on the common FE slopes for the coef table.
const R_HAUSMAN = String.raw`
xnames <- xnames[seq_len(k)]
df <- data.frame(.entity = entity, .timev = timev, .y = y, stringsAsFactors = FALSE)
for (i in seq_len(k)) df[[xnames[i]]] <- x_flat[((i - 1L) * n_obs + 1L):(i * n_obs)]
pdat <- plm::pdata.frame(df, index = c('.entity', '.timev'))
form <- as.formula(paste('.y ~', paste(xnames, collapse = ' + ')))
fe <- plm::plm(form, data = pdat, model = 'within')
re <- plm::plm(form, data = pdat, model = 'random')
h  <- plm::phtest(fe, re)
fe_c <- coef(fe); re_c <- coef(re)
fe_vc <- plm::vcovHC(fe, method = 'arellano', type = 'HC1', cluster = 'group')
re_vc <- plm::vcovHC(re, method = 'arellano', type = 'HC1', cluster = 'group')
fe_se <- sqrt(diag(fe_vc)); re_se <- sqrt(diag(re_vc))
fe_ci <- lmtest::coefci(fe, vcov. = fe_vc, level = ci_level)
re_ci <- lmtest::coefci(re, vcov. = re_vc, level = ci_level)
common <- names(fe_c)   # FE slopes (within has no intercept)
compare_rows <- lapply(common, function(t) list(
  term = t, feB = unname(fe_c[t]), reB = unname(re_c[t]), diff = unname(fe_c[t] - re_c[t]),
  feSe = unname(fe_se[t]), feCiLow = unname(fe_ci[t, 1]), feCiHigh = unname(fe_ci[t, 2]),
  reSe = unname(re_se[t]), reCiLow = unname(re_ci[t, 1]), reCiHigh = unname(re_ci[t, 2])))
list(chisq = unname(h$statistic), df = unname(h$parameter), p = unname(h$p.value),
     compare_rows = compare_rows, n_obs = nrow(df), n_entities = plm::pdim(fe)$nT$n,
     fe_r2 = unname(summary(fe)$r.squared['rsq']), re_r2 = unname(summary(re)$r.squared['rsq']))`

// Side-by-side FE vs RE coefficient plot (clustered 95% CIs, dodged).
const R_HAUSMAN_PLOT = String.raw`
xnames <- xnames[seq_len(k)]
df <- data.frame(.entity = entity, .timev = timev, .y = y, stringsAsFactors = FALSE)
for (i in seq_len(k)) df[[xnames[i]]] <- x_flat[((i - 1L) * n_obs + 1L):(i * n_obs)]
pdat <- plm::pdata.frame(df, index = c('.entity', '.timev'))
form <- as.formula(paste('.y ~', paste(xnames, collapse = ' + ')))
fe <- plm::plm(form, data = pdat, model = 'within')
re <- plm::plm(form, data = pdat, model = 'random')
fe_c <- coef(fe); terms <- names(fe_c)
fe_ci <- lmtest::coefci(fe, vcov. = plm::vcovHC(fe, method = 'arellano', type = 'HC1', cluster = 'group'), level = 0.95)
re_ci <- lmtest::coefci(re, vcov. = plm::vcovHC(re, method = 'arellano', type = 'HC1', cluster = 'group'), level = 0.95)
re_c <- coef(re)
pdat2 <- rbind(
  data.frame(term = terms, model = 'FE', est = unname(fe_c[terms]), lo = fe_ci[terms, 1], hi = fe_ci[terms, 2]),
  data.frame(term = terms, model = 'RE', est = unname(re_c[terms]), lo = re_ci[terms, 1], hi = re_ci[terms, 2]))
pdat2$term <- factor(pdat2$term, levels = rev(terms))
print(ggplot2::ggplot(pdat2, ggplot2::aes(x = est, y = term, colour = model)) +
  ggplot2::geom_vline(xintercept = 0, colour = '#9cc2ec', linetype = 'dashed') +
  ggplot2::geom_pointrange(ggplot2::aes(xmin = lo, xmax = hi), position = ggplot2::position_dodge(width = 0.4)) +
  ggplot2::scale_colour_manual(values = c(FE = '#0c447c', RE = '#c8781e')) +
  ggplot2::labs(x = 'Estimate (95% CI)', y = NULL, colour = NULL))`

interface RawHausman {
  chisq: number; df: number; p: number
  compare_rows: HausmanCompareRow[]
  n_obs: number; n_entities: number
  fe_r2: number; re_r2: number
}

export async function runHausmanTest(
  engine: Engine, data: Dataset, entityCol: string, timeCol: string, outcomeCol: string, regressorCols: string[],
  opts: { alpha?: number } = {},
): Promise<HausmanResult> {
  const alpha = opts.alpha ?? 0.05
  const ciLevelV = 0.95 // Hausman card has no CI pill — clustered CIs are fixed at 95% (matches the plot)
  const present = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== ''
  const rows = data.rows.filter((r) =>
    present(r[entityCol]) && present(r[timeCol])
    && typeof r[outcomeCol] === 'number' && Number.isFinite(r[outcomeCol] as number)
    && regressorCols.every((c) => typeof r[c] === 'number' && Number.isFinite(r[c] as number)))
  const nExcluded = data.rows.length - rows.length
  if (new Set(rows.map((r) => String(r[entityCol]))).size < 2) throw new Error('Hausman test needs at least 2 entities.')
  if (new Set(rows.map((r) => String(r[timeCol]))).size < 2) throw new Error('Hausman test needs at least 2 time periods.')
  if (rows.length < regressorCols.length + 2) throw new Error(`Too few complete observations (${rows.length}) for ${regressorCols.length} regressor(s).`)
  const nObs = rows.length
  const env = {
    entity: rows.map((r) => String(r[entityCol])),
    timev: rows.map((r) => String(r[timeCol])),
    y: rows.map((r) => r[outcomeCol] as number),
    x_flat: regressorCols.flatMap((c) => rows.map((r) => r[c] as number)),
    xnames: regressorCols, k: regressorCols.length, n_obs: nObs, ci_level: ciLevelV,
  }
  const raw = await engine.runJson<RawHausman>(R_HAUSMAN, env)
  const figCoefPng = await engine.capturePlot(R_HAUSMAN_PLOT, 600, 450, env)
  return {
    chisq: raw.chisq, df: raw.df, p: raw.p, compareRows: raw.compare_rows,
    feR2: raw.fe_r2, reR2: raw.re_r2, ciLevel: ciLevelV,
    alpha, nObs: raw.n_obs, nEntities: raw.n_entities, nExcluded, figCoefPng,
  }
}
