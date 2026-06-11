import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

// Card R map: shapiro.test() / nortest::lillie.test() → table · ggplot2 + stat_qq() → figures.
// Shapiro-Wilk applies for 3–5000 cases (card note) — outside that range it reports nulls (builder renders em-dashes).
// nortest::lillie.test stops below n = 5 ("sample size must be greater than 4") — guarded the same way,
// because minRule admits N = 3 and the runner must not crash on eligible data.
const R_STATS = String.raw`
n <- length(x)
sh <- if (n >= 3 && n <= 5000) shapiro.test(x) else NULL
ks <- if (n >= 5) nortest::lillie.test(x) else NULL
list(n = n,
  shapiro = if (is.null(sh)) list(W = NA_real_, p = NA_real_) else list(W = unname(sh$statistic), p = sh$p.value),
  ks = if (is.null(ks)) list(D = NA_real_, p = NA_real_) else list(D = unname(ks$statistic), p = ks$p.value))`

// ggplot2 objects must be print()ed to reach the active png() device. bins = 30 IS ggplot2's "auto"
// default (the bins pill), passed explicitly to silence the advisory message.
const R_HISTOGRAM = String.raw`
print(ggplot2::ggplot(data.frame(x = x), ggplot2::aes(x)) +
  ggplot2::geom_histogram(bins = 30, fill = '#9cc2ec', colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL))`

const R_QQ = String.raw`
print(ggplot2::ggplot(data.frame(x = x), ggplot2::aes(sample = x)) +
  ggplot2::stat_qq(colour = '#0c447c') + ggplot2::stat_qq_line(colour = '#9cc2ec') +
  ggplot2::labs(x = NULL, y = NULL))`

interface RawStats { n: number; shapiro: { W: number | null; p: number | null }; ks: { D: number | null; p: number | null } }
export interface DistributionNormalityResult extends RawStats {
  nExcluded: number
  histogramPng: Uint8Array<ArrayBuffer>
  qqPng: Uint8Array<ArrayBuffer>
}

export async function runDistributionNormality(engine: Engine, data: Dataset, variable: string): Promise<DistributionNormalityResult> {
  // Single-column drop (the card's missing-data unit under the global R2 policy): keep numeric-finite values only.
  const values = data.rows.map((r) => r[variable]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  const nExcluded = data.rows.length - values.length
  const env = { x: values }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const histogramPng = await engine.capturePlot(R_HISTOGRAM, 600, 450, env)
  const qqPng = await engine.capturePlot(R_QQ, 600, 450, env)
  return { ...s, nExcluded, histogramPng, qqPng }
}
