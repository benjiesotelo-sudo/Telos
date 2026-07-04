const BY_ID: Record<string, string> = { tails: 'Hypothesis', 'equal-variance': 'Variances', posthoc: 'Post-hoc' }
/** Presentational grouping only (spec §2). Extend BY_ID when a new option deserves a named row. */
export function optionGroup(o: { id: string; kind: string }): string {
  return o.kind === 'display' ? 'Display' : BY_ID[o.id] ?? 'Settings'
}
