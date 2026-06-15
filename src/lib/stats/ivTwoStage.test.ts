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
    expect(r.weakF).toBeCloseTo(438.5002, 1)
    expect(r.wuF).toBeCloseTo(1022.7501, 1)
    expect(r.sargan).toBeNull()                      // just-identified → Sargan NA → null
    expect(Array.from(r.figCoefPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('guards: fewer instruments than endogenous errors (order condition)', async () => {
    await expect(runIvTwoStage(engine, loadCsvFixture(CAUSAL), 'wage', ['educ', 'exper'], ['educ_iv'], []))
      .rejects.toThrow(/order condition/)
  }, 300_000)
})
