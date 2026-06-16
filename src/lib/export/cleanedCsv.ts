import type { Dataset } from '../stats/types'
// RFC-4180: quote a field if it contains comma, double-quote, CR or LF; double internal quotes; null/undefined -> empty.
const esc = (v: string | number | boolean | null | undefined): string => {
  if (v == null) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export function toCsv(ds: Dataset): string {
  return [ds.columns.join(','), ...ds.rows.map(r => ds.columns.map(c => esc(r[c])).join(','))].join('\n') + '\n'
}
