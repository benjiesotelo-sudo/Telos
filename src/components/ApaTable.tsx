import type { TableSpec } from '../lib/registry/types'
import { headerGroups } from '../lib/registry/types'
import type { MatrixTable } from '../lib/results/types'

// Classic tables (27 tests) render unchanged: one <td> per column, no row classes.
// Coef tables (kind:'coef', 2026-06-16) carry a `_kind` on each built row that styles it:
//   'coef' = estimate row · 'se' = muted (SE) row · 'ci' = muted [lo,hi] row ·
//   'rule' = the horizontal rule before the GOF footer · 'gof' = a footer row ·
//   'span' = a full-width row (e.g. the Hausman χ² diagnostic), text in the first column's key.
// Grouped rows (A6 device 1, 2026-07-06): a row carrying `__group: string` is a group-header row -
// all its columns are filled (group-level stats, e.g. CR/AVE/ω/α, live on it under their normal
// column keys) and it renders italic (class="row-group"). Rows that follow indent their first cell
// (class="row-child") until the NEXT `__group` row. This is a separate marker from `_kind` (which
// stays coef-table-only) so a classic table can opt in without touching the coef row machinery.
// Matrix tables (kind:'matrix', SEM): square correlation-style grids (Fornell-Larcker, HTMT, …).
type ClassicProps = { id: string; spec: TableSpec; rows: Record<string, string | number>[]; matrix?: never; domId?: never }
// `domId` overrides the matrix's logical id for the DOM id only — so a SEM spec that adds a
// domId collision-override (Task 33) renders `table-${domId}`, matching what the exporter's
// captureNode(`table-${spec.domId ?? spec.id}`) looks up. Without it the matrix render id and the
// export lookup diverge → getElementById null → toPng(null) "Cannot read … ownerDocument".
type MatrixProps = { matrix: MatrixTable; domId?: string; id?: never; spec?: never; rows?: never }

export function ApaTable(props: ClassicProps | MatrixProps) {
  if (props.matrix) {
    const { id, colLabels, rowLabels, cells, diagonal, diagonalStyle, lowerOnly, cellStars, starNote } = props.matrix
    return (
      // R1: overflow-x wrapper only - the id stays on the <table> so #table-* locators (e2e) and
      // captureNode(`table-${domId ?? id}`) (PNG export) still find the same element.
      <div style={{ overflowX: 'auto' }}>
        <table id={`table-${props.domId ?? id}`} className="apa matrix">
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
                const star = cellStars?.[i]?.[j]
                const val = star ? `${cells[i][j]}${star}` : cells[i][j]
                const isDiag = j === i
                const content =
                  isDiag && (diagonal === 'bold' || diagonalStyle === 'bold') ? <strong>{val}</strong> :
                  isDiag && diagonalStyle === 'italic' ? <em>{val}</em> :
                  val
                return <td key={j}>{content}</td>
              })}
            </tr>
          ))}</tbody>
          {starNote && <tfoot><tr><td colSpan={colLabels.length + 1} className="matrix-starnote">{starNote}</td></tr></tfoot>}
        </table>
      </div>
    )
  }
  const { id, spec, rows } = props
  const n = spec.columns.length
  const firstKey = spec.columns[0]?.key
  // Spanning column headers (A6 device 2, 2026-07-06): only when at least one column carries `span`
  // do we render a two-row <thead> - every other table keeps its original single-row header
  // (byte-identical). Plain (ungrouped) columns get rowSpan=2 so their label prints once.
  const groups = headerGroups(spec.columns)
  const hasSpan = groups.some((g) => g.group != null)
  const tableClass = spec.kind === 'coef' ? 'apa coef' : hasSpan ? 'apa spanned' : 'apa'
  // `__group` rows are their own italic header (group-level stats live on them, under their normal
  // column keys); everything after one indents (row-child) until the next `__group` resets it.
  let inGroup = false
  const bodyRows = rows.map((r, i) => {
    if ('__section' in r) {
      inGroup = false
      return <tr key={i} className="row-section"><td colSpan={n}>{r['__section']}</td></tr>
    }
    if ('__group' in r) {
      inGroup = true
      return <tr key={i} className="row-group">{spec.columns.map((c) => <td key={c.key}>{r[c.key]}</td>)}</tr>
    }
    const kind = r['_kind'] as string | undefined
    if (kind === 'rule') { inGroup = false; return <tr key={i} className="gofrule"><td colSpan={n} /></tr> }
    if (kind === 'span') { inGroup = false; return <tr key={i} className="row-span"><td colSpan={n}>{r[firstKey]}</td></tr> }
    const cls = [kind && `row-${kind}`, inGroup && 'row-child'].filter(Boolean).join(' ') || undefined
    return <tr key={i} className={cls}>{spec.columns.map((c) => <td key={c.key}>{r[c.key]}</td>)}</tr>
  })
  return (
    <div style={{ overflowX: 'auto' }}>
      <table id={id} className={tableClass}>
        <thead>{hasSpan ? (
          <>
            <tr>{groups.map((g) => g.group != null
              ? <th key={g.key} colSpan={g.cols.length} className="span-group">{g.group}</th>
              : <th key={g.key} rowSpan={2}>{g.cols[0].label}{g.cols[0].sub && <sub>{g.cols[0].sub}</sub>}{g.cols[0].suffix}</th>)}
            </tr>
            <tr>{groups.flatMap((g) => g.group == null ? [] :
              g.cols.map((c) => <th key={c.key}>{c.label}{c.sub && <sub>{c.sub}</sub>}{c.suffix}</th>))}
            </tr>
          </>
        ) : (
          <tr>{spec.columns.map((c) => <th key={c.key}>{c.label}{c.sub && <sub>{c.sub}</sub>}{c.suffix}</th>)}</tr>
        )}</thead>
        <tbody>{bodyRows}</tbody>
      </table>
    </div>
  )
}
