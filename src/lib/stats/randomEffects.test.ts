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

  // Theme-4: Breusch–Pagan LM test (RE vs pooled OLS) via plm::plmtest(pooling, type='bp') + Swamy–Arora
  // variance components / theta. Native R 4.6.0 plm 2.6-7: chisq=0.06952968, df=1, p=0.7920228, theta=0.04205488,
  // sigma2 idios=0.2500838, individual=0.00280499.
  it('BP LM test (RE vs pooled OLS) + variance components / theta vs native R 4.6.0', async () => {
    const r = await runRandomEffects(engine, loadCsvFixture(PANEL), 'firm', 'year', 'roa', ['leverage', 'rd_spend', 'size'])
    expect(r.bpLm).toBeCloseTo(0.06952968, 5)
    expect(r.bpDf).toBe(1)
    expect(r.bpP).toBeCloseTo(0.7920228, 4)
    expect(r.theta).toBeCloseTo(0.0420548809841274, 5)
    expect(r.varIdiosyncratic).toBeCloseTo(0.2500838, 5)
    expect(r.varEntity).toBeCloseTo(0.00280499, 5)
  }, 900_000)
})
