import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { FishersExactResult } from '../stats/fishersExact'
import type { CardContent } from './builders'
import { f, fp, fpApa, fx } from '../format/apa'

const tailsNote = (t: string) => t === 'two.sided' ? '' : ` This was a one-tailed test (${t}).`

export function buildFishersExact(spec: TestSpec, r: FishersExactResult): CardContent {
  const columns = [{ key: 'rowcat', label: 'Row \\ Column' },
    ...r.colCats.map((cat, j) => ({ key: `c${j}`, label: cat })), { key: 'total', label: 'Total' }]
  const R = r.rowCats.length, C = r.colCats.length
  const bodyRows = r.rowCats.map((cat, i) => {
    const row: Record<string, string | number> = { rowcat: cat, total: String(r.counts[i][C]) }
    r.colCats.forEach((_, j) => { row[`c${j}`] = String(r.counts[i][j]) }) // plain counts (recorded decision 4)
    return row
  })
  const totalRow: Record<string, string | number> = { rowcat: 'Total', total: String(r.counts[R][C]) }
  r.colCats.forEach((_, j) => { totalRow[`c${j}`] = String(r.counts[R][j]) })

  const pStr = fpApa(r.p)
  // 2×2: the card's add-on slots in before the period (recorded decision 3); larger tables: base sentence only.
  const base = spec.apaTemplate.replace('[Var1]', r.rowVar).replace('[Var2]', r.colVar).replace('{p}', pStr)
  const apa = r.is2x2
    ? base.replace(/\.$/, ` (OR=${f(r.or!)}, 95% CI [${f(r.ciLow!)}, ${f(r.ciHigh!)}]).`)
    : base
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: { ...spec.tables[0], columns }, rows: [...bodyRows, totalRow] },
      // 2×2: conditional-MLE OR + CI (V undefined → em-dash). Larger tables: OR/CI undefined → em-dash, Cramér's V is the effect size.
      { spec: spec.tables[1], rows: [r.is2x2
        ? { p: fp(r.p), or: f(r.or!), ci: `[${f(r.ciLow!)}, ${f(r.ciHigh!)}]`, v: '—' }
        : { p: fp(r.p), or: '—', ci: '—', v: r.v == null ? '—' : `${f(r.v)} [${fx(r.vLow ?? null, f)}, ${fx(r.vHigh ?? null, f)}]` }] },
    ],
    note: spec.tableNote ?? null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.` + tailsNote(r.tails),
    apa,
    nExcluded: r.nExcluded,
  }
}
