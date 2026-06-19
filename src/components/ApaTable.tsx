import type { TableSpec } from '../lib/registry/types'
import type { MatrixTable } from '../lib/results/types'

// Classic tables (27 tests) render unchanged: one <td> per column, no row classes.
// Coef tables (kind:'coef', 2026-06-16) carry a `_kind` on each built row that styles it:
//   'coef' = estimate row · 'se' = muted (SE) row · 'ci' = muted [lo,hi] row ·
//   'rule' = the horizontal rule before the GOF footer · 'gof' = a footer row ·
//   'span' = a full-width row (e.g. the Hausman χ² diagnostic), text in the first column's key.
// Matrix tables (kind:'matrix', SEM): square correlation-style grids (Fornell-Larcker, HTMT, …).
type ClassicProps = { id: string; spec: TableSpec; rows: Record<string, string | number>[]; matrix?: never }
type MatrixProps = { matrix: MatrixTable; id?: never; spec?: never; rows?: never }

export function ApaTable(props: ClassicProps | MatrixProps) {
  if (props.matrix) {
    const { id, colLabels, rowLabels, cells, diagonal, lowerOnly } = props.matrix
    return (
      <table id={`table-${id}`} className="apa matrix">
        <thead><tr>
          <th />
          {colLabels.map((label, j) => <th key={j}>{label}</th>)}
        </tr></thead>
        <tbody>{rowLabels.map((rowLabel, i) => (
          <tr key={i}>
            <th>{rowLabel}</th>
            {colLabels.map((_, j) => {
              const isUpper = lowerOnly && j > i
              if (isUpper || cells[i][j] == null) return <td key={j}></td>
              const val = cells[i][j]
              const content = (diagonal === 'bold' && j === i) ? <strong>{val}</strong> : val
              return <td key={j}>{content}</td>
            })}
          </tr>
        ))}</tbody>
      </table>
    )
  }
  const { id, spec, rows } = props
  const n = spec.columns.length
  const firstKey = spec.columns[0]?.key
  return (
    <table id={id} className={spec.kind === 'coef' ? 'apa coef' : 'apa'}>
      <thead><tr>{spec.columns.map((c) => <th key={c.key}>{c.label}{c.sub && <sub>{c.sub}</sub>}{c.suffix}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => {
        const kind = r['_kind'] as string | undefined
        if (kind === 'rule') return <tr key={i} className="gofrule"><td colSpan={n} /></tr>
        if (kind === 'span') return <tr key={i} className="row-span"><td colSpan={n}>{r[firstKey]}</td></tr>
        return <tr key={i} className={kind ? `row-${kind}` : undefined}>{spec.columns.map((c) => <td key={c.key}>{r[c.key]}</td>)}</tr>
      })}</tbody>
    </table>
  )
}
