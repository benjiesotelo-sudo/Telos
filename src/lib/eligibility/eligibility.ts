import type { RoleConstraint, TestSpec } from '../registry/types'
import type { CatalogEntry } from '../registry/catalog'
import { LATER_SLICE_REASON } from '../registry/catalog'
import type { ColumnMeta } from '../data/columnMeta'
import type { Dataset } from '../stats/types'

export interface Verdict { ok: boolean; reason: string | null }

const distinct = (ds: Dataset, colName: string) =>
  new Set(ds.rows.map((r) => r[colName]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '')).size

/** Can THIS column sit in THIS role? (step-6 slot rule — also reused per-config by the store's revalidation) */
export function slotCompatibility(role: RoleConstraint, col: ColumnMeta | undefined, working: Dataset): Verdict {
  if (!col) return { ok: false, reason: 'column not found' }
  if (!col.used) return { ok: false, reason: 'column is not marked Use' }
  if (col.level === null) return { ok: false, reason: 'needs a measurement level' }
  if (!role.levels.includes(col.level)) return { ok: false, reason: `needs ${role.levels[0] === 'interval' ? 'an' : 'a'} ${role.levels.join(' / ')} column` }
  if (role.tag && !col.tags.includes(role.tag))
    return { ok: false, reason: 'needs a count column (non-negative whole numbers)' }
  if (role.categories) {
    const d = distinct(working, col.name)
    if (role.categories.exact !== undefined && d !== role.categories.exact)
      return { ok: false, reason: `needs exactly ${role.categories.exact} categories` }
    if (role.categories.min !== undefined && d < role.categories.min)
      return { ok: false, reason: `needs ${role.categories.min}+ categories` }
  }
  return { ok: true, reason: null }
}

/** Complete = outcome is a finite number AND group is present (mirrors the stats listwise filter). */
export function completeRowsPerGroup(ds: Dataset, outcome: string, group: string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const r of ds.rows) {
    const o = r[outcome], g = r[group]
    if (typeof o === 'number' && Number.isFinite(o) && g !== null && g !== undefined && String(g).trim() !== '')
      counts[String(g)] = (counts[String(g)] ?? 0) + 1
  }
  return counts
}

/** Complete pairs: both condition columns numeric-finite in the same row (mirrors the paired listwise unit). */
export function completePairs(ds: Dataset, a: string, b: string): number {
  return ds.rows.filter((r) => typeof r[a] === 'number' && Number.isFinite(r[a] as number)
    && typeof r[b] === 'number' && Number.isFinite(r[b] as number)).length
}

/** Numeric-finite values present in one column. */
export function numericValues(ds: Dataset, col: string): number {
  return ds.rows.filter((r) => typeof r[col] === 'number' && Number.isFinite(r[col] as number)).length
}

/** Step-5 verdict: greyed + reason, or eligible. Candidate sets per role, then the test's minRule. */
export function testEligibility(entry: CatalogEntry, spec: TestSpec | null, columns: ColumnMeta[], working: Dataset): Verdict {
  if (entry.status === 'later-slice' || !spec) return { ok: false, reason: LATER_SLICE_REASON }
  const candidates = spec.constraints.roles.map((role) => columns.filter((c) => slotCompatibility(role, c, working).ok))
  for (let i = 0; i < candidates.length; i++) {
    const role = spec.constraints.roles[i]
    if (candidates[i].length < role.arity.min) {
      const label = spec.roles.find((r) => r.id === role.roleId)?.label ?? role.roleId
      return { ok: false, reason: role.tag
        ? `needs a count column (non-negative whole numbers) for ${label}`
        : `needs ${role.levels[0] === 'interval' ? 'an' : 'a'} ${role.levels.join(' / ')} column for ${label}` }
    }
  }
  const rule = spec.constraints.minRule
  if (rule.kind === 'rows-per-group') {
    for (const o of candidates[0]) for (const g of candidates[1]) {
      if (o.name === g.name) continue
      const per = completeRowsPerGroup(working, o.name, g.name)
      if (Object.keys(per).length && Object.values(per).every((n) => n >= rule.n)) return { ok: true, reason: null }
    }
    return { ok: false, reason: `needs at least ${rule.n} complete rows per group` }
  }
  if (rule.kind === 'complete-pairs') {
    for (const a of candidates[0]) for (const b of candidates[1] ?? candidates[0])
      if (a.name !== b.name && completePairs(working, a.name, b.name) >= rule.n) return { ok: true, reason: null }
    return { ok: false, reason: `needs at least ${rule.n} complete pairs` }
  }
  if (rule.kind === 'values') {
    if (candidates[0].some((c) => numericValues(working, c.name) >= rule.n)) return { ok: true, reason: null }
    return { ok: false, reason: `needs at least ${rule.n} values` }
  }
  if (rule.kind === 'complete-wide-rows') {
    const measures = candidates[candidates.length - 1] // the repeated-measures role is last by convention in this family
    for (const a of measures) for (const b of measures)
      if (a.name !== b.name && completePairs(working, a.name, b.name) >= rule.n) return { ok: true, reason: null }
    return { ok: false, reason: `needs at least ${rule.n} complete rows across two repeated-measure columns` }
  }
  if (candidates[0].length >= rule.n) return { ok: true, reason: null } // 'used-columns'
  return { ok: false, reason: `needs at least ${rule.n} usable column${rule.n > 1 ? 's' : ''}` }
}

/** Design §5.4: child levels appearing under >1 parent level (nested ANOVA sanity check). */
export function nestedLevelReuse(ds: Dataset, parent: string, child: string): string[] {
  const seen = new Map<string, Set<string>>()
  for (const r of ds.rows) {
    const p = r[parent], c = r[child]
    if (p == null || c == null || String(p).trim() === '' || String(c).trim() === '') continue
    if (!seen.has(String(c))) seen.set(String(c), new Set())
    seen.get(String(c))!.add(String(p))
  }
  return [...seen.entries()].filter(([, ps]) => ps.size > 1).map(([c]) => c).sort()
}
