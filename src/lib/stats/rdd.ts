import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface RddResult {
  estimate: number; se: number; z: number; p: number; ciLow: number; ciHigh: number
  bandwidth: number; nLeft: number; nRight: number
  cutoff: number; polyOrder: number
  ciLevel: number; alpha: number
  nObs: number; nExcluded: number
  figRdPng: Uint8Array<ArrayBuffer>
}

// rdrobust::rdrobust(y, x, c=cutoff, p=order, level=pct). Card reports the Conventional point estimate +
// bandwidth + N with rdrobust's recommended ROBUST (bias-corrected) inference (SE/z/p/CI = row 3).
const R_RDD = String.raw`
rd <- rdrobust::rdrobust(y, x, c = cutoff, p = poly_order, level = ci_pct)
list(
  estimate = unname(rd$coef[1, 1]), se = unname(rd$se[3, 1]), z = unname(rd$z[3, 1]), p = unname(rd$pv[3, 1]),
  ci_low = unname(rd$ci[3, 1]), ci_high = unname(rd$ci[3, 2]), bandwidth = unname(rd$bws[1, 1]),
  n_left = unname(rd$N_h[1]), n_right = unname(rd$N_h[2]))`

const R_RD_PLOT = String.raw`print(rdrobust::rdplot(y, x, c = cutoff, hide = TRUE)$rdplot)`

interface RawRdd {
  estimate: number; se: number; z: number; p: number; ci_low: number; ci_high: number
  bandwidth: number; n_left: number; n_right: number
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
    cutoff, polyOrder, ciLevel: ciLvl, alpha, nObs: rows.length, nExcluded, figRdPng,
  }
}
