import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface MultivarRow {
  effect: string
  stat: number; f: number; df1: number; df2: number; p: number
  /** Pillai's trace fields — always computed (APA always from Pillai per recorded decision 1). */
  pillai: number; pillaiF: number; pillaiDf1: number; pillaiDf2: number; pillaiP: number
}

export interface FollowupRow {
  dv: string; f: number; df1: number; df2: number; p: number; pes: number
  pesLow: number; pesHigh: number                 // partial-η² CI (APA-7: report ES WITH its CI); one-sided (upper pinned ~1.00)
}

export interface ManovaResult {
  multivariate: MultivarRow[]
  followups: FollowupRow[]
  /** Box's M test of homogeneity of covariance matrices (heplots::boxM). NA→null when not estimable (small/singular groups). */
  boxM: { chisq: number | null; df: number | null; p: number | null }
  statistic: string
  alpha: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

// stats::manova() with sequential SS (design §4.10). Column 2 of summary(m,test=...)$stats
// is the statistic value (column name = the test name; index positionally per plan note).
const R_STATS = String.raw`
d <- data.frame(row.names = seq_len(n))
for (i in seq_along(dvnames)) d[[dvnames[i]]] <- dvs_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(fnames)) d[[fnames[i]]] <- factor(fvals_flat[((i - 1) * n + 1):(i * n)])
frhs <- paste(fnames, collapse = ' * ')
fml <- as.formula(paste('cbind(', paste(dvnames, collapse = ', '), ') ~', frhs))
m <- manova(fml, data = d)
grab <- function(test) { s <- summary(m, test = test)$stats; s[setdiff(rownames(s), 'Residuals'), , drop = FALSE] }
sc <- grab(statistic); sp <- grab('Pillai')
mv <- lapply(rownames(sc), function(t) list(effect = gsub(':', ' × ', t),
  stat = sc[t, 2], f = sc[t, 'approx F'], df1 = sc[t, 'num Df'], df2 = sc[t, 'den Df'], p = sc[t, 'Pr(>F)'],
  pillai = sp[t, 2], pillaiF = sp[t, 'approx F'], pillaiDf1 = sp[t, 'num Df'], pillaiDf2 = sp[t, 'den Df'], pillaiP = sp[t, 'Pr(>F)']))
fu <- list()
if (followups) for (dv in dvnames) {
  a <- aov(as.formula(paste(dv, '~', frhs)), data = d)
  s <- summary(a)[[1]]; rownames(s) <- trimws(rownames(s))
  terms <- setdiff(rownames(s), 'Residuals')
  # effectsize::eta_squared(ci=level): one ES row per term, matched by Parameter (APA-7 ES-with-CI).
  es <- effectsize::eta_squared(a, partial = TRUE, ci = level)
  pcol <- if ('Eta2_partial' %in% colnames(es)) 'Eta2_partial' else 'Eta2'
  for (t in terms) {
    j <- match(t, trimws(es$Parameter))
    fu[[length(fu) + 1]] <- list(
      dv = if (length(terms) > 1) paste0(dv, ' (', gsub(':', ' × ', t), ')') else dv,
      f = s[t, 'F value'], df1 = s[t, 'Df'], df2 = s['Residuals', 'Df'], p = s[t, 'Pr(>F)'],
      pes = es[[pcol]][j], pesLow = es$CI_low[j], pesHigh = es$CI_high[j])
  }
}
# Box's M — homogeneity of covariance matrices across the cell grouping (heplots::boxM).
# Guard: each cell needs > p observations for an estimable covariance (else singular); tryCatch → NA→null on failure (mirrors the Shapiro small-N guard).
cell <- interaction(d[fnames], drop = TRUE)
Ymat <- as.matrix(d[dvnames])
na3 <- list(chisq = NA_real_, df = NA_real_, p = NA_real_)  # keep keys present so the JSON serializer emits null (NULL would drop the element)
bm <- if (all(table(cell) > length(dvnames)) && nlevels(cell) >= 2) tryCatch({
  b <- heplots::boxM(Ymat, cell)
  list(chisq = unname(b$statistic), df = unname(b$parameter), p = unname(b$p.value))
}, error = function(e) na3) else na3
list(multivariate = mv, followups = fu, boxM = bm)`

// Facet by DV — group means per DV with 95% CI error bars.
const R_FIGURE = String.raw`
gf <- factor(fvals_flat[1:n])
agg <- do.call(rbind, lapply(seq_along(dvnames), function(i) {
  v <- dvs_flat[((i - 1) * n + 1):(i * n)]
  mm <- tapply(v, gf, mean); nn <- tapply(v, gf, length); ss <- tapply(v, gf, sd)
  se <- ss / sqrt(nn); tq <- qt(0.975, nn - 1)
  data.frame(dv = dvnames[i], g = names(mm), m = as.numeric(mm),
    lo = as.numeric(mm - tq * se), hi = as.numeric(mm + tq * se)) }))
print(ggplot2::ggplot(agg, ggplot2::aes(g, m)) +
  ggplot2::geom_pointrange(ggplot2::aes(ymin = lo, ymax = hi), colour = '#0c447c') +
  ggplot2::facet_wrap(~dv, scales = 'free_y') + ggplot2::labs(x = NULL, y = NULL))`

interface RawResult { multivariate: MultivarRow[]; followups: FollowupRow[]; boxM: ManovaResult['boxM'] }

export async function runManova(
  engine: Engine, data: Dataset,
  outcomes: string[], factors: string[],
  statistic: string, followups: boolean, alpha = 0.05,
): Promise<ManovaResult> {
  // Listwise: all DVs numeric-finite + all factors non-blank.
  const rows = data.rows.filter((r) =>
    outcomes.every((dv) => typeof r[dv] === 'number' && Number.isFinite(r[dv] as number)) &&
    factors.every((f) => r[f] != null && String(r[f]).trim() !== ''))
  const nExcluded = data.rows.length - rows.length
  const n = rows.length
  const env = {
    dvs_flat: outcomes.flatMap((dv) => rows.map((r) => r[dv] as number)),
    dvnames: outcomes,
    fvals_flat: factors.flatMap((f) => rows.map((r) => String(r[f]))),
    fnames: factors,
    n,
    statistic,
    followups,
    level: 0.95, // partial-η² CI level; card has no adjustable CI option, so APA-fixed 0.95
  }
  const s = await engine.runJson<RawResult>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_FIGURE, 600, 450, env)
  return { multivariate: s.multivariate, followups: s.followups, boxM: s.boxM, statistic, alpha, nExcluded, figurePng }
}
