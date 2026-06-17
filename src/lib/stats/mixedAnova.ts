import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import { POSTHOC_EMM_R, type PosthocRow } from './posthoc'
import { SPHERICITY_R, type SphericityInfo } from './sphericity'

export interface MixedAnovaDescRow { group: string; condition: string; n: number; m: number; sd: number }
// pesLow/pesHigh: one-sided CI on partial η² (effectsize::eta_squared(partial=TRUE, ci=level)); per-term, APA-7 reports the ES WITH its CI.
export interface MixedAnovaTableRow { source: string; ss: number; df1: number; df2: number; ms: number; f: number; p: number; pes: number; pesLow: number; pesHigh: number }
export interface MixedAnovaResult {
  desc: MixedAnovaDescRow[]
  anovaRows: MixedAnovaTableRow[]  // three rows: between, within, interaction
  sphericity: SphericityInfo[]
  posthoc: PosthocRow[]
  levene: { F: number | null; p: number | null }
  betweenName: string
  alpha: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

const R_STATS = (betweenName: string) => String.raw`
grpf <- factor(grp)
long <- data.frame(
  sid = factor(rep(sid, length(conds))),
  grp = factor(rep(grp, length(conds))),
  condition = factor(rep(conds, each = n), levels = conds),
  score = scores_flat
)
m <- suppressWarnings(suppressMessages(afex::aov_ez(
  id = 'sid', dv = 'score', data = long,
  between = 'grp', within = 'condition',
  anova_table = list(es = 'pes', correction = correction)
)))
at <- m$anova_table
u <- summary(m$Anova, multivariate = FALSE)$univariate.tests
ss_grp       <- u['grp', 'Sum Sq']
ss_cond      <- u['condition', 'Sum Sq']
ss_inter     <- u['grp:condition', 'Sum Sq']
# Partial η² CI per term (one-sided: lower floored at 0, upper pinned at 1.00 — APA convention).
es <- effectsize::eta_squared(m, partial = TRUE, ci = level)
esP <- as.character(es$Parameter)
make_row <- function(key, label) { ei <- match(key, esP); list(
  source = label,
  ss = if (key == 'grp') ss_grp else if (key == 'condition') ss_cond else ss_inter,
  df1 = at[key, 'num Df'], df2 = at[key, 'den Df'],
  ms = (if (key == 'grp') ss_grp else if (key == 'condition') ss_cond else ss_inter) / at[key, 'num Df'],
  f = at[key, 'F'], p = at[key, 'Pr(>F)'], pes = at[key, 'pes'],
  pesLow = es$CI_low[ei], pesHigh = es$CI_high[ei]
) }
anova_rows <- list(
  make_row('grp',          '${betweenName} (between)'),
  make_row('condition',    'Condition (within)'),
  make_row('grp:condition', '${betweenName} × Condition')
)
spher <- .telos_sphericity(m)
desc_grids <- expand.grid(g = levels(grpf), c = factor(conds, levels = conds), stringsAsFactors = FALSE)
desc <- lapply(seq_len(nrow(desc_grids)), function(i) {
  g <- desc_grids$g[i]; co <- desc_grids$c[i]
  v <- long$score[long$grp == g & long$condition == co]
  list(group = g, condition = co, n = length(v), m = mean(v), sd = sd(v))
})
ph <- if (posthocOn) .telos_posthoc(emmeans::emmeans(m, ~condition), 'bonferroni') else list()
# Levene (recorded decision 9): hand-rolled Brown-Forsythe on per-subject means across measures by group.
subj_means <- tapply(long$score, long$sid, mean)
grp_for_subj <- grp[match(names(subj_means), sid)]
gf2 <- factor(grp_for_subj)
lev <- tryCatch({
  ls <- summary(aov(abs(subj_means - ave(subj_means, gf2, FUN = median)) ~ gf2))[[1]]
  list(F = ls[1, 'F value'], p = ls[1, 'Pr(>F)'])
}, error = function(e) list(F = NULL, p = NULL))
list(desc = desc, anova_rows = anova_rows, sphericity = spher, posthoc = ph, levene = lev)
`

const R_FIGURE = String.raw`
mat <- matrix(scores_flat, ncol = length(conds))
g <- factor(grp)
agg <- do.call(rbind, lapply(levels(g), function(l) {
  sub <- mat[g == l, , drop = FALSE]
  mm <- colMeans(sub); se <- apply(sub, 2, sd) / sqrt(nrow(sub))
  tq <- qt(0.975, nrow(sub) - 1)
  data.frame(grp = l, cond = factor(conds, levels = conds), m = mm,
    lo = mm - tq * se, hi = mm + tq * se)
}))
print(ggplot2::ggplot(agg, ggplot2::aes(cond, m, group = grp, colour = grp)) +
  ggplot2::geom_line() +
  ggplot2::geom_pointrange(ggplot2::aes(ymin = lo, ymax = hi)) +
  ggplot2::labs(x = NULL, y = NULL, colour = NULL))
`

interface RawStats {
  desc: MixedAnovaDescRow[]
  anova_rows: MixedAnovaTableRow[]  // each row carries pes + its one-sided η² CI (pesLow/pesHigh)
  sphericity: SphericityInfo[]
  posthoc: PosthocRow[]
  levene: { F: number | null; p: number | null }
}

export async function runMixedAnova(
  engine: Engine, data: Dataset,
  subject: string, between: string, measures: string[],
  sphericityChoice: string, posthocOn: boolean, alpha = 0.05
): Promise<MixedAnovaResult> {
  // Listwise: subject + between non-blank AND all measures numeric-finite
  const rows = data.rows.filter((r) =>
    r[subject] != null && String(r[subject]).trim() !== '' &&
    r[between] != null && String(r[between]).trim() !== '' &&
    measures.every((m) => typeof r[m] === 'number' && Number.isFinite(r[m] as number))
  )
  const nExcluded = data.rows.length - rows.length

  const correctionMap: Record<string, string> = { 'GG correction': 'GG', 'HF correction': 'HF', 'none': 'none' }
  const correction = correctionMap[sphericityChoice] ?? 'GG'

  const env = {
    sid: rows.map((r) => String(r[subject])),
    grp: rows.map((r) => String(r[between])),
    conds: measures,
    scores_flat: measures.flatMap((m) => rows.map((r) => r[m] as number)),
    n: rows.length,
    correction,
    posthocOn,
    level: 0.95,  // no adjustable CI level on this card; APA-7 default for the partial-η² CI
  }

  const betweenLabel = between.charAt(0).toUpperCase() + between.slice(1)
  const rCode = `${POSTHOC_EMM_R}\n${SPHERICITY_R}\n${R_STATS(betweenLabel)}`
  const s = await engine.runJson<RawStats>(rCode, env)
  const figurePng = await engine.capturePlot(R_FIGURE, 600, 450, env)

  return {
    desc: s.desc,
    anovaRows: s.anova_rows,
    sphericity: s.sphericity,
    posthoc: s.posthoc,
    levene: s.levene,
    betweenName: betweenLabel,
    alpha,
    nExcluded,
    figurePng,
  }
}
