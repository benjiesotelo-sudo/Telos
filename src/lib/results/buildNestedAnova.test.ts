import { describe, it, expect } from 'vitest'
import { buildNestedAnova } from './buildNestedAnova'
import { NESTED_ANOVA as spec } from '../registry/nestedAnova'
import type { NestedAnovaResult } from '../stats/nestedAnova'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

// Spike fixture result (outcome ~ school / classroom, random nesting)
const spikeResult: NestedAnovaResult = {
  rows: [
    { source: 'A', ss: 307.069, df: 2, ms: 153.5345, f: 1.4799504544885, p: 0.357127524540067, omega2: 0.0583618541479071, errDf: 3 },
    { source: 'B', ss: 311.228999999999, df: 3, ms: 103.743, f: 1.99454911069684, p: 0.12570562659026, omega2: 0.0446070727986374, errDf: 54 },
  ],
  factor: 'school', nested: 'classroom',
  nesting: 'random',
  crossed: [],
  nExcluded: 0,
  figurePng: png,
}

describe('buildNestedAnova', () => {
  const c = buildNestedAnova(spec, spikeResult)

  it('produces exactly one table with the nested-anova spec', () => {
    expect(c.tables).toHaveLength(1)
    expect(c.tables[0].spec.id).toBe('nested-anova')
    expect(c.tables[0].spec.captionStyle).toBe('bare')
  })

  it('table rows have substituted source labels', () => {
    expect(c.tables[0].rows[0].source).toBe('school')
    expect(c.tables[0].rows[1].source).toBe('classroom (nested in school)')
  })

  it('row A numeric formatting matches spike numbers', () => {
    const rowA = c.tables[0].rows[0]
    expect(rowA.ss).toBe('307.07')
    expect(rowA.df).toBe('2')
    expect(rowA.ms).toBe('153.53')
    expect(rowA.f).toBe('1.48')
    expect(rowA.p).toBe('.357')
    expect(rowA.omega2).toBe('0.06')
  })

  it('row B numeric formatting matches spike numbers', () => {
    const rowB = c.tables[0].rows[1]
    expect(rowB.ss).toBe('311.23')
    expect(rowB.df).toBe('3')
    expect(rowB.f).toBe('1.99')
    expect(rowB.omega2).toBe('0.04')
  })

  it('APA string uses random errDf=3 (df 2/3)', () => {
    // F(2,3)=1.48, p = .357
    expect(c.apa).toBe('A nested ANOVA for A gave F(2,3)=1.48, p = .357.')
  })

  it('note equals card plain text (no crossed warning when crossed is empty)', () => {
    expect(c.note).toEqual({ kind: 'plain', text: spec.tableNote!.text })
  })

  it('figure carries spec caption and type', () => {
    expect(c.figures[0]).toEqual({ caption: 'Grouped means', type: 'grouped means plot (nested groups within each top-level group)', file: 'grouped-means', png })
  })

  it('howToRead and nExcluded forwarded', () => {
    expect(c.howToRead).toBe(spec.howToRead)
    expect(c.nExcluded).toBe(0)
  })
})

describe('buildNestedAnova — crossed warning', () => {
  const resultWithCrossed: NestedAnovaResult = { ...spikeResult, crossed: ['c1', 'c2'] }
  const c = buildNestedAnova(spec, resultWithCrossed)

  it('appends crossed warning sentence to the note when crossed is non-empty', () => {
    expect(c.note!.kind).toBe('plain')
    expect(c.note!.text).toBe(
      spec.tableNote!.text +
      ' — classroom labels repeat across school levels; results assume distinct groups within each school — check your coding',
    )
  })
})

describe('buildNestedAnova — omega2 not estimable', () => {
  const resultNullOmega: NestedAnovaResult = {
    ...spikeResult,
    rows: [
      { ...spikeResult.rows[0], omega2: null },
      { ...spikeResult.rows[1], omega2: null },
    ],
  }
  const c = buildNestedAnova(spec, resultNullOmega)

  it('renders em-dash when omega2 is null', () => {
    expect(c.tables[0].rows[0].omega2).toBe('—')
    expect(c.tables[0].rows[1].omega2).toBe('—')
  })
})

describe('buildNestedAnova — fixed nesting APA and note', () => {
  const fixedResult: NestedAnovaResult = {
    ...spikeResult,
    nesting: 'fixed',
    rows: [
      { ...spikeResult.rows[0], f: 2.95183386287543, p: 0.0607280510032202, errDf: 54 },
      { ...spikeResult.rows[1] },
    ],
  }
  const c = buildNestedAnova(spec, fixedResult)

  it('APA uses fixed errDf=54 (df 2/54)', () => {
    expect(c.apa).toBe('A nested ANOVA for A gave F(2,54)=2.95, p = .061.')
  })

  it('note uses fixed-nesting text (not random-nesting denominator explanation)', () => {
    expect(c.note!.kind).toBe('plain')
    expect(c.note!.text).toBe(
      'Under fixed nesting both F rows are tested against the residual mean square — the two F rows share the same denominator. Variance components (or ω²) are reported as the effect size where estimable.',
    )
  })
})
