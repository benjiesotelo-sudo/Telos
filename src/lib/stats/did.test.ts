import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Engine } from '../webr/engine'
import { runDid } from './did'
import { loadCsvFixture } from './csvFixture'

const PANEL = join(dirname(fileURLToPath(import.meta.url)), '../../../tests/e2e/fixtures/panel.csv')

// Native R 4.6.0: lm(roa ~ treated*post), clustered-by-firm SE (sandwich::vcovCL) → treated:post = 1.525625.
describe('runDid', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('DiD interaction + clustered-by-entity SE vs native R 4.6.0', async () => {
    const r = await runDid(engine, loadCsvFixture(PANEL), 'roa', 'treated', 'post', 'firm', 'year')
    expect(r.nObs).toBe(96)
    const did = r.coefRows.find((c) => c.term === 'tr:po')!
    expect(did.b).toBeCloseTo(1.525625, 4)
    expect(did.se).toBeCloseTo(0.122387, 4)        // clustered (sandwich::vcovCL) — verifies vcovCL under WebR
    expect(did.t).toBeCloseTo(12.465601, 3)
    expect(did.ciLow).toBeCloseTo(1.282554, 4)
    expect(did.ciHigh).toBeCloseTo(1.768696, 4)
    expect(r.coefRows.find((c) => c.term === 'tr')!.b).toBeCloseTo(-6.286500, 4)
    expect(r.coefRows.find((c) => c.term === 'po')!.b).toBeCloseTo(2.015083, 4)
    expect(r.coefRows.find((c) => c.term === '(Intercept)')!.b).toBeCloseTo(19.206417, 4)
    expect(Array.from(r.figTrendsPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('guards: a treatment with ≠2 groups errors clearly', async () => {
    const ds = loadCsvFixture(PANEL)
    await expect(runDid(engine, ds, 'roa', 'firm', 'post', 'firm', 'year')) // firm has 12 groups
      .rejects.toThrow(/exactly 2 groups/)
  }, 300_000)
})
