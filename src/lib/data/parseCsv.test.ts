import { describe, it, expect } from 'vitest'
import { parseCsv } from './parseCsv'
describe('parseCsv', () => {
  it('parses headers + typed rows', () => {
    const ds = parseCsv('group,score\nA,10\nB,12\n')
    expect(ds.columns).toEqual(['group', 'score'])
    expect(ds.rows[1]).toEqual({ group: 'B', score: 12 })
  })
  it('keeps missing cells as null — never 0 (the listwise filter downstream relies on this)', () => {
    const ds = parseCsv('group,score\nA,\nB,12\n')
    expect(ds.rows[0]).toEqual({ group: 'A', score: null })
  })
})
