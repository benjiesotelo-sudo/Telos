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
  if (role.categories && distinct(working, col.name) !== role.categories.exact)
    return { ok: false, reason: `needs exactly ${role.categories.exact} categories` }
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

/** Step-5 verdict: greyed + reason, or eligible. Brute-forces candidate role assignments (cheap at 46 tests × small role counts). */
export function testEligibility(entry: CatalogEntry, spec: TestSpec | null, columns: ColumnMeta[], working: Dataset): Verdict {
  if (entry.status === 'later-slice' || !spec) return { ok: false, reason: LATER_SLICE_REASON }
  const candidates = spec.constraints.roles.map((role) => columns.filter((c) => slotCompatibility(role, c, working).ok))
  for (let i = 0; i < candidates.length; i++) {
    if (!candidates[i].length) {
      const role = spec.constraints.roles[i]
      const label = spec.roles.find((r) => r.id === role.roleId)?.label ?? role.roleId
      return { ok: false, reason: `needs ${role.levels[0] === 'interval' ? 'an' : 'a'} ${role.levels.join(' / ')} column for ${label}` }
    }
  }
  // any disjoint assignment meeting the min-rows rule? (t-test: outcome × group pairs)
  for (const o of candidates[0]) for (const g of candidates[1]) {
    if (o.name === g.name) continue
    const per = completeRowsPerGroup(working, o.name, g.name)
    if (Object.keys(per).length && Object.values(per).every((n) => n >= spec.constraints.minRowsPerGroup)) return { ok: true, reason: null }
  }
  return { ok: false, reason: `needs at least ${spec.constraints.minRowsPerGroup} complete rows per group` }
}
