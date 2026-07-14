import { describe, it, expect } from 'vitest'
import { CATALOG } from './catalog'

describe('catalog short names (spec R6)', () => {
  it('every long name carries a compact short', () => {
    // Ceiling raised 18 -> 19 by R10 (board-clearing slice, owner ruling): 'Mult. regression'
    // becomes the full word 'Multiple regression' (19 chars) - the one ruled label sets the bound.
    const offenders = CATALOG.filter((c) => c.name.length > 18 && !(c.short && c.short.length <= 19))
    expect(offenders.map((c) => c.id)).toEqual([])
  })
  it('shorts are never longer than names', () => {
    expect(CATALOG.filter((c) => c.short && c.short.length > c.name.length)).toEqual([])
  })
  it("R10 (owner ruling): multiple-linear-regression's short label is 'Multiple regression', not 'Mult. regression'", () => {
    expect(CATALOG.find((c) => c.id === 'multiple-linear-regression')!.short).toBe('Multiple regression')
  })
})
