import { describe, it, expect } from 'vitest'
import type { BuiltTable } from '../results/builders'
import { coefToLatex, classicToLatex, matrixToLatex, escapeLatex } from './rTable'

// Faithful to the real coef row shape (see ApaTable.tsx + buildSimpleLinearRegression / buildHausmanTest):
// spec.columns = [{key:'term',label:''}, ...value cols]; each row carries a `_kind` and cells at r[col.key].
const simpleCoef: BuiltTable = {
  spec: {
    id: 'coefficients', title: 'Regression coefficients', kind: 'coef',
    columns: [{ key: 'term', label: '' }, { key: 'est', label: '(1)' }, { key: 'beta', label: 'β' }],
    models: [{ key: 'est', label: '(1)' }], extraCols: [{ key: 'beta', label: 'β' }],
    gof: [{ key: 'n', label: 'Num.Obs.' }, { key: 'r2', label: 'R²' }],
  },
  rows: [
    { _kind: 'coef', term: '(Intercept)', est: '0.50', beta: '' },
    { _kind: 'se', term: '', est: '(0.10)', beta: '' },
    { _kind: 'ci', term: '', est: '[0.30, 0.70]', beta: '' },
    { _kind: 'coef', term: 'x', est: '1.20', beta: '0.45' },
    { _kind: 'se', term: '', est: '(0.20)', beta: '' },
    { _kind: 'ci', term: '', est: '[0.80, 1.60]', beta: '' },
    { _kind: 'rule' },
    { _kind: 'gof', term: 'Num.Obs.', est: '100' },
    { _kind: 'gof', term: 'R²', est: '0.42' },
  ],
}

// Side-by-side FE | RE coef table with a full-width Hausman χ² span row (buildHausmanTest shape).
const hausmanCoef: BuiltTable = {
  spec: {
    id: 'hausman', title: 'Hausman test', kind: 'coef',
    columns: [{ key: 'term', label: '' }, { key: 'fe', label: 'Fixed effects' }, { key: 're', label: 'Random effects' }, { key: 'diff', label: 'Difference' }],
    models: [{ key: 'fe', label: 'Fixed effects' }, { key: 're', label: 'Random effects' }], extraCols: [{ key: 'diff', label: 'Difference' }],
    gof: [{ key: 'n', label: 'Num.Obs.' }],
  },
  rows: [
    { _kind: 'coef', term: 'rd', fe: '0.30', re: '0.28', diff: '0.02' },
    { _kind: 'se', term: '', fe: '(0.05)', re: '(0.04)', diff: '' },
    { _kind: 'ci', term: '', fe: '[0.20, 0.40]', re: '[0.20, 0.36]', diff: '' },
    { _kind: 'rule' },
    { _kind: 'gof', term: 'Num.Obs.', fe: '240', re: '', diff: '' },
    { _kind: 'span', term: 'Hausman χ²(1) = 4.50, p = .034' },
  ],
}

const classic: BuiltTable = {
  spec: {
    id: 'anova', title: 'ANOVA',
    columns: [{ key: 'source', label: 'Source' }, { key: 'ss', label: 'SS' }, { key: 'p', label: 'p' }],
  },
  rows: [
    { source: 'Between', ss: '12.3', p: '.004' },
    { source: 'Within', ss: '45.6', p: '' },
  ],
}

describe('escapeLatex', () => {
  it('escapes the special characters', () => {
    expect(escapeLatex('a_b%c&d#e$f{g}h')).toBe('a\\_b\\%c\\&d\\#e\\$f\\{g\\}h')
  })
  it('escapes tilde, caret and backslash with the math-safe forms', () => {
    expect(escapeLatex('~^\\')).toBe('\\textasciitilde{}\\textasciicircum{}\\textbackslash{}')
  })

  // The app routes negatives through apa.ts minus() (U+2212) and builders emit Greek + math symbols.
  // These must become ASCII-LaTeX so report.tex compiles AND renders on pdfLaTeX + XeTeX/tectonic.
  it('maps the Unicode glyphs the app emits to ASCII-LaTeX, leaving NO raw non-ASCII bytes', () => {
    const out = escapeLatex('−12 χ²(1) β η² a×b ≤ 5 < 6')
    expect(out).toContain('$-$') // − minus
    expect(out).toContain('$\\chi$') // χ
    expect(out).toContain('\\textsuperscript{2}') // ²
    expect(out).toContain('$\\beta$') // β
    expect(out).toContain('$\\eta$') // η
    expect(out).toContain('$\\times$') // ×
    expect(out).toContain('$\\le$') // ≤
    expect(out).toContain('$<$') // <  (avoids the pdfLaTeX ligature)
    // No raw non-ASCII byte survives.
    expect(/[^\x00-\x7F]/.test(out)).toBe(false)
  })

  it('covers the full emitted glyph set (dashes, relations, Greek, Λ, ·, §, é) with no non-ASCII left', () => {
    const glyphs = '− – — × ÷ ± √ ≤ ≥ ≠ ≈ ≡ → ⇒ … ² ³ § · é α β γ δ ε η θ λ μ ρ σ τ χ ω Δ Λ Σ'
    const out = escapeLatex(glyphs)
    expect(/[^\x00-\x7F]/.test(out)).toBe(false)
    expect(out).toContain('$\\Lambda$') // Wilks' Λ
    expect(out).toContain('$\\rightarrow$') // →
    expect(out).toContain('---') // em dash
    expect(out).toContain("\\'{e}") // Scheffé
  })

  it('does not re-escape backslashes inserted by the escape itself', () => {
    // χ → $\chi$ ; the inserted backslash must NOT become \textbackslash{}.
    expect(escapeLatex('χ')).toBe('$\\chi$')
    expect(escapeLatex('χ')).not.toContain('\\textbackslash')
  })
})

describe('coefToLatex', () => {
  it('emits a booktabs tabular with the three rules', () => {
    const tex = coefToLatex(simpleCoef)
    expect(tex).toContain('\\begin{tabular}')
    expect(tex).toContain('\\toprule')
    expect(tex).toContain('\\midrule')
    expect(tex).toContain('\\bottomrule')
    expect(tex).toContain('\\end{tabular}')
  })
  it('puts the model column labels in the header', () => {
    const tex = coefToLatex(simpleCoef)
    // header row carries the value-column labels (term label is blank); β is escaped to ASCII-LaTeX
    expect(tex).toMatch(/&\s*\(1\)\s*&\s*\$\\beta\$\s*\\\\/)
  })
  it('stacks the estimate, then (SE), then [CI] as successive rows under the term', () => {
    const tex = coefToLatex(simpleCoef)
    const i0 = tex.indexOf('(Intercept)')
    const i1 = tex.indexOf('(0.10)')
    const i2 = tex.indexOf('[0.30, 0.70]')
    const i3 = tex.indexOf('x &')
    expect(i0).toBeGreaterThan(-1)
    expect(i1).toBeGreaterThan(i0)
    expect(i2).toBeGreaterThan(i1)
    expect(i3).toBeGreaterThan(i2)
  })
  it('puts the GOF rows after the midrule', () => {
    const tex = coefToLatex(simpleCoef)
    expect(tex.indexOf('Num.Obs.')).toBeGreaterThan(tex.indexOf('\\midrule'))
  })
  it('renders a full-width span row via \\multicolumn across all columns', () => {
    const tex = coefToLatex(hausmanCoef)
    expect(tex).toContain('\\multicolumn{4}{l}{Hausman')
  })
})

describe('classicToLatex', () => {
  it('emits a booktabs tabular from columns + rows', () => {
    const tex = classicToLatex(classic)
    expect(tex).toContain('\\toprule')
    expect(tex).toContain('\\bottomrule')
    expect(tex).toMatch(/Source\s*&\s*SS\s*&\s*p\s*\\\\/)
    expect(tex).toMatch(/Between\s*&\s*12.3\s*&\s*.004\s*\\\\/)
  })
})

// Matrix tables (kind:'matrix', SEM: Fornell-Larcker / HTMT / interfactor-correlations) carry their data
// in BuiltTable.matrix with empty spec.columns + rows. Faithful to buildAve.ts flMatrix.
const flMatrix: BuiltTable = {
  spec: { id: 'fornell-larcker', title: 'Discriminant validity (Fornell-Larcker)', columns: [] },
  rows: [],
  matrix: {
    kind: 'matrix', id: 'fornell-larcker', caption: 'Discriminant validity (Fornell-Larcker)',
    rowLabels: ['visual', 'textual', 'R&D'], colLabels: ['visual', 'textual', 'R&D'],
    cells: [
      ['.74', null, null],
      ['.45', '.77', null],
      ['.30', '.52', '.71'],
    ],
    diagonal: 'bold', lowerOnly: true,
  },
}

describe('matrixToLatex', () => {
  it('emits a booktabs tabular with a NON-empty preamble sized to 1 label + N data columns', () => {
    const tex = matrixToLatex(flMatrix)
    expect(tex).toContain('\\begin{tabular}{lccc}') // l (row labels) + c per construct
    expect(tex).not.toContain('\\begin{tabular}{}') // the bug: empty preamble would not compile
    expect(tex).toContain('\\toprule')
    expect(tex).toContain('\\bottomrule')
    expect(tex).toContain('\\end{tabular}')
  })
  it('puts the column labels in the header after a blank corner cell', () => {
    const tex = matrixToLatex(flMatrix)
    expect(tex).toMatch(/&\s*visual\s*&\s*textual\s*&\s*R\\&D\s*\\\\/)
  })
  it('bolds the diagonal (diagonal=bold) and blanks the upper triangle (lowerOnly)', () => {
    const tex = matrixToLatex(flMatrix)
    expect(tex).toContain('\\textbf{.74}') // √AVE on the diagonal
    // visual row: bold diagonal then two empty (upper-triangle) cells
    expect(tex).toMatch(/visual\s*&\s*\\textbf\{.74\}\s*&\s*&\s*\\\\/)
  })
  it('escapes label + cell text', () => {
    const tex = matrixToLatex(flMatrix)
    expect(tex).toContain('R\\&D')
    expect(tex).not.toContain('R&D ')
  })
})

describe('escaping is applied to cell + label text', () => {
  it('escapes a column literally named with _ or &', () => {
    const t: BuiltTable = {
      spec: { id: 't', title: 't', columns: [{ key: 'a', label: 'pre_post' }, { key: 'b', label: 'R&D' }] },
      rows: [{ a: 'x_1', b: 'A&B' }],
    }
    const tex = classicToLatex(t)
    expect(tex).toContain('pre\\_post')
    expect(tex).toContain('R\\&D')
    expect(tex).toContain('x\\_1')
    expect(tex).toContain('A\\&B')
    expect(tex).not.toContain('pre_post')
  })
})
