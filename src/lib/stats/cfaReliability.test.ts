import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runCfaReliability } from './cfaReliability'
import { loadCsvFixture } from './csvFixture'
import { join } from 'node:path'

// Reference values: native R 4.6.0, HolzingerSwineford x1–x9 (tests/e2e/fixtures/scale.csv).
// 3-construct model: visual=[x1,x2,x3], textual=[x4,x5,x6], speed=[x7,x8,x9].
// Verified via 2026-06-18-sem-feasibility-spike.md + task-8-brief.md.
//
// AVE:  visual≈0.371, textual≈0.721, speed≈0.424
// CR=ω: visual≈0.612, textual≈0.885, speed≈0.686
// α:    visual≈0.626, textual≈0.883, speed≈0.689
// Fornell-Larcker diagonal = sqrt(AVE): visual≈0.609, textual≈0.849, speed≈0.651
// HTMT off-diagonals: visual-textual≈0.384, visual-speed≈0.387, textual-speed≈0.280

const CONSTRUCTS = [
  { name: 'visual', items: ['x1', 'x2', 'x3'] },
  { name: 'textual', items: ['x4', 'x5', 'x6'] },
  { name: 'speed', items: ['x7', 'x8', 'x9'] },
]

describe('cfaReliability', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('3-construct CFA on HolzingerSwineford x1–x9 matches native-R reference values', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/scale.csv'))
    const result = await runCfaReliability(engine, data, CONSTRUCTS)

    // --- structure ---
    expect(result.labels).toEqual(['visual', 'textual', 'speed'])
    expect(result.perConstruct).toHaveLength(3)
    expect(result.fornellLarcker).toHaveLength(3)
    expect(result.htmt).toHaveLength(3)

    // --- per-construct indices ---
    const [vis, tex, spd] = result.perConstruct
    expect(vis.name).toBe('visual')
    expect(tex.name).toBe('textual')
    expect(spd.name).toBe('speed')

    // AVE
    expect(vis.ave).toBeCloseTo(0.371, 2)
    expect(tex.ave).toBeCloseTo(0.721, 2)
    expect(spd.ave).toBeCloseTo(0.424, 2)

    // CR = omega (congeneric identity)
    expect(vis.cr).toBeCloseTo(vis.omega, 6)
    expect(tex.cr).toBeCloseTo(tex.omega, 6)
    expect(spd.cr).toBeCloseTo(spd.omega, 6)

    // omega (= CR)
    expect(vis.omega).toBeCloseTo(0.612, 2)
    expect(tex.omega).toBeCloseTo(0.885, 2)
    expect(spd.omega).toBeCloseTo(0.686, 2)

    // alpha (psych::alpha raw_alpha per construct)
    expect(vis.alpha).toBeCloseTo(0.626, 2)
    expect(tex.alpha).toBeCloseTo(0.883, 2)
    expect(spd.alpha).toBeCloseTo(0.689, 2)

    // --- Fornell-Larcker matrix ---
    // diagonal = sqrt(AVE)
    expect(result.fornellLarcker[0][0]).toBeCloseTo(0.609, 2)
    expect(result.fornellLarcker[1][1]).toBeCloseTo(0.849, 2)
    expect(result.fornellLarcker[2][2]).toBeCloseTo(0.651, 2)
    // off-diagonal = inter-construct correlations (symmetric); check one pair
    expect(result.fornellLarcker[0][1]).toBeCloseTo(result.fornellLarcker[1][0], 6)
    // all off-diagonals finite
    expect(Number.isFinite(result.fornellLarcker[0][1])).toBe(true)
    expect(Number.isFinite(result.fornellLarcker[0][2])).toBe(true)
    expect(Number.isFinite(result.fornellLarcker[1][2])).toBe(true)

    // --- HTMT matrix ---
    // symmetric, off-diagonals match reference (to 2dp)
    // task brief: visual-textual≈0.384, visual-speed≈0.387, textual-speed≈0.280
    // [0][1] = visual-textual, [0][2] = visual-speed, [1][2] = textual-speed
    expect(result.htmt[0][1]).toBeCloseTo(0.384, 2)
    expect(result.htmt[0][2]).toBeCloseTo(0.387, 2)
    expect(result.htmt[1][2]).toBeCloseTo(0.280, 2)
    // symmetry
    expect(result.htmt[0][1]).toBeCloseTo(result.htmt[1][0], 6)
    expect(result.htmt[0][2]).toBeCloseTo(result.htmt[2][0], 6)
    expect(result.htmt[1][2]).toBeCloseTo(result.htmt[2][1], 6)
  }, 600_000)
})
