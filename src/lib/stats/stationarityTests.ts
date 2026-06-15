import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

// ── Result interface ──────────────────────────────────────────────────────────

export interface StationarityRow {
  test: string              // 'ADF' | 'KPSS' | 'PP'
  statistic: number
  lag: number
  p: number                 // raw numeric p from R (boundary value when bounded)
  pBounded: 'less' | 'greater' | null  // non-null when R fired the interpolation-range warning
  conclusion: string        // computed from p vs alpha per each test's null
}

export interface StationarityResult {
  rows: StationarityRow[]
  alpha: number
  n: number
  nExcluded: number
  // figures
  figSeriesPng: Uint8Array<ArrayBuffer>
  figAcfPng: Uint8Array<ArrayBuffer>
}

// ── R code blocks ─────────────────────────────────────────────────────────────

// Run ADF, KPSS, PP. Use withCallingHandlers to catch the interpolation-range warnings
// ("p-value smaller/greater than printed p-value") so the UI can show bounded display.
// All three are run unconditionally; the runner filters to the requested tests in JS.
// ts(x, frequency=1): we pass a plain numeric vector — frequency is not used by these tests
// but ts() is applied for consistency with the ARIMA/Stationarity backbone.
const R_TESTS = String.raw`
x_ts <- ts(x, frequency = 1)

# ADF — tseries::adf.test (exact p via interpolation, rarely bounded)
adf_res <- tseries::adf.test(x_ts)
adf_stat <- as.numeric(adf_res$statistic)
adf_lag  <- as.integer(adf_res$parameter)
adf_p    <- adf_res$p.value
# ADF p-values are exact (rarely at table boundary); use NA_character_ so JSON serialises to null
adf_bounded <- NA_character_

# KPSS — suppress the interpolation-range warning; capture its direction
kpss_bounded_dir <- NA_character_
kpss_res <- withCallingHandlers(
  tseries::kpss.test(x_ts),
  warning = function(w) {
    msg <- conditionMessage(w)
    if (grepl('smaller', msg)) kpss_bounded_dir <<- 'less'
    else if (grepl('greater', msg)) kpss_bounded_dir <<- 'greater'
    invokeRestart('muffleWarning')
  }
)
kpss_stat <- as.numeric(kpss_res$statistic)
kpss_lag  <- as.integer(kpss_res$parameter)
kpss_p    <- kpss_res$p.value

# Phillips-Perron — same bounded-p pattern as KPSS
pp_bounded_dir <- NA_character_
pp_res <- withCallingHandlers(
  tseries::pp.test(x_ts),
  warning = function(w) {
    msg <- conditionMessage(w)
    if (grepl('smaller', msg)) pp_bounded_dir <<- 'less'
    else if (grepl('greater', msg)) pp_bounded_dir <<- 'greater'
    invokeRestart('muffleWarning')
  }
)
pp_stat <- as.numeric(pp_res$statistic)
pp_lag  <- as.integer(pp_res$parameter)
pp_p    <- pp_res$p.value

list(
  adf  = list(statistic = adf_stat,  lag = adf_lag,  p = adf_p,  pBounded = adf_bounded),
  kpss = list(statistic = kpss_stat, lag = kpss_lag, p = kpss_p, pBounded = kpss_bounded_dir),
  pp   = list(statistic = pp_stat,   lag = pp_lag,   p = pp_p,   pBounded = pp_bounded_dir),
  n    = length(x_ts)
)`

// Figure 1 — raw series plot (level + first-difference side-by-side via ggplot2).
// Produces figure_series.png.
const R_SERIES_PLOT = String.raw`
x_ts <- ts(x, frequency = 1)
n    <- length(x_ts)
idx  <- seq_len(n)
dx   <- c(NA_real_, diff(as.numeric(x_ts)))
df   <- rbind(
  data.frame(panel = 'Level',         t = idx, y = as.numeric(x_ts)),
  data.frame(panel = 'First diff.',   t = idx, y = dx))
df$panel <- factor(df$panel, levels = c('Level', 'First diff.'))
print(ggplot2::ggplot(df, ggplot2::aes(t, y)) +
  ggplot2::geom_line(colour = '#0c447c') +
  ggplot2::facet_wrap(~panel, scales = 'free_y', ncol = 1) +
  ggplot2::labs(x = xlab, y = NULL) +
  ggplot2::theme_minimal())`

// Figure 2 — ACF + PACF via base R acf()/pacf() + ggplot2 facet_wrap (no patchwork — consistent
// with the ARIMA residuals panel pattern; forecast::ggAcf() is the source for the spec R map entry
// but facet_wrap produces the equivalent visual without an additional package dependency).
// Produces figure_acf.png.
const R_ACF_PLOT = String.raw`
x_ts <- ts(x, frequency = 1)
n    <- length(x_ts)
ci   <- qnorm(0.975) / sqrt(n)
ac   <- acf(x_ts,  plot = FALSE)
pac  <- pacf(x_ts, plot = FALSE)
ac_df  <- data.frame(panel = 'ACF',  lag = as.numeric(ac$lag[-1]),  value = as.numeric(ac$acf[-1]))
pac_df <- data.frame(panel = 'PACF', lag = as.numeric(pac$lag),     value = as.numeric(pac$acf))
df     <- rbind(ac_df, pac_df)
df$panel <- factor(df$panel, levels = c('ACF', 'PACF'))
print(ggplot2::ggplot(df, ggplot2::aes(x = lag, y = value)) +
  ggplot2::geom_hline(yintercept = c(ci, -ci), linetype = 'dashed', colour = '#9cc2ec') +
  ggplot2::geom_hline(yintercept = 0, colour = 'grey50') +
  ggplot2::geom_segment(ggplot2::aes(xend = lag, yend = 0), colour = '#0c447c') +
  ggplot2::facet_wrap(~panel, ncol = 1, scales = 'free_y') +
  ggplot2::labs(x = 'Lag', y = NULL) +
  ggplot2::theme_minimal())`

// ── Raw JSON type ─────────────────────────────────────────────────────────────

interface RawTestResult { statistic: number; lag: number; p: number; pBounded: string | null }
interface RawTests {
  adf: RawTestResult; kpss: RawTestResult; pp: RawTestResult; n: number
}

// ── Conclusion helper ─────────────────────────────────────────────────────────

// ADF null: unit root (non-stationary). p < α → reject → stationary.
// KPSS null: stationary. p < α → reject → non-stationary.
// PP null: unit root (non-stationary). p < α → reject → stationary.
function conclusion(test: 'ADF' | 'KPSS' | 'PP', p: number, alpha: number): string {
  if (test === 'KPSS') return p < alpha ? 'non-stationary' : 'stationary'
  return p < alpha ? 'stationary' : 'non-stationary'
}

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runStationarityTests(
  engine: Engine, data: Dataset,
  timeCol: string, seriesCol: string,
  opts: { alpha?: number } = {},
): Promise<StationarityResult> {
  const alpha = opts.alpha ?? 0.05

  // Listwise: keep rows where both time and series are present; series must be numeric-finite.
  const rows = data.rows.filter((r) => {
    const t = r[timeCol]; const v = r[seriesCol]
    return t !== null && t !== undefined && String(t).trim() !== ''
      && typeof v === 'number' && Number.isFinite(v as number)
  })
  const nExcluded = data.rows.length - rows.length

  // Sort ascending by time column (lexicographic for ISO dates; numeric for integer indices).
  const sorted = [...rows].sort((a, b) => {
    const na = Number(a[timeCol]); const nb = Number(b[timeCol])
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
    return String(a[timeCol]) < String(b[timeCol]) ? -1 : String(a[timeCol]) > String(b[timeCol]) ? 1 : 0
  })

  // Guard: duplicate time values
  const timeStrs = sorted.map((r) => String(r[timeCol]))
  if (new Set(timeStrs).size !== timeStrs.length) {
    throw new Error('Stationarity: duplicate time values detected — each time point must be unique')
  }

  const series = sorted.map((r) => r[seriesCol] as number)

  // Guard: minimum observations
  if (series.length < 20) {
    throw new Error(`Stationarity tests require at least 20 complete observations; found ${series.length}`)
  }

  const env = { x: series, xlab: timeCol, ylab: seriesCol }

  const raw = await engine.runJson<RawTests>(R_TESTS, env)

  // Build result rows
  const adfRow: StationarityRow = {
    test: 'ADF', statistic: raw.adf.statistic, lag: raw.adf.lag, p: raw.adf.p,
    pBounded: (raw.adf.pBounded as 'less' | 'greater' | null) ?? null,
    conclusion: conclusion('ADF', raw.adf.p, alpha),
  }
  const kpssRow: StationarityRow = {
    test: 'KPSS', statistic: raw.kpss.statistic, lag: raw.kpss.lag, p: raw.kpss.p,
    pBounded: (raw.kpss.pBounded as 'less' | 'greater' | null) ?? null,
    conclusion: conclusion('KPSS', raw.kpss.p, alpha),
  }
  const ppRow: StationarityRow = {
    test: 'PP', statistic: raw.pp.statistic, lag: raw.pp.lag, p: raw.pp.p,
    pBounded: (raw.pp.pBounded as 'less' | 'greater' | null) ?? null,
    conclusion: conclusion('PP', raw.pp.p, alpha),
  }

  const figSeriesPng = await engine.capturePlot(R_SERIES_PLOT, 700, 500, env)
  const figAcfPng = await engine.capturePlot(R_ACF_PLOT, 700, 500, env)

  return {
    rows: [adfRow, kpssRow, ppRow],
    alpha,
    n: raw.n,
    nExcluded,
    figSeriesPng,
    figAcfPng,
  }
}
