/** Shared parametric post-hoc machinery (design §3 B2). Six cards draw the same
 * Pair / M_diff / SE / p_adj / 95% CI table; emmeans computes all of them.
 * Rank-based tables (Dunn, Nemenyi) have different shapes and live in their tests' modules. */

export interface PosthocRow { pair: string; diff: number; se: number; pAdj: number; ciLo: number; ciHi: number }

/** R helper: define once per stats block, call with an emmeans object + adjust method + CI level.
 * summary(pairs(...), infer=TRUE, level=level) yields estimate/SE/p.value/lower.CL/upper.CL under ONE adjustment. */
export const POSTHOC_EMM_R = String.raw`
.telos_posthoc <- function(emm, adjust, level = 0.95) {
  s <- summary(pairs(emm, adjust = adjust), infer = TRUE, level = level)
  lapply(seq_len(nrow(s)), function(i) list(
    pair = as.character(s$contrast[i]), diff = s$estimate[i], se = s$SE[i],
    pAdj = s$p.value[i], ciLo = s$lower.CL[i], ciHi = s$upper.CL[i]))
}`

/** Render rows for the drawn table (builders import this; column keys match the cards). */
export const posthocTableRows = (rows: PosthocRow[], fmt: { f: (n: number) => string; fp: (p: number) => string }) =>
  rows.map((r) => ({ pair: r.pair, mdiff: fmt.f(r.diff), se: fmt.f(r.se), padj: fmt.fp(r.pAdj), ci: `[${fmt.f(r.ciLo)}, ${fmt.f(r.ciHi)}]` }))
