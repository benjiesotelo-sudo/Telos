import { describe, it, expect } from 'vitest'
import { slotCompatibility, testEligibility, completeRowsPerGroup, nestedLevelReuse } from './eligibility'
import { INDEPENDENT_T_TEST } from '../registry/independentTTest'
import { ARIMA_SARIMA } from '../registry/arimaSarima'
import { CATALOG } from '../registry/catalog'
import type { ColumnMeta } from '../data/columnMeta'
import type { Dataset } from '../stats/types'
import type { Level, TestSpec, RoleConstraint } from '../registry/types'
import type { CatalogEntry } from '../registry/catalog'

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

describe('time-order + excludeTag guards (econometrics)', () => {
  const dt = (name: string): ColumnMeta => ({ name, detected: 'datetime64', tags: ['datetime'], level: 'interval', used: true })
  const timeRole: RoleConstraint = { roleId: 'time', levels: [], arity: { min: 1, max: 1 }, timeOrder: true }
  const seriesRole: RoleConstraint = { roleId: 'series', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, excludeTag: 'datetime' }
  it('time role accepts a datetime-tagged column', () =>
    expect(slotCompatibility(timeRole, dt('month'), ds).ok).toBe(true))
  it('time role accepts an ordinal column', () =>
    expect(slotCompatibility(timeRole, col('year', 'ordinal'), ds).ok).toBe(true))
  it('time role rejects a plain ratio column', () =>
    expect(slotCompatibility(timeRole, col('sales', 'ratio'), ds)).toEqual({ ok: false, reason: 'needs a date/time or ordered column' }))
  it('series role excludes the datetime column', () =>
    expect(slotCompatibility(seriesRole, dt('month'), ds)).toEqual({ ok: false, reason: 'the date/time column belongs in the Time slot, not here' }))
  it('series role still accepts a ratio column', () =>
    expect(slotCompatibility(seriesRole, col('sales', 'ratio'), ds).ok).toBe(true))
  it('a time-series test is eligible when the series has ≥n values (values minRule; Time role is non-numeric)', () => {
    const cols: ColumnMeta[] = [
      { name: 'month', detected: 'datetime64', tags: ['datetime'], level: 'interval', used: true },
      { name: 'sales', detected: 'float64', tags: [], level: 'ratio', used: true },
    ]
    const tsDs: Dataset = { columns: ['month', 'sales'], rows: Array.from({ length: 25 }, (_, i) => ({ month: `2020-${String(i + 1).padStart(2, '0')}-01`, sales: i + 1.5 })) }
    const entry = CATALOG.find((c) => c.id === 'arima-sarima')!
    expect(testEligibility(entry, ARIMA_SARIMA, cols, tsDs).ok).toBe(true)
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

describe('slotCompatibility categories.min', () => {
  const threeDs: Dataset = { columns: ['g'], rows: [{ g: 'a' }, { g: 'b' }, { g: 'c' }] }
  const twoDs: Dataset = { columns: ['g'], rows: [{ g: 'a' }, { g: 'b' }] }
  const minRole = { roleId: 'factor', levels: ['nominal', 'ordinal'] as Level[], arity: { min: 1, max: 1 }, categories: { min: 3 } }
  it('rejects a 2-category column when min is 3', () =>
    expect(slotCompatibility(minRole, col('g', 'nominal'), twoDs)).toEqual({ ok: false, reason: 'needs 3+ categories' }))
  it('accepts a 3-category column when min is 3', () =>
    expect(slotCompatibility(minRole, col('g', 'nominal'), threeDs)).toEqual({ ok: true, reason: null }))
})

describe('testEligibility complete-wide-rows', () => {
  const wideSpec: TestSpec = {
    id: 'rm-test', name: 'RM', question: 'q?', roles: [
      { id: 'measures', label: 'Measures', levels: 'interval / ratio', arity: '2+' },
    ],
    options: [], tables: [], howToRead: '', apaTemplate: '', rMap: '', bundleFiles: [],
    constraints: {
      roles: [{ roleId: 'measures', levels: ['interval', 'ratio'] as Level[], arity: { min: 2, max: Infinity } }],
      minRule: { kind: 'complete-wide-rows', n: 3 },
    },
  }
  const wideEntry = { id: 'rm-test', name: 'RM', family: 'Group comparisons', status: 'available' as const }
  const t1 = col('t1', 'ratio'); const t2 = col('t2', 'ratio')
  const bigWide: Dataset = { columns: ['t1', 't2'], rows: [
    { t1: 1, t2: 2 }, { t1: 3, t2: 4 }, { t1: 5, t2: 6 },
  ] }
  const smallWide: Dataset = { columns: ['t1', 't2'], rows: [
    { t1: 1, t2: 2 }, { t1: 3, t2: null },
  ] }
  it('passes when ≥n complete pairs exist across two measure columns', () =>
    expect(testEligibility(wideEntry, wideSpec, [t1, t2], bigWide)).toEqual({ ok: true, reason: null }))
  it('fails when no pair reaches n complete rows', () =>
    expect(testEligibility(wideEntry, wideSpec, [t1, t2], smallWide)).toEqual({ ok: false, reason: 'needs at least 3 complete rows across two repeated-measure columns' }))
})

describe('nestedLevelReuse', () => {
  it('returns child labels that appear under more than one parent', () => {
    const crossDs: Dataset = { columns: ['parent', 'child'], rows: [
      { parent: 'a', child: 'x' }, { parent: 'a', child: 'y' }, { parent: 'b', child: 'x' },
    ] }
    expect(nestedLevelReuse(crossDs, 'parent', 'child')).toEqual(['x'])
  })
  it('returns [] when nesting is clean (each child under exactly one parent)', () => {
    const cleanDs: Dataset = { columns: ['parent', 'child'], rows: [
      { parent: 'a', child: 'x' }, { parent: 'a', child: 'y' }, { parent: 'b', child: 'z' },
    ] }
    expect(nestedLevelReuse(cleanDs, 'parent', 'child')).toEqual([])
  })
})

describe('count-tag role constraint (B1)', () => {
  const countRole: RoleConstraint = { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, tag: 'count' }
  const countCol: ColumnMeta = { name: 'complaints', detected: 'int64', tags: ['count'], level: 'ratio', used: true }
  const floatCol: ColumnMeta = { name: 'months', detected: 'float64', tags: [], level: 'ratio', used: true }
  it('accepts a count-tagged column', () =>
    expect(slotCompatibility(countRole, countCol, ds).ok).toBe(true))
  it('rejects a non-count ratio column with the readable reason', () =>
    expect(slotCompatibility(countRole, floatCol, ds)).toEqual({ ok: false, reason: 'needs a count column (non-negative whole numbers)' }))
  it('the level check still precedes the tag check', () =>
    expect(slotCompatibility(countRole, { ...floatCol, level: 'nominal' }, ds).reason).toBe('needs an interval / ratio column'))
  it('an untagged role still accepts a count column (palette house rule: counts fit Predictors)', () => {
    const anyRole: RoleConstraint = { roleId: 'predictor', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } }
    expect(slotCompatibility(anyRole, countCol, ds).ok).toBe(true)
  })
  it('testEligibility names the count requirement when no count column exists', () => {
    const spec = { id: 'x', name: 'X', question: '', options: [], tables: [], howToRead: '', apaTemplate: '', rMap: '', bundleFiles: [],
      roles: [{ id: 'outcome', label: 'Outcome (DV)', levels: 'count', arity: 'non-negative integers · exactly 1' }],
      constraints: { roles: [countRole], minRule: { kind: 'complete-pairs', n: 3 } } } as unknown as TestSpec
    const entry = { id: 'x', name: 'X', family: 'F', status: 'available' } as CatalogEntry
    expect(testEligibility(entry, spec, [floatCol], ds).reason).toBe('needs a count column (non-negative whole numbers) for Outcome (DV)')
  })
})

describe('testEligibility panel (FE/RE/Hausman)', () => {
  const panelSpec: TestSpec = {
    id: 'fe-test', name: 'FE', question: 'q?', roles: [
      { id: 'entity', label: 'Entity', levels: 'nominal / ordinal', arity: 'exactly 1' },
      { id: 'time', label: 'Time', levels: 'datetime / ordered', arity: 'exactly 1' },
      { id: 'outcome', label: 'Outcome', levels: 'interval / ratio', arity: 'exactly 1' },
      { id: 'regressors', label: 'Regressors', levels: 'any', arity: '1+' },
    ],
    options: [], tables: [], howToRead: '', apaTemplate: '', rMap: '', bundleFiles: [],
    constraints: {
      roles: [
        { roleId: 'entity', levels: ['nominal', 'ordinal'] as Level[], arity: { min: 1, max: 1 } },
        { roleId: 'time', levels: [] as Level[], arity: { min: 1, max: 1 }, timeOrder: true },
        { roleId: 'outcome', levels: ['interval', 'ratio'] as Level[], arity: { min: 1, max: 1 }, excludeTag: 'datetime' },
        { roleId: 'regressors', levels: ['nominal', 'ordinal', 'interval', 'ratio'] as Level[], arity: { min: 1, max: Infinity }, excludeTag: 'datetime' },
      ],
      minRule: { kind: 'panel', n: 12 },
    },
  }
  const panelEntry = { id: 'fe-test', name: 'FE', family: 'Econometrics', status: 'available' as const }
  const cols = [col('firm', 'nominal'), col('year', 'ordinal'), col('roa', 'ratio'), col('leverage', 'ratio')]
  const mk = (firms: number[], years: number[]): Dataset => ({ columns: ['firm', 'year', 'roa', 'leverage'],
    rows: firms.flatMap((f) => years.map((y) => ({ firm: `firm${f}`, year: y, roa: f + y, leverage: 0.1 * y }))) })
  it('eligible with ≥2 entities, ≥2 periods, ≥12 complete rows', () =>
    expect(testEligibility(panelEntry, panelSpec, cols, mk([1, 2, 3], [1, 2, 3, 4, 5]))).toEqual({ ok: true, reason: null })) // 15 rows
  it('greyed when only 1 entity', () =>
    expect(testEligibility(panelEntry, panelSpec, cols, mk([1], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])).reason)
      .toBe('needs ≥2 entities, ≥2 periods, and ≥12 complete observations'))
  it('greyed when too few complete rows', () =>
    expect(testEligibility(panelEntry, panelSpec, cols, mk([1, 2], [1, 2, 3])).ok).toBe(false)) // 6 rows
})
