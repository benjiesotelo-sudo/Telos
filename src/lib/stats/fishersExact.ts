import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface FishersExactResult {
  rowVar: string; colVar: string
  rowCats: string[]; colCats: string[]
  counts: number[][]            // (R+1) × (C+1) with margins
  p: number; is2x2: boolean
  or?: number; ciLow?: number; ciHigh?: number // 2×2 only
  n: number; nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

const R_STATS = String.raw`
tab <- table(rv, cv)
ft <- fisher.test(tab)
is22 <- all(dim(tab) == 2)
m <- addmargins(tab)
c(list(rowCats = rownames(tab), colCats = colnames(tab),
       counts = lapply(seq_len(nrow(m)), function(i) as.numeric(m[i, ])),
       p = ft$p.value, is2x2 = is22, n = sum(tab)),
  if (is22) list(or = unname(ft$estimate), ciLow = ft$conf.int[1], ciHigh = ft$conf.int[2]))`

const R_GROUPED_BAR = String.raw`
d <- data.frame(rv = factor(rv), cv = factor(cv))
print(ggplot2::ggplot(d, ggplot2::aes(rv, fill = cv)) +
  ggplot2::geom_bar(position = 'dodge', colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL, fill = NULL))`

interface RawStats { rowCats: string[]; colCats: string[]; counts: number[][]; p: number; is2x2: boolean; n: number; or?: number; ciLow?: number; ciHigh?: number }

export async function runFishersExact(engine: Engine, data: Dataset, rowVar: string, colVar: string): Promise<FishersExactResult> {
  const rows = data.rows.filter((r) =>
    r[rowVar] !== null && r[rowVar] !== undefined && String(r[rowVar]).trim() !== ''
    && r[colVar] !== null && r[colVar] !== undefined && String(r[colVar]).trim() !== '')
  const nExcluded = data.rows.length - rows.length
  const env = { rv: rows.map((r) => String(r[rowVar])), cv: rows.map((r) => String(r[colVar])) }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_GROUPED_BAR, 600, 450, env)
  return { rowVar, colVar, ...s, nExcluded, figurePng }
}
