import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import { binaryCode, positiveLevel } from './binaryCoding'

export interface PsmBalanceRow { covariate: string; smdPre: number; smdPost: number; varRatio: number }
export interface PsmResult {
  balance: PsmBalanceRow[]
  attB: number; attSe: number; attT: number; attP: number; attLo: number; attHi: number
  matchedN: number; nT: number; nC: number
  ciLevel: number; alpha: number
  nExcluded: number
  // Common-support / overlap diagnostic (Theme-3): treated units dropped (unmatched + discarded off the
  // region of common support) and the propensity-score overlap range by group (from summary(matchit)).
  treatedDropped: number | null; controlDropped: number | null
  psTreatedLo: number | null; psTreatedHi: number | null; psControlLo: number | null; psControlHi: number | null
  figLovePng: Uint8Array<ArrayBuffer>
}

// MatchIt::matchit(treat ~ covariates, method='nearest', ratio=k[, caliper]); balance from summary();
// ATT = lm(y ~ treat, matched, weights) with subclass-clustered SE. (optimal/full need optmatch — not shipped.)
const R_PSM = String.raw`
cov_names <- cov_names[seq_len(n_cov)]
d <- data.frame(.treat = treat, .y = y)
for (i in seq_len(n_cov)) d[[cov_names[i]]] <- cov_flat[((i - 1L) * n_obs + 1L):(i * n_obs)]
form <- as.formula(paste('.treat ~', paste(cov_names, collapse = ' + ')))
m <- if (caliper_val > 0) MatchIt::matchit(form, data = d, method = 'nearest', ratio = ratio, caliper = caliper_val)
     else MatchIt::matchit(form, data = d, method = 'nearest', ratio = ratio)
s <- summary(m); sa <- s$sum.all; sm <- s$sum.matched
covs <- rownames(sm)[rownames(sm) != 'distance']
balance_rows <- lapply(covs, function(cv) list(
  covariate = cv, smdPre = unname(sa[cv, 'Std. Mean Diff.']), smdPost = unname(sm[cv, 'Std. Mean Diff.']), varRatio = unname(sm[cv, 'Var. Ratio'])))
md <- MatchIt::match.data(m)
att <- lm(.y ~ .treat, data = md, weights = md$weights)
V  <- sandwich::vcovCL(att, cluster = md$subclass)
ct <- lmtest::coeftest(att, vcov. = V); ci <- lmtest::coefci(att, vcov. = V, level = ci_level)
# Common-support / overlap diagnostic: summary(matchit)$nn carries the Unmatched + Discarded counts by group;
# treated dropped = treated units left off the region of common support. Propensity-score overlap range per group.
nn <- s$nn
dropped_of <- function(grp) {
  u <- if ('Unmatched' %in% rownames(nn)) nn['Unmatched', grp] else 0
  dd <- if ('Discarded' %in% rownames(nn)) nn['Discarded', grp] else 0
  unname(u + dd)
}
ps <- m$distance; trt <- m$treat == 1
ps_t_lo <- if (any(trt)) min(ps[trt]) else NA_real_; ps_t_hi <- if (any(trt)) max(ps[trt]) else NA_real_
ps_c_lo <- if (any(!trt)) min(ps[!trt]) else NA_real_; ps_c_hi <- if (any(!trt)) max(ps[!trt]) else NA_real_
list(balance_rows = balance_rows,
  att_b = unname(ct['.treat', 1]), att_se = unname(ct['.treat', 2]), att_t = unname(ct['.treat', 3]), att_p = unname(ct['.treat', 4]),
  att_lo = unname(ci['.treat', 1]), att_hi = unname(ci['.treat', 2]),
  matched_n = nrow(md), n_t = sum(md$.treat == 1), n_c = sum(md$.treat == 0),
  treated_dropped = dropped_of('Treated'), control_dropped = dropped_of('Control'),
  ps_t_lo = ps_t_lo, ps_t_hi = ps_t_hi, ps_c_lo = ps_c_lo, ps_c_hi = ps_c_hi)`

// Hand-rolled love plot (cobalt unavailable under WebR): |SMD| per covariate, unmatched vs matched, ref line at 0.1.
const R_LOVE_PLOT = String.raw`
df <- data.frame(cov = rep(cov_names, 2), smd = c(smd_pre, smd_post),
  sample = factor(rep(c('Unmatched', 'Matched'), each = length(cov_names)), levels = c('Unmatched', 'Matched')))
df$cov <- factor(df$cov, levels = rev(cov_names))
print(ggplot2::ggplot(df, ggplot2::aes(x = smd, y = cov, colour = sample)) +
  ggplot2::geom_vline(xintercept = 0.1, colour = '#9cc2ec', linetype = 'dashed') +
  ggplot2::geom_point(size = 3) +
  ggplot2::scale_colour_manual(values = c(Unmatched = '#c8781e', Matched = '#0c447c')) +
  ggplot2::labs(x = '|Standardized mean difference|', y = NULL, colour = NULL))`

interface RawPsm {
  balance_rows: PsmBalanceRow[]
  att_b: number; att_se: number; att_t: number; att_p: number; att_lo: number; att_hi: number
  matched_n: number; n_t: number; n_c: number
  treated_dropped: number | null; control_dropped: number | null
  ps_t_lo: number | null; ps_t_hi: number | null; ps_c_lo: number | null; ps_c_hi: number | null
}

const levelsOf = (data: Dataset, col: string): string[] =>
  [...new Set(data.rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '').map(String))].sort()

export async function runPropensityScoreMatching(
  engine: Engine, data: Dataset, outcome: string, treatment: string, covariates: string[],
  opts: { ratio?: number; caliper?: number; ciLevel?: number; alpha?: number } = {},
): Promise<PsmResult> {
  const ratio = opts.ratio ?? 1
  const caliper = opts.caliper ?? 0
  const ciLvl = opts.ciLevel ?? 0.95
  const alpha = opts.alpha ?? 0.05
  const trLevels = levelsOf(data, treatment)
  if (trLevels.length !== 2) throw new Error('Propensity score matching needs a treatment with exactly 2 groups.')
  const num = (c: string, r: Record<string, unknown>) => typeof r[c] === 'number' && Number.isFinite(r[c] as number)
  const present = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== ''
  const rows = data.rows.filter((r) => num(outcome, r) && present(r[treatment]) && covariates.every((c) => num(c, r)))
  const nExcluded = data.rows.length - rows.length
  const treat = rows.map((r) => binaryCode(r[treatment], positiveLevel(trLevels)))
  const nT = treat.filter((t) => t === 1).length
  const nC = treat.filter((t) => t === 0).length
  if (nT < 10 || nC < 10) throw new Error(`Propensity score matching needs ≥10 in each group (found ${nT} treated, ${nC} control).`)
  const env = {
    treat, y: rows.map((r) => r[outcome] as number),
    cov_flat: covariates.flatMap((c) => rows.map((r) => r[c] as number)), cov_names: covariates, n_cov: covariates.length,
    n_obs: rows.length, ratio, caliper_val: caliper, ci_level: ciLvl,
  }
  const raw = await engine.runJson<RawPsm>(R_PSM, env)
  const figLovePng = await engine.capturePlot(R_LOVE_PLOT, 600, 450, {
    cov_names: raw.balance_rows.map((b) => b.covariate),
    smd_pre: raw.balance_rows.map((b) => Math.abs(b.smdPre)),
    smd_post: raw.balance_rows.map((b) => Math.abs(b.smdPost)),
  })
  const na = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : v)
  return {
    balance: raw.balance_rows,
    attB: raw.att_b, attSe: raw.att_se, attT: raw.att_t, attP: raw.att_p, attLo: raw.att_lo, attHi: raw.att_hi,
    matchedN: raw.matched_n, nT: raw.n_t, nC: raw.n_c, ciLevel: ciLvl, alpha, nExcluded,
    treatedDropped: na(raw.treated_dropped), controlDropped: na(raw.control_dropped),
    psTreatedLo: na(raw.ps_t_lo), psTreatedHi: na(raw.ps_t_hi), psControlLo: na(raw.ps_c_lo), psControlHi: na(raw.ps_c_hi),
    figLovePng,
  }
}
