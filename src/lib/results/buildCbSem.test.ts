import { describe, it, expect } from 'vitest'
import { buildCbSem } from './buildCbSem'
import type { CbSemResult } from '../stats/runCbSem'
import { MODERATION_DISCLOSURE } from '../stats/moderationModel'
import type { TestSpec } from '../registry/types'
import { CB_SEM } from '../registry/cbSem'
import { PATH_ANALYSIS } from '../registry/pathAnalysis'

// Minimal spec stub with the 6 CB-SEM tables in §5.1 order (U3-T3: structural-paths is now the ONE
// merged table — structural paths + indirect effects + moderation, H-numbered, dual-CI, Result-ruled).
// Only ids/titles/columns the builder reads.
const SPEC = {
  id: 'cb-sem',
  name: 'Structural equation model (CB-SEM)',
  tables: [
    { id: 'efa-suitability', title: 'EFA suitability', columns: [] },
    { id: 'efa-loadings', title: 'EFA rotated loadings', columns: [] },
    { id: 'cfa-loadings', title: 'Measurement model (loadings, reliability & item descriptives)', columns: [
      { key: 'path', label: 'Construct / Item' }, { key: 'mean', label: 'Mean' }, { key: 'sd', label: 'SD' },
      { key: 'b', label: 'B' }, { key: 'se', label: 'SE' },
      { key: 'z', label: 'z' }, { key: 'p', label: 'p' }, { key: 'std', label: 'Std. loading' },
      { key: 'omega', label: 'ω' }, { key: 'alpha', label: 'α' }, { key: 'cr', label: 'CR' }, { key: 'ave', label: 'AVE' } ] },
    { id: 'fornell-larcker', title: 'Discriminant validity (Fornell–Larcker)', columns: [] },
    { id: 'htmt', title: 'Discriminant validity (HTMT)', columns: [] },
    { id: 'fit-indices', title: 'Fit indices', columns: [] },
    { id: 'structural-paths', title: 'Structural paths, indirect effects & moderation', columns: [
      { key: 'h', label: 'H' }, { key: 'path', label: 'Path' }, { key: 'b', label: 'B' },
      { key: 'beta', label: 'Std. β' }, { key: 'p', label: 'p' },
      { key: 'percLower', label: 'Lower' }, { key: 'percUpper', label: 'Upper' },
      { key: 'bcLower', label: 'Lower' }, { key: 'bcUpper', label: 'Upper' },
      { key: 'result', label: 'Result' } ] },
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
  // Dual CIs (percentile + BC, U3-T3): both pairs bound the unstandardized B from one bootstrap run.
  structural: [
    { from: 1, to: 2, fromName: 'ind60', toName: 'dem60', b: 1.47, se: 0.39, z: 3.7, p: 0, stdBeta: 0.448,
      ciLower: 0.248, ciUpper: 0.648, ciPercLower: 0.248, ciPercUpper: 0.648, ciBcLower: 0.230, ciBcUpper: 0.630, r2: 0.201 },
    { from: 2, to: 3, fromName: 'dem60', toName: 'dem65', b: 0.84, se: 0.04, z: 19.1, p: 0, stdBeta: 0.913,
      ciLower: 0.819, ciUpper: 1.006, ciPercLower: 0.819, ciPercUpper: 1.006, ciBcLower: 0.801, ciBcUpper: 0.988, r2: 0.974 },
  ],
  rsquare: { 2: 0.201, 3: 0.974 },
  indirect: [
    { label: 'ie_1_2_3', pathLabel: 'ind60 → dem60 → dem65', est: 1.274, stdEst: 0.41, se: 0.359,
      ciLower: 0.55, ciUpper: 2.004, ciPercLower: 0.55, ciPercUpper: 2.004, ciBcLower: 0.50, ciBcUpper: 1.95, p: 0 },
  ],
  moderation: {
    rows: [
      { moderatorName: 'age', pathLabel: 'ind60 → dem60', b: 0.32, se: 0.11, z: 2.9, p: 0.004, stdBeta: 0.18,
        ciPercLower: -0.05, ciPercUpper: 0.30, ciBcLower: -0.08, ciBcUpper: 0.27, matched: true },
    ],
    slopes: [],
  },
  // 3-construct discriminant-validity matrices, reusing the HolzingerSwineford reference values from
  // cfaReliability.test.ts (native R 4.6.0): Fornell-Larcker diagonal = sqrt(AVE), off-diagonal = latent
  // correlations; HTMT off-diagonals; corLvP all < .0001 (diagonal null, not NaN — R's NA_real_ round-trip,
  // never read by the builder since stars are only computed strictly below the diagonal).
  fornellLarcker: [
    [0.6087, 0.4585, 0.4705],
    [0.4585, 0.8491, 0.2830],
    [0.4705, 0.2830, 0.6515],
  ],
  htmt: [
    [1, 0.3841, 0.3868],
    [0.3841, 1, 0.2797],
    [0.3868, 0.2797, 1],
  ],
  corLvP: [
    [null, 0.00001, 0.00001],
    [0.00001, null, 0.00001],
    [0.00001, 0.00001, null],
  ] as unknown as number[][],
  discriminantLabels: ['visual', 'textual', 'speed'],
  estimates: { paths: [{ from: 1, to: 2, beta: 0.448 }], loadings: { x1: 0.92, x2: 0.973 }, r2: { 2: 0.201, 3: 0.974 } },
  itemStats: [
    { construct: 'ind60', item: 'x1', mean: 5.05, sd: 1.14, n: 75 },
    { construct: 'ind60', item: 'x2', mean: 4.79, sd: 1.29, n: 75 },
  ],
}

describe('buildCbSem', () => {
  it('emits CFA, reliability, fit, and ONE merged structural/indirect/moderation table (full mode)', () => {
    const c = buildCbSem(SPEC, base)
    const ids = c.tables.map((t) => t.spec.id)
    expect(ids).toEqual([
      'cfa-loadings', 'fornell-larcker', 'htmt', 'fit-indices', 'structural-paths',
    ])

    const t1 = c.tables.find((t) => t.spec.id === 'cfa-loadings')!
    expect(t1.rows[0]).toMatchObject({ __group: 'ind60', omega: '.95', alpha: '.94' }) // group row
    expect(t1.rows[1]).toMatchObject({ path: 'x1', mean: '5.05', std: '.92' }) // item row, no omega

    const fit = c.tables.find((t) => t.spec.id === 'fit-indices')!
    expect(fit.rows).toHaveLength(1)
    expect(String(fit.rows[0].rmsea)).toContain('[.06, .14]')

    // Merged Table 5 (U3-T3): sectioned, H-numbered, dual-CI, Result-ruled.
    const t5 = c.tables.find((t) => t.spec.id === 'structural-paths')!
    expect(t5.rows[0]).toEqual({ __section: 'Direct paths' })
    expect(t5.rows[1]).toMatchObject({ h: 'H1', result: 'Supported' })
    // construct NAMES in the direct-path Path cell (render-faithfully extension, kept from pre-merge)
    expect(t5.rows[1].path).toBe('ind60 → dem60')
    expect(t5.rows[2]).toMatchObject({ h: 'H2', result: 'Supported' })

    expect(t5.rows.some((r) => r.__section === 'Indirect effects')).toBe(true)
    const indirectRow = t5.rows.find((r) => r.h === 'H3')!
    expect(indirectRow.path).toBe('ind60 → dem60 → dem65')
    expect(indirectRow.result).toBe('Supported')

    expect(t5.rows.some((r) => r.__section === 'Moderation')).toBe(true)
    const modRow = t5.rows.find((r) => r.h === 'H4')!
    expect(modRow.path).toBe('ind60 → dem60 × age')
    expect(modRow.result).toBe('Not supported') // percentile CI [-0.05, 0.30] straddles zero

    // Fornell-Larcker: italic √AVE diagonal, starred off-diagonal latent correlations (U3-T2)
    const fl = c.tables.find((t) => t.spec.id === 'fornell-larcker')!
    expect(fl.matrix!.diagonalStyle).toBe('italic')
    expect(fl.matrix!.cells[0][0]).toBe('.61') // √AVE diagonal
    expect(fl.matrix!.cells[1][0]).toBe('.46') // off-diagonal correlation
    expect(fl.matrix!.cellStars![1][0]).toBe('***')
    expect(fl.matrix!.cellStars![0][0]).toBeNull() // no star on the diagonal
    expect(fl.matrix!.starNote).toBe('*p<.05, **p<.01, ***p<.001')

    // HTMT: lower-triangle only, no stars/diagonal styling
    const htmt = c.tables.find((t) => t.spec.id === 'htmt')!
    expect(htmt.matrix!.cells[1][0]).toBe('.38') // visual-textual
    expect(htmt.matrix!.cells[0][0]).toBeNull() // diagonal suppressed
  })

  it('falls back to numeric ids / lavaan label when name fields are absent', () => {
    const noNames: CbSemResult = {
      ...base,
      structural: [{ from: 1, to: 2, b: 1.47, se: 0.39, z: 3.7, p: 0, stdBeta: 0.448,
        ciLower: 0.248, ciUpper: 0.648, ciPercLower: 0.248, ciPercUpper: 0.648, ciBcLower: 0.230, ciBcUpper: 0.630, r2: 0.201 }],
      indirect: [{ label: 'ie_1_2_3', est: 1.274, stdEst: 0.41, se: 0.359,
        ciLower: 0.55, ciUpper: 2.004, ciPercLower: 0.55, ciPercUpper: 2.004, ciBcLower: 0.50, ciBcUpper: 1.95, p: 0 }],
      moderation: undefined,
    }
    const c = buildCbSem(SPEC, noNames)
    const t5 = c.tables.find((t) => t.spec.id === 'structural-paths')!
    expect(t5.rows.find((r) => r.h === 'H1')!.path).toBe('1 → 2')
    expect(t5.rows.find((r) => r.h === 'H2')!.path).toBe('ie_1_2_3')
  })

  it('R² note: one line per endogenous construct, keyed by construct id and named via structural toName', () => {
    const c = buildCbSem(SPEC, base)
    expect(c.note?.text).toContain('R²(dem60) = .20')
    expect(c.note?.text).toContain('R²(dem65) = .97')
  })

  it('Andrews & Buchinsky (2000) bootstrap-count disclosure when nboot < 7000 (post-review amendment a)', () => {
    const c = buildCbSem(SPEC, { ...base, nboot: 5000 })
    expect(c.note?.text).toContain('Andrews & Buchinsky')
    expect(c.note?.text).toContain('≥7,000 resamples')
  })

  it('omits the Andrews & Buchinsky disclosure when nboot >= 7000', () => {
    const c = buildCbSem(SPEC, { ...base, nboot: 10000 })
    expect(c.note?.text).not.toContain('Andrews & Buchinsky')
  })

  it('match=FALSE disclosure renders as a de-duplicated note under Table 5 (post-review amendment b)', () => {
    const withDisclosure: CbSemResult = {
      ...base,
      moderation: {
        rows: [
          { ...base.moderation!.rows[0], matched: false, disclosure: MODERATION_DISCLOSURE },
          { ...base.moderation!.rows[0], moderatorName: 'income', matched: false, disclosure: MODERATION_DISCLOSURE },
        ],
        slopes: [],
      },
    }
    const c = buildCbSem(SPEC, withDisclosure)
    expect(c.note?.text).toContain(MODERATION_DISCLOSURE)
    // de-duplicated: the shared disclosure text appears exactly once even with 2 unequal-count moderations
    expect(c.note!.text.split(MODERATION_DISCLOSURE)).toHaveLength(2)
  })

  it('omits the disclosure note when every moderation row is matched (no disclosure)', () => {
    const c = buildCbSem(SPEC, base)
    expect(c.note?.text ?? '').not.toContain(MODERATION_DISCLOSURE)
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
    expect(ids).toContain('structural-paths')
  })

  // Review findings (fix round, U3-T3): direct-paths-only CB-SEM models never bootstrap (no indirect
  // chain, no moderation), so lavaan's parameterEstimates() never populates ci.lower/upper under
  // boot.ci.type — ciBcLower/ciBcUpper come back null (NA_real_ -> null over the WebR bridge) AND
  // ciPercLower/ciPercUpper hold ordinary delta-method (Wald) CIs, not bootstrap percentile CIs.
  it('non-bootstrapped run (bootstrapped: false): BC CI cells are dashes, not fabricated ".00"', () => {
    const directOnly: CbSemResult = {
      ...base,
      bootstrapped: false,
      indirect: undefined,
      moderation: undefined,
      structural: base.structural!.map((row) => ({ ...row, ciBcLower: null, ciBcUpper: null })),
    }
    const c = buildCbSem(SPEC, directOnly)
    const t5 = c.tables.find((t) => t.spec.id === 'structural-paths')!
    const dataRows = t5.rows.filter((r) => r.h != null)
    expect(dataRows.length).toBeGreaterThan(0)
    for (const row of dataRows) {
      expect(row.bcLower).toBe('—')
      expect(row.bcUpper).toBe('—')
      expect(row.bcLower).not.toBe('.00')
      expect(row.bcUpper).not.toBe('.00')
    }
  })

  it('non-bootstrapped run: table note carries an honest Wald-CI sentence, no Andrews & Buchinsky / Efron claim', () => {
    const directOnly: CbSemResult = {
      ...base,
      bootstrapped: false,
      nboot: 5000, // even under the default nboot, no bootstrap ran -- A&B must NOT fire
      indirect: undefined,
      moderation: undefined,
      structural: base.structural!.map((row) => ({ ...row, ciBcLower: null, ciBcUpper: null })),
    }
    const c = buildCbSem(SPEC, directOnly)
    expect(c.note?.text).toContain('delta-method')
    expect(c.note?.text).toContain('Wald')
    expect(c.note?.text).not.toContain('Andrews & Buchinsky')
    expect(c.note?.text).not.toContain('Efron')
  })

  it('bootstrapped run (bootstrapped: true, or field absent): current behavior unchanged -- numeric BC cells, A&B note when nboot<7000', () => {
    const c = buildCbSem(SPEC, { ...base, bootstrapped: true, nboot: 5000 })
    const t5 = c.tables.find((t) => t.spec.id === 'structural-paths')!
    const h1 = t5.rows.find((r) => r.h === 'H1')!
    expect(h1.bcLower).toBe('.23')
    expect(h1.bcUpper).toBe('.63')
    expect(c.note?.text).toContain('Andrews & Buchinsky')
    expect(c.note?.text).not.toContain('delta-method')

    // field-absent fixtures (every OTHER test in this file) must keep behaving as bootstrapped --
    // `bootstrapped` is optional so pre-existing hand-built CbSemResult fixtures need no change.
    const omitted = { ...base }
    delete (omitted as Partial<CbSemResult>).bootstrapped
    const c2 = buildCbSem(SPEC, omitted)
    expect(c2.note?.text).not.toContain('delta-method')
  })

  it('suppresses the Fornell-Larcker/HTMT tables when < 2 constructs (mirrors buildAve.ts)', () => {
    const oneConstruct: CbSemResult = {
      ...base,
      fornellLarcker: [[0.6087]],
      htmt: [[1]],
      corLvP: [[null]] as unknown as number[][],
      discriminantLabels: ['visual'],
    }
    const c = buildCbSem(SPEC, oneConstruct)
    const ids = c.tables.map((t) => t.spec.id)
    expect(ids).not.toContain('fornell-larcker')
    expect(ids).not.toContain('htmt')
  })
})

// REGRESSION (2026-07-06 live-run finding): ApaTable renders row[column.key] against the REAL registry
// spec — the mock SPEC above used the builder's own row keys, so a builder/spec key mismatch rendered
// EMPTY "Std. loading" (cfa-loadings, spec key 'std') and "Std. β" (structural-paths, spec key 'beta')
// columns in the app while every builder unit test stayed green. Assert against the REAL specs: every
// spec column key must be present and non-empty SOMEWHERE in the table. (Relaxed from a per-ROW rule to
// a per-COLUMN rule in U3-T1: the merged cfa-loadings table intentionally leaves group rows blank on
// item columns and item rows blank on group columns — see buildCbSem.ts's __group split. This still
// catches the regression the per-row rule was written for — a spec/builder key mismatch blanks a column
// in EVERY row, not just some. U3-T3: the merged structural-paths table similarly leaves __section
// marker rows blank on every data column — still fine, since .some() only needs ONE row filled.)
describe('buildCbSem — real registry specs (row keys must cover every spec column key)', () => {
  const assertRowsCoverSpecColumns = (spec: TestSpec, result: CbSemResult, tableIds: string[]) => {
    const c = buildCbSem(spec, result)
    for (const id of tableIds) {
      const table = c.tables.find((t) => t.spec.id === id)!
      expect(table, `table ${id} missing`).toBeDefined()
      expect(table.rows.length).toBeGreaterThan(0)
      for (const col of table.spec.columns) {
        const filled = table.rows.some((row) => {
          const v = row[col.key as keyof typeof row]
          return v != null && String(v).trim() !== ''
        })
        expect(filled, `table ${id} column '${col.key}' (${col.label}) is blank in EVERY row`).toBe(true)
      }
    }
  }

  it('CB_SEM: cfa-loadings + fit + the merged structural-paths table fill every spec column', () => {
    assertRowsCoverSpecColumns(CB_SEM, base, [
      'cfa-loadings', 'fit-indices', 'structural-paths',
    ])
  })

  it('PATH_ANALYSIS: structural-paths + indirect rows fill every spec column', () => {
    const path: CbSemResult = { ...base, mode: 'path', cfaLoadings: [], reliability: [] }
    assertRowsCoverSpecColumns(PATH_ANALYSIS, path, ['structural-paths', 'indirect-effects'])
  })
})
