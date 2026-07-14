import { describe, it, expect } from 'vitest'
import { PATH_ANALYSIS } from './pathAnalysis'
import { CATALOG, SPECS } from './catalog'
import { RUNNERS, BUILDERS } from '../results/builders'
import { gateOk } from '../../state/session'
import type { SessionState } from '../../state/session'

describe('path-analysis - observed-only CB-SEM picker entry', () => {
  it('is a distinct catalog entry under SEM, available', () => {
    const entry = CATALOG.find((c) => c.id === 'path-analysis')
    expect(entry).toBeDefined()
    expect(entry!.status).toBe('available')
    expect(entry!.family).toBe('Latent variable models')
    expect(entry!.subfamily).toBe('Structural equation modeling')
  })

  it('routes through the canvas, in path mode, with no construct-slots measurement input', () => {
    expect(PATH_ANALYSIS.id).toBe('path-analysis')
    expect(PATH_ANALYSIS.inputKind).toBe('sem-canvas')
    expect(PATH_ANALYSIS.modelKind).toBe('path')
    // NOT the legacy boolean (migrated away in Unit 2)
    expect((PATH_ANALYSIS as { constructsInput?: unknown }).constructsInput).toBeUndefined()
  })

  it('declares NO measurement/EFA/CFA/reliability/AVE tables (observed-only)', () => {
    const ids = PATH_ANALYSIS.tables.map((t) => t.id)
    expect(ids).not.toContain('cfa-loadings')
    expect(ids).not.toContain('reliability')
    expect(ids).not.toContain('efa-suitability')
    expect(ids).not.toContain('efa-loadings')
    expect(ids).toContain('structural-paths')
    expect(ids).toContain('indirect-effects')
  })

  it('bundle files omit measurement PNGs, include the (conditional) fit-indices table, and keep the path diagram', () => {
    expect(PATH_ANALYSIS.bundleFiles).toEqual([
      'table_fit-indices.png (when df > 0)',
      'table_structural-paths.png',
      'table_indirect-effects.png',
      'figure_path-diagram.png',
    ])
  })

  it('is registered + wired to the reused CB-SEM runner/builder', () => {
    expect(SPECS['path-analysis']).toBe(PATH_ANALYSIS)
    expect(RUNNERS['path-analysis']).toBeTypeOf('function')
    expect(BUILDERS['path-analysis']).toBeTypeOf('function')
  })

  it('gateOk relaxes the >=2-items rule in path mode: >=2 PLACED columns + >=1 path is enough', () => {
    // P2 shelf model: path mode derives nodes from setup.placed (the connected SemCanvas draws them by
    // index, in placement order), so the gate checks placed-columns + >=1 path - NOT constructs (the
    // construct-slots form is hidden in path mode) and NOT the used-columns set (placement is opt-in,
    // independent of `used`). Paths address nodes by their numeric index, matching runCbSem's seed.
    const col = (name: string, used = true) =>
      ({ name, detected: 'float64' as const, tags: [] as never[], level: 'ratio' as const, used })
    const base = {
      selection: ['path-analysis'],
      columns: [col('x1'), col('x4'), col('x7')],
      setups: {
        'path-analysis': {
          roles: {}, options: {}, props: {}, blocked: null,
          modelKind: 'path' as const,
          constructs: [],   // irrelevant to path-mode gating: nodes come from placed, not the form
          placed: ['x1', 'x4', 'x7'],
          paths: [{ from: 0, to: 1 }, { from: 1, to: 2 }],
        },
      },
    } as unknown as SessionState

    expect(gateOk(base, 'test:path-analysis')).toBe(true)

    const noPaths = {
      ...base,
      setups: { 'path-analysis': { ...base.setups['path-analysis'], paths: [] } },
    } as unknown as SessionState
    expect(gateOk(noPaths, 'test:path-analysis')).toBe(false)

    // <2 placed columns can't form a model -> gate fails even with a path drawn (used-columns no longer count)
    const oneCol = {
      ...base,
      setups: { 'path-analysis': { ...base.setups['path-analysis'], placed: ['x1'] } },
    } as unknown as SessionState
    expect(gateOk(oneCol, 'test:path-analysis')).toBe(false)
  })
})

// T11/R13 (board-clearing slice): consistency pins for the owner-visible registry strings. Every other
// SEM-family card pins these against its spec twin (docs/specs/telos_test_outputs.html), but the twin
// has NO path-analysis card (path analysis was added post-twin as a picker entry that reuses the CB-SEM
// output card, and the twin is byte-pinned read-only), so these are SELF-REFERENTIAL pins against
// literal expected strings - same drift protection, no twin to compare to. A deliberate wording change
// updates the literal here in the same commit (the point: silent drift fails loudly, on the exact string).
describe('path-analysis - owner-visible string pins (self-referential; the spec twin has no path-analysis card)', () => {
  it('options are pinned: three display-only entries (ids/labels/values/kind)', () => {
    expect(PATH_ANALYSIS.options).toEqual([
      { id: 'estimator', label: 'estimator', value: 'WLSMV (ordinal) / ML / MLR', kind: 'display' },
      { id: 'missing', label: 'missing', value: 'listwise (default) / FIML / pairwise', kind: 'display' },
      { id: 'bootstrap', label: 'bootstrap resamples', value: '5000', kind: 'display' },
    ])
  })
  it('rMap is pinned verbatim', () => {
    expect(PATH_ANALYSIS.rMap).toBe(
      'lavaan::sem(estimator=, missing=, ordered=) on observed variables (regressions only; no =~) → fit · lavaan::fitMeasures() → Table 1 (fit indices, df > 0 only; suppressed when fitMeasures(fit,"df") == 0, saturated) · standardizedSolution() + lavInspect(fit,"rsquare") → Table 2 (structural paths + R²) · auto := indirect-effect definitions + bootstrap (boot.ci.type="perc", R = 5000) → Table 3 (indirect effects) · semPlot::semPaths() → figure (rectangles = observed)',
    )
  })
  it('table note is pinned verbatim (kind, text, placement)', () => {
    expect(PATH_ANALYSIS.tableNote).toEqual({
      kind: 'plain',
      text: 'Path analysis fits directed relationships among observed variables (lavaan::sem) - no latent measurement model, so no CFA loadings, reliability, or AVE are reported. When the model is saturated (df = 0, e.g. a single-mediator X → M → Y chain), it fits the data perfectly by construction and global fit indices (χ², CFI, TLI, RMSEA, SRMR) are not reported; an over-identified model (df > 0) reports fit, interpreting RMSEA cautiously at small df / small N (Kenny, Kaniskan & McCoach, 2015). Indirect (mediated) effects are tested with bias-uncorrected percentile bootstrap 95% CIs (5,000 resamples; MacKinnon, Lockwood & Williams, 2004); an interval excluding 0 indicates a credible indirect effect.',
      afterTableId: 'indirect-effects',
    })
  })
})
