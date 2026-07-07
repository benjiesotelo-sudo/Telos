import type { TestSpec } from '../../../registry/types'
import type { TestSetup } from '../../../../state/session'
import type { Dataset } from '../../../stats/types'
import { regressionEmitters, regressionPackages } from './regression'
import { groupEmitters, groupPackages } from './groups'
import { assocDescEmitters, assocDescPackages } from './assocDesc'
import { latentEmitters, latentPackages, latentRenameEntries } from './latent'

/** One test → its R snippet. Tasks 3-5 add families to the per-file maps below. */
export type Emitter = (spec: TestSpec, setup: TestSetup, dataset: Dataset) => string

export const EMITTERS: Record<string, Emitter> = { ...regressionEmitters, ...groupEmitters, ...assocDescEmitters, ...latentEmitters }
export const PACKAGES: Record<string, string[]> = { ...regressionPackages, ...groupPackages, ...assocDescPackages, ...latentPackages }

/** id -> raw-CSV-column-to-sanitized-R-token rename entries (X1/X2, export side). Only the 7 SEM-family
 *  ids latentRenameEntries knows about return anything; every other id falls through to `[]` there, so
 *  readData()'s rename param stays empty and every non-SEM script is untouched. */
export const getRenameEntries = latentRenameEntries
