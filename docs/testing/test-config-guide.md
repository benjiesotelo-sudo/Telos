# Telos — shared testing guide (`wage1-extended.csv`)

A single dataset + a configuration recipe for every **live** test, so Benjie and Claude
test identically and surface the same completeness gaps.

- **Dataset:** `wage1-extended.csv` (this folder, and copied to `~/Documents/` for upload).
  526 workers (Wooldridge `wage1`) + a few added columns — see the column reference below.
- **Rebuild:** `node docs/testing/build-wage1-extended.mjs` (deterministic — always identical output).
- **Covers:** all **29 live tests**. The time-series and panel **econometrics** tests
  (ARIMA, ADF/KPSS, Granger, VAR, fixed/random effects, Hausman, DiD) need a date/entity
  dimension this cross-sectional file doesn't have — they'll get small companion files when
  that slice lands. IV / RDD / PSM (cross-sectional) will be added here then too.

## How to use it

1. Upload `wage1-extended.csv` → **Configure data** (set each column's type + level — see table) →
   **Pick a test** → drag columns into the role slots and set options as listed → **Run**.
2. Compare what you get to the **Expect** line. If a sensible column is *rejected* by a role
   slot, or an output reads wrong / is missing, that's a finding — note the test + what you saw.

## Column reference (expected type / level after upload)

| Column | What it is | Expected level | Used as |
|---|---|---|---|
| `wage` | hourly wage ($) | ratio (continuous) | outcome / DV / numeric variable |
| `lwage` | log(wage) | ratio | continuous variable (≈normal) |
| `educ` | years of education | ratio (integer) | predictor / covariate / correlation |
| `exper` | years of work experience | ratio (integer) | predictor / covariate |
| `tenure` | years with current employer | ratio (integer) | predictor |
| `numdep` | number of dependents (0–6) | **count** | Poisson/NB outcome |
| `id` | person id (1–526, unique) | id — **starts Unused** | Subject ID (repeated-measures tests) |
| `sex` | male / female | nominal | grouping / factor / categorical |
| `region` | northcentral / south / west / east | nominal (4 levels) | 3+ group factor |
| `occupation` | professional / clerical / service / other | nominal (4 levels) | factor / categorical |
| `married_status` | married / single | nominal (2 levels) | grouping / logistic outcome |
| `dept` | sub-group nested in region (`NC-1`…`E-2`) | nominal | nested factor |
| `score_t1/t2/t3` | skills score at 3 times (synthetic) | ratio | paired / repeated measures / 2nd DV |
| original 0/1 dummies (`female`, `married`, `smsa`, …) | binary indicators | nominal | available, but the readable columns above are clearer |

> **Heads-up on `id`:** it's a clean 1–526 run, so the app auto-detects it as an **ID column and
> leaves it Unused with no level.** For the repeated-measures tests (RM-ANOVA, mixed ANOVA, Friedman),
> first mark `id` **Used** and set its level to **nominal** in Configure-data, *then* drag it into the
> Subject ID slot. (`educ`/`exper`/`tenure` default to ratio and work as predictors/covariates as-is —
> the count tag the app adds is harmless outside the Poisson outcome slot.)

---

## Descriptive statistics

### 1. Summary statistics
- **Question:** What are the central tendency and spread of wage, education, and experience — overall and by sex?
- **Roles:** Variables to summarize = `wage`, `educ`, `exper` · Group by (optional) = `sex`
- **Options:** (statistics & skew/kurtosis are fixed displays)
- **Expect:** a Descriptive-statistics table (N, M, SD, Min, Max, Median, Skew, Kurtosis), one block per sex; a histogram.

### 2. Frequencies & cross-tabs
- **Question:** How are workers distributed across regions, and does region composition differ by marital status?
- **Roles:** Variable(s) = `region` (simple frequency) — then add `married_status` for a cross-tab
- **Expect:** a frequency table (Category, n, %, cumulative %); with two variables, a region × married_status cross-tab (n + row % + col %); a bar chart.

### 3. Distribution & normality
- **Question:** Are hourly wage and log-wage normally distributed?
- **Roles:** Variable(s) = `wage`, `lwage`
- **Expect:** a normality table per variable (Shapiro-Wilk W + K–S D, N, p) with skew/kurtosis; histogram + QQ panels. `wage` is right-skewed (expect non-normal); `lwage` is closer to normal — a useful contrast, and a check that the output **reports** rather than declares.

---

## Group comparisons

### 4. One-sample t-test
- **Question:** Does the average hourly wage differ from $5.00/hour?
- **Roles:** Outcome = `wage`
- **Options:** test value (μ₀) = **5** · α = 0.05 · CI = 95% (tails fixed two-tailed)
- **Expect:** descriptives (N, M≈5.90, SD, SE) + one-sample t-test (test value, t, df=525, p, M_diff, CI, d). Clearly significant. *(Try μ₀ = 6 for a near-null case.)*

### 5. Independent t-test
- **Question:** Do men and women earn different average hourly wages?
- **Roles:** Outcome (DV) = `wage` · Grouping variable = `sex`
- **Options:** α = 0.05 · equal variance = off (Welch) · CI = 95%
- **Expect:** group statistics per sex; t-test with a Welch row; Levene note; Cohen's d; boxplot. Men earn more → significant.

### 6. Paired t-test
- **Question:** Do skills scores improve from time 1 to time 2?
- **Roles:** Condition A = `score_t1` · Condition B = `score_t2`
- **Options:** α = 0.05 · CI = 95%
- **Expect:** paired descriptives; paired t-test (t, df=525, p, M_diff ≈ 3.5, CI, d_z); change figure. Strongly significant.

### 7. One-way ANOVA + post-hoc
- **Question:** Does average wage differ across the four U.S. regions?
- **Roles:** Outcome (DV) = `wage` · Factor = `region`
- **Options:** α = 0.05 · post-hoc = Tukey HSD · CI = 95%
- **Expect:** descriptives by region; ANOVA (SS, df, MS, F, p, η²); Tukey post-hoc; means plot; Levene/normality notes.

### 8. Factorial ANOVA
- **Question:** How do sex and marital status — and their interaction — relate to wage?
- **Roles:** Outcome (DV) = `wage` · Factors = `sex`, `married_status`
- **Options:** α = 0.05 · interactions = on · CI = 95% (post-hoc fixed Tukey)
- **Expect:** cell descriptives (sex × married_status); ANOVA with main effects + interaction (partial η²); simple-effects/post-hoc; interaction plot. *(Toggle interactions off to check the main-effects-only wording.)*

### 9. Repeated-measures ANOVA
- **Question:** Do skills scores change across the three time points?
- **Roles:** Subject ID = `id` *(mark Used + nominal first — see the `id` heads-up)* · Repeated measures = `score_t1`, `score_t2`, `score_t3`
- **Options:** α = 0.05 · sphericity = GG correction · post-hoc = on
- **Expect:** condition descriptives; RM-ANOVA; Mauchly's sphericity (3 levels → table shown); post-hoc; profile plot. Strong within-subject effect. *(Set sphericity = none to check the "uncorrected" wording.)*

### 10. Mixed ANOVA
- **Question:** Do skills-score trajectories over time differ between men and women?
- **Roles:** Subject ID = `id` *(mark Used + nominal first — see the `id` heads-up)* · Between-groups factor = `sex` · Repeated measures = `score_t1`, `score_t2`, `score_t3`
- **Options:** α = 0.05 · sphericity = GG correction · post-hoc = on
- **Expect:** descriptives by group × condition; mixed ANOVA (between, within, interaction terms); sphericity; post-hoc; one profile line per sex. The sex × time interaction is small (~2 pts) — a good borderline case.

### 11. Nested ANOVA
- **Question:** Does wage vary across departments nested within region?
- **Roles:** Outcome (DV) = `wage` · Factor = `region` · Nested factor = `dept`
- **Options:** α = 0.05 · nesting = random
- **Expect:** nested ANOVA table (region, dept(region), residual; ω²); grouped-means plot. Note the two F rows use different error terms.

### 12. Welch's ANOVA
- **Question:** Does average wage differ across regions without assuming equal variances?
- **Roles:** Outcome (DV) = `wage` · Factor = `region`
- **Options:** α = 0.05 (post-hoc fixed Games-Howell)
- **Expect:** descriptives; Welch's ANOVA (F, df1, fractional df2, p); Games-Howell post-hoc; means plot.

### 13. ANCOVA
- **Question:** Do wages differ by region after controlling for education?
- **Roles:** Outcome (DV) = `wage` · Factor = `region` · Covariate(s) = `educ`
- **Options:** α = 0.05 · CI = 95% (post-hoc fixed adjusted means)
- **Expect:** adjusted (estimated marginal) means; ANCOVA table (partial η²); post-hoc on adjusted means; adjusted-means plot; slopes-homogeneity note. *(If `educ` is rejected as a covariate, set its level to ratio — and flag it.)*

### 14. MANOVA
- **Question:** Do men and women differ jointly on wage and skills score?
- **Roles:** Outcomes (DVs) = `wage`, `score_t1` · Factor(s) = `sex`
- **Options:** α = 0.05 · test statistic = Pillai · follow-up ANOVAs = on
- **Expect:** multivariate tests (Pillai's V, approx F, df, p); per-DV follow-up ANOVAs; means plot faceted by DV. *(Use `wage` + `score_t1`, not `wage` + `lwage` — those are collinear. Switch the statistic to Wilks to check it's reported, not always Pillai.)*

### 15. MANCOVA
- **Question:** Do men and women differ on wage and skills score after controlling for education?
- **Roles:** Outcomes (DVs) = `wage`, `score_t1` · Factor(s) = `sex` · Covariate(s) = `educ`
- **Options:** α = 0.05 · test statistic = Pillai
- **Expect:** covariate-adjusted multivariate tests; adjusted univariate follow-ups; adjusted-means plot faceted by DV.

### 16. Mann-Whitney U
- **Question:** Do wage distributions differ between men and women (nonparametric)?
- **Roles:** Outcome = `wage` · Grouping var = `sex`
- **Options:** α = 0.05 · continuity correction = on (tails fixed two)
- **Expect:** rank summary (N, mean rank, sum of ranks per sex); Mann-Whitney (U, Z, p, r); boxplot.

### 17. Wilcoxon signed-rank
- **Question:** Do skills scores improve from time 1 to time 2 (nonparametric)?
- **Roles:** Condition A = `score_t1` · Condition B = `score_t2`
- **Options:** α = 0.05 · continuity correction = on (tails fixed two)
- **Expect:** rank summary by sign; signed-rank (V/W, Z, p, r); change figure. (38 tied cases are dropped — expected.)

### 18. Kruskal-Wallis
- **Question:** Do wage distributions differ across regions (nonparametric)?
- **Roles:** Outcome = `wage` · Grouping var = `region`
- **Options:** α = 0.05 (post-hoc fixed Dunn's)
- **Expect:** rank summary; Kruskal-Wallis (H, df, p, ε²); Dunn post-hoc; boxplot.

### 19. Friedman
- **Question:** Do skills scores differ across the three time points (nonparametric)?
- **Roles:** Subject ID = `id` *(mark Used + nominal first — see the `id` heads-up)* · Repeated measures = `score_t1`, `score_t2`, `score_t3`
- **Options:** α = 0.05 (post-hoc fixed Nemenyi)
- **Expect:** rank summary; Friedman (χ², df, p, Kendall's W); Nemenyi post-hoc; profile/box figure.

---

## Association

### 20. Pearson correlation
- **Question:** Is education linearly associated with hourly wage?
- **Roles:** Variable A = `educ` · Variable B = `wage`
- **Options:** α = 0.05 · CI = 95% (tails fixed two)
- **Expect:** Pearson table (r, 95% CI, t, df, p, N); scatter with fitted line. Positive, significant.

### 21. Spearman correlation
- **Question:** Is there a monotonic association between education and wage?
- **Roles:** Variable A = `educ` · Variable B = `wage`
- **Options:** α = 0.05 (tails fixed two)
- **Expect:** Spearman table (ρ, S, p, N); scatter. No CI (noted — `cor.test` doesn't return one for rank correlation).

### 22. Kendall's tau
- **Question:** Rank association between education and wage, robust to ties?
- **Roles:** Variable A = `educ` · Variable B = `wage`
- **Options:** α = 0.05 (tails fixed two)
- **Expect:** Kendall table (τ, z, p, N); scatter.

### 23. Chi-square independence
- **Question:** Are region and marital status related?
- **Roles:** Row variable = `region` · Column variable = `married_status`
- **Options:** α = 0.05 · continuity correction = on
- **Expect:** contingency table (observed [expected], row/col %); chi-square (χ², df=3, p, Cramér's V); mosaic/grouped bar. 4×2 → no Yates correction (that only applies to 2×2).

### 24. Chi-square goodness-of-fit
- **Question:** Are workers evenly distributed across the four regions?
- **Roles:** Variable = `region`
- **Options:** expected proportions = equal · α = 0.05
- **Expect:** observed vs expected + std. residuals; GoF (χ², df = k−1 = 3, p, Cohen's w); bar chart. Regions are uneven → significant. *(Try custom proportions, e.g. 0.25/0.35/0.20/0.20, to exercise that path.)*

### 25. Fisher's exact
- **Question:** Is sex associated with marital status (exact test)?
- **Roles:** Row variable = `sex` · Column variable = `married_status`
- **Options:** α = 0.05 (tails fixed two)
- **Expect:** 2×2 contingency; Fisher's exact (exact p, odds ratio, 95% CI — OR/CI shown because it's 2×2); grouped bar.

---

## Regression & prediction

### 26. Simple linear regression
- **Question:** How much does each additional year of education raise hourly wage?
- **Roles:** Outcome (DV) = `wage` · Predictor = `educ`
- **Options:** α = 0.05 · CI = 95%
- **Expect:** model fit (R², adj R², F, df, p, SE); coefficients (B≈0.54, SE, β, t, p, 95% CI); fitted-line + residual panels.

### 27. Multiple linear regression
- **Question:** How do education, experience, and tenure jointly predict wage?
- **Roles:** Outcome (DV) = `wage` · Predictors = `educ`, `exper`, `tenure`
- **Options:** α = 0.05 · CI = 95% · standardize = off
- **Expect:** model fit; coefficients with VIF; residual diagnostics; coefficient plot. **The β column shows em-dashes** with standardize off — that's the intended design (R1 ruling), not a bug. Toggle **standardize = on** to populate β. (The coefficient plot always shows standardized β regardless of the toggle — a known, ruled choice.)

### 28. Logistic regression
- **Question:** Can we predict whether someone is married from education, experience, and sex?
- **Roles:** Outcome (DV) = `married_status` · Predictors = `educ`, `exper`, `sex`
- **Options:** α = 0.05 · CI = 95% · report odds ratios = on · event category = **married**
- **Expect:** model fit (−2LL, AIC, Nagelkerke R², omnibus χ², p); coefficients (B, SE, z, p, OR, 95% CI); classification table; ROC curve + AUC. Includes a categorical predictor (`sex`), which exercises dummy coding and avoids the numeric-only near-separation edge.

### 29. Poisson / negative binomial
- **Question:** What predicts the number of dependents a worker has?
- **Roles:** Outcome (DV) = `numdep` · Predictors = `educ`, `exper`, `sex` · Exposure = (leave empty)
- **Options:** model = Poisson · α = 0.05 · CI = 95%
- **Expect:** model fit (AIC, residual deviance, df, dispersion); coefficients (B, SE, z, p, IRR, 95% CI); fitted-vs-residual plot; dispersion note. *(Switch model to negative binomial to see theta replace the dispersion ratio.)*

---

## Time series — `timeseries.csv`

The time-series econometrics tests need a dated series, so they use a **separate** file:
`timeseries.csv` (this folder + copied to `~/Documents/`) — 72 monthly rows, columns `month`
(ISO date, auto-detected as datetime → drop into the **Time** slot), `sales`, `visitors`, `ad_spend`.
Upload this instead of `wage1-extended.csv` for the four tests below. (`month` is accepted by the Time
role and *excluded* from numeric Series roles, so it can't be mis-dropped.)

### 30. ARIMA / SARIMA
- **Question:** What is the trend/seasonal structure of monthly sales, and the forecast ahead?
- **Roles:** Time variable = `month` · Series = `sales`
- **Options:** order = auto-select (or manual p,d,q P,D,Q) · seasonal period = 12 · forecast horizon = 12
- **Expect:** model summary (term·SE·CI), fit & diagnostics (AIC·BIC·log-lik·σ²·Ljung–Box p), forecast table (80/95% PI); forecast plot + a residual-diagnostics figure (ACF + Q–Q).

### 31. Stationarity tests (ADF, KPSS)
- **Question:** Is the sales series stationary?
- **Roles:** Time = `month` · Series = `sales`
- **Options:** test = both · lags = auto · α = 0.05
- **Expect:** one table, three rows — ADF, KPSS, **Phillips–Perron** — each with statistic, lag, p (KPSS/PP shown bounded, e.g. "< .01"), and a Conclusion computed from p vs α. Series plot + ACF/PACF figure. (On this fixture ADF and KPSS disagree — a good illustration of why you read both.)

### 32. Granger causality
- **Question:** Do past ad-spend values help predict sales (and/or the reverse)?
- **Roles:** Time = `month` · Series X = `ad_spend` · Series Y = `sales`
- **Options:** max lag = 4 · α = 0.05
- **Expect:** a table with both directions (X→Y, Y→X) — F, df, p; cross-series plot. Predictive precedence, not causation — and on this fixture both directions are significant.

### 33. VAR
- **Question:** How do sales and visitors move together over time?
- **Roles:** Time = `month` · Series = `sales`, `visitors`
- **Options:** lag order = auto · IRF horizon = 10
- **Expect:** lag-selection table (AIC/BIC/HQ), per-equation coefficients, a **FEVD** (forecast-error variance decomposition) table + a stability note; impulse-response plots.

## Coming with sub-slice 2 (panel + causal)

Still greyed in the picker; built next:
- **Panel** — Fixed effects, Random effects, Hausman, Difference-in-differences → an entity × period panel file.
- **Cross-sectional causal** — Instrumental variables (2SLS), Regression discontinuity, Propensity score matching → added to `wage1-extended.csv` (synthetic instrument + running variable).
