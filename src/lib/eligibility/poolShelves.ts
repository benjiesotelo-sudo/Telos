import type { Level, RoleConstraint } from '../registry/types'
import type { ColumnMeta } from '../data/columnMeta'
import type { Dataset } from '../stats/types'
import { slotCompatibility } from './eligibility'
import { POOL_SHELF_NOTE } from '../../content/copy'

export const LEVEL_ORDER: Level[] = ['nominal', 'ordinal', 'interval', 'ratio']

export interface ShelfChip { col: ColumnMeta; assigned: boolean; ok: boolean; reason: string | null }
export interface Shelf { level: Level; chips: ShelfChip[]; dim: boolean; note: string | null }

/** Does this role accept this level? Mirrors slotCompatibility's level rules:
 *  a timeOrder role takes ordinal columns or a date-tagged chip regardless of its (empty) levels list. */
function roleAcceptsLevel(r: RoleConstraint, level: Level, cols: ColumnMeta[]): boolean {
  return r.timeOrder
    ? level === 'ordinal' || cols.some((c) => c.tags.includes('datetime'))
    : r.levels.includes(level)
}

/** Does any open slot accept this level in principle? */
function levelAccepted(level: Level, openRoles: RoleConstraint[], shelfCols: ColumnMeta[]): boolean {
  return openRoles.some((r) => roleAcceptsLevel(r, level, shelfCols))
}

/** Spec 2026-07-04 two-tier verdicts: shelf dims when the level alone rules every chip out (one shared
 *  note, chips clean); chips failing secondary constraints dim alone inside a lit shelf. */
export function buildShelves(columns: ColumnMeta[], openRoles: RoleConstraint[], assigned: Set<string>, working: Dataset): Shelf[] {
  return LEVEL_ORDER.map((level) => {
    const cols = columns.filter((c) => c.used && c.level === level)
    const dim = cols.length > 0 && openRoles.length > 0 && !levelAccepted(level, openRoles, cols)
    const chips = cols.map((col): ShelfChip => {
      if (assigned.has(col.name)) return { col, assigned: true, ok: false, reason: null }
      const fits = openRoles.map((r) => slotCompatibility(r, col, working))
      const ok = fits.some((v) => v.ok)
      // find reason from a role that accepts this level (if any), or just the first role if none accept the level
      const acceptingIndex = openRoles.findIndex((r) => roleAcceptsLevel(r, level, cols))
      const reasonIndex = acceptingIndex >= 0 ? acceptingIndex : 0
      const reason = ok || dim || !openRoles.length ? null : fits[reasonIndex]?.reason ?? fits[0]?.reason ?? null
      return { col, assigned: false, ok, reason }
    })
    return { level, chips, dim, note: dim ? POOL_SHELF_NOTE(level) : null }
  })
}
