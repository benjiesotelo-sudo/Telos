# Reporting-completeness (APA-7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all 40 live tests into conformance with the owner-approved citable standard (APA-7 + cited method/package references + computational provenance) without changing any correct, native-R-verified statistic — surfacing effect-size CIs, uniform assumption reporting, the expected econometrics diagnostics, per-test/descriptive completeness, and a `CITATIONS.txt`.

**Architecture:** No new infrastructure — extend the existing `stats → registry → builder` pipeline. Per change: the `src/lib/stats/<id>.ts` runner returns the (often already-computed) value, the `src/lib/registry/<id>.ts` table/apaTemplate/note/howToRead is updated, the `src/lib/results/build<Id>.ts` renders it, the consistency test is updated, the spec-HTML card is mirrored, and the value is cross-checked **WebR ≡ native R 4.6.0**. Phased by theme (1→4) + provenance + a single gate story. Worked-reference-then-fanout per theme (the proven econometrics/ms-format execution shape): one card built fully, the rest follow the same diff via parallel worktrees, one integration + gate.

**Tech Stack:** React/TS + Zustand; WebR 0.6.0 (R 4.6.0) via `src/lib/webr/engine.ts` (`runJson`/`capturePlot`); `effectsize`, `car`, `afex`, `emmeans`, `plm`, `vars`, `tseries`, `MatchIt`, `rdrobust` (all preloaded); vitest + Playwright; tectonic for the LaTeX gate.

**Spec:** `docs/superpowers/specs/2026-06-17-reporting-completeness-apa7-design.md`. **Per-test gap detail:** `docs/superpowers/reviews/2026-06-17-reporting-completeness-review.md`.

**Authority/faithfulness:** report-only neutral APA-7 preserved; the ratified no-visible-coefficient-*p* policy in the modelsummary tables is UNCHANGED. Build to green on local `main`; **NEVER push/deploy** — stop at the owner click-through with a ratify list.

---

## Established patterns (read once before any task)

**Worked reference — effect-size CI (Theme 1), from `oneSampleTTest.ts` + `buildOneSampleTTest.ts`:**
- Stats today: `d <- effectsize::cohens_d(x, mu = mu0)` → returns `cohensD = d$Cohens_d`. `effectsize` ALSO returns `d$CI_low` / `d$CI_high` (and honors a `ci=` arg). The result interface is `OneSampleTTestResult`.
- Builder today renders the d cell as `d: f(r.cohensD)`; the mean-difference CI cell is `ci: \`[${f(r.ci[0])}, ${f(r.ci[1])}]\``.
- Coef tables already show a bracketed CI line via `{ _kind:'ci', est: \`[${f(x.ciLow)}, ${f(x.ciHigh)}]\` }` (`buildSimpleLinearRegression.ts`).

**Stats verification pattern:** each `src/lib/stats/<id>.test.ts` loads a fixture via `loadCsvFixture`, runs the runner under WebR (`engine.init()` in `beforeAll`), and asserts against native-R ground truth. New/changed values MUST get an assertion with the native-R value.

**Consistency-test pattern:** `src/lib/registry/<id>.consistency.test.ts` matches registry strings VERBATIM to the drawn HTML card (`telos_test_outputs.html`). Any new column header / note / apaTemplate string must be mirrored in the HTML card and the consistency test kept green (mutation-checked).

**Display helpers** (`src/lib/format/apa.ts`): `f` (2dp + U+2212 minus), `fp` (APA p), `fdf`, `fx` (NA→em-dash), `minus`. Effect-size CIs render as `\`${f(value)} [${f(lo)}, ${f(hi)}]\`` in the value's own cell (matching Pearson r), OR a dedicated `[CI]` line for stacked coef tables.

---

## Task 1: Verification spike — novel machinery + WebR feasibility

**Files:** Create `docs/superpowers/reviews/2026-06-17-reporting-completeness-spike.md` (no src changes).

- [ ] **Step 1:** In native R 4.6.0 AND under WebR (`engine.ts` preload), confirm shape + a ground-truth value for each NOVEL computation, and record it in the spike doc:
  - `effectsize::cohens_d(x, mu=, ci=level)` / `rank_biserial` / `rank_epsilon_squared` / `kendalls_w` / `eta_squared(partial=)` / `omega_squared` / `cohens_w` / `cramers_v` → confirm each returns `CI_low`/`CI_high` and honors `ci=`.
  - Bootstrap CI for Spearman ρ and Kendall τ — pick the method (percentile via `boot`, or a hand-rolled seeded resample if `boot` is not WebR-loadable); record a seeded ground-truth ρ-CI/τ-CI on `association.csv`.
  - Box's M — `heplots::boxM` if WebR-loadable, else hand-roll the χ²-approx; record value on `anova.csv` cbind(outcome,outcome2) ~ group.
  - `vars::serial.test` (Portmanteau) on the `var.test` Canada fit; `plm::plmtest` (BP-LM) + variance components on the panel fit; `plm` pre-trends leads/lags signal; Hodges-Lehmann via `wilcox.test(conf.int=TRUE)$estimate` for MWU + Wilcoxon.
  - **RDD McCrary:** test whether `rddensity` loads under WebR. If NOT, record the decision: hand-roll a McCrary-style density test, or DEFER it with a how-to-read note (the only deferral allowed).
- [ ] **Step 2:** Record every confirmed value + the chosen method per item + any defer. **Step 3:** Commit the spike doc.

*Gate for the rest of the plan: only build what this spike confirmed runs under WebR.*

---

## Phase 1 — Theme 1: Effect-size confidence intervals

### Task 2: Worked reference — one-sample-t Cohen's d CI

**Files:** Modify `src/lib/stats/oneSampleTTest.ts`, `src/lib/registry/oneSampleTTest.ts`, `src/lib/results/buildOneSampleTTest.ts`; Test `src/lib/stats/oneSampleTTest.test.ts`, `src/lib/registry/oneSampleTTest.consistency.test.ts`; mirror `telos_test_outputs.html`.

- [ ] **Step 1 (failing stats test):** in `oneSampleTTest.test.ts` assert `r.cohensDLow`/`r.cohensDHigh` ≈ the native-R `effectsize::cohens_d(post, mu=70, ci=0.95)` `CI_low`/`CI_high` from the spike (paired.csv `post`).
- [ ] **Step 2:** run, fails (fields undefined). **Step 3 (implement):** in the R map change `d <- effectsize::cohens_d(x, mu = mu0, ci = level)` and add `cohensDLow = d$CI_low, cohensDHigh = d$CI_high` to the returned list + `RawStats` + `OneSampleTTestResult`.
- [ ] **Step 4:** stats test passes (WebR).
- [ ] **Step 5 (render):** in `buildOneSampleTTest.ts` change the d cell to `d: \`${f(r.cohensD)} [${f(r.cohensDLow)}, ${f(r.cohensDHigh)}]\`` and update the table-2 `d` column header in the registry to `Cohen's d [{pct}% CI]` (thread `pct` like the existing `ciLabel`). Append the d CI to the apaTemplate (`d={d} [{dlo}, {dhi}]`).
- [ ] **Step 6:** mirror the new header + apaTemplate string in the `telos_test_outputs.html` one-sample card; update `oneSampleTTest.consistency.test.ts`; run it green (mutation-check).
- [ ] **Step 7:** `npx vitest run` the three test files green; **commit**.

### Task 3: Fan-out — effect-size CIs on the remaining cards

**Files (per card):** `src/lib/stats/<id>.ts` + `registry/<id>.ts` + `results/build<Id>.ts` + `<id>.test.ts` + `<id>.consistency.test.ts` + the HTML card. Parallel worktrees, one card each, same diff as Task 2.

- [ ] For each, extend the runner to return `<es>Low`/`<es>High` from the effectsize object (pass `ci = level`), render `value [lo, hi]`, mirror the header/apaTemplate, update the consistency test, and assert the CI vs native-R:

| id | effect size | effectsize fn |
|---|---|---|
| paired-t-test | Cohen's dz | `cohens_d(paired=TRUE, ci=)` |
| mann-whitney-u | rank-biserial r | `rank_biserial(ci=)` |
| wilcoxon-signed-rank | rank-biserial r | `rank_biserial(paired=TRUE, ci=)` |
| kruskal-wallis | ε² | `rank_epsilon_squared(ci=)` |
| friedman | Kendall's W | `kendalls_w(ci=)` |
| one-way-anova | η² | `eta_squared(partial=FALSE, ci=)` |
| factorial-anova | partial η² | `eta_squared(partial=TRUE, ci=)` |
| repeated-measures-anova | partial η² | from afex/`eta_squared(ci=)` |
| mixed-anova | partial η² | `eta_squared(ci=)` |
| nested-anova | ω² | `omega_squared(ci=)` |
| ancova | partial η² | `eta_squared(partial=TRUE, ci=)` |
| manova / mancova | per-DV partial η² | `eta_squared(ci=)` per follow-up |
| chi-square-goodness-of-fit | Cohen's w | `cohens_w(ci=)` |

- [ ] Each card: stats test asserts the CI vs native-R; consistency test green. **Commit per card** (or per small group).

### Task 4: Bootstrap CI for Spearman ρ and Kendall τ

**Files:** Modify `src/lib/stats/spearman.ts`, `kendallsTau.ts` + registries + builders; Test both `*.test.ts` + consistency tests; HTML cards.

- [ ] **Step 1 (failing test):** assert `r.rhoLow`/`r.rhoHigh` (and τ) ≈ the spike's seeded bootstrap CI on `association.csv` (satisfaction, motivation).
- [ ] **Step 3 (implement):** add the spike-chosen bootstrap (seeded) to each R map returning `*Low`/`*High`; render `ρ [lo, hi]` (replace the current "no CI" note with the CI); same for τ. Mirror header/apaTemplate; update consistency tests.
- [ ] **Step 4–5:** WebR tests green; **commit**.

### Task 5: Independent-t — re-implement Cohen's d via effectsize (CI + correct standardizer)

**Files:** Modify `src/lib/stats/independentTTest.ts` + registry + builder; Test `independentTTest.test.ts` + consistency.

- [ ] **Step 1 (failing test):** assert the new `cohensD`/`cohensDLow`/`cohensDHigh` ≈ native-R `effectsize::cohens_d(score ~ group, ci=, pooled_sd = <equalVariance>)` on `study.csv` (Welch default → non-pooled/Hedges per spike).
- [ ] **Step 3:** replace the hand-rolled pooled d with `effectsize::cohens_d(...)`, threading the standardizer to match the equal-variance toggle (pooled when equal-variance on; Hedges/non-pooled when Welch). Render `d [lo, hi]`. The point estimate must still match the prior pooled value when equal-variance=on (assert both).
- [ ] **Step 4–5:** green; **commit**.

### Task 6: Cramér's V CI (χ² independence)

**Files:** Modify `src/lib/stats/chiSquareIndependence.ts` + registry + builder; Test + consistency.

- [ ] **Step 1 (failing test):** assert `cramersVLow`/`High` ≈ native-R `effectsize::cramers_v(tab, ci=)`; the V point estimate stays identical to today's value.
- [ ] **Step 3:** compute V (and its CI) via `effectsize::cramers_v` on the (continuity-consistent) table; render `V [lo, hi]`. **Step 4–5:** green; **commit**.

---

## Phase 2 — Theme 2: Assumption reporting (Standard set)

### Task 7: paired-t — compute + show Shapiro on the differences
**Files:** `src/lib/stats/pairedTTest.ts` + registry + `buildPairedTTest.ts` + tests.
- [ ] **Step 1 (failing test):** assert `r.shapiro.{W,p}` ≈ native-R `shapiro.test(pre - post)` on `paired.csv`.
- [ ] **Step 3:** add `sw <- if (n>=3 && n<=5000) shapiro.test(a - b) else NULL` to the R map; return `shapiro`; replace the static `tableNote` with the computed assume-note (mirror one-sample's `note:{kind:'assume', text:...}`). Update registry note + consistency + HTML. **Step 4–5:** green; **commit**.

### Task 8: mixed-ANOVA — render the already-computed between-groups Levene
**Files:** `src/lib/results/buildMixedAnova.ts` + registry + consistency (+ stats only if the value isn't already on the result).
- [ ] **Step 1:** confirm `MixedAnovaResult.levene{F,p}` is populated (it is). **Step 3:** render it in the assume-note (`Levene F=…, p=…`) like one-way/factorial; add the note string to the registry + HTML; update consistency. **Step 4–5:** green; **commit**.

### Task 9: independent-t & Welch — within-group normality (Shapiro per group)
**Files:** `src/lib/stats/{independentTTest,welchAnova}.ts` + registries + builders + tests.
- [ ] **Step 1 (failing test):** assert per-group `shapiro` ≈ native-R `shapiro.test` within each group. **Step 3:** add per-group Shapiro to the R map; thread into the assume-note alongside Levene (independent-t) / as a new note (Welch). **Step 4–5:** green; **commit**.

### Task 10: MANOVA / MANCOVA — Box's M
**Files:** `src/lib/stats/{manova,mancova}.ts` + registries + builders + tests.
- [ ] **Step 1 (failing test):** assert Box's M χ²/df/p ≈ the spike value. **Step 3:** add the spike-chosen Box's M (package or hand-rolled) to the R map; render as an assume-note + cite the method per the standard. **Step 4–5:** green; **commit**.

### Task 11: nested-ANOVA — descriptives table + Levene + Shapiro
**Files:** `src/lib/stats/nestedAnova.ts` + registry (add a descriptives table spec) + `buildNestedAnova.ts` + tests + HTML.
- [ ] **Step 1 (failing test):** assert per-group N/M/SD + Levene + Shapiro vs native-R. **Step 3:** add a descriptives table (per top-level group N/M/SD) + an assume-note (Levene + Shapiro) to the R map/registry/builder; mirror the new table + note in the HTML card; update consistency. **Step 4–5:** green; **commit**.

---

## Phase 3 — Theme 3: Econometrics diagnostics

### Task 12: Cheap fixes / near-correctness
**Files:** `src/lib/stats/arimaSarima.ts` (+ registry), `src/lib/registry/rdd.ts` + `buildRdd.ts`, `src/lib/registry/stationarityTests.ts`, `src/lib/registry/grangerCausality.ts`; tests + consistency + HTML where strings change.
- [ ] **ARIMA Ljung-Box:** change `Box.test(resid, type="Ljung-Box")` → `Box.test(resid, lag = max(10, 2*period), fitdf = p+q+P+Q, type="Ljung-Box")`; report Q, lag, df + p. Stats test asserts the new Q/df vs native-R. 
- [ ] **RDD labels:** surface bandwidth selector (`mserd`), kernel (`triangular`), and the cutoff value in the GOF footer/note (values already in the `rdrobust` object). 
- [ ] **Stationarity APA:** add the Phillips-Perron result to the apaTemplate (it's in the table). 
- [ ] **Granger:** fix the lag-default copy in how-to-read; add an AIC/BIC `VARselect` lag-selection note.
- [ ] Update consistency tests + HTML for changed strings; **commit** per fix.

### Task 13: Key diagnostics (new computation; per the spike)
**Files:** `src/lib/stats/{var,propensityScoreMatching,rdd,did}.ts` + registries + builders + tests.
- [ ] **VAR:** add `vars::serial.test` (Portmanteau) → render an assume-note (stat, df, p). Assert vs native-R.
- [ ] **PSM:** add a common-support/overlap diagnostic (count of unmatched/discarded treated units + a PS-overlap summary from `MatchIt`) → render a row/note. Assert vs native-R.
- [ ] **RDD:** add the McCrary density test per the spike (rddensity or hand-rolled) → render stat + p; if deferred, add the how-to-read note instead.
- [ ] **DiD:** add a pre-trends signal (a leads-and-lags / pre-period interaction p via `plm`) → render a note; keep the parallel-trends figure. Assert vs native-R.
- [ ] **Commit** per test.

---

## Phase 4 — Theme 4: Per-test items + fuller descriptive cards

### Task 14: Render / sentence / copy fixes
**Files:** `src/lib/results/{buildFixedEffects,buildDid}.ts` + registries; `src/lib/registry/wilcoxonSignedRank.ts`; `src/lib/registry/distributionNormality.ts`; `src/lib/registry/logisticRegression.ts`; consistency + HTML.
- [ ] **FE & DiD:** render the overall F as `F({fDf1},{fDf2}), p` using the already-computed `f_df1/f_df2/f_p`.
- [ ] **Wilcoxon:** add the V/W statistic to the apaTemplate.
- [ ] **Distribution-normality:** add the K-S/Lilliefors `D`, p to the apaTemplate.
- [ ] **Logistic how-to-read:** rewrite the "read p from the z column" sentence to reference the per-term CI (no z column; ratified policy stays).
- [ ] Update consistency + HTML for each changed string; **commit** per fix.

### Task 15: Completeness adds
**Files:** `src/lib/stats/{mannWhitneyU,kruskalWallis,wilcoxonSignedRank,randomEffects,kendallsTau,fishersExact,chiSquareIndependence}.ts` + registries + builders + tests.
- [ ] **MWU & KW:** add per-group median + IQR to the rank-summary table; assert vs native-R.
- [ ] **MWU & Wilcoxon:** add Hodges-Lehmann median-difference (+ its CI) via `wilcox.test(conf.int=TRUE)`; render in-table; assert vs native-R.
- [ ] **Random effects:** add `plm::plmtest` (BP-LM, RE vs pooled) + variance components/θ → table/note; assert vs native-R.
- [ ] **Kendall:** label the statistic `tau-b` (header/note). **Fisher:** label the OR as conditional-MLE + add Cramér's V for >2×2 tables (effectsize). **χ² independence:** add per-cell standardized residuals to Table 1 (already computed in the GoF sibling — mirror it).
- [ ] Update consistency + HTML; **commit** per group.

### Task 16: Descriptive tables → Arel-Bundock `datasummary_*` (+ completeness adds)
**Files:** `src/lib/stats/{summaryStatistics,frequenciesCrosstabs,distributionNormality}.ts` + registries + builders + tests + HTML; export emitter `src/lib/export/rScript/emitters/assocDesc.ts`.
Adopt the owner-preferred `modelsummary` package's descriptive functions: replicate the format in the builders (computed values/figures unchanged) and emit the real `datasummary_*()` call in `analysis.R`.
- [ ] **Summary statistics → `datasummary_skim`/`datasummary` style:** per-variable rows × stat columns; **add** a mean 95% CI (or SE) column + relabel the kurtosis header "Kurtosis (excess, type-3)". Stats test asserts the mean CI vs native-R; emitter emits `datasummary_skim(...)`. Update consistency + HTML.
- [ ] **Frequencies & cross-tabs → `datasummary_crosstab` style:** **add** the Valid% vs Total% split + a Missing row (from the computed `nExcluded`); emitter emits `datasummary_crosstab(row ~ col, data)`. Assert counts; update consistency + HTML.
- [ ] **Distribution-normality:** keep its normality-test structure (not a pure descriptive table); **add** skewness + kurtosis columns to the per-variable table (`psych`/moments); assert vs native-R. Update consistency + HTML.
- [ ] **Commit** per card.

### Task 16b: Group "Table 1" descriptives → `datasummary_balance`
**Files:** the per-group descriptives table in each group-comparison builder — `src/lib/results/build{IndependentTTest,PairedTTest,OneSampleTTest,OneWayAnova,FactorialAnova,RepeatedMeasuresAnova,MixedAnova,NestedAnova,WelchAnova,Ancova,Manova,Mancova,MannWhitneyU,WilcoxonSignedRank,KruskalWallis,Friedman}.ts` + their registries (descriptives table spec only) + consistency + HTML; export emitters where a descriptives block is emitted.
Restyle ONLY the per-group descriptives block (N/M/SD by group) to the `datasummary_balance` "Table 1" house style — the **inferential** table (t/F/χ²/rank statistic, post-hoc, source table) is untouched. Computed values unchanged; this is the format + the emitted `datasummary_balance(~group, data)` call.
- [ ] Worked reference on independent-t (one builder), then fan out to the rest via parallel worktrees, one builder each, same diff. Per builder: update the descriptives table spec, mirror the HTML, keep the consistency test green. **Commit** per small group.
- [ ] *Note (scope):* this is the owner-approved datasummary extension to the group descriptives; if it proves heavy it can split into its own follow-on plan after Tasks 1–16 land — flag at integration (Task 19).

---

## Phase 5 — Provenance (CITATIONS.txt + per-card method-ref)

### Task 17: CITATIONS.txt in the export bundle
**Files:** Create `src/lib/export/citations.ts`; modify `src/components/screens/ResultsScreen.tsx` `buildExportFiles`; Test `src/lib/export/citations.test.ts`.
- [ ] **Step 1 (failing test):** `citationsText()` returns a body containing the R version, each emitted package + a `citation()`-style reference, and the line "Tables formatted per APA-7 (7th ed.); econometric methods follow each package's cited reference." **Step 3:** implement (reuse the package-union approach from `licenses.ts`); add `CITATIONS.txt` to the export file map whenever R/LaTeX is exported. **Step 4–5:** green; **commit**.

### Task 18: Per-card method-reference line (econometrics how-to-read)
**Files:** `src/lib/registry/{arimaSarima,stationarityTests,grangerCausality,var,fixedEffects,randomEffects,hausmanTest,did,rdd,ivTwoStage,propensityScoreMatching}.ts` + consistency + HTML.
- [ ] Append a one-line "Method: <canonical reference>" to each econometrics card's how-to-read (e.g. RDD → Calonico–Cattaneo–Titiunik; IV weak-instrument → Stock–Yogo; PSM → Austin; DiD → Bertrand–Duflo–Mullainathan; ARIMA → Hyndman & Athanasopoulos; VAR → Lütkepohl), worded report-only. Mirror in HTML; update consistency. **Commit** per small group.

---

## Phase 6 — Integration, gates, ratify

### Task 19: Full-suite integration + HTML sync sweep
- [ ] Re-run the whole consistency suite (every changed card's registry ↔ HTML). `tsc -b` 0. `npm run test:fast` green. Fix any registry/HTML drift. **Commit.**

### Task 20: Native-R correctness gate extension
**Files:** `src/lib/export/rScript/runs-in-r.test.ts` + emitters where a new diagnostic is now emitted.
- [ ] Extend the emitters/gate so any new diagnostic that belongs in `analysis.R` is emitted + still runs under native R. **Commit.**

### Task 21: e2e
- [ ] Confirm the existing journeys still pass with the new rows/notes (the result-card structure changed). Update any e2e assertion that pinned an exact table shape now altered. **Commit.**

### Task 22: Combined review + gates + ratify + notify
- [ ] Light combined adversarial review: native-R recompute every NEW value (CIs, diagnostics, descriptives) + a UI drive of a sample card per theme + the export `CITATIONS.txt`. 
- [ ] **Gates:** `tsc -b` 0 · full vitest ×2 (incl. WebR + the R-runs gate) · full e2e · build · fresh-clone. 
- [ ] Docs: update README/ROADMAP (reporting-completeness pass → Done); regenerate `docs/TEST_CATALOG.md` if structure changed; refresh the per-test documentation capture if desired. 
- [ ] Assemble the ratify list (`docs/superpowers/reviews/2026-06-17-reporting-completeness-ratify.md`): the standard cited per family, each new value's native-R verification, any McCrary deferral, the bootstrap method chosen for ρ/τ. **PushNotification** when green. **STOP at the owner click-through. NEVER push/deploy without his word.**

---

## Self-review
- **Spec coverage:** Theme 1 → Tasks 2–6; Theme 2 → Tasks 7–11; Theme 3 → Tasks 12–13; Theme 4 → Tasks 14–16b (descriptive tables restyled to Arel-Bundock `datasummary_skim/crosstab` + group "Table 1" via `datasummary_balance`, per standard §2); provenance → Tasks 17–18; HTML/consistency/gates/ratify → Tasks 19–22; the Task-1 spike de-risks every novel computation + WebR feasibility (incl. the one allowed deferral, McCrary). ✓
- **Out of scope honored:** the no-visible-coefficient-*p* policy is untouched (Task 14 only fixes the logistic copy); the full causal battery + IQR/Total-row are excluded. ✓
- **Type consistency:** every new result field (`<es>Low`/`<es>High`, `shapiro`, `boxM`, `serialTest`, `mccrary`, `preTrend`, `hodgesLehmann`, `bpLm`, descriptive CI fields) is defined in its runner's interface in the task that introduces it and consumed only in that card's builder. ✓
- **Process:** worked-reference-then-fanout per theme; per-card parallel worktrees touching only their own files; one integration (Task 19) + native-R gate (Task 20) + e2e (Task 21) + combined gate (Task 22); single native-R-verification discipline throughout.
