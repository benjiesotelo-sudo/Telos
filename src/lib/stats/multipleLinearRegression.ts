import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface MultipleLinearTerm { term: string; b: number; se: number; beta: number | null; t: number; p: number; ciLow: number; ciHigh: number; vif: number | null }
export interface MultipleLinearResult {
  outcome: string
  standardize: boolean // R1 display toggle — β is always computed; the builder masks
  r2: number; adjR2: number; f: number; df1: number; df2: number; p: number
  terms: MultipleLinearTerm[]
  n: number; nExcluded: number
  figResidualsPng: Uint8Array<ArrayBuffer>
}

// Data frame assembled with REAL column names (ancova flat-pack precedent) so coefficient rownames carry them.
// β via parameters::standardise_parameters(refit): numeric β = B·SD(x)/SD(y); dummy β = B/SD(y) (spike-pinned);
// intercept β ≈ 0 → NA_real_ → null → blank cell. VIF: car::vif is per-TERM; report (GVIF^(1/(2*Df)))^2 for every
// term (matrix column 3 squared; ≡ plain GVIF when all Df==1, where vif() returns a vector); every dummy row shows
// its parent term's value. k = 1 predictor: car::vif errors 'model contains fewer than 2 terms' (spike-pinned
// verbatim, both engines) → the call is guarded and VIF arrives NA_real_ → null → em-dash cells.
const R_STATS = String.raw`
numnames <- numnames[seq_len(nnum)]; catnames <- catnames[seq_len(ncat)]
d <- data.frame(y = y)
for (i in seq_along(numnames)) d[[numnames[i]]] <- nums_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(catnames)) d[[catnames[i]]] <- factor(cats_flat[((i - 1) * n + 1):(i * n)])
m <- lm(as.formula(paste('y ~', paste(prednames, collapse = ' + '))), data = d)
s <- summary(m)
cf <- s$coefficients; ci <- confint(m)
# β hand formula (spike-pinned ≡ parameters::standardise_parameters refit):
# numeric terms: B·SD(x)/SD(y); dummy terms: B/SD(y). Intercept: NA_real_.
sd_y <- sd(d$y)
labs <- rownames(cf)
parent <- vapply(labs, function(t) {
  if (t == '(Intercept)') return('')
  for (cn in catnames) if (startsWith(t, cn) && nchar(t) > nchar(cn)) return(cn)
  t
}, character(1))
betas <- vapply(labs, function(t) {
  if (t == '(Intercept)') return(NA_real_)
  p <- parent[t]
  if (p %in% catnames) return(cf[t, 1] / sd_y)  # dummy: B/SD(y)
  if (t %in% numnames) return(cf[t, 1] * sd(d[[t]]) / sd_y)  # numeric: B·SD(x)/SD(y)
  cf[t, 1] * sd(d[[t]]) / sd_y
}, numeric(1))
vift <- if (length(prednames) >= 2) { v <- car::vif(m); if (is.matrix(v)) v[, 3]^2 else v } else NULL
pretty <- vapply(seq_along(labs), function(i) {
  if (labs[i] == '(Intercept)') labs[i]
  else if (parent[i] %in% catnames) paste0(parent[i], ': ', substring(labs[i], nchar(parent[i]) + 1))
  else labs[i]
}, character(1))
terms <- lapply(seq_along(labs), function(i) list(
  term = pretty[i], b = cf[i, 1], se = cf[i, 2],
  beta = if (labs[i] == '(Intercept)') NA_real_ else unname(betas[labs[i]]),
  t = cf[i, 3], p = cf[i, 4], ciLow = ci[i, 1], ciHigh = ci[i, 2],
  vif = if (is.null(vift) || labs[i] == '(Intercept)') NA_real_ else unname(vift[parent[i]])))
fst <- s$fstatistic
list(r2 = s$r.squared, adjR2 = s$adj.r.squared, f = unname(fst[1]), df1 = unname(fst[2]), df2 = unname(fst[3]),
     p = pf(fst[1], fst[2], fst[3], lower.tail = FALSE), terms = terms, n = nrow(d))`

// Residual diagnostics — ONE file, one ggplot, facet_wrap over a stacked long frame (spike-pinned composition).
const R_RESID = String.raw`
numnames <- numnames[seq_len(nnum)]; catnames <- catnames[seq_len(ncat)]
d <- data.frame(y = y)
for (i in seq_along(numnames)) d[[numnames[i]]] <- nums_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(catnames)) d[[catnames[i]]] <- factor(cats_flat[((i - 1) * n + 1):(i * n)])
m <- lm(as.formula(paste('y ~', paste(prednames, collapse = ' + '))), data = d)
r <- residuals(m); fv <- fitted(m); nn <- length(r)
panels <- rbind(
  data.frame(panel = 'Residuals vs fitted', x = fv, y = r),
  data.frame(panel = 'Normal Q-Q', x = qnorm(ppoints(nn)), y = sort(r)))
panels$panel <- factor(panels$panel, levels = c('Residuals vs fitted', 'Normal Q-Q'))
qs <- quantile(r, c(0.25, 0.75)); zs <- qnorm(c(0.25, 0.75))
slope <- diff(qs) / diff(zs); intercept <- qs[1] - slope * zs[1]
refs <- data.frame(panel = factor(c('Residuals vs fitted', 'Normal Q-Q'), levels = levels(panels$panel)),
                   slope = c(0, slope), intercept = c(0, intercept))
print(ggplot2::ggplot(panels, ggplot2::aes(x, y)) +
  ggplot2::geom_abline(data = refs, ggplot2::aes(slope = slope, intercept = intercept), colour = '#9cc2ec', linetype = 'dashed') +
  ggplot2::geom_point(colour = '#0c447c') +
  ggplot2::facet_wrap(~panel, scales = 'free') +
  ggplot2::labs(x = NULL, y = NULL))`

interface RawStats { r2: number; adjR2: number; f: number; df1: number; df2: number; p: number; terms: MultipleLinearTerm[]; n: number }

/** Storage-type classification (recorded decision 1): all-numeric non-missing values → linear term; else factor. */
const isNumericColumn = (data: Dataset, col: string): boolean => {
  const vals = data.rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
  return vals.length > 0 && vals.every((v) => typeof v === 'number')
}

export async function runMultipleLinearRegression(engine: Engine, data: Dataset, outcome: string, predictors: string[],
  standardize: boolean): Promise<MultipleLinearResult> {
  const numPreds = predictors.filter((c) => isNumericColumn(data, c))
  const catPreds = predictors.filter((c) => !isNumericColumn(data, c))
  // Per-test listwise (convention 15): outcome numeric-finite + every predictor complete in the same row.
  const rows = data.rows.filter((r) =>
    typeof r[outcome] === 'number' && Number.isFinite(r[outcome] as number)
    && numPreds.every((c) => typeof r[c] === 'number' && Number.isFinite(r[c] as number))
    && catPreds.every((c) => r[c] !== null && r[c] !== undefined && String(r[c]).trim() !== ''))
  const nExcluded = data.rows.length - rows.length
  const n = rows.length
  // WebR cannot convert empty JS arrays [] to R vectors — pad with a sentinel when empty; R trims via ncat/nnum counts.
  const catNamesEnv = catPreds.length > 0 ? catPreds : ['__NONE__']
  const catsFlatEnv = catPreds.length > 0 ? catPreds.flatMap((c) => rows.map((r) => String(r[c]))) : ['__NONE__']
  const numNamesEnv = numPreds.length > 0 ? numPreds : ['__NONE__']
  const numsFlatEnv = numPreds.length > 0 ? numPreds.flatMap((c) => rows.map((r) => r[c] as number)) : [0]
  const env = {
    y: rows.map((r) => r[outcome] as number),
    prednames: predictors, // drag order = term order
    numnames: numNamesEnv, nums_flat: numsFlatEnv, nnum: numPreds.length,
    catnames: catNamesEnv, cats_flat: catsFlatEnv, ncat: catPreds.length,
    n,
  }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figResidualsPng = await engine.capturePlot(R_RESID, 800, 420, env)
  return { outcome, standardize, ...s, nExcluded, figResidualsPng }
}
