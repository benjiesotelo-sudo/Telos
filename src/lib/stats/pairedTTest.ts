import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface ConditionStat { condition: string; n: number; mean: number; sd: number }
export interface PairedTTestResult {
  conditions: [ConditionStat, ConditionStat]
  pair: string                          // 'A − B' (U+2212); diffs = A − B per the card's subtraction order
  t: number; df: number; p: number
  meanDiff: number                      // mean(A − B) = t.test estimate
  ci: [number, number]                  // CI of the mean difference at the requested level
  dz: number                            // effectsize::cohens_d(paired=TRUE)
  ciLevel: number
  nExcluded: number                     // incomplete pairs dropped listwise
  figurePng: Uint8Array<ArrayBuffer>
}

const R_STATS = String.raw`
desc <- psych::describe(data.frame(a = a, b = b))
res <- t.test(a, b, paired = TRUE, conf.level = level)
dz <- effectsize::cohens_d(a, b, paired = TRUE)$Cohens_d
list(stats = list(list(n = desc$n[1], mean = desc$mean[1], sd = desc$sd[1]),
                  list(n = desc$n[2], mean = desc$mean[2], sd = desc$sd[2])),
  t = unname(res$statistic), df = unname(res$parameter), p = res$p.value,
  meanDiff = unname(res$estimate), ci = as.numeric(res$conf.int), dz = dz)`

// The card's "paired-lines / difference plot": one line per case from Condition A to Condition B.
const R_FIGURE = String.raw`
df <- data.frame(case = rep(seq_along(a), 2),
  cond = factor(rep(c(la, lb), each = length(a)), levels = c(la, lb)),
  value = c(a, b))
print(ggplot2::ggplot(df, ggplot2::aes(cond, value, group = case)) +
  ggplot2::geom_line(colour = '#9cc2ec') + ggplot2::geom_point(colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL))`

interface RawStats { stats: { n: number; mean: number; sd: number }[]; t: number; df: number; p: number; meanDiff: number; ci: number[]; dz: number }

export async function runPairedTTest(engine: Engine, data: Dataset, conditionA: string, conditionB: string, level = 0.95): Promise<PairedTTestResult> {
  // Complete-pairs listwise (the card's missing-data unit): keep rows where BOTH condition columns are numeric-finite.
  const rows = data.rows.filter((r) =>
    typeof r[conditionA] === 'number' && Number.isFinite(r[conditionA] as number) &&
    typeof r[conditionB] === 'number' && Number.isFinite(r[conditionB] as number))
  const nExcluded = data.rows.length - rows.length
  const env = { a: rows.map((r) => r[conditionA] as number), b: rows.map((r) => r[conditionB] as number), la: conditionA, lb: conditionB, level }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_FIGURE, 600, 450, env)
  return {
    conditions: [
      { condition: conditionA, n: s.stats[0].n, mean: s.stats[0].mean, sd: s.stats[0].sd },
      { condition: conditionB, n: s.stats[1].n, mean: s.stats[1].mean, sd: s.stats[1].sd },
    ],
    pair: `${conditionA} − ${conditionB}`,
    t: s.t, df: s.df, p: s.p, meanDiff: s.meanDiff, ci: [s.ci[0], s.ci[1]], dz: s.dz,
    ciLevel: level, nExcluded, figurePng,
  }
}
