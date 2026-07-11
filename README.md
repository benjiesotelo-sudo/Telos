<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/brand/telos-mark-dark.svg">
    <img src="docs/brand/telos-mark-light.svg" width="110" alt="The Telos mark: three nodes on a path">
  </picture>
</p>

<h1 align="center">Telos</h1>

<p align="center">
  <a href="https://telos-stats.pages.dev"><b>Use it now: telos-stats.pages.dev</b></a>
</p>

<p align="center">
  <a href="https://github.com/benjiesotelo-sudo/Telos/actions/workflows/ci.yml"><img src="https://github.com/benjiesotelo-sudo/Telos/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://doi.org/10.5281/zenodo.21281648"><img src="https://zenodo.org/badge/DOI/10.5281/zenodo.21281648.svg" alt="DOI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-8c3a1d" alt="License: AGPL-3.0"></a>
</p>

Telos is browser-based statistical analysis for thesis students.
All computation runs client-side in WebR (R compiled to WebAssembly), so your data never leaves the browser.
There is no server, no account, and nothing to install.

The app is a seven-step guided flow: **Welcome, Upload, Terms guide, Configure data, Pick a test, Configure test, Results and export**.
It runs 48 statistical tests live, spanning descriptives, frequencies and normality, the t-test and full ANOVA families (through MANCOVA), the rank-based tests (Mann-Whitney, Wilcoxon, Kruskal-Wallis, Friedman), association (Pearson, Spearman, Kendall, the chi-square family, Fisher's exact), regression (linear, logistic, Poisson and negative binomial), econometrics (ARIMA/SARIMA, stationarity, Granger, VAR, panel models, DiD, IV, RDD, PSM), and latent-variable modeling (reliability, EFA, PCA, CB-SEM, PLS-SEM, and path analysis on a drawable canvas).
Results come out as APA tables, figures, and plain-language how-to-read notes, with citations for every method.

## Why trust the numbers

Every statistic the app can produce is pinned against native R 4.6.0.

- Each test has a known-answer suite: the WebR result must match values computed in native R, to tight tolerances, before anything ships.
- The exported `analysis.R` is itself gate-tested: a CI-adjacent suite runs it under native R and requires it to reproduce the app's numbers (`src/lib/export/rScript/runs-in-r.test.ts`).
- Every test also carries a single-file audit document with the app's output and the native R output side by side: [browse all 48](https://benjiesotelo-sudo.github.io/Telos/test-documentation/index.html) (also in-repo at `docs/test-documentation/`).

## Quick start (development)

```bash
npm install          # install deps + postinstall copies the WebR runtime to public/webr/
npm run dev          # dev server at http://localhost:5173
npm run test:fast    # everything except the WebR engine suites (~1,700 tests, ~30 s) - the fast inner loop
npm test             # full vitest suite incl. WebR engine + native-R parity tests (~30 minutes)
npm run e2e          # Playwright journeys (installs Chromium on first run)
npm run build        # tsc + copy-webr + vite build -> dist/
npm run preview      # serve dist/ locally
```

> **First runs:** `npm run e2e` downloads Chromium (~150 MB) if not cached.
> On first visit the engine preloads R packages (ggplot2, psych, lavaan, seminr, and friends) from the WebR package repository; the browser caches them afterwards.

CI runs the fast loop (typecheck, `test:fast`, build) on every push and pull request.
The WebR engine suites, native-R parity gates, and Playwright journeys are deliberately not in CI: they take 30+ minutes and require a native R toolchain, and they are run locally as the release gate instead.

## Repository map

```
docs/specs/
  telos_test_inputs.html      ┐
  telos_test_outputs.html     ├ the three LOCKED product specs (source of truth; the
  telos_ui_spec.html          ┘ consistency tests read them at these paths - do not edit)

docs/test-documentation/      48 single-file audit docs (app output vs native R, per test)
docs/brand/                   the Telos identity kit (mark, favicon, tuned geometry)
docs/superpowers/             design docs, implementation plans, and review reports per slice

src/
  lib/registry/   one TestSpec per statistical test, encoded verbatim from the spec HTML,
                  each with a *.consistency.test.ts that fails if it drifts from the card
  lib/stats/      one WebR runner per test + known-answer tests (values verified in native R)
  lib/results/    one builder per test (result -> card content) + the RUNNERS/BUILDERS maps
  lib/webr/       the WebR engine wrapper (init, runJson, capturePlot)
  lib/format/     APA number formatting helpers
  lib/data/       CSV/Excel parsing and column typing
  lib/export/     PNG capture, R script + LaTeX emitters, zip bundling
  components/     React components (screens/ holds one component per flow step)
  state/          the Zustand session store: step machine, gates, run lifecycle
  styles/         design tokens (light canonical, dark/auto variants)

tests/e2e/        Playwright journeys; fixtures/ holds the sample CSVs
scripts/          copy-webr.mjs - copies + decompresses the WebR runtime into public/webr/
public/           static assets: fonts, COOP/COEP headers file, self-hosted WebR (gitignored)
```

## Architecture notes

### COOP/COEP (cross-origin isolation)

WebR's WebAssembly worker requires `SharedArrayBuffer`, which browsers gate behind cross-origin isolation.
Two places set the required headers:

- **Dev/preview**: `vite.config.ts` injects `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on every response.
- **Production (Cloudflare Pages)**: `public/_headers` applies the same headers to `/*`.

### Self-hosted WebR

WebR ships ~70 MB of runtime + R packages.
`scripts/copy-webr.mjs` (run via `postinstall` and as part of `npm run build`) copies the webr dist from `node_modules/webr/dist` into `public/webr/` and decompresses the lazy VFS `.data.gz` images in place.
This avoids a double-gunzip bug (Vite's `Content-Encoding: gzip` + the WebR worker's own gunzip).
The `public/webr/` directory is gitignored.

### Registry-driven content

Test metadata (table columns, APA template, how-to-read text, export filenames) is encoded in `src/lib/registry/` from the `docs/specs/telos_test_outputs.html` spec.
A consistency test fails if the registry drifts from the spec.

## Export bundle

The export panel offers five tick-able formats, bundled into one `telos-export.zip` (a single file downloads directly; PDF prints instead of zipping):

- **Table images / Figure images**: each test's tables and figures as PNGs under an `NN_<test-id>/` folder.
- **R script**: a clean `analysis.R` that reproduces every selected test, plus the `cleaned.csv` it reads, verified to run under native R 4.6.0 and reproduce the app's numbers.
- **LaTeX file**: a native booktabs `report.tex` (coefficient and classic tables, figures, how-to-read and APA prose), Unicode-escaped to compile under pdfLaTeX and XeTeX.
- **PDF report**: a print-to-PDF of the results page.

Every download also carries `CITATIONS.txt` and `references.bib` (the methods and software used, with provenance), and any R or LaTeX export bundles a `LICENSES.txt` crediting the R packages, WebR, R, and the fonts.

## Deploy

```bash
npm run build && npx wrangler pages deploy dist --project-name telos-stats
```

## Contributing and support

Bug reports, questions, and pull requests all go through [GitHub Issues](https://github.com/benjiesotelo-sudo/Telos/issues).
See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines, including the never-attach-real-participant-data rule.

## Citing Telos

If Telos is useful in your research, cite it (GitHub's "Cite this repository" button uses [CITATION.cff](CITATION.cff)):

> Sotelo, B. (2026). *Telos (v1.0.0)* [Computer software]. https://doi.org/10.5281/zenodo.21281648

Every export's `CITATIONS.txt` also cites the app plus the specific statistical methods and R packages your analysis used.

## Licences

Telos is licensed under the [GNU AGPL-3.0](LICENSE).

Bundled/runtime assets:

| Asset | Licence | Source |
|---|---|---|
| R language + WebR binaries | GPLv3 | `public/webr/LICENSE.md` · [r-project.org](https://www.r-project.org) · [webr.r-wasm.org](https://webr.r-wasm.org) |
| Crimson Pro typeface | SIL OFL 1.1 | `public/fonts/OFL-CrimsonPro.txt` |
| Archivo typeface | SIL OFL 1.1 | `public/fonts/OFL-Archivo.txt` |
