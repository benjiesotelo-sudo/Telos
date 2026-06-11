import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface FrequencyRow { category: string; n: number; pct: number; cumPct: number } // pct/cumPct already ×100
export interface CrossTab {
  rowCats: string[]; colCats: string[] // alphabetical (janitor::tabyl order — spike fact 4)
  counts: number[][]; rowPct: number[][]; colPct: number[][] // (rowCats+Total) × (colCats+Total), Total last; pct ×100
}
export interface FrequenciesResult {
  kind: 'one' | 'two'
  freq: FrequencyRow[] | null      // kind 'one'
  crosstab: CrossTab | null        // kind 'two'
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

// tabyl emits proportions 0–1 (spike fact 4) — ×100 here so display values match the verified numbers.
const R_FREQ = String.raw`
t <- janitor::tabyl(v1)
lapply(seq_len(nrow(t)), function(i) list(category = as.character(t[[1]][i]), n = as.numeric(t$n[i]),
  pct = as.numeric(t$percent[i]) * 100, cumPct = as.numeric(cumsum(t$percent)[i]) * 100))`

// adorn_totals FIRST, then adorn_percentages — janitor keeps the Total row/col inside the % tables
// (spike-verified: Total row row% = 0.5/0.5; Total col col% = the column marginals).
const R_CROSSTAB = String.raw`
d <- data.frame(r = v1, c = v2, stringsAsFactors = FALSE)
ct <- janitor::tabyl(d, r, c)
tot <- janitor::adorn_totals(ct, c('row','col'))
rp <- janitor::adorn_percentages(tot, 'row'); cp <- janitor::adorn_percentages(tot, 'col')
m <- as.matrix(tot[, -1]); rpm <- as.matrix(rp[, -1]); cpm <- as.matrix(cp[, -1])
list(rowCats = as.list(as.character(ct[[1]])), colCats = as.list(as.character(names(ct)[-1])),
  counts = lapply(seq_len(nrow(m)), function(i) as.numeric(m[i, ])),
  rowPct = lapply(seq_len(nrow(rpm)), function(i) as.numeric(rpm[i, ]) * 100),
  colPct = lapply(seq_len(nrow(cpm)), function(i) as.numeric(cpm[i, ]) * 100))`

const R_BAR = String.raw`
print(ggplot2::ggplot(data.frame(v = v1), ggplot2::aes(v)) +
  ggplot2::geom_bar(fill = '#9cc2ec', colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL))`

const R_GROUPED_BAR = String.raw`
print(ggplot2::ggplot(data.frame(r = v1, c = v2), ggplot2::aes(r, fill = c)) +
  ggplot2::geom_bar(position = 'dodge', colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL, fill = NULL))`

const present = (v: unknown) => v != null && String(v).trim() !== ''

export async function runFrequenciesCrosstabs(engine: Engine, data: Dataset, variables: string[]): Promise<FrequenciesResult> {
  // Present-category counting (design ruling): a row is used iff every USED column has a value.
  const used = variables.slice(0, 2)
  const rows = data.rows.filter((r) => used.every((c) => present(r[c])))
  const nExcluded = data.rows.length - rows.length
  if (used.length === 1) {
    const env = { v1: rows.map((r) => String(r[used[0]])) }
    const freq = await engine.runJson<FrequencyRow[]>(R_FREQ, env)
    const figurePng = await engine.capturePlot(R_BAR, 600, 450, env)
    return { kind: 'one', freq, crosstab: null, nExcluded, figurePng }
  }
  const env = { v1: rows.map((r) => String(r[used[0]])), v2: rows.map((r) => String(r[used[1]])) }
  const crosstab = await engine.runJson<CrossTab>(R_CROSSTAB, env)
  const figurePng = await engine.capturePlot(R_GROUPED_BAR, 600, 450, env)
  return { kind: 'two', freq: null, crosstab, nExcluded, figurePng }
}
