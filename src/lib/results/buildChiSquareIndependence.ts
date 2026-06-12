import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { ChiSquareIndependenceResult } from '../stats/chiSquareIndependence'
import type { CardContent } from './builders'
import { f, f1, fdf, fp } from '../format/apa'

const pc = (x: number) => x.toFixed(1) // percentages at 1 dp (frequencies precedent)

export function buildChiSquareIndependence(spec: TestSpec, r: ChiSquareIndependenceResult): CardContent {
  // The sanctioned divergence (frequencies precedent): drawn Col 1/Col 2/… placeholders become one column
  // per category of the column variable + Total. Cell = obs [exp] (row% / col%) — recorded decision 4.
  const columns = [{ key: 'rowcat', label: 'Row \\ Column' },
    ...r.colCats.map((cat, j) => ({ key: `c${j}`, label: cat })), { key: 'total', label: 'Total' }]
  const R = r.rowCats.length, C = r.colCats.length
  const cell = (i: number, j: number) =>
    `${r.counts[i][j]} [${f(r.expected[i][j])}] (${pc(r.rowPct[i][j])}% / ${pc(r.colPct[i][j])}%)`
  const bodyRows = r.rowCats.map((cat, i) => {
    const row: Record<string, string | number> = { rowcat: cat, total: String(r.counts[i][C]) }
    r.colCats.forEach((_, j) => { row[`c${j}`] = cell(i, j) })
    return row
  })
  const totalRow: Record<string, string | number> = { rowcat: 'Total', total: String(r.counts[R][C]) }
  r.colCats.forEach((_, j) => { totalRow[`c${j}`] = String(r.counts[R][j]) })

  // Dynamic small-expected warning appended to the drawn note (the note itself promises this warning) — decision 5.
  const warn = r.minExpected < 5 ? ` Smallest expected count here is ${f1(r.minExpected)} — consider Fisher's exact test.` : ''
  const apa = spec.apaTemplate
    .replace('{df}', fdf(r.df)).replace('{n}', String(r.n)).replace('{chisq}', f(r.chisq))
    .replace('p={p}', r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`)
    .replace('{v}', f(r.v))
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: { ...spec.tables[0], columns }, rows: [...bodyRows, totalRow] },
      { spec: spec.tables[1], rows: [{ chisq: f(r.chisq), df: fdf(r.df), p: fp(r.p), v: f(r.v) }] },
    ],
    note: spec.tableNote ? { ...spec.tableNote, text: spec.tableNote.text + warn } : null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
