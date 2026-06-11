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

export interface BuiltTable { spec: TableSpec; rows: Record<string, string | number>[] }
export interface CardContent {
  tables: BuiltTable[]
  note: { kind: 'assume' | 'plain'; text: string } | null
  figures: { caption: string; type: string; png: Uint8Array }[]
  howToRead: string
  apa: string
  nExcluded: number
}
export type Runner = (engine: Engine, ds: Dataset, setup: TestSetup) => Promise<unknown>

export const RUNNERS: Record<string, Runner> = {
  'independent-t-test': (engine, ds, setup) =>
    runIndependentTTest(engine, ds, setup.roles['outcome'][0], setup.roles['group'][0], setup.options['equalVariance'] as boolean),
  'one-sample-t-test': (engine, ds, setup) =>
    runOneSampleTTest(engine, ds, setup.roles['outcome'][0], setup.options['mu0'] as number),
  'paired-t-test': (engine, ds, setup) =>
    runPairedTTest(engine, ds, setup.roles['conditionA'][0], setup.roles['conditionB'][0]),
  'mann-whitney-u': (engine, ds, setup) =>
    runMannWhitneyU(engine, ds, setup.roles['outcome'][0], setup.roles['group'][0], setup.options['continuity'] as boolean),
}
export const BUILDERS: Record<string, (spec: TestSpec, result: unknown) => CardContent> = {
  'independent-t-test': (spec, result) => buildIndependentTTest(spec, result as TTestResult),
  'one-sample-t-test': (spec, result) => buildOneSampleTTest(spec, result as OneSampleTTestResult),
  'paired-t-test': (spec, result) => buildPairedTTest(spec, result as PairedTTestResult),
  'mann-whitney-u': (spec, result) => buildMannWhitneyU(spec, result as MannWhitneyUResult),
}
