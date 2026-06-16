import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Engine } from '../webr/engine'
import { runHausmanTest } from './hausmanTest'
import { loadCsvFixture } from './csvFixture'

const PANEL = join(dirname(fileURLToPath(import.meta.url)), '../../../tests/e2e/fixtures/panel.csv')

// Native R 4.6.0: plm::phtest(within, random) on panel.csv → χ²=3.071622, df=3, p=0.380714 (favours RE).
describe('runHausmanTest', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('phtest statistic + FE/RE comparison + clustered SE/CI + per-col R² vs native R 4.6.0', async () => {
    const r = await runHausmanTest(engine, loadCsvFixture(PANEL), 'firm', 'year', 'roa', ['leverage', 'rd_spend', 'size'])
    expect(r.chisq).toBeCloseTo(3.071622, 4)
    expect(r.df).toBe(3)
    expect(r.p).toBeCloseTo(0.380714, 5)
    expect(r.nObs).toBe(96)
    expect(r.nEntities).toBe(12)
    const lev = r.compareRows.find((c) => c.term === 'leverage')!
    expect(lev.feB).toBeCloseTo(-5.574297, 4)
    expect(lev.reB).toBeCloseTo(-4.053601, 4)
    expect(lev.diff).toBeCloseTo(-1.520696, 4)
    // clustered (arellano HC1, group) SE + 95% CI per model — surfaced for the coef table
    expect(lev.feSe).toBeCloseTo(1.466992, 4)
    expect(lev.feCiLow).toBeCloseTo(-8.493151, 4)
    expect(lev.feCiHigh).toBeCloseTo(-2.655444, 4)
    expect(lev.reSe).toBeCloseTo(1.289718, 4)
    expect(lev.reCiLow).toBeCloseTo(-6.615093, 4)
    expect(lev.reCiHigh).toBeCloseTo(-1.492110, 4)
    expect(r.feR2).toBeCloseTo(0.914498, 4)
    expect(r.reR2).toBeCloseTo(0.980050, 4)
    expect(r.ciLevel).toBe(0.95)
    expect(r.compareRows.map((c) => c.term)).toEqual(['leverage', 'rd_spend', 'size'])
    expect(Array.from(r.figCoefPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)
})
