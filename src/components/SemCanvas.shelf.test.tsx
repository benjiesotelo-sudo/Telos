import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SemCanvas } from './SemCanvas'
import type { ColumnMeta } from '../lib/data/columnMeta'
import type { TestSetup } from '../state/session'

// Container-level tests for the P2 shelf model (spec Amendment A, docs/superpowers/specs/
// 2026-07-11-path-mode-wlsmv-design.md): these render the STORE-CONNECTED <SemCanvas> (not the
// pure SemCanvasUI - that's covered exhaustively in SemCanvas.test.tsx), proving the container
// correctly DERIVES shelfColumns/columns(placed)/nodePositions from `useSession` state.
//
// Zustand 5's SSR snapshot (`getInitialState()`) does not reflect a live `setState()` call under
// `renderToStaticMarkup` (this bit ResultsScreen.progress.test.tsx first - see its own comment),
// so, following that established precedent, `useSession` is mocked here to a plain object we
// control directly. The "before"/"after" setups below are HAND-CONSTRUCTED to the exact shape T2's
// store actions (placeColumn/removeColumn/moveNode) are already proven (session.test.tsx) to
// produce - this file's job is proving the CONNECTED COMPONENT renders each shape correctly, not
// re-proving the store mutations themselves.

const TEST_ID = 'path-analysis'
const usedCol = (name: string): ColumnMeta => ({ name, detected: 'float64', tags: [], level: 'ratio', used: true })

const mockState: {
  runStatus: 'idle' | 'running' | 'error'
  columns: ColumnMeta[]
  setups: Record<string, TestSetup>
  runs: Record<string, unknown>
  moveNode: ReturnType<typeof vi.fn>
  placeColumn: ReturnType<typeof vi.fn>
  removeColumn: ReturnType<typeof vi.fn>
  addPath: ReturnType<typeof vi.fn>
  removePath: ReturnType<typeof vi.fn>
  addModeration: ReturnType<typeof vi.fn>
  removeModeration: ReturnType<typeof vi.fn>
} = {
  runStatus: 'idle',
  columns: [],
  setups: {},
  runs: {},
  moveNode: vi.fn(),
  placeColumn: vi.fn(),
  removeColumn: vi.fn(),
  addPath: vi.fn(),
  removePath: vi.fn(),
  addModeration: vi.fn(),
  removeModeration: vi.fn(),
}

vi.mock('../state/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../state/session')>()
  return { ...actual, useSession: () => mockState }
})

function setPath(setup: Partial<TestSetup>, columns = ['educ', 'exper', 'wage']) {
  mockState.columns = columns.map(usedCol)
  mockState.setups = {
    [TEST_ID]: { roles: {}, options: {}, props: {}, blocked: null, modelKind: 'path', placed: [], paths: [], ...setup },
  }
}

describe('SemCanvas (connected) - P2 shelf model container wiring', () => {
  it('empty-start: renders the empty-canvas hint and the FULL shelf (no column placed yet)', () => {
    setPath({ placed: [] })
    const html = renderToStaticMarkup(<SemCanvas testId={TEST_ID} />)
    expect(html).toContain('Your canvas is empty. Add variables from the shelf below, then draw paths between them.')
    expect((html.match(/class="chip"/g) ?? []).length).toBe(3)
    expect(html).toContain('+ educ'); expect(html).toContain('+ exper'); expect(html).toContain('+ wage')
    expect((html.match(/class="sem-node-rect"/g) ?? []).length).toBe(0)
  })

  it('a placed column renders as a node and drops off the shelf', () => {
    setPath({ placed: ['educ'] })
    const html = renderToStaticMarkup(<SemCanvas testId={TEST_ID} />)
    expect((html.match(/class="sem-node-rect"/g) ?? []).length).toBe(1)
    expect(html).toContain('>educ<')
    expect((html.match(/class="chip"/g) ?? []).length).toBe(2)   // exper, wage remain
    expect(html).not.toContain('+ educ')
    expect(html).not.toContain('Your canvas is empty')
  })

  it('after a placeColumn-shaped state change: node appears, chip leaves the shelf (proves the derivation reacts to `placed`)', () => {
    setPath({ placed: ['educ'] })
    const before = renderToStaticMarkup(<SemCanvas testId={TEST_ID} />)
    expect((before.match(/class="sem-node-rect"/g) ?? []).length).toBe(1)

    setPath({ placed: ['educ', 'exper'] })   // == the exact result of placeColumn(TEST_ID, 'exper') per T2
    const after = renderToStaticMarkup(<SemCanvas testId={TEST_ID} />)
    expect((after.match(/class="sem-node-rect"/g) ?? []).length).toBe(2)
    expect(after).toContain('>exper<')
    expect(after).not.toContain('+ exper')
    expect((after.match(/class="chip"/g) ?? []).length).toBe(1)   // only wage left
  })

  it('after a removeColumn-shaped state change: node gone, chip reappears, touching path gone', () => {
    setPath({ placed: ['educ', 'exper', 'wage'], paths: [{ from: 0, to: 2 }, { from: 1, to: 2 }] })
    const before = renderToStaticMarkup(<SemCanvas testId={TEST_ID} />)
    expect((before.match(/class="sem-node-rect"/g) ?? []).length).toBe(3)
    expect((before.match(/class="sem-path"/g) ?? []).length).toBe(2)
    expect((before.match(/class="chip"/g) ?? []).length).toBe(0)

    // == the exact result of removeColumn(TEST_ID, 'educ') per T2's dropPlacedIndices: educ (was
    // index 0) drops, exper/wage remap to 0/1, the educ->wage path drops, exper->wage survives as 0->1.
    setPath({ placed: ['exper', 'wage'], paths: [{ from: 0, to: 1 }] })
    const after = renderToStaticMarkup(<SemCanvas testId={TEST_ID} />)
    expect((after.match(/class="sem-node-rect"/g) ?? []).length).toBe(2)
    expect(after).not.toContain('>educ<')
    expect(after).toContain('+ educ')                     // chip is back on the shelf
    expect((after.match(/class="chip"/g) ?? []).length).toBe(1)
    expect((after.match(/class="sem-path"/g) ?? []).length).toBe(1)
  })

  it('nodePositions threading: a moved node renders at its stored position, not its auto-grid slot; an unmoved sibling is unaffected', () => {
    setPath({ placed: ['educ', 'exper'] })
    const gridHtml = renderToStaticMarkup(<SemCanvas testId={TEST_ID} />)
    const gridIdx1 = gridHtml.match(/class="sem-node-rect" data-node-id="1" x="([^"]+)" y="([^"]+)"/)
    expect(gridIdx1).not.toBeNull()

    setPath({ placed: ['educ', 'exper'], nodePositions: { educ: { x: 42, y: 84 } } })
    const movedHtml = renderToStaticMarkup(<SemCanvas testId={TEST_ID} />)
    expect(movedHtml).toContain('data-node-id="0" x="42" y="84"')
    // the never-moved sibling still lands on its grid slot, unaffected by educ's move
    expect(movedHtml).toContain(`data-node-id="1" x="${gridIdx1![1]}" y="${gridIdx1![2]}"`)
  })

  it('latent mode: no shelf renders in the connected component either (defensive, mirrors the pure-UI guard)', () => {
    mockState.columns = [usedCol('q1'), usedCol('q2')]
    mockState.setups = { 'cb-sem': { roles: {}, options: {}, props: {}, blocked: null, modelKind: 'latent', constructs: [], paths: [] } }
    const html = renderToStaticMarkup(<SemCanvas testId="cb-sem" />)
    expect(html).not.toContain('class="chip"')
  })
})
