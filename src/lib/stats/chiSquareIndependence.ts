import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface ContingencyData {
  rowCats: string[]; colCats: string[]
  counts: number[][]           // (R+1) × (C+1) — margins included (addmargins order)
  expected: number[][]; rowPct: number[][]; colPct: number[][] // R × C
}
export interface ChiSquareIndependenceResult extends ContingencyData {
  rowVar: string; colVar: string
  chisq: number; df: number; p: number; v: number; minExpected: number; n: number
  alpha: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

// Spike verdict (spec D1 fallback): rcompanion cannot load under webr (rootSolve lacks a wasm binary).
// Hand V on the UNCORRECTED χ² reproduces rcompanion::cramerV's native default exactly (the Yates-corrected
// value does NOT match) — V stays convention-stable while the test's own χ² follows the continuity toggle.
const R_STATS = String.raw`
tab <- table(rv, cv)
g <- suppressWarnings(chisq.test(tab, correct = continuity))
rp <- prop.table(tab, 1) * 100; cp <- prop.table(tab, 2) * 100
m <- addmargins(tab)
v <- sqrt(unname(suppressWarnings(chisq.test(tab, correct = FALSE))$statistic) / (sum(tab) * (min(dim(tab)) - 1)))
list(rowCats = rownames(tab), colCats = colnames(tab),
     counts = lapply(seq_len(nrow(m)), function(i) as.numeric(m[i, ])),
     expected = lapply(seq_len(nrow(tab)), function(i) as.numeric(g$expected[i, ])),
     rowPct = lapply(seq_len(nrow(tab)), function(i) as.numeric(rp[i, ])),
     colPct = lapply(seq_len(nrow(tab)), function(i) as.numeric(cp[i, ])),
     chisq = unname(g$statistic), df = unname(g$parameter), p = g$p.value,
     v = v, minExpected = min(g$expected), n = sum(tab))`

// Grouped (dodged) bar — frequencies-crosstabs styling.
const R_GROUPED_BAR = String.raw`
d <- data.frame(rv = factor(rv), cv = factor(cv))
print(ggplot2::ggplot(d, ggplot2::aes(rv, fill = cv)) +
  ggplot2::geom_bar(position = 'dodge', colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL, fill = NULL))`

interface RawStats extends ContingencyData { chisq: number; df: number; p: number; v: number; minExpected: number; n: number }

export async function runChiSquareIndependence(engine: Engine, data: Dataset, rowVar: string, colVar: string,
  continuity: boolean, alpha = 0.05): Promise<ChiSquareIndependenceResult> {
  const rows = data.rows.filter((r) =>
    r[rowVar] !== null && r[rowVar] !== undefined && String(r[rowVar]).trim() !== ''
    && r[colVar] !== null && r[colVar] !== undefined && String(r[colVar]).trim() !== '')
  const nExcluded = data.rows.length - rows.length
  const env = { rv: rows.map((r) => String(r[rowVar])), cv: rows.map((r) => String(r[colVar])), continuity }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_GROUPED_BAR, 600, 450, env)
  return { rowVar, colVar, ...s, alpha, nExcluded, figurePng }
}
