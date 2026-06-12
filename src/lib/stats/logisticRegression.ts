import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface LogisticTerm { term: string; b: number; se: number; z: number; p: number; or: number; orLow: number; orHigh: number }
export interface LogisticResult {
  outcome: string; event: string
  reportOR: boolean // R1 display toggle — ORs always computed; the builder masks
  m2ll: number; aic: number; nagelkerke: number
  omnibusChisq: number; omnibusDf: number; omnibusP: number
  terms: LogisticTerm[]
  levels: string[]                 // factor order [other, event] — classification row/column order
  classCounts: number[][]          // rows = PREDICTED level (levels order), cols = observed (levels order)
  pctCorrect: (number | null)[]    // per-predicted-row 100·diag/rowsum; null when a row predicts nothing
  auc: number
  n: number; nExcluded: number
  figRocPng: Uint8Array<ArrayBuffer>
}

// Event re-level (convention 7): chosen level becomes glm's SECOND factor level — levels = c(other, event).
// −2LL = −2·logLik; omnibus χ² = null − residual deviance, df = df.null − df.residual, p from pchisq (convention 6).
// Nagelkerke via performance::r2_nagelkerke (D3: SHIP). Profile CIs need suppressMessages (spike risk 7).
// Classification HAND-computed (convention 8): cutoff P(event) ≥ 0.5, rows = predicted levels, caret never consulted.
// AUC via pROC (D1: SHIP) — spike-pinned ≡ hand rank/Mann-Whitney identity, and INVARIANT to the event choice.
const R_STATS = String.raw`
oth <- setdiff(sort(unique(yv)), event)
d <- data.frame(y = factor(yv, levels = c(oth, event)))
for (i in seq_along(numnames)) d[[numnames[i]]] <- nums_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(catnames)) d[[catnames[i]]] <- factor(cats_flat[((i - 1) * n + 1):(i * n)])
m <- glm(as.formula(paste('y ~', paste(prednames, collapse = ' + '))), family = binomial, data = d)
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
  or = exp(cf[i, 1]), orLow = exp(ci[i, 1]), orHigh = exp(ci[i, 2])))
omni <- m$null.deviance - m$deviance
odf <- m$df.null - m$df.residual
p <- fitted(m)
pred <- factor(ifelse(p >= 0.5, event, oth), levels = levels(d$y))
tab <- table(pred, d$y)
pct <- ifelse(rowSums(tab) > 0, 100 * diag(tab) / rowSums(tab), NA_real_)
auc <- as.numeric(pROC::auc(pROC::roc(d$y, p, quiet = TRUE)))
list(m2ll = -2 * as.numeric(logLik(m)), aic = AIC(m), nagelkerke = as.numeric(performance::r2_nagelkerke(m)),
     omnibusChisq = omni, omnibusDf = odf, omnibusP = pchisq(omni, odf, lower.tail = FALSE),
     terms = terms, levels = levels(d$y),
     classCounts = lapply(seq_len(nrow(tab)), function(i) as.numeric(tab[i, ])),
     pctCorrect = as.numeric(pct), auc = auc, n = nrow(d))`

// ROC figure (convention 9, spike recipe): hand threshold sweep — thresholds = −Inf, midpoints of sorted unique
// fitted probs, +Inf; the polyline IS the staircase (consecutive points differ in one coordinate). AUC annotated
// via the rank identity (≡ pROC, spike-pinned). House styling.
const R_ROC = String.raw`
oth <- setdiff(sort(unique(yv)), event)
d <- data.frame(y = factor(yv, levels = c(oth, event)))
for (i in seq_along(numnames)) d[[numnames[i]]] <- nums_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(catnames)) d[[catnames[i]]] <- factor(cats_flat[((i - 1) * n + 1):(i * n)])
m <- glm(as.formula(paste('y ~', paste(prednames, collapse = ' + '))), family = binomial, data = d)
p <- fitted(m)
u <- sort(unique(p)); th <- c(-Inf, (u[-1] + u[-length(u)]) / 2, Inf)
tpr <- vapply(th, function(t) mean(p[d$y == event] >= t), numeric(1))
fpr <- vapply(th, function(t) mean(p[d$y != event] >= t), numeric(1))
ord <- order(fpr, tpr)
n1 <- sum(d$y == event); n0 <- sum(d$y != event); rk <- rank(p)
auc <- (sum(rk[d$y == event]) - n1 * (n1 + 1) / 2) / (n1 * n0)
print(ggplot2::ggplot(data.frame(fpr = fpr[ord], tpr = tpr[ord]), ggplot2::aes(fpr, tpr)) +
  ggplot2::geom_abline(slope = 1, intercept = 0, colour = '#9cc2ec', linetype = 'dashed') +
  ggplot2::geom_line(colour = '#0c447c', linewidth = 0.8) +
  ggplot2::annotate('text', x = 0.7, y = 0.15, label = sprintf('AUC = %.3f', auc)) +
  ggplot2::coord_equal() +
  ggplot2::labs(x = '1 - Specificity', y = 'Sensitivity'))`

interface RawStats {
  m2ll: number; aic: number; nagelkerke: number; omnibusChisq: number; omnibusDf: number; omnibusP: number
  terms: LogisticTerm[]; levels: string[]; classCounts: number[][]; pctCorrect: (number | null)[]; auc: number; n: number
}

/** Storage-type classification (recorded decision 1): all-numeric non-missing values → linear term; else factor. */
const isNumericColumn = (data: Dataset, col: string): boolean => {
  const vals = data.rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
  return vals.length > 0 && vals.every((v) => typeof v === 'number')
}

export async function runLogisticRegression(engine: Engine, data: Dataset, outcome: string, predictors: string[],
  event: string, reportOR: boolean): Promise<LogisticResult> {
  const numPreds = predictors.filter((c) => isNumericColumn(data, c))
  const catPreds = predictors.filter((c) => !isNumericColumn(data, c))
  // Per-test listwise (convention 15): outcome non-blank (stringified — the level-select choices are strings) +
  // every predictor complete in the same row.
  const rows = data.rows.filter((r) =>
    r[outcome] !== null && r[outcome] !== undefined && String(r[outcome]).trim() !== ''
    && numPreds.every((c) => typeof r[c] === 'number' && Number.isFinite(r[c] as number))
    && catPreds.every((c) => r[c] !== null && r[c] !== undefined && String(r[c]).trim() !== ''))
  const nExcluded = data.rows.length - rows.length
  const n = rows.length
  const env = {
    yv: rows.map((r) => String(r[outcome])), event,
    prednames: predictors,
    numnames: numPreds, nums_flat: numPreds.flatMap((c) => rows.map((r) => r[c] as number)),
    catnames: catPreds, cats_flat: catPreds.flatMap((c) => rows.map((r) => String(r[c]))),
    n,
  }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figRocPng = await engine.capturePlot(R_ROC, 550, 550, env)
  return { outcome, event, reportOR, ...s, nExcluded, figRocPng }
}
