# Telos

Browser-based statistical analysis for thesis students. All computation runs client-side in WebR (R compiled to WebAssembly) — data never leaves the browser.

The app is a seven-step guided flow: **Welcome → Upload** (CSV or Excel with a sheet picker) **→ Terms guide** (measurement levels, missingness, assumptions) **→ Configure data** (column types and levels, missing-data policy) **→ Pick a test** (46 tests drawn from the spec tree; 8 of the 46 tests run live (descriptives, frequencies, normality, the t-test family, Mann-Whitney, Wilcoxon); the rest remain greyed with honest reasons) **→ Configure test** (drag columns into role slots) **→ Results / export** (APA table, figures, how-to-read, zip download).

Design language: dominantly white tool surfaces on a warm paper background, Workday-style numbered stepper (✓ done · blue-ring current · gray locked), blue `#185fa5` as the single accent, Crimson Pro in page titles only.

## Commands

```bash
npm install          # install deps + postinstall copies WebR runtime to public/webr/
npm run dev          # dev server at http://localhost:5173
npm test             # vitest unit tests (36 files / 166 tests; engine suites run serialized, ~8 minutes)
npm run e2e          # playwright test -- installs Chromium itself on first run
npm run build        # tsc + copy-webr + vite build → dist/
npm run preview      # serve dist/ locally for manual check
```

> **First runs:** `npm run e2e` downloads Chromium (~150 MB) if not cached.
> On first visit the engine preloads six R packages (ggplot2, nortest, effectsize,
> psych, coin, janitor) from the WebR package repository; the browser caches them afterwards.

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
