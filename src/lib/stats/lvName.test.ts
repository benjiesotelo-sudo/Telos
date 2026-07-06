import { describe, it, expect } from 'vitest'
import { lvName, lvNames } from './lvName'

describe('lvName', () => {
  it('passes already-valid identifiers through unchanged', () => {
    expect(lvName('ind60')).toBe('ind60')
    expect(lvName('Image')).toBe('Image')
  })

  it('replaces spaces with underscores', () => {
    expect(lvName('ESG Perception')).toBe('ESG_Perception')
  })

  it('collapses runs of illegal/underscore characters to a single underscore', () => {
    expect(lvName('A   B')).toBe('A_B')
    expect(lvName('A___B')).toBe('A_B')
    expect(lvName('A-B/C')).toBe('A_B_C')
  })

  it('trims leading and trailing illegal characters', () => {
    expect(lvName('  Leading and trailing  ')).toBe('Leading_and_trailing')
    expect(lvName('__wrapped__')).toBe('wrapped')
  })

  it('prefixes a leading digit with X', () => {
    expect(lvName('1Factor')).toBe('X1Factor')
    expect(lvName('60')).toBe('X60')
  })

  it('falls back to X when nothing survives sanitization', () => {
    expect(lvName('???')).toBe('X')
    expect(lvName('日本語')).toBe('X')
  })
})

describe('lvNames', () => {
  it('dedupes collisions deterministically in input order', () => {
    expect(lvNames(['A B', 'A_B', 'A-B'])).toEqual(['A_B', 'A_B_2', 'A_B_3'])
  })

  it('dedupes all-illegal names that all fall back to X', () => {
    expect(lvNames(['???', '!!!'])).toEqual(['X', 'X_2'])
  })

  it('leaves distinct valid names untouched', () => {
    expect(lvNames(['ind60', 'dem60', 'dem65'])).toEqual(['ind60', 'dem60', 'dem65'])
  })

  it('only appends a suffix to the 2nd+ occurrence, not the 1st', () => {
    expect(lvNames(['Construct A', 'Construct B', 'Construct A'])).toEqual([
      'Construct_A',
      'Construct_B',
      'Construct_A_2',
    ])
  })
})
