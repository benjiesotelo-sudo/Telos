import type { TestSpec } from '../registry/types'
import type { TestSetup, TestRun } from '../../state/session'
import { BUILDERS } from '../results/builders'
import { coefToLatex, classicToLatex, escapeLatex } from './rTable'

// LaTeX report export (design 2026-06-16, export-formats slice): the same report as the in-app results,
// as a native booktabs LaTeX source. Per selected test, in order: \section{name} → each table (coef vs
// classic) → \includegraphics for each figure (figures/NN_id/figure_*.png, NN = 1-based padded, matching
// the zip layout in ResultsScreen) → the how-to-read text and the APA paragraph (all prose escaped).
// The body is escaped to pure ASCII-LaTeX (escapeLatex maps every non-ASCII glyph the app emits to a
// command), so no inputenc is needed; [T1]{fontenc} is harmless belt-and-suspenders for hyphenation /
// glyph coverage and keeps pdfLaTeX happy alongside XeTeX/tectonic.
const PREAMBLE = ['\\documentclass{article}', '\\usepackage[T1]{fontenc}', '\\usepackage{booktabs,graphicx,siunitx}', '\\begin{document}']

export function emitLatex(
  selection: string[], // the FULL selection — figure-folder NN is the 1-based index here, matching the
  _setups: Record<string, TestSetup>, // on-screen card numbering and the zip layout in ResultsScreen.
  specs: Record<string, TestSpec>,
  runs: Record<string, TestRun>,
): string {
  const out: string[] = [...PREAMBLE]
  selection.forEach((id, i) => {
    const spec = specs[id]; const run = runs[id]
    // Skip ids with no usable result (no run / errored / stale): emit NO \section and never call
    // BUILDERS[id](spec, result) with an undefined/stale result. NN (= i+1) keeps the full-selection
    // index so the \includegraphics path matches the figure PNG keys buildExportFiles writes.
    if (!spec || !run || !run.result || run.stale) return
    const content = BUILDERS[id](spec, run.result)
    const folder = `figures/${String(i + 1).padStart(2, '0')}_${id}`
    out.push(`\\section{${escapeLatex(spec.name)}}`)
    for (const t of content.tables) out.push(t.spec.kind === 'coef' ? coefToLatex(t) : classicToLatex(t))
    for (const fig of content.figures) out.push(`\\includegraphics{${folder}/figure_${fig.file ?? fig.type}.png}`)
    out.push(escapeLatex(content.howToRead))
    out.push(escapeLatex(content.apa))
  })
  out.push('\\end{document}')
  return out.join('\n\n')
}
