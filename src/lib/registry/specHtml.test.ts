import { describe, it, expect } from 'vitest'
import { decode } from './specHtml'

describe('decode covers every entity used in the SEM-B output cards', () => {
  it('resolves the PLS reliability + CB-SEM glyphs verbatim', () => {
    expect(decode('Construct &middot; &alpha; &middot; &rho;_A &middot; CR (&rho;_C) &middot; AVE'))
      .toBe('Construct · α · ρ_A · CR (ρ_C) · AVE')
    expect(decode('CR &middot; AVE &middot; &omega; &middot; &alpha;')).toBe('CR · AVE · ω · α')
    expect(decode('&radic;AVE')).toBe('√AVE')
    expect(decode('&chi;&sup2;(df, p) &middot; &chi;&sup2;/df')).toBe('χ²(df, p) · χ²/df')
    expect(decode('R&sup2; &ge; .__ &middot; HTMT < .85')).toBe('R² ≥ .__ · HTMT < .85')
    expect(decode('Construct&rarr;Item')).toBe('Construct→Item')
  })
})
