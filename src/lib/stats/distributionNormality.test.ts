import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runDistributionNormality } from './distributionNormality'
import type { Dataset } from './types'

// long12 = the sample's 12 scores. Cross-verified (spike wf_fe92c580-dcb): WebR R 4.6.0 ≡ native R 4.6.0 on every digit.
const scores = [72, 68, 75, 70, 66, 71, 81, 79, 85, 83, 78, 88]
const data: Dataset = { columns: ['score'], rows: [
  ...scores.map((score) => ({ score })),
  { score: null }, { score: 'n/a' }, // single-column drop: both rows EXCLUDED, never coerced to 0
] }

describe('runDistributionNormality', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('long12 known answers: Shapiro W/p + Lilliefors D/p, single-column drop, both PNGs', async () => {
    const r = await runDistributionNormality(engine, data, 'score')
    expect(r.nExcluded).toBe(2)
    expect(r.n).toBe(12)
    expect(r.shapiro.W).toBeCloseTo(0.9633, 3)   // 0.963261809
    expect(r.shapiro.p).toBeCloseTo(0.8292, 3)   // 0.829180865
    expect(r.ks.D).toBeCloseTo(0.1462, 3)        // 0.146181269
    expect(r.ks.p).toBeCloseTo(0.6814, 3)        // 0.681426721
    expect(Array.from(r.histogramPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(Array.from(r.qqPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('N above 5000 → Shapiro nulls (outside 3–5000), K–S still reports (structural — no unverified numbers)', async () => {
    const big: Dataset = { columns: ['x'], rows: Array.from({ length: 5001 }, (_, i) => ({ x: ((i * 37) % 1000) + i / 5001 })) }
    const r = await runDistributionNormality(engine, big, 'x')
    expect(r.n).toBe(5001)
    expect(r.shapiro).toEqual({ W: null, p: null })
    expect(r.ks.D).toBeGreaterThan(0)
    expect(r.ks.p).toBeGreaterThanOrEqual(0)
    expect(r.ks.p).toBeLessThanOrEqual(1)
    expect(Array.from(r.histogramPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(Array.from(r.qqPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('N = 4 (minRule admits 3): Shapiro runs, Lilliefors guarded null below its n = 5 floor (structural)', async () => {
    const r = await runDistributionNormality(engine, { columns: ['x'], rows: [66, 72, 79, 88].map((x) => ({ x })) }, 'x')
    expect(r.shapiro.W).not.toBeNull()
    expect(r.ks).toEqual({ D: null, p: null })
  })
})
