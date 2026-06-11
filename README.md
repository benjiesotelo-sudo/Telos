# Telos

Browser-based statistical analysis for thesis students. All computation runs client-side in WebR (R compiled to WebAssembly) — data never leaves the browser. This is the walking-skeleton slice: one test, the independent t-test, end to end.

## Commands

```bash
npm install          # install deps + postinstall copies WebR runtime to public/webr/
npm run dev          # dev server at http://localhost:5173
npm test             # vitest unit tests (19 tests)
npm run e2e          # playwright test -- installs Chromium itself on first run
npm run build        # tsc + copy-webr + vite build → dist/
npm run preview      # serve dist/ locally for manual check
```

> **First runs:** `npm run e2e` downloads Chromium (~150 MB) if not cached.
> The first analysis run in dev/preview/e2e also fetches ggplot2 and its dependencies
> from the WebR package repository; the browser caches these afterwards.

## Architecture notes

### COOP/COEP (cross-origin isolation)

WebR's WebAssembly worker requires `SharedArrayBuffer`, which browsers gate behind cross-origin isolation. Two places set the required headers:

- **Dev/preview**: `vite.config.ts` injects `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` on every response.
- **Production (Cloudflare Pages)**: `public/_headers` applies the same headers to `/*`.

### Self-hosted WebR

WebR ships ~70 MB of runtime + R packages. `scripts/copy-webr.mjs` (run via `postinstall` and as part of `npm run build`) copies the webr dist from `node_modules/webr/dist` into `public/webr/` and decompresses the lazy VFS `.data.gz` images in place. This avoids a double-gunzip bug (Vite's `Content-Encoding: gzip` + the WebR worker's own gunzip). The `public/webr/` directory is gitignored.

### Registry-driven content

Test metadata (table columns, APA template, how-to-read text, export filenames) is encoded in `src/registry/` from the `telos_test_outputs.html` spec. A consistency test fails if the registry drifts from the spec.

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

The zip currently contains only `01_independent-t-test/` images (the plot and table PNGs). `report.pdf`, `report.tex`, `analysis.R`, and `data/cleaned.csv` are planned for a later build slice, which will also add a LICENSES note to the bundle.

## Licences

| Asset | Licence | Source |
|---|---|---|
| R language + WebR binaries | GPLv3 | `public/webr/LICENSE.md` · [r-project.org](https://www.r-project.org) · [webr.r-wasm.org](https://webr.r-wasm.org) |
| Crimson Pro typeface | SIL OFL 1.1 | `public/fonts/OFL-CrimsonPro.txt` |
| Atkinson Hyperlegible typeface | SIL OFL 1.1 | `public/fonts/OFL-AtkinsonHyperlegible.txt` |
