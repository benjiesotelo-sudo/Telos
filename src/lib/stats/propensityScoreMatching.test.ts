import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Engine } from '../webr/engine'
import { runPropensityScoreMatching } from './propensityScoreMatching'
import { loadCsvFixture } from './csvFixture'

const CAUSAL = join(dirname(fileURLToPath(import.meta.url)), '../../../tests/e2e/fixtures/causal.csv')

// Native R 4.6.0: matchit(enroll ~ exper+age+ability, method="nearest", ratio=1); ATT via weighted lm,
// subclass-clustered SE. ability SMD 1.359 → 0.373 (matching reduces the confound); ATT 5.869.
describe('runPropensityScoreMatching', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('covariate balance + ATT vs native R 4.6.0', async () => {
    const r = await runPropensityScoreMatching(engine, loadCsvFixture(CAUSAL), 'health', 'enroll', ['exper', 'age', 'ability'])
    expect(r.matchedN).toBe(134)
    const ability = r.balance.find((b) => b.covariate === 'ability')!
    expect(ability.smdPre).toBeCloseTo(1.358679, 4)
    expect(ability.smdPost).toBeCloseTo(0.373121, 4)
    expect(ability.varRatio).toBeCloseTo(1.298281, 4)
    expect(r.balance.find((b) => b.covariate === 'exper')!.smdPost).toBeCloseTo(-0.001786, 4)
    expect(r.attB).toBeCloseTo(5.868657, 4)
    expect(r.attSe).toBeCloseTo(0.2277397, 4)   // subclass-clustered (sandwich::vcovCL)
    expect(r.attLo).toBeCloseTo(5.418165, 3)
    expect(r.attHi).toBeCloseTo(6.319148, 3)
    expect(Array.from(r.figLovePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]) // hand-rolled love plot
  }, 900_000)

  it('guards: a treatment with ≠2 groups errors clearly', async () => {
    await expect(runPropensityScoreMatching(engine, loadCsvFixture(CAUSAL), 'health', 'exper', ['age', 'ability']))
      .rejects.toThrow(/exactly 2 groups/)
  }, 300_000)
})
