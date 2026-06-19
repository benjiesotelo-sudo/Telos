/** Matrix table: square (or rectangular) label×label grid — Fornell-Larcker, HTMT, interfactor-correlation. */
export interface MatrixTable {
  kind: 'matrix'
  id: string
  caption: string
  rowLabels: string[]
  colLabels: string[]
  cells: (string | number | null)[][]
  diagonal?: 'bold' | 'plain'
  lowerOnly?: boolean
}
