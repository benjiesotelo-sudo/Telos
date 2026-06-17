import { describe, it, expect } from 'vitest'
import { buildNestedAnova } from './buildNestedAnova'
import { NESTED_ANOVA as spec } from '../registry/nestedAnova'
import type { NestedAnovaResult } from '../stats/nestedAnova'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

// Spike fixture result (outcome ~ school / classroom, random nesting)
const spikeResult: NestedAnovaResult = {
  rows: [
    { source: 'A', ss: 307.069, df: 2, ms: 153.5345, f: 1.4799504544885, p: 0.357127524540067, omega2: 0.0583618541479071, omega2Low: 0, omega2High: 1, errDf: 3 },
    { source: 'B', ss: 311.228999999999, df: 3, ms: 103.743, f: 1.99454911069684, p: 0.12570562659026, omega2: 0.0446070727986374, omega2Low: 0, omega2High: 1, errDf: 54 },
  ],
  desc: [
    { group: 'north', n: 20, m: 32.475, sd: 7.4660547603 },
    { group: 'south', n: 20, m: 33.845, sd: 6.9070882737 },
    { group: 'west', n: 20, m: 37.81, sd: 7.794728313 },
  ],
  levene: { F: 0.0224210737, p: 0.9778370299 },
  shapiro: { W: 0.976442458, p: 0.2970228268 },
  factor: 'school', nested: 'classroom',
  nesting: 'random',
  crossed: [],
  alpha: 0.05,
  nExcluded: 0,
  figurePng: png,
}

describe('buildNestedAnova', () => {
  const c = buildNestedAnova(spec, spikeResult)

  it('produces two tables: descriptives then the nested-anova table', () => {
    expect(c.tables).toHaveLength(2)
    expect(c.tables[0].spec.id).toBe('descriptives')
    expect(c.tables[1].spec.id).toBe('nested-anova')
    expect(c.tables[1].spec.captionStyle).toBe('bare')
  })

  it('descriptives table reports per top-level group N / M / SD', () => {
    expect(c.tables[0].rows).toEqual([
      { group: 'north', n: 20, m: '32.48', sd: '7.47' },
      { group: 'south', n: 20, m: '33.84', sd: '6.91' },
      { group: 'west', n: 20, m: '37.81', sd: '7.79' },
    ])
  })

  it('anova table rows have substituted source labels', () => {
    expect(c.tables[1].rows[0].source).toBe('school')
    expect(c.tables[1].rows[1].source).toBe('classroom (nested in school)')
  })

  it('row A numeric formatting matches spike numbers', () => {
    const rowA = c.tables[1].rows[0]
    expect(rowA.ss).toBe('307.07')
    expect(rowA.df).toBe('2')
    expect(rowA.ms).toBe('153.53')
    expect(rowA.f).toBe('1.48')
    expect(rowA.p).toBe('.357')
    expect(rowA.omega2).toBe('0.06 [0.00, 1.00]')  // effectsize::omega_squared(ci=0.95): one-sided CI, upper pinned at 1.00
  })

  it('row B numeric formatting matches spike numbers', () => {
    const rowB = c.tables[1].rows[1]
    expect(rowB.ss).toBe('311.23')
    expect(rowB.df).toBe('3')
    expect(rowB.f).toBe('1.99')
    expect(rowB.omega2).toBe('0.04 [0.00, 1.00]')
  })

  it('APA string uses random errDf=3 (df 2/3) and reports ω² with its one-sided CI', () => {
    // F(2,3)=1.48, p = .357, ω²=.06 [.00, 1.00] (row A; f01 drops the leading zero on bounded statistics)
    expect(c.apa).toBe('A nested ANOVA for A gave F(2,3)=1.48, p = .357, ω²=.06 [.00, 1.00].')
  })

  it('assume-note = registry text + runtime Levene/Shapiro stats (no crossed warning when crossed is empty)', () => {
    expect(c.note).toEqual({
      kind: 'assume',
      text: spec.tableNote!.text + ' (Levene F=0.02, p=.978 · Shapiro W=0.98, p=.297)',
    })
  })

  it('figure carries spec caption and type', () => {
    expect(c.figures[0]).toEqual({ caption: 'Grouped means', type: 'grouped means plot (nested groups within each top-level group)', file: 'grouped-means', png })
  })

  it('howToRead and nExcluded forwarded', () => {
    expect(c.howToRead).toBe(spec.howToRead + ' Your significance threshold (α) is 0.05.')
    expect(c.nExcluded).toBe(0)
  })
})

describe('buildNestedAnova — crossed warning', () => {
  const resultWithCrossed: NestedAnovaResult = { ...spikeResult, crossed: ['c1', 'c2'] }
  const c = buildNestedAnova(spec, resultWithCrossed)

  it('appends crossed warning sentence after the assume stats when crossed is non-empty', () => {
    expect(c.note!.kind).toBe('assume')
    expect(c.note!.text).toBe(
      spec.tableNote!.text +
      ' (Levene F=0.02, p=.978 · Shapiro W=0.98, p=.297)' +
      ' — classroom labels repeat across school levels; results assume distinct groups within each school — check your coding',
    )
  })
})

describe('buildNestedAnova — omega2 not estimable', () => {
  const resultNullOmega: NestedAnovaResult = {
    ...spikeResult,
    rows: [
      { ...spikeResult.rows[0], omega2: null, omega2Low: null, omega2High: null },
      { ...spikeResult.rows[1], omega2: null, omega2Low: null, omega2High: null },
    ],
  }
  const c = buildNestedAnova(spec, resultNullOmega)

  it('renders em-dash (whole cell) when omega2 is not estimable', () => {
    expect(c.tables[1].rows[0].omega2).toBe('—')
    expect(c.tables[1].rows[1].omega2).toBe('—')
  })

  it('APA em-dashes the ω² clause when ω² is not estimable', () => {
    expect(c.apa).toBe('A nested ANOVA for A gave F(2,3)=1.48, p = .357, ω²=— [—, —].')
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
    expect(c.apa).toBe('A nested ANOVA for A gave F(2,54)=2.95, p = .061, ω²=.06 [.00, 1.00].')
  })

  it('note uses fixed-nesting text + shared assumption sentence + runtime stats (not random denominator explanation)', () => {
    expect(c.note!.kind).toBe('assume')
    expect(c.note!.text).toBe(
      'Under fixed nesting both F rows are tested against the residual mean square — the two F rows share the same denominator. Variance components (or ω²) are reported as the effect size where estimable. ' +
      "Assumption checks: Levene's (equal variances across top-level groups) & normality of residuals (Shapiro-Wilk)." +
      ' (Levene F=0.02, p=.978 · Shapiro W=0.98, p=.297)',
    )
  })
})
