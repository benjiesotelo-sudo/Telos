import type { TestSpec, TableSpec } from '../registry/types'
import type { Engine } from '../webr/engine'
import type { Dataset, TTestResult } from '../stats/types'
import type { TestSetup } from '../../state/session'
import { runIndependentTTest } from '../stats/independentTTest'
import { buildIndependentTTest } from './buildIndependentTTest'
import { runOneSampleTTest, type OneSampleTTestResult } from '../stats/oneSampleTTest'
import { buildOneSampleTTest } from './buildOneSampleTTest'
import type { PairedTTestResult } from '../stats/pairedTTest'
import { runPairedTTest } from '../stats/pairedTTest'
import { buildPairedTTest } from './buildPairedTTest'
import { runMannWhitneyU, type MannWhitneyUResult } from '../stats/mannWhitneyU'
import { buildMannWhitneyU } from './buildMannWhitneyU'
import { runWilcoxonSignedRank, type WilcoxonSignedRankResult } from '../stats/wilcoxonSignedRank'
import { buildWilcoxonSignedRank } from './buildWilcoxonSignedRank'
import { runDistributionNormality, type DistributionNormalityResult } from '../stats/distributionNormality'
import { buildDistributionNormality } from './buildDistributionNormality'
import { runSummaryStatistics, type SummaryStatsResult } from '../stats/summaryStatistics'
import { buildSummaryStatistics } from './buildSummaryStatistics'
import { runFrequenciesCrosstabs, type FrequenciesResult } from '../stats/frequenciesCrosstabs'
import { buildFrequenciesCrosstabs } from './buildFrequenciesCrosstabs'
import { runOneWayAnova, type OneWayAnovaResult } from '../stats/oneWayAnova'
import { buildOneWayAnova } from './buildOneWayAnova'
import { runFactorialAnova, type FactorialAnovaResult } from '../stats/factorialAnova'
import { buildFactorialAnova } from './buildFactorialAnova'
import { runRepeatedMeasuresAnova, type RepeatedMeasuresAnovaResult } from '../stats/repeatedMeasuresAnova'
import { buildRepeatedMeasuresAnova } from './buildRepeatedMeasuresAnova'
import { runMixedAnova, type MixedAnovaResult } from '../stats/mixedAnova'
import { buildMixedAnova } from './buildMixedAnova'
import { runNestedAnova, type NestedAnovaResult } from '../stats/nestedAnova'
import { buildNestedAnova } from './buildNestedAnova'
import { runWelchAnova, type WelchAnovaResult } from '../stats/welchAnova'
import { buildWelchAnova } from './buildWelchAnova'
import { runAncova, type AncovaResult } from '../stats/ancova'
import { buildAncova } from './buildAncova'
import { runManova, type ManovaResult } from '../stats/manova'
import { buildManova } from './buildManova'
import { runMancova, type MancovaResult } from '../stats/mancova'
import { buildMancova } from './buildMancova'
import { runKruskalWallis, type KruskalWallisResult } from '../stats/kruskalWallis'
import { buildKruskalWallis } from './buildKruskalWallis'
import { runFriedman, type FriedmanResult } from '../stats/friedman'
import { buildFriedman } from './buildFriedman'
import { runPearson, type PearsonResult } from '../stats/pearson'
import { buildPearson } from './buildPearson'
import { runSpearman, type SpearmanResult } from '../stats/spearman'
import { buildSpearman } from './buildSpearman'
import { runKendallsTau, type KendallsTauResult } from '../stats/kendallsTau'
import { buildKendallsTau } from './buildKendallsTau'
import { runChiSquareGof, type ChiSquareGofResult } from '../stats/chiSquareGof'
import { buildChiSquareGof } from './buildChiSquareGof'
import { runChiSquareIndependence, type ChiSquareIndependenceResult } from '../stats/chiSquareIndependence'
import { buildChiSquareIndependence } from './buildChiSquareIndependence'
import { runFishersExact, type FishersExactResult } from '../stats/fishersExact'
import { buildFishersExact } from './buildFishersExact'
import { runSimpleLinearRegression, type SimpleLinearResult } from '../stats/simpleLinearRegression'
import { buildSimpleLinearRegression } from './buildSimpleLinearRegression'
import { runMultipleLinearRegression, type MultipleLinearResult } from '../stats/multipleLinearRegression'
import { buildMultipleLinearRegression } from './buildMultipleLinearRegression'
import { runLogisticRegression, type LogisticResult } from '../stats/logisticRegression'
import { buildLogisticRegression } from './buildLogisticRegression'
import { runPoissonNegativeBinomial, type PoissonNbResult } from '../stats/poissonNegativeBinomial'
import { buildPoissonNegativeBinomial } from './buildPoissonNegativeBinomial'
import { runArimaSarima, type ArimaSarimaResult } from '../stats/arimaSarima'
import { buildArimaSarima } from './buildArimaSarima'
import { runStationarityTests, type StationarityResult } from '../stats/stationarityTests'
import { buildStationarityTests } from './buildStationarityTests'
import { runGrangerCausality, type GrangerResult } from '../stats/grangerCausality'
import { buildGrangerCausality } from './buildGrangerCausality'
import { runVar, type VarResult } from '../stats/var'
import { buildVar } from './buildVar'
import { runFixedEffects, type FixedEffectsResult } from '../stats/fixedEffects'
import { buildFixedEffects } from './buildFixedEffects'
import { runRandomEffects, type RandomEffectsResult } from '../stats/randomEffects'
import { buildRandomEffects } from './buildRandomEffects'
import { runHausmanTest, type HausmanResult } from '../stats/hausmanTest'
import { buildHausmanTest } from './buildHausmanTest'
import { runDid, type DidResult } from '../stats/did'
import { buildDid } from './buildDid'
import { runIvTwoStage, type IvResult } from '../stats/ivTwoStage'
import { buildIvTwoStage } from './buildIvTwoStage'
import { runRdd, type RddResult } from '../stats/rdd'
import { buildRdd } from './buildRdd'
import { runPropensityScoreMatching, type PsmResult } from '../stats/propensityScoreMatching'
import { buildPropensityScoreMatching } from './buildPropensityScoreMatching'
import { categoriesOf, propsArray } from '../data/props'
import { ciLevel } from '../format/apa'

/** Map the tails option choice to R's alternative= string (default: 'two.sided'). */
export const alternativeOf = (setup: TestSetup): string =>
  ({ 'one-tailed (greater)': 'greater', 'one-tailed (less)': 'less' }[String(setup.options['tails'] ?? 'two-tailed')] ?? 'two.sided')

export interface BuiltTable { spec: TableSpec; rows: Record<string, string | number>[] }
export interface CardContent {
  tables: BuiltTable[]
  note: { kind: 'assume' | 'plain'; text: string; afterTableId?: string } | null // afterTableId: render the note inline after that table (else after all tables)
  figures: { caption: string; type: string; file?: string; png: Uint8Array }[] // file: zip slug when the card bundle name differs from the type
  howToRead: string
  apa: string
  nExcluded: number
}
export type Runner = (engine: Engine, ds: Dataset, setup: TestSetup) => Promise<unknown>

const alphaOf = (setup: TestSetup) => Number(setup.options['alpha'] ?? 0.05)

export const RUNNERS: Record<string, Runner> = {
  'independent-t-test': (engine, ds, setup) =>
    runIndependentTTest(engine, ds, setup.roles['outcome'][0], setup.roles['group'][0], setup.options['equalVariance'] as boolean, ciLevel(setup.options['ci']), alphaOf(setup), alternativeOf(setup)),
  'one-sample-t-test': (engine, ds, setup) =>
    runOneSampleTTest(engine, ds, setup.roles['outcome'][0], setup.options['mu0'] as number, ciLevel(setup.options['ci']), alphaOf(setup), alternativeOf(setup)),
  'paired-t-test': (engine, ds, setup) =>
    runPairedTTest(engine, ds, setup.roles['conditionA'][0], setup.roles['conditionB'][0], ciLevel(setup.options['ci']), alphaOf(setup), alternativeOf(setup)),
  'mann-whitney-u': (engine, ds, setup) =>
    runMannWhitneyU(engine, ds, setup.roles['outcome'][0], setup.roles['group'][0], setup.options['continuity'] as boolean, false, alphaOf(setup), alternativeOf(setup)),
  'wilcoxon-signed-rank': (engine, ds, setup) =>
    runWilcoxonSignedRank(engine, ds, setup.roles['conditionA'][0], setup.roles['conditionB'][0], setup.options['continuity'] as boolean, false, alphaOf(setup), alternativeOf(setup)),
  'distribution-normality': (engine, ds, setup) => runDistributionNormality(engine, ds, setup.roles['variable']),
  'summary-statistics': (engine, ds, setup) =>
    runSummaryStatistics(engine, ds, setup.roles['variables'], setup.roles['groupBy'][0]),
  'frequencies-crosstabs': (engine, ds, setup) => runFrequenciesCrosstabs(engine, ds, setup.roles['variables']),
  'one-way-anova': (engine, ds, setup) =>
    runOneWayAnova(engine, ds, setup.roles['outcome'][0], setup.roles['factor'][0], setup.options['posthoc'] as string, ciLevel(setup.options['ci']), alphaOf(setup)),
  'factorial-anova': (engine, ds, setup) =>
    runFactorialAnova(engine, ds, setup.roles['outcome'][0], setup.roles['factors'], setup.options['interactions'] as boolean, ciLevel(setup.options['ci']), alphaOf(setup)),
  'repeated-measures-anova': (engine, ds, setup) =>
    runRepeatedMeasuresAnova(engine, ds, setup.roles['subject'][0], setup.roles['measures'], setup.options['sphericity'] as string, setup.options['posthoc'] as boolean, ciLevel(setup.options['ci']), alphaOf(setup)),
  'mixed-anova': (engine, ds, setup) =>
    runMixedAnova(engine, ds, setup.roles['subject'][0], setup.roles['between'][0], setup.roles['measures'], setup.options['sphericity'] as string, setup.options['posthoc'] as boolean, alphaOf(setup)),
  'nested-anova': (engine, ds, setup) =>
    runNestedAnova(engine, ds, setup.roles['outcome'][0], setup.roles['factor'][0], setup.roles['nested'][0], (setup.options['nesting'] as string) === 'random', alphaOf(setup)),
  'welch-anova': (engine, ds, setup) => runWelchAnova(engine, ds, setup.roles['outcome'][0], setup.roles['factor'][0], alphaOf(setup)),
  'ancova': (engine, ds, setup) => runAncova(engine, ds, setup.roles['outcome'][0], setup.roles['factor'], setup.roles['covariates'], ciLevel(setup.options['ci']), alphaOf(setup)),
  'manova': (engine, ds, setup) =>
    runManova(engine, ds, setup.roles['outcomes'], setup.roles['factors'], setup.options['statistic'] as string, setup.options['followups'] as boolean, alphaOf(setup)),
  'mancova': (engine, ds, setup) =>
    runMancova(engine, ds, setup.roles['outcomes'], setup.roles['factors'], setup.roles['covariates'], setup.options['statistic'] as string, alphaOf(setup)),
  'kruskal-wallis': (engine, ds, setup) => runKruskalWallis(engine, ds, setup.roles['outcome'][0], setup.roles['group'][0], alphaOf(setup)),
  'friedman': (engine, ds, setup) => runFriedman(engine, ds, setup.roles['subject'][0], setup.roles['measures'], alphaOf(setup)),
  'pearson': (engine, ds, setup) => runPearson(engine, ds, setup.roles['variableA'][0], setup.roles['variableB'][0], ciLevel(setup.options['ci']), alphaOf(setup), alternativeOf(setup)),
  'spearman': (engine, ds, setup) => runSpearman(engine, ds, setup.roles['variableA'][0], setup.roles['variableB'][0], alphaOf(setup), alternativeOf(setup)),
  'kendalls-tau': (engine, ds, setup) => runKendallsTau(engine, ds, setup.roles['variableA'][0], setup.roles['variableB'][0], alphaOf(setup), alternativeOf(setup)),
  'chi-square-goodness-of-fit': (engine, ds, setup) => {
    const v = setup.roles['variable'][0]
    const custom = setup.options['expectedProps'] === 'custom'
    return runChiSquareGof(engine, ds, v, custom ? propsArray(categoriesOf(ds, v), setup.props) : null, alphaOf(setup))
  },
  'chi-square-independence': (engine, ds, setup) =>
    runChiSquareIndependence(engine, ds, setup.roles['rowVar'][0], setup.roles['colVar'][0], setup.options['continuity'] as boolean, alphaOf(setup)),
  'fishers-exact': (engine, ds, setup) => runFishersExact(engine, ds, setup.roles['rowVar'][0], setup.roles['colVar'][0], alphaOf(setup), alternativeOf(setup)),
  'simple-linear-regression': (engine, ds, setup) =>
    runSimpleLinearRegression(engine, ds, setup.roles['outcome'][0], setup.roles['predictor'][0], ciLevel(setup.options['ci']), alphaOf(setup)),
  'multiple-linear-regression': (engine, ds, setup) =>
    runMultipleLinearRegression(engine, ds, setup.roles['outcome'][0], setup.roles['predictors'], setup.options['standardize'] as boolean, ciLevel(setup.options['ci']), alphaOf(setup)),
  'logistic-regression': (engine, ds, setup) =>
    runLogisticRegression(engine, ds, setup.roles['outcome'][0], setup.roles['predictors'], String(setup.options['event']), setup.options['reportOR'] as boolean, ciLevel(setup.options['ci']), alphaOf(setup)),
  'poisson-negative-binomial': (engine, ds, setup) =>
    runPoissonNegativeBinomial(engine, ds, setup.roles['outcome'][0], setup.roles['predictors'], setup.roles['exposure'][0] ?? null, setup.options['model'] as 'Poisson' | 'negative binomial', ciLevel(setup.options['ci']), alphaOf(setup)),
  'arima-sarima': (engine, ds, setup) =>
    runArimaSarima(engine, ds, setup.roles['time'][0], setup.roles['series'][0], {
      auto: String(setup.options['order'] ?? 'auto-select') !== 'manual',
      p: Number(setup.options['order.p'] ?? 0), d: Number(setup.options['order.d'] ?? 0), q: Number(setup.options['order.q'] ?? 0),
      P: Number(setup.options['order.P'] ?? 0), D: Number(setup.options['order.D'] ?? 0), Q: Number(setup.options['order.Q'] ?? 0),
      seasonalPeriod: Number(setup.options['seasonalPeriod'] ?? 1), horizon: Number(setup.options['horizon'] ?? 12),
      ciLevel: ciLevel(setup.options['ci']),
    }),
  'stationarity-tests': (engine, ds, setup) =>
    runStationarityTests(engine, ds, setup.roles['time'][0], setup.roles['series'][0], { alpha: alphaOf(setup) }),
  'granger-causality': (engine, ds, setup) =>
    runGrangerCausality(engine, ds, setup.roles['time'][0], setup.roles['seriesX'][0], setup.roles['seriesY'][0], { maxLag: Number(setup.options['maxLag'] ?? 4), alpha: alphaOf(setup) }),
  'var': (engine, ds, setup) =>
    runVar(engine, ds, setup.roles['time'][0], setup.roles['series'], { lagOrder: setup.options['lagOrder'] === 'auto' ? 'auto' : Number(setup.options['lagOrder']), irfHorizon: Number(setup.options['irfHorizon'] ?? 10) }),
  'fixed-effects': (engine, ds, setup) =>
    runFixedEffects(engine, ds, setup.roles['entity'][0], setup.roles['time'][0], setup.roles['outcome'][0], setup.roles['regressors'], { effect: String(setup.options['effects'] ?? 'entity'), seClustered: setup.options['se'] !== 'classical', alpha: alphaOf(setup) }),
  'random-effects': (engine, ds, setup) =>
    runRandomEffects(engine, ds, setup.roles['entity'][0], setup.roles['time'][0], setup.roles['outcome'][0], setup.roles['regressors'], { seClustered: setup.options['se'] !== 'classical', alpha: alphaOf(setup) }),
  'hausman-test': (engine, ds, setup) =>
    runHausmanTest(engine, ds, setup.roles['entity'][0], setup.roles['time'][0], setup.roles['outcome'][0], setup.roles['regressors'], { alpha: alphaOf(setup) }),
  'did': (engine, ds, setup) =>
    runDid(engine, ds, setup.roles['outcome'][0], setup.roles['treatment'][0], setup.roles['period'][0], setup.roles['entity'][0], setup.roles['time'][0], { seClustered: setup.options['se'] !== 'classical', alpha: alphaOf(setup) }),
  'iv-2sls': (engine, ds, setup) =>
    runIvTwoStage(engine, ds, setup.roles['outcome'][0], setup.roles['endogenous'], setup.roles['instruments'], setup.roles['controls'] ?? [], { seRobust: setup.options['se'] !== 'classical', alpha: alphaOf(setup) }),
  'rdd': (engine, ds, setup) =>
    runRdd(engine, ds, setup.roles['outcome'][0], setup.roles['running'][0], { cutoff: Number(setup.options['cutoff'] ?? 50), polyOrder: parseInt(String(setup.options['poly'] ?? '1'), 10) || 1, alpha: alphaOf(setup) }),
  'propensity-score-matching': (engine, ds, setup) => {
    const cal = Number(setup.options['caliper'])
    return runPropensityScoreMatching(engine, ds, setup.roles['outcome'][0], setup.roles['treatment'][0], setup.roles['covariates'], { ratio: parseInt(String(setup.options['ratio'] ?? '1'), 10) || 1, caliper: Number.isFinite(cal) ? cal : 0, alpha: alphaOf(setup) })
  },
}
export const BUILDERS: Record<string, (spec: TestSpec, result: unknown) => CardContent> = {
  'independent-t-test': (spec, result) => buildIndependentTTest(spec, result as TTestResult),
  'one-sample-t-test': (spec, result) => buildOneSampleTTest(spec, result as OneSampleTTestResult),
  'paired-t-test': (spec, result) => buildPairedTTest(spec, result as PairedTTestResult),
  'mann-whitney-u': (spec, result) => buildMannWhitneyU(spec, result as MannWhitneyUResult),
  'wilcoxon-signed-rank': (spec, result) => buildWilcoxonSignedRank(spec, result as WilcoxonSignedRankResult),
  'distribution-normality': (spec, result) => buildDistributionNormality(spec, result as DistributionNormalityResult),
  'summary-statistics': (spec, result) => buildSummaryStatistics(spec, result as SummaryStatsResult),
  'frequencies-crosstabs': (spec, result) => buildFrequenciesCrosstabs(spec, result as FrequenciesResult),
  'one-way-anova': (spec, result) => buildOneWayAnova(spec, result as OneWayAnovaResult),
  'factorial-anova': (spec, result) => buildFactorialAnova(spec, result as FactorialAnovaResult),
  'repeated-measures-anova': (spec, result) => buildRepeatedMeasuresAnova(spec, result as RepeatedMeasuresAnovaResult),
  'mixed-anova': (spec, result) => buildMixedAnova(spec, result as MixedAnovaResult),
  'nested-anova': (spec, result) => buildNestedAnova(spec, result as NestedAnovaResult),
  'welch-anova': (spec, result) => buildWelchAnova(spec, result as WelchAnovaResult),
  'ancova': (spec, result) => buildAncova(spec, result as AncovaResult),
  'manova': (spec, result) => buildManova(spec, result as ManovaResult),
  'mancova': (spec, result) => buildMancova(spec, result as MancovaResult),
  'kruskal-wallis': (spec, result) => buildKruskalWallis(spec, result as KruskalWallisResult),
  'friedman': (spec, result) => buildFriedman(spec, result as FriedmanResult),
  'pearson': (spec, result) => buildPearson(spec, result as PearsonResult),
  'spearman': (spec, result) => buildSpearman(spec, result as SpearmanResult),
  'kendalls-tau': (spec, result) => buildKendallsTau(spec, result as KendallsTauResult),
  'chi-square-goodness-of-fit': (spec, result) => buildChiSquareGof(spec, result as ChiSquareGofResult),
  'chi-square-independence': (spec, result) => buildChiSquareIndependence(spec, result as ChiSquareIndependenceResult),
  'fishers-exact': (spec, result) => buildFishersExact(spec, result as FishersExactResult),
  'simple-linear-regression': (spec, result) => buildSimpleLinearRegression(spec, result as SimpleLinearResult),
  'multiple-linear-regression': (spec, result) => buildMultipleLinearRegression(spec, result as MultipleLinearResult),
  'logistic-regression': (spec, result) => buildLogisticRegression(spec, result as LogisticResult),
  'poisson-negative-binomial': (spec, result) => buildPoissonNegativeBinomial(spec, result as PoissonNbResult),
  'arima-sarima': (spec, result) => buildArimaSarima(spec, result as ArimaSarimaResult),
  'stationarity-tests': (spec, result) => buildStationarityTests(spec, result as StationarityResult),
  'granger-causality': (spec, result) => buildGrangerCausality(spec, result as GrangerResult),
  'var': (spec, result) => buildVar(spec, result as VarResult),
  'fixed-effects': (spec, result) => buildFixedEffects(spec, result as FixedEffectsResult),
  'random-effects': (spec, result) => buildRandomEffects(spec, result as RandomEffectsResult),
  'hausman-test': (spec, result) => buildHausmanTest(spec, result as HausmanResult),
  'did': (spec, result) => buildDid(spec, result as DidResult),
  'iv-2sls': (spec, result) => buildIvTwoStage(spec, result as IvResult),
  'rdd': (spec, result) => buildRdd(spec, result as RddResult),
  'propensity-score-matching': (spec, result) => buildPropensityScoreMatching(spec, result as PsmResult),
}
