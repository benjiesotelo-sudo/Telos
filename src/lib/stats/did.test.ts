import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Engine } from '../webr/engine'
import { runDid } from './did'
import { loadCsvFixture } from './csvFixture'

const PANEL = join(dirname(fileURLToPath(import.meta.url)), '../../../tests/e2e/fixtures/panel.csv')

// Native R 4.6.0: plm::plm(roa ~ post + post:treated, model='within'), clustered-by-firm SE
// (plm::vcovHC arellano/HC1) → post:treated = 1.525625, post = 2.015083, within R² = 0.8406621.
// The within transform absorbs the time-invariant Treated main effect — only Post + Treated×Post are estimated.
describe('runDid', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('entity-FE DiD interaction + clustered-by-entity SE vs native R 4.6.0', async () => {
    const r = await runDid(engine, loadCsvFixture(PANEL), 'roa', 'treated', 'post', 'firm', 'year')
    expect(r.nObs).toBe(96)
    expect(r.nEntities).toBe(12)
    expect(r.withinR2).toBeCloseTo(0.8406621, 4)
    expect(r.fStat).toBeCloseTo(216.3148, 2)
    // Overall within-F df + p (native R 4.6.0: summary(fit)$fstatistic) → F(2, 82), p ≈ 1.97e-33.
    expect(r.fDf1).toBe(2)
    expect(r.fDf2).toBe(82)
    expect(r.fP).toBeCloseTo(1.972789e-33, 38)
    // Treated main effect is absorbed: only Post + Treated×Post are returned
    expect(r.coefRows.map((c) => c.term).sort()).toEqual(['po', 'po:tr'])
    const did = r.coefRows.find((c) => c.term === 'po:tr')!
    expect(did.b).toBeCloseTo(1.525625, 4)         // DiD effect must match the prior build
    expect(did.se).toBeCloseTo(0.116532, 4)        // clustered (plm::vcovHC arellano/HC1) — verifies under WebR
    expect(did.ciLow).toBeCloseTo(1.293806, 4)
    expect(did.ciHigh).toBeCloseTo(1.757444, 4)
    const post = r.coefRows.find((c) => c.term === 'po')!
    expect(post.b).toBeCloseTo(2.015083, 4)
    expect(post.se).toBeCloseTo(0.086275, 4)
    expect(post.ciLow).toBeCloseTo(1.843456, 4)
    expect(post.ciHigh).toBeCloseTo(2.186711, 4)
    expect(Array.from(r.figTrendsPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    // Pre-trends signal: pre-period (post=0) leads-and-lags joint F of treated×factor(year) interactions —
    // base lm(roa ~ treated*factor(year)) vs lm(roa ~ treated+factor(year)), anova(). Native R 4.6.0:
    // F(3, 40) = 0.004068, p = 0.999636 → parallel pre-trends hold.
    expect(r.preTrend).not.toBeNull()
    expect(r.preTrend!.F).toBeCloseTo(0.004068, 5)
    expect(r.preTrend!.df1).toBe(3)
    expect(r.preTrend!.df2).toBe(40)
    expect(r.preTrend!.p).toBeCloseTo(0.999636, 5)
  }, 900_000)

  it('guards: a treatment with ≠2 groups errors clearly', async () => {
    const ds = loadCsvFixture(PANEL)
    await expect(runDid(engine, ds, 'roa', 'firm', 'post', 'firm', 'year')) // firm has 12 groups
      .rejects.toThrow(/exactly 2 groups/)
  }, 300_000)
})
