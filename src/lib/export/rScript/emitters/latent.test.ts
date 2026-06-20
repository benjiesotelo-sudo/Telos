import { describe, it, expect } from 'vitest'
import { latentEmitters, latentPackages } from './latent'
import type { TestSpec } from '../../../registry/types'
import type { TestSetup } from '../../../../state/session'

const SPEC = { id: 'pls-sem', name: 'PLS-SEM' } as unknown as TestSpec

const SETUP: TestSetup = {
  roles: {},
  options: { nboot: 5000 },
  props: {},
  blocked: null,
  modelKind: 'latent',
  constructs: [
    { id: 1, name: 'Image', mode: 'reflective', items: ['IMAG1', 'IMAG2'] },
    { id: 2, name: 'Expectation', mode: 'formative', items: ['CUEX1', 'CUEX2'] },
    { id: 3, name: 'Satisfaction', mode: 'reflective', items: ['CUSA1', 'CUSA2'] },
  ],
  paths: [
    { from: 1, to: 2 },
    { from: 1, to: 3 },
    { from: 2, to: 3 },
  ],
}

describe('pls-sem emitter', () => {
  it('emits a reproducible seminr block with the serial-cluster shim and reordered reliability', () => {
    const R = latentEmitters['pls-sem'](SPEC, SETUP, { columns: [], rows: [] } as never)
    // serial shim present (seminr bootstrap forces a PSOCK cluster)
    expect(R).toContain('telosSerialCluster')
    // measurement model: reflective = mode_A, formative = mode_B
    expect(R).toContain('composite("Image", c("IMAG1", "IMAG2"), weights = mode_A)')
    expect(R).toContain('composite("Expectation", c("CUEX1", "CUEX2"), weights = mode_B)')
    // structural paths by NAME (ids are app-only)
    expect(R).toContain('paths(from = "Image", to = "Expectation")')
    expect(R).toContain('paths(from = "Expectation", to = "Satisfaction")')
    // estimate + bootstrap with the production count + percentile CI + serial cores
    expect(R).toContain('estimate_pls(data = d, measurement_model = mm, structural_model = sm)')
    expect(R).toContain('nboot = 5000')
    expect(R).toContain('cores = 1')
    // reliability reorder note + the four display columns
    expect(R).toContain('alpha')
    expect(R).toContain('rhoA')
    expect(R).toContain('rhoC')
    expect(R).toContain('AVE')
    // gc() around the heavy bootstrap
    expect(R).toContain('gc()')
    // indirect via specific_effect_significance
    expect(R).toContain('specific_effect_significance')
  })

  it('handles an empty model gracefully', () => {
    const R = latentEmitters['pls-sem'](SPEC, { ...SETUP, constructs: [] }, { columns: [], rows: [] } as never)
    expect(R).toContain('# No constructs defined')
  })

  it('declares the seminr package set', () => {
    expect(latentPackages['pls-sem']).toEqual(['seminr'])
  })
})
