// src/components/SemControls.test.tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SemControlsUI, missingOptionValue, MISSING_OPTION_IDS, BOOTSTRAP_PRESETS, estBootstrapMinutes } from './SemControls'
import { CB_SEM_DEFAULT_MISSING } from '../lib/stats/runCbSem'
import type { TestSetup } from '../state/session'

const noop = () => {}

function renderUI(over: Partial<Parameters<typeof SemControlsUI>[0]> = {}) {
  return renderToStaticMarkup(
    <SemControlsUI
      track="cb-sem"
      modelKind="latent"
      pipeline="full"
      efa={false}
      estimator="ML"
      missing="fiml"
      nboot={5000}
      running={false}
      hasOrdinalIndicator={true}
      globalMissingPolicy="leave"
      onSetPipeline={noop}
      onSetEfa={noop}
      onSetEstimator={noop}
      onSetMissing={noop}
      onSetNboot={noop}
      {...over}
    />
  )
}

describe('SemControlsUI - pipeline-stage selector (CB-SEM, §3.4)', () => {
  it('defaults to the full model and offers full / cfa-only stages', () => {
    const html = renderUI({ pipeline: 'full' })
    expect(html).toContain('full')
    expect(html).toContain('cfa-only')
  })

  it('marks CFA + fit as locked/always-on (not a toggle)', () => {
    const html = renderUI()
    expect(html).toContain('CFA + fit indices')
    expect(html).toContain('always on')
  })

  it('shows the EFA sub-toggle reflecting its state', () => {
    const html = renderUI({ efa: true })
    expect(html).toContain('Exploratory factor analysis')
    expect(html).toContain('checked=""') // EFA checkbox on
  })

  it('does NOT render the pipeline selector for PLS-SEM (no pipeline strip, §3.5)', () => {
    const html = renderUI({ track: 'pls-sem' })
    expect(html).not.toContain('cfa-only')
  })

  it('does NOT render the pipeline selector in path mode (observed-only, §3.6)', () => {
    const html = renderUI({ modelKind: 'path' })
    expect(html).not.toContain('cfa-only')
  })
})

describe('SemControlsUI - estimator-aware missing-data dropdown (§3.4)', () => {
  it('CB-SEM: renders the estimator dropdown (WLSMV/ML/MLR) and the missing-data dropdown', () => {
    const html = renderUI({ track: 'cb-sem' })
    expect(html).toContain('WLSMV')
    expect(html).toContain('MLR')
    expect(html).toContain('FIML')
    expect(html).toContain('listwise')
  })

  it('greys FIML when the estimator is WLSMV (FIML is an ML-family option)', () => {
    // WLSMV cannot use FIML — the FIML option must be disabled.
    const html = renderUI({ track: 'cb-sem', estimator: 'WLSMV', missing: 'pairwise' })
    expect(html).toContain('value="fiml" disabled=""')
  })

  it('PLS-SEM has NO estimator dropdown (missing follows global step-4a, §3.5)', () => {
    const html = renderUI({ track: 'pls-sem' })
    expect(html).not.toContain('WLSMV')
    expect(html).not.toContain('MLR')
  })
})

describe('SemControlsUI - WLSMV blocked once a moderation edge exists (§A7 UI-estimator seam)', () => {
  it('greys the WLSMV option when hasModeration is true', () => {
    const html = renderUI({ estimator: 'ML', hasModeration: true })
    expect(html).toContain('value="WLSMV" disabled=""')
  })

  it('leaves WLSMV selectable when there is no moderation edge (default)', () => {
    const html = renderUI({ estimator: 'ML' })
    expect(html).not.toContain('value="WLSMV" disabled=""')
  })

  it('shows a note explaining why WLSMV is unavailable', () => {
    const html = renderUI({ estimator: 'ML', hasModeration: true })
    expect(html).toMatch(/WLSMV is unavailable while a moderation edge is drawn/)
  })
})

describe('SemControlsUI - bootstrap control (presets + free entry + time estimate, D6)', () => {
  it('exposes 1k / 5k / 10k presets and 5000 is the live value', () => {
    const html = renderUI({ nboot: 5000 })
    expect(BOOTSTRAP_PRESETS).toEqual([1000, 5000, 10000])
    expect(html).toContain('5000')
  })

  it('renders a free-entry number input for the resample count', () => {
    const html = renderUI()
    expect(html).toContain('aria-label="bootstrap resamples"')
  })

  it('shows a computed time estimate (elapsed/est is time-based, not per-resample, D7)', () => {
    const html = renderUI({ track: 'pls-sem', nboot: 5000 })
    // PLS 5k ≈ 2.7 min per spike 0b
    expect(html).toContain('min')
    expect(html).toMatch(/≈\s*2\.7\s*min/)
  })

  it('notes BCa kicks in only at the 10k preset, percentile otherwise (D10)', () => {
    expect(html10()).toContain('percentile')
    expect(renderUI({ nboot: 10000 })).toContain('BCa')
  })
})

function html10() {
  return renderUI({ nboot: 5000 })
}

describe('missingOptionValue - the connected default agrees with the runner (default-value seam, slice-5 review)', () => {
  it('CB_SEM_DEFAULT_MISSING is listwise (the fit\'s own effective default: lavaan::sem() is called with no missing= arg)', () => {
    expect(CB_SEM_DEFAULT_MISSING).toBe('listwise')
  })

  it('an untouched setup.options (no "missing" key -- freshSetup never seeds it, kind:"display" is filtered out) resolves to CB_SEM_DEFAULT_MISSING, NOT the stale "fiml" default', () => {
    const untouched: TestSetup['options'] = {}
    expect(missingOptionValue(untouched)).toBe(CB_SEM_DEFAULT_MISSING)
    expect(missingOptionValue(untouched)).not.toBe('fiml')
  })

  it('an explicitly-set value passes through unchanged (no silent override of a user choice)', () => {
    expect(missingOptionValue({ missing: 'fiml' })).toBe('fiml')
    expect(missingOptionValue({ missing: 'pairwise' })).toBe('pairwise')
  })

  it('renders into SemControlsUI as the selected option when passed through as the missing prop', () => {
    const html = renderUI({ missing: missingOptionValue({}) })
    expect(html).toContain(`value="${CB_SEM_DEFAULT_MISSING}" selected=""`)
  })
})

describe('MISSING_OPTS - multiple imputation removed (H1 wiring slice, Task 2)', () => {
  it('option ids are exactly fiml/pairwise/listwise - no more "mi"', () => {
    expect(MISSING_OPTION_IDS).toEqual(['fiml', 'pairwise', 'listwise'])
  })

  it('does not render "Multiple imputation" anywhere in the missing-data dropdown', () => {
    const html = renderUI()
    expect(html).not.toMatch(/Multiple imputation/)
    expect(html).not.toContain('value="mi"')
  })
})

describe('Bootstrap greys under non-ML estimators (bootstrap CIs are ML-only, Task 2 behavior 2)', () => {
  it('disables the bootstrap resample input and shows a note when estimator is MLR', () => {
    const html = renderUI({ estimator: 'MLR' })
    const inputTag = html.match(/<input[^>]*aria-label="bootstrap resamples"[^>]*>/)
    expect(inputTag?.[0]).toContain('disabled=""')
    expect(html).toContain(
      'Bootstrap CIs require the ML estimator; MLR/WLSMV report their own robust standard errors and delta-method CIs.'
    )
  })

  it('disables the bootstrap resample input when estimator is WLSMV', () => {
    const html = renderUI({ estimator: 'WLSMV', missing: 'pairwise' })
    const inputTag = html.match(/<input[^>]*aria-label="bootstrap resamples"[^>]*>/)
    expect(inputTag?.[0]).toContain('disabled=""')
  })

  it('leaves the bootstrap resample input enabled under ML (no note)', () => {
    const html = renderUI({ estimator: 'ML' })
    const inputTag = html.match(/<input[^>]*aria-label="bootstrap resamples"[^>]*>/)
    expect(inputTag?.[0]).not.toContain('disabled')
    expect(html).not.toContain('Bootstrap CIs require the ML estimator')
  })
})

describe('WLSMV requires at least one ordinal indicator (Task 2 behavior 3)', () => {
  it('greys the WLSMV option when no construct item is ordinal-level', () => {
    const html = renderUI({ estimator: 'ML', hasOrdinalIndicator: false })
    expect(html).toContain('value="WLSMV" disabled=""')
    expect(html).toContain(
      'WLSMV needs at least one ordinal indicator; all your indicators are scale-level - use ML or MLR.'
    )
  })

  it('leaves WLSMV selectable when at least one indicator is ordinal', () => {
    const html = renderUI({ estimator: 'ML', hasOrdinalIndicator: true })
    expect(html).not.toContain('value="WLSMV" disabled=""')
    expect(html).not.toMatch(/WLSMV needs at least one ordinal indicator/)
  })

  it('shows the ordinal-indicator note even while WLSMV is the stale selection', () => {
    const html = renderUI({ estimator: 'WLSMV', missing: 'pairwise', hasOrdinalIndicator: false })
    expect(html).toContain('value="WLSMV" disabled=""')
    expect(html).toMatch(/WLSMV needs at least one ordinal indicator/)
  })

  // FIX 4 (final-review wave): path mode's hasOrdinalIndicator is always false (setup.constructs is
  // empty in path mode until run-time synthesis - SemControls.tsx wrapper), so the ordinal-scale-level
  // claim is false in that mode. The note text must differ per modelKind, never claiming a fact about
  // indicator levels path mode cannot know yet.
  it('in path mode, the WLSMV note reads "not yet available for path analysis" - never the false scale-level claim', () => {
    const html = renderUI({ track: 'cb-sem', modelKind: 'path', estimator: 'ML', hasOrdinalIndicator: false })
    expect(html).toContain('value="WLSMV" disabled=""')
    expect(html).toContain('WLSMV is not yet available for path analysis; use ML or MLR.')
    expect(html).not.toMatch(/all your indicators are scale-level/)
  })

  it('in latent mode, the WLSMV note keeps the original scale-level wording - never the path-mode text', () => {
    const html = renderUI({ track: 'cb-sem', modelKind: 'latent', estimator: 'ML', hasOrdinalIndicator: false })
    expect(html).toContain(
      'WLSMV needs at least one ordinal indicator; all your indicators are scale-level - use ML or MLR.'
    )
    expect(html).not.toMatch(/not yet available for path analysis/)
  })
})

describe('Step-4a missing-policy mismatch note (Task 2 behavior 4)', () => {
  it('shows the mismatch note: global "drop" vs SEM fiml', () => {
    const html = renderUI({ missing: 'fiml', globalMissingPolicy: 'drop' })
    expect(html).toContain('Your Configure-data missing setting is &quot;Drop rows&quot;; this SEM fit uses FIML instead.')
  })

  it('shows the mismatch note: global "impute" vs SEM pairwise', () => {
    const html = renderUI({ estimator: 'WLSMV', missing: 'pairwise', globalMissingPolicy: 'impute' })
    expect(html).toContain('Your Configure-data missing setting is &quot;Impute&quot;; this SEM fit uses pairwise instead.')
  })

  it('does not show the note when the global policy is "leave" (default, no Configure-data override)', () => {
    const html = renderUI({ missing: 'fiml', globalMissingPolicy: 'leave' })
    expect(html).not.toMatch(/Configure-data missing setting/)
  })

  it('does not show the note when the SEM missing choice is listwise (no divergence to flag)', () => {
    const html = renderUI({ missing: 'listwise', globalMissingPolicy: 'drop' })
    expect(html).not.toMatch(/Configure-data missing setting/)
  })
})

describe('missingOptionValue - stale/removed ids fall back to the runner default (Task 2 behavior 5)', () => {
  it('a stale missing:"mi" (removed multiple-imputation option) resolves to CB_SEM_DEFAULT_MISSING', () => {
    expect(missingOptionValue({ missing: 'mi' })).toBe(CB_SEM_DEFAULT_MISSING)
    expect(missingOptionValue({ missing: 'mi' })).not.toBe('mi')
  })

  it('renders that fallback into SemControlsUI rather than an unknown/impossible option', () => {
    const html = renderUI({ missing: missingOptionValue({ missing: 'mi' }) })
    expect(html).toContain(`value="${CB_SEM_DEFAULT_MISSING}" selected=""`)
  })
})

describe('pairwise missing option disabled under MLR (Task 0 spike amendment: lavaan hard-errors MLR+pairwise)', () => {
  it('pairwise is enabled under ML', () => {
    const html = renderUI({ estimator: 'ML', missing: 'listwise' })
    expect(html).not.toContain('value="pairwise" disabled=""')
  })

  it('pairwise is enabled under WLSMV', () => {
    const html = renderUI({ estimator: 'WLSMV', missing: 'pairwise' })
    expect(html).not.toContain('value="pairwise" disabled=""')
  })

  it('pairwise is disabled under MLR, with the mirrored hint text', () => {
    const html = renderUI({ estimator: 'MLR', missing: 'listwise' })
    expect(html).toContain('value="pairwise" disabled=""')
    expect(html).toContain('Pairwise is not supported under MLR; use FIML or listwise.')
  })

  it('a stale saved setup (missing="pairwise", estimator switched to MLR) renders without crashing and shows pairwise disabled - the id itself is still valid so missingOptionValue passes it through unchanged, matching the existing stale-FIML-under-WLSMV convention', () => {
    const html = renderUI({ estimator: 'MLR', missing: 'pairwise' })
    expect(html).toContain('value="pairwise" disabled=""')
    expect(missingOptionValue({ missing: 'pairwise' })).toBe('pairwise')
  })
})

describe('estBootstrapMinutes - spike-calibrated estimate (§5.3)', () => {
  it('CB-SEM 5000 ≈ 2.5 min (mediation 5k spike)', () => {
    expect(estBootstrapMinutes('cb-sem', 5000)).toBeCloseTo(2.5, 1)
  })
  it('PLS 5000 ≈ 2.7 min and 10000 ≈ 5.4 min (linear in resamples)', () => {
    expect(estBootstrapMinutes('pls-sem', 5000)).toBeCloseTo(2.7, 1)
    expect(estBootstrapMinutes('pls-sem', 10000)).toBeCloseTo(5.4, 1)
  })
  it('scales linearly with the resample count', () => {
    expect(estBootstrapMinutes('pls-sem', 2500)).toBeCloseTo(1.35, 1)
  })
})
