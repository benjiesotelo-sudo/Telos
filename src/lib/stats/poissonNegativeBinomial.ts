import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface PoissonNbTerm { term: string; b: number; se: number; z: number; p: number; irr: number; irrLow: number; irrHigh: number }
export interface PoissonNbResult {
  outcome: string
  model: 'Poisson' | 'negative binomial'
  aic: number; deviance: number; dfResid: number
  dispersion: number // Poisson: check_overdispersion $dispersion_ratio (≡ hand Pearson χ²/df); NB: theta (convention 10)
  terms: PoissonNbTerm[]
  n: number; nExcluded: number
  figResidualsPng: Uint8Array<ArrayBuffer>
}

// Offset enters IN-FORMULA as offset(log(.telos_exposure)) for BOTH models (convention 11; spike-verified glm.nb
// accepts it and profile CIs converge). The exposure column gets a synthetic frame name so it can never collide
// with a predictor name. Profile CIs need suppressMessages (spike risk 7). theta from m$theta (convention 10).
const R_STATS = String.raw`
d <- data.frame(y = y)
for (i in seq_along(numnames)) d[[numnames[i]]] <- nums_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(catnames)) d[[catnames[i]]] <- factor(cats_flat[((i - 1) * n + 1):(i * n)])
rhs <- paste(prednames, collapse = ' + ')
if (has_offset) { d$.telos_exposure <- exposure; rhs <- paste(rhs, '+ offset(log(.telos_exposure))') }
m <- if (negbin) MASS::glm.nb(as.formula(paste('y ~', rhs)), data = d)
     else glm(as.formula(paste('y ~', rhs)), family = poisson, data = d)
s <- summary(m)
cf <- s$coefficients
ci <- suppressMessages(confint(m))
labs <- rownames(cf)
parent <- vapply(labs, function(t) {
  if (t == '(Intercept)') return('')
  for (cn in catnames) if (startsWith(t, cn) && nchar(t) > nchar(cn)) return(cn)
  t
}, character(1))
pretty <- vapply(seq_along(labs), function(i) {
  if (labs[i] == '(Intercept)') labs[i]
  else if (parent[i] %in% catnames) paste0(parent[i], ': ', substring(labs[i], nchar(parent[i]) + 1))
  else labs[i]
}, character(1))
terms <- lapply(seq_along(labs), function(i) list(
  term = pretty[i], b = cf[i, 1], se = cf[i, 2], z = cf[i, 3], p = cf[i, 4],
  irr = exp(cf[i, 1]), irrLow = exp(ci[i, 1]), irrHigh = exp(ci[i, 2])))
disp <- if (negbin) m$theta else as.numeric(performance::check_overdispersion(m)$dispersion_ratio)
list(aic = AIC(m), deviance = m$deviance, dfResid = m$df.residual, dispersion = disp, terms = terms, n = nrow(d))`

// Card figure: fitted vs. Pearson residuals + dashed y = 0 (spike recipe, house styling).
const R_FITRES = String.raw`
d <- data.frame(y = y)
for (i in seq_along(numnames)) d[[numnames[i]]] <- nums_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(catnames)) d[[catnames[i]]] <- factor(cats_flat[((i - 1) * n + 1):(i * n)])
rhs <- paste(prednames, collapse = ' + ')
if (has_offset) { d$.telos_exposure <- exposure; rhs <- paste(rhs, '+ offset(log(.telos_exposure))') }
m <- if (negbin) MASS::glm.nb(as.formula(paste('y ~', rhs)), data = d)
     else glm(as.formula(paste('y ~', rhs)), family = poisson, data = d)
pd <- data.frame(fitted = fitted(m), resid = residuals(m, type = 'pearson'))
print(ggplot2::ggplot(pd, ggplot2::aes(fitted, resid)) +
  ggplot2::geom_hline(yintercept = 0, colour = '#9cc2ec', linetype = 'dashed') +
  ggplot2::geom_point(colour = '#0c447c') +
  ggplot2::labs(x = 'Fitted values', y = 'Pearson residuals'))`

interface RawStats { aic: number; deviance: number; dfResid: number; dispersion: number; terms: PoissonNbTerm[]; n: number }

/** Storage-type classification (recorded decision 1): all-numeric non-missing values → linear term; else factor. */
const isNumericColumn = (data: Dataset, col: string): boolean => {
  const vals = data.rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
  return vals.length > 0 && vals.every((v) => typeof v === 'number')
}

export async function runPoissonNegativeBinomial(engine: Engine, data: Dataset, outcome: string, predictors: string[],
  exposure: string | null, model: 'Poisson' | 'negative binomial'): Promise<PoissonNbResult> {
  const numPreds = predictors.filter((c) => isNumericColumn(data, c))
  const catPreds = predictors.filter((c) => !isNumericColumn(data, c))
  // Per-test listwise (convention 15): outcome + every predictor + exposure (when assigned) complete in the same row.
  const rows = data.rows.filter((r) =>
    typeof r[outcome] === 'number' && Number.isFinite(r[outcome] as number)
    && numPreds.every((c) => typeof r[c] === 'number' && Number.isFinite(r[c] as number))
    && catPreds.every((c) => r[c] !== null && r[c] !== undefined && String(r[c]).trim() !== '')
    && (exposure === null || (typeof r[exposure] === 'number' && Number.isFinite(r[exposure] as number))))
  const nExcluded = data.rows.length - rows.length
  const n = rows.length
  const env = {
    y: rows.map((r) => r[outcome] as number),
    prednames: predictors,
    numnames: numPreds, nums_flat: numPreds.flatMap((c) => rows.map((r) => r[c] as number)),
    catnames: catPreds, cats_flat: catPreds.flatMap((c) => rows.map((r) => String(r[c]))),
    has_offset: exposure !== null,
    exposure: exposure === null ? [0] : rows.map((r) => r[exposure] as number), // [0] placeholder, never read (has_offset gates)
    negbin: model === 'negative binomial',
    n,
  }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figResidualsPng = await engine.capturePlot(R_FITRES, 600, 450, env)
  return { outcome, model, ...s, nExcluded, figResidualsPng }
}
