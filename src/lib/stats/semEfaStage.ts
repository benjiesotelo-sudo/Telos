// EFA preamble stage for the CB-SEM card (R1, board-clearing slice, docs/superpowers/specs/
// 2026-07-14-board-clearing-slice-design.md): when the card's EFA toggle is on, Tables E1
// (suitability: KMO + Bartlett) and E2 (rotated loadings) run BEFORE the confirmatory fit, as the
// card note has always promised ("EFA -> CFA -> fit -> structural").
//
// Single source of truth (same pattern as INDPROD_R / semFitArgs / R_SATURATED_PREDICATE): the
// computation fragment below is shared verbatim by the app runner (runCbSem.ts) and the export
// emitter (emitters/latent.ts), so app == export by construction.
//
// Fixed analysis choices - the CB-SEM card has no EFA selectors (unlike the standalone EFA card):
// principal-axis extraction + oblimin rotation, the standalone EFA card's own defaults (efa.ts).
// The factor count is FIXED to the number of constructs (efa_k): the stage is a diagnostic preamble
// checking whether the hypothesized structure emerges, not a retention-rule exploration.
// psych::fa here is deterministic (no simulation), but the seed is set anyway, matching the main
// fit's own convention (WebR == native parity discipline).

/** E1 suitability payload on CbSemResult (KMO + Bartlett's test of sphericity). */
export interface EfaStageSuitability {
  kmo: number
  bartlettChisq: number
  bartlettDf: number
  bartlettP: number
}

/** Raw JSON payload of the EFA-stage engine.runJson call (EFA_STAGE_STATS_R's returned list).
 *  Vector fields are typed `number[] | number` because .telos_json serializes an R length-1 vector
 *  as a bare scalar (engine.ts) - normalize with a spread-to-array guard TS-side. */
export interface RawEfaStage {
  kmo: number
  bartlettChisq: number
  bartlettDf: number
  bartlettP: number
  loadMat: number[] | number
  h2Vec: number[] | number
  ssPerFactor: number[] | number
}

/** Shared computation fragment. Expects `d_efa` (complete-cases data frame of the model's items)
 *  and `efa_k` (integer factor count) to be defined; leaves efa_kmo / efa_bart / efa_fa / efa_load /
 *  efa_h2 bound for the caller's own output shaping (runner: JSON list; emitter: cat/print). */
export const EFA_STAGE_R = String.raw`R_efa <- cor(d_efa)
efa_kmo <- as.numeric(psych::KMO(R_efa)$MSA)
efa_bart <- psych::cortest.bartlett(R_efa, n = nrow(d_efa))
set.seed(20260620)
efa_fa <- psych::fa(d_efa, nfactors = efa_k, fm = "pa", rotate = "oblimin")
efa_load <- unclass(efa_fa$loadings)
efa_h2 <- as.numeric(efa_fa$communality)`

/** The app runner's full EFA-stage block. Env bindings (all efa_-prefixed so nothing collides with
 *  the main fit's env names): efa_cols_flat (numeric, column-major over efa_items, LISTWISE rows -
 *  cor() needs complete cases), efa_items (character, sanitized item tokens), efa_n (integer rows),
 *  efa_k (integer factor count = number of constructs). Returns the RawEfaStage list. */
export const EFA_STAGE_STATS_R = String.raw`library(psych)
p <- length(efa_items)
d_efa <- as.data.frame(lapply(seq_len(p), function(i) efa_cols_flat[((i - 1) * efa_n + 1):(i * efa_n)]))
colnames(d_efa) <- efa_items
${EFA_STAGE_R}
list(
  kmo           = efa_kmo,
  bartlettChisq = as.numeric(efa_bart$chisq),
  bartlettDf    = as.numeric(efa_bart$df),
  bartlettP     = as.numeric(efa_bart$p.value),
  loadMat       = as.numeric(efa_load),
  h2Vec         = efa_h2,
  ssPerFactor   = as.numeric(colSums(efa_load^2))
)`
