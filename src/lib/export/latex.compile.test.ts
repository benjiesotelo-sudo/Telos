import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BuiltTable } from '../results/builders'
import { classicToLatex, matrixToLatex } from './rTable'

const hasTectonic = (() => {
  try { execSync('tectonic --version', { stdio: 'ignore' }); return true } catch { return false }
})()

// Standing compile-smoke gate: emit a document exercising ALL FOUR A6 devices (2026-07-06) in one shot —
// (1) grouped rows (`__group` + indented children), (2) spanned column headers (`span.group`), (3) section
// labels (`__section`), (4) a matrix table with cellStars/diagonalStyle/starNote — with adversarial content
// (%, &, _) sitting in the labels that reach the LaTeX body verbatim. If escapeLatex (rTable.ts) regresses
// on any of these, tectonic fails loudly here instead of a silent report.tex compile break discovered only
// via a doc-harness/e2e run (or, worse, by Benjie downloading a broken PDF).
describe.skipIf(!hasTectonic)('LaTeX export compiles under tectonic (A6 devices + adversarial content)', () => {
  it('compiles a document with grouped rows + spanned headers + section labels + a starred/italic matrix', () => {
    const classic: BuiltTable = {
      spec: {
        id: 'demo', title: 'Demo',
        columns: [
          { key: 'path', label: 'Path' },
          { key: 'lo', label: 'Lower', span: { group: '95% CI (%)' } },
          { key: 'hi', label: 'Upper', span: { group: '95% CI (%)' } },
        ],
      },
      rows: [
        { __section: 'Section A & B_1' },
        { __group: 'Construct_1 (50%)', path: 'Construct_1 (50%)', lo: '', hi: '' },
        { path: 'item_1 & item_2', lo: '.10', hi: '.20' },
      ],
    }
    const matrix: BuiltTable = {
      spec: { id: 'mtx', title: 'Matrix', columns: [] },
      rows: [],
      matrix: {
        kind: 'matrix', id: 'mtx', caption: 'Matrix % test',
        rowLabels: ['A_1', 'B & C'], colLabels: ['A_1', 'B & C'],
        cells: [[0.8, null], [0.3, 0.75]],
        diagonalStyle: 'italic',
        cellStars: [['**', null], ['*', null]],
        starNote: '*p<.05, **p<.01 (10% level)',
      },
    }

    const body = [classicToLatex(classic), '', matrixToLatex(matrix)].join('\n')
    const doc = [
      '\\documentclass{article}',
      '\\usepackage{booktabs,graphicx,siunitx}',
      '\\begin{document}',
      body,
      '\\end{document}',
      '',
    ].join('\n')

    const dir = mkdtempSync(join(tmpdir(), 'telos-tex-compile-'))
    const file = join(dir, 'doc.tex')
    writeFileSync(file, doc)
    expect(() => execSync(`tectonic ${JSON.stringify(file)}`, { cwd: dir, stdio: 'pipe' })).not.toThrow()
  }, 30_000)
})
