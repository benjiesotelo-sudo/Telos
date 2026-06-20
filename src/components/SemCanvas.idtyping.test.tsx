import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SemCanvasUI, nodesOf } from './SemCanvas'
import { useSession } from '../state/session'
import type { Construct, StructuralPath } from '../state/session'
import type { ColumnMeta } from '../lib/data/columnMeta'

const numericCol = (name: string): ColumnMeta => ({ name, detected: 'float64', tags: [], level: 'ratio', used: true })
const C = (id: number, name: string, items: string[]): Construct => ({ id, name, items, x: 60, y: 100 })

describe('SemCanvas — numeric id typing (regression: no string/number === mismatch)', () => {
  it('Construct.id and StructuralPath.from/to are number-typed and match by ===', () => {
    const constructs = [C(1, 'A', ['q1', 'q2']), C(2, 'B', ['q3', 'q4'])]
    const paths: StructuralPath[] = [{ from: 1, to: 2 }]
    // a path resolves to its endpoint nodes by strict === on numeric ids
    const nodes = nodesOf({ constructs, columns: [], modelKind: 'latent' })
    const from = nodes.find((n) => n.id === paths[0].from)
    const to = nodes.find((n) => n.id === paths[0].to)
    expect(typeof from!.id).toBe('number')
    expect(typeof to!.id).toBe('number')
    // Node.name is the display label (Node.label does not exist — use .name)
    expect(from!.name).toBe('A')
    expect(to!.name).toBe('B')
  })

  it('data-node-id renders the raw numeric value (not a quoted string literal in JSX semantics)', () => {
    const html = renderToStaticMarkup(
      <SemCanvasUI
        testId="t"
        constructs={[C(7, 'Lat', ['q1', 'q2'])]} columns={[]} paths={[]}
        modelKind="latent" mode="draw" estimates={null} running={false}
        onAddPath={() => {}} onRemovePath={() => {}} onMoveNode={() => {}} onSetMode={() => {}}
      />,
    )
    expect(html).toContain('data-node-id="7"')
  })

  it('addConstruct assigns a fresh monotonic NUMERIC id (Unit-2 migration)', () => {
    useSession.getState().reset()
    useSession.setState({ selection: ['cb-sem'], columns: [numericCol('q1')], setups: { 'cb-sem': { roles: {}, options: {}, props: {}, blocked: null, constructs: [] } } })
    useSession.getState().addConstruct('cb-sem')
    useSession.getState().addConstruct('cb-sem')
    const ids = (useSession.getState().setups['cb-sem'].constructs ?? []).map((c) => c.id)
    expect(ids.every((id) => typeof id === 'number')).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)   // unique
    expect(ids[1]).toBeGreaterThan(ids[0])        // monotonic
  })

  it('a path added with the same numeric id from both store and render resolves identically', () => {
    useSession.getState().reset()
    useSession.setState({ selection: ['cb-sem'], columns: [numericCol('q1'), numericCol('q2'), numericCol('q3'), numericCol('q4')],
      setups: { 'cb-sem': { roles: {}, options: {}, props: {}, blocked: null, modelKind: 'latent',
        constructs: [C(1, 'A', ['q1', 'q2']), C(2, 'B', ['q3', 'q4'])], paths: [] } } })
    useSession.getState().addPath('cb-sem', 1, 2)
    const p = useSession.getState().setups['cb-sem'].paths![0]
    expect(typeof p.from).toBe('number')
    expect(typeof p.to).toBe('number')
    // string lookups must NOT match (proves we never coerced to string keys)
    const cs = useSession.getState().setups['cb-sem'].constructs!
    // @ts-expect-error — deliberate wrong-type lookup to prove ids are numbers, not strings
    expect(cs.find((c) => c.id === '1')).toBeUndefined()
  })
})
