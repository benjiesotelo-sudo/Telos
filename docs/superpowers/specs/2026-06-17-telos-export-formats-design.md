# Telos — export formats (R script · PDF · LaTeX) design

**Date:** 2026-06-17
**Status:** DRAFT — awaiting Benjie's review
**Slice:** Export formats (the three currently-disabled formats) — pre-SEM

## 1. Goal & scope

Implement the three export formats currently drawn but disabled ("coming in a later slice") on the Results screen, fulfilling the Welcome promise of a **reproducible R script** plus a formatted report:

- **R script (.R)** — clean, idiomatic, runnable R that reproduces every selected test's computation + figures, bundled with the cleaned dataset. **Covers all 40 live tests** (Benjie's call).
- **PDF report** — the rendered results as a paper document, via **browser print-to-PDF** (Benjie's call).
- **LaTeX (.tex)** — a compilable report with **native booktabs tables** (Benjie's call), figures via `\includegraphics`, and the how-to-read + APA text.

The existing table/figure **PNG** exports stay. Nothing else changes.

## 2. Decisions (Benjie, 2026-06-17)

1. **Scope** — all three formats this slice.
2. **R script** — clean idiomatic R (standard `lm`/`glm`/`plm` + `modelsummary` + `ggplot2` calls), **not** the app's internal env-injected plumbing. Covers **all 40 tests**.
3. **PDF** — browser print-to-PDF (a print stylesheet + `window.print()`), reusing the real rendered report. No new PDF dependency.
4. **LaTeX** — native booktabs tables generated from the structured table data; figures `\includegraphics` the captured PNGs.

## 3. Architecture

New `src/lib/export/` modules, each a pure `data → string/bytes` function (no React, no engine), unit-testable against fixtures. The Results screen's existing `download()` flow gains the three formats.

```
src/lib/export/
  rScript/
    emit.ts            # assembler: header + per-test blocks + cleaned-CSV reference
    emitters.ts        # family-grouped per-test R emitters (see §4)
    helpers.ts         # shared R snippets (read CSV, factor/level coercion, modelsummary call, ggplot2)
  latex.ts             # .tex report: preamble + per-test booktabs tables + figures + text
  rTable.ts            # turn a built table (classic rows OR coef rows/gof) into booktabs LaTeX
  print.css            # PDF: print stylesheet (imported; scoped to a printing class)
  bundle.ts            # (existing) fflate zip — reused
cleanedCsv.ts          # serialize the cleaned Dataset to CSV text (shared by R + the bundle)
```

`ResultsScreen.tsx`: enable the three checkboxes; the Download flow produces a single **`telos-export.zip`** for the file formats and triggers print for PDF (see §7).

## 4. R script (the bulk)

**Shape of the emitted `analysis.R`:**
```r
# Telos — reproducible analysis script
# Generated <date>. Re-run: open in R/RStudio in this folder, install packages, source the file.
# install.packages(c("modelsummary","plm","AER","MASS","forecast","vars","MatchIt","rdrobust","car","effectsize","ggplot2"))
library(modelsummary); library(ggplot2)   # + per-test libs as needed
d <- read.csv("cleaned.csv", stringsAsFactors = FALSE)
# coerce levels as configured:
d$group <- factor(d$group)            # nominal/ordinal columns

# === 01 · Simple linear regression ===
m1 <- lm(post_score ~ pre_score, data = d)
modelsummary(list("(1)" = m1), stars = FALSE, statistic = c("std.error","conf.int"), gof_map = c("nobs","r.squared","adj.r.squared","f","rmse","aic","bic","logLik"))
ggplot(d, aes(pre_score, post_score)) + geom_point() + geom_smooth(method = "lm")
# ...one block per selected test, in selection order...
```

**Emitter design — family-grouped, not 40 bespoke.** The 40 tests collapse to a handful of family templates, each parameterized by the chosen role columns + options:
- **Regression/econometrics coef family** (15) → `model <- <fn>(formula, data=d, …)` + the `modelsummary()` call (from the spike §3) + the figure(s). `<fn>`: lm / glm(family=) / MASS::glm.nb / plm(model=) / AER::ivreg / rdrobust / MatchIt::matchit / forecast::Arima / vars::VAR.
- **Group-comparison family** (t-tests, ANOVA family, nonparametric) → the test call (`t.test`/`aov`/`afex::aov_ez`/`wilcox.test`/`kruskal.test`/…) + effect size + the descriptive/figure code.
- **Association family** → `cor.test(...)` / `chisq.test(...)` / `fisher.test(...)` + figure.
- **Descriptive family** → `psych::describe` / `janitor::tabyl` / `shapiro.test` + figure.

Each family template lives in `emitters.ts` keyed by test id, sharing `helpers.ts` snippets. **Source of truth:** each emitter mirrors the model/test call its stats module already runs (so results match) — but written idiomatically. The chosen columns + options (α/CI/tails/event-category/etc.) thread into the call.

**Cleaned dataset:** `cleanedCsv.ts` serializes the post-Configure-data `Dataset` (types/levels applied, missing-data policy applied) to CSV. The R bundle = `analysis.R` + `cleaned.csv` (so it runs standalone).

**Correctness gate (critical — this is the differentiator):** a test takes the emitted R for representative tests, **runs it in native R**, and confirms it executes cleanly and reproduces the app's key numbers (the emitted script must actually work, not just look plausible).

## 5. PDF (browser print-to-PDF)

A `print.css` (media `print`, or a `.printing` body class toggled before `window.print()`): hide the nav/stepper, the export controls, buttons, and the picker chrome; show the results cards full-width; force `page-break-before` between tests; keep each table + its figure together (`break-inside: avoid`). Ticking **PDF** in the Download flow toggles the printing class and calls `window.print()`; the browser's "Save as PDF" produces the file. The coef tables print as their real HTML (native, selectable). No new dependency. (The earlier sticky-nav-overlap note is moot here — print.css hides the nav.)

## 6. LaTeX (.tex, native booktabs)

`latex.ts` emits a compilable document: preamble (`\documentclass{article}`, `booktabs`, `graphicx`, `siunitx` for number alignment), then per selected test in order:
- **Coefficient tables** → `rTable.ts` turns the coef structure (model columns, per-term estimate/(SE)/[CI] rows, GOF footer, side-by-side columns, spanning rows) into a booktabs `tabular`. Classic tables (ANOVA, contingency, descriptives) → booktabs from their `columns` + `rows`.
- **Figures** → `\includegraphics` the captured PNGs (bundled into the zip under `figures/`).
- **How-to-read + APA** text as paragraphs.
LaTeX special chars escaped (`_ % & # $ ~ ^ \`). Delivered in the export zip as `report.tex` + the `figures/` PNGs. The student compiles it (pdflatex/Overleaf) — we don't compile in-browser.

## 7. Download UX (combining formats)

The Download button already takes ticked checkboxes (PNG tables/figures). Add R / LaTeX / PDF. On Download:
- **File formats** (R, LaTeX, table PNGs, figure PNGs) assemble into ONE `telos-export.zip`: `analysis.R`, `cleaned.csv`, `report.tex`, `figures/…`, and the existing per-test `NN_<id>/table_*.png` + `figure_*.png`. (A single zip avoids multiple download prompts.)
- **PDF** is handled separately: if ticked, after the zip downloads, toggle the printing class + `window.print()`. (Print can't go in a zip.) If PDF is the *only* tick, skip the zip and just print.
- Errors surface in the existing `exportError` box.

## 8. Testing

- **Unit (pure emitters):** `rScript`, `latex`, `rTable`, `cleanedCsv` — `data → string` against fixtures; assert structure + LaTeX escaping + CSV round-trip. Fast (non-WebR).
- **R-runs-correctly (the key gate):** a (slow) test that runs the emitted R for a sample across families in native R and checks it executes + reproduces the app's numbers.
- **Print view:** a unit/DOM test that the `.printing` class hides controls + shows cards; visual confirmation at Benjie's click-through (the actual PDF).
- **e2e:** extend a journey to tick R + LaTeX, download the zip, and assert it contains `analysis.R` / `cleaned.csv` / `report.tex` / `figures/`.
- Full gates ×2 + fresh clone, per standing process.

## 9. Risks / open

- **Scale:** the R emitters + LaTeX table emitter touch every test type — the biggest piece; family-grouping is the mitigation, but this is a large slice (build incrementally: R first, then PDF, then LaTeX).
- **Package availability:** the student must `install.packages(...)` to run the script — the header lists them; we can't bundle R packages.
- **LaTeX side-by-side / VAR dynamic tables:** booktabs for multi-column + dynamic-column tables needs care (the `rTable` emitter handles the coef structure generically).
- **Print fidelity:** page breaks / wide side-by-side tables on paper — tune in `print.css`; confirm at click-through.
- **modelsummary in the R script vs the app:** the app replicates modelsummary's format in TS; the R script calls real `modelsummary()` — so a re-run produces the authentic package output (the captured call from the table-format spike §3).

## 10. Sequencing

One slice, built incrementally + verifiable at each step: cleaned-CSV serializer → R-script emitters (family by family, each verified by running the R in native R) + bundle → PDF print.css + wiring → LaTeX emitter (`rTable` + report) → Download UX → e2e → gates ×2 + fresh clone → ratify. **Build to green on local `main`; never push/deploy without Benjie's word.**
