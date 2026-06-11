import { describe, it, expect } from 'vitest'
import { deriveColumns, detectType, suggestLevel, fixType, compatibleLevels } from './columnMeta'
import type { Dataset } from '../stats/types'

const ds: Dataset = { columns: ['id', 'wage', 'female', 'hired', 'note', 'start'], rows: [
  { id: 1, wage: 12.5, female: 0, hired: true, note: 'a', start: '2024-01-05' },
  { id: 2, wage: 9.25, female: 1, hired: false, note: 'b', start: '2024-02-11' },
  { id: 3, wage: 11.0, female: 1, hired: true, note: null, start: '2024-03-20' },
] }

describe('detectType', () => {
  it('classifies with the spec vocabulary', () => {
    expect(detectType([1, 2, 3])).toBe('int64')
    expect(detectType([1.5, 2, null])).toBe('float64')   // nulls ignored
    expect(detectType([true, false])).toBe('bool')
    expect(detectType(['2024-01-05', '2024-02-11'])).toBe('datetime64')
    expect(detectType(['a', 'b'])).toBe('object')
    expect(detectType([null, null])).toBe('object')      // nothing to go on
    expect(detectType(['1', '2'])).toBe('object')        // numeric-as-text stays object — that's what fix-type is for
  })
})

describe('deriveColumns', () => {
  const cols = deriveColumns(ds)
  it('detects types, tags and pre-fills suggested levels', () => {
    expect(cols.map((c) => [c.name, c.detected, c.level, c.used])).toEqual([
      ['id', 'int64', null, false],          // id tag → excluded by default, no level
      ['wage', 'float64', 'ratio', true],
      ['female', 'int64', 'ratio', true],    // numeric → ratio suggestion (student corrects to nominal in the UI)
      ['hired', 'bool', 'nominal', true],
      ['note', 'object', 'nominal', true],
      ['start', 'datetime64', 'interval', true],
    ])
  })
  it('tags: consecutive unique ints → id; nonneg ints → count; datetime64 → datetime', () => {
    expect(cols.find((c) => c.name === 'id')!.tags).toContain('id')
    expect(cols.find((c) => c.name === 'female')!.tags).toContain('count')
    expect(cols.find((c) => c.name === 'start')!.tags).toEqual(['datetime'])
  })
})

describe('fixType', () => {
  it('coerces numeric-as-text to numbers; unparseable becomes null (missing)', () => {
    const d: Dataset = { columns: ['x'], rows: [{ x: '12' }, { x: ' 3.5 ' }, { x: 'n/a' }] }
    const fixed = fixType(d, 'x')
    expect(fixed.rows.map((r) => r.x)).toEqual([12, 3.5, null])
  })
})

describe('suggestLevel', () => {
  it('maps detected type → level per the spec note', () => {
    expect(suggestLevel('int64')).toBe('ratio'); expect(suggestLevel('float64')).toBe('ratio')
    expect(suggestLevel('object')).toBe('nominal'); expect(suggestLevel('bool')).toBe('nominal')
    expect(suggestLevel('datetime64')).toBe('interval')
  })
})

describe('compatibleLevels', () => {
  it('limits level choices to what the stored type supports (spec 4d: "within compatibility")', () => {
    expect(compatibleLevels('float64')).toEqual(['nominal', 'ordinal', 'interval', 'ratio'])
    expect(compatibleLevels('object')).toEqual(['nominal', 'ordinal'])
    expect(compatibleLevels('bool')).toEqual(['nominal', 'ordinal'])
    expect(compatibleLevels('datetime64')).toEqual(['nominal', 'ordinal', 'interval'])
  })
})
