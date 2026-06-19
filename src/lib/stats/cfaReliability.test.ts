import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runCfaReliability } from './cfaReliability'
import { loadCsvFixture } from './csvFixture'
import { join } from 'node:path'

// Reference values: native R 4.6.0, HolzingerSwineford x1–x9 (tests/e2e/fixtures/scale.csv).
// 3-construct model: visual=[x1,x2,x3], textual=[x4,x5,x6], speed=[x7,x8,x9].
// Derived 2026-06-19 via Rscript: lavaan::cfa(std.lv=FALSE), semTools::AVE, semTools::compRelSEM,
// psych::alpha (raw_alpha), lavInspect(fit,"cor.lv"), semTools::htmt.
//
// AVE:  visual=0.3705588726, textual=0.7210162828, speed=0.4244882926
// CR=ω: visual=0.6120051511, textual=0.8850607732, speed=0.6858416922
// α:    visual=0.6261171319, textual=0.8827069129, speed=0.6884550230
// Fornell-Larcker diagonal = sqrt(AVE):
//        visual=0.6087354702, textual=0.8491267767, speed=0.6515276606
// Fornell-Larcker off-diagonal (latent correlations):
//        [0][1]=0.4585093004, [0][2]=0.4705345445, [1][2]=0.2829847304
// HTMT off-diagonals:
//        visual-textual=0.3840885639, visual-speed=0.3867729305, textual-speed=0.2796835510

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

    // AVE (native R: semTools::AVE)
    expect(vis.ave).toBeCloseTo(0.3706, 3)
    expect(tex.ave).toBeCloseTo(0.7210, 3)
    expect(spd.ave).toBeCloseTo(0.4245, 3)

    // CR = omega (congeneric identity — engine returns same value for both)
    expect(vis.cr).toBeCloseTo(vis.omega, 6)
    expect(tex.cr).toBeCloseTo(tex.omega, 6)
    expect(spd.cr).toBeCloseTo(spd.omega, 6)

    // omega (= CR, native R: semTools::compRelSEM)
    expect(vis.omega).toBeCloseTo(0.6120, 3)
    expect(tex.omega).toBeCloseTo(0.8851, 3)
    expect(spd.omega).toBeCloseTo(0.6858, 3)

    // alpha (native R: psych::alpha raw_alpha per construct)
    expect(vis.alpha).toBeCloseTo(0.6261, 3)
    expect(tex.alpha).toBeCloseTo(0.8827, 3)
    expect(spd.alpha).toBeCloseTo(0.6885, 3)

    // --- Fornell-Larcker matrix ---
    // diagonal = sqrt(AVE) (native R: sqrt(semTools::AVE(fit)))
    expect(result.fornellLarcker[0][0]).toBeCloseTo(0.6087, 3)
    expect(result.fornellLarcker[1][1]).toBeCloseTo(0.8491, 3)
    expect(result.fornellLarcker[2][2]).toBeCloseTo(0.6515, 3)
    // off-diagonal = latent correlations (native R: lavInspect(fit,"cor.lv"))
    expect(result.fornellLarcker[0][1]).toBeCloseTo(0.4585, 3)
    expect(result.fornellLarcker[0][2]).toBeCloseTo(0.4705, 3)
    expect(result.fornellLarcker[1][2]).toBeCloseTo(0.2830, 3)
    // symmetry
    expect(result.fornellLarcker[0][1]).toBeCloseTo(result.fornellLarcker[1][0], 6)
    expect(result.fornellLarcker[0][2]).toBeCloseTo(result.fornellLarcker[2][0], 6)
    expect(result.fornellLarcker[1][2]).toBeCloseTo(result.fornellLarcker[2][1], 6)

    // --- HTMT matrix ---
    // off-diagonals (native R: semTools::htmt)
    // [0][1] = visual-textual, [0][2] = visual-speed, [1][2] = textual-speed
    expect(result.htmt[0][1]).toBeCloseTo(0.3841, 3)
    expect(result.htmt[0][2]).toBeCloseTo(0.3868, 3)
    expect(result.htmt[1][2]).toBeCloseTo(0.2797, 3)
    // symmetry
    expect(result.htmt[0][1]).toBeCloseTo(result.htmt[1][0], 6)
    expect(result.htmt[0][2]).toBeCloseTo(result.htmt[2][0], 6)
    expect(result.htmt[1][2]).toBeCloseTo(result.htmt[2][1], 6)
  }, 600_000)
})
