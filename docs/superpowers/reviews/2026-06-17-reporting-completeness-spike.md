# Task 1 verification spike — reporting-completeness (APA-7) novel machinery + WebR feasibility

**Date:** 2026-06-17 · **WebR:** 0.6.0 (R 4.6.0) via the live app engine (`src/lib/webr/engine.ts`) · **Native:** R 4.6.0 at `/usr/local/bin/Rscript` · cross-checked WebR ≡ native R.

**Method:** native R via `Rscript` (`/tmp/spike_native.R`, `/tmp/spike_ds.R`); WebR via a tsx harness that imports the real `Engine` and calls `engine.init()` + `engine.runJson(...)` (`/tmp/spike_webr.mts`). Fixtures loaded from `tests/e2e/fixtures/` with the app's parse rules; configs taken from `docs/test-documentation/<NN>_<id>/README.md`. r-wasm repo availability cross-checked against `https://repo.r-wasm.org/src/contrib/PACKAGES`.

## Headline (gate result)

**Every novel computation runs under WebR. No deferral is required — `rddensity` (McCrary) LOADS and runs under WebR**, so the one deferral the plan allowed is not needed. All three candidate NEW packages (`boot`, `heplots`, `rddensity`) install AND load under WebR 0.6.0, and every WebR value matches native R 4.6.0 to full precision. The install≠load trap (that bit `did`/`PMCMRplus`/`Rmpfr`) does **not** bite this pass.

| New pkg | In r-wasm repo | Risky deps | WebR install | WebR load | Decision |
|---|---|---|:---:|:---:|---|
| `boot` | yes (1.3-32) | none (recommended pkg) | ✓ | ✓ | **available live** — but a hand-rolled seeded base-R bootstrap is equally exact; see item 2 for the recommendation |
| `heplots` | yes (1.8.1) | `rgl`, `broom`, `purrr`, `tibble` | ✓ | ✓ | **ship-package** for Box's M (`heplots::boxM`); hand-roll verified as a safety net (matches to full precision) |
| `rddensity` | yes (3.0) | `lpdensity`, `ggplot2` | ✓ | ✓ | **ship-package** for McCrary — **no deferral needed** |

> Recommendation to controller: add `heplots` and `rddensity` to the engine preload list (item 10/13). `boot` need not be added — the hand-roll is preferred (see item 2). `modelsummary` is NOT added to WebR — its `datasummary_*` calls are EMITTED in `analysis.R` and run in the student's native R (item 6).

---

## Per-item verification + decisions

### 1. effectsize CIs (preloaded) — all return `CI_low`/`CI_high` and honor `ci=`

**WebR-loadable:** yes (`effectsize` is preloaded). **Chosen method:** live-WebR. Each function returns `CI_low`/`CI_high` and honors a `ci=` argument. Ground truth (native R ≡ WebR; `ci=0.95`):

| effectsize fn | fixture / config | point | 95% CI |
|---|---|---|---|
| `cohens_d(post, mu=70)` | paired.csv `post`, μ₀=70 (one-sample) | 3.2653 | [1.1437, 5.3681] |
| `cohens_d(pre, post, paired=TRUE)` | paired.csv (paired-t dz) | −4.24 | [−6.90, −1.58] |
| `rank_biserial(score ~ group)` | study.csv (MWU) | −1.00 | [−1.00, −1.00] ⚠ |
| `rank_biserial(pre, post, paired=TRUE)` | paired.csv (Wilcoxon) | −1.00 | [−1.00, −1.00] ⚠ |
| `rank_epsilon_squared(outcome ~ group)` | anova.csv (Kruskal-Wallis) | 0.11 | [0.04, 1.00] † |
| `kendalls_w(score_t1,t2,t3)` | anova.csv wide (Friedman) | 0.56 | [0.50, 1.00] † |
| `eta_squared(aov(outcome~group), partial=FALSE)` | anova.csv one-way | 0.09 | [0.00, 1.00] † |
| `omega_squared(aov(outcome~group))` | anova.csv one-way | 0.06 | [0.00, 1.00] † |
| `eta_squared(aov(outcome~group*gender), partial=TRUE)` | anova.csv factorial: group | 0.10 | [0.00, 1.00] † |
| `cohens_w(table(method,passed))` | association.csv (χ² independence sibling) | 0.35 | [0.00, 1.00] † |
| `cramers_v(table(method,passed))` (adj.) | association.csv | 0.27 | [0.00, 1.00] † |
| `cohens_w(table(method))` | association.csv (χ² GoF, equal expected) | 0.15 | [0.00, 1.41] † |

**⚠ Edge case for Task 3 (rank-biserial on study.csv):** the two groups are perfectly separated (every treatment score > every control score), so rank-biserial = −1 with a degenerate CI [−1, −1]. The per-card test should assert the boundary value (`-1`, CI `[-1,-1]`) as ground truth, OR the worker may prefer a non-degenerate fixture for the rank-biserial cards. Either way the value is correct and reproducible — flagged so the test author isn't surprised.

**† One-sided CI note:** effectsize reports variance-explained / χ²-family effect sizes (η², ε², ω², W, w, V) with a one-sided CI — the upper bound is fixed at the parameter max (1.00, or 1.41 for unbounded `cohens_w` GoF). This is by-design APA convention, not a bug. The point estimates equal today's displayed values (the d/r CIs are the only new bidirectional ones). Builders should render exactly what effectsize returns.

### 2. Bootstrap CI for Spearman ρ and Kendall τ — `boot` loads, but hand-roll is preferred

**WebR-loadable:** `boot` installs + loads under WebR (recommended package; it is also bundled in base R). **Chosen method: hand-rolled SEEDED base-R percentile bootstrap** (no new package). Rationale: (a) it is exactly reproducible across WebR ≡ native R with a fixed `set.seed`, (b) it avoids growing the preload, (c) `boot::boot.ci(type="perc")` applies a normal-order-statistic interpolation that makes its endpoints differ slightly from raw `quantile()`, which would complicate the WebR≡R assertion. The hand-roll uses raw `quantile(stats, c(.025,.975))`.

**Seed:** `set.seed(20260617)` · **R = 2000 resamples** · fixture association.csv (`satisfaction`, `motivation`). Ground truth (native R ≡ WebR, identical to the digit):

- Point: Spearman ρ = **0.846840**, Kendall τ = **0.749068**
- **Hand-roll percentile CI (the chosen method):**
  - Spearman ρ 95% CI = **[0.757101, 0.901121]**
  - Kendall τ 95% CI = **[0.663909, 0.822039]**
- For reference, `boot::boot.ci(type="perc")` on the same seed gives ρ CI [0.763871, 0.903113] (slightly different by design — NOT what we assert).

**Test guidance:** assert the hand-roll CI exactly (WebR≡R is bit-identical here); the implementation R must use the identical `set.seed`/`R`/`quantile` recipe. Note these are ordinal correlations on a 1–5 Likert pair, so the bootstrap resamples discrete values — the CI is stable across engines.

### 3. Box's M (MANOVA/MANCOVA) — `heplots::boxM` loads; hand-roll verified as fallback

**WebR-loadable:** `heplots` installs + loads under WebR (its `rgl`/`broom`/`purrr`/`tibble` imports all resolve from the r-wasm repo — no load failure). **Chosen method: ship `heplots::boxM`** (with the base-R χ²-approximation hand-roll verified as a safety net). Fixture anova.csv, `cbind(outcome, outcome2) ~ group`:

- `heplots::boxM` (WebR ≡ native hand-roll): **χ² = 11.4375, df = 6, p = 0.07576**
- Hand-roll (Box's M χ²-approx, base R): M = 12.0482, χ² (Box-corrected) = **11.4375, df = 6, p = 0.07576** — matches `boxM` to full precision.

heplots is NOT in the current preload — controller should add it (item 10). Hand-roll recipe (if the team prefers no new package): pooled within-group covariance, `M = (N−g)·ln|Spooled| − Σ(nᵢ−1)·ln|Sᵢ|`, Box scale factor `u`, `χ² = (1−u)·M`, `df = p(p+1)(g−1)/2`.

### 4. Panel / nonparametric diagnostics — all preloaded/base, all run under WebR

**WebR-loadable:** yes (`vars`, `plm` preloaded; `wilcox.test` base). **Chosen method:** live-WebR throughout. Ground truth (WebR ≡ native R):

| Diagnostic | fixture / config | value |
|---|---|---|
| `vars::serial.test` Portmanteau (asymptotic, `lags.pt=16`) on the auto-selected VAR | timeseries.csv `sales,visitors`; AIC lag = **9** | **χ² = 112.345, df = 28, p = 4.63e-12** |
| `plm::plmtest` BP-LM (RE vs pooled, `type="bp"`) | panel.csv `roa ~ leverage+rd_spend+size` | **χ² = 0.06953, df = 1, p = 0.7920** |
| `plm::ercomp` variance components | same | θ = **0.04205**, σ²_idiosyncratic = **0.25008**, σ²_individual = **0.0028050** (share 0.989 / 0.011) |
| DiD pre-trends signal (base `lm`, pre-period `roa ~ treated*year` vs `treated+year`, joint F) | panel.csv pre-period (post==0 ⇒ years 2017–2020); post starts 2021 | **F(3, 40) = 0.00407, p = 0.99964** (clean parallel pre-trends) |
| Hodges-Lehmann MWU (`wilcox.test(conf.int=TRUE, exact=FALSE)`) | study.csv `score~group` (control, treatment) | HL = **−12.0000**, 95% CI **[−17.0000, −7.0000]** |
| Hodges-Lehmann Wilcoxon paired | paired.csv `pre,post` | HL = **−11.5000**, 95% CI **[−14.5000, −9.99995]** (warns "conf.level not achievable" — n=6) |

Notes: the VAR auto-lag is 9 on this 72-row series (`VARselect` AIC). The DiD pre-trend test uses the pre-period only (post==0); since the panel's `post` flips at 2021, the pre-period leads/lags interaction is jointly non-significant (parallel trends hold) — this is the "pre-trends signal" Task 13 renders. The paired Wilcoxon HL CI throws a benign "requested conf.level not achievable" warning at n=6 — suppress it (`suppressWarnings`) as the runner already does elsewhere.

### 5. RDD McCrary density test — `rddensity` LOADS under WebR → no deferral

**WebR-loadable:** **yes** — `rddensity` (3.0) installs AND loads under WebR (its `lpdensity` + `ggplot2` deps resolve). **Chosen method: ship `rddensity::rddensity`** — the only deferral the plan allowed is NOT taken. Fixture causal.csv `running_var`, cutoff `c=50` (WebR ≡ native confirmed; native lacked the pkg but WebR ran it):

- `rddensity::rddensity(running_var, c=50)$test`: fields `t_asy, t_jk, p_asy, p_jk`.
  - **t_jk (robust, jackknife) = 0.07807, p_jk = 0.93777** → no manipulation/sorting at the cutoff (as expected for a synthetic running variable).
  - Bandwidths h_left = 24.115, h_right = 33.750; N_left = 101, N_right = 99.

**Recommendation:** add `rddensity` to the preload (item 13) and render the jackknife-robust statistic + p (`t_jk`/`p_jk`) per the rddensity convention (Cattaneo–Jansson–Ma), cited per item 18. Note for Task 13: extract from `rd$test$t_jk` / `rd$test$p_jk` (the field names confirmed under WebR).

### 6. datasummary (`modelsummary`) descriptive tables — REPLICATED in TS + EMITTED in analysis.R (verified in NATIVE R)

**Run model:** these are NOT run live in WebR — the format is replicated in the TS builders and the real `datasummary_*()` call is emitted in `analysis.R` (it runs in the student's native R). Verified with `modelsummary` **2.6.0** under native R 4.6.0. All three functions run. **The student needs `modelsummary` installed** (its default table backend is `tinytable`, also bundled; `datasummary_balance`'s difference-in-means column additionally wants `estimatr` — see below).

| function | call (fixture) | output shape (`output="data.frame"`) |
|---|---|---|
| `datasummary_skim` | `datasummary_skim(<numeric cols>)` (summary-statistics, test 01) | rows = one per numeric variable; **columns = `[var] · Unique · Missing Pct. · Mean · SD · Min · Median · Max · Histogram`** (9 cols incl. the variable name). e.g. students numeric → 4×9. |
| `datasummary_crosstab` | `datasummary_crosstab(method ~ passed, assoc)` (frequencies/cross-tabs, test 02; χ² independence sibling) | **stacked N + "% row" layout**: 2 rows per row-level (a `N` row + a `% row` row) plus an `All` block → 8×5 for method(3)×passed(2). Columns = `method · (stat label) · no · yes · All`. |
| `datasummary_balance` | `datasummary_balance(~group, study)` (group "Table 1", test 05 etc.) | one row per variable; **columns = per group `<grp> (N=n) / Mean` and `<grp> (N=n) / Std. Dev.`** → 1×5 for study (`score` by control/treatment, 2 groups × Mean+SD + var-name col). With `dinm=TRUE` (default) it appends a Diff-in-Means + p column but **warns unless `estimatr` is installed** — emit with `dinm=FALSE` OR note the `estimatr` dependency. |

**Completeness-add ground truth (Task 16):**
- **Mean 95% CI (t-based)** for the summary-stats card (students numeric, full-N cols): `id` mean 7.5000 CI [5.0846, 9.9154]; `score` mean 75.6429 CI [71.7033, 79.5824]. (`anxiety`/`satisfaction` have 7 missing in students.csv → compute with `na.rm`; association.csv numeric cols have no missing.)
- **datasummary_skim warning:** `type='all'` is only fully supported on the tinytable backend — emit with an explicit `type="numeric"` to suppress the warning in the student's R.
- **Skew / excess (type-3) kurtosis** via `psych` (preloaded under WebR; also for the emitted script) for the distribution-normality add: e.g. students `score` skew 0.3013, excess kurtosis −1.3337. Relabel the kurtosis header "Kurtosis (excess, type-3)" per the plan.

**Package note for the student / CITATIONS.txt (Task 17):** the emitted `analysis.R` descriptive blocks require `modelsummary` (+ its `tinytable` backend, bundled). `datasummary_balance` with the default difference-in-means column wants `estimatr` — either pin `dinm=FALSE` in the emitter or list `estimatr` as an optional dependency. `psych` is already used elsewhere.

---

## Summary of method decisions (for the controller)

1. **effectsize CIs (item 1):** live-WebR, all 8 fns honor `ci=` and return `CI_low`/`CI_high`. Variance-explained effect sizes carry a one-sided CI (upper bound fixed at the max) — render as-returned. **Edge case:** rank-biserial = −1 / CI [−1,−1] on study.csv (perfect separation) — assert the boundary or pick a non-degenerate fixture for Task 3's rank-biserial cards.
2. **Bootstrap ρ/τ (item 2):** **HAND-ROLLED seeded base-R percentile bootstrap** (not `boot`), `set.seed(20260617)`, R=2000, raw `quantile`. ρ CI [0.757101, 0.901121]; τ CI [0.663909, 0.822039]. (boot loads but its `boot.ci` interpolation differs — hand-roll keeps WebR≡R bit-identical.)
3. **Box's M (item 3):** **ship `heplots::boxM`** (loads under WebR despite rgl/broom deps). χ²=11.4375, df=6, p=0.07576 on anova.csv. Hand-roll verified identical as a fallback. → add `heplots` to preload.
4. **Panel/nonparam diagnostics (item 4):** all live-WebR (vars/plm/base). Portmanteau χ²=112.345 df=28 p≈4.6e-12 (VAR lag 9); plmtest BP χ²=0.06953 p=0.7920 + variance components (θ=0.04205); DiD pre-trend F(3,40)=0.00407 p=0.99964; HL MWU −12 [−17,−7], HL Wilcoxon −11.5 [−14.5, −10.0].
5. **RDD McCrary (item 5):** **NO DEFERRAL** — `rddensity` LOADS under WebR. Ship it; t_jk=0.07807, p_jk=0.93777 on causal.csv running_var c=50. → add `rddensity` to preload.
6. **datasummary (item 6):** native-R-export-only (emitted in analysis.R, replicated in TS builders). `datasummary_skim` (9-col), `datasummary_crosstab` (stacked N/% row), `datasummary_balance` (per-group Mean/SD; needs `estimatr` only for the optional diff-in-means column — emit `dinm=FALSE`). Student needs `modelsummary`.

**Preload additions recommended:** `heplots`, `rddensity` (both load + run under WebR 0.6.0; verified WebR ≡ native R). `boot` NOT needed (hand-roll preferred). `modelsummary` stays native-only (emitted, not live).

**Reproduction:** `/tmp/spike_native.R` + `/tmp/spike_ds.R` (Rscript), `/tmp/spike_webr.mts` (`npx tsx`, imports the real engine).
