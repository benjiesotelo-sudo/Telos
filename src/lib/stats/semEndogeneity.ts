/**
 * Single source for the SEM path-mode endogeneity derivations (T11/R13, board-clearing slice).
 * Pure functions, no imports - safe to consume from the stats runner (runCbSem.ts), the export
 * emitter (emitters/latent.ts), the store (session.ts's wlsmvAllowed), and SemControls without
 * creating dependency cycles. Previously these blocks were hand-duplicated with sync comments.
 *
 * Amendment B (path mode only, docs/superpowers/specs/2026-07-11-path-mode-wlsmv-design.md): a
 * PLACED ordinal column only declares lavaan `ordered=` when it is ENDOGENOUS in the drawn paths
 * (some path's `to` is that column's construct id) - lavaan applies threshold semantics only to
 * endogenous ordered variables; declaring an exogenous one warns ("no thresholds") and changes
 * nothing numerically (T1 spike evidence). Exogenous ordinal columns are downgraded to 'scale'
 * (so semFitArgs never adds them to orderedRaw) and surfaced separately via exogenousOrdinals for
 * the card/script disclosure. Latent mode is unaffected: every ordinal item keeps its level
 * regardless of its role in the structural model (untouched H1 behavior).
 */

/** Structural subset of a construct as both consumers hold it (path mode: construct id = the
 *  column's placed index, per withPathModeConstructs; the construct "name" IS the observed column). */
export interface EndogeneityConstruct {
  id: number
  name: string
}

export interface SemEndogeneityInput {
  /** modelKind === 'path' (observed-only mode). Latent mode short-circuits every downgrade below. */
  isPath: boolean
  constructs: readonly EndogeneityConstruct[]
  /** Drawn structural paths; only `to` matters here (a construct is endogenous iff some path targets it). */
  paths: readonly { to: number }[]
  /** The raw used-column universe (runCbSem's usedCols / the emitter's indicatorDomain): the observed
   *  columns in path mode, the items in latent mode. Output keys/entries stay in this order. */
  domain: readonly string[]
  /** Raw dataset column name -> Configure-data measurement level; missing entries default to 'scale'. */
  columnLevels: Record<string, string>
}

export interface SemEndogeneity {
  /** Per-domain-column levels with the path-mode exogenous-ordinal downgrade applied (semFitArgs input). */
  indicatorLevels: Record<string, string>
  /** Path mode: the placed ordinal columns that were downgraded (for the disclosure). Latent mode: []. */
  exogenousOrdinals: string[]
}

/** The isEndogenous/indicatorLevels/exogenousOrdinals derivation shared by runCbSem.ts and the
 *  cb-sem export emitter, so app and export downgrade the SAME columns by construction. */
export function semEndogeneity({ isPath, constructs, paths, domain, columnLevels }: SemEndogeneityInput): SemEndogeneity {
  const endogenousIds = new Set(paths.map((p) => p.to))
  const constructByName = new Map(constructs.map((c) => [c.name, c]))
  // Only ever consulted in path mode (isPath guards every call), where each domain column maps to a
  // construct by name - the non-null assertions mirror the original inline blocks exactly.
  const isEndogenous = (raw: string) => endogenousIds.has(constructByName.get(raw)!.id)
  const indicatorLevels: Record<string, string> = Object.fromEntries(
    domain.map((raw) => {
      const level = columnLevels[raw] ?? 'scale'
      return [raw, isPath && level === 'ordinal' && !isEndogenous(raw) ? 'scale' : level]
    }),
  )
  const exogenousOrdinals = isPath
    ? domain.filter((raw) => (columnLevels[raw] ?? 'scale') === 'ordinal' && !isEndogenous(raw))
    : []
  return { indicatorLevels, exogenousOrdinals }
}

/** Structural subset of TestSetup that the WLSMV-eligibility derivation reads (accepts a real
 *  TestSetup at both call sites without importing the store type into this dependency-free module). */
export interface WlsmvOrdinalSetup {
  modelKind?: string
  placed?: readonly string[]
  paths?: readonly { to: number }[]
  constructs?: readonly { items: readonly string[] }[]
}

/** Does this setup have the ordinal indicator WLSMV needs? The ONE derivation behind both the
 *  SemControls option-greying and session.ts's wlsmvAllowed reset guard (R7) - previously duplicated
 *  with sync comments. Path mode: at least one PLACED ordinal column is ENDOGENOUS (some path's `to`
 *  is that column's placed index; Amendment B - lavaan only assigns thresholds to endogenous ordered
 *  variables). Latent mode: at least one construct item is ordinal-level. Moderation (which also
 *  forbids WLSMV) is deliberately NOT folded in: SemControls needs it separately for hint wording. */
export function hasWlsmvOrdinalIndicator(setup: WlsmvOrdinalSetup, levelOf: (col: string) => string | null | undefined): boolean {
  if (setup.modelKind === 'path') {
    const paths = setup.paths ?? []
    return (setup.placed ?? []).some((name, i) => levelOf(name) === 'ordinal' && paths.some((p) => p.to === i))
  }
  return (setup.constructs ?? []).some((c) => c.items.some((item) => levelOf(item) === 'ordinal'))
}
