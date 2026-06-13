import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface SimpleLinearTerm { term: string; b: number; se: number; beta: number | null; t: number; p: number; ciLow: number; ciHigh: number }
export interface SimpleLinearResult {
  outcome: string; predictor: string
  r2: number; adjR2: number; f: number; df1: number; df2: number; p: number; sigma: number // sigma = summary(m)$sigma — the Table 1 SE (convention 3)
  terms: SimpleLinearTerm[]
  n: number; nExcluded: number
  figFitPng: Uint8Array<ArrayBuffer>
  figResidualsPng: Uint8Array<ArrayBuffer>
}

// β via parameters::standardise_parameters (refit — the card's R map). Spike-pinned identities: numeric β = B·SD(x)/SD(y);
// dummy β = B/SD(y); standardized intercept ≈ 0 → NA_real_ → JSON null → blank cell per the ghost row.
// Dummy term names arrive R-glued (e.g. 'groupb') → rendered '<column>: <level>' (convention 1).
// lm confint is t-based — no profiling messages to suppress here.
// NOTE: We use eval(bquote(lm(.(reformulate(...)), data=d))) so that m$call contains a LITERAL formula
// (e.g. `post_score ~ pre_score`), not `as.formula(paste(yname,"~",xname))`. datawizard::standardize(m,method='refit')
// internally calls update(m, data=std_data); update.lm re-evaluates m$call in datawizard's env where captureR-env
// variables like `yname` and `xname` are NOT in scope — so as.formula(paste(...)) would fail. A literal formula
// in m$call is self-contained and resolves correctly in any environment. Root-cause confirmed by isolation tests.
const R_STATS = String.raw`
d <- data.frame(.y = y)
names(d)[1] <- yname
d[[xname]] <- if (x_is_factor) factor(x) else x
m <- eval(bquote(lm(.(reformulate(xname, response = yname)), data = d)))
s <- summary(m)
cf <- s$coefficients; ci <- confint(m, level = level)
sp <- parameters::standardise_parameters(m, method = 'refit')
betas <- setNames(sp$Std_Coefficient, sp$Parameter)
labs <- rownames(cf)
pretty <- vapply(labs, function(t) {
  if (t != '(Intercept)' && x_is_factor && startsWith(t, xname)) paste0(xname, ': ', substring(t, nchar(xname) + 1)) else t
}, character(1))
terms <- lapply(seq_along(labs), function(i) list(
  term = pretty[i], b = cf[i, 1], se = cf[i, 2],
  beta = if (labs[i] == '(Intercept)') NA_real_ else unname(betas[labs[i]]),
  t = cf[i, 3], p = cf[i, 4], ciLow = ci[i, 1], ciHigh = ci[i, 2]))
fst <- s$fstatistic
list(r2 = s$r.squared, adjR2 = s$adj.r.squared, f = unname(fst[1]), df1 = unname(fst[2]), df2 = unname(fst[3]),
     p = pf(fst[1], fst[2], fst[3], lower.tail = FALSE), sigma = s$sigma, terms = terms, n = nrow(d))`

// Card figure 1: fitted-line scatter (house styling). Categorical predictor → points only (recorded decision 7:
// geom_smooth(method='lm') is undefined on a discrete axis).
const R_FIT = String.raw`
p <- if (x_is_factor) {
  ggplot2::ggplot(data.frame(x = factor(x), y = y), ggplot2::aes(x, y)) +
    ggplot2::geom_point(colour = '#0c447c') +
    ggplot2::labs(x = xlab, y = ylab)
} else {
  ggplot2::ggplot(data.frame(x = x, y = y), ggplot2::aes(x, y)) +
    ggplot2::geom_point(colour = '#0c447c') +
    ggplot2::geom_smooth(method = 'lm', formula = y ~ x, se = TRUE, colour = '#0c447c', fill = '#9cc2ec') +
    ggplot2::labs(x = xlab, y = ylab)
}
print(p)`

// Card figure 2: residual diagnostics — ONE file, one ggplot, facet_wrap over a stacked long frame (spike-pinned
// composition): fitted-vs-residuals + Normal Q-Q (hand quantiles), per-panel reference lines via geom_abline(data=refs)
// (y = 0 line; quartile qqline slope = IQR(resid)/IQR(z)). No patchwork, no gridExtra.
const R_RESID = String.raw`
d <- data.frame(.y = y); names(d)[1] <- yname
d[[xname]] <- if (x_is_factor) factor(x) else x
m <- eval(bquote(lm(.(reformulate(xname, response = yname)), data = d)))
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

interface RawStats { r2: number; adjR2: number; f: number; df1: number; df2: number; p: number; sigma: number; terms: SimpleLinearTerm[]; n: number }

/** Storage-type classification (recorded decision 1): all-numeric non-missing values → linear term; else factor. */
const isNumericColumn = (data: Dataset, col: string): boolean => {
  const vals = data.rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
  return vals.length > 0 && vals.every((v) => typeof v === 'number')
}

export async function runSimpleLinearRegression(engine: Engine, data: Dataset, outcome: string, predictor: string, level = 0.95): Promise<SimpleLinearResult> {
  const xNumeric = isNumericColumn(data, predictor)
  // Per-test listwise (convention 15): outcome numeric-finite; predictor numeric-finite (numeric) or non-blank (categorical).
  const rows = data.rows.filter((r) =>
    typeof r[outcome] === 'number' && Number.isFinite(r[outcome] as number)
    && (xNumeric
      ? typeof r[predictor] === 'number' && Number.isFinite(r[predictor] as number)
      : r[predictor] !== null && r[predictor] !== undefined && String(r[predictor]).trim() !== ''))
  const nExcluded = data.rows.length - rows.length
  const env = {
    y: rows.map((r) => r[outcome] as number),
    x: xNumeric ? rows.map((r) => r[predictor] as number) : rows.map((r) => String(r[predictor])),
    yname: outcome, xname: predictor, x_is_factor: !xNumeric, xlab: predictor, ylab: outcome, level,
  }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figFitPng = await engine.capturePlot(R_FIT, 600, 450, env)
  const figResidualsPng = await engine.capturePlot(R_RESID, 800, 420, env)
  return { outcome, predictor, ...s, nExcluded, figFitPng, figResidualsPng }
}
