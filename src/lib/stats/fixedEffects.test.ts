import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Engine } from '../webr/engine'
import { runFixedEffects } from './fixedEffects'
import { loadCsvFixture } from './csvFixture'

const PANEL = join(dirname(fileURLToPath(import.meta.url)), '../../../tests/e2e/fixtures/panel.csv')

// Native R 4.6.0 ground truth on panel.csv (docs/superpowers/reviews/2026-06-15-panel-causal-spike.md):
//   plm(roa ~ leverage + rd_spend + size, model="within"), clustered vcovHC(method="arellano", type="HC1").
describe('runFixedEffects', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('clustered within estimates + model fit + poolability vs native R 4.6.0', async () => {
    const r = await runFixedEffects(engine, loadCsvFixture(PANEL), 'firm', 'year', 'roa', ['leverage', 'rd_spend', 'size'])
    expect(r.nObs).toBe(96)
    expect(r.nEntities).toBe(12)
    expect(r.nExcluded).toBe(0)

    const lev = r.coefRows.find((c) => c.term === 'leverage')!
    expect(lev.b).toBeCloseTo(-5.574297, 4)
    expect(lev.se).toBeCloseTo(1.466992, 4)
    expect(lev.t).toBeCloseTo(-3.799815, 3)
    expect(lev.p).toBeCloseTo(0.000279, 5)
    expect(lev.ciLow).toBeCloseTo(-8.493151, 3)
    expect(lev.ciHigh).toBeCloseTo(-2.655444, 3)
    expect(r.coefRows.find((c) => c.term === 'rd_spend')!.b).toBeCloseTo(1.888007, 4)
    expect(r.coefRows.find((c) => c.term === 'size')!.b).toBeCloseTo(0.140074, 4)

    expect(r.withinR2).toBeCloseTo(0.9144979, 5)
    expect(r.adjR2).toBeCloseTo(0.8997198, 5)
    expect(r.fStat).toBeCloseTo(288.7818, 2)
    expect(r.fDf1).toBe(3)
    expect(r.fDf2).toBe(81)
    expect(r.poolF).toBeCloseTo(1.291747, 4)   // §2.8 poolability F-test
    expect(r.poolP).toBeCloseTo(0.2442503, 5)

    expect(Array.from(r.figCoefPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]) // PNG magic
  }, 900_000)

  it('classical SE differs from clustered; 90% CI is narrower than 95%', async () => {
    const ds = loadCsvFixture(PANEL)
    const clustered = await runFixedEffects(engine, ds, 'firm', 'year', 'roa', ['leverage', 'rd_spend', 'size'], { ciLevel: 0.95 })
    const classical = await runFixedEffects(engine, ds, 'firm', 'year', 'roa', ['leverage', 'rd_spend', 'size'], { seClustered: false })
    const cl = clustered.coefRows.find((c) => c.term === 'leverage')!
    const cn = classical.coefRows.find((c) => c.term === 'leverage')!
    expect(cn.se).not.toBeCloseTo(cl.se, 3)          // classical ≠ clustered SE
    const narrow = await runFixedEffects(engine, ds, 'firm', 'year', 'roa', ['leverage', 'rd_spend', 'size'], { ciLevel: 0.90 })
    const n90 = narrow.coefRows.find((c) => c.term === 'leverage')!
    expect(n90.ciHigh - n90.ciLow).toBeLessThan(cl.ciHigh - cl.ciLow)
  }, 900_000)

  it('guards: fewer than 2 entities errors clearly', async () => {
    const ds = loadCsvFixture(PANEL)
    const one = { columns: ds.columns, rows: ds.rows.filter((r) => r.firm === 'firm01') }
    await expect(runFixedEffects(engine, one, 'firm', 'year', 'roa', ['leverage', 'rd_spend', 'size']))
      .rejects.toThrow(/at least 2 entities/)
  }, 300_000)
})
