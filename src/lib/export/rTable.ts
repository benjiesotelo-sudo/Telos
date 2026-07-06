import type { BuiltTable } from '../results/builders'
import type { ColumnDef, HeaderGroup } from '../registry/types'
import { headerGroups } from '../registry/types'

// LaTeX export: turn a BuiltTable into a booktabs `tabular`. Mirrors ApaTable.tsx —
// classic tables render one cell per spec.column; coef tables (kind:'coef') carry a `_kind` on each
// row ('coef'|'se'|'ci'|'rule'|'gof'|'span') and the est/(SE)/[CI] stacking is already in the cell values.

// Single pass over the original chars (a callback so inserted backslashes/braces are never re-escaped).
const LATEX_ESC: Record<string, string> = {
  '\\': '\\textbackslash{}', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}',
  _: '\\_', '%': '\\%', '&': '\\&', '#': '\\#', $: '\\$', '{': '\\{', '}': '\\}',
}

// Second pass: every non-ASCII / TeX-active glyph the app can emit → a robust ASCII-LaTeX
// equivalent that renders on BOTH pdfLaTeX and XeTeX/tectonic. The app routes negatives through
// apa.ts minus() (U+2212) and the builders emit Greek + math symbols (grepped from src/lib/results
// + src/lib/stats + src/lib/format/apa.ts). The replacement values are pure ASCII, so the second
// pass never re-escapes the backslashes inserted by the first pass. < and > are mapped too so
// pdfLaTeX does not form the ¡/¿ ligatures from them.
const UNICODE_ESC: Record<string, string> = {
  // dashes / minus
  '−': '$-$', // − minus (apa.ts minus())
  '–': '--', // – en dash
  '—': '---', // — em dash
  // operators / relations
  '×': '$\\times$', // ×
  '÷': '$\\div$', // ÷
  '±': '$\\pm$', // ±
  '√': '$\\surd$', // √
  '≤': '$\\le$', // ≤
  '≥': '$\\ge$', // ≥
  '≠': '$\\ne$', // ≠
  '≈': '$\\approx$', // ≈
  '≡': '$\\equiv$', // ≡
  '→': '$\\rightarrow$', // →
  '⇒': '$\\Rightarrow$', // ⇒
  '…': '\\ldots{}', // …
  // superscripts
  '²': '\\textsuperscript{2}', // ²
  '³': '\\textsuperscript{3}', // ³
  // punctuation / symbols
  '§': '\\S{}', // §
  '·': '$\\cdot$', // ·
  'é': '\\\'{e}', // é (Scheffé)
  '<': '$<$',
  '>': '$>$',
  // Greek lowercase
  'α': '$\\alpha$', // α
  'β': '$\\beta$', // β
  'γ': '$\\gamma$', // γ
  'δ': '$\\delta$', // δ
  'ε': '$\\varepsilon$', // ε
  'ζ': '$\\zeta$', // ζ
  'η': '$\\eta$', // η
  'θ': '$\\theta$', // θ
  'κ': '$\\kappa$', // κ
  'λ': '$\\lambda$', // λ
  'μ': '$\\mu$', // μ
  'ν': '$\\nu$', // ν
  'ξ': '$\\xi$', // ξ
  'ρ': '$\\rho$', // ρ
  'σ': '$\\sigma$', // σ
  'τ': '$\\tau$', // τ
  'φ': '$\\phi$', // φ
  'χ': '$\\chi$', // χ
  'ψ': '$\\psi$', // ψ
  'ω': '$\\omega$', // ω
  // Greek uppercase the app uses
  'Δ': '$\\Delta$', // Δ
  'Λ': '$\\Lambda$', // Λ (Wilks' Λ)
  'Σ': '$\\Sigma$', // Σ
  'Χ': '$X$', // Χ uppercase chi — no \Chi in LaTeX; the Latin X is identical
}
const UNICODE_RE = new RegExp(`[${Object.keys(UNICODE_ESC).join('')}]`, 'g')

export function escapeLatex(s: string): string {
  // Pass 1: TeX-active ASCII → escaped forms (callback so inserted \ and {} survive pass 2 unchanged,
  // since all UNICODE_ESC keys are outside [\\~^_%&#${}<>] except < and > which pass 1 leaves alone).
  const escaped = s.replace(/[\\~^_%&#${}]/g, (c) => LATEX_ESC[c])
  // Pass 2: only the listed code points are touched; their ASCII replacements are inert for pass 1.
  return escaped.replace(UNICODE_RE, (c) => UNICODE_ESC[c])
}

const cell = (v: string | number | undefined) => escapeLatex(v == null ? '' : String(v))
const flatLabel = (c: ColumnDef) => escapeLatex(`${c.label}${c.sub ?? ''}${c.suffix ?? ''}`)
const colSpec = (n: number) => `{${'l'.repeat(n)}}`

/** A coef BuiltTable → booktabs tabular: model headers; stacked est/(SE)/[CI] rows; \midrule then GOF; span via \multicolumn. */
export function coefToLatex(t: BuiltTable): string {
  const cols = t.spec.columns
  const n = cols.length
  const header = cols.map(flatLabel).join(' & ') + ' \\\\'
  const body = t.rows.map((r) => {
    const kind = r['_kind'] as string | undefined
    if (kind === 'rule') return '\\midrule'
    if (kind === 'span') return `\\multicolumn{${n}}{l}{${cell(r[cols[0].key])}} \\\\`
    return cols.map((c) => cell(r[c.key])).join(' & ') + ' \\\\'
  })
  return [`\\begin{tabular}${colSpec(n)}`, '\\toprule', header, '\\midrule', ...body, '\\bottomrule', '\\end{tabular}'].join('\n')
}

/** A matrix BuiltTable (kind:'matrix' - Fornell-Larcker / HTMT / interfactor-Φ) → booktabs tabular.
 *  Mirrors ApaTable.tsx: blank corner + column labels header; one row per rowLabel; `lowerOnly` blanks
 *  the upper triangle; `diagonal:'bold'` bolds the diagonal. Data lives in t.matrix (spec.columns is empty).
 *  A6 device 4 (2026-07-06): `cellStars` appends a significance suffix after the cell value;
 *  `diagonalStyle` italicizes the diagonal (`'bold'` behaves like the legacy `diagonal:'bold'`);
 *  `starNote` prints as an italic line AFTER \end{tabular} - LaTeX export isn't rasterized (unlike
 *  the HTML <tfoot>, which has to sit inside the captured <table>), so plain trailing prose is fine. */
export function matrixToLatex(t: BuiltTable): string {
  const m = t.matrix!
  const n = m.colLabels.length
  const header = ' & ' + m.colLabels.map(cell).join(' & ') + ' \\\\'
  const body = m.rowLabels.map((rowLabel, i) => {
    const cells = m.colLabels.map((_, j) => {
      if ((m.lowerOnly && j > i) || m.cells[i][j] == null) return ''
      const star = m.cellStars?.[i]?.[j] ?? ''
      const c = cell(m.cells[i][j] ?? '') + escapeLatex(star)
      const isDiag = j === i
      if (isDiag && (m.diagonal === 'bold' || m.diagonalStyle === 'bold')) return `\\textbf{${c}}`
      if (isDiag && m.diagonalStyle === 'italic') return `\\textit{${c}}`
      return c
    })
    return `${cell(rowLabel)} & ${cells.join(' & ')} \\\\`
  })
  const lines = [`\\begin{tabular}{l${'c'.repeat(n)}}`, '\\toprule', header, '\\midrule', ...body, '\\bottomrule', '\\end{tabular}']
  if (m.starNote) lines.push(`\\textit{${escapeLatex(m.starNote)}}`)
  return lines.join('\n')
}

/** Two-row booktabs header for spanned columns (A6 device 2): row 1 = each spanned group's label via
 *  \multicolumn (or a plain column's own label, printed ONCE - row 2 leaves it blank, so no \multirow
 *  is needed); a \cmidrule(lr){..} under each spanned group; row 2 = the spanned group's sub-column
 *  labels only. Column positions for \cmidrule are 1-based and counted across ALL columns. */
function spannedHeaderLines(groups: HeaderGroup[]): string[] {
  let pos = 1
  const row1: string[] = []; const row2: string[] = []; const cmidrules: string[] = []
  for (const g of groups) {
    if (g.group != null) {
      row1.push(`\\multicolumn{${g.cols.length}}{c}{${escapeLatex(g.group)}}`)
      row2.push(...g.cols.map(flatLabel))
      cmidrules.push(`\\cmidrule(lr){${pos}-${pos + g.cols.length - 1}}`)
    } else {
      row1.push(flatLabel(g.cols[0]))
      row2.push('')
    }
    pos += g.cols.length
  }
  return [row1.join(' & ') + ' \\\\', cmidrules.join(' '), row2.join(' & ') + ' \\\\']
}

/** A classic BuiltTable → booktabs tabular from columns + rows. A6 devices (2026-07-06):
 *  spanned column headers (spec.columns[].span) → spannedHeaderLines (else the original single-line
 *  header, byte-identical); `__group` rows → a full-width ITALIC row (every column wrapped in
 *  \textit - NOT \multirow); `__section` rows → a \multicolumn italic label row; rows following a
 *  `__group` (until the next `__group`/`__section`) get a `\quad`-indented first cell. */
export function classicToLatex(t: BuiltTable): string {
  const cols = t.spec.columns
  const groups = headerGroups(cols)
  const hasSpan = groups.some((g) => g.group != null)
  const header = hasSpan ? spannedHeaderLines(groups) : [cols.map(flatLabel).join(' & ') + ' \\\\']
  let inGroup = false
  const body = t.rows.map((r) => {
    if ('__section' in r) { inGroup = false; return `\\multicolumn{${cols.length}}{l}{\\textit{${cell(r['__section'])}}} \\\\` }
    if ('__group' in r) { inGroup = true; return cols.map((c) => `\\textit{${cell(r[c.key])}}`).join(' & ') + ' \\\\' }
    const line = cols.map((c, i) => (inGroup && i === 0 ? `\\quad ${cell(r[c.key])}` : cell(r[c.key])))
    return line.join(' & ') + ' \\\\'
  })
  return [`\\begin{tabular}${colSpec(cols.length)}`, '\\toprule', ...header, '\\midrule', ...body, '\\bottomrule', '\\end{tabular}'].join('\n')
}
