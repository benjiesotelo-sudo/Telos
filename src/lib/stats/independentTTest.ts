import type { Engine } from '../webr/engine'
import type { Dataset, GroupStat, TTestResult } from './types'

const R_STATS = String.raw`
g <- factor(group); lv <- levels(g)
gs <- lapply(lv, function(l){ v <- score[g==l]; list(group=l, n=length(v), mean=mean(v), sd=sd(v), se=sd(v)/sqrt(length(v))) })
med <- tapply(score, g, median); z <- abs(score - med[as.character(g)])
lev <- anova(lm(z ~ g)); levF <- lev[["F value"]][1]; levP <- lev[["Pr(>F)"]][1]
# Levene is degenerate below n=3 per group (F is floating-point residue) - report as null, render as em-dash
if (min(table(g)) < 3) { levF <- NA_real_; levP <- NA_real_ }
# The user's equal-variance option decides pooled vs Welch (card pill, drawn default off -> Welch).
# Levene above is the reported assumption check, NOT a gate.
res <- t.test(score ~ g, var.equal = equal_variance, conf.level = level)
a <- score[g==lv[1]]; b <- score[g==lv[2]]; n1<-length(a); n2<-length(b)
sp <- sqrt(((n1-1)*sd(a)^2 + (n2-1)*sd(b)^2)/(n1+n2-2)); d <- (mean(a)-mean(b))/sp
list(groupStats=gs, test=if (equal_variance) 'pooled' else 'welch',
  t=unname(res$statistic), df=unname(res$parameter), p=res$p.value,
  meanDiff=mean(a)-mean(b), ci=as.numeric(res$conf.int), cohensD=d, levene=list(F=levF, p=levP))`

// ggplot2 (per the architecture doc / outputs spec / rMap); print() renders into the active png() device.
const R_BOXPLOT = String.raw`
print(ggplot2::ggplot(data.frame(group = factor(group), score = score), ggplot2::aes(group, score)) +
  ggplot2::geom_boxplot(fill = '#9cc2ec', colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL))`

interface RawStats {
  groupStats: GroupStat[]; test: 'pooled' | 'welch'
  t: number; df: number; p: number; meanDiff: number; ci: number[]; cohensD: number; levene: { F: number | null; p: number | null }
}

export async function runIndependentTTest(engine: Engine, data: Dataset, outcome: string, group: string, equalVariance: boolean, level = 0.95, alpha = 0.05): Promise<TTestResult> {
  // Per-test listwise (spec step-4a default): drop rows missing/non-numeric in either role column.
  const rows = data.rows.filter((r) =>
    typeof r[outcome] === 'number' && Number.isFinite(r[outcome] as number) && r[group] != null && String(r[group]).trim() !== '')
  const nExcluded = data.rows.length - rows.length
  const env = { score: rows.map((r) => r[outcome] as number), group: rows.map((r) => String(r[group])), equal_variance: equalVariance, level }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_BOXPLOT, 600, 450, env)
  return {
    groupStats: [s.groupStats[0], s.groupStats[1]],
    contrast: `${s.groupStats[0].group} − ${s.groupStats[1].group}`, test: s.test,
    t: s.t, df: s.df, p: s.p, meanDiff: s.meanDiff, ci: [s.ci[0], s.ci[1]], cohensD: s.cohensD,
    levene: s.levene, ciLevel: level, alpha, nExcluded, figurePng,
  }
}
