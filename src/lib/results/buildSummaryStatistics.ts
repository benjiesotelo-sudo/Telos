import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { SummaryStatsResult } from '../stats/summaryStatistics'
import type { CardContent } from './builders'
import { f, fx } from '../format/apa'

export function buildSummaryStatistics(spec: TestSpec, r: SummaryStatsResult): CardContent {
  const base = spec.tables[0]
  // Per the card note, group-by ADDS a Group column (inserted first); non-mutating copy of the registry spec.
  const tableSpec = r.grouped ? { ...base, columns: [{ key: 'group', label: 'Group' }, ...base.columns] } : base
  const fig = figuresOf(spec)[0]
  return {
    tables: [{ spec: tableSpec, rows: r.rows.map((row) => ({
      ...(r.grouped ? { group: row.group! } : {}),
      variable: row.variable, n: row.n,
      mean: fx(row.mean, f), sd: fx(row.sd, f), min: fx(row.min, f), max: fx(row.max, f),
      median: fx(row.median, f), skew: fx(row.skew, f), kurtosis: fx(row.kurtosis, f),
    })) }],
    note: spec.tableNote ?? null,
    // type is per-variable so Task 4's export names (figure_<type>.png) never collide across histograms.
    figures: r.histograms.map((h) => ({ caption: `${fig.caption} — ${h.variable}`, type: `${fig.type}_${h.variable}`, png: h.png })),
    howToRead: spec.howToRead,
    apa: spec.apaTemplate.replace('{x}', 'X'), // bare "Table." captions — the card's exemplar sentence stands as written
    nExcluded: r.nExcluded,
  }
}
