import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

// ── Result interface ──────────────────────────────────────────────────────────

export interface ArimaCoef { term: string; estimate: number; se: number; ciLow: number; ciHigh: number }

export interface ArimaForecastRow { period: number; forecast: number; lo80: number; hi80: number; lo95: number; hi95: number }

export interface ArimaSarimaResult {
  // model identity
  p: number; d: number; q: number; P: number; D: number; Q: number; s: number
  autoSelected: boolean
  // Table 1 — model summary
  coefs: ArimaCoef[]
  // Table 2 — fit & residual diagnostics
  aic: number; bic: number; loglik: number; sigma2: number
  // Ljung–Box test of residual autocorrelation: Q(lag), df = lag − (p+q+P+Q), and its p.
  ljungboxQ: number | null; ljungboxLag: number | null; ljungboxDf: number | null; ljungboxP: number
  // Table 3 — forecast
  forecastRows: ArimaForecastRow[]
  // metadata
  ciLevel: number
  n: number; nExcluded: number
  // figures
  figForecastPng: Uint8Array<ArrayBuffer>
  figResidualsPng: Uint8Array<ArrayBuffer>   // §2.5 econometrics-grade addition
}

// ── R code blocks ─────────────────────────────────────────────────────────────

// Model fitting — auto.arima (auto) or arima (manual).
// x is a plain numeric vector; ts() wraps it with the declared frequency.
// Leading/trailing NAs are trimmed before ts() is built.
// Duplicate time values and internal NAs are caught with stop() beforehand (runner checks in JS).
// confint default level = 0.975 sides → 95% CI; we pass level explicitly.
const R_MODEL = String.raw`
x_ts <- ts(x, frequency = s_period)
fit <- if (auto_mode) {
  forecast::auto.arima(x_ts)
} else {
  arima(x_ts, order = c(p_arg, d_arg, q_arg),
        seasonal = list(order = c(P_arg, D_arg, Q_arg), period = s_period))
}
ord <- fit$arma          # [p, q, P, Q, s, d, D]
p_val <- ord[1]; d_val <- ord[6]; q_val <- ord[2]
P_val <- ord[3]; D_val <- ord[7]; Q_val <- ord[4]; s_val <- ord[5]
cf   <- coef(fit)
se   <- sqrt(diag(fit$var.coef))
ci   <- confint(fit, level = ci_level)
terms <- lapply(seq_along(cf), function(i) list(
  term = names(cf)[i],
  estimate = unname(cf[i]),
  se = unname(se[i]),
  ciLow = unname(ci[i, 1]),
  ciHigh = unname(ci[i, 2])
))
# Ljung–Box on residuals: lag = max(10, 2*period); fitdf = #fitted ARMA params (p+q+P+Q).
lb_lag <- max(10, 2 * s_period)
lb_fitdf <- p_val + q_val + P_val + Q_val
lbt <- Box.test(residuals(fit), lag = lb_lag, fitdf = lb_fitdf, type = 'Ljung-Box')
ljp <- unname(lbt$p.value)
ljq <- unname(lbt$statistic)
ljdf <- unname(lbt$parameter)
fc  <- forecast::forecast(fit, h = horizon, level = c(80, 95))
frows <- lapply(seq_len(horizon), function(i) list(
  period = i,
  forecast = unname(fc$mean[i]),
  lo80 = unname(fc$lower[i, 1]),
  hi80 = unname(fc$upper[i, 1]),
  lo95 = unname(fc$lower[i, 2]),
  hi95 = unname(fc$upper[i, 2])
))
list(
  p = p_val, d = d_val, q = q_val, P = P_val, D = D_val, Q = Q_val, s = s_val,
  coefs = terms,
  aic = AIC(fit), bic = BIC(fit), loglik = as.numeric(logLik(fit)),
  sigma2 = fit$sigma2,
  ljungboxQ = ljq, ljungboxLag = lb_lag, ljungboxDf = ljdf, ljungboxP = ljp,
  forecastRows = frows,
  n = length(x)
)`

// Figure 1 — forecast plot: history + forecast + prediction intervals (ggplot2 via autoplot).
// We use forecast:::autoplot.forecast which requires print() to reach the device.
const R_FORECAST_PLOT = String.raw`
x_ts <- ts(x, frequency = s_period)
fit <- if (auto_mode) {
  forecast::auto.arima(x_ts)
} else {
  arima(x_ts, order = c(p_arg, d_arg, q_arg),
        seasonal = list(order = c(P_arg, D_arg, Q_arg), period = s_period))
}
fc <- forecast::forecast(fit, h = horizon, level = c(80, 95))
print(forecast::autoplot(fc) +
  ggplot2::labs(x = xlab, y = ylab) +
  ggplot2::theme_minimal())`

// Figure 2 (§2.5) — residual diagnostics: ACF of residuals + Normal Q–Q.
// Follows the simple-linear residual recipe: facet_wrap over a long frame, hand Q–Q panel.
const R_RESID_PLOT = String.raw`
x_ts <- ts(x, frequency = s_period)
fit <- if (auto_mode) {
  forecast::auto.arima(x_ts)
} else {
  arima(x_ts, order = c(p_arg, d_arg, q_arg),
        seasonal = list(order = c(P_arg, D_arg, Q_arg), period = s_period))
}
r <- as.numeric(residuals(fit))
nn <- length(r)
# ACF values (lag 1..maxlag)
ac <- acf(r, plot = FALSE)
lags <- as.numeric(ac$lag[-1]); acvals <- as.numeric(ac$acf[-1])
acf_df <- data.frame(panel = 'Residual ACF', x = lags, y = acvals)
ci_line <- qnorm(0.975) / sqrt(nn)
# Q-Q panel
qq_df <- data.frame(panel = 'Normal Q-Q', x = qnorm(ppoints(nn)), y = sort(r))
qs <- quantile(r, c(0.25, 0.75)); zs <- qnorm(c(0.25, 0.75))
slope <- diff(qs) / diff(zs); intercept <- qs[1] - slope * zs[1]
# Combine
panels <- rbind(acf_df, qq_df)
panels$panel <- factor(panels$panel, levels = c('Residual ACF', 'Normal Q-Q'))
refs <- data.frame(
  panel = factor(c('Residual ACF', 'Normal Q-Q'), levels = levels(panels$panel)),
  slope = c(0, slope), intercept = c(0, intercept))
print(ggplot2::ggplot(panels, ggplot2::aes(x, y)) +
  ggplot2::geom_abline(data = refs, ggplot2::aes(slope = slope, intercept = intercept),
    colour = '#9cc2ec', linetype = 'dashed') +
  ggplot2::geom_hline(data = data.frame(panel = factor('Residual ACF', levels = levels(panels$panel)),
    y = c(ci_line, -ci_line)), ggplot2::aes(yintercept = y),
    colour = '#9cc2ec', linetype = 'dotted') +
  ggplot2::geom_point(colour = '#0c447c') +
  ggplot2::facet_wrap(~panel, scales = 'free') +
  ggplot2::labs(x = NULL, y = NULL))`

// ── Raw JSON type ─────────────────────────────────────────────────────────────

interface RawModel {
  p: number; d: number; q: number; P: number; D: number; Q: number; s: number
  coefs: ArimaCoef[]; aic: number; bic: number; loglik: number; sigma2: number
  ljungboxQ: number | null; ljungboxLag: number | null; ljungboxDf: number | null; ljungboxP: number
  forecastRows: ArimaForecastRow[]; n: number
}

// NA → null (WebR serialises R NA/NaN as null already; this guard also catches non-finite numbers).
const nz = (x: number | null | undefined): number | null =>
  x == null || !Number.isFinite(x) ? null : x

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runArimaSarima(
  engine: Engine, data: Dataset,
  timeCol: string, seriesCol: string,
  opts: { auto: boolean; p?: number; d?: number; q?: number; P?: number; D?: number; Q?: number; seasonalPeriod?: number; horizon?: number; ciLevel?: number },
): Promise<ArimaSarimaResult> {
  const ciLevel = opts.ciLevel ?? 0.95
  const horizon = opts.horizon ?? 12
  const seasonalPeriod = opts.seasonalPeriod ?? 1

  // Listwise: keep rows where both time and series are non-null; series must be numeric-finite.
  const rows = data.rows.filter((r) => {
    const t = r[timeCol]; const v = r[seriesCol]
    return t !== null && t !== undefined && String(t).trim() !== ''
      && typeof v === 'number' && Number.isFinite(v as number)
  })
  const nExcluded = data.rows.length - rows.length

  // Sort ascending by time column (lexicographic for ISO dates; numeric for integer indices).
  const sorted = [...rows].sort((a, b) => {
    const ta = String(a[timeCol]); const tb = String(b[timeCol])
    const na = Number(a[timeCol]); const nb = Number(b[timeCol])
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
    return ta < tb ? -1 : ta > tb ? 1 : 0
  })

  const series = sorted.map((r) => r[seriesCol] as number)
  const timeVals = sorted.map((r) => r[timeCol])

  // Guard: duplicate time values
  const timeStrs = timeVals.map(String)
  if (new Set(timeStrs).size !== timeStrs.length) {
    throw new Error('ARIMA: duplicate time values detected — each time point must be unique')
  }

  // Trim leading/trailing NA (already filtered above; this is a belt-and-suspenders pass on the series itself)
  // Series is already numeric-finite from the filter above, so no trimming needed.
  // Guard: minimum observations
  if (series.length < 20) {
    throw new Error(`ARIMA requires at least 20 complete observations; found ${series.length}`)
  }

  // SARIMA cycle guard: need ≥ 2 full cycles
  if (seasonalPeriod > 1 && series.length < 2 * seasonalPeriod) {
    throw new Error(`SARIMA with period ${seasonalPeriod} requires ≥ ${2 * seasonalPeriod} observations; found ${series.length}`)
  }

  const env = {
    x: series,
    xlab: timeCol, ylab: seriesCol,
    auto_mode: opts.auto,
    p_arg: opts.p ?? 0, d_arg: opts.d ?? 0, q_arg: opts.q ?? 0,
    P_arg: opts.P ?? 0, D_arg: opts.D ?? 0, Q_arg: opts.Q ?? 0,
    s_period: seasonalPeriod,
    horizon,
    ci_level: ciLevel,
  }

  const raw = await engine.runJson<RawModel>(R_MODEL, env)
  const figForecastPng = await engine.capturePlot(R_FORECAST_PLOT, 700, 450, env)
  const figResidualsPng = await engine.capturePlot(R_RESID_PLOT, 800, 420, env)

  return {
    p: raw.p, d: raw.d, q: raw.q, P: raw.P, D: raw.D, Q: raw.Q, s: raw.s,
    autoSelected: opts.auto,
    coefs: raw.coefs,
    aic: raw.aic, bic: raw.bic, loglik: raw.loglik, sigma2: raw.sigma2,
    ljungboxQ: nz(raw.ljungboxQ), ljungboxLag: nz(raw.ljungboxLag), ljungboxDf: nz(raw.ljungboxDf),
    ljungboxP: raw.ljungboxP,
    forecastRows: raw.forecastRows,
    ciLevel,
    n: raw.n, nExcluded,
    figForecastPng,
    figResidualsPng,
  }
}
