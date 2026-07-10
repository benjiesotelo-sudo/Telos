/**
 * The SINGLE source of truth for lavaan `sem()` fit parameterization (estimator + missing-data
 * handling), used by both the WebR runner (runCbSem.ts) and the analysis.R export emitter so
 * export ≡ app. Pure, no WebR dependency - normalizes raw dropdown values, enforces the guards
 * the H1 estimator spike (docs/superpowers/reviews/2026-07-10-h1-estimator-spike.md) proved lavaan
 * itself enforces (hard errors, not warnings), and assembles the exact `sem(model, data, ...)`
 * argument fragment text both call sites splice in verbatim.
 *
 * Valid 7-cell matrix (spike-verified, Q2/Q3): ML x {listwise, fiml, pairwise}, MLR x {listwise,
 * fiml}, WLSMV x {listwise, pairwise}. Every other combination is guarded below.
 */

export type SemEstimator = 'ML' | 'MLR' | 'WLSMV'
export type SemMissing = 'listwise' | 'fiml' | 'pairwise'

export interface SemFitArgsInput {
  estimator: string                       // raw setup.options['estimator'] ?? 'ML'
  missing: string                         // raw setup.options['missing'] ?? CB_SEM_DEFAULT_MISSING
  /** raw (display) indicator/observed column name -> measurement level from Configure-data */
  indicatorLevels: Record<string, 'scale' | 'ordinal' | 'nominal' | string>
  /** raw -> sanitized R token (runCbSem's itemNameOf; identity in the emitter default path) */
  itemNameOf: (raw: string) => string
  hasModeration: boolean
  wantsBootstrap: boolean                 // hasIndirect || hasModeration (the CURRENT needsBootstrap)
}

export interface SemFitArgs {
  estimator: SemEstimator
  missing: SemMissing
  /** lavaan argument fragment WITHOUT leading comma; '' exactly for ML+listwise (the byte-pin) */
  fragment: string
  orderedRaw: string[]                    // raw names, for the card disclosure
  orderedR: string[]                      // sanitized tokens, inside fragment's ordered=c(...)
  bootstrapAllowed: boolean               // estimator === 'ML'
  needsBootstrap: boolean                 // wantsBootstrap && bootstrapAllowed
  ciMethod: 'bootstrap' | 'delta'         // what indirect/moderation CIs actually are
  robustLabels: boolean                   // estimator !== 'ML' -> fit table uses robust/scaled names
  /** true when missing !== 'listwise': the runner must pass FULL rows (with NA) to R */
  passFullRows: boolean
}

const ESTIMATORS = new Set<SemEstimator>(['ML', 'MLR', 'WLSMV'])
const MISSINGS = new Set<SemMissing>(['listwise', 'fiml', 'pairwise'])

/** Estimator-conditional `lavaan::fitMeasures()` request vector, in fixed table order (chisq, df,
 *  pvalue, cfi, tli, rmsea, rmsea.ci.lower, rmsea.ci.upper, srmr). Single source shared by the WebR
 *  runner (runCbSem.ts's fitListBlock) and the export emitter's Table 5 fit-indices block, so an
 *  exported script requests the SAME scaled/robust measures the results card shows - never the naive
 *  unscaled names under a robust estimator (H1 wiring final-review fix, Important I1).
 *
 *  Spike-verified key names (docs/superpowers/reviews/2026-07-10-h1-estimator-spike.md Q1): ML has no
 *  `.scaled`/`.robust` suffixed names at all. MLR exposes BOTH families, populated - this uses
 *  `.robust` for cfi/tli/rmsea (chisq/df/pvalue only ever exist as `.scaled`; lavaan never publishes a
 *  `chisq.robust`). WLSMV's `.robust` keys EXIST but are ALWAYS NA (spike-verified), so WLSMV uses the
 *  `.scaled` family throughout. `robust` flags the non-ML branches for the caller's own labeling
 *  (the runner's `fit_list$robust` flag / the export's display comment) - lavaan's own returned vector
 *  is already named with the requested strings, so a print of it is self-labeling either way. */
export interface FitMeasureNames {
  request: [string, string, string, string, string, string, string, string, string]
  robust: boolean
}

export function semFitMeasureNames(estimator: SemEstimator): FitMeasureNames {
  if (estimator === 'ML') {
    return { request: ['chisq', 'df', 'pvalue', 'cfi', 'tli', 'rmsea', 'rmsea.ci.lower', 'rmsea.ci.upper', 'srmr'], robust: false }
  }
  const s = estimator === 'MLR' ? 'robust' : 'scaled' // WLSMV: .robust keys exist but are always NA (spike Q1)
  return {
    request: [
      'chisq.scaled', 'df.scaled', 'pvalue.scaled', `cfi.${s}`, `tli.${s}`, `rmsea.${s}`,
      `rmsea.ci.lower.${s}`, `rmsea.ci.upper.${s}`, 'srmr',
    ],
    robust: true,
  }
}

export function semFitArgs(input: SemFitArgsInput): SemFitArgs {
  // Normalize: display-era / unknown option values (e.g. the UI's leftover "mi" multiple-imputation
  // option) fall back to the fit's own effective defaults rather than throwing.
  const estimator: SemEstimator = ESTIMATORS.has(input.estimator as SemEstimator)
    ? (input.estimator as SemEstimator)
    : 'ML'
  const missing: SemMissing = MISSINGS.has(input.missing as SemMissing)
    ? (input.missing as SemMissing)
    : 'listwise'

  // Guards (spike-verified: lavaan itself hard-errors on these, not just a UI nicety).
  if (missing === 'fiml' && estimator === 'WLSMV') {
    throw new Error(
      'FIML requires an ML-family estimator (ML or MLR); under WLSMV use pairwise or listwise.',
    )
  }
  if (missing === 'pairwise' && estimator === 'MLR') {
    throw new Error(
      'Pairwise missing data is not supported under MLR (lavaan cannot compute the robust covariance matrix); use FIML or listwise.',
    )
  }
  const orderedRaw = Object.entries(input.indicatorLevels)
    .filter(([, level]) => level === 'ordinal')
    .map(([raw]) => raw)
  if (estimator === 'WLSMV' && orderedRaw.length === 0) {
    throw new Error(
      'WLSMV requires at least one ordinal indicator; all indicators are scale-level - use ML or MLR.',
    )
  }
  if (input.hasModeration && estimator === 'WLSMV') {
    throw new Error(
      'Latent moderation requires an ML-family estimator (ML or MLR); switch off WLSMV or remove the moderation edge.',
    )
  }

  const orderedR = orderedRaw.map(input.itemNameOf)

  const parts: string[] = []
  if (estimator !== 'ML') parts.push(`estimator = "${estimator}"`)
  if (missing !== 'listwise') parts.push(`missing = "${missing === 'fiml' ? 'ml' : missing}"`)
  if (estimator === 'WLSMV') parts.push(`ordered = c(${orderedR.map((r) => `"${r}"`).join(', ')})`)
  const fragment = parts.join(', ')

  const bootstrapAllowed = estimator === 'ML'
  const needsBootstrap = input.wantsBootstrap && bootstrapAllowed

  return {
    estimator,
    missing,
    fragment,
    orderedRaw,
    orderedR,
    bootstrapAllowed,
    needsBootstrap,
    ciMethod: needsBootstrap ? 'bootstrap' : 'delta',
    robustLabels: estimator !== 'ML',
    passFullRows: missing !== 'listwise',
  }
}
