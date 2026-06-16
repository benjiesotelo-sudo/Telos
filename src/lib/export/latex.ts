import type { TestSpec } from '../registry/types'
import type { TestSetup, TestRun } from '../../state/session'
import { BUILDERS } from '../results/builders'
import { coefToLatex, classicToLatex, escapeLatex } from './rTable'

// LaTeX report export (design 2026-06-16, export-formats slice): the same report as the in-app results,
// as a native booktabs LaTeX source. Per selected test, in order: \section{name} → each table (coef vs
// classic) → \includegraphics for each figure (figures/NN_id/figure_*.png, NN = 1-based padded, matching
// the zip layout in ResultsScreen) → the how-to-read text and the APA paragraph (all prose escaped).
const PREAMBLE = ['\\documentclass{article}', '\\usepackage{booktabs,graphicx,siunitx}', '\\begin{document}']

export function emitLatex(
  selection: string[],
  _setups: Record<string, TestSetup>, // part of the export signature; the LaTeX body is built from spec + result
  specs: Record<string, TestSpec>,
  runs: Record<string, TestRun>,
): string {
  const out: string[] = [...PREAMBLE]
  selection.forEach((id, i) => {
    const spec = specs[id]; const run = runs[id]
    if (!spec || !run) return
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
