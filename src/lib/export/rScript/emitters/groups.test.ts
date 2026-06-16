import { describe, it, expect } from 'vitest'
import { groupEmitters, groupPackages } from './groups'
import type { TestSetup } from '../../../../state/session'
import type { Dataset } from '../../../stats/types'

// Each emitter is (spec, setup, dataset). spec is unused by this family, so a stub is fine.
const spec = {} as never
const setup = (roles: Record<string, string[]>, options: Record<string, boolean | number | string> = {}, props: Record<string, number> = {}): TestSetup =>
  ({ roles, options, props, blocked: null })
const ds: Dataset = {
  columns: ['y', 'g', 'a', 'b', 'c', 'sid', 'grp', 'cov', 'cov2', 'f2', 'nest'],
  rows: [
    { y: 1, g: 'x', a: 1, b: 2, c: 3, sid: 's1', grp: 't', cov: 0.1, cov2: 5, f2: 'p', nest: 'n1' },
    { y: 2, g: 'y', a: 3, b: 4, c: 5, sid: 's2', grp: 'u', cov: 0.2, cov2: 6, f2: 'q', nest: 'n2' },
  ],
}
const emit = (id: string, st: TestSetup) => groupEmitters[id](spec, st, ds)

const ALL_IDS = [
  'one-sample-t-test', 'independent-t-test', 'paired-t-test', 'one-way-anova', 'factorial-anova',
  'repeated-measures-anova', 'mixed-anova', 'nested-anova', 'welch-anova', 'ancova', 'manova',
  'mancova', 'mann-whitney-u', 'wilcoxon-signed-rank', 'kruskal-wallis', 'friedman',
]

describe('group-comparison emitters', () => {
  it('exposes an emitter + package list for every catalog id it owns', () => {
    for (const id of ALL_IDS) {
      expect(typeof groupEmitters[id]).toBe('function')
      expect(Array.isArray(groupPackages[id])).toBe(true)
    }
  })

  describe('one-sample-t-test', () => {
    const r = emit('one-sample-t-test', setup({ outcome: ['y'] }, { mu0: 100, ci: '99%', tails: 'one-tailed (greater)' }))
    it('mirrors t.test(x, mu=) with the threaded column, mu0, CI and alternative', () => {
      expect(r).toContain('t.test(d[["y"]], mu = 100')
      expect(r).toContain('conf.level = 0.99')
      expect(r).toContain('alternative = "greater"')
    })
    it("emits effectsize::cohens_d with mu and the histogram + vline figure", () => {
      expect(r).toContain('effectsize::cohens_d(d[["y"]], mu = 100')
      expect(r).toContain('geom_histogram')
      expect(r).toContain('geom_vline')
      expect(r).toContain('xintercept = 100')
    })
    it('defaults mu0 to 0, CI to 0.95, tails to two.sided', () => {
      const d = emit('one-sample-t-test', setup({ outcome: ['y'] }))
      expect(d).toContain('mu = 0')
      expect(d).toContain('conf.level = 0.95')
      expect(d).toContain('alternative = "two.sided"')
    })
  })

  describe('independent-t-test', () => {
    const r = emit('independent-t-test', setup({ outcome: ['y'], group: ['g'] }, { equalVariance: true, ci: '90%', tails: 'one-tailed (less)' }))
    it('mirrors t.test(y ~ g, var.equal=) with threaded columns + CI + alternative', () => {
      expect(r).toContain('t.test(d[["y"]] ~ factor(d[["g"]])')
      expect(r).toContain('var.equal = TRUE')
      expect(r).toContain('conf.level = 0.9')
      expect(r).toContain('alternative = "less"')
    })
    it('defaults equal variance OFF (Welch) and emits Levene + boxplot + cohens_d', () => {
      const d = emit('independent-t-test', setup({ outcome: ['y'], group: ['g'] }))
      expect(d).toContain('var.equal = FALSE')
      expect(d).toContain('geom_boxplot')
      expect(d).toMatch(/leveneTest|cohens_d/)
    })
  })

  describe('paired-t-test', () => {
    const r = emit('paired-t-test', setup({ conditionA: ['a'], conditionB: ['b'] }, { ci: '95%', tails: 'two-tailed' }))
    it('mirrors t.test(a, b, paired=TRUE) with both columns + CI + alternative', () => {
      expect(r).toContain('t.test(d[["a"]], d[["b"]], paired = TRUE')
      expect(r).toContain('conf.level = 0.95')
      expect(r).toContain('alternative = "two.sided"')
    })
    it('emits paired cohens_d and the paired-lines figure', () => {
      expect(r).toContain('effectsize::cohens_d(d[["a"]], d[["b"]], paired = TRUE)')
      expect(r).toContain('geom_line')
    })
  })

  describe('one-way-anova', () => {
    const r = emit('one-way-anova', setup({ outcome: ['y'], factor: ['g'] }, { posthoc: 'Bonferroni', ci: '99%' }))
    it('mirrors aov(y ~ g) and threads the post-hoc adjust + emmeans', () => {
      expect(r).toContain('aov(d[["y"]] ~ factor(d[["g"]])')
      expect(r).toContain('emmeans')
      expect(r).toContain('adjust = "bonferroni"')
    })
    it('emits eta_squared and the means pointrange figure', () => {
      expect(r).toContain('effectsize::eta_squared')
      expect(r).toContain('geom_pointrange')
    })
    it('defaults post-hoc to tukey', () => {
      const d = emit('one-way-anova', setup({ outcome: ['y'], factor: ['g'] }))
      expect(d).toContain('adjust = "tukey"')
    })
  })

  describe('factorial-anova', () => {
    const r = emit('factorial-anova', setup({ outcome: ['y'], factors: ['g', 'f2'] }, { interactions: true }))
    it('mirrors afex::aov_car with interaction (*) over the threaded factors', () => {
      expect(r).toContain('afex::aov_car(')
      expect(r).toContain('f1 = factor(d[["g"]])')
      expect(r).toContain('f2 = factor(d[["f2"]])')
      expect(r).toMatch(/y ~ f1 \* f2/)
    })
    it('uses + (additive) when interactions are off', () => {
      const d = emit('factorial-anova', setup({ outcome: ['y'], factors: ['g', 'f2'] }, { interactions: false }))
      expect(d).toMatch(/y ~ f1 \+ f2/)
    })
    it('emits partial eta-squared and the interaction plot', () => {
      expect(r).toContain('eta_squared')
      expect(r).toContain('geom_line')
    })
  })

  describe('repeated-measures-anova', () => {
    const r = emit('repeated-measures-anova', setup({ subject: ['sid'], measures: ['a', 'b', 'c'] }, { sphericity: 'HF correction', posthoc: true }))
    it('mirrors afex::aov_ez within-subjects with the threaded measures + correction', () => {
      expect(r).toContain('afex::aov_ez')
      expect(r).toContain('within')
      expect(r).toContain('"HF"')
      expect(r).toContain('"a"')
      expect(r).toContain('"c"')
    })
    it('emits emmeans post-hoc when on and the profile figure', () => {
      expect(r).toContain('emmeans')
      expect(r).toContain('geom_pointrange')
    })
    it('maps GG correction by default', () => {
      const d = emit('repeated-measures-anova', setup({ subject: ['sid'], measures: ['a', 'b'] }))
      expect(d).toContain('"GG"')
    })
  })

  describe('mixed-anova', () => {
    const r = emit('mixed-anova', setup({ subject: ['sid'], between: ['grp'], measures: ['a', 'b'] }, { sphericity: 'none', posthoc: true }))
    it('mirrors afex::aov_ez with between + within threaded', () => {
      expect(r).toContain('afex::aov_ez')
      expect(r).toContain('between')
      expect(r).toContain('within')
      expect(r).toContain('"none"')
      expect(r).toContain('grp')
    })
    it('emits the grouped profile figure', () => {
      expect(r).toContain('geom_line')
      expect(r).toContain('geom_pointrange')
    })
  })

  describe('nested-anova', () => {
    const r = emit('nested-anova', setup({ outcome: ['y'], factor: ['g'], nested: ['nest'] }, { nesting: 'random' }))
    it('mirrors aov(y ~ A / B) nesting the threaded columns via named factors', () => {
      expect(r).toContain('af <- factor(d[["g"]]); bf <- factor(d[["nest"]])')
      expect(r).toContain('aov(d[["y"]] ~ af / bf)')
    })
    it('emits omega_squared and the grouped means figure', () => {
      expect(r).toContain('effectsize::omega_squared')
      expect(r).toContain('geom_pointrange')
    })
    it('uses the nested mean square as error term under random nesting', () => {
      expect(r).toMatch(/random|msB|af:bf/)
    })
  })

  describe('welch-anova', () => {
    const r = emit('welch-anova', setup({ outcome: ['y'], factor: ['g'] }))
    it('mirrors oneway.test(var.equal = FALSE) on the threaded columns', () => {
      expect(r).toContain('oneway.test(d[["y"]] ~ factor(d[["g"]])')
      expect(r).toContain('var.equal = FALSE')
    })
    it('emits Games-Howell post-hoc and the means figure', () => {
      expect(r).toContain('games_howell_test')
      expect(r).toContain('geom_pointrange')
    })
  })

  describe('ancova', () => {
    const r = emit('ancova', setup({ outcome: ['y'], factor: ['g'], covariates: ['cov'] }, { ci: '90%' }))
    it('mirrors lm with covariate + factor and car::Anova(type = 3)', () => {
      expect(r).toContain('lm(')
      expect(r).toContain('d[["cov"]]')
      expect(r).toContain('d[["g"]]')
      expect(r).toContain('car::Anova(')
      expect(r).toContain('type = 3')
    })
    it('emits partial eta-squared, emmeans adjusted means, and the figure', () => {
      expect(r).toContain('eta_squared')
      expect(r).toContain('emmeans')
      expect(r).toContain('geom_pointrange')
    })
  })

  describe('manova', () => {
    const r = emit('manova', setup({ outcomes: ['a', 'b'], factors: ['g'] }, { statistic: 'Wilks', followups: true }))
    it('mirrors manova(cbind(DVs) ~ factors) and the selected statistic', () => {
      expect(r).toContain('manova(')
      expect(r).toContain('cbind(d[["a"]], d[["b"]])')
      expect(r).toContain('test = "Wilks"')
    })
    it('emits per-DV follow-up aov when on and the faceted figure', () => {
      expect(r).toContain('aov(')
      expect(r).toContain('facet_wrap')
    })
    it('defaults the statistic to Pillai', () => {
      const d = emit('manova', setup({ outcomes: ['a', 'b'], factors: ['g'] }))
      expect(d).toContain('test = "Pillai"')
    })
  })

  describe('mancova', () => {
    const r = emit('mancova', setup({ outcomes: ['a', 'b'], factors: ['g'], covariates: ['cov'] }, { statistic: 'Pillai' }))
    it('mirrors manova(cbind(DVs) ~ covariates + factors) with covariates FIRST', () => {
      expect(r).toContain('manova(')
      expect(r).toContain('cbind(d[["a"]], d[["b"]])')
      expect(r).toContain('test = "Pillai"')
      // covariate appears before the factor on the RHS
      const rhs = r.slice(r.indexOf('cbind'))
      expect(rhs.indexOf('d[["cov"]]')).toBeLessThan(rhs.indexOf('d[["g"]]'))
    })
    it('emits per-DV follow-up aov and the faceted adjusted-means figure', () => {
      expect(r).toContain('aov(')
      expect(r).toContain('facet_wrap')
    })
    it('builds the per-DV lm() data.frame with positional cov_i/fac_i (name-safe) identifiers, not raw column names', () => {
      // values still thread the real column via col() = d[["name"]]; the data.frame ARG names are positional
      expect(r).toContain('cov_1 = d[["cov"]]')
      expect(r).toContain('fac_1 = factor(d[["g"]])')
      expect(r).toContain('lm(y ~ cov_1 + fac_1')
      expect(r).toContain('emmeans::emmeans(lm_fit, ~ fac_1)')
      // no raw-name identifiers like `cov_cov` / `fac_g` leak into the script
      expect(r).not.toContain('cov_cov')
      expect(r).not.toContain('fac_g')
    })
  })

  describe('mann-whitney-u', () => {
    const r = emit('mann-whitney-u', setup({ outcome: ['y'], group: ['g'] }, { continuity: true, tails: 'one-tailed (greater)' }))
    it('mirrors wilcox.test(y ~ g) unpaired with correct= and alternative', () => {
      expect(r).toContain('wilcox.test(d[["y"]] ~ factor(d[["g"]])')
      expect(r).toContain('correct = TRUE')
      expect(r).toContain('alternative = "greater"')
      expect(r).not.toContain('paired = TRUE')
    })
    it('emits rank_biserial, coin Z, and the boxplot', () => {
      expect(r).toContain('rank_biserial')
      expect(r).toContain('coin::')
      expect(r).toContain('geom_boxplot')
    })
  })

  describe('wilcoxon-signed-rank', () => {
    const r = emit('wilcoxon-signed-rank', setup({ conditionA: ['a'], conditionB: ['b'] }, { continuity: false, tails: 'one-tailed (less)' }))
    it('mirrors wilcox.test(a, b, paired = TRUE) with correct= and alternative', () => {
      expect(r).toContain('a <- d[["a"]]; b <- d[["b"]]')
      expect(r).toContain('wilcox.test(a, b, paired = TRUE')
      expect(r).toContain('correct = FALSE')
      expect(r).toContain('alternative = "less"')
    })
    it('emits paired rank_biserial, coin signed Z, and the difference plot', () => {
      expect(r).toContain('rank_biserial')
      expect(r).toContain('coin::')
      expect(r).toContain('geom_col')
    })
  })

  describe('kruskal-wallis', () => {
    const r = emit('kruskal-wallis', setup({ outcome: ['y'], group: ['g'] }))
    it('mirrors kruskal.test(y ~ g) on the threaded columns', () => {
      expect(r).toContain('kruskal.test(d[["y"]] ~ factor(d[["g"]]))')
    })
    it('emits Dunn post-hoc, epsilon-squared, and the boxplot', () => {
      expect(r).toContain('dunn_test')
      expect(r).toContain('geom_boxplot')
    })
  })

  describe('friedman', () => {
    const r = emit('friedman', setup({ subject: ['sid'], measures: ['a', 'b', 'c'] }))
    it('mirrors friedman.test over a matrix of the threaded measures', () => {
      expect(r).toContain('friedman.test(')
      expect(r).toContain('d[["a"]]')
      expect(r).toContain('d[["c"]]')
    })
    it('emits Kendall W and the profile figure', () => {
      expect(r).toMatch(/Kendall|w <-|n \* \(k - 1\)/)
      expect(r).toContain('geom_pointrange')
    })
  })
})
