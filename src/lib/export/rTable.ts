import type { BuiltTable } from '../results/builders'
import type { ColumnDef } from '../registry/types'

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

/** A classic BuiltTable → booktabs tabular from columns + rows. */
export function classicToLatex(t: BuiltTable): string {
  const cols = t.spec.columns
  const header = cols.map(flatLabel).join(' & ') + ' \\\\'
  const body = t.rows.map((r) => cols.map((c) => cell(r[c.key])).join(' & ') + ' \\\\')
  return [`\\begin{tabular}${colSpec(cols.length)}`, '\\toprule', header, '\\midrule', ...body, '\\bottomrule', '\\end{tabular}'].join('\n')
}
