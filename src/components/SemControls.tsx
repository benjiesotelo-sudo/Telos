// src/components/SemControls.tsx
import { useSession } from '../state/session'
import type { TestSetup } from '../state/session'
import { CB_SEM_DEFAULT_MISSING } from '../lib/stats/runCbSem'

export const BOOTSTRAP_PRESETS = [1000, 5000, 10000] as const

// Spike-calibrated per-resample wall time in WASM (spike 0b): CB-SEM 5k ≈ 2.5 min; PLS 5k ≈ 2.7 min, 10k ≈ 5.4 min.
// Time-based progress (D7) uses this for the elapsed/estimate bar — NOT per-resample counts.
const MIN_PER_5K: Record<'cb-sem' | 'pls-sem', number> = { 'cb-sem': 2.5, 'pls-sem': 2.7 }

/** Spike-calibrated estimate, linear in resamples. Returns minutes. */
export function estBootstrapMinutes(track: 'cb-sem' | 'pls-sem', nboot: number): number {
  return (MIN_PER_5K[track] * nboot) / 5000
}

// CB-SEM missing-data options. `mlOnly` ones are greyed when the estimator is not ML-family (WLSMV).
// `mlrBlocked` (pairwise) is greyed under MLR specifically - lavaan hard-errors MLR + pairwise
// (Task 0 spike, docs/superpowers/reviews/2026-07-10-h1-estimator-spike.md), mirrored here so the
// UI never lets the user reach that thrown guard (semFitArgs.ts) in the first place.
const MISSING_OPTS: Array<{ id: string; label: string; mlOnly: boolean; mlrBlocked?: boolean }> = [
  { id: 'fiml', label: 'FIML (full-information ML)', mlOnly: true },
  { id: 'pairwise', label: 'Pairwise', mlOnly: false, mlrBlocked: true },
  { id: 'listwise', label: 'Listwise deletion', mlOnly: false },
]
export const MISSING_OPTION_IDS = MISSING_OPTS.map((m) => m.id)
const MISSING_OPTION_ID_SET = new Set(MISSING_OPTION_IDS)
const isMlFamily = (estimator: string) => estimator === 'ML' || estimator === 'MLR'
const isMissingDisabled = (m: (typeof MISSING_OPTS)[number], estimator: string) =>
  (m.mlOnly && !isMlFamily(estimator)) || (!!m.mlrBlocked && estimator === 'MLR')

// Step-4a (Configure-data) missing-policy labels, mirrored from ConfigureDataScreen's POLICIES list
// so the SEM step-4a mismatch note reads the same word the user picked there.
const STEP4A_POLICY_LABEL: Record<string, string> = { drop: 'Drop rows', impute: 'Impute', leave: 'Leave as-is' }
// The SEM fit's effective missing-data handling, in the mismatch note's wording.
const SEM_MISSING_LABEL: Record<string, string> = { fiml: 'FIML', pairwise: 'pairwise' }

export interface SemControlsUIProps {
  track: 'cb-sem' | 'pls-sem'
  modelKind: 'latent' | 'path'
  pipeline: 'full' | 'cfa-only'
  efa: boolean
  estimator: string
  missing: string
  nboot: number
  running: boolean
  /** True when the canvas has one or more moderation edges drawn (design §A7). Moderation's
   *  indProd() approach forces an ML-family estimator, so WLSMV must be un-selectable once a
   *  moderation edge exists — mirrors the runCbSem/moderationModel guard that already throws if
   *  WLSMV reaches the runner with moderations present; this closes the UI-side seam so the
   *  estimator dropdown never lets the user reach that thrown error in the first place. */
  hasModeration?: boolean
  /** Latent mode: any construct item's column level is 'ordinal' (Configure-data). Path mode
   *  (Amendment B, docs/superpowers/specs/2026-07-11-path-mode-wlsmv-design.md): at least one
   *  PLACED column is ordinal AND is ENDOGENOUS in the drawn paths (some path's `to` points at
   *  it) - matches lavaan's ordered-threshold semantics; exogenous ordinal predictors enter the
   *  model numerically and never carry thresholds. WLSMV needs at least one ordinal indicator
   *  (semFitArgs.ts's own guard) - mirrored here so the WLSMV option greys out in the UI before
   *  the user can reach that thrown error. */
  hasOrdinalIndicator: boolean
  /** Path mode only: true when at least one PLACED column (on the canvas) is ordinal-level,
   *  regardless of whether it is endogenous yet. Distinguishes the two path-mode WLSMV hints:
   *  "nothing ordinal on the canvas at all" vs "an ordinal variable is placed but none is
   *  endogenous yet" (Amendment B). Unused outside path mode. */
  hasPlacedOrdinal?: boolean
  /** R7 (board-clearing slice): true while the store's revalidated() guard auto-reset a stranded
   *  'WLSMV' to 'ML' (the enabling condition broke - see session.ts's wlsmvAllowed). Renders a
   *  one-sentence "Estimator reset to ML" hint; the store clears it when eligibility returns or
   *  the user picks an estimator manually. */
  estimatorFallback?: boolean
  /** Session-level Configure-data missing policy ('leave' | 'drop' | 'impute') - compared against
   *  the SEM-local missing choice for the step-4a mismatch note. */
  globalMissingPolicy: string
  onSetPipeline: (p: 'full' | 'cfa-only') => void
  onSetEfa: (on: boolean) => void
  onSetEstimator: (e: string) => void
  onSetMissing: (m: string) => void
  onSetNboot: (n: number) => void
}

/** Pure presentational bespoke controls — NOT generic option pills (locked stages, conditional greying, computed estimate). */
export function SemControlsUI({
  track, modelKind, pipeline, efa, estimator, missing, nboot, running, hasModeration = false,
  hasOrdinalIndicator, hasPlacedOrdinal = false, estimatorFallback = false, globalMissingPolicy,
  onSetPipeline, onSetEfa, onSetEstimator, onSetMissing, onSetNboot,
}: SemControlsUIProps) {
  const isCb = track === 'cb-sem'
  const showPipeline = isCb && modelKind !== 'path'
  const estMin = estBootstrapMinutes(track, nboot)
  const ci = nboot >= 10000 ? 'BCa' : 'percentile'
  const bootstrapAllowed = estimator === 'ML'
  const bootstrapDisabled = running || !bootstrapAllowed
  // Step-4a mismatch: the SEM fit's effective missing handling diverges from what the user picked
  // on Configure-data ('leave' means no global policy was set, so there's nothing to diverge from).
  const showStep4aMismatch = missing !== 'listwise' && globalMissingPolicy !== 'leave'
  return (
    <div className="sem-controls">
      {/* ── Pipeline-stage selector (CB-SEM, latent only) — OPTIONAL/ADVANCED, defaults to full ── */}
      {showPipeline && (
        <fieldset className="card" style={{ marginTop: 8 }}>
          <legend className="eyebrow">Pipeline <span className="hint">(optional · advanced - defaults to the full model)</span></legend>
          <label className="pill" style={{ cursor: 'pointer' }}>
            <input type="radio" name="sem-pipeline" value="full" checked={pipeline === 'full'}
              disabled={running} onChange={() => onSetPipeline('full')} style={{ marginRight: 6 }} />
            full (measurement + structural)
          </label>
          <label className="pill" style={{ cursor: 'pointer', marginLeft: 8 }}>
            <input type="radio" name="sem-pipeline" value="cfa-only" checked={pipeline === 'cfa-only'}
              disabled={running} onChange={() => onSetPipeline('cfa-only')} style={{ marginRight: 6 }} />
            cfa-only (measurement step - Anderson &amp; Gerbing)
          </label>
          <div style={{ marginTop: 8 }}>
            <span className="pill" aria-disabled="true">CFA + fit indices <em className="hint">always on</em></span>
            <label className="pill" style={{ cursor: 'pointer', marginLeft: 8 }}>
              <input type="checkbox" checked={efa} disabled={running}
                onChange={(e) => onSetEfa(e.target.checked)} style={{ marginRight: 6 }} />
              Exploratory factor analysis (EFA)
            </label>
          </div>
        </fieldset>
      )}

      {/* ── Estimator + estimator-aware missing-data (CB-SEM only; PLS missing follows global step-4a) ── */}
      {isCb && (
        <fieldset className="card" style={{ marginTop: 8 }}>
          <legend className="eyebrow">Estimation</legend>
          <label className="pill">
            estimator{' '}
            <select aria-label="estimator" value={estimator} disabled={running}
              onChange={(e) => onSetEstimator(e.target.value)}
              style={{ border: 0, background: 'transparent', font: 'inherit', color: 'inherit' }}>
              {['WLSMV', 'ML', 'MLR'].map((e) => (
                <option key={e} value={e}
                  disabled={e === 'WLSMV' && (hasModeration || !hasOrdinalIndicator)}>{e}</option>
              ))}
            </select>
          </label>
          <label className="pill" style={{ marginLeft: 8 }}>
            missing data{' '}
            <select aria-label="missing data" value={missing} disabled={running}
              onChange={(e) => onSetMissing(e.target.value)}
              style={{ border: 0, background: 'transparent', font: 'inherit', color: 'inherit' }}>
              {MISSING_OPTS.map((m) => (
                <option key={m.id} value={m.id} disabled={isMissingDisabled(m, estimator)}>{m.label}</option>
              ))}
            </select>
          </label>
          {!isMlFamily(estimator) && (
            <p className="hint" role="note" style={{ marginTop: 4 }}>
              FIML requires an ML-family estimator (ML or MLR); under WLSMV use pairwise.
            </p>
          )}
          {estimator === 'MLR' && (
            <p className="hint" role="note" style={{ marginTop: 4 }}>
              Pairwise is not supported under MLR; use FIML or listwise.
            </p>
          )}
          {hasModeration && (
            <p className="hint" role="note" style={{ marginTop: 4 }}>
              WLSMV is unavailable while a moderation edge is drawn - latent moderation forces an
              ML-family estimator (ML or MLR); remove the moderation edge to use WLSMV.
            </p>
          )}
          {!hasOrdinalIndicator && (
            // DRAFT copy - owner render review pending (spec 2026-07-11-path-mode-wlsmv-design.md
            // Amendment B); path-mode wording branches on whether an ordinal column is placed at all.
            <p className="hint" role="note" style={{ marginTop: 4 }}>
              {modelKind === 'path'
                ? hasPlacedOrdinal
                  ? 'WLSMV applies ordered-threshold modeling to ordinal outcome variables; draw a path into an ordinal variable to enable it.'
                  : 'WLSMV needs at least one ordinal variable on the canvas; all your placed variables are scale-level - use ML or MLR.'
                : 'WLSMV needs at least one ordinal indicator; all your indicators are scale-level - use ML or MLR.'}
            </p>
          )}
          {estimatorFallback && (
            // R7: the store auto-reset a stranded WLSMV to ML (revalidated() guard) - say so, in one
            // sentence, wording adapted from the unavailability hints above (which state the remedy).
            <p className="hint" role="note" style={{ marginTop: 4 }}>
              {modelKind === 'path'
                ? 'Estimator reset to ML: WLSMV needs an ordinal outcome on the canvas (a path drawn into an ordinal variable).'
                : hasModeration
                  ? 'Estimator reset to ML: latent moderation forces an ML-family estimator (ML or MLR).'
                  : 'Estimator reset to ML: WLSMV needs at least one ordinal indicator.'}
            </p>
          )}
          {showStep4aMismatch && (
            <p className="hint" role="note" style={{ marginTop: 4 }}>
              {`Your Configure-data missing setting is "${STEP4A_POLICY_LABEL[globalMissingPolicy] ?? globalMissingPolicy}"; this SEM fit uses ${SEM_MISSING_LABEL[missing] ?? missing} instead.`}
            </p>
          )}
        </fieldset>
      )}

      {/* ── Bootstrap control — presets + free entry + spike-calibrated time estimate (D6/D7/D10) ── */}
      <fieldset className="card" style={{ marginTop: 8 }}>
        <legend className="eyebrow">Bootstrap</legend>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {BOOTSTRAP_PRESETS.map((n) => (
            <label key={n} className={`pill${nboot === n ? ' on' : ''}`} style={{ cursor: 'pointer' }}>
              <input type="radio" name="sem-nboot" value={n} checked={nboot === n}
                disabled={bootstrapDisabled} onChange={() => onSetNboot(n)} style={{ marginRight: 6 }} />
              {n === 1000 ? '1k' : n === 5000 ? '5k' : '10k'}
            </label>
          ))}
          <label className="pill">
            resamples{' '}
            <input type="number" min={100} step={100} value={nboot} disabled={bootstrapDisabled}
              aria-label="bootstrap resamples" onChange={(e) => onSetNboot(Number(e.target.value))}
              style={{ width: '6em', border: 0, background: 'transparent', font: 'inherit', color: 'inherit' }} />
          </label>
          <span className="hint" role="status">≈ {estMin.toFixed(1)} min · {ci} CI</span>
        </div>
        <p className="hint" style={{ marginTop: 4 }}>
          {nboot >= 10000
            ? 'BCa confidence intervals (publication-grade; BCa needs ≈7k+ resamples to be accurate).'
            : 'Percentile confidence intervals (cross-track consistency; BCa reserved for the 10k preset).'}
        </p>
        {!bootstrapAllowed && (
          <p className="hint" role="note" style={{ marginTop: 4 }}>
            Bootstrap CIs require the ML estimator; MLR/WLSMV report their own robust standard errors and delta-method CIs.
          </p>
        )}
      </fieldset>
    </div>
  )
}

/** Single source of truth for the CB-SEM 'missing' dropdown's displayed default. An untouched setup has
 *  no 'missing' key in setup.options (freshSetup filters kind:'display' registry options out — see
 *  src/state/session.ts), so the UI must show the SAME value the runner treats as its effective default:
 *  CB_SEM_DEFAULT_MISSING (runCbSem.ts) — never a value of its own that could drift out of sync. */
export const missingOptionValue = (o: TestSetup['options']): string => {
  const v = String(o.missing ?? CB_SEM_DEFAULT_MISSING)
  return MISSING_OPTION_ID_SET.has(v) ? v : CB_SEM_DEFAULT_MISSING
}

/** Store-connected bespoke controls — values persist into setup.options, read by runCbSem/runPlsSem + emitters. */
export function SemControls({ testId }: { testId: string }) {
  const s = useSession()
  const setup = s.setups[testId]
  if (!setup) return null
  const track = testId === 'pls-sem' ? 'pls-sem' : 'cb-sem'
  const o = setup.options
  const columnLevel = new Map(s.columns.map((c) => [c.name, c.level]))
  const isPath = setup.modelKind === 'path'
  const placed = setup.placed ?? []
  const paths = setup.paths ?? []
  // Amendment B (docs/superpowers/specs/2026-07-11-path-mode-wlsmv-design.md): path-mode WLSMV
  // enablement requires a PLACED ordinal column that is ENDOGENOUS in the drawn paths (some
  // path's `to` is that column's placed-index) - lavaan only assigns thresholds to endogenous
  // ordered variables; exogenous ordinal predictors enter numerically with no warning. This is
  // dynamic with drawing: it re-derives from the live setup on every render. Latent mode's rule
  // (any ordinal item among construct indicators) is unchanged.
  const hasPlacedOrdinal = isPath && placed.some((name) => columnLevel.get(name) === 'ordinal')
  const hasEndogenousOrdinal = isPath && placed.some((name, i) =>
    columnLevel.get(name) === 'ordinal' && paths.some((p) => p.to === i))
  const hasOrdinalIndicator = isPath
    ? hasEndogenousOrdinal
    : (setup.constructs ?? []).some((c) => c.items.some((item) => columnLevel.get(item) === 'ordinal'))
  return (
    <SemControlsUI
      track={track}
      modelKind={setup.modelKind ?? 'latent'}
      pipeline={(o.pipeline as 'full' | 'cfa-only') ?? 'full'}
      efa={!!o.efa}
      estimator={String(o.estimator ?? 'ML')}
      missing={missingOptionValue(o)}
      nboot={Number(o.nboot ?? 5000)}
      running={s.runStatus === 'running'}
      hasModeration={(setup.moderations ?? []).length > 0}
      hasOrdinalIndicator={hasOrdinalIndicator}
      hasPlacedOrdinal={hasPlacedOrdinal}
      estimatorFallback={!!setup.estimatorFallback}
      globalMissingPolicy={s.missingPolicy}
      onSetPipeline={(p) => s.setOption(testId, 'pipeline', p)}
      onSetEfa={(on) => s.setOption(testId, 'efa', on)}
      onSetEstimator={(e) => s.setOption(testId, 'estimator', e)}
      onSetMissing={(m) => s.setOption(testId, 'missing', m)}
      onSetNboot={(n) => s.setOption(testId, 'nboot', n)}
    />
  )
}
