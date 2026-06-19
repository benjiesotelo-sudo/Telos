import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ApaTable } from './ApaTable'
import type { TableSpec } from '../lib/registry/types'
import type { MatrixTable } from '../lib/results/types'

const spec: TableSpec = {
  id: 'fe', title: 'Coefficients', kind: 'coef',
  columns: [{ key: 'term', label: '' }, { key: 'm1', label: 'Fixed effects' }, { key: 'm2', label: 'Random effects' }, { key: 'diff', label: 'Difference' }],
  models: [{ key: 'm1', label: 'Fixed effects' }, { key: 'm2', label: 'Random effects' }],
  gof: [{ key: 'n', label: 'Num.Obs.' }, { key: 'r2', label: 'R²' }],
  extraCols: [{ key: 'diff', label: 'Difference' }],
}
const rows: Record<string, string | number>[] = [
  { _kind: 'coef', term: 'rd_spend', m1: '0.142', m2: '0.128', diff: '0.014' },
  { _kind: 'se', term: '', m1: '(0.031)', m2: '(0.027)', diff: '' },
  { _kind: 'ci', term: '', m1: '[0.08, 0.20]', m2: '[0.07, 0.18]', diff: '' },
  { _kind: 'rule' },
  { _kind: 'gof', term: 'Num.Obs.', m1: '96', m2: '96', diff: '' },
  { _kind: 'gof', term: 'R²', m1: '.71', m2: '.66', diff: '' },
  { _kind: 'span', term: 'Hausman χ²(2) = 6.41, p = .041' },
]

describe('ApaTable coef rendering (design 2026-06-16)', () => {
  const html = renderToStaticMarkup(<ApaTable id="t" spec={spec} rows={rows} />)
  it('marks the table coef and renders model + extra column headers', () => {
    expect(html).toContain('class="apa coef"')
    expect(html).toContain('Fixed effects'); expect(html).toContain('Random effects'); expect(html).toContain('Difference')
  })
  it('stacks estimate, muted (SE), muted [CI] with kind classes', () => {
    expect(html).toContain('class="row-se"'); expect(html).toContain('(0.031)')
    expect(html).toContain('class="row-ci"'); expect(html).toContain('[0.08, 0.20]')
  })
  it('renders the rule before the GOF footer and the GOF rows', () => {
    expect(html).toContain('class="gofrule"'); expect(html).toContain('Num.Obs.')
  })
  it('renders a full-width span row for the Hausman diagnostic', () => {
    expect(html).toContain('class="row-span"')
    expect(html).toContain('Hausman χ²(2) = 6.41, p = .041')
    expect(html.toLowerCase()).toContain('colspan="4"')
  })
  it('classic tables (no kind) render unchanged', () => {
    const classic: TableSpec = { id: 'c', title: 'X', columns: [{ key: 'a', label: 'A' }] }
    const h = renderToStaticMarkup(<ApaTable id="c" spec={classic} rows={[{ a: '1' }]} />)
    expect(h).toContain('class="apa"'); expect(h).not.toContain('coef')
    expect(h).toContain('>1<')
  })
})

// ── MatrixTable renderer (kind:'matrix') ──────────────────────────────────────
const m3x3: MatrixTable = {
  kind: 'matrix',
  id: 'fl',
  caption: 'Fornell-Larcker Criterion',
  rowLabels: ['A', 'B', 'C'],
  colLabels: ['A', 'B', 'C'],
  cells: [
    ['.85', null, null],
    ['.42', '.79', null],
    ['.38', '.51', '.91'],
  ],
  diagonal: 'bold',
  lowerOnly: true,
}

describe('ApaTable matrix rendering (kind:matrix)', () => {
  const html = renderToStaticMarkup(<ApaTable matrix={m3x3} />)

  it('wraps in <table id="table-fl">', () => {
    expect(html).toContain('id="table-fl"')
    expect(html).toContain('<table')
  })

  it('renders a single header row with corner th + colLabels', () => {
    // thead: corner th (empty) + 3 colLabel ths; tbody: 3 row-header ths; <thead> tag itself matches /<th/
    // Verify the thead structure precisely
    expect(html).toContain('<thead>')
    // The header row should have the three col labels A, B, C
    expect(html).toContain('>A<'); expect(html).toContain('>B<'); expect(html).toContain('>C<')
    // Only one <thead> block (one header row)
    expect((html.match(/<thead/g) ?? []).length).toBe(1)
  })

  it('renders 3 body rows, each starting with a row-header th', () => {
    // body row header ths: 'A', 'B', 'C' — but those match the colLabel ths above
    // more precise: tbody should contain 3 <tr>
    const trMatches = html.match(/<tr/g) ?? []
    // 1 thead <tr> + 3 tbody <tr> = 4 total
    expect(trMatches.length).toBe(4)
  })

  it('upper-triangle cells (lowerOnly) render blank', () => {
    // row 0, col 1 and col 2 are null (upper-triangle) → blank <td></td>
    // The value '.42' is lower-triangle (row 1, col 0) → present
    expect(html).toContain('.42')
    // null cells: should not contain the values that would be there if filled
    // We know cells[0][1] and cells[0][2] are null → empty tds
    // Count empty tds: row0 has 2 blanks, row1 has 1 blank, row2 has 0 blanks = 3 total
    const emptyTdMatches = html.match(/<td><\/td>/g) ?? []
    expect(emptyTdMatches.length).toBe(3)
  })

  it('diagonal cells wrapped in <strong> when diagonal:bold', () => {
    // diagonal cells: [0][0]='.85', [1][1]='.79', [2][2]='.91'
    expect(html).toContain('<strong>.85</strong>')
    expect(html).toContain('<strong>.79</strong>')
    expect(html).toContain('<strong>.91</strong>')
  })

  it('plain diagonal does not bold', () => {
    const plain: MatrixTable = { ...m3x3, diagonal: 'plain' }
    const h = renderToStaticMarkup(<ApaTable matrix={plain} />)
    expect(h).not.toContain('<strong>')
    expect(h).toContain('.85')
  })

  it('without lowerOnly, upper-triangle cells render their value', () => {
    const full: MatrixTable = {
      kind: 'matrix', id: 'htmt', caption: 'HTMT', diagonal: 'plain',
      rowLabels: ['X', 'Y'], colLabels: ['X', 'Y'],
      cells: [['.80', '.45'], ['.45', '.88']],
    }
    const h = renderToStaticMarkup(<ApaTable matrix={full} />)
    // Both .45 values present (no blanking)
    expect(h.match(/\.45/g)?.length).toBe(2)
  })
})
