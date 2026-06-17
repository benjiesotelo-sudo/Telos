import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import { POSTHOC_EMM_R, type PosthocRow } from './posthoc'
import { SPHERICITY_R, type SphericityInfo } from './sphericity'

export interface RMConditionDesc { condition: string; n: number; m: number; sd: number }
export interface RMAnovaRow {
  source: string; ss: number; df1: number; df2: number
  ms: number; f: number; p: number; pes: number
  pesLow: number; pesHigh: number   // partial-η² CI (APA-7: report η²p WITH its CI); one-sided (upper pinned at 1.00) per effectsize convention; honors `level`
}
export interface RepeatedMeasuresAnovaResult {
  anova: RMAnovaRow
  sphericity: SphericityInfo[]
  desc: RMConditionDesc[]
  posthoc: PosthocRow[]
  sphericityChoice: string  // the selected option value, e.g. 'GG correction'
  ciLevel: number
  alpha: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

/** Maps the card's select value to afex correction code. */
export const SPHERICITY_MAP: Record<string, string> = {
  'GG correction': 'GG',
  'HF correction': 'HF',
  'none': 'none',
}

const R_STATS = String.raw`
long <- data.frame(sid = factor(rep(sid, length(conds))),
  condition = factor(rep(conds, each = n), levels = conds), score = scores_flat)
m <- suppressWarnings(suppressMessages(afex::aov_ez(id = 'sid', dv = 'score', data = long,
  within = 'condition', anova_table = list(es = 'pes', correction = correction))))
at <- m$anova_table
u <- summary(m$Anova, multivariate = FALSE)$univariate.tests
ss <- u['condition', 'Sum Sq']
es <- effectsize::eta_squared(m, ci = level)  # partial η² with its (one-sided) CI
anova_row <- list(source = 'Condition', ss = ss, df1 = at['condition', 'num Df'], df2 = at['condition', 'den Df'],
  ms = ss / at['condition', 'num Df'], f = at['condition', 'F'], p = at['condition', 'Pr(>F)'], pes = at['condition', 'pes'],
  pesLow = es[es$Parameter == 'condition', 'CI_low'], pesHigh = es[es$Parameter == 'condition', 'CI_high'])
spher <- .telos_sphericity(m)
desc <- lapply(conds, function(cn) { v <- long$score[long$condition == cn]; list(condition = cn, n = length(v), m = mean(v), sd = sd(v)) })
ph <- if (posthocOn) .telos_posthoc(emmeans::emmeans(m, ~condition), 'bonferroni', level) else list()
list(anova = anova_row, sphericity = spher, desc = desc, posthoc = ph)`

const R_FIGURE = String.raw`
mat <- matrix(scores_flat, ncol = length(conds))
mm <- colMeans(mat); sdv <- apply(mat, 2, sd); se <- sdv / sqrt(nrow(mat)); tq <- qt(0.975, nrow(mat) - 1)
agg <- data.frame(cond = factor(conds, levels = conds), m = mm, lo = mm - tq * se, hi = mm + tq * se)
print(ggplot2::ggplot(agg, ggplot2::aes(cond, m, group = 1)) + ggplot2::geom_line(colour = '#0c447c') +
  ggplot2::geom_pointrange(ggplot2::aes(ymin = lo, ymax = hi), colour = '#0c447c') + ggplot2::labs(x = NULL, y = NULL) +
  ggplot2::coord_cartesian(ylim = c(min(agg$lo) - 0.5, max(agg$hi) + 0.5)))`

export async function runRepeatedMeasuresAnova(
  engine: Engine, data: Dataset, subject: string, measures: string[],
  sphericityChoice: string, posthocOn: boolean, level = 0.95, alpha = 0.05,
): Promise<RepeatedMeasuresAnovaResult> {
  // Listwise: keep rows where subject non-blank AND every measure is numeric-finite.
  const rows = data.rows.filter((r) =>
    r[subject] != null && String(r[subject]).trim() !== '' &&
    measures.every((m) => typeof r[m] === 'number' && Number.isFinite(r[m] as number)))
  const nExcluded = data.rows.length - rows.length
  const correction = SPHERICITY_MAP[sphericityChoice] ?? 'GG'
  const n = rows.length
  const env = {
    sid: rows.map((r) => String(r[subject])),
    conds: measures,
    scores_flat: measures.flatMap((m) => rows.map((r) => r[m] as number)),
    n,
    correction,
    posthocOn,
    level,
  }
  const s = await engine.runJson<Omit<RepeatedMeasuresAnovaResult, 'nExcluded' | 'figurePng' | 'sphericityChoice'>>(
    `${POSTHOC_EMM_R}\n${SPHERICITY_R}\n${R_STATS}`, env,
  )
  const figurePng = await engine.capturePlot(R_FIGURE, 600, 450, { scores_flat: env.scores_flat, conds: measures })
  return { ...s, sphericityChoice, ciLevel: level, alpha, nExcluded, figurePng }
}
