import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runSpearman } from './spearman'
import { loadAssociationFixture } from './fixtures/association'

describe('runSpearman', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike known answers — tied ordinal pair (satisfaction × motivation)', async () => {
    const r = await runSpearman(engine, loadAssociationFixture(), 'satisfaction', 'motivation')
    expect(r.rho).toBeCloseTo(0.8468402828, 6)
    expect(r.s).toBeCloseTo(1632.682586, 4)
    expect(r.p).toBeCloseTo(5.716192287e-12, 9)
    expect(r.n).toBe(40)
    // ρ CI via seeded base-R percentile bootstrap (set.seed(20260617), R=2000) — native R ≡ WebR (spike-verified, same seed)
    expect(r.rhoLow).toBeCloseTo(0.7571, 3)
    expect(r.rhoHigh).toBeCloseTo(0.9011, 3)
  }, 900_000)

  it('spike known answers — continuous pair (hours_studied × exam_score)', async () => {
    const r = await runSpearman(engine, loadAssociationFixture(), 'hours_studied', 'exam_score')
    expect(r.rho).toBeCloseTo(0.6549233014, 6)
    expect(r.s).toBeCloseTo(3678.517607, 4)
    expect(r.p).toBeCloseTo(4.536450066e-06, 9)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 300_000)
})
