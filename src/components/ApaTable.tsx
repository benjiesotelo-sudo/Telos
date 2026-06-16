import type { TableSpec } from '../lib/registry/types'

// Classic tables (27 tests) render unchanged: one <td> per column, no row classes.
// Coef tables (kind:'coef', 2026-06-16) carry a `_kind` on each built row that styles it:
//   'coef' = estimate row · 'se' = muted (SE) row · 'ci' = muted [lo,hi] row ·
//   'rule' = the horizontal rule before the GOF footer · 'gof' = a footer row ·
//   'span' = a full-width row (e.g. the Hausman χ² diagnostic), text in the first column's key.
export function ApaTable({ id, spec, rows }: { id: string; spec: TableSpec; rows: Record<string, string | number>[] }) {
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
