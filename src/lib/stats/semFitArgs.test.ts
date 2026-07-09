import { describe, it, expect } from 'vitest'
import { semFitArgs } from './semFitArgs'

const id = (s: string) => s
const scaleLevels = { x1: 'scale', x2: 'scale' }
const mixedLevels = { a1: 'ordinal', a2: 'ordinal', c1: 'scale' }

describe('semFitArgs', () => {
  it('ML + listwise is the byte-identical empty fragment', () => {
    const r = semFitArgs({ estimator: 'ML', missing: 'listwise', indicatorLevels: scaleLevels, itemNameOf: id, hasModeration: false, wantsBootstrap: true })
    expect(r.fragment).toBe('')
    expect(r.needsBootstrap).toBe(true)
    expect(r.ciMethod).toBe('bootstrap')
    expect(r.robustLabels).toBe(false)
    expect(r.passFullRows).toBe(false)
  })
  it('unknown option values fall back to the defaults (display-era junk must not throw)', () => {
    const r = semFitArgs({ estimator: 'mi', missing: 'mi', indicatorLevels: scaleLevels, itemNameOf: id, hasModeration: false, wantsBootstrap: false })
    expect(r.estimator).toBe('ML'); expect(r.missing).toBe('listwise')
  })
  it('MLR + fiml: fragment exact, bootstrap suppressed, delta CIs', () => {
    const r = semFitArgs({ estimator: 'MLR', missing: 'fiml', indicatorLevels: scaleLevels, itemNameOf: id, hasModeration: false, wantsBootstrap: true })
    expect(r.fragment).toBe('estimator = "MLR", missing = "ml"')
    expect(r.needsBootstrap).toBe(false)
    expect(r.ciMethod).toBe('delta')
    expect(r.robustLabels).toBe(true)
    expect(r.passFullRows).toBe(true)
  })
  it('WLSMV auto-declares only the ordinal indicators, sanitized', () => {
    const r = semFitArgs({ estimator: 'WLSMV', missing: 'pairwise', indicatorLevels: mixedLevels, itemNameOf: (s) => s + '_r', hasModeration: false, wantsBootstrap: false })
    expect(r.fragment).toBe('estimator = "WLSMV", missing = "pairwise", ordered = c("a1_r", "a2_r")')
    expect(r.orderedRaw).toEqual(['a1', 'a2'])
  })
  it('guards: FIML under WLSMV / WLSMV without ordinal / WLSMV under moderation', () => {
    expect(() => semFitArgs({ estimator: 'WLSMV', missing: 'fiml', indicatorLevels: mixedLevels, itemNameOf: id, hasModeration: false, wantsBootstrap: false }))
      .toThrow('FIML requires an ML-family estimator')
    expect(() => semFitArgs({ estimator: 'WLSMV', missing: 'listwise', indicatorLevels: scaleLevels, itemNameOf: id, hasModeration: false, wantsBootstrap: false }))
      .toThrow('at least one ordinal indicator')
    expect(() => semFitArgs({ estimator: 'WLSMV', missing: 'listwise', indicatorLevels: mixedLevels, itemNameOf: id, hasModeration: true, wantsBootstrap: true }))
      .toThrow('Latent moderation requires an ML-family estimator')
  })
  it('guard: pairwise missing is not supported under MLR (lavaan eigen() hard-errors - spike Q2)', () => {
    expect(() => semFitArgs({ estimator: 'MLR', missing: 'pairwise', indicatorLevels: scaleLevels, itemNameOf: id, hasModeration: false, wantsBootstrap: false }))
      .toThrow('Pairwise missing data is not supported under MLR')
  })
  it('the 7-cell valid matrix (spike-verified): ML x {listwise,fiml,pairwise}, MLR x {listwise,fiml}, WLSMV x {listwise,pairwise} all succeed', () => {
    const cells: Array<[string, string, Record<string, string>]> = [
      ['ML', 'listwise', scaleLevels],
      ['ML', 'fiml', scaleLevels],
      ['ML', 'pairwise', scaleLevels],
      ['MLR', 'listwise', scaleLevels],
      ['MLR', 'fiml', scaleLevels],
      ['WLSMV', 'listwise', mixedLevels],
      ['WLSMV', 'pairwise', mixedLevels],
    ]
    for (const [estimator, missing, indicatorLevels] of cells) {
      expect(() => semFitArgs({ estimator, missing, indicatorLevels, itemNameOf: id, hasModeration: false, wantsBootstrap: false })).not.toThrow()
    }
  })
})
