import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runCronbachsAlpha, type CronbachResult } from './cronbachsAlpha'
import { loadCsvFixture } from './csvFixture'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// Fixture: lavaan::HolzingerSwineford1939[, paste0("x",1:9)] (n=301, 9 items, no reverse keys)
// Generated via: write.csv(..., row.names=FALSE, quote=FALSE)
// Reference values: native R 4.6.0
//   psych::alpha(d)$total$raw_alpha             = 0.760488595825
//   psych::alpha(d)$feldt$lower.ci$raw_alpha    = 0.717716865952
//   psych::alpha(d)$feldt$upper.ci$raw_alpha    = 0.799078832562
//   cfa(1-factor, std.lv=TRUE, ML) + compRelSEM
//   omega                                        = 0.629613911775
//   bootstrapLavaan(R=2000, set.seed(20260619)) quantile(2.5%)  = 0.5265363
//   bootstrapLavaan(R=2000, set.seed(20260619)) quantile(97.5%) = 0.7198204
//   nItems = 9, nCases = 301
//   item r.drop:  x1=0.5220367, x2=0.2752431, x3=0.3701721, x4=0.5807066,
//                 x5=0.5253854, x6=0.5951390, x7=0.2457316, x8=0.3690554, x9=0.4947810
//   alpha.drop:   x1=0.7248063, x2=0.7642313, x3=0.7489560, x4=0.7150013,
//                 x5=0.7235720, x6=0.7141540, x7=0.7664368, x8=0.7484245, x9=0.7310302

const FIXTURES = fileURLToPath(new URL('../../../tests/e2e/fixtures/', import.meta.url))
const ITEMS = ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9']

// nboot=200 keeps WebR wall-clock manageable (~4 min); production default is 2000.
const TEST_NBOOT = 200

describe('runCronbachsAlpha', () => {
  const engine = new Engine()
  let result: CronbachResult

  beforeAll(async () => {
    await engine.init()
    const ds = loadCsvFixture(join(FIXTURES, 'scale.csv'))
    // One engine call; all stat/figure tests read from `result`
    result = await runCronbachsAlpha(engine, ds, ITEMS, 20260619, TEST_NBOOT)
  }, 600_000)

  afterAll(async () => { await engine.close() })

  it('omega (headline) matches native R 4.6.0 (ML CFA + compRelSEM)', () => {
    // omega is the headline reliability statistic — McDonald's ω, not Cronbach's α
    expect(result.omega).toBeCloseTo(0.629613911775, 3)
  })

  it('omegaCi is a plausible bootstrap 95% CI around omega', () => {
    // CI is stochastic; wide tolerance to survive WebR RNG + only 200 bootstrap draws
    // Native R 2000-boot CI: [0.527, 0.720]; allow generous bounds here
    expect(result.omegaCi[0]).toBeGreaterThan(0.40)
    expect(result.omegaCi[0]).toBeLessThan(result.omega)
    expect(result.omegaCi[1]).toBeGreaterThan(result.omega)
    expect(result.omegaCi[1]).toBeLessThan(0.85)
    expect(result.omegaCi[0]).toBeLessThan(result.omegaCi[1])
  })

  it('alpha (secondary) matches native R 4.6.0', () => {
    expect(result.alpha).toBeCloseTo(0.760488595825, 4)
  })

  it('stdAlpha matches native R 4.6.0 psych::alpha()$total$std.alpha', () => {
    // Native R: psych::alpha(d)$total$std.alpha = 0.7604022
    expect(result.stdAlpha).toBeCloseTo(0.7604022, 4)
    // std.alpha is always finite and plausibly near raw alpha
    expect(Number.isFinite(result.stdAlpha)).toBe(true)
    expect(Math.abs(result.stdAlpha - result.alpha)).toBeLessThan(0.05)
  })

  it('alphaCi (Feldt) matches native R 4.6.0 (exact/deterministic)', () => {
    expect(result.alphaCi[0]).toBeCloseTo(0.717716865952, 3)
    expect(result.alphaCi[1]).toBeCloseTo(0.799078832562, 3)
  })

  it('nItems and nCases are correct', () => {
    expect(result.nItems).toBe(9)
    expect(result.nCases).toBe(301)
  })

  it('itemTotal: corrected item-total r matches native R 4.6.0 to 4dp', () => {
    const EXP_R = [0.5220367, 0.2752431, 0.3701721, 0.5807066, 0.5253854, 0.5951390, 0.2457316, 0.3690554, 0.4947810]
    expect(result.itemTotal).toHaveLength(9)
    expect(result.itemTotal.map((it) => it.item)).toEqual(ITEMS)
    for (let i = 0; i < 9; i++) {
      expect(result.itemTotal[i].r).toBeCloseTo(EXP_R[i], 4)
    }
  })

  it('itemTotal: alpha-if-dropped matches native R 4.6.0 to 4dp', () => {
    const EXP_DROP = [0.7248063, 0.7642313, 0.7489560, 0.7150013, 0.7235720, 0.7141540, 0.7664368, 0.7484245, 0.7310302]
    for (let i = 0; i < 9; i++) {
      expect(result.itemTotal[i].alphaDropped).toBeCloseTo(EXP_DROP[i], 4)
    }
  })

  it('figItemTotalPng starts with PNG magic bytes (drop-item on by default)', () => {
    // figItemTotalPng is defined when dropItem=true (the default)
    expect(Array.from(result.figItemTotalPng!.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('listwise: drops rows missing any item, nCases reflects filtered count', async () => {
    const ds = loadCsvFixture(join(FIXTURES, 'scale.csv'))
    ds.rows[0]['x1'] = null
    const r = await runCronbachsAlpha(engine, ds, ITEMS, 20260619, TEST_NBOOT)
    expect(r.nCases).toBe(300)
  }, 600_000)
})
