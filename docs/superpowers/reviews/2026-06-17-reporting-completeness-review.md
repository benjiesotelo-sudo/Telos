# Reporting-convention & completeness review — all 40 live tests (2026-06-17)

Owner-requested review ("what reporting convention do they follow? is each complete?"). Done by 8 family
methodology reviewers + a senior critic, grounded in `src/lib/registry`, `src/lib/results/build*`, and
`src/lib/stats` (not memory). Per-test documentation that backs this: `docs/test-documentation/`.

**Owner ruling (2026-06-17):** push the export slice as-is (no deploy, done — `main = origin = 6ac192a`);
**address the concerns in this doc in a later pass.** Nothing here is a correctness bug — all 40 are
statistically sound and native-R-verified. These are publication-*completeness* gaps.

## Convention (all 40)

Every test is **report-only, neutral APA-7**: reports the numbers, never declares a verdict (teaching is a
separate "How to read" layer), adjustable α/CI threaded through, a literal copy-paste APA exemplar sentence,
correct APA typography (U+2212 minus, leading-zero drop, compact-vs-spaced p). The **11 regression +
econometrics tests** use the **modelsummary publication coefficient-table** convention (stacked
estimate/(SE)/[CI], GOF footer, no stars, side-by-side models). All conventions match what a thesis/journal
in each area expects.

## Three systematic gaps (account for most of the distance to publication-complete)

1. **Effect-size confidence intervals missing wherever the effect size is a standalone index** — Cohen's
   d/dz, rank-biserial r, ε², Kendall's W, η²/ω²/partial-η², Spearman ρ, Kendall τ, Cramér's V, Cohen's w
   (~20 cards). The app threads CIs everywhere else (Pearson r, Fisher OR, every regression cell) and the R
   calls (`cohens_d`, `rank_biserial`, …) **already return the CI — it is computed then discarded.** Highest
   leverage, lowest risk.
2. **Assumption reporting is uneven *internally*** — computed+shown (one-sample Shapiro, ANOVA Levene),
   static text (paired-t normality), computed-but-not-rendered (mixed-ANOVA Levene), or absent (Box's M for
   MANOVA/MANCOVA; nested-ANOVA none; econ identifying-assumption diagnostics are prose-only).
3. **Values computed then dropped at the render layer** — FE/DiD bare F (df/p exist); logistic z/p hidden
   while its how-to-read says "read p from the z column" that isn't shown; APA sentences omit a tabulated
   statistic (Wilcoxon V/W; Phillips–Perron in stationarity).

## Per-test completeness (✅ complete · 🟡 minor · 🟠 notable)

| Test | Verdict | Key gap |
|---|---|---|
| Summary statistics | 🟡 | no mean CI/SE; "Kurtosis" not labelled excess |
| Frequencies & cross-tabs | 🟡 | no Valid%/Total% split or Missing row (exclusion count IS shown) |
| Distribution & normality | 🟡 | skew/kurtosis live only on Summary card |
| One-sample t | 🟡 | Cohen's d CI computed then discarded |
| Independent t | 🟡 | no within-group normality; hand-rolled pooled d (no CI, no Hedges) under Welch default |
| Paired t | 🟡 (weak) | normality-of-differences is static text, never computed |
| Mann-Whitney U | 🟡 | no CI on r; no median/IQR |
| Wilcoxon signed-rank | 🟡 | APA drops V/W; no CI / Hodges-Lehmann |
| Kruskal-Wallis | ✅ | only effect-size CI missing |
| Friedman | 🟡 (weak) | N reported nowhere; Nemenyi shows only adjusted p (no q/z) |
| One-way ANOVA | 🟡 | no η²/ω² CI |
| Factorial ANOVA | 🟡 | no partial-η² CI |
| Repeated-measures ANOVA | 🟡 | no η² CI; partial not generalized η² |
| Mixed ANOVA | 🟡 | computes a between-groups Levene it never renders (dead value) |
| Nested ANOVA | 🟠 | no descriptives AND no assumption checks (weakest in suite) |
| Welch's ANOVA | 🟡 | only omnibus card with no effect size at all |
| ANCOVA | 🟡 | exemplar (adj means+CI + slopes test); only η² CI missing |
| MANOVA | 🟠 | no Box's M, no descriptives table, no multivariate effect size |
| MANCOVA | 🟠 | same as MANOVA |
| Pearson | 🟡 | normality/linearity only verbal (has CI on r) |
| Spearman | 🟡 | no CI (honestly disclosed) |
| Kendall's tau | 🟡 | tau-b not labelled; no CI (not disclosed) |
| Chi-square independence | ✅ | only per-cell standardized residuals missing |
| Chi-square goodness-of-fit | ✅ | exemplary |
| Fisher's exact | 🟡 | OR not labelled conditional-MLE; no effect size for >2×2 |
| Simple linear | 🟡 | per-coef p hidden; no formal assumption-test numbers |
| Multiple linear | 🟡 | per-coef p hidden (VIF is a plus) |
| Logistic | 🟡 | per-term p hidden + how-to-read points at non-existent z column; no Hosmer-Lemeshow |
| Poisson / NB | 🟡 | no formal overdispersion / Poisson-vs-NB LR test |
| ARIMA / SARIMA | 🟡 | Ljung-Box at default lag=1, no fitdf (near-correctness); no forecast-accuracy |
| Stationarity (ADF/KPSS/PP) | 🟡 | APA drops PP; test spec (trend/drift, lag rule) not surfaced |
| Granger | 🟡 | stationarity warned-not-checked; no lag-selection aid |
| VAR | ✅ | only residual serial-correlation (Portmanteau) test missing |
| Fixed effects | 🟡 | overall F shown bare (df/p computed, not rendered) |
| Random effects | 🟡 | no BP-LM (RE vs OLS); no θ/variance components |
| Hausman | 🟡 | classical phtest vs displayed clustered SEs (coherence) |
| DiD | 🟡 | no formal pre-trends/event-study; single Post dummy not time FE |
| RDD | 🟡 | conventional estimate + robust CI mismatch; bandwidth/kernel/cutoff unlabelled; McCrary recommended-not-run |
| IV / 2SLS | ✅ | most complete in suite |
| PSM | 🟡 | no common-support / overlap diagnostic |

**Strongest:** IV/2SLS, GoF, ANCOVA, VAR, Kruskal-Wallis, χ² independence, Hausman.
**Weakest:** nested-ANOVA, MANOVA, MANCOVA (notable); within minor, watch paired-t, Friedman, Welch.

## Prioritized punch-list for the deferred pass

1. **Surface effect-size CIs everywhere an effect size is reported** (~20 cards). Mostly a `$`-extraction +
   render change (the CI is already computed). #1 leverage; near-zero risk; what APA-7 most asks for.
2. **Render computed-but-dropped values:** FE/DiD F → `F(df1,df2), p`; fix the logistic how-to-read "z column"
   copy (or show z/p); add the dropped statistic to the Wilcoxon and Stationarity APA sentences.
3. **Make assumption reporting uniform:** compute+show paired-t Shapiro on the differences; render the
   mixed-ANOVA Levene that's already computed; add Box's M to MANOVA/MANCOVA; add descriptives + an
   assumption check to nested-ANOVA.
4. **Econometrics identifying-assumption diagnostics** (recommended-in-prose → run in-app): DiD pre-trends/
   event-study or placebo; RDD McCrary density + label bandwidth/kernel/cutoff; PSM common-support/overlap;
   VAR Portmanteau serial-correlation; fix ARIMA Ljung-Box spec (lag ≫ 1, fitdf = p+q+P+Q).
5. **Smaller polish:** Summary mean CI/SE + "excess kurtosis" note; frequencies Valid%/Missing row; Welch
   effect size; label Kendall tau-b; Fisher conditional-MLE OR label + effect size for >2×2; per-cell
   standardized residuals on χ² independence.

Full per-test detail (convention + what's reported + every gap with severity) is in the review-workflow
output and `docs/test-documentation/`.
