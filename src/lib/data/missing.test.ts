import { describe, it, expect } from 'vitest'
import { applyMissingPolicy } from './missing'
import type { Dataset } from '../stats/types'
import type { ColumnMeta } from './columnMeta'

const ds: Dataset = { columns: ['g', 'x'], rows: [
  { g: 'a', x: 1 }, { g: 'a', x: null }, { g: 'b', x: 3 }, { g: null, x: 4 },
] }
const meta: ColumnMeta[] = [
  { name: 'g', detected: 'object', tags: [], level: 'nominal', used: true },
  { name: 'x', detected: 'int64', tags: ['count'], level: 'ratio', used: true },
]

describe('applyMissingPolicy', () => {
  it('leave: passes the dataset through untouched (per-test listwise happens downstream)', () => {
    const r = applyMissingPolicy(ds, meta, 'leave')
    expect(r.dataset).toEqual(ds); expect(r.droppedCount).toBe(0)
  })
  it('drop: removes rows with any missing value in a Used column, and counts them', () => {
    const r = applyMissingPolicy(ds, meta, 'drop')
    expect(r.dataset.rows).toEqual([{ g: 'a', x: 1 }, { g: 'b', x: 3 }]); expect(r.droppedCount).toBe(2)
  })
  it('impute: mean for interval/ratio, mode for nominal/ordinal', () => {
    const r = applyMissingPolicy(ds, meta, 'impute')
    expect(r.dataset.rows[1].x).toBeCloseTo((1 + 3 + 4) / 3, 10) // mean of non-missing x
    expect(r.dataset.rows[3].g).toBe('a')                        // mode of g
    expect(r.droppedCount).toBe(0)
  })
  it('impute ignores unused columns', () => {
    const m2 = meta.map((c) => (c.name === 'x' ? { ...c, used: false } : c))
    const r = applyMissingPolicy(ds, m2, 'impute')
    expect(r.dataset.rows[1].x).toBeNull()
  })
})
