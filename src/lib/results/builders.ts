import type { TestSpec, TableSpec } from '../registry/types'
import type { Engine } from '../webr/engine'
import type { Dataset, TTestResult } from '../stats/types'
import type { TestSetup } from '../../state/session'
import { runIndependentTTest } from '../stats/independentTTest'
import { buildIndependentTTest } from './buildIndependentTTest'
import { runOneSampleTTest, type OneSampleTTestResult } from '../stats/oneSampleTTest'
import { buildOneSampleTTest } from './buildOneSampleTTest'

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
}
export const BUILDERS: Record<string, (spec: TestSpec, result: unknown) => CardContent> = {
  'independent-t-test': (spec, result) => buildIndependentTTest(spec, result as TTestResult),
  'one-sample-t-test': (spec, result) => buildOneSampleTTest(spec, result as OneSampleTTestResult),
}
