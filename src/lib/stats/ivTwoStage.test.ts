import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Engine } from '../webr/engine'
import { runIvTwoStage } from './ivTwoStage'
import { loadCsvFixture } from './csvFixture'

const CAUSAL = join(dirname(fileURLToPath(import.meta.url)), '../../../tests/e2e/fixtures/causal.csv')

// Native R 4.6.0: ivreg(wage ~ educ + exper | educ_iv + exper), robust SE (sandwich::vcovHC HC1).
describe('runIvTwoStage', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('first stage + 2SLS robust estimates + diagnostics vs native R 4.6.0', async () => {
    const r = await runIvTwoStage(engine, loadCsvFixture(CAUSAL), 'wage', ['educ'], ['educ_iv'], ['exper'])
    expect(r.nObs).toBe(200)
    const fs = r.firstStage.find((x) => x.instrument === 'educ_iv')!
    expect(fs.coef).toBeCloseTo(1.156964, 4)
    expect(fs.se).toBeCloseTo(0.055250, 4)
    expect(fs.partialF).toBeCloseTo(438.5002, 1)
    const educ = r.coefRows.find((c) => c.term === 'educ')!
    expect(educ.b).toBeCloseTo(7.821416, 4)
    expect(educ.se).toBeCloseTo(0.284340, 4)        // robust SE (sandwich::vcovHC) — verifies under WebR
    expect(educ.ciLow).toBeCloseTo(7.260675, 3)
    expect(educ.ciHigh).toBeCloseTo(8.382158, 3)
    // OLS|2SLS shape: the matching OLS estimate/SE/CI are surfaced per term (lm(.y ~ educ + exper), HC1)
    expect(educ.olsB).toBeCloseTo(9.568037, 4)
    expect(educ.olsSe).toBeCloseTo(0.160186, 4)
    expect(educ.olsCiLow).toBeCloseTo(9.252138, 3)
    expect(educ.olsCiHigh).toBeCloseTo(9.883936, 3)
    expect(r.weakF).toBeCloseTo(438.5002, 1)
    expect(r.wuF).toBeCloseTo(1022.7501, 1)
    expect(r.sargan).toBeNull()                      // just-identified → Sargan NA → null
    expect(r.structF).toBeCloseTo(373.4404, 1)       // structural Wald F = summary(.,diagnostics=T)$waldtest[1]
    expect(r.rmse).toBeCloseTo(6.666408, 3)
    expect(Array.from(r.figCoefPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('guards: fewer instruments than endogenous errors (order condition)', async () => {
    await expect(runIvTwoStage(engine, loadCsvFixture(CAUSAL), 'wage', ['educ', 'exper'], ['educ_iv'], []))
      .rejects.toThrow(/order condition/)
  }, 300_000)

  // R1 gap-fix: first-stage strength was only ever computed for the FIRST endogenous regressor. Synthetic
  // 2-endogenous/2-instrument fixture (n=40, set.seed(777)), native R 4.6.0 verified directly (Rscript):
  // fs1 <- lm(x1 ~ z1+z2+ctrl); fs2 <- lm(x2 ~ z1+z2+ctrl).
  it('first stage is computed and reported for EVERY endogenous regressor, not just the first', async () => {
    const n = 40
    const y = [24.1905, 18.0741, 18.4382, 13.636, 28.5962, 23.2501, 19.2845, 20.5721, 21.9786, 21.17, 22.6195, 14.8256, 20.0501, 20.873, 32.5203, 23.9732, 27.8572, 28.4168, 20.6787, 23.1267, 8.3169, 22.522, 19.6769, 22.6383, 29.4296, 28.0487, 9.713, 20.1634, 11.9619, 17.1354, 28.6736, 27.4113, 21.7862, 17.273, 24.7235, 10.8398, 26.1249, 18.0934, 14.2965, 26.6836]
    const x1 = [9.7591, 6.0449, 8.3894, 6.8801, 11.1711, 10.1847, 8.7361, 11.2135, 9.2346, 8.2267, 6.2175, 7.0222, 4.6108, 8.3052, 13.7736, 8.8538, 12.1298, 8.5794, 12.1736, 8.0707, 2.7891, 9.0116, 6.4813, 12.0237, 11.4556, 10.5286, 2.8411, 7.9314, 3.2946, 7.1754, 10.2545, 10.7919, 11.2077, 6.0169, 10.5512, 3.3831, 11.3, 6.7596, 6.1222, 10.0189]
    const x2 = [2.8686, 2.9524, 0.8411, 0.1096, 4.7051, 2.6155, 1.0142, -0.4597, 1.9648, 4.277, 6.8959, 1.572, 5.6955, 2.4474, 1.755, 4.7853, 2.0633, 6.2732, -1.0733, 3.9898, 2.0522, 3.1008, 3.7302, 0.5225, 3.4891, 3.4805, 2.5222, 3.6877, 3.0636, 1.4464, 4.8664, 2.8666, -1.6981, 4.1512, 2.4182, 2.4194, 2.2014, 2.7858, 1.1547, 3.0814]
    const z1 = [11.469, 8.804, 11.533, 8.804, 14.916, 11.864, 10.608, 13.327, 9.381, 8.863, 9.087, 10.162, 4.357, 9.899, 16.934, 12.917, 12.894, 8.368, 12.014, 11.502, 3.908, 10.683, 7.651, 13.821, 14.313, 11.281, 4.767, 9.924, 5.535, 8.375, 11.984, 12.575, 13.755, 6.356, 14.569, 6.292, 14.998, 8.489, 8.265, 10.815]
    const z2 = [4.397, 4.168, 3.537, 3.331, 6.256, 6.595, 3.54, 3.329, 4.314, 7.968, 8.066, 2.58, 9.66, 4.86, 5.503, 5.68, 3.944, 5.665, 0.127, 6.61, 4.292, 5.351, 4.839, 1.791, 7.54, 4.633, 3.838, 5.161, 4.015, 4.669, 6.919, 3.5, 2.239, 5.953, 2.609, 6.217, 4.108, 5.301, 3.059, 5.973]
    const ctrl = [0.83, 0.008, 1.039, -0.027, -0.137, 0.059, -0.868, -0.931, 0.858, -1.419, -1.738, -0.569, 0.768, -0.899, 1.258, -0.812, -0.441, 0.773, -0.449, 0.391, 0.859, 0.17, 0.473, -1.112, 1.283, 1.082, 0.219, 0.454, -1.366, -0.14, 1.253, 0.559, 0.25, -0.434, 0.307, -1.143, -0.471, -0.089, 0.463, 0.012]
    const rows = Array.from({ length: n }, (_, i) => ({ y: y[i], x1: x1[i], x2: x2[i], z1: z1[i], z2: z2[i], ctrl: ctrl[i] }))
    const ds = { columns: ['y', 'x1', 'x2', 'z1', 'z2', 'ctrl'], rows }
    const r = await runIvTwoStage(engine, ds, 'y', ['x1', 'x2'], ['z1', 'z2'], ['ctrl'])
    const rows1 = r.firstStage.filter((row) => row.endogenous === 'x1')
    const rows2 = r.firstStage.filter((row) => row.endogenous === 'x2')
    expect(rows1).toHaveLength(2); expect(rows2).toHaveLength(2)
    const z1x1 = rows1.find((row) => row.instrument === 'z1')!
    expect(z1x1.coef).toBeCloseTo(0.81288239, 4)
    expect(z1x1.se).toBeCloseTo(0.05576843, 4)
    const z2x2 = rows2.find((row) => row.instrument === 'z2')!
    expect(z2x2.coef).toBeCloseTo(0.7725193759, 4)
    expect(z2x2.se).toBeCloseTo(0.10058980, 4)
    expect(z2x2.partialF).toBeCloseTo(7.679897687 ** 2, 1)
  }, 900_000)
})
