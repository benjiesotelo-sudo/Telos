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
export function escapeLatex(s: string): string {
  return s.replace(/[\\~^_%&#${}]/g, (c) => LATEX_ESC[c])
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
