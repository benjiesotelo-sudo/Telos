import type { TestSpec } from './types'
import { SUMMARY_STATISTICS } from './summaryStatistics'
import { INDEPENDENT_T_TEST } from './independentTTest'
import { ONE_SAMPLE_T_TEST } from './oneSampleTTest'
import { PAIRED_T_TEST } from './pairedTTest'
import { MANN_WHITNEY_U } from './mannWhitneyU'
import { WILCOXON_SIGNED_RANK } from './wilcoxonSignedRank'
import { DISTRIBUTION_NORMALITY } from './distributionNormality'
import { FREQUENCIES_CROSSTABS } from './frequenciesCrosstabs'
import { ONE_WAY_ANOVA } from './oneWayAnova'
import { FACTORIAL_ANOVA } from './factorialAnova'
import { REPEATED_MEASURES_ANOVA } from './repeatedMeasuresAnova'
import { MIXED_ANOVA } from './mixedAnova'
import { NESTED_ANOVA } from './nestedAnova'
import { WELCH_ANOVA } from './welchAnova'
import { ANCOVA } from './ancova'
import { MANOVA } from './manova'
import { MANCOVA } from './mancova'
import { KRUSKAL_WALLIS } from './kruskalWallis'
import { FRIEDMAN } from './friedman'
import { PEARSON } from './pearson'
import { SPEARMAN } from './spearman'
import { KENDALLS_TAU } from './kendallsTau'
import { CHI_SQUARE_INDEPENDENCE } from './chiSquareIndependence'
import { CHI_SQUARE_GOF } from './chiSquareGof'
import { FISHERS_EXACT } from './fishersExact'
import { SIMPLE_LINEAR_REGRESSION } from './simpleLinearRegression'
import { MULTIPLE_LINEAR_REGRESSION } from './multipleLinearRegression'
import { LOGISTIC_REGRESSION } from './logisticRegression'
import { POISSON_NEGATIVE_BINOMIAL } from './poissonNegativeBinomial'
import { ARIMA_SARIMA } from './arimaSarima'
import { STATIONARITY_TESTS } from './stationarityTests'
import { GRANGER_CAUSALITY } from './grangerCausality'
import { VAR } from './var'
import { FIXED_EFFECTS } from './fixedEffects'
import { RANDOM_EFFECTS } from './randomEffects'
import { HAUSMAN_TEST } from './hausmanTest'
import { DID } from './did'
import { RDD } from './rdd'
import { IV_TWO_STAGE } from './ivTwoStage'
import { PROPENSITY_SCORE_MATCHING } from './propensityScoreMatching'
import { CRONBACHS_ALPHA } from './cronbachsAlpha'
import { AVE } from './ave'

export type CatalogStatus = 'available' | 'later-slice'
export interface CatalogEntry { id: string; name: string; family: string; subfamily?: string; status: CatalogStatus; short?: string; note?: string } // note: the ui-spec tree's inline leaf annotation (SEM leaves), rendered verbatim

// Encoded from telos_ui_spec.html "5 · Pick a test" tree. Names verbatim (entities decoded).
const e = (id: string, name: string, family: string, subfamily?: string, status: CatalogStatus = 'later-slice', short?: string): CatalogEntry =>
  ({ id, name, family, ...(subfamily ? { subfamily } : {}), status, ...(short ? { short } : {}) })

export const CATALOG: CatalogEntry[] = [
  e('summary-statistics', 'Summary statistics', 'Descriptive statistics', undefined, 'available'),
  e('frequencies-crosstabs', 'Frequencies & cross-tabs', 'Descriptive statistics', undefined, 'available'),
  e('distribution-normality', 'Distribution & normality', 'Descriptive statistics', undefined, 'available'),
  e('one-sample-t-test', 'One-sample t-test', 'Group comparisons', 'Parametric', 'available'),
  e('independent-t-test', 'Independent t-test', 'Group comparisons', 'Parametric', 'available', 't-test'),
  e('paired-t-test', 'Paired t-test', 'Group comparisons', 'Parametric', 'available'),
  e('one-way-anova', 'One-way ANOVA + post-hoc', 'Group comparisons', 'Parametric', 'available'),
  e('factorial-anova', 'Factorial ANOVA', 'Group comparisons', 'Parametric', 'available'),
  e('repeated-measures-anova', 'Repeated-measures ANOVA', 'Group comparisons', 'Parametric', 'available'),
  e('mixed-anova', 'Mixed ANOVA', 'Group comparisons', 'Parametric', 'available'),
  e('nested-anova', 'Nested ANOVA', 'Group comparisons', 'Parametric', 'available'),
  e('welch-anova', "Welch's ANOVA", 'Group comparisons', 'Parametric', 'available'),
  e('ancova', 'ANCOVA', 'Group comparisons', 'Parametric', 'available'),
  e('manova', 'MANOVA', 'Group comparisons', 'Parametric', 'available'),
  e('mancova', 'MANCOVA', 'Group comparisons', 'Parametric', 'available'),
  e('mann-whitney-u', 'Mann-Whitney U', 'Group comparisons', 'Nonparametric', 'available'),
  e('wilcoxon-signed-rank', 'Wilcoxon signed-rank', 'Group comparisons', 'Nonparametric', 'available'),
  e('kruskal-wallis', 'Kruskal-Wallis', 'Group comparisons', 'Nonparametric', 'available'),
  e('friedman', 'Friedman', 'Group comparisons', 'Nonparametric', 'available'),
  e('pearson', 'Pearson', 'Association', 'Correlation', 'available'),
  e('spearman', 'Spearman', 'Association', 'Correlation', 'available'),
  e('kendalls-tau', "Kendall's tau", 'Association', 'Correlation', 'available'),
  e('chi-square-independence', 'Chi-square independence', 'Association', 'Categorical', 'available'),
  e('chi-square-goodness-of-fit', 'Chi-square goodness-of-fit', 'Association', 'Categorical', 'available'),
  e('fishers-exact', "Fisher's exact", 'Association', 'Categorical', 'available'),
  e('simple-linear-regression', 'Simple linear regression', 'Regression & prediction', undefined, 'available'),
  e('multiple-linear-regression', 'Multiple linear regression', 'Regression & prediction', undefined, 'available'),
  e('logistic-regression', 'Logistic regression', 'Regression & prediction', undefined, 'available'),
  e('poisson-negative-binomial', 'Poisson / negative binomial', 'Regression & prediction', undefined, 'available'),
  e('arima-sarima', 'ARIMA / SARIMA', 'Econometrics', 'Time series', 'available'),
  e('stationarity-tests', 'Stationarity tests (ADF, KPSS)', 'Econometrics', 'Time series', 'available'),
  e('granger-causality', 'Granger causality', 'Econometrics', 'Time series', 'available'),
  e('var', 'VAR', 'Econometrics', 'Time series', 'available'),
  e('fixed-effects', 'Fixed effects', 'Econometrics', 'Panel data', 'available'),
  e('random-effects', 'Random effects', 'Econometrics', 'Panel data', 'available'),
  e('hausman-test', 'Hausman test', 'Econometrics', 'Panel data', 'available'),
  e('did', 'Difference-in-differences (DiD)', 'Econometrics', 'Causal inference', 'available'),
  e('rdd', 'Regression discontinuity (RDD)', 'Econometrics', 'Causal inference', 'available'),
  e('iv-2sls', 'Instrumental variables (IV / 2SLS)', 'Econometrics', 'Causal inference', 'available'),
  e('propensity-score-matching', 'Propensity score matching', 'Econometrics', 'Causal inference', 'available'),
  e('cronbachs-alpha', "Cronbach's alpha", 'Latent variable models', 'Reliability', 'available'),
  e('ave', 'Average variance extracted (AVE)', 'Latent variable models', 'Reliability', 'available'),
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
export const SPECS: Record<string, TestSpec> = {
  [SUMMARY_STATISTICS.id]: SUMMARY_STATISTICS, [FREQUENCIES_CROSSTABS.id]: FREQUENCIES_CROSSTABS, [INDEPENDENT_T_TEST.id]: INDEPENDENT_T_TEST, [ONE_SAMPLE_T_TEST.id]: ONE_SAMPLE_T_TEST, [PAIRED_T_TEST.id]: PAIRED_T_TEST, [MANN_WHITNEY_U.id]: MANN_WHITNEY_U, [WILCOXON_SIGNED_RANK.id]: WILCOXON_SIGNED_RANK, [DISTRIBUTION_NORMALITY.id]: DISTRIBUTION_NORMALITY,
  [ONE_WAY_ANOVA.id]: ONE_WAY_ANOVA, [FACTORIAL_ANOVA.id]: FACTORIAL_ANOVA, [REPEATED_MEASURES_ANOVA.id]: REPEATED_MEASURES_ANOVA, [MIXED_ANOVA.id]: MIXED_ANOVA, [NESTED_ANOVA.id]: NESTED_ANOVA, [WELCH_ANOVA.id]: WELCH_ANOVA, [ANCOVA.id]: ANCOVA, [MANOVA.id]: MANOVA, [MANCOVA.id]: MANCOVA, [KRUSKAL_WALLIS.id]: KRUSKAL_WALLIS, [FRIEDMAN.id]: FRIEDMAN,
  [PEARSON.id]: PEARSON, [SPEARMAN.id]: SPEARMAN, [KENDALLS_TAU.id]: KENDALLS_TAU, [CHI_SQUARE_INDEPENDENCE.id]: CHI_SQUARE_INDEPENDENCE, [CHI_SQUARE_GOF.id]: CHI_SQUARE_GOF, [FISHERS_EXACT.id]: FISHERS_EXACT,
  [SIMPLE_LINEAR_REGRESSION.id]: SIMPLE_LINEAR_REGRESSION, [MULTIPLE_LINEAR_REGRESSION.id]: MULTIPLE_LINEAR_REGRESSION,
  [LOGISTIC_REGRESSION.id]: LOGISTIC_REGRESSION, [POISSON_NEGATIVE_BINOMIAL.id]: POISSON_NEGATIVE_BINOMIAL,
  [ARIMA_SARIMA.id]: ARIMA_SARIMA, [STATIONARITY_TESTS.id]: STATIONARITY_TESTS, [GRANGER_CAUSALITY.id]: GRANGER_CAUSALITY, [VAR.id]: VAR,
  [FIXED_EFFECTS.id]: FIXED_EFFECTS, [RANDOM_EFFECTS.id]: RANDOM_EFFECTS, [HAUSMAN_TEST.id]: HAUSMAN_TEST, [DID.id]: DID, [RDD.id]: RDD, [IV_TWO_STAGE.id]: IV_TWO_STAGE, [PROPENSITY_SCORE_MATCHING.id]: PROPENSITY_SCORE_MATCHING,
  [CRONBACHS_ALPHA.id]: CRONBACHS_ALPHA,
  [AVE.id]: AVE,
}
