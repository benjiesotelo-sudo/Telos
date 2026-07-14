// src/components/SemControls.pathmode.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SemControls } from './SemControls'
import type { ColumnMeta } from '../lib/data/columnMeta'
import type { TestSetup } from '../state/session'

// Container-level tests for path-mode WLSMV enablement (Amendment B, spec 2026-07-11-path-mode-
// wlsmv-design.md): these render the STORE-CONNECTED <SemControls> (not the pure SemControlsUI -
// that's covered in SemControls.test.tsx), proving the container correctly DERIVES
// hasOrdinalIndicator/hasPlacedOrdinal from `useSession` state (setup.placed/paths + s.columns),
// per the same mocking precedent as SemCanvas.shelf.test.tsx.

const TEST_ID = 'path-analysis'
const col = (name: string, level: ColumnMeta['level']): ColumnMeta =>
  ({ name, detected: 'float64', tags: [], level, used: true })

const mockState: {
  runStatus: 'idle' | 'running' | 'error'
  missingPolicy: string
  columns: ColumnMeta[]
  setups: Record<string, TestSetup>
  setOption: ReturnType<typeof vi.fn>
} = {
  runStatus: 'idle',
  missingPolicy: 'leave',
  columns: [],
  setups: {},
  setOption: vi.fn(),
}

vi.mock('../state/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../state/session')>()
  return { ...actual, useSession: () => mockState }
})

function setPath(setup: Partial<TestSetup>, columns: ColumnMeta[]) {
  mockState.columns = columns
  mockState.setups = {
    [TEST_ID]: { roles: {}, options: {}, props: {}, blocked: null, modelKind: 'path', placed: [], paths: [], ...setup },
  }
}

function render() {
  return renderToStaticMarkup(<SemControls testId={TEST_ID} />)
}

describe('SemControls (connected) - path-mode WLSMV enablement (Amendment B)', () => {
  it('ordinal placed + endogenous (a path points into it): WLSMV enabled', () => {
    setPath(
      // a1 is index 0; the path's `to: 0` points INTO a1, making it endogenous
      { placed: ['a1', 'cont2'], paths: [{ from: 1, to: 0 }] },
      [col('a1', 'ordinal'), col('cont2', 'interval')]
    )
    const html = render()
    expect(html).not.toContain('value="WLSMV" disabled=""')
  })

  it('ordinal placed but exogenous only (no path points into it): WLSMV disabled, endogeneity hint', () => {
    setPath(
      // a1 (index 0) is the SOURCE (`from`), never a `to` target -> exogenous only
      { placed: ['a1', 'cont2'], paths: [{ from: 0, to: 1 }] },
      [col('a1', 'ordinal'), col('cont2', 'interval')]
    )
    const html = render()
    expect(html).toContain('value="WLSMV" disabled=""')
    expect(html).toContain(
      'WLSMV applies ordered-threshold modeling to ordinal outcome variables; draw a path into an ordinal variable to enable it.'
    )
  })

  it('no ordinal column placed at all: WLSMV disabled, adapted all-scale hint', () => {
    setPath(
      { placed: ['cont1', 'cont2'], paths: [{ from: 0, to: 1 }] },
      [col('cont1', 'interval'), col('cont2', 'interval'), col('a1', 'ordinal')] // a1 exists but is NOT placed
    )
    const html = render()
    expect(html).toContain('value="WLSMV" disabled=""')
    expect(html).toContain(
      'WLSMV needs at least one ordinal variable on the canvas; all your placed variables are scale-level - use ML or MLR.'
    )
  })

  it('no paths drawn at all: an ordinal placed column has no `to` pointing at it -> still exogenous-only, disabled with the endogeneity hint', () => {
    setPath(
      { placed: ['a1', 'cont2'], paths: [] },
      [col('a1', 'ordinal'), col('cont2', 'interval')]
    )
    const html = render()
    expect(html).toContain('value="WLSMV" disabled=""')
    expect(html).toContain(
      'WLSMV applies ordered-threshold modeling to ordinal outcome variables; draw a path into an ordinal variable to enable it.'
    )
  })

  it('is DYNAMIC with drawing: drawing a path into the ordinal column flips it from disabled to enabled', () => {
    const columns = [col('a1', 'ordinal'), col('cont2', 'interval')]
    setPath({ placed: ['a1', 'cont2'], paths: [] }, columns)
    const before = render()
    expect(before).toContain('value="WLSMV" disabled=""')

    // == the result of addPath(TEST_ID, { from: 1, to: 0 }): a path now points INTO a1 (index 0)
    setPath({ placed: ['a1', 'cont2'], paths: [{ from: 1, to: 0 }] }, columns)
    const after = render()
    expect(after).not.toContain('value="WLSMV" disabled=""')
  })

  it('is DYNAMIC with drawing: removing the only endogenous-making path flips it back to disabled', () => {
    const columns = [col('a1', 'ordinal'), col('cont2', 'interval')]
    setPath({ placed: ['a1', 'cont2'], paths: [{ from: 1, to: 0 }] }, columns)
    const before = render()
    expect(before).not.toContain('value="WLSMV" disabled=""')

    // == the result of removePath(TEST_ID, 0)
    setPath({ placed: ['a1', 'cont2'], paths: [] }, columns)
    const after = render()
    expect(after).toContain('value="WLSMV" disabled=""')
  })

  it('latent mode is unaffected: hasOrdinalIndicator still derives from setup.constructs, not placed/paths', () => {
    mockState.columns = [col('q1', 'ordinal'), col('q2', 'interval')]
    mockState.setups = {
      'cb-sem': {
        roles: {}, options: {}, props: {}, blocked: null, modelKind: 'latent', paths: [],
        constructs: [{ id: 0, name: 'F1', items: ['q1', 'q2'] }],
      },
    }
    const html = renderToStaticMarkup(<SemControls testId="cb-sem" />)
    expect(html).not.toContain('value="WLSMV" disabled=""')
  })

  // R7 (board-clearing slice): the container forwards setup.estimatorFallback (set by the store's
  // revalidated() guard when it auto-reset a stranded WLSMV to ML) so the reset hint renders.
  it('R7: setup.estimatorFallback surfaces the "Estimator reset to ML" hint', () => {
    setPath(
      { placed: ['a1', 'cont2'], paths: [], options: { estimator: 'ML' }, estimatorFallback: true },
      [col('a1', 'ordinal'), col('cont2', 'interval')]
    )
    const html = render()
    expect(html).toContain('Estimator reset to ML: WLSMV needs an ordinal outcome on the canvas')
  })

  it('R7: no fallback flag, no reset hint', () => {
    setPath(
      { placed: ['a1', 'cont2'], paths: [], options: { estimator: 'ML' } },
      [col('a1', 'ordinal'), col('cont2', 'interval')]
    )
    expect(render()).not.toContain('Estimator reset to ML')
  })
})
