import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

// psych::describe default type=3 (Joanes & Gill b-family; kurtosis is EXCESS — spike fact 3).
// Always the data.frame path: NEVER describeBy(vector, g) — psych 2.6.3 treats the vector as factor codes (garbage).
// t-based mean CI = mean ± qt(1−(1−conf)/2, n−1)·SE. n<2 ⇒ qt(.,0)=Inf and SE=NA ⇒ NA bounds (.telos_json → null → em-dash).
const R_DESCRIBE = String.raw`
d <- psych::describe(data.frame(x = x))
tc <- qt(1 - (1 - conf) / 2, df = d$n[1] - 1)
list(n=d$n[1], mean=d$mean[1], sd=d$sd[1], min=d$min[1], max=d$max[1], median=d$median[1], skew=d$skew[1], kurtosis=d$kurtosis[1],
     ciLow=d$mean[1] - tc * d$se[1], ciHigh=d$mean[1] + tc * d$se[1])`

const R_DESCRIBE_BY = String.raw`
gs <- sort(unique(as.character(g)))  # alphabetical; as.character before .telos_json (spike fact 5)
lapply(gs, function(l) {
  d <- psych::describe(data.frame(x = x[g == l]))  # per-subset data.frame path — matches describeBy(data.frame…) verbatim (spike)
  tc <- qt(1 - (1 - conf) / 2, df = d$n[1] - 1)
  list(group=l, n=d$n[1], mean=d$mean[1], sd=d$sd[1], min=d$min[1], max=d$max[1], median=d$median[1], skew=d$skew[1], kurtosis=d$kurtosis[1],
       ciLow=d$mean[1] - tc * d$se[1], ciHigh=d$mean[1] + tc * d$se[1])
})`

// bins=12 fixed (not card-specified): explicit bins keeps stat_bin's pick-a-binwidth message out of the run.
const R_HIST = String.raw`
print(ggplot2::ggplot(data.frame(x = x), ggplot2::aes(x)) +
  ggplot2::geom_histogram(bins = 12, fill = '#9cc2ec', colour = '#0c447c') +
  ggplot2::scale_y_continuous(breaks = scales::breaks_extended(only.loose = TRUE, Q = c(1,2,5,10)), labels = scales::label_number(accuracy = 1)) +
  ggplot2::labs(x = NULL, y = 'Count'))`

export interface SummaryRow {
  variable: string; group?: string; n: number
  mean: number | null; sd: number | null; min: number | null; max: number | null
  median: number | null; skew: number | null; kurtosis: number | null  // null (e.g. sd at n=1) renders as em-dash
  ciLow: number | null; ciHigh: number | null  // t-based mean CI bounds; null at n<2 ⇒ em-dash
}
export interface SummaryStatsResult {
  rows: SummaryRow[]                 // ungrouped: one per variable; grouped: variable × group (groups alphabetical)
  grouped: boolean
  histograms: { variable: string; png: Uint8Array<ArrayBuffer> }[]  // one per variable, ALL kept values (card: per variable)
  nExcluded: number                  // always 0 — the per-variable N column carries missingness (recorded decision)
}
type RawRow = Omit<SummaryRow, 'variable' | 'group'>
type RawGroupRow = RawRow & { group: string }

export async function runSummaryStatistics(engine: Engine, data: Dataset, variables: string[], groupBy?: string, ciLevel = 0.95): Promise<SummaryStatsResult> {
  const rows: SummaryRow[] = []
  const histograms: { variable: string; png: Uint8Array<ArrayBuffer> }[] = []
  for (const variable of variables) {
    // Per-variable N (the card's missing-data unit): each variable drops its own missing/non-numeric cells;
    // grouped rows additionally need a present group value in the same row.
    const kept = data.rows.filter((r) => typeof r[variable] === 'number' && Number.isFinite(r[variable] as number))
    if (groupBy) {
      const paired = kept.filter((r) => r[groupBy] != null && String(r[groupBy]).trim() !== '')
      const env = { x: paired.map((r) => r[variable] as number), g: paired.map((r) => String(r[groupBy])), conf: ciLevel }
      for (const g of await engine.runJson<RawGroupRow[]>(R_DESCRIBE_BY, env)) rows.push({ variable, ...g })
    } else {
      rows.push({ variable, ...(await engine.runJson<RawRow>(R_DESCRIBE, { x: kept.map((r) => r[variable] as number), conf: ciLevel })) })
    }
    histograms.push({ variable, png: await engine.capturePlot(R_HIST, 600, 450, { x: kept.map((r) => r[variable] as number) }) })
  }
  return { rows, grouped: !!groupBy, histograms, nExcluded: 0 }
}
