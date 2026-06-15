import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Engine } from '../webr/engine'
import { runRandomEffects } from './randomEffects'
import { loadCsvFixture } from './csvFixture'

const PANEL = join(dirname(fileURLToPath(import.meta.url)), '../../../tests/e2e/fixtures/panel.csv')

// Native R 4.6.0: plm(roa ~ leverage + rd_spend + size, model="random"), clustered vcovHC arellano.
describe('runRandomEffects', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('Swamy–Arora estimates + clustered SE + R² vs native R 4.6.0', async () => {
    const r = await runRandomEffects(engine, loadCsvFixture(PANEL), 'firm', 'year', 'roa', ['leverage', 'rd_spend', 'size'])
    expect(r.nObs).toBe(96)
    expect(r.nEntities).toBe(12)
    const int = r.coefRows.find((c) => c.term === '(Intercept)')!
    expect(int.b).toBeCloseTo(-0.765470, 4)
    expect(int.se).toBeCloseTo(0.276531, 4)
    const lev = r.coefRows.find((c) => c.term === 'leverage')!
    expect(lev.b).toBeCloseTo(-4.053601, 4)
    expect(lev.se).toBeCloseTo(1.289718, 4)
    expect(lev.ciLow).toBeCloseTo(-6.615093, 3)
    expect(r.coefRows.find((c) => c.term === 'rd_spend')!.b).toBeCloseTo(0.547641, 4)
    expect(r.coefRows.find((c) => c.term === 'size')!.b).toBeCloseTo(0.956744, 4)
    expect(r.r2).toBeCloseTo(0.98005, 5)
    expect(r.adjR2).toBeCloseTo(0.9793994, 5)
    expect(Array.from(r.figCoefPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)
})
