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
