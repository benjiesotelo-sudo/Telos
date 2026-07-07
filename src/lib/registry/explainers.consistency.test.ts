// A5 coverage gate (U8-T2, un-skipped + made GREEN by U8-T4): every reportable statistic must be
// reachable by a term-led explainer (docs/superpowers/specs/2026-07-06-telos-citable-complete-design.md
// §A5). This test enumerates every card's registry table column keys and asserts an EXPLAINERS entry
// exists per key per card - all 48 cards / 454 (card, key) pairs now covered.
import { describe, it, expect } from 'vitest'
import { SPECS } from './catalog'
import { EXPLAINERS } from './explainers'
import type { TableSpec } from './types'

// Every column key a card actually surfaces - classic tables (columns[]), coef tables (models + extraCols +
// gof), matrix tables (columns: [] deliberately - excluded, no per-cell explainer is expected; the matrix's
// own note/legend covers interpretation, consistent with A6's matrix devices doing the explaining visually).
function keysOf(t: TableSpec): string[] {
  if (t.kind === 'coef') return [...(t.models ?? []).map((m) => m.key), ...(t.extraCols ?? []).map((c) => c.key), ...(t.gof ?? []).map((g) => g.key)]
  if (t.columns.length === 0) return [] // matrix table
  return t.columns.map((c) => c.key).filter((k) => k !== 'term' && k !== '' && !['pair', 'group', 'construct', 'path', 'contrast', 'item', 'pred'].includes(k)) // exclude label/identifier columns - nothing to "interpret" about a row label itself
}

// Documented aggregate allowlist: a card can report a value synthesized across several rows/cells (e.g.
// "the largest VIF in this run") that has no registry column key of its own to require coverage for.
// Add `${cardId}:${key}` here ONLY with a comment naming the column the aggregate is drawn from - never
// to paper over a real gap. Currently empty: multiple-linear-regression's `vif` explainer key already
// matches the surfaced `vif` column directly (the aggregate framing - "largest VIF" - lives in the
// interpret() text via a `vifMax` computed value, not in the key), so no allowlist entry is needed for
// it today. Kept here, wired into the offender check below, as the accommodation T1 review flagged so
// Task 4 doesn't need to touch the check's logic if it hits a genuine synthesized-key case.
const AGGREGATE_ALLOWLIST = new Set<string>([])

describe('explainer coverage (A5 - machine-checked, drift-proof)', () => {
  it('every card has at least one explainer entry (placeholder gate; per-key check below is the real one)', () => {
    const missing = Object.keys(SPECS).filter((id) => !EXPLAINERS[id] || EXPLAINERS[id].length === 0)
    expect(missing).toEqual([])
  })
  it('every non-identifier column key surfaced by a card has a matching explainer entry (or a documented aggregate allowlist entry)', () => {
    const offenders: string[] = []
    for (const [id, spec] of Object.entries(SPECS)) {
      const keys = new Set(spec.tables.flatMap(keysOf))
      const have = new Set((EXPLAINERS[id] ?? []).map((e) => e.key))
      for (const k of keys) if (!have.has(k) && !AGGREGATE_ALLOWLIST.has(`${id}:${k}`)) offenders.push(`${id}:${k}`)
    }
    expect(offenders).toEqual([])
  })
})
