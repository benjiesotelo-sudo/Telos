import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Engine } from '../webr/engine'
import { runRdd } from './rdd'
import { loadCsvFixture } from './csvFixture'

const CAUSAL = join(dirname(fileURLToPath(import.meta.url)), '../../../tests/e2e/fixtures/causal.csv')

// Native R 4.6.0: rdrobust(score, running_var, c=50) → Conventional est 9.897029, Robust CI [9.475, 10.282].
describe('runRdd', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('RD estimate + bandwidth + N vs native R 4.6.0', async () => {
    const r = await runRdd(engine, loadCsvFixture(CAUSAL), 'score', 'running_var', { cutoff: 50 })
    expect(r.estimate).toBeCloseTo(9.897029, 4)
    expect(r.se).toBeCloseTo(0.2058503, 4)
    expect(r.z).toBeCloseTo(47.9908, 2)
    expect(r.p).toBeLessThan(1e-6)
    expect(r.ciLow).toBeCloseTo(9.475461, 3)
    expect(r.ciHigh).toBeCloseTo(10.28238, 3)
    expect(r.bandwidth).toBeCloseTo(8.659617, 3)
    expect(r.nLeft).toBe(18)
    expect(r.nRight).toBe(16)
    expect(r.bwSelect).toBe('mserd')
    expect(r.kernel).toBe('Triangular')
    expect(Array.from(r.figRdPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    // R1 gap-fix: bandwidth-sensitivity re-estimates (fixed h=h0/2 and h=h0*2) — native R verified.
    expect(r.bwSensitivity.half.h).toBeCloseTo(8.659617 / 2, 3)
    expect(r.bwSensitivity.half.estimate).toBeCloseTo(9.859443, 4)
    expect(r.bwSensitivity.half.ciLow).toBeCloseTo(8.743573, 3)
    expect(r.bwSensitivity.half.ciHigh).toBeCloseTo(10.63558, 3)
    expect(r.bwSensitivity.double.h).toBeCloseTo(8.659617 * 2, 3)
    expect(r.bwSensitivity.double.estimate).toBeCloseTo(9.942434, 4)
    expect(r.bwSensitivity.double.ciLow).toBeCloseTo(9.552166, 3)
    expect(r.bwSensitivity.double.ciHigh).toBeCloseTo(10.23671, 3)
  }, 900_000)

  // McCrary density manipulation test (rddensity::rddensity(running_var, c=50)$test, jackknife-robust):
  // native R 4.6.0 (rddensity 3.0) → t_jk = 0.07806802, p_jk = 0.9377739 (no sorting at the cutoff).
  it('McCrary density test (jackknife-robust t/p) vs native R 4.6.0', async () => {
    const r = await runRdd(engine, loadCsvFixture(CAUSAL), 'score', 'running_var', { cutoff: 50 })
    expect(r.mccrary.t).toBeCloseTo(0.07806802, 4)
    expect(r.mccrary.p).toBeCloseTo(0.9377739, 4)
  }, 900_000)

  it('polynomial order 2 gives the native-R p=2 estimate', async () => {
    const r = await runRdd(engine, loadCsvFixture(CAUSAL), 'score', 'running_var', { cutoff: 50, polyOrder: 2 })
    expect(r.estimate).toBeCloseTo(9.903214, 3)
  }, 900_000)
})
