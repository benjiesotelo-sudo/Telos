import { describe, it, expect } from 'vitest'
import { isSaturated, R_SATURATED_PREDICATE } from './semSaturation'

describe('isSaturated — the single df==0 saturation predicate', () => {
  it('is true exactly when fit.df == 0 (object with .df)', () => {
    expect(isSaturated({ df: 0 })).toBe(true)
    expect(isSaturated({ df: 0.0 })).toBe(true)
  })

  it('is false for any positive df (over-identified)', () => {
    expect(isSaturated({ df: 1 })).toBe(false)
    expect(isSaturated({ df: 24 })).toBe(false)
  })

  it('is false for negative df (under-identified) — strictly keyed on == 0', () => {
    expect(isSaturated({ df: -3 })).toBe(false)
  })

  it('is false when fit/df is absent (path-mode with no fit, or non-numeric)', () => {
    expect(isSaturated(undefined)).toBe(false)
    expect(isSaturated({})).toBe(false)
    expect(isSaturated({ df: NaN })).toBe(false)
  })

  it('accepts a CbSemResult and reads its fit.df', () => {
    expect(isSaturated({ fit: { df: 0 } })).toBe(true)
    expect(isSaturated({ fit: { df: 5 } })).toBe(false)
  })

  it('exposes the R-side predicate string keyed on fitMeasures(fit, "df")', () => {
    expect(R_SATURATED_PREDICATE).toBe(`as.numeric(lavaan::fitMeasures(fit, "df")) == 0`)
  })

  // Number path — guards the falsy-zero bug: !0 is truthy, so a naive `if (!input)` guard
  // would return false for isSaturated(0), which is the saturated case. This must be true.
  it('accepts a raw number — isSaturated(0) is true, isSaturated(41) is false', () => {
    expect(isSaturated(0)).toBe(true)
    expect(isSaturated(41)).toBe(false)
    expect(isSaturated(-1)).toBe(false)
    expect(isSaturated(NaN)).toBe(false)
  })
})
