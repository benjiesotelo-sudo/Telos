import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { StationarityResult, StationarityRow } from '../stats/stationarityTests'
import type { CardContent } from './builders'
import { f, fp, fpApa } from '../format/apa'

// p cell: bounded KPSS/PP p-values render with the interpolation operator (e.g. "< .01" / "> .10");
// otherwise the compact table-style p (no leading zero).
const pCell = (row: StationarityRow): string =>
  row.pBounded === 'less' ? `< ${fp(row.p)}` : row.pBounded === 'greater' ? `> ${fp(row.p)}` : fp(row.p)

export function buildStationarityTests(spec: TestSpec, r: StationarityResult): CardContent {
  const rows = r.rows.map((row) => ({
    test: row.test, statistic: f(row.statistic), lag: row.lag,
    p: pCell(row), conclusion: row.conclusion,
  }))
  const adf = r.rows.find((x) => x.test === 'ADF')!
  const kpss = r.rows.find((x) => x.test === 'KPSS')!
  const apa = spec.apaTemplate
    .replace('{adf}', f(adf.statistic)).replace('{adfp}', fpApa(adf.p))
    .replace('{kpss}', f(kpss.statistic)).replace('{kpssp}', fpApa(kpss.p))
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
