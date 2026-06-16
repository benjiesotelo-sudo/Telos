import { describe, it, expect } from 'vitest'
import { assocDescEmitters, assocDescPackages } from './assocDesc'
import type { TestSetup } from '../../../../state/session'
import type { Dataset } from '../../../stats/types'

// Helpers — each emitter is (spec, setup, dataset). spec is unused by this family, so a stub is fine.
const spec = {} as never
const setup = (roles: Record<string, string[]>, options: Record<string, boolean | number | string> = {}, props: Record<string, number> = {}): TestSetup =>
  ({ roles, options, props, blocked: null })
const ds: Dataset = {
  columns: ['x', 'y', 'grp', 'row', 'col', 'cat'],
  rows: [
    { x: 1, y: 2, grp: 'a', row: 'p', col: 'q', cat: 'r' },
    { x: 3, y: 4, grp: 'b', row: 'p', col: 'q', cat: 's' },
  ],
}
const emit = (id: string, st: TestSetup) => assocDescEmitters[id](spec, st, ds)

describe('assocDesc emitters', () => {
  it('exposes an emitter + package list for every catalog id it owns', () => {
    for (const id of ['pearson', 'spearman', 'kendalls-tau', 'chi-square-independence', 'chi-square-goodness-of-fit',
      'fishers-exact', 'summary-statistics', 'frequencies-crosstabs', 'distribution-normality']) {
      expect(typeof assocDescEmitters[id]).toBe('function')
      expect(Array.isArray(assocDescPackages[id])).toBe(true)
    }
  })

  describe('pearson', () => {
    const r = emit('pearson', setup({ variableA: ['x'], variableB: ['y'] }, { ci: '99%', tails: 'one-tailed (greater)' }))
    it('mirrors cor.test(method = "pearson") on the threaded columns', () => {
      expect(r).toContain('cor.test(d[["x"]], d[["y"]]')
      expect(r).toContain('method = "pearson"')
    })
    it('threads CI level and alternative', () => {
      expect(r).toContain('conf.level = 0.99')
      expect(r).toContain('alternative = "greater"')
    })
    it('emits the scatter + lm smooth figure', () => {
      expect(r).toContain('geom_point')
      expect(r).toContain('geom_smooth(method = "lm")')
    })
    it('defaults tails to two.sided and CI to 0.95', () => {
      const d = emit('pearson', setup({ variableA: ['x'], variableB: ['y'] }))
      expect(d).toContain('alternative = "two.sided"')
      expect(d).toContain('conf.level = 0.95')
    })
  })

  describe('spearman', () => {
    const r = emit('spearman', setup({ variableA: ['x'], variableB: ['y'] }, { tails: 'one-tailed (less)' }))
    it('mirrors cor.test(method = "spearman", exact = FALSE)', () => {
      expect(r).toContain('cor.test(d[["x"]], d[["y"]]')
      expect(r).toContain('method = "spearman"')
      expect(r).toContain('exact = FALSE')
      expect(r).toContain('alternative = "less"')
    })
    it('emits a plain scatter (no lm smooth)', () => {
      expect(r).toContain('geom_point')
      expect(r).not.toContain('geom_smooth')
    })
  })

  describe('kendalls-tau', () => {
    const r = emit('kendalls-tau', setup({ variableA: ['x'], variableB: ['y'] }))
    it('mirrors cor.test(method = "kendall", exact = FALSE)', () => {
      expect(r).toContain('method = "kendall"')
      expect(r).toContain('exact = FALSE')
      expect(r).toContain('d[["x"]]')
      expect(r).toContain('d[["y"]]')
    })
  })

  describe('chi-square-independence', () => {
    it('builds table() then chisq.test with the continuity toggle threaded (on)', () => {
      const r = emit('chi-square-independence', setup({ rowVar: ['row'], colVar: ['col'] }, { continuity: true }))
      expect(r).toContain('table(sub[["row"]], sub[["col"]])')
      expect(r).toContain('chisq.test(')
      expect(r).toContain('correct = TRUE')
    })
    it('pre-filters blank/whitespace/NA cells on both columns before tabulating (drops the read.csv "" phantom)', () => {
      const r = emit('chi-square-independence', setup({ rowVar: ['row'], colVar: ['col'] }, { continuity: true }))
      expect(r).toContain('sub <- d[!is.na(d[["row"]]) & trimws(d[["row"]]) != "" & !is.na(d[["col"]]) & trimws(d[["col"]]) != "", ]')
    })
    it('threads continuity = FALSE when toggled off', () => {
      const r = emit('chi-square-independence', setup({ rowVar: ['row'], colVar: ['col'] }, { continuity: false }))
      expect(r).toContain('correct = FALSE')
    })
    it('emits the grouped bar figure', () => {
      const r = emit('chi-square-independence', setup({ rowVar: ['row'], colVar: ['col'] }, { continuity: true }))
      expect(r).toContain("geom_bar(position = \"dodge\")")
    })
  })

  describe('chi-square-goodness-of-fit', () => {
    it('chisq.test on table() with equal expected split by default (no p =)', () => {
      const r = emit('chi-square-goodness-of-fit', setup({ variable: ['cat'] }))
      expect(r).toContain('table(sub[["cat"]])')
      expect(r).toContain('chisq.test(')
      expect(r).not.toContain('p = c(')
    })
    it('pre-filters blank/whitespace/NA cells before tabulating (drops the read.csv "" phantom)', () => {
      const r = emit('chi-square-goodness-of-fit', setup({ variable: ['cat'] }))
      expect(r).toContain('sub <- d[!is.na(d[["cat"]]) & trimws(d[["cat"]]) != "", ]')
    })
    it('emits an explicit p = expected-probabilities vector for custom proportions', () => {
      const r = emit('chi-square-goodness-of-fit', setup({ variable: ['cat'] }, { expectedProps: 'custom' }, { r: 0.25, s: 0.75 }))
      expect(r).toContain('pr <- c(0.25, 0.75)')
      expect(r).toContain('chisq.test(tab, p = pr)')
    })
  })

  describe('fishers-exact', () => {
    const r = emit('fishers-exact', setup({ rowVar: ['row'], colVar: ['col'] }, { tails: 'one-tailed (greater)' }))
    it('mirrors fisher.test on table() with alternative threaded', () => {
      expect(r).toContain('table(sub[["row"]], sub[["col"]])')
      expect(r).toContain('fisher.test(')
      expect(r).toContain('alternative = "greater"')
    })
    it('pre-filters blank/whitespace/NA cells on both columns before tabulating', () => {
      expect(r).toContain('sub <- d[!is.na(d[["row"]]) & trimws(d[["row"]]) != "" & !is.na(d[["col"]]) & trimws(d[["col"]]) != "", ]')
    })
  })

  describe('summary-statistics', () => {
    it('describes each variable with psych::describe on a data.frame (ungrouped)', () => {
      const r = emit('summary-statistics', setup({ variables: ['x', 'y'], groupBy: [] }))
      expect(r).toContain('psych::describe(data.frame(x = d[["x"]]))')
      expect(r).toContain('psych::describe(data.frame(x = d[["y"]]))')
      expect(r).toContain('geom_histogram')
    })
    it('uses describeBy on a data.frame (NOT a bare vector) when a group column is assigned', () => {
      const r = emit('summary-statistics', setup({ variables: ['x'], groupBy: ['grp'] }))
      expect(r).toContain('psych::describeBy(data.frame(x = d[["x"]]), group = d[["grp"]], mat = TRUE)')
      // Guard against the spike-forbidden bare-vector anti-pattern that yields the 'X1*' / mean=3 garbage.
      expect(r).not.toContain('describeBy(d[["x"]]')
      expect(r).not.toContain('describeBy(d$x')
    })
  })

  describe('frequencies-crosstabs', () => {
    it('one variable -> tabyl frequency table + bar, pre-filtering the "" phantom', () => {
      const r = emit('frequencies-crosstabs', setup({ variables: ['cat'] }))
      expect(r).toContain('sub <- d[!is.na(d[["cat"]]) & trimws(d[["cat"]]) != "", ]')
      expect(r).toContain('janitor::tabyl(sub[["cat"]])')
      expect(r).toContain('geom_bar')
    })
    it('two variables -> tabyl cross-tab with adorn_totals + grouped bar, pre-filtering both columns', () => {
      const r = emit('frequencies-crosstabs', setup({ variables: ['row', 'col'] }))
      expect(r).toContain('sub <- d[!is.na(d[["row"]]) & trimws(d[["row"]]) != "" & !is.na(d[["col"]]) & trimws(d[["col"]]) != "", ]')
      expect(r).toContain('janitor::tabyl(sub, row, col)')
      expect(r).toContain('adorn_totals')
      expect(r).toContain("position = \"dodge\"")
    })
  })

  describe('distribution-normality', () => {
    const r = emit('distribution-normality', setup({ variable: ['x', 'y'] }))
    it('runs shapiro.test + nortest::lillie.test per variable on the cleaned vector', () => {
      expect(r).toContain('xv <- na.omit(d[["x"]]); nv <- length(xv)')
      expect(r).toContain('print(shapiro.test(xv))')
      expect(r).toContain('print(nortest::lillie.test(xv))')
      expect(r).toContain('xv <- na.omit(d[["y"]]); nv <- length(xv)')
    })
    it('guards both tests so a small-n column never halts the script (shapiro [3,5000], lillie n>=5)', () => {
      expect(r).toContain('if (nv >= 3 && nv <= 5000) print(shapiro.test(xv)) else')
      expect(r).toContain('if (nv >= 5) print(nortest::lillie.test(xv)) else')
    })
    it('emits both the histogram and the qq figure', () => {
      expect(r).toContain('geom_histogram')
      expect(r).toContain('stat_qq()')
      expect(r).toContain('stat_qq_line()')
    })
  })
})
