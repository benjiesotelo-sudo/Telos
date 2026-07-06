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
  // A6 device 4 (2026-07-06):
  diagonalStyle?: 'bold' | 'italic' // additive to `diagonal` (kept for back-compat, existing HTMT/AVE cards keep working unchanged); 'bold' here has the same effect as diagonal:'bold'; 'italic' is new (√AVE on the Fornell-Larcker diagonal)
  cellStars?: (string | null)[][] // same shape as `cells` - a significance-star suffix ('*'|'**'|'***') per cell, or null; appended after the cell's value
  starNote?: string // the star legend (e.g. "*p<.05, **p<.01, ***p<.001"); renders as a table footer row (HTML, inside the captured <table>) / a line after \end{tabular} (LaTeX)
}
