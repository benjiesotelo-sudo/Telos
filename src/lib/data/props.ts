import type { Dataset } from '../stats/types'

/** Distinct non-empty values of a column, stringified + sorted — matches R's C-locale table() order for ASCII data. */
export const categoriesOf = (ds: Dataset, col: string): string[] =>
  [...new Set(ds.rows.map((r) => r[col])
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== '').map(String))].sort()

/** Effective custom proportions: stored value per category, equal split where unset. */
export const propsArray = (cats: string[], props: Record<string, number>): number[] =>
  cats.map((c) => props[c] ?? 1 / cats.length)

/** Run-gate rule for custom proportions (design R1): every value > 0, sum within 0.001 of 1. */
export const propsSumOk = (vals: number[]): boolean =>
  vals.length >= 2 && vals.every((v) => Number.isFinite(v) && v > 0)
  && Math.abs(vals.reduce((a, b) => a + b, 0) - 1) <= 0.001

/** Poisson exposure run gate (design convention 11): every PRESENT value must be a number > 0 — log(exposure) must exist. Missing values are the stats module's listwise territory. */
export const strictlyPositive = (ds: Dataset, col: string): boolean =>
  ds.rows.every((r) => { const v = r[col]; return v === null || v === undefined || String(v).trim() === '' || (typeof v === 'number' && Number.isFinite(v) && v > 0) })

/** level-select default (B2): the SECOND level alphabetically — matches the drawn 'passed · second level' and R glm's modeled (second) factor level. */
export const defaultEventLevel = (cats: string[]): string => cats[1] ?? cats[0] ?? ''
