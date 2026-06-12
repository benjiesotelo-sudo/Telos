import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface SpearmanResult {
  varA: string; varB: string
  rho: number; s: number; p: number; n: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

// exact = FALSE (recorded in design §3.2): deterministic asymptotic path — the exact path is unavailable
// with ties anyway, and this pins WebR ≡ native R regardless of tie pattern. Spike-verified both ways.
// suppressWarnings: the tie warning is expected, and the spike battery ran exactly this form.
const R_STATS = String.raw`
ct <- suppressWarnings(cor.test(x, y, method = 'spearman', exact = FALSE))
list(rho = unname(ct$estimate), s = unname(ct$statistic), p = ct$p.value, n = length(x))`

// Card R map: ggplot2 → figure; raw values (design §3.9), column names as axis labels.
const R_SCATTER = String.raw`
print(ggplot2::ggplot(data.frame(x = x, y = y), ggplot2::aes(x, y)) +
  ggplot2::geom_point(colour = '#0c447c') +
  ggplot2::labs(x = xlab, y = ylab))`

interface RawStats { rho: number; s: number; p: number; n: number }

export async function runSpearman(engine: Engine, data: Dataset, varA: string, varB: string): Promise<SpearmanResult> {
  const rows = data.rows.filter((r) =>
    typeof r[varA] === 'number' && Number.isFinite(r[varA] as number)
    && typeof r[varB] === 'number' && Number.isFinite(r[varB] as number))
  const nExcluded = data.rows.length - rows.length
  const env = { x: rows.map((r) => r[varA] as number), y: rows.map((r) => r[varB] as number), xlab: varA, ylab: varB }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_SCATTER, 600, 450, env)
  return { varA, varB, ...s, nExcluded, figurePng }
}
