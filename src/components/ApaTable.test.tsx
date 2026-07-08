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
  it('a table with no __group/_kind rows renders BYTE-IDENTICAL html (A6 regression pin)', () => {
    const plain: TableSpec = { id: 'c', title: 'X', columns: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }] }
    const h = renderToStaticMarkup(<ApaTable id="c" spec={plain} rows={[{ a: '1', b: '2' }]} />)
    expect(h).toBe('<div style="overflow-x:auto"><table id="c" class="apa"><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table></div>')
  })
})

// ── grouped rows (A6 device 1, 2026-07-06): a `__group` row (all columns filled, group-level stats
// live on it) renders italic; rows that follow indent their first cell until the next `__group`. ──
describe('ApaTable classic - grouped rows (__group)', () => {
  // Faithful to Table 1's post-merge shape (A1): construct rows carry CR/AVE/ω/α once; item rows
  // carry Mean/SD/B/SE/z/p/Std. loading (buildCbSem.ts wires this up in a later unit).
  const spec: TableSpec = {
    id: 'cfa-loadings', title: 'Measurement model', columns: [
      { key: 'path', label: 'Construct → Item' }, { key: 'mean', label: 'M' }, { key: 'sd', label: 'SD' },
      { key: 'b', label: 'B' }, { key: 'se', label: 'SE' }, { key: 'z', label: 'z' }, { key: 'p', label: 'p' },
      { key: 'std', label: 'Std. loading' }, { key: 'cr', label: 'CR' }, { key: 'ave', label: 'AVE' },
      { key: 'omega', label: 'ω' }, { key: 'alpha', label: 'α' },
    ],
  }
  const rows: Record<string, string | number>[] = [
    { __group: 'Visual', path: 'Visual', mean: '', sd: '', b: '', se: '', z: '', p: '', std: '', cr: '.83', ave: '.62', omega: '.85', alpha: '.81' },
    { path: 'Visual → x1', mean: '4.94', sd: '1.17', b: '1.00', se: '', z: '', p: '', std: '.77' },
    { path: 'Visual → x2', mean: '6.09', sd: '1.17', b: '0.55', se: '0.06', z: '9.31', p: '<.001', std: '.42' },
    { __group: 'Textual', path: 'Textual', mean: '', sd: '', b: '', se: '', z: '', p: '', std: '', cr: '.87', ave: '.70', omega: '.87', alpha: '.85' },
    { path: 'Textual → x4', mean: '3.06', sd: '1.16', b: '1.00', se: '', z: '', p: '', std: '.85' },
  ]
  const html = renderToStaticMarkup(<ApaTable id="cfa-loadings" spec={spec} rows={rows} />)

  it('renders a __group row as class="row-group" carrying its own column values (construct name + CR/AVE/ω/α)', () => {
    expect(html).toContain('class="row-group"')
    expect((html.match(/class="row-group"/g) ?? []).length).toBe(2) // Visual + Textual
    expect(html).toMatch(/class="row-group"><td>Visual<\/td>.*?<td>\.83<\/td><td>\.62<\/td><td>\.85<\/td><td>\.81<\/td>/)
  })

  it('indents rows following a __group as class="row-child", resetting at the next __group', () => {
    // 2 item rows under Visual, 1 under Textual - 3 row-child rows total.
    expect((html.match(/class="row-child"/g) ?? []).length).toBe(3)
    expect(html).toContain('<tr class="row-child"><td>Visual → x1</td>')
  })

  it('a __group row never carries the row-child class (it is the header, not a child)', () => {
    const groupRowMatch = html.match(/<tr class="row-group"[^>]*>/g) ?? []
    expect(groupRowMatch.length).toBe(2)
    for (const m of groupRowMatch) expect(m).not.toContain('row-child')
  })
})

// ── spanning column headers (A6 device 2, 2026-07-06): a two-level <thead> when any column ──
// carries `span`; plain columns keep their single label via rowSpan; adjacent same-group columns
// merge under one colSpan header.
describe('ApaTable classic - spanning column headers (span.group)', () => {
  // Table 5's post-merge shape (A3): two CI groups (Percentile / BC), everything else plain.
  const spec: TableSpec = {
    id: 'structural-paths', title: 'Structural paths', columns: [
      { key: 'h', label: 'H' }, { key: 'path', label: 'Path' }, { key: 'b', label: 'B' },
      { key: 'percLo', label: 'Lower', span: { group: 'Percentile 95% CI' } },
      { key: 'percHi', label: 'Upper', span: { group: 'Percentile 95% CI' } },
      { key: 'bcLo', label: 'Lower', span: { group: 'BC 95% CI' } },
      { key: 'bcHi', label: 'Upper', span: { group: 'BC 95% CI' } },
      { key: 'result', label: 'Result' },
    ],
  }
  const rows: Record<string, string | number>[] = [
    { h: 'H1', path: 'Visual → Ability', b: '0.42', percLo: '0.30', percHi: '0.55', bcLo: '0.29', bcHi: '0.54', result: 'Supported' },
  ]
  const html = renderToStaticMarkup(<ApaTable id="structural-paths" spec={spec} rows={rows} />)

  it('renders TWO header rows (span present) and marks the table class="apa spanned"', () => {
    expect(html).toContain('class="apa spanned"')
    const theadTrs = html.match(/<thead>.*?<\/thead>/s)![0].match(/<tr>/g) ?? []
    expect(theadTrs.length).toBe(2)
  })

  it('row 1 has a colSpan=2 cell per group, labeled with the group name', () => {
    // renderToStaticMarkup emits the JSX prop casing (colSpan/rowSpan), not the lowercase HTML wire
    // name - same convention the existing coef-row test uses (html.toLowerCase() before matching).
    expect(html.toLowerCase()).toContain('colspan="2"')
    expect(html).toMatch(/<th colSpan="2"[^>]*>Percentile 95% CI<\/th>/)
    expect(html).toMatch(/<th colSpan="2"[^>]*>BC 95% CI<\/th>/)
  })

  it('row 1 gives ungrouped columns rowSpan=2 so their label prints once', () => {
    expect((html.match(/rowSpan="2"/g) ?? []).length).toBe(4) // H, Path, B, Result
  })

  it('row 2 carries ONLY the spanned sub-column labels (Lower/Upper × 2), nothing for plain columns', () => {
    const rows2 = html.match(/<thead>.*?<\/thead>/s)![0].match(/<tr>(.*?)<\/tr>/gs) ?? []
    const row2 = rows2[1]
    expect((row2.match(/<th>Lower<\/th>/g) ?? []).length).toBe(2)
    expect((row2.match(/<th>Upper<\/th>/g) ?? []).length).toBe(2)
    expect(row2.match(/<th/g)?.length).toBe(4) // exactly the 4 spanned sub-columns, no cells for H/Path/B/Result
  })

  it('a table with no span columns keeps the single-row header (byte-identical, class="apa")', () => {
    const plain: TableSpec = { id: 'x', title: 'X', columns: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }] }
    const h = renderToStaticMarkup(<ApaTable id="x" spec={plain} rows={[{ a: '1', b: '2' }]} />)
    expect(h).toBe('<div style="overflow-x:auto"><table id="x" class="apa"><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table></div>')
  })
})

// ── internal section labels (A6 device 3, 2026-07-06): a `__section` row is a full-width italic
// label inside the body (Table 5's "Direct paths" / "Indirect effects" / "Moderation" blocks). ──
describe('ApaTable classic - internal section labels (__section)', () => {
  const spec: TableSpec = {
    id: 'structural-paths', title: 'Structural paths', columns: [
      { key: 'h', label: 'H' }, { key: 'path', label: 'Path' }, { key: 'b', label: 'B' }, { key: 'result', label: 'Result' },
    ],
  }
  const rows: Record<string, string | number>[] = [
    { __section: 'Direct paths' },
    { h: 'H1', path: 'Visual → Ability', b: '0.42', result: 'Supported' },
    { __section: 'Indirect effects' },
    { h: 'H2', path: 'Visual → Ability → Achievement', b: '0.11', result: 'Supported' },
  ]
  const html = renderToStaticMarkup(<ApaTable id="structural-paths" spec={spec} rows={rows} />)

  it('renders a __section row as a full-width class="row-section" cell, text in the first column', () => {
    expect((html.match(/class="row-section"/g) ?? []).length).toBe(2)
    expect(html.toLowerCase()).toMatch(/<tr class="row-section"><td colspan="4">direct paths<\/td><\/tr>/)
    expect(html.toLowerCase()).toContain('<td colspan="4">indirect effects</td>')
  })

  it('a __section row is NOT treated as a __group (no group-child indenting carries across it)', () => {
    // The row right after "Indirect effects" must NOT be row-child (no __group is open at that point).
    const afterSection = html.split('Indirect effects</td></tr>')[1]
    expect(afterSection.startsWith('<tr><td>H2</td>')).toBe(true)
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

  it('honors an explicit domId (spec override) for the table DOM id - export capture parity', () => {
    // Matrix tables under a SEM spec with a domId override (Task 33 collision-avoidance) must
    // render the same DOM id the exporter captures (`table-${spec.domId}`), else captureNode → null.
    const h = renderToStaticMarkup(<ApaTable matrix={m3x3} domId="pls-sem-fl" />)
    expect(h).toContain('id="table-pls-sem-fl"')
    expect(h).not.toContain('id="table-fl"')
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

// ── matrix upgrades (A6 device 4, 2026-07-06): italic diagonal, per-cell significance stars, a ──
// star-legend footer row. Faithful to Table 3's post-merge shape (A1): √AVE italic on the diagonal,
// stars on the off-diagonal latent correlations.
describe('ApaTable matrix - devices (diagonalStyle, cellStars, starNote)', () => {
  const fl: MatrixTable = {
    kind: 'matrix', id: 'fornell-larcker', caption: 'Fornell-Larcker Criterion',
    rowLabels: ['Visual', 'Textual', 'Speed'], colLabels: ['Visual', 'Textual', 'Speed'],
    cells: [
      ['.83', null, null],
      ['.42', '.79', null],
      ['.38', '.51', '.91'],
    ],
    diagonalStyle: 'italic',
    lowerOnly: true,
    cellStars: [
      [null, null, null],
      ['***', null, null],
      ['**', '***', null],
    ],
    starNote: '*p<.05, **p<.01, ***p<.001',
  }
  const html = renderToStaticMarkup(<ApaTable matrix={fl} />)

  it('diagonalStyle:italic wraps the diagonal cells in <em>, not <strong>', () => {
    expect(html).toContain('<em>.83</em>')
    expect(html).toContain('<em>.79</em>')
    expect(html).toContain('<em>.91</em>')
    expect(html).not.toContain('<strong>')
  })

  it('diagonalStyle:bold behaves like the legacy diagonal:bold', () => {
    const h = renderToStaticMarkup(<ApaTable matrix={{ ...fl, diagonalStyle: 'bold' }} />)
    expect(h).toContain('<strong>.83</strong>')
    expect(h).not.toContain('<em>')
  })

  it('cellStars append the significance suffix directly after the cell value', () => {
    expect(html).toContain('.42***')
    expect(html).toContain('.38**')
    expect(html).toContain('.51***')
  })

  it('a null cellStars entry appends nothing (no stray "null" text)', () => {
    expect(html).not.toContain('null')
  })

  it('starNote renders as a table footer row so it is captured WITH the table (captureNode parity)', () => {
    expect(html).toContain('<tfoot>')
    expect(html).toContain('*p&lt;.05, **p&lt;.01, ***p&lt;.001')
    // still inside the same <table id="table-fornell-larcker">, not a sibling element
    const tableBlock = html.match(/<table[^>]*id="table-fornell-larcker"[^>]*>.*<\/table>/s)![0]
    expect(tableBlock).toContain('*p&lt;.05')
  })

  it('a matrix with none of the new fields renders exactly as before (byte-identical legacy path)', () => {
    const legacy: MatrixTable = {
      kind: 'matrix', id: 'm', caption: 'M', rowLabels: ['A'], colLabels: ['A'], cells: [['.9']], diagonal: 'bold',
    }
    const h = renderToStaticMarkup(<ApaTable matrix={legacy} />)
    expect(h).toBe('<div style="overflow-x:auto"><table id="table-m" class="apa matrix"><thead><tr><th></th><th>A</th></tr></thead><tbody><tr><th>A</th><td><strong>.9</strong></td></tr></tbody></table></div>')
  })
})
