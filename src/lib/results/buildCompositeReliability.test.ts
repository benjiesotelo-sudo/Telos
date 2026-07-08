import { describe, it, expect } from 'vitest'
import { buildCompositeReliability } from './buildCompositeReliability'
import type { CompositeReliabilityResult } from '../stats/compositeReliability'
import { COMPOSITE_RELIABILITY } from '../registry/compositeReliability'

// Audit gap (2026-07-06 completeness audit, composite-reliability row): the template's ".__" placeholder
// was NEVER filled -- the builder returned spec.apaTemplate verbatim. Now a proper {construct}/{verdict}/
// {cr} template, filled from the FIRST construct (the worked-example convention already used by
// multiple-linear-regression's "predictor X" -> real term name).
const base: CompositeReliabilityResult = {
  cfa: {
    perConstruct: [
      { name: 'visual', ave: 0.61, cr: 0.85, omega: 0.85, alpha: 0.8 },
      { name: 'textual', ave: 0.4, cr: 0.55, omega: 0.55, alpha: 0.5 },
    ],
    fornellLarcker: [], htmt: [], labels: ['visual', 'textual'], corLvP: [],
  },
  figReliabilityPng: new Uint8Array(),
}

describe('buildCompositeReliability - APA template filled with the live CR value (worked example = first construct)', () => {
  it('fills construct name and CR value from the FIRST construct, verdict "satisfactory" when CR >= .70', () => {
    const c = buildCompositeReliability(COMPOSITE_RELIABILITY, base)
    expect(c.apa).toBe('Composite reliability for visual was satisfactory (CR = .85 ≥ .70).')
  })

  it('verdict flips to "not satisfactory" when the first construct\'s CR is below .70', () => {
    const belowThreshold: CompositeReliabilityResult = {
      ...base,
      cfa: { ...base.cfa, perConstruct: [base.cfa.perConstruct[1], base.cfa.perConstruct[0]] },
    }
    const c = buildCompositeReliability(COMPOSITE_RELIABILITY, belowThreshold)
    expect(c.apa).toContain('for textual was not satisfactory (CR = .55')
  })

  it('every {token} in the template resolves to a live value (no literal braces, no ".__")', () => {
    const c = buildCompositeReliability(COMPOSITE_RELIABILITY, base)
    expect(c.apa).not.toMatch(/\{[a-zA-Z]+\}/)
    expect(c.apa).not.toContain('.__')
  })
})
