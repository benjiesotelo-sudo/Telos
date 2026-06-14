import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface PearsonResult {
  varA: string; varB: string // role names — builders get (spec, result) only
  r: number; t: number; df: number; p: number; ciLow: number; ciHigh: number; n: number
  ciLevel: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

const R_STATS = String.raw`
ct <- cor.test(x, y, conf.level = level)
list(r = unname(ct$estimate), t = unname(ct$statistic), df = unname(ct$parameter), p = ct$p.value,
     ciLow = ct$conf.int[1], ciHigh = ct$conf.int[2], n = length(x))`

// Card R map: geom_point()+geom_smooth(method="lm") — default se band; column names as axis labels (recorded decision 6).
const R_SCATTER = String.raw`
print(ggplot2::ggplot(data.frame(x = x, y = y), ggplot2::aes(x, y)) +
  ggplot2::geom_point(colour = '#0c447c') +
  ggplot2::geom_smooth(method = 'lm', colour = '#0c447c', fill = '#9cc2ec') +
  ggplot2::labs(x = xlab, y = ylab))`

interface RawStats { r: number; t: number; df: number; p: number; ciLow: number; ciHigh: number; n: number }

export async function runPearson(engine: Engine, data: Dataset, varA: string, varB: string, level = 0.95): Promise<PearsonResult> {
  // Per-test listwise (spec step-4a default): both role columns numeric-finite in the same row.
  const rows = data.rows.filter((r) =>
    typeof r[varA] === 'number' && Number.isFinite(r[varA] as number)
    && typeof r[varB] === 'number' && Number.isFinite(r[varB] as number))
  const nExcluded = data.rows.length - rows.length
  const env = { x: rows.map((r) => r[varA] as number), y: rows.map((r) => r[varB] as number), xlab: varA, ylab: varB, level }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_SCATTER, 600, 450, env)
  return { varA, varB, ...s, ciLevel: level, nExcluded, figurePng }
}
