import type { Dataset } from '../stats/types'
import type { Level } from '../registry/types'

export type DetectedType = 'int64' | 'float64' | 'object' | 'bool' | 'datetime64'
export type Tag = 'count' | 'datetime' | 'id' | 'nested' // full spec tag vocabulary; 'nested' has no auto-detector in this slice (recorded decision — never emitted by detectTags)
export interface ColumnMeta { name: string; detected: DetectedType; tags: Tag[]; level: Level | null; used: boolean }

const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ].*)?$/ // ⚠ conservative ISO-date heuristic; validation workflow probes edge cases

export function detectType(values: (string | number | boolean | null)[]): DetectedType {
  const v = values.filter((x): x is string | number | boolean => x !== null)
  if (!v.length) return 'object'
  if (v.every((x) => typeof x === 'boolean')) return 'bool'
  if (v.every((x) => typeof x === 'number')) return v.every((x) => Number.isInteger(x)) ? 'int64' : 'float64'
  if (v.every((x) => typeof x === 'string' && DATE_RE.test(x))) return 'datetime64'
  return 'object'
}

export function detectTags(values: (string | number | boolean | null)[], detected: DetectedType): Tag[] {
  const tags: Tag[] = []
  const v = values.filter((x) => x !== null)
  if (detected === 'datetime64') tags.push('datetime')
  if (detected === 'int64') {
    const nums = v as number[]
    if (nums.every((x) => x >= 0)) tags.push('count')
    // id = a serial column: unique ints forming ONE consecutive run (1..n style). Plain uniqueness is not
    // enough — real outcome columns (test scores, wages) are routinely all-unique and must stay Used.
    // (min/max via loop: spread Math.max(...nums) throws RangeError at ~125k elements; spec allows 100k rows)
    let min = Infinity, max = -Infinity
    for (const x of nums) { min = Math.min(min, x); max = Math.max(max, x) }
    if (nums.length > 1 && new Set(nums).size === nums.length && max - min === nums.length - 1) tags.push('id')
  }
  return tags
}

export function suggestLevel(detected: DetectedType): Level {
  if (detected === 'int64' || detected === 'float64') return 'ratio'
  if (detected === 'datetime64') return 'interval'
  return 'nominal' // object, bool
}

export function deriveColumns(ds: Dataset): ColumnMeta[] {
  return ds.columns.map((name) => {
    const values = ds.rows.map((r) => r[name] ?? null)
    const detected = detectType(values)
    const tags = detectTags(values, detected)
    const isId = tags.includes('id')
    return { name, detected, tags, level: isId ? null : suggestLevel(detected), used: !isId }
  })
}

/** Spec 4d: the level is changeable only within what the stored type supports; "fix type" is the route to numeric levels. */
export function compatibleLevels(detected: DetectedType): Level[] {
  if (detected === 'int64' || detected === 'float64') return ['nominal', 'ordinal', 'interval', 'ratio']
  if (detected === 'datetime64') return ['nominal', 'ordinal', 'interval']
  return ['nominal', 'ordinal'] // object, bool — DRAFT mapping, Benjie confirms at rendered review
}

/** The spec's "fix type" override: numeric-as-text → numbers; unparseable → null (missing). */
export function fixType(ds: Dataset, column: string): Dataset {
  const rows = ds.rows.map((r) => {
    const raw = r[column]
    if (typeof raw !== 'string') return r
    const n = Number(raw.trim())
    return { ...r, [column]: raw.trim() !== '' && Number.isFinite(n) ? n : null }
  })
  return { ...ds, rows }
}
