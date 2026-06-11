import type { TestSpec } from '../registry/types'
import type { CardContent } from './builders'
import type { FrequenciesResult } from '../stats/frequenciesCrosstabs'

// Display convention (recorded): percentages arrive ×100 from the stats module, rendered at 1 dp.
// The % sign lives in Table 1's column header, and inside the cell for cross-tab cells. No negatives exist here.
const pc = (x: number) => x.toFixed(1)

export function buildFrequenciesCrosstabs(spec: TestSpec, r: FrequenciesResult): CardContent {
  const fig = spec.figures![0]
  const base = {
    figures: [{ caption: fig.caption, type: fig.type, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa: spec.apaTemplate.replace('{n}', '1'), // exactly one table is built per run → always Table 1 at runtime
    nExcluded: r.nExcluded,
  }
  if (r.kind === 'one') {
    return { ...base, note: null,
      tables: [{ spec: spec.tables[0], rows: r.freq!.map((x) => ({ category: x.category, n: x.n, pct: pc(x.pct), cumpct: pc(x.cumPct) })) }] }
  }
  const ct = r.crosstab!
  // THE one sanctioned divergence from the registry spec: replace the drawn Col 1/Col 2/… placeholders with
  // one column per category of the SECOND variable + Total (card note: "cross-tab columns expand to the
  // number of categories in the column variable").
  const columns = [{ key: 'rowcat', label: 'Row \\ Column' },
    ...ct.colCats.map((cat, j) => ({ key: `c${j}`, label: cat })), { key: 'total', label: 'Total' }]
  const R = ct.rowCats.length, C = ct.colCats.length
  const cell = (i: number, j: number) => `${ct.counts[i][j]} (${pc(ct.rowPct[i][j])}% / ${pc(ct.colPct[i][j])}%)`
  const rows = ct.rowCats.map((cat, i) => {
    const row: Record<string, string | number> = { rowcat: cat, total: String(ct.counts[i][C]) }
    ct.colCats.forEach((_, j) => { row[`c${j}`] = cell(i, j) })
    return row
  })
  const totalRow: Record<string, string | number> = { rowcat: 'Total', total: String(ct.counts[R][C]) }
  ct.colCats.forEach((_, j) => { totalRow[`c${j}`] = String(ct.counts[R][j]) }) // margins: plain counts (their %s are 100% by construction)
  return { ...base, note: spec.tableNote ?? null,
    tables: [{ spec: { ...spec.tables[1], columns }, rows: [...rows, totalRow] }] }
}
