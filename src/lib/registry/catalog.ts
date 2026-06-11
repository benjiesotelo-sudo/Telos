import type { TestSpec } from './types'
import { INDEPENDENT_T_TEST } from './independentTTest'

export type CatalogStatus = 'available' | 'later-slice'
export interface CatalogEntry { id: string; name: string; family: string; subfamily?: string; status: CatalogStatus; short?: string; note?: string } // note: the ui-spec tree's inline leaf annotation (SEM leaves), rendered verbatim

// Encoded from telos_ui_spec.html "5 · Pick a test" tree. Names verbatim (entities decoded).
const e = (id: string, name: string, family: string, subfamily?: string, status: CatalogStatus = 'later-slice', short?: string): CatalogEntry =>
  ({ id, name, family, ...(subfamily ? { subfamily } : {}), status, ...(short ? { short } : {}) })

export const CATALOG: CatalogEntry[] = [
  e('summary-statistics', 'Summary statistics', 'Descriptive statistics'),
  e('frequencies-crosstabs', 'Frequencies & cross-tabs', 'Descriptive statistics'),
  e('distribution-normality', 'Distribution & normality', 'Descriptive statistics'),
  e('one-sample-t-test', 'One-sample t-test', 'Group comparisons', 'Parametric'),
  e('independent-t-test', 'Independent t-test', 'Group comparisons', 'Parametric', 'available', 't-test'),
  e('paired-t-test', 'Paired t-test', 'Group comparisons', 'Parametric'),
  e('one-way-anova', 'One-way ANOVA + post-hoc', 'Group comparisons', 'Parametric'),
  e('factorial-anova', 'Factorial ANOVA', 'Group comparisons', 'Parametric'),
  e('repeated-measures-anova', 'Repeated-measures ANOVA', 'Group comparisons', 'Parametric'),
  e('nested-anova', 'Nested ANOVA', 'Group comparisons', 'Parametric'),
  e('welch-anova', "Welch's ANOVA", 'Group comparisons', 'Parametric'),
  e('ancova', 'ANCOVA', 'Group comparisons', 'Parametric'),
  e('manova', 'MANOVA', 'Group comparisons', 'Parametric'),
  e('mancova', 'MANCOVA', 'Group comparisons', 'Parametric'),
  e('mann-whitney-u', 'Mann-Whitney U', 'Group comparisons', 'Nonparametric'),
  e('wilcoxon-signed-rank', 'Wilcoxon signed-rank', 'Group comparisons', 'Nonparametric'),
  e('kruskal-wallis', 'Kruskal-Wallis', 'Group comparisons', 'Nonparametric'),
  e('friedman', 'Friedman', 'Group comparisons', 'Nonparametric'),
  e('pearson', 'Pearson', 'Association', 'Correlation'),
  e('spearman', 'Spearman', 'Association', 'Correlation'),
  e('kendalls-tau', "Kendall's tau", 'Association', 'Correlation'),
  e('chi-square-independence', 'Chi-square independence', 'Association', 'Categorical'),
  e('chi-square-goodness-of-fit', 'Chi-square goodness-of-fit', 'Association', 'Categorical'),
  e('fishers-exact', "Fisher's exact", 'Association', 'Categorical'),
  e('simple-linear-regression', 'Simple linear regression', 'Regression & prediction'),
  e('multiple-linear-regression', 'Multiple linear regression', 'Regression & prediction'),
  e('logistic-regression', 'Logistic regression', 'Regression & prediction'),
  e('poisson-negative-binomial', 'Poisson / negative binomial', 'Regression & prediction'),
  e('arima-sarima', 'ARIMA / SARIMA', 'Econometrics', 'Time series'),
  e('stationarity-tests', 'Stationarity tests (ADF, KPSS)', 'Econometrics', 'Time series'),
  e('granger-causality', 'Granger causality', 'Econometrics', 'Time series'),
  e('var', 'VAR', 'Econometrics', 'Time series'),
  e('fixed-effects', 'Fixed effects', 'Econometrics', 'Panel data'),
  e('random-effects', 'Random effects', 'Econometrics', 'Panel data'),
  e('hausman-test', 'Hausman test', 'Econometrics', 'Panel data'),
  e('did', 'Difference-in-differences (DiD)', 'Econometrics', 'Causal inference'),
  e('rdd', 'Regression discontinuity (RDD)', 'Econometrics', 'Causal inference'),
  e('iv-2sls', 'Instrumental variables (IV / 2SLS)', 'Econometrics', 'Causal inference'),
  e('propensity-score-matching', 'Propensity score matching', 'Econometrics', 'Causal inference'),
  e('cronbachs-alpha', "Cronbach's alpha", 'Latent variable models', 'Reliability'),
  e('ave', 'Average variance extracted (AVE)', 'Latent variable models', 'Reliability'),
  e('composite-reliability', 'Composite reliability (CR)', 'Latent variable models', 'Reliability'),
  e('efa', 'Exploratory factor analysis (EFA)', 'Latent variable models', 'Factor analysis'),
  e('pca', 'Principal component analysis (PCA)', 'Latent variable models', 'Factor analysis'),
  { id: 'cb-sem', name: 'CB-SEM', family: 'Latent variable models', subfamily: 'Structural equation modeling', status: 'later-slice',
    note: '— pipeline stages selectable: CFA & model fit always run, EFA and the structural stage optional (default: all on); includes path analysis & mediation via drawn path chains (indirect-effects table, bootstrapped CIs); moderation planned for a later version' },
  { id: 'pls-sem', name: 'PLS-SEM', family: 'Latent variable models', subfamily: 'Structural equation modeling', status: 'later-slice',
    note: '— includes path analysis & mediation via drawn path chains (indirect-effects table, bootstrapped CIs); moderation planned for a later version' },
]

export const FAMILIES = [...new Set(CATALOG.map((c) => c.family))] // tree order
export const LATER_SLICE_REASON = 'arrives in a later slice'

/** Runnable test specs this slice ships; later slices add entries here. Keys = catalog ids. */
export const SPECS: Record<string, TestSpec> = { [INDEPENDENT_T_TEST.id]: INDEPENDENT_T_TEST }
