import { describe, it, expect } from 'vitest'
import { toCsv } from './cleanedCsv'

describe('toCsv', () => {
  it('quotes fields with commas, leaves numbers bare, empties nulls, trailing newline (RFC-4180)', () => {
    expect(toCsv({ columns: ['a', 'b'], rows: [{ a: 1, b: 'x,y' }, { a: 2, b: null }] })).toBe('a,b\n1,"x,y"\n2,\n')
  })
  it('doubles internal double-quotes and wraps the field', () => {
    expect(toCsv({ columns: ['a'], rows: [{ a: 'he said "hi"' }] })).toBe('a\n"he said ""hi"""\n')
  })
  it('wraps fields containing a newline', () => {
    expect(toCsv({ columns: ['a'], rows: [{ a: 'line1\nline2' }] })).toBe('a\n"line1\nline2"\n')
  })
})
