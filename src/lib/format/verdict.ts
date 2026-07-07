// Cross-cutting assumption-verdict-sentence device (2026-07-06 completeness audit, item V): every
// parametric card's assumption-check note appends a plain-language, p-threshold-based verdict onto the
// computed statistics -- met OR violated, never a bare number left to the reader's own judgment.
// Design ruling (design §4.4, precedented by buildOneWayAnova's original Levene clause): SUGGEST an
// alternative when violated, never auto-switch the test. `alpha` is the run's own significance
// threshold (not a hardcoded .05), so the verdict always agrees with the card's own APA "below/at or
// above alpha" language elsewhere.
export function verdictClause(p: number | null | undefined, alpha: number, metText: string, violatedText: string): string {
  if (p == null || !Number.isFinite(p)) return ''
  return p < alpha ? ` — ${violatedText}` : ` — ${metText}`
}

// Same device, keyed off a precomputed boolean — for checks spanning several rows/terms (e.g. ANCOVA's
// per-covariate homogeneity-of-slopes check, one row per covariate) where a single p doesn't exist.
export function verdictFromBoolean(violated: boolean, metText: string, violatedText: string): string {
  return ` — ${violated ? violatedText : metText}`
}
