import type { Emitter } from './index'
import type { TestSetup } from '../../../../state/session'

// Group-comparison family (t-tests, ANOVA family, nonparametric two/multi-sample tests).
// Each emitter mirrors its src/lib/stats/<test>.ts call + effect size + figure, threading
// setup.roles[roleId] (column names) and setup.options[optId] exactly as builders.ts does.
// NOT regression models -> no modelsummary; emit the test/effect-size/figure directly.

// --- option helpers (mirror builders.ts: alternativeOf / ciLevel / alphaOf) ---
const col = (c: string) => `d[["${c}"]]`
/** tails option -> R alternative= string (default two.sided). */
const alt = (s: TestSetup) =>
  ({ 'one-tailed (greater)': 'greater', 'one-tailed (less)': 'less' } as Record<string, string>)[
    String(s.options['tails'] ?? 'two-tailed')
  ] ?? 'two.sided'
/** CI option ('90%'|'95%'|'99%') -> conf.level numeric (default 0.95). */
const conf = (s: TestSetup) => {
  const n = Number(String(s.options['ci'] ?? '95').replace('%', ''))
  return Number.isFinite(n) && n > 0 ? n / 100 : 0.95
}

export const groupEmitters: Record<string, Emitter> = {
  // t.test(x, mu=) -> Table 2 · effectsize::cohens_d() -> d · histogram + dashed vline at mu0
  'one-sample-t-test': (_spec, setup) => {
    const y = setup.roles['outcome'][0]
    const mu0 = Number(setup.options['mu0'] ?? 0)
    return [
      `res <- t.test(${col(y)}, mu = ${mu0}, conf.level = ${conf(setup)}, alternative = "${alt(setup)}")`,
      `print(res)`,
      `effectsize::cohens_d(${col(y)}, mu = ${mu0})`,
      `if (length(${col(y)}) >= 3 && length(${col(y)}) <= 5000) print(shapiro.test(${col(y)}))`,
      `print(ggplot(data.frame(x = ${col(y)}), aes(x)) +`,
      `  geom_histogram(bins = nclass.Sturges(${col(y)}), fill = "#9cc2ec", colour = "#0c447c") +`,
      `  geom_vline(xintercept = ${mu0}, colour = "#0c447c", linetype = "dashed") + labs(x = NULL, y = NULL))`,
    ].join('\n')
  },

  // t.test(score ~ g, var.equal=) -> Table 2 · pooled Cohen's d · Levene (anova on |dev from median|) · boxplot
  'independent-t-test': (_spec, setup) => {
    const y = setup.roles['outcome'][0], g = setup.roles['group'][0]
    const eq = setup.options['equalVariance'] === true ? 'TRUE' : 'FALSE'
    return [
      `itt <- data.frame(score = ${col(y)}, g = factor(${col(g)}))`,
      `res <- t.test(${col(y)} ~ factor(${col(g)}), var.equal = ${eq}, conf.level = ${conf(setup)}, alternative = "${alt(setup)}")`,
      `print(res)`,
      `print(car::leveneTest(score ~ g, data = itt, center = median))`,
      `print(effectsize::cohens_d(score ~ g, data = itt, pooled_sd = TRUE))`,
      `print(ggplot(itt, aes(g, score)) +`,
      `  geom_boxplot(fill = "#9cc2ec", colour = "#0c447c") + labs(x = NULL, y = NULL))`,
    ].join('\n')
  },

  // t.test(a, b, paired=TRUE) -> Table 2 · effectsize::cohens_d(paired=TRUE) -> dz · paired-lines figure
  'paired-t-test': (_spec, setup) => {
    const a = setup.roles['conditionA'][0], b = setup.roles['conditionB'][0]
    return [
      `print(psych::describe(data.frame(a = ${col(a)}, b = ${col(b)})))`,
      `res <- t.test(${col(a)}, ${col(b)}, paired = TRUE, conf.level = ${conf(setup)}, alternative = "${alt(setup)}")`,
      `print(res)`,
      `effectsize::cohens_d(${col(a)}, ${col(b)}, paired = TRUE)`,
      `pl <- data.frame(case = rep(seq_along(${col(a)}), 2),`,
      `  cond = factor(rep(c("${a}", "${b}"), each = length(${col(a)})), levels = c("${a}", "${b}")),`,
      `  value = c(${col(a)}, ${col(b)}))`,
      `print(ggplot(pl, aes(cond, value, group = case)) +`,
      `  geom_line(colour = "#9cc2ec") + geom_point(colour = "#0c447c") + labs(x = NULL, y = NULL))`,
    ].join('\n')
  },

  // aov(y ~ g) -> Table 2 · eta_squared · emmeans pairwise (adjust threaded) · means pointrange ± t-CI
  'one-way-anova': (_spec, setup) => {
    const y = setup.roles['outcome'][0], g = setup.roles['factor'][0]
    const adjust = ({ 'Tukey HSD': 'tukey', 'Bonferroni': 'bonferroni', 'Scheffé': 'scheffe' } as Record<string, string>)[
      String(setup.options['posthoc'] ?? 'Tukey HSD')
    ] ?? 'tukey'
    const level = conf(setup)
    return [
      `owa <- data.frame(y = ${col(y)}, g = factor(${col(g)}))`,
      `m <- aov(${col(y)} ~ factor(${col(g)}), data = owa)`,
      `print(summary(m))`,
      `print(effectsize::eta_squared(m, partial = FALSE))`,
      `m2 <- aov(y ~ g, data = owa)  # named-factor refit so emmeans can reference the grouping term`,
      `print(summary(pairs(emmeans::emmeans(m2, ~ g), adjust = "${adjust}"), infer = TRUE, level = ${level}))`,
      `gf <- factor(${col(g)}); agg <- data.frame(g = levels(gf), m = as.numeric(tapply(${col(y)}, gf, mean)))`,
      `nn <- as.numeric(tapply(${col(y)}, gf, length)); sdv <- as.numeric(tapply(${col(y)}, gf, sd))`,
      `se <- sdv / sqrt(nn); tq <- qt(1 - (1 - ${level}) / 2, nn - 1)`,
      `agg$lo <- agg$m - tq * se; agg$hi <- agg$m + tq * se`,
      `print(ggplot(agg, aes(g, m)) + geom_pointrange(aes(ymin = lo, ymax = hi), colour = "#0c447c") + labs(x = NULL, y = NULL))`,
    ].join('\n')
  },

  // afex::aov_car (main effects + interaction) -> Table 2 · pes · emmeans simple effects · interaction plot.
  // One obs per .sid (between-subjects design expressed in afex's repeated-measures wrapper, mirrors the stats module).
  'factorial-anova': (_spec, setup) => {
    const y = setup.roles['outcome'][0], factors = setup.roles['factors']
    const sep = setup.options['interactions'] === false ? ' + ' : ' * '
    const fv = (i: number) => `f${i + 1}`          // stable factor var names in the model data.frame + formula
    const rhs = factors.map((_f, i) => fv(i)).join(sep)
    const f1 = fv(0), f2 = factors.length > 1 ? fv(1) : fv(0)
    return [
      `fad <- data.frame(.sid = factor(seq_along(${col(y)})), y = ${col(y)}, ${factors.map((f, i) => `${fv(i)} = factor(${col(f)})`).join(', ')})`,
      `m <- afex::aov_car(y ~ ${rhs} + Error(.sid), data = fad, anova_table = list(es = "pes"))`,
      `print(m$anova_table)`,
      `print(effectsize::eta_squared(m$lm, partial = TRUE))`,
      factors.map((_f, i) => `print(summary(pairs(emmeans::emmeans(m, ~ ${fv(i)}), adjust = "tukey"), infer = TRUE))`).join('\n'),
      `agg <- aggregate(list(m = fad$y), by = list(a = fad$${f1}, b = fad$${f2}), FUN = mean)`,
      `print(ggplot(agg, aes(a, m, group = b, colour = b)) + geom_line() + geom_point() + labs(x = NULL, y = NULL, colour = "${factors[1] ?? factors[0]}"))`,
    ].join('\n')
  },

  // afex::aov_ez within-subjects -> Tables 2-3 · sphericity correction threaded · emmeans (bonferroni) · profile plot
  'repeated-measures-anova': (_spec, setup) => {
    const sid = setup.roles['subject'][0], measures = setup.roles['measures']
    const correction = ({ 'GG correction': 'GG', 'HF correction': 'HF', 'none': 'none' } as Record<string, string>)[
      String(setup.options['sphericity'] ?? 'GG correction')
    ] ?? 'GG'
    const posthocOn = setup.options['posthoc'] !== false
    const condLevels = measures.map((m) => `"${m}"`).join(', ')
    return [
      `conds <- c(${condLevels})`,
      `nrw <- length(${col(measures[0])})`,
      `long <- data.frame(sid = factor(rep(${col(sid)}, length(conds))),`,
      `  condition = factor(rep(conds, each = nrw), levels = conds),`,
      `  score = c(${measures.map(col).join(', ')}))`,
      `m <- afex::aov_ez(id = "sid", dv = "score", data = long, within = "condition",`,
      `  anova_table = list(es = "pes", correction = "${correction}"))`,
      `print(m$anova_table)`,
      `print(summary(m$Anova, multivariate = FALSE))`,
      posthocOn ? `print(summary(pairs(emmeans::emmeans(m, ~ condition), adjust = "bonferroni"), infer = TRUE, level = ${conf(setup)}))` : `# post-hoc off`,
      `mat <- matrix(c(${measures.map(col).join(', ')}), ncol = length(conds))`,
      `mm <- colMeans(mat); sdv <- apply(mat, 2, sd); se <- sdv / sqrt(nrow(mat)); tq <- qt(0.975, nrow(mat) - 1)`,
      `agg <- data.frame(cond = factor(conds, levels = conds), m = mm, lo = mm - tq * se, hi = mm + tq * se)`,
      `print(ggplot(agg, aes(cond, m, group = 1)) + geom_line(colour = "#0c447c") +`,
      `  geom_pointrange(aes(ymin = lo, ymax = hi), colour = "#0c447c") + labs(x = NULL, y = NULL))`,
    ].join('\n')
  },

  // afex::aov_ez between (grp) × within (condition) -> Tables 2-3 · emmeans (bonferroni) · grouped profile plot
  'mixed-anova': (_spec, setup) => {
    const sid = setup.roles['subject'][0], grp = setup.roles['between'][0], measures = setup.roles['measures']
    const correction = ({ 'GG correction': 'GG', 'HF correction': 'HF', 'none': 'none' } as Record<string, string>)[
      String(setup.options['sphericity'] ?? 'GG correction')
    ] ?? 'GG'
    const posthocOn = setup.options['posthoc'] !== false
    const condLevels = measures.map((m) => `"${m}"`).join(', ')
    return [
      `conds <- c(${condLevels})`,
      `nrw <- length(${col(measures[0])})`,
      `long <- data.frame(sid = factor(rep(${col(sid)}, length(conds))),`,
      `  grp = factor(rep(${col(grp)}, length(conds))),`,
      `  condition = factor(rep(conds, each = nrw), levels = conds),`,
      `  score = c(${measures.map(col).join(', ')}))`,
      `m <- afex::aov_ez(id = "sid", dv = "score", data = long, between = "grp", within = "condition",`,
      `  anova_table = list(es = "pes", correction = "${correction}"))`,
      `print(m$anova_table)`,
      `print(summary(m$Anova, multivariate = FALSE))`,
      posthocOn ? `print(summary(pairs(emmeans::emmeans(m, ~ condition), adjust = "bonferroni"), infer = TRUE))` : `# post-hoc off`,
      `mat <- matrix(c(${measures.map(col).join(', ')}), ncol = length(conds)); gv <- factor(${col(grp)})`,
      `agg <- do.call(rbind, lapply(levels(gv), function(l) {`,
      `  sub <- mat[gv == l, , drop = FALSE]; mm <- colMeans(sub); se <- apply(sub, 2, sd) / sqrt(nrow(sub))`,
      `  tq <- qt(0.975, nrow(sub) - 1)`,
      `  data.frame(grp = l, cond = factor(conds, levels = conds), m = mm, lo = mm - tq * se, hi = mm + tq * se) }))`,
      `print(ggplot(agg, aes(cond, m, group = grp, colour = grp)) + geom_line() +`,
      `  geom_pointrange(aes(ymin = lo, ymax = hi)) + labs(x = NULL, y = NULL, colour = NULL))`,
    ].join('\n')
  },

  // aov(y ~ A / B) nested · F for A uses B(A) MS as error under random nesting · omega_squared · grouped means
  'nested-anova': (_spec, setup) => {
    const y = setup.roles['outcome'][0], factor = setup.roles['factor'][0], nested = setup.roles['nested'][0]
    const random = String(setup.options['nesting'] ?? 'random') === 'random'
    return [
      `af <- factor(${col(factor)}); bf <- factor(${col(nested)})  # named factors keep clean summary row names af / af:bf`,
      `m <- aov(${col(y)} ~ af / bf)`,
      `s <- summary(m)[[1]]; rownames(s) <- trimws(rownames(s))`,
      `msA <- s["af", "Mean Sq"]; msB <- s["af:bf", "Mean Sq"]; msR <- s["Residuals", "Mean Sq"]`,
      `dfA <- s["af", "Df"]; dfB <- s["af:bf", "Df"]; dfR <- s["Residuals", "Df"]`,
      random
        ? `fA <- msA / msB; pA <- pf(fA, dfA, dfB, lower.tail = FALSE)  # random nesting: A tested against B(A)`
        : `fA <- msA / msR; pA <- pf(fA, dfA, dfR, lower.tail = FALSE)  # fixed nesting: A tested against residual`,
      `fB <- msB / msR; pB <- pf(fB, dfB, dfR, lower.tail = FALSE)`,
      `print(data.frame(source = c("A", "B"), F = c(fA, fB), p = c(pA, pB)))`,
      `print(effectsize::omega_squared(m, partial = FALSE))`,
      `cellm <- aggregate(list(m = ${col(y)}), by = list(a = af, b = bf), FUN = mean)`,
      `nc <- aggregate(list(n = ${col(y)}), by = list(a = af, b = bf), FUN = length)`,
      `sdv <- aggregate(list(s = ${col(y)}), by = list(a = af, b = bf), FUN = sd)`,
      `cellm$lo <- cellm$m - qt(0.975, nc$n - 1) * sdv$s / sqrt(nc$n)`,
      `cellm$hi <- cellm$m + qt(0.975, nc$n - 1) * sdv$s / sqrt(nc$n)`,
      `print(ggplot(cellm, aes(a, m, colour = b)) +`,
      `  geom_pointrange(aes(ymin = lo, ymax = hi), position = position_dodge(width = 0.5)) + labs(x = NULL, y = NULL, colour = NULL))`,
    ].join('\n')
  },

  // oneway.test(var.equal = FALSE) -> Table 2 · rstatix::games_howell_test -> Table 3 · means pointrange
  'welch-anova': (_spec, setup) => {
    const y = setup.roles['outcome'][0], g = setup.roles['factor'][0]
    return [
      `res <- oneway.test(${col(y)} ~ factor(${col(g)}), var.equal = FALSE)`,
      `print(res)`,
      `print(rstatix::games_howell_test(data.frame(y = ${col(y)}, g = factor(${col(g)})), y ~ g))`,
      `gf <- factor(${col(g)}); agg <- data.frame(g = levels(gf), m = as.numeric(tapply(${col(y)}, gf, mean)))`,
      `nn <- as.numeric(tapply(${col(y)}, gf, length)); sdv <- as.numeric(tapply(${col(y)}, gf, sd))`,
      `se <- sdv / sqrt(nn); tq <- qt(0.975, nn - 1); agg$lo <- agg$m - tq * se; agg$hi <- agg$m + tq * se`,
      `print(ggplot(agg, aes(g, m)) + geom_pointrange(aes(ymin = lo, ymax = hi), colour = "#0c447c") + labs(x = NULL, y = NULL))`,
    ].join('\n')
  },

  // lm(y ~ covs + factors, contr.sum) + car::Anova(type=3) -> Table 2 · partial eta2 · emmeans adjusted means · figure.
  // Clean named data.frame (cov_*/fac_*) so contrasts, car::Anova and emmeans reference stable term names.
  'ancova': (_spec, setup) => {
    const y = setup.roles['outcome'][0], factors = setup.roles['factor'], covs = setup.roles['covariates']
    const level = conf(setup)
    const fv = (i: number) => `fac_${i + 1}`, cv = (i: number) => `cov_${i + 1}`
    const covRhs = covs.map((_c, i) => cv(i)).join(' + ')
    const facRhs = factors.map((_f, i) => fv(i)).join(' * ')
    return [
      `ac <- data.frame(y = ${col(y)}, ${covs.map((c2, i) => `${cv(i)} = ${col(c2)}`).join(', ')}, ${factors.map((f, i) => `${fv(i)} = factor(${col(f)})`).join(', ')})`,
      `ctr <- list(${factors.map((_f, i) => `${fv(i)} = "contr.sum"`).join(', ')})`,
      `m <- lm(y ~ ${covRhs} + ${facRhs}, data = ac, contrasts = ctr)`,
      `a3 <- car::Anova(m, type = 3)`,
      `print(a3)`,
      `print(effectsize::eta_squared(a3, partial = TRUE))`,
      `emm <- emmeans::emmeans(m, ~ ${facRhs}, level = ${level})`,
      `print(emm)`,
      `print(summary(pairs(emm, adjust = "tukey"), infer = TRUE, level = ${level}))`,
      `emm_df <- as.data.frame(emm)`,
      `gc <- setdiff(names(emm_df), c("emmean", "SE", "df", "lower.CL", "upper.CL"))`,
      `emm_df$g_lbl <- if (length(gc) > 1) do.call(paste, c(emm_df[gc], sep = " × ")) else as.character(emm_df[[gc[1]]])`,
      `print(ggplot(emm_df, aes(g_lbl, emmean)) +`,
      `  geom_pointrange(aes(ymin = lower.CL, ymax = upper.CL), colour = "#0c447c") + labs(x = NULL, y = NULL))`,
    ].join('\n')
  },

  // manova(cbind(DVs) ~ factors) sequential SS · selected statistic · per-DV follow-up aov · means faceted by DV
  'manova': (_spec, setup) => {
    const dvs = setup.roles['outcomes'], factors = setup.roles['factors']
    const statistic = String(setup.options['statistic'] ?? 'Pillai') === 'Wilks' ? 'Wilks' : 'Pillai'
    const followups = setup.options['followups'] !== false
    const cbind = `cbind(${dvs.map(col).join(', ')})`
    const facRhs = factors.map((f) => `factor(${col(f)})`).join(' * ')
    return [
      `m <- manova(${cbind} ~ ${facRhs})`,
      `print(summary(m, test = "${statistic}"))`,
      followups
        ? dvs.map((dv) => `print(summary(aov(${col(dv)} ~ ${facRhs})))`).join('\n')
        : `# follow-up ANOVAs off`,
      `gf <- factor(${col(factors[0])})`,
      `agg <- do.call(rbind, lapply(list(${dvs.map((dv) => `c(${col(dv)})`).join(', ')}), function(v) {`,
      `  mm <- tapply(v, gf, mean); nn <- tapply(v, gf, length); ss <- tapply(v, gf, sd)`,
      `  se <- ss / sqrt(nn); tq <- qt(0.975, nn - 1)`,
      `  data.frame(g = names(mm), m = as.numeric(mm), lo = as.numeric(mm - tq * se), hi = as.numeric(mm + tq * se)) }))`,
      `agg$dv <- rep(c(${dvs.map((dv) => `"${dv}"`).join(', ')}), each = nlevels(gf))`,
      `print(ggplot(agg, aes(g, m)) + geom_pointrange(aes(ymin = lo, ymax = hi), colour = "#0c447c") +`,
      `  facet_wrap(~dv, scales = "free_y") + labs(x = NULL, y = NULL))`,
    ].join('\n')
  },

  // manova(cbind(DVs) ~ covariates + factors) — covariates FIRST (== car::Manova Type II factor row) · per-DV aov · adjusted-means faceted
  'mancova': (_spec, setup) => {
    const dvs = setup.roles['outcomes'], factors = setup.roles['factors'], covs = setup.roles['covariates']
    const statistic = String(setup.options['statistic'] ?? 'Pillai') === 'Wilks' ? 'Wilks' : 'Pillai'
    const cbind = `cbind(${dvs.map(col).join(', ')})`
    const covRhs = covs.map(col).join(' + ')
    const facRhs = factors.map((f) => `factor(${col(f)})`).join(' * ')
    return [
      `# covariates FIRST, factor(s) LAST -> factor row matches car::Manova Type II (spike-proven)`,
      `m <- manova(${cbind} ~ ${covRhs} + ${facRhs})`,
      `print(summary(m, test = "${statistic}"))`,
      dvs.map((dv) => `print(summary(aov(${col(dv)} ~ ${covRhs} + ${facRhs})))`).join('\n'),
      `agg <- do.call(rbind, lapply(list(${dvs.map((dv) => `c(${col(dv)})`).join(', ')}), function(v) {`,
      `  d2 <- data.frame(y = v, ${covs.map((c2) => `${'cov_' + c2} = ${col(c2)}`).join(', ')}, ${factors.map((f) => `${'fac_' + f} = factor(${col(f)})`).join(', ')})`,
      `  lm_fit <- lm(y ~ ${covs.map((c2) => 'cov_' + c2).join(' + ')} + ${factors.map((f) => 'fac_' + f).join(' * ')}, data = d2)`,
      `  em <- as.data.frame(emmeans::emmeans(lm_fit, ~ ${'fac_' + factors[0]}))`,
      `  data.frame(g = as.character(em[["${'fac_' + factors[0]}"]]), m = em$emmean, lo = em$lower.CL, hi = em$upper.CL) }))`,
      `agg$dv <- rep(c(${dvs.map((dv) => `"${dv}"`).join(', ')}), each = nlevels(factor(${col(factors[0])})))`,
      `print(ggplot(agg, aes(g, m)) + geom_pointrange(aes(ymin = lo, ymax = hi), colour = "#0c447c") +`,
      `  facet_wrap(~dv, scales = "free_y") + labs(x = NULL, y = NULL))`,
    ].join('\n')
  },

  // wilcox.test(y ~ g) unpaired -> U/p · coin Z · rank_biserial -> r · boxplot
  'mann-whitney-u': (_spec, setup) => {
    const y = setup.roles['outcome'][0], g = setup.roles['group'][0]
    const correct = setup.options['continuity'] === false ? 'FALSE' : 'TRUE'
    return [
      `df <- data.frame(score = ${col(y)}, g = factor(${col(g)}))`,
      `res <- wilcox.test(${col(y)} ~ factor(${col(g)}), correct = ${correct}, alternative = "${alt(setup)}")`,
      `print(res)`,
      `print(coin::wilcox_test(score ~ g, data = df))`,
      `print(effectsize::rank_biserial(score ~ g, data = df))`,
      `print(ggplot(data.frame(group = factor(${col(g)}), score = ${col(y)}), aes(group, score)) +`,
      `  geom_boxplot(fill = "#9cc2ec", colour = "#0c447c") + labs(x = NULL, y = NULL))`,
    ].join('\n')
  },

  // wilcox.test(a, b, paired=TRUE) -> V/p · coin::wilcoxsign_test Z · rank_biserial(paired) -> r · difference plot
  'wilcoxon-signed-rank': (_spec, setup) => {
    const a = setup.roles['conditionA'][0], b = setup.roles['conditionB'][0]
    const correct = setup.options['continuity'] === false ? 'FALSE' : 'TRUE'
    return [
      `a <- ${col(a)}; b <- ${col(b)}`,
      `res <- wilcox.test(a, b, paired = TRUE, correct = ${correct}, alternative = "${alt(setup)}")`,
      `print(res)`,
      `print(coin::wilcoxsign_test(a ~ b))`,
      `print(effectsize::rank_biserial(a, b, paired = TRUE))`,
      `print(ggplot(data.frame(case = factor(seq_along(a)), d = a - b), aes(case, d)) +`,
      `  geom_col(fill = "#9cc2ec", colour = "#0c447c") + geom_hline(yintercept = 0, colour = "#0c447c") +`,
      `  labs(x = "Case", y = "Difference (A - B)"))`,
    ].join('\n')
  },

  // kruskal.test(y ~ g) -> H/df/p · eps2 = H(n+1)/(n^2-1) · rstatix::dunn_test (holm) -> Table 3 · boxplot
  'kruskal-wallis': (_spec, setup) => {
    const y = setup.roles['outcome'][0], g = setup.roles['group'][0]
    return [
      `kw <- kruskal.test(${col(y)} ~ factor(${col(g)}))`,
      `print(kw)`,
      `nn <- length(${col(y)}); h <- unname(kw$statistic); eps2 <- h * (nn + 1) / (nn^2 - 1)`,
      `cat("epsilon-squared:", eps2, "\\n")`,
      `print(rstatix::dunn_test(data.frame(y = ${col(y)}, g = factor(${col(g)})), y ~ g, p.adjust.method = "holm"))`,
      `print(ggplot(data.frame(group = factor(${col(g)}), score = ${col(y)}), aes(group, score)) +`,
      `  geom_boxplot(fill = "#9cc2ec", colour = "#0c447c") + labs(x = NULL, y = NULL))`,
    ].join('\n')
  },

  // friedman.test(matrix) -> chi2/df/p · Kendall W = chi2/(n*(k-1)) · hand-rolled Nemenyi · profile plot
  'friedman': (_spec, setup) => {
    const measures = setup.roles['measures']
    const condLevels = measures.map((m) => `"${m}"`).join(', ')
    return [
      `conds <- c(${condLevels})`,
      `mat <- matrix(c(${measures.map(col).join(', ')}), ncol = length(conds), dimnames = list(NULL, conds))`,
      `ft <- friedman.test(mat)`,
      `print(ft)`,
      `k <- ncol(mat); n <- nrow(mat); w <- unname(ft$statistic) / (n * (k - 1))`,
      `cat("Kendall's W:", w, "\\n")`,
      `rbar <- colMeans(t(apply(mat, 1, rank)))`,
      `for (i in 1:(k - 1)) for (j in (i + 1):k) {`,
      `  q <- (rbar[j] - rbar[i]) / sqrt(k * (k + 1) / (6 * n))`,
      `  cat(conds[i], "-", conds[j], "p.adj =", ptukey(abs(q) * sqrt(2), k, Inf, lower.tail = FALSE), "\\n") }`,
      `mm <- colMeans(mat); sdv <- apply(mat, 2, sd); se <- sdv / sqrt(nrow(mat)); tq <- qt(0.975, nrow(mat) - 1)`,
      `agg <- data.frame(cond = factor(conds, levels = conds), m = mm, lo = mm - tq * se, hi = mm + tq * se)`,
      `print(ggplot(agg, aes(cond, m, group = 1)) + geom_line(colour = "#0c447c") +`,
      `  geom_pointrange(aes(ymin = lo, ymax = hi), colour = "#0c447c") + labs(x = NULL, y = NULL))`,
    ].join('\n')
  },
}

export const groupPackages: Record<string, string[]> = {
  'one-sample-t-test': ['effectsize', 'ggplot2'],
  'independent-t-test': ['car', 'effectsize', 'ggplot2'],
  'paired-t-test': ['psych', 'effectsize', 'ggplot2'],
  'one-way-anova': ['effectsize', 'emmeans', 'ggplot2'],
  'factorial-anova': ['afex', 'effectsize', 'emmeans', 'ggplot2'],
  'repeated-measures-anova': ['afex', 'emmeans', 'ggplot2'],
  'mixed-anova': ['afex', 'emmeans', 'ggplot2'],
  'nested-anova': ['effectsize', 'ggplot2'],
  'welch-anova': ['rstatix', 'ggplot2'],
  'ancova': ['car', 'effectsize', 'emmeans', 'ggplot2'],
  'manova': ['ggplot2'],
  'mancova': ['emmeans', 'ggplot2'],
  'mann-whitney-u': ['coin', 'effectsize', 'ggplot2'],
  'wilcoxon-signed-rank': ['coin', 'effectsize', 'ggplot2'],
  'kruskal-wallis': ['rstatix', 'ggplot2'],
  'friedman': ['ggplot2'],
}
