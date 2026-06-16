import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ApaTable } from './ApaTable'
import type { TableSpec } from '../lib/registry/types'

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
