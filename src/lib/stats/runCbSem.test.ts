import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runCbSem } from './runCbSem'
import { isSaturated } from './semSaturation'
import { loadCsvFixture } from './csvFixture'
import { join } from 'node:path'
import type { TestSetup } from '../../state/session'

// Reference values: native R 4.6.0 / lavaan 0.6.21 on lavaan's PoliticalDemocracy (Bollen industrialization→democracy).
// Model: ind60=~x1+x2+x3 · dem60=~y1+y2+y3+y4 · dem65=~y5+y6+y7+y8 · dem60~ind60 · dem65~dem60+ind60 · ind_ie:=a*b.
// Derived 2026-06-20 via Rscript sem(): df=41, chisq=72.462, CFI=.953, TLI=.938, RMSEA=.101 [.061,.139], SRMR=.055.
// std β: ind60→dem60=.448, dem60→dem65=.913, ind60→dem65=.146 · R²: dem60=.201, dem65=.974.
// unstd indirect a*b=1.274 (SE≈.359) · std loadings ind60: x1=.920,x2=.973,x3=.872.

const SETUP: TestSetup = {
  roles: {},
  options: { estimator: 'ML', nboot: 50, ciType: 'percentile' },
  props: {},
  blocked: null,
  modelKind: 'latent',
  constructs: [
    { id: 1, name: 'ind60', items: ['x1', 'x2', 'x3'] },
    { id: 2, name: 'dem60', items: ['y1', 'y2', 'y3', 'y4'] },
    { id: 3, name: 'dem65', items: ['y5', 'y6', 'y7', 'y8'] },
  ],
  paths: [
    { from: 1, to: 2 },
    { from: 2, to: 3 },
    { from: 1, to: 3 },
  ],
}

describe('semSaturation predicate', () => {
  it('isSaturated is true only at df==0', () => {
    expect(isSaturated(0)).toBe(true)
    expect(isSaturated(41)).toBe(false)
    expect(isSaturated(1)).toBe(false)
  })
})

describe('runCbSem', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('Bollen PoliticalDemocracy SEM matches native-R reference values', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/polidemocracy.csv'))
    const result = await runCbSem(engine, data, SETUP)

    // --- mode + saturation ---
    expect(result.mode).toBe('full')
    expect(result.saturated).toBe(false)
    expect(result.fit!.df).toBe(41)

    // --- fit indices ---
    expect(result.fit!.chisq).toBeCloseTo(72.462, 1)
    expect(result.fit!.cfi).toBeCloseTo(0.953, 2)
    expect(result.fit!.tli).toBeCloseTo(0.938, 2)
    expect(result.fit!.rmsea).toBeCloseTo(0.101, 2)
    expect(result.fit!.rmseaLower).toBeCloseTo(0.061, 2)
    expect(result.fit!.rmseaUpper).toBeCloseTo(0.139, 2)
    expect(result.fit!.srmr).toBeCloseTo(0.055, 2)

    // --- CFA loadings present (std loading on ind60→x2 = .973) ---
    const x2 = result.cfaLoadings.find((r) => r.rhs === 'x2')!
    expect(Number(x2.stdLoading)).toBeCloseTo(0.973, 2)

    // --- structural standardized paths (id-keyed) ---
    const s = result.structural!
    const p12 = s.find((r) => r.from === 1 && r.to === 2)!
    const p23 = s.find((r) => r.from === 2 && r.to === 3)!
    const p13 = s.find((r) => r.from === 1 && r.to === 3)!
    expect(Number(p12.stdBeta)).toBeCloseTo(0.448, 2)
    expect(Number(p23.stdBeta)).toBeCloseTo(0.913, 2)
    expect(Number(p13.stdBeta)).toBeCloseTo(0.146, 2)

    // --- R² (endogenous constructs, id-keyed) ---
    expect(result.rsquare![2]).toBeCloseTo(0.201, 2)
    expect(result.rsquare![3]).toBeCloseTo(0.974, 2)

    // --- bootstrapped indirect effect (ind60→dem60→dem65) ---
    const ie = result.indirect![0]
    expect(Number(ie.est)).toBeCloseTo(1.274, 1)
    expect(ie.ciLower).not.toBeNull()
    expect(ie.ciUpper).not.toBeNull()
    expect(Number(ie.ciLower)).toBeLessThan(Number(ie.est))
    expect(Number(ie.ciUpper)).toBeGreaterThan(Number(ie.est))

    // --- estimates block for the canvas overlay (numeric ids) ---
    expect(result.estimates.paths).toHaveLength(3)
    expect(result.estimates.r2[3]).toBeCloseTo(0.974, 2)
    expect(result.estimates.loadings['x2']).toBeCloseTo(0.973, 2)
  }, 600_000)
})
