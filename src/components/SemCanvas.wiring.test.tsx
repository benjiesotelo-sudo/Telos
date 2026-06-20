import { describe, it, expect, beforeEach } from 'vitest'
import { useSession } from '../state/session'
import { screenToViewBox } from './SemCanvas'
import type { ColumnMeta } from '../lib/data/columnMeta'

const numericCol = (name: string): ColumnMeta => ({ name, detected: 'float64', tags: [], level: 'ratio', used: true })
const TEST_ID = 'cb-sem'

function seed() {
  useSession.setState({
    selection: [TEST_ID],
    columns: [numericCol('q1'), numericCol('q2'), numericCol('q3'), numericCol('q4')],
    setups: {
      [TEST_ID]: {
        roles: {}, options: {}, props: {}, blocked: null, modelKind: 'latent',
        constructs: [
          { id: 1, name: 'A', items: ['q1', 'q2'], x: 60, y: 100 },
          { id: 2, name: 'B', items: ['q3', 'q4'], x: 300, y: 100 },
        ],
        paths: [],
      },
    },
  })
}

describe('SemCanvas store wiring', () => {
  beforeEach(() => { useSession.getState().reset(); seed() })

  it('addPath records a directed structural path between two construct ids', () => {
    useSession.getState().addPath(TEST_ID, 1, 2)
    expect(useSession.getState().setups[TEST_ID].paths).toEqual([{ from: 1, to: 2 }])
  })

  it('addPath dedupes an already-present directed edge', () => {
    useSession.getState().addPath(TEST_ID, 1, 2)
    useSession.getState().addPath(TEST_ID, 1, 2)
    expect(useSession.getState().setups[TEST_ID].paths).toHaveLength(1)
  })

  it('addPath keeps A→B and B→A as distinct directed edges', () => {
    useSession.getState().addPath(TEST_ID, 1, 2)
    useSession.getState().addPath(TEST_ID, 2, 1)
    expect(useSession.getState().setups[TEST_ID].paths).toEqual([{ from: 1, to: 2 }, { from: 2, to: 1 }])
  })

  it('removePath drops the path at the given index', () => {
    useSession.getState().addPath(TEST_ID, 1, 2)
    useSession.getState().addPath(TEST_ID, 2, 1)
    useSession.getState().removePath(TEST_ID, 0)
    expect(useSession.getState().setups[TEST_ID].paths).toEqual([{ from: 2, to: 1 }])
  })

  it('moveNode updates the matched construct x/y by id (items move with it — they are drawn relative)', () => {
    useSession.getState().moveNode(TEST_ID, 2, 410, 220)
    const c = useSession.getState().setups[TEST_ID].constructs!.find((x) => x.id === 2)!
    expect(c).toMatchObject({ id: 2, x: 410, y: 220 })
    expect(c.items).toEqual(['q3', 'q4'])   // items unchanged → keep their side
  })

  it('setConstructMode flips a construct between reflective and formative by id', () => {
    useSession.getState().setConstructMode(TEST_ID, 1, 'formative')
    expect(useSession.getState().setups[TEST_ID].constructs!.find((x) => x.id === 1)!.mode).toBe('formative')
  })
})

describe('screenToViewBox — drag coordinate mapping', () => {
  const rect = { left: 0, top: 0, width: 720, height: 320 }
  it('maps a screen point to viewBox space at 1:1 (no zoom/pan)', () => {
    const vb = { x: 0, y: 0, w: 720, h: 320 }
    expect(screenToViewBox(360, 160, rect, vb)).toEqual({ x: 360, y: 160 })
  })
  it('scales by the viewBox/rect ratio under zoom-in (vb half the rect)', () => {
    const vb = { x: 100, y: 50, w: 360, h: 160 }   // zoomed 2× in, panned
    // screen centre → viewBox centre = origin + half the viewBox span
    expect(screenToViewBox(360, 160, rect, vb)).toEqual({ x: 100 + 180, y: 50 + 80 })
  })
})
