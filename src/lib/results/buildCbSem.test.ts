import { describe, it, expect } from 'vitest'
import { buildCbSem } from './buildCbSem'
import type { CbSemResult } from '../stats/runCbSem'
import type { TestSpec } from '../registry/types'
import { CB_SEM } from '../registry/cbSem'
import { PATH_ANALYSIS } from '../registry/pathAnalysis'

// Minimal spec stub with the 7 CB-SEM tables in §5.1 order. Only ids/titles/columns the builder reads.
const SPEC = {
  id: 'cb-sem',
  name: 'Structural equation model (CB-SEM)',
  tables: [
    { id: 'efa-suitability', title: 'EFA suitability', columns: [] },
    { id: 'efa-loadings', title: 'EFA rotated loadings', columns: [] },
    { id: 'cfa-loadings', title: 'Measurement model (CFA)', columns: [
      { key: 'path', label: 'Construct → Item' }, { key: 'b', label: 'B' }, { key: 'se', label: 'SE' },
      { key: 'z', label: 'z' }, { key: 'p', label: 'p' }, { key: 'std', label: 'Std. loading' } ] },
    { id: 'reliability', title: 'Reliability & validity', columns: [
      { key: 'construct', label: 'Construct' }, { key: 'cr', label: 'CR' }, { key: 'ave', label: 'AVE' },
      { key: 'omega', label: 'ω' }, { key: 'alpha', label: 'α' } ] },
    { id: 'fit-indices', title: 'Fit indices', columns: [] },
    { id: 'structural-paths', title: 'Structural paths', columns: [
      { key: 'path', label: 'Path' }, { key: 'b', label: 'B' }, { key: 'se', label: 'SE' },
      { key: 'z', label: 'z' }, { key: 'p', label: 'p' }, { key: 'beta', label: 'Std. β' },
      { key: 'ci', label: '95% CI' }, { key: 'r2', label: 'R²' } ] },
    { id: 'indirect-effects', title: 'Indirect effects', columns: [
      { key: 'path', label: 'Path' }, { key: 'est', label: 'est' }, { key: 'se', label: 'SE' },
      { key: 'ci', label: 'bootstrap 95% CI' }, { key: 'p', label: 'p' } ] },
  ],
  figures: [{ caption: 'Path diagram', type: 'annotated path diagram', file: 'path-diagram' }],
  howToRead: 'hr', apaTemplate: 'apa', rMap: 'r',
} as unknown as TestSpec

const base: CbSemResult = {
  mode: 'full',
  saturated: false,
  cfaLoadings: [
    { construct: 'ind60', item: 'x1', b: 1, se: 0, z: 0, p: 0, stdLoading: 0.92, rhs: 'x1' },
    { construct: 'ind60', item: 'x2', b: 2.18, se: 0.14, z: 15.7, p: 0, stdLoading: 0.973, rhs: 'x2' },
  ],
  reliability: [
    { construct: 'ind60', cr: 0.95, ave: 0.86, omega: 0.95, alpha: 0.94 },
    { construct: 'dem65', cr: 0.89, ave: 0.66, omega: 0.89, alpha: 0.88 },
  ],
  fit: { chisq: 72.462, df: 41, pvalue: 0.002, cfi: 0.953, tli: 0.938, rmsea: 0.101, rmseaLower: 0.061, rmseaUpper: 0.139, srmr: 0.055 },
  structural: [
    { from: 1, to: 2, fromName: 'ind60', toName: 'dem60', b: 1.47, se: 0.39, z: 3.7, p: 0, stdBeta: 0.448, ciLower: 0.248, ciUpper: 0.648, r2: 0.201 },
    { from: 2, to: 3, fromName: 'dem60', toName: 'dem65', b: 0.84, se: 0.04, z: 19.1, p: 0, stdBeta: 0.913, ciLower: 0.819, ciUpper: 1.006, r2: 0.974 },
  ],
  rsquare: { 2: 0.201, 3: 0.974 },
  indirect: [
    { label: 'ie_1_2_3', pathLabel: 'ind60 → dem60 → dem65', est: 1.274, stdEst: 0.41, se: 0.359, ciLower: 0.55, ciUpper: 2.004, p: 0 },
  ],
  estimates: { paths: [{ from: 1, to: 2, beta: 0.448 }], loadings: { x1: 0.92, x2: 0.973 }, r2: { 2: 0.201, 3: 0.974 } },
}

describe('buildCbSem', () => {
  it('emits CFA, reliability, fit, structural, indirect tables (full mode)', () => {
    const c = buildCbSem(SPEC, base)
    const ids = c.tables.map((t) => t.spec.id)
    expect(ids).toEqual(['cfa-loadings', 'reliability', 'fit-indices', 'structural-paths', 'indirect-effects'])

    const cfa = c.tables.find((t) => t.spec.id === 'cfa-loadings')!
    expect(cfa.rows[1].std).toBe('.97')
    expect(cfa.rows[1].b).toBe('2.18')

    const fit = c.tables.find((t) => t.spec.id === 'fit-indices')!
    expect(fit.rows).toHaveLength(1)
    expect(String(fit.rows[0].rmsea)).toContain('[.06, .14]')

    const struct = c.tables.find((t) => t.spec.id === 'structural-paths')!
    expect(struct.rows[0].beta).toBe('.45')
    expect(struct.rows[0].r2).toBe('.20')
    // construct NAMES in the structural Path cell (render-faithfully extension)
    expect(struct.rows[0].path).toBe('ind60 → dem60')

    const ind = c.tables.find((t) => t.spec.id === 'indirect-effects')!
    expect(ind.rows[0].est).toBe('1.27')
    expect(String(ind.rows[0].ci)).toBe('[0.55, 2.00]')
    // construct-name chain in the indirect Path cell (render-faithfully extension)
    expect(ind.rows[0].path).toBe('ind60 → dem60 → dem65')
  })

  it('falls back to numeric ids / lavaan label when name fields are absent', () => {
    const noNames: CbSemResult = {
      ...base,
      structural: [{ from: 1, to: 2, b: 1.47, se: 0.39, z: 3.7, p: 0, stdBeta: 0.448, ciLower: 0.248, ciUpper: 0.648, r2: 0.201 }],
      indirect: [{ label: 'ie_1_2_3', est: 1.274, stdEst: 0.41, se: 0.359, ciLower: 0.55, ciUpper: 2.004, p: 0 }],
    }
    const c = buildCbSem(SPEC, noNames)
    const struct = c.tables.find((t) => t.spec.id === 'structural-paths')!
    expect(struct.rows[0].path).toBe('1 → 2')
    const ind = c.tables.find((t) => t.spec.id === 'indirect-effects')!
    expect(ind.rows[0].path).toBe('ie_1_2_3')
  })

  it('suppresses the fit table and flags saturation when df==0', () => {
    const sat: CbSemResult = { ...base, saturated: true, fit: { ...base.fit!, df: 0 } }
    const c = buildCbSem(SPEC, sat)
    expect(c.tables.some((t) => t.spec.id === 'fit-indices')).toBe(false)
    expect(c.note?.text).toContain('saturated')
  })

  it('suppresses measurement tables in path mode', () => {
    const path: CbSemResult = { ...base, mode: 'path', cfaLoadings: [], reliability: [] }
    const c = buildCbSem(SPEC, path)
    const ids = c.tables.map((t) => t.spec.id)
    expect(ids).not.toContain('cfa-loadings')
    expect(ids).not.toContain('reliability')
    expect(ids).toContain('structural-paths')
  })
})

// REGRESSION (2026-07-06 live-run finding): ApaTable renders row[column.key] against the REAL registry
// spec — the mock SPEC above used the builder's own row keys, so a builder/spec key mismatch rendered
// EMPTY "Std. loading" (cfa-loadings, spec key 'std') and "Std. β" (structural-paths, spec key 'beta')
// columns in the app while every builder unit test stayed green. Assert against the REAL specs: every
// spec column key must be present and non-empty in every built row.
describe('buildCbSem — real registry specs (row keys must cover every spec column key)', () => {
  const assertRowsCoverSpecColumns = (spec: TestSpec, result: CbSemResult, tableIds: string[]) => {
    const c = buildCbSem(spec, result)
    for (const id of tableIds) {
      const table = c.tables.find((t) => t.spec.id === id)!
      expect(table, `table ${id} missing`).toBeDefined()
      expect(table.rows.length).toBeGreaterThan(0)
      for (const col of table.spec.columns) {
        for (const [ri, row] of table.rows.entries()) {
          const v = row[col.key as keyof typeof row]
          expect(v, `table ${id} row ${ri} column '${col.key}' (${col.label}) is empty`).toBeTruthy()
          expect(String(v).trim(), `table ${id} row ${ri} column '${col.key}' (${col.label}) is blank`).not.toBe('')
        }
      }
    }
  }

  it('CB_SEM: cfa-loadings + structural-paths + reliability + fit + indirect rows fill every spec column', () => {
    assertRowsCoverSpecColumns(CB_SEM, base, [
      'cfa-loadings', 'reliability', 'fit-indices', 'structural-paths', 'indirect-effects',
    ])
  })

  it('PATH_ANALYSIS: structural-paths + indirect rows fill every spec column', () => {
    const path: CbSemResult = { ...base, mode: 'path', cfaLoadings: [], reliability: [] }
    assertRowsCoverSpecColumns(PATH_ANALYSIS, path, ['structural-paths', 'indirect-effects'])
  })
})
