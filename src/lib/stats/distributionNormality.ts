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

// ggplot2 objects must be print()ed to reach the active png() device.
// Adaptive Sturges bins: max(5, min(30, ceiling(log2(n)+1))) — avoids the ggplot2 advisory and
// scales sensibly from n=3 (5 bins) to large n (capped at 30). Integer y-axis breaks for counts.
const R_HISTOGRAM = (variable: string) => String.raw`
bins <- max(5L, min(30L, ceiling(log2(length(x)) + 1)))
print(ggplot2::ggplot(data.frame(x = x), ggplot2::aes(x)) +
  ggplot2::geom_histogram(bins = bins, fill = '#9cc2ec', colour = '#0c447c') +
  ggplot2::scale_y_continuous(breaks = scales::breaks_extended(only.loose = TRUE, Q = c(1,2,5,10)), labels = scales::label_number(accuracy = 1)) +
  ggplot2::labs(x = ${JSON.stringify(variable)}, y = 'Count'))`

const R_QQ = String.raw`
print(ggplot2::ggplot(data.frame(x = x), ggplot2::aes(sample = x)) +
  ggplot2::stat_qq(colour = '#0c447c') + ggplot2::stat_qq_line(colour = '#9cc2ec') +
  ggplot2::labs(x = 'Theoretical quantiles', y = 'Sample quantiles'))`

interface RawStats { n: number; shapiro: { W: number | null; p: number | null }; ks: { D: number | null; p: number | null } }
export interface VariableNormality extends RawStats {
  variable: string
  nExcluded: number
  histogramPng: Uint8Array<ArrayBuffer>
  qqPng: Uint8Array<ArrayBuffer>
}
export interface DistributionNormalityResult { variables: VariableNormality[] }

export async function runDistributionNormality(engine: Engine, data: Dataset, variables: string[]): Promise<DistributionNormalityResult> {
  const out: VariableNormality[] = []
  for (const variable of variables) {
    // Single-column drop per variable (the card's missing-data unit under the global R2 policy): keep numeric-finite values only.
    const values = data.rows.map((r) => r[variable]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    const nExcluded = data.rows.length - values.length
    const env = { x: values }
    const s = await engine.runJson<RawStats>(R_STATS, env)
    const histogramPng = await engine.capturePlot(R_HISTOGRAM(variable), 600, 450, env)
    const qqPng = await engine.capturePlot(R_QQ, 600, 450, env)
    out.push({ variable, ...s, nExcluded, histogramPng, qqPng })
  }
  return { variables: out }
}
