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
    { id: 'conditional-effects', title: 'Conditional effects (simple slopes)', columns: [
      { key: 'level', label: 'Moderator level' }, { key: 'b', label: 'B' }, { key: 'se', label: 'SE' },
      { key: 'p', label: 'p' }, { key: 'ci', label: 'boot 95% CI' } ] },
  ],
  figures: [
    { caption: 'Path diagram', type: 'annotated path diagram', file: 'path-diagram' },
    { caption: 'Simple slopes', type: 'conditional-effects plot', file: 'simple-slopes', optional: true },
  ],
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

  // U3-T5: CB-SEM is the labelled-notes worked example — content.notes (LabelledNote[]) replaces the
  // single giant content.note for this card. Content-preserving: every fact from the old tableNote.text
  // survives, split and labelled; nothing dropped.
  it('labelled notes: canonical label set + order (static notes, no dynamic triggers)', () => {
    const clean: CbSemResult = { ...base, cfaLoadings: [], reliability: [], rsquare: undefined, moderation: undefined, indirect: undefined, bootstrapped: true, nboot: 10000 }
    const c = buildCbSem(SPEC, clean)
    expect(c.notes!.map((n) => n.label)).toEqual(['Scope', 'Cutoffs', 'Estimator', 'R²', 'Caution', 'Discriminant validity', 'Indirect effects', 'Moderation'])
    expect(c.notes!.find((n) => n.label === 'Cutoffs')!.text).toContain('CFI/TLI ≥ .95')
    expect(c.notes!.find((n) => n.label === 'Discriminant validity')).toMatchObject({
      text: 'Discriminant validity also has its own card (AVE / convergent validity); it is included here so one run gives the complete measurement-model writeup.',
      afterTableId: 'htmt',
    })
    expect(c.note).toBeNull() // CB-SEM renders notes, not the legacy single note
  })

  it('R² note: one line per endogenous construct, keyed by construct id and named via structural toName', () => {
    const c = buildCbSem(SPEC, base)
    const r2 = c.notes!.find((n) => n.label === 'R²')!.text
    expect(r2).toContain('R²(dem60) = .20')
    expect(r2).toContain('R²(dem65) = .97')
  })

  it('Andrews & Buchinsky (2000) bootstrap-count disclosure when nboot < 7000 (post-review amendment a)', () => {
    const c = buildCbSem(SPEC, { ...base, nboot: 5000 })
    const ci = c.notes!.find((n) => n.label === 'CIs')!.text
    expect(ci).toContain('Andrews & Buchinsky')
    expect(ci).toContain('≥7,000 resamples')
  })

  it('omits the Andrews & Buchinsky disclosure (and the CIs note entirely) when nboot >= 7000', () => {
    const c = buildCbSem(SPEC, { ...base, nboot: 10000 })
    expect(c.notes!.find((n) => n.label === 'CIs')).toBeUndefined()
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
    const mod = c.notes!.find((n) => n.label === 'Moderation')!.text
    expect(mod).toContain(MODERATION_DISCLOSURE)
    // de-duplicated: the shared disclosure text appears exactly once even with 2 unequal-count moderations
    expect(mod.split(MODERATION_DISCLOSURE)).toHaveLength(2)
  })

  it('omits the disclosure note when every moderation row is matched (no disclosure)', () => {
    const c = buildCbSem(SPEC, base)
    expect(c.notes!.find((n) => n.label === 'Moderation')!.text).not.toContain(MODERATION_DISCLOSURE)
  })

  // Fix round (U3-T5 review findings, item 1): the Moderation note dropped a methodological clause
  // ("each an interaction-term effect from the same bootstrap run" -- present in the pre-split
  // tableNote, lost when U3-T5 split it into labelled notes) and added a false forward-reference to a
  // conditional-effects table that Unit 5 hasn't built yet. Static text must (a) restore the bootstrap-
  // provenance clause and (b) not claim a table that doesn't exist.
  it('Moderation note restores the bootstrap-provenance clause and drops the premature conditional-effects-table reference', () => {
    const c = buildCbSem(SPEC, base)
    const mod = c.notes!.find((n) => n.label === 'Moderation')!.text
    expect(mod).toContain('each an interaction-term effect from the same bootstrap run')
    expect(mod).not.toContain('conditional-effects table')
  })

  it('suppresses the fit table and flags saturation when df==0 (single Saturation note, in notes[0])', () => {
    const sat: CbSemResult = { ...base, saturated: true, fit: { ...base.fit!, df: 0 } }
    const c = buildCbSem(SPEC, sat)
    expect(c.tables.some((t) => t.spec.id === 'fit-indices')).toBe(false)
    expect(c.notes![0]).toMatchObject({ label: 'Saturation' })
    expect(c.notes![0].text).toContain('saturated')
  })

  it('item-sample note (labelled "Item sample", placed after the cfa-loadings table) states the missing-data-dependent sample', () => {
    const c = buildCbSem(SPEC, base)
    const itemSample = c.notes!.find((n) => n.label === 'Item sample')!
    expect(itemSample.afterTableId).toBe('cfa-loadings')
    expect(itemSample.text).toContain('the listwise estimation sample (the same N as the model fit)')
  })

  it('item-sample note states the per-item-N caveat when missing is not listwise', () => {
    const c = buildCbSem(SPEC, { ...base, missing: 'fiml' })
    const itemSample = c.notes!.find((n) => n.label === 'Item sample')!
    expect(itemSample.text).toContain('N can vary by item under fiml/mi/pairwise')
  })

  it('omits the "Item sample" note when there are no CFA loadings (path mode)', () => {
    const c = buildCbSem(SPEC, { ...base, mode: 'path', cfaLoadings: [], reliability: [] })
    expect(c.notes!.find((n) => n.label === 'Item sample')).toBeUndefined()
  })

  // T3 review follow-up (a): a missing/non-finite CI bound must never fabricate a Supported/Not-supported
  // verdict -- render a dash instead. Before this fix, Number(null) coerced to 0, so a row with a null
  // lower bound and a negative-but-present upper bound would wrongly read "Supported" (0 > 0 is false,
  // hi < 0 true) or "Not supported" depending on the other bound, neither of which is a real verdict.
  it('Result column renders a dash, not a fabricated verdict, when either CI bound is nullish', () => {
    const nullBound: CbSemResult = {
      ...base,
      indirect: undefined,
      moderation: undefined,
      structural: [{ ...base.structural![0], ciPercLower: null as unknown as number, ciPercUpper: -0.2 }],
    }
    const c = buildCbSem(SPEC, nullBound)
    const t5 = c.tables.find((t) => t.spec.id === 'structural-paths')!
    const h1 = t5.rows.find((r) => r.h === 'H1')!
    expect(h1.result).toBe('—')
    expect(h1.result).not.toBe('Supported')
    expect(h1.result).not.toBe('Not supported')
  })

  // Fix round (review finding 2): the shared result() dash rule was only pinned on the direct-paths row
  // above -- pin it on the Indirect effects and Moderation sections too, since they call the exact same
  // result(row.ciPercLower, row.ciPercUpper) helper.
  it('Result column renders a dash, not a fabricated verdict, on the Indirect effects row when either CI bound is nullish', () => {
    const nullBound: CbSemResult = {
      ...base,
      moderation: undefined,
      indirect: [{ ...base.indirect![0], ciPercLower: null as unknown as number, ciPercUpper: -0.2 }],
    }
    const c = buildCbSem(SPEC, nullBound)
    const t5 = c.tables.find((t) => t.spec.id === 'structural-paths')!
    const indirectRow = t5.rows.find((r) => r.__section == null && r.path === 'ind60 → dem60 → dem65')!
    expect(indirectRow.result).toBe('—')
    expect(indirectRow.result).not.toBe('Supported')
    expect(indirectRow.result).not.toBe('Not supported')
  })

  it('Result column renders a dash, not a fabricated verdict, on the Moderation row when either CI bound is nullish', () => {
    const nullBound: CbSemResult = {
      ...base,
      indirect: undefined,
      moderation: {
        rows: [{ ...base.moderation!.rows[0], ciPercLower: null as unknown as number, ciPercUpper: -0.2 }],
        slopes: [],
      },
    }
    const c = buildCbSem(SPEC, nullBound)
    const t5 = c.tables.find((t) => t.spec.id === 'structural-paths')!
    const modRow = t5.rows.find((r) => r.__section == null && r.path === 'ind60 → dem60 × age')!
    expect(modRow.result).toBe('—')
    expect(modRow.result).not.toBe('Supported')
    expect(modRow.result).not.toBe('Not supported')
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

  it('non-bootstrapped run: labelled "CIs" note carries an honest Wald-CI sentence + Result-derivation wording, no Andrews & Buchinsky / Efron claim', () => {
    const directOnly: CbSemResult = {
      ...base,
      bootstrapped: false,
      nboot: 5000, // even under the default nboot, no bootstrap ran -- A&B must NOT fire
      indirect: undefined,
      moderation: undefined,
      structural: base.structural!.map((row) => ({ ...row, ciBcLower: null, ciBcUpper: null })),
    }
    const c = buildCbSem(SPEC, directOnly)
    const ci = c.notes!.find((n) => n.label === 'CIs')!.text
    expect(ci).toContain('delta-method')
    expect(ci).toContain('Wald')
    // T3 review follow-up (a): the Wald note gains this sentence so Result is understood as CI-derived.
    expect(ci).toContain('Result is derived from these intervals.')
    expect(ci).not.toContain('Andrews & Buchinsky')
    expect(ci).not.toContain('Efron')
  })

  it('bootstrapped run (bootstrapped: true, or field absent): current behavior unchanged -- numeric BC cells, A&B note when nboot<7000', () => {
    const c = buildCbSem(SPEC, { ...base, bootstrapped: true, nboot: 5000 })
    const t5 = c.tables.find((t) => t.spec.id === 'structural-paths')!
    const h1 = t5.rows.find((r) => r.h === 'H1')!
    expect(h1.bcLower).toBe('.23')
    expect(h1.bcUpper).toBe('.63')
    const ci = c.notes!.find((n) => n.label === 'CIs')!.text
    expect(ci).toContain('Andrews & Buchinsky')
    expect(ci).not.toContain('delta-method')

    // field-absent fixtures (every OTHER test in this file) must keep behaving as bootstrapped --
    // `bootstrapped` is optional so pre-existing hand-built CbSemResult fixtures need no change.
    const omitted = { ...base }
    delete (omitted as Partial<CbSemResult>).bootstrapped
    const c2 = buildCbSem(SPEC, omitted)
    expect(c2.notes!.find((n) => n.label === 'CIs')!.text).not.toContain('delta-method')
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

  // U5-T2: conditional-effects table + second (simple-slopes) figure entry.
  // modId/label (fix round, multi-moderation regression): all 3 rows belong to the SAME edge here, so
  // the single-moderation tests below stay on the "today's exact shape" code path.
  const SLOPES: NonNullable<CbSemResult['moderation']>['slopes'] = [
    { level: '-1SD', modId: 1, label: 'ind60 → dem60 × age', b: 0.26, se: 0.07, p: 0.0002, z: 3.71, ciPercLower: 0.13, ciPercUpper: 0.40, ciBcLower: 0.14, ciBcUpper: 0.41 },
    { level: 'mean', modId: 1, label: 'ind60 → dem60 × age', b: 0.47, se: 0.06, p: 0.00001, z: 7.83, ciPercLower: 0.36, ciPercUpper: 0.58, ciBcLower: 0.36, ciBcUpper: 0.59 },
    { level: '+1SD', modId: 1, label: 'ind60 → dem60 × age', b: 0.67, se: 0.09, p: 0.000005, z: 7.44, ciPercLower: 0.52, ciPercUpper: 0.86, ciBcLower: 0.52, ciBcUpper: 0.85 },
  ]

  it('emits the conditional-effects table with the SAME numbers as moderation.slopes', () => {
    const r: CbSemResult = { ...base, moderation: { rows: base.moderation!.rows, slopes: SLOPES } }
    const content = buildCbSem(SPEC, r)
    const table = content.tables.find((t) => t.spec.id === 'conditional-effects')!
    expect(table.rows).toEqual([
      { level: '-1SD', b: '0.26', se: '0.07', p: '<.001', ci: '[.13, .40]' },
      { level: 'mean', b: '0.47', se: '0.06', p: '<.001', ci: '[.36, .58]' },
      { level: '+1SD', b: '0.67', se: '0.09', p: '<.001', ci: '[.52, .86]' },
    ])
  })

  it('emits a SECOND figure entry (simple-slopes) with real PNG bytes when moderation is present, none when absent', () => {
    const withMod: CbSemResult = {
      ...base,
      moderation: { rows: base.moderation!.rows, slopes: SLOPES },
      figModSlopesPng: new Uint8Array([1, 2, 3]),
    }
    const contentWithMod = buildCbSem(SPEC, withMod)
    expect(contentWithMod.figures).toHaveLength(2)
    expect(contentWithMod.figures[1].png.length).toBeGreaterThan(0)

    const withoutMod: CbSemResult = { ...base, moderation: undefined }
    const contentWithoutMod = buildCbSem(SPEC, withoutMod)
    expect(contentWithoutMod.figures).toHaveLength(1)
  })

  // Fix round (multi-moderation regression, reviewer-verified in real R): with 2 legal moderation edges
  // (guards only block exact duplicates), moderation.slopes held 6 rows with 3 duplicated `level` labels
  // per edge -- the OLD ggplot factor() call threw ("factor level [4] is duplicated"), and even setting
  // that aside, the table rendered 6 indistinguishable rows with no way to tell which edge a row belongs
  // to. Fix: disambiguate via modId + a prepended 'Moderation' column, not a cap on moderation count.
  it('2 distinct moderation edges: prepends a Moderation column and labels every row by its edge', () => {
    const edge2 = 'dem60 → dem65 × income'
    const twoMod: NonNullable<CbSemResult['moderation']>['slopes'] = [
      ...SLOPES,
      { level: '-1SD', modId: 2, label: edge2, b: 0.10, se: 0.05, p: 0.04, z: 2.0, ciPercLower: 0.01, ciPercUpper: 0.20, ciBcLower: 0.0, ciBcUpper: 0.19 },
      { level: 'mean', modId: 2, label: edge2, b: 0.20, se: 0.05, p: 0.001, z: 4.0, ciPercLower: 0.10, ciPercUpper: 0.30, ciBcLower: 0.09, ciBcUpper: 0.29 },
      { level: '+1SD', modId: 2, label: edge2, b: 0.30, se: 0.06, p: 0.0001, z: 5.0, ciPercLower: 0.18, ciPercUpper: 0.42, ciBcLower: 0.17, ciBcUpper: 0.41 },
    ]
    const r: CbSemResult = { ...base, moderation: { rows: base.moderation!.rows, slopes: twoMod } }
    const content = buildCbSem(SPEC, r)
    const table = content.tables.find((t) => t.spec.id === 'conditional-effects')!

    expect(table.spec.columns.map((c) => c.key)).toEqual(['moderation', 'level', 'b', 'se', 'p', 'ci'])
    expect(table.rows).toHaveLength(6)
    expect(table.rows[0]).toMatchObject({ moderation: 'ind60 → dem60 × age', level: '-1SD' })
    expect(table.rows[2]).toMatchObject({ moderation: 'ind60 → dem60 × age', level: '+1SD' })
    expect(table.rows[3]).toMatchObject({ moderation: edge2, level: '-1SD' })
    expect(table.rows[5]).toMatchObject({ moderation: edge2, level: '+1SD' })
  })

  it('values carries the fit indices under the rmseaLower/rmseaUpper convention the term explainer reads (U8-T3), plus the U8-T4 measurement/structural aggregates', () => {
    const c = buildCbSem(SPEC, base)
    expect(c.values).toEqual({
      cfi: '.95', tli: '.94', rmsea: '.10', rmseaLower: '.06', rmseaUpper: '.14', srmr: '.06',
      chisq: '72.46', chisqDf: '1.77', fitDf: '41', fitP: '.002',
      itemMeanLo: '4.79', itemMeanHi: '5.05', itemSdLo: '1.14', itemSdHi: '1.29',
      loadBLo: '1.00', loadBHi: '2.18', loadSeLo: '0.00', loadSeHi: '0.14', loadZLo: '0', loadZHi: '15.70',
      loadPLo: '<.001', loadPHi: '<.001', stdLoadLo: '.92', stdLoadHi: '.97',
      omegaLo: '.89', omegaHi: '.95', alphaLo: '.88', alphaHi: '.94', crLo: '.89', crHi: '.95', aveLo: '.66', aveHi: '.86',
      nConstructs: 2, nItems: 2,
      hCount: 4, supportedCount: 3, betaLo: '.18', betaHi: '.91', structPLo: '<.001', structPHi: '.004',
      percLowerLo: '.25', percLowerHi: '.82', percUpperLo: '.65', percUpperHi: '1.01',
      bcLowerLo: '.23', bcLowerHi: '.80', bcUpperLo: '.63', bcUpperHi: '.99',
      nModerationEdges: 1,
    })
  })

  it('values omits fit but keeps the measurement/structural aggregates when fit is suppressed for saturation - no explainer line quotes an uninformative fit index', () => {
    const sat: CbSemResult = { ...base, saturated: true, fit: { ...base.fit!, df: 0 } }
    const c = buildCbSem(SPEC, sat)
    expect(c.values).not.toHaveProperty('cfi')
    expect(c.values).not.toHaveProperty('rmsea')
    expect(c.values).not.toHaveProperty('chisq')
    expect(c.values).toMatchObject({ itemMeanLo: '4.79', omegaLo: '.89', hCount: 4, betaLo: '.18' })
  })

  it('single moderation keeps the EXACT static column shape (the real registry spec object, untouched)', () => {
    const r: CbSemResult = { ...base, moderation: { rows: base.moderation!.rows, slopes: SLOPES } }
    const content = buildCbSem(SPEC, r)
    const table = content.tables.find((t) => t.spec.id === 'conditional-effects')!
    // Same object reference as the registry spec -- proves the single-moderation path never clones/
    // mutates it, so the master HTML / consistency-test column pin (5 columns, no 'Moderation') stays true.
    expect(table.spec).toBe(SPEC.tables.find((t) => t.id === 'conditional-effects'))
    expect(table.spec.columns.map((c) => c.key)).toEqual(['level', 'b', 'se', 'p', 'ci'])
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

  it('PATH_ANALYSIS: labelled notes (U8-T4 sweep) replace the old single note, content-preserving, through the same `notes` field CB-SEM already uses', () => {
    const path: CbSemResult = { ...base, mode: 'path', cfaLoadings: [], reliability: [] }
    const c = buildCbSem(PATH_ANALYSIS, path)
    expect(c.note).toBeNull()
    expect(c.notes).toEqual([
      { label: 'Scope', text: expect.stringContaining('no latent measurement model, so no CFA loadings, reliability, or AVE are reported') },
      { label: 'Fit', text: expect.stringContaining('global fit indices'), afterTableId: 'structural-paths' },
      { label: 'Indirect effects', text: expect.stringContaining('bias-uncorrected percentile bootstrap 95% CIs'), afterTableId: 'indirect-effects' },
    ])
  })

  it('PATH_ANALYSIS: saturation collapses the labelled notes to the single shared saturation flag (same as CB-SEM)', () => {
    const path: CbSemResult = { ...base, mode: 'path', cfaLoadings: [], reliability: [], saturated: true, fit: { ...base.fit!, df: 0 } }
    const c = buildCbSem(PATH_ANALYSIS, path)
    expect(c.note).toBeNull()
    expect(c.notes).toEqual([{ label: 'Saturation', text: expect.stringContaining('The model is saturated (df = 0)') }])
  })

  it('PATH_ANALYSIS: values carries the range aggregates the path-analysis term explainers read (U8-T4) - distinctly namespaced from cb-sem, and carries no cb-sem-only keys', () => {
    const path: CbSemResult = { ...base, mode: 'path', cfaLoadings: [], reliability: [] }
    const c = buildCbSem(PATH_ANALYSIS, path)
    expect(c.values).toEqual({
      pathBLo: '0.84', pathBHi: '1.47', pathSeLo: '0.04', pathSeHi: '0.39', pathZLo: '3.70', pathZHi: '19.10',
      pathPLo: '<.001', pathPHi: '<.001', pathBetaLo: '.45', pathBetaHi: '.91', pathR2Lo: '.20', pathR2Hi: '.97',
      indEstLo: '1.27', indEstHi: '1.27', nPaths: 2, nIndirect: 1,
    })
    expect(c.values).not.toHaveProperty('hCount') // cb-sem-only structural aggregate
    expect(c.values).not.toHaveProperty('itemMeanLo') // cb-sem-only measurement aggregate
  })
})
