import { describe, it, expect } from 'vitest'
import { buildShelves, LEVEL_ORDER } from './poolShelves'
import type { ColumnMeta } from '../data/columnMeta'
import type { RoleConstraint } from '../registry/types'
import type { Dataset } from '../stats/types'

const col = (over: Partial<ColumnMeta> & { name: string }): ColumnMeta =>
  ({ detected: 'float64', tags: [], level: 'ratio', used: true, ...over })

// study-style fixture: one column per level + a date + a count
const group = col({ name: 'group', detected: 'object', level: 'nominal' })
const region = col({ name: 'region', detected: 'object', level: 'nominal' })
const rating = col({ name: 'rating', detected: 'int64', level: 'ordinal', tags: ['count'] })
const day = col({ name: 'day', detected: 'datetime64', level: 'interval', tags: ['datetime'] })
const score = col({ name: 'score' })
const arrests = col({ name: 'arrests', detected: 'int64', tags: ['count'] })
const COLS = [group, region, rating, day, score, arrests]

const working: Dataset = { columns: COLS.map((c) => c.name), rows: [
  { group: 'a', region: 'x', rating: 1, day: '2026-01-01', score: 1.5, arrests: 0 },
  { group: 'b', region: 'y', rating: 2, day: '2026-01-02', score: 2.5, arrests: 3 },
  { group: 'a', region: 'z', rating: 2, day: '2026-01-03', score: 3.5, arrests: 1 },
] }

// independent-t-test-shaped roles
const outcome: RoleConstraint = { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } }
const groupRole: RoleConstraint = { roleId: 'group', levels: ['nominal'], arity: { min: 1, max: 1 }, categories: { exact: 2 } }
// time-series-shaped roles
const time: RoleConstraint = { roleId: 'time', levels: [], arity: { min: 1, max: 1 }, timeOrder: true }
const series: RoleConstraint = { roleId: 'series', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, excludeTag: 'datetime' }

const none = new Set<string>()

describe('buildShelves', () => {
  it('returns the four shelves in fixed level order with dataset-order membership', () => {
    const shelves = buildShelves(COLS, [outcome, groupRole], none, working)
    expect(shelves.map((s) => s.level)).toEqual(LEVEL_ORDER)
    expect(shelves[0].chips.map((c) => c.col.name)).toEqual(['group', 'region'])
    expect(shelves[3].chips.map((c) => c.col.name)).toEqual(['score', 'arrests'])
  })

  it('dims a shelf whose level no open slot accepts, with one note and clean chips', () => {
    const shelves = buildShelves(COLS, [outcome, groupRole], none, working)
    const ordinal = shelves[1]
    expect(ordinal.dim).toBe(true)
    expect(ordinal.note).toBe('no open slot takes ordinal')
    expect(ordinal.chips[0].reason).toBeNull() // note replaces the per-chip sentence
  })

  it('keeps a shelf lit when the level fits but a chip fails an individual constraint', () => {
    const shelves = buildShelves(COLS, [outcome, groupRole], none, working)
    const nominal = shelves[0]
    expect(nominal.dim).toBe(false)
    expect(nominal.chips.find((c) => c.col.name === 'group')!.ok).toBe(true)
    const bad = nominal.chips.find((c) => c.col.name === 'region')!
    expect(bad.ok).toBe(false)
    expect(bad.reason).toBe('needs exactly 2 categories')
  })

  it('time-series probe: Time slot lights the ordinal shelf and the date chip; Series rejects the date chip individually', () => {
    const shelves = buildShelves(COLS, [time, series], none, working)
    expect(shelves[1].dim).toBe(false) // ordinal shelf lit via timeOrder
    expect(shelves[1].chips[0].ok).toBe(true)
    const interval = shelves[2]
    expect(interval.dim).toBe(false)
    expect(interval.chips[0].ok).toBe(true) // day fits the Time slot
    const nominal = shelves[0]
    expect(nominal.dim).toBe(true) // neither role takes nominal
  })

  it('assigned chips are marked, non-draggable, reasonless, and ignored by the dim probe', () => {
    const shelves = buildShelves(COLS, [groupRole], new Set(['score']), working)
    const chip = shelves[3].chips.find((c) => c.col.name === 'score')!
    expect(chip.assigned).toBe(true)
    expect(chip.ok).toBe(false)
    expect(chip.reason).toBeNull()
    expect(shelves[3].dim).toBe(true) // ratio shelf still dims on level, assignment does not veto the probe
  })

  it('all slots filled: nothing draggable, no notes, no reasons', () => {
    const shelves = buildShelves(COLS, [], none, working)
    for (const s of shelves) {
      expect(s.dim).toBe(false)
      expect(s.note).toBeNull()
      for (const c of s.chips) { expect(c.ok).toBe(false); expect(c.reason).toBeNull() }
    }
  })

  it('empty shelf: no chips, never dim', () => {
    const shelves = buildShelves([group, score], [outcome, groupRole], none, working)
    expect(shelves[1].chips).toEqual([])
    expect(shelves[1].dim).toBe(false)
    expect(shelves[1].note).toBeNull()
  })

  it('unused columns and level-less columns are excluded', () => {
    const shelves = buildShelves([col({ name: 'dead', used: false }), col({ name: 'noLevel', level: null })], [outcome], none, working)
    expect(shelves.every((s) => s.chips.length === 0)).toBe(true)
  })
})
