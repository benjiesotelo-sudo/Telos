// src/components/SemControls.tsx
import { useSession } from '../state/session'

export const BOOTSTRAP_PRESETS = [1000, 5000, 10000] as const

// Spike-calibrated per-resample wall time in WASM (spike 0b): CB-SEM 5k ≈ 2.5 min; PLS 5k ≈ 2.7 min, 10k ≈ 5.4 min.
// Time-based progress (D7) uses this for the elapsed/estimate bar — NOT per-resample counts.
const MIN_PER_5K: Record<'cb-sem' | 'pls-sem', number> = { 'cb-sem': 2.5, 'pls-sem': 2.7 }

/** Spike-calibrated estimate, linear in resamples. Returns minutes. */
export function estBootstrapMinutes(track: 'cb-sem' | 'pls-sem', nboot: number): number {
  return (MIN_PER_5K[track] * nboot) / 5000
}

// CB-SEM missing-data options. `mlOnly` ones are greyed when the estimator is not ML-family (WLSMV).
const MISSING_OPTS: Array<{ id: string; label: string; mlOnly: boolean }> = [
  { id: 'fiml', label: 'FIML (full-information ML)', mlOnly: true },
  { id: 'mi', label: 'Multiple imputation', mlOnly: false },
  { id: 'pairwise', label: 'Pairwise', mlOnly: false },
  { id: 'listwise', label: 'Listwise deletion', mlOnly: false },
]
const isMlFamily = (estimator: string) => estimator === 'ML' || estimator === 'MLR'

export interface SemControlsUIProps {
  track: 'cb-sem' | 'pls-sem'
  modelKind: 'latent' | 'path'
  pipeline: 'full' | 'cfa-only'
  efa: boolean
  estimator: string
  missing: string
  nboot: number
  running: boolean
  onSetPipeline: (p: 'full' | 'cfa-only') => void
  onSetEfa: (on: boolean) => void
  onSetEstimator: (e: string) => void
  onSetMissing: (m: string) => void
  onSetNboot: (n: number) => void
}

/** Pure presentational bespoke controls — NOT generic option pills (locked stages, conditional greying, computed estimate). */
export function SemControlsUI({
  track, modelKind, pipeline, efa, estimator, missing, nboot, running,
  onSetPipeline, onSetEfa, onSetEstimator, onSetMissing, onSetNboot,
}: SemControlsUIProps) {
  const isCb = track === 'cb-sem'
  const showPipeline = isCb && modelKind !== 'path'
  const estMin = estBootstrapMinutes(track, nboot)
  const ci = nboot >= 10000 ? 'BCa' : 'percentile'
  return (
    <div className="sem-controls">
      {/* ── Pipeline-stage selector (CB-SEM, latent only) — OPTIONAL/ADVANCED, defaults to full ── */}
      {showPipeline && (
        <fieldset className="card" style={{ marginTop: 8 }}>
          <legend className="eyebrow">Pipeline <span className="hint">(optional · advanced — defaults to the full model)</span></legend>
          <label className="pill" style={{ cursor: 'pointer' }}>
            <input type="radio" name="sem-pipeline" value="full" checked={pipeline === 'full'}
              disabled={running} onChange={() => onSetPipeline('full')} style={{ marginRight: 6 }} />
            full (measurement + structural)
          </label>
          <label className="pill" style={{ cursor: 'pointer', marginLeft: 8 }}>
            <input type="radio" name="sem-pipeline" value="cfa-only" checked={pipeline === 'cfa-only'}
              disabled={running} onChange={() => onSetPipeline('cfa-only')} style={{ marginRight: 6 }} />
            cfa-only (measurement step — Anderson &amp; Gerbing)
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
              {['WLSMV', 'ML', 'MLR'].map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          <label className="pill" style={{ marginLeft: 8 }}>
            missing data{' '}
            <select aria-label="missing data" value={missing} disabled={running}
              onChange={(e) => onSetMissing(e.target.value)}
              style={{ border: 0, background: 'transparent', font: 'inherit', color: 'inherit' }}>
              {MISSING_OPTS.map((m) => (
                <option key={m.id} value={m.id} disabled={m.mlOnly && !isMlFamily(estimator)}>{m.label}</option>
              ))}
            </select>
          </label>
          {!isMlFamily(estimator) && (
            <p className="hint" role="note" style={{ marginTop: 4 }}>
              FIML requires an ML-family estimator (ML or MLR); under WLSMV use pairwise.
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
                disabled={running} onChange={() => onSetNboot(n)} style={{ marginRight: 6 }} />
              {n === 1000 ? '1k' : n === 5000 ? '5k' : '10k'}
            </label>
          ))}
          <label className="pill">
            resamples{' '}
            <input type="number" min={100} step={100} value={nboot} disabled={running}
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
      </fieldset>
    </div>
  )
}

/** Store-connected bespoke controls — values persist into setup.options, read by runCbSem/runPlsSem + emitters. */
export function SemControls({ testId }: { testId: string }) {
  const s = useSession()
  const setup = s.setups[testId]
  if (!setup) return null
  const track = testId === 'pls-sem' ? 'pls-sem' : 'cb-sem'
  const o = setup.options
  return (
    <SemControlsUI
      track={track}
      modelKind={setup.modelKind ?? 'latent'}
      pipeline={(o.pipeline as 'full' | 'cfa-only') ?? 'full'}
      efa={!!o.efa}
      estimator={String(o.estimator ?? 'ML')}
      missing={String(o.missing ?? 'fiml')}
      nboot={Number(o.nboot ?? 5000)}
      running={s.runStatus === 'running'}
      onSetPipeline={(p) => s.setOption(testId, 'pipeline', p)}
      onSetEfa={(on) => s.setOption(testId, 'efa', on)}
      onSetEstimator={(e) => s.setOption(testId, 'estimator', e)}
      onSetMissing={(m) => s.setOption(testId, 'missing', m)}
      onSetNboot={(n) => s.setOption(testId, 'nboot', n)}
    />
  )
}
