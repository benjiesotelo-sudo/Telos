import { describe, it, expect } from 'vitest'
import { headerGroups } from './types'
import type { ColumnDef } from './types'

// Table 5's post-merge shape (A3): H | Path | B | Std. β | p | Percentile 95% CI (Lower/Upper) |
// BC 95% CI (Lower/Upper) | Result - two spanned CI groups, everything else plain.
const table5Cols: ColumnDef[] = [
  { key: 'h', label: 'H' }, { key: 'path', label: 'Path' }, { key: 'b', label: 'B' },
  { key: 'beta', label: 'Std. β' }, { key: 'p', label: 'p' },
  { key: 'percLo', label: 'Lower', span: { group: 'Percentile 95% CI' } },
  { key: 'percHi', label: 'Upper', span: { group: 'Percentile 95% CI' } },
  { key: 'bcLo', label: 'Lower', span: { group: 'BC 95% CI' } },
  { key: 'bcHi', label: 'Upper', span: { group: 'BC 95% CI' } },
  { key: 'result', label: 'Result' },
]

describe('headerGroups', () => {
  it('groups adjacent columns sharing the same span.group into one entry', () => {
    const groups = headerGroups(table5Cols)
    const perc = groups.find((g) => g.group === 'Percentile 95% CI')
    const bc = groups.find((g) => g.group === 'BC 95% CI')
    expect(perc?.cols.map((c) => c.key)).toEqual(['percLo', 'percHi'])
    expect(bc?.cols.map((c) => c.key)).toEqual(['bcLo', 'bcHi'])
  })

  it('gives every ungrouped column its own entry with group undefined and cols.length 1', () => {
    const groups = headerGroups(table5Cols)
    const plain = groups.filter((g) => g.group == null)
    expect(plain.length).toBe(6) // h, path, b, beta, p, result
    for (const g of plain) expect(g.cols.length).toBe(1)
  })

  it('preserves column order (groups appear where their first member was)', () => {
    const groups = headerGroups(table5Cols)
    expect(groups.map((g) => g.group ?? g.cols[0].key)).toEqual([
      'h', 'path', 'b', 'beta', 'p', 'Percentile 95% CI', 'BC 95% CI', 'result',
    ])
  })

  it('two non-adjacent groups with the same label stay separate entries (adjacency, not label, decides)', () => {
    const cols: ColumnDef[] = [
      { key: 'a', label: 'A', span: { group: 'CI' } },
      { key: 'mid', label: 'Mid' },
      { key: 'b', label: 'B', span: { group: 'CI' } },
    ]
    const groups = headerGroups(cols)
    expect(groups.length).toBe(3)
    expect(groups[0].cols.map((c) => c.key)).toEqual(['a'])
    expect(groups[2].cols.map((c) => c.key)).toEqual(['b'])
  })

  it('a table with no span columns produces one ungrouped entry per column (byte-identical header case)', () => {
    const cols: ColumnDef[] = [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]
    const groups = headerGroups(cols)
    expect(groups).toEqual([{ key: 'a', group: undefined, cols: [cols[0]] }, { key: 'b', group: undefined, cols: [cols[1]] }])
  })
})
