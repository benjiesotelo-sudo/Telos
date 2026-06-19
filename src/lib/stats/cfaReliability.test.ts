import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'

// Smoke test: verifies that the makeCluster serial shim + lavaan/semTools/GPArotation packages
// load and run correctly under WebR. Uses lavaan's built-in HolzingerSwineford1939 dataset.
// Expected ω values cross-checked against native R 4.6.0 (2026-06-18-sem-feasibility-spike.md).
describe('cfaReliability (CFA + compRelSEM smoke test)', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('2-construct CFA on HolzingerSwineford1939 returns finite omega via semTools::compRelSEM', async () => {
    // 2-construct model (visual + textual) from the 3-factor HolzingerSwineford1939 spike
    // Spike native-R-verified values: visual ω ≈ 0.612, textual ω ≈ 0.885
    const result = await engine.runJson<{ visual: number; textual: number }>(`
      library(lavaan)
      model <- '
        visual  =~ x1 + x2 + x3
        textual =~ x4 + x5 + x6
      '
      fit <- cfa(model, data = HolzingerSwineford1939)
      rel <- unlist(semTools::compRelSEM(fit))
      list(visual = as.numeric(rel["visual"]), textual = as.numeric(rel["textual"]))
    `)

    expect(isFinite(result.visual)).toBe(true)
    expect(isFinite(result.textual)).toBe(true)
    expect(result.visual).toBeCloseTo(0.612, 2)
    expect(result.textual).toBeCloseTo(0.885, 2)
  }, 300_000)
})
