import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface KendallsTauResult {
  varA: string; varB: string
  tau: number; z: number; p: number; n: number
  tauLow: number; tauHigh: number                 // τ CI (APA-7: report the effect size WITH its CI), seeded percentile bootstrap
  alpha: number
  tails: string
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

// exact = FALSE (design §3.2): ONLY the asymptotic path returns the z statistic the card draws
// (the exact path's statistic is T). Spike-verified: statistic name is 'z' on this path, tied and untied.
// suppressWarnings: the tie warning is expected, and the spike battery ran exactly this form.
// τ CI: cor.test returns no CI for Kendall, so we hand-roll a SEEDED base-R percentile bootstrap
// (set.seed(20260617), R = 2000, paired row resample of tau-b). Native R ≡ WebR — assert in the stats test.
const R_STATS = String.raw`
ct <- suppressWarnings(cor.test(x, y, method = 'kendall', exact = FALSE, alternative = alternative))
level <- 0.95
set.seed(20260617)
boot <- numeric(2000)
n <- length(x)
for (b in seq_len(2000)) { idx <- sample.int(n, n, replace = TRUE); boot[b] <- suppressWarnings(cor(x[idx], y[idx], method = 'kendall')) }
ci <- unname(quantile(boot, probs = c((1 - level) / 2, 1 - (1 - level) / 2), names = FALSE, na.rm = TRUE))
list(tau = unname(ct$estimate), z = unname(ct$statistic), p = ct$p.value, n = n, tauLow = ci[1], tauHigh = ci[2])`

const R_SCATTER = String.raw`
print(ggplot2::ggplot(data.frame(x = x, y = y), ggplot2::aes(x, y)) +
  ggplot2::geom_point(colour = '#0c447c') +
  ggplot2::labs(x = xlab, y = ylab))`

interface RawStats { tau: number; z: number; p: number; n: number; tauLow: number; tauHigh: number }

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
