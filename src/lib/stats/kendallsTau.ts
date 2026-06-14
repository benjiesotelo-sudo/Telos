import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface KendallsTauResult {
  varA: string; varB: string
  tau: number; z: number; p: number; n: number
  alpha: number
  tails: string
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

// exact = FALSE (design §3.2): ONLY the asymptotic path returns the z statistic the card draws
// (the exact path's statistic is T). Spike-verified: statistic name is 'z' on this path, tied and untied.
// suppressWarnings: the tie warning is expected, and the spike battery ran exactly this form.
const R_STATS = String.raw`
ct <- suppressWarnings(cor.test(x, y, method = 'kendall', exact = FALSE, alternative = alternative))
list(tau = unname(ct$estimate), z = unname(ct$statistic), p = ct$p.value, n = length(x))`

const R_SCATTER = String.raw`
print(ggplot2::ggplot(data.frame(x = x, y = y), ggplot2::aes(x, y)) +
  ggplot2::geom_point(colour = '#0c447c') +
  ggplot2::labs(x = xlab, y = ylab))`

interface RawStats { tau: number; z: number; p: number; n: number }

export async function runKendallsTau(engine: Engine, data: Dataset, varA: string, varB: string, alpha = 0.05, alternative = 'two.sided'): Promise<KendallsTauResult> {
  const rows = data.rows.filter((r) =>
    typeof r[varA] === 'number' && Number.isFinite(r[varA] as number)
    && typeof r[varB] === 'number' && Number.isFinite(r[varB] as number))
  const nExcluded = data.rows.length - rows.length
  const env = { x: rows.map((r) => r[varA] as number), y: rows.map((r) => r[varB] as number), xlab: varA, ylab: varB, alternative }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_SCATTER, 600, 450, env)
  return { varA, varB, ...s, alpha, tails: alternative, nExcluded, figurePng }
}
