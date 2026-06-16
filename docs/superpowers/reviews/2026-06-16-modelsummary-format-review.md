# modelsummary table-format slice — ratify list & review

**Date:** 2026-06-16 · **Status:** built to green on local `main`, **NOTHING pushed/deployed** — awaiting Benjie's click-through + ratify rulings.

Restyled the **13 regression/econometrics coefficient tables** to the modelsummary publication convention (stacked estimate / (SE) / [CI] → goodness-of-fit footer → side-by-side model columns, **no significance stars**), keeping every richer column we already report. The other 27 tests are untouched.

## Decisions already ruled by Benjie (now built — confirm they landed as intended)

- **D1 — no significance stars.** Confirmed across all 13.
- **D2 — 5 side-by-side tables built:** logistic **B | OR**, Poisson **B | IRR**, Hausman **FE | RE** (+ Difference column + a spanning Hausman χ² row), IV **OLS | 2SLS** (+ diagnostics footer), VAR **one column per equation**.
- **D3 — replicated in the builders.** (R-script `modelsummary()` half deferred — see flags.)
- **D4 — `Num.Obs.` everywhere + meaningful GOF rows** per model family (see below).
- **D5 — all 13 spec-HTML cards redrawn** (your design canvas — please click through).
- **CI** = SE in parens + `[lo, hi]` line beneath, consistent across all 13.
- **#8 DiD = Option B (entity fixed-effects).** Built: `plm(roa ~ post + treated:post | firm)`, clustered SE → table shows **Post + Treated×Post**; the drawn "Treated absorbed" note is now true. DiD effect **1.5256** (native-R verified), within R² .841.

## New flags for your ruling (I chose a sensible default; easily reversible)

1. **t / p dropped from the visible coef cell** (also residual σ and the F df/p for OLS). modelsummary's default shows only estimate + the paren statistic; the CI conveys the inference, and report-only avoids leaning on p. **They remain in the result object / data — not lost.** Your call: keep (modelsummary-faithful) vs. restore t/p as extra stacked lines.
2. **Exported-R-script `modelsummary()` call — DEFERRED.** The R-script export doesn't exist yet (3 export formats are disabled "later slice"). The canonical call is captured in the spike doc §3, ready for that future export slice.
3. **Clustered-SE provenance via the note**, not a column header (the coef format has no SE column header). FE/RE/DiD/Hausman keep their "clustered SE" wording in the note/APA.
4. **Hausman "Decision" softened to report-only:** the table reports χ²(df), p in a spanning row; no FE/RE verdict is baked into the table (the how-to-read explains it). Consistent with the report-only policy.
5. **GOF rows per family** (native-R verified; AIC/BIC/Log.Lik. have no method for plm/ivreg/rdrobust/matchit, so omitted there): lm = N/R²/Adj.R²/F/RMSE/AIC/BIC/LogLik · glm = N/(pseudo-R² or dispersion)/LogLik/AIC/BIC · plm (FE/RE/Hausman/DiD) = N/N-entities/within-R²/F · IV = N/RMSE/structural-F + weak-IV/Wu-Hausman/Sargan · RDD = bandwidth/N(left)/N(right) · PSM = matched-N/treated/control.
6. **VAR dynamic per-equation columns:** the builder builds one column per series at runtime; its consistency test checks the static parts (caption, GOF labels, note, kept-separate tables) not the data-dependent equation labels.
7. **Logistic omnibus χ²** rendered as one GOF row with its p inline (e.g. "9.54 (p .023)") to keep the footer compact.

## Kept-separate auxiliary tables (unchanged, classic format)
Logistic **Classification** + ROC · Poisson fit/residual figure · ARIMA **Forecast** table + figures · VAR **Lag-selection** grid + **FEVD** + IRF · IV **First-stage** table · PSM **Covariate-balance** table + love plot · all coefficient-plot figures.

## Verification
- Every coef block + new GOF value **native-R 4.6.0 verified** (per-test, on the committed fixtures).
- Per-test builder + WebR stats tests green; all 13 **consistency tests** pass (registry ↔ redrawn card verbatim).
- tsc 0 · **full WebR vitest 810/810 (136 files), run ×2** · **FULL e2e 14/14 (every journey: flow, anova, association, regression, all 3 econometrics)** · build green · **fresh-clone (committed HEAD): install + build + test:fast 682 green** (the 128 WebR stats also proven green on a clean clone at the prior gate). Final gate `/tmp/telos-gate3` = GREEN.
- *(Integrity note: the fresh-clone gate caught 2 new builder-test files — `buildArimaSarima.test.ts`, `buildVar.test.ts` — that `git add -u` had skipped; now committed, so the committed set is the full 810.)*
- Catalog regenerated (`docs/TEST_CATALOG.md`) showing the coef structure for the external completeness review.
- **Combined visual + correctness review: CLEAN.** All 12 coef-table shapes rendered + screenshotted (`.superpowers/screens/ms-format/`): no stars, estimate/(SE)/[CI] stacking, GOF footer rule, side-by-side columns aligned, Hausman χ² span row, kept-separate tables classic — no rendering bugs. 3 independent native-R spot-checks matched (DiD Treated×Post 1.5256 CI [1.29,1.76]; logistic OR 1.08 [1.01,1.18]; VAR per-eq R² .9952/.9909). One cosmetic note (not a bug): the sticky nav can overlap a GOF row *in a full-page scroll screenshot*; the zip export captures the table node directly so exported PNGs are unaffected.

## Still open (carryover — your calls, nothing pushed)
- The **prior econometrics ratify list** (`docs/superpowers/reviews/2026-06-15-econometrics-panel-causal-ratify.md`).
- **Push / deploy** of the whole local-`main` pile (now 30+ commits ahead of origin).
- The deferred R-script/PDF/LaTeX **export slice**; the design-theme menu; the regression-completeness coherence pass.
