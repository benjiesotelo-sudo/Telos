# Telos — modelsummary publication table format (design)

**Date:** 2026-06-16
**Status:** DRAFT — awaiting Benjie's review
**Slice:** Regression & econometrics coefficient-table restyle (pre-launch)

## 1. Goal & background

Adopt the **modelsummary** (Vincent Arel-Bundock; the modern successor to stargazer) **publication table convention** for Telos's regression and econometrics coefficient tables, so thesis/paper output matches what committees and journals expect.

This is grounded in two verified inputs:

- **Convention research** (`deep-research`, 23/25 claims 3-vote confirmed): the academic regression-table convention is coefficient → **standard error in parentheses stacked directly beneath it** → a **goodness-of-fit (GOF) footer** → **side-by-side model columns**. Our current "tidy" one-row-per-term layout (B · SE · t · p · CI as columns) is a *software-output* style, not the publication convention.
- **Per-test audit** (`wf_a0caeed2-4e9`, modelsummary 2.6.0 verified on native R 4.6.0): modelsummary's **default** is raw estimate + SE in parens beneath, a GOF footer (`Num.Obs., R2, R2 Adj., AIC, BIC, Log.Lik., F, RMSE`), side-by-side columns, and **no significance stars**. Crucially, **in 11 of 13 tests Telos already reports *more* than modelsummary's spare default** — so this is a presentation upgrade, not a rebuild. modelsummary + its full hard-dependency closure ship as **WebAssembly binaries on repo.r-wasm.org** (so it is WebR-loadable).

The headline gaps the audit found: (a) the **layout** (tidy vs stacked + footer); (b) **`Num.Obs.` (N) is missing from every test's tables** though computed internally; (c) **untapped side-by-side tables** where the data already exists.

## 2. Scope

**In scope — the 13 coefficient/estimate-table tests (Group A):**
Simple linear, Multiple linear, Logistic, Poisson/NB · ARIMA/SARIMA, VAR, Fixed effects, Random effects, Hausman, DiD, RDD, IV/2SLS, PSM.

**Explicitly out of scope (unchanged — different, already-correct conventions):** all Descriptive, t-test, ANOVA-family (Source·SS·df·MS·F·p·η²), correlation, χ²/contingency, and the ADF/KPSS + Granger time-series test-statistic tables. modelsummary's regression-table format does not apply to these.

## 3. Locked decisions (Benjie, 2026-06-16)

- **D1 — Significance stars: OFF.** Matches modelsummary's default, the report-only policy, and the ASA critique of p<.05 bright-lines. Exact p stays available as a report-only number.
- **D2 — Side-by-side: build the 5 where data already exists** — Hausman FE|RE, IV OLS|2SLS, VAR per-equation, Logistic B|OR, Poisson B|IRR. Defer speculative ones (simple-vs-multiple comparison, DiD adjusted ladder, RDD bandwidth/poly sensitivity, PSM unmatched-vs-matched).
- **D3 — Architecture: replicate the format in the TS builders** (preserves theming, consistency tests, figures, report-only neutralization) **and emit a real `modelsummary()` call in the exported R script** (verified WebR-loadable) so a re-run reproduces an authentic publication table. Do **not** render tables by running modelsummary live.
- **D4 — GOF rows: add `Num.Obs.` to every test**, plus the meaningful fit rows (R²/Adj.R², F, AIC/BIC, Log.Lik., RMSE) **where they apply**; skip rows that aren't meaningful for a given model (e.g. R²/AIC for RDD, PSM, ARIMA).
- **D5 — Scope: its own pre-launch slice.** Touches builders + the 13 drawn spec-HTML cards (Benjie's design canvas — he reviews the redrawn cards) + consistency tests.

## 4. The unified table format

Each coefficient table becomes one object:

```
                 (1) <model / column label>
  <term A>       <estimate>
                 (<SE>)
  <term B>       <estimate>
                 (<SE>)
  ──────────────────────────         ← horizontal rule
  Num.Obs.       <n>
  <fit rows…>    <value>
```

- **Coefficient block:** term labels are left row stubs; the **estimate** sits on its own row; the **SE in parentheses on the next row directly beneath it** (the convention). Pretty term labels (e.g. `treated: yes`) are kept over raw `factor()1` names.
- **No stars.** p is reported as a report-only number where we surface it (not converted to asterisks).
- **GOF footer** below a rule: `Num.Obs.` first, then the meaningful fit rows for that model.
- **Side-by-side:** multiple models → one column each, sharing term rows, blank where a term is absent (the 5 tests in D2).
- **Richer columns we keep** (§5) render as additional columns or stacked sub-lines — never dropped to reach modelsummary's minimalism.
- **CI:** SE goes in the parens; the 95%/adjustable CI we already compute is kept as a **bracketed `[lo, hi]` line directly beneath the SE** (modelsummary `statistic = c('std.error','conf.int')`), applied consistently across all tests including the side-by-side ones (so each term renders on three lines: estimate / (SE) / [lo, hi]). Report-only favors the CI as a descriptive range. *(Benjie ruled 2026-06-16.)*

## 5. "Adopt unless incomplete" principle

We adopt modelsummary's **layout, footer, side-by-side columns, and no-stars default**. Where Telos already reports more than modelsummary's spare default, we **keep it** — modelsummary's default omitting something is not a reason to drop it.

## 6. Per-test treatment

For each: **merge** (which current tables collapse into the stacked block + footer), **keep** (richer-than-default), **add** (GOF, native-R-verified), **columns** (single vs side-by-side).

- **Simple linear** — merge Model-fit + Coefficients. Keep: β, t, p, CI, residual σ, F(df1,df2,p). Add: N, RMSE, AIC, BIC, Log.Lik. Single column.
- **Multiple linear** — merge. Keep: VIF, β, t, p, CI, F(df1,df2,p). Add: N, RMSE, AIC, BIC, Log.Lik. Single column (raw|standardized side-by-side deferred to the `standardize` toggle as a future option).
- **Logistic** — merge Model-fit + Coefficients; **B | OR side-by-side** (SE under B, CI under OR). Keep: OR, CI(OR), z, p, Nagelkerke R², omnibus χ²/p, −2LL, **Classification table + ROC stay separate**. Add: N, BIC. Skip: F, RMSE.
- **Poisson / NB** — merge; **B | IRR side-by-side**. Keep: IRR, CI(IRR), z, p, dispersion(Poisson)/theta(NB), residual deviance+df, dispersion note, fit/residual figure. Add: N, Log.Lik., BIC; optional pseudo-R². Skip: R², F. (Poisson-vs-NB model-compare columns = future.)
- **ARIMA/SARIMA** — merge Table 1 (coef) + Table 2 (diagnostics) into stacked block + footer; **Forecast table stays separate**. Keep: σ², Ljung–Box p, CI (stack SE + CI), forecast table, residual/forecast figures. Add: N. Omit: R²/F (n/a); RMSE optional. Single column (candidate-order comparison = future).
- **VAR** — **per-equation side-by-side** (one column per response series; union of lagged terms as stubs; estimate over SE). **Lag-selection grid + FEVD stay separate tables.** Keep: lag grid, FEVD, IRF figure, Cholesky/stationarity note, t/p in exported data. Add: N, per-equation R²/Adj.R²/RMSE/Log.Lik.; promote selected lag p + max-root-modulus + stable flag into the footer.
- **Fixed effects** — merge Coefficients + Model-fit. Keep: clustered-SE labeling, CI, N entities, Within R², poolability F note, within-variation note, coef plot. Add: N, **surface Adj.R² (already computed, unsurfaced)**, RMSE optional. (FE plugs into the Hausman side-by-side.)
- **Random effects** — merge. Keep: clustered SE, CI, t, p, N entities, single-R² caveat note. Add: N, F (optional), AIC/BIC/RMSE optional.
- **Hausman** — **FE | RE two-column** (strongest fit; data already fit). Estimate over (clustered SE) per column; **keep the Difference column**; the **Hausman χ²(df)=…, p** becomes a spanning footer row; keep the report-only Decision, the FE-vs-RE figure. Add: surface per-model SE (currently only used for the plot), N, N entities, R² per model.
- **DiD** — **switch the runner to entity fixed-effects** `plm(roa ~ post + treated:post | entity)`, clustered SE (#8 ruling: Option B). Coefficient table shows **Post + Treated×Post** (2 terms; the time-invariant Treated main effect is absorbed) → stacked block + a new footer. Keep: CI, clustered-SE label, pretty terms, the now-true *"Treated absorbed by entity fixed effects"* note, parallel-trends figure. Add: N, N entities, Within R², F. DiD effect unchanged (≈1.53; CI slightly tighter than the plain-`lm` build). Requires updating the `did` stats/builder/tests + e2e (2-row table). (Adjusted-vs-unadjusted columns = future.)
- **RDD** — single estimand → one term row ("RD treatment effect") + footer. Keep: bandwidth, N left/right, robust bias-corrected inference (labeled robust), CI, cutoff + polynomial order (promoted into the footer). Add: total/effective-N row. Omit: R²/AIC/BIC/RMSE/F (n/a for local-polynomial RD). (Conventional|Robust columns = future.)
- **IV / 2SLS** — 2SLS coefficient table → stacked block; **OLS | 2SLS two-column** (data already fit for the coef plot, never tabled); pull the diagnostics (weak-IV first-stage F, Wu-Hausman, Sargan) **out of the prose note into footer rows**. **First-stage table stays separate.** Keep: partial-F per instrument, t, p, CI, instrument-validity note. Add: N, structural F, R²/Adj.R² (optional, interpretively weak).
- **PSM** — ATT table → single stacked coef + footer. **Balance table + love plot stay separate.** Keep: t, p, CI, matchedN. Add: N (= matchedN), treated-N/control-N. Skip: R²/AIC/etc. (not meaningful for a y~treat ATT); keep omitting the intercept. (Unmatched|matched columns = future.)

## 7. New statistics & GOF additions

Any new computed value (N surfaced, RMSE, AIC, BIC, Log.Lik., FE Adj.R², VAR per-equation fit rows, DiD full GOF, IV diagnostics moved to footer) must be **cross-verified against native R 4.6.0** before shipping (project ethos — every number reproduced). Most (N, the FE Adj.R², IV diagnostics, Hausman per-model SE) are already computed and just need surfacing; the genuinely new ones are RMSE/AIC/BIC/Log.Lik. where added.

## 8. Side-by-side builds (D2)

Build now (data already exists in the stats modules): **Hausman FE|RE, IV OLS|2SLS, VAR per-equation, Logistic B|OR, Poisson B|IRR.** Each needs the builder to emit a multi-column table and the consistency test + spec card to reflect it. Speculative side-by-sides are documented as future options, not built.

## 9. Implementation surfaces

- **Backbone:** a shared "stacked coefficient block + GOF footer (+ optional multi-column)" table primitive the builders target, so all 13 render consistently. Likely a new `TableSpec` shape / builder helper (e.g. a `coefBlock`/`gofFooter` model) rather than ad-hoc per test.
- **Builders** (`src/lib/results/build*.ts`): restructure the 13 to emit the new shape; keep richer columns; add GOF rows.
- **Spec-HTML cards** (`telos_test_outputs.html`): redraw all 13 cards to the new format — **Benjie's design canvas; he approves the redrawn cards** (render-faithfully).
- **Consistency tests** (`src/lib/registry/*.consistency.test.ts`): update the 13 to match the redrawn cards verbatim; mutation-checked.
- **Figures:** unchanged (coef plots, ROC, parallel-trends, IRF, love plot all stay).
- **Report-only:** preserved and reinforced (no stars).
- **Export:** add a `modelsummary(...)` call to the exported `analysis.R` for the affected tests (single line over the fitted model(s)); zip PNG tables continue to come from our builders.

## 10. Open items / Benjie's calls (ratify)

- **CI presentation — RESOLVED (Benjie, 2026-06-16):** SE in parens + CI as a bracketed `[lo, hi]` line directly beneath the SE, consistent across all tests (incl. side-by-side). Each term renders on three lines.
- **#8 DiD model — RESOLVED (Benjie, 2026-06-16): Option B (entity fixed-effects).** Runner switches to `plm` within with clustered SE; table shows Post + Treated×Post; the drawn "Treated absorbed" note becomes true. Detail in §6 DiD.
- **Exported-R-script depth:** emit `modelsummary()` only, or also write the table to file (`output=`)?
- **Multiple-linear standardized columns / Poisson-vs-NB columns / RDD Conventional|Robust** — confirm these stay deferred.
- Per-test GOF row choices in §6 (which fit rows are "meaningful") — confirm during card review.

## 11. Verification plan

- New/surfaced statistics reproduced in native R 4.6.0 (per test).
- 13 consistency tests updated + mutation-checked against the redrawn cards.
- e2e journeys re-asserted (zip table names unchanged; new table shapes render).
- Full gates ×2 + fresh clone, per standing process.
- Visual verification of each redrawn card (Benjie's click-through; screenshots).

## 12. Sequencing

One slice with a shared backbone (the table primitive) → per-test restyle (parallelizable in worktrees, as prior slices) → integration (catalog/consistency) → spec-HTML card redraw → e2e + combined review → gates ×2 + fresh clone → ratify. Runs before launch; the other 27 tests are untouched.
