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
