import { describe, it, expect } from 'vitest'
import { CATALOG } from './catalog'

describe('catalog short names (spec R6)', () => {
  it('every long name carries a compact short', () => {
    const offenders = CATALOG.filter((c) => c.name.length > 18 && !(c.short && c.short.length <= 18))
    expect(offenders.map((c) => c.id)).toEqual([])
  })
  it('shorts are never longer than names', () => {
    expect(CATALOG.filter((c) => c.short && c.short.length > c.name.length)).toEqual([])
  })
})
