import type { Construct, StructuralPath, Moderation } from '../../state/session'

/** Internal record carrying what the R env needs per moderation: item lists for the `indProd()` calls,
 *  and the labels for pulling estimates back out. `pathLabel` is a UI-facing display string
 *  ("SN → TI"); `pathLabel_` is the lavaan free-parameter label of the moderated path (`p_<from>_<to>`). */
export interface ModerationDef {
  id: number; moderatorName: string; pathLabel: string; matched: boolean
  intLabel: string; modLabel: string; varLabel: string; pathLabel_: string
  var1: string[]; var2: string[]; targetName: string
}

/** Fixed disclosure text (design §A7 / U2-T4 brief) shown on a moderation row ONLY when the moderator
 *  and the moderated path's source construct have unequal indicator counts, so `indProd(match=FALSE)`
 *  (all-possible product indicators) ran instead of the matched-pairs default. Exported so the
 *  export emitter reuses the SAME string (app ≡ export). */
export const MODERATION_DISCLOSURE =
  "Moderator and the path's source construct have unequal indicator counts; product indicators use " +
  'all possible pairs (match=FALSE, double mean-centered) rather than matched pairs — see Marsh, Wen ' +
  '& Hau (2004) for the matched-pairs method used when counts are equal.'

/** Guards (design §A7): no self-moderation, no duplicate, not in path-analysis (observed-only) mode.
 *  Same error messages `buildModel` threw inline before this extraction. */
export function validateModerations(moderations: Moderation[], paths: StructuralPath[], isPath: boolean): void {
  for (const mod of moderations) {
    const path = paths[mod.pathIndex]
    if (!path) throw new Error(`Moderation references paths[${mod.pathIndex}], which does not exist.`)
    if (mod.moderatorId === path.from || mod.moderatorId === path.to) {
      throw new Error('A construct cannot moderate a path it is already the source or target of.')
    }
  }
  if (isPath && moderations.length) {
    throw new Error('Latent moderation is not available in path-analysis (observed-only) mode.')
  }
  const seen = new Set<string>()
  for (const mod of moderations) {
    const key = `${mod.moderatorId}:${mod.pathIndex}`
    if (seen.has(key)) throw new Error('Duplicate moderation: the same moderator already moderates this path.')
    seen.add(key)
  }
}

/** Per-moderation model lines: the interaction construct (INT_<id>) built from double-mean-centered
 *  product indicators (semTools::indProd naming — matched: var1[i].var2[i]; unmatched: all var1[i].var2[j]
 *  pairs), plus the moderator's own main-effect covariate (pmod_<id>, AUTO-INJECTED onto the target's
 *  regression unless an existing drawn path already predicts it) and its variance (vmod_<id>, needed by
 *  the `:=` simple-slope definitions a later task adds). `targetLineExtras` is keyed by `pathIndex` — the
 *  CALLER (`buildModel`, which already has the base structural lines in scope) splices each extra onto its
 *  own existing target line. */
export function buildModerationLines(
  constructs: Construct[],
  paths: StructuralPath[],
  rNameOf: (id: number) => string,
  moderations: Moderation[],
): { lines: string[]; moderationDefs: ModerationDef[]; targetLineExtras: Map<number, string> } {
  const byId = new Map(constructs.map((c) => [c.id, c]))
  const lines: string[] = []
  const moderationDefs: ModerationDef[] = []
  const targetLineExtras = new Map<number, string>()
  for (const mod of moderations) {
    const path = paths[mod.pathIndex]
    const source = byId.get(path.from)!
    const target = byId.get(path.to)!
    const moderator = byId.get(mod.moderatorId)!
    const matched = source.items.length === moderator.items.length
    const intName = `INT_${mod.id}`
    const modLabel = `pmod_${mod.id}`
    const intLabel = `pint_${mod.id}`
    const varLabel = `vmod_${mod.id}`
    const pathLabel_ = `p_${path.from}_${path.to}`

    // Product-indicator naming REPLICATES semTools::indProd exactly (var1[i].var2[j], match=TRUE:
    // i==j pairs only, match=FALSE: all i,j pairs) — the R side calls indProd() with the SAME
    // var1/var2 item lists in the SAME order, so the names line up without a round trip.
    const prodNames = matched
      ? source.items.map((it, i) => `${it}.${moderator.items[i]}`)
      : source.items.flatMap((a) => moderator.items.map((b) => `${a}.${b}`))
    lines.push(`${intName} =~ ${prodNames.join(' + ')}`)

    // Moderator main-effect covariate on the target, UNLESS an existing drawn path already predicts it.
    const alreadyPredicts = paths.some((p) => p.from === mod.moderatorId && p.to === path.to)
    const extra = (alreadyPredicts ? '' : ` + ${modLabel}*${rNameOf(mod.moderatorId)}`) + ` + ${intLabel}*${intName}`
    targetLineExtras.set(mod.pathIndex, (targetLineExtras.get(mod.pathIndex) ?? '') + extra)
    lines.push(`${rNameOf(mod.moderatorId)} ~~ ${varLabel}*${rNameOf(mod.moderatorId)}`)

    // Simple slopes at -1SD/mean/+1SD (Aiken & West 1991), defined INSIDE the model (production design
    // per the moderation spike §2b(3)) so bootstrap CIs fall out of the SAME single run and correctly
    // propagate the moderator-SD uncertainty per resample -- NOT the hand-rolled post-hoc arithmetic the
    // spike's original (non-`:=`) script used.
    lines.push(`slope_lo_${mod.id}  := ${pathLabel_} - ${intLabel}*sqrt(${varLabel})`)
    lines.push(`slope_mid_${mod.id} := ${pathLabel_}`)
    lines.push(`slope_hi_${mod.id}  := ${pathLabel_} + ${intLabel}*sqrt(${varLabel})`)

    moderationDefs.push({
      id: mod.id, moderatorName: moderator.name, pathLabel: `${source.name} → ${target.name}`,
      matched, intLabel, modLabel, varLabel, pathLabel_,
      var1: source.items, var2: moderator.items, targetName: rNameOf(path.to),
    })
  }
  return { lines, moderationDefs, targetLineExtras }
}

/** The indProd() data-prep block ONLY — no model-string assembly (the model text, including the
 *  moderation lines above, is already fully assembled TS-side by `buildModel` before this ever runs; R
 *  just needs to build the product-indicator columns before the fit). Consumes the flattened env arrays
 *  `moderationIndProdEnv` produces below; the SAME text is meant to feed both `runCbSem.ts`'s R_STATS
 *  block and the `cb-sem` R-script export emitter (export ≡ app; wiring lands in a later task). */
export const INDPROD_R = String.raw`
# Defensive defaults: the WebR call site (runCbSem.ts) deliberately OMITS these vars from the env
# object on a non-moderation run rather than sending empty JS arrays -- webr's JS->R env marshalling
# misdetects an empty array as tabular "array of row-objects" data (Array.prototype.every is vacuously
# true on []) and crashes converting it to a data.frame. R defines its own empty typed vectors instead.
if (!exists('mod_ids', inherits = FALSE)) {
  mod_ids <- integer(0); mod_var1_flat <- character(0); mod_var1_lens <- integer(0)
  mod_var2_flat <- character(0); mod_var2_lens <- integer(0); mod_matched <- logical(0)
  mod_target <- character(0)
}
if (length(mod_ids) > 0) {
  suppressMessages(library(semTools))
  v1_start <- 1L; v2_start <- 1L
  for (mi in seq_along(mod_ids)) {
    v1 <- mod_var1_flat[v1_start:(v1_start + mod_var1_lens[mi] - 1L)]; v1_start <- v1_start + mod_var1_lens[mi]
    v2 <- mod_var2_flat[v2_start:(v2_start + mod_var2_lens[mi] - 1L)]; v2_start <- v2_start + mod_var2_lens[mi]
    d <- indProd(d, var1 = v1, var2 = v2, match = as.logical(mod_matched[mi]), meanC = TRUE, doubleMC = TRUE)
  }
}
`

/** Flattens ModerationDef[] into the R env arrays INDPROD_R consumes — same flattening convention as
 *  `item_cols_flat` elsewhere in `runCbSem.ts`. Shared by the WebR env object and the R-script emitter's
 *  literal R-vector emission (both consume it identically so export ≡ app). */
export function moderationIndProdEnv(defs: ModerationDef[]) {
  return {
    mod_ids: defs.map((d) => d.id),
    mod_var1_flat: defs.flatMap((d) => d.var1), mod_var1_lens: defs.map((d) => d.var1.length),
    mod_var2_flat: defs.flatMap((d) => d.var2), mod_var2_lens: defs.map((d) => d.var2.length),
    mod_matched: defs.map((d) => d.matched),
    mod_target: defs.map((d) => d.targetName),
  }
}
