# Telos

Browser-based statistical analysis for thesis students. All computation runs client-side in WebR (R compiled to WebAssembly) — data never leaves the browser.

The app is a seven-step guided flow: **Welcome → Upload** (CSV or Excel with a sheet picker) **→ Terms guide** (measurement levels, missingness, assumptions) **→ Configure data** (column types and levels, missing-data policy) **→ Pick a test** (47 tests drawn from the spec tree; 40 of the 47 run live: descriptives, frequencies, normality, the t-test family, the full ANOVA family (one-way, factorial, repeated-measures, mixed, nested, Welch's, ANCOVA, MANOVA, MANCOVA), Mann-Whitney, Wilcoxon, Kruskal-Wallis, Friedman, the Association family (Pearson, Spearman, Kendall's tau, χ² independence, χ² goodness-of-fit with custom expected proportions, Fisher's exact), the Regression family (simple linear, multiple linear, logistic, Poisson / negative binomial), and the Econometrics family (ARIMA/SARIMA, stationarity (ADF/KPSS), Granger causality, VAR, fixed effects, random effects, Hausman, difference-in-differences, instrumental variables (2SLS), regression discontinuity, propensity score matching); the rest remain greyed with honest reasons) **→ Configure test** (drag columns into role slots) **→ Results / export** (APA table, figures, how-to-read, zip download).

Design language: dominantly white tool surfaces on a warm paper background, Workday-style numbered stepper (✓ done · blue-ring current · gray locked), blue `#185fa5` as the single accent, Crimson Pro in page titles only.

## Commands

```bash
npm install          # install deps + postinstall copies WebR runtime to public/webr/
npm run dev          # dev server at http://localhost:5173
npm test             # vitest unit tests (136 files / 810 tests; engine suites run serialized, ~30 minutes)
npm run test:fast    # everything except the WebR engine suites — the seconds-fast inner loop
npm run e2e          # playwright test -- installs Chromium itself on first run
npm run build        # tsc + copy-webr + vite build → dist/
npm run preview      # serve dist/ locally for manual check
```

> **First runs:** `npm run e2e` downloads Chromium (~150 MB) if not cached.
> On first visit the engine preloads thirteen R packages (ggplot2, nortest, effectsize, psych,
> coin, janitor, afex, emmeans, car, rstatix, pROC, parameters, performance) from the WebR
> package repository; the browser caches them afterwards.

## Repository map

```
telos_test_inputs.html      ┐
telos_test_outputs.html     ├ the three LOCKED product specs (source of truth; consistency
telos_ui_spec.html          ┘ tests read them at these root paths — do not move or edit)

docs/superpowers/
  specs/      one approved design doc per build phase (architecture · frontend flow · core tests)
  plans/      the executed implementation plan for each phase
  reviews/    the two pre-build review reports (spec completeness · plan recheck)

src/
  lib/registry/   one TestSpec per statistical test, encoded verbatim from the spec HTML,
                  each with a *.consistency.test.ts that fails if it drifts from the card
  lib/stats/      one WebR runner per test + known-answer tests (values verified in native R)
  lib/results/    one builder per test (result → card content) + the RUNNERS/BUILDERS maps
  lib/webr/       the WebR engine wrapper (init, runJson, capturePlot)
  lib/format/     APA number formatting helpers
  lib/data/       CSV/Excel parsing and column typing
  lib/export/     PNG capture and zip bundling
  components/     React components (screens/ holds one component per flow step)
  state/          the Zustand session store: step machine, gates, run lifecycle
  styles/         design tokens (light canonical, dark/auto variants)

tests/e2e/        Playwright journeys (`npm run e2e`); fixtures/ holds the sample CSVs
scripts/          copy-webr.mjs — copies + decompresses the WebR runtime into public/webr/
public/           static assets: fonts, COOP/COEP headers file, self-hosted WebR (gitignored)
```

## Architecture notes

### COOP/COEP (cross-origin isolation)

WebR's WebAssembly worker requires `SharedArrayBuffer`, which browsers gate behind cross-origin isolation. Two places set the required headers:

- **Dev/preview**: `vite.config.ts` injects `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on every response.
- **Production (Cloudflare Pages)**: `public/_headers` applies the same headers to `/*`.

### Self-hosted WebR

WebR ships ~70 MB of runtime + R packages. `scripts/copy-webr.mjs` (run via `postinstall` and as part of `npm run build`) copies the webr dist from `node_modules/webr/dist` into `public/webr/` and decompresses the lazy VFS `.data.gz` images in place. This avoids a double-gunzip bug (Vite's `Content-Encoding: gzip` + the WebR worker's own gunzip). The `public/webr/` directory is gitignored.

### Registry-driven content

Test metadata (table columns, APA template, how-to-read text, export filenames) is encoded in `src/lib/registry/` from the `telos_test_outputs.html` spec. A consistency test fails if the registry drifts from the spec.

## Deploy

One-time project setup (run once per account):

```bash
npx wrangler pages project create telos --production-branch main
```

Deploy:

```bash
npm run build && npx wrangler pages deploy dist --project-name telos
```

## Export bundle

The zip contains one `NN_<test-id>/` folder per test run (NN = the test's position on the results page), each holding that card's table and figure PNGs named from its spec bundle line. The PDF report, LaTeX file, and R script checkboxes are visible in the export panel but disabled — they are deferred to a later build slice, which will also add a `LICENSES` note to the bundle.

## Licences

| Asset | Licence | Source |
|---|---|---|
| R language + WebR binaries | GPLv3 | `public/webr/LICENSE.md` · [r-project.org](https://www.r-project.org) · [webr.r-wasm.org](https://webr.r-wasm.org) |
| Crimson Pro typeface | SIL OFL 1.1 | `public/fonts/OFL-CrimsonPro.txt` |
| Atkinson Hyperlegible typeface | SIL OFL 1.1 | `public/fonts/OFL-AtkinsonHyperlegible.txt` |
