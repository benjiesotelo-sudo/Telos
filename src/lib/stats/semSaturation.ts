/**
 * The ONE shared saturation predicate (design §3.6, §5.1). A model is saturated iff lavaan reports df==0,
 * in which case the fit table is suppressed (perfect, uninformative fit) and a saturation flag is emitted.
 * The builder, the latent.ts emitter, and the runs-in-r gate ALL call this so screen/export/native agree.
 * Keyed strictly on df, NOT on recursiveness.
 *
 * Accepts a raw number (from runCbSem: isSaturated(raw.df)), a CbSemResult/fit-block shape
 * (from buildCbSem: isSaturated(result)), or undefined — so both existing callers work without change.
 * IMPORTANT: the number path guards df===0 FIRST — `!0` is truthy, so an absent-check before the
 * number path would wrongly return false for the saturated case.
 */

/** Anything carrying a model df: a CbSemResult, its fit block, or a bare { df }. */
export interface SaturationInput {
  df?: number
  fit?: { df?: number } & Record<string, unknown>
}

/** TRUE iff the model is saturated: fitMeasures(fit,'df') == 0. Absent/NaN/non-number → false. */
export function isSaturated(input: number | SaturationInput | undefined): boolean {
  // Guard the number path first — !0 is truthy, so we cannot do `if (!input)` before this check.
  if (typeof input === 'number') return Number.isFinite(input) && input === 0

  if (input == null) return false
  // SaturationInput: try .df then .fit.df
  if (typeof input.df === 'number') return Number.isFinite(input.df) && input.df === 0
  if (input.fit != null && typeof input.fit.df === 'number') {
    return Number.isFinite(input.fit.df) && input.fit.df === 0
  }
  return false
}

/** The identical predicate as an R expression, for analysis.R (keyed on the same fitMeasures df). */
export const R_SATURATED_PREDICATE = `as.numeric(lavaan::fitMeasures(fit, "df")) == 0`
