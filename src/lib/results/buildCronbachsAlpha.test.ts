import { describe, it, expect } from 'vitest'
import { buildCronbachsAlpha } from './buildCronbachsAlpha'
import type { CronbachResult } from '../stats/cronbachsAlpha'
import { CRONBACHS_ALPHA } from '../registry/cronbachsAlpha'

// Audit gap (2026-07-06 completeness audit, cronbachs-alpha row): the APA verdict adjective "was high"
// was hardcoded regardless of the rendered omega value -- a low-reliability run still claimed "high".
// The registry template now carries a {verdict} token; the builder must condition it on the run's own
// omega against the card's OWN stated thresholds (howToRead: >= .70 acceptable, >= .80 good).
const base: CronbachResult = {
  omega: 0.95,
  omegaCi: [0.91, 0.97],
  alpha: 0.94,
  stdAlpha: 0.93,
  alphaCi: [0.9, 0.96],
  nItems: 4,
  nCases: 120,
  useStandardizedAlpha: false,
  itemTotal: [],
  figItemTotalPng: undefined,
}

describe('buildCronbachsAlpha - APA verdict adjective conditioned on the live omega (not hardcoded)', () => {
  it('reports "good" when omega >= .80', () => {
    const c = buildCronbachsAlpha(CRONBACHS_ALPHA, { ...base, omega: 0.95 })
    expect(c.apa).toContain('Internal consistency was good')
  })

  it('reports "acceptable" when .70 <= omega < .80', () => {
    const c = buildCronbachsAlpha(CRONBACHS_ALPHA, { ...base, omega: 0.75 })
    expect(c.apa).toContain('Internal consistency was acceptable')
  })

  it('does NOT claim "good" or "high" for a low omega below the card\'s own .70 threshold', () => {
    const c = buildCronbachsAlpha(CRONBACHS_ALPHA, { ...base, omega: 0.42 })
    expect(c.apa).not.toContain('was good')
    expect(c.apa).not.toContain('was high')
    expect(c.apa).toContain('below the conventional .70 threshold')
  })

  it('every {token} in the template resolves to a live value (no literal braces survive)', () => {
    const c = buildCronbachsAlpha(CRONBACHS_ALPHA, base)
    expect(c.apa).not.toMatch(/\{[a-zA-Z]+\}/)
  })
})
