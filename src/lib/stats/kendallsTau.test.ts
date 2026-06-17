import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runKendallsTau } from './kendallsTau'
import { loadAssociationFixture } from './fixtures/association'

describe('runKendallsTau', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike known answers — tied ordinal pair (satisfaction × motivation)', async () => {
    const r = await runKendallsTau(engine, loadAssociationFixture(), 'satisfaction', 'motivation')
    expect(r.tau).toBeCloseTo(0.7490683239, 6)
    expect(r.z).toBeCloseTo(5.708916072, 6)
    expect(r.p).toBeCloseTo(1.136979369e-08, 9)
    expect(r.n).toBe(40)
    expect(r.tauLow).toBeCloseTo(0.6639087530, 3)   // seeded percentile bootstrap (set.seed(20260617), R=2000): native R ≡ WebR
    expect(r.tauHigh).toBeCloseTo(0.8220388862, 3)
  }, 900_000)

  it('spike known answers — continuous pair (hours_studied × exam_score)', async () => {
    const r = await runKendallsTau(engine, loadAssociationFixture(), 'hours_studied', 'exam_score')
    expect(r.tau).toBeCloseTo(0.4688504499, 6)
    expect(r.z).toBeCloseTo(4.253493058, 6)
    expect(r.p).toBeCloseTo(2.104614657e-05, 9)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 300_000)
})
