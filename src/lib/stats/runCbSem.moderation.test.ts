import { describe, it, expect, vi } from 'vitest'
import { buildModel, runCbSem } from './runCbSem'
import { lvNames } from './lvName'
import type { Construct, StructuralPath } from '../../state/session'
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import type { TestSetup } from '../../state/session'

const constructs: Construct[] = [
  { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
  { id: 2, name: 'TA', items: ['ta1', 'ta2', 'ta3', 'ta4'] },
  { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
]
const paths: StructuralPath[] = [{ from: 1, to: 3 }]
const rNameOf = (id: number) => { const names = lvNames(constructs.map((c) => c.name)); return names[constructs.findIndex((c) => c.id === id)] }

describe('buildModel — moderation guards + naming (pure, no WebR)', () => {
  it('rejects self-moderation (moderator is the path source or target)', () => {
    expect(() => buildModel(constructs, paths, false, rNameOf, [{ id: 1, moderatorId: 1, pathIndex: 0 }])).toThrow(/source or target/)
  })
  it('rejects a duplicate moderation (same moderator, same path)', () => {
    const mods = [{ id: 1, moderatorId: 2, pathIndex: 0 }, { id: 2, moderatorId: 2, pathIndex: 0 }]
    expect(() => buildModel(constructs, paths, false, rNameOf, mods)).toThrow(/Duplicate moderation/)
  })
  it('rejects moderation in path-analysis (observed-only) mode', () => {
    expect(() => buildModel(constructs, paths, true, rNameOf, [{ id: 1, moderatorId: 2, pathIndex: 0 }])).toThrow(/path-analysis/)
  })
  it('matched (equal counts) product-indicator names follow semTools var1[i].var2[i]', () => {
    const { model, moderationDefs } = buildModel(constructs, paths, false, rNameOf, [{ id: 1, moderatorId: 2, pathIndex: 0 }])
    expect(model).toContain('INT_1 =~ sn1.ta1 + sn2.ta2 + sn3.ta3 + sn4.ta4')
    expect(model).toContain('TI ~ p_1_3*SN + pmod_1*TA + pint_1*INT_1')
    expect(moderationDefs[0].matched).toBe(true)
  })
  it('unequal counts use match=FALSE all-pairs naming (var1[i].var2[j])', () => {
    const ta3: Construct[] = [
      { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
      { id: 2, name: 'TA3', items: ['ta1', 'ta2', 'ta3'] },
      { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
    ]
    const { model, moderationDefs } = buildModel(ta3, paths, false, rNameOf, [{ id: 1, moderatorId: 2, pathIndex: 0 }])
    expect(model).toContain(
      'INT_1 =~ sn1.ta1 + sn1.ta2 + sn1.ta3 + sn2.ta1 + sn2.ta2 + sn2.ta3 + sn3.ta1 + sn3.ta2 + sn3.ta3 + sn4.ta1 + sn4.ta2 + sn4.ta3',
    )
    expect(moderationDefs[0].matched).toBe(false)
  })
  it('no moderations is a no-op (existing 47 tests keep passing unmodified)', () => {
    const { model, moderationDefs } = buildModel(constructs, paths, false, rNameOf)
    expect(model).not.toContain('INT_')
    expect(moderationDefs).toEqual([])
  })
  it('emits the := simple-slope definitions (production design, not the hand-rolled spike variant)', () => {
    const { model } = buildModel(constructs, paths, false, rNameOf, [{ id: 1, moderatorId: 2, pathIndex: 0 }])
    expect(model).toContain('TA ~~ vmod_1*TA')
    expect(model).toContain('slope_lo_1  := p_1_3 - pint_1*sqrt(vmod_1)')
    expect(model).toContain('slope_mid_1 := p_1_3')
    expect(model).toContain('slope_hi_1  := p_1_3 + pint_1*sqrt(vmod_1)')
  })
})

describe('runCbSem — moderation row/slope count invariant (pure, mocked engine, no WebR)', () => {
  // A requested moderation must never silently vanish: the runner throws rather than returning a
  // partial/short moderation result if the R side's row counts ever drift from what TS asked for
  // (U2-T6 reviewer-recommended guard). Engine is faked here so this is a fast pure unit test --
  // the real R-side behaviour (mod_rows always length(mod_ids); slope_rows dropped only on a `:=`
  // label miss) is exercised end-to-end by runCbSem.moderation.integration.test.ts.
  const items = { sn: ['sn1', 'sn2', 'sn3', 'sn4'], ta: ['ta1', 'ta2', 'ta3', 'ta4'], ti: ['ti1', 'ti2', 'ti3'] }
  const data: Dataset = {
    columns: [...items.sn, ...items.ta, ...items.ti],
    rows: Array.from({ length: 10 }, (_, i) =>
      Object.fromEntries([...items.sn, ...items.ta, ...items.ti].map((c, j) => [c, i + j + 1])),
    ),
  }
  const setup: TestSetup = {
    roles: {}, options: { estimator: 'ML', nboot: 500, ciType: 'percentile' }, props: {}, blocked: null,
    modelKind: 'latent',
    constructs: [
      { id: 1, name: 'SN', items: items.sn },
      { id: 2, name: 'TA', items: items.ta },
      { id: 3, name: 'TI', items: items.ti },
    ],
    paths: [{ from: 1, to: 3 }],
    moderations: [{ id: 1, moderatorId: 2, pathIndex: 0 }],
  }
  const validModRow = { id: 1, b: 0.1, se: 0.1, z: 1, p: 0.3, stdBeta: 0.1, ciPercLower: -0.1, ciPercUpper: 0.3, ciBcLower: -0.1, ciBcUpper: 0.3 }
  const validSlopeRow = (level: 'lo' | 'mid' | 'hi') => ({
    modId: 1, level, est: 0.1, se: 0.1, z: 1, p: 0.3, ciPercLower: -0.1, ciPercUpper: 0.3, ciBcLower: -0.1, ciBcUpper: 0.3,
  })
  const cfaResult = {
    perConstruct: [
      { name: 'SN', ave: 0.6, cr: 0.8, omega: 0.8, alpha: 0.8 },
      { name: 'TA', ave: 0.6, cr: 0.8, omega: 0.8, alpha: 0.8 },
      { name: 'TI', ave: 0.6, cr: 0.8, omega: 0.8, alpha: 0.8 },
    ],
    fornellLarcker: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    htmt: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
    labels: ['SN', 'TA', 'TI'],
    corLvP: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  }

  /** Fakes the two engine.runJson round-trips runCbSem makes in latent mode: the main R_STATS
   *  block (first call, returns `mainStats`), then runCfaReliability's own block (second call,
   *  always well-formed so only the FIRST call's shape is under test). */
  function fakeEngine(mainStats: Record<string, unknown>): Engine {
    const runJson = vi.fn()
      .mockResolvedValueOnce(mainStats)
      .mockResolvedValueOnce(cfaResult)
    return { runJson } as unknown as Engine
  }

  const baseRaw = {
    fit: {}, df: 1, cfaLoadings: [], structural: [], rsquareIds: { 3: 0.4 }, indirect: [],
    estLoadings: {}, estPaths: [],
  }

  it('RED-then-fixed: throws when moderationRows is missing the requested moderation entirely', async () => {
    const engine = fakeEngine({ ...baseRaw, moderationRows: [], slopeRows: [validSlopeRow('lo'), validSlopeRow('mid'), validSlopeRow('hi')] })
    await expect(runCbSem(engine, data, setup)).rejects.toThrow(/moderation edge vanished/)
  })

  it('throws when slopeRows is short (a := label lookup silently missed one level)', async () => {
    const engine = fakeEngine({ ...baseRaw, moderationRows: [validModRow], slopeRows: [validSlopeRow('lo'), validSlopeRow('mid')] })
    await expect(runCbSem(engine, data, setup)).rejects.toThrow(/simple-slope row\(s\)/)
  })

  it('happy path: matching counts pass the guard and the moderation result is returned', async () => {
    const engine = fakeEngine({
      ...baseRaw,
      moderationRows: [validModRow],
      slopeRows: [validSlopeRow('lo'), validSlopeRow('mid'), validSlopeRow('hi')],
    })
    const result = await runCbSem(engine, data, setup)
    expect(result.moderation!.rows).toHaveLength(1)
    expect(result.moderation!.slopes).toHaveLength(3)
    // Moderation forces se="bootstrap" -> the result must say so (Table 5 CI-honesty fix round).
    expect(result.bootstrapped).toBe(true)
  })

  // Fix round (Table 5 CI honesty): CbSemResult.bootstrapped mirrors the runner's own needsBootstrap
  // gate (hasIndirect || moderations) — a direct-paths-only model never bootstraps, so the builder must
  // know NOT to render BC cells or claim bootstrap provenance. Mocked engine: this is a TS-plumbing
  // test (flag threading), not a stats test; the true-side of the gate is also asserted for free on the
  // real WebR PoliticalDemocracy run in runCbSem.test.ts.
  it('direct-paths-only (no indirect chain, no moderation) returns bootstrapped: false', async () => {
    const directSetup: TestSetup = { ...setup, moderations: [] }
    const engine = fakeEngine({ ...baseRaw, moderationRows: [], slopeRows: [] })
    const result = await runCbSem(engine, data, directSetup)
    expect(result.bootstrapped).toBe(false)
  })
})

describe('runCbSem — config routing (setup.moderations reaches buildModel; U4-T4 wiring, no WebR)', () => {
  // Proves the config->runner seam end to end WITHOUT a WebR run: capture the env object runCbSem
  // actually hands to engine.runJson and assert it carries buildModel's moderation output (the
  // interaction line + indProd flattening) -- i.e. setup.moderations really did reach buildModel,
  // not just get accepted and dropped. Full-precision math is U2-T6's job
  // (runCbSem.moderation.integration.test.ts); this test is wiring-only.
  const items = { sn: ['sn1', 'sn2', 'sn3', 'sn4'], ta: ['ta1', 'ta2', 'ta3', 'ta4'], ti: ['ti1', 'ti2', 'ti3'] }
  const data: Dataset = {
    columns: [...items.sn, ...items.ta, ...items.ti],
    rows: Array.from({ length: 10 }, (_, i) =>
      Object.fromEntries([...items.sn, ...items.ta, ...items.ti].map((c, j) => [c, i + j + 1])),
    ),
  }
  const setup: TestSetup = {
    roles: {}, options: { estimator: 'ML', nboot: 500, ciType: 'percentile' }, props: {}, blocked: null,
    modelKind: 'latent',
    constructs: [
      { id: 1, name: 'SN', items: items.sn },
      { id: 2, name: 'TA', items: items.ta },
      { id: 3, name: 'TI', items: items.ti },
    ],
    paths: [{ from: 1, to: 3 }],
    moderations: [{ id: 1, moderatorId: 2, pathIndex: 0 }],
  }
  const validModRow = { id: 1, b: 0.1, se: 0.1, z: 1, p: 0.3, stdBeta: 0.1, ciPercLower: -0.1, ciPercUpper: 0.3, ciBcLower: -0.1, ciBcUpper: 0.3 }
  const validSlopeRow = (level: 'lo' | 'mid' | 'hi') => ({
    modId: 1, level, est: 0.1, se: 0.1, z: 1, p: 0.3, ciPercLower: -0.1, ciPercUpper: 0.3, ciBcLower: -0.1, ciBcUpper: 0.3,
  })
  const cfaResult = {
    perConstruct: [
      { name: 'SN', ave: 0.6, cr: 0.8, omega: 0.8, alpha: 0.8 },
      { name: 'TA', ave: 0.6, cr: 0.8, omega: 0.8, alpha: 0.8 },
      { name: 'TI', ave: 0.6, cr: 0.8, omega: 0.8, alpha: 0.8 },
    ],
    fornellLarcker: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    htmt: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
    labels: ['SN', 'TA', 'TI'],
    corLvP: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  }
  const baseRaw = {
    fit: {}, df: 1, cfaLoadings: [], structural: [], rsquareIds: { 3: 0.4 }, indirect: [],
    estLoadings: {}, estPaths: [],
    moderationRows: [validModRow],
    slopeRows: [validSlopeRow('lo'), validSlopeRow('mid'), validSlopeRow('hi')],
  }

  it('the env handed to engine.runJson carries the moderation model text + indProd flattening', async () => {
    const runJson = vi.fn().mockResolvedValueOnce(baseRaw).mockResolvedValueOnce(cfaResult)
    const engine = { runJson } as unknown as Engine
    await runCbSem(engine, data, setup)

    expect(runJson).toHaveBeenCalledTimes(2)
    const [, env] = runJson.mock.calls[0] as [string, Record<string, unknown>]
    // buildModel's interaction line reached the model string sent to R -- proves setup.moderations
    // was not silently dropped between the store and the runner.
    expect(env.model_str).toContain('INT_1 =~ sn1.ta1 + sn2.ta2 + sn3.ta3 + sn4.ta4')
    expect(env.model_str).toContain('slope_lo_1  := p_1_3 - pint_1*sqrt(vmod_1)')
    // moderationIndProdEnv flattening reached the env (not just the model string).
    expect(env.mod_ids).toEqual([1])
    expect(env.mod_var1_flat).toEqual(items.sn)
    // moderation widens the bootstrap gate regardless of any indirect-effect chain (design §A7).
    expect(env.has_indirect).toBe(true)
  })

  it('a moderation-free setup sends NO mod_* env fields (empty-array webR crash guard, moderationModel.ts)', async () => {
    const noModSetup: TestSetup = { ...setup, moderations: [] }
    const runJson = vi.fn()
      .mockResolvedValueOnce({ ...baseRaw, moderationRows: [], slopeRows: [] })
      .mockResolvedValueOnce(cfaResult)
    const engine = { runJson } as unknown as Engine
    await runCbSem(engine, data, noModSetup)
    const [, env] = runJson.mock.calls[0] as [string, Record<string, unknown>]
    expect(env).not.toHaveProperty('mod_ids')
    expect(env.model_str).not.toContain('INT_')
  })
})
