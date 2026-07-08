import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { SummaryStatsResult } from '../stats/summaryStatistics'
import type { CardContent } from './builders'
import { f, fx, ciLevel } from '../format/apa'

// t-based mean CI cell: "[lo, hi]" with each bound em-dashed when null (n<2); whole cell em-dash if neither bound exists.
const ciCell = (lo: number | null, hi: number | null) => lo == null && hi == null ? '—' : `[${fx(lo, f)}, ${fx(hi, f)}]`

// A5: this card can summarize several variables (and groups) at once, so there is no single row to bind an
// explainer's live value to. Instead we report the range (or single value, when everything agrees) of each
// numeric column across the reported rows — still a real computed number, just aggregated rather than per-row.
const range = (nums: number[]) => {
  const arr = nums.filter((n) => Number.isFinite(n))
  if (!arr.length) return '—'
  const lo = Math.min(...arr), hi = Math.max(...arr)
  return lo === hi ? f(lo) : `${f(lo)}–${f(hi)}`
}
const intRange = (nums: number[]) => {
  if (!nums.length) return '—'
  const lo = Math.min(...nums), hi = Math.max(...nums)
  return lo === hi ? String(lo) : `${lo}–${hi}`
}

export function buildSummaryStatistics(spec: TestSpec, r: SummaryStatsResult): CardContent {
  const base = spec.tables[0]
  // The CI label carries the card's adjustable level when present (no CI option today ⇒ stays 95%), matching the t-test convention.
  const ci = spec.options?.find((o) => o.id === 'ci')
  const ciLabel = `${Math.round(ciLevel(ci?.value) * 100)}% CI`
  const cols = base.columns.map((c) => c.key === 'ci' ? { ...c, label: ciLabel } : c)
  // Per the card note, group-by ADDS a Group column (inserted first); non-mutating copy of the registry spec.
  const tableSpec = r.grouped ? { ...base, columns: [{ key: 'group', label: 'Group' }, ...cols] } : { ...base, columns: cols }
  const fig = figuresOf(spec)[0]
  return {
    tables: [{ spec: tableSpec, rows: r.rows.map((row) => ({
      ...(r.grouped ? { group: row.group! } : {}),
      variable: row.variable, n: row.n,
      mean: fx(row.mean, f), sd: fx(row.sd, f), ci: ciCell(row.ciLow, row.ciHigh),
      min: fx(row.min, f), max: fx(row.max, f),
      median: fx(row.median, f), skew: fx(row.skew, f), kurtosis: fx(row.kurtosis, f),
    })) }],
    note: spec.tableNote ?? null,
    // type is per-variable so Task 4's export names (figure_<type>.png) never collide across histograms.
    figures: r.histograms.map((h) => ({ caption: `${fig.caption} - ${h.variable}`, type: `${fig.type}_${h.variable}`, png: h.png })),
    howToRead: spec.howToRead,
    apa: spec.apaTemplate.replace('{x}', 'X'), // bare "Table." captions — the card's exemplar sentence stands as written
    nExcluded: r.nExcluded,
    values: {
      variable: String(new Set(r.rows.map((row) => row.variable)).size),
      grouped: r.grouped ? 'true' : 'false',
      n: intRange(r.rows.map((row) => row.n)),
      mean: range(r.rows.map((row) => row.mean ?? NaN)),
      sd: range(r.rows.map((row) => row.sd ?? NaN)),
      ci: ciLabel,
      min: range(r.rows.map((row) => row.min ?? NaN)),
      max: range(r.rows.map((row) => row.max ?? NaN)),
      median: range(r.rows.map((row) => row.median ?? NaN)),
      skew: range(r.rows.map((row) => row.skew ?? NaN)),
      kurtosis: range(r.rows.map((row) => row.kurtosis ?? NaN)),
    },
  }
}
