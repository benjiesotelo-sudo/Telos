/** Estimated marginal (adjusted) means via emmeans (design §3 B4). ANCOVA/MANCOVA. */
export interface AdjustedMeanRow { group: string; mean: number; se: number; ciLo: number; ciHi: number }

export const ADJMEANS_R = String.raw`
.telos_adjmeans <- function(emm) {
  s <- as.data.frame(emm)
  grp_cols <- setdiff(names(s), c('emmean', 'SE', 'df', 'lower.CL', 'upper.CL'))
  lapply(seq_len(nrow(s)), function(i) list(
    group = paste(vapply(grp_cols, function(c) as.character(s[[c]][i]), character(1)), collapse = ' × '),
    mean = s$emmean[i], se = s$SE[i], ciLo = s$lower.CL[i], ciHi = s$upper.CL[i]))
}`
