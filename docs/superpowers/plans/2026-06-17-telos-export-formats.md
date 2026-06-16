# Export Formats (R script · PDF · LaTeX) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Spec: `docs/superpowers/specs/2026-06-17-telos-export-formats-design.md`.

**Goal:** Implement the three drawn-but-disabled export formats — a clean reproducible R script (all 40 tests) + cleaned data, a browser-print PDF report, and a native-booktabs LaTeX report — plus LICENSES in the bundle.

**Architecture:** New `src/lib/export/` modules, each a pure `data → string/bytes` function (no React/engine), unit-testable. R-script generation uses **family-grouped per-test emitters** that mirror the model/test call each stats module already runs (so results match), written idiomatically. PDF reuses the real rendered DOM via a print stylesheet + `window.print()`. LaTeX turns the structured `BuiltTable` data into booktabs. ResultsScreen wires the three formats into the existing Download flow (one `telos-export.zip` for files; print for PDF).

**Tech Stack:** TS, fflate (existing zip), the existing `BUILDERS`/`SPECS`/`workingDataset`; verification against native R 4.6.0 (the emitted R must actually run). No new runtime deps (PDF = browser print).

**Process:** Lighter regimen, built incrementally (R → PDF → LaTeX), each family verified by running its emitted R in native R; full gates ×2 + fresh clone; **STOP at Benjie's click-through; NEVER push/deploy without his word.**

---

## Key existing interfaces (grounding)

- `Dataset { columns: string[]; rows: Record<string, string|number|boolean|null>[] }` (`src/lib/stats/types.ts`).
- `TestSetup { roles: Record<string,string[]>; options: Record<string,boolean|number|string>; props; blocked }` (`src/state/session.ts`) — `roles[roleId]` = assigned column names; `options[id]` = chosen value.
- `workingDataset(s)` (`src/state/session.ts`) = the cleaned dataset (missing-policy applied) — the source for `cleaned.csv`.
- `SPECS[id]` (registry), `BUILDERS[id](spec,result)` → `CardContent` (`src/lib/results/builders.ts`), `s.runs[id].result` (the computed result).
- Coef tables: `BuiltTable` with `kind:'coef'` carries `coefRows`/`gofRows`/spanNotes (built rows tagged `_kind`); classic tables carry `rows`.

---

## Task 1: Cleaned-CSV serializer

**Files:** Create `src/lib/export/cleanedCsv.ts`; Test `src/lib/export/cleanedCsv.test.ts`

- [ ] **Step 1: failing test** — `toCsv({columns:['a','b'], rows:[{a:1,b:'x,y'},{a:2,b:null}]})` returns `a,b\n1,"x,y"\n2,\n` (RFC-4180: quote fields containing comma/quote/newline; null → empty; numbers bare).
- [ ] **Step 2:** run, verify fails. **Step 3: implement** `toCsv(ds: Dataset): string` — header from `ds.columns`, each row `ds.columns.map(c => esc(row[c]))`, `esc` = `null/undefined → ''`, else stringify + quote-if-needed (double internal quotes). **Step 4:** pass. **Step 5:** commit.

---

## Task 2: R-script backbone (assembler + helpers + worked example)

**Files:** Create `src/lib/export/rScript/helpers.ts`, `emit.ts`, `emitters.ts`; Test `src/lib/export/rScript/emit.test.ts`

- [ ] **Step 1: failing test** — `emitRScript(['simple-linear-regression'], setups, SPECS, dataset)` returns a string that: starts with the header comment + `install.packages(...)` line + `library(...)` + `d <- read.csv("cleaned.csv", stringsAsFactors = FALSE)`; contains a `# === 01 · Simple linear regression ===` block with `lm(post_score ~ pre_score, data = d)` and a `modelsummary(` call with `stars = FALSE`.
- [ ] **Step 2:** run, fails. **Step 3: implement.**
  - `helpers.ts`: shared snippets — `header(pkgs: string[])`, `readData()`, `factorLines(setup, spec, dataset)` (emit `d$col <- factor(d$col)` for nominal/ordinal role columns), `modelsummaryCall(modelVar, opts)` (the call from spike §3: `modelsummary(list("(1)"=m), stars=FALSE, statistic=c("std.error","conf.int"), gof_map=...)`; exponentiate variant for logistic/poisson), `ggsaveOrPrint(plotExpr)`.
  - `emit.ts`: `emitRScript(selection, setups, specs, dataset)` — assemble header (union of per-test packages) → read data → factor coercion → for each id in selection order, `# === NN · <name> ===` + `EMITTERS[id](spec, setup, dataset)`. Returns the full script string.
  - `emitters.ts`: `EMITTERS: Record<string, (spec, setup, dataset) => string>`. Implement **simple-linear** as the worked reference:
    ```ts
    'simple-linear-regression': (spec, setup) => {
      const y = setup.roles['outcome'][0], x = setup.roles['predictor'][0]
      return [
        `m <- lm(${y} ~ ${x}, data = d)`,
        modelsummaryCall('m', { gof: 'lm' }),
        `ggplot(d, aes(${x}, ${y})) + geom_point() + geom_smooth(method = "lm")`,
      ].join('\n')
    }
    ```
- [ ] **Step 4:** pass. tsc 0. **Step 5:** commit.

**Note for Tasks 3–5:** each emitter MIRRORS the model/test call in its stats module (`src/lib/stats/<id>.ts` R_STATS) — same function, same formula, same option threading — but written idiomatically (no env vars, no `.telos_json`). Read the stats module to get the exact call; thread `setup.roles`/`setup.options` into it.

---

## Task 3: R emitters — regression + econometrics (15)

**Files:** Modify `src/lib/export/rScript/emitters.ts`; Test `src/lib/export/rScript/emitters.regression.test.ts`

- [ ] For each: simple-linear (done), multiple-linear, logistic, poisson-nb, arima-sarima, stationarity-tests, granger-causality, var, fixed-effects, random-effects, hausman-test, did, rdd, iv-2sls, propensity-score-matching — add an `EMITTERS[id]` that emits the idiomatic call(s) + `modelsummary()` (coef tests) or the test-specific output + the figure code. Functions per the stats module: `glm(family=binomial)` / `MASS::glm.nb` / `plm(model=)` / `AER::ivreg` / `rdrobust::rdrobust` / `MatchIt::matchit` / `forecast::Arima` (or `auto.arima`) / `vars::VAR` / `tseries::adf.test`+`kpss.test` / `lmtest::grangertest`.
- [ ] **Test (unit):** each emitter produces a string containing the right function + the chosen columns. **Step: commit** per sub-group.

---

## Task 4: R emitters — group comparisons (t-tests, ANOVA family, nonparametric)

**Files:** Modify `emitters.ts`; Test `emitters.groups.test.ts`

- [ ] Add `EMITTERS[id]` for: one-sample-t, independent-t, paired-t, one-way-anova, factorial-anova, repeated-measures-anova, mixed-anova, nested-anova, welch-anova, ancova, manova, mancova, mann-whitney, wilcoxon, kruskal-wallis, friedman — mirroring each stats module's call (`t.test` / `aov` / `afex::aov_ez` / `oneway.test` / `car::Anova` / `manova` / `wilcox.test` / `kruskal.test` / `friedman.test`) + effect size + the descriptives/figure code. Unit-test each. Commit per sub-group.

---

## Task 5: R emitters — association + descriptive (9)

**Files:** Modify `emitters.ts`; Test `emitters.assoc-desc.test.ts`

- [ ] Add `EMITTERS[id]` for: pearson, spearman, kendall, chi-square-independence, chi-square-gof, fisher, summary-statistics, frequencies-crosstabs, distribution-normality — mirroring each stats module (`cor.test(method=)` / `chisq.test` / `fisher.test` / `psych::describe` / `janitor::tabyl` / `shapiro.test`+`nortest::lillie.test`) + figure. Unit-test each. Commit.

---

## Task 6: R correctness gate (the differentiator must actually run)

**Files:** Test `src/lib/export/rScript/runs-in-r.test.ts` (slow; native R via child_process, gated behind an env flag like the WebR suites)

- [ ] **Step 1:** for one representative test per family (e.g. simple-linear, logistic, fixed-effects, one-way-anova, pearson, summary-statistics): build the cleaned CSV from the test's fixture, emit the R, write both to a temp dir, `Rscript analysis.R`, and assert exit 0 + that a key number in the output matches the app's result (e.g. the coefficient). **Step 2–4:** implement + pass (install packages as needed). **Step 5:** commit. *(This proves the emitted R genuinely runs, not just looks right.)*

---

## Task 7: PDF — browser print-to-PDF

**Files:** Create `src/lib/export/print.css`; Modify `src/components/screens/ResultsScreen.tsx`; Modify `src/main.tsx` or `App.tsx` (import print.css); Test `src/components/screens/ResultsScreen.print.test.tsx`

- [ ] **Step 1: failing test** — toggling a `printing` class on `<body>` (or a wrapper) hides elements marked `data-noprint` (nav/stepper, export controls, buttons) and the results cards remain. **Step 2:** fails. **Step 3: implement** `print.css` (`@media print` + a `.printing` class): hide `[data-noprint]`, results cards full-width, `.card { break-inside: avoid }`, `page-break-before: always` between test cards; tag the nav/stepper/export-bar with `data-noprint`. **Step 4:** the Download flow, when `formats.pdf`, toggles the class + calls `window.print()` then untoggles on `afterprint`. **Step 5:** pass + commit. (Visual confirmation of the actual PDF at Benjie's click-through.)

---

## Task 8: LaTeX — booktabs report

**Files:** Create `src/lib/export/rTable.ts`, `latex.ts`; Test `src/lib/export/latex.test.ts`, `rTable.test.ts`

- [ ] **Step 1 (rTable):** `coefToLatex(table: BuiltTable)` → a booktabs `tabular` from the coef structure (model columns as headers; per term the estimate row + `(SE)` + `[CI]`; `\midrule` then GOF rows; spanning rows via `\multicolumn`); `classicToLatex(table)` → booktabs from `columns`+`rows`. LaTeX-escape `_ % & # $ ~ ^ \`. Unit-test both shapes (incl. a side-by-side coef table).
- [ ] **Step 2 (latex):** `emitLatex(selection, setups, specs, runs)` → preamble (`\documentclass{article}`, `\usepackage{booktabs,graphicx,siunitx}`) + per test in order: `\section{<name>}` → tables (rTable) → `\includegraphics{figures/NN_id/figure_*.png}` → how-to-read + APA paragraphs. **Step 3:** unit-test structure + escaping. **Step 4:** commit.

---

## Task 9: LICENSES + bundle assembly

**Files:** Create `src/lib/export/licenses.ts` (the licence texts/notice) ; Modify the export flow

- [ ] **Step 1:** `licensesText()` returns a `LICENSES.txt` body crediting the bundled R packages, the fonts (Crimson Pro / Atkinson Hyperlegible — OFL), and WebR, with their licence names + links. **Step 2:** unit-test it contains the OFL + the key package names. **Step 3:** commit.

---

## Task 10: Download UX wiring

**Files:** Modify `src/components/screens/ResultsScreen.tsx`; Test extend `ResultsScreen` test

- [ ] **Step 1:** enable the 3 checkboxes (remove `disabled`, drop "coming in a later slice"). Extend `formats` state with `r`, `latex`, `pdf`. **Step 2:** in `download()`: build the file map — if `formats.r` add `analysis.R` (emitRScript) + `cleaned.csv` (toCsv(workingDataset)); if `formats.latex` add `report.tex` (emitLatex) + the figure PNGs under `figures/`; keep the existing table/figure PNGs; always add `LICENSES.txt`; zip → `telos-export.zip`. If `formats.pdf`, after the zip, run the print flow (Task 7). If PDF is the only tick, skip the zip. **Step 3:** test the file map for a R+LaTeX selection contains the expected entries. **Step 4:** commit.

---

## Task 11: e2e

**Files:** Modify a journey in `tests/e2e/` (e.g. `regression.spec.ts` or `flow.spec.ts`)

- [ ] Tick R + LaTeX + tables, Download, unzip the blob, assert it contains `analysis.R`, `cleaned.csv`, `report.tex`, `figures/…`, `LICENSES.txt`, and a `table_*.png`. (PDF/print isn't e2e-tested — covered by the print unit test + click-through.) Commit.

---

## Task 12: Docs + gates + ratify + notify

- [ ] README (export now live — R/PDF/LaTeX) + ROADMAP (slice → Done). **Gates:** tsc 0 · full vitest ×2 (incl. the R-runs gate where the machine has R) · e2e · build · fresh-clone. Assemble ratify list (`docs/superpowers/reviews/2026-06-17-export-formats-review.md`): R-script coverage confirmed all-40; PDF = browser print (UX = print dialog); LaTeX native booktabs; LICENSES contents; any package the student must install. Update `telos-build-phase` memory. **PushNotification** when green. **NEVER push/deploy.**

---

## Self-review

- **Spec coverage:** R script §4 → Tasks 1–6; PDF §5 → Task 7; LaTeX §6 → Task 8; LICENSES §7 → Task 9; Download UX §7 → Task 10; testing §8 → Tasks 6/11 + per-task units. ✓
- **Scope:** large but cohesive; built incrementally (R → PDF → LaTeX), each family verified. The R emitters (Tasks 3–5) are the bulk — parallelizable by family in worktrees, mirroring each stats module.
- **Type consistency:** `emitRScript`, `EMITTERS`, `toCsv`, `emitLatex`, `coefToLatex`/`classicToLatex`, `licensesText` used consistently; all consume the grounded `Dataset`/`TestSetup`/`BuiltTable` types.
- **Open/ratify (surfaced):** PDF print = a dialog not a silent download (UX); the student must `install.packages(...)`; LaTeX includes figures as images (figures are inherently images).
