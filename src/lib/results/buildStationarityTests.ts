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
  const adf = r.rows.find((x) => x.test === 'ADF')!
  const kpss = r.rows.find((x) => x.test === 'KPSS')!
  const pp = r.rows.find((x) => x.test === 'PP')!
  const apa = spec.apaTemplate
    .replace('{adf}', f(adf.statistic)).replace('{adfp}', apaP(adf))
    .replace('{kpss}', f(kpss.statistic)).replace('{kpssp}', apaP(kpss))
    .replace('{pp}', f(pp.statistic)).replace('{ppp}', apaP(pp))
    .replace('{alpha}', String(r.alpha))
  const figs = figuresOf(spec)
  return {
    tables: [{ spec: spec.tables[0], rows }],
    note: spec.tableNote ?? null,
    figures: [
      { caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figSeriesPng },
      { caption: figs[1].caption, type: figs[1].type, file: figs[1].file, png: r.figAcfPng },
    ],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
