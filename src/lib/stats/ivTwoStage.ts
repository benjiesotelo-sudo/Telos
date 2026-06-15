import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface IvFirstStageRow { instrument: string; coef: number; se: number; partialF: number; p: number }
export interface IvCoefRow { term: string; b: number; se: number; t: number; p: number; ciLow: number; ciHigh: number }
export interface IvResult {
  firstStage: IvFirstStageRow[]
  coefRows: IvCoefRow[]
  weakF: number; weakP: number; wuF: number; wuP: number; sargan: number | null; sarganP: number | null
  endogenous: string[]
  seType: 'robust' | 'classical'
  ciLevel: number; alpha: number
  nObs: number; nExcluded: number
  figCoefPng: Uint8Array<ArrayBuffer>
}

// .y ~ endo + ctrl | instr + ctrl (AER::ivreg via the lighter `ivreg` pkg). Robust SE = sandwich::vcovHC.
// First stage = lm(firstEndogenous ~ instr + ctrl); per-instrument strength = (t-stat)². Diagnostics from
// summary(iv, diagnostics=TRUE): weak instruments F, Wu–Hausman, Sargan (NA when just-identified).
const R_IV = String.raw`
endo_names  <- endo_names[seq_len(n_endo)]
instr_names <- instr_names[seq_len(n_instr)]
ctrl_names  <- if (n_ctrl > 0) ctrl_names[seq_len(n_ctrl)] else character(0)
d <- data.frame(.y = y)
for (i in seq_len(n_endo))  d[[endo_names[i]]]  <- endo_flat[((i - 1L) * n_obs + 1L):(i * n_obs)]
for (i in seq_len(n_instr)) d[[instr_names[i]]] <- instr_flat[((i - 1L) * n_obs + 1L):(i * n_obs)]
for (i in seq_len(n_ctrl))  d[[ctrl_names[i]]]  <- ctrl_flat[((i - 1L) * n_obs + 1L):(i * n_obs)]
rhs    <- paste(c(endo_names, ctrl_names), collapse = ' + ')
ivpart <- paste(c(instr_names, ctrl_names), collapse = ' + ')
form   <- as.formula(paste('.y ~', rhs, '|', ivpart))
iv <- ivreg::ivreg(form, data = d)
V  <- if (se_robust) sandwich::vcovHC(iv, type = 'HC1') else stats::vcov(iv)
ct <- lmtest::coeftest(iv, vcov. = V); ci <- lmtest::coefci(iv, vcov. = V, level = ci_level)
labs <- rownames(ct)
coef_rows <- lapply(seq_along(labs), function(i) list(
  term = labs[i], b = ct[i, 1], se = ct[i, 2], t = ct[i, 3], p = ct[i, 4], ciLow = ci[i, 1], ciHigh = ci[i, 2]))
fs  <- lm(as.formula(paste(endo_names[1], '~', ivpart)), data = d)
fsc <- summary(fs)$coefficients
first_stage <- lapply(instr_names, function(nm) { r <- fsc[nm, ]; list(instrument = nm, coef = r[1], se = r[2], partialF = r[3]^2, p = r[4]) })
diag <- summary(iv, diagnostics = TRUE)$diagnostics
gd <- function(nm, col) if (nm %in% rownames(diag)) unname(diag[nm, col]) else NA_real_
list(first_stage = first_stage, coef_rows = coef_rows,
  weak_f = gd('Weak instruments', 'statistic'), weak_p = gd('Weak instruments', 'p-value'),
  wu_f = gd('Wu-Hausman', 'statistic'), wu_p = gd('Wu-Hausman', 'p-value'),
  sargan = gd('Sargan', 'statistic'), sargan_p = gd('Sargan', 'p-value'), n_obs = nrow(d))`

const R_IV_PLOT = String.raw`
endo_names  <- endo_names[seq_len(n_endo)]
instr_names <- instr_names[seq_len(n_instr)]
ctrl_names  <- if (n_ctrl > 0) ctrl_names[seq_len(n_ctrl)] else character(0)
d <- data.frame(.y = y)
for (i in seq_len(n_endo))  d[[endo_names[i]]]  <- endo_flat[((i - 1L) * n_obs + 1L):(i * n_obs)]
for (i in seq_len(n_instr)) d[[instr_names[i]]] <- instr_flat[((i - 1L) * n_obs + 1L):(i * n_obs)]
for (i in seq_len(n_ctrl))  d[[ctrl_names[i]]]  <- ctrl_flat[((i - 1L) * n_obs + 1L):(i * n_obs)]
rhs    <- paste(c(endo_names, ctrl_names), collapse = ' + ')
ivpart <- paste(c(instr_names, ctrl_names), collapse = ' + ')
iv  <- ivreg::ivreg(as.formula(paste('.y ~', rhs, '|', ivpart)), data = d)
ols <- lm(as.formula(paste('.y ~', rhs)), data = d)
ivc <- lmtest::coefci(iv, vcov. = sandwich::vcovHC(iv, type = 'HC1'), level = ci_level)
olc <- lmtest::coefci(ols, vcov. = sandwich::vcovHC(ols, type = 'HC1'), level = ci_level)
ivb <- coef(iv); olb <- coef(ols); terms <- endo_names
pdat <- rbind(
  data.frame(term = terms, model = 'OLS',  est = unname(olb[terms]), lo = olc[terms, 1], hi = olc[terms, 2]),
  data.frame(term = terms, model = '2SLS', est = unname(ivb[terms]), lo = ivc[terms, 1], hi = ivc[terms, 2]))
pdat$term <- factor(pdat$term, levels = rev(terms))
print(ggplot2::ggplot(pdat, ggplot2::aes(x = est, y = term, colour = model)) +
  ggplot2::geom_vline(xintercept = 0, colour = '#9cc2ec', linetype = 'dashed') +
  ggplot2::geom_pointrange(ggplot2::aes(xmin = lo, xmax = hi), position = ggplot2::position_dodge(width = 0.4)) +
  ggplot2::scale_colour_manual(values = c(OLS = '#0c447c', '2SLS' = '#c8781e')) +
  ggplot2::labs(x = 'Estimate (endogenous regressor)', y = NULL, colour = NULL))`

interface RawIv {
  first_stage: IvFirstStageRow[]; coef_rows: IvCoefRow[]
  weak_f: number; weak_p: number; wu_f: number; wu_p: number; sargan: number | null; sargan_p: number | null; n_obs: number
}

const numeric = (c: string) => (r: Record<string, unknown>) => typeof r[c] === 'number' && Number.isFinite(r[c] as number)

export async function runIvTwoStage(
  engine: Engine, data: Dataset, outcome: string, endogenous: string[], instruments: string[], controls: string[],
  opts: { seRobust?: boolean; ciLevel?: number; alpha?: number } = {},
): Promise<IvResult> {
  const seRobust = opts.seRobust ?? true
  const ciLvl = opts.ciLevel ?? 0.95
  const alpha = opts.alpha ?? 0.05
  if (instruments.length < endogenous.length) throw new Error('Instrumental variables needs at least as many instruments as endogenous regressors (order condition).')
  const used = [outcome, ...endogenous, ...instruments, ...controls]
  const rows = data.rows.filter((r) => used.every((c) => numeric(c)(r)))
  const nExcluded = data.rows.length - rows.length
  if (rows.length < used.length + 2) throw new Error(`Too few complete observations (${rows.length}) for 2SLS.`)
  const nObs = rows.length
  const flat = (cols: string[]) => cols.flatMap((c) => rows.map((r) => r[c] as number))
  const env = {
    y: rows.map((r) => r[outcome] as number),
    endo_flat: flat(endogenous), endo_names: endogenous, n_endo: endogenous.length,
    instr_flat: flat(instruments), instr_names: instruments, n_instr: instruments.length,
    ctrl_flat: controls.length ? flat(controls) : [0], ctrl_names: controls.length ? controls : ['__NONE__'], n_ctrl: controls.length,
    n_obs: nObs, se_robust: seRobust, ci_level: ciLvl,
  }
  const raw = await engine.runJson<RawIv>(R_IV, env)
  const figCoefPng = await engine.capturePlot(R_IV_PLOT, 600, 450, env)
  return {
    firstStage: raw.first_stage, coefRows: raw.coef_rows,
    weakF: raw.weak_f, weakP: raw.weak_p, wuF: raw.wu_f, wuP: raw.wu_p, sargan: raw.sargan, sarganP: raw.sargan_p,
    endogenous, seType: seRobust ? 'robust' : 'classical', ciLevel: ciLvl, alpha, nObs: raw.n_obs, nExcluded, figCoefPng,
  }
}
