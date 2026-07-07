import { describe, it, expect } from 'vitest'
import { buildPlsSem } from './buildPlsSem'
import type { PlsSemResult } from '../stats/plsSem'
import type { TestSpec } from '../registry/types'
import { PLS_SEM } from '../registry/plsSem'

const SPEC = {
  id: 'pls-sem',
  name: 'PLS-SEM',
  tables: [
    { id: 'measurement', title: 'Measurement model', columns: [] },
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
    { construct: 'Image', item: 'IMAG1', weight: null, loading: 0.81, vif: null, t: 12.3, p: 0.0001, mean: 7.64, sd: 1.7 },
    { construct: 'Expectation', item: 'CUEX1', weight: 0.44, loading: null, vif: 1.9, t: 3.1, p: 0.002, mean: 6.8, sd: 1.2 },
  ],
  reliability: [
    { construct: 'Image', alpha: 0.77, rhoA: 0.78, cr: 0.83, ave: 0.50 },
    { construct: 'Expectation', alpha: 0.55, rhoA: 0.60, cr: 0.78, ave: null },
  ],
  htmt: { labels: ['Image', 'Expectation'], cells: [[null, null], [0.41, null]] },
  structural: [
    { path: 'Image → Expectation', beta: 0.30, t: 4.1, p: 0.001, ciLower: 0.16, ciUpper: 0.44, ciBcLower: 0.15, ciBcUpper: 0.43, fSquare: 0.10 },
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
  it('measurement table groups indicator rows under their construct, carrying α/ρA/ρC/AVE once on the group row', () => {
    const c = buildPlsSem(SPEC, R)
    const table = c.tables.find((t) => t.spec.id === 'measurement')!
    const groupRow = table.rows.find((r) => (r as Record<string, unknown>).__group === 'Image')!
    expect(groupRow.alpha).toBe('.77')
    expect(groupRow.rhoA).toBe('.78')
    expect(groupRow.rhoC).not.toBe('')
    expect(groupRow.ave).toBe('.50')
    const childRow = table.rows[table.rows.indexOf(groupRow) + 1]
    expect(childRow.alpha).toBe('')
    expect(childRow.rhoA).toBe('')
    expect(childRow.rhoC).toBe('')
    expect(childRow.ave).toBe('')
    expect(childRow.mean).not.toBe('')
    expect(childRow.path).toBe('IMAG1')

    // formative Expectation: AVE rendered as an em-dash on the group row, not a number
    const expGroup = table.rows.find((r) => (r as Record<string, unknown>).__group === 'Expectation')!
    expect(expGroup.ave).toBe('—')
    expect(expGroup.rhoA).toBe('.60')
  })

  it('renders measurement child rows with loading OR weight (+ Mean/SD) per indicator', () => {
    const c = buildPlsSem(SPEC, R)
    const table = c.tables.find((t) => t.spec.id === 'measurement')!
    const imag1 = table.rows.find((r) => r.path === 'IMAG1')!
    expect(imag1.loading).toBe('.81')
    expect(imag1.mean).toBe('7.64')
    expect(imag1.sd).toBe('1.70')
    const cuex1 = table.rows.find((r) => r.path === 'CUEX1')!
    // merged display column ("Loading / weight"): formative rows surface the WEIGHT here
    expect(cuex1.loading).toBe('.44')
    expect(cuex1.mean).toBe('6.80')
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

  it('renders structural paths with H-ids, dual CIs (percentile + BC), and the Result rule; quality table keeps R²/adj/Q²', () => {
    const c = buildPlsSem(SPEC, R)
    const struct = c.tables.find((t) => t.spec.id === 'structural')!
    expect(struct.rows[0].h).toBe('H1')
    expect(struct.rows[0].path).toBe('Image → Expectation')
    expect(struct.rows[0].beta).toBe('.30')
    expect(struct.rows[0].ciPercLo).toBe('.16'); expect(struct.rows[0].ciPercHi).toBe('.44')
    expect(struct.rows[0].ciBcLo).toBe('.15'); expect(struct.rows[0].ciBcHi).toBe('.43')
    expect(struct.rows[0].result).toBe('Supported') // percentile CI [.16, .44] excludes zero
    const qual = c.tables.find((t) => t.spec.id === 'structural-quality')!
    expect(qual.rows[0].r2).toBe('.09')
    expect(qual.rows[0].q2).toBe('0.05')
  })

  // U6-T3 RED: H-ordering (creation order) + the Result rule derived from the PERCENTILE CI, independent
  // of what the BC column says (a BC CI is comparative context only, never the Result source).
  it('structural table carries H-ids, dual CIs, and the Result rule (percentile CI excludes zero)', () => {
    const content = buildPlsSem(SPEC, { ...R, structural: [
      { path: 'Image → Expectation', beta: 0.5, p: 0.001, ciLower: 0.3, ciUpper: 0.7, ciBcLower: 0.29, ciBcUpper: 0.71, fSquare: 0.2 },
      { path: 'Complaints → Loyalty', beta: 0.05, p: 0.4, ciLower: -0.1, ciUpper: 0.2, ciBcLower: -0.11, ciBcUpper: 0.21, fSquare: 0.01 },
    ] })
    const table = content.tables.find((t) => t.spec.id === 'structural')!
    expect(table.rows[0].h).toBe('H1'); expect(table.rows[0].result).toBe('Supported')
    expect(table.rows[1].h).toBe('H2'); expect(table.rows[1].result).toBe('Not supported')
  })

  // U6-T3 RED: f² is not a structural-table column any more (dual CIs took its place) — it must reach the
  // R² note line, keyed by target construct, never vanish as a silently-unrendered orphan row key.
  it('the R²/f² note line reports f² per incoming path, not as a silent orphan row key', () => {
    const content = buildPlsSem(PLS_SEM, R)
    expect(content.note!.text).toMatch(/R²\(Expectation\)/)
    expect(content.note!.text).toMatch(/f²/i)
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

// REGRESSION (2026-07-06 live-run finding): ApaTable renders row[column.key] against the REAL registry
// spec — the mock SPEC above has empty columns, so builder/spec key mismatches rendered EMPTY
// "Construct → Item" (spec key 'path') and "f²" (spec key 'f2') columns in the app while the builder
// unit tests stayed green. Assert against the REAL PLS_SEM spec: every spec column key must be present
// and non-empty in every built row (the em-dash placeholder counts as non-empty). Relaxed to a
// per-COLUMN rule for 'measurement' (U6-T1, mirrors U3-T1's cfa-loadings relaxation): the merged
// table intentionally leaves group rows blank on item columns and item rows blank on group columns.
describe('buildPlsSem — real registry spec (row keys must cover every spec column key)', () => {
  it('PLS_SEM: every rows-table row fills every spec column', () => {
    const c = buildPlsSem(PLS_SEM, R)
    for (const table of c.tables) {
      if (table.matrix) continue // HTMT matrix renders via the matrix branch; spec.columns unused
      expect(table.rows.length).toBeGreaterThan(0)
      if (table.spec.id === 'measurement') {
        for (const col of table.spec.columns) {
          const filled = table.rows.some((row) => {
            const v = row[col.key as keyof typeof row]
            return v != null && String(v).trim() !== ''
          })
          expect(filled, `table ${table.spec.id} column '${col.key}' (${col.label}) is blank in EVERY row`).toBe(true)
        }
        continue
      }
      for (const col of table.spec.columns) {
        for (const [ri, row] of table.rows.entries()) {
          const v = row[col.key as keyof typeof row]
          expect(v, `table ${table.spec.id} row ${ri} column '${col.key}' (${col.label}) is empty`).toBeTruthy()
          expect(String(v).trim(), `table ${table.spec.id} row ${ri} column '${col.key}' (${col.label}) is blank`).not.toBe('')
        }
      }
    }
  })

  it('PLS_SEM measurement: formative rows surface the WEIGHT in the merged Loading / weight column', () => {
    const c = buildPlsSem(PLS_SEM, R)
    const table = c.tables.find((t) => t.spec.id === 'measurement')!
    const imag1 = table.rows.find((r) => r.path === 'IMAG1')!
    expect(imag1.loading).toBe('.81')       // reflective: loading
    const cuex1 = table.rows.find((r) => r.path === 'CUEX1')!
    expect(cuex1.loading).toBe('.44')       // formative: weight surfaces in the merged column
  })
})
