import { describe, it, expect } from 'vitest'
import {
  CELL_1_ML_LISTWISE,
  CELL_2_ML_FIML,
  CELL_3_ML_PAIRWISE,
  CELL_4_MLR_LISTWISE,
  CELL_5_MLR_FIML,
  CELL_6_WLSMV_LISTWISE,
  CELL_7_WLSMV_PAIRWISE,
  PATH_WLSMV_SAT,
  PATH_WLSMV_STRUCT,
  type H1PinCell,
} from './h1Pins'

// H1 estimator/missing wiring (Task 4): the pins module holds native-R 4.6.0 / lavaan 0.6-21
// ground truth for the 7-cell estimator x missing-data matrix. This test does not re-derive any
// number (that is Task 5's real-WebR known-answer job) - it just guards the pins module's own
// shape/integrity: all 7 cells present, every numeric finite, and the two degeneracy traps the
// Task 0 spike flagged (WLSMV listwise vs pairwise; MLR vs its same-missing ML sibling) are
// genuinely distinguishable, not silently byte-identical copies.

const ALL_CELLS: Record<string, H1PinCell> = {
  CELL_1_ML_LISTWISE,
  CELL_2_ML_FIML,
  CELL_3_ML_PAIRWISE,
  CELL_4_MLR_LISTWISE,
  CELL_5_MLR_FIML,
  CELL_6_WLSMV_LISTWISE,
  CELL_7_WLSMV_PAIRWISE,
}

function allNumbers(cell: H1PinCell): number[] {
  return [
    ...Object.values(cell.fit),
    ...cell.structural.flatMap((row) => [row.est, row.se, row.ciLower, row.ciUpper].filter((v): v is number => v !== undefined)),
  ]
}

describe('h1Pins - 7-cell estimator/missing matrix (native-R pins)', () => {
  it('exports exactly 7 cells', () => {
    expect(Object.keys(ALL_CELLS)).toHaveLength(7)
  })

  it('every numeric value in every cell parses as a finite number', () => {
    for (const [name, cell] of Object.entries(ALL_CELLS)) {
      const numbers = allNumbers(cell)
      expect(numbers.length, `${name} has no pinned numbers`).toBeGreaterThan(0)
      for (const n of numbers) {
        expect(Number.isFinite(n), `${name} has a non-finite pinned value: ${n}`).toBe(true)
      }
    }
  })

  it('each cell carries its own estimator/missing tag matching its export name', () => {
    expect(CELL_1_ML_LISTWISE).toMatchObject({ estimator: 'ML', missing: 'listwise' })
    expect(CELL_2_ML_FIML).toMatchObject({ estimator: 'ML', missing: 'fiml' })
    expect(CELL_3_ML_PAIRWISE).toMatchObject({ estimator: 'ML', missing: 'pairwise' })
    expect(CELL_4_MLR_LISTWISE).toMatchObject({ estimator: 'MLR', missing: 'listwise' })
    expect(CELL_5_MLR_FIML).toMatchObject({ estimator: 'MLR', missing: 'fiml' })
    expect(CELL_6_WLSMV_LISTWISE).toMatchObject({ estimator: 'WLSMV', missing: 'listwise' })
    expect(CELL_7_WLSMV_PAIRWISE).toMatchObject({ estimator: 'WLSMV', missing: 'pairwise' })
  })

  it('degeneracy guard: WLSMV listwise pins genuinely differ from WLSMV pairwise pins (likert5-missing fixture, not the holeless likert5.csv the spike flagged as byte-identical)', () => {
    expect(CELL_6_WLSMV_LISTWISE.fit['chisq.scaled']).not.toBeCloseTo(CELL_7_WLSMV_PAIRWISE.fit['chisq.scaled'], 7)
    expect(CELL_6_WLSMV_LISTWISE.structural[0].est).not.toBeCloseTo(CELL_7_WLSMV_PAIRWISE.structural[0].est, 7)
  })

  it('the two MLR cells differ numerically from their same-missing ML siblings (robust/scaled fit indices are a genuine estimator effect)', () => {
    // MLR/listwise vs ML/listwise: chisq/df/pvalue/cfi/tli/rmsea/srmr are IDENTICAL (same point
    // estimates under MLR/ML for a complete-data fit); the estimator effect shows up in the
    // .scaled/.robust fit indices and in the structural path's se/CI (robust sandwich SE).
    expect(CELL_4_MLR_LISTWISE.fit['chisq.scaled']).not.toBeCloseTo(CELL_1_ML_LISTWISE.fit.chisq, 7)
    expect(CELL_4_MLR_LISTWISE.structural[0].se).not.toBeCloseTo(CELL_1_ML_LISTWISE.structural[0].se, 7)

    // MLR/fiml vs ML/fiml
    expect(CELL_5_MLR_FIML.fit['chisq.scaled']).not.toBeCloseTo(CELL_2_ML_FIML.fit.chisq, 7)
    expect(CELL_5_MLR_FIML.structural[0].se).not.toBeCloseTo(CELL_2_ML_FIML.structural[0].se, 7)
  })
})

// Path-mode WLSMV pins (path-mode WLSMV slice, Task 1): same shape-integrity discipline as the
// 7-cell matrix above, extended minimally to the two new exports. These are a plain
// structural-regression fit (no latent constructs), a genuinely different model shape from
// cells 1-7, so they get their own small describe block rather than being folded into ALL_CELLS.
describe('h1Pins - path-mode WLSMV pins (native-R pins, Task 1 of the path-mode WLSMV slice)', () => {
  const PATH_CELLS: Record<string, H1PinCell> = { PATH_WLSMV_SAT, PATH_WLSMV_STRUCT }

  it('both exports are present and tagged WLSMV / listwise', () => {
    expect(PATH_WLSMV_SAT).toMatchObject({ estimator: 'WLSMV', missing: 'listwise' })
    expect(PATH_WLSMV_STRUCT).toMatchObject({ estimator: 'WLSMV', missing: 'listwise' })
  })

  it('every numeric value in every cell parses as a finite number', () => {
    for (const [name, cell] of Object.entries(PATH_CELLS)) {
      const numbers = allNumbers(cell)
      expect(numbers.length, `${name} has no pinned numbers`).toBeGreaterThan(0)
      for (const n of numbers) {
        expect(Number.isFinite(n), `${name} has a non-finite pinned value: ${n}`).toBe(true)
      }
    }
  })

  it('PATH_WLSMV_SAT carries exactly its 2 structural paths (cont2 ~ a1, cont2 ~ b1); PATH_WLSMV_STRUCT adds cont1 ~ cont2 on top', () => {
    expect(PATH_WLSMV_SAT.structural.map((row) => row.param)).toEqual(['cont2 ~ a1', 'cont2 ~ b1'])
    expect(PATH_WLSMV_STRUCT.structural.map((row) => row.param)).toEqual(['cont2 ~ a1', 'cont2 ~ b1', 'cont1 ~ cont2'])
  })

  it('the two cells are genuinely different fits, not copies (saturated df=0 vs non-saturated df=2)', () => {
    expect(PATH_WLSMV_SAT.fit.df).toBe(0)
    expect(PATH_WLSMV_STRUCT.fit.df).toBe(2)
    expect(PATH_WLSMV_SAT.structural[0].est).not.toBeCloseTo(PATH_WLSMV_STRUCT.structural[0].est, 7)
  })
})
