import { describe, it, expect } from 'vitest'
import { CATALOG } from './catalog'
import { CITATIONS } from './citations'

describe('citation registry coverage (A4)', () => {
  it('every catalog id has a citation entry', () => {
    const missing = CATALOG.filter((c) => !CITATIONS[c.id]).map((c) => c.id)
    expect(missing).toEqual([])
  })
  it('every entry has a non-empty whyThisTest and at least one statisticalBasis claim, each with at least one ref', () => {
    const offenders = Object.entries(CITATIONS).filter(([, c]) =>
      !c.whyThisTest.text.trim() || c.whyThisTest.refs.length === 0 ||
      c.statisticalBasis.length === 0 || c.statisticalBasis.some((b) => !b.claim.trim() || !b.ref.text.trim()))
      .map(([id]) => id)
    expect(offenders).toEqual([])
  })
  it('no id in CITATIONS that is not in CATALOG (dead entries)', () => {
    const ids = new Set(CATALOG.map((c) => c.id))
    expect(Object.keys(CITATIONS).filter((id) => !ids.has(id))).toEqual([])
  })
})
