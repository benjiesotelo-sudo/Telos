import { describe, it, expect } from 'vitest'
import { regressionEmitters, regressionPackages } from './regression'
import type { TestSetup } from '../../../../state/session'
import type { Dataset } from '../../../stats/types'

// Each emitter is (spec, setup, dataset). The regression family ignores spec, so a stub is fine.
const spec = {} as never
const setup = (roles: Record<string, string[]>, options: Record<string, boolean | number | string> = {}, props: Record<string, number> = {}): TestSetup =>
  ({ roles, options, props, blocked: null })

// A column set rich enough to feed every econometrics test (numeric + categorical + a time / entity / treatment column).
const ds: Dataset = {
  columns: ['wage', 'educ', 'exper', 'female', 'union', 'year', 'firm', 'treated', 'period', 'score', 'run', 'nearc', 'gdp', 'cpi'],
  rows: [
    { wage: 5, educ: 12, exper: 2, female: 'no', union: 'no', year: 1, firm: 'A', treated: 'control', period: 'pre', score: 1, run: 40, nearc: 0, gdp: 100, cpi: 2 },
    { wage: 7, educ: 16, exper: 5, female: 'yes', union: 'yes', year: 2, firm: 'B', treated: 'treated', period: 'post', score: 0, run: 60, nearc: 1, gdp: 110, cpi: 3 },
  ],
}
const emit = (id: string, st: TestSetup) => regressionEmitters[id](spec, st, ds)

const OWNED = [
  'simple-linear-regression', 'multiple-linear-regression', 'logistic-regression', 'poisson-negative-binomial',
  'arima-sarima', 'stationarity-tests', 'granger-causality', 'var', 'fixed-effects', 'random-effects',
  'hausman-test', 'did', 'rdd', 'iv-2sls', 'propensity-score-matching',
]

describe('regression / econometrics emitters', () => {
  it('exposes an emitter + package list for every catalog id it owns', () => {
    for (const id of OWNED) {
      expect(typeof regressionEmitters[id]).toBe('function')
      expect(Array.isArray(regressionPackages[id])).toBe(true)
    }
  })

  describe('multiple-linear-regression', () => {
    const r = emit('multiple-linear-regression', setup({ outcome: ['wage'], predictors: ['educ', 'exper', 'female'] }, { ci: '90%' }))
    it('mirrors lm() with the additive predictor formula on the threaded columns', () => {
      expect(r).toContain('lm(wage ~ educ + exper + female, data = d)')
    })
    it('emits the canonical modelsummary coef table', () => {
      expect(r).toContain('modelsummary(')
      expect(r).toContain('stars = FALSE')
    })
    it('emits the residual-diagnostic and standardized-coefficient figures', () => {
      expect(r).toContain('Residuals vs fitted')
      expect(r).toContain('Standardized')
      expect(r).toContain('car::vif(m)')
    })
    it('omits car::vif entirely with a single predictor (car::vif needs >= 2 terms — mirrors the app guard)', () => {
      // one categorical predictor with >= 3 levels expands to >= 2 dummy coefs but is still ONE term; the old
      // `if (length(coef(m)) >= 3)` guard mis-fired and car::vif errored. The guard is now on predictor count.
      const r1 = emit('multiple-linear-regression', setup({ outcome: ['wage'], predictors: ['female'] }, {}))
      expect(r1).not.toContain('car::vif')
    })
  })

  describe('logistic-regression', () => {
    const r = emit('logistic-regression', setup({ outcome: ['union'], predictors: ['educ', 'exper'] }, { event: 'yes', reportOR: true, ci: '95%' }))
    it('re-levels the outcome so the chosen event is the second factor level', () => {
      // mirrors logisticRegression.ts: factor(..., levels = c(oth, event)) — event last
      expect(r).toContain('levels = c(oth, "yes")')
      expect(r).toContain('"yes"')
    })
    it('mirrors glm(family = binomial) on the threaded columns', () => {
      expect(r).toContain('glm(')
      expect(r).toContain('family = binomial')
      expect(r).toContain('union')
      expect(r).toContain('educ + exper')
    })
    it('reports odds ratios via the exponentiated modelsummary variant', () => {
      expect(r).toContain('exponentiate = TRUE')
      expect(r).toContain('Odds ratio')
    })
    it('emits the classification table and the ROC / AUC figure', () => {
      expect(r).toContain('table(')
      expect(r).toContain('pROC::roc')
    })
    it('emits the single overall LR omnibus chi-square (null - residual deviance), not the sequential anova table', () => {
      // mirrors logisticRegression.ts: omnibus = null.deviance - deviance, df = df.null - df.residual,
      // p = pchisq(omnibus, df, lower.tail = FALSE). The old per-term anova(m, test = "Chisq") was wrong.
      expect(r).toContain('omnibus <- m$null.deviance - m$deviance')
      expect(r).toContain('omnibus_df <- m$df.null - m$df.residual')
      expect(r).toContain('pchisq(omnibus, omnibus_df, lower.tail = FALSE)')
      expect(r).not.toContain('anova(m, test = "Chisq")')
    })
  })

  describe('poisson-negative-binomial', () => {
    it('mirrors glm(family = poisson) with the offset when an exposure column is assigned', () => {
      const r = emit('poisson-negative-binomial', setup({ outcome: ['wage'], predictors: ['educ'], exposure: ['exper'] }, { model: 'Poisson' }))
      expect(r).toContain('family = poisson')
      expect(r).toContain('offset(log(exper))')
      expect(r).toContain('exponentiate = TRUE') // IRR
    })
    it('switches to MASS::glm.nb for the negative-binomial model and reports theta', () => {
      const r = emit('poisson-negative-binomial', setup({ outcome: ['wage'], predictors: ['educ'] }, { model: 'negative binomial' }))
      expect(r).toContain('MASS::glm.nb(')
      expect(r).toContain('theta')
    })
    it('emits no offset term when no exposure column is assigned', () => {
      const r = emit('poisson-negative-binomial', setup({ outcome: ['wage'], predictors: ['educ'] }, { model: 'Poisson' }))
      expect(r).not.toContain('offset(')
    })
    it('emits the fitted-vs-Pearson-residual figure', () => {
      const r = emit('poisson-negative-binomial', setup({ outcome: ['wage'], predictors: ['educ'] }, { model: 'Poisson' }))
      expect(r).toContain('Pearson')
    })
  })

  describe('arima-sarima', () => {
    it('uses forecast::auto.arima in auto-select mode', () => {
      const r = emit('arima-sarima', setup({ time: ['year'], series: ['wage'] }, { order: 'auto-select', seasonalPeriod: 12, horizon: 6 }))
      expect(r).toContain('forecast::auto.arima(')
      // series is sorted by time before ts() (mirrors arimaSarima.ts)
      expect(r).toContain('ts(dd_ord$wage, frequency = 12)')
      expect(r).toContain('forecast::forecast(')
      expect(r).toContain('h = 6')
    })
    it('uses arima() with the manual (p,d,q)(P,D,Q) order when order = manual', () => {
      const r = emit('arima-sarima', setup({ time: ['year'], series: ['wage'] },
        { order: 'manual', 'order.p': 1, 'order.d': 1, 'order.q': 0, 'order.P': 1, 'order.D': 0, 'order.Q': 1, seasonalPeriod: 4, horizon: 12 }))
      expect(r).toContain('order = c(1, 1, 0)')
      expect(r).toContain('order = c(1, 0, 1)')
      expect(r).toContain('period = 4')
    })
    it('emits Box.test (Ljung-Box) and the forecast autoplot', () => {
      const r = emit('arima-sarima', setup({ time: ['year'], series: ['wage'] }, {}))
      expect(r).toContain("Box.test(")
      expect(r).toContain('Ljung-Box')
      expect(r).toContain('forecast::autoplot(')
    })
  })

  describe('stationarity-tests', () => {
    const r = emit('stationarity-tests', setup({ time: ['year'], series: ['wage'] }, { alpha: 0.05 }))
    it('runs ADF, KPSS and Phillips-Perron on the series ts()', () => {
      // series sorted by time before ts() (mirrors stationarityTests.ts)
      expect(r).toContain('ts(dd_ord$wage, frequency = 1)')
      expect(r).toContain('tseries::adf.test(')
      expect(r).toContain('tseries::kpss.test(')
      expect(r).toContain('tseries::pp.test(')
    })
    it('emits the series + ACF/PACF figures', () => {
      expect(r).toContain('acf(')
      expect(r).toContain('pacf(')
    })
  })

  describe('granger-causality', () => {
    const r = emit('granger-causality', setup({ time: ['year'], seriesX: ['gdp'], seriesY: ['cpi'] }, { maxLag: 3 }))
    it('runs lmtest::grangertest in both directions with the threaded max lag', () => {
      expect(r).toContain('lmtest::grangertest(d$cpi ~ d$gdp, order = 3)')
      expect(r).toContain('lmtest::grangertest(d$gdp ~ d$cpi, order = 3)')
    })
    it('emits the cross-series plot', () => {
      expect(r).toContain('geom_line')
    })
  })

  describe('var', () => {
    const r = emit('var', setup({ time: ['year'], series: ['gdp', 'cpi'] }, { irfHorizon: 8 }))
    it('selects lag via vars::VARselect and fits vars::VAR', () => {
      expect(r).toContain('vars::VARselect(')
      expect(r).toContain('vars::VAR(')
      expect(r).toContain("type = 'const'")
    })
    it('builds the series frame from the threaded columns', () => {
      expect(r).toContain('d[, c("gdp", "cpi")]')
    })
    it('emits FEVD, stability roots and the IRF plot', () => {
      expect(r).toContain('vars::fevd(')
      expect(r).toContain('vars::roots(')
      expect(r).toContain('vars::irf(')
      expect(r).toContain('n.ahead = 8')
    })
  })

  describe('fixed-effects', () => {
    it('fits plm within with the entity effect and clustered SE by default', () => {
      const r = emit('fixed-effects', setup({ entity: ['firm'], time: ['year'], outcome: ['wage'], regressors: ['educ', 'exper'] }, { effects: 'entity', se: 'clustered by entity' }))
      expect(r).toContain("plm::plm(wage ~ educ + exper, data = pdat, model = 'within'")
      expect(r).toContain("effect = 'individual'")
      expect(r).toContain("index = c(\"firm\", \"year\")")
      expect(r).toContain("method = 'arellano'")
      expect(r).toContain('lmtest::coeftest(')
      expect(r).toContain('plm::pFtest(')
    })
    it('maps two-way effects and switches to classical vcov', () => {
      const r = emit('fixed-effects', setup({ entity: ['firm'], time: ['year'], outcome: ['wage'], regressors: ['educ'] }, { effects: 'two-way', se: 'classical' }))
      expect(r).toContain("effect = 'twoways'")
      expect(r).toContain('stats::vcov(')
      expect(r).not.toContain('arellano')
    })
  })

  describe('random-effects', () => {
    const r = emit('random-effects', setup({ entity: ['firm'], time: ['year'], outcome: ['wage'], regressors: ['educ'] }, { se: 'clustered by entity' }))
    it('fits plm random with clustered SE', () => {
      expect(r).toContain("model = 'random'")
      expect(r).toContain("method = 'arellano'")
      expect(r).toContain('lmtest::coeftest(')
    })
  })

  describe('hausman-test', () => {
    const r = emit('hausman-test', setup({ entity: ['firm'], time: ['year'], outcome: ['wage'], regressors: ['educ'] }, {}))
    it('fits FE + RE and runs plm::phtest', () => {
      expect(r).toContain("model = 'within'")
      expect(r).toContain("model = 'random'")
      expect(r).toContain('plm::phtest(')
    })
    it('emits the side-by-side FE vs RE coefficient plot', () => {
      expect(r).toContain('position')
    })
  })

  describe('did', () => {
    const r = emit('did', setup({ outcome: ['wage'], treatment: ['treated'], period: ['period'], entity: ['firm'], time: ['year'] }, { se: 'clustered' }))
    it('codes treated/post to 0/1 by the positive level', () => {
      expect(r).toContain('"treated"') // positive treatment level
      expect(r).toContain('"post"')    // positive period level
    })
    it('fits the entity-FE within model on po + po:tr with clustered SE', () => {
      expect(r).toContain("plm::plm(wage ~ po + po:tr, data = pdat, model = 'within')")
      expect(r).toContain("method = 'arellano'")
    })
    it('emits the parallel-trends plot', () => {
      expect(r).toContain('geom_vline')
      expect(r).toContain('aggregate(')
    })
    it('aggregates the trends figure over listwise-complete rows and ranks a non-numeric time axis (mirrors did.ts)', () => {
      expect(r).toContain('df_t <- d[keep, ]')
      // ranks a non-numeric time column to integer order rather than plotting raw labels
      expect(r).toContain('match(as.character(raw_time), sort(unique(as.character(raw_time))))')
    })
  })

  describe('rdd', () => {
    // The RDD card has no ci pill — only cutoff / bandwidth-display / polynomial. rdrobust runs at its fixed 95% level.
    const r = emit('rdd', setup({ outcome: ['score'], running: ['run'] }, { cutoff: 60, poly: '2 · quadratic' }))
    it('mirrors rdrobust::rdrobust with the threaded cutoff, polynomial order and the fixed 95% level', () => {
      expect(r).toContain('rdrobust::rdrobust(d$score, d$run, c = 60, p = 2, level = 95)')
    })
    it('emits the rdplot figure', () => {
      expect(r).toContain('rdrobust::rdplot(')
    })
  })

  describe('iv-2sls', () => {
    const r = emit('iv-2sls', setup({ outcome: ['wage'], endogenous: ['educ'], instruments: ['nearc'], controls: ['exper'] }, { se: 'robust' }))
    it('fits ivreg with the endogenous | instrument formula plus controls', () => {
      expect(r).toContain('ivreg::ivreg(wage ~ educ + exper | nearc + exper, data = d)')
    })
    it('fits the matching OLS and reports robust SE via sandwich::vcovHC', () => {
      expect(r).toContain('lm(wage ~ educ + exper, data = d)')
      expect(r).toContain("sandwich::vcovHC(")
      expect(r).toContain("type = 'HC1'")
    })
    it('emits the first-stage regression and the diagnostics summary', () => {
      expect(r).toContain('lm(educ ~ nearc + exper, data = d)')
      expect(r).toContain('diagnostics = TRUE')
    })
    it('uses classical vcov when SE = classical', () => {
      const c = emit('iv-2sls', setup({ outcome: ['wage'], endogenous: ['educ'], instruments: ['nearc'], controls: [] }, { se: 'classical' }))
      expect(c).toContain('stats::vcov(')
      expect(c).not.toContain('vcovHC')
    })
  })

  describe('propensity-score-matching', () => {
    const r = emit('propensity-score-matching', setup({ outcome: ['wage'], treatment: ['treated'], covariates: ['educ', 'exper'] }, { ratio: '2:1', caliper: 0.2 }))
    it('codes treatment to 0/1 and matches with MatchIt nearest at the threaded ratio + caliper', () => {
      expect(r).toContain('MatchIt::matchit(')
      expect(r).toContain("method = 'nearest'")
      expect(r).toContain('ratio = 2')
      expect(r).toContain('caliper = 0.2')
      expect(r).toContain('treat ~ educ + exper')
    })
    it('estimates the ATT via weighted lm on matched data with clustered SE', () => {
      expect(r).toContain('MatchIt::match.data(')
      expect(r).toContain('weights = md$weights')
      expect(r).toContain('sandwich::vcovCL(')
    })
    it('omits the caliper argument when caliper is off (0)', () => {
      const r0 = emit('propensity-score-matching', setup({ outcome: ['wage'], treatment: ['treated'], covariates: ['educ'] }, { ratio: '1:1', caliper: 0 }))
      expect(r0).not.toContain('caliper =')
    })
    it('emits the love plot', () => {
      expect(r).toContain('Standardized mean difference')
    })
  })
})
