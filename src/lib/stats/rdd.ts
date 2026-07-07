import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface RddResult {
  estimate: number; se: number; z: number; p: number; ciLow: number; ciHigh: number
  bandwidth: number; nLeft: number; nRight: number
  bwSelect: string; kernel: string
  mccrary: { t: number | null; p: number | null }
  // R1 gap-fix: bandwidth-sensitivity re-estimates at half/double the MSE-optimal h (fixed h=, same p/kernel).
  bwSensitivity: { half: { h: number; estimate: number; ciLow: number; ciHigh: number }; double: { h: number; estimate: number; ciLow: number; ciHigh: number } }
  cutoff: number; polyOrder: number
  ciLevel: number; alpha: number
  nObs: number; nExcluded: number
  figRdPng: Uint8Array<ArrayBuffer>
}

// rdrobust::rdrobust(y, x, c=cutoff, p=order, level=pct). Card reports the Conventional point estimate +
// bandwidth + N with rdrobust's recommended ROBUST (bias-corrected) inference (SE/z/p/CI = row 3).
// Footer labels the bandwidth selector (rd$bwselect = mserd) + kernel (rd$kernel = Triangular). The McCrary
// density manipulation test (rddensity::rddensity, Cattaneo–Jansson–Ma) reports the jackknife-robust t_jk/p_jk
// (the asymptotic t_asy/p_asy are NA for this design); NA → null guarded.
const R_RDD = String.raw`
rd <- rdrobust::rdrobust(y, x, c = cutoff, p = poly_order, level = ci_pct)
nanull <- function(v) if (length(v) != 1 || is.na(v)) NULL else unname(v)
mc <- tryCatch(rddensity::rddensity(x, c = cutoff)$test, error = function(e) list(t_jk = NA, p_jk = NA))
# R1 gap-fix: bandwidth-sensitivity re-estimates at half/double the MSE-optimal h (fixed h=, same p/level/kernel).
h0 <- unname(rd$bws[1, 1])
rd_half <- rdrobust::rdrobust(y, x, c = cutoff, p = poly_order, level = ci_pct, h = h0 / 2)
rd_double <- rdrobust::rdrobust(y, x, c = cutoff, p = poly_order, level = ci_pct, h = h0 * 2)
list(
  estimate = unname(rd$coef[1, 1]), se = unname(rd$se[3, 1]), z = unname(rd$z[3, 1]), p = unname(rd$pv[3, 1]),
  ci_low = unname(rd$ci[3, 1]), ci_high = unname(rd$ci[3, 2]), bandwidth = h0,
  n_left = unname(rd$N_h[1]), n_right = unname(rd$N_h[2]),
  bw_select = unname(rd$bwselect), kernel = unname(rd$kernel),
  mccrary_t = nanull(mc$t_jk), mccrary_p = nanull(mc$p_jk),
  bw_half = list(h = h0 / 2, estimate = unname(rd_half$coef[1, 1]), ciLow = unname(rd_half$ci[3, 1]), ciHigh = unname(rd_half$ci[3, 2])),
  bw_double = list(h = h0 * 2, estimate = unname(rd_double$coef[1, 1]), ciLow = unname(rd_double$ci[3, 1]), ciHigh = unname(rd_double$ci[3, 2])))`

const R_RD_PLOT = String.raw`print(rdrobust::rdplot(y, x, c = cutoff, hide = TRUE)$rdplot)`

interface RawRdd {
  estimate: number; se: number; z: number; p: number; ci_low: number; ci_high: number
  bandwidth: number; n_left: number; n_right: number
  bw_select: string; kernel: string
  mccrary_t: number | null; mccrary_p: number | null
  bw_half: { h: number; estimate: number; ciLow: number; ciHigh: number }
  bw_double: { h: number; estimate: number; ciLow: number; ciHigh: number }
}

export async function runRdd(
  engine: Engine, data: Dataset, outcome: string, runningVar: string,
  opts: { cutoff?: number; polyOrder?: number; ciLevel?: number; alpha?: number } = {},
): Promise<RddResult> {
  const cutoff = opts.cutoff ?? 50
  const polyOrder = opts.polyOrder ?? 1
  const ciLvl = opts.ciLevel ?? 0.95
  const alpha = opts.alpha ?? 0.05
  const num = (c: string, r: Record<string, unknown>) => typeof r[c] === 'number' && Number.isFinite(r[c] as number)
  const rows = data.rows.filter((r) => num(outcome, r) && num(runningVar, r))
  const nExcluded = data.rows.length - rows.length
  const xs = rows.map((r) => r[runningVar] as number)
  const left = xs.filter((x) => x < cutoff).length
  const right = xs.filter((x) => x >= cutoff).length
  if (left < 5 || right < 5) throw new Error(`Regression discontinuity needs observations on both sides of the cutoff (${cutoff}); found ${left} below and ${right} at/above.`)
  const env = {
    y: rows.map((r) => r[outcome] as number), x: xs,
    cutoff, poly_order: polyOrder, ci_pct: Math.round(ciLvl * 100),
  }
  const raw = await engine.runJson<RawRdd>(R_RDD, env)
  const figRdPng = await engine.capturePlot(R_RD_PLOT, 640, 480, env)
  return {
    estimate: raw.estimate, se: raw.se, z: raw.z, p: raw.p, ciLow: raw.ci_low, ciHigh: raw.ci_high,
    bandwidth: raw.bandwidth, nLeft: raw.n_left, nRight: raw.n_right,
    bwSelect: raw.bw_select, kernel: raw.kernel,
    mccrary: { t: raw.mccrary_t ?? null, p: raw.mccrary_p ?? null },
    bwSensitivity: { half: raw.bw_half, double: raw.bw_double },
    cutoff, polyOrder, ciLevel: ciLvl, alpha, nObs: rows.length, nExcluded, figRdPng,
  }
}
