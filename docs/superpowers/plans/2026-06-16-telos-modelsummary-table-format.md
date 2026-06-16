# modelsummary Publication Table Format — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Spec: `docs/superpowers/specs/2026-06-16-telos-modelsummary-table-format-design.md`.

**Goal:** Restyle the 13 regression/econometrics coefficient tables to the modelsummary publication convention (stacked estimate → (SE) → [CI], goodness-of-fit footer, side-by-side model columns, no stars), keeping every richer column we already report, and switch DiD to entity fixed-effects.

**Architecture:** Add a new table `kind: 'coef'` to the registry/result model. A coef table carries model columns + a GOF-row list (labels in the registry, so consistency tests still match registry strings ↔ drawn card verbatim); the builder fills per-term `{est, se, ci}` stacked cells + GOF values. `ApaTable` gains a coef branch (term → 3 stacked lines, a rule, then GOF rows, plus spanning rows for diagnostics like the Hausman χ²). Capture/zip is unchanged (still `<table id="table-…">` → PNG). Classic tables (the other 27 tests, and the kept auxiliary tables — classification, balance, lag-selection, FEVD, forecast, first-stage) are untouched. The exported `analysis.R` gains a `modelsummary()` call per affected test.

**Tech Stack:** React + TS, WebR (R 4.6.0 packages: stats/plm/AER-ivreg/MASS/forecast/vars/MatchIt/rdrobust + **modelsummary** in the exported script only), vitest, Playwright. Numbers cross-verified against native R 4.6.0.

**Process:** Lighter regimen — pre-plan spike (Task 1) for novel numbers; per-test build in parallel worktrees touching only their own files; one serial backbone first; full gates at integration; combined slice-end review; gates ×2 + fresh clone; **STOP at Benjie's click-through; NEVER push/deploy.**

---

## Per-test reference (from audit `wf_a0caeed2-4e9`)

| Test | Merge into coef table | Keep (richer) | Add GOF | Columns |
|---|---|---|---|---|
| Simple linear | Model-fit + Coefficients | β, residual σ, F(df1,df2,p) | N, RMSE, AIC, BIC, LogLik | single |
| Multiple linear | Model-fit + Coefficients | VIF, β, F(df1,df2,p) | N, RMSE, AIC, BIC, LogLik | single |
| Logistic | Model-fit + Coefficients | OR, CI(OR), Nagelkerke, omnibus χ², −2LL; **classification + ROC stay** | N, BIC | **B \| OR** |
| Poisson/NB | Model-fit + Coefficients | IRR, CI(IRR), dispersion/theta, resid dev+df, note, figure | N, LogLik, BIC | **B \| IRR** |
| ARIMA | Model summary + Diagnostics; **Forecast stays** | σ², Ljung–Box, forecast table, figures | N | single |
| VAR | per-equation coef; **lag-grid + FEVD stay** | lag grid, FEVD, IRF, note, t/p in export | N, per-eq R²/AdjR²/RMSE/LogLik; selected lag p + max-root-modulus + stable in footer | **one col / equation** |
| Fixed effects | Coefficients + Model-fit | clustered-SE label, N entities, Within R², poolability F note, figure | N, **surface AdjR² (computed)** | single |
| Random effects | Coefficients + Model-fit | clustered SE, N entities, single-R² note | N, F (opt) | single |
| Hausman | Test stat + FE/RE coefs | **Difference col**, Hausman χ²/df/p (spanning footer), Decision, figure | surface per-model SE, N, N entities, R²/col | **FE \| RE** |
| DiD | single coef → coef table | clustered-SE label, note (now true), trends figure | N, N entities, Within R², F | single (**model→entity-FE plm**) |
| RDD | single estimand → 1 term row | bandwidth, N L/R, robust inference, cutoff/poly→footer | effective-N | single |
| IV/2SLS | 2SLS coefs; **first-stage stays** | partial-F, instrument note; diagnostics→footer | N, structural F, R² (opt) | **OLS \| 2SLS** |
| PSM | ATT → coef table; **balance + love plot stay** | t/p, CI, matchedN | N (=matchedN), treated/control N | single |

**Visible coef cell = estimate / (SE) / [CI] only** (the convention + the locked CI decision). t/p drop from the visible cell (redundant with SE/CI, and modelsummary-default) but stay in the exported CSV + R script — **flag for ratify**. β/VIF (multiple-linear) kept as extra right-hand columns; OR/IRR become the second model column.

---

## Task 1: Ground-truth spike (native R 4.6.0)

**Files:** Create `docs/superpowers/reviews/2026-06-16-modelsummary-format-spike.md`

- [ ] **Step 1:** In native R on the committed fixtures (`tests/e2e/fixtures/panel.csv`, `causal.csv`, `regression.csv`, `timeseries.csv`), compute and record, per affected test: the existing coefficient block (estimate/SE/CI — confirm unchanged vs current tests) **and** every NEW GOF value to be shown (N via `nobs`, RMSE via `sqrt(mean(resid^2))`, `AIC`, `BIC`, `logLik`, FE `adjR2`, per-equation VAR `summary(eq)$r.squared`/RMSE/logLik, IV structural F). Install packages as needed (`plm`, `AER`, `MASS`, `forecast`, `vars`, `MatchIt`, `rdrobust`, `modelsummary`).
- [ ] **Step 2:** Verify the **entity-FE DiD (Option B)** on `panel.csv`: `plm(roa ~ post + treated:post, data=pdata.frame(.,index=c("firm","year")), model="within")` with clustered SE (`vcovHC(.,cluster="group",method="arellano")`). Record Post, Treated×Post (expect ≈1.5256), SE, 95% CI, within R², N, N entities.
- [ ] **Step 3:** Sanity-check the exported-script payload: for one lm, one glm (exponentiate), one plm, render `modelsummary(list(...), statistic=c("std.error","conf.int"), stars=FALSE, gof_map=...)` to markdown; confirm it produces a clean publication table. Record the canonical call to embed in `analysis.R`.
- [ ] **Step 4:** Write all values + the canonical `modelsummary()` call into the spike doc. Commit: `git add docs/superpowers/reviews/2026-06-16-modelsummary-format-spike.md && git commit -m "spike(ms-format): native-R ground truth for GOF rows + entity-FE DiD + export call"`

---

## Task 2: Backbone — `kind:'coef'` registry & result types

**Files:** Modify `src/lib/registry/types.ts`; Modify `src/lib/results/builders.ts` (CardContent table union); Test `src/lib/registry/types.test.ts` (new)

- [ ] **Step 1: Write failing test** asserting a `kind:'coef'` TableSpec carries `models` + `gof` and that a coef `CardContent` table carries `coefRows`/`gofRows`.
- [ ] **Step 2:** Run, verify fails (types absent).
- [ ] **Step 3: Implement types.** In `types.ts` extend `TableSpec`:

```ts
export interface GofRow { key: string; label: string }            // footer row label, verbatim for consistency
export interface ModelCol { key: string; label: string }          // a model column ((1), 'Fixed effects', 'Odds ratio (OR)', …)
export interface TableSpec {
  id: string; title: string; columns: ColumnDef[]; captionStyle?: 'bare'; domId?: string
  kind?: 'coef'                       // undefined = classic columns×rows (unchanged)
  models?: ModelCol[]                 // coef: one per side-by-side model (single test = one)
  gof?: GofRow[]                      // coef: footer rows, labels match the drawn card
  extraCols?: ColumnDef[]            // coef: kept per-term columns (e.g. multiple-linear β, VIF)
}
```

In `builders.ts` make `CardContent.tables` a union:

```ts
export type BuiltTable =
  | { spec: TableSpec; rows: Record<string, string | number>[] }                                  // classic
  | { spec: TableSpec; coefRows: CoefRow[]; gofRows: { key: string; values: string[] }[]; spanNotes?: string[] } // coef
export interface CoefRow { term: string; cells: { est: string; se: string; ci: string }[]; extra?: Record<string, string> }
```

- [ ] **Step 4:** Run test, verify passes. tsc clean. **Step 5:** Commit.

---

## Task 3: Backbone — coef renderer + capture parity

**Files:** Modify `src/components/ApaTable.tsx` (or add `CoefTable.tsx` + branch in `ResultPreviewCard.tsx`); Test `src/components/CoefTable.test.tsx`

- [ ] **Step 1: Write failing test** rendering a coef table: header = blank stub + model labels; each `CoefRow` → an estimate row (term in stub), a muted `(SE)` row, a muted `[lo, hi]` row; a rule before the footer; each `gofRows` → label + value(s); `spanNotes` → a full-width row. Assert DOM is one `<table id="table-…">`.
- [ ] **Step 2:** Run, verify fails. **Step 3: Implement** the coef branch (term stubs, 3 stacked lines/term with row classes `coef`/`se`/`ci`, a `gofrule` row, footer rows, spanning note rows; `extraCols` as extra `<th>/<td>` on the estimate row). Keep classic `ApaTable` path unchanged.
- [ ] **Step 4:** In `ResultPreviewCard.tsx`, branch on `'coefRows' in t` to render the coef table; classic path unchanged. **Step 5:** Add CSS (muted SE/CI rows, `border-top` rule, `tabular-nums`) to tokens.css.
- [ ] **Step 6:** Run unit + a capture smoke test (`src/lib/export/*`) to confirm a coef table still captures to PNG (it is a `<table id>` — no capture change expected). tsc clean. **Step 7:** Commit.

---

## Task 4: ~~`modelsummary()` in exported R script~~ — DEFERRED (out of scope)

**DEFERRED 2026-06-16 (ratify flag).** The exported R-script feature does not exist yet — the zip currently ships only table/figure PNGs; the "R script (.R)", "PDF report", and "LaTeX" export formats are the disabled "coming in a later slice" options (`ResultsScreen.tsx`). Building the R-script export is its own future slice; emitting a `modelsummary()` call belongs there. The **canonical call is captured in the spike doc** (`docs/superpowers/reviews/2026-06-16-modelsummary-format-spike.md` §3), ready to drop in when that slice is built. This slice = the **in-app table restyle** only (the substance of D3). No code for this task.

---

## Tasks 5–17: Per-test restyle (parallel worktrees, one test each)

**Shared recipe (every per-test task):**
1. Read the test's registry (`src/lib/registry/<name>.ts`), builder (`src/lib/results/build<Name>.ts`), stats (`src/lib/stats/<name>.ts`), consistency test, and the drawn card in `telos_test_outputs.html`.
2. Registry: set the coef table `kind:'coef'`, `models`, `gof` (labels verbatim — see reference table), `extraCols` for kept per-term columns. Remove the now-merged separate model-fit TableSpec.
3. Stats (only if new values needed): compute the added GOF values; **cross-verify each against the Task-1 spike / native R**; add to the result type + a stats test asserting the verified value.
4. Builder: emit `coefRows` ({est, se, ci} stacked) + `gofRows` (values) + `spanNotes` where applicable; keep the auxiliary classic tables (classification, balance, lag-grid, FEVD, forecast, first-stage); keep figures, note, report-only APA. No stars.
5. Builder test (mock result): assert coefRows/gofRows/extraCols shape + report-only APA.
6. Consistency test: assert `models[].label` + `gof[].label` + note + caption appear in the redrawn card; mutation-check (corrupt one → red).
7. Redraw the card in `telos_test_outputs.html` to the new format (term stubs / (SE) / [CI], rule, GOF footer, model columns) — **faithful to the agreed layout**; keep APA report-only.
8. Run `npm run test:fast` for the touched files; tsc clean. Commit.

- [ ] **Task 5: Simple linear** — single col; add N/RMSE/AIC/BIC/LogLik; keep β (extraCol), residual σ + F in footer.
- [ ] **Task 6: Multiple linear** — single col; β + VIF as extraCols; add N/RMSE/AIC/BIC/LogLik; keep F.
- [ ] **Task 7: Logistic** — **B|OR two columns** (SE under B, CI under OR); keep Nagelkerke/omnibus χ²/−2LL in footer + add N/BIC; **classification table + ROC unchanged**.
- [ ] **Task 8: Poisson/NB** — **B|IRR two columns**; footer dispersion/theta + resid dev/df + N/LogLik/BIC; keep dispersion note + figure.
- [ ] **Task 9: ARIMA** — merge Model-summary + Diagnostics; coef block stacks SE+CI; footer N/σ²/Ljung–Box/AIC/BIC/LogLik; **Forecast table + figures unchanged**.
- [ ] **Task 10: VAR** — **one column per equation** (union of lagged terms as stubs); footer per-eq R²/AdjR²/RMSE/LogLik + N + selected-lag p + max-root-modulus + stable flag; **lag-grid + FEVD + IRF unchanged**; t/p kept in export only.
- [ ] **Task 11: Fixed effects** — single col; footer N/N-entities/Within R²/**AdjR² (surface existing)**/F; keep clustered-SE label + poolability note + coef plot.
- [ ] **Task 12: Random effects** — single col; footer N/N-entities/R²/AdjR² + F(opt); keep clustered SE + single-R² note.
- [ ] **Task 13: Hausman** — **FE|RE two columns** (estimate/(clustered SE)/[CI] per col) + **Difference extraCol**; spanNote = `Hausman χ²(df) = …, p …`; footer N/N-entities/R² per col; keep Decision (report-only) + figure.
- [ ] **Task 14: DiD** — **swap runner to entity-FE `plm` within + clustered SE** (Option B; values from Task-1 spike); table shows Post + Treated×Post; footer N/N-entities/Within R²/F; keep clustered-SE label + (now-true) absorbed note + trends figure; update did stats/builder/tests.
- [ ] **Task 15: RDD** — one term row ("RD treatment effect") /(SE)/[CI]; footer bandwidth/N-left/N-right/cutoff/poly/effective-N; keep robust-inference labeling + RD plot.
- [ ] **Task 16: IV/2SLS** — **OLS|2SLS two columns** (data already fit for the plot); pull weak-IV F / Wu-Hausman / Sargan from the note into footer rows + N + structural F; **first-stage table unchanged**.
- [ ] **Task 17: PSM** — ATT → one term row /(SE)/[CI]; footer N(=matchedN)/treated-N/control-N; **balance table + love plot unchanged**.

---

## Task 18: Integration

**Files:** Modify `src/lib/registry/catalog.consistency.test.ts`; `src/lib/results/builders.ts` (RUNNERS/BUILDERS untouched unless DiD runner signature changed); decode rescan.

- [ ] **Step 1:** Merge worktree branches; octopus or sequential. **Step 2:** Update `catalog.consistency.test.ts` for the new coef table shapes (models/gof). **Step 3:** Re-scan `decode()` for any new entities introduced by card redraws. **Step 4:** `npm test` full WebR suite green. **Step 5:** Commit.

---

## Task 19: e2e

**Files:** Modify `tests/e2e/*.spec.ts` (panel + causal + regression journeys).

- [ ] **Step 1:** Update journey assertions for the new table shapes (term stubs, GOF footer rows, side-by-side headers) and the **DiD 2-row table**. **Step 2:** Confirm zip table PNG names unchanged (domId stable). **Step 3:** `npm run test:e2e` green. **Step 4:** Commit.

---

## Task 20: Combined adversarial review

- [ ] One review workflow: independent native-R recompute of every coef block + each new GOF value; UI screenshot drive of all 13 cards (single + side-by-side); report-only/no-stars confirmed; verify nothing in the 27 non-coef tests changed. Fix findings. Record `docs/superpowers/reviews/2026-06-16-modelsummary-format-review.md`.

---

## Task 21: Docs

**Files:** `docs/TEST_CATALOG.md` (regen via `npx tsx scripts/gen-test-tree.ts`); `docs/testing/test-config-guide.md`; `README.md`; `docs/superpowers/ROADMAP.md`; screenshots `.superpowers/screens/`.

- [ ] Regenerate the catalog; update the guide's expected-output sections for the 13 tests; bump README/ROADMAP (counts unchanged at 40 live; note the format change); refresh screenshots (a single-col card, a side-by-side card, the DiD 2-row). Commit.

---

## Task 22: Final gates + ratify + notify

- [ ] tsc 0 · full vitest ×2 · e2e ×2 · build · fresh-clone (install → tsc → build → vitest). All green on final HEAD.
- [ ] Assemble the **ratify list** in `docs/superpowers/reviews/2026-06-16-modelsummary-format-review.md`: D1–D5 + CI decision + #8 DiD=B (now built) + the **t/p-dropped-from-visible-cell** call + per-test GOF-row choices + the exported-`modelsummary()` call + any review findings.
- [ ] Update `telos-build-phase.md` memory with final state (HEAD, gates, ratify pointer).
- [ ] **PushNotification** to Benjie: build green, ratify list ready, awaiting click-through. **NEVER push/deploy.**

---

## Self-review notes

- **Spec coverage:** every §6 per-test treatment → a Task 5–17 row; §4 format → Tasks 2–3; §9 export → Task 4; CI decision → Task 3 renderer; #8 DiD=B → Task 14; GOF additions → Task 1 verification + per-test. ✓
- **Open/ratify (surfaced, not silently decided):** t/p drop from visible cell (kept in export); whether RE gets AIC/BIC (default: omit, not standard for GLS); ARIMA RMSE (omit). All flagged in Task 22 ratify list per Benjie's "ping me on decisions to ratify."
- **Type consistency:** `kind:'coef'`, `models`, `gof`, `extraCols`, `CoefRow{term,cells:{est,se,ci},extra}`, `BuiltTable` union used identically across Tasks 2/3/5–17. ✓
