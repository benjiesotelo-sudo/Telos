import type { Dataset } from '../stats/types'
import type { ColumnMeta } from './columnMeta'

export type MissingPolicy = 'leave' | 'drop' | 'impute'
export interface MissingResult { dataset: Dataset; droppedCount: number }

const isMissing = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

/** Step-4a semantics (Benjie's R2 ruling): leave = pass-through (tests do their own listwise);
 *  drop = global listwise over Used columns; impute = mean (interval/ratio) / mode (nominal/ordinal). */
export function applyMissingPolicy(ds: Dataset, meta: ColumnMeta[], policy: MissingPolicy): MissingResult {
  if (policy === 'leave') return { dataset: ds, droppedCount: 0 }
  const used = meta.filter((c) => c.used).map((c) => c.name)
  if (policy === 'drop') {
    const rows = ds.rows.filter((r) => used.every((c) => !isMissing(r[c])))
    return { dataset: { ...ds, rows }, droppedCount: ds.rows.length - rows.length }
  }
  // impute
  const fill: Record<string, string | number | boolean> = {}
  for (const c of meta) {
    if (!c.used || c.level === null) continue
    const present = ds.rows.map((r) => r[c.name]).filter((v) => !isMissing(v)) as (string | number | boolean)[]
    if (!present.length) continue
    if (c.level === 'interval' || c.level === 'ratio') {
      const nums = present.filter((v): v is number => typeof v === 'number')
      if (nums.length) fill[c.name] = nums.reduce((a, b) => a + b, 0) / nums.length
    } else {
      const counts = new Map<string | number | boolean, number>()
      for (const v of present) counts.set(v, (counts.get(v) ?? 0) + 1)
      fill[c.name] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    }
  }
  const rows = ds.rows.map((r) => {
    const out = { ...r }
    for (const c of used) if (isMissing(out[c]) && c in fill) out[c] = fill[c]
    return out
  })
  return { dataset: { ...ds, rows }, droppedCount: 0 }
}
