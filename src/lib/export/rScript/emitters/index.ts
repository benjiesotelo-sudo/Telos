import type { TestSpec } from '../../../registry/types'
import type { TestSetup } from '../../../../state/session'
import type { Dataset } from '../../../stats/types'
import { regressionEmitters, regressionPackages } from './regression'
import { groupEmitters, groupPackages } from './groups'
import { assocDescEmitters, assocDescPackages } from './assocDesc'
import { latentEmitters, latentPackages, latentItemDomain, latentRenameEntries } from './latent'

/** One test → its R snippet. `itemMap` (4th arg) is the SEM-family-only selection-global raw-column ->
 *  sanitized-R-token map (U10 fix, built once in emit.ts from the union of every selected test's item
 *  domain) — every non-SEM emitter ignores it. */
export type Emitter = (spec: TestSpec, setup: TestSetup, dataset: Dataset, itemMap?: Map<string, string>) => string

export const EMITTERS: Record<string, Emitter> = { ...regressionEmitters, ...groupEmitters, ...assocDescEmitters, ...latentEmitters }
export const PACKAGES: Record<string, string[]> = { ...regressionPackages, ...groupPackages, ...assocDescPackages, ...latentPackages }

/** id -> its raw SEM-family item/column domain (before sanitizing). Only the 7 SEM-family ids
 *  latentItemDomain knows about return anything; every other id falls through to `[]`. emit.ts unions
 *  this across the whole selection to compute ONE global rename map (U10 fix). */
export const getItemDomain = latentItemDomain

/** id -> raw-CSV-column-to-sanitized-R-token rename entries (X1/X2, export side), resolved against the
 *  selection-global map built by emit.ts. Only the 7 SEM-family ids latentRenameEntries knows about
 *  return anything; every other id falls through to `[]` there, so readData()'s rename param stays empty
 *  and every non-SEM script is untouched. */
export const getRenameEntries = latentRenameEntries
