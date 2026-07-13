import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { StationarityResult, StationarityRow } from '../stats/stationarityTests'
import type { CardContent } from './builders'
import { f, fp, fpApa } from '../format/apa'

// p cell: bounded KPSS/PP p-values render with the interpolation operator (e.g. "< .01" / "> .10");
// otherwise the compact table-style p (no leading zero).
const pCell = (row: StationarityRow): string =>
  row.pBounded === 'less' ? `< ${fp(row.p)}` : row.pBounded === 'greater' ? `> ${fp(row.p)}` : fp(row.p)
// APA-sentence p: bounded values keep the interpolation operator ("< .01" / "> .10"); else report-only fpApa ("= .253")
const apaP = (row: StationarityRow): string =>
  row.pBounded === 'less' ? `< ${fp(row.p)}` : row.pBounded === 'greater' ? `> ${fp(row.p)}` : fpApa(row.p)

export function buildStationarityTests(spec: TestSpec, r: StationarityResult): CardContent {
  const rows = r.rows.map((row) => ({
    test: row.test, statistic: f(row.statistic), lag: row.lag,
    p: pCell(row), conclusion: row.conclusion,
  }))
  // R3 (board-clearing T3): the 'test' selector subsets which tests the runner reports, so every
  // row lookup is guarded - only the rows that ran exist. PP accompanies 'both' only.
  const adf = r.rows.find((x) => x.test === 'ADF')
  const kpss = r.rows.find((x) => x.test === 'KPSS')
  const pp = r.rows.find((x) => x.test === 'PP')
  const lead = adf ?? kpss
  if (!lead) throw new Error('Stationarity: no test rows in the result')
  // Verdict sentence degrades with the choice: 'both' = the full drawn-card template (all three
  // clauses); a subset run reports only its own test's clause.
  const apa = adf && kpss && pp
    ? spec.apaTemplate
        .replace('{adf}', f(adf.statistic)).replace('{adfp}', apaP(adf))
        .replace('{kpss}', f(kpss.statistic)).replace('{kpssp}', apaP(kpss))
        .replace('{pp}', f(pp.statistic)).replace('{ppp}', apaP(pp))
        .replace('{alpha}', String(r.alpha))
    : lead.test === 'ADF'
      ? `ADF gave τ=${f(lead.statistic)}, p ${apaP(lead)} (α=${r.alpha}).`
      : `KPSS gave LM=${f(lead.statistic)}, p ${apaP(lead)} (α=${r.alpha}).`
  // Disclosure line (owner ruling R3): name exactly which tests ran.
  const disclosure = r.rows.length === 3
    ? 'Tests run: ADF, KPSS, and Phillips–Perron.'
    : `Tests run: ${lead.test} only.`
  const figs = figuresOf(spec)
  return {
    tables: [{ spec: spec.tables[0], rows }],
    note: spec.tableNote ?? null,
    figures: [
      { caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figSeriesPng },
      { caption: figs[1].caption, type: figs[1].type, file: figs[1].file, png: r.figAcfPng },
    ],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.` + ` ${disclosure}`,
    apa,
    nExcluded: r.nExcluded,
    // A5 (U8-T4): one row stands in for the table (test/statistic/lag/p/conclusion are per-row) -
    // ADF when it ran, otherwise KPSS (R3 subset runs). 'test' lists the tests actually reported;
    // standIn/statLabel let the explainers name the stand-in test and its statistic symbol honestly.
    values: {
      test: r.rows.map((x) => x.test).join(', '),
      statistic: f(lead.statistic), lag: String(lead.lag), p: pCell(lead), conclusion: lead.conclusion,
      standIn: lead.test, statLabel: lead.test === 'ADF' ? 'τ' : 'LM',
    },
  }
}
