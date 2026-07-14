import { describe, it, expect } from 'vitest'
import { SPECS } from '../../registry/catalog'
import { REPS } from './reps'
import { ALLOWLIST, ALL_SETUPS, SUPPLEMENTAL, sweepA, sweepB, pairKey } from './wiringSweep'

// The wiring sweep, graduated from scripts/wiring-sweep.mts into a permanent test:fast gate (T13/R16,
// board-clearing slice). Both sweeps are pure TS - no WebR, no native R:
//   Sweep B (static): every registry-declared table must be reachable from that test's results builder
//     (the H2/EFA class of defect: a table computed or promised but never rendered).
//   Sweep A (dynamic, emitter-diff): flipping any non-display option must change the emitted analysis.R
//     for at least one alternative (the H1 class: controls wired to nothing).
// The false-positive ledger is ENCODED as wiringSweep.ts's ALLOWLIST with per-entry justifications.
// A NEW suspect fails here naming the (testId, optionId) pair; a STALE allowlist entry (an option that
// became genuinely wired) fails too, so the ledger can never drift from reality in either direction.

describe('wiring sweep (permanent gate, R16)', () => {
  it('sweep B: every registry-declared table is reachable from its builder, all 48 tests', () => {
    expect(sweepB()).toEqual([])
  })

  it('sweep A: every one of the 48 tests has a REP or supplemental setup (coverage)', () => {
    const { covered } = sweepA(ALL_SETUPS)
    const uncovered = Object.keys(SPECS).filter((id) => !covered.has(id))
    expect(uncovered).toEqual([])
    // the two sources stay honest: REPS come from the native-R gate, SUPPLEMENTAL fills the rest
    expect(REPS.length).toBeGreaterThan(0)
    expect(SUPPLEMENTAL.length).toBeGreaterThan(0)
  })

  it('sweep A: every setup emits a baseline analysis.R cleanly', () => {
    expect(sweepA(ALL_SETUPS).failures).toEqual([])
  })

  it('sweep A: every non-display, non-allowlisted option changes the emitted script (a failure here names a NEW suspect)', () => {
    const suspectKeys = [...new Set(sweepA(ALL_SETUPS).suspects.map(pairKey))].sort()
    const allowKeys = new Set(ALLOWLIST.map(pairKey))
    const newSuspects = suspectKeys.filter((k) => !allowKeys.has(k))
    // A pair listed below is an UNWIRED CONTROL: no alternative value changes analysis.R. Either wire it
    // (see T2/T3 for the pattern) or bring an owner-ruled justification to wiringSweep.ts's ALLOWLIST.
    expect(newSuspects).toEqual([])
  })

  it('allowlist has no stale entries: every allowlisted pair is still a real sweep-A suspect', () => {
    const suspectKeys = new Set(sweepA(ALL_SETUPS).suspects.map(pairKey))
    const stale = ALLOWLIST.map(pairKey).filter((k) => !suspectKeys.has(k))
    // A pair listed below became genuinely wired (or its option vanished) - remove it from ALLOWLIST.
    expect(stale).toEqual([])
  })

  it('allowlist contains ONLY the documented false-positive classes (nobody parks a real bug here silently)', () => {
    // no duplicate pairs
    const keys = ALLOWLIST.map(pairKey)
    expect(new Set(keys).size).toBe(keys.length)

    for (const entry of ALLOWLIST) {
      const spec = SPECS[entry.testId]
      expect(spec, `${entry.testId}: unknown testId in allowlist`).toBeDefined()
      const opt = (spec.options ?? []).find((o) => o.id === entry.optionId)
      expect(opt, `${pairKey(entry)}: option not in registry`).toBeDefined()
      switch (entry.reason) {
        case 'runner-wired':
          // alpha only: the app-side runner consumes the significance level (verdict sentences, CI
          // labeling); the emitted script is legitimately level-free (R prints exact p-values).
          expect(entry.optionId, `${pairKey(entry)}: runner-wired class is alpha-only`).toBe('alpha')
          expect(opt!.kind).toBe('number')
          break
        case 'display-wired':
          // reportOR / standardize flip how the CARD presents already-computed quantities; the emitted
          // script always prints both forms, so the option is honestly display-side.
          expect(
            ['logistic-regression::reportOR', 'multiple-linear-regression::standardize'],
            `${pairKey(entry)}: not a documented display-wired pair`,
          ).toContain(pairKey(entry))
          expect(opt!.kind).toBe('toggle')
          break
        case 'retention-gated':
          // nFactors / nComponents only take effect when retention = fixed-n; the REP baselines run
          // retention = parallel, where the count is legitimately ignored.
          expect(
            ['efa::nFactors', 'pca::nComponents'],
            `${pairKey(entry)}: not a documented retention-gated pair`,
          ).toContain(pairKey(entry))
          expect(opt!.kind).toBe('number')
          expect((spec.options ?? []).some((o) => o.id === 'retention' && o.kind === 'select')).toBe(true)
          break
        case 'single-choice':
          // a select with exactly one choice has structurally no alternative to flip to.
          expect(opt!.kind).toBe('select')
          expect((opt!.choices ?? []).length).toBeLessThanOrEqual(1)
          break
        default:
          expect.unreachable(`${pairKey(entry)}: undocumented allowlist reason ${String(entry.reason)}`)
      }
    }

    // The genuinely-wired controls fixed by T1-T3 must NEVER reappear in the ledger:
    // the ci quartet (T2) and the stationarity 'test' selector (T3) are real options now...
    expect(ALLOWLIST.some((e) => e.optionId === 'ci')).toBe(false)
    expect(ALLOWLIST.some((e) => e.testId === 'stationarity-tests' && e.optionId === 'test')).toBe(false)
    // ...and the EFA stage tables (T1) are table-reachability facts: sweep B has NO allowlist at all,
    // so its zero-findings assertion above is unconditional.
  })
})
