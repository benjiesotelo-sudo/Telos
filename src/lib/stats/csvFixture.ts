import { readFileSync } from 'node:fs'
import type { Dataset } from './types'

/** Load a committed CSV fixture into a Dataset (test helper). Numeric-looking cells become numbers,
 *  everything else stays a string; empty cells become null. Plain comma-split (fixtures have no quoted commas). */
export function loadCsvFixture(absPath: string): Dataset {
  const lines = readFileSync(absPath, 'utf8').trim().split(/\r?\n/)
  const columns = lines[0].split(',')
  const rows = lines.slice(1).map((line) => {
    const cells = line.split(',')
    const row: Record<string, string | number | null> = {}
    columns.forEach((c, i) => {
      const v = cells[i] ?? ''
      if (v === '') { row[c] = null; return }
      const n = Number(v)
      row[c] = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(v) && Number.isFinite(n) ? n : v
    })
    return row
  })
  return { columns, rows }
}
