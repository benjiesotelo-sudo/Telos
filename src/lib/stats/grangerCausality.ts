import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

// ── Result interface ──────────────────────────────────────────────────────────

export interface GrangerRow {
  direction: string   // 'X→Y' | 'Y→X'
  f: number
  df1: number         // numerator df (= maxLag)
  df2: number         // denominator df (Res.Df of restricted model)
  p: number
}

export interface GrangerResult {
  rows: [GrangerRow, GrangerRow]  // [X→Y, Y→X]
  maxLag: number
  alpha: number
  n: number
  nExcluded: number
  figCrossSeriesPng: Uint8Array<ArrayBuffer>
}

// ── R code blocks ─────────────────────────────────────────────────────────────

// Run lmtest::grangertest in both directions.
// grangertest(Y ~ X, order=maxLag): tests whether X Granger-causes Y.
// grangertest(X ~ Y, order=maxLag): tests whether Y Granger-causes X.
// Both x and y are plain numeric vectors (already sorted by time in JS).
// The anova-format result has 2 rows; row 2 carries F, Df (negative), Res.Df, Pr(>F).
const R_TESTS = String.raw`
# X → Y: does X Granger-cause Y?
res_xy <- lmtest::grangertest(y ~ x, order = max_lag)
f_xy   <- res_xy[["F"]][2]
df1_xy <- abs(res_xy[["Df"]][2])      # numerator df = max_lag
df2_xy <- res_xy[["Res.Df"]][2]       # denominator df (restricted model Res.Df)
p_xy   <- res_xy[["Pr(>F)"]][2]

# Y → X: does Y Granger-cause X?
res_yx <- lmtest::grangertest(x ~ y, order = max_lag)
f_yx   <- res_yx[["F"]][2]
df1_yx <- abs(res_yx[["Df"]][2])
df2_yx <- res_yx[["Res.Df"]][2]
p_yx   <- res_yx[["Pr(>F)"]][2]

list(
  xy = list(f = f_xy, df1 = df1_xy, df2 = df2_xy, p = p_xy),
  yx = list(f = f_yx, df1 = df1_yx, df2 = df2_yx, p = p_yx),
  n  = length(x)
)`

// Figure — cross-series time plot: both X and Y on the same time axis.
// Uses the integer index (1..n) as the x-axis; colour distinguishes the two series.
const R_CROSS_SERIES_PLOT = String.raw`
n   <- length(x)
idx <- seq_len(n)
df  <- rbind(
  data.frame(t = idx, value = x, series = xlab),
  data.frame(t = idx, value = y, series = ylab)
)
df$series <- factor(df$series, levels = c(xlab, ylab))
print(ggplot2::ggplot(df, ggplot2::aes(x = t, y = value, colour = series)) +
  ggplot2::geom_line() +
  ggplot2::scale_colour_manual(values = c('#0c447c', '#e07020')) +
  ggplot2::labs(x = tlab, y = NULL, colour = NULL) +
  ggplot2::theme_minimal() +
  ggplot2::theme(legend.position = 'top'))`

// ── Raw JSON type ─────────────────────────────────────────────────────────────

interface RawGranger {
  xy: { f: number; df1: number; df2: number; p: number }
  yx: { f: number; df1: number; df2: number; p: number }
  n: number
}

// ── Runner ────────────────────────────────────────────────────────────────────

export async function runGrangerCausality(
  engine: Engine, data: Dataset,
  timeCol: string, xCol: string, yCol: string,
  opts: { maxLag?: number; alpha?: number } = {},
): Promise<GrangerResult> {
  const maxLag = opts.maxLag ?? 4
  const alpha = opts.alpha ?? 0.05

  // Listwise: keep rows where time, x, and y are all present and numeric-finite.
  const rows = data.rows.filter((r) => {
    const t = r[timeCol]; const xv = r[xCol]; const yv = r[yCol]
    return t !== null && t !== undefined && String(t).trim() !== ''
      && typeof xv === 'number' && Number.isFinite(xv as number)
      && typeof yv === 'number' && Number.isFinite(yv as number)
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
    throw new Error('Granger: duplicate time values detected — each time point must be unique')
  }

  const xSeries = sorted.map((r) => r[xCol] as number)
  const ySeries = sorted.map((r) => r[yCol] as number)

  // Guard: minimum observations
  if (xSeries.length < 20) {
    throw new Error(`Granger causality requires at least 20 complete observations; found ${xSeries.length}`)
  }

  const env = {
    x: xSeries,
    y: ySeries,
    max_lag: maxLag,
    xlab: xCol,
    ylab: yCol,
    tlab: timeCol,
  }

  const raw = await engine.runJson<RawGranger>(R_TESTS, env)

  const figCrossSeriesPng = await engine.capturePlot(R_CROSS_SERIES_PLOT, 700, 400, env)

  return {
    rows: [
      { direction: 'X→Y', f: raw.xy.f, df1: raw.xy.df1, df2: raw.xy.df2, p: raw.xy.p },
      { direction: 'Y→X', f: raw.yx.f, df1: raw.yx.df1, df2: raw.yx.df2, p: raw.yx.p },
    ],
    maxLag,
    alpha,
    n: raw.n,
    nExcluded,
    figCrossSeriesPng,
  }
}
