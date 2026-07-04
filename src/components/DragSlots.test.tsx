import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SPECS } from '../lib/registry/catalog'
import { buildShelves } from '../lib/eligibility/poolShelves'
import { DragSlotsUI } from './DragSlots'
import type { TestSpec } from '../lib/registry/types'
import type { ColumnMeta } from '../lib/data/columnMeta'
import type { Dataset } from '../lib/stats/types'

// Hand-built fixtures (poolShelves.test.ts idiom): the connected DragSlots wrapper reads the zustand
// store, whose SSR snapshot is frozen at the initial state under renderToStaticMarkup — so the unit
// tests target the props-based DragSlotsUI, same split as ConstructSlots/SemConfig.
const col = (over: Partial<ColumnMeta> & { name: string }): ColumnMeta =>
  ({ detected: 'float64', tags: [], level: 'ratio', used: true, ...over })

// one column per level + a date + a count + a 3-category nominal that fails group's exact-2
const COLS: ColumnMeta[] = [
  col({ name: 'group', detected: 'object', level: 'nominal' }),
  col({ name: 'region', detected: 'object', level: 'nominal' }),
  col({ name: 'rating', detected: 'int64', level: 'ordinal', tags: ['count'] }),
  col({ name: 'day', detected: 'datetime64', level: 'interval', tags: ['datetime'] }),
  col({ name: 'score' }),
  col({ name: 'arrests', detected: 'int64', tags: ['count'] }),
]

const working: Dataset = { columns: COLS.map((c) => c.name), rows: [
  { group: 'a', region: 'x', rating: 1, day: '2026-01-01', score: 1.5, arrests: 0 },
  { group: 'b', region: 'y', rating: 2, day: '2026-01-02', score: 2.5, arrests: 3 },
  { group: 'a', region: 'z', rating: 2, day: '2026-01-03', score: 3.5, arrests: 1 },
] }

const T_TEST = SPECS['independent-t-test']
const ONE_SAMPLE = SPECS['one-sample-t-test']
const noop = () => {}

const emptyRoles = (spec: TestSpec) => Object.fromEntries(spec.constraints.roles.map((r) => [r.roleId, [] as string[]]))
const openRoles = (spec: TestSpec, roles: Record<string, string[]>) =>
  spec.constraints.roles.filter((r) => (roles[r.roleId] ?? []).length < r.arity.max)

function render(spec: TestSpec, opts: { columns?: ColumnMeta[]; roles?: Record<string, string[]> } = {}) {
  const roles = opts.roles ?? emptyRoles(spec)
  const assigned = new Set(Object.values(roles).flat())
  const shelves = buildShelves(opts.columns ?? COLS, openRoles(spec, roles), assigned, working)
  return renderToStaticMarkup(<DragSlotsUI spec={spec} shelves={shelves} roles={roles} onDrop={noop} onRemove={noop} />)
}

describe('DragSlotsUI grouped pool', () => {
  it('renders the four shelves in fixed order with counts', () => {
    const html = render(T_TEST)
    // shelf-head renders as `<div class="shelf-head">nominal <span class="count">…` — match the `>level <` prefix
    const order = ['nominal', 'ordinal', 'interval', 'ratio'].map((l) => html.indexOf(`>${l} <`))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('dims the ordinal shelf with one note and no per-chip sentence', () => {
    // one-sample t-test's only role takes interval/ratio → the ordinal shelf dims as a whole
    const html = render(ONE_SAMPLE)
    expect(html).toContain('no open slot takes ordinal')
    expect(html).not.toContain('needs an interval / ratio column') // the old per-chip noise is gone
  })

  it('keeps nominal lit and dims only the 3-category chip with its own reason', () => {
    const html = render(T_TEST)
    expect(html).toContain('needs exactly 2 categories')
    expect(html).not.toContain('no open slot takes nominal')
  })

  it('renders date and count badges', () => {
    const html = render(T_TEST)
    expect(html).toContain('<span class="tag">date</span>')
    expect(html).toContain('<span class="tag">count</span>')
  })

  it('shows teaching copy on an empty shelf', () => {
    const html = render(T_TEST, { columns: COLS.filter((c) => c.level !== 'ordinal') }) // no ordinal member
    expect(html).toContain('No ordinal columns yet.')
  })

  it('marks an assigned chip in the pool (slot copy + pool copy)', () => {
    expect(render(T_TEST).match(/chip assigned/g) ?? []).toHaveLength(0)
    const html = render(T_TEST, { roles: { outcome: ['score'], group: [] } })
    expect(html.match(/chip assigned/g)).toHaveLength(2)
  })
})
