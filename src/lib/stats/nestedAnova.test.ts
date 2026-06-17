import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { loadAnovaFixture } from './fixtures/anova'
import { runNestedAnova } from './nestedAnova'
import type { Dataset } from './types'

describe('runNestedAnova', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('RANDOM nesting: fixture outcome ~ school/classroom spike known answers', async () => {
    const ds = loadAnovaFixture()
    const r = await runNestedAnova(engine, ds, 'outcome', 'school', 'classroom', true)

    // SS (both modes share identical SS/MS)
    expect(r.rows[0].ss).toBeCloseTo(307.069, 2)
    expect(r.rows[1].ss).toBeCloseTo(311.229, 2)
    expect(r.rows[0].ms).toBeCloseTo(153.5345, 4)
    expect(r.rows[1].ms).toBeCloseTo(103.743, 3)

    // dfA=2, dfB=3
    expect(r.rows[0].df).toBe(2)
    expect(r.rows[1].df).toBe(3)

    // Random: F_school uses B(A) as error, errDf=3
    expect(r.rows[0].f).toBeCloseTo(1.4799504544885, 6)
    expect(r.rows[0].errDf).toBe(3)
    expect(r.rows[0].p).toBeCloseTo(0.357127524540067, 6)

    // F_class uses residual, df 3/54
    expect(r.rows[1].f).toBeCloseTo(1.99454911069684, 6)
    expect(r.rows[1].errDf).toBe(54)

    // ω²
    expect(r.rows[0].omega2).not.toBeNull()
    expect(r.rows[0].omega2!).toBeCloseTo(0.0583618541479071, 6)
    expect(r.rows[1].omega2).not.toBeNull()
    expect(r.rows[1].omega2!).toBeCloseTo(0.0446070727986374, 6)

    // ω² one-sided CI — effectsize::omega_squared(ci=0.95): native R ≡ WebR, upper bound pinned at 1.00 (APA convention)
    expect(r.rows[0].omega2Low!).toBeCloseTo(0, 3)
    expect(r.rows[0].omega2High!).toBeCloseTo(1, 3)
    expect(r.rows[1].omega2Low!).toBeCloseTo(0, 3)
    expect(r.rows[1].omega2High!).toBeCloseTo(1, 3)

    // No crossed labels in the clean fixture
    expect(r.crossed).toEqual([])
    expect(r.nExcluded).toBe(0)
    expect(r.figurePng.length).toBeGreaterThan(1000)
  }, 900_000)

  it('FIXED nesting: F_school uses residual (df 2/54)', async () => {
    const ds = loadAnovaFixture()
    const r = await runNestedAnova(engine, ds, 'outcome', 'school', 'classroom', false)

    expect(r.rows[0].f).toBeCloseTo(2.95183386287543, 6)
    expect(r.rows[0].errDf).toBe(54)
    expect(r.rows[0].p).toBeCloseTo(0.0607280510032202, 6)

    // F_class unchanged (still vs residual)
    expect(r.rows[1].f).toBeCloseTo(1.99454911069684, 6)
    expect(r.rows[1].errDf).toBe(54)

    // SS/MS identical in both modes
    expect(r.rows[0].ss).toBeCloseTo(307.069, 2)
  }, 900_000)

  it('crossed detector: relabelled classrooms yield crossed labels', async () => {
    const ds = loadAnovaFixture()
    // Relabel all classroom values to 'c1' or 'c2' (appears in multiple schools → crossed)
    const doctoredRows = ds.rows.map((row, i) => ({ ...row, classroom: i % 2 === 0 ? 'c1' : 'c2' }))
    const doctored: Dataset = { columns: ds.columns, rows: doctoredRows }
    const r = await runNestedAnova(engine, doctored, 'outcome', 'school', 'classroom', true)
    expect(r.crossed.sort()).toEqual(['c1', 'c2'])
  }, 900_000)
})
