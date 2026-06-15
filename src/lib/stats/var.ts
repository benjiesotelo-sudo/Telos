import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

// ── Result interfaces ─────────────────────────────────────────────────────────

export interface VarLagRow {
  lag: number
  aic: number
  bic: number
  hq: number
}

export interface VarCoefRow {
  term: string      // e.g. 'e.l1' — the lagged-term label from summary(fit$varresult[[eq]])
  equation: string  // equation (response variable) name
  estimate: number
  se: number
  t: number
  p: number
}

export interface VarFevdRow {
  variable: string  // the forecasted variable
  impulse: string   // the shock source
  share: number     // share of forecast-error variance (0–1)
}

export interface VarResult {
  seriesNames: string[]
  selectedLag: number
  lagRows: VarLagRow[]
  coefRows: VarCoefRow[]
  fevdRows: VarFevdRow[]
  maxRootModulus: number  // §2.5: stability — max companion-eigenvalue modulus
  stable: boolean         // maxRootModulus < 1
  irfHorizon: number
  n: number
  nExcluded: number
  figIrfPng: Uint8Array<ArrayBuffer>
}

// ── R code blocks ─────────────────────────────────────────────────────────────

// VARselect + VAR + coefficient extraction + FEVD + roots.
// Inputs (env):
//   series_flat — flat numeric vector, column-major: all values for series_names[0], then [1], ...
//   series_names — character vector of column names
//   n_obs       — integer: number of rows
//   lag_max     — integer: upper VARselect search bound
//   irf_h       — integer: IRF horizon
// The runner sorts rows by time and passes the matrix column-by-column.
const R_VAR = String.raw`
# Rebuild data frame from flat column-major vector
k <- length(series_names)
df <- as.data.frame(
  lapply(seq_len(k), function(i) series_flat[((i - 1L) * n_obs + 1L):(i * n_obs)]))
colnames(df) <- series_names

# VARselect: cap search at floor((n-1)/k) to keep models identified
safe_max <- max(1L, min(as.integer(lag_max), floor((n_obs - 1L) / k)))
sel <- vars::VARselect(df, lag.max = safe_max, type = 'const')
criteria <- sel$criteria   # rows: AIC SC HQ FPE; cols: lag 1..safe_max

aic_vec <- criteria[1, ]
bic_vec <- criteria[2, ]
hq_vec  <- criteria[3, ]
lags_vec <- seq_len(ncol(criteria))
lag_table <- lapply(seq_along(lags_vec), function(i)
  list(lag = lags_vec[i], aic = aic_vec[i], bic = bic_vec[i], hq = hq_vec[i]))

# Pick lag by AIC minimum
selected_lag <- as.integer(which.min(aic_vec))

# Fit VAR
fit <- vars::VAR(df, p = selected_lag, type = 'const')

# Coefficient table: one row per lagged term (including const) per equation
coef_rows <- list()
for (eq_name in names(fit$varresult)) {
  cf <- summary(fit$varresult[[eq_name]])$coefficients
  for (i in seq_len(nrow(cf))) {
    coef_rows[[length(coef_rows) + 1L]] <- list(
      term     = rownames(cf)[i],
      equation = eq_name,
      estimate = cf[i, 1L],
      se       = cf[i, 2L],
      t        = cf[i, 3L],
      p        = cf[i, 4L]
    )
  }
}

# §2.5: FEVD at irfHorizon — long format
fevd_res  <- vars::fevd(fit, n.ahead = irf_h)
fevd_rows <- list()
for (var_name in names(fevd_res)) {
  row_h <- fevd_res[[var_name]][irf_h, ]
  for (imp_name in names(row_h)) {
    fevd_rows[[length(fevd_rows) + 1L]] <- list(
      variable = var_name,
      impulse  = imp_name,
      share    = unname(row_h[imp_name])
    )
  }
}

# §2.5: Stability — max companion-eigenvalue modulus (vars::roots returns moduli)
r_mod    <- vars::roots(fit)
max_root <- max(r_mod)
is_stable <- max_root < 1.0

list(
  lag_table    = lag_table,
  selected_lag = selected_lag,
  coef_rows    = coef_rows,
  fevd_rows    = fevd_rows,
  max_root     = max_root,
  is_stable    = is_stable
)`

// IRF figure — base graphics via vars plot method.
// Use bquote(.(p_use)) to embed the literal integer into the VAR call so vars stores
// 'VAR(df, p=1L, type="const")'. Bootstrap IRF re-evaluates fit$call via eval(call, parent.frame());
// a bare symbol like 'selected_lag' would not be in scope inside bootstrap internals.
const R_IRF = String.raw`
k     <- length(series_names)
p_use <- as.integer(selected_lag)
df    <- as.data.frame(
  lapply(seq_len(k), function(i) series_flat[((i - 1L) * n_obs + 1L):(i * n_obs)]))
colnames(df) <- series_names
fit     <- eval(bquote(vars::VAR(df, p = .(p_use), type = 'const')))
irf_obj <- vars::irf(fit, n.ahead = as.integer(irf_h), boot = TRUE)
plot(irf_obj)`

// ── Raw JSON type ─────────────────────────────────────────────────────────────

interface RawVar {
  lag_table: { lag: number; aic: number; bic: number; hq: number }[]
  selected_lag: number
  coef_rows: { term: string; equation: string; estimate: number; se: number; t: number; p: number }[]
  fevd_rows: { variable: string; impulse: string; share: number }[]
  max_root: number
  is_stable: boolean
}

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runVar(
  engine: Engine,
  data: Dataset,
  timeCol: string,
  seriesCols: string[],
  opts: { lagOrder?: 'auto' | number; irfHorizon?: number; lagMax?: number } = {},
): Promise<VarResult> {
  const irfHorizon = opts.irfHorizon ?? 10
  // lagMax: VARselect search upper bound. Auto mode uses 10; manual passes the explicit lag directly.
  const lagMax = typeof opts.lagOrder === 'number' ? opts.lagOrder : (opts.lagMax ?? 10)

  // Listwise: keep rows where time and ALL series columns are numeric-finite.
  const rows = data.rows.filter((r) => {
    const t = r[timeCol]
    if (t === null || t === undefined || String(t).trim() === '') return false
    return seriesCols.every((col) => typeof r[col] === 'number' && Number.isFinite(r[col] as number))
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
    throw new Error('VAR: duplicate time values detected — each time point must be unique')
  }

  // Minimum observations guard (complete-wide-rows ≥ 20)
  if (sorted.length < 20) {
    throw new Error(`VAR requires at least 20 complete observations; found ${sorted.length}`)
  }

  const nObs = sorted.length
  // Column-major flat array: all values for seriesCols[0], then [1], etc.
  const seriesFlat = seriesCols.flatMap((col) => sorted.map((r) => r[col] as number))

  const env = {
    series_flat: seriesFlat,
    series_names: seriesCols,
    n_obs: nObs,
    lag_max: lagMax,
    irf_h: irfHorizon,
    // selected_lag is populated from raw result for the figure call
    selected_lag: 0,
  }

  const raw = await engine.runJson<RawVar>(R_VAR, env)

  // Render IRF figure with the VARselect-picked lag
  const irfEnv = { ...env, selected_lag: raw.selected_lag }
  const figIrfPng = await engine.capturePlot(R_IRF, 800, 600, irfEnv)

  return {
    seriesNames: seriesCols,
    selectedLag: raw.selected_lag,
    lagRows: raw.lag_table,
    coefRows: raw.coef_rows,
    fevdRows: raw.fevd_rows,
    maxRootModulus: raw.max_root,
    stable: raw.is_stable,
    irfHorizon,
    n: nObs,
    nExcluded,
    figIrfPng,
  }
}
