import { describe, it, expect } from 'vitest'
import { slotCompatibility, testEligibility, completeRowsPerGroup } from './eligibility'
import { INDEPENDENT_T_TEST } from '../registry/independentTTest'
import { CATALOG } from '../registry/catalog'
import type { ColumnMeta } from '../data/columnMeta'
import type { Dataset } from '../stats/types'

const col = (name: string, level: ColumnMeta['level'], used = true): ColumnMeta =>
  ({ name, detected: 'float64', tags: [], level, used })
const ds: Dataset = { columns: ['score', 'group'], rows: [
  { score: 1, group: 'a' }, { score: 2, group: 'a' }, { score: 3, group: 'a' },
  { score: 4, group: 'b' }, { score: 5, group: 'b' }, { score: 6, group: 'b' },
] }
const tt = CATALOG.find((c) => c.id === 'independent-t-test')!
const outcomeRole = INDEPENDENT_T_TEST.constraints.roles[0]
const groupRole = INDEPENDENT_T_TEST.constraints.roles[1]

describe('slotCompatibility', () => {
  it('accepts a used ratio column for the outcome role', () =>
    expect(slotCompatibility(outcomeRole, col('score', 'ratio'), ds).ok).toBe(true))
  it('rejects wrong level with a readable reason', () =>
    expect(slotCompatibility(outcomeRole, col('group', 'nominal'), ds)).toEqual({ ok: false, reason: 'needs an interval / ratio column' }))
  it('rejects unused / missing-level columns', () => {
    expect(slotCompatibility(outcomeRole, col('score', 'ratio', false), ds).reason).toBe('column is not marked Use')
    expect(slotCompatibility(outcomeRole, col('score', null), ds).reason).toBe('needs a measurement level')
  })
  it('enforces the exact category count on the grouping role', () => {
    const three: Dataset = { columns: ['group'], rows: [{ group: 'a' }, { group: 'b' }, { group: 'c' }] }
    expect(slotCompatibility(groupRole, col('group', 'nominal'), three)).toEqual({ ok: false, reason: 'needs exactly 2 categories' })
  })
})

describe('completeRowsPerGroup', () => {
  it('counts complete (outcome numeric, group present) rows per group', () => {
    const holes: Dataset = { columns: ['score', 'group'], rows: [
      { score: 1, group: 'a' }, { score: null, group: 'a' }, { score: 2, group: 'b' },
    ] }
    expect(completeRowsPerGroup(holes, 'score', 'group')).toEqual({ a: 1, b: 1 })
  })
})

describe('testEligibility', () => {
  const cols = [col('score', 'ratio'), col('group', 'nominal')]
  it('t-test eligible on a ratio outcome + 2-category group with ≥3 complete rows per group', () =>
    expect(testEligibility(tt, INDEPENDENT_T_TEST, cols, ds)).toEqual({ ok: true, reason: null }))
  it('later-slice tests carry the honest reason', () =>
    expect(testEligibility(CATALOG.find((c) => c.id === 'pearson')!, null, cols, ds)).toEqual({ ok: false, reason: 'arrives in a later slice' }))
  it('reports the first unmeetable role', () =>
    expect(testEligibility(tt, INDEPENDENT_T_TEST, [col('a', 'nominal'), col('b', 'nominal')], ds).reason).toBe('needs an interval / ratio column for Outcome (DV)'))
  it('reports the min-rows rule when role-compatible pairs all lack data', () => {
    const tiny: Dataset = { columns: ['score', 'group'], rows: [
      { score: 1, group: 'a' }, { score: 2, group: 'a' }, { score: 3, group: 'b' },
    ] }
    expect(testEligibility(tt, INDEPENDENT_T_TEST, cols, tiny).reason).toBe('needs at least 3 complete rows per group')
  })
})
