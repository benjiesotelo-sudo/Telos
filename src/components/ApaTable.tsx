import type { TableSpec } from '../lib/registry/types'
export function ApaTable({ id, spec, rows }: { id: string; spec: TableSpec; rows: Record<string, string | number>[] }) {
  return (
    <table id={id} className="apa">
      <thead><tr>{spec.columns.map((c) => <th key={c.key}>{c.label}{c.sub && <sub>{c.sub}</sub>}{c.suffix}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{spec.columns.map((c) => <td key={c.key}>{r[c.key]}</td>)}</tr>)}</tbody>
    </table>
  )
}
