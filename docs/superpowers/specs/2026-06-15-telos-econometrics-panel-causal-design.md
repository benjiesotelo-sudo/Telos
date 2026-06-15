# Telos — Econometrics sub-slice 2: Panel + cross-sectional causal (design spec)

**Date:** 2026-06-15 · **Slice:** Econometrics #2 of 2 (owner-ruled split 2026-06-15).
**Scope:** 7 tests — **Fixed effects**, **Random effects**, **Hausman test**, **Difference-in-differences (DiD)**
(panel) · **Instrumental variables (IV / 2SLS)**, **Regression discontinuity (RDD)**,
**Propensity score matching (PSM)** (cross-sectional causal).
Sub-slice 1 (time series: ARIMA/SARIMA, Stationarity, Granger, VAR) is the companion spec
(`2026-06-15-telos-econometrics-timeseries-design.md`) and is already built/green on local `main`.

**Authority:** outputs are the cards already drawn & approved in `telos_test_outputs.html`; inputs in
`telos_test_inputs.html`. All 7 cards are **fully drawn** and present in `catalog.ts` at status `later-slice`.
This spec encodes them into the registry/runners/builders. Where it deviates from the drawn cards it says so
explicitly (report-only APA neutralisation; the econometrics-grade additions of §2.8).

**Spike:** all 7 are WebR-0.6.0 feasible and match native R 4.6.0 to ≥5 sig figs — see
`docs/superpowers/reviews/2026-06-15-econometrics-spike.md` (FE within 0.11012380; RE Swamy–Arora 0.10978115;
Hausman χ²=2.330367, p=0.311865; DiD interaction=5; IV 2SLS 1.9874081; RDD est 1.4383256; PSM matched n=370).
Packages `plm`, `ivreg`, `AER`, `rdrobust`, `MatchIt`, `fixest` install **and load**; the `did` package fails
to load (fastglm → no wasm) and is **not needed** (2×2 DiD is base `lm`). **One gap the spike did NOT cover:
clustered / robust standard errors** — these are *drawn on the cards* (FE/RE/DiD "Clustered SE"; IV "robust"),
so they are required, not optional, and must be cross-checked against native R during the build (§5.0).

**Build mode (2026-06-15):** owner granted overnight autonomy — build to green on local `main`, ratify at the
click-through gate. **NEVER push/deploy.** Surface only expensive-to-reverse forks. **Output bar = FULL
econometrics-grade (owner option 3).** The drawn cards for this family are already close to publication-grade
(they draw first-stage F, Wu–Hausman, Sargan, bandwidth, balance, ATT), so "full econometrics-grade" here is
mostly *faithful implementation + surfacing the drawn diagnostics*, with a short, flagged list of genuine
extras (§2.8).

**Owner's standing reminder (folded into §4):** the testing-data documentation is a first-class deliverable —
`docs/testing/test-config-guide.md` (how each live test is configured + expected output) plus the **new
datasets** promised for this slice (a `panel.csv` and the IV/RDD/PSM column extensions to
`wage1-extended.csv`), all documented and coherent for an **external completeness review this week**, and the
auto `docs/TEST_CATALOG.md` regenerated.

---

## 1. The shared new machinery (backbone)

The genuinely new surface is **panel data** (entity × time long format). Build it once in the serial backbone
before the per-test work. The cross-sectional causal tests (IV/RDD/PSM) reuse existing role kinds and need no
new eligibility machinery beyond their own constraints.

### 1.1 The `entity` role (new RoleConstraint)
- **Used by:** FE, RE, Hausman (each draws roles **Entity · Time · Outcome · Regressors**) and, as the
  cluster unit, DiD.
- **Label:** "Entity" — drawn as `nominal / ordinal · exactly 1` (e.g. firm, country, student id).
- **Eligibility:** a new role form satisfied by a **`nominal`- or `ordinal`-level** column. No `excludeTag`
  needed (it is never numeric-Series). It does **not** require the `id` tag — entity ids are often plain
  nominal strings (`firm01`); `columnMeta` does not emit an `entity` tag and we will not add one (keep it a
  level check). Constraint: `{ id:'entity', levels:['nominal','ordinal'], arity:{min:1,max:1} }`.
- **Time role:** reuse the **existing `time` role** from sub-slice 1 (`timeOrder:true`, datetime-tag-or-ordinal)
  — no change. The panel slice inherits the `excludeTag:'datetime'` guard for the numeric Outcome/Regressor
  roles (already built in sub-slice 1).
- **Runner contract:** the engine builds a `plm::pdata.frame(data, index = c(entity, time))` and fits within /
  random models against it. Rows need not be pre-sorted (plm indexes by the pair).

### 1.2 The `panel` minRule (new MinRule kind)
The existing `values` rule counts numeric values across roles — wrong for panel (entity is nominal). Add a
small, purpose-fit kind:
- **`{ kind:'panel'; n:number }`** — eligible iff there are **≥ 2 distinct entities**, **≥ 2 distinct time
  periods**, and **≥ n complete observations** across (entity, time, outcome, ≥1 regressor). Default `n = 12`.
- This is the minimum for a within estimator to be identified (cross-section + within-entity variation). It is
  a clean expression of the panel requirement rather than overloading `rows-per-group`. **New backbone — flag
  (§6).**
- **DiD / IV / RDD / PSM** are cross-sectional and do **not** use `panel`; their eligibility uses existing
  kinds plus a runtime structural guard (§1.4), detailed per test in §2.

### 1.3 Reused / per-test option kinds (all faithful to drawn cards)
- **`select`** (reused): FE `effects` (`entity` (default) / `time` / `two-way` → plm `effect=`
  `individual`/`time`/`twoways`); FE/RE/DiD `std. errors` (`clustered by entity` (default) / `classical`);
  IV `std. errors` (`robust` (default) / `classical`); PSM `matching method` (`nearest` (default), `optimal`,
  `full` — choices as drawn), PSM `ratio` (`1:1` default …); RDD `polynomial order` (`1` (linear, default) /
  `2`).
- **`number`** (reused): `α` (default 0.05, all 7); RDD `cutoff value` (default 50); PSM `caliper`
  (default off → empty/0 = off).
- **`select` CI** (reused convention): CI level 90 / 95 / 99 (default 95) wherever a CI column / CI sentence is
  drawn (FE, RE, DiD, IV, RDD, PSM). Threaded as `{pct}% CI` (see §3).
- **multi-chip roles** (reused shape, like MANOVA outcomes): FE/RE/Hausman `Regressors` (any level, 1+);
  IV `Endogenous regressor` (1+), `Instrument(s)` (1+), `Controls` (0+); PSM `Covariates` (1+).
- **`weak-instrument test`** (IV) is **on** as drawn and not user-toggleable in v1 (always reported) → render
  as a `display` option, not interactive (flag §6: it is drawn as "on (default)" implying a toggle; we ship it
  always-on because turning the weak-IV check *off* has no defensible use).

### 1.4 Runtime structural guards (graceful errors, never a white screen)
Each runner validates structure and degrades to the per-test error card (the established pattern) with a clear
message rather than crashing:
- **FE/RE/Hausman:** ≥2 entities, ≥2 periods; within model needs at least one regressor with within-entity
  variation (plm drops time-invariant regressors — if *all* drop, error clearly). Hausman: if `phtest`
  returns a non-positive-definite difference (common with clustered/robust vcov), fall back to the classical
  Hausman and note it.
- **DiD:** all four treat×post cells non-empty; both Treatment levels and both Period levels present.
- **IV:** #instruments ≥ #endogenous (order condition); first stage estimable.
- **RDD:** observations on **both** sides of the cutoff; `rdrobust` bandwidth solvable (else widen / report
  its error).
- **PSM:** both treatment groups non-empty and large enough for the requested ratio; if `matchit` cannot
  match, report it.

### 1.5 Engine preload additions
`engine.ts` init loop gains **`plm`, `sandwich`, `ivreg`, `rdrobust`, `MatchIt`** (`lmtest` already preloaded
in sub-slice 1; `sandwich` provides `vcovCL`/`vcovHC` for DiD/IV clustered-robust SEs). Spike-proven to load
(except `sandwich`, which §5.0 confirms). **Flag (§6):** continues the first-run download growth; lazy
per-family loading remains a deferred perf pass.

### 1.6 Spot-validation (lighter regimen)
The panel paradigm (`pdata.frame`, within/random, clustered vcov) is novel machinery → **spot-validate in a
small sandbox** (build a tiny panel, confirm FE/RE/Hausman run end-to-end through the role→runner path and
reproduce the §5.0 spike values). Not a full-plan replay.

---

## 2. Per-test encoding (faithful to the drawn cards)

CI columns/sentences are threaded `{pct}% CI` (default 95). All APA is report-only (§3). Each multi-table card
gets distinct `TableSpec.domId`s (§3).

### 2.1 Fixed effects  (`fixed-effects`)
- **Roles:** Entity (`entity`, ×1) · Time (`time`, ×1) · Outcome (`interval/ratio`, ×1, excl. datetime) ·
  Regressors (`any level`, 1+, excl. datetime).
- **Options:** effects (entity / time / two-way) · std. errors (clustered by entity / classical) · α · CI.
- **Tables:** **T1 Coefficients (within estimator):** Term · B · Clustered SE · t · p · {pct}% CI.
  **T2 Model fit:** Within R² · F · N obs · N entities.
- **Figure:** Coefficients (coefficient plot, estimate ± CI). `figure_coefficients.png`.
- **Note (from card):** time-invariant predictors are absorbed and drop out; little within-entity variation →
  large SEs.
- **R map:** `plm(y ~ x…, data=pdata, model="within", effect=…)`; clustered SE via
  `plm::vcovHC(fit, method="arellano", type="HC1", cluster="group")` → `lmtest::coeftest`/`coefci`.
- **APA (report-only):** "In a fixed-effects (within) model, [predictor] gave B=__, p=__ (clustered SE)."
- **Bundle:** table_coefficients.png · table_model-fit.png · figure_coefficients.png.

### 2.2 Random effects  (`random-effects`)
- **Roles:** Entity · Time · Outcome · Regressors (same as FE).
- **Options:** std. errors (clustered by entity / classical) · α · CI.
- **Tables:** **T1 Coefficients:** Term · B · Clustered SE · t · p · {pct}% CI.
  **T2 Model fit:** R² · Adj. R² · N obs · N entities.
- **Figure:** Coefficients (coefficient plot). `figure_coefficients.png`.
- **Note (from card):** unlike FE, time-invariant predictors are retained; trust RE only if Hausman favours it.
- **R map:** `plm(…, model="random", random.method="swamy-arora")`; clustered SE as FE.
- **APA (report-only):** "In a random-effects model, [predictor] gave B=__, p=__."
- **Bundle:** table_coefficients.png · table_model-fit.png · figure_coefficients.png.

### 2.3 Hausman test  (`hausman-test`)
- **Roles:** Entity · Time · Outcome · Regressors (same as FE/RE — one panel setup, both models fit).
- **Options:** α.
- **Tables:** **T1 Hausman test:** χ² · df · p · Decision. **T2 FE vs. RE coefficients:** Term · FE B · RE B ·
  Difference.
- **Figure:** FE vs. RE (side-by-side coefficient plot). `figure_coefficients.png`.
- **Decision column (§3):** computed from actual p vs α — `p < α → "FE"`, else `"RE"`. Reports the test's own
  decision (the literal `phtest` output), not a substantive verdict; borderline vs report-only (flag §6,
  same posture as sub-slice 1's stationarity Conclusion column).
- **R map:** `plm::phtest(fe_fit, re_fit)` → T1; align `coef(fe)` vs `coef(re)` → T2.
- **APA (report-only — NEUTRALISED):** the drawn template says *"A Hausman test favoured fixed effects,
  χ²(__)=__, p=__"* which **hardcodes a verdict**. Neutralise to: **"A Hausman test comparing the fixed- and
  random-effects estimates gave χ²(__)=__, p=__."** Mirror in `telos_test_outputs.html`. **Flag (§6).**
- **Bundle:** table_hausman.png · table_fe-vs-re.png · figure_coefficients.png.

### 2.4 Difference-in-differences  (`did`)
- **Roles:** Outcome (`interval/ratio`, ×1) · Treatment group (`nominal`, ×1, exactly 2 categories) ·
  Period pre/post (`nominal`, ×1, exactly 2 categories) · Entity/cluster (`entity`, ×1) ·
  Time for the trends plot (`time`, ×1).
- **Options:** std. errors (clustered / classical) · α · CI. (Card also draws `covariates: none` — v1 ships
  no covariate slot; flag §6.)
- **Table:** **DiD model:** Term · B · Clustered SE · t · p · {pct}% CI. (Rows: Treated, Post, Treated×Post.)
- **Figure:** Parallel trends (group means over time, treatment onset marked). `figure_parallel-trends.png`.
- **Eligibility:** complete rows ≥ n over (outcome, treatment, period); the 2×2 structural guard (§1.4) does
  the rest.
- **Note (from card):** the Treated×Post coefficient is the DiD effect *only under parallel trends*; the plot
  is supportive, not confirmatory.
- **R map:** `lm(y ~ treated * post)`; clustered SE by entity via `sandwich::vcovCL(fit, cluster=~entity)` →
  `coeftest`/`coefci`. (Base `lm` — the `did` package is not loadable and not needed.)
- **APA (report-only):** "The DiD estimate (Treated×Post) was B=__, {pct}% CI [__, __], p=__ (clustered SE)."
- **Bundle:** table_did.png · figure_parallel-trends.png.

### 2.5 Instrumental variables / 2SLS  (`iv-2sls`)
- **Roles:** Outcome (`interval/ratio`, ×1) · Endogenous regressor (`any`, 1+) · Instrument(s) (`any`, 1+) ·
  Controls (`any`, 0+).
- **Options:** std. errors (robust / classical) · weak-instrument test (display, always on) · α · CI.
- **Tables:** **T1 First stage (instrument strength):** Instrument · Coef. · SE · Partial F · p.
  **T2 2SLS coefficients:** Term · B · SE · t · p · {pct}% CI.
- **Figure:** Coefficients (OLS vs. 2SLS coefficient plot). `figure_coefficients.png`.
- **Eligibility:** complete rows ≥ n over the used columns; #instruments ≥ #endogenous guard (§1.4).
- **Note (from card):** read first-stage F first (rule of thumb > 10); the causal reading rests on the
  exclusion restriction (a theory assumption); Sargan checks over-identification only, unavailable when
  just-identified.
- **R map:** first stage `lm(endog ~ instruments + controls)` → T1 (coef/SE + partial F);
  `summary(ivreg::ivreg(y ~ endog + controls | instruments + controls), diagnostics=TRUE)` → T2 + weak-IV F,
  Wu–Hausman, Sargan (rendered as a diagnostics `tableNote`). Robust SE via `sandwich::vcovHC`.
- **APA (report-only — softened):** drawn *"Using 2SLS, X had an effect of B=__, p=__ (first-stage F=__)"* →
  **"The 2SLS estimate for [endogenous] was B=__, p=__ (first-stage F=__)."** Mirror in HTML. **Flag (§6).**
- **Bundle:** table_first-stage.png · table_2sls.png · figure_coefficients.png.

### 2.6 Regression discontinuity  (`rdd`)
- **Roles:** Outcome (`interval/ratio`, ×1) · Running variable (`interval/ratio`, ×1).
- **Options:** cutoff value (number, default 50) · bandwidth (display "auto" — rdrobust MSE-optimal; flag §6) ·
  polynomial order (1 (default) / 2) · α · CI.
- **Table:** **RD estimate:** Bandwidth · Estimate · SE · z · p · {pct}% CI · N (left/right).
- **Figure:** RD plot (binned scatter + fitted lines either side of the cutoff). `figure_rd-plot.png`.
- **Eligibility:** ≥ n values on outcome + running variable; both-sides-of-cutoff guard (§1.4).
- **Note (from card):** the jump is causal only if subjects cannot sort across the cutoff and nothing else
  changes there; check a density (McCrary) test and covariate/placebo balance. (v1 reports the estimate +
  plot; McCrary/placebo are §2.8 candidates — flag.)
- **R map:** `rdrobust::rdrobust(y, x, c=cutoff, p=order, level=ci)` → table (conventional + robust rows);
  `rdrobust::rdplot(y, x, c=cutoff)` → figure.
- **APA (report-only):** "At the cutoff, the RD estimate was __, {pct}% CI [__, __], p=__."
- **Bundle:** table_rd-estimate.png · figure_rd-plot.png.

### 2.7 Propensity score matching  (`propensity-score-matching`)
- **Roles:** Outcome (`interval/ratio`, ×1) · Treatment (`nominal`, ×1, exactly 2 categories) ·
  Covariates (`any`, 1+).
- **Options:** matching method (nearest (default) / optimal / full) · caliper (number, default off) ·
  ratio (`1:1` (default) / `2:1` / `3:1`) · α · CI.
- **Tables:** **T1 Covariate balance (before / after):** Covariate · Std. mean diff (pre) · Std. mean diff
  (post) · Variance ratio. **T2 Treatment effect (ATT):** Estimate · SE · t · p · {pct}% CI.
- **Figure:** Balance (love plot): standardized differences before vs. after matching. `figure_love-plot.png`.
- **Eligibility:** both treatment groups present & ≥ n each (§1.4).
- **Note (from card):** confirm balance first (small SMDs), then read ATT; PSM only balances *measured*
  covariates (ignorability cannot be verified from data).
- **R map:** `MatchIt::matchit(treat ~ covariates, method=…, ratio=…, caliper=…)` → T1 balance +
  matched data; `lm(y ~ treat, data=matched, weights=weights)` → T2 ATT (SE/t/p/CI). Love plot: if `cobalt`
  is not WebR-loadable, **hand-roll** the love plot from the balance table via `ggplot2` (the established
  hand-roll-when-package-absent pattern; §5.0 confirms cobalt). **Flag (§6).**
- **APA (report-only — NEUTRALISED):** drawn *"After matching (all SMDs < .1), the ATT was __, …"* **hardcodes
  a balance verdict that may be false**. Neutralise to: **"After propensity-score matching, the ATT was __,
  {pct}% CI [__, __], p=__."** (Balance is reported in T1.) Mirror in HTML. **Flag (§6).**
- **Bundle:** table_balance.png · table_att.png · figure_love-plot.png.

### 2.8 Econometrics-grade additions beyond the drawn cards (owner option 3) — minimal & flagged
The drawn cards already carry the core diagnostics, so the genuine extras are few. Build only those that are
standard, high-value, and WebR-verifiable; flag each prominently. **Build:**
- **IV diagnostics surfaced** — render the drawn weak-IV F, **Wu–Hausman endogeneity**, and **Sargan
  over-identification** (when over-identified) as a diagnostics `tableNote` under T2. (These are in the card's
  R-map already; surfacing them is faithful, not beyond — included here for visibility.)
- **FE poolability** — an F-test for individual effects (`plm::pFtest(within, pooling)`) as a `tableNote` on
  FE (standard "are fixed effects warranted?" diagnostic).
**Defer (flag as OPEN, not built unless §5.0 proves trivially WebR-verifiable):**
- **DiD formal pre-trend test** — the card deliberately frames parallel-trends as visual/"not confirmatory";
  a formal test risks over-claiming. Leave as drawn (plot only) unless owner wants it.
- **RDD McCrary density + covariate/placebo checks** — `rddensity`/extra packages not spiked; surfacing these
  unverified would be worse than omitting. Flag as the highest-value RDD extra if owner raises the bar.

---

## 3. Conventions & rulings

1. **Report-only APA applies to all 7.** Two cards hardcode verdicts and are **neutralised** (Hausman
   "favoured fixed effects" → factual; PSM "all SMDs < .1" → dropped); IV "had an effect" is softened. These
   edit the **spec-HTML APA templates** (registry + `telos_test_outputs.html` mirror) in lockstep, exactly as
   the audit-fix slice and sub-slice 1 did. **No card-structure HTML changes** — the §2.8 additions live in
   the registry with consistency tests accommodating; structural HTML sync of §2.8 is deferred to owner review
   (cards are his design canvas). **Flag (§6).**
2. **Clustered / robust SEs are drawn and required** (FE/RE/DiD clustered-by-entity; IV robust). Exact recipes
   (`plm::vcovHC` Arellano; `sandwich::vcovCL`/`vcovHC`) are **cross-checked against native R in §5.0** before
   the per-test build — the treacherous bit reserved for verification under the lighter regimen.
3. **Adjustable α + CI level** (defaults 0.05 / 95%) on all 7, per the standing convention. CI threaded as
   `{pct}% CI` in table headers + APA; clustered/robust CIs computed at the chosen level
   (`coefci(level=)`, `rdrobust(level=)`, ATT `confint(level=)`). **Tails are not applicable** to these
   estimators (no one/two-sided concept) — no tails option.
4. **α is a reference/decision input** (drives the Hausman Decision column + the how-to-read α line); it does
   not, under report-only, declare a verdict on the user's data.
5. **Hausman Decision + RDD nothing-hardcoded:** computed from actual values, never literals.
6. **"How to read" text = the card's prose verbatim** (the report-only teaching layer).
7. Numbers follow house formatting (`fp`/`fpApa`/`f01`/`f`); sentence p-values use the spaced report-only
   form; bounded p shown as `< .001` etc.
8. **`decode()` entity re-scan:** σ/τ/χ/² already mapped (sub-slice 1 + association). Re-scan all 7 cards for
   any unmapped HTML entity (≥, ≤, Λ, etc.) while building and extend `decode()` — the recurring
   card-consistency gotcha. (PSM "Std. mean diff", "ATT", "SMD" are plain ASCII.)
9. **Distinct `TableSpec.domId`** on every multi-table card (FE, RE, Hausman, IV, PSM = 2 tables each) so
   exported table PNGs don't collide on a combined results page (the proven seam). Zip filenames keep the
   card-faithful `table_*.png` names under each test's `NN_<id>/` folder.
10. **Figure → PNG files:** FE/RE/Hausman/IV `figure_coefficients.png`; DiD `figure_parallel-trends.png`;
    RDD `figure_rd-plot.png`; PSM `figure_love-plot.png`. All render through the existing `capturePlot` device
    (rdplot uses base graphics; love plot via ggplot2).

---

## 4. Data fixtures + testing guide  (owner's external-completeness deliverable)

This section is a **first-class deliverable**, not an afterthought — the owner is having the testing-data
documentation assessed for completeness this week.

### 4.1 New fixtures (deterministic, committed)
- **`tests/e2e/fixtures/panel.csv`** — a balanced **long-format panel**: ~12 entities × ~8 periods (~96 rows).
  Columns: `firm` (entity, `firm01`…`firm12`), `year` (period, 2017…2024 — set ordinal), `roa` (outcome),
  `leverage` · `rd_spend` · `size` (regressors, with genuine within-firm variation), `treated` (binary; half
  the firms) and `post` (binary; `year ≥ 2021`) for DiD. Built deterministically (seeded, no `Math.random`).
  *Why a separate file:* panel econometrics requires entity×period **long** data; the cross-sectional
  `wage1-extended.csv` cannot represent it. This is documented for the reviewer.
- **`tests/e2e/fixtures/causal.csv`** — a clean cross-section (~200 rows) purpose-built so each causal method
  has a clear, non-degenerate target (separate outcomes per method — columns are cheap, clarity is not):
  - **IV:** outcome `wage` ← `educ` + an *unobserved* ability term; instrument `educ_iv` (drives `educ`,
    excluded from the wage equation) → 2SLS on `educ` recovers its structural coefficient.
  - **RDD:** outcome `score` = a smooth function of `running_var` (0–100) **plus a genuine jump at cutoff 50**.
  - **PSM:** binary treatment `enroll` assigned by a propensity logistic on covariates `exper`/`age`/`ability`
    (selection), with a known ATT on outcome `health`.
  - Shared covariates `exper`, `age`, `ability`. Deterministic builder (the `wage1-extended` integer-hash idiom).
- Expected statistics for both fixtures are **recomputed in native R 4.6.0** during the build and embedded in
  the unit tests (we do not reuse the spike's dataset values — these are new fixtures).

### 4.2 Shared testing dataset (`docs/testing/`) — the owner's coherence requirement
- **`wage1-extended.csv` is UNCHANGED** — it already drives the 29 live tests. The sub-slice-2 tests use the
  two new datasets above; these **are** "the other data" promised. (Refined from an earlier draft that proposed
  adding causal columns to `wage1-extended`: a clean purpose-built `causal.csv` demonstrates IV/RDD/PSM far
  more clearly than synthetic columns bolted onto real wage data, and avoids corrupting the wage outcome the 29
  existing tests rely on. **Flag §6.**)
- **Copy `panel.csv` + `causal.csv`** into `docs/testing/` (and `~/Documents/`) alongside `wage1-extended.csv`,
  as the shared sub-slice-2 datasets.
- **Update `docs/testing/test-config-guide.md`** — replace the "Coming with sub-slice 2" stub with: a
  **Panel-data fixture** section (entity/period semantics, long-format example), 4 panel-test sections
  (FE/RE/Hausman/DiD: question + exact roles/options + expected output), a **Causal-inference fixture**
  section (the wage1-extended extensions: instrument validity, running-variable discontinuity, treatment
  assignment), and 3 causal-test sections (IV/RDD/PSM). Each section mirrors the existing format (Question /
  Roles / Options / Expect) and is verified against `eligibility.ts` so the configurations are actually
  selectable.
- **Regenerate `docs/TEST_CATALOG.md`** via `scripts/gen-test-tree.ts` (`npx tsx`) once the 7 catalog leaves
  flip to `available`, so the committed auto-tree shows all **40 live tests** for the reviewer.

---

## 5. Process (lighter regimen, per ROADMAP)

**5.0 Verification spike FIRST (the treacherous bits).** Before per-test work, a focused WebR-in-node spike
(after the running final gate frees the machine) that, on `panel.csv` + `causal.csv`, cross-checks against
native R 4.6.0: `plm` within/random + **clustered `vcovHC` Arellano SEs & CIs**; `phtest`; DiD `lm` +
**`sandwich::vcovCL`**; `ivreg` + diagnostics + **robust SE**; `rdrobust` (auto bandwidth) + `rdplot`;
`MatchIt` balance + ATT; and whether `sandwich` and `cobalt` load (cobalt → decide hand-roll love plot).
Commit ground truth under `docs/superpowers/reviews/`.

1. **Backbone (serial, on main):** the `entity` role + the `panel` minRule + the runtime guards scaffold;
   engine preload additions; `panel.csv` + `causal.csv` fixtures + the `build-wage1-extended.mjs` extension.
   Spot-validate the panel paradigm (§1.6). Keep the existing e2e green.
2. **7 tests in parallel worktrees** (one per test; each touches only its own new registry/stats/builder files
   + tests; mutation-checked card-consistency tests; §5.0 values reproduced). Panel tests (FE/RE/Hausman)
   share the entity backbone built in step 1.
3. **Serial integration** — register catalog/builders, flip the 7 catalog leaves to `available`, run the full
   suite gate once.
4. **e2e journeys** — a **panel journey** on `panel.csv` (FE → Hausman → DiD) and a **causal journey** on
   `causal.csv` (IV → RDD → PSM): configure roles, run, check tables/figures, zip filenames.
5. **Combined slice-end review** (one opus pass over the whole diff; independent native-R recomputation +
   UI spot-check) — no per-task reviews.
6. **Docs:** regenerate `TEST_CATALOG.md`; finish the test-config guide; copy datasets to `~/Documents`.
7. **Gates ×2 + fresh clone**, screenshots, then **the owner's click-through gate**. Assemble the ratify list;
   **PushNotification** when done or blocked. **Never push/deploy without his word.**

---

## 6. Decisions taken under autonomy (2026-06-15) — for ratification

Owner granted autonomy ("work autonomously, I'll ratify"). Calls being made (all consistent with prior rulings
/ the approved cards), to ratify at the click-through gate:

- **(a) Report-only APA neutralisation — DECIDED.** Hausman "favoured fixed effects" → factual; PSM "all SMDs
  < .1" → dropped; IV "had an effect" → softened. Registry + `telos_test_outputs.html` mirror. The only
  spec-HTML change (no card-structure edits).
- **(b) `entity` role + `panel` minRule — DECIDED (new backbone):** nominal/ordinal entity, ≥2 entities & ≥2
  periods & ≥12 complete obs. Surfacing as a new MinRule kind rather than overloading `rows-per-group`.
- **(c) Clustered/robust SEs — DECIDED:** drawn ⇒ built (`plm::vcovHC` Arellano; `sandwich::vcovCL`/`vcovHC`),
  cross-checked vs native R in §5.0.
- **(d) Adjustable α + CI (defaults 0.05/95%), no tails — DECIDED** (tails N/A for these estimators).
- **(e) Hausman Decision column — DECIDED: keep**, computed from actual p vs α (borderline vs report-only, as
  with sub-slice 1's stationarity Conclusion column).
- **(f) DiD via base `lm`** (the `did` package is not WebR-loadable and not needed for 2×2); **no covariate
  slot in v1** (card draws "covariates: none").
- **(g) IV via `ivreg`** (lighter than AER; both load); weak-instrument test shipped always-on (display).
- **(h) RDD `cutoff` interactive (default 50); bandwidth = rdrobust auto (display); polynomial 1/2.**
- **(i) Preload growth — ACCEPT** (`plm`, `sandwich`, `ivreg`, `rdrobust`, `MatchIt`).
- **(j) §2.8 econometrics-grade additions — BUILD:** IV diagnostics surfaced (Wu–Hausman, Sargan) + FE
  poolability F. **DEFER (flag):** DiD formal pre-trend test (card frames as visual-only); RDD McCrary /
  placebo balance (packages unspiked).
- **(k) PSM love plot:** hand-rolled via ggplot2 if `cobalt` is not WebR-loadable (§5.0 decides).
- **(l) Fixtures & shared dataset — DECIDED:** two new committed, native-R-verified fixtures `panel.csv` +
  `causal.csv` (clean, purpose-built); **`wage1-extended.csv` left UNCHANGED** (a clean causal.csv beats
  bolting synthetic columns onto real wage data, and protects the 29 live tests' outcome); guide +
  `TEST_CATALOG.md` updated; both new datasets copied to `~/Documents`. (Owner's external-completeness
  deliverable — the document covers wage1-extended for the 29 + panel.csv/causal.csv for the 7.)

**Open forks surfaced (owner's call, not resolved):** whether to add the DiD formal pre-trend test and the RDD
McCrary/placebo diagnostics (the only places the drawn cards stop short of the very fullest econometrics-grade
bar); whether the IV `weak-instrument test` and RDD `bandwidth` should become interactive rather than
display-only. None block the build; all are cheap to add later.
