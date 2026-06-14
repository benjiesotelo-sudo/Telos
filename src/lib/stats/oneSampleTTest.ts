import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface OneSampleTTestResult {
  variable: string
  n: number; mean: number; sd: number; se: number
  mu0: number
  t: number; df: number; p: number
  meanDiff: number                                // M − μ0
  ci: [number, number]                            // DIFFERENCE CI — see the spike-fact comment below
  cohensD: number
  shapiro: { W: number | null; p: number | null } // null outside Shapiro's 3–5000 range — rendered as em-dash
  ciLevel: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

// Card R map: t.test(x, mu=) → Table 2 · effectsize::cohens_d() → d. shapiro.test feeds the assume note
// ('normality (Shapiro-Wilk) reported under the descriptives').
// SPIKE FACT (do not "fix"): one-sample t.test conf.int is the CI of the MEAN. The card pairs '95% CI' with
// M_diff and the how-to-read says the CI shows 'by how much' — so the rendered CI is the DIFFERENCE CI
// = conf.int − μ0 (recorded decision; for μ0 = 0 the two coincide).
const R_STATS = String.raw`
n <- length(x)
res <- t.test(x, mu = mu0, conf.level = level)
d <- effectsize::cohens_d(x, mu = mu0)
sw <- if (n >= 3 && n <= 5000) shapiro.test(x) else NULL
list(n = n, mean = mean(x), sd = sd(x), se = sd(x)/sqrt(n),
  t = unname(res$statistic), df = unname(res$parameter), p = res$p.value,
  meanDiff = mean(x) - mu0,
  ci = as.numeric(res$conf.int) - mu0,
  cohensD = d$Cohens_d,
  shapiro = list(W = if (is.null(sw)) NA_real_ else unname(sw$statistic), p = if (is.null(sw)) NA_real_ else sw$p.value))`

// Card figure: 'distribution / boxplot with a reference line at the test value' → histogram + dashed vline at μ0.
const R_DISTRIBUTION = String.raw`
print(ggplot2::ggplot(data.frame(x = x), ggplot2::aes(x)) +
  ggplot2::geom_histogram(bins = nclass.Sturges(x), fill = '#9cc2ec', colour = '#0c447c') +
  ggplot2::geom_vline(xintercept = mu0, colour = '#0c447c', linetype = 'dashed') +
  ggplot2::labs(x = NULL, y = NULL))`

interface RawStats {
  n: number; mean: number; sd: number; se: number
  t: number; df: number; p: number; meanDiff: number; ci: number[]; cohensD: number
  shapiro: { W: number | null; p: number | null }
}

export async function runOneSampleTTest(engine: Engine, data: Dataset, outcome: string, mu0: number, level = 0.95): Promise<OneSampleTTestResult> {
  // Per-test single-column drop (design §2, global R2 policy): keep rows whose outcome value is a finite number.
  const values = data.rows.map((r) => r[outcome]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  const nExcluded = data.rows.length - values.length
  const env = { x: values, mu0, level }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_DISTRIBUTION, 600, 450, env)
  return {
    variable: outcome, n: s.n, mean: s.mean, sd: s.sd, se: s.se, mu0,
    t: s.t, df: s.df, p: s.p, meanDiff: s.meanDiff, ci: [s.ci[0], s.ci[1]], cohensD: s.cohensD,
    shapiro: s.shapiro, ciLevel: level, nExcluded, figurePng,
  }
}
