import { readFileSync } from 'node:fs'
import type { Dataset } from '../types'

/** Test-only loader for the spike fixture (simple CSV: no quotes/embedded commas). */
export function loadAnovaFixture(): Dataset {
  const [head, ...lines] = readFileSync('src/lib/stats/fixtures/anova.csv', 'utf8').trim().split('\n')
  const cols = head.split(',').map((c) => c.replace(/^"|"$/g, ''))
  const rows = lines.map((l) => {
    const vals = l.split(',').map((v) => v.replace(/^"|"$/g, ''))
    return Object.fromEntries(cols.map((c, i) => {
      const n = Number(vals[i])
      return [c, vals[i] !== '' && Number.isFinite(n) && /^-?[\d.]+$/.test(vals[i]) ? n : vals[i]]
    }))
  })
  return { columns: cols, rows } as Dataset
}
