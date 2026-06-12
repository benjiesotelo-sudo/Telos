/** Mauchly + GG/HF extraction from an afex model (design §3 B3). Used by RM + Mixed ANOVA.
 * Card rule: with a 2-level repeated factor sphericity is automatically met — callers omit the table (null). */

export interface SphericityInfo { effect: string; w: number; p: number; ggEps: number; hfEps: number }

/** R helper: afex model -> per-effect Mauchly W/p + GG/HF epsilons.
 * summary(m$Anova) carries sphericity.tests (W, p) and pval.adjustments (GG eps, HF eps) for
 * every within/interaction term; row order matches. Returns a list of rows, or an empty list
 * when the design has a 2-level repeated factor (no tests exist). */
export const SPHERICITY_R = String.raw`
.telos_sphericity <- function(m) {
  s <- summary(m$Anova, multivariate = FALSE)
  st <- s$sphericity.tests; pa <- s$pval.adjustments
  if (is.null(st) || nrow(st) == 0) return(list())
  lapply(rownames(st), function(e) list(
    effect = e, w = unname(st[e, 'Test statistic']), p = unname(st[e, 'p-value']),
    ggEps = unname(pa[e, 'GG eps']), hfEps = unname(pa[e, 'HF eps'])))
}`
