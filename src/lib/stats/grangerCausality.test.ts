import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runGrangerCausality } from './grangerCausality'
import type { Dataset } from './types'

// ── Spike dataset 1 — lh-shift ────────────────────────────────────────────────
// R's built-in `lh` (luteinizing hormone, n=48); x = lh[1:47], y = lh[2:48].
// grangertest(y ~ x, order=1) → F=2.1551252 (the spec anchor value).
// This is the specific spike pinned in the implementation plan.
const LH = [
  2.4, 2.4, 2.4, 2.2, 2.1, 1.5, 2.3, 2.3, 2.5, 2, 1.9, 1.7,
  2.2, 1.8, 3.2, 3.2, 2.7, 2.2, 2.2, 1.9, 1.9, 1.8, 2.7, 3,
  2.3, 2, 2, 2.9, 2.9, 2.7, 2.7, 2.3, 2.6, 2.4, 1.8, 1.7,
  1.5, 1.4, 2.1, 3.3, 3.5, 3.5, 3.1, 2.6, 2.1, 3.4, 3, 2.9,
]
function makeLhShiftDataset(): Dataset {
  const x = LH.slice(0, 47)
  const y = LH.slice(1, 48)
  const rows = x.map((xv, i) => ({ t: i + 1, x: xv, y: y[i] }))
  return { columns: ['t', 'x', 'y'], rows }
}

// ── Spike dataset 2 — Canada macroeconomic data ───────────────────────────────
// vars::Canada[, c('prod', 'e')], n=84 quarterly observations.
// Non-degenerate in both directions; used to assert both rows against native R.
// Native R 4.6.0 (lmtest::grangertest, order=4):
//   prod → e:  F=5.281426308, df1=4, df2=75, p=0.000881310315
//   e → prod:  F=1.396189638, df1=4, df2=75, p=0.244096449230
const CANADA_PROD = [
  405.366466, 404.639834, 403.814883, 404.215773, 405.046714, 404.416739, 402.819127, 401.977335,
  402.089725, 401.306688, 401.630171, 401.563755, 402.815699, 403.142108, 403.078619, 403.718786,
  404.866799, 405.636187, 405.136285, 406.024640, 406.412270, 406.300933, 406.335352, 406.773695,
  405.152548, 404.929831, 404.576546, 404.199493, 405.949856, 405.822092, 406.446283, 407.051248,
  407.946024, 408.179585, 408.599813, 409.090561, 408.704215, 408.980275, 408.328690, 407.885697,
  407.260532, 406.775151, 406.179414, 405.439793, 403.279971, 403.364856, 403.380680, 404.003183,
  404.477398, 404.786783, 405.271004, 405.382993, 405.156416, 406.470043, 406.229309, 406.726484,
  408.578505, 409.676710, 410.385763, 410.539524, 410.445258, 410.625605, 410.867240, 411.235918,
  410.663655, 410.808508, 412.115962, 412.999407, 412.955057, 412.824133, 413.048875, 413.611018,
  413.604782, 412.968388, 412.265887, 412.910594, 413.829416, 414.224152, 415.167771, 415.701580,
  416.867407, 417.610399, 418.002980, 417.266680,
]
const CANADA_E = [
  929.610514, 929.803985, 930.318388, 931.427687, 932.662006, 933.550940, 933.531526, 933.076879,
  932.123753, 930.635939, 929.097060, 928.563336, 929.069380, 930.265516, 931.677032, 932.138968,
  932.276686, 932.832783, 933.733419, 934.177206, 934.592840, 935.606710, 936.511086, 937.420090,
  938.415922, 938.999170, 939.235355, 939.679504, 940.249674, 941.435819, 942.298096, 943.532223,
  944.348970, 944.821489, 945.067137, 945.806726, 946.869662, 946.876612, 947.249692, 947.651276,
  948.183971, 948.349239, 948.032171, 947.106483, 946.079554, 946.183812, 946.225795, 945.997784,
  945.518279, 945.351398, 945.291786, 945.400786, 945.905810, 945.903470, 946.319029, 946.579621,
  946.780032, 947.628284, 948.622058, 949.399183, 949.948138, 949.794494, 949.953380, 950.250239,
  950.538031, 950.787128, 950.869529, 950.928132, 951.845722, 952.600476, 953.597553, 954.143388,
  954.542593, 955.263136, 956.056053, 956.796586, 957.386480, 958.063416, 958.716592, 959.488142,
  960.362493, 960.783379, 961.029030, 961.765710,
]
function makeCanadaDataset(): Dataset {
  const rows = CANADA_PROD.map((p, i) => ({ t: i + 1, prod: p, e: CANADA_E[i] }))
  return { columns: ['t', 'prod', 'e'], rows }
}

// ── Test suite ────────────────────────────────────────────────────────────────

describe('runGrangerCausality', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike anchor — lh-shift X→Y: F=2.1551252 matches native R 4.6.0 to ≥5 sig figs', async () => {
    const r = await runGrangerCausality(engine, makeLhShiftDataset(), 't', 'x', 'y', { maxLag: 1 })

    expect(r.n).toBe(47)
    expect(r.nExcluded).toBe(0)
    expect(r.maxLag).toBe(1)
    expect(r.rows).toHaveLength(2)

    // X→Y row (the spec spike anchor)
    const xy = r.rows[0]
    expect(xy.direction).toBe('X→Y')
    expect(xy.f).toBeCloseTo(2.155125224357145, 5)   // native R 4.6.0: 2.1551252
    expect(xy.df1).toBe(1)                            // order=1 → df1=1
    expect(xy.df2).toBe(44)                           // Res.Df of restricted model
    expect(xy.p).toBeCloseTo(0.149372281033554, 5)

    // Figure: valid PNG bytes
    expect(Array.from(r.figCrossSeriesPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('Canada dataset — both directions match native R 4.6.0 to ≥5 sig figs (order=4)', async () => {
    const r = await runGrangerCausality(engine, makeCanadaDataset(), 't', 'prod', 'e', { maxLag: 4 })

    expect(r.n).toBe(84)
    expect(r.nExcluded).toBe(0)
    expect(r.maxLag).toBe(4)

    // X→Y: prod Granger-causes e
    const xy = r.rows[0]
    expect(xy.direction).toBe('X→Y')
    expect(xy.f).toBeCloseTo(5.281426308154, 5)
    expect(xy.df1).toBe(4)
    expect(xy.df2).toBe(75)
    expect(xy.p).toBeCloseTo(0.000881310315, 7)

    // Y→X: e Granger-causes prod (not significant)
    const yx = r.rows[1]
    expect(yx.direction).toBe('Y→X')
    expect(yx.f).toBeCloseTo(1.396189637978, 5)
    expect(yx.df1).toBe(4)
    expect(yx.df2).toBe(75)
    expect(yx.p).toBeCloseTo(0.244096449230, 5)
  }, 300_000)

  it('listwise: drops rows with missing time, x, or y', async () => {
    const ds: Dataset = {
      columns: ['t', 'x', 'y'],
      rows: [
        ...CANADA_PROD.slice(0, 25).map((p, i) => ({ t: i + 1, x: p, y: CANADA_E[i] })),
        { t: 26, x: null, y: CANADA_E[25] },   // missing x
        { t: 27, x: CANADA_PROD[26], y: null }, // missing y
        { t: null, x: CANADA_PROD[27], y: CANADA_E[27] }, // missing time
        ...CANADA_PROD.slice(28, 57).map((p, i) => ({ t: i + 29, x: p, y: CANADA_E[i + 28] })),
      ],
    }
    const r = await runGrangerCausality(engine, ds, 't', 'x', 'y', { maxLag: 4 })
    expect(r.nExcluded).toBe(3)
    expect(r.n).toBe(54) // 25 + 29 = 54 complete rows
  }, 300_000)

  it('sort-by-time: shuffled rows produce the same X→Y F value as sorted', async () => {
    const shuffled: Dataset = {
      columns: ['t', 'prod', 'e'],
      rows: [...CANADA_PROD.map((p, i) => ({ t: i + 1, prod: p, e: CANADA_E[i] }))].reverse(),
    }
    const r = await runGrangerCausality(engine, shuffled, 't', 'prod', 'e', { maxLag: 4 })
    expect(r.rows[0].f).toBeCloseTo(5.281426308154, 5)
  }, 300_000)
})
