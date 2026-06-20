// src/components/SemControls.test.tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SemControlsUI, BOOTSTRAP_PRESETS, estBootstrapMinutes } from './SemControls'

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
      onSetPipeline={noop}
      onSetEfa={noop}
      onSetEstimator={noop}
      onSetMissing={noop}
      onSetNboot={noop}
      {...over}
    />
  )
}

describe('SemControlsUI — pipeline-stage selector (CB-SEM, §3.4)', () => {
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

describe('SemControlsUI — estimator-aware missing-data dropdown (§3.4)', () => {
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

describe('SemControlsUI — bootstrap control (presets + free entry + time estimate, D6)', () => {
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

describe('estBootstrapMinutes — spike-calibrated estimate (§5.3)', () => {
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
