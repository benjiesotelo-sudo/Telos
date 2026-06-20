# Spike 0a — SVG→PNG raster finding

**Date:** 2026-06-20  
**Task:** Spike 0a (Task 1, SEM Sub-slice B de-risking)  
**Verdict: SUCCESS — success bar MET, no fallback required**

---

## What was tested

An annotated path-diagram SVG (two latent ovals + item rectangle + β-labelled directed path + R² annotation) was rendered in a standalone HTML page served by the Vite dev server (port 5173, COOP/COEP isolation active), then rastered via `html-to-image`'s `toPng` at `pixelRatio: 2` — the exact same call that `captureNode()` in `src/lib/export/capture.ts` makes.

Webfonts exercised (real filenames from `src/styles/tokens.css` `@font-face` rules):
- Crimson Pro 600: `q5uDsoa5M_tv7IihmnkabARboYF6CsKj.woff2`
- Atkinson Hyperlegible 400: `9Bt23C1KxNDXMspQ1lPyU89-1h6ONRlW45G04pIoWQeCbA.woff2`
- Atkinson Hyperlegible 700: `9Bt73C1KxNDXMspQ1lPyU89-1h6ONRlW45G8Wbc9dCWPRl-uFQ.woff2`

---

## Measured numbers (headless Playwright, Chromium)

| Metric | Value | Bar | Pass? |
|--------|-------|-----|-------|
| Raster width (px) | **1104** | > 900 | YES |
| Raster height (px) | 550 | — | — |
| `nonBlankRatio` | **0.0232** | > 0.02 | YES |
| Data-URL length (chars) | 58 338 | — | — |
| PNG file size | 43 737 bytes | — | — |
| DPR | 2 | pinned to 2 | YES |

Raw output: `len=58338 w=1104 h=550 nonBlankRatio=0.0232 dpr=2`  
(file: `0a-raster-headless.txt`)

---

## Visual inspection

The rendered PNG (`0a-raster-headless.png`) shows:

- Latent ovals (Trust, Loyalty) with blue `#185fa5` stroke — **present**
- Oval labels in **Crimson Pro** (serif, bold weight) — **rendered, no tofu**
- β = 0.68*** path label in **Atkinson Hyperlegible** (sans-serif) — **rendered, no tofu**
- R² = 0.46 annotation in **Atkinson Hyperlegible** — **rendered, no tofu**
- trust1 indicator rectangle with connecting line — **present**
- Arrow marker at path end — **present and correctly drawn**
- Background white, no clipping artefacts

No blank glyphs, no tofu boxes, no font-substitution artefacts observed.

---

## COOP/COEP isolation

Vite dev server was started with the project's production isolation headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

`toPng` completed successfully under these headers. No `SharedArrayBuffer`-related errors, no CORS errors for font loading (fonts are same-origin under `/fonts/`). This confirms D8: the `captureNode` path works under the app's security posture.

---

## Playwright probe result

```
1 passed (2.0s)
```

Config: `docs/superpowers/reviews/2026-06-20-sem-b-spike-data/playwright-spike.config.ts` (spike-local config with `testDir: '.'` and `baseURL: 'http://localhost:5173'`).

---

## Fallbacks

None triggered. For the record, the brief named three fallbacks:

1. **Webfont glyphs fail to raster** → inline font as base64 `@font-face` in SVG `<defs><style>`. *Not needed: webfonts rendered correctly.*
2. **Inline base64 also fails** → fall back to system serif/sans stack in exported SVG only. *Not needed.*
3. **DPR mismatch diverges three sizes** → pin SVG `viewBox`+`width` so intrinsic size × DPR 2 is canonical. *Not needed: single canonical DPR 2 confirmed.*

---

## Output artefacts

| File | Description |
|------|-------------|
| `raster-fixture.html` | Standalone SVG fixture (also served as `public/sem-b-spike/raster-fixture.html`) |
| `raster-0a.spec.ts` | Headless Playwright probe |
| `playwright-spike.config.ts` | Spike-local Playwright config |
| `0a-raster-headless.txt` | Measured numbers output by the probe |
| `0a-raster-headless.png` | PNG written by the probe — visually verified clean |
| `0a-svg-raster.md` | This finding document |

---

## Decision ratified

**D8 (export-figure strategy): CONFIRMED — use `captureNode` / `html-to-image` `toPng` at DPR 2.**  
Unit 3c's `captureNode`-of-the-`<svg id="figure-path-diagram-${testId}">` raster will produce a clean, webfont-rendered PNG under the app's COOP/COEP isolation. No fallback plumbing is required.
