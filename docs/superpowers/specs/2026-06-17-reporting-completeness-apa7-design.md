# Reporting-completeness pass — APA-7 conformance + citable provenance (design)

**Status:** design, awaiting owner review → implementation plan.
**Origin:** the 2026-06-17 reporting-convention/completeness review (`reviews/2026-06-17-reporting-completeness-review.md`)
flagged that the 40 live tests are statistically sound and report-only neutral APA-7, but fall short of a strict
publication-completeness bar in a few systematic ways. Owner decision: adopt a named, citable standard and
conform every test to it (so "complete" = "conforms to the cited standard," defensible if questioned).

## Goal

Bring every test's *reporting* into conformance with a named standard, and make the *computation* traceable —
without changing any (correct, native-R-verified) statistics. No new tests go live; this is a quality pass on
the existing 40.

## The standard (owner-ruled 2026-06-17)

Complementary, citable conventions — this pass conforms each test to the right one and enforces the shared reporting principles across all. **Coefficient tables and descriptive tables follow Vincent Arel-Bundock's `modelsummary` package** (the convention the owner prefers); the inferential statistic tables keep their discipline-standard APA-7 structure; APA-7 principles + cited methods + provenance apply throughout. Both families are applied the same way the coef tables already are: the format is **replicated in the TS builders** and the **real R call emitted in the exported `analysis.R`** (it does not run live in WebR); computed values are unchanged.

1. **Coefficient tables (the 13 regression + econometrics tests) → `modelsummary()` (Arel-Bundock).** The stacked estimate / (SE) / [CI] + GOF-footer format from the table-format slice — **UNCHANGED.** They already carry a per-term CI, so the effect-size-CI work below does **not** touch them; affected only by the relevant diagnostics/render fixes (Themes 3–4) + the method-reference line (Task 18).
2. **Descriptive tables → Arel-Bundock's `datasummary_*` family** (same package + house style): Summary statistics → `datasummary_skim`/`datasummary`; Frequencies & cross-tabs → `datasummary_crosstab`; the group "Table 1" descriptives that front the t-test / ANOVA / nonparametric comparisons → `datasummary_balance`. (Correlation matrices → `datasummary_correlation` only if/when correlations go multi-variable; the current single-pair cards are unaffected.) The Theme-4 descriptive completeness adds (mean CI, Valid%/Missing, excess-kurtosis, skew/kurtosis) are designed *into* these datasummary tables rather than patched onto the old format.
3. **Inferential statistic tables → APA-7 conventions:** the ANOVA/ANCOVA/MANOVA source & multivariate-test tables, correlation *r*-lines, the χ² contingency + test tables, Fisher, and the rank-test tables keep their discipline-standard structure (a coefficient or datasummary format would be *wrong* for these).
4. **Cross-cutting reporting principles → APA-7 (Publication Manual, 7th ed.), across ALL families:** exact *p*; **effect sizes with confidence intervals**; descriptives; assumptions checked + reported. The completeness yardstick — what most of this pass enforces.
5. **Econometrics *methods* APA-7 doesn't define → the canonical method reference the computation already uses**, cited from each R package's own `citation()` (authoritative, no guessing): `rdrobust` (Calonico–Cattaneo–Titiunik), weak-instrument *F* (Stock–Yogo), PSM balance (Austin), DiD clustered SE (Bertrand–Duflo–Mullainathan), ARIMA/`forecast` (Hyndman & Athanasopoulos), VAR (`vars`/Lütkepohl), `plm`, `tseries`. For the coef-table family this sits alongside `modelsummary` — cite both.
6. **Computational traceability** — everything runs in R via published packages and the app already exports a
   runnable `analysis.R`. Surface the provenance so any number traces to a named, peer-used implementation
   (see "Provenance" below).

## Scope — four work-streams

### Theme 1 — Effect-size confidence intervals (APA-7: effect size *with* its CI)
Surface a CI next to every effect size, displayed like Pearson's *r* / Fisher's OR already are (`value [lo, hi]`).
- **Extract (already computed by `effectsize`, discarded today):** Cohen's d (one-sample, paired), rank-biserial
  *r* (Mann-Whitney, Wilcoxon), ε² (Kruskal-Wallis), Kendall's W (Friedman), η²/partial-η²/ω² (one-way, factorial,
  RM, mixed, nested, ANCOVA, MANOVA/MANCOVA per-DV), Cohen's w (χ² GoF).
- **Re-implement:** independent-t Cohen's d via `effectsize::cohens_d` (gains the CI **and** retires the
  pooled/Hedges-uncorrected-under-Welch concern — use the standardizer that matches the chosen test).
- **Switch:** Cramér's V (χ² independence) to `effectsize::cramers_v` for its CI (keep the value identical).
- **Bootstrap:** Spearman ρ and Kendall τ (base `cor.test` returns no CI) — percentile/BCa bootstrap CI.

### Theme 2 — Assumption reporting (APA-7: assumptions checked + reported), "Standard set"
Every test reports the assumption checks its method requires, **computed** (no static text, no dead values):
- **paired-t** — compute + show Shapiro-Wilk on the difference scores (currently static text).
- **mixed-ANOVA** — render the between-groups Levene that is already computed (currently a dead value).
- **independent-t & Welch** — add within-group normality (Shapiro per group).
- **MANOVA / MANCOVA** — add Box's M (homogeneity of covariance matrices).
- **nested-ANOVA** — add a descriptives table + Levene + Shapiro (currently neither descriptives nor any check).

### Theme 3 — Econometrics identifying-assumption diagnostics
**Cheap fixes / near-correctness (do regardless):** ARIMA Ljung-Box at `lag ≫ 1` with `fitdf = p+q+P+Q` (today
default `lag=1`, no `fitdf`); label RDD bandwidth selector / kernel / cutoff; add Phillips-Perron to the
stationarity APA sentence; fix the Granger lag-default copy + add an AIC/BIC lag-selection note.
**Key diagnostics (new computation):** VAR residual serial-correlation (Portmanteau, `vars::serial.test`);
PSM common-support/overlap; RDD McCrary density test; a DiD pre-trends signal. **Feasibility spike** for any
package not WebR-loadable (e.g. `rddensity`) — hand-roll or defer that one item with a note.
**Deferred (out of scope):** full causal battery — DiD event-study leads/lags + two-way FE, RDD placebo cutoffs,
Abadie–Imbens PSM SEs.

### Theme 4 — Per-test items + fuller descriptive cards
- **Render / sentence / copy:** FE & DiD overall *F* → `F(df1,df2), p` (already computed); Wilcoxon APA sentence
  includes *V/W*; distribution-normality APA narrates the K-S/Lilliefors result; fix the logistic how-to-read
  "read p from the z column" copy (no z column — the ratified no-visible-coefficient-*p* policy stays; the CI
  substitutes; just fix wording).
- **Completeness adds:** Mann-Whitney & Kruskal-Wallis group medians/IQR; Hodges-Lehmann median-difference
  (Mann-Whitney, Wilcoxon); random-effects Breusch-Pagan LM (RE vs pooled) + variance components/θ; label
  Kendall's tau-b; label Fisher's OR as conditional-MLE + add Cramér's V for >2×2; per-cell standardized
  residuals on χ² independence.
- **Descriptive tables → Arel-Bundock `datasummary_*` (standard §2), with the completeness adds designed in:**
  Summary statistics → `datasummary_skim`/`datasummary` + a mean 95% CI (or SE) + "excess kurtosis (type-3)" label;
  Frequencies & cross-tabs → `datasummary_crosstab` + Valid% vs Total% split + a Missing row; the per-group
  "Table 1" descriptives that front the t-test / ANOVA / nonparametric comparisons → `datasummary_balance`;
  Distribution-normality keeps its normality-test structure but surfaces skewness/kurtosis. Replicate each
  format in the TS builders + emit the real `datasummary_*()` in `analysis.R`; computed values unchanged.
  (Quartiles/IQR + a grouped Total row are out of scope — owner-ruled.)

## Provenance (computational traceability)

Add a **`CITATIONS.txt`** to the export bundle (alongside `LICENSES.txt`): R version, each R package used by the
emitted analysis, and its `citation()` reference, plus a one-line statement that results are formatted per
APA-7 and econometric methods follow each package's cited method. A short per-card method-reference line in the
how-to-read of the econometrics cards is also included (owner-approved 2026-06-17).

## Architecture / where changes land

Follows the existing pattern; no new infrastructure.
- **`src/lib/stats/<id>.ts`** — return the already-computed CI bounds / new diagnostic values (extend the result
  types); add the new computations (bootstrap ρ/τ, Box's M, Shapiro/Levene where missing, Portmanteau, McCrary,
  pre-trends, Hodges-Lehmann, BP-LM). Every new/changed value cross-checked WebR ≡ native R 4.6.0.
- **`src/lib/registry/<id>.ts`** — table column specs, `apaTemplate`, `tableNote`, `howToRead` updated for the new
  cells/sentences; consistency tests updated.
- **`src/lib/results/build<Id>.ts`** — render the new CIs / diagnostics / descriptives / notes.
- **Spec HTML cards** (`telos_test_outputs.html`) — mirror any new drawn rows/notes (owner's design canvas).
- **Export** — `CITATIONS.txt`; emitters extend to print the new diagnostics where they already mirror the call.

## Testing

- Per-test stats tests assert the new CIs/diagnostics against native-R ground truth (the established WebR≡R spike
  pattern); bootstrap CIs asserted within tolerance against a seeded native-R bootstrap.
- Consistency tests updated for new registry strings; card-mutation checks retained.
- Native-R correctness gate (`runs-in-r.test.ts`) extended where emitters gain diagnostics.
- Full gates ×2 + fresh-clone; owner click-through at the end.

## Out of scope / unchanged
- The ratified no-visible-coefficient-*p* policy in the modelsummary regression/econometrics tables (per-term CI
  is the in-table inference cue). The logistic copy fix only removes the reference to a non-existent z column.
- Full causal-robustness battery (Theme 3 deferred items).
- No new tests go live; the SEM slice is separate (ROADMAP #1).

## Resolved (owner-approved 2026-06-17)
- Standard confirmed: APA-7 + cited method/package references + computational provenance ("a proper citable convention").
- Provenance surfacing: **both** — `CITATIONS.txt` in the export bundle **and** a per-card method-reference line in the econometrics cards' how-to-read.
- Quartiles/IQR + a grouped "Total" row: **out** of scope for this pass.
- Sequencing: **one combined implementation plan, phased by theme** (Themes 1→4), single gate story.
