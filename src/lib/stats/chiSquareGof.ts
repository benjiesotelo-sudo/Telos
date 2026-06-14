import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface GofRow { category: string; observed: number; expected: number; stdRes: number }
export interface ChiSquareGofResult {
  variable: string
  rows: GofRow[]
  chisq: number; df: number; p: number; w: number; n: number
  alpha: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

// props arrive normalized from propsArray (gate enforces |Σ−1| ≤ 0.001); R demands exactness → renormalize (decision 6).
// Spike: effectsize::cohens_w accepts p= custom proportions, identical native/webr (= √(χ²/N)). suppressWarnings:
// sparse-data approximation warnings are expected user territory (the card's own how-to-read covers it).
const R_STATS = String.raw`
tab <- table(v)
pr <- if (use_props) props / sum(props) else rep(1 / length(tab), length(tab))
g <- suppressWarnings(chisq.test(tab, p = pr))
w <- as.numeric(effectsize::cohens_w(tab, p = pr)$Cohens_w)
list(categories = names(tab), observed = as.numeric(tab), expected = as.numeric(g$expected),
     stdres = as.numeric(g$stdres), chisq = unname(g$statistic), df = unname(g$parameter),
     p = g$p.value, w = w, n = sum(tab))`

// Dodged observed-vs-expected bars (card figure: bar chart (observed vs. expected)); house palette.
const R_BAR = String.raw`
tab <- table(v)
pr <- if (use_props) props / sum(props) else rep(1 / length(tab), length(tab))
g <- suppressWarnings(chisq.test(tab, p = pr))
k <- length(tab)
d <- data.frame(category = factor(rep(names(tab), 2), levels = names(tab)),
  kind = factor(rep(c('Observed', 'Expected'), each = k), levels = c('Observed', 'Expected')),
  count = c(as.numeric(tab), as.numeric(g$expected)))
print(ggplot2::ggplot(d, ggplot2::aes(category, count, fill = kind)) +
  ggplot2::geom_col(position = 'dodge', colour = '#0c447c') +
  ggplot2::scale_fill_manual(values = c(Observed = '#9cc2ec', Expected = '#f0efe9')) +
  ggplot2::labs(x = NULL, y = NULL, fill = NULL))`

interface RawStats { categories: string[]; observed: number[]; expected: number[]; stdres: number[]; chisq: number; df: number; p: number; w: number; n: number }

/** props: alphabetical-category-order proportions (custom mode) or null (equal split). */
export async function runChiSquareGof(engine: Engine, data: Dataset, variable: string, props: number[] | null, alpha = 0.05): Promise<ChiSquareGofResult> {
  // Per-test listwise: non-empty value (categorical — numbers allowed, stringified like the column meta does).
  const vals = data.rows.map((r) => r[variable]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '').map(String)
  const nExcluded = data.rows.length - vals.length
  const env = { v: vals, props: props ?? [0], use_props: props !== null }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_BAR, 600, 450, env)
  return { variable,
    rows: s.categories.map((c, i) => ({ category: c, observed: s.observed[i], expected: s.expected[i], stdRes: s.stdres[i] })),
    chisq: s.chisq, df: s.df, p: s.p, w: s.w, n: s.n, alpha, nExcluded, figurePng }
}
