import { describe, it, expect } from 'vitest'
import { buildFactorialAnova } from './buildFactorialAnova'
import { FACTORIAL_ANOVA as spec } from '../registry/factorialAnova'
import type { FactorialAnovaResult } from '../stats/factorialAnova'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

// Spike numbers: outcome ~ group * gender on fixture (nothing significant at α=.05)
const fixtureResult: FactorialAnovaResult = {
  rows: [
    { source: 'group', ss: 131.605, df: 2, ms: 65.8025, f: 3.04188224848381, p: 0.0560001080368759, pes: 0.101254715777249 },
    { source: 'gender', ss: 61.504, df: 1, ms: 61.504, f: 2.84368260584025, p: 0.097503832286258, pes: 0.050026361338315 },
    { source: 'group × gender', ss: 107.476, df: 2, ms: 53.738, f: 2.48491031233834, p: 0.0928168303408816, pes: 0.0842773569943164 },
  ],
  desc: [
    // 6 cells, n=10 each (totalN=60)
    { cell: 'control × f', n: 10, m: 29.5, sd: 4.2 },
    { cell: 'control × m', n: 10, m: 31.5, sd: 4.8 },
    { cell: 'drug_a × f', n: 10, m: 33.0, sd: 5.1 },
    { cell: 'drug_a × m', n: 10, m: 30.5, sd: 4.5 },
    { cell: 'drug_b × f', n: 10, m: 32.0, sd: 5.5 },
    { cell: 'drug_b × m', n: 10, m: 33.5, sd: 4.0 },
  ],
  levene: { F: 1.23, p: 0.30 },
  shapiro: { W: 0.98, p: 0.42 },
  simpleEffects: [
    { term: 'group', pair: 'control - drug_a', diff: -1.37, se: 2.34, pAdj: 0.828, ciLo: -7.0, ciHi: 4.26 },
    { term: 'group', pair: 'control - drug_b', diff: -2.75, se: 2.34, pAdj: 0.482, ciLo: -8.38, ciHi: 2.88 },
    { term: 'group', pair: 'drug_a - drug_b', diff: -1.38, se: 2.34, pAdj: 0.822, ciLo: -7.01, ciHi: 4.25 },
    { term: 'gender', pair: 'f - m', diff: 1.01, se: 1.96, pAdj: 0.607, ciLo: -2.93, ciHi: 4.95 },
    { term: 'group × gender', pair: 'control - drug_a | f', diff: -3.55, se: 3.18, pAdj: 0.806, ciLo: -11.40, ciHi: 4.30 },
    { term: 'group × gender', pair: 'control - drug_a | m', diff: 0.81, se: 3.18, pAdj: 1.0, ciLo: -7.04, ciHi: 8.66 },
  ],
  nExcluded: 0,
  figurePng: png,
}

describe('buildFactorialAnova — fixture (nothing significant): Table 3 absent', () => {
  const c = buildFactorialAnova(spec, fixtureResult)

  it('renders only 2 tables when nothing is significant', () => {
    expect(c.tables).toHaveLength(2)
    expect(c.tables[0].spec.id).toBe('cell-descriptives')
    expect(c.tables[1].spec.id).toBe('anova')
  })

  it('Table 1 cell-descriptives rows formatted correctly', () => {
    expect(c.tables[0].rows[0]).toEqual({ cell: 'control × f', n: 10, m: '29.50', sd: '4.20' })
  })

  it('Table 2 ANOVA rows: group, gender, interaction with correct formatting', () => {
    expect(c.tables[1].rows).toHaveLength(3)
    // group row: f=3.04, p=.056, pes=0.10
    expect(c.tables[1].rows[0]).toMatchObject({ source: 'group', df: '2', f: '3.04', p: '.056', pes: '0.10' })
    // gender row: f=2.84, p=.098
    expect(c.tables[1].rows[1]).toMatchObject({ source: 'gender', df: '1', f: '2.84', p: '.098' })
    // interaction row: f=2.48, p=.093
    expect(c.tables[1].rows[2]).toMatchObject({ source: 'group × gender', df: '2', f: '2.48', p: '.093', pes: '0.08' })
  })

  it('APA from interaction row: F(2,54)=2.48, p=.093, partial η²=0.08', () => {
    // dfRes = 60 - 1 - (2+1+2) = 54
    expect(c.apa).toBe('A two-way ANOVA found a significant A×B interaction, F(2,54)=2.48, p=.093, partial η²=0.08.')
  })

  it('note appends Levene + Shapiro values to card assume text', () => {
    expect(c.note!.kind).toBe('assume')
    expect(c.note!.text).toContain("assumption checks: Levene's & normality of residuals")
    expect(c.note!.text).toContain('Levene F=1.23')
    expect(c.note!.text).toContain('Shapiro W=0.98')
  })

  it('figure carries the interaction plot type', () => {
    expect(c.figures).toEqual([{ caption: 'Interaction', type: 'interaction plot (one line per level of a factor)', png }])
  })
})

describe('buildFactorialAnova — doctored result (interaction p=.01): Table 3 present, interaction rows only', () => {
  // Doctor the result: interaction significant at .01, main effects still not significant
  const doctoredResult: FactorialAnovaResult = {
    ...fixtureResult,
    rows: [
      { source: 'group', ss: 131.605, df: 2, ms: 65.8025, f: 3.04, p: 0.056, pes: 0.10 },
      { source: 'gender', ss: 61.504, df: 1, ms: 61.504, f: 2.84, p: 0.098, pes: 0.05 },
      { source: 'group × gender', ss: 107.476, df: 2, ms: 53.738, f: 4.80, p: 0.012, pes: 0.15 },
    ],
  }

  const c = buildFactorialAnova(spec, doctoredResult)

  it('renders 3 tables when interaction is significant', () => {
    expect(c.tables).toHaveLength(3)
    expect(c.tables[2].spec.id).toBe('simple-effects')
  })

  it('Table 3 contains only interaction rows (main-effect terms filtered out)', () => {
    const contrastKeys = c.tables[2].rows.map((r) => (r as Record<string, string>).contrast)
    // Only interaction rows (pair contains " | ") are included
    contrastKeys.forEach((k) => { expect(k).toContain(' | ') })
    // Main-effect marginal rows (e.g. 'control - drug_a') are absent
    expect(contrastKeys.some((k) => k === 'control - drug_a')).toBe(false)
  })

  it('Table 3 rows use the contrast key, not pair', () => {
    // The column key is 'contrast' per the spec
    const firstRow = c.tables[2].rows[0]
    expect('contrast' in firstRow).toBe(true)
    expect('pair' in firstRow).toBe(false)
  })
})

describe('buildFactorialAnova — all significant: Table 3 contains all rows', () => {
  const allSigResult: FactorialAnovaResult = {
    ...fixtureResult,
    rows: [
      { source: 'group', ss: 400, df: 2, ms: 200, f: 9.0, p: 0.001, pes: 0.25 },
      { source: 'gender', ss: 200, df: 1, ms: 200, f: 9.0, p: 0.004, pes: 0.14 },
      { source: 'group × gender', ss: 300, df: 2, ms: 150, f: 6.8, p: 0.002, pes: 0.20 },
    ],
  }

  const c = buildFactorialAnova(spec, allSigResult)

  it('includes all simple-effects rows when all terms are significant', () => {
    expect(c.tables).toHaveLength(3)
    expect(c.tables[2].rows).toHaveLength(fixtureResult.simpleEffects.length)
  })
})
