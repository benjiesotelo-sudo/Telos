# Export-formats slice — ratify list & review record (2026-06-17)

The three drawn-but-disabled export formats are now live: a reproducible **R script** (+ cleaned data),
a browser **PDF** print, and a native-booktabs **LaTeX** report, plus a `LICENSES.txt` in the bundle.
Built to green on **local `main`** — **nothing pushed, nothing deployed** (both your calls).

## What was built (12 tasks)

- **R script** — `analysis.R` covering all **40 live tests**. Each emitter mirrors its stats module's
  actual call (`lm`/`glm`/`MASS::glm.nb`/`plm`/`ivreg`/`rdrobust`/`MatchIt`/`forecast`/`tseries`/`vars`/
  `lmtest`/`t.test`/`aov`/`afex`/`car::Anova`/`wilcox.test`/`kruskal.test`/`friedman.test`/`cor.test`/
  `chisq.test`/`fisher.test`/`psych::describe`/`janitor::tabyl`/`shapiro.test`+`nortest`), with
  `modelsummary()` coefficient tables and ggplot2 figures, plus the `cleaned.csv` it reads.
- **PDF** — print-to-PDF via a print stylesheet (`print.css`) + `window.print()`; the nav/stepper/theme/
  export bar are hidden, one result card per page.
- **LaTeX** — `report.tex`, native booktabs: coefficient + classic + side-by-side tables, `\multicolumn`
  span rows (e.g. Hausman χ², IV diagnostics), `\includegraphics` figures, how-to-read + APA prose.
- **LICENSES.txt** — credits the R packages the script uses (exact union of the emitters), WebR, R, and the
  two fonts (OFL).
- **Download UX** — the three checkboxes are live; one `telos-export.zip` (a lone file downloads directly;
  ticking PDF triggers the print dialog).

## Gate evidence

- **tsc** 0 · **`test:fast`** 829/829 (101 files).
- **Native-R correctness (the differentiator):** a comprehensive sweep emitted every one of the **40** tests'
  R against its real fixture+config and ran it under **native R 4.6.0** — **40/40 run clean and reproduce the
  app's numbers** (econometrics cross-checked against the lh/Nile/Canada spike datasets). A committed,
  `skipIf`-guarded gate (`src/lib/export/rScript/runs-in-r.test.ts`, 12 representatives incl. the bug cases)
  keeps this honest; it is excluded from `test:fast` and runs in the full suite where `Rscript` exists.
- **LaTeX compiles:** a representative `report.tex` (coef + classic + two side-by-side tables + spans +
  figures) compiles under **tectonic (XeTeX)** to a valid PDF; the output is Unicode-escaped to pure ASCII
  LaTeX so it also compiles under default pdfLaTeX.
- **e2e:** the regression journey ticks R + LaTeX + tables, downloads, and asserts the unzip contains
  `analysis.R`, `cleaned.csv`, `report.tex`, `LICENSES.txt`, `figures/NN_id/…`, and `table_*.png` (green).
- A combined adversarial review (3 agents) found 1 blocker + 1 major + minors — **all fixed** (see below).

## Decisions for you to ratify

1. **R faithfulness approach** — the emitted R reads `cleaned.csv` with the **real column names** and mirrors
   each test's *call* idiomatically (no WebR env-vars / `.telos_json` / flat-pack). Same call ⇒ same numbers
   (native-R-verified). This is "clean R a student can read and re-run", not a transcript of the in-app engine.
2. **`modelsummary` GOF footer** omits the F-statistic (`'f'`) and reorders vs the spec's illustrative example
   — it matches the verified spike §3 call; results are correct. Confirm the F-row staying out of the footer is fine.
3. **LICENSES scope** — added only when **R or LaTeX** is exported (the formats whose bundled packages/fonts the
   licence credits); pure image-only exports stay lean. (The plan said "always" — I scoped it; your call.)
4. **PDF = a print dialog**, not a silent file. One Download click with PDF ticked builds any zip *then* opens
   the browser print dialog. **PDF is the one format not e2e-tested — please eyeball the printed PDF at your
   click-through.**
5. **LaTeX number alignment** — tables are left-aligned (`l` columns); `siunitx` is loaded but no decimal
   `S`-columns are used. Confirm left-alignment is acceptable (vs decimal-aligned numerics).
6. **Internal structure** (invisible, no behaviour change) — the R emitters are split into per-family modules
   (`rScript/emitters/{regression,groups,assocDesc}.ts`) instead of one `emitters.ts`, so the families could
   be built in parallel. Flagging only for transparency.

## Fixed during review (no action needed — listed for the record)

- **Blocker** — LaTeX `\includegraphics` figure folders now use the **full-selection index** (matching the zip
  folders and the on-screen card numbers), so figures resolve even when an earlier-selected test errored/was stale.
- **Major** — `escapeLatex` now maps every Unicode glyph the app emits (`−`, Greek α/β/χ/η/σ/ω…, `²`/`³`, `×`,
  `≤`/`≥`, `→`, `<`/`>`, dashes, ellipsis) to ASCII LaTeX, so the report renders on pdfLaTeX (previously the
  Greek silently dropped under XeTeX and pdfLaTeX would hard-error).
- **Bug** — Poisson/NB dispersion line had an inline comment swallowing the `print()` paren (the native-R gate
  caught it); fixed.
- Minors — grouped `summary-statistics` no longer uses `describeBy(bare vector)` (was spike-forbidden garbage);
  small-n normality guarded; blank categorical cells pre-filtered (chi-square/Fisher/frequencies); `mancova`
  uses name-safe positional identifiers; LICENSES reconciled to the exact emitter package union (added MASS,
  dropped stale urca); `printReport` listener `{ once: true }`; single-file MIME from extension.

## Known limitations (accept or queue)

- **Non-syntactic column names** — the emitted R/LaTeX assume syntactic column names (the app's datasets are
  clean); columns with spaces/special characters may need manual back-tick quoting in the script. Not hardened.
- A few **figure recipes** (e.g. logistic ROC, ARIMA/VAR diagnostics, DiD trends) reproduce the same data via a
  slightly different but numerically-equivalent ggplot composition than the in-app WebR figure code.

## Carryover (your standing calls — unchanged)

- **Push / deploy** — nothing pushed or deployed; the whole export slice sits on local `main` (+N commits).
- Prior econometrics ratify list (`reviews/2026-06-15-econometrics-panel-causal-ratify.md`); design-theme menu;
  eventual first deploy.
- **Next slice** per the roadmap: Latent variables & SEM.
