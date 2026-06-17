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

// anxiety known answers recomputed in native R 4.6.0 (2026-06-12): shapiro W=0.985295280 p=0.988459795 ·
// lillie D=0.079371235 p=1.000000000 (Lilliefors p is capped at 1)
const anxiety = [35, 42, 29, 38, 45, 33, 27, 22, 25, 31, 36]
const twoVar: Dataset = { columns: ['score', 'anxiety'], rows: scores.map((score, i) => ({
  score, anxiety: i < anxiety.length ? anxiety[i] : null, // last row's anxiety missing → per-variable N
})) }

describe('runDistributionNormality', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('long12 known answers: Shapiro W/p + Lilliefors D/p, single-column drop, both PNGs', async () => {
    const r = await runDistributionNormality(engine, data, ['score'])
    expect(r.variables).toHaveLength(1)
    const v = r.variables[0]
    expect(v.variable).toBe('score')
    expect(v.nExcluded).toBe(2)
    expect(v.n).toBe(12)
    expect(v.shapiro.W).toBeCloseTo(0.9633, 3)   // 0.963261809
    expect(v.shapiro.p).toBeCloseTo(0.8292, 3)   // 0.829180865
    expect(v.ks.D).toBeCloseTo(0.1462, 3)        // 0.146181269
    expect(v.ks.p).toBeCloseTo(0.6814, 3)        // 0.681426721
    expect(v.skew).toBeCloseTo(0.1144, 3)        // psych::describe type 3, native R 4.6.0: 0.1143992142
    expect(v.kurtosis).toBeCloseTo(-1.4922, 3)   // excess kurtosis (type 3): -1.4922046390
    expect(Array.from(v.histogramPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(Array.from(v.qqPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('two variables: per-variable known answers, per-variable N and exclusions, four PNGs', async () => {
    const r = await runDistributionNormality(engine, twoVar, ['score', 'anxiety'])
    expect(r.variables.map((v) => v.variable)).toEqual(['score', 'anxiety'])
    const [s, a] = r.variables
    expect(s.n).toBe(12); expect(s.nExcluded).toBe(0)
    expect(s.shapiro.W).toBeCloseTo(0.9633, 3)
    expect(s.skew).toBeCloseTo(0.1144, 3)                // long12 skew (type 3): 0.1143992142
    expect(s.kurtosis).toBeCloseTo(-1.4922, 3)           // long12 excess kurtosis: -1.4922046390
    expect(a.n).toBe(11); expect(a.nExcluded).toBe(1)   // the null row drops for anxiety only
    expect(a.shapiro.W).toBeCloseTo(0.9853, 3)           // 0.985295280
    expect(a.shapiro.p).toBeCloseTo(0.9885, 3)           // 0.988459795
    expect(a.ks.D).toBeCloseTo(0.0794, 3)                // 0.079371235
    expect(a.ks.p).toBeCloseTo(1.0, 3)                   // capped at 1
    expect(a.skew).toBeCloseTo(0.1235, 3)                // anxiety11 skew (type 3): 0.1234803294
    expect(a.kurtosis).toBeCloseTo(-1.2705, 3)           // anxiety11 excess kurtosis: -1.2705455920
    for (const v of r.variables) {
      expect(Array.from(v.histogramPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
      expect(Array.from(v.qqPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    }
  })

  it('N above 5000 → Shapiro nulls (outside 3–5000), K–S still reports (structural — no unverified numbers)', async () => {
    const big: Dataset = { columns: ['x'], rows: Array.from({ length: 5001 }, (_, i) => ({ x: ((i * 37) % 1000) + i / 5001 })) }
    const r = await runDistributionNormality(engine, big, ['x'])
    const v = r.variables[0]
    expect(v.n).toBe(5001)
    expect(v.shapiro).toEqual({ W: null, p: null })
    expect(v.ks.D).toBeGreaterThan(0)
    expect(v.ks.p).toBeGreaterThanOrEqual(0)
    expect(v.ks.p).toBeLessThanOrEqual(1)
    expect(Array.from(v.histogramPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(Array.from(v.qqPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('N = 4 (minRule admits 3): Shapiro runs, Lilliefors guarded null below its n = 5 floor (structural)', async () => {
    const r = await runDistributionNormality(engine, { columns: ['x'], rows: [66, 72, 79, 88].map((x) => ({ x })) }, ['x'])
    expect(r.variables[0].shapiro.W).not.toBeNull()
    expect(r.variables[0].ks).toEqual({ D: null, p: null })
  })

  // README doc config (docs/test-documentation/03_distribution-normality): students.csv, score + anxiety.
  // Ground truth from native R 4.6.0 psych::describe(data.frame(x=x)) (type 3, excess kurtosis):
  // score n=14 skew=0.3013384093 kurtosis=-1.3336563344 · anxiety n=13 skew=-0.1114607449 kurtosis=-1.2784113361
  it('README config (students.csv): score + anxiety skew/kurtosis ≡ native R psych::describe (type 3, excess)', async () => {
    const score = [72, 68, 75, 70, 66, 71, 81, 79, 85, 83, 78, 88, 74, 69]
    const anxiety = [35, 42, 29, 38, 45, 33, null, 27, 22, 25, 31, 19, 36, 40] // id 7 anxiety missing in students.csv
    const ds: Dataset = { columns: ['score', 'anxiety'], rows: score.map((s, i) => ({ score: s, anxiety: anxiety[i] })) }
    const r = await runDistributionNormality(engine, ds, ['score', 'anxiety'])
    const [s, a] = r.variables
    expect(s.n).toBe(14)
    expect(s.skew).toBeCloseTo(0.3013, 3)        // 0.3013384093
    expect(s.kurtosis).toBeCloseTo(-1.3337, 3)   // -1.3336563344
    expect(a.n).toBe(13); expect(a.nExcluded).toBe(1)
    expect(a.skew).toBeCloseTo(-0.1115, 3)       // -0.1114607449
    expect(a.kurtosis).toBeCloseTo(-1.2784, 3)   // -1.2784113361
  })
})
