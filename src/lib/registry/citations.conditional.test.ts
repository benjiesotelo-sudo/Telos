// Task 8: conditional method refs (estimator/missing/indirect-CI-method aware). Web-verified refs
// (Yuan-Bentler 2000, Muthen/du Toit/Spisic 1997, Enders-Bandalos 2001, Sobel 1982) attach to the
// cb-sem and path-analysis statistical-basis footer ONLY when the run's options actually earn them.
// A default (untouched) run must behave as ML + listwise: no conditional refs fire.
import { describe, it, expect } from 'vitest'
import type { TestSetup } from '../../state/session'
import { CITATIONS, effectiveStatisticalBasis } from './citations'

const setup = (overrides: Partial<TestSetup> = {}): TestSetup => ({
  roles: {}, options: {}, props: {}, blocked: null, constructs: [], paths: [], moderations: [],
  ...overrides,
})

describe.each(['cb-sem', 'path-analysis'] as const)('effectiveStatisticalBasis(%s)', (id) => {
  it('registry entry declares a conditionalBasis for estimator/missing/indirect-CI refs', () => {
    const c = CITATIONS[id]
    expect(c.conditionalBasis && c.conditionalBasis.length).toBeGreaterThan(0)
  })

  it('a default (untouched) run - no setup at all - fires no conditional refs', () => {
    const basis = effectiveStatisticalBasis(id)
    expect(basis.some((b) => b.ref.text.includes('Yuan'))).toBe(false)
    expect(basis.some((b) => b.ref.text.includes('Muth'))).toBe(false)
    expect(basis.some((b) => b.ref.text.includes('Enders'))).toBe(false)
    expect(basis.some((b) => b.ref.text.includes('Sobel'))).toBe(false)
  })

  it('a default-filled setup (empty options, ML+listwise) fires no conditional refs', () => {
    const basis = effectiveStatisticalBasis(id, setup())
    expect(basis.some((b) => b.ref.text.includes('Yuan'))).toBe(false)
    expect(basis.some((b) => b.ref.text.includes('Muth'))).toBe(false)
    expect(basis.some((b) => b.ref.text.includes('Enders'))).toBe(false)
    expect(basis.some((b) => b.ref.text.includes('Sobel'))).toBe(false)
  })

  it('estimator MLR fires Yuan-Bentler (2000) only, not WLSMV or FIML refs', () => {
    const basis = effectiveStatisticalBasis(id, setup({ options: { estimator: 'MLR' } }))
    expect(basis.some((b) => b.ref.text.includes('Yuan') && b.ref.text.includes('Bentler'))).toBe(true)
    expect(basis.some((b) => b.ref.text.includes('Muth'))).toBe(false)
    expect(basis.some((b) => b.ref.text.includes('Enders'))).toBe(false)
  })

  it('estimator WLSMV fires the Muthen/du Toit/Spisic (1997) source only, not Yuan-Bentler', () => {
    const basis = effectiveStatisticalBasis(id, setup({ options: { estimator: 'WLSMV' } }))
    expect(basis.some((b) => b.ref.text.includes('Muth') && b.ref.text.includes('du Toit') && b.ref.text.includes('Spisic'))).toBe(true)
    expect(basis.some((b) => b.ref.text.includes('Yuan'))).toBe(false)
  })

  it('estimator ML fires neither the MLR nor the WLSMV ref', () => {
    const basis = effectiveStatisticalBasis(id, setup({ options: { estimator: 'ML' } }))
    expect(basis.some((b) => b.ref.text.includes('Yuan'))).toBe(false)
    expect(basis.some((b) => b.ref.text.includes('Muth'))).toBe(false)
  })

  it('missing=fiml fires Enders-Bandalos (2001) only under FIML, not listwise/pairwise', () => {
    const fiml = effectiveStatisticalBasis(id, setup({ options: { missing: 'fiml' } }))
    expect(fiml.some((b) => b.ref.text.includes('Enders') && b.ref.text.includes('Bandalos'))).toBe(true)
    const listwise = effectiveStatisticalBasis(id, setup({ options: { missing: 'listwise' } }))
    expect(listwise.some((b) => b.ref.text.includes('Enders'))).toBe(false)
    const pairwise = effectiveStatisticalBasis(id, setup({ options: { missing: 'pairwise' } }))
    expect(pairwise.some((b) => b.ref.text.includes('Enders'))).toBe(false)
  })

  it('Sobel (1982) fires under MLR + an indirect chain (mediation)', () => {
    const basis = effectiveStatisticalBasis(id, setup({
      options: { estimator: 'MLR' },
      paths: [{ from: 1, to: 2 }, { from: 2, to: 3 }], // 1 -> 2 -> 3, a mediated chain
    }))
    expect(basis.some((b) => b.ref.text.includes('Sobel'))).toBe(true)
  })

  it('Sobel (1982) fires under WLSMV + moderation, even with no indirect chain', () => {
    const basis = effectiveStatisticalBasis(id, setup({
      options: { estimator: 'WLSMV' },
      paths: [{ from: 1, to: 2 }],
      moderations: [{ id: 1, moderatorId: 3, pathIndex: 0 }],
    }))
    expect(basis.some((b) => b.ref.text.includes('Sobel'))).toBe(true)
  })

  it('Sobel (1982) does NOT fire under MLR/WLSMV with no indirect chain and no moderation', () => {
    const basis = effectiveStatisticalBasis(id, setup({
      options: { estimator: 'MLR' },
      paths: [{ from: 1, to: 2 }, { from: 3, to: 4 }], // two disjoint direct paths, no mediator
    }))
    expect(basis.some((b) => b.ref.text.includes('Sobel'))).toBe(false)
  })

  it('Sobel (1982) does NOT fire under ML even with an indirect chain (ML uses bootstrap, not delta)', () => {
    const basis = effectiveStatisticalBasis(id, setup({
      options: { estimator: 'ML' },
      paths: [{ from: 1, to: 2 }, { from: 2, to: 3 }],
    }))
    expect(basis.some((b) => b.ref.text.includes('Sobel'))).toBe(false)
  })

  it('the base statisticalBasis claims are always present, unaffected by options', () => {
    const base = CITATIONS[id].statisticalBasis.map((b) => b.claim)
    const basis = effectiveStatisticalBasis(id, setup({ options: { estimator: 'WLSMV', missing: 'fiml' } }))
    for (const claim of base) expect(basis.some((b) => b.claim === claim)).toBe(true)
  })
})

describe('web-verified ref content (Task 8)', () => {
  it('Yuan-Bentler (2000): Sociological Methodology 30, 165-200, with a doi', () => {
    const basis = effectiveStatisticalBasis('cb-sem', setup({ options: { estimator: 'MLR' } }))
    const ref = basis.find((b) => b.ref.text.includes('Yuan'))!.ref
    expect(ref.authors).toContain('Yuan')
    expect(ref.authors).toContain('Bentler')
    expect(ref.year).toBe('2000')
    expect(ref.source).toContain('Sociological Methodology')
    expect(ref.source).toContain('165-200')
    expect(ref.doi).toBeTruthy()
  })

  it('WLSMV source: Muthen, du Toit & Spisic (1997), honestly cited as an unpublished technical report', () => {
    const basis = effectiveStatisticalBasis('cb-sem', setup({ options: { estimator: 'WLSMV' } }))
    const ref = basis.find((b) => b.ref.text.includes('Muth'))!.ref
    expect(ref.year).toBe('1997')
    expect(ref.source.toLowerCase()).toContain('unpublished')
    expect(ref.source.toLowerCase()).toContain('technical report')
    expect(ref.source).not.toMatch(/Psychometrika/) // not the distinct 1984 Muthen paper
  })

  it('Enders-Bandalos (2001): Structural Equation Modeling 8(3), 430-457, with a doi', () => {
    const basis = effectiveStatisticalBasis('cb-sem', setup({ options: { missing: 'fiml' } }))
    const ref = basis.find((b) => b.ref.text.includes('Enders'))!.ref
    expect(ref.year).toBe('2001')
    expect(ref.source).toContain('8(3)')
    expect(ref.source).toContain('430-457')
    expect(ref.doi).toBeTruthy()
  })

  it('Sobel (1982): Sociological Methodology 13, 290-312, with a doi', () => {
    const basis = effectiveStatisticalBasis('cb-sem', setup({
      options: { estimator: 'MLR' }, paths: [{ from: 1, to: 2 }, { from: 2, to: 3 }],
    }))
    const ref = basis.find((b) => b.ref.text.includes('Sobel'))!.ref
    expect(ref.year).toBe('1982')
    expect(ref.source).toContain('Sociological Methodology')
    expect(ref.source).toContain('290-312')
    expect(ref.doi).toBeTruthy()
  })
})
