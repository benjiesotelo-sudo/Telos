import { describe, it, expect } from 'vitest'
import { categoriesOf, propsArray, propsSumOk, strictlyPositive, defaultEventLevel } from './props'
import type { Dataset } from '../stats/types'

const ds: Dataset = { columns: ['m'], rows: [
  { m: 'lecture' }, { m: 'discussion' }, { m: 'seminar' }, { m: 'lecture' },
  { m: null }, { m: '  ' }, { m: 7 },
] }

describe('props helpers', () => {
  it('categoriesOf: distinct non-empty values, stringified, sorted (R table() order for ASCII)', () => {
    expect(categoriesOf(ds, 'm')).toEqual(['7', 'discussion', 'lecture', 'seminar'])
  })
  it('propsArray: stored value or equal split default', () => {
    expect(propsArray(['a', 'b', 'c'], { b: 0.5 })).toEqual([1 / 3, 0.5, 1 / 3])
  })
  it('propsSumOk: needs ≥2 categories, all > 0, |Σ−1| ≤ 0.001', () => {
    expect(propsSumOk([0.5, 0.3, 0.2])).toBe(true)
    expect(propsSumOk([0.5, 0.2995, 0.2])).toBe(true)  // within tolerance
    expect(propsSumOk([0.5, 0.25, 0.2])).toBe(false)   // sums to .95
    expect(propsSumOk([0.5, 0.5, 0])).toBe(false)      // zero proportion
    expect(propsSumOk([1])).toBe(false)                // one category
  })
})

describe('defaultEventLevel (level-select default, B2)', () => {
  it('picks the SECOND level alphabetically (drawn "passed · second level"; glm models the second factor level)', () => {
    expect(defaultEventLevel(['no', 'yes'])).toBe('yes')
  })
  it('degrades to the only level, then to empty', () => {
    expect(defaultEventLevel(['only'])).toBe('only')
    expect(defaultEventLevel([])).toBe('')
  })
})

describe('strictlyPositive (poisson exposure run gate, design convention 11)', () => {
  const mk = (vals: (number | string | null)[]): Dataset => ({ columns: ['e'], rows: vals.map((v) => ({ e: v })) })
  it('passes when every present value is a positive number (missing rows are listwise territory)', () => {
    expect(strictlyPositive(mk([1, 0.5, null, 12]), 'e')).toBe(true)
  })
  it('fails on zero, negatives, and non-numeric presence', () => {
    expect(strictlyPositive(mk([1, 0]), 'e')).toBe(false)
    expect(strictlyPositive(mk([1, -2]), 'e')).toBe(false)
    expect(strictlyPositive(mk([1, 'soon']), 'e')).toBe(false)
  })
})
