import { describe, it, expect } from 'vitest'
import { buildPlsSem } from './buildPlsSem'
import type { PlsSemResult } from '../stats/plsSem'
import type { TestSpec } from '../registry/types'

const SPEC = {
  id: 'pls-sem',
  name: 'PLS-SEM',
  tables: [
    { id: 'outer-model', title: 'Outer model', columns: [] },
    { id: 'reliability', title: 'Reliability & convergent validity', columns: [] },
    { id: 'htmt', title: 'Discriminant validity (HTMT)', columns: [] },
    { id: 'structural', title: 'Structural paths', columns: [] },
    { id: 'structural-quality', title: 'Structural model quality', columns: [] },
    { id: 'indirect-effects', title: 'Indirect effects', columns: [] },
  ],
  figures: [{ type: 'path-diagram', caption: 'Path diagram', file: 'figure_path-diagram' }],
  howToRead: 'HOWTO',
  apaTemplate: 'APA',
  tableNote: null,
} as unknown as TestSpec

const R: PlsSemResult = {
  outer: [
    { construct: 'Image', item: 'IMAG1', weight: null, loading: 0.81, vif: null, t: 12.3, p: 0.0001 },
    { construct: 'Expectation', item: 'CUEX1', weight: 0.44, loading: null, vif: 1.9, t: 3.1, p: 0.002 },
  ],
  reliability: [
    { construct: 'Image', alpha: 0.77, rhoA: 0.78, cr: 0.83, ave: 0.50 },
    { construct: 'Expectation', alpha: 0.55, rhoA: 0.60, cr: 0.78, ave: null },
  ],
  htmt: { labels: ['Image', 'Expectation'], cells: [[null, null], [0.41, null]] },
  structural: [
    { path: 'Image → Expectation', beta: 0.30, t: 4.1, p: 0.001, ciLower: 0.16, ciUpper: 0.44, fSquare: 0.10 },
  ],
  quality: [
    { construct: 'Expectation', r2: 0.092, r2adj: 0.090, q2: 0.05 },
  ],
  indirect: [
    { path: 'Image → Expectation → Satisfaction', est: 0.03, se: 0.02, ciLower: 0.01, ciUpper: 0.07, t: 2.0, p: 0.04 },
  ],
  estimates: { paths: [{ from: 1, to: 2, beta: 0.30 }], loadings: { 'Image  ->  IMAG1': 0.81 }, r2: { 2: 0.092 } },
}

describe('buildPlsSem', () => {
  it('reorders reliability to α / ρ_A / CR / AVE and suppresses AVE for formative constructs', () => {
    const c = buildPlsSem(SPEC, R)
    const rel = c.tables.find((t) => t.spec.id === 'reliability')!
    expect(Object.keys(rel.rows[0])).toEqual(['construct', 'alpha', 'rhoA', 'cr', 'ave'])
    expect(rel.rows[0].construct).toBe('Image')
    expect(rel.rows[0].alpha).toBe('.77')
    expect(rel.rows[0].ave).toBe('.50')
    // formative Expectation: AVE rendered as an em-dash, not a number
    expect(rel.rows[1].ave).toBe('—')
  })

  it('renders outer model with loading OR weight (+ VIF) per indicator', () => {
    const c = buildPlsSem(SPEC, R)
    const outer = c.tables.find((t) => t.spec.id === 'outer-model')!
    expect(outer.rows[0].loading).toBe('.81')
    expect(outer.rows[0].weight).toBe('—')
    expect(outer.rows[1].weight).toBe('.44')
    expect(outer.rows[1].loading).toBe('—')
    expect(outer.rows[1].vif).toBe('1.90')
  })

  it('renders HTMT as a lowerOnly matrix table', () => {
    const c = buildPlsSem(SPEC, R)
    const htmt = c.tables.find((t) => t.matrix?.id === 'htmt')!
    expect(htmt.matrix!.kind).toBe('matrix')
    expect(htmt.matrix!.lowerOnly).toBe(true)
    expect(htmt.matrix!.rowLabels).toEqual(['Image', 'Expectation'])
    expect(htmt.matrix!.cells[1][0]).toBe('.41')
    expect(htmt.matrix!.cells[0][1]).toBeNull()
  })

  it('renders structural paths with f² and the quality table with R²/adj/Q²', () => {
    const c = buildPlsSem(SPEC, R)
    const struct = c.tables.find((t) => t.spec.id === 'structural')!
    expect(struct.rows[0].path).toBe('Image → Expectation')
    expect(struct.rows[0].beta).toBe('.30')
    expect(struct.rows[0].fSquare).toBe('0.10')
    expect(struct.rows[0].ci).toBe('[.16, .44]')
    const qual = c.tables.find((t) => t.spec.id === 'structural-quality')!
    expect(qual.rows[0].r2).toBe('.09')
    expect(qual.rows[0].q2).toBe('0.05')
  })

  it('emits the indirect-effects table only when present', () => {
    const c = buildPlsSem(SPEC, R)
    const ind = c.tables.find((t) => t.spec.id === 'indirect-effects')!
    expect(ind.rows[0].path).toBe('Image → Expectation → Satisfaction')
    expect(ind.rows[0].ci).toBe('[.01, .07]')
    // dropping indirect removes the table
    const c2 = buildPlsSem(SPEC, { ...R, indirect: [] })
    expect(c2.tables.find((t) => t.spec.id === 'indirect-effects')).toBeUndefined()
  })
})
