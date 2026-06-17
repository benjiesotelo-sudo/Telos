import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface FishersExactResult {
  rowVar: string; colVar: string
  rowCats: string[]; colCats: string[]
  counts: number[][]            // (R+1) × (C+1) with margins
  p: number; is2x2: boolean
  or?: number; ciLow?: number; ciHigh?: number // 2×2 only (fisher.test's conditional-MLE OR)
  v?: number; vLow?: number; vHigh?: number     // larger-than-2×2 only: Cramér's V association effect size (effectsize::cramers_v)
  n: number; alpha: number; tails: string; nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

// fisher.test()'s OR is the CONDITIONAL MLE (the non-central hypergeometric MLE), not the sample cross-product — the
// card labels it as such. For tables larger than 2×2 the OR is undefined, so effectsize::cramers_v(adjust=FALSE, ci=0.95)
// supplies the association effect size + its (one-sided, upper bound pinned at 1.00) CI — mirroring the χ²-independence card.
const naNull = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null)
const R_STATS = String.raw`
tab <- table(rv, cv)
ft <- fisher.test(tab, alternative = alternative)
is22 <- all(dim(tab) == 2)
m <- addmargins(tab)
c(list(rowCats = rownames(tab), colCats = colnames(tab),
       counts = lapply(seq_len(nrow(m)), function(i) as.numeric(m[i, ])),
       p = ft$p.value, is2x2 = is22, n = sum(tab)),
  if (is22) list(or = unname(ft$estimate), ciLow = ft$conf.int[1], ciHigh = ft$conf.int[2])
  else { cv_es <- effectsize::cramers_v(tab, adjust = FALSE, ci = 0.95)
         list(v = cv_es$Cramers_v, vLow = cv_es$CI_low, vHigh = cv_es$CI_high) })`

const R_GROUPED_BAR = String.raw`
d <- data.frame(rv = factor(rv), cv = factor(cv))
print(ggplot2::ggplot(d, ggplot2::aes(rv, fill = cv)) +
  ggplot2::geom_bar(position = 'dodge', colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL, fill = NULL))`

interface RawStats { rowCats: string[]; colCats: string[]; counts: number[][]; p: number; is2x2: boolean; n: number; or?: number; ciLow?: number; ciHigh?: number; v?: number | null; vLow?: number | null; vHigh?: number | null }

export async function runFishersExact(engine: Engine, data: Dataset, rowVar: string, colVar: string, alpha = 0.05, alternative = 'two.sided'): Promise<FishersExactResult> {
  const rows = data.rows.filter((r) =>
    r[rowVar] !== null && r[rowVar] !== undefined && String(r[rowVar]).trim() !== ''
    && r[colVar] !== null && r[colVar] !== undefined && String(r[colVar]).trim() !== '')
  const nExcluded = data.rows.length - rows.length
  const env = { rv: rows.map((r) => String(r[rowVar])), cv: rows.map((r) => String(r[colVar])), alternative }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_GROUPED_BAR, 600, 450, env)
  // guard NA → null/undefined so the builder em-dashes (effectsize can return NA for the V CI on sparse tables)
  const v = naNull(s.v) ?? undefined, vLow = naNull(s.vLow) ?? undefined, vHigh = naNull(s.vHigh) ?? undefined
  return { rowVar, colVar, ...s, v, vLow, vHigh, alpha, tails: alternative, nExcluded, figurePng }
}
