import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { ApaTable } from '../../components/ApaTable'
import type { TableSpec } from '../registry/types'
import type { MatrixTable } from '../results/types'
import type { BuiltTable } from '../results/builders'
import { classicToLatex, matrixToLatex } from './rTable'

// PNG/PDF-capture parity (A6, 2026-07-06): the table PNGs (ResultsScreen.buildExportFiles) and the
// print-to-PDF path both rasterize/print the SAME on-screen DOM - there is no separate "export"
// template. captureNode(id) is literally `toPng(document.getElementById(id))` (src/lib/export/
// capture.ts); ResultPreviewCard mounts ApaTable with EXACTLY that id. So as long as (1) that id is
// unique and (2) every A6 device renders INSIDE the <table> element carrying it, the devices are
// captured for free - there is nothing device-specific left to wire for PNG/PDF. This suite locks
// that invariant (source-level wiring + DOM containment) and additionally proves the LaTeX twin is
// built from the SAME BuiltTable, so app/PNG/PDF/LaTeX can never silently diverge on a device.

describe('source wiring: one render path (no PNG-only table template)', () => {
  const resultPreviewCard = readFileSync(new URL('../../components/ResultPreviewCard.tsx', import.meta.url), 'utf8')
  const capture = readFileSync(new URL('./capture.ts', import.meta.url), 'utf8')

  it('ResultPreviewCard builds the classic-table id with the SAME convention captureNode looks up', () => {
    expect(resultPreviewCard).toContain('<ApaTable id={`table-${t.spec.domId ?? t.spec.id}`} spec={t.spec} rows={t.rows} />')
  })
  it('ResultPreviewCard passes domId straight through for matrix tables (ApaTable does its own table- prefixing)', () => {
    expect(resultPreviewCard).toContain('<ApaTable matrix={t.matrix} domId={t.spec.domId} />')
  })
  it('captureNode has exactly one lookup mechanism: getElementById + toPng, no alternate template', () => {
    expect(capture).toContain('document.getElementById(id)')
    expect(capture).toContain('toPng(')
  })
})

describe('DOM containment: every A6 device renders INSIDE the captured <table> element', () => {
  // Table 5's post-merge shape, carrying BOTH a spanned header and a section label - the two devices
  // most likely to accidentally render outside <table> (a two-row <thead> and a full-width body row).
  const spec: TableSpec = {
    id: 'structural-paths', title: 'Structural paths', columns: [
      { key: 'h', label: 'H' }, { key: 'path', label: 'Path' },
      { key: 'percLo', label: 'Lower', span: { group: 'Percentile 95% CI' } },
      { key: 'percHi', label: 'Upper', span: { group: 'Percentile 95% CI' } },
      { key: 'result', label: 'Result' },
    ],
  }
  const rows: Record<string, string | number>[] = [
    { __section: 'Direct paths' },
    { h: 'H1', path: 'Visual → Ability', percLo: '.30', percHi: '.55', result: 'Supported' },
  ]
  // The exact id convention ResultPreviewCard uses (asserted above), so this mirrors the real mount.
  const id = `table-${spec.id}`
  const html = renderToStaticMarkup(<ApaTable id={id} spec={spec} rows={rows} />)

  it('the captured id is unique in the output (getElementById resolves unambiguously)', () => {
    expect((html.match(new RegExp(`id="${id}"`, 'g')) ?? []).length).toBe(1)
  })

  it('the spanning header AND the section label both sit between <table ...> and </table>', () => {
    const tableBlock = html.match(/<table[^>]*>.*<\/table>/s)![0]
    expect(tableBlock).toContain('Percentile 95% CI')
    expect(tableBlock).toContain('Direct paths')
    // nothing about them leaks OUTSIDE the table into the wrapping <div>
    const outsideTable = html.replace(tableBlock, '')
    expect(outsideTable).not.toContain('Percentile 95% CI')
    expect(outsideTable).not.toContain('Direct paths')
  })

  it('a matrix starNote sits inside a <tfoot> WITHIN the same captured <table>, not a sibling element', () => {
    const matrix: MatrixTable = {
      kind: 'matrix', id: 'fornell-larcker', caption: 'Fornell-Larcker',
      rowLabels: ['Visual'], colLabels: ['Visual'], cells: [['.83']],
      diagonalStyle: 'italic', cellStars: [['*']], starNote: '*p<.05',
    }
    const h = renderToStaticMarkup(<ApaTable matrix={matrix} />)
    const tableBlock = h.match(/<table[^>]*>.*<\/table>/s)![0]
    expect(tableBlock).toContain('<tfoot>')
    expect(tableBlock).toContain('*p&lt;.05')
    expect(h.replace(tableBlock, '')).not.toContain('*p&lt;.05')
  })
})

describe('cross-renderer parity: the SAME BuiltTable feeds ApaTable (HTML/PNG/PDF) and the LaTeX twin', () => {
  const groupedSpanned: BuiltTable = {
    spec: {
      id: 'cfa-loadings', title: 'Measurement model', columns: [
        { key: 'path', label: 'Construct → Item' }, { key: 'cr', label: 'CR' },
      ],
    },
    rows: [
      { __group: 'Visual', path: 'Visual', cr: '.83' },
      { path: 'Visual → x1', cr: '' },
    ],
  }

  it('the group label + stat both appear in the HTML render and the LaTeX twin, from the same object', () => {
    const html = renderToStaticMarkup(<ApaTable id="table-cfa-loadings" spec={groupedSpanned.spec} rows={groupedSpanned.rows} />)
    const tex = classicToLatex(groupedSpanned)
    for (const needle of ['Visual', '.83']) {
      expect(html).toContain(needle)
      expect(tex).toContain(needle)
    }
  })

  const starred: BuiltTable = {
    spec: { id: 'fornell-larcker', title: 'Fornell-Larcker', columns: [] },
    rows: [],
    matrix: {
      kind: 'matrix', id: 'fornell-larcker', caption: 'Fornell-Larcker',
      rowLabels: ['Visual', 'Textual'], colLabels: ['Visual', 'Textual'],
      cells: [['.83', null], ['.42', '.79']], diagonalStyle: 'italic', lowerOnly: true,
      cellStars: [[null, null], ['***', null]], starNote: '*p<.05, **p<.01, ***p<.001',
    },
  }

  it('matrix stars + starNote appear in BOTH the HTML render and the LaTeX twin, from the same object', () => {
    const html = renderToStaticMarkup(<ApaTable matrix={starred.matrix!} />)
    const tex = matrixToLatex(starred)
    expect(html).toContain('.42***'); expect(tex).toContain('.42***')
    expect(html.toLowerCase()).toContain('*p&lt;.05'); expect(tex).toContain('*p$<$.05')
  })
})
