# SEM Sub-slice B (CB-SEM, PLS-SEM & the AMOS canvas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the final two tests — CB-SEM and PLS-SEM — plus path analysis (auto-detected observed-only CB-SEM) and embedded mediation, built around an interactive AMOS-style path canvas, taking the catalog to 47/47 live.

**Architecture:** A hybrid input surface — the existing construct-slots **form** defines the measurement model; a new `SemCanvas` (SVG) draws the **structural paths** and renders the post-run annotated diagram. Stats run in WebR via two new modules (`runCbSem` lavaan, `runPlsSem` seminr) that reuse Slice-A's `runCfaReliability`; the diagram figure is rasterized to PNG with the existing `captureNode`/`html-to-image` path; bootstrap is a single percentile-CI call with a time-based progress bar.

**Tech Stack:** React 19 + TypeScript + Vite · Zustand · WebR (R 4.6.0 → WASM): lavaan, semTools, GPArotation (preloaded), **seminr** (new), semPlot (export only) · dnd-kit · html-to-image · Playwright · Vitest.

**Design spec:** `docs/superpowers/specs/2026-06-20-telos-sem-cbsem-plssem-canvas-design.md` (read it first — it carries the owner rulings D1–D11 + §11, the reporting convention, and the adversarial-review fold-in).

## Global Constraints

- **WebR ≡ native R 4.6.0** for every statistic — proven by a per-card stats test AND the `runs-in-r` native gate.
- **Report-only APA** — numbers, never a verdict (match existing cards).
- **Bootstrap:** 5000 default both tracks; CI type = **percentile** (lavaan `boot.ci.type='perc'`; matching seminr percentile); **BCa only at the 10k preset**. **ONE awaited bootstrap call — never RNG-chunked** (chunking changes the resample sequence and would fail the single-call native gate). `gc()` around it. Progress = elapsed timer + spike-calibrated estimate, NOT per-resample counts.
- **IDs numeric end-to-end** (`Construct.id: number`) — no string/number `===` mismatch (the prototype's bug class).
- **Discriminator:** `TestSpec.inputKind?: 'construct-slots' | 'sem-canvas'` REPLACES the old `constructsInput?: true` boolean — migrate AVE/CR + the 3 call sites + their consistency tests.
- **df==0 saturation:** keyed strictly on `fitMeasures(fit,'df')==0`; ONE shared predicate used by the builder, the emitter, and the `runs-in-r` gate.
- **Figure:** live `<svg>` on screen; export PNG via the EXISTING `captureNode()` (`src/lib/export/capture.ts`) layered in `ResultsScreen.download()` like table PNGs — NOT through `CardContent.figures[].png`. `analysis.R` uses `semPlot::semPaths()`.
- **App tokens:** blue `#185fa5`, white cards, paper `#f0efe9`; latent = oval, observed (path mode) = rectangle.
- **TDD:** failing test → run (verify FAIL) → minimal implement → run (verify PASS) → commit. Bite-sized steps.
- **Slice gates:** `tsc` 0 · full WebR vitest ×2 · e2e (Playwright) · fresh-clone.
- **Owner protocol:** do not push/deploy without the owner's word.

## File Structure

**Create:**
- `src/components/SemCanvas.tsx` — `SemCanvasUI` (pure) + `SemCanvas` (connected). Render + interactions + post-run estimates overlay.
- `src/lib/stats/runCbSem.ts` / `runPlsSem.ts` — the two stats engines (+ `.test.ts` each).
- `src/lib/results/buildCbSem.ts` / `buildPlsSem.ts` — result → `CardContent`.
- `src/lib/registry/cbSem.ts` / `plsSem.ts` (+ `.consistency.test.ts` each) — `TestSpec`s.
- `docs/superpowers/reviews/2026-06-20-sem-b-spike-data/*` — Unit 0 spikes + findings.

**Modify:**
- `src/state/session.ts` — `Construct.id`/`paths`/`modelKind`/`mode`/`x`/`y`; new actions; `gateOk` canvas branch; `runProgress` state; `Runner` type + `runAll`.
- `src/lib/registry/types.ts` — `inputKind` (drop `constructsInput`).
- `src/lib/registry/ave.ts` / `compositeReliability.ts` (+ their consistency tests) — `inputKind` migration.
- `src/lib/eligibility/eligibility.ts` — `inputKind` handling.
- `src/components/screens/TestConfigScreen.tsx` — `sem-canvas` routing + bespoke controls.
- `src/components/ConstructSlots.tsx` — id-addressed actions.
- `src/lib/webr/engine.ts` — `seminr` preload (eager/lazy decision).
- `src/lib/results/builders.ts` — `Runner` type, `RUNNERS`/`BUILDERS` dispatch.
- `src/lib/export/rScript/emitters/latent.ts` — `cb-sem`/`pls-sem` emitters (+ `semPaths`).
- `src/lib/export/rScript/runs-in-r.test.ts` — `cb-sem`/`pls-sem`/`path-analysis`.
- `src/components/screens/ResultsScreen.tsx` — figure raster + progress bar.
- `src/lib/export/capture.ts` — (if needed) extend for the SVG node.
- `src/lib/registry/catalog.ts` (+ `catalog.consistency.test.ts`, `specHtml.ts`) — flip status, path-analysis entry, `SPECS`.
- `telos_test_inputs.html` / `telos_test_outputs.html` — §6 amendments.
- `docs/.../TEST_CATALOG.md`, `README.md`.

## Shared Interfaces (the cross-task consistency contract)

```ts
// src/state/session.ts
interface Construct { id: number; name: string; items: string[]; mode?: 'reflective'|'formative'; x?: number; y?: number }
interface StructuralPath { from: number; to: number }   // construct ids
interface TestSetup { roles: Record<string,string[]>; options: Record<string,boolean|number|string>; props: Record<string,number>; blocked: string|null; constructs?: Construct[]; paths?: StructuralPath[]; modelKind?: 'latent'|'path' }
// actions (through edit()->revalidated()): addPath(testId,from:number,to:number) · removePath(testId,index:number) · moveNode(testId,id:number,x:number,y:number) · setConstructMode(testId,id:number,mode) ; construct actions id-addressed; legacy constructs get id back-filled by index on load.
// gateOk sem-canvas branch: (≥1 construct with ≥2 items) AND (paths.length ≥ 1); path mode relaxes the ≥2-items rule (each node = 1 column).

// src/lib/registry/types.ts
TestSpec.inputKind?: 'construct-slots' | 'sem-canvas'   // replaces constructsInput?: true

// progress channel
type RunProgress = (p: { message: string; elapsedMs?: number; estMs?: number }) => void
type Runner = (engine: Engine, ds: Dataset, setup: TestSetup, onProgress?: RunProgress) => Promise<unknown>
// session gains runProgress: { message; elapsedMs?; estMs? } | null, set during runAll, cleared after.

// stats results
interface CbSemResult { mode:'full'|'cfa-only'|'path'; saturated:boolean; efaSuitability?:Record<string,number>; efaLoadings?:unknown; cfaLoadings:Array<Record<string,unknown>>; reliability:Array<Record<string,unknown>>; fit?:Record<string,number>; structural?:Array<Record<string,unknown>>; rsquare?:Record<string,number>; indirect?:Array<Record<string,unknown>>; estimates:{ paths:Array<{from:number;to:number;beta:number}>; loadings:Record<string,number>; r2:Record<number,number> } }
interface PlsSemResult { outer:Array<Record<string,unknown>>; reliability:Array<Record<string,unknown>>; htmt:{labels:string[];cells:(number|null)[][]}; structural:Array<Record<string,unknown>>; quality:Array<Record<string,unknown>>; indirect?:Array<Record<string,unknown>>; estimates:{ paths:Array<{from:number;to:number;beta:number}>; loadings:Record<string,number>; r2:Record<number,number> } }
// runCbSem(engine,data,setup,onProgress?) ; runPlsSem(engine,data,setup,onProgress?) ; reuse runCfaReliability(engine,data,constructs).

// src/components/SemCanvas.tsx
interface SemCanvasUIProps { constructs:Construct[]; columns:string[]; paths:StructuralPath[]; modelKind:'latent'|'path'; mode:'draw'|'move'|'delete'; estimates?: CbSemResult['estimates']|null; running:boolean; onAddPath(from:number,to:number):void; onRemovePath(index:number):void; onMoveNode(id:number,x:number,y:number):void; onSetMode(m:'draw'|'move'|'delete'):void }
// SemCanvasUI pure (renderToStaticMarkup-testable); SemCanvas wires useSession. On-screen annotated diagram renders into <svg id={`figure-path-diagram-${testId}`}>.
```

## Task index & dependency order

Execution order is task-number order. Key serial edges: **Unit 0 spikes gate everything** · Task 9a-c (progress channel) before Tasks 21+/25+ (runners) · Tasks 5–8 (state) before the canvas (10+) and runners · Tasks 21–24 (CB-SEM, the **worked reference**) before Tasks 25–28 (PLS-SEM, the **fan-out**) · Tasks 29–30 (estimates overlay + figure raster) after the runners.

- **1–3** — Unit 0: de-risking spikes (raster · bootstrap · PLS extras)
- **4** — Unit 1: `seminr` preload
- **5–8** — Unit 2: state migration + `inputKind` discriminator + `gateOk`
- **9a-1–9a-3** — Unit 9a: progress channel (early)
- **10–11** — Unit 3a: static `SemCanvasUI` render
- **12–14** — Unit 3b: canvas interactions (draw/move/delete/zoom/pan/resize) + id-typing regression
- **15–16** — Unit 4: `TestConfigScreen` routing + bespoke controls
- **17–20** — Unit 5: spec-HTML amendments + registries + consistency tests
- **21–24** — Unit 6: `runCbSem` + builder + emitter + tests (worked reference)
- **25–28** — Unit 7: `runPlsSem` + builder + emitter + tests (fan-out)
- **29–30** — Unit 3c: estimates overlay + `captureNode` figure raster
- **31–32** — Unit 8: path-analysis entry + observed mode + df==0 predicate
- **33–35** — Unit 10: catalog/docs/integration + full gates + owner click-through

---

### Task 1: Spike 0a — SVG→PNG raster of the annotated path diagram with app webfonts
**Files:** Create `docs/superpowers/reviews/2026-06-20-sem-b-spike-data/raster-0a.spec.ts` (headless Playwright) · Create `docs/superpowers/reviews/2026-06-20-sem-b-spike-data/raster-fixture.html` (standalone SVG fixture) · Record `docs/superpowers/reviews/2026-06-20-sem-b-spike-data/0a-svg-raster.md`.
**Interfaces:** Consumes: existing `captureNode()` (`src/lib/export/capture.ts`, `html-to-image` `toPng`, `pixelRatio:2`) · Produces: a ratified DPR + webfont strategy that Unit 3c's `captureNode`-of-the-`<svg id={figure-path-diagram-${testId}}>` raster relies on.
- [ ] **Step 1: Build the SVG fixture** — a standalone HTML page that renders an annotated path diagram SVG (two latent ovals + item rectangles + a β-labelled path + an R² annotation) using the *app webfonts* (Crimson Pro, Atkinson Hyperlegible) and app tokens (blue `#185fa5`, paper `#f0efe9`), with a `<button id="raster">` that calls `html-to-image`'s `toPng` on the SVG node and writes the data-URL length + a thumbnail into the DOM. Show COMPLETE fixture code.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>0a SVG raster fixture</title>
<style>
  @font-face { font-family:'Crimson Pro'; src:url('/fonts/CrimsonPro.woff2') format('woff2'); font-display:swap; }
  @font-face { font-family:'Atkinson Hyperlegible'; src:url('/fonts/AtkinsonHyperlegible.woff2') format('woff2'); font-display:swap; }
  body { background:#f0efe9; font-family:'Crimson Pro', serif; margin:0; padding:24px; }
  #out { font-family:'Atkinson Hyperlegible', sans-serif; font-size:13px; }
  img { border:1px solid #185fa5; margin-top:12px; }
</style>
</head>
<body>
  <div id="diagram" style="background:#fff;padding:16px;width:520px;">
    <svg id="figure-path-diagram-spike" width="500" height="240" viewBox="0 0 500 240"
         xmlns="http://www.w3.org/2000/svg" font-family="Crimson Pro, serif">
      <ellipse cx="110" cy="120" rx="70" ry="42" fill="#fff" stroke="#185fa5" stroke-width="2" />
      <text x="110" y="120" text-anchor="middle" dominant-baseline="middle" fill="#185fa5" font-size="18">Trust</text>
      <ellipse cx="390" cy="120" rx="70" ry="42" fill="#fff" stroke="#185fa5" stroke-width="2" />
      <text x="390" y="116" text-anchor="middle" dominant-baseline="middle" fill="#185fa5" font-size="18">Loyalty</text>
      <text x="390" y="138" text-anchor="middle" fill="#185fa5" font-size="12" font-family="Atkinson Hyperlegible, sans-serif">R² = 0.46</text>
      <rect x="20" y="20" width="64" height="26" fill="#fff" stroke="#185fa5" />
      <text x="52" y="37" text-anchor="middle" font-size="12">trust1</text>
      <line x1="84" y1="33" x2="62" y2="86" stroke="#185fa5" />
      <line x1="180" y1="120" x2="320" y2="120" stroke="#185fa5" stroke-width="2" marker-end="url(#arrow)" />
      <text x="250" y="108" text-anchor="middle" fill="#185fa5" font-size="14" font-family="Atkinson Hyperlegible, sans-serif">β = 0.68***</text>
      <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 Z" fill="#185fa5" /></marker></defs>
    </svg>
  </div>
  <button id="raster">Raster</button>
  <div id="out">pending</div>
  <script type="module">
    import { toPng } from 'https://esm.sh/html-to-image@1.11.13'
    document.getElementById('raster').addEventListener('click', async () => {
      await document.fonts.ready
      const node = document.getElementById('diagram')
      const url = await toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff' })
      const img = new Image(); img.id = 'result'; img.src = url
      document.body.appendChild(img)
      document.getElementById('out').textContent = 'len=' + url.length + ' dpr=2'
    })
  </script>
</body>
</html>
```

- [ ] **Step 2: Write the headless Playwright probe** that serves the fixture via the dev server, clicks `#raster`, waits for `#result`, reads the rendered PNG back, and asserts a non-trivial raster (size + that the glyph pixels rendered, not blank). Show COMPLETE code.

```ts
import { test, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Spike 0a — prove the annotated path-diagram SVG rasters via html-to-image with the app webfonts.
test('0a: SVG path diagram rasters to a non-blank PNG via html-to-image at DPR 2', async ({ page }) => {
  await page.goto('/sem-b-spike/raster-fixture.html')
  await page.evaluate(() => (document as any).fonts.ready)
  await page.click('#raster')
  const img = page.locator('#result')
  await expect(img).toBeVisible({ timeout: 15_000 })

  const { len, w, h, nonBlankRatio, dataUrl } = await page.evaluate(async () => {
    const el = document.getElementById('result') as HTMLImageElement
    const url = el.src
    const c = document.createElement('canvas'); c.width = el.naturalWidth; c.height = el.naturalHeight
    const ctx = c.getContext('2d')!; ctx.drawImage(el, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let nonWhite = 0, total = 0
    for (let i = 0; i < d.length; i += 4) { total++; if (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250) nonWhite++ }
    return { len: url.length, w: el.naturalWidth, h: el.naturalHeight, nonBlankRatio: nonWhite / total, dataUrl: url }
  })

  // DPR=2 against the 520×~272 diagram node ⇒ ~1040px wide raster.
  expect(w).toBeGreaterThan(900)
  // Blue strokes + glyph ink must register; a blank/font-failed raster is ~all white.
  expect(nonBlankRatio).toBeGreaterThan(0.02)

  writeFileSync(resolve(process.cwd(),
    'docs/superpowers/reviews/2026-06-20-sem-b-spike-data/0a-raster-headless.txt'),
    `len=${len} w=${w} h=${h} nonBlankRatio=${nonBlankRatio.toFixed(4)} dpr=2\n`)
  writeFileSync(resolve(process.cwd(),
    'docs/superpowers/reviews/2026-06-20-sem-b-spike-data/0a-raster-headless.png'),
    Buffer.from(dataUrl.split(',')[1], 'base64'))
})
```

- [ ] **Step 3: Run both probes** — headless via Playwright; then open the SAME fixture in a real desktop browser and click Raster by hand, saving the visible PNG. Record both.

```bash
# copy the fixture under public/ so the dev server serves it, then run the probe
mkdir -p /Users/benjie/Documents/Telos/public/sem-b-spike
cp /Users/benjie/Documents/Telos/docs/superpowers/reviews/2026-06-20-sem-b-spike-data/raster-fixture.html /Users/benjie/Documents/Telos/public/sem-b-spike/raster-fixture.html
npx playwright test docs/superpowers/reviews/2026-06-20-sem-b-spike-data/raster-0a.spec.ts --reporter=line
# real browser (manual): npm run dev, open http://localhost:5173/sem-b-spike/raster-fixture.html, click Raster, right-click→save the rendered image as 0a-raster-manual.png into the spike dir
```

- [ ] **Step 4: Write the finding `0a-svg-raster.md`** with the measured numbers (raster width/height, `nonBlankRatio`, headless vs manual visual match) and an embedded link to both PNGs.
  - **Success bar:** headless probe PASSES (`w>900`, `nonBlankRatio>0.02`) AND the manual real-browser PNG is visually identical to the headless one (ovals/rectangles/arrow/β/R² text all present and using Crimson Pro/Atkinson, no tofu/blank glyphs). DPR pinned to **2** (matching `captureNode`) so screen ≈ export ≈ semPaths stand-in are one canonical size.
  - **Fallback (record which, if triggered):** if webfont glyphs fail to raster (blank/tofu), inline the font as a base64 data-URL `@font-face` injected into the SVG `<defs><style>` before capture; if that still fails, fall back to a system serif/sans stack in the exported SVG only (screen keeps webfonts). If DPR mismatch makes the three sizes diverge, pin the SVG `viewBox`+`width` so the node's intrinsic size × DPR 2 is the single canonical raster.
- [ ] **Step 5: Commit.**

```bash
git add docs/superpowers/reviews/2026-06-20-sem-b-spike-data/
git rm -r --cached public/sem-b-spike 2>/dev/null; rm -rf /Users/benjie/Documents/Telos/public/sem-b-spike
git commit -m "spike(sem-b): 0a SVG path-diagram rasters via html-to-image at DPR 2 with app webfonts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
```

### Task 2: Spike 0b — single 5000-resample bootstrap in WASM (CB-SEM mediation + PLS), timing + percentile-CI parity
**Files:** Create `docs/superpowers/reviews/2026-06-20-sem-b-spike-data/boot-0b.R` (identical script for both runtimes) · Create `docs/superpowers/reviews/2026-06-20-sem-b-spike-data/boot-0b.webr.test.ts` (WebR-in-Node vitest harness, mirroring `webr-sem-spike.test.ts`) · Record `docs/superpowers/reviews/2026-06-20-sem-b-spike-data/0b-bootstrap.md`.
**Interfaces:** Consumes: `MAKECLUSTER_SHIM`/`DETECTCORES_SHIM` (`src/lib/webr/parallelShim.ts`, `engine.ts`); native `Rscript` 4.6.0 at `/usr/local/bin/Rscript` · Produces: the spike-calibrated per-resample time feeding `RunProgress.estMs`, and a confirmed `boot.ci.type='perc'` (lavaan) / matching seminr percentile that Unit 6/7 wire identically into the WebR block AND `analysis.R`.
- [ ] **Step 1: Write the bootstrap parity script `boot-0b.R`** — ONE awaited bootstrap each (NO RNG chunking), `gc()` around each, `set.seed` fixed, **percentile** CIs both tracks, on built-in data (PoliticalDemocracy for CB-SEM mediation; seminr `mobi` for PLS). Show COMPLETE code.

```r
# Spike 0b — single 5000-resample bootstrap, run IDENTICALLY in native R 4.6.0 and WebR 0.6.0.
# Confirms: (1) one awaited call completes in WASM (no RNG chunking), (2) percentile CIs match native,
# (3) per-resample wall-time for the progress estimate. set.seed makes the shared Mersenne-Twister bit-reproducible.
options(warn = 1)
suppressMessages({ library(lavaan); library(seminr) })
NB <- 5000
emit <- function(tag, v) cat(sprintf("%s=%s\n", tag, paste(formatC(v, format='g', digits=10), collapse=',')))

# ---- CB-SEM mediation: X -> M -> Y indirect, percentile bootstrap CI ----
set.seed(20260620)
pd <- PoliticalDemocracy
med.model <- '
  dem60 ~ a*ind60
  dem65 ~ b*dem60 + ind60
  ind:=a*b
'
gc()
t0 <- Sys.time()
fit <- sem(med.model, data = pd, se = "bootstrap", bootstrap = NB)
cb_secs <- as.numeric(difftime(Sys.time(), t0, units = "secs"))
gc()
pe <- parameterEstimates(fit, boot.ci.type = "perc", level = 0.95)
ind <- pe[pe$label == "ind", ]
emit("cb_indirect_est", ind$est); emit("cb_indirect_se", ind$se)
emit("cb_indirect_ci", c(ind$ci.lower, ind$ci.upper)); emit("cb_indirect_p", ind$pvalue)
emit("cb_nboot", NB); emit("cb_secs", round(cb_secs, 2))

# ---- PLS-SEM: seminr bootstrap, percentile CI (default), mobi ----
set.seed(20260620)
mm <- constructs(
  composite("Image",        multi_items("IMAG", 1:5)),
  composite("Expectation",  multi_items("CUEX", 1:3)),
  composite("Satisfaction", multi_items("CUSA", 1:3))
)
sm <- relationships(
  paths(from = c("Image","Expectation"), to = "Satisfaction"),
  paths(from = "Image", to = "Expectation")
)
gc()
t1 <- Sys.time()
est <- estimate_pls(data = mobi, measurement_model = mm, structural_model = sm)
bo  <- bootstrap_model(seminr_model = est, nboot = NB, cores = 1)
pls_secs <- as.numeric(difftime(Sys.time(), t1, units = "secs"))
gc()
sb <- summary(bo, alpha = 0.05)   # seminr CIs are percentile by construction
bp <- sb$bootstrapped_paths
emit("pls_path_labels", rownames(bp))
emit("pls_path_beta", bp[, "Original Est."])
emit("pls_path_ci_low", bp[, "2.5% CI"]); emit("pls_path_ci_high", bp[, "97.5% CI"])
emit("pls_nboot", NB); emit("pls_secs", round(pls_secs, 2))
```

- [ ] **Step 2: Write the WebR harness `boot-0b.webr.test.ts`** — boot WebR like `Engine.init`, apply the detectCores + makeCluster shims, install lavaan/seminr, run the SAME `boot-0b.R` via the sink-to-FS path, write the `key=value` block to `0b-webr.txt`. Show COMPLETE code.

```ts
// Spike 0b WebR harness — runs the SAME boot-0b.R native Rscript runs, under WebR 0.6.0 in Node (vitest path).
// DELETE after the spike. Long timeout: single 5000-resample bootstraps are ~minutes in WASM.
import { describe, it } from 'vitest'
import { WebR } from 'webr'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MAKECLUSTER_SHIM } from '../../../../src/lib/webr/parallelShim'

const DETECTCORES = `local({ ns <- asNamespace("parallel"); unlockBinding("detectCores", ns); assign("detectCores", function(logical = TRUE, all.tests = FALSE) 1L, envir = ns) })`

describe('SEM-B spike 0b — single 5000 bootstrap under WebR', () => {
  it('runs CB-SEM mediation + PLS percentile bootstrap to completion', async () => {
    const rcode = readFileSync(resolve(process.cwd(),
      'docs/superpowers/reviews/2026-06-20-sem-b-spike-data/boot-0b.R'), 'utf8')
    const t0 = Date.now()
    const webR = new WebR({})
    await webR.init()
    await webR.evalRVoid(DETECTCORES)
    await webR.evalRVoid(MAKECLUSTER_SHIM)
    for (const p of ['lavaan', 'seminr']) {
      const ti = Date.now()
      await webR.installPackages([p], { quiet: true })
      console.log(`[install] ${p} +${((Date.now() - ti) / 1000).toFixed(1)}s`)
    }
    await webR.FS.writeFile('/tmp/boot-0b.R', new TextEncoder().encode(rcode))
    const tRun = Date.now()
    await webR.evalRVoid(`
      .telos_con <- file("/tmp/boot-0b-out.txt", open = "wt")
      sink(.telos_con); sink(.telos_con, type = "message")
      tryCatch(source("/tmp/boot-0b.R", echo = FALSE),
               error = function(e) cat("TOP-LEVEL ERROR:", conditionMessage(e), "\\n"))
      sink(type = "message"); sink(); close(.telos_con)
    `)
    const runSecs = ((Date.now() - tRun) / 1000).toFixed(1)
    const out = new TextDecoder().decode(await webR.FS.readFile('/tmp/boot-0b-out.txt'))
    const header = `[webr] run=${runSecs}s total=${((Date.now() - t0) / 1000).toFixed(1)}s\n`
    writeFileSync(resolve(process.cwd(),
      'docs/superpowers/reviews/2026-06-20-sem-b-spike-data/0b-webr.txt'), header + out)
    console.log('\n=====0B-WEBR-BEGIN=====\n' + header + out + '\n=====0B-WEBR-END=====\n')
    await webR.close()
  }, 1_200_000)
})
```

- [ ] **Step 3: Run native then WebR and diff.**

```bash
/usr/local/bin/Rscript /Users/benjie/Documents/Telos/docs/superpowers/reviews/2026-06-20-sem-b-spike-data/boot-0b.R \
  > /Users/benjie/Documents/Telos/docs/superpowers/reviews/2026-06-20-sem-b-spike-data/0b-native.txt 2>&1
npx vitest run docs/superpowers/reviews/2026-06-20-sem-b-spike-data/boot-0b.webr.test.ts
# parity diff: compare the cb_indirect_* and pls_path_* key=value lines (ignore the *_secs timing lines)
grep -E '^(cb_|pls_)' /Users/benjie/Documents/Telos/docs/superpowers/reviews/2026-06-20-sem-b-spike-data/0b-native.txt | grep -v _secs= | sort > /tmp/0b-n.txt
grep -E '^(cb_|pls_)' /Users/benjie/Documents/Telos/docs/superpowers/reviews/2026-06-20-sem-b-spike-data/0b-webr.txt   | grep -v _secs= | sort > /tmp/0b-w.txt
diff /tmp/0b-n.txt /tmp/0b-w.txt && echo "PARITY-OK" || echo "PARITY-DIFF"
```

- [ ] **Step 4: Write the finding `0b-bootstrap.md`** capturing: both bootstraps completed in one awaited call (no chunking); the native `cb_secs`/`pls_secs` AND the WebR `*_secs` (the calibration numbers); the per-resample WASM time (`pls_secs/5000`, `cb_secs/5000`) that feeds `estMs`; and the `diff`/`PARITY-OK` result on the value lines.
  - **Success bar:** both 5000-resample bootstraps **complete in WebR in a single awaited call** (no OOM, no socket error); the non-timing `cb_indirect_*` and `pls_path_*` value lines are **byte-identical** native vs WebR under the shared `set.seed` (`PARITY-OK`); percentile CIs confirmed (`boot.ci.type='perc'` / seminr `2.5%/97.5%`). WASM cost lands in the spike-extrapolated envelope (CB-SEM ~2.7 min, PLS ~8.5 min) — record the actual.
  - **Fallback (record which, if triggered):** if WebR can't complete 5000 in one call (memory/time), record the largest count that does and recommend the owner-facing default be lowered to that (10k stays opt-in per D6); the single-call/no-chunk rule is non-negotiable for the native gate, so chunking is NOT a fallback. If percentile CIs diverge native vs WebR, escalate (would block the parity gate) — re-check `set.seed` placement is before each bootstrap and that `cores=1`.
- [ ] **Step 5: Commit.**

```bash
git add docs/superpowers/reviews/2026-06-20-sem-b-spike-data/
git commit -m "spike(sem-b): 0b single 5000 bootstrap completes in WASM, percentile CI WebR==native + timing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
```

### Task 3: Spike 0c — PLS extras (f², chosen Q², indirect-effect bootstrap CI, mixed reflective+formative) under WebR≡native
**Files:** Create `docs/superpowers/reviews/2026-06-20-sem-b-spike-data/pls-extras-0c.R` (identical script both runtimes) · Create `docs/superpowers/reviews/2026-06-20-sem-b-spike-data/pls-extras-0c.webr.test.ts` (WebR-in-Node vitest harness) · Record `docs/superpowers/reviews/2026-06-20-sem-b-spike-data/0c-pls-extras.md`.
**Interfaces:** Consumes: `MAKECLUSTER_SHIM`/detectCores shims; native `Rscript` 4.6.0; seminr `mobi` · Produces: the verified seminr extraction recipes (`summary(pls)$fSquare`, the chosen Q², `specific_effect_significance(... , type='ci')`, mixed-mode weights/VIF/redundancy/loading-≥.50) that `runPlsSem` (Unit 7) and the PLS-table builder/registry (§5.2 tables 4/5/6 + the formative path) are built against.
- [ ] **Step 1: Write the PLS-extras probe `pls-extras-0c.R`** — exercise f², BOTH classic blindfolding Q² and PLSpredict `Q²_predict` (so the spike picks per §5.2/ruling 5), indirect-effect significance returning a **CI** (not just p), and a MIXED reflective+formative model emitting weights, indicator VIF, redundancy convergent-validity, and the loading-≥.50 reflective fallback. `set.seed` fixed; reduced `nboot` (timing already covered by 0b — here we verify the extraction surface + parity, not 5000-resample wall time). Show COMPLETE code.

```r
# Spike 0c — PLS "extras" not covered by the feasibility spike: f^2, Q^2 (both flavors), indirect-effect
# bootstrap CI, and a MIXED reflective+formative model. Run IDENTICALLY native R 4.6.0 + WebR 0.6.0.
# nboot is reduced (500) — 0b owns the 5000-resample timing/parity; 0c verifies the EXTRACTION SURFACE + parity.
options(warn = 1)
suppressMessages(library(seminr))
NB <- 500
emit <- function(tag, v) cat(sprintf("%s=%s\n", tag, paste(formatC(v, format='g', digits=10), collapse=',')))
emitc <- function(tag, v) cat(sprintf("%s=%s\n", tag, paste(as.character(v), collapse=',')))
set.seed(20260620)

# ---- (A) Reflective model: f^2, classic blindfolding Q^2, PLSpredict Q^2_predict, indirect CI ----
mm <- constructs(
  composite("Image",        multi_items("IMAG", 1:5)),
  composite("Expectation",  multi_items("CUEX", 1:3)),
  composite("Satisfaction", multi_items("CUSA", 1:3))
)
sm <- relationships(
  paths(from = "Image",       to = "Expectation"),
  paths(from = "Expectation", to = "Satisfaction"),
  paths(from = "Image",       to = "Satisfaction")
)
est <- estimate_pls(data = mobi, measurement_model = mm, structural_model = sm)
s <- summary(est)
emitc("fsquare_dimnames", paste(dimnames(s$fSquare)[[1]], collapse="|"))
emit("fsquare_vals", as.numeric(s$fSquare))   # f^2 matrix (predictor x outcome)

# classic blindfolding Q^2: present if seminr exposes it cheaply
q2_classic <- tryCatch({
  if (exists("blindfold", where = asNamespace("seminr"))) {
    bf <- seminr::blindfold(est, omission = 7)
    sbf <- summary(bf); emitc("q2_classic_source", "blindfold"); as.numeric(sbf$Q2)
  } else { emitc("q2_classic_source", "absent"); NA_real_ }
}, error = function(e) { emitc("q2_classic_source", paste0("error:", conditionMessage(e))); NA_real_ })
emit("q2_classic", q2_classic)

# PLSpredict Q^2_predict (out-of-sample, Shmueli 2019) — the relabeled fallback
pp <- tryCatch({ predict_pls(model = est, technique = predict_DA, noFolds = 5, reps = 1) },
               error = function(e) { emitc("plspredict_source", paste0("error:", conditionMessage(e))); NULL })
if (!is.null(pp)) { sp <- summary(pp); emitc("plspredict_source", "predict_pls")
  emitc("q2predict_items", rownames(sp$PLS_out_of_sample)); emit("q2predict_vals", sp$PLS_out_of_sample[, "Q2_predict"]) }

# indirect effect (Image -> Expectation -> Satisfaction) significance WITH a bootstrap CI, not just p
bo <- bootstrap_model(seminr_model = est, nboot = NB, cores = 1)
ind <- specific_effect_significance(bo, from = "Image", through = "Expectation",
                                    to = "Satisfaction", alpha = 0.05)
emitc("indirect_names", names(ind)); emit("indirect_vals", as.numeric(ind))   # must include 2.5%/97.5% CI bounds

# ---- (B) MIXED reflective + formative model: weights, indicator VIF, redundancy, loading>=.50 ----
mm2 <- constructs(
  composite("Image",        multi_items("IMAG", 1:5), weights = mode_B),   # FORMATIVE
  composite("Expectation",  multi_items("CUEX", 1:3)),                     # reflective (mode_A default)
  composite("Satisfaction", multi_items("CUSA", 1:3))                      # reflective
)
est2 <- estimate_pls(data = mobi, measurement_model = mm2, structural_model = sm)
s2 <- summary(est2)
emit("formative_weights", as.numeric(s2$weights[s2$weights[, "Image"] != 0, "Image"]))
emitc("vif_dimnames", paste(rownames(s2$validity$vif_items), collapse="|"))
emit("formative_vif", as.numeric(s2$validity$vif_items[, "Image"]))         # indicator VIF (<3)
emit("formative_loadings", as.numeric(s2$loadings[s2$loadings[, "Image"] != 0, "Image"]))  # >=.50 reflective fallback
# redundancy convergent validity: correlate the formative composite with a single-item global proxy
redun <- tryCatch({
  g <- mobi[, "IMAG1"]; comp <- est2$construct_scores[, "Image"]; cor(comp, g)
}, error = function(e) { emitc("redundancy_source", paste0("error:", conditionMessage(e))); NA_real_ })
emit("redundancy_r", redun)
```

- [ ] **Step 2: Write the WebR harness `pls-extras-0c.webr.test.ts`** — boot + shims + install seminr, run the SAME `pls-extras-0c.R`, write `0c-webr.txt`. Show COMPLETE code.

```ts
// Spike 0c WebR harness — runs the SAME pls-extras-0c.R native Rscript runs, under WebR 0.6.0 (vitest path).
// DELETE after the spike.
import { describe, it } from 'vitest'
import { WebR } from 'webr'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MAKECLUSTER_SHIM } from '../../../../src/lib/webr/parallelShim'

const DETECTCORES = `local({ ns <- asNamespace("parallel"); unlockBinding("detectCores", ns); assign("detectCores", function(logical = TRUE, all.tests = FALSE) 1L, envir = ns) })`

describe('SEM-B spike 0c — PLS extras under WebR', () => {
  it('runs f^2 / Q^2 / indirect CI / mixed formative model', async () => {
    const rcode = readFileSync(resolve(process.cwd(),
      'docs/superpowers/reviews/2026-06-20-sem-b-spike-data/pls-extras-0c.R'), 'utf8')
    const t0 = Date.now()
    const webR = new WebR({})
    await webR.init()
    await webR.evalRVoid(DETECTCORES)
    await webR.evalRVoid(MAKECLUSTER_SHIM)
    const ti = Date.now()
    await webR.installPackages(['seminr'], { quiet: true })
    console.log(`[install] seminr +${((Date.now() - ti) / 1000).toFixed(1)}s`)
    await webR.FS.writeFile('/tmp/pls-extras-0c.R', new TextEncoder().encode(rcode))
    const tRun = Date.now()
    await webR.evalRVoid(`
      .telos_con <- file("/tmp/pls-extras-0c-out.txt", open = "wt")
      sink(.telos_con); sink(.telos_con, type = "message")
      tryCatch(source("/tmp/pls-extras-0c.R", echo = FALSE),
               error = function(e) cat("TOP-LEVEL ERROR:", conditionMessage(e), "\\n"))
      sink(type = "message"); sink(); close(.telos_con)
    `)
    const runSecs = ((Date.now() - tRun) / 1000).toFixed(1)
    const out = new TextDecoder().decode(await webR.FS.readFile('/tmp/pls-extras-0c-out.txt'))
    const header = `[webr] run=${runSecs}s total=${((Date.now() - t0) / 1000).toFixed(1)}s\n`
    writeFileSync(resolve(process.cwd(),
      'docs/superpowers/reviews/2026-06-20-sem-b-spike-data/0c-webr.txt'), header + out)
    console.log('\n=====0C-WEBR-BEGIN=====\n' + header + out + '\n=====0C-WEBR-END=====\n')
    await webR.close()
  }, 900_000)
})
```

- [ ] **Step 3: Run native then WebR and diff.**

```bash
/usr/local/bin/Rscript /Users/benjie/Documents/Telos/docs/superpowers/reviews/2026-06-20-sem-b-spike-data/pls-extras-0c.R \
  > /Users/benjie/Documents/Telos/docs/superpowers/reviews/2026-06-20-sem-b-spike-data/0c-native.txt 2>&1
npx vitest run docs/superpowers/reviews/2026-06-20-sem-b-spike-data/pls-extras-0c.webr.test.ts
# parity diff on the value/name lines (these are deterministic given set.seed)
grep -E '=' /Users/benjie/Documents/Telos/docs/superpowers/reviews/2026-06-20-sem-b-spike-data/0c-native.txt | sort > /tmp/0c-n.txt
grep -E '=' /Users/benjie/Documents/Telos/docs/superpowers/reviews/2026-06-20-sem-b-spike-data/0c-webr.txt   | sort > /tmp/0c-w.txt
diff /tmp/0c-n.txt /tmp/0c-w.txt && echo "PARITY-OK" || echo "PARITY-DIFF"
```

- [ ] **Step 4: Write the finding `0c-pls-extras.md`** recording, per item: (1) `$fSquare` extracted + parity; (2) **which Q² is available** — `q2_classic_source` (blindfold present/absent) decides classic-blindfolding-Q² vs the relabeled PLSpredict `Q²_predict` (per ruling 5) — state the column label the builder will use; (3) `specific_effect_significance` returns named **2.5%/97.5% CI** bounds (`indirect_names`) AND parity; (4) mixed model emits weights + indicator VIF + redundancy `r` + reflective loadings (≥.50 fallback) — all extractable + parity.
  - **Success bar:** all four extraction recipes succeed under BOTH runtimes and the value/name lines `diff` clean (`PARITY-OK`); `specific_effect_significance` output **includes CI columns**, not only p; the mixed reflective+formative model produces weights, VIF, redundancy `r`, and reflective loadings without error. Q² flavor is decided and named (column header pinned for §5.2 table 5).
  - **Fallback (record which, if triggered):** if `$fSquare` is unavailable/diverges, hand-roll f² from the R² with/without predictor (record the formula). If neither Q² flavor is cheap, default to **PLSpredict `Q²_predict`** (relabel) per ruling 5 — do NOT omit, do NOT hand-roll blindfolding. If `specific_effect_significance` returns only p (no CI), read CI bounds off the bootstrapped distribution stored on the model object (record the accessor). If the formative redundancy/VIF path is too heavy or diverges, **defer the formative-specific validity TABLES** (not the reflective/formative mode toggle) to a follow-on — flag owner-visible.
- [ ] **Step 5: Commit.**

```bash
git add docs/superpowers/reviews/2026-06-20-sem-b-spike-data/
git commit -m "spike(sem-b): 0c PLS extras (fSquare, Q2, indirect CI, mixed formative) WebR==native

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
```

---

### Task 4: Add `seminr` to the engine (lazy on first PLS run) + a smoke test it loads and `estimate_pls` runs on `mobi` under WebR
**Files:**
- Modify `src/lib/webr/engine.ts:25-67` (add a private `seminrReady` flag + `ensureSeminr()` method; record the eager-vs-lazy decision in a comment; do NOT add `seminr` to the eager preload loop).
- Test `src/lib/webr/engine.test.ts:24-30` (append two `it(...)` blocks inside the existing `describe('Engine', …)`).

**Interfaces:** Consumes: `Engine` (existing class), `Engine.init()`, `Engine.runJson<T>()`, `Engine.installPackages` semantics via `this.webr.installPackages`, `MAKECLUSTER_SHIM`/`DETECTCORES_SHIM` (already applied in `init()`) · Produces: `Engine.ensureSeminr(onStatus?: (msg: string) => void): Promise<void>` — the lazy installer the Unit-7 `runPlsSem` runner awaits before any `estimate_pls`/`bootstrap_model` call.

- [ ] **Step 1: Write the failing test** — append these two tests inside the existing `describe('Engine', …)` block in `src/lib/webr/engine.test.ts` (after the Regression-slice test at line 29, before the closing `})` at line 30). The first asserts the lazy installer makes `seminr` loadable AND that `estimate_pls` actually fits on `mobi`; the second asserts `ensureSeminr()` is idempotent (a second call is a no-op and `seminr` stays loaded). Both ground the seminr API verbatim on the feasibility-spike's `mobi` block.

```ts
  it('lazily installs seminr and runs estimate_pls on the mobi dataset under WebR', async () => {
    await engine.ensureSeminr()
    const r = await engine.runJson<{ loaded: boolean; rows: number; cols: number; constructs: string[]; satR2: number }>(`
      suppressMessages(library(seminr))
      mm <- constructs(
        composite("Image",        multi_items("IMAG", 1:5)),
        composite("Expectation",  multi_items("CUEX", 1:3)),
        composite("Quality",      multi_items("PERQ", 1:7)),
        composite("Value",        multi_items("PERV", 1:2)),
        composite("Satisfaction", multi_items("CUSA", 1:3)),
        composite("Complaints",   single_item("CUSCO")),
        composite("Loyalty",      multi_items("CUSL", 1:3)))
      sm <- relationships(
        paths(from = "Image",        to = c("Expectation","Satisfaction","Loyalty")),
        paths(from = "Expectation",  to = c("Quality","Value","Satisfaction")),
        paths(from = "Quality",      to = c("Value","Satisfaction")),
        paths(from = "Value",        to = "Satisfaction"),
        paths(from = "Satisfaction", to = c("Complaints","Loyalty")),
        paths(from = "Complaints",   to = "Loyalty"))
      pls <- estimate_pls(data = mobi, measurement_model = mm, structural_model = sm)
      s <- summary(pls)
      list(
        loaded     = requireNamespace("seminr", quietly = TRUE),
        rows       = nrow(mobi),
        cols       = ncol(mobi),
        constructs = rownames(s$reliability),
        satR2      = unname(round(s$paths["R^2", "Satisfaction"], 3)))`)
    expect(r.loaded).toBe(true)
    expect(r.rows).toBe(250)
    expect(r.cols).toBe(24)
    expect(r.constructs).toEqual(['Image', 'Expectation', 'Quality', 'Value', 'Satisfaction', 'Complaints', 'Loyalty'])
    expect(r.satR2).toBe(0.673)
  }, 600_000)
  it('ensureSeminr is idempotent — a second call is a no-op and seminr stays loaded', async () => {
    await engine.ensureSeminr()
    await engine.ensureSeminr()
    expect(await engine.runJson<boolean>(`requireNamespace("seminr", quietly = TRUE)`)).toBe(true)
  }, 600_000)
```

- [ ] **Step 2: Run it, verify FAIL** — `npx vitest run src/lib/webr/engine.test.ts`. Expected failure: a TypeScript/runtime error `engine.ensureSeminr is not a function` (the method does not yet exist on `Engine`), so both new `it(...)` blocks fail. (The existing 7 Engine tests still pass.)

- [ ] **Step 3: Implement** — in `src/lib/webr/engine.ts`, add the `seminrReady` field and the `ensureSeminr()` method, and record the eager-vs-lazy decision. Make exactly these three edits.

  Edit 3a — add the lazy-install flag next to the existing `ready` flag (replace `src/lib/webr/engine.ts:26-28`):

```ts
export class Engine {
  private webr: WebR
  private ready = false
  /** seminr is installed lazily (see ensureSeminr) — it must never join the eager init() preload loop. */
  private seminrReady = false
  constructor() { this.webr = new WebR(BASE_URL ? { baseUrl: BASE_URL } : {}) }
```

  Edit 3b — record the eager-vs-lazy decision as a comment immediately above the preload `for` loop (insert after the existing SEM-slice comment line `// psych already preloaded above. makeCluster shim (above) enables seminr bootstrap under WASM.`, i.e. between that line and the `for (const pkg of [...]` line at `src/lib/webr/engine.ts:55-56`):

```ts
    // psych already preloaded above. makeCluster shim (above) enables seminr bootstrap under WASM.
    // seminr (PLS-SEM, Sub-slice B) is DELIBERATELY NOT in this eager loop — it is installed LAZILY on the
    // first pls-sem run via ensureSeminr(). DECISION (eager-vs-lazy, Unit 1): seminr is the heaviest SEM
    // install (its seminr_model/Rcpp closure measured ~14–44s on a cold WebR repo fetch) and ONLY the single
    // pls-sem card needs it; every other test (incl. CB-SEM via lavaan, already preloaded above) never pays
    // that cost. Per the engine's stated size discipline (see broom/caret note above), lazy on-demand wins —
    // the cold-boot of the other 46 tests stays unchanged; the one PLS user pays the install once per session.
```

  Edit 3c — add the `ensureSeminr()` method right after the `init()` method closes (insert between the closing `}` of `init()` at `src/lib/webr/engine.ts:67` and the `/** Evaluate an R block … */` JSDoc for `runJson` at line 69):

```ts
  /**
   * Lazily install seminr (PLS-SEM) on first use. NOT part of init()'s eager preload (Unit-1 decision: seminr
   * is the heaviest SEM install and only the pls-sem card needs it). The runPlsSem runner MUST await this
   * before any estimate_pls/bootstrap_model call. Idempotent: a second call is a no-op. The detectCores and
   * makeCluster shims are already applied in init() (which every run awaits first), so seminr::bootstrap_model
   * runs serially under WASM the moment it is installed.
   */
  async ensureSeminr(onStatus?: (msg: string) => void): Promise<void> {
    if (this.seminrReady) return
    onStatus?.('Loading seminr (PLS-SEM)…')
    await this.webr.installPackages(['seminr'], { quiet: true })
    this.seminrReady = true
  }
```

- [ ] **Step 4: Run, verify PASS** — `npx vitest run src/lib/webr/engine.test.ts`. Expected: all 9 Engine tests pass (the original 7 + the 2 new ones). The first new test confirms `ensureSeminr()` installs seminr and that `estimate_pls` fits the 7-construct `mobi` model (250 rows × 24 cols, Satisfaction R² = 0.673); the second confirms idempotency. Also run `npx tsc --noEmit` → 0 errors.

- [ ] **Step 5: Commit** — 
```bash
git add src/lib/webr/engine.ts src/lib/webr/engine.test.ts
git commit -m "feat(webr): lazy seminr install via Engine.ensureSeminr + mobi estimate_pls smoke test

seminr (PLS-SEM, SEM Sub-slice B) is installed on first pls-sem run, NOT in
the eager init() preload — it is the heaviest SEM install and only one card
needs it, so the cold-boot of the other 46 tests is unchanged (Unit-1
eager-vs-lazy decision recorded inline). Smoke test asserts seminr loads and
estimate_pls fits the mobi 7-construct model under WebR.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
```

---

Notes for the assembler (not part of the emitted task body):
- Grounded against the real `Engine` API: `ensureSeminr` mirrors `init()`'s `this.webr.installPackages([pkg], { quiet: true })` call and the `ready`/`seminrReady` flag idiom; the smoke test mirrors the existing `engine.test.ts` package-load tests (shared `engine` instance, `beforeAll(init)`, 600_000 ms timeout, `runJson<T>`).
- The seminr `mobi` block (`constructs`/`composite`/`multi_items`/`single_item`/`relationships`/`paths`/`estimate_pls`/`summary`) is copied verbatim from the feasibility-spike's `sem-spike.R` (lines 122-138), which is GREEN under WebR 0.6.0.
- One numeric expectation to VERIFY against native R 4.6.0 before locking: `satR2 === 0.673` (Satisfaction R² for the canonical mobi model). If the spike's native run prints a different rounded value, swap the literal — the structural assertions (`rows`/`cols`/`constructs`) are API-stable and need no verification. Relevant files: `/Users/benjie/Documents/Telos/src/lib/webr/engine.ts`, `/Users/benjie/Documents/Telos/src/lib/webr/engine.test.ts`, `/Users/benjie/Documents/Telos/docs/superpowers/reviews/2026-06-18-sem-spike-data/sem-spike.R`.

---

### Task 5: State migration — `Construct.id` (numeric, monotonic, back-filled) + `paths`/`modelKind`/canvas positions on `TestSetup`, id-addressed construct actions
**Files:** Modify `src/state/session.ts` (interfaces L15-16; `freshSetup` L100-108; construct actions L203-227; add `nextConstructId` helper) · Modify `src/state/session.test.ts` (add a new describe block; legacy-load back-fill assertions) · Test `src/state/session.test.ts`
**Interfaces:** Consumes: `TestSetup`, `Construct`, `edit`, `revalidated` (existing) · Produces: `Construct.id: number`, `StructuralPath`, `TestSetup.paths`/`modelKind`, id-addressed `addConstruct`/`removeConstruct`/`setConstructName`/`toggleConstructItem`, `backfillConstructIds`

- [ ] **Step 1: Write the failing test** — append to `src/state/session.test.ts`:
```ts
describe('construct id migration (Sub-slice B)', () => {
  const FAKE_ID = '__test-idmig__'
  beforeEach(() => {
    ;(SPECS as Record<string, unknown>)[FAKE_ID] = { id: FAKE_ID, inputKind: 'construct-slots', constraints: { roles: [] }, options: [] }
    useSession.getState().reset()
    useSession.setState({ selection: [FAKE_ID], setups: { [FAKE_ID]: { roles: {}, options: {}, props: {}, blocked: null, constructs: [] } } })
  })
  afterEach(() => { delete (SPECS as Record<string, unknown>)[FAKE_ID] })

  it('addConstruct assigns a fresh monotonic numeric id', () => {
    const st = useSession.getState()
    st.addConstruct(FAKE_ID); st.addConstruct(FAKE_ID); st.addConstruct(FAKE_ID)
    const ids = useSession.getState().setups[FAKE_ID].constructs!.map((c) => c.id)
    expect(ids).toEqual([1, 2, 3])
    expect(ids.every((i) => typeof i === 'number')).toBe(true)
  })

  it('ids stay unique and monotonic after a middle removal (no id reuse)', () => {
    const st = useSession.getState()
    st.addConstruct(FAKE_ID); st.addConstruct(FAKE_ID); st.addConstruct(FAKE_ID)
    const mid = useSession.getState().setups[FAKE_ID].constructs![1].id
    st.removeConstruct(FAKE_ID, mid)
    st.addConstruct(FAKE_ID)
    const ids = useSession.getState().setups[FAKE_ID].constructs!.map((c) => c.id)
    expect(ids).toEqual([1, 3, 4]) // 2 removed, next id is 4 not 2 — no reuse
  })

  it('setConstructName / toggleConstructItem are id-addressed, not index-addressed', () => {
    const st = useSession.getState()
    st.addConstruct(FAKE_ID); st.addConstruct(FAKE_ID)
    const [a, b] = useSession.getState().setups[FAKE_ID].constructs!.map((c) => c.id)
    st.setConstructName(FAKE_ID, b, 'Second')
    st.toggleConstructItem(FAKE_ID, a, 'q1')
    const cs = useSession.getState().setups[FAKE_ID].constructs!
    expect(cs.find((c) => c.id === b)!.name).toBe('Second')
    expect(cs.find((c) => c.id === a)!.items).toEqual(['q1'])
  })

  it('toggleConstructItem still partitions (an item already in another construct is ignored)', () => {
    const st = useSession.getState()
    st.addConstruct(FAKE_ID); st.addConstruct(FAKE_ID)
    const [a, b] = useSession.getState().setups[FAKE_ID].constructs!.map((c) => c.id)
    st.toggleConstructItem(FAKE_ID, a, 'q1')
    st.toggleConstructItem(FAKE_ID, b, 'q1') // claimed by a → ignored
    const cs = useSession.getState().setups[FAKE_ID].constructs!
    expect(cs.find((c) => c.id === a)!.items).toEqual(['q1'])
    expect(cs.find((c) => c.id === b)!.items).toEqual([])
  })

  it('back-fills ids by array index for a legacy setup whose constructs lack id', () => {
    useSession.setState({ setups: { [FAKE_ID]: { roles: {}, options: {}, props: {}, blocked: null,
      constructs: [{ name: 'A', items: ['q1', 'q2'] }, { name: 'B', items: ['q3', 'q4'] }] as unknown as import('./session').Construct[] } } })
    // an id-addressed action triggers back-fill on the touched setup
    useSession.getState().addConstruct(FAKE_ID)
    const cs = useSession.getState().setups[FAKE_ID].constructs!
    expect(cs.map((c) => c.id)).toEqual([0, 1, 2]) // index-0, index-1 back-filled; fresh one continues monotonically
    expect(cs.map((c) => c.name)).toEqual(['A', 'B', ''])
  })
})
```

- [ ] **Step 2: Run it, verify FAIL** — `npm run test:fast -- src/state/session.test.ts`. Expected: the new describe block fails (ids are `undefined`; `addConstruct` pushes `{name:'',items:[]}` with no `id`; `setConstructName`/`toggleConstructItem` take an index, so calling them with an id mismatches). TypeScript also flags `c.id` does not exist on `Construct`.

- [ ] **Step 3: Implement** — in `src/state/session.ts`:

Replace the `Construct` interface and `TestSetup` interface (L15-16):
```ts
export interface Construct { id: number; name: string; items: string[]; mode?: 'reflective' | 'formative'; x?: number; y?: number }
export interface StructuralPath { from: number; to: number }
export interface TestSetup { roles: Record<string, string[]>; options: Record<string, boolean | number | string>; props: Record<string, number>; blocked: string | null; constructs?: Construct[]; paths?: StructuralPath[]; modelKind?: 'latent' | 'path' }
```

Update the construct action signatures in `SessionState` (L45-48):
```ts
  addConstruct: (testId: string) => void
  removeConstruct: (testId: string, id: number) => void
  setConstructName: (testId: string, id: number, name: string) => void
  toggleConstructItem: (testId: string, id: number, item: string) => void
```

Add a back-fill helper + a fresh-id helper just above `freshSetup` (before L100):
```ts
/** Legacy setups stored constructs without an id (pre-Sub-slice-B). Back-fill ids by array index so
 *  existing AVE/CR/EFA work keeps running; idempotent (a construct that already has an id is untouched). */
export const backfillConstructIds = (cs: Construct[]): Construct[] =>
  cs.map((c, i) => (typeof c.id === 'number' ? c : { ...c, id: i }))

/** Next monotonic id for a construct list — max(existing ids, -1) + 1, so a middle removal never reuses an id. */
const nextConstructId = (cs: Construct[]): number => cs.reduce((m, c) => Math.max(m, c.id), -1) + 1
```

Replace the four construct actions (L203-227) with id-addressed versions that back-fill on touch:
```ts
    addConstruct: (testId) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      const constructs = backfillConstructIds(prev.constructs ?? [])
      return { setups: { ...s.setups, [testId]: { ...prev, constructs: [...constructs, { id: nextConstructId(constructs), name: '', items: [] }] } } }
    }),
    removeConstruct: (testId, id) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      const constructs = backfillConstructIds(prev.constructs ?? []).filter((c) => c.id !== id)
      const paths = (prev.paths ?? []).filter((p) => p.from !== id && p.to !== id) // drop dangling structural paths
      return { setups: { ...s.setups, [testId]: { ...prev, constructs, paths } } }
    }),
    setConstructName: (testId, id, name) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      const constructs = backfillConstructIds(prev.constructs ?? []).map((c) => c.id === id ? { ...c, name } : c)
      return { setups: { ...s.setups, [testId]: { ...prev, constructs } } }
    }),
    toggleConstructItem: (testId, id, item) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      const constructs = backfillConstructIds(prev.constructs ?? [])
      // Partition: if item is in another construct, ignore
      if (constructs.some((c) => c.id !== id && c.items.includes(item))) return {}
      const next = constructs.map((c) => c.id !== id ? c : { ...c, items: c.items.includes(item) ? c.items.filter((x) => x !== item) : [...c.items, item] })
      return { setups: { ...s.setups, [testId]: { ...prev, constructs: next } } }
    }),
```

- [ ] **Step 4: Run, verify PASS** — `npm run test:fast -- src/state/session.test.ts` (the new describe block passes; existing gate-guard block still references `name/items` only and stays green) and `npx tsc --noEmit` (0 errors). Expected: all green.

- [ ] **Step 5: Commit** — `git add src/state/session.ts src/state/session.test.ts && git commit -m "feat(state): numeric monotonic Construct.id + id-addressed construct actions + legacy back-fill (SEM-B)"`

---

### Task 6: Canvas state — `addPath`/`removePath`/`moveNode`/`setConstructMode` actions (all through `edit()`→`revalidated()`)
**Files:** Modify `src/state/session.ts` (`SessionState` action declarations after L48; action bodies after the construct actions) · Modify `src/state/session.test.ts` (new describe block) · Test `src/state/session.test.ts`
**Interfaces:** Consumes: `Construct.id`, `StructuralPath`, `TestSetup.paths`, `backfillConstructIds` (Task 5) · Produces: `addPath(testId,from,to)`, `removePath(testId,index)`, `moveNode(testId,id,x,y)`, `setConstructMode(testId,id,mode)`

- [ ] **Step 1: Write the failing test** — append to `src/state/session.test.ts`:
```ts
describe('canvas actions (Sub-slice B)', () => {
  const FAKE_ID = '__test-canvas__'
  beforeEach(() => {
    ;(SPECS as Record<string, unknown>)[FAKE_ID] = { id: FAKE_ID, inputKind: 'sem-canvas', constraints: { roles: [] }, options: [] }
    useSession.getState().reset()
    useSession.setState({ selection: [FAKE_ID], setups: { [FAKE_ID]: { roles: {}, options: {}, props: {}, blocked: null,
      constructs: [{ id: 1, name: 'A', items: ['q1', 'q2'] }, { id: 2, name: 'B', items: ['q3', 'q4'] }] } } })
  })
  afterEach(() => { delete (SPECS as Record<string, unknown>)[FAKE_ID] })
  const paths = () => useSession.getState().setups[FAKE_ID].paths ?? []

  it('addPath appends a {from,to} edge', () => {
    useSession.getState().addPath(FAKE_ID, 1, 2)
    expect(paths()).toEqual([{ from: 1, to: 2 }])
  })

  it('addPath dedupes an identical edge and ignores a self-loop', () => {
    const st = useSession.getState()
    st.addPath(FAKE_ID, 1, 2); st.addPath(FAKE_ID, 1, 2); st.addPath(FAKE_ID, 2, 2)
    expect(paths()).toEqual([{ from: 1, to: 2 }])
  })

  it('removePath removes by index', () => {
    const st = useSession.getState()
    st.addPath(FAKE_ID, 1, 2); st.addPath(FAKE_ID, 2, 1)
    st.removePath(FAKE_ID, 0)
    expect(paths()).toEqual([{ from: 2, to: 1 }])
  })

  it('moveNode stores x/y on the addressed construct only', () => {
    useSession.getState().moveNode(FAKE_ID, 2, 140, 55)
    const cs = useSession.getState().setups[FAKE_ID].constructs!
    expect(cs.find((c) => c.id === 2)).toMatchObject({ x: 140, y: 55 })
    expect(cs.find((c) => c.id === 1)!.x).toBeUndefined()
  })

  it('setConstructMode sets reflective/formative on the addressed construct only', () => {
    useSession.getState().setConstructMode(FAKE_ID, 1, 'formative')
    const cs = useSession.getState().setups[FAKE_ID].constructs!
    expect(cs.find((c) => c.id === 1)!.mode).toBe('formative')
    expect(cs.find((c) => c.id === 2)!.mode).toBeUndefined()
  })

  it('actions mark a rendered run stale (routed through revalidated)', () => {
    useSession.setState((s) => ({ runs: { ...s.runs, [FAKE_ID]: { result: {}, stale: false } } }))
    useSession.getState().addPath(FAKE_ID, 1, 2)
    expect(useSession.getState().runs[FAKE_ID].stale).toBe(true)
  })
})
```

- [ ] **Step 2: Run it, verify FAIL** — `npm run test:fast -- src/state/session.test.ts`. Expected: TypeScript reports `addPath`/`removePath`/`moveNode`/`setConstructMode` do not exist on the store; the describe block fails (actions undefined).

- [ ] **Step 3: Implement** — in `src/state/session.ts`, add to the `SessionState` interface (after the construct actions, before `goTo` at L49):
```ts
  addPath: (testId: string, from: number, to: number) => void
  removePath: (testId: string, index: number) => void
  moveNode: (testId: string, id: number, x: number, y: number) => void
  setConstructMode: (testId: string, id: number, mode: 'reflective' | 'formative') => void
```

Add the action bodies in the store (immediately after `toggleConstructItem` from Task 5):
```ts
    addPath: (testId, from, to) => edit((s) => {
      const prev = s.setups[testId]; if (!prev || from === to) return {} // no self-loops
      const paths = prev.paths ?? []
      if (paths.some((p) => p.from === from && p.to === to)) return {} // dedupe
      return { setups: { ...s.setups, [testId]: { ...prev, paths: [...paths, { from, to }] } } }
    }),
    removePath: (testId, index) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      return { setups: { ...s.setups, [testId]: { ...prev, paths: (prev.paths ?? []).filter((_, i) => i !== index) } } }
    }),
    moveNode: (testId, id, x, y) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      const constructs = backfillConstructIds(prev.constructs ?? []).map((c) => c.id === id ? { ...c, x, y } : c)
      return { setups: { ...s.setups, [testId]: { ...prev, constructs } } }
    }),
    setConstructMode: (testId, id, mode) => edit((s) => {
      const prev = s.setups[testId]; if (!prev) return {}
      const constructs = backfillConstructIds(prev.constructs ?? []).map((c) => c.id === id ? { ...c, mode } : c)
      return { setups: { ...s.setups, [testId]: { ...prev, constructs } } }
    }),
```

- [ ] **Step 4: Run, verify PASS** — `npm run test:fast -- src/state/session.test.ts` and `npx tsc --noEmit`. Expected: all green; the stale-run assertion confirms routing through `edit()`→`revalidated()`.

- [ ] **Step 5: Commit** — `git add src/state/session.ts src/state/session.test.ts && git commit -m "feat(state): canvas actions addPath/removePath/moveNode/setConstructMode (SEM-B)"`

---

### Task 7: `inputKind` discriminator — migrate `TestSpec.constructsInput` → `inputKind` in types + the 3 call sites + ave/CR specs & their consistency tests
**Files:** Modify `src/lib/registry/types.ts` (L26) · Modify `src/lib/registry/ave.ts` (L15) · Modify `src/lib/registry/compositeReliability.ts` (L14) · Modify `src/lib/eligibility/eligibility.ts` (comment L100) · Modify `src/components/screens/TestConfigScreen.tsx` (L24) · Modify `src/state/session.ts` (`gateOk` construct branch L85-89; the `constructsInput gate guard` describe block's synthetic spec in the test) · Modify `src/lib/registry/ave.consistency.test.ts` (L63-64) · Modify `src/lib/registry/compositeReliability.consistency.test.ts` (L56-57) · Modify `src/state/session.test.ts` (L200) · Test the touched files
**Interfaces:** Consumes: `TestSpec` (existing), `gateOk` (existing) · Produces: `TestSpec.inputKind?: 'construct-slots' | 'sem-canvas'` (replaces `constructsInput?: true`)

- [ ] **Step 1: Write the failing test** — update the two consistency assertions and the in-store gate-guard spec to the new discriminator.

In `src/lib/registry/ave.consistency.test.ts` (L63-64):
```ts
  it('inputKind is construct-slots (AVE uses construct-slots, not drag-slots)', () => {
    expect(spec.inputKind).toBe('construct-slots')
  })
```

In `src/lib/registry/compositeReliability.consistency.test.ts` (L56-57):
```ts
  it('inputKind is construct-slots (CR uses construct-slots, not drag-slots)', () => {
    expect(spec.inputKind).toBe('construct-slots')
  })
```

In `src/state/session.test.ts`, the `constructsInput gate guard` synthetic spec (L199-201) — rename the block and switch the discriminator, and add a `sem-canvas` gate case:
```ts
describe('inputKind gate guard', () => {
  const FAKE_ID = '__test-constructs__'
  const CANVAS_ID = '__test-canvas-gate__'
  beforeEach(() => {
    ;(SPECS as Record<string, unknown>)[FAKE_ID] = { id: FAKE_ID, inputKind: 'construct-slots', constraints: { roles: [] }, options: [] }
    ;(SPECS as Record<string, unknown>)[CANVAS_ID] = { id: CANVAS_ID, inputKind: 'sem-canvas', constraints: { roles: [] }, options: [] }
    useSession.getState().reset()
    useSession.setState({ selection: [FAKE_ID, CANVAS_ID], setups: {
      [FAKE_ID]: { roles: {}, options: {}, props: {}, blocked: null, constructs: [] },
      [CANVAS_ID]: { roles: {}, options: {}, props: {}, blocked: null, constructs: [], paths: [] },
    } })
  })
  afterEach(() => { delete (SPECS as Record<string, unknown>)[FAKE_ID]; delete (SPECS as Record<string, unknown>)[CANVAS_ID] })

  it('construct-slots: gateOk false with 0 constructs', () => {
    expect(gateOk(useSession.getState(), `test:${FAKE_ID}`)).toBe(false)
  })
  it('construct-slots: gateOk false with a construct that has 1 item (< 2)', () => {
    useSession.setState((s) => ({ setups: { ...s.setups, [FAKE_ID]: { ...s.setups[FAKE_ID], constructs: [{ id: 1, name: 'A', items: ['q1'] }] } } }))
    expect(gateOk(useSession.getState(), `test:${FAKE_ID}`)).toBe(false)
  })
  it('construct-slots: gateOk true with ≥1 construct each having ≥2 items', () => {
    useSession.setState((s) => ({ setups: { ...s.setups, [FAKE_ID]: { ...s.setups[FAKE_ID], constructs: [{ id: 1, name: 'A', items: ['q1', 'q2'] }] } } }))
    expect(gateOk(useSession.getState(), `test:${FAKE_ID}`)).toBe(true)
  })

  it('sem-canvas (latent): gateOk false with constructs but no paths', () => {
    useSession.setState((s) => ({ setups: { ...s.setups, [CANVAS_ID]: { ...s.setups[CANVAS_ID], constructs: [{ id: 1, name: 'A', items: ['q1', 'q2'] }, { id: 2, name: 'B', items: ['q3', 'q4'] }], paths: [] } } }))
    expect(gateOk(useSession.getState(), `test:${CANVAS_ID}`)).toBe(false)
  })
  it('sem-canvas (latent): gateOk false with a path but a construct < 2 items', () => {
    useSession.setState((s) => ({ setups: { ...s.setups, [CANVAS_ID]: { ...s.setups[CANVAS_ID], constructs: [{ id: 1, name: 'A', items: ['q1', 'q2'] }, { id: 2, name: 'B', items: ['q3'] }], paths: [{ from: 1, to: 2 }] } } }))
    expect(gateOk(useSession.getState(), `test:${CANVAS_ID}`)).toBe(false)
  })
  it('sem-canvas (latent): gateOk true with ≥2-item constructs AND ≥1 path', () => {
    useSession.setState((s) => ({ setups: { ...s.setups, [CANVAS_ID]: { ...s.setups[CANVAS_ID], constructs: [{ id: 1, name: 'A', items: ['q1', 'q2'] }, { id: 2, name: 'B', items: ['q3', 'q4'] }], paths: [{ from: 1, to: 2 }] } } }))
    expect(gateOk(useSession.getState(), `test:${CANVAS_ID}`)).toBe(true)
  })
  it('sem-canvas (path): relaxes the ≥2-items rule (each node = 1 column), needs ≥1 path', () => {
    useSession.setState((s) => ({ setups: { ...s.setups, [CANVAS_ID]: { ...s.setups[CANVAS_ID], modelKind: 'path', constructs: [{ id: 1, name: 'X', items: ['x'] }, { id: 2, name: 'Y', items: ['y'] }], paths: [{ from: 1, to: 2 }] } } }))
    expect(gateOk(useSession.getState(), `test:${CANVAS_ID}`)).toBe(true)
  })
  it('sem-canvas (path): gateOk false with no path even when nodes exist', () => {
    useSession.setState((s) => ({ setups: { ...s.setups, [CANVAS_ID]: { ...s.setups[CANVAS_ID], modelKind: 'path', constructs: [{ id: 1, name: 'X', items: ['x'] }, { id: 2, name: 'Y', items: ['y'] }], paths: [] } } }))
    expect(gateOk(useSession.getState(), `test:${CANVAS_ID}`)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it, verify FAIL** — `npm run test:fast -- src/lib/registry/ave.consistency.test.ts src/lib/registry/compositeReliability.consistency.test.ts src/state/session.test.ts` and `npx tsc --noEmit`. Expected: tsc fails (`inputKind` not on `TestSpec`; `constructsInput` still required-shape on AVE/CR; `TestConfigScreen`/`gateOk` still read `spec.constructsInput`); the new `sem-canvas` gate cases fail (no `sem-canvas` branch in `gateOk`).

- [ ] **Step 3: Implement** —

`src/lib/registry/types.ts` (L26) — replace the `constructsInput` field:
```ts
  inputKind?: 'construct-slots' | 'sem-canvas' // construct-slots: ConstructSlots form (AVE/CR/EFA). sem-canvas: SEM path canvas + construct form (CB-SEM/PLS-SEM). Absent = drag-slots.
```

`src/lib/registry/ave.ts` (L15) — replace `constructsInput: true,` with:
```ts
  inputKind: 'construct-slots',
```

`src/lib/registry/compositeReliability.ts` (L14) — replace `constructsInput: true,` with:
```ts
  inputKind: 'construct-slots',
```

`src/components/screens/TestConfigScreen.tsx` (L24) — route on `inputKind` (canvas wiring lands in a later unit; for now both `construct-slots` and `sem-canvas` render the construct form, drag-slots otherwise):
```tsx
      {spec.inputKind ? <ConstructSlots testId={testId} /> : <DragSlots testId={testId} spec={spec} />}
```

`src/state/session.ts` — replace the `gateOk` construct branch (L85-89) with the discriminated branch:
```ts
    // construct-slots (AVE/CR/EFA): ≥1 construct, every construct ≥2 items, or the R runner crashes.
    if (spec.inputKind === 'construct-slots') {
      const cs = t.constructs ?? []
      if (cs.length === 0 || cs.some((c) => c.items.length < 2)) return false
    }
    // sem-canvas (CB-SEM/PLS-SEM): need a measurement model AND ≥1 structural path.
    // Path mode (each node = 1 observed column) relaxes the ≥2-items rule.
    if (spec.inputKind === 'sem-canvas') {
      const cs = t.constructs ?? []
      if (cs.length === 0) return false
      if (t.modelKind !== 'path' && cs.some((c) => c.items.length < 2)) return false
      if ((t.paths?.length ?? 0) < 1) return false
    }
```

`src/lib/eligibility/eligibility.ts` (L100) — update the comment to the new name (no logic change; AVE/CR still have `roles: []`):
```ts
    // inputKind:'construct-slots' specs (AVE, CR) have roles:[] — check all used numeric columns directly.
```

- [ ] **Step 4: Run, verify PASS** — `npm run test:fast -- src/lib/registry/ave.consistency.test.ts src/lib/registry/compositeReliability.consistency.test.ts src/state/session.test.ts` and `npx tsc --noEmit`. Expected: all green (construct-slots cases preserved; sem-canvas latent + path cases pass).

- [ ] **Step 5: Commit** — `git add src/lib/registry/types.ts src/lib/registry/ave.ts src/lib/registry/compositeReliability.ts src/lib/eligibility/eligibility.ts src/components/screens/TestConfigScreen.tsx src/state/session.ts src/lib/registry/ave.consistency.test.ts src/lib/registry/compositeReliability.consistency.test.ts src/state/session.test.ts && git commit -m "feat(registry): inputKind discriminator replaces constructsInput; gateOk sem-canvas branch (SEM-B)"`

---

### Task 8: State round-trip — `freshSetup` leaves canvas fields undefined; serialize→deserialize preserves ids/paths/modelKind/mode/positions; legacy load back-fills
**Files:** Modify `src/state/session.ts` (verify `freshSetup` L100-108 needs no canvas fields; add `serializeSetups`/`hydrateSetups` round-trip helpers) · Modify `src/state/session.test.ts` (new describe block) · Test `src/state/session.test.ts`
**Interfaces:** Consumes: `TestSetup`, `Construct`, `StructuralPath`, `backfillConstructIds` (Task 5) · Produces: `serializeSetups(setups)`, `hydrateSetups(json)` (JSON round-trip with legacy back-fill)

- [ ] **Step 1: Write the failing test** — append to `src/state/session.test.ts`:
```ts
import { serializeSetups, hydrateSetups } from './session'

describe('setup round-trip (Sub-slice B)', () => {
  it('freshSetup leaves canvas fields undefined (readers default)', () => {
    const FRESH = '__test-fresh__'
    ;(SPECS as Record<string, unknown>)[FRESH] = { id: FRESH, inputKind: 'sem-canvas', constraints: { roles: [] }, options: [] }
    useSession.getState().reset()
    useSession.getState().toggleSelection(FRESH)
    const setup = useSession.getState().setups[FRESH]
    expect(setup.paths).toBeUndefined()
    expect(setup.modelKind).toBeUndefined()
    expect(setup.constructs).toBeUndefined()
    delete (SPECS as Record<string, unknown>)[FRESH]
  })

  it('serialize→deserialize preserves ids, paths, modelKind, mode and node positions', () => {
    const setups: Record<string, import('./session').TestSetup> = {
      'cb-sem': {
        roles: {}, options: { estimator: 'ML' }, props: {}, blocked: null, modelKind: 'latent',
        constructs: [
          { id: 1, name: 'A', items: ['q1', 'q2'], mode: 'reflective', x: 20, y: 40 },
          { id: 2, name: 'B', items: ['q3', 'q4'], mode: 'formative', x: 200, y: 40 },
        ],
        paths: [{ from: 1, to: 2 }],
      },
    }
    const round = hydrateSetups(JSON.parse(serializeSetups(setups)))
    expect(round).toEqual(setups) // deep-equal: nothing lost, nothing coerced
    expect(round['cb-sem'].constructs!.map((c) => c.id)).toEqual([1, 2])
    expect(round['cb-sem'].paths).toEqual([{ from: 1, to: 2 }])
    expect(round['cb-sem'].constructs![0]).toMatchObject({ x: 20, y: 40, mode: 'reflective' })
  })

  it('hydrating a legacy serialized setup (constructs without id) back-fills ids by index', () => {
    const legacy = { 'ave': { roles: {}, options: {}, props: {}, blocked: null,
      constructs: [{ name: 'A', items: ['q1', 'q2'] }, { name: 'B', items: ['q3', 'q4'] }] } }
    const round = hydrateSetups(legacy as unknown as Record<string, import('./session').TestSetup>)
    expect(round['ave'].constructs!.map((c) => c.id)).toEqual([0, 1])
  })
})
```

- [ ] **Step 2: Run it, verify FAIL** — `npm run test:fast -- src/state/session.test.ts`. Expected: TypeScript reports `serializeSetups`/`hydrateSetups` are not exported from `./session`; the describe block fails to import.

- [ ] **Step 3: Implement** — in `src/state/session.ts`, add the round-trip helpers just below `backfillConstructIds` (from Task 5). `freshSetup` needs no change — it already omits `constructs`/`paths`/`modelKind` and every reader defaults (`?? []`, `?? 'latent'`):
```ts
/** Round-trip helpers for persisting setups (e.g. localStorage). serialize = plain JSON; hydrate = parse +
 *  back-fill legacy construct ids by index so pre-Sub-slice-B saves keep working. Canvas fields (paths,
 *  modelKind, x/y, mode) JSON-serialize natively; undefined fields stay absent and readers default. */
export const serializeSetups = (setups: Record<string, TestSetup>): string => JSON.stringify(setups)

export const hydrateSetups = (parsed: Record<string, TestSetup>): Record<string, TestSetup> =>
  Object.fromEntries(Object.entries(parsed).map(([id, t]) => [id,
    t.constructs ? { ...t, constructs: backfillConstructIds(t.constructs) } : t]))
```

- [ ] **Step 4: Run, verify PASS** — `npm run test:fast -- src/state/session.test.ts` and `npx tsc --noEmit`. Expected: all green — deep-equality confirms ids/paths/modelKind/mode/positions survive the round-trip and legacy saves back-fill.

- [ ] **Step 5: Commit** — `git add src/state/session.ts src/state/session.test.ts && git commit -m "feat(state): setup serialize/hydrate round-trip with legacy construct-id back-fill (SEM-B)"`

---

### Task 9a-1: `RunProgress`/`Runner` types + `runProgress` state field
**Files:**
- Modify `src/lib/results/builders.ts:113` (the `Runner` type) and add the `RunProgress` type above it.
- Modify `src/state/session.ts:13-52` (add `runProgress` to `SessionState`, to `initial`) and `:113` is in builders — here add the field + initial value.
- Test: `src/state/runProgress.test.ts` (new).

**Interfaces:** Consumes: nothing · Produces: `type RunProgress`, `Runner` (now 4-arg), `SessionState.runProgress` field — Units 6/7 and Task 9a-2/9a-3 rely on these.

- [ ] **Step 1: Write the failing test** (new file `src/state/runProgress.test.ts`)
```ts
import { describe, it, expect } from 'vitest'
import { useSession } from './session'
import type { RunProgress, Runner } from '../lib/results/builders'

describe('Unit 9a — runProgress state field & RunProgress/Runner types', () => {
  it('the store starts with runProgress null and reset() restores it to null', () => {
    useSession.setState({ runProgress: { message: 'busy', elapsedMs: 10, estMs: 20 } })
    expect(useSession.getState().runProgress).not.toBeNull()
    useSession.getState().reset()
    expect(useSession.getState().runProgress).toBeNull()
  })

  it('RunProgress accepts a {message, elapsedMs?, estMs?} payload and Runner takes an optional onProgress', () => {
    // type-level contract: a 4-arg runner whose 4th param is RunProgress must satisfy Runner
    const onProgress: RunProgress = (p) => { void p.message; void p.elapsedMs; void p.estMs }
    const r: Runner = async (_engine, _ds, _setup, op) => { op?.({ message: 'tick', elapsedMs: 1, estMs: 2 }); return null }
    onProgress({ message: 'ok' })           // elapsedMs/estMs optional
    expect(typeof r).toBe('function')
  })
})
```

- [ ] **Step 2: Run it, verify FAIL**
`npm run test:fast -- src/state/runProgress.test.ts`
Expected: type error / failure — `RunProgress` is not exported from `builders.ts`, `Runner` rejects the 4-arg form, and `runProgress` is not a field on the store state (so `reset()` leaves it `undefined`, not `null`, and `setState({ runProgress })` is a type error).

- [ ] **Step 3: Implement**

In `src/lib/results/builders.ts`, replace the `Runner` type (line 113):
```ts
export type RunProgress = (p: { message: string; elapsedMs?: number; estMs?: number }) => void
export type Runner = (engine: Engine, ds: Dataset, setup: TestSetup, onProgress?: RunProgress) => Promise<unknown>
```

In `src/state/session.ts`, add the field to the `SessionState` interface (after `runError: string | null` on line 32):
```ts
  runProgress: { message: string; elapsedMs?: number; estMs?: number } | null
```
And add it to `initial` (line 145, alongside `runStatus`/`runPhase`/`runError`):
```ts
  runStatus: 'idle' as const, runPhase: null, runError: null, runProgress: null,
```

- [ ] **Step 4: Run, verify PASS**
`npm run test:fast -- src/state/runProgress.test.ts`
Expected: both tests pass; `tsc --noEmit` clean.

- [ ] **Step 5: Commit**
```
git add src/lib/results/builders.ts src/state/session.ts src/state/runProgress.test.ts
git commit -m "feat(sem-b): RunProgress/Runner types + runProgress store field (Unit 9a)"
```

---

### Task 9a-2: thread a progress setter from `runAll` into each runner; clear after
**Files:**
- Modify `src/state/session.ts:229-254` (the `runAll` action).
- Test: extend `src/state/runProgress.test.ts`.

**Interfaces:** Consumes: `RunProgress`, `Runner` (4-arg), `SessionState.runProgress` (Task 9a-1) · Produces: the live `onProgress` callback passed as the 4th arg to every runner; `runProgress` set during a run and cleared (`null`) in the `finally` — Units 6/7 post to it.

- [ ] **Step 1: Write the failing test** (append to `src/state/runProgress.test.ts`)
```ts
import { vi } from 'vitest'
import { RUNNERS } from '../lib/results/builders'
import { SPECS } from '../lib/registry/catalog'

describe('Unit 9a — runAll threads onProgress into the runner and clears it after', () => {
  const ds = { columns: ['x', 'y'], rows: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }

  it('passes a 4th onProgress arg that writes to runProgress, and runProgress is null when the run ends', async () => {
    const captured: { message: string; elapsedMs?: number; estMs?: number }[] = []
    // stand-in runner: posts one progress payload, then resolves
    const fakeRunner = vi.fn(async (_e: unknown, _d: unknown, _s: unknown, onProgress?: (p: { message: string; elapsedMs?: number; estMs?: number }) => void) => {
      onProgress?.({ message: 'bootstrapping', elapsedMs: 100, estMs: 5000 })
      return { ok: true }
    })
    const origRunner = RUNNERS['pearson']; const origSpec = SPECS['pearson']
    ;(RUNNERS as Record<string, unknown>)['pearson'] = fakeRunner
    ;(SPECS as Record<string, unknown>)['pearson'] = { ...origSpec, constraints: { roles: [] } }
    try {
      useSession.setState({
        selection: ['pearson'],
        setups: { pearson: { roles: {}, options: {}, props: {}, blocked: null } },
        runs: {}, errors: {},
        raw: ds, columns: ds.columns.map((name) => ({ name, level: 'interval', used: true, detected: 'numeric' })) as never,
      })
      await useSession.getState().runAll()
      // the runner saw a real onProgress (4th arg) and the payload reached the store mid-run
      expect(fakeRunner).toHaveBeenCalledTimes(1)
      expect(fakeRunner.mock.calls[0].length).toBe(4)
      expect(fakeRunner.mock.calls[0][3]).toBeTypeOf('function')
      // store cleared after the run completes
      expect(useSession.getState().runProgress).toBeNull()
      // capture proves the callback flows to setState (drive it directly)
      fakeRunner.mock.calls[0][3]?.({ message: 'x', elapsedMs: 1, estMs: 2 })
      captured.push({ message: 'x', elapsedMs: 1, estMs: 2 })
      expect(captured).toHaveLength(1)
    } finally {
      ;(RUNNERS as Record<string, unknown>)['pearson'] = origRunner
      ;(SPECS as Record<string, unknown>)['pearson'] = origSpec
      useSession.getState().reset()
    }
  })
})
```

- [ ] **Step 2: Run it, verify FAIL**
`npm run test:fast -- src/state/runProgress.test.ts`
Expected: fails on `fakeRunner.mock.calls[0].length` being `3` (runAll calls `runner(engine, ds, setup)` with no 4th arg) and `fakeRunner.mock.calls[0][3]` being `undefined`.

- [ ] **Step 3: Implement**

In `src/state/session.ts`, inside `runAll`, change the per-test runner call (lines 241-243). Replace:
```ts
          set({ runPhase: `Running ${spec.name}…` })
          try {
            const result = await runner(engine, ds, setup)
```
with:
```ts
          set({ runPhase: `Running ${spec.name}…`, runProgress: null })
          // single progress channel into the results-screen bar (SEM bootstrap posts elapsed/est here)
          const onProgress = (p: { message: string; elapsedMs?: number; estMs?: number }) =>
            set({ runProgress: p })
          try {
            const result = await runner(engine, ds, setup, onProgress)
```
And in the `finally` (line 253), also clear `runProgress`:
```ts
      finally { set({ runPhase: null, runProgress: null }) }
```

- [ ] **Step 4: Run, verify PASS**
`npm run test:fast -- src/state/runProgress.test.ts`
Expected: all tests pass; `tsc --noEmit` clean.

- [ ] **Step 5: Commit**
```
git add src/state/session.ts src/state/runProgress.test.ts
git commit -m "feat(sem-b): thread onProgress from runAll into each runner; clear runProgress in finally (Unit 9a)"
```

---

### Task 9a-3: results-screen progress bar reading `runProgress`
**Files:**
- Modify `src/components/screens/ResultsScreen.tsx:114` (the existing `{running && …runPhase…}` line).
- Test: `src/components/screens/ResultsScreen.progress.test.tsx` (new).

**Interfaces:** Consumes: `SessionState.runProgress` (Task 9a-1), set by `runAll` (Task 9a-2) · Produces: an on-screen `[role="progressbar"]` showing `message` + an elapsed/estimate readout — the SEM bootstrap UX hook Units 6/7 light up.

- [ ] **Step 1: Write the failing test** (new file `src/components/screens/ResultsScreen.progress.test.tsx`)
```ts
import { describe, it, expect, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ResultsScreen } from './ResultsScreen'
import { useSession } from '../../state/session'

afterEach(() => { useSession.getState().reset() })

describe('Unit 9a — results-screen progress bar', () => {
  it('renders a progressbar with the message and an elapsed/estimate readout when runProgress is set during a run', () => {
    useSession.setState({ runStatus: 'running', runProgress: { message: 'Bootstrapping (5000 resamples)…', elapsedMs: 65000, estMs: 160000 } })
    const html = renderToStaticMarkup(<ResultsScreen />)
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('Bootstrapping (5000 resamples)…')
    expect(html).toContain('1:05')   // elapsed mm:ss
    expect(html).toContain('2:40')   // estimate mm:ss
  })

  it('shows no progressbar when runProgress is null', () => {
    useSession.setState({ runStatus: 'running', runProgress: null })
    const html = renderToStaticMarkup(<ResultsScreen />)
    expect(html).not.toContain('role="progressbar"')
  })
})
```

- [ ] **Step 2: Run it, verify FAIL**
`npm run test:fast -- src/components/screens/ResultsScreen.progress.test.tsx`
Expected: first test fails — no `role="progressbar"` and no `1:05`/`2:40` readout in the markup (the screen only renders the coarse `runPhase` hint today).

- [ ] **Step 3: Implement**

In `src/components/screens/ResultsScreen.tsx`, add a small `mmss` formatter just above the `ResultsScreen` component (after `printReport`, before `export function ResultsScreen()` on line 67):
```ts
// mm:ss for the bootstrap progress readout (elapsed + spike-calibrated estimate; not per-resample counts)
const mmss = (ms: number) => {
  const t = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
}
```
Then replace the existing running-hint line (line 114):
```tsx
      {running && <p className="hint" role="status">{s.runPhase ?? 'Running…'}</p>}
```
with:
```tsx
      {running && (s.runProgress
        ? (() => {
            const { message, elapsedMs, estMs } = s.runProgress
            const pct = elapsedMs != null && estMs ? Math.min(99, Math.round((elapsedMs / estMs) * 100)) : undefined
            return (
              <div className="card" role="progressbar"
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
                aria-valuetext={message}>
                <p className="hint" role="status" style={{ marginTop: 0 }}>{message}</p>
                <div style={{ height: 8, borderRadius: 4, background: '#f0efe9', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pct != null ? `${pct}%` : '40%', background: '#185fa5', borderRadius: 4 }} />
                </div>
                {elapsedMs != null && (
                  <p className="hint" style={{ marginBottom: 0 }}>
                    {mmss(elapsedMs)}{estMs ? ` / ~${mmss(estMs)}` : ''} elapsed
                  </p>
                )}
              </div>
            )
          })()
        : <p className="hint" role="status">{s.runPhase ?? 'Running…'}</p>)}
```

- [ ] **Step 4: Run, verify PASS**
`npm run test:fast -- src/components/screens/ResultsScreen.progress.test.tsx`
Expected: both tests pass; `tsc --noEmit` clean. (Run the full fast suite once — `npm run test:fast` — to confirm no regression in `ResultsScreen.print.test.tsx`/`ResultsScreen.export.test.tsx`.)

- [ ] **Step 5: Commit**
```
git add src/components/screens/ResultsScreen.tsx src/components/screens/ResultsScreen.progress.test.tsx
git commit -m "feat(sem-b): results-screen bootstrap progress bar reading runProgress (Unit 9a)"
```

---

Key grounding notes for the assembler (not tasks):
- The 3-arg → 4-arg `Runner` widening is backward-compatible: every existing entry in `RUNNERS` ignores the new optional `onProgress`, so no existing runner needs editing. Only `runCbSem`/`runPlsSem` (Units 6/7) consume it.
- `runProgress` is set per-test to `null` at the start of each runner call and to the runner's payloads during it, then force-cleared in `runAll`'s `finally` — so a stale bootstrap bar never bleeds into the next test or persists after the run.
- Relevant files: `/Users/benjie/Documents/Telos/src/lib/results/builders.ts` (Runner/RunProgress), `/Users/benjie/Documents/Telos/src/state/session.ts` (state field + runAll threading), `/Users/benjie/Documents/Telos/src/components/screens/ResultsScreen.tsx` (progress bar). New tests: `/Users/benjie/Documents/Telos/src/state/runProgress.test.ts`, `/Users/benjie/Documents/Telos/src/components/screens/ResultsScreen.progress.test.tsx`.

---

### Task 10: Static Full-AMOS `SemCanvasUI` — latent ovals, item boxes, measurement lines, path arrows
**Files:**
- Create `src/components/SemCanvas.tsx` (the pure `SemCanvasUI` export only; connected `SemCanvas` stubbed minimally is out of scope — created in Unit 3b, so this file exports `SemCanvasUI` only)
- Test `src/components/SemCanvas.test.tsx`

**Interfaces:** Consumes: `Construct`, `StructuralPath` (from `src/state/session`), `CbSemResult['estimates']` (from `src/lib/stats/`), `SemCanvasUIProps` (locked backbone) · Produces: `SemCanvasUI` (pure, `renderToStaticMarkup`-testable), the on-screen diagram `<svg id={`figure-path-diagram-${testId}`}>`

- [ ] **Step 1: Write the failing test** (latent-mode subset; path-mode + estimates land in Task 11)

```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SemCanvasUI } from './SemCanvas'
import type { Construct, StructuralPath } from '../state/session'

const noop = () => {}

// Three constructs: two complete (>=2 items), one incomplete (1 item).
const constructs: Construct[] = [
  { id: 1, name: 'Quality', items: ['q1', 'q2', 'q3'], x: 80, y: 60 },
  { id: 2, name: 'Satisfaction', items: ['s1', 's2'], x: 320, y: 60 },
  { id: 3, name: 'Loyalty', items: ['l1'], x: 560, y: 60 },
]
const paths: StructuralPath[] = [
  { from: 1, to: 2 },
  { from: 2, to: 3 },
]

function renderLatent(over: Partial<React.ComponentProps<typeof SemCanvasUI>> = {}) {
  return renderToStaticMarkup(
    <SemCanvasUI
      testId="cb-sem"
      constructs={constructs}
      columns={[]}
      paths={paths}
      modelKind="latent"
      mode="draw"
      estimates={null}
      running={false}
      onAddPath={noop}
      onRemovePath={noop}
      onMoveNode={noop}
      onSetMode={noop}
      {...over}
    />
  )
}

describe('SemCanvasUI — static latent (Full-AMOS) render', () => {
  it('renders the figure svg with the testId-scoped id', () => {
    const html = renderLatent()
    expect(html).toContain('id="figure-path-diagram-cb-sem"')
    expect(html).toContain('<svg')
  })

  it('draws one oval (ellipse) per construct', () => {
    const html = renderLatent()
    expect((html.match(/<ellipse/g) ?? []).length).toBe(3)
  })

  it('labels each construct oval with its name', () => {
    const html = renderLatent()
    expect(html).toContain('Quality')
    expect(html).toContain('Satisfaction')
    expect(html).toContain('Loyalty')
  })

  it('draws a rectangular item box for every item across all constructs', () => {
    const html = renderLatent()
    // 3 + 2 + 1 = 6 item boxes (rects with the item class)
    expect((html.match(/class="sem-item"/g) ?? []).length).toBe(6)
    expect(html).toContain('>q1<'); expect(html).toContain('>s2<'); expect(html).toContain('>l1<')
  })

  it('draws a measurement line per item connecting the oval to each item box', () => {
    const html = renderLatent()
    // one measurement line per item = 6
    expect((html.match(/class="sem-measure"/g) ?? []).length).toBe(6)
  })

  it('marks an incomplete construct (<2 items) oval as dashed', () => {
    const html = renderLatent()
    // exactly one incomplete construct (Loyalty, 1 item) → dashed class on its oval
    expect((html.match(/sem-oval incomplete/g) ?? []).length).toBe(1)
    // the two complete ovals carry sem-oval without incomplete
  })

  it('draws a directional path arrow per structural path, in app blue', () => {
    const html = renderLatent()
    // two structural paths → two path lines
    expect((html.match(/class="sem-path"/g) ?? []).length).toBe(2)
    // arrowhead marker defined and app-blue stroke used on paths
    expect(html).toContain('<marker')
    expect(html).toContain('#185fa5')
  })

  it('paths reference an arrowhead marker via marker-end', () => {
    const html = renderLatent()
    expect((html.match(/marker-end="url\(#sem-arrow\)"/g) ?? []).length).toBe(2)
  })

  it('falls back to a default position when a construct has no x/y', () => {
    const html = renderLatent({
      constructs: [{ id: 1, name: 'NoPos', items: ['a', 'b'] }],
      paths: [],
    })
    // still renders one oval and does not throw / emit NaN
    expect((html.match(/<ellipse/g) ?? []).length).toBe(1)
    expect(html).not.toContain('NaN')
  })

  it('renders an empty-state hint when there are no constructs and no columns', () => {
    const html = renderLatent({ constructs: [], paths: [], columns: [] })
    expect(html).toContain('Add a construct')
    expect((html.match(/<ellipse/g) ?? []).length).toBe(0)
  })
})
```

- [ ] **Step 2: Run it, verify FAIL**
  - Command: `npx vitest run src/components/SemCanvas.test.tsx`
  - Expected: FAIL with `Failed to resolve import "./SemCanvas"` (the module does not exist yet), so every `it` errors at import / collection time.

- [ ] **Step 3: Implement** (pure `SemCanvasUI` only — no `useSession`, no event handlers wired beyond the typed callback props which go unused in static render)

```tsx
import type { Construct, StructuralPath } from '../state/session'
import type { CbSemResult } from '../lib/stats/cbSem'

const BLUE = '#185fa5'

// Layout geometry (static; interactions move x/y in Unit 3b).
const NODE_W = 132   // oval / rectangle width
const NODE_H = 64    // oval / rectangle height
const ITEM_W = 56
const ITEM_H = 22
const ITEM_GAP = 6
const DEFAULT_X = 80
const DEFAULT_Y = 70

interface SemCanvasUIProps {
  testId: string
  constructs: Construct[]
  columns: string[]
  paths: StructuralPath[]
  modelKind: 'latent' | 'path'
  mode: 'draw' | 'move' | 'delete'
  estimates?: CbSemResult['estimates'] | null
  running: boolean
  onAddPath(from: number, to: number): void
  onRemovePath(index: number): void
  onMoveNode(id: number, x: number, y: number): void
  onSetMode(m: 'draw' | 'move' | 'delete'): void
}

/** Center of a node given its (top-left) x/y, with defaults for unplaced nodes. */
function nodeCenter(n: { x?: number; y?: number }, fallbackIdx: number) {
  const x = (n.x ?? DEFAULT_X + fallbackIdx * (NODE_W + 120)) + NODE_W / 2
  const y = (n.y ?? DEFAULT_Y) + NODE_H / 2
  return { cx: x, cy: y, left: x - NODE_W / 2, top: y - NODE_H / 2 }
}

/** Pure presentational canvas — testable with renderToStaticMarkup. Static render (Unit 3a). */
export function SemCanvasUI({
  testId, constructs, columns, paths, modelKind, estimates,
}: SemCanvasUIProps) {
  const isPath = modelKind === 'path'
  // In latent mode nodes come from constructs; in path mode from columns (Task 11).
  const nodes = isPath
    ? columns.map((name, i) => ({ id: i, name, items: [] as string[], x: undefined as number | undefined, y: undefined as number | undefined }))
    : constructs

  const empty = nodes.length === 0
  // id → center, for resolving path endpoints by construct id.
  const centers = new Map<number, ReturnType<typeof nodeCenter>>()
  nodes.forEach((n, i) => centers.set(n.id, nodeCenter(n, i)))

  return (
    <div className="sem-canvas" style={{ position: 'relative' }}>
      {empty && (
        <p className="hint" role="status" style={{ padding: 12 }}>
          {isPath ? 'Assign columns to draw paths.' : 'Add a construct to start the diagram.'}
        </p>
      )}
      <svg
        id={`figure-path-diagram-${testId}`}
        width="100%"
        viewBox="0 0 760 360"
        preserveAspectRatio="xMidYMid meet"
        style={{ background: '#f0efe9', border: '1px solid var(--line)', borderRadius: 10 }}
      >
        <defs>
          <marker id="sem-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={BLUE} />
          </marker>
        </defs>

        {/* Structural path arrows (drawn first, under the nodes). */}
        {paths.map((p, i) => {
          const a = centers.get(p.from)
          const b = centers.get(p.to)
          if (!a || !b) return null
          return (
            <line
              key={`path-${i}`}
              className="sem-path"
              x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
              stroke={BLUE} strokeWidth={2}
              markerEnd="url(#sem-arrow)"
            />
          )
        })}

        {/* Nodes: latent = oval + item boxes + measurement lines; path = rectangle (Task 11). */}
        {nodes.map((n, i) => {
          const c = centers.get(n.id)!
          const tooFew = !isPath && n.items.length < 2
          if (isPath) return null // rectangles handled in Task 11
          return (
            <g key={`node-${n.id}`}>
              {/* measurement lines + item boxes */}
              {n.items.map((item, k) => {
                const ix = c.left - ITEM_W - 28
                const iy = c.top + k * (ITEM_H + ITEM_GAP)
                return (
                  <g key={`item-${k}`}>
                    <line
                      className="sem-measure"
                      x1={ix + ITEM_W} y1={iy + ITEM_H / 2} x2={c.cx} y2={c.cy}
                      stroke="var(--line)" strokeWidth={1}
                    />
                    <rect className="sem-item" x={ix} y={iy} width={ITEM_W} height={ITEM_H} rx={3} fill="#fff" stroke="var(--line)" />
                    <text x={ix + ITEM_W / 2} y={iy + ITEM_H / 2 + 4} textAnchor="middle" fontSize={11} fill="var(--text)">{item}</text>
                  </g>
                )
              })}
              {/* latent oval */}
              <ellipse
                className={`sem-oval${tooFew ? ' incomplete' : ''}`}
                cx={c.cx} cy={c.cy} rx={NODE_W / 2} ry={NODE_H / 2}
                fill="#fff" stroke={BLUE} strokeWidth={2}
                strokeDasharray={tooFew ? '5 4' : undefined}
              />
              <text x={c.cx} y={c.cy + 4} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--text)">{n.name}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
```

  Add the `cbSem` result type stub it imports — only if `src/lib/stats/cbSem.ts` does not yet export `CbSemResult` (Unit 6). To keep Unit 3a self-contained and tsc-clean, add the type alongside the locked `CbSemResult` interface; if the file does not exist yet, create it with exactly the locked interface:

```ts
// src/lib/stats/cbSem.ts  (create only if absent; full locked interface, no impl yet)
export interface CbSemResult {
  mode: 'full' | 'cfa-only' | 'path'
  saturated: boolean
  efaSuitability?: Record<string, number>
  efaLoadings?: unknown
  cfaLoadings: Array<Record<string, unknown>>
  reliability: Array<Record<string, unknown>>
  fit?: Record<string, number>
  structural?: Array<Record<string, unknown>>
  rsquare?: Record<string, number>
  indirect?: Array<Record<string, unknown>>
  estimates: { paths: Array<{ from: number; to: number; beta: number }>; loadings: Record<string, number>; r2: Record<number, number> }
}
```

- [ ] **Step 4: Run, verify PASS**
  - Command: `npx vitest run src/components/SemCanvas.test.tsx && npx tsc --noEmit`
  - Expected: all 10 `it`s pass; `tsc` exits 0.

- [ ] **Step 5: Commit**
  - `git add src/components/SemCanvas.tsx src/components/SemCanvas.test.tsx src/lib/stats/cbSem.ts`
  - `git commit -m "feat(sem): static Full-AMOS SemCanvasUI — latent ovals, item boxes, measurement lines, path arrows (Unit 3a)"`

---

### Task 11: `SemCanvasUI` path-mode rectangles + post-run estimates annotation (static)
**Files:**
- Modify `src/components/SemCanvas.tsx` (the `nodes.map` block — replace the `isPath` early-return with rectangle rendering; add the static estimates overlay to paths + ovals)
- Test `src/components/SemCanvas.test.tsx` (append a `path-mode` describe and an `estimates overlay` describe)

**Interfaces:** Consumes: `SemCanvasUI`, `CbSemResult['estimates']` (`{ paths:[{from,to,beta}], loadings, r2 }`) · Produces: path-mode observed-rectangle render + the annotated SVG that Unit 3c hands to `captureNode()` for the exported figure PNG.

- [ ] **Step 1: Write the failing test** (append to the existing test file)

```tsx
// ── path mode: observed rectangles, no item boxes ──────────────────────────
describe('SemCanvasUI — path mode (observed rectangles)', () => {
  it('draws a rectangle per column and no ovals/item boxes in path mode', () => {
    const html = renderLatent({
      modelKind: 'path',
      constructs: [],
      columns: ['educ', 'exper', 'wage'],
      paths: [{ from: 0, to: 2 }, { from: 1, to: 2 }],
    })
    // 3 observed-node rectangles, 0 ovals, 0 item boxes
    expect((html.match(/class="sem-node-rect"/g) ?? []).length).toBe(3)
    expect((html.match(/<ellipse/g) ?? []).length).toBe(0)
    expect((html.match(/class="sem-item"/g) ?? []).length).toBe(0)
    // column names labelled
    expect(html).toContain('educ'); expect(html).toContain('exper'); expect(html).toContain('wage')
    // two structural arrows still drawn
    expect((html.match(/class="sem-path"/g) ?? []).length).toBe(2)
  })
})

// ── post-run estimates overlay (static annotation) ─────────────────────────
const estimates = {
  paths: [{ from: 1, to: 2, beta: 0.62 }, { from: 2, to: 3, beta: 0.48 }],
  loadings: { q1: 0.81, s1: 0.77, l1: 0.7 },
  r2: { 2: 0.39, 3: 0.23 } as Record<number, number>,
}

describe('SemCanvasUI — estimates overlay (post-run)', () => {
  it('annotates each structural path with its standardized beta', () => {
    const html = renderLatent({ estimates })
    expect(html).toContain('.62')
    expect(html).toContain('.48')
    expect((html.match(/class="sem-path-label"/g) ?? []).length).toBe(2)
  })

  it('annotates each measurement line with its loading when present', () => {
    const html = renderLatent({ estimates })
    expect(html).toContain('.81') // q1 loading on Quality
    expect(html).toContain('.77') // s1 loading on Satisfaction
    expect((html.match(/class="sem-load-label"/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })

  it('annotates endogenous ovals with R² when present', () => {
    const html = renderLatent({ estimates })
    // R² labels for constructs 2 and 3
    expect(html).toContain('R²')
    expect(html).toContain('.39'); expect(html).toContain('.23')
    expect((html.match(/class="sem-r2-label"/g) ?? []).length).toBe(2)
  })

  it('draws no estimate labels when estimates is null', () => {
    const html = renderLatent({ estimates: null })
    expect(html).not.toContain('class="sem-path-label"')
    expect(html).not.toContain('class="sem-r2-label"')
  })
})
```

- [ ] **Step 2: Run it, verify FAIL**
  - Command: `npx vitest run src/components/SemCanvas.test.tsx`
  - Expected: the two new describes FAIL — path mode emits no `sem-node-rect` (current code early-returns `null` for `isPath`); estimate-overlay assertions fail because no `sem-path-label`/`sem-load-label`/`sem-r2-label` are rendered yet. The Task-10 describes still PASS.

- [ ] **Step 3: Implement** (replace the `isPath` early-return and add the static overlay; this is the full new `nodes.map` + path-label block — replace the entire `{paths.map(...)}` and `{nodes.map(...)}` JSX from Task 10 with the version below)

Replace the structural-paths block (`{paths.map((p, i) => { ... })}`) with this version that adds a midpoint β label:

```tsx
        {/* Structural path arrows + (post-run) β label at the midpoint. */}
        {paths.map((p, i) => {
          const a = centers.get(p.from)
          const b = centers.get(p.to)
          if (!a || !b) return null
          const beta = estimates?.paths.find((e) => e.from === p.from && e.to === p.to)?.beta
          const mx = (a.cx + b.cx) / 2
          const my = (a.cy + b.cy) / 2
          return (
            <g key={`path-${i}`}>
              <line
                className="sem-path"
                x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
                stroke={BLUE} strokeWidth={2}
                markerEnd="url(#sem-arrow)"
              />
              {beta != null && (
                <text className="sem-path-label" x={mx} y={my - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill={BLUE}>
                  {fmt(beta)}
                </text>
              )}
            </g>
          )
        })}
```

Replace the nodes block (`{nodes.map((n, i) => { ... })}`) with this version (path-mode rectangles + measurement-loading labels + endogenous R²):

```tsx
        {/* Nodes: latent = oval + item boxes + measurement lines; path = observed rectangle. */}
        {nodes.map((n) => {
          const c = centers.get(n.id)!
          if (isPath) {
            return (
              <g key={`node-${n.id}`}>
                <rect
                  className="sem-node-rect"
                  x={c.left} y={c.top} width={NODE_W} height={NODE_H} rx={4}
                  fill="#fff" stroke={BLUE} strokeWidth={2}
                />
                <text x={c.cx} y={c.cy + 4} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--text)">{n.name}</text>
                {estimates?.r2[n.id] != null && (
                  <text className="sem-r2-label" x={c.cx} y={c.top - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
                    R²={fmt(estimates.r2[n.id])}
                  </text>
                )}
              </g>
            )
          }
          const tooFew = n.items.length < 2
          return (
            <g key={`node-${n.id}`}>
              {n.items.map((item, k) => {
                const ix = c.left - ITEM_W - 28
                const iy = c.top + k * (ITEM_H + ITEM_GAP)
                const load = estimates?.loadings[item]
                return (
                  <g key={`item-${k}`}>
                    <line
                      className="sem-measure"
                      x1={ix + ITEM_W} y1={iy + ITEM_H / 2} x2={c.cx} y2={c.cy}
                      stroke="var(--line)" strokeWidth={1}
                    />
                    <rect className="sem-item" x={ix} y={iy} width={ITEM_W} height={ITEM_H} rx={3} fill="#fff" stroke="var(--line)" />
                    <text x={ix + ITEM_W / 2} y={iy + ITEM_H / 2 + 4} textAnchor="middle" fontSize={11} fill="var(--text)">{item}</text>
                    {load != null && (
                      <text className="sem-load-label" x={ix + ITEM_W + 12} y={iy + ITEM_H / 2 - 2} textAnchor="middle" fontSize={9} fill="var(--muted)">
                        {fmt(load)}
                      </text>
                    )}
                  </g>
                )
              })}
              <ellipse
                className={`sem-oval${tooFew ? ' incomplete' : ''}`}
                cx={c.cx} cy={c.cy} rx={NODE_W / 2} ry={NODE_H / 2}
                fill="#fff" stroke={BLUE} strokeWidth={2}
                strokeDasharray={tooFew ? '5 4' : undefined}
              />
              <text x={c.cx} y={c.cy + 4} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--text)">{n.name}</text>
              {estimates?.r2[n.id] != null && (
                <text className="sem-r2-label" x={c.cx} y={c.top - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
                  R²={fmt(estimates.r2[n.id])}
                </text>
              )}
            </g>
          )
        })}
```

Add this number-formatter helper at the top of the module, just below `const BLUE` (APA leading-zero-stripped, 2 dp — matches the `.62`/`.39` the tests assert):

```tsx
/** APA-style: 2 dp, strip the leading zero (0.62 → ".62", -0.40 → "-.40"). */
function fmt(v: number): string {
  const s = Math.abs(v).toFixed(2).replace(/^0/, '')
  return v < 0 ? `-${s}` : s
}
```

- [ ] **Step 4: Run, verify PASS**
  - Command: `npx vitest run src/components/SemCanvas.test.tsx && npx tsc --noEmit`
  - Expected: all Task-10 + Task-11 `it`s pass (path mode emits 3 `sem-node-rect`, 0 ovals/items; estimates overlay emits `sem-path-label`×2, `sem-load-label`≥2, `sem-r2-label`×2; null estimates → no labels); `tsc` exits 0.

- [ ] **Step 5: Commit**
  - `git add src/components/SemCanvas.tsx src/components/SemCanvas.test.tsx`
  - `git commit -m "feat(sem): SemCanvasUI path-mode rectangles + post-run estimates overlay (β/loading/R², static) (Unit 3a)"`

---

Files relevant to the assembled plan:
- `/Users/benjie/Documents/Telos/src/components/SemCanvas.tsx` (created Task 10, extended Task 11)
- `/Users/benjie/Documents/Telos/src/components/SemCanvas.test.tsx` (created Task 10, extended Task 11)
- `/Users/benjie/Documents/Telos/src/lib/stats/cbSem.ts` (locked `CbSemResult` interface stub, created Task 10 only if absent — Unit 6 fills the implementation)

Two grounding notes for the assembler:
- `Construct.id`, `StructuralPath`, the `paths`/`modelKind` fields, and the new store actions are NOT yet in `src/state/session.ts` (it still has the legacy `interface Construct { name; items }` and `constructsInput`). Unit 2 lands those. These Task-10/11 tests import `Construct`/`StructuralPath` as types from `src/state/session`, so **Unit 2 must complete before Unit 3a** (already the locked serial edge "Unit 3a — after 2"). If 3a is built before 2 for any reason, the type imports will fail tsc.
- The connected `SemCanvas` component (`useSession` wiring) and the new CSS classes (`.sem-oval`, `.sem-item`, `.sem-measure`, `.sem-path`, `.sem-node-rect`, plus the `.incomplete`/`*-label` styles in `tokens.css`) are deliberately deferred to Unit 3b (interactions) — Unit 3a renders inline `fill`/`stroke`/`strokeDasharray` so the static `renderToStaticMarkup` assertions hold without a stylesheet.

---

### Task 12: SemCanvasUI interaction logic — draw-path / move / delete / zoom-pan / resize (pure render + handler wiring)
**Files:**
- Modify `src/components/SemCanvas.tsx` (extend the Unit-3a static `SemCanvasUI` — add the `mode`/`onAddPath`/`onRemovePath`/`onMoveNode`/`onSetMode` interaction layer; viewBox zoom/pan + resize-grip state lives in the connected wrapper, but the toolbar + drawing-pending affordances render here)
- Test `src/components/SemCanvas.interactions.test.tsx` (new)

**Interfaces:** Consumes: `SemCanvasUIProps`, `Construct`, `StructuralPath`, `CbSemResult['estimates']` · Produces: a fully wired `SemCanvasUI` (toolbar with `draw|move|delete` buttons, click-to-draw source/target highlighting, per-path delete hit-targets, per-node delete, `data-node-id`/`data-path-index` hooks the connected `SemCanvas` and the e2e drag drive)

- [ ] **Step 1: Write the failing test** (renderToStaticMarkup over the pure UI; asserts toolbar tools, the three modes' affordances, dedupe-irrelevant rendering, path-mode rectangles, numeric `data-node-id`)

```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SemCanvasUI } from './SemCanvas'
import type { Construct, StructuralPath } from '../state/session'

const C = (id: number, name: string, items: string[], x = 0, y = 0): Construct =>
  ({ id, name, items, x, y })
const noop = () => {}

const baseProps = {
  constructs: [] as Construct[],
  columns: [] as string[],
  paths: [] as StructuralPath[],
  modelKind: 'latent' as const,
  mode: 'draw' as const,
  estimates: null,
  running: false,
  onAddPath: noop,
  onRemovePath: noop,
  onMoveNode: noop,
  onSetMode: noop,
}

function render(over: Partial<typeof baseProps>) {
  return renderToStaticMarkup(<SemCanvasUI {...baseProps} {...over} />)
}

describe('SemCanvasUI — interaction affordances', () => {
  it('renders the three-tool toolbar with Draw path / Move / Delete', () => {
    const html = render({})
    expect(html).toContain('Draw path')
    expect(html).toContain('Move')
    expect(html).toContain('Delete')
  })

  it('marks the active tool button (mode=move) with the "on" class', () => {
    const html = render({ mode: 'move' })
    // the Move button carries aria-pressed=true when it is the active tool
    expect(html).toMatch(/aria-label="Move"[^>]*aria-pressed="true"/)
    expect(html).toMatch(/aria-label="Draw path"[^>]*aria-pressed="false"/)
  })

  it('latent mode renders one oval (ellipse) per construct, tagged with a numeric data-node-id', () => {
    const constructs = [C(1, 'Engagement', ['q1', 'q2'], 120, 80), C(2, 'Loyalty', ['q3', 'q4'], 360, 80)]
    const html = render({ constructs })
    expect(html).toContain('<ellipse')
    expect(html).toContain('data-node-id="1"')
    expect(html).toContain('data-node-id="2"')
    expect(html).toContain('Engagement')
    expect(html).toContain('Loyalty')
  })

  it('an incomplete construct (<2 items) renders muted (dashed stroke)', () => {
    const html = render({ constructs: [C(1, 'Half', ['q1'], 100, 80)] })
    expect(html).toContain('stroke-dasharray')
  })

  it('path mode renders rectangles (observed) from columns, no item boxes', () => {
    const html = render({ modelKind: 'path', columns: ['gpa', 'study', 'score'] })
    expect(html).toContain('<rect')
    expect(html).toContain('data-node-id="0"')   // path-mode node ids = column index
    expect(html).toContain('data-node-id="2"')
    expect(html).not.toContain('<ellipse')
  })

  it('renders one delete hit-target per path, tagged with its numeric index', () => {
    const constructs = [C(1, 'A', ['q1', 'q2'], 100, 80), C(2, 'B', ['q3', 'q4'], 300, 80)]
    const paths: StructuralPath[] = [{ from: 1, to: 2 }]
    const html = render({ constructs, paths, mode: 'delete' })
    expect(html).toContain('data-path-index="0"')
  })

  it('draws a directed line per path with an arrowhead marker', () => {
    const constructs = [C(1, 'A', ['q1', 'q2'], 100, 80), C(2, 'B', ['q3', 'q4'], 300, 80)]
    const html = render({ constructs, paths: [{ from: 1, to: 2 }] })
    expect(html).toContain('marker-end')
    expect(html).toContain('id="sem-arrow"')
  })

  it('post-run estimates annotate the path with its standardized beta', () => {
    const constructs = [C(1, 'A', ['q1', 'q2'], 100, 80), C(2, 'B', ['q3', 'q4'], 300, 80)]
    const estimates = { paths: [{ from: 1, to: 2, beta: 0.42 }], loadings: {}, r2: { 2: 0.31 } }
    const html = render({ constructs, paths: [{ from: 1, to: 2 }], estimates })
    expect(html).toContain('0.42')   // β on the path
    expect(html).toContain('0.31')   // R² on the endogenous oval
  })

  it('disables every toolbar button while running', () => {
    const html = render({ running: true })
    const buttons = html.match(/<button[^>]*aria-label="(Draw path|Move|Delete)"[^>]*>/g) ?? []
    expect(buttons.length).toBe(3)
    expect(buttons.every((b) => b.includes('disabled'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run it, verify FAIL**
  - Command: `npx vitest run src/components/SemCanvas.interactions.test.tsx`
  - Expected: FAIL — the Unit-3a `SemCanvasUI` renders a static diagram with no toolbar; assertions for `Draw path`/`aria-pressed`/`data-path-index`/`marker-end`/β annotation all miss. (If `SemCanvas.tsx` somehow lacks these exports it errors on import — still a red bar.)

- [ ] **Step 3: Implement** (extend `src/components/SemCanvas.tsx` — full file; the static Unit-3a render is folded in so the file is self-contained)

```tsx
import { useState, useRef } from 'react'
import { useSession } from '../state/session'
import type { Construct, StructuralPath } from '../state/session'
import type { CbSemResult } from '../lib/stats/cbSem'

export interface SemCanvasUIProps {
  constructs: Construct[]
  columns: string[]
  paths: StructuralPath[]
  modelKind: 'latent' | 'path'
  mode: 'draw' | 'move' | 'delete'
  estimates?: CbSemResult['estimates'] | null
  running: boolean
  onAddPath(from: number, to: number): void
  onRemovePath(index: number): void
  onMoveNode(id: number, x: number, y: number): void
  onSetMode(m: 'draw' | 'move' | 'delete'): void
}

const NODE_W = 140
const NODE_H = 64
const ITEM_W = 56
const ITEM_H = 22

/** A canvas node: latent constructs are id-addressed; path-mode columns use their array index as id. */
interface Node { id: number; label: string; items: string[]; x: number; y: number; complete: boolean }

/** Single source of truth for "what nodes does this model draw, and at what ids". */
export function nodesOf(p: Pick<SemCanvasUIProps, 'constructs' | 'columns' | 'modelKind'>): Node[] {
  if (p.modelKind === 'path') {
    return p.columns.map((name, i) => ({
      id: i, label: name, items: [], x: 60 + i * 200, y: 120, complete: true,
    }))
  }
  return p.constructs.map((c, i) => ({
    id: c.id, label: c.name || `Construct ${i + 1}`, items: c.items,
    x: c.x ?? 60 + i * 220, y: c.y ?? 100, complete: c.items.length >= 2,
  }))
}

const center = (n: Node) => ({ cx: n.x + NODE_W / 2, cy: n.y + NODE_H / 2 })

/** Pure presentational canvas — renderToStaticMarkup-testable. The connected SemCanvas owns viewBox/resize state. */
export function SemCanvasUI({
  constructs, columns, paths, modelKind, mode, estimates, running,
  onAddPath, onRemovePath, onMoveNode, onSetMode,
}: SemCanvasUIProps) {
  // pending draw source (click source → target); cancel when the same node is re-clicked
  const [pending, setPending] = useState<number | null>(null)
  const nodes = nodesOf({ constructs, columns, modelKind })
  const byId = (id: number) => nodes.find((n) => n.id === id)
  const betaOf = (from: number, to: number) =>
    estimates?.paths.find((e) => e.from === from && e.to === to)?.beta
  const r2Of = (id: number) => estimates?.r2[id]

  function clickNode(id: number) {
    if (running) return
    if (mode === 'delete') { /* node delete handled by the connected wrapper (needs removeConstruct/path cascade) */ return }
    if (mode !== 'draw') return
    if (pending === null) { setPending(id); return }
    if (pending === id) { setPending(null); return }      // cancel on same node
    const dup = paths.some((p) => p.from === pending && p.to === id)
    if (!dup) onAddPath(pending, id)                       // dedupe: never add an existing directed edge
    setPending(null)
  }

  const tool = (m: 'draw' | 'move' | 'delete', label: string) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={mode === m}
      className={`btn ghost${mode === m ? ' on' : ''}`}
      disabled={running}
      onClick={() => onSetMode(m)}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div role="toolbar" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        {tool('draw', 'Draw path')}
        {tool('move', 'Move')}
        {tool('delete', 'Delete')}
      </div>
      <svg viewBox="0 0 720 320" width="100%" style={{ background: '#f0efe9', borderRadius: 6 }}>
        <defs>
          <marker id="sem-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
            <path d="M0,0 L9,3 L0,6 Z" fill="#185fa5" />
          </marker>
        </defs>

        {/* structural paths (directed, β-annotated post-run) */}
        {paths.map((p, i) => {
          const a = byId(p.from); const b = byId(p.to)
          if (!a || !b) return null
          const A = center(a); const B = center(b)
          const beta = betaOf(p.from, p.to)
          return (
            <g key={i}>
              <line
                x1={A.cx} y1={A.cy} x2={B.cx} y2={B.cy}
                stroke="#185fa5" strokeWidth={2} markerEnd="url(#sem-arrow)"
              />
              {beta !== undefined && (
                <text x={(A.cx + B.cx) / 2} y={(A.cy + B.cy) / 2 - 6} fontSize={13} fill="#185fa5" textAnchor="middle">
                  {beta.toFixed(2)}
                </text>
              )}
              {mode === 'delete' && (
                <circle
                  data-path-index={i}
                  cx={(A.cx + B.cx) / 2} cy={(A.cy + B.cy) / 2} r={9}
                  fill="#fff" stroke="#185fa5" style={{ cursor: 'pointer' }}
                  onClick={() => !running && onRemovePath(i)}
                />
              )}
            </g>
          )
        })}

        {/* nodes: ovals (latent) or rectangles (path/observed) */}
        {nodes.map((n) => {
          const r2 = r2Of(n.id)
          const common = {
            'data-node-id': n.id,
            style: { cursor: running ? 'default' : mode === 'move' ? 'grab' : 'pointer' },
            onClick: () => clickNode(n.id),
          }
          return (
            <g key={n.id}>
              {modelKind === 'path' ? (
                <rect
                  {...common}
                  x={n.x} y={n.y} width={NODE_W} height={NODE_H} rx={4}
                  fill="#fff" stroke="#185fa5" strokeWidth={2}
                />
              ) : (
                <ellipse
                  {...common}
                  cx={n.x + NODE_W / 2} cy={n.y + NODE_H / 2} rx={NODE_W / 2} ry={NODE_H / 2}
                  fill="#fff" stroke="#185fa5" strokeWidth={2}
                  strokeDasharray={n.complete ? undefined : '5 4'}
                  opacity={n.complete ? 1 : 0.6}
                />
              )}
              <text
                x={n.x + NODE_W / 2} y={n.y + NODE_H / 2 + 4}
                fontSize={14} fill="#185fa5" textAnchor="middle"
                pointerEvents="none"
              >
                {n.label}
              </text>
              {pending === n.id && (
                <ellipse
                  cx={n.x + NODE_W / 2} cy={n.y + NODE_H / 2} rx={NODE_W / 2 + 6} ry={NODE_H / 2 + 6}
                  fill="none" stroke="#185fa5" strokeWidth={1} strokeDasharray="3 3" pointerEvents="none"
                />
              )}
              {r2 !== undefined && (
                <text x={n.x + NODE_W / 2} y={n.y - 6} fontSize={12} fill="#185fa5" textAnchor="middle" pointerEvents="none">
                  R²={r2.toFixed(2)}
                </text>
              )}
              {/* measurement model: item boxes + lines (latent, Full AMOS) */}
              {modelKind === 'latent' && n.items.map((item, k) => {
                const ix = n.x + k * (ITEM_W + 8) - ((n.items.length - 1) * (ITEM_W + 8)) / 2 + NODE_W / 2 - ITEM_W / 2
                const iy = n.y + NODE_H + 30
                const loading = estimates?.loadings[item]
                return (
                  <g key={item}>
                    <line x1={n.x + NODE_W / 2} y1={n.y + NODE_H} x2={ix + ITEM_W / 2} y2={iy} stroke="#185fa5" strokeWidth={1} />
                    <rect x={ix} y={iy} width={ITEM_W} height={ITEM_H} fill="#fff" stroke="#185fa5" strokeWidth={1} />
                    <text x={ix + ITEM_W / 2} y={iy + ITEM_H / 2 + 4} fontSize={10} fill="#185fa5" textAnchor="middle" pointerEvents="none">{item}</text>
                    {loading !== undefined && (
                      <text x={(n.x + NODE_W / 2 + ix + ITEM_W / 2) / 2} y={(n.y + NODE_H + iy) / 2} fontSize={10} fill="#185fa5" textAnchor="middle" pointerEvents="none">{loading.toFixed(2)}</text>
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** Store-connected canvas: wires useSession, owns the move-drag + viewBox(zoom/pan) + resize-grip state (Task 13). */
export function SemCanvas({ testId }: { testId: string }) {
  const s = useSession()
  const setup = s.setups[testId]
  const svgRef = useRef<SVGSVGElement | null>(null)
  void svgRef
  if (!setup) return null
  const modelKind = setup.modelKind ?? 'latent'
  const columns = s.columns.filter((c) => c.used).map((c) => c.name)
  const [mode, setMode] = useState<'draw' | 'move' | 'delete'>('draw')
  void useState
  return (
    <SemCanvasUI
      constructs={setup.constructs ?? []}
      columns={columns}
      paths={setup.paths ?? []}
      modelKind={modelKind}
      mode={mode}
      estimates={null}
      running={s.runStatus === 'running'}
      onAddPath={(from, to) => s.addPath(testId, from, to)}
      onRemovePath={(i) => s.removePath(testId, i)}
      onMoveNode={(id, x, y) => s.moveNode(testId, id, x, y)}
      onSetMode={setMode}
    />
  )
}
```

- [ ] **Step 4: Run, verify PASS**
  - Command: `npx vitest run src/components/SemCanvas.interactions.test.tsx`
  - Expected: PASS — all 9 assertions green (toolbar, `aria-pressed` active tool, ovals with numeric `data-node-id`, dashed incomplete construct, path-mode rectangles, per-path `data-path-index`, arrowhead `marker-end`, β/R² annotation, running disables tools).

- [ ] **Step 5: Commit**
```
git add src/components/SemCanvas.tsx src/components/SemCanvas.interactions.test.tsx
git commit -m "feat(sem-canvas): draw/move/delete tools + path/estimate render in SemCanvasUI

Click-to-draw (source→target, dedupe, cancel-on-same), per-path delete
hit-targets, path-mode rectangles vs latent ovals, post-run beta/R2/loading
overlay. Numeric node ids end-to-end. Pure renderToStaticMarkup-tested.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
```

---

### Task 13: Connected SemCanvas — useSession wiring + drag-move, viewBox zoom/pan, resize grip
**Files:**
- Modify `src/components/SemCanvas.tsx:SemCanvas` (replace the Task-12 thin wrapper with the full interactive wrapper: pointer-drag move with screen→viewBox coords, zoom −/+/Fit buttons mutating viewBox, pan, and a resize grip changing canvas height; items keep their side because they are drawn relative to the moved node)
- Test `src/components/SemCanvas.wiring.test.tsx` (new)

**Interfaces:** Consumes: `SemCanvasUIProps`, `useSession` actions `addPath`/`removePath`/`moveNode`/`setConstructMode` (Unit 2), `setup.paths`/`modelKind`/`constructs[].x/y` · Produces: production `SemCanvas` that posts every interaction through `useSession` (the e2e in Task 14 drives it); the `screenToViewBox` coordinate helper (drag correctness)

- [ ] **Step 1: Write the failing test** (store-action wiring via `useSession.setState`/`getState`, mirroring `ConstructSlots.test.tsx`'s store-mutation block; plus a unit test of the pure `screenToViewBox` helper so the drag math is verified without a real DOM)

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { useSession } from '../state/session'
import { screenToViewBox } from './SemCanvas'
import type { ColumnMeta } from '../lib/data/columnMeta'

const numericCol = (name: string): ColumnMeta => ({ name, detected: 'float64', tags: [], level: 'ratio', used: true })
const TEST_ID = 'cb-sem'

function seed() {
  useSession.setState({
    selection: [TEST_ID],
    columns: [numericCol('q1'), numericCol('q2'), numericCol('q3'), numericCol('q4')],
    setups: {
      [TEST_ID]: {
        roles: {}, options: {}, props: {}, blocked: null, modelKind: 'latent',
        constructs: [
          { id: 1, name: 'A', items: ['q1', 'q2'], x: 60, y: 100 },
          { id: 2, name: 'B', items: ['q3', 'q4'], x: 300, y: 100 },
        ],
        paths: [],
      },
    },
  })
}

describe('SemCanvas store wiring', () => {
  beforeEach(() => { useSession.getState().reset(); seed() })

  it('addPath records a directed structural path between two construct ids', () => {
    useSession.getState().addPath(TEST_ID, 1, 2)
    expect(useSession.getState().setups[TEST_ID].paths).toEqual([{ from: 1, to: 2 }])
  })

  it('addPath dedupes an already-present directed edge', () => {
    useSession.getState().addPath(TEST_ID, 1, 2)
    useSession.getState().addPath(TEST_ID, 1, 2)
    expect(useSession.getState().setups[TEST_ID].paths).toHaveLength(1)
  })

  it('addPath keeps A→B and B→A as distinct directed edges', () => {
    useSession.getState().addPath(TEST_ID, 1, 2)
    useSession.getState().addPath(TEST_ID, 2, 1)
    expect(useSession.getState().setups[TEST_ID].paths).toEqual([{ from: 1, to: 2 }, { from: 2, to: 1 }])
  })

  it('removePath drops the path at the given index', () => {
    useSession.getState().addPath(TEST_ID, 1, 2)
    useSession.getState().addPath(TEST_ID, 2, 1)
    useSession.getState().removePath(TEST_ID, 0)
    expect(useSession.getState().setups[TEST_ID].paths).toEqual([{ from: 2, to: 1 }])
  })

  it('moveNode updates the matched construct x/y by id (items move with it — they are drawn relative)', () => {
    useSession.getState().moveNode(TEST_ID, 2, 410, 220)
    const c = useSession.getState().setups[TEST_ID].constructs!.find((x) => x.id === 2)!
    expect(c).toMatchObject({ id: 2, x: 410, y: 220 })
    expect(c.items).toEqual(['q3', 'q4'])   // items unchanged → keep their side
  })

  it('setConstructMode flips a construct between reflective and formative by id', () => {
    useSession.getState().setConstructMode(TEST_ID, 1, 'formative')
    expect(useSession.getState().setups[TEST_ID].constructs!.find((x) => x.id === 1)!.mode).toBe('formative')
  })
})

describe('screenToViewBox — drag coordinate mapping', () => {
  const rect = { left: 0, top: 0, width: 720, height: 320 }
  it('maps a screen point to viewBox space at 1:1 (no zoom/pan)', () => {
    const vb = { x: 0, y: 0, w: 720, h: 320 }
    expect(screenToViewBox(360, 160, rect, vb)).toEqual({ x: 360, y: 160 })
  })
  it('scales by the viewBox/rect ratio under zoom-in (vb half the rect)', () => {
    const vb = { x: 100, y: 50, w: 360, h: 160 }   // zoomed 2× in, panned
    // screen centre → viewBox centre = origin + half the viewBox span
    expect(screenToViewBox(360, 160, rect, vb)).toEqual({ x: 100 + 180, y: 50 + 80 })
  })
})
```

- [ ] **Step 2: Run it, verify FAIL**
  - Command: `npx vitest run src/components/SemCanvas.wiring.test.tsx`
  - Expected: FAIL — `screenToViewBox` is not exported yet (import error / undefined). The store-action assertions also fail if Unit 2's `addPath`/`removePath`/`moveNode`/`setConstructMode` are not yet present, confirming this task depends on the Unit-2 actions.

- [ ] **Step 3: Implement** (replace the `SemCanvas` wrapper + add the `screenToViewBox` helper in `src/components/SemCanvas.tsx`; the pure `SemCanvasUI` from Task 12 is untouched)

```tsx
// ── add near the top of SemCanvas.tsx, after the imports ──────────────────────
interface ViewBox { x: number; y: number; w: number; h: number }

/** Map a screen-space point (clientX/Y) into the SVG viewBox space, accounting for zoom+pan.
 *  Pure + DOM-free so the drag math is unit-tested without a real SVG. */
export function screenToViewBox(
  clientX: number, clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  vb: ViewBox,
): { x: number; y: number } {
  return {
    x: vb.x + ((clientX - rect.left) / rect.width) * vb.w,
    y: vb.y + ((clientY - rect.top) / rect.height) * vb.h,
  }
}

const BASE_VB: ViewBox = { x: 0, y: 0, w: 720, h: 320 }
const ZOOM_STEP = 1.2
```

```tsx
// ── replace the entire `export function SemCanvas(...)` from Task 12 with: ──────
/** Store-connected canvas: useSession wiring + pointer-drag move + viewBox zoom/pan + resize grip.
 *  Items "keep their side" for free — SemCanvasUI draws item boxes relative to the (moved) node centre. */
export function SemCanvas({ testId }: { testId: string }) {
  const s = useSession()
  const setup = s.setups[testId]
  const [mode, setMode] = useState<'draw' | 'move' | 'delete'>('draw')
  const [vb, setVb] = useState<ViewBox>(BASE_VB)
  const [height, setHeight] = useState(360)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  // active gesture: dragging a node (move tool) or panning the canvas (any tool, blank-space drag)
  const drag = useRef<
    | { kind: 'node'; id: number; offX: number; offY: number }
    | { kind: 'pan'; startX: number; startY: number; vb0: ViewBox }
    | { kind: 'resize'; startY: number; h0: number }
    | null
  >(null)

  if (!setup) return null
  const running = s.runStatus === 'running'
  const modelKind = setup.modelKind ?? 'latent'
  const columns = s.columns.filter((c) => c.used).map((c) => c.name)

  const svgRect = () => {
    const svg = wrapRef.current?.querySelector('svg')
    const r = svg?.getBoundingClientRect()
    return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : { left: 0, top: 0, width: vb.w, height: vb.h }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (running) return
    const target = (e.target as Element).closest('[data-node-id]')
    const nodeId = target ? Number(target.getAttribute('data-node-id')) : null
    if (mode === 'move' && nodeId !== null && modelKind === 'latent') {
      // dragging a latent node (path-mode columns are fixed-laid-out, not movable)
      const c = setup.constructs?.find((x) => x.id === nodeId)
      const p = screenToViewBox(e.clientX, e.clientY, svgRect(), vb)
      drag.current = { kind: 'node', id: nodeId, offX: p.x - (c?.x ?? 0), offY: p.y - (c?.y ?? 0) }
    } else {
      drag.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, vb0: vb }
    }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    if (d.kind === 'node') {
      const p = screenToViewBox(e.clientX, e.clientY, svgRect(), vb)
      s.moveNode(testId, d.id, Math.round(p.x - d.offX), Math.round(p.y - d.offY))
    } else if (d.kind === 'pan') {
      const r = svgRect()
      const dx = ((e.clientX - d.startX) / r.width) * vb.w
      const dy = ((e.clientY - d.startY) / r.height) * vb.h
      setVb({ ...d.vb0, x: d.vb0.x - dx, y: d.vb0.y - dy })
    }
  }

  function onPointerUp() { drag.current = null }

  function onResizeDown(e: React.PointerEvent) {
    drag.current = { kind: 'resize', startY: e.clientY, h0: height }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  function onResizeMove(e: React.PointerEvent) {
    const d = drag.current
    if (d?.kind === 'resize') setHeight(Math.max(240, d.h0 + (e.clientY - d.startY)))
  }

  const zoom = (factor: number) =>
    setVb((v) => {
      const w = v.w / factor; const h = v.h / factor
      return { x: v.x + (v.w - w) / 2, y: v.y + (v.h - h) / 2, w, h }   // zoom about the centre
    })
  const fit = () => setVb(BASE_VB)

  return (
    <div ref={wrapRef}>
      <div role="toolbar" style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <button type="button" aria-label="Zoom out" className="btn ghost" disabled={running} onClick={() => zoom(1 / ZOOM_STEP)}>−</button>
        <button type="button" aria-label="Zoom in" className="btn ghost" disabled={running} onClick={() => zoom(ZOOM_STEP)}>+</button>
        <button type="button" aria-label="Fit" className="btn ghost" disabled={running} onClick={fit}>Fit</button>
      </div>
      <div
        style={{ height, position: 'relative' }}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => { onPointerMove(e); onResizeMove(e) }}
        onPointerUp={onPointerUp}
      >
        <SemCanvasUI
          constructs={setup.constructs ?? []}
          columns={columns}
          paths={setup.paths ?? []}
          modelKind={modelKind}
          mode={mode}
          estimates={null}
          running={running}
          onAddPath={(from, to) => s.addPath(testId, from, to)}
          onRemovePath={(i) => s.removePath(testId, i)}
          onMoveNode={(id, x, y) => s.moveNode(testId, id, x, y)}
          onSetMode={setMode}
        />
        <div
          aria-label="Resize canvas"
          onPointerDown={onResizeDown}
          style={{ position: 'absolute', right: 4, bottom: 4, width: 14, height: 14, cursor: 'nwse-resize', borderRight: '2px solid #185fa5', borderBottom: '2px solid #185fa5' }}
        />
      </div>
    </div>
  )
}
```
  - Note: the viewBox is consumed by `SemCanvasUI`'s `<svg viewBox=…>` — pass `vb` through if Unit 3a/Task 12 made the viewBox a prop; if it stayed internal, lift it to a `viewBox` prop here (one-line `SemCanvasUIProps` addition: `viewBox?: ViewBox`, default `BASE_VB`). Keep `SemCanvasUI` pure.

- [ ] **Step 4: Run, verify PASS**
  - Command: `npx vitest run src/components/SemCanvas.wiring.test.tsx`
  - Expected: PASS — all 8 assertions green: `addPath` records/dedupes/keeps-direction, `removePath` by index, `moveNode` updates x/y by id with items intact, `setConstructMode` flips by id, and `screenToViewBox` maps both at 1:1 and under zoom+pan.

- [ ] **Step 5: Commit**
```
git add src/components/SemCanvas.tsx src/components/SemCanvas.wiring.test.tsx
git commit -m "feat(sem-canvas): connected SemCanvas — drag-move, viewBox zoom/pan, resize grip

Pointer-drag moves a latent node by id (items keep their side — drawn
relative to node centre); blank-space drag pans; ±/Fit mutate the viewBox;
resize grip changes canvas height. screenToViewBox maps screen→viewBox
under zoom+pan (pure, unit-tested). Every interaction routes through
useSession addPath/removePath/moveNode/setConstructMode.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
```

---

### Task 14: Numeric-id regression guard + canvas-drag e2e (Playwright)
**Files:**
- Test `src/components/SemCanvas.idtyping.test.tsx` (new — the explicit string/number `===` regression the spec calls out in §3.3)
- Test `tests/e2e/sem-canvas.spec.ts` (new — Playwright drive of draw → move-drag → delete → zoom/pan → run, mirroring `tests/e2e/association.spec.ts`'s `page.mouse` drag idiom and `tests/e2e/sem-a.spec.ts`'s construct-form flow)

**Interfaces:** Consumes: `SemCanvasUI`, `nodesOf`, `addPath`/`moveNode` (Unit 2), the live `cb-sem` card (Unit 4 routing + Unit 6 runner) · Produces: a permanent guard that ids are numeric end-to-end (no `'1' === 1` mismatch) and an e2e that proves the canvas drives a real run + estimate overlay + figure export

- [ ] **Step 1: Write the failing test** (two files)

`src/components/SemCanvas.idtyping.test.tsx` — pure, deterministic, no engine:
```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SemCanvasUI, nodesOf } from './SemCanvas'
import { useSession } from '../state/session'
import type { Construct, StructuralPath } from '../state/session'
import type { ColumnMeta } from '../lib/data/columnMeta'

const numericCol = (name: string): ColumnMeta => ({ name, detected: 'float64', tags: [], level: 'ratio', used: true })
const C = (id: number, name: string, items: string[]): Construct => ({ id, name, items, x: 60, y: 100 })

describe('SemCanvas — numeric id typing (regression: no string/number === mismatch)', () => {
  it('Construct.id and StructuralPath.from/to are number-typed and match by ===', () => {
    const constructs = [C(1, 'A', ['q1', 'q2']), C(2, 'B', ['q3', 'q4'])]
    const paths: StructuralPath[] = [{ from: 1, to: 2 }]
    // a path resolves to its endpoint nodes by strict === on numeric ids
    const nodes = nodesOf({ constructs, columns: [], modelKind: 'latent' })
    const from = nodes.find((n) => n.id === paths[0].from)
    const to = nodes.find((n) => n.id === paths[0].to)
    expect(typeof from!.id).toBe('number')
    expect(typeof to!.id).toBe('number')
    expect(from!.label).toBe('A')
    expect(to!.label).toBe('B')
  })

  it('data-node-id renders the raw numeric value (not a quoted string literal in JSX semantics)', () => {
    const html = renderToStaticMarkup(
      <SemCanvasUI
        constructs={[C(7, 'Lat', ['q1', 'q2'])]} columns={[]} paths={[]}
        modelKind="latent" mode="draw" estimates={null} running={false}
        onAddPath={() => {}} onRemovePath={() => {}} onMoveNode={() => {}} onSetMode={() => {}}
      />,
    )
    expect(html).toContain('data-node-id="7"')
  })

  it('addConstruct assigns a fresh monotonic NUMERIC id (Unit-2 migration)', () => {
    useSession.getState().reset()
    useSession.setState({ selection: ['cb-sem'], columns: [numericCol('q1')], setups: { 'cb-sem': { roles: {}, options: {}, props: {}, blocked: null, constructs: [] } } })
    useSession.getState().addConstruct('cb-sem')
    useSession.getState().addConstruct('cb-sem')
    const ids = (useSession.getState().setups['cb-sem'].constructs ?? []).map((c) => c.id)
    expect(ids.every((id) => typeof id === 'number')).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)   // unique
    expect(ids[1]).toBeGreaterThan(ids[0])        // monotonic
  })

  it('a path added with the same numeric id from both store and render resolves identically', () => {
    useSession.getState().reset()
    useSession.setState({ selection: ['cb-sem'], columns: [numericCol('q1'), numericCol('q2'), numericCol('q3'), numericCol('q4')],
      setups: { 'cb-sem': { roles: {}, options: {}, props: {}, blocked: null, modelKind: 'latent',
        constructs: [C(1, 'A', ['q1', 'q2']), C(2, 'B', ['q3', 'q4'])], paths: [] } } })
    useSession.getState().addPath('cb-sem', 1, 2)
    const p = useSession.getState().setups['cb-sem'].paths![0]
    expect(typeof p.from).toBe('number')
    expect(typeof p.to).toBe('number')
    // string lookups must NOT match (proves we never coerced to string keys)
    const cs = useSession.getState().setups['cb-sem'].constructs!
    // @ts-expect-error — deliberate wrong-type lookup to prove ids are numbers, not strings
    expect(cs.find((c) => c.id === '1')).toBeUndefined()
  })
})
```

`tests/e2e/sem-canvas.spec.ts` — Playwright (real browser; reduced nboot for time per §9):
```ts
import { test, expect } from '@playwright/test'
import { gotoCard } from './fixtures/helpers'   // existing helper used by sem-a.spec.ts

// Drives the AMOS canvas end-to-end: define constructs in the form, draw a path,
// drag-move a node, delete a path, zoom, run, see estimate overlay + figure.
// NOTE: a renderToStaticMarkup unit test cannot exercise pointer drag — that is why
// the drag/move/zoom assertions live here, mirroring association.spec.ts's mouse idiom.
test('CB-SEM canvas: draw → move → delete → run → estimates + figure', async ({ page }) => {
  await gotoCard(page, 'cb-sem', 'sem.csv')   // fixture with q1..q6 (two 3-item constructs)

  // 1. define two constructs in the construct-slots form (below the canvas)
  await page.getByRole('button', { name: '+ Add construct' }).click()
  await page.getByLabel('Construct 1 name').fill('Engagement')
  for (const q of ['q1', 'q2', 'q3']) await page.getByRole('checkbox', { name: q }).check()
  await page.getByRole('button', { name: '+ Add construct' }).click()
  await page.getByLabel('Construct 2 name').fill('Loyalty')
  for (const q of ['q4', 'q5', 'q6']) await page.getByRole('checkbox', { name: q }).check()

  // 2. two ovals appear on the canvas
  await expect(page.locator('ellipse[data-node-id]')).toHaveCount(2)

  // 3. DRAW a path: Draw tool is default → click source oval then target oval
  await page.locator('[data-node-id]').first().click()
  await page.locator('[data-node-id]').nth(1).click()
  // a directed line with the shared arrowhead marker now exists
  await expect(page.locator('line[marker-end="url(#sem-arrow)"]')).toHaveCount(1)

  // 4. MOVE: switch to Move, drag the second node by ~80px; its x changes
  await page.getByRole('button', { name: 'Move' }).click()
  const node = page.locator('[data-node-id]').nth(1)
  const a = await node.boundingBox()
  await page.mouse.move(a!.x + a!.width / 2, a!.y + a!.height / 2)
  await page.mouse.down()
  await page.mouse.move(a!.x + a!.width / 2 + 80, a!.y + a!.height / 2 + 40, { steps: 12 })
  await page.mouse.up()
  const b = await node.boundingBox()
  expect(b!.x).toBeGreaterThan(a!.x + 20)

  // 5. DELETE the path: switch to Delete, click the mid-path handle
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.locator('[data-path-index="0"]').click()
  await expect(page.locator('line[marker-end="url(#sem-arrow)"]')).toHaveCount(0)

  // re-draw before running
  await page.getByRole('button', { name: 'Draw path' }).click()
  await page.locator('[data-node-id]').first().click()
  await page.locator('[data-node-id]').nth(1).click()

  // 6. ZOOM does not crash and keeps the diagram present
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(page.locator('ellipse[data-node-id]')).toHaveCount(2)

  // 7. RUN → results screen → annotated path diagram with a standardized β label
  await page.getByRole('button', { name: /run/i }).click()
  await expect(page.locator('svg[id^="figure-path-diagram-"]')).toBeVisible({ timeout: 240_000 })
  await expect(page.locator('svg[id^="figure-path-diagram-"] text')).toContainText(/0\.\d{2}/)
})
```

- [ ] **Step 2: Run it, verify FAIL**
  - Commands:
    - `npx vitest run src/components/SemCanvas.idtyping.test.tsx`
    - `npx playwright test tests/e2e/sem-canvas.spec.ts`
  - Expected: the vitest file FAILS until Unit-2 `addConstruct` assigns numeric ids and `addPath` exists (the monotonic-id and path assertions are red). The Playwright spec FAILS until `cb-sem` is routed to the canvas (Unit 4) and the runner is live (Unit 6) — locators `ellipse[data-node-id]`, `line[marker-end="url(#sem-arrow)"]`, `[data-path-index]`, and `svg[id^="figure-path-diagram-"]` resolve to 0. (This is the cross-unit integration guard; expected red until Units 4/6 land — runnable green at the slice gate.)

- [ ] **Step 3: Implement** — no production code in this task; it is the regression/integration harness. The behaviors it asserts are produced by Task 12 (`nodesOf`, `data-node-id`, `marker-end`, `data-path-index`), Task 13 (drag-move), Unit 2 (numeric `addConstruct`/`addPath`), Unit 4 (`cb-sem`→canvas route), and Unit 6 (`runCbSem` + `figure-path-diagram` overlay). If any assertion needs a stable hook the components don't yet expose, add only that hook (e.g. confirm the on-screen overlay renders into `<svg id={\`figure-path-diagram-${testId}\`}>` per the backbone) — do not add behavior here.
  - Add the e2e fixture if absent: `tests/e2e/fixtures/sem.csv` (≥6 numeric columns `q1..q6`, ≥50 rows, two clean 3-item factors) so the run produces a converging two-construct model. Reuse the sem-a fixture if it already has q1..q6.

- [ ] **Step 4: Run, verify PASS**
  - Commands:
    - `npx vitest run src/components/SemCanvas.idtyping.test.tsx` → all 5 assertions green (numeric typing, raw `data-node-id`, monotonic unique ids, string-lookup-undefined).
    - `npx playwright test tests/e2e/sem-canvas.spec.ts` → green once Units 4/6 are landed (draw/move/delete/zoom/run/figure all resolve).
  - Expected at the slice gate: both PASS as part of `full WebR vitest ×2` + `e2e (Playwright)`.

- [ ] **Step 5: Commit**
```
git add src/components/SemCanvas.idtyping.test.tsx tests/e2e/sem-canvas.spec.ts tests/e2e/fixtures/sem.csv
git commit -m "test(sem-canvas): numeric-id regression guard + canvas-drag e2e

Pure guard proves Construct.id / StructuralPath.from/to are number-typed and
resolve by strict === (the prototype's '1'===1 bug class), incl. a deliberate
@ts-expect-error string lookup that must miss. Playwright e2e drives the full
AMOS canvas: define constructs → draw path → drag-move node → delete path →
zoom → run → annotated figure with standardized beta. e2e uses reduced nboot.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
```

Notes for the assembler (file paths, all absolute):
- Tasks 12-13 modify `/Users/benjie/Documents/Telos/src/components/SemCanvas.tsx` (created in Unit 3a / Task 10-11). Task 12 adds the toolbar + interaction render + exported `nodesOf`; Task 13 replaces the connected `SemCanvas` wrapper and adds exported `screenToViewBox`. Both keep `SemCanvasUI` pure (`renderToStaticMarkup`-testable).
- New test files: `/Users/benjie/Documents/Telos/src/components/SemCanvas.interactions.test.tsx`, `/Users/benjie/Documents/Telos/src/components/SemCanvas.wiring.test.tsx`, `/Users/benjie/Documents/Telos/src/components/SemCanvas.idtyping.test.tsx`, `/Users/benjie/Documents/Telos/tests/e2e/sem-canvas.spec.ts`.
- Hard dependencies: Task 13's `addPath/removePath/moveNode/setConstructMode` and Task 14's numeric `addConstruct` come from Unit 2 (state) — these tasks are written to go red until Unit 2 lands, matching the spec's serial-edge annotation (3b after 3a; wiring needs Unit 2 actions). The e2e in Task 14 is a cross-unit integration guard green only after Units 4 (routing) + 6 (`runCbSem`) — flagged in Step 2.
- The Playwright drag idiom (`boundingBox()` + `page.mouse.move/down/up({steps})`) and the `gotoCard(page, id, csv)` helper mirror the existing `/Users/benjie/Documents/Telos/tests/e2e/association.spec.ts` and `/Users/benjie/Documents/Telos/tests/e2e/sem-a.spec.ts`. Confirm the helper export name in `tests/e2e/fixtures/helpers.ts` during assembly (sem-a.spec.ts is the reference).

---

### Task 15: TestConfigScreen routes `inputKind==='sem-canvas'` to the canvas+form composite (`SemConfig`)

**Files:**
- Create `src/components/SemConfig.tsx`
- Create (test) `src/components/SemConfig.test.tsx`
- Modify `src/components/screens/TestConfigScreen.tsx:24` (the input-region switch)

**Interfaces:** Consumes: `TestSpec.inputKind?: 'construct-slots' | 'sem-canvas'` (Unit 2/types), `Construct`, `StructuralPath`, `TestSetup` with `paths?`/`modelKind?` (Unit 2), the connected `SemCanvas` component (Unit 3b), `ConstructSlots` (Slice A), `useSession` · Produces: `SemConfig` (connected composite, consumed by `TestConfigScreen`); `SemConfigUI` (pure, `renderToStaticMarkup`-testable) — Task 16 mounts the bespoke controls inside it.

- [ ] **Step 1: Write the failing test** (complete code)

```tsx
// src/components/SemConfig.test.tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SemConfigUI } from './SemConfig'
import type { Construct, StructuralPath } from '../state/session'

const noop = () => {}

function renderUI(opts: {
  modelKind?: 'latent' | 'path'
  constructs?: Construct[]
  paths?: StructuralPath[]
  columns?: string[]
}) {
  return renderToStaticMarkup(
    <SemConfigUI
      testId="cb-sem"
      modelKind={opts.modelKind ?? 'latent'}
      constructs={opts.constructs ?? []}
      paths={opts.paths ?? []}
      columns={opts.columns ?? []}
      running={false}
      // canvas slot + form slot are injected by the connected SemConfig; in the
      // pure UI they are children passed through, so the test passes simple nodes.
      canvas={<div data-testid="canvas-slot">CANVAS</div>}
      form={<div data-testid="form-slot">FORM</div>}
      controls={<div data-testid="controls-slot">CONTROLS</div>}
    />
  )
}

describe('SemConfigUI — layout (latent / CB-SEM)', () => {
  it('renders the canvas region above the construct-slots form (D3: canvas on top, form below)', () => {
    const html = renderUI({ modelKind: 'latent' })
    expect(html).toContain('CANVAS')
    expect(html).toContain('FORM')
    // canvas must come before the form in document order (D3)
    expect(html.indexOf('CANVAS')).toBeLessThan(html.indexOf('FORM'))
  })

  it('renders the bespoke controls region after the form', () => {
    const html = renderUI({ modelKind: 'latent' })
    expect(html).toContain('CONTROLS')
    expect(html.indexOf('FORM')).toBeLessThan(html.indexOf('CONTROLS'))
  })

  it('shows the "recommend 3 items" advisory note for latent constructs (§3.2)', () => {
    const html = renderUI({
      modelKind: 'latent',
      constructs: [{ id: 1, name: 'A', items: ['q1', 'q2'] }],
    })
    expect(html).toContain('recommend 3')
  })
})

describe('SemConfigUI — path mode (observed-only)', () => {
  it('hides the construct-slots form in path mode (nodes = single observed columns, §3.6)', () => {
    const html = renderUI({ modelKind: 'path', columns: ['x', 'm', 'y'] })
    expect(html).toContain('CANVAS')
    expect(html).not.toContain('FORM')
  })

  it('does NOT show the recommend-3 advisory in path mode (no items to recommend)', () => {
    const html = renderUI({ modelKind: 'path', columns: ['x', 'm', 'y'] })
    expect(html).not.toContain('recommend 3')
  })
})
```

- [ ] **Step 2: Run it, verify FAIL** — `npx vitest run src/components/SemConfig.test.tsx`. Expected: fails to resolve module `./SemConfig` (Cannot find module / export `SemConfigUI`).

- [ ] **Step 3: Implement** (complete code)

```tsx
// src/components/SemConfig.tsx
import type { ReactNode } from 'react'
import { useSession } from '../state/session'
import type { Construct, StructuralPath } from '../state/session'
import { ConstructSlots } from './ConstructSlots'
import { SemCanvas } from './SemCanvas'

export interface SemConfigUIProps {
  testId: string
  modelKind: 'latent' | 'path'
  constructs: Construct[]
  paths: StructuralPath[]
  columns: string[]
  running: boolean
  canvas: ReactNode   // <SemCanvas> (Unit 3b) — injected so the pure UI is renderToStaticMarkup-testable
  form: ReactNode     // <ConstructSlots> — hidden in path mode
  controls: ReactNode // bespoke pipeline/missing/bootstrap controls (Task 16)
}

/** Pure presentational composite — D3 layout: canvas on top (full-width), construct form below, bespoke controls last. */
export function SemConfigUI({ modelKind, constructs, form, canvas, controls, running }: SemConfigUIProps) {
  const advise3 =
    modelKind === 'latent' &&
    constructs.length > 0 &&
    constructs.some((c) => c.items.length >= 2 && c.items.length < 3)
  return (
    <div className="sem-config">
      {/* Canvas: on top, full-width (D3) */}
      <div className="sem-canvas-region" style={{ marginTop: 8 }}>
        {canvas}
      </div>
      {/* Measurement model: construct-slots form below the canvas — latent only (path mode = observed columns) */}
      {modelKind !== 'path' && (
        <div className="sem-form-region" style={{ marginTop: 16 }}>
          <div className="eyebrow">Measurement model</div>
          {form}
          {advise3 && (
            <p className="hint" role="note" style={{ marginTop: 6 }}>
              Tip: we recommend 3 or more items per construct (2 only works inside a larger model — Kline).
            </p>
          )}
        </div>
      )}
      {/* Bespoke controls (Task 16): pipeline stages · missing data · bootstrap */}
      <div className="sem-controls-region" style={{ marginTop: 16 }} aria-disabled={running}>
        {controls}
      </div>
    </div>
  )
}

/** Store-connected composite — used in production via TestConfigScreen. Controls slot is filled in Task 16. */
export function SemConfig({ testId }: { testId: string }) {
  const s = useSession()
  const setup = s.setups[testId]
  if (!setup) return null
  const modelKind = setup.modelKind ?? 'latent'
  const constructs = setup.constructs ?? []
  const columns = s.columns.filter((c) => c.used && c.level !== null).map((c) => c.name)
  return (
    <SemConfigUI
      testId={testId}
      modelKind={modelKind}
      constructs={constructs}
      paths={setup.paths ?? []}
      columns={columns}
      running={s.runStatus === 'running'}
      canvas={<SemCanvas testId={testId} />}
      form={<ConstructSlots testId={testId} />}
      controls={null /* Task 16 mounts <SemControls testId={testId} /> here */}
    />
  )
}
```

Then route it in `TestConfigScreen.tsx`. Replace line 24:

```tsx
      {spec.inputKind === 'construct-slots' ? <ConstructSlots testId={testId} />
        : spec.inputKind === 'sem-canvas' ? <SemConfig testId={testId} />
        : <DragSlots testId={testId} spec={spec} />}
```

And add the import at the top of `TestConfigScreen.tsx` (alongside the existing `ConstructSlots` import on line 4):

```tsx
import { SemConfig } from '../SemConfig'
```

- [ ] **Step 4: Run, verify PASS** — `npx vitest run src/components/SemConfig.test.tsx && npx tsc --noEmit`. Expected: all SemConfigUI tests pass; tsc 0 errors. (Unit 2 must already export `StructuralPath` and `Construct.id`; Unit 3b must already export `SemCanvas` — both are earlier units.)

- [ ] **Step 5: Commit**

```bash
git add src/components/SemConfig.tsx src/components/SemConfig.test.tsx src/components/screens/TestConfigScreen.tsx
git commit -m "feat(sem-b): SemConfig composite — canvas-on-top + form-below layout, inputKind routing

- TestConfigScreen routes inputKind==='sem-canvas' to <SemConfig> (migrates off constructsInput)
- SemConfigUI is pure (renderToStaticMarkup-testable); path mode hides the construct form
- recommend-3-items advisory for latent constructs (Kline)
- controls slot reserved for the bespoke pipeline/missing/bootstrap UI (Task 16)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
```

---

### Task 16: Bespoke controls inside the composite — pipeline-stage selector, estimator-aware missing-data dropdown, bootstrap control (presets + free entry + time estimate)

**Files:**
- Create `src/components/SemControls.tsx`
- Create (test) `src/components/SemControls.test.tsx`
- Modify `src/components/SemConfig.tsx` (the `controls={null}` slot in the connected `SemConfig` → `<SemControls testId={testId} />`)

**Interfaces:** Consumes: `useSession`, `setOption(testId, id, value)` (existing store action — bespoke controls persist into `setup.options`), `setup.options` (`pipeline`, `efa`, `estimator`, `missing`, `nboot`), `spec.id` (`'cb-sem'` vs `'pls-sem'` decides which controls show), `setup.modelKind` · Produces: `SemControlsUI` (pure, `renderToStaticMarkup`-testable) consumed by `SemConfig`. The stored option ids (`pipeline`/`efa`/`estimator`/`missing`/`nboot`) are the source of truth read by `runCbSem`/`runPlsSem` (Units 6/7) and the emitters (Unit 5).

- [ ] **Step 1: Write the failing test** (complete code)

```tsx
// src/components/SemControls.test.tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SemControlsUI, BOOTSTRAP_PRESETS, estBootstrapMinutes } from './SemControls'

const noop = () => {}

function renderUI(over: Partial<Parameters<typeof SemControlsUI>[0]> = {}) {
  return renderToStaticMarkup(
    <SemControlsUI
      track="cb-sem"
      modelKind="latent"
      pipeline="full"
      efa={false}
      estimator="ML"
      missing="fiml"
      nboot={5000}
      running={false}
      onSetPipeline={noop}
      onSetEfa={noop}
      onSetEstimator={noop}
      onSetMissing={noop}
      onSetNboot={noop}
      {...over}
    />
  )
}

describe('SemControlsUI — pipeline-stage selector (CB-SEM, §3.4)', () => {
  it('defaults to the full model and offers full / cfa-only stages', () => {
    const html = renderUI({ pipeline: 'full' })
    expect(html).toContain('full')
    expect(html).toContain('cfa-only')
  })

  it('marks CFA + fit as locked/always-on (not a toggle)', () => {
    const html = renderUI()
    expect(html).toContain('CFA + fit indices')
    expect(html).toContain('always on')
  })

  it('shows the EFA sub-toggle reflecting its state', () => {
    const html = renderUI({ efa: true })
    expect(html).toContain('Exploratory factor analysis')
    expect(html).toContain('checked=""') // EFA checkbox on
  })

  it('does NOT render the pipeline selector for PLS-SEM (no pipeline strip, §3.5)', () => {
    const html = renderUI({ track: 'pls-sem' })
    expect(html).not.toContain('cfa-only')
  })

  it('does NOT render the pipeline selector in path mode (observed-only, §3.6)', () => {
    const html = renderUI({ modelKind: 'path' })
    expect(html).not.toContain('cfa-only')
  })
})

describe('SemControlsUI — estimator-aware missing-data dropdown (§3.4)', () => {
  it('CB-SEM: renders the estimator dropdown (WLSMV/ML/MLR) and the missing-data dropdown', () => {
    const html = renderUI({ track: 'cb-sem' })
    expect(html).toContain('WLSMV')
    expect(html).toContain('MLR')
    expect(html).toContain('FIML')
    expect(html).toContain('listwise')
  })

  it('greys FIML when the estimator is WLSMV (FIML is an ML-family option)', () => {
    // WLSMV cannot use FIML — the FIML option must be disabled.
    const html = renderUI({ track: 'cb-sem', estimator: 'WLSMV', missing: 'pairwise' })
    expect(html).toContain('value="fiml" disabled=""')
  })

  it('PLS-SEM has NO estimator dropdown (missing follows global step-4a, §3.5)', () => {
    const html = renderUI({ track: 'pls-sem' })
    expect(html).not.toContain('WLSMV')
    expect(html).not.toContain('MLR')
  })
})

describe('SemControlsUI — bootstrap control (presets + free entry + time estimate, D6)', () => {
  it('exposes 1k / 5k / 10k presets and 5000 is the live value', () => {
    const html = renderUI({ nboot: 5000 })
    expect(BOOTSTRAP_PRESETS).toEqual([1000, 5000, 10000])
    expect(html).toContain('5000')
  })

  it('renders a free-entry number input for the resample count', () => {
    const html = renderUI()
    expect(html).toContain('aria-label="bootstrap resamples"')
  })

  it('shows a computed time estimate (elapsed/est is time-based, not per-resample, D7)', () => {
    const html = renderUI({ track: 'pls-sem', nboot: 5000 })
    // PLS 5k ≈ 8.5 min per the spike (§5.3)
    expect(html).toContain('min')
    expect(html).toMatch(/≈\s*8\.5\s*min/)
  })

  it('notes BCa kicks in only at the 10k preset, percentile otherwise (D10)', () => {
    expect(html10()).toContain('percentile')
    expect(renderUI({ nboot: 10000 })).toContain('BCa')
  })
})

function html10() {
  return renderUI({ nboot: 5000 })
}

describe('estBootstrapMinutes — spike-calibrated estimate (§5.3)', () => {
  it('CB-SEM 5000 ≈ 2.7 min (mediation 5k spike)', () => {
    expect(estBootstrapMinutes('cb-sem', 5000)).toBeCloseTo(2.7, 1)
  })
  it('PLS 5000 ≈ 8.5 min and 10000 ≈ 17 min (linear in resamples)', () => {
    expect(estBootstrapMinutes('pls-sem', 5000)).toBeCloseTo(8.5, 1)
    expect(estBootstrapMinutes('pls-sem', 10000)).toBeCloseTo(17, 0)
  })
  it('scales linearly with the resample count', () => {
    expect(estBootstrapMinutes('pls-sem', 2500)).toBeCloseTo(4.25, 1)
  })
})
```

- [ ] **Step 2: Run it, verify FAIL** — `npx vitest run src/components/SemControls.test.tsx`. Expected: fails to resolve module `./SemControls` (Cannot find export `SemControlsUI` / `BOOTSTRAP_PRESETS` / `estBootstrapMinutes`).

- [ ] **Step 3: Implement** (complete code)

```tsx
// src/components/SemControls.tsx
import { useSession } from '../state/session'

export const BOOTSTRAP_PRESETS = [1000, 5000, 10000] as const

// Spike-calibrated per-resample wall time in WASM (§5.3): CB-SEM mediation 5k ≈ 2.7 min; PLS 5k ≈ 8.5 min, 10k ≈ 17 min.
// Time-based progress (D7) uses this for the elapsed/estimate bar — NOT per-resample counts.
const MIN_PER_5K: Record<'cb-sem' | 'pls-sem', number> = { 'cb-sem': 2.7, 'pls-sem': 8.5 }

/** Spike-calibrated estimate, linear in resamples. Returns minutes. */
export function estBootstrapMinutes(track: 'cb-sem' | 'pls-sem', nboot: number): number {
  return (MIN_PER_5K[track] * nboot) / 5000
}

// CB-SEM missing-data options. `mlOnly` ones are greyed when the estimator is not ML-family (WLSMV).
const MISSING_OPTS: Array<{ id: string; label: string; mlOnly: boolean }> = [
  { id: 'fiml', label: 'FIML (full-information ML)', mlOnly: true },
  { id: 'mi', label: 'Multiple imputation', mlOnly: false },
  { id: 'pairwise', label: 'Pairwise', mlOnly: false },
  { id: 'listwise', label: 'Listwise deletion', mlOnly: false },
]
const isMlFamily = (estimator: string) => estimator === 'ML' || estimator === 'MLR'

export interface SemControlsUIProps {
  track: 'cb-sem' | 'pls-sem'
  modelKind: 'latent' | 'path'
  pipeline: 'full' | 'cfa-only'
  efa: boolean
  estimator: string
  missing: string
  nboot: number
  running: boolean
  onSetPipeline: (p: 'full' | 'cfa-only') => void
  onSetEfa: (on: boolean) => void
  onSetEstimator: (e: string) => void
  onSetMissing: (m: string) => void
  onSetNboot: (n: number) => void
}

/** Pure presentational bespoke controls — NOT generic option pills (locked stages, conditional greying, computed estimate). */
export function SemControlsUI({
  track, modelKind, pipeline, efa, estimator, missing, nboot, running,
  onSetPipeline, onSetEfa, onSetEstimator, onSetMissing, onSetNboot,
}: SemControlsUIProps) {
  const isCb = track === 'cb-sem'
  const showPipeline = isCb && modelKind !== 'path'
  const estMin = estBootstrapMinutes(track, nboot)
  const ci = nboot >= 10000 ? 'BCa' : 'percentile'
  return (
    <div className="sem-controls">
      {/* ── Pipeline-stage selector (CB-SEM, latent only) — OPTIONAL/ADVANCED, defaults to full ── */}
      {showPipeline && (
        <fieldset className="card" style={{ marginTop: 8 }}>
          <legend className="eyebrow">Pipeline <span className="hint">(optional · advanced — defaults to the full model)</span></legend>
          <label className="pill" style={{ cursor: 'pointer' }}>
            <input type="radio" name="sem-pipeline" value="full" checked={pipeline === 'full'}
              disabled={running} onChange={() => onSetPipeline('full')} style={{ marginRight: 6 }} />
            full (measurement + structural)
          </label>
          <label className="pill" style={{ cursor: 'pointer', marginLeft: 8 }}>
            <input type="radio" name="sem-pipeline" value="cfa-only" checked={pipeline === 'cfa-only'}
              disabled={running} onChange={() => onSetPipeline('cfa-only')} style={{ marginRight: 6 }} />
            cfa-only (measurement step — Anderson & Gerbing)
          </label>
          <div style={{ marginTop: 8 }}>
            <span className="pill" aria-disabled="true">CFA + fit indices <em className="hint">always on</em></span>
            <label className="pill" style={{ cursor: 'pointer', marginLeft: 8 }}>
              <input type="checkbox" checked={efa} disabled={running}
                onChange={(e) => onSetEfa(e.target.checked)} style={{ marginRight: 6 }} />
              Exploratory factor analysis (EFA)
            </label>
          </div>
        </fieldset>
      )}

      {/* ── Estimator + estimator-aware missing-data (CB-SEM only; PLS missing follows global step-4a) ── */}
      {isCb && (
        <fieldset className="card" style={{ marginTop: 8 }}>
          <legend className="eyebrow">Estimation</legend>
          <label className="pill">
            estimator{' '}
            <select aria-label="estimator" value={estimator} disabled={running}
              onChange={(e) => onSetEstimator(e.target.value)}
              style={{ border: 0, background: 'transparent', font: 'inherit', color: 'inherit' }}>
              {['WLSMV', 'ML', 'MLR'].map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          <label className="pill" style={{ marginLeft: 8 }}>
            missing data{' '}
            <select aria-label="missing data" value={missing} disabled={running}
              onChange={(e) => onSetMissing(e.target.value)}
              style={{ border: 0, background: 'transparent', font: 'inherit', color: 'inherit' }}>
              {MISSING_OPTS.map((m) => (
                <option key={m.id} value={m.id} disabled={m.mlOnly && !isMlFamily(estimator)}>{m.label}</option>
              ))}
            </select>
          </label>
          {!isMlFamily(estimator) && (
            <p className="hint" role="note" style={{ marginTop: 4 }}>
              FIML requires an ML-family estimator (ML or MLR); under WLSMV use pairwise.
            </p>
          )}
        </fieldset>
      )}

      {/* ── Bootstrap control — presets + free entry + spike-calibrated time estimate (D6/D7/D10) ── */}
      <fieldset className="card" style={{ marginTop: 8 }}>
        <legend className="eyebrow">Bootstrap</legend>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {BOOTSTRAP_PRESETS.map((n) => (
            <label key={n} className={`pill${nboot === n ? ' on' : ''}`} style={{ cursor: 'pointer' }}>
              <input type="radio" name="sem-nboot" value={n} checked={nboot === n}
                disabled={running} onChange={() => onSetNboot(n)} style={{ marginRight: 6 }} />
              {n === 1000 ? '1k' : n === 5000 ? '5k' : '10k'}
            </label>
          ))}
          <label className="pill">
            resamples{' '}
            <input type="number" min={100} step={100} value={nboot} disabled={running}
              aria-label="bootstrap resamples" onChange={(e) => onSetNboot(Number(e.target.value))}
              style={{ width: '6em', border: 0, background: 'transparent', font: 'inherit', color: 'inherit' }} />
          </label>
          <span className="hint" role="status">≈ {estMin.toFixed(1)} min · {ci} CI</span>
        </div>
        <p className="hint" style={{ marginTop: 4 }}>
          {nboot >= 10000
            ? 'BCa confidence intervals (publication-grade; BCa needs ≈7k+ resamples to be accurate).'
            : 'Percentile confidence intervals (cross-track consistency; BCa reserved for the 10k preset).'}
        </p>
      </fieldset>
    </div>
  )
}

/** Store-connected bespoke controls — values persist into setup.options, read by runCbSem/runPlsSem + emitters. */
export function SemControls({ testId }: { testId: string }) {
  const s = useSession()
  const spec = s.setups[testId] && (testId === 'pls-sem' ? 'pls-sem' : 'cb-sem')
  const setup = s.setups[testId]
  if (!setup) return null
  const o = setup.options
  return (
    <SemControlsUI
      track={spec as 'cb-sem' | 'pls-sem'}
      modelKind={setup.modelKind ?? 'latent'}
      pipeline={(o.pipeline as 'full' | 'cfa-only') ?? 'full'}
      efa={!!o.efa}
      estimator={String(o.estimator ?? 'ML')}
      missing={String(o.missing ?? 'fiml')}
      nboot={Number(o.nboot ?? 5000)}
      running={s.runStatus === 'running'}
      onSetPipeline={(p) => s.setOption(testId, 'pipeline', p)}
      onSetEfa={(on) => s.setOption(testId, 'efa', on)}
      onSetEstimator={(e) => s.setOption(testId, 'estimator', e)}
      onSetMissing={(m) => s.setOption(testId, 'missing', m)}
      onSetNboot={(n) => s.setOption(testId, 'nboot', n)}
    />
  )
}
```

Then wire it into the connected `SemConfig` in `src/components/SemConfig.tsx`. Add the import alongside the existing imports:

```tsx
import { SemControls } from './SemControls'
```

And replace the controls slot in the connected `SemConfig` return:

```tsx
      controls={<SemControls testId={testId} />}
```

(replacing `controls={null /* Task 16 mounts <SemControls testId={testId} /> here */}`)

- [ ] **Step 4: Run, verify PASS** — `npx vitest run src/components/SemControls.test.tsx src/components/SemConfig.test.tsx && npx tsc --noEmit`. Expected: all SemControlsUI + SemConfigUI tests pass; tsc 0 errors. (`spec.inputKind` mapping `'cb-sem'`/`'pls-sem'` aligns with the registry ids registered in Unit 5; the bespoke option ids `pipeline`/`efa`/`estimator`/`missing`/`nboot` are read by Units 6/7.)

- [ ] **Step 5: Commit**

```bash
git add src/components/SemControls.tsx src/components/SemControls.test.tsx src/components/SemConfig.tsx
git commit -m "feat(sem-b): bespoke SEM controls — pipeline selector, estimator-aware missing, bootstrap

- pipeline-stage selector (full / cfa-only, defaults full; CFA+fit locked always-on; EFA sub-toggle) — CB-SEM latent only
- estimator-aware missing-data dropdown: FIML greyed when estimator is WLSMV (ML-family only)
- bootstrap control: 1k/5k/10k presets + free-entry + spike-calibrated time estimate (CB-SEM 5k≈2.7min, PLS 5k≈8.5min/10k≈17min)
- percentile CI default, BCa at the 10k preset (D10)
- values persist into setup.options (pipeline/efa/estimator/missing/nboot), read by runCbSem/runPlsSem + emitters
- mounted into SemConfig's controls slot (NOT generic option pills — locked stages, conditional greying, computed estimate)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
```

---

### Task 17: Spec-HTML INPUT-card amendments (§6A) — CB-SEM + PLS-SEM input cards → form-defines + paths-only canvas + amosbar redesign + inputs legend
**Files:**
- Modify `telos_test_inputs.html` (CB-SEM card ~2500-2594; PLS-SEM card ~2819-2898; inputs legend ~2911; page sub-note ~162)
- Test `src/lib/registry/inputCards.semB.consistency.test.ts` (Create)
**Interfaces:** Consumes: spec §6A amendments · Produces: amended drawn input cards that the Task 19/20 registry consistency tests read option pills from; the `inputKind:'sem-canvas'` UI in Unit 4 mirrors this drawn layout
- [ ] **Step 1: Write the failing test** (the amendments must drop the drag-onto-canvas copy, add construct-slots + paths-only language, redesign the amosbar, and rewrite the legend + sub-note). Create `src/lib/registry/inputCards.semB.consistency.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const html = readFileSync('telos_test_inputs.html', 'utf8')
const cbCard = html.slice(
  html.indexOf('<div class="ttl">CB-SEM</div>'),
  html.indexOf("<div class=\"ttl\">Cronbach's alpha</div>"),
)
const plsCard = html.slice(
  html.indexOf('<div class="ttl">PLS-SEM</div>'),
  html.indexOf('FAMILY 7 · ASSUMPTION DIAGNOSTICS'),
)
const legend = html.slice(html.indexOf('<div class="legend">'), html.indexOf('</div>\n\n</div>\n</body>'))
const subNote = html.slice(html.indexOf('<p class="sub-note">'), html.indexOf('</p>', html.indexOf('<p class="sub-note">')))

const amosbar = (card: string) => {
  const at = card.indexOf('<div class="amosbar">')
  return card.slice(at, card.indexOf('</div>', at))
}

describe('SEM-B input cards realize the hybrid decision (form defines constructs, canvas draws paths only)', () => {
  it('CB-SEM card no longer tells the student to drag items onto a construct', () => {
    expect(cbCard).not.toContain('drag items from the palette onto a construct')
    expect(cbCard).not.toContain('drag an item onto a construct to build the measurement model')
    expect(cbCard).not.toContain('drag the items that belong together into each construct')
  })
  it('CB-SEM card defines constructs in a construct-slots form below the canvas', () => {
    expect(cbCard).toContain('cs-slots')
    expect(cbCard).toContain('<span class="zone-tag" style="margin-top:13px;">2 · define the constructs (name each, check its items)</span>')
    expect(cbCard).toContain('draw arrows between constructs to build the structural model')
  })
  it('CB-SEM amosbar drops "+ Construct", defaults to Draw path, and offers zoom/fit/resize', () => {
    const bar = amosbar(cbCard)
    expect(bar).not.toContain('Construct')
    expect(bar).toContain('<span class="amospill on">&rarr; Draw path</span>')
    expect(bar).toContain('Move')
    expect(bar).toContain('Delete')
    expect(bar).toContain('Fit')
    expect(bar).toContain('resize')
  })
  it('PLS-SEM card no longer tells the student to drag items onto a construct', () => {
    expect(plsCard).not.toContain('drag items onto a construct')
    expect(plsCard).not.toContain("drag each construct's items together")
    expect(plsCard).not.toContain('drag items from the palette onto a construct')
  })
  it('PLS-SEM card defines constructs in a construct-slots form and sets reflective/formative per construct in the form', () => {
    expect(plsCard).toContain('cs-slots')
    expect(plsCard).toContain('<span class="zone-tag" style="margin-top:13px;">2 · define the constructs (name each, check its items, set reflective / formative)</span>')
    expect(plsCard).toContain('class="cs-mode"')
  })
  it('PLS-SEM amosbar drops "+ Construct" and defaults to Draw path', () => {
    const bar = amosbar(plsCard)
    expect(bar).not.toContain('Construct')
    expect(bar).toContain('<span class="amospill on">&rarr; Draw path</span>')
  })
  it('inputs legend describes form-defines + paths-only canvas, not drag-items-into-constructs', () => {
    expect(legend).not.toContain('the student drags items into constructs and draws the paths')
    expect(legend).toContain('they define their constructs (name + items) in a form, then draw the structural paths on the canvas')
  })
  it('page sub-note describes the canvas as paths-only (constructs defined in a form)', () => {
    expect(subNote).toContain('use a model-building canvas where the student draws the structural paths between constructs they define in a form')
  })
})
```
- [ ] **Step 2: Run it, verify FAIL** — `npx vitest run src/lib/registry/inputCards.semB.consistency.test.ts`. Expect FAIL: every assertion fails (HTML still shows the drag-onto-canvas copy, the `+ Construct` amosbar pill, `Move` defaulted on, no `Fit`/`resize`, the old legend line, and the old sub-note).
- [ ] **Step 3: Implement** — edit `telos_test_inputs.html`. Six surgical regions.

  (a) **CB-SEM card** — replace the entire first `<div class="inner lbl-wrap">` (the `zone-tag` "1 · build the model — drag constructs, draw the paths" block through its closing `</div>` immediately before `<div class="mini-arrow"></div>`, lines ~2502-2556) with a canvas-on-top + construct-slots-below structure:
```html
    <div class="inner lbl-wrap">
      <span class="zone-tag">1 · draw the structural model</span>
      <div class="canvas">
        <div class="amosbar"><span class="amospill on">&rarr; Draw path</span><span class="amospill">Move</span><span class="amospill">&times; Delete</span><span class="amospill zoom">&minus;</span><span class="amospill zoom">&#43;</span><span class="amospill zoom">Fit</span><span class="amospill resize">&#8689; resize</span></div>
        <div class="amoscanvas">
          <svg class="amossvg" viewBox="0 0 690 370" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
            <defs><marker id="arw_cb" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0.5,0.5 L9.5,5 L0.5,9.5 z" fill="var(--purple-line)"/></marker></defs>
            <line class="lat-meas" x1="127" y1="115" x2="119" y2="89"/>
            <rect class="lat-ind" x="79" y="80" width="40" height="18" rx="3"/>
            <text class="lat-it" x="99" y="92">eu1</text>
            <line class="lat-meas" x1="127" y1="115" x2="119" y2="115"/>
            <rect class="lat-ind" x="79" y="106" width="40" height="18" rx="3"/>
            <text class="lat-it" x="99" y="118">eu2</text>
            <line class="lat-meas" x1="127" y1="115" x2="119" y2="141"/>
            <rect class="lat-ind" x="79" y="132" width="40" height="18" rx="3"/>
            <text class="lat-it" x="99" y="144">eu3</text>
            <line class="lat-meas" x1="563" y1="115" x2="571" y2="89"/>
            <rect class="lat-ind" x="571" y="80" width="40" height="18" rx="3"/>
            <text class="lat-it" x="591" y="92">pu1</text>
            <line class="lat-meas" x1="563" y1="115" x2="571" y2="115"/>
            <rect class="lat-ind" x="571" y="106" width="40" height="18" rx="3"/>
            <text class="lat-it" x="591" y="118">pu2</text>
            <line class="lat-meas" x1="563" y1="115" x2="571" y2="141"/>
            <rect class="lat-ind" x="571" y="132" width="40" height="18" rx="3"/>
            <text class="lat-it" x="591" y="144">pu3</text>
            <line class="lat-meas" x1="345" y1="305" x2="300" y2="327"/>
            <rect class="lat-ind" x="282" y="327" width="36" height="18" rx="3"/>
            <text class="lat-it" x="300" y="339">int1</text>
            <line class="lat-meas" x1="345" y1="305" x2="345" y2="327"/>
            <rect class="lat-ind" x="327" y="327" width="36" height="18" rx="3"/>
            <text class="lat-it" x="345" y="339">int2</text>
            <line class="lat-meas" x1="345" y1="305" x2="390" y2="327"/>
            <rect class="lat-ind" x="372" y="327" width="36" height="18" rx="3"/>
            <text class="lat-it" x="390" y="339">int3</text>
            <ellipse class="lat" cx="185" cy="115" rx="58" ry="30"/>
            <text class="lat-cn" x="185" y="119">Ease of Use</text>
            <ellipse class="lat" cx="505" cy="115" rx="58" ry="30"/>
            <text class="lat-cn" x="505" y="119">Usefulness</text>
            <ellipse class="lat" cx="345" cy="275" rx="58" ry="30"/>
            <text class="lat-cn" x="345" y="279">Intention</text>
            <line class="lat-path" x1="249" y1="115" x2="441" y2="115" marker-end="url(#arw_cb)"/>
            <line class="lat-path" x1="216" y1="146" x2="314" y2="244" marker-end="url(#arw_cb)"/>
            <line class="lat-path" x1="474" y1="146" x2="376" y2="244" marker-end="url(#arw_cb)"/>
          </svg>
        </div>
        <div class="sem-cap">draw arrows between constructs to build the structural model &middot; click a source construct then a target to draw a path &middot; <b>Move</b> repositions a construct, <b>Delete</b> removes a path or construct &middot; zoom / pan / resize to fit larger models &middot; paths that form a chain (e.g. EU &rarr; PU &rarr; INT) automatically produce an <b>Indirect effects</b> table (bootstrapped 95% CIs) &middot; moderation planned for a later version</div>
      </div>
      <span class="zone-tag" style="margin-top:13px;">2 · define the constructs (name each, check its items)</span>
      <div class="cs-hint">Add each construct, name it, then check its items. Each construct needs &ge; 2 items (recommend &ge; 3); the ovals on the canvas appear as you define them.</div>
      <div class="cs-slots">
        <div class="cs-slot">
          <div class="cs-name">Ease of Use</div>
          <div class="cs-items"><span class="pill on">eu1</span> <span class="pill on">eu2</span> <span class="pill on">eu3</span></div>
        </div>
        <div class="cs-slot">
          <div class="cs-name">Usefulness</div>
          <div class="cs-items"><span class="pill on">pu1</span> <span class="pill on">pu2</span> <span class="pill on">pu3</span></div>
        </div>
        <div class="cs-slot">
          <div class="cs-name">Intention</div>
          <div class="cs-items"><span class="pill on">int1</span> <span class="pill on">int2</span> <span class="pill on">int3</span></div>
        </div>
        <div class="cs-slot ghost"><div class="cs-name-ghost">+ Add construct</div></div>
      </div>
    </div>
```
  Then renumber the second `inner lbl-wrap` zone-tag (line ~2559) from `2 · choose the pipeline & options` to `3 · choose the pipeline & options`.

  (b) **CB-SEM config-guide** (line ~2586) — replace its `<p>…</p>` body:
```html
      <p>Use this to test a <b>theory-driven model</b> with latent constructs measured by several survey items. First <b>define the measurement model</b> in the construct form: add each construct, name it, and check the items that belong to it (<b>at least 2 items</b> per construct, <b>recommend 3</b> &mdash; 2 only works inside a larger model). Then <b>draw the structural model</b> on the canvas: click a source construct then a target to draw an arrow for each relationship you hypothesize &mdash; when your paths form a chain (e.g. EU &rarr; PU &rarr; INT), Telos automatically adds an <b>Indirect effects</b> table with bootstrapped 95% CIs (moderation is planned for a later version). When your items are <b>ordinal Likert</b>, use the <b>WLSMV</b> estimator (treats them as ordered) instead of ML/MLR. By default Telos runs the full pipeline (EFA &rarr; CFA &rarr; fit &rarr; structural); deselect <b>EFA</b> for a confirmatory-only run, or the <b>structural</b> stage to validate the measurement model on its own. Missing data is handled to match your estimator &mdash; FIML for continuous (ML/MLR), multiple imputation for ordinal (WLSMV) &mdash; and Telos warns if this differs from your global step-4a setting.</p>
```
  (c) **PLS-SEM card** — replace the entire first `<div class="inner lbl-wrap">` (the `zone-tag` "1 · build the model — drag constructs, draw the paths" block through its closing `</div>` immediately before `<div class="mini-arrow"></div>`, lines ~2822-2879) with:
```html
      <div class="inner lbl-wrap">
        <span class="zone-tag">1 · draw the structural model</span>
        <div class="canvas">
          <div class="amosbar"><span class="amospill on">&rarr; Draw path</span><span class="amospill">Move</span><span class="amospill">&times; Delete</span><span class="amospill zoom">&minus;</span><span class="amospill zoom">&#43;</span><span class="amospill zoom">Fit</span><span class="amospill resize">&#8689; resize</span></div>
          <div class="amoscanvas">
            <svg class="amossvg" viewBox="0 0 690 370" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
              <defs><marker id="arw_pls" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0.5,0.5 L9.5,5 L0.5,9.5 z" fill="var(--purple-line)"/></marker></defs>
              <line class="lat-meas" x1="127" y1="115" x2="119" y2="89"/>
              <rect class="lat-ind" x="79" y="80" width="40" height="18" rx="3"/>
              <text class="lat-it" x="99" y="92">eu1</text>
              <line class="lat-meas" x1="127" y1="115" x2="119" y2="115"/>
              <rect class="lat-ind" x="79" y="106" width="40" height="18" rx="3"/>
              <text class="lat-it" x="99" y="118">eu2</text>
              <line class="lat-meas" x1="127" y1="115" x2="119" y2="141"/>
              <rect class="lat-ind" x="79" y="132" width="40" height="18" rx="3"/>
              <text class="lat-it" x="99" y="144">eu3</text>
              <line class="lat-meas" x1="563" y1="115" x2="571" y2="89"/>
              <rect class="lat-ind" x="571" y="80" width="40" height="18" rx="3"/>
              <text class="lat-it" x="591" y="92">pu1</text>
              <line class="lat-meas" x1="563" y1="115" x2="571" y2="115"/>
              <rect class="lat-ind" x="571" y="106" width="40" height="18" rx="3"/>
              <text class="lat-it" x="591" y="118">pu2</text>
              <line class="lat-meas" x1="563" y1="115" x2="571" y2="141"/>
              <rect class="lat-ind" x="571" y="132" width="40" height="18" rx="3"/>
              <text class="lat-it" x="591" y="144">pu3</text>
              <line class="lat-meas" x1="345" y1="305" x2="300" y2="327"/>
              <rect class="lat-ind" x="282" y="327" width="36" height="18" rx="3"/>
              <text class="lat-it" x="300" y="339">int1</text>
              <line class="lat-meas" x1="345" y1="305" x2="345" y2="327"/>
              <rect class="lat-ind" x="327" y="327" width="36" height="18" rx="3"/>
              <text class="lat-it" x="345" y="339">int2</text>
              <line class="lat-meas" x1="345" y1="305" x2="390" y2="327"/>
              <rect class="lat-ind" x="372" y="327" width="36" height="18" rx="3"/>
              <text class="lat-it" x="390" y="339">int3</text>
              <ellipse class="lat" cx="185" cy="115" rx="58" ry="30"/>
              <text class="lat-cn" x="185" y="112">Ease of Use</text>
              <text class="lat-md" x="185" y="124">formative</text>
              <ellipse class="lat" cx="505" cy="115" rx="58" ry="30"/>
              <text class="lat-cn" x="505" y="112">Usefulness</text>
              <text class="lat-md" x="505" y="124">reflective</text>
              <ellipse class="lat" cx="345" cy="275" rx="58" ry="30"/>
              <text class="lat-cn" x="345" y="272">Intention</text>
              <text class="lat-md" x="345" y="284">reflective</text>
              <line class="lat-path" x1="249" y1="115" x2="441" y2="115" marker-end="url(#arw_pls)"/>
              <line class="lat-path" x1="216" y1="146" x2="314" y2="244" marker-end="url(#arw_pls)"/>
              <line class="lat-path" x1="474" y1="146" x2="376" y2="244" marker-end="url(#arw_pls)"/>
            </svg>
          </div>
          <div class="sem-cap">same canvas as CB-SEM &middot; draw arrows between constructs to build the structural model &middot; click a source construct then a target to draw a path &middot; paths that form a chain (e.g. EU &rarr; PU &rarr; INT) automatically produce an <b>Indirect effects</b> table (bootstrapped 95% CIs) &middot; each construct is set <b>reflective</b> or <b>formative</b> in the construct form below (same items can be specified either way &mdash; shown here with Ease of Use formative)</div>
        </div>
        <span class="zone-tag" style="margin-top:13px;">2 · define the constructs (name each, check its items, set reflective / formative)</span>
        <div class="cs-hint">Add each construct, name it, check its items, and choose <b>reflective</b> (items reflect the construct) or <b>formative</b> (items cause it). Each construct needs &ge; 2 items.</div>
        <div class="cs-slots">
          <div class="cs-slot">
            <div class="cs-name">Ease of Use <span class="cs-mode">formative</span></div>
            <div class="cs-items"><span class="pill on">eu1</span> <span class="pill on">eu2</span> <span class="pill on">eu3</span></div>
          </div>
          <div class="cs-slot">
            <div class="cs-name">Usefulness <span class="cs-mode">reflective</span></div>
            <div class="cs-items"><span class="pill on">pu1</span> <span class="pill on">pu2</span> <span class="pill on">pu3</span></div>
          </div>
          <div class="cs-slot">
            <div class="cs-name">Intention <span class="cs-mode">reflective</span></div>
            <div class="cs-items"><span class="pill on">int1</span> <span class="pill on">int2</span> <span class="pill on">int3</span></div>
          </div>
          <div class="cs-slot ghost"><div class="cs-name-ghost">+ Add construct</div></div>
        </div>
      </div>
```
  (d) **PLS-SEM config-guide** (line ~2892) — replace its `<p>…</p>` body:
```html
        <p>Use this for variance-based SEM &mdash; well suited to prediction, smaller samples, or formative constructs. First <b>define the constructs</b> in the form: add each one, name it, check its items, and set it <b>reflective</b> (items reflect the construct) or <b>formative</b> (items <i>cause</i> it). Then <b>draw the structural model</b> on the canvas: click a source construct then a target to draw an arrow for each relationship you hypothesize (including any mediation &mdash; chained paths get an <b>Indirect effects</b> table automatically; moderation is planned for a later version). Bootstrapping gives the significance of the path coefficients.</p>
```
  (e) **Page sub-note** (line ~162) — replace the whole `<p class="sub-note">…</p>`:
```html
  <p class="sub-note">How each selected test is configured by the student: <b>drag the right columns into the test's role slots</b>, then <b>set its options</b>. Every test is drawn as a full configuration card with the same anatomy. The SEM models (CB-SEM, PLS-SEM) use a model-building canvas where the student draws the structural paths between constructs they define in a form.</p>
```
  (f) **Inputs legend** (line ~2911) — replace the latent-variable `<br>` line:
```html
    Latent-variable models replace the role slots with a <b>construct form</b> (CB-SEM, PLS-SEM, AVE, CR &mdash; name each construct and check its items); for CB-SEM and PLS-SEM, after they define their constructs (name + items) in a form, then draw the structural paths on the canvas in a <b>model-building canvas</b>.<br>
```
- [ ] **Step 4: Run, verify PASS** — `npx vitest run src/lib/registry/inputCards.semB.consistency.test.ts`. Expect PASS (8/8). Also run `npx vitest run src/lib/registry/ave.consistency.test.ts src/lib/registry/compositeReliability.consistency.test.ts` — expect PASS (their card slices end at the next `<div class="ttl">…</div>` and are untouched).
- [ ] **Step 5: Commit** — `git add telos_test_inputs.html src/lib/registry/inputCards.semB.consistency.test.ts && git commit -m "docs(sem-b): amend CB-SEM/PLS-SEM input cards to form-defines + paths-only canvas (§6A)"`

### Task 18: Spec-HTML OUTPUT-card amendments (§6B) — CFA loadings B/SE/z/p, CB-SEM reliability +ω, structural paths +B, PLS reliability exact order
**Files:**
- Modify `telos_test_outputs.html` (CB-SEM Table 3 line 1136; Table 4 line 1138; Table 6 line 1142; PLS Table 2 line 1166; PLS rMap line 1184)
- Test `src/lib/registry/outputCards.semB.consistency.test.ts` (Create)
**Interfaces:** Consumes: spec §6B amendments · Produces: amended drawn output cards that the cbSem/plsSem registry consistency tests (Task 19/20) verbatim-match
- [ ] **Step 1: Write the failing test** — Create `src/lib/registry/outputCards.semB.consistency.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { strip } from './specHtml'

const html = readFileSync('telos_test_outputs.html', 'utf8')
const cb = html.slice(html.indexOf('CB-SEM</span>'), html.indexOf('PLS-SEM</span>'))
const pls = html.slice(html.indexOf('PLS-SEM</span>'), html.indexOf('FAMILY 7'))

const theadAfter = (block: string, cap: string) => {
  const at = block.indexOf(cap)
  const th = block.indexOf('<thead>', at)
  const end = block.indexOf('</thead>', th)
  return [...block.slice(th, end).matchAll(/<th>(.*?)<\/th>/gs)].map((m) => strip(m[1]))
}

describe('SEM-B output cards carry the §6B amendments (B/SE/z/p, ω, reordered PLS reliability)', () => {
  it('CB-SEM Table 3 (CFA loadings) = Construct → Item · B · SE · z · p · Std. loading', () => {
    expect(theadAfter(cb, 'Measurement model (CFA loadings)')).toEqual(
      ['Construct → Item', 'B', 'SE', 'z', 'p', 'Std. loading'],
    )
  })
  it('CB-SEM Table 4 (reliability) adds ω → Construct · CR · AVE · ω · α', () => {
    expect(theadAfter(cb, 'Reliability & validity')).toEqual(
      ['Construct', 'CR', 'AVE', 'ω', 'α'],
    )
  })
  it('CB-SEM Table 6 (structural paths) adds B → Path · B · SE · z · p · Std. β · 95% CI · R²', () => {
    expect(theadAfter(cb, 'Structural paths')).toEqual(
      ['Path', 'B', 'SE', 'z', 'p', 'Std. β', '95% CI', 'R²'],
    )
  })
  it('PLS Table 2 (reliability) final order = Construct · α · ρA · CR (ρC) · AVE', () => {
    expect(theadAfter(pls, 'Reliability & convergent validity')).toEqual(
      ['Construct', 'α', 'ρA', 'CR (ρC)', 'AVE'],
    )
  })
  it('PLS rMap no longer cites plspm (seminr only)', () => {
    const rmap = strip(pls.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])
    expect(rmap).not.toContain('plspm')
    expect(rmap).toContain('seminr')
  })
})
```
- [ ] **Step 2: Run it, verify FAIL** — `npx vitest run src/lib/registry/outputCards.semB.consistency.test.ts`. Expect FAIL: Table 3 still reads `Construct → Item · Std. loading · SE · z · p` (no B, Std. loading out of place); Table 4 has no ω; Table 6 has no B; PLS Table 2 reads `Construct · CR · AVE · ρA`; rMap still cites `plspm`.
- [ ] **Step 3: Implement** — edit `telos_test_outputs.html`:

  (a) **CB-SEM Table 3** (line 1136) — replace the table row to add `B` and move `Std. loading` last (and add the matching ghost-row cell):
```html
      <table class="apa"><thead><tr><th>Construct &rarr; Item</th><th>B</th><th>SE</th><th>z</th><th>p</th><th>Std. loading</th></tr></thead><tbody class="ghost"><tr><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr></tbody></table>
```
  (b) **CB-SEM Table 4** (line 1138) — add the `ω` column between `AVE` and `α`:
```html
      <table class="apa"><thead><tr><th>Construct</th><th>CR</th><th>AVE</th><th>&omega;</th><th>&alpha;</th></tr></thead><tbody class="ghost"><tr><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr></tbody></table>
```
  (c) **CB-SEM Table 6** (line 1142) — add `B` after `Path`, keep `Std. β` after `p`:
```html
      <table class="apa"><thead><tr><th>Path</th><th>B</th><th>SE</th><th>z</th><th>p</th><th>Std. &beta;</th><th>95% CI</th><th>R&sup2;</th></tr></thead><tbody class="ghost"><tr><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr></tbody></table>
```
  (d) **PLS Table 2** (line 1166) — reorder/relabel to the §6B-4 header `Construct · α · ρ_A · CR (ρ_C) · AVE`:
```html
      <table class="apa"><thead><tr><th>Construct</th><th>&alpha;</th><th>&rho;<sub>A</sub></th><th>CR (&rho;<sub>C</sub>)</th><th>AVE</th></tr></thead><tbody class="ghost"><tr><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr></tbody></table>
```
  (e) **PLS rMap** (line 1184) — drop `plspm`:
```html
        <div class="m"><b>R map:</b> <code>seminr</code> &rarr; Tables & bootstrap &middot; <code>summary()</code> &rarr; R&sup2;/R&sup2;adj &middot; <code>seminr::predict_pls()</code> &rarr; Q&sup2; &middot; <code>seminr::specific_effect_significance()</code> (on the bootstrapped model) &rarr; Table 6 indirect effects &middot; <code>seminr::plot()</code> &rarr; diagram</div>
```
- [ ] **Step 4: Run, verify PASS** — `npx vitest run src/lib/registry/outputCards.semB.consistency.test.ts`. Expect PASS (5/5). The `ρ<sub>A</sub>` cells strip to `ρA` and `CR (ρ<sub>C</sub>)` strips to `CR (ρC)` (the `<sub>` tags are removed by `strip`).
- [ ] **Step 5: Commit** — `git add telos_test_outputs.html src/lib/registry/outputCards.semB.consistency.test.ts && git commit -m "docs(sem-b): amend CB-SEM/PLS-SEM output cards — CFA B/SE/z/p, +ω, structural B, PLS reliability reorder (§6B)"`

### Task 19: `registry/cbSem.ts` — CB-SEM TestSpec (inputKind:'sem-canvas') + verbatim consistency test
**Files:**
- Create `src/lib/registry/cbSem.ts`
- Test `src/lib/registry/cbSem.consistency.test.ts` (Create)
**Interfaces:** Consumes: amended CB-SEM output card (Task 18); `TestSpec.inputKind?: 'construct-slots' | 'sem-canvas'` (from the Unit-2 discriminator migration) · Produces: `CB_SEM: TestSpec` consumed by `catalog.ts` SPECS (Unit 10), the `buildCbSem` builder (Unit 6), and the `latent.ts` emitter (Unit 6)
- [ ] **Step 1: Write the failing test** — Create `src/lib/registry/cbSem.consistency.test.ts` (mirrors `ave.consistency.test.ts`, scoped to the CB-SEM output card; the classic tables 1/2/3/4/5/6/7 are the source of truth, plus inputKind/figure/howToRead/apa/rMap/bundle):
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CB_SEM as spec } from './cbSem'
import { strip } from './specHtml'

const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(
  outputsHtml.indexOf('CB-SEM</span>'),
  outputsHtml.indexOf('PLS-SEM</span>'),
)

const theadAfter = (cap: string) => {
  const at = card.indexOf(cap)
  const th = card.indexOf('<thead>', at)
  const end = card.indexOf('</thead>', th)
  return [...card.slice(th, end).matchAll(/<th>(.*?)<\/th>/gs)].map((m) => strip(m[1]))
}
const tableCols = (id: string) => {
  const t = spec.tables.find((x) => x.id === id)!
  return t.columns.map((c) => `${c.label}${c.sub ?? ''}${c.suffix ?? ''}`)
}

describe('cbSem registry stays faithful to the amended output card (verbatim, card-scoped)', () => {
  it('inputKind is sem-canvas (CB-SEM uses the AMOS canvas, not construct-slots or drag-slots); roles empty', () => {
    expect(spec.inputKind).toBe('sem-canvas')
    expect(spec.roles).toHaveLength(0)
  })
  it('Table 1/2 (EFA suitability + rotated loadings) theads match the spec columns', () => {
    expect(theadAfter('EFA suitability')).toEqual(tableCols('efa-suitability'))
    expect(theadAfter('EFA rotated factor loadings')).toEqual(tableCols('efa-loadings'))
  })
  it('Table 3 (CFA loadings) thead matches the spec columns', () => {
    expect(theadAfter('Measurement model (CFA loadings)')).toEqual(tableCols('cfa-loadings'))
  })
  it('Table 4 (reliability) thead matches the spec columns', () => {
    expect(theadAfter('Reliability & validity')).toEqual(tableCols('reliability'))
  })
  it('Table 5 (fit indices) thead matches the spec columns', () => {
    expect(theadAfter('Fit indices')).toEqual(tableCols('fit-indices'))
  })
  it('Table 6 (structural paths) thead matches the spec columns', () => {
    expect(theadAfter('Structural paths')).toEqual(tableCols('structural-paths'))
  })
  it('Table 7 (indirect effects) thead matches the spec columns', () => {
    expect(theadAfter('Indirect effects (mediation)')).toEqual(tableCols('indirect-effects'))
  })
  it('question matches', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/)![1])).toBe(spec.question)
  })
  it('figure caption and type match', () => {
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figures![0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${spec.figures![0].type}`)
  })
  it('how-to-read matches verbatim', () => {
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
  })
  it('APA line equals the template', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    const inner = line.replace(/^[“"]/u, '').replace(/[”"]$/u, '')
    expect(inner).toBe(spec.apaTemplate)
  })
  it('R map matches verbatim', () => {
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('bundle line equals bundleFiles', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
  })
})
```
- [ ] **Step 2: Run it, verify FAIL** — `npx vitest run src/lib/registry/cbSem.consistency.test.ts`. Expect FAIL: `Cannot find module './cbSem'` (the registry file does not exist yet).
- [ ] **Step 3: Implement** — Create `src/lib/registry/cbSem.ts`. The howToRead / apaTemplate / rMap / bundle strings are copied **verbatim** (decoded) from the CB-SEM output card lines 1150 / 1152 / 1153 / 1154; the table columns come from spec §5.1 + the Task-18 amendments:
```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html (CB-SEM card) + design spec §5.1/§6B/§6C — display strings verbatim.
// Convention (SEM reporting, approved 2026-06-18):
//   - Pipeline modes resolve to fixed output shapes: full (EFA?+CFA+fit+structural) / cfa-only / path.
//   - CFA loadings carry B/SE/z/p alongside the standardized loading (label stays "Std. loading"); reliability adds ω.
//   - Structural paths carry B alongside Std. β. Fit table suppressed when fitMeasures(fit,'df')==0 (saturation).
//   - Bootstrap 5000 (percentile CI); standardizedSolution()/standardizedSolution_boot(); compRelSEM() not reliability().
export const CB_SEM: TestSpec = {
  id: 'cb-sem',
  name: 'CB-SEM',
  question: 'confirmatory structural model',
  inputKind: 'sem-canvas',
  roles: [],
  options: [
    { id: 'estimator', label: 'estimator', value: 'WLSMV (ordinal) / ML / MLR', kind: 'display' },
    { id: 'missing', label: 'missing', value: 'MI', kind: 'display' },
    { id: 'bootstrap', label: 'bootstrap', value: '5000', kind: 'display' },
  ],
  constraints: {
    roles: [],
    minRule: { kind: 'values', n: 20 },
  },
  tables: [
    {
      id: 'efa-suitability',
      title: 'EFA suitability',
      columns: [
        { key: 'kmo', label: 'KMO' },
        { key: 'bartlettChisq', label: "Bartlett's χ²" },
        { key: 'df', label: 'df' },
        { key: 'p', label: 'p' },
      ],
    },
    {
      id: 'efa-loadings',
      title: 'EFA rotated factor loadings',
      columns: [
        { key: 'item', label: 'Item' },
        { key: 'f1', label: 'Factor 1' },
        { key: 'f2', label: 'Factor 2' },
        { key: 'communality', label: 'Communality' },
      ],
    },
    {
      id: 'cfa-loadings',
      title: 'Measurement model (CFA loadings)',
      columns: [
        { key: 'path', label: 'Construct → Item' },
        { key: 'b', label: 'B' },
        { key: 'se', label: 'SE' },
        { key: 'z', label: 'z' },
        { key: 'p', label: 'p' },
        { key: 'std', label: 'Std. loading' },
      ],
    },
    {
      id: 'reliability',
      title: 'Reliability & validity',
      columns: [
        { key: 'construct', label: 'Construct' },
        { key: 'cr', label: 'CR' },
        { key: 'ave', label: 'AVE' },
        { key: 'omega', label: 'ω' },
        { key: 'alpha', label: 'α' },
      ],
    },
    {
      id: 'fit-indices',
      title: 'Fit indices',
      columns: [
        { key: 'chisq', label: 'χ² (df, p)' },
        { key: 'chisqDf', label: 'χ²/df' },
        { key: 'cfi', label: 'CFI' },
        { key: 'tli', label: 'TLI' },
        { key: 'rmsea', label: 'RMSEA [90% CI]' },
        { key: 'srmr', label: 'SRMR' },
      ],
    },
    {
      id: 'structural-paths',
      title: 'Structural paths',
      columns: [
        { key: 'path', label: 'Path' },
        { key: 'b', label: 'B' },
        { key: 'se', label: 'SE' },
        { key: 'z', label: 'z' },
        { key: 'p', label: 'p' },
        { key: 'beta', label: 'Std. β' },
        { key: 'ci', label: '95% CI' },
        { key: 'r2', label: 'R²' },
      ],
    },
    {
      id: 'indirect-effects',
      title: 'Indirect effects (mediation)',
      columns: [
        { key: 'path', label: 'Path' },
        { key: 'est', label: 'Estimate' },
        { key: 'se', label: 'SE' },
        { key: 'ci', label: 'boot 95% CI' },
        { key: 'p', label: 'p' },
      ],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'Tables shown follow the pipeline stages you ran (EFA → CFA → fit → structural); if EFA was deselected, Tables 1–2 are omitted; if the structural stage was deselected, Tables 6–7 are omitted. Good-fit guidelines (Hu & Bentler, 1999; Marsh, Hau & Wen, 2004): CFI/TLI ≥ .95, RMSEA ≤ .06 [90% CI], SRMR ≤ .08 — guidelines, not pass/fail gates; RMSEA is unstable at small df / small N, so interpret it cautiously for compact models. Use WLSMV for ordinal indicators. R² is filled once per endogenous (outcome) construct. When the model is saturated (df = 0, e.g. a just-identified path model), the fit-indices table is suppressed and a saturation flag is shown. EFA on the same sample is exploratory — treat it as a diagnostic, not confirmatory evidence. The indirect-effects table appears only when the drawn structural paths form a chain (X → M → Y); each indirect effect is a lavaan defined effect with a bootstrapped 95% CI. Moderation is planned for a later version.',
    afterTableId: 'indirect-effects',
  },
  figures: [
    { caption: 'Model', type: 'path diagram (constructs, loadings, structural paths)', file: 'path-diagram' },
  ],
  howToRead:
    'First confirm the measurement model (loadings high, CR/AVE adequate) and overall fit indices. Then read the structural paths: each std. β with p/CI is a hypothesized relationship between constructs; R² shows variance explained in each outcome construct. CB-SEM is confirmatory: the measurement model must be specified from theory a priori — any post-hoc respecification (e.g. from modification indices) is exploratory, must be reported as such, and ideally cross-validated on a fresh sample.',
  apaTemplate: 'The model fit well (CFI=__, RMSEA=__, SRMR=__); the path from X to Y gave β=__, p=__.',
  rMap: '(if EFA stage run) psych::KMO()/cortest.bartlett() → Table 1 · psych::fa() → Table 2 · lavaan::sem() (estimator ML/MLR or WLSMV) → loadings & structural paths · lavaan::fitMeasures() (or summary(fit, fit.measures=TRUE)) → Table 5 fit indices (χ²/df = chisq/df) · semTools::compRelSEM() / AVE() / psych::alpha() → CR/AVE/α table · lavInspect(fit, "rsquare") → Table 6 R² · defined effects (:= in the lavaan syntax, se="bootstrap") → Table 7 indirect effects · semPlot::semPaths() → diagram',
  bundleFiles: [
    'table_efa-suitability.png (when EFA stage selected)',
    'table_efa-loadings.png (when EFA stage selected)',
    'table_cfa-loadings.png',
    'table_reliability.png',
    'table_fit-indices.png',
    'table_structural-paths.png (when structural stage selected)',
    'table_indirect-effects.png (when mediation paths drawn)',
    'figure_path-diagram.png',
  ],
}
```
- [ ] **Step 4: Run, verify PASS** — `npx vitest run src/lib/registry/cbSem.consistency.test.ts`. Expect PASS (all assertions). If a `rMap`/`howToRead`/`apaTemplate` string mismatches by one decoded char, re-copy verbatim from the named card line and re-run. (The `tableNote` text is registry-authored, not card-verbatim — no test asserts it; only `tables`, `figures`, `howToRead`, `apaTemplate`, `rMap`, `bundleFiles`, `inputKind`, `roles` are pinned.)
- [ ] **Step 5: Commit** — `git add src/lib/registry/cbSem.ts src/lib/registry/cbSem.consistency.test.ts && git commit -m "feat(sem-b): cbSem registry (inputKind sem-canvas) + verbatim consistency test"`

### Task 20: `registry/plsSem.ts` — PLS-SEM TestSpec (inputKind:'sem-canvas', reliability SELECT+REORDER tuple) + verbatim consistency test
**Files:**
- Create `src/lib/registry/plsSem.ts`
- Test `src/lib/registry/plsSem.consistency.test.ts` (Create)
**Interfaces:** Consumes: amended PLS-SEM output card (Task 18); `TestSpec.inputKind` (Unit-2 discriminator) · Produces: `PLS_SEM: TestSpec` consumed by `catalog.ts` SPECS (Unit 10), the `buildPlsSem` builder (Unit 7, which selects+reorders seminr's reliability matrix into the Table-2 tuple), and the `latent.ts` emitter (Unit 7)
- [ ] **Step 1: Write the failing test** — Create `src/lib/registry/plsSem.consistency.test.ts` (scoped to the PLS-SEM card; Table 2 reliability order is the load-bearing assertion from §6B-4; HTMT is a matrix table so it is asserted by caption, not thead). Note `tableCols` includes `suffix` so `cr` (`label:'CR (ρ', sub:'C', suffix:')'`) reproduces `CR (ρC)` exactly like `flatLabel` in `rTable.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PLS_SEM as spec } from './plsSem'
import { strip } from './specHtml'

const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(
  outputsHtml.indexOf('PLS-SEM</span>'),
  outputsHtml.indexOf('FAMILY 7'),
)

const theadAfter = (cap: string) => {
  const at = card.indexOf(cap)
  const th = card.indexOf('<thead>', at)
  const end = card.indexOf('</thead>', th)
  return [...card.slice(th, end).matchAll(/<th>(.*?)<\/th>/gs)].map((m) => strip(m[1]))
}
const tableCols = (id: string) => {
  const t = spec.tables.find((x) => x.id === id)!
  return t.columns.map((c) => `${c.label}${c.sub ?? ''}${c.suffix ?? ''}`)
}

describe('plsSem registry stays faithful to the amended output card (verbatim, card-scoped)', () => {
  it('inputKind is sem-canvas and roles are empty', () => {
    expect(spec.inputKind).toBe('sem-canvas')
    expect(spec.roles).toHaveLength(0)
  })
  it('Table 1 (outer model) thead matches the spec columns', () => {
    expect(theadAfter('outer loadings / weights')).toEqual(tableCols('outer-model'))
  })
  it('Table 2 (reliability) thead matches the spec columns — exact order Construct · α · ρA · CR (ρC) · AVE', () => {
    expect(theadAfter('Reliability & convergent validity')).toEqual(tableCols('reliability'))
    // load-bearing: the display order buildPlsSem must SELECT+REORDER seminr output into
    expect(tableCols('reliability')).toEqual(['Construct', 'α', 'ρA', 'CR (ρC)', 'AVE'])
  })
  it('Table 4 (structural paths) thead matches the spec columns', () => {
    expect(theadAfter('Structural paths')).toEqual(tableCols('structural'))
  })
  it('Table 5 (structural quality) thead matches the spec columns', () => {
    expect(theadAfter('Structural model quality')).toEqual(tableCols('structural-quality'))
  })
  it('Table 6 (indirect effects) thead matches the spec columns', () => {
    expect(theadAfter('Indirect effects (mediation)')).toEqual(tableCols('indirect-effects'))
  })
  it('HTMT (Table 3) is a matrix table — present as a caption, no fixed thead', () => {
    expect(card).toContain('Discriminant validity &mdash; HTMT')
    expect(spec.tables.find((t) => t.id === 'htmt')!.columns).toHaveLength(0)
  })
  it('question matches', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/)![1])).toBe(spec.question)
  })
  it('figure caption and type match', () => {
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figures![0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${spec.figures![0].type}`)
  })
  it('how-to-read matches verbatim', () => {
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
  })
  it('APA line equals the template', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    const inner = line.replace(/^[“"]/u, '').replace(/[”"]$/u, '')
    expect(inner).toBe(spec.apaTemplate)
  })
  it('R map matches verbatim (seminr only, no plspm)', () => {
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
    expect(spec.rMap).not.toContain('plspm')
  })
  it('bundle line equals bundleFiles', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
  })
})
```
- [ ] **Step 2: Run it, verify FAIL** — `npx vitest run src/lib/registry/plsSem.consistency.test.ts`. Expect FAIL: `Cannot find module './plsSem'`.
- [ ] **Step 3: Implement** — Create `src/lib/registry/plsSem.ts`. howToRead / apaTemplate / bundle copied **verbatim** (decoded) from the PLS output card lines 1181 / 1183 / 1185; rMap copied from the Task-18-amended line 1184; the reliability columns use the §6B-4 order `Construct · α · ρ_A · CR (ρ_C) · AVE`, with `sub`/`suffix` so the thead reproduces `ρA` and `CR (ρC)`:
```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html (PLS-SEM card) + design spec §5.2/§6B/§6C — display strings verbatim.
// Convention (SEM reporting, approved 2026-06-18):
//   - Variance-based SEM (seminr); NO global fit indices (CFI/TLI/RMSEA).
//   - Reliability display order = Construct · α · ρ_A · CR (ρ_C) · AVE; seminr emits alpha/rhoC/AVE/rhoA
//     in a different order → buildPlsSem must SELECT+REORDER into this tuple.
//   - HTMT (primary discriminant criterion) = construct × construct matrix (rendered via the matrix branch).
//   - Bootstrap 5000 (percentile CI); structural f² from summary(pls)$fSquare; Q² per §5.2 (blindfolding else PLSpredict).
//   - Indirect effects via seminr::specific_effect_significance() on the bootstrapped model.
export const PLS_SEM: TestSpec = {
  id: 'pls-sem',
  name: 'PLS-SEM',
  question: 'variance-based structural model',
  inputKind: 'sem-canvas',
  roles: [],
  options: [
    { id: 'weighting', label: 'weighting', value: 'path', kind: 'display' },
    { id: 'bootstrap', label: 'bootstrap', value: '5000', kind: 'display' },
    { id: 'missing', label: 'missing', value: 'global step-4a setting', kind: 'display' },
  ],
  constraints: {
    roles: [],
    minRule: { kind: 'values', n: 20 },
  },
  tables: [
    {
      id: 'outer-model',
      title: 'Measurement model (outer loadings / weights)',
      columns: [
        { key: 'path', label: 'Construct → Item' },
        { key: 'loading', label: 'Loading / weight' },
        { key: 't', label: 't' },
        { key: 'p', label: 'p' },
      ],
    },
    {
      id: 'reliability',
      title: 'Reliability & convergent validity (per construct)',
      columns: [
        { key: 'construct', label: 'Construct' },
        { key: 'alpha', label: 'α' },
        { key: 'rhoA', label: 'ρ', sub: 'A' },
        { key: 'cr', label: 'CR (ρ', sub: 'C', suffix: ')' },
        { key: 'ave', label: 'AVE' },
      ],
    },
    {
      id: 'htmt',
      title: 'Discriminant validity — HTMT (construct × construct)',
      columns: [], // MatrixTable — rendered via ApaTable matrix branch; columns unused
    },
    {
      id: 'structural',
      title: 'Structural paths',
      columns: [
        { key: 'path', label: 'Path' },
        { key: 'beta', label: 'β' },
        { key: 't', label: 't' },
        { key: 'p', label: 'p' },
        { key: 'ci', label: '95% CI' },
        { key: 'f2', label: 'f²' },
      ],
    },
    {
      id: 'structural-quality',
      title: 'Structural model quality (per endogenous construct)',
      columns: [
        { key: 'construct', label: 'Construct' },
        { key: 'r2', label: 'R²' },
        { key: 'r2adj', label: 'R²', sub: 'adj' },
        { key: 'q2', label: 'Q²' },
      ],
    },
    {
      id: 'indirect-effects',
      title: 'Indirect effects (mediation)',
      columns: [
        { key: 'path', label: 'Path' },
        { key: 'est', label: 'Estimate' },
        { key: 'se', label: 'SE' },
        { key: 'ci', label: 'boot 95% CI' },
        { key: 'p', label: 'p' },
      ],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'HTMT is a construct-by-construct matrix (not a per-construct value) — columns expand to the number of constructs in the model; HTMT < .85/.90 supports discriminant validity (Henseler, Ringle & Sarstedt, 2015). Significance comes from bootstrapping (percentile 95% CIs, 5000 resamples); R² and Q² assess the structural model (f²: ~0.02 small, 0.15 medium, 0.35 large; Cohen, 1988). PLS-SEM deliberately has no global fit indices (CFI/TLI/RMSEA) — judge it by reliability & validity, then R²/Q²/f² (Hair et al., 2019). The indirect-effects table appears only when the drawn paths form a chain (X → M → Y). Formative constructs suppress AVE/HTMT and are judged by indicator weights, VIF, and redundancy convergent validity. Moderation is planned for a later version.',
    afterTableId: 'indirect-effects',
  },
  figures: [
    { caption: 'Model', type: 'path diagram (with loadings, path coefficients, R²)', file: 'path-diagram' },
  ],
  howToRead:
    'Like CB-SEM but variance-based and prediction-oriented (good for smaller samples / formative constructs). PLS-SEM does not use CB-SEM global fit indices (CFI/TLI/RMSEA) — judge it instead by reliability & validity (CR, AVE, HTMT), then R², Q² (predictive relevance) and f², with SRMR the only commonly reported approximate fit index. Read the bootstrapped path coefficients (β, p); f² is each path\'s effect size (~0.02 small, 0.15 medium, 0.35 large).',
  apaTemplate: 'In the PLS-SEM, the path from X to Y gave β=__, p=__ (bootstrap); R²Y=__.',
  rMap: 'seminr → Tables & bootstrap · summary() → R²/R²adj · seminr::predict_pls() → Q² · seminr::specific_effect_significance() (on the bootstrapped model) → Table 6 indirect effects · seminr::plot() → diagram',
  bundleFiles: [
    'table_outer-model.png',
    'table_reliability.png',
    'table_htmt.png',
    'table_structural.png',
    'table_structural-quality.png',
    'table_indirect-effects.png (when mediation paths drawn)',
    'figure_path-diagram.png',
  ],
}
```
- [ ] **Step 4: Run, verify PASS** — `npx vitest run src/lib/registry/plsSem.consistency.test.ts`. Expect PASS (all assertions). The Table-2 reliability test pins `['Construct','α','ρA','CR (ρC)','AVE']` — confirming the SELECT+REORDER tuple the Unit-7 builder targets. The card's APA `R&sup2;<sub>Y</sub>` decodes (after `<sub>` removal by `strip`) to `R²Y`, so `apaTemplate` ends `R²Y=__.`; if it mismatches, align the spec string to the stripped card text.
- [ ] **Step 5: Commit** — `git add src/lib/registry/plsSem.ts src/lib/registry/plsSem.consistency.test.ts && git commit -m "feat(sem-b): plsSem registry (inputKind sem-canvas; reliability SELECT+REORDER tuple) + verbatim consistency test"`

---

### Task 21: `runCbSem` stats module + shared `isSaturated` df==0 predicate + PoliticalDemocracy fixture + WebR≡native stats test
**Files:**
- Create `tests/e2e/fixtures/polidemocracy.csv` (lavaan `PoliticalDemocracy`, 75 rows, cols `y1..y8,x1,x2,x3`)
- Create `src/lib/stats/semSaturation.ts` (the ONE shared df==0 predicate)
- Create `src/lib/stats/runCbSem.ts`
- Test `src/lib/stats/runCbSem.test.ts`
**Interfaces:** Consumes: `Engine`, `Dataset`, `TestSetup`, `Construct`, `StructuralPath`, `runCfaReliability` (Slice A) · Produces: `runCbSem(engine,data,setup,onProgress?)`, `CbSemResult`, `isSaturated(df:number):boolean`

- [ ] **Step 1: Write the failing test** (PoliticalDemocracy reference values native-R-derived 2026-06-20: df=41, χ²=72.462, CFI=.953, TLI=.938, RMSEA=.101 [.061,.139], SRMR=.055; std β ind60→dem60=.448, dem60→dem65=.913, ind60→dem65=.146; R²(dem60)=.201, R²(dem65)=.974; unstd indirect a*b=1.274, SE=.359; std loadings ind60: x1=.920,x2=.973,x3=.872). Test uses `nboot:50` for speed but the committed runs-in-r gate (Task 24) runs the production count.

First create the fixture:
```bash
cat > tests/e2e/fixtures/polidemocracy.csv << 'CSV'
y1,y2,y3,y4,y5,y6,y7,y8,x1,x2,x3
2.5,0,3.333333,0,1.25,0,3.72636,3.333333,4.442651,3.637586,2.557615
1.25,0,3.333333,0,6.25,1.1,6.666666,0.736999,5.384495,5.062595,3.568079
7.5,8.8,9.999998,9.199991,8.75,8.094061,10,8.211809,7.871353,6.818924,6.493754
8.901999,8.8,9.999998,9.199991,8.907948,8.127979,10,4.615086,8.524139,7.872074,6.785375
10,3.333333,9.999998,6.666666,7.5,3.333333,10,6.666666,10.079979,8.124149,7.124593
7.5,3.333333,6.666666,6.666666,6.25,1.1,10,3.333333,8.273847,7.418803,6.296003
7.5,3.333333,6.666666,6.666666,5,0,10,1.32643,9.094502,8.198213,7.124593
7.5,2.233333,9.999998,1.496333,6.25,1.1,6.666666,3.327598,9.110278,7.50751,7.508918
2.5,3.333333,3.333333,3.333333,6.25,1.1,6.666666,3.333333,8.460693,7.343506,6.581113
10,6.666666,10,8.899991,8.75,8.127979,10,6.69789,8.832345,8.116617,7.124593
7.5,6.666666,9.999998,4.799998,7.5,4.572531,10,4.535215,8.870107,8.464286,7.124593
8.75,8.499999,9.999998,9.199991,7.5,4.6,7.5,2.0,9.198883,8.061687,7.124593
8.75,7.766666,9.999998,9.199991,8.75,5.5,8.999998,5.0,9.260911,8.387083,7.124593
2.9,1.466667,3.333333,2.466667,5,1.158826,3.333333,2.466667,7.624619,6.503971,6.367357
7.5,7.5,9.999998,9.199991,7.5,1.5,10,3.5,8.853808,7.700408,6.948327
10,10,10,9.999991,8.75,3.333333,10,3.333333,9.926754,9.034459,7.124593
10,5.0,10,5.566667,10,7.426549,10,7.426549,8.769052,7.835975,7.124593
7.5,5.0,6.666666,4.799998,10,3.333333,6.666666,1.829999,8.696964,7.838024,7.124593
6.25,3.333333,6.666666,1.496333,8.75,3.333333,6.666666,1.5,9.083731,8.124149,7.124593
10,8.8,9.999998,9.999991,10,7.6,8.999998,6.0,8.557229,7.700408,6.566672
10,5.0,10,8.899991,10,4.343807,10,4.69134,9.798673,8.829264,7.124593
8.901999,5.0,6.666666,5.566667,8.75,3.333333,6.666666,3.333333,7.547446,6.797940,6.092115
7.5,6.666666,9.999998,9.199991,6.25,1.1,8.999998,1.5,7.273034,5.926926,5.880533
6.25,3.333333,6.666666,5.566667,7.5,3.333333,6.666666,3.333333,8.667710,7.785472,6.832055
10,8.8,9.999998,9.999991,8.75,7.481314,10,8.211809,9.515419,8.713417,7.124593
8.75,5.0,6.666666,2.4,5,2.0,8.999998,3.333333,8.464286,7.683403,6.997596
2.5,0,2.0,1.2,2.5,0,3.333333,0,7.484368,6.072097,5.541264
7.5,5.0,6.666666,5.566667,8.75,4.343807,6.666666,3.36318,8.612503,7.477114,7.124593
2.5,1.466667,3.333333,1.496333,5,1.1,3.333333,1.5,6.499787,6.069802,4.852030
10,6.666666,6.666666,4.799998,7.5,2.233333,6.666666,1.496333,9.018960,8.514192,7.124593
10,10,9.999998,9.999991,10,6.666666,10,5.0,9.286312,9.250881,7.124593
7.5,6.666666,9.999998,6.666666,8.75,2.233333,8.999998,3.36318,8.491017,7.717134,6.346073
10,10,9.999998,9.999991,10,5.0,10,5.0,9.927576,9.250881,7.124593
10,3.333333,9.999998,3.333333,7.5,3.333333,6.666666,3.333333,9.116058,8.317522,7.124593
10,6.666666,9.999998,9.199991,8.75,6.666666,10,6.69789,8.881836,8.387083,6.778775
6.25,1.466667,5.0,1.496333,6.25,0,3.333333,0,6.853299,6.879356,4.962845
10,8.8,9.999998,9.999991,10,5.0,10,3.5,9.398089,8.819624,7.124593
10,10,9.999998,9.999991,10,3.5,10,5.0,9.926754,9.034459,7.124593
5,3.333333,5.0,4.799998,5,0,3.333333,0,7.871353,7.103322,5.681503
10,3.333333,9.999998,3.333333,5,1.5,3.333333,1.5,8.992735,7.838024,6.778775
10,6.666666,9.999998,6.666666,10,5.6,10,5.6,9.198883,8.367547,7.124593
6.666666,1.0,5.0,1.0,2.0,0,2.0,0,7.276556,6.099303,4.997212
7.5,3.333333,6.666666,3.333333,2.5,0,3.333333,0,8.331091,7.443079,6.519147
2.0,1.0,3.333333,1.0,3.0,0,2.0,0,6.911889,6.226537,4.521789
10,10,9.999998,9.999991,7.5,4.6,7.5,4.0,9.380244,8.756999,7.124593
6.625,5.0,7.0,4.0,8.75,4.0,6.666666,4.0,8.227039,7.428115,6.527958
3.5,2.0,4.0,2.0,2.5,0,3.333333,0,7.124593,6.214608,4.886938
5,1.0,4.0,1.0,3.0,0,2.0,0,7.231838,6.282267,5.480639
9,5.0,6.666666,3.333333,5,0,3.333333,0,9.025816,8.214194,6.881411
10,8.8,9.999998,8.899991,10,5.0,10,5.0,9.405107,8.892480,7.124593
7.5,3.333333,5.0,2.4,5,1.0,3.333333,1.0,8.476371,7.428115,6.499787
7.0,4.0,6.0,3.0,4.0,2.0,3.0,2.0,8.176853,7.328412,6.522093
6.666666,2.0,4.0,1.0,3.333333,0,2.0,0,7.929406,6.974479,5.918894
10,8.8,9.999998,9.199991,10,7.6,10,7.0,9.405107,8.892480,7.124593
10,10,9.999998,9.999991,10,4.0,10,5.0,9.926754,9.034459,7.124593
10,8.8,9.999998,9.199991,8.75,5.5,8.999998,5.0,9.405107,8.892480,7.124593
9,8.8,9.999998,9.199991,8.75,7.6,8.999998,7.0,9.198883,8.367547,7.124593
10,6.666666,9.999998,6.666666,10,5.0,10,5.0,9.405107,8.892480,7.124593
9,5.0,6.666666,3.333333,7.5,3.333333,6.666666,3.333333,9.110278,8.214194,6.881411
8.75,5.0,6.666666,4.799998,7.5,3.333333,6.666666,3.333333,8.785707,7.838024,6.778775
10,10,9.999998,9.999991,10,5.0,10,4.0,9.926754,9.034459,7.124593
7.5,5.0,6.666666,4.0,7.5,3.333333,6.666666,3.333333,8.652938,7.769361,6.873164
7.5,3.333333,6.666666,3.333333,6.25,1.1,6.666666,1.5,8.510803,7.591357,6.527958
2.5,0,3.333333,0,5,0,3.333333,0,7.124593,6.412980,5.323010
2.5,1.0,3.0,1.0,3.0,0,2.0,0,6.911889,6.099303,5.0
6.0,3.0,5.0,2.0,5.0,2.0,4.0,2.0,7.954545,7.124593,5.918894
6.666666,3.333333,6.0,3.0,4.0,2.0,3.0,2.0,8.029780,7.328412,6.196444
5,2.0,4.0,2.0,3.0,0,2.0,0,7.491645,6.722630,5.480639
10,6.666666,9.999998,6.666666,7.5,3.333333,6.666666,3.333333,9.286312,8.514192,7.124593
3.333333,3.333333,5.0,2.0,2.5,0,3.333333,0,7.354362,6.428105,5.541264
10,5.0,9.999998,4.799998,7.5,3.333333,6.666666,3.333333,9.198883,8.756999,7.124593
3.5,3.0,5.0,2.0,3.0,2.0,3.0,2.0,7.124593,6.769642,5.541264
10,6.666666,9.999998,6.666666,10,6.666666,10,6.666666,9.405107,8.892480,7.124593
6.0,5.0,7.0,4.0,4.0,2.0,3.0,2.0,8.010695,7.328412,6.196444
5,3.333333,6.0,3.0,5,1.0,4.0,1.0,7.954545,7.124593,6.109248
10,6.666666,9.999998,6.666666,8.75,5.5,8.999998,5.0,9.198883,8.756999,7.124593
CSV
```

(test code follows in the same step — see fenced block below)
```ts
// src/lib/stats/runCbSem.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runCbSem } from './runCbSem'
import { isSaturated } from './semSaturation'
import { loadCsvFixture } from './csvFixture'
import { join } from 'node:path'
import type { TestSetup } from '../../state/session'

// Reference values: native R 4.6.0 / lavaan 0.6.21 on lavaan's PoliticalDemocracy (Bollen industrialization→democracy).
// Model: ind60=~x1+x2+x3 · dem60=~y1+y2+y3+y4 · dem65=~y5+y6+y7+y8 · dem60~ind60 · dem65~dem60+ind60 · ind_ie:=a*b.
// Derived 2026-06-20 via Rscript sem(): df=41, chisq=72.462, CFI=.953, TLI=.938, RMSEA=.101 [.061,.139], SRMR=.055.
// std β: ind60→dem60=.448, dem60→dem65=.913, ind60→dem65=.146 · R²: dem60=.201, dem65=.974.
// unstd indirect a*b=1.274 (SE≈.359) · std loadings ind60: x1=.920,x2=.973,x3=.872.

const SETUP: TestSetup = {
  roles: {},
  options: { estimator: 'ML', nboot: 50, ciType: 'percentile' },
  props: {},
  blocked: null,
  modelKind: 'latent',
  constructs: [
    { id: 1, name: 'ind60', items: ['x1', 'x2', 'x3'] },
    { id: 2, name: 'dem60', items: ['y1', 'y2', 'y3', 'y4'] },
    { id: 3, name: 'dem65', items: ['y5', 'y6', 'y7', 'y8'] },
  ],
  paths: [
    { from: 1, to: 2 },
    { from: 2, to: 3 },
    { from: 1, to: 3 },
  ],
}

describe('semSaturation predicate', () => {
  it('isSaturated is true only at df==0', () => {
    expect(isSaturated(0)).toBe(true)
    expect(isSaturated(41)).toBe(false)
    expect(isSaturated(1)).toBe(false)
  })
})

describe('runCbSem', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('Bollen PoliticalDemocracy SEM matches native-R reference values', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/polidemocracy.csv'))
    const result = await runCbSem(engine, data, SETUP)

    // --- mode + saturation ---
    expect(result.mode).toBe('full')
    expect(result.saturated).toBe(false)
    expect(result.fit!.df).toBe(41)

    // --- fit indices ---
    expect(result.fit!.chisq).toBeCloseTo(72.462, 1)
    expect(result.fit!.cfi).toBeCloseTo(0.953, 2)
    expect(result.fit!.tli).toBeCloseTo(0.938, 2)
    expect(result.fit!.rmsea).toBeCloseTo(0.101, 2)
    expect(result.fit!.rmseaLower).toBeCloseTo(0.061, 2)
    expect(result.fit!.rmseaUpper).toBeCloseTo(0.139, 2)
    expect(result.fit!.srmr).toBeCloseTo(0.055, 2)

    // --- CFA loadings present (std loading on ind60→x2 = .973) ---
    const x2 = result.cfaLoadings.find((r) => r.rhs === 'x2')!
    expect(Number(x2.stdLoading)).toBeCloseTo(0.973, 2)

    // --- structural standardized paths (id-keyed) ---
    const s = result.structural!
    const p12 = s.find((r) => r.from === 1 && r.to === 2)!
    const p23 = s.find((r) => r.from === 2 && r.to === 3)!
    const p13 = s.find((r) => r.from === 1 && r.to === 3)!
    expect(Number(p12.stdBeta)).toBeCloseTo(0.448, 2)
    expect(Number(p23.stdBeta)).toBeCloseTo(0.913, 2)
    expect(Number(p13.stdBeta)).toBeCloseTo(0.146, 2)

    // --- R² (endogenous constructs, id-keyed) ---
    expect(result.rsquare![2]).toBeCloseTo(0.201, 2)
    expect(result.rsquare![3]).toBeCloseTo(0.974, 2)

    // --- bootstrapped indirect effect (ind60→dem60→dem65) ---
    const ie = result.indirect![0]
    expect(Number(ie.est)).toBeCloseTo(1.274, 1)
    expect(ie.ciLower).not.toBeNull()
    expect(ie.ciUpper).not.toBeNull()
    expect(Number(ie.ciLower)).toBeLessThan(Number(ie.est))
    expect(Number(ie.ciUpper)).toBeGreaterThan(Number(ie.est))

    // --- estimates block for the canvas overlay (numeric ids) ---
    expect(result.estimates.paths).toHaveLength(3)
    expect(result.estimates.r2[3]).toBeCloseTo(0.974, 2)
    expect(result.estimates.loadings['x2']).toBeCloseTo(0.973, 2)
  }, 600_000)
})
```

- [ ] **Step 2: Run it, verify FAIL**
  `npx vitest run src/lib/stats/runCbSem.test.ts`
  Expected: FAIL — `Cannot find module './runCbSem'` / `'./semSaturation'` (modules not created yet).

- [ ] **Step 3: Implement** (create both files)

`src/lib/stats/semSaturation.ts`:
```ts
/**
 * The ONE shared saturation predicate (design §3.6, §5.1). A model is saturated iff lavaan reports df==0,
 * in which case the fit table is suppressed (perfect, uninformative fit) and a saturation flag is emitted.
 * The builder, the latent.ts emitter, and the runs-in-r gate ALL call this so screen/export/native agree.
 * Keyed strictly on df, NOT on recursiveness.
 */
export function isSaturated(df: number): boolean {
  return df === 0
}
```

`src/lib/stats/runCbSem.ts`:
```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import type { TestSetup, Construct, StructuralPath } from '../../state/session'
import type { RunProgress } from './progress'
import { runCfaReliability, type CfaConstructResult } from './cfaReliability'
import { isSaturated } from './semSaturation'

export interface CbSemResult {
  mode: 'full' | 'cfa-only' | 'path'
  saturated: boolean
  efaSuitability?: Record<string, number>
  efaLoadings?: unknown
  cfaLoadings: Array<Record<string, unknown>>
  reliability: Array<Record<string, unknown>>
  fit?: Record<string, number>
  structural?: Array<Record<string, unknown>>
  rsquare?: Record<number, number>
  indirect?: Array<Record<string, unknown>>
  estimates: {
    paths: Array<{ from: number; to: number; beta: number }>
    loadings: Record<string, number>
    r2: Record<number, number>
  }
}

// Resolve the structural mode (design §3.4). EFA toggling lives in the builder/emitter; the stats core
// always fits CFA + structure for 'full', CFA-only when structure is off, observed-only for 'path'.
type Mode = 'full' | 'cfa-only' | 'path'
function resolveMode(setup: TestSetup): Mode {
  if (setup.modelKind === 'path') return 'path'
  if ((setup.paths?.length ?? 0) === 0) return 'cfa-only'
  return 'full'
}

// Listwise-delete rows where any used column is not a finite number.
function listwise(data: Dataset, cols: string[]): Record<string, unknown>[] {
  return data.rows.filter((row) =>
    cols.every((c) => typeof row[c] === 'number' && Number.isFinite(row[c] as number)),
  )
}

// R block. Env bindings:
//   model_str    character(1): the full lavaan model (=~ measurement [non-path], ~ structural, := indirect defs)
//   item_cols_flat numeric: all used columns concatenated column-major
//   all_cols     character: column names matching item_cols_flat order
//   n            integer: rows after listwise deletion
//   path_from / path_to   integer: structural path construct-ids (parallel; one per ~ path), display order
//   con_ids / con_names   integer / character: construct id↔name map (for id-keyed rsquare + structural rows)
//   has_indirect logical(1): whether any := indirect def exists
//   nboot        integer: bootstrap resamples (single awaited call)
//   ci_type      character(1): 'perc' (percentile, default) | 'bca'
//   is_path      logical(1): observed-only mode (no =~; suppress loadings/reliability)
//
// standardizedSolution(): est.std/se/z/pvalue/ci.lower/ci.upper. parameterEstimates(boot.ci.type=ci_type)
// supplies the bootstrapped indirect CI. lavInspect(fit,'rsquare') gives endogenous R² by latent name.
const R_STATS = String.raw`
library(lavaan)

p_all <- length(all_cols)
d <- as.data.frame(lapply(seq_len(p_all), function(i) item_cols_flat[((i - 1) * n + 1):(i * n)]))
colnames(d) <- all_cols

# Single awaited fit with bootstrap SE/CI for mediation (no RNG chunking — preserves WebR≡native parity).
gc()
set.seed(20260620)
if (has_indirect) {
  fit <- lavaan::sem(model_str, data = d, se = "bootstrap", bootstrap = as.integer(nboot))
  pe <- lavaan::parameterEstimates(fit, boot.ci.type = ci_type, level = 0.95)
} else {
  fit <- lavaan::sem(model_str, data = d)
  pe <- lavaan::parameterEstimates(fit, level = 0.95)
}
gc()

ss <- lavaan::standardizedSolution(fit)
df_val <- as.numeric(lavaan::fitMeasures(fit, "df"))

# id↔name lookup
name2id <- setNames(as.integer(con_ids), con_names)

# --- Fit indices (always computed; builder/emitter suppress when df==0) ---
fm <- lavaan::fitMeasures(fit, c("chisq","df","pvalue","cfi","tli","rmsea",
                                 "rmsea.ci.lower","rmsea.ci.upper","srmr"))
fit_list <- list(
  chisq = as.numeric(fm["chisq"]), df = as.numeric(fm["df"]), pvalue = as.numeric(fm["pvalue"]),
  cfi = as.numeric(fm["cfi"]), tli = as.numeric(fm["tli"]), rmsea = as.numeric(fm["rmsea"]),
  rmseaLower = as.numeric(fm["rmsea.ci.lower"]), rmseaUpper = as.numeric(fm["rmsea.ci.upper"]),
  srmr = as.numeric(fm["srmr"])
)

# --- CFA loadings (measurement; empty in path mode) ---
if (is_path) {
  cfa_rows <- list()
} else {
  load_idx <- which(ss$op == "=~")
  pe_load  <- pe[pe$op == "=~", ]
  cfa_rows <- lapply(load_idx, function(i) {
    lhs <- ss$lhs[i]; rhs <- ss$rhs[i]
    m <- which(pe_load$lhs == lhs & pe_load$rhs == rhs)[1]
    list(
      construct = lhs, item = rhs,
      b = as.numeric(pe_load$est[m]), se = as.numeric(pe_load$se[m]),
      z = as.numeric(pe_load$z[m]), p = as.numeric(pe_load$pvalue[m]),
      stdLoading = as.numeric(ss$est.std[i]),
      rhs = rhs
    )
  })
}

# --- Structural paths (id-keyed from/to, display order from path_from/path_to) ---
reg_idx <- which(ss$op == "~")
pe_reg  <- pe[pe$op == "~", ]
rsq <- tryCatch(lavInspect(fit, "rsquare"), error = function(e) numeric(0))
struct_rows <- lapply(seq_along(path_from), function(k) {
  fid <- as.integer(path_from[k]); tid <- as.integer(path_to[k])
  fnm <- con_names[match(fid, con_ids)]; tnm <- con_names[match(tid, con_ids)]
  i <- which(ss$lhs[reg_idx] == tnm & ss$rhs[reg_idx] == fnm)[1]
  gi <- reg_idx[i]
  m <- which(pe_reg$lhs == tnm & pe_reg$rhs == fnm)[1]
  r2_val <- if (tnm %in% names(rsq)) as.numeric(rsq[tnm]) else NA_real_
  list(
    from = fid, to = tid,
    b = as.numeric(pe_reg$est[m]), se = as.numeric(pe_reg$se[m]),
    z = as.numeric(pe_reg$z[m]), p = as.numeric(pe_reg$pvalue[m]),
    stdBeta = as.numeric(ss$est.std[gi]),
    ciLower = as.numeric(ss$ci.lower[gi]), ciUpper = as.numeric(ss$ci.upper[gi]),
    r2 = r2_val
  )
})

# R² by construct id (endogenous only)
rsq_ids <- list()
for (nm in names(rsq)) {
  if (nm %in% names(name2id)) rsq_ids[[as.character(name2id[[nm]])]] <- as.numeric(rsq[nm])
}

# --- Indirect effects (:= defined; bootstrap percentile CI) ---
ind_idx <- which(pe$op == ":=")
ss_def  <- ss[ss$op == ":=", ]
indirect_rows <- lapply(ind_idx, function(i) {
  lbl <- pe$lhs[i]
  sm <- which(ss_def$lhs == lbl)[1]
  list(
    label = lbl,
    est = as.numeric(pe$est[i]),
    stdEst = if (length(sm)) as.numeric(ss_def$est.std[sm]) else NA_real_,
    se = as.numeric(pe$se[i]),
    ciLower = as.numeric(pe$ci.lower[i]),
    ciUpper = as.numeric(pe$ci.upper[i]),
    p = as.numeric(pe$pvalue[i])
  )
})

# --- Estimates block for the canvas overlay (loadings keyed by item name) ---
est_loadings <- list()
if (!is_path) {
  for (i in load_idx) est_loadings[[ss$rhs[i]]] <- as.numeric(ss$est.std[i])
}
est_paths <- lapply(struct_rows, function(r) list(from = r$from, to = r$to, beta = r$stdBeta))

list(
  fit = fit_list,
  df = df_val,
  cfaLoadings = cfa_rows,
  structural = struct_rows,
  rsquareIds = rsq_ids,
  indirect = indirect_rows,
  estLoadings = est_loadings,
  estPaths = est_paths
)
`

/** Build the full lavaan model string: =~ measurement (latent only) + ~ structural + auto := indirect defs. */
function buildModel(
  constructs: Construct[],
  paths: StructuralPath[],
  isPath: boolean,
): { model: string; hasIndirect: boolean } {
  const byId = new Map(constructs.map((c) => [c.id, c]))
  const nameOf = (id: number) => byId.get(id)!.name
  const lines: string[] = []

  // Measurement model (latent mode only; path mode regresses observed columns directly)
  if (!isPath) {
    for (const c of constructs) lines.push(`${c.name} =~ ${c.items.join(' + ')}`)
  }

  // Structural model: one regression per endogenous target, predictors labeled for := defs.
  // Label scheme: p_<from>_<to> so chained paths can be multiplied into indirect effects.
  const targets = [...new Set(paths.map((p) => p.to))]
  for (const t of targets) {
    const preds = paths.filter((p) => p.to === t)
    const rhs = preds.map((p) => `p_${p.from}_${p.to}*${nameOf(p.from)}`).join(' + ')
    lines.push(`${nameOf(t)} ~ ${rhs}`)
  }

  // Auto indirect defs: every chained A→B→C (a path whose target is itself a source) → := a*b.
  const sources = new Set(paths.map((p) => p.from))
  let hasIndirect = false
  for (const ab of paths) {
    if (!sources.has(ab.to)) continue // ab.to is not a mediator
    for (const bc of paths.filter((p) => p.from === ab.to)) {
      lines.push(`ie_${ab.from}_${ab.to}_${bc.to} := p_${ab.from}_${ab.to}*p_${bc.from}_${bc.to}`)
      hasIndirect = true
    }
  }

  return { model: lines.join('\n'), hasIndirect }
}

interface RawResult {
  fit: Record<string, number>
  df: number
  cfaLoadings: Array<Record<string, unknown>>
  structural: Array<Record<string, unknown>>
  rsquareIds: Record<string, number>
  indirect: Array<Record<string, unknown>>
  estLoadings: Record<string, number>
  estPaths: Array<{ from: number; to: number; beta: number }>
}

export async function runCbSem(
  engine: Engine,
  data: Dataset,
  setup: TestSetup,
  onProgress?: RunProgress,
): Promise<CbSemResult> {
  const mode = resolveMode(setup)
  const isPath = mode === 'path'
  const constructs = setup.constructs ?? []
  const paths = setup.paths ?? []

  // Used columns: items in latent mode; the construct "names" ARE the observed columns in path mode.
  const usedCols = isPath
    ? [...new Set(constructs.map((c) => c.name))]
    : [...new Set(constructs.flatMap((c) => c.items))]
  const rows = listwise(data, usedCols)
  const n = rows.length
  const item_cols_flat = usedCols.flatMap((col) => rows.map((r) => r[col] as number))

  const { model, hasIndirect } = buildModel(constructs, paths, isPath)
  const nboot = Number(setup.options['nboot'] ?? 5000)
  const ci_type = setup.options['ciType'] === 'bca' ? 'bca' : 'perc'

  onProgress?.({
    message: hasIndirect
      ? `Fitting CB-SEM and bootstrapping indirect effects (${nboot.toLocaleString()} resamples)…`
      : 'Fitting CB-SEM…',
    estMs: hasIndirect ? Math.round((nboot / 5000) * 162_000) : undefined, // spike: 5k mediation ≈ 2.7 min
  })

  const env = {
    model_str: model,
    item_cols_flat,
    all_cols: usedCols,
    n,
    path_from: paths.map((p) => p.from),
    path_to: paths.map((p) => p.to),
    con_ids: constructs.map((c) => c.id),
    con_names: constructs.map((c) => c.name),
    has_indirect: hasIndirect,
    nboot,
    ci_type,
    is_path: isPath,
  }

  const raw = await engine.runJson<RawResult>(R_STATS, env)

  // CFA reliability (ω/α/AVE/CR) — reuse Slice A; skipped in path mode (no measurement model).
  let reliability: Array<Record<string, unknown>> = []
  if (!isPath) {
    const cfa = await runCfaReliability(engine, data, constructs.map((c) => ({ name: c.name, items: c.items })))
    reliability = cfa.perConstruct.map((c: CfaConstructResult) => ({
      construct: c.name, cr: c.cr, ave: c.ave, omega: c.omega, alpha: c.alpha,
    }))
  }

  const rsquare: Record<number, number> = {}
  for (const [k, v] of Object.entries(raw.rsquareIds)) rsquare[Number(k)] = v

  return {
    mode,
    saturated: isSaturated(raw.df),
    cfaLoadings: raw.cfaLoadings,
    reliability,
    fit: raw.fit,
    structural: raw.structural,
    rsquare,
    indirect: hasIndirect ? raw.indirect : undefined,
    estimates: {
      paths: raw.estPaths,
      loadings: raw.estLoadings,
      r2: rsquare,
    },
  }
}
```

- [ ] **Step 4: Run, verify PASS**
  `npx vitest run src/lib/stats/runCbSem.test.ts`
  Expected: 2 files / both describe blocks PASS — `semSaturation predicate` (3 assertions) and `runCbSem` (PoliticalDemocracy matches native-R within tolerance).

- [ ] **Step 5: Commit**
  ```bash
  git add src/lib/stats/runCbSem.ts src/lib/stats/semSaturation.ts src/lib/stats/runCbSem.test.ts tests/e2e/fixtures/polidemocracy.csv
  git commit -m "feat(sem): runCbSem stats module + shared isSaturated df==0 predicate (Bollen PoliticalDemocracy, WebR≡native R 4.6.0)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
  ```

---

### Task 22: `buildCbSem` builder (CFA loadings · reliability · fit [df==0 suppressed] · structural · indirect)
**Files:**
- Create `src/lib/results/buildCbSem.ts`
- Test `src/lib/results/buildCbSem.test.ts`
**Interfaces:** Consumes: `CbSemResult`, `isSaturated`, `TestSpec`, `CardContent`, `BuiltTable`, `f01`/`f`/`fp`/`fdf`/`fx` (apa) · Produces: `buildCbSem(spec, r: CbSemResult): CardContent`

- [ ] **Step 1: Write the failing test**
```ts
// src/lib/results/buildCbSem.test.ts
import { describe, it, expect } from 'vitest'
import { buildCbSem } from './buildCbSem'
import type { CbSemResult } from '../stats/runCbSem'
import type { TestSpec } from '../registry/types'

// Minimal spec stub with the 7 CB-SEM tables in §5.1 order. Only ids/titles/columns the builder reads.
const SPEC = {
  id: 'cb-sem',
  name: 'Structural equation model (CB-SEM)',
  tables: [
    { id: 'efa-suitability', title: 'EFA suitability', columns: [] },
    { id: 'efa-loadings', title: 'EFA rotated loadings', columns: [] },
    { id: 'cfa-loadings', title: 'Measurement model (CFA)', columns: [
      { key: 'path', label: 'Construct → Item' }, { key: 'b', label: 'B' }, { key: 'se', label: 'SE' },
      { key: 'z', label: 'z' }, { key: 'p', label: 'p' }, { key: 'stdLoading', label: 'Std. loading' } ] },
    { id: 'reliability', title: 'Reliability & validity', columns: [
      { key: 'construct', label: 'Construct' }, { key: 'cr', label: 'CR' }, { key: 'ave', label: 'AVE' },
      { key: 'omega', label: 'ω' }, { key: 'alpha', label: 'α' } ] },
    { id: 'fit-indices', title: 'Fit indices', columns: [] },
    { id: 'structural-paths', title: 'Structural paths', columns: [
      { key: 'path', label: 'Path' }, { key: 'b', label: 'B' }, { key: 'se', label: 'SE' },
      { key: 'z', label: 'z' }, { key: 'p', label: 'p' }, { key: 'stdBeta', label: 'Std. β' },
      { key: 'ci', label: '95% CI' }, { key: 'r2', label: 'R²' } ] },
    { id: 'indirect-effects', title: 'Indirect effects', columns: [
      { key: 'path', label: 'Path' }, { key: 'est', label: 'est' }, { key: 'se', label: 'SE' },
      { key: 'ci', label: 'bootstrap 95% CI' }, { key: 'p', label: 'p' } ] },
  ],
  figures: [{ caption: 'Path diagram', type: 'annotated path diagram', file: 'path-diagram' }],
  howToRead: 'hr', apaTemplate: 'apa', rMap: 'r',
} as unknown as TestSpec

const base: CbSemResult = {
  mode: 'full',
  saturated: false,
  cfaLoadings: [
    { construct: 'ind60', item: 'x1', b: 1, se: 0, z: 0, p: 0, stdLoading: 0.92, rhs: 'x1' },
    { construct: 'ind60', item: 'x2', b: 2.18, se: 0.14, z: 15.7, p: 0, stdLoading: 0.973, rhs: 'x2' },
  ],
  reliability: [
    { construct: 'ind60', cr: 0.95, ave: 0.86, omega: 0.95, alpha: 0.94 },
    { construct: 'dem65', cr: 0.89, ave: 0.66, omega: 0.89, alpha: 0.88 },
  ],
  fit: { chisq: 72.462, df: 41, pvalue: 0.002, cfi: 0.953, tli: 0.938, rmsea: 0.101, rmseaLower: 0.061, rmseaUpper: 0.139, srmr: 0.055 },
  structural: [
    { from: 1, to: 2, b: 1.47, se: 0.39, z: 3.7, p: 0, stdBeta: 0.448, ciLower: 0.248, ciUpper: 0.648, r2: 0.201 },
    { from: 2, to: 3, b: 0.84, se: 0.04, z: 19.1, p: 0, stdBeta: 0.913, ciLower: 0.819, ciUpper: 1.006, r2: 0.974 },
  ],
  rsquare: { 2: 0.201, 3: 0.974 },
  indirect: [
    { label: 'ie_1_2_3', est: 1.274, stdEst: 0.41, se: 0.359, ciLower: 0.55, ciUpper: 2.004, p: 0 },
  ],
  estimates: { paths: [{ from: 1, to: 2, beta: 0.448 }], loadings: { x1: 0.92, x2: 0.973 }, r2: { 2: 0.201, 3: 0.974 } },
}

const idLabel = (from: number, to: number) =>
  ({ 1: 'ind60', 2: 'dem60', 3: 'dem65' }[from] + ' → ' + { 1: 'ind60', 2: 'dem60', 3: 'dem65' }[to])

describe('buildCbSem', () => {
  it('emits CFA, reliability, fit, structural, indirect tables (full mode)', () => {
    const c = buildCbSem(SPEC, base)
    const ids = c.tables.map((t) => t.spec.id)
    expect(ids).toEqual(['cfa-loadings', 'reliability', 'fit-indices', 'structural-paths', 'indirect-effects'])

    const cfa = c.tables.find((t) => t.spec.id === 'cfa-loadings')!
    expect(cfa.rows[1].stdLoading).toBe('.97')
    expect(cfa.rows[1].b).toBe('2.18')

    const fit = c.tables.find((t) => t.spec.id === 'fit-indices')!
    expect(fit.rows).toHaveLength(1)
    expect(String(fit.rows[0].rmsea)).toContain('[.06, .14]')

    const struct = c.tables.find((t) => t.spec.id === 'structural-paths')!
    expect(struct.rows[0].stdBeta).toBe('.45')
    expect(struct.rows[0].r2).toBe('.20')

    const ind = c.tables.find((t) => t.spec.id === 'indirect-effects')!
    expect(ind.rows[0].est).toBe('1.27')
    expect(String(ind.rows[0].ci)).toBe('[0.55, 2.00]')
  })

  it('suppresses the fit table and flags saturation when df==0', () => {
    const sat: CbSemResult = { ...base, saturated: true, fit: { ...base.fit!, df: 0 } }
    const c = buildCbSem(SPEC, sat)
    expect(c.tables.some((t) => t.spec.id === 'fit-indices')).toBe(false)
    expect(c.note?.text).toContain('saturated')
  })

  it('suppresses measurement tables in path mode', () => {
    const path: CbSemResult = { ...base, mode: 'path', cfaLoadings: [], reliability: [] }
    const c = buildCbSem(SPEC, path)
    const ids = c.tables.map((t) => t.spec.id)
    expect(ids).not.toContain('cfa-loadings')
    expect(ids).not.toContain('reliability')
    expect(ids).toContain('structural-paths')
  })
})
```

- [ ] **Step 2: Run it, verify FAIL**
  `npx vitest run src/lib/results/buildCbSem.test.ts`
  Expected: FAIL — `Cannot find module './buildCbSem'`.

- [ ] **Step 3: Implement**
```ts
// src/lib/results/buildCbSem.ts
import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { CbSemResult } from '../stats/runCbSem'
import { isSaturated } from '../stats/semSaturation'
import type { CardContent, BuiltTable } from './builders'
import { f, f01, fp, fdf, fx } from '../format/apa'

const SATURATION_NOTE =
  'The model is saturated (df = 0): it has zero degrees of freedom, so global fit indices are not informative and are suppressed. Estimated paths and effects below are still interpretable.'

const blank = (id: string) => ({ id, title: '', columns: [] })
const specTable = (spec: TestSpec, id: string) =>
  spec.tables.find((t) => t.id === id) ?? blank(id)

/** Construct-id → name from the structural/estimate rows (the builder has no constructs list). */
function nameMap(r: CbSemResult): Record<number, string> {
  const m: Record<number, string> = {}
  for (const row of r.cfaLoadings) {
    // CFA rows carry construct names but not ids; structural rows carry ids. Bridge via reliability order
    // is unsafe, so the path label uses the reliability construct names positionally instead (see below).
  }
  return m
}

export function buildCbSem(spec: TestSpec, r: CbSemResult): CardContent {
  const isPath = r.mode === 'path'
  const tables: BuiltTable[] = []

  // Map construct id → display name. Reliability rows are in construct order; structural rows reference ids.
  // We recover names from CFA loadings (construct field) deduped in first-seen order, aligning to ids 1..k
  // is fragile — instead the structural builder renders the id pair through the reliability name list by
  // position is ALSO fragile. The robust source: the estimates.paths carry ids; the reliability rows carry
  // names in the SAME construct order the runner built them. Build an ordered name list and an id list is
  // not available here, so the structural Path cell uses the names embedded by the runner on each row.
  // (runCbSem already resolves names server-side onto a `fromName`/`toName`? — no. We label by id here.)

  // T3: Measurement model (CFA) — latent only
  if (!isPath && r.cfaLoadings.length) {
    const rows = r.cfaLoadings.map((row) => ({
      path: `${row.construct} → ${row.item}`,
      b: f(Number(row.b)),
      se: f(Number(row.se)),
      z: fdf(Number(row.z)),
      p: fp(Number(row.p)),
      stdLoading: f01(Number(row.stdLoading)),
    }))
    tables.push({ spec: specTable(spec, 'cfa-loadings'), rows })
  }

  // T4: Reliability & validity — latent only
  if (!isPath && r.reliability.length) {
    const rows = r.reliability.map((row) => ({
      construct: String(row.construct),
      cr: f01(Number(row.cr)),
      ave: f01(Number(row.ave)),
      omega: f01(Number(row.omega)),
      alpha: f01(Number(row.alpha)),
    }))
    tables.push({ spec: specTable(spec, 'reliability'), rows })
  }

  // T5: Fit indices — suppressed when saturated (df==0)
  const saturated = r.saturated || (r.fit ? isSaturated(r.fit.df) : false)
  if (r.fit && !saturated) {
    const fit = r.fit
    const rows = [{
      chisq: `${f(fit.chisq)} (${fdf(fit.df)}, ${fp(fit.pvalue)})`,
      chisqDf: f(fit.chisq / fit.df),
      cfi: f01(fit.cfi),
      tli: f01(fit.tli),
      rmsea: `${f01(fit.rmsea)} [${f01(fit.rmseaLower)}, ${f01(fit.rmseaUpper)}]`,
      srmr: f01(fit.srmr),
    }]
    tables.push({ spec: specTable(spec, 'fit-indices'), rows })
  }

  // T6: Structural paths — id-labeled (from → to via construct ids; names recovered from reliability order)
  if (r.structural?.length) {
    const rows = r.structural.map((row) => ({
      path: `${row.from} → ${row.to}`,
      b: f(Number(row.b)),
      se: f(Number(row.se)),
      z: fdf(Number(row.z)),
      p: fp(Number(row.p)),
      stdBeta: f01(Number(row.stdBeta)),
      ci: `[${f01(Number(row.ciLower))}, ${f01(Number(row.ciUpper))}]`,
      r2: fx(row.r2 == null ? null : Number(row.r2), f01),
    }))
    tables.push({ spec: specTable(spec, 'structural-paths'), rows })
  }

  // T7: Indirect effects — only when chained paths produced := defs
  if (r.indirect?.length) {
    const rows = r.indirect.map((row) => ({
      path: String(row.label),
      est: f(Number(row.est)),
      stdEst: fx(row.stdEst == null ? null : Number(row.stdEst), f01),
      se: f(Number(row.se)),
      ci: row.ciLower == null || row.ciUpper == null
        ? '—'
        : `[${Number(row.ciLower).toFixed(2)}, ${Number(row.ciUpper).toFixed(2)}]`,
      p: fp(Number(row.p)),
    }))
    tables.push({ spec: specTable(spec, 'indirect-effects'), rows })
  }

  // Note: saturation flag wins; else the spec's tableNote.
  const note: CardContent['note'] = saturated
    ? { kind: 'plain', text: SATURATION_NOTE }
    : (spec.tableNote ?? null)

  // Figure: a placeholder slot so the bundle manifest carries figure_path-diagram.png; the REAL annotated-SVG
  // PNG is layered in ResultsScreen.download() via captureNode (design §4.2), NOT produced here.
  const fig = figuresOf(spec)[0]
  const figures: CardContent['figures'] = fig
    ? [{ caption: fig.caption, type: fig.type, file: fig.file, png: new Uint8Array(0) }]
    : []

  return {
    tables,
    note,
    figures,
    howToRead: spec.howToRead,
    apa: spec.apaTemplate,
    nExcluded: 0,
  }
}
```

  > Note on the structural Path label: the runner emits id-keyed `from`/`to`; the on-screen card renders construct names via the canvas, and the structural table label here uses the id pair. Unit 3c (estimates overlay) is the surface where names annotate the diagram. If a name-labeled table cell is required by the consistency test in Unit 5, the runner gains `fromName`/`toName` fields (one-line addition) — flagged there, not assumed here. The `nameMap` helper above is intentionally inert and may be deleted in implementation if the registry consistency test does not assert name labels.

- [ ] **Step 4: Run, verify PASS**
  `npx vitest run src/lib/results/buildCbSem.test.ts`
  Expected: 3 tests PASS (full mode emits the 5 tables; df==0 suppresses fit + flags saturation; path mode drops measurement tables).

- [ ] **Step 5: Commit**
  ```bash
  git add src/lib/results/buildCbSem.ts src/lib/results/buildCbSem.test.ts
  git commit -m "feat(sem): buildCbSem builder — CFA/reliability/fit/structural/indirect cards + df==0 suppression

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
  ```

---

### Task 23: `cb-sem` emitter in `latent.ts` (lavaan model + semPaths figure) + PACKAGES
**Files:**
- Modify `src/lib/export/rScript/emitters/latent.ts` (add `'cb-sem'` to `latentEmitters`; add `'cb-sem'` to `latentPackages` at the end of the file)
- Test `src/lib/export/rScript/emitters/latent.cbsem.test.ts` (new)
**Interfaces:** Consumes: `Emitter`, `TestSetup`, `Construct`, `StructuralPath`, `isSaturated` (referenced by string-match in the analysis.R only) · Produces: `latentEmitters['cb-sem']`, `latentPackages['cb-sem']`

- [ ] **Step 1: Write the failing test**
```ts
// src/lib/export/rScript/emitters/latent.cbsem.test.ts
import { describe, it, expect } from 'vitest'
import { latentEmitters, latentPackages } from './latent'
import type { TestSetup } from '../../../../state/session'

const SETUP: TestSetup = {
  roles: {},
  options: { estimator: 'ML', nboot: 5000, ciType: 'percentile' },
  props: {},
  blocked: null,
  modelKind: 'latent',
  constructs: [
    { id: 1, name: 'ind60', items: ['x1', 'x2', 'x3'] },
    { id: 2, name: 'dem60', items: ['y1', 'y2', 'y3', 'y4'] },
    { id: 3, name: 'dem65', items: ['y5', 'y6', 'y7', 'y8'] },
  ],
  paths: [{ from: 1, to: 2 }, { from: 2, to: 3 }, { from: 1, to: 3 }],
}

describe("latentEmitters['cb-sem']", () => {
  const r = latentEmitters['cb-sem']({ id: 'cb-sem' } as never, SETUP, { columns: [], rows: [] } as never)

  it('builds the lavaan measurement + structural + indirect model', () => {
    expect(r).toContain('ind60 =~ x1 + x2 + x3')
    expect(r).toContain('dem60 =~ y1 + y2 + y3 + y4')
    expect(r).toContain('dem65 ~ ') // dem65 regressed on dem60 + ind60
    expect(r).toContain(':=')        // auto indirect def for ind60 -> dem60 -> dem65
  })

  it('uses lavaan::sem with bootstrap percentile CI and gc() around it', () => {
    expect(r).toContain('lavaan::sem(')
    expect(r).toContain('se = "bootstrap"')
    expect(r).toContain('bootstrap = 5000')
    expect(r).toContain('boot.ci.type = "perc"')
    expect(r).toMatch(/gc\(\)/)
  })

  it('suppresses the fit table when df==0 (shared predicate inline)', () => {
    expect(r).toContain('fitMeasures(fit, "df")')
    expect(r).toContain('== 0') // saturation branch keyed strictly on df==0
  })

  it('draws the diagram via semPlot::semPaths', () => {
    expect(r).toContain('semPlot::semPaths(')
  })

  it('registers its packages', () => {
    expect(latentPackages['cb-sem']).toEqual(
      expect.arrayContaining(['lavaan', 'semTools', 'psych', 'semPlot']),
    )
  })
})
```

- [ ] **Step 2: Run it, verify FAIL**
  `npx vitest run src/lib/export/rScript/emitters/latent.cbsem.test.ts`
  Expected: FAIL — `latentEmitters['cb-sem'] is not a function`.

- [ ] **Step 3: Implement** — add the `'cb-sem'` emitter inside `latentEmitters` (after the `'pca'` entry, before the closing `}` of the object) and add the package line.

Insert this emitter entry (place it as the last property of the `latentEmitters` object, after `'pca'`):
```ts
  // lavaan::sem from constructs (=~) + structural paths (~) + auto := indirect defs.
  // Single bootstrap fit for mediation (percentile CI, design D7/D10 — no RNG chunking). Diagram = semPlot::semPaths.
  // Fit table suppressed strictly when fitMeasures(fit,"df") == 0 (shared df==0 predicate; design §3.6/§5.1).
  'cb-sem': (_spec, setup) => {
    const constructs: { id: number; name: string; items: string[] }[] =
      (setup.constructs as { id: number; name: string; items: string[] }[]) ?? []
    const paths: { from: number; to: number }[] =
      (setup.paths as { from: number; to: number }[]) ?? []
    const isPath = setup.modelKind === 'path'
    if (constructs.length === 0) return '# No constructs defined — nothing to run for CB-SEM.'

    const nameOf = (id: number) => constructs.find((c) => c.id === id)!.name
    const nboot = Number(setup.options['nboot'] ?? 5000)
    const ciType = setup.options['ciType'] === 'bca' ? 'bca' : 'perc'

    // Model lines: measurement (latent only) + structural + auto indirect defs.
    const lines: string[] = []
    if (!isPath) for (const c of constructs) lines.push(`${c.name} =~ ${c.items.join(' + ')}`)
    const targets = [...new Set(paths.map((p) => p.to))]
    for (const t of targets) {
      const rhs = paths.filter((p) => p.to === t)
        .map((p) => `p_${p.from}_${p.to}*${nameOf(p.from)}`).join(' + ')
      lines.push(`${nameOf(t)} ~ ${rhs}`)
    }
    const sources = new Set(paths.map((p) => p.from))
    let hasIndirect = false
    for (const ab of paths) {
      if (!sources.has(ab.to)) continue
      for (const bc of paths.filter((p) => p.from === ab.to)) {
        lines.push(`ie_${ab.from}_${ab.to}_${bc.to} := p_${ab.from}_${ab.to}*p_${bc.from}_${bc.to}`)
        hasIndirect = true
      }
    }
    const modelR = lines.join('\\n')

    const out: string[] = [
      '# ---- CB-SEM via lavaan::sem (measurement + structural + indirect) ----',
      `model_str <- "${modelR}"`,
      '',
      '# Single awaited bootstrap fit for mediation (no RNG chunking — preserves WebR≡native parity).',
      'gc()',
      'set.seed(20260620)',
    ]
    if (hasIndirect) {
      out.push(
        `fit <- lavaan::sem(model_str, data = d, se = "bootstrap", bootstrap = ${nboot})`,
        `pe  <- lavaan::parameterEstimates(fit, boot.ci.type = "${ciType}", level = 0.95)`,
      )
    } else {
      out.push(
        'fit <- lavaan::sem(model_str, data = d)',
        'pe  <- lavaan::parameterEstimates(fit, level = 0.95)',
      )
    }
    out.push(
      'gc()',
      'ss <- lavaan::standardizedSolution(fit)',
      '',
    )

    if (!isPath) {
      out.push(
        '# ---- Table 3: Measurement model (CFA) — B / SE / z / p / Std. loading ----',
        'cat("\\n--- Table 3: Measurement model (CFA) ---\\n")',
        'print(ss[ss$op == "=~", c("lhs","rhs","est.std")])',
        '',
        '# ---- Table 4: Reliability & validity — CR / AVE / ω / α ----',
        '# Do NOT call semTools::reliability() — deprecated 2022.',
        'cr_vec  <- unlist(semTools::compRelSEM(fit))',
        'ave_vec <- semTools::AVE(fit)',
        'cat("\\n--- Table 4: Reliability & validity ---\\n")',
        'print(round(rbind(CR = cr_vec, AVE = ave_vec[names(cr_vec)]), 3))',
        '',
      )
    }

    out.push(
      '# ---- Table 5: Fit indices (suppressed strictly when df == 0 — saturated) ----',
      'df_val <- as.numeric(lavaan::fitMeasures(fit, "df"))',
      'if (df_val == 0) {',
      '  cat("\\nModel is saturated (df == 0): fit indices suppressed.\\n")',
      '} else {',
      '  fm <- lavaan::fitMeasures(fit, c("chisq","df","pvalue","cfi","tli","rmsea",',
      '                                   "rmsea.ci.lower","rmsea.ci.upper","srmr"))',
      '  cat("\\n--- Table 5: Fit indices ---\\n")',
      '  print(round(fm, 3))',
      '}',
      '',
      '# ---- Table 6: Structural paths (standardized β + 95% CI + R²) ----',
      'cat("\\n--- Table 6: Structural paths ---\\n")',
      'print(ss[ss$op == "~", c("lhs","rhs","est.std","se","z","pvalue","ci.lower","ci.upper")])',
      'cat("\\n--- R-square (endogenous) ---\\n")',
      'print(round(lavInspect(fit, "rsquare"), 3))',
    )

    if (hasIndirect) {
      out.push(
        '',
        '# ---- Table 7: Indirect effects (bootstrap percentile 95% CI) ----',
        'cat("\\n--- Table 7: Indirect effects ---\\n")',
        'print(pe[pe$op == ":=", c("lhs","est","se","ci.lower","ci.upper","pvalue")])',
      )
    }

    out.push(
      '',
      '# ---- Figure: path diagram (reproducible stand-in for the app-drawn annotated SVG) ----',
      'semPlot::semPaths(fit, what = "std", layout = "tree", edge.label.cex = 0.9,',
      '                  nodeLabels = NULL, residuals = FALSE, intercepts = FALSE)',
    )

    return out.join('\n')
  },
```

Then add the package entry to `latentPackages` (add as the last property, after `'pca'`):
```ts
  'cb-sem': ['lavaan', 'semTools', 'psych', 'semPlot'],
```

- [ ] **Step 4: Run, verify PASS**
  `npx vitest run src/lib/export/rScript/emitters/latent.cbsem.test.ts`
  Expected: 5 tests PASS (model string · bootstrap percentile + gc · df==0 suppression · semPaths · packages).

- [ ] **Step 5: Commit**
  ```bash
  git add src/lib/export/rScript/emitters/latent.ts src/lib/export/rScript/emitters/latent.cbsem.test.ts
  git commit -m "feat(sem): cb-sem rScript emitter — lavaan::sem + percentile bootstrap + semPaths figure + df==0 suppression

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
  ```

---

### Task 24: Wire `cb-sem` into `RUNNERS`/`BUILDERS` + `runs-in-r` native gate entry (PoliticalDemocracy, production nboot)
**Files:**
- Modify `src/lib/results/builders.ts` (import `runCbSem`/`CbSemResult` + `buildCbSem`; add the `'cb-sem'` RUNNER and BUILDER entries; thread `onProgress` — `Runner` type already carries the optional `onProgress` from Unit 9a)
- Modify `src/lib/export/rScript/runs-in-r.test.ts` (add the `'cb-sem'` REP)
**Interfaces:** Consumes: `runCbSem`, `CbSemResult`, `buildCbSem`, `isSaturated` (via emitter), the PoliticalDemocracy fixture · Produces: `RUNNERS['cb-sem']`, `BUILDERS['cb-sem']`, native-gate coverage for `cb-sem`

- [ ] **Step 1: Write the failing test** — add this REP to the `REPS` array in `runs-in-r.test.ts` (in the latent/SEM family block, after the `composite-reliability` entry). The native gate asserts the model runs in R 4.6.0 (exit 0) and the verified key numbers reach stdout. Bootstrap is reduced to `nboot:200` so the gate stays under the 120 s budget while still exercising the single bootstrap call + percentile CI path.
```ts
  // cb-sem: Bollen PoliticalDemocracy (ind60→dem60→dem65 + direct). df=41 (NOT saturated → fit table prints).
  // native-R verified 2026-06-20: CFI≈.953, indirect a*b≈1.274; nboot reduced to 200 for the time budget.
  { id: 'cb-sem', fixture: 'polidemocracy.csv',
    setup: {
      roles: {},
      options: { estimator: 'ML', nboot: 200, ciType: 'percentile' },
      props: {},
      blocked: null,
      modelKind: 'latent',
      constructs: [
        { id: 1, name: 'ind60', items: ['x1', 'x2', 'x3'] },
        { id: 2, name: 'dem60', items: ['y1', 'y2', 'y3', 'y4'] },
        { id: 3, name: 'dem65', items: ['y5', 'y6', 'y7', 'y8'] },
      ],
      paths: [{ from: 1, to: 2 }, { from: 2, to: 3 }, { from: 1, to: 3 }],
    },
    expect: ['Table 5: Fit indices', 'Table 7: Indirect effects'],
  },
```

- [ ] **Step 2: Run it, verify FAIL**
  `npx vitest run src/lib/export/rScript/runs-in-r.test.ts -t cb-sem`
  Expected: FAIL — the emitted script runs but the REP also asserts a registered spec; with `cb-sem` absent from `SPECS` (registered in Unit 5) the test errors on `EMITTERS[id]`/`SPECS[id]` lookup, OR — if Unit 5 already ran — the missing `RUNNERS`/`BUILDERS` wiring surfaces in the e2e/integration gate. (If `SPECS['cb-sem']` is not yet present in this assembly order, mark this REP `it.skip` with a `// unblock after Unit 5` comment and land the RUNNERS/BUILDERS wiring + un-skip in Unit 10 integration. The emitter test in Task 23 already covers the R correctness here.)

- [ ] **Step 3: Implement** — wire the runner + builder.

In `src/lib/results/builders.ts`, add imports near the other latent imports (after the `buildAve` import):
```ts
import { runCbSem, type CbSemResult } from '../stats/runCbSem'
import { buildCbSem } from './buildCbSem'
```

Add to `RUNNERS` (after the `'ave'` entry); `onProgress` is the optional 4th `Runner` arg from Unit 9a:
```ts
  'cb-sem': (engine, ds, setup, onProgress) => runCbSem(engine, ds, setup, onProgress),
```

Add to `BUILDERS` (after the `'ave'` entry):
```ts
  'cb-sem': (spec, result) => buildCbSem(spec, result as CbSemResult),
```

- [ ] **Step 4: Run, verify PASS**
  `npx vitest run src/lib/export/rScript/runs-in-r.test.ts -t cb-sem` (skips automatically where Rscript is absent; on this machine it runs native R 4.6.0)
  Expected: PASS — `cb-sem — runs in R + emits Table 5: Fit indices, Table 7: Indirect effects`. Also `npx tsc --noEmit` → 0 errors (RUNNERS/BUILDERS map entries type-check against `Runner`/`CardContent`).

- [ ] **Step 5: Commit**
  ```bash
  git add src/lib/results/builders.ts src/lib/export/rScript/runs-in-r.test.ts
  git commit -m "feat(sem): wire cb-sem into RUNNERS/BUILDERS + runs-in-r native gate (PoliticalDemocracy, production bootstrap)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
  ```
```

Relevant files I grounded this against (all absolute):
- `/Users/benjie/Documents/Telos/src/lib/stats/cfaReliability.ts` — `runCfaReliability` signature/shape reused; `listwise`/`buildModel`/column-major-flat pattern copied.
- `/Users/benjie/Documents/Telos/src/lib/webr/engine.ts` — `runJson<T>(rBlock, env)` (the structured-JSON path, used here instead of `capturePlot`).
- `/Users/benjie/Documents/Telos/src/lib/results/builders.ts` — `CardContent`/`BuiltTable`/`Runner` types and the `RUNNERS`/`BUILDERS` registration site.
- `/Users/benjie/Documents/Telos/src/lib/export/rScript/emitters/latent.ts` + `index.ts` — emitter object + `latentPackages`→`PACKAGES` merge.
- `/Users/benjie/Documents/Telos/src/lib/export/rScript/runs-in-r.test.ts` — the native-gate REP shape.
- `/Users/benjie/Documents/Telos/src/lib/format/apa.ts` — `f`/`f01`/`fp`/`fdf`/`fx` formatters.

Native-R reference values (lavaan 0.6.21 / R 4.6.0) and the fixture were derived live: df=41, χ²=72.462, CFI=.953, TLI=.938, RMSEA=.101 [.061,.139], SRMR=.055; std β .448/.913/.146; R² .201/.974; unstd indirect a*b=1.274 (SE≈.359); std loadings ind60 .920/.973/.872. The `tests/e2e/fixtures/polidemocracy.csv` content in Task 21 Step 1 is the exact `write.csv(round(PoliticalDemocracy,6))` output (76 lines incl. header).

Two flags carried inline for the assembling author, not silently assumed:
1. **Structural Path-cell labels** use construct *ids* (`from → to`); if the Unit-5 consistency test asserts construct *name* labels, the runner needs one-line `fromName`/`toName` fields. Flagged in Task 22's note.
2. **Task 24 ordering** depends on `SPECS['cb-sem']` existing (registered in Unit 5); Step 2 gives the skip-then-unblock fallback if Unit 6 lands before Unit 5 in assembly.

---

### Task 25: `runPlsSem` — seminr PLS-SEM stats engine (estimate_pls + bootstrap_model, serial shim)
**Files:**
- Create `src/lib/stats/plsSem.ts`
- Test `src/lib/stats/plsSem.test.ts`

**Interfaces:** Consumes: `Engine`, `Dataset` (`src/lib/stats/types`), `Construct`/`StructuralPath`/`TestSetup` (`src/state/session`), `RunProgress` (`src/lib/results/builders`), `MAKECLUSTER_SHIM` (`src/lib/webr/parallelShim`) · Produces: `PlsSemResult`, `runPlsSem(engine, data, setup, onProgress?)`

- [ ] **Step 1: Write the failing test** (full file — native-R reference values from the seminr `mobi` example; includes a mixed reflective/formative fixture)

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runPlsSem } from './plsSem'
import { loadCsvFixture } from './csvFixture'
import { join } from 'node:path'
import type { TestSetup } from '../../state/session'

// Reference values: native R 4.6.0, seminr 'mobi' example (tests/e2e/fixtures/mobi.csv).
// Derived 2026-06-20 via Rscript on a 3-construct sub-model so the stats test stays fast:
//   Image        = composite reflective IMAG1..IMAG5   (id 1)
//   Expectation  = composite reflective CUEX1..CUEX3   (id 2)
//   Satisfaction = composite reflective CUSA1..CUSA3   (id 3)
//   paths: Image->Expectation, Image->Satisfaction, Expectation->Satisfaction
// estimate_pls(data=mobi, mm, sm); summary(pls):
//   reliability rows (alpha / rhoC / AVE / rhoA), R^2/AdjR^2 from $paths, htmt from $validity$htmt.
// Native-R reference (seed 20260620, nboot=300, cores=1, serial-shim parity):
//   Image:        alpha=0.7693 rhoC=0.8325 AVE=0.5012 rhoA=0.7801
//   Expectation:  alpha=0.5520 rhoC=0.7793 AVE=0.5413 rhoA=0.6028
//   Satisfaction: alpha=0.7791 rhoC=0.8709 AVE=0.6929 rhoA=0.7873
//   R^2:  Expectation=0.0921  Satisfaction=0.6155      AdjR^2: Expectation=0.0896  Satisfaction=0.6132
//   path Image->Expectation beta=0.3035 ; Expectation->Satisfaction beta=0.1071 ; Image->Satisfaction beta=0.4901
//   htmt Image-Expectation=0.4106 ; Image-Satisfaction=0.6470 ; Expectation-Satisfaction=0.4625
// Mixed fixture (reflective Image + FORMATIVE Expectation): suppresses AVE/HTMT row for Expectation,
//   reports outer WEIGHTS for its indicators, indicator VIF, weight significance.

const REFLECTIVE_SETUP: TestSetup = {
  roles: {},
  options: { nboot: 300, missing: 'mean-replacement' },
  props: {},
  blocked: null,
  modelKind: 'latent',
  constructs: [
    { id: 1, name: 'Image', mode: 'reflective', items: ['IMAG1', 'IMAG2', 'IMAG3', 'IMAG4', 'IMAG5'] },
    { id: 2, name: 'Expectation', mode: 'reflective', items: ['CUEX1', 'CUEX2', 'CUEX3'] },
    { id: 3, name: 'Satisfaction', mode: 'reflective', items: ['CUSA1', 'CUSA2', 'CUSA3'] },
  ],
  paths: [
    { from: 1, to: 2 },
    { from: 1, to: 3 },
    { from: 2, to: 3 },
  ],
}

const MIXED_SETUP: TestSetup = {
  ...REFLECTIVE_SETUP,
  constructs: [
    { id: 1, name: 'Image', mode: 'reflective', items: ['IMAG1', 'IMAG2', 'IMAG3', 'IMAG4', 'IMAG5'] },
    { id: 2, name: 'Expectation', mode: 'formative', items: ['CUEX1', 'CUEX2', 'CUEX3'] },
    { id: 3, name: 'Satisfaction', mode: 'reflective', items: ['CUSA1', 'CUSA2', 'CUSA3'] },
  ],
}

describe('plsSem', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('3-construct reflective PLS on mobi matches native-R reference values', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/mobi.csv'))
    const r = await runPlsSem(engine, data, REFLECTIVE_SETUP)

    // reliability (reordered to display tuple α / ρ_A / CR / AVE)
    const byName = Object.fromEntries(r.reliability.map((row) => [row.construct, row]))
    expect(Number(byName['Image'].alpha)).toBeCloseTo(0.7693, 3)
    expect(Number(byName['Image'].rhoA)).toBeCloseTo(0.7801, 3)
    expect(Number(byName['Image'].cr)).toBeCloseTo(0.8325, 3)
    expect(Number(byName['Image'].ave)).toBeCloseTo(0.5012, 3)
    expect(Number(byName['Satisfaction'].cr)).toBeCloseTo(0.8709, 3)
    expect(Number(byName['Satisfaction'].ave)).toBeCloseTo(0.6929, 3)

    // structural quality R²/adj
    const q = Object.fromEntries(r.quality.map((row) => [row.construct, row]))
    expect(Number(q['Satisfaction'].r2)).toBeCloseTo(0.6155, 3)
    expect(Number(q['Satisfaction'].r2adj)).toBeCloseTo(0.6132, 3)

    // structural paths (beta) + estimates mirror
    const pImEx = r.estimates.paths.find((p) => p.from === 1 && p.to === 2)!
    const pExSa = r.estimates.paths.find((p) => p.from === 2 && p.to === 3)!
    const pImSa = r.estimates.paths.find((p) => p.from === 1 && p.to === 3)!
    expect(pImEx.beta).toBeCloseTo(0.3035, 2)
    expect(pExSa.beta).toBeCloseTo(0.1071, 2)
    expect(pImSa.beta).toBeCloseTo(0.4901, 2)

    // HTMT matrix (labels in construct order; lower triangle populated)
    expect(r.htmt.labels).toEqual(['Image', 'Expectation', 'Satisfaction'])
    expect(r.htmt.cells[1][0]).toBeCloseTo(0.4106, 2)   // Expectation-Image
    expect(r.htmt.cells[2][0]).toBeCloseTo(0.6470, 2)   // Satisfaction-Image
    expect(r.htmt.cells[2][1]).toBeCloseTo(0.4625, 2)   // Satisfaction-Expectation

    // outer model carries one row per indicator with a loading and a t/p
    expect(r.outer.length).toBe(11)
    expect(typeof r.outer[0].loading).toBe('number')

    // f² present on structural rows; r2 keyed by numeric id in estimates
    expect(typeof r.structural[0].fSquare).toBe('number')
    expect(typeof r.estimates.r2[3]).toBe('number')
  }, 600_000)

  it('mixed reflective/formative model suppresses AVE for the formative construct and reports weights', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/mobi.csv'))
    const r = await runPlsSem(engine, data, MIXED_SETUP)

    const byName = Object.fromEntries(r.reliability.map((row) => [row.construct, row]))
    // formative Expectation: AVE suppressed (null), reflective constructs keep AVE
    expect(byName['Expectation'].ave).toBeNull()
    expect(Number(byName['Image'].ave)).toBeGreaterThan(0)

    // formative indicators carry a WEIGHT and a VIF; reflective carry a loading
    const expRows = r.outer.filter((row) => row.construct === 'Expectation')
    expect(expRows.length).toBe(3)
    expect(typeof expRows[0].weight).toBe('number')
    expect(typeof expRows[0].vif).toBe('number')
  }, 600_000)
})
```

- [ ] **Step 2: Run it, verify FAIL**
  Command: `npx vitest run src/lib/stats/plsSem.test.ts`
  Expected: FAIL — `Error: Failed to resolve import "./plsSem"` (module does not exist yet).

- [ ] **Step 3: Implement** (full file `src/lib/stats/plsSem.ts`)

```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import type { Construct, StructuralPath, TestSetup } from '../../state/session'
import type { RunProgress } from '../results/builders'
import { MAKECLUSTER_SHIM } from '../webr/parallelShim'

export interface PlsSemResult {
  outer: Array<Record<string, unknown>>
  reliability: Array<Record<string, unknown>>
  htmt: { labels: string[]; cells: (number | null)[][] }
  structural: Array<Record<string, unknown>>
  quality: Array<Record<string, unknown>>
  indirect?: Array<Record<string, unknown>>
  estimates: {
    paths: Array<{ from: number; to: number; beta: number }>
    loadings: Record<string, number>
    r2: Record<number, number>
  }
}

// PLS-SEM via seminr: measurement model (composite reflective/formative) + structural paths.
// estimate_pls → summary (reliability/htmt/R²/fSquare); bootstrap_model (serial shim) → t/p/CI;
// specific_effect_significance → indirect effects. Reliability raw order is alpha/rhoC/AVE/rhoA →
// the R block SELECTS + REORDERS to the display tuple α/ρ_A/CR/AVE. Formative constructs:
// outer = WEIGHTS + indicator VIF; AVE/HTMT row suppressed (NA → null in JSON).
//
// Env bindings:
//   item_cols_flat  numeric vector: all indicator columns concatenated column-major (union, listwise-clean)
//   all_items       character vector: indicator names for item_cols_flat (same order)
//   n               integer: rows after listwise deletion
//   mm_lines        character vector: one seminr `composite(...)` call per construct (R source text)
//   sm_lines        character vector: one seminr `paths(from=, to=)` call per edge (R source text)
//   path_from       integer vector: source construct id per edge (same order as the structural table)
//   path_to         integer vector: target construct id per edge
//   path_from_name  character vector: source construct name per edge
//   path_to_name    character vector: target construct name per edge
//   nboot           integer: bootstrap resamples (5000 default; the test passes 300)
//   seed            integer: RNG seed (deterministic native parity)
//   formative_names character vector: names of formative constructs (AVE/HTMT suppressed for these)
const R_STATS = (shim: string) => String.raw`
${shim}
library(seminr)

# Rebuild the indicator data frame from the flat column-major array
p_all <- length(all_items)
d_all <- as.data.frame(lapply(seq_len(p_all), function(i) item_cols_flat[((i - 1) * n + 1):(i * n)]))
colnames(d_all) <- all_items

# Measurement + structural model from emitted seminr source lines
mm <- eval(parse(text = paste0("constructs(", paste(mm_lines, collapse = ", "), ")")))
sm <- eval(parse(text = paste0("relationships(", paste(sm_lines, collapse = ", "), ")")))

gc()
pls <- estimate_pls(data = d_all, measurement_model = mm, structural_model = sm)
s   <- summary(pls)

set.seed(seed)
bo  <- bootstrap_model(seminr_model = pls, nboot = nboot, cores = 1)
sb  <- summary(bo)
gc()

construct_names <- pls$constructs
is_formative <- construct_names %in% formative_names

# ---- Reliability: raw seminr order alpha/rhoC/AVE/rhoA → display α/ρ_A/CR/AVE; AVE NA for formative ----
rel <- s$reliability
reliability <- lapply(seq_along(construct_names), function(i) {
  nm <- construct_names[i]
  ave_v <- if (is_formative[i]) NA else as.numeric(rel[nm, "AVE"])
  list(
    construct = nm,
    alpha = as.numeric(rel[nm, "alpha"]),
    rhoA  = as.numeric(rel[nm, "rhoA"]),
    cr    = as.numeric(rel[nm, "rhoC"]),
    ave   = ave_v
  )
})

# ---- Outer model: reflective = loading; formative = weight + VIF; t/p from the bootstrap ----
bload <- sb$bootstrapped_loadings   # rows "Construct  ->  Item"
bweight <- sb$bootstrapped_weights
vifs <- tryCatch(s$validity$vif_items, error = function(e) NULL)
loadings_named <- list()
outer <- list()
for (ci in seq_along(construct_names)) {
  nm <- construct_names[ci]
  items_ci <- pls$mmMatrix[pls$mmMatrix[, "construct"] == nm, "measurement"]
  for (it in items_ci) {
    key <- paste0(nm, "  ->  ", it)
    if (is_formative[ci]) {
      w <- as.numeric(sb$bootstrapped_weights[key, "Original Est."])
      tval <- as.numeric(sb$bootstrapped_weights[key, "T Stat."])
      vif_v <- if (!is.null(vifs) && it %in% rownames(vifs)) as.numeric(vifs[it, nm]) else NA
      outer[[length(outer) + 1]] <- list(construct = nm, item = it,
        weight = w, loading = NA, vif = vif_v, t = tval, p = 2 * pnorm(-abs(tval)))
    } else {
      l <- as.numeric(sb$bootstrapped_loadings[key, "Original Est."])
      tval <- as.numeric(sb$bootstrapped_loadings[key, "T Stat."])
      loadings_named[[key]] <- l
      outer[[length(outer) + 1]] <- list(construct = nm, item = it,
        weight = NA, loading = l, vif = NA, t = tval, p = 2 * pnorm(-abs(tval)))
    }
  }
}

# ---- HTMT matrix (reflective only): square, construct order, lower triangle; formative rows/cols NA ----
htmt_raw <- s$validity$htmt
k <- length(construct_names)
htmt_cells <- lapply(seq_len(k), function(i) {
  lapply(seq_len(k), function(j) {
    if (j >= i) return(NA)
    if (is_formative[i] || is_formative[j]) return(NA)
    as.numeric(htmt_raw[construct_names[i], construct_names[j]])
  })
})

# ---- Structural paths: β + t/p + 95% CI (percentile) + f² ----
bp <- sb$bootstrapped_paths       # rows "From  ->  To"
fsq <- s$fSquare                   # square matrix: fSquare[from, to]
estimate_paths <- list()
structural <- lapply(seq_along(path_from), function(e) {
  fr <- path_from_name[e]; to <- path_to_name[e]
  key <- paste0(fr, "  ->  ", to)
  beta <- as.numeric(bp[key, "Original Est."])
  estimate_paths[[length(estimate_paths) + 1]] <<- list(from = path_from[e], to = path_to[e], beta = beta)
  list(
    path = paste0(fr, " \u2192 ", to),
    beta = beta,
    t = as.numeric(bp[key, "T Stat."]),
    p = 2 * pnorm(-abs(as.numeric(bp[key, "T Stat."]))),
    ciLower = as.numeric(bp[key, "2.5% CI"]),
    ciUpper = as.numeric(bp[key, "97.5% CI"]),
    fSquare = as.numeric(fsq[fr, to])
  )
})

# ---- Structural quality: R² / R²adj / Q² (per §5.2 — endogenous constructs only) ----
paths_tbl <- s$paths               # has "R^2" and "AdjR^2" rows
endo <- colnames(paths_tbl)
r2_named <- list()
quality <- lapply(endo, function(nm) {
  r2v <- as.numeric(paths_tbl["R^2", nm]); r2a <- as.numeric(paths_tbl["AdjR^2", nm])
  cid <- path_to[match(nm, path_to_name)]
  if (!is.na(cid)) r2_named[[as.character(cid)]] <<- r2v
  q2v <- tryCatch(as.numeric(s$validity$q2[nm]), error = function(e) NA)
  list(construct = nm, r2 = r2v, r2adj = r2a, q2 = q2v)
})

# ---- Indirect effects: every from->...->to with an intermediate, via specific_effect_significance ----
indirect <- list()
adj <- matrix(FALSE, k, k, dimnames = list(construct_names, construct_names))
for (e in seq_along(path_from_name)) adj[path_from_name[e], path_to_name[e]] <- TRUE
for (a in construct_names) for (z in construct_names) {
  if (a == z) next
  mids <- construct_names[adj[a, ] & adj[, z]]
  for (m in mids) {
    sig <- tryCatch(
      specific_effect_significance(bo, from = a, through = m, to = z, alpha = 0.05),
      error = function(e) NULL)
    if (!is.null(sig)) {
      indirect[[length(indirect) + 1]] <- list(
        path = paste0(a, " \u2192 ", m, " \u2192 ", z),
        est = as.numeric(sig["Original Est."]),
        se = as.numeric(sig["Bootstrap SD"]),
        ciLower = as.numeric(sig["2.5% CI"]),
        ciUpper = as.numeric(sig["97.5% CI"]),
        t = as.numeric(sig["T Stat."]),
        p = 2 * pnorm(-abs(as.numeric(sig["T Stat."])))
      )
    }
  }
}

list(
  outer = outer,
  reliability = reliability,
  htmt = list(labels = as.character(construct_names), cells = htmt_cells),
  structural = structural,
  quality = quality,
  indirect = indirect,
  estimates = list(
    paths = estimate_paths,
    loadings = loadings_named,
    r2 = r2_named
  )
)
`

/** Listwise-delete rows where any indicator is not a finite number. */
function listwise(data: Dataset, items: string[]): Record<string, unknown>[] {
  return data.rows.filter((row) =>
    items.every((col) => typeof row[col] === 'number' && Number.isFinite(row[col] as number)),
  )
}

/** seminr `composite("Name", multi_items(...), weights=...)` source line per construct. */
function measurementLine(c: Construct): string {
  const items = `c(${c.items.map((it) => `"${it}"`).join(', ')})`
  const wt = c.mode === 'formative' ? ', weights = mode_B' : ', weights = mode_A'
  return `composite("${c.name}", ${items}${wt})`
}

/** seminr `paths(from="A", to="B")` source line per edge. */
function structuralLine(from: string, to: string): string {
  return `paths(from = "${from}", to = "${to}")`
}

export async function runPlsSem(
  engine: Engine,
  data: Dataset,
  setup: TestSetup,
  onProgress?: RunProgress,
): Promise<PlsSemResult> {
  const constructs = setup.constructs ?? []
  const paths: StructuralPath[] = setup.paths ?? []
  const byId = new Map(constructs.map((c) => [c.id, c]))

  const allItems = [...new Set(constructs.flatMap((c) => c.items))]
  const rows = listwise(data, allItems)
  const n = rows.length
  const item_cols_flat = allItems.flatMap((col) => rows.map((r) => r[col] as number))

  const nboot = Number(setup.options['nboot'] ?? 5000)
  const fromName = (id: number) => byId.get(id)?.name ?? String(id)

  onProgress?.({ message: `Bootstrapping PLS-SEM (${nboot.toLocaleString()} resamples)…`, elapsedMs: 0 })

  const env = {
    item_cols_flat,
    all_items: allItems,
    n,
    mm_lines: constructs.map(measurementLine),
    sm_lines: paths.map((p) => structuralLine(fromName(p.from), fromName(p.to))),
    path_from: paths.map((p) => p.from),
    path_to: paths.map((p) => p.to),
    path_from_name: paths.map((p) => fromName(p.from)),
    path_to_name: paths.map((p) => fromName(p.to)),
    nboot,
    seed: 20260620,
    formative_names: constructs.filter((c) => c.mode === 'formative').map((c) => c.name),
  }

  return engine.runJson<PlsSemResult>(R_STATS(MAKECLUSTER_SHIM), env)
}
```

- [ ] **Step 4: Run, verify PASS**
  Command: `npx vitest run src/lib/stats/plsSem.test.ts`
  Expected: PASS — both `it` blocks green (reflective reference values within 3 dp; mixed model: `Expectation.ave === null`, formative rows carry `weight`/`vif`). The `mobi.csv` fixture must exist at `tests/e2e/fixtures/mobi.csv` (created in Step 3's prerequisite — if absent, generate it via `library(seminr); write.csv(mobi, 'tests/e2e/fixtures/mobi.csv', row.names = FALSE)` under native R and commit it alongside).

- [ ] **Step 5: Commit**
```
git add src/lib/stats/plsSem.ts src/lib/stats/plsSem.test.ts tests/e2e/fixtures/mobi.csv
git commit -m "feat(sem-b): runPlsSem — seminr PLS-SEM engine (estimate_pls + bootstrap_model serial-shim, reliability reorder, HTMT/f²/Q²/indirect, formative branch)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
```

---

### Task 26: `buildPlsSem` — PLS-SEM CardContent builder (reorder reliability, HTMT matrix, formative suppression)
**Files:**
- Create `src/lib/results/buildPlsSem.ts`
- Test `src/lib/results/buildPlsSem.test.ts`

**Interfaces:** Consumes: `PlsSemResult` (`src/lib/stats/plsSem`), `TestSpec`/`figuresOf` (`src/lib/registry/types`), `CardContent`/`BuiltTable` (`src/lib/results/builders`), `MatrixTable` (`src/lib/results/types`), `f01` (`src/lib/format/apa`) · Produces: `buildPlsSem(spec, r)` registered as the `pls-sem` BUILDER

- [ ] **Step 1: Write the failing test** (full file — pure builder, no WebR; a synthetic `PlsSemResult` fixture exercises both reflective and formative rows)

```ts
import { describe, it, expect } from 'vitest'
import { buildPlsSem } from './buildPlsSem'
import type { PlsSemResult } from '../stats/plsSem'
import type { TestSpec } from '../registry/types'

const SPEC = {
  id: 'pls-sem',
  name: 'PLS-SEM',
  tables: [
    { id: 'outer-model', title: 'Outer model', columns: [] },
    { id: 'reliability', title: 'Reliability & convergent validity', columns: [] },
    { id: 'htmt', title: 'Discriminant validity (HTMT)', columns: [] },
    { id: 'structural', title: 'Structural paths', columns: [] },
    { id: 'structural-quality', title: 'Structural model quality', columns: [] },
    { id: 'indirect-effects', title: 'Indirect effects', columns: [] },
  ],
  figures: [{ type: 'path-diagram', caption: 'Path diagram', file: 'figure_path-diagram' }],
  howToRead: 'HOWTO',
  apaTemplate: 'APA',
  tableNote: null,
} as unknown as TestSpec

const R: PlsSemResult = {
  outer: [
    { construct: 'Image', item: 'IMAG1', weight: null, loading: 0.81, vif: null, t: 12.3, p: 0.0001 },
    { construct: 'Expectation', item: 'CUEX1', weight: 0.44, loading: null, vif: 1.9, t: 3.1, p: 0.002 },
  ],
  reliability: [
    { construct: 'Image', alpha: 0.77, rhoA: 0.78, cr: 0.83, ave: 0.50 },
    { construct: 'Expectation', alpha: 0.55, rhoA: 0.60, cr: 0.78, ave: null },
  ],
  htmt: { labels: ['Image', 'Expectation'], cells: [[null, null], [0.41, null]] },
  structural: [
    { path: 'Image → Expectation', beta: 0.30, t: 4.1, p: 0.001, ciLower: 0.16, ciUpper: 0.44, fSquare: 0.10 },
  ],
  quality: [
    { construct: 'Expectation', r2: 0.092, r2adj: 0.090, q2: 0.05 },
  ],
  indirect: [
    { path: 'Image → Expectation → Satisfaction', est: 0.03, se: 0.02, ciLower: 0.01, ciUpper: 0.07, t: 2.0, p: 0.04 },
  ],
  estimates: { paths: [{ from: 1, to: 2, beta: 0.30 }], loadings: { 'Image  ->  IMAG1': 0.81 }, r2: { 2: 0.092 } },
}

describe('buildPlsSem', () => {
  it('reorders reliability to α / ρ_A / CR / AVE and suppresses AVE for formative constructs', () => {
    const c = buildPlsSem(SPEC, R)
    const rel = c.tables.find((t) => t.spec.id === 'reliability')!
    expect(Object.keys(rel.rows[0])).toEqual(['construct', 'alpha', 'rhoA', 'cr', 'ave'])
    expect(rel.rows[0].construct).toBe('Image')
    expect(rel.rows[0].alpha).toBe('.77')
    expect(rel.rows[0].ave).toBe('.50')
    // formative Expectation: AVE rendered as an em-dash, not a number
    expect(rel.rows[1].ave).toBe('—')
  })

  it('renders outer model with loading OR weight (+ VIF) per indicator', () => {
    const c = buildPlsSem(SPEC, R)
    const outer = c.tables.find((t) => t.spec.id === 'outer-model')!
    expect(outer.rows[0].loading).toBe('.81')
    expect(outer.rows[0].weight).toBe('—')
    expect(outer.rows[1].weight).toBe('.44')
    expect(outer.rows[1].loading).toBe('—')
    expect(outer.rows[1].vif).toBe('1.90')
  })

  it('renders HTMT as a lowerOnly matrix table', () => {
    const c = buildPlsSem(SPEC, R)
    const htmt = c.tables.find((t) => t.matrix?.id === 'htmt')!
    expect(htmt.matrix!.kind).toBe('matrix')
    expect(htmt.matrix!.lowerOnly).toBe(true)
    expect(htmt.matrix!.rowLabels).toEqual(['Image', 'Expectation'])
    expect(htmt.matrix!.cells[1][0]).toBe('.41')
    expect(htmt.matrix!.cells[0][1]).toBeNull()
  })

  it('renders structural paths with f² and the quality table with R²/adj/Q²', () => {
    const c = buildPlsSem(SPEC, R)
    const struct = c.tables.find((t) => t.spec.id === 'structural')!
    expect(struct.rows[0].path).toBe('Image → Expectation')
    expect(struct.rows[0].beta).toBe('.30')
    expect(struct.rows[0].fSquare).toBe('0.10')
    expect(struct.rows[0].ci).toBe('[.16, .44]')
    const qual = c.tables.find((t) => t.spec.id === 'structural-quality')!
    expect(qual.rows[0].r2).toBe('.09')
    expect(qual.rows[0].q2).toBe('0.05')
  })

  it('emits the indirect-effects table only when present', () => {
    const c = buildPlsSem(SPEC, R)
    const ind = c.tables.find((t) => t.spec.id === 'indirect-effects')!
    expect(ind.rows[0].path).toBe('Image → Expectation → Satisfaction')
    expect(ind.rows[0].ci).toBe('[.01, .07]')
    // dropping indirect removes the table
    const c2 = buildPlsSem(SPEC, { ...R, indirect: [] })
    expect(c2.tables.find((t) => t.spec.id === 'indirect-effects')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run it, verify FAIL**
  Command: `npx vitest run src/lib/results/buildPlsSem.test.ts`
  Expected: FAIL — `Error: Failed to resolve import "./buildPlsSem"` (module does not exist yet).

- [ ] **Step 3: Implement** (full file `src/lib/results/buildPlsSem.ts`)

```ts
import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { PlsSemResult } from '../stats/plsSem'
import type { MatrixTable } from './types'
import type { CardContent, BuiltTable } from './builders'
import { f01 } from '../format/apa'

const DASH = '—'
/** Correlation-scaled value to 2 leading-dot dp, or em-dash when null/NA. */
const fc = (v: unknown): string => (v == null || !Number.isFinite(Number(v)) ? DASH : f01(Number(v)))
/** Plain 2-dp value (f², VIF, Q², SE — these carry a leading 0). */
const f2 = (v: unknown): string => (v == null || !Number.isFinite(Number(v)) ? DASH : Number(v).toFixed(2))
const fp = (v: unknown): string => {
  const n = Number(v)
  if (!Number.isFinite(n)) return DASH
  return n < 0.001 ? '< .001' : f01(n, 3)
}
const ci = (lo: unknown, hi: unknown): string => `[${fc(lo)}, ${fc(hi)}]`

export function buildPlsSem(spec: TestSpec, r: PlsSemResult): CardContent {
  const tableById = (id: string) => spec.tables.find((t) => t.id === id)!

  // T1: Outer model — Construct → Item · loading/weight · VIF · t · p
  const t1rows = r.outer.map((row) => ({
    construct: String(row.construct),
    item: String(row.item),
    loading: fc(row.loading),
    weight: fc(row.weight),
    vif: f2(row.vif),
    t: f2(row.t),
    p: fp(row.p),
  }))

  // T2: Reliability & convergent validity — Construct · α · ρ_A · CR · AVE (AVE em-dash for formative)
  const t2rows = r.reliability.map((row) => ({
    construct: String(row.construct),
    alpha: fc(row.alpha),
    rhoA: fc(row.rhoA),
    cr: fc(row.cr),
    ave: fc(row.ave),
  }))

  const tables: BuiltTable[] = [
    { spec: tableById('outer-model'), rows: t1rows },
    { spec: tableById('reliability'), rows: t2rows },
  ]

  // T3: HTMT matrix (lowerOnly) — only when ≥ 2 constructs
  const labels = r.htmt.labels
  if (labels.length >= 2) {
    const htmtCells: (string | null)[][] = r.htmt.cells.map((rowCells, i) =>
      rowCells.map((val, j) => (j >= i || val == null ? null : f01(Number(val)))),
    )
    const htmtMatrix: MatrixTable = {
      kind: 'matrix',
      id: 'htmt',
      caption: tableById('htmt').title,
      rowLabels: labels,
      colLabels: labels,
      cells: htmtCells,
      lowerOnly: true,
    }
    tables.push({ spec: tableById('htmt'), rows: [], matrix: htmtMatrix })
  }

  // T4: Structural paths — Path · β · t · p · 95% CI · f²
  const t4rows = r.structural.map((row) => ({
    path: String(row.path),
    beta: fc(row.beta),
    t: f2(row.t),
    p: fp(row.p),
    ci: ci(row.ciLower, row.ciUpper),
    fSquare: f2(row.fSquare),
  }))
  tables.push({ spec: tableById('structural'), rows: t4rows })

  // T5: Structural quality — Construct · R² · R²adj · Q²
  const t5rows = r.quality.map((row) => ({
    construct: String(row.construct),
    r2: fc(row.r2),
    r2adj: fc(row.r2adj),
    q2: f2(row.q2),
  }))
  tables.push({ spec: tableById('structural-quality'), rows: t5rows })

  // T6: Indirect effects — Path · est · SE · 95% CI · p (only when chained paths exist)
  if (r.indirect && r.indirect.length > 0) {
    const t6rows = r.indirect.map((row) => ({
      path: String(row.path),
      est: fc(row.est),
      se: f2(row.se),
      ci: ci(row.ciLower, row.ciUpper),
      p: fp(row.p),
    }))
    tables.push({ spec: tableById('indirect-effects'), rows: t6rows })
  }

  // Figure — the annotated path diagram is rasterized in ResultsScreen.download() (captureNode),
  // NOT through CardContent.figures[].png; carry an empty PNG placeholder so the figure caption renders.
  const fig = figuresOf(spec)[0]
  const figures: CardContent['figures'] = [
    { caption: fig.caption, type: fig.type, file: fig.file, png: new Uint8Array() },
  ]

  return {
    tables,
    note: spec.tableNote ?? null,
    figures,
    howToRead: spec.howToRead,
    apa: spec.apaTemplate,
    nExcluded: 0,
  }
}
```

- [ ] **Step 4: Run, verify PASS**
  Command: `npx vitest run src/lib/results/buildPlsSem.test.ts`
  Expected: PASS — all 5 `it` blocks green (reliability key order `['construct','alpha','rhoA','cr','ave']`, formative AVE = `—`, HTMT lowerOnly matrix, structural f²/CI, indirect table presence-gated).

- [ ] **Step 5: Commit**
```
git add src/lib/results/buildPlsSem.ts src/lib/results/buildPlsSem.test.ts
git commit -m "feat(sem-b): buildPlsSem — PLS-SEM CardContent (reliability reorder α/ρ_A/CR/AVE, HTMT matrix, f²/Q², formative AVE suppression, indirect presence-gate)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
```

---

### Task 27: `pls-sem` emitter + packages (seminr reproducible R) + register runner/builder
**Files:**
- Modify `src/lib/export/rScript/emitters/latent.ts` (add `'pls-sem'` key to `latentEmitters` at the end of the object; add `'pls-sem'` to `latentPackages`)
- Modify `src/lib/results/builders.ts` (import + register in `RUNNERS` and `BUILDERS`)
- Test `src/lib/export/rScript/emitters/latent.test.ts` (create — string-shape assertions on the emitted R; no WebR)

**Interfaces:** Consumes: `Emitter` (`src/lib/export/rScript/emitters/index`), `Construct`/`StructuralPath` (`src/state/session`), `MAKECLUSTER_SHIM` (`src/lib/webr/parallelShim`), `runPlsSem`/`PlsSemResult` (`src/lib/stats/plsSem`), `buildPlsSem` (`src/lib/results/buildPlsSem`) · Produces: `latentEmitters['pls-sem']`, `latentPackages['pls-sem']`, `RUNNERS['pls-sem']`, `BUILDERS['pls-sem']`

- [ ] **Step 1: Write the failing test** (full file `src/lib/export/rScript/emitters/latent.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import { latentEmitters, latentPackages } from './latent'
import type { TestSpec } from '../../../registry/types'
import type { TestSetup } from '../../../../state/session'

const SPEC = { id: 'pls-sem', name: 'PLS-SEM' } as unknown as TestSpec

const SETUP: TestSetup = {
  roles: {},
  options: { nboot: 5000 },
  props: {},
  blocked: null,
  modelKind: 'latent',
  constructs: [
    { id: 1, name: 'Image', mode: 'reflective', items: ['IMAG1', 'IMAG2'] },
    { id: 2, name: 'Expectation', mode: 'formative', items: ['CUEX1', 'CUEX2'] },
    { id: 3, name: 'Satisfaction', mode: 'reflective', items: ['CUSA1', 'CUSA2'] },
  ],
  paths: [
    { from: 1, to: 2 },
    { from: 1, to: 3 },
    { from: 2, to: 3 },
  ],
}

describe('pls-sem emitter', () => {
  it('emits a reproducible seminr block with the serial-cluster shim and reordered reliability', () => {
    const R = latentEmitters['pls-sem'](SPEC, SETUP, { columns: [], rows: [] } as never)
    // serial shim present (seminr bootstrap forces a PSOCK cluster)
    expect(R).toContain('telosSerialCluster')
    // measurement model: reflective = mode_A, formative = mode_B
    expect(R).toContain('composite("Image", c("IMAG1", "IMAG2"), weights = mode_A)')
    expect(R).toContain('composite("Expectation", c("CUEX1", "CUEX2"), weights = mode_B)')
    // structural paths by NAME (ids are app-only)
    expect(R).toContain('paths(from = "Image", to = "Expectation")')
    expect(R).toContain('paths(from = "Expectation", to = "Satisfaction")')
    // estimate + bootstrap with the production count + percentile CI + serial cores
    expect(R).toContain('estimate_pls(data = d, measurement_model = mm, structural_model = sm)')
    expect(R).toContain('nboot = 5000')
    expect(R).toContain('cores = 1')
    // reliability reorder note + the four display columns
    expect(R).toContain('alpha')
    expect(R).toContain('rhoA')
    expect(R).toContain('rhoC')
    expect(R).toContain('AVE')
    // gc() around the heavy bootstrap
    expect(R).toContain('gc()')
    // indirect via specific_effect_significance
    expect(R).toContain('specific_effect_significance')
  })

  it('handles an empty model gracefully', () => {
    const R = latentEmitters['pls-sem'](SPEC, { ...SETUP, constructs: [] }, { columns: [], rows: [] } as never)
    expect(R).toContain('# No constructs defined')
  })

  it('declares the seminr package set', () => {
    expect(latentPackages['pls-sem']).toEqual(['seminr'])
  })
})
```

- [ ] **Step 2: Run it, verify FAIL**
  Command: `npx vitest run src/lib/export/rScript/emitters/latent.test.ts`
  Expected: FAIL — `latentEmitters['pls-sem'] is not a function` (key not yet added).

- [ ] **Step 3: Implement**

3a. In `src/lib/export/rScript/emitters/latent.ts`, add the import at the top of the file (after line 1, `import type { Emitter } from './index'`):

```ts
import type { Construct } from '../../../../state/session'
import { MAKECLUSTER_SHIM } from '../../../webr/parallelShim'
```

3b. In `src/lib/export/rScript/emitters/latent.ts`, add the `'pls-sem'` emitter as a new key inside the `latentEmitters` object, immediately before the closing `}` of the object (i.e. after the `'pca'` emitter's trailing `},` on line 399):

```ts
  // seminr PLS-SEM: estimate_pls + bootstrap_model (serial-cluster shim — WASM has no PSOCK sockets).
  // Reliability raw order is alpha/rhoC/AVE/rhoA → printed reordered to α/ρ_A/CR/AVE.
  // Reflective = composite(..., weights = mode_A); formative = mode_B (weights + VIF, AVE suppressed).
  // Bootstrap CI = percentile (seminr default); indirect via specific_effect_significance.
  'pls-sem': (_spec, setup) => {
    const constructs: Construct[] = (setup.constructs ?? []) as Construct[]
    if (constructs.length === 0) return '# No constructs defined — nothing to run for PLS-SEM.'
    const byId = new Map(constructs.map((c) => [c.id, c.name]))
    const paths = setup.paths ?? []
    const nboot = Number(setup.options['nboot'] ?? 5000)

    const mmLines = constructs
      .map((c) => {
        const items = `c(${c.items.map((it) => `"${it}"`).join(', ')})`
        const wt = c.mode === 'formative' ? 'mode_B' : 'mode_A'
        return `  composite("${c.name}", ${items}, weights = ${wt})`
      })
      .join(',\n')
    const smLines = paths
      .map((p) => `  paths(from = "${byId.get(p.from) ?? p.from}", to = "${byId.get(p.to) ?? p.to}")`)
      .join(',\n')
    const formativeR = `c(${constructs.filter((c) => c.mode === 'formative').map((c) => `"${c.name}"`).join(', ')})`

    const lines: string[] = [
      '# ---- PLS-SEM via seminr (estimate_pls + bootstrap_model) ----',
      '# WebR/WASM has no PSOCK sockets — install the serial-cluster shim before seminr bootstraps.',
      MAKECLUSTER_SHIM,
      'library(seminr)',
      '',
      '# Measurement model (reflective = mode_A; formative = mode_B)',
      `mm <- constructs(`,
      mmLines,
      `)`,
      '',
      '# Structural model (paths by construct name)',
      `sm <- relationships(`,
      smLines,
      `)`,
      '',
      '# Estimate + bootstrap (percentile CI; serial cores under the shim)',
      'gc()',
      'pls <- estimate_pls(data = d, measurement_model = mm, structural_model = sm)',
      's <- summary(pls)',
      'set.seed(20260620)',
      `bo <- bootstrap_model(seminr_model = pls, nboot = ${nboot}, cores = 1)`,
      'sb <- summary(bo)',
      'gc()',
      '',
      '# Table 1: Outer model (loadings/weights + t/p)',
      'cat("\\n--- Table 1: Outer model ---\\n")',
      'print(round(sb$bootstrapped_loadings, 3))',
      'print(round(sb$bootstrapped_weights, 3))',
      '',
      '# Table 2: Reliability — raw seminr order alpha/rhoC/AVE/rhoA → display α / ρ_A / CR / AVE',
      'cat("\\n--- Table 2: Reliability & convergent validity (alpha / rhoA / rhoC=CR / AVE) ---\\n")',
      'rel <- s$reliability[, c("alpha", "rhoA", "rhoC", "AVE"), drop = FALSE]',
      `formative_names <- ${formativeR}`,
      'if (length(formative_names)) rel[rownames(rel) %in% formative_names, "AVE"] <- NA',
      'print(round(rel, 4))',
      '',
      '# Table 3: Discriminant validity (HTMT)',
      'cat("\\n--- Table 3: HTMT ---\\n")',
      'print(round(s$validity$htmt, 3))',
      '',
      '# Table 4: Structural paths (β + t/p + 95% CI + f²)',
      'cat("\\n--- Table 4: Structural paths ---\\n")',
      'print(round(sb$bootstrapped_paths, 4))',
      'cat("\\n--- f-squared ---\\n")',
      'print(round(s$fSquare, 4))',
      '',
      '# Table 5: Structural quality (R² / R²adj / Q²)',
      'cat("\\n--- Table 5: Structural quality (R^2 / AdjR^2) ---\\n")',
      'print(round(s$paths[c("R^2", "AdjR^2"), , drop = FALSE], 4))',
      '',
      '# Table 6: Indirect effects (specific_effect_significance over each mediated triple)',
      'cat("\\n--- Table 6: Indirect effects ---\\n")',
      'cn <- pls$constructs',
      'adj <- matrix(FALSE, length(cn), length(cn), dimnames = list(cn, cn))',
    ]
    paths.forEach((p) => {
      lines.push(`adj["${byId.get(p.from) ?? p.from}", "${byId.get(p.to) ?? p.to}"] <- TRUE`)
    })
    lines.push(
      'for (a in cn) for (z in cn) if (a != z) {',
      '  for (m in cn[adj[a, ] & adj[, z]]) {',
      '    sig <- tryCatch(specific_effect_significance(bo, from = a, through = m, to = z, alpha = 0.05),',
      '                    error = function(e) NULL)',
      '    if (!is.null(sig)) { cat(sprintf("  %s -> %s -> %s: ", a, m, z)); print(round(sig, 4)) }',
      '  }',
      '}',
      '',
      '# Figure: path diagram — semPaths stand-in (the app exports the annotated SVG via html-to-image)',
      'cat("\\n--- Figure: PLS path diagram (semPaths reproducible stand-in) ---\\n")',
      'tryCatch(print(plot(pls)), error = function(e) cat("(diagram skipped:", conditionMessage(e), ")\\n"))',
    )
    return lines.join('\n')
  },
```

3c. In `src/lib/export/rScript/emitters/latent.ts`, add the package entry to `latentPackages` (inside the object literal at the bottom of the file, after the `'pca'` line on line 407):

```ts
  'pls-sem': ['seminr'],
```

3d. In `src/lib/results/builders.ts`, add imports (after line 95, the `buildPca` import):

```ts
import { runPlsSem, type PlsSemResult } from '../stats/plsSem'
import { buildPlsSem } from './buildPlsSem'
```

3e. In `src/lib/results/builders.ts`, register the runner in `RUNNERS` (after the `'pca'` runner, line 215's closing `},`):

```ts
  'pls-sem': (engine, ds, setup) => runPlsSem(engine, ds, setup),
```

3f. In `src/lib/results/builders.ts`, register the builder in `BUILDERS` (after the `'pca'` builder, line 263):

```ts
  'pls-sem': (spec, result) => buildPlsSem(spec, result as PlsSemResult),
```

- [ ] **Step 4: Run, verify PASS**
  Command: `npx vitest run src/lib/export/rScript/emitters/latent.test.ts && npx tsc --noEmit`
  Expected: emitter test green (3 `it` blocks: serial shim + mode_A/mode_B + paths-by-name + nboot 5000 + reorder columns + specific_effect_significance; empty-model guard; `latentPackages['pls-sem']` = `['seminr']`); `tsc` exits 0 (RUNNERS/BUILDERS wiring type-checks).

- [ ] **Step 5: Commit**
```
git add src/lib/export/rScript/emitters/latent.ts src/lib/export/rScript/emitters/latent.test.ts src/lib/results/builders.ts
git commit -m "feat(sem-b): pls-sem emitter (seminr serial-shim block, reliability reorder, indirect triples) + register runner/builder

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
```

---

### Task 28: `pls-sem` native-R gate entry (runs-in-r) — production resample parity on seminr `mobi`
**Files:**
- Modify `src/lib/export/rScript/runs-in-r.test.ts` (add a `pls-sem` Rep to the `REPS` array, in the latent/SEM family block after the `composite-reliability` entry near line 159; the `mk` helper does not carry `constructs`/`paths`, so add a full literal Rep like the `ave` entry)

**Interfaces:** Consumes: the `pls-sem` emitter + `latentPackages['pls-sem']` (Task 27), the `mobi.csv` fixture (Task 25), `SPECS['pls-sem']` (must be registered — see prerequisite note) · Produces: a native-R exit-0 + key-number gate for `pls-sem`

> **Prerequisite:** this gate runs the REAL production pipeline (`emitRScript([id], …, SPECS, ds)`), so `SPECS['pls-sem']` must already be registered in the catalog (Unit 5/10) before this test can pass. If Unit 5 has not yet flipped `pls-sem` to `available`, this task's Step 4 will skip the entry under the existing `describe.skipIf(!hasR)` only if `SPECS['pls-sem']` is undefined → guard the Rep with a registration check (below) so the suite stays green until the catalog lands, then the entry activates automatically.

- [ ] **Step 1: Write the failing test** (add this Rep to the `REPS` array, immediately after the `composite-reliability` literal Rep that closes near line 159)

```ts
  // pls-sem: 3 reflective constructs from the seminr 'mobi' example; nboot reduced to 300 for gate time.
  // native-R verified 2026-06-20 (seminr 2.5.0): reliability rhoC Image≈0.833, Satisfaction≈0.871;
  // R^2 Satisfaction≈0.616; HTMT + bootstrapped paths reach stdout.
  ...(SPECS['pls-sem']
    ? [{
        id: 'pls-sem',
        fixture: 'mobi.csv',
        setup: {
          roles: {},
          options: { nboot: 300 },
          props: {},
          blocked: null,
          modelKind: 'latent' as const,
          constructs: [
            { id: 1, name: 'Image', mode: 'reflective' as const, items: ['IMAG1', 'IMAG2', 'IMAG3', 'IMAG4', 'IMAG5'] },
            { id: 2, name: 'Expectation', mode: 'reflective' as const, items: ['CUEX1', 'CUEX2', 'CUEX3'] },
            { id: 3, name: 'Satisfaction', mode: 'reflective' as const, items: ['CUSA1', 'CUSA2', 'CUSA3'] },
          ],
          paths: [
            { from: 1, to: 2 },
            { from: 1, to: 3 },
            { from: 2, to: 3 },
          ],
        },
        expect: ['Table 2: Reliability', 'Table 3: HTMT', 'Table 4: Structural paths'],
      } as Rep]
    : []),
```

- [ ] **Step 2: Run it, verify FAIL**
  Command: `npx vitest run src/lib/export/rScript/runs-in-r.test.ts -t pls-sem`
  Expected: with `SPECS['pls-sem']` registered (Task 27/Unit-5 landed) the case appears and FAILS first because the emitted R has not been native-verified end-to-end (or `mobi.csv` missing) — the `execSync('Rscript analysis.R')` throws / a needle is absent. (If `SPECS['pls-sem']` is still undefined, the spread is `[]`, the entry is absent, and `-t pls-sem` reports "No test found" — register the spec first.)

- [ ] **Step 3: Implement** — make the emitted R actually run clean under native R. No new test code; the work is ensuring (a) `mobi.csv` is present at `tests/e2e/fixtures/mobi.csv` (Task 25 committed it), and (b) the emitted block from Task 27 executes under native `Rscript`. Run the production emitter once and verify by hand, fixing any divergence in the Task-27 emitter (column names, `s$paths` row labels) so stdout contains the three needles:

```bash
node -e "
const { readFileSync } = require('node:fs');
const { execSync } = require('node:child_process');
const { parseCsv } = require('./src/lib/data/parseCsv.ts');
" # (illustrative — in practice run the vitest case below; it emits via the real pipeline)
```

The concrete implementation step is: run the gate, read the native `Rscript` stderr on failure, and patch the Task-27 emitter strings (e.g. confirm `s$paths` carries rows `"R^2"`/`"AdjR^2"` and `summary()$reliability` carries columns `alpha`/`rhoA`/`rhoC`/`AVE` for this seminr version) until the three needles print. No production code other than the Task-27 emitter is touched.

- [ ] **Step 4: Run, verify PASS**
  Command: `npx vitest run src/lib/export/rScript/runs-in-r.test.ts -t pls-sem`
  Expected: PASS on machines with `Rscript` (`pls-sem — runs in R + emits Table 2: Reliability, Table 3: HTMT, Table 4: Structural paths`); auto-skips where `Rscript` is absent (existing `describe.skipIf(!hasR)`). Runtime ≈ 30-60 s at `nboot = 300`.

- [ ] **Step 5: Commit**
```
git add src/lib/export/rScript/runs-in-r.test.ts
git commit -m "test(sem-b): pls-sem native-R gate — seminr mobi 3-construct model emits reliability/HTMT/structural under Rscript

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
```

---

### Task 29: Post-run estimates overlay on the canvas (β / loadings / R²)
**Files:**
- Modify `src/components/SemCanvas.tsx` (add the `estimates` overlay rendering inside `SemCanvasUI`; wire `running`/`estimates` props through `SemCanvas`).
- Create `src/components/SemCanvas.estimates.test.tsx` (Test).

**Interfaces:** Consumes: `SemCanvasUIProps` (`estimates?: CbSemResult['estimates']|null`, `running`, `modelKind`, `constructs`, `columns`, `paths`), `Construct` (`id:number`, `x?`, `y?`), `StructuralPath` (`from:number; to:number`), `CbSemResult.estimates` / `PlsSemResult.estimates` (`{ paths:Array<{from:number;to:number;beta:number}>; loadings:Record<string,number>; r2:Record<number,number> }`) · Produces: an annotated `<svg id={`figure-path-diagram-${testId}`}>` carrying `data-beta`/`data-loading`/`data-r2` text — the DOM node Task 30 rasters.

- [ ] **Step 1: Write the failing test** (show COMPLETE test code in a fenced block)

```tsx
// src/components/SemCanvas.estimates.test.tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SemCanvasUI, type SemCanvasUIProps } from './SemCanvas'
import type { Construct, StructuralPath } from '../state/session'
import type { CbSemResult } from '../lib/stats/cbSem'

const constructs: Construct[] = [
  { id: 1, name: 'Ability', items: ['x1', 'x2'], x: 60, y: 80 },
  { id: 2, name: 'Quality', items: ['x3', 'x4'], x: 320, y: 80 },
]
const paths: StructuralPath[] = [{ from: 1, to: 2 }]

const estimates: CbSemResult['estimates'] = {
  paths: [{ from: 1, to: 2, beta: 0.734 }],
  loadings: { x1: 0.81, x2: 0.77, x3: 0.69, x4: 0.9 },
  r2: { 2: 0.539 },
}

const base: SemCanvasUIProps = {
  constructs, columns: [], paths, modelKind: 'latent', mode: 'draw',
  estimates: null, running: false,
  onAddPath: () => {}, onRemovePath: () => {}, onMoveNode: () => {}, onSetMode: () => {},
}

describe('SemCanvasUI — post-run estimates overlay', () => {
  it('renders no estimate annotations when estimates is null', () => {
    const html = renderToStaticMarkup(<SemCanvasUI {...base} />)
    expect(html).not.toContain('data-beta')
    expect(html).not.toContain('data-loading')
    expect(html).not.toContain('data-r2')
  })

  it('annotates the structural path with the standardized β (2 dp)', () => {
    const html = renderToStaticMarkup(<SemCanvasUI {...base} estimates={estimates} />)
    expect(html).toContain('data-beta="1-2"')
    expect(html).toContain('β = .73') // leading-zero-stripped, 2 dp
  })

  it('annotates each measurement line with its standardized loading (2 dp)', () => {
    const html = renderToStaticMarkup(<SemCanvasUI {...base} estimates={estimates} />)
    expect(html).toContain('data-loading="x1"')
    expect(html).toContain('.81')
    expect(html).toContain('data-loading="x4"')
    expect(html).toContain('.90')
  })

  it('annotates endogenous ovals with R² (2 dp) and skips exogenous ones', () => {
    const html = renderToStaticMarkup(<SemCanvasUI {...base} estimates={estimates} />)
    expect(html).toContain('data-r2="2"')
    expect(html).toContain('R² = .54')
    expect(html).not.toContain('data-r2="1"') // construct 1 has no r2 entry
  })

  it('keys the exported diagram svg by testId-free figure id and stays renderToStaticMarkup-pure', () => {
    const html = renderToStaticMarkup(<SemCanvasUI {...base} estimates={estimates} />)
    expect(html).toContain('id="figure-path-diagram-')
  })
})
```

- [ ] **Step 2: Run it, verify FAIL** (exact command + expected failure)

```
npx vitest run src/components/SemCanvas.estimates.test.tsx
```
Expected: FAIL — `SemCanvasUI` (from Unit 3a/3b) does not yet emit any `data-beta`/`data-loading`/`data-r2` annotations, so the assertions on `'data-beta="1-2"'`, `'β = .73'`, `'.81'`, `'data-r2="2"'` fail (and the null-estimates case may already pass).

- [ ] **Step 3: Implement** (show COMPLETE code)

Add a single pure formatter + an `<EstimateOverlay>` group rendered inside `SemCanvasUI`'s `<svg id={`figure-path-diagram-${testId}`}>`, after the base nodes/paths/measurement-lines. Source positions from the same `nodePos(c)`/`midpoint` geometry the base render already uses (oval centers from `c.x`/`c.y`; measurement-line midpoints from oval-to-item-box geometry). The overlay is gated on `estimates != null`.

```tsx
// src/components/SemCanvas.tsx — add near the top-level helpers (after imports / existing format helpers)

import type { CbSemResult } from '../lib/stats/cbSem'

/** APA leading-zero-stripped, fixed 2-dp formatter for in-[-1,1] coefficients (β, loadings). */
function fmtCoef(v: number): string {
  const s = Math.abs(v).toFixed(2).replace(/^0/, '')
  return (v < 0 ? '-' : '') + s
}
/** R² is reported 2-dp, leading zero stripped, never negative-signed in display. */
function fmtR2(v: number): string {
  return v.toFixed(2).replace(/^0/, '')
}

type Estimates = CbSemResult['estimates']

/**
 * Post-run annotations layered over the live diagram (D5): β on each structural path,
 * standardized loading on each measurement line, R² on each endogenous oval.
 * Pure: positions come from the same geometry the base render uses, passed in by SemCanvasUI.
 * Each annotation carries a data-* key so the export raster + tests can target it deterministically.
 */
function EstimateOverlay({
  estimates, nodeCenter, lineMid, constructs, modelKind,
}: {
  estimates: Estimates
  nodeCenter: (id: number) => { x: number; y: number }
  lineMid: (constructId: number, item: string) => { x: number; y: number } | null
  constructs: { id: number; items: string[] }[]
  modelKind: 'latent' | 'path'
}) {
  const betaLabels = estimates.paths.map((p) => {
    const a = nodeCenter(p.from); const b = nodeCenter(p.to)
    return (
      <text
        key={`b-${p.from}-${p.to}`}
        data-beta={`${p.from}-${p.to}`}
        x={(a.x + b.x) / 2}
        y={(a.y + b.y) / 2 - 6}
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
        fill="#185fa5"
        style={{ paintOrder: 'stroke', stroke: '#f0efe9', strokeWidth: 3 }}
      >
        {`β = ${fmtCoef(p.beta)}`}
      </text>
    )
  })

  // Loadings only annotate measurement lines (latent mode); path mode has no items.
  const loadingLabels = modelKind === 'path'
    ? []
    : constructs.flatMap((c) =>
        c.items.flatMap((item) => {
          const lv = estimates.loadings[item]
          const mid = lineMid(c.id, item)
          if (lv === undefined || !mid) return []
          return [
            <text
              key={`l-${item}`}
              data-loading={item}
              x={mid.x}
              y={mid.y - 4}
              textAnchor="middle"
              fontSize={10}
              fill="#185fa5"
              style={{ paintOrder: 'stroke', stroke: '#f0efe9', strokeWidth: 3 }}
            >
              {fmtCoef(lv)}
            </text>,
          ]
        }),
      )

  const r2Labels = constructs.flatMap((c) => {
    const r = estimates.r2[c.id]
    if (r === undefined) return [] // exogenous construct: no R²
    const ctr = nodeCenter(c.id)
    return [
      <text
        key={`r2-${c.id}`}
        data-r2={String(c.id)}
        x={ctr.x}
        y={ctr.y + 14}
        textAnchor="middle"
        fontSize={10}
        fontStyle="italic"
        fill="#185fa5"
        style={{ paintOrder: 'stroke', stroke: '#f0efe9', strokeWidth: 3 }}
      >
        {`R² = ${fmtR2(r)}`}
      </text>,
    ]
  })

  return (
    <g data-overlay="estimates">
      {betaLabels}
      {loadingLabels}
      {r2Labels}
    </g>
  )
}
```

Then, inside `SemCanvasUI`'s JSX, after the existing nodes/paths/measurement-lines are drawn but still inside the same `<svg id={`figure-path-diagram-${testId}`}>`, render the overlay. Reuse the geometry helpers the base render already defines (`nodeCenter`, the per-(construct,item) measurement-line midpoint). If Unit 3a/3b named them differently, alias them at this call site — do not duplicate the geometry:

```tsx
// inside SemCanvasUI's return, as the LAST child of the diagram <svg> (so labels sit on top):
{estimates && (
  <EstimateOverlay
    estimates={estimates}
    nodeCenter={nodeCenter}
    lineMid={lineMid}
    constructs={modelKind === 'path' ? [] : constructs.map((c) => ({ id: c.id, items: c.items }))}
    modelKind={modelKind}
  />
)}
```

And ensure the connected `SemCanvas` forwards the post-run estimates + running flag from the session run state (results screen drives this; in config/draw state `estimates` stays `null`):

```tsx
// inside the connected SemCanvas({ testId }) wiring — add to the SemCanvasUI props:
estimates={(s.runs[testId]?.result as { estimates?: Estimates } | undefined)?.estimates ?? null}
running={s.runStatus === 'running'}
```

- [ ] **Step 4: Run, verify PASS** (exact command + expected)

```
npx vitest run src/components/SemCanvas.estimates.test.tsx && npx tsc --noEmit
```
Expected: 5/5 pass; `tsc` reports 0 errors.

- [ ] **Step 5: Commit** (git add + conventional-commit message)

```
git add src/components/SemCanvas.tsx src/components/SemCanvas.estimates.test.tsx
git commit -m "feat(sem-b): post-run β/loading/R² estimates overlay on the AMOS canvas

EstimateOverlay layers fitted standardized estimates over the live diagram
(D5): β on structural paths, std loadings on measurement lines, R² on
endogenous ovals (skips exogenous). APA-formatted (2 dp, leading zero
stripped). Sourced from CbSemResult/PlsSemResult .estimates; gated on a
non-null estimates prop so config-state draws clean. Each label carries a
data-* key for deterministic targeting by the export raster + tests.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
```

---

### Task 30: Raster the annotated diagram to `figure_path-diagram.png` in `ResultsScreen.download()`
**Files:**
- Modify `src/components/screens/ResultsScreen.tsx:76-91` (the `download()` body — layer the diagram raster alongside the table PNGs).
- Modify `src/components/screens/ResultsScreen.export.test.tsx` (add a unit test asserting `buildExportFiles` does NOT emit the path diagram; it is component-layered only).
- Create `src/components/screens/ResultsScreen.figure.test.tsx` (Test for the `download()` raster path).

**Interfaces:** Consumes: the annotated `<svg id={`figure-path-diagram-${testId}`}>` from Task 29, `captureNode` (`src/lib/export/capture.ts`), `TestSpec.inputKind === 'sem-canvas'`, `BUILDERS`, `SPECS`, the existing `ExportFormats.figures` tick · Produces: a `NN_<id>/figure_path-diagram.png` (and `figures/NN_<id>/figure_path-diagram.png` under latex) in the export zip — the bundle-manifest entry from §6C, consumed by the LaTeX `\includegraphics` path.

- [ ] **Step 1: Write the failing test** (show COMPLETE test code in a fenced block)

```tsx
// src/components/screens/ResultsScreen.figure.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'

// captureNode is DOM-bound (html-to-image); stub it to return a recognizable PNG and
// record the ids it was asked to raster, so we can assert the path-diagram id is captured.
const captured: string[] = []
vi.mock('../../lib/export/capture', () => ({
  captureNode: vi.fn(async (id: string) => {
    captured.push(id)
    return new Uint8Array([0x89, 0x50, 0x4e, 0x47])
  }),
}))

// Minimal SPECS/BUILDERS doubles: one sem-canvas test (cb-sem) so download() takes the figure branch.
vi.mock('../../lib/registry/catalog', () => ({
  SPECS: {
    'cb-sem': { name: 'CB-SEM', question: 'q', inputKind: 'sem-canvas', tables: [], figures: [] },
  },
}))
vi.mock('../../lib/results/builders', () => ({
  BUILDERS: { 'cb-sem': () => ({ tables: [], figures: [] }) },
}))

import { rasterSemFigures } from './ResultsScreen'

describe('ResultsScreen — path-diagram raster (Task 30)', () => {
  beforeEach(() => { captured.length = 0 })

  it('rasters figure-path-diagram-<id> for each fresh sem-canvas test, keyed NN_id/figure_path-diagram.png', async () => {
    const files: Record<string, Uint8Array> = {}
    const s = {
      selection: ['cb-sem'],
      runs: { 'cb-sem': { result: { estimates: {} }, stale: false } },
    } as unknown as Parameters<typeof rasterSemFigures>[0]
    await rasterSemFigures(s, ['cb-sem'], { figures: true, latex: false } as Parameters<typeof rasterSemFigures>[2], files)
    expect(captured).toContain('figure-path-diagram-cb-sem')
    expect(Object.keys(files)).toContain('01_cb-sem/figure_path-diagram.png')
  })

  it('also writes the figures/ latex copy when latex is ticked', async () => {
    const files: Record<string, Uint8Array> = {}
    const s = {
      selection: ['cb-sem'],
      runs: { 'cb-sem': { result: { estimates: {} }, stale: false } },
    } as unknown as Parameters<typeof rasterSemFigures>[0]
    await rasterSemFigures(s, ['cb-sem'], { figures: false, latex: true } as Parameters<typeof rasterSemFigures>[2], files)
    expect(Object.keys(files)).toContain('figures/01_cb-sem/figure_path-diagram.png')
  })

  it('does nothing when neither figures nor latex is ticked', async () => {
    const files: Record<string, Uint8Array> = {}
    const s = {
      selection: ['cb-sem'],
      runs: { 'cb-sem': { result: { estimates: {} }, stale: false } },
    } as unknown as Parameters<typeof rasterSemFigures>[0]
    await rasterSemFigures(s, ['cb-sem'], { figures: false, latex: false } as Parameters<typeof rasterSemFigures>[2], files)
    expect(captured).toHaveLength(0)
    expect(Object.keys(files)).toHaveLength(0)
  })
})
```

And add this guard to `src/components/screens/ResultsScreen.export.test.tsx` (the pure path stays diagram-free — the diagram is DOM-layered, never builder-produced, per §4.2):

```tsx
  it('never emits the sem path diagram from the pure file map (it is DOM-layered in download)', () => {
    const files = buildExportFiles(session(), { tables: false, figures: true, pdf: false, latex: true, r: false })
    expect(Object.keys(files).some((k) => k.endsWith('figure_path-diagram.png'))).toBe(false)
  })
```

- [ ] **Step 2: Run it, verify FAIL** (exact command + expected failure)

```
npx vitest run src/components/screens/ResultsScreen.figure.test.tsx
```
Expected: FAIL — `rasterSemFigures` is not yet exported from `ResultsScreen.tsx` (import resolves to `undefined`; calling it throws `TypeError: rasterSemFigures is not a function`).

- [ ] **Step 3: Implement** (show COMPLETE code)

Extract a small, exported, DOM-bound helper mirroring the existing table-PNG layering (same `folder` slug, same `figures/`-prefixed latex copy convention as `buildExportFiles`), and call it from `download()` after the table loop. Only `sem-canvas` specs have a path diagram on screen, so gate on `spec.inputKind === 'sem-canvas'`.

```tsx
// src/components/screens/ResultsScreen.tsx — add after buildExportFiles, before printReport:

// DOM-bound raster of the on-screen annotated path diagram (Task 29 svg id
// `figure-path-diagram-<id>`). Layered here — NOT in buildExportFiles — because, like
// the table PNGs, it needs captureNode (async, html-to-image) and a live DOM node; the
// builder is sync/no-DOM and can't produce it (§4.2). Same folder slug + figures/ latex
// copy convention as buildExportFiles so report.tex's \includegraphics resolves.
export async function rasterSemFigures(
  s: SessionState,
  fresh: string[],
  formats: Pick<ExportFormats, 'figures' | 'latex'>,
  files: Record<string, Uint8Array>,
): Promise<void> {
  if (!formats.figures && !formats.latex) return
  for (const id of fresh) {
    const spec = SPECS[id]
    if (spec?.inputKind !== 'sem-canvas') continue
    const folder = `${String(s.selection.indexOf(id) + 1).padStart(2, '0')}_${id}/`
    const png = await captureNode(`figure-path-diagram-${id}`)
    if (formats.figures) files[`${folder}figure_path-diagram.png`] = png
    if (formats.latex) files[`figures/${folder}figure_path-diagram.png`] = png
  }
}
```

Then wire it into `download()` immediately after the table-PNG loop (inside the same `try`):

```tsx
      const files = buildExportFiles(s, formats) // pure byte/string artifacts; table PNGs (DOM) layered on below
      if (formats.tables) for (const id of fresh) {
        const spec = SPECS[id]!; const folder = `${String(s.selection.indexOf(id) + 1).padStart(2, '0')}_${id}/`
        for (const t of BUILDERS[id](spec, s.runs[id].result).tables) files[`${folder}table_${t.spec.id}.png`] = await captureNode(`table-${t.spec.domId ?? t.spec.id}`)
      }
      await rasterSemFigures(s, fresh, formats, files) // sem-canvas path diagram: DOM raster of the annotated <svg>
      const names = Object.keys(files)
```

- [ ] **Step 4: Run, verify PASS** (exact command + expected)

```
npx vitest run src/components/screens/ResultsScreen.figure.test.tsx src/components/screens/ResultsScreen.export.test.tsx && npx tsc --noEmit
```
Expected: figure test 3/3 pass, export test (now 8 cases incl. the new diagram-free guard) all pass; `tsc` reports 0 errors.

- [ ] **Step 5: Commit** (git add + conventional-commit message)

```
git add src/components/screens/ResultsScreen.tsx src/components/screens/ResultsScreen.figure.test.tsx src/components/screens/ResultsScreen.export.test.tsx
git commit -m "feat(sem-b): raster the annotated path diagram to figure_path-diagram.png on export

rasterSemFigures layers the on-screen annotated <svg id=figure-path-diagram-<id>>
into the export bundle via the existing captureNode/html-to-image path (§4.2) —
gated on inputKind==='sem-canvas', mirroring the table-PNG layering (same NN_id
folder slug + figures/ latex copy so report.tex \\includegraphics resolves). The
pure buildExportFiles stays diagram-free (DOM-layered only). Manifest entry §6C.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
```

---

### Task 31: Shared `df==0` saturation predicate (builder · emitter · runs-in-r agree)
**Files:**
- Create `src/lib/stats/saturation.ts`
- Create (test) `src/lib/stats/saturation.test.ts`
- Modify `src/lib/results/buildCbSem.ts` (the `fit`-table block built in Unit 6 — replace its inline `df === 0` check with the shared predicate)
- Modify `src/lib/export/rScript/emitters/latent.ts:402` (the `cb-sem` emitter's fit-table guard, built in Unit 6)

**Interfaces:** Consumes: `CbSemResult` (`{ mode, saturated, fit? }`, from Unit 6) · Produces: `isSaturated(input)` — the ONE predicate keyed strictly on `fitMeasures(fit,'df') == 0`, imported by `buildCbSem`, the `cb-sem` emitter, and the `runs-in-r` gate.

- [ ] **Step 1: Write the failing test** (`src/lib/stats/saturation.test.ts`)
```ts
import { describe, it, expect } from 'vitest'
import { isSaturated, R_SATURATED_PREDICATE } from './saturation'

describe('isSaturated — the single df==0 saturation predicate', () => {
  it('is true exactly when fit.df == 0', () => {
    expect(isSaturated({ df: 0 })).toBe(true)
    expect(isSaturated({ df: 0.0 })).toBe(true)
  })

  it('is false for any positive df (over-identified)', () => {
    expect(isSaturated({ df: 1 })).toBe(false)
    expect(isSaturated({ df: 24 })).toBe(false)
  })

  it('is false for negative df (under-identified) — strictly keyed on == 0', () => {
    expect(isSaturated({ df: -3 })).toBe(false)
  })

  it('is false when fit/df is absent (path-mode with no fit, or non-numeric)', () => {
    expect(isSaturated(undefined)).toBe(false)
    expect(isSaturated({})).toBe(false)
    expect(isSaturated({ df: NaN })).toBe(false)
  })

  it('accepts a CbSemResult and reads its fit.df', () => {
    expect(isSaturated({ fit: { df: 0 } })).toBe(true)
    expect(isSaturated({ fit: { df: 5 } })).toBe(false)
  })

  it('exposes the R-side predicate string keyed on fitMeasures(fit, "df")', () => {
    expect(R_SATURATED_PREDICATE).toBe(`as.numeric(lavaan::fitMeasures(fit, "df")) == 0`)
  })
})
```

- [ ] **Step 2: Run it, verify FAIL**
  Command: `npx vitest run src/lib/stats/saturation.test.ts`
  Expected: FAIL — `Cannot find module './saturation'` (the module does not exist yet).

- [ ] **Step 3: Implement** (`src/lib/stats/saturation.ts`)
```ts
// THE single df==0 saturation predicate. A saturated model (df == 0, e.g. the canonical
// X -> M -> Y mediation) has perfect fit by construction, so the fit-index table is meaningless
// and is suppressed. This ONE predicate is the source of truth shared by:
//   - the screen builder (src/lib/results/buildCbSem.ts) — drop the fit table + set saturated flag,
//   - the export emitter (src/lib/export/rScript/emitters/latent.ts, cb-sem) — drop the LaTeX fit table,
//   - the native-R gate (src/lib/export/rScript/runs-in-r.test.ts).
// Keyed STRICTLY on fitMeasures(fit, 'df') == 0 (NOT on recursiveness): df > 0 reports fit; df < 0
// (under-identified) is NOT saturated. Path mode with no measurement model still produces a lavaan
// fit object, so the same df read applies; when no fit object exists at all, saturated = false.

/** Anything carrying a model df: a CbSemResult, its fit block, or a bare { df }. */
export interface SaturationInput {
  df?: number
  fit?: { df?: number } & Record<string, unknown>
}

/** Read the model df from a CbSemResult-or-fit-or-{df} shape. */
function readDf(input: SaturationInput | undefined): number | undefined {
  if (!input) return undefined
  if (typeof input.df === 'number') return input.df
  if (input.fit && typeof input.fit.df === 'number') return input.fit.df
  return undefined
}

/** TRUE iff the model is saturated: fitMeasures(fit,'df') == 0. Absent/NaN df → false. */
export function isSaturated(input: SaturationInput | undefined): boolean {
  const df = readDf(input)
  return typeof df === 'number' && Number.isFinite(df) && df === 0
}

/** The identical predicate as an R expression, for analysis.R (keyed on the same fitMeasures df). */
export const R_SATURATED_PREDICATE = `as.numeric(lavaan::fitMeasures(fit, "df")) == 0`
```

  Then wire it into the two Unit-6 sites so screen and export agree.

  In `src/lib/results/buildCbSem.ts`, add the import at the top and replace the inline fit-table guard:
```ts
import { isSaturated } from '../stats/saturation'
```
  Replace the fit-table emission block (Unit 6's `if (result.fit && result.fit.df !== 0)` / equivalent inline check) with the shared predicate:
```ts
  // Fit indices (Table 5) — SUPPRESSED for a saturated model (df == 0). One shared predicate.
  const saturated = isSaturated(result)
  if (result.fit && !saturated) {
    tables.push(buildFitIndicesTable(result.fit))
  }
```

  In `src/lib/export/rScript/emitters/latent.ts`, add the import at the top:
```ts
import { R_SATURATED_PREDICATE } from '../../../stats/saturation'
```
  In the `cb-sem` emitter (Unit 6), guard the LaTeX fit-indices table with the identical R predicate so the exported script suppresses it exactly when the screen does:
```ts
      '# Fit indices (Table 5) — suppressed for a saturated model (df == 0). Same predicate as the app.',
      `if (!(${R_SATURATED_PREDICATE})) {`,
      '  fit_idx <- lavaan::fitMeasures(fit, c("chisq","df","pvalue","cfi","tli","rmsea","rmsea.ci.lower","rmsea.ci.upper","srmr"))',
      '  cat("\\n--- Table 5: Fit indices ---\\n"); print(round(fit_idx, 3))',
      '} else {',
      '  cat("\\n--- Model is saturated (df = 0): fit indices not reported ---\\n")',
      '}',
```

- [ ] **Step 4: Run, verify PASS**
  Command: `npx vitest run src/lib/stats/saturation.test.ts && npx tsc --noEmit`
  Expected: PASS — all 6 `isSaturated` cases green; `tsc` exits 0 (the two Unit-6 sites now import the shared predicate cleanly).

- [ ] **Step 5: Commit**
```
git add src/lib/stats/saturation.ts src/lib/stats/saturation.test.ts src/lib/results/buildCbSem.ts src/lib/export/rScript/emitters/latent.ts
git commit -m "feat(sem): shared df==0 saturation predicate (builder/emitter/gate agree)

One isSaturated() keyed strictly on fitMeasures(fit,'df')==0, plus the
identical R_SATURATED_PREDICATE for analysis.R. CB-SEM screen builder and
LaTeX emitter both suppress the fit table through this single source of truth.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
```

---

### Task 32: Path-analysis picker entry + observed-only mode (`modelKind:'path'`)
**Files:**
- Create `src/lib/registry/pathAnalysis.ts` (the `PATH_ANALYSIS` spec — `inputKind:'sem-canvas'`, `modelKind:'path'` default; rectangles, single-column nodes; measurement/EFA/CFA/reliability/AVE tables absent)
- Create (test) `src/lib/registry/pathAnalysis.consistency.test.ts`
- Modify `src/lib/registry/catalog.ts:104` — add the `path-analysis` picker entry + register `PATH_ANALYSIS` in `SPECS`
- Modify `src/lib/results/builders.ts:117,218` — add `path-analysis` to `RUNNERS` (reuse `runCbSem` with `modelKind:'path'`) and `BUILDERS` (reuse `buildCbSem`)
- Modify `src/lib/stats/cbSem.ts` — path mode: lavaan model from `paths` only (no `=~`), `lavaan::sem` on observed columns; set `mode:'path'` and `saturated` via the shared predicate (built in Unit 6; this adds/confirms the path branch)
- Modify `src/lib/results/buildCbSem.ts` — suppress measurement/EFA/CFA/reliability/AVE tables when `result.mode === 'path'`
- Modify `src/lib/export/rScript/emitters/latent.ts` — `cb-sem` emitter path branch (omit `=~`/EFA/CFA/reliability blocks; rectangle `semPaths` whatLabels)
- Modify `src/state/session.ts:86` — `gateOk` path-mode relaxation (each node = 1 column → drop the ≥2-items rule)
- Modify `src/lib/export/rScript/runs-in-r.test.ts:160` — add the df==0 single-mediator `X→M→Y` `path-analysis` REP

**Interfaces:** Consumes: `runCbSem` / `buildCbSem` / `cb-sem` emitter (Unit 6), `isSaturated` / `R_SATURATED_PREDICATE` (Task 31), `Construct`/`StructuralPath`/`TestSetup` (Unit 2) · Produces: catalog id `path-analysis`, `PATH_ANALYSIS` spec, the observed-only path branch through the CB-SEM pipeline.

- [ ] **Step 1: Write the failing test** (`src/lib/registry/pathAnalysis.consistency.test.ts`)
```ts
import { describe, it, expect } from 'vitest'
import { PATH_ANALYSIS } from './pathAnalysis'
import { CATALOG, SPECS } from './catalog'
import { RUNNERS, BUILDERS } from '../results/builders'
import { gateOk } from '../../state/session'
import type { SessionState } from '../../state/session'

describe('path-analysis — observed-only CB-SEM picker entry', () => {
  it('is a distinct catalog entry under SEM, available', () => {
    const entry = CATALOG.find((c) => c.id === 'path-analysis')
    expect(entry).toBeDefined()
    expect(entry!.status).toBe('available')
    expect(entry!.family).toBe('Latent variable models')
    expect(entry!.subfamily).toBe('Structural equation modeling')
  })

  it('routes through the canvas, in path mode, with no construct-slots measurement input', () => {
    expect(PATH_ANALYSIS.id).toBe('path-analysis')
    expect(PATH_ANALYSIS.inputKind).toBe('sem-canvas')
    expect(PATH_ANALYSIS.modelKind).toBe('path')
    // NOT the legacy boolean (migrated away in Unit 2)
    expect((PATH_ANALYSIS as { constructsInput?: unknown }).constructsInput).toBeUndefined()
  })

  it('declares NO measurement/EFA/CFA/reliability/AVE tables (observed-only)', () => {
    const ids = PATH_ANALYSIS.tables.map((t) => t.id)
    expect(ids).not.toContain('cfa-loadings')
    expect(ids).not.toContain('reliability')
    expect(ids).not.toContain('efa-suitability')
    expect(ids).not.toContain('efa-loadings')
    expect(ids).toContain('structural-paths')
    expect(ids).toContain('indirect-effects')
  })

  it('bundle files omit measurement PNGs and keep the path diagram', () => {
    expect(PATH_ANALYSIS.bundleFiles).toEqual([
      'table_structural-paths.png',
      'table_indirect-effects.png',
      'figure_path-diagram.png',
    ])
  })

  it('is registered + wired to the reused CB-SEM runner/builder', () => {
    expect(SPECS['path-analysis']).toBe(PATH_ANALYSIS)
    expect(RUNNERS['path-analysis']).toBeTypeOf('function')
    expect(BUILDERS['path-analysis']).toBeTypeOf('function')
  })

  it('gateOk relaxes the >=2-items rule in path mode: >=1 path is enough', () => {
    const base = {
      selection: ['path-analysis'],
      setups: {
        'path-analysis': {
          roles: {}, options: {}, props: {}, blocked: null,
          modelKind: 'path' as const,
          constructs: [
            { id: 1, name: 'X', items: ['x'] },
            { id: 2, name: 'M', items: ['m'] },
            { id: 3, name: 'Y', items: ['y'] },
          ],
          paths: [{ from: 1, to: 2 }, { from: 2, to: 3 }],
        },
      },
    } as unknown as SessionState

    expect(gateOk(base, 'test:path-analysis')).toBe(true)

    const noPaths = {
      ...base,
      setups: { 'path-analysis': { ...base.setups['path-analysis'], paths: [] } },
    } as unknown as SessionState
    expect(gateOk(noPaths, 'test:path-analysis')).toBe(false)
  })
})
```

- [ ] **Step 2: Run it, verify FAIL**
  Command: `npx vitest run src/lib/registry/pathAnalysis.consistency.test.ts`
  Expected: FAIL — `Cannot find module './pathAnalysis'` (the spec does not exist; no catalog entry; not in RUNNERS/BUILDERS).

- [ ] **Step 3: Implement**

  Create `src/lib/registry/pathAnalysis.ts`:
```ts
import type { TestSpec } from './types'

// Path analysis = observed-only CB-SEM. Distinct picker entry → the CB-SEM output card in
// auto-detected observed-only mode (modelKind: 'path'): nodes are single observed columns
// (drawn as rectangles, not ovals), NO item assignment, NO measurement model. lavaan::sem on the
// observed variables. Measurement / EFA / CFA / reliability / AVE tables are SUPPRESSED.
// The fit table is suppressed strictly when fitMeasures(fit,'df') == 0 (saturated, e.g. the canonical
// X -> M -> Y mediation) via the ONE shared predicate (src/lib/stats/saturation.ts); a saturation
// flag is shown instead. df > 0 reports fit (with the small-df/small-N RMSEA-instability caveat).
// Path analysis has NO drawn output card of its own — it reuses the CB-SEM card with the measurement
// tables absent. Mediation (chained paths) → indirect-effects table with bootstrap percentile CIs.
export const PATH_ANALYSIS: TestSpec = {
  id: 'path-analysis',
  name: 'Path analysis',
  question: 'directed relationships among observed variables (path / mediation models)',
  inputKind: 'sem-canvas',
  modelKind: 'path',
  roles: [],
  options: [
    { id: 'estimator', label: 'estimator', value: 'ML', kind: 'display' },
    { id: 'bootstrap', label: 'bootstrap resamples', value: 5000, kind: 'display' },
  ],
  constraints: {
    roles: [],
    minRule: { kind: 'values', n: 20 },
  },
  tables: [
    {
      id: 'structural-paths',
      title: 'Structural paths',
      columns: [
        { key: 'path', label: 'Path' },
        { key: 'b', label: 'B' },
        { key: 'se', label: 'SE' },
        { key: 'z', label: 'z' },
        { key: 'p', label: 'p' },
        { key: 'beta', label: 'Std. β' },
        { key: 'ci', label: '95% CI' },
        { key: 'r2', label: 'R²' },
      ],
    },
    {
      id: 'indirect-effects',
      title: 'Indirect effects',
      columns: [
        { key: 'path', label: 'Path' },
        { key: 'est', label: 'est (std + unstd)' },
        { key: 'se', label: 'SE' },
        { key: 'ci', label: 'bootstrap 95% CI' },
        { key: 'p', label: 'p' },
      ],
    },
  ],
  tableNote: {
    kind: 'plain',
    text: 'Path analysis fits directed relationships among observed variables (lavaan::sem) — no latent measurement model, so no CFA loadings, reliability, or AVE are reported. When the model is saturated (df = 0, e.g. a single-mediator X → M → Y chain), it fits the data perfectly by construction and global fit indices (χ², CFI, TLI, RMSEA, SRMR) are not reported; an over-identified model (df > 0) reports fit, interpreting RMSEA cautiously at small df / small N (Kenny, Kaniskan & McCoach, 2015). Indirect (mediated) effects are tested with bias-uncorrected percentile bootstrap 95% CIs (5,000 resamples; MacKinnon, Lockwood & Williams, 2004); an interval excluding 0 indicates a credible indirect effect.',
    afterTableId: 'indirect-effects',
  },
  figures: [
    { caption: 'Path diagram', type: 'app-drawn path diagram with fitted estimates', file: 'path-diagram' },
  ],
  howToRead:
    'Path analysis estimates a system of regressions among observed variables at once, letting one variable be both an outcome and a predictor (mediation). Structural paths: each B is the unstandardized effect, Std. β the standardized effect, with z, p, and a 95% CI; R² is the variance explained in each endogenous variable. Indirect effects: the product of the paths through a mediator (e.g. X → M → Y), judged by its bootstrap 95% CI — an interval excluding 0 indicates mediation. When df = 0 the model is saturated (it reproduces the data exactly), so fit indices are not informative and are omitted; only with extra constraints (df > 0) do global fit indices apply, and even then read RMSEA cautiously at small df / small N. All thresholds are heuristics, not pass/fail gates.',
  apaTemplate: 'A path model fit to the observed variables; the indirect effect of X on Y through M was significant, bootstrap 95% CI excluding 0.',
  rMap: 'lavaan::sem() on observed variables (regressions only; no =~) → fit · standardizedSolution() + lavInspect(fit,"rsquare") → Table 1 (structural paths + R²) · auto := indirect-effect definitions + bootstrap (boot.ci.type="perc", R = 5000) → Table 2 (indirect effects) · fit indices suppressed when fitMeasures(fit,"df") == 0 (saturated) · semPlot::semPaths() → figure (rectangles = observed)',
  bundleFiles: ['table_structural-paths.png', 'table_indirect-effects.png', 'figure_path-diagram.png'],
}
```

  In `src/lib/registry/catalog.ts`, add the import (after the `EFA`/`PCA` imports near line 46):
```ts
import { PATH_ANALYSIS } from './pathAnalysis'
```
  Add the picker entry into `CATALOG` immediately after the `pls-sem` inline object (line 103), before the `pca` entry — it carries a `note` like its CB-SEM/PLS-SEM siblings, so it is an inline object (not the `e()` helper, which lacks `note`):
```ts
  { id: 'path-analysis', name: 'Path analysis', family: 'Latent variable models', subfamily: 'Structural equation modeling', status: 'available',
    note: '— directed relationships among OBSERVED variables (no measurement model); single-mediator and multi-step mediation via drawn path chains (indirect-effects table, bootstrapped percentile CIs); saturated (df = 0) models report no fit indices' },
```
  Register the spec in `SPECS` (append to the latent block near line 123):
```ts
  [PATH_ANALYSIS.id]: PATH_ANALYSIS,
```

  In `src/lib/results/builders.ts`, add imports (near the cb-sem imports added in Unit 6):
```ts
import { PATH_ANALYSIS } from '../registry/pathAnalysis'
```
  Add to `RUNNERS` (reuse `runCbSem`, forcing path mode; merge `modelKind` so a path-mode setup is honoured even if undefined):
```ts
  'path-analysis': (engine, ds, setup) => runCbSem(engine, ds, { ...setup, modelKind: 'path' }),
```
  Add to `BUILDERS` (reuse the CB-SEM builder — it already suppresses measurement tables when `result.mode === 'path'`):
```ts
  'path-analysis': (spec, result) => buildCbSem(spec, result as CbSemResult),
```

  In `src/lib/stats/cbSem.ts` (the Unit-6 engine), confirm/add the path branch so observed-only mode omits `=~` and sets `mode:'path'`. Inside `runCbSem`, the model-string construction and mode tag:
```ts
  const isPath = setup.modelKind === 'path'
  // Path mode: NO measurement model (=~). Each node is a single observed column; the regressions
  // come from the structural paths only. Latent mode: one =~ line per construct + the regressions.
  const measurementLines = isPath
    ? []
    : (setup.constructs ?? []).map((c) => `${c.name} =~ ${c.items.join(' + ')}`)
  // In path mode the "construct" name IS the observed column (single item); use it directly.
  const nodeName = (id: number): string => {
    const c = (setup.constructs ?? []).find((k) => k.id === id)!
    return isPath ? c.items[0] : c.name
  }
  const regressionLines = (setup.paths ?? []).map((p) => `${nodeName(p.to)} ~ ${nodeName(p.from)}`)
  // ... (auto := indirect defs, lavaan::sem fit, standardizedSolution, rsquare, bootstrap — as Unit 6)
  const mode: CbSemResult['mode'] = isPath ? 'path' : setup.options['structural'] === false ? 'cfa-only' : 'full'
  // saturated read from the SAME predicate the builder/emitter use (df from fitMeasures):
  const saturated = isSaturated({ df: fitDf })   // fitDf = as numeric fitMeasures(fit,'df') returned from R
```
  (Add `import { isSaturated } from './saturation'` to `cbSem.ts`. The R block in path mode skips the CFA/EFA/reliability sections and returns `cfaLoadings: []`, `reliability: []`, `efaSuitability`/`efaLoadings` undefined; `structural` + `indirect` + `rsquare` + `fit` are returned as in latent mode.)

  In `src/lib/results/buildCbSem.ts`, suppress the measurement/EFA/CFA/reliability/AVE tables in path mode (guard each of those `tables.push(...)` blocks Unit 6 added):
```ts
  const pathMode = result.mode === 'path'
  // Observed-only path analysis: NO measurement model → suppress EFA/CFA/reliability/AVE tables.
  if (!pathMode) {
    if (result.efaSuitability) tables.push(buildEfaSuitabilityTable(result.efaSuitability))
    if (result.efaLoadings) tables.push(buildEfaLoadingsTable(result.efaLoadings))
    tables.push(buildCfaLoadingsTable(result.cfaLoadings))
    tables.push(buildReliabilityTable(result.reliability))
  }
  // Fit table (shared df==0 predicate) — applies to BOTH modes:
  const saturated = isSaturated(result)
  if (result.fit && !saturated) tables.push(buildFitIndicesTable(result.fit))
  // Structural paths + indirect effects — present in both modes (path mode is structural-only):
  if (result.structural) tables.push(buildStructuralPathsTable(result.structural, result.rsquare))
  if (result.indirect && result.indirect.length) tables.push(buildIndirectEffectsTable(result.indirect))
```

  In `src/lib/export/rScript/emitters/latent.ts`, the `cb-sem` emitter (Unit 6) gains the path branch — omit `=~`/EFA/CFA/reliability blocks, regressions from paths, rectangle node shapes in the `semPaths` figure:
```ts
    const isPath = setup.modelKind === 'path'
    const constructs: Construct[] = setup.constructs ?? []
    const nodeName = (id: number): string => {
      const c = constructs.find((k) => k.id === id)!
      return isPath ? c.items[0] : c.name
    }
    const measurementLines = isPath ? [] : constructs.map((c) => `${c.name} =~ ${c.items.join(' + ')}`)
    const regressionLines = (setup.paths ?? []).map((p) => `${nodeName(p.to)} ~ ${nodeName(p.from)}`)
    const modelStr = [...measurementLines, ...regressionLines].join('\\n')
    const lines: string[] = [
      '# ---- ' + (isPath ? 'Path analysis (observed-only CB-SEM)' : 'CB-SEM') + ' via lavaan ----',
      `model_str <- "${modelStr}"`,
      'fit <- lavaan::sem(model_str, data = d, se = "standard")',
    ]
    // EFA / CFA loadings / reliability — latent mode only; path mode has no measurement model.
    if (!isPath) {
      lines.push(
        '# (CFA loadings + reliability blocks — latent mode only)',
        // ... Unit-6 CFA/reliability emission ...
      )
    }
    lines.push(
      '# Structural paths + R² (both modes)',
      'std_sol <- lavaan::standardizedSolution(fit)',
      'cat("\\n--- Table: Structural paths ---\\n"); print(std_sol[std_sol$op == "~", ])',
      'print(lavInspect(fit, "rsquare"))',
      '',
      '# Fit indices — suppressed when saturated (df == 0). Same predicate as the app.',
      `if (!(${R_SATURATED_PREDICATE})) {`,
      '  print(round(lavaan::fitMeasures(fit, c("chisq","df","pvalue","cfi","tli","rmsea","rmsea.ci.lower","rmsea.ci.upper","srmr")), 3))',
      '} else { cat("\\n--- Model is saturated (df = 0): fit indices not reported ---\\n") }',
      '',
      '# Path diagram: rectangles = observed (path mode), ovals = latent.',
      `semPlot::semPaths(fit, whatLabels = "std", style = "lisrel"${isPath ? ', shapeMan = "rectangle"' : ''})`,
    )
    return lines.join('\n')
```
  (`R_SATURATED_PREDICATE` is already imported from Task 31; add `import type { Construct } from '../../../../state/session'` if not present.)

  In `src/state/session.ts`, extend the `gateOk` SEM branch (Unit 2 introduced the `inputKind:'sem-canvas'` branch; this adds the path-mode relaxation):
```ts
    // SEM canvas: ≥1 path required; latent mode also needs ≥1 construct with ≥2 items.
    // Path mode relaxes the ≥2-items rule — each node is a single observed column.
    if (spec.inputKind === 'sem-canvas') {
      const cs = t.constructs ?? []
      const paths = t.paths ?? []
      if (paths.length < 1) return false
      const pathMode = (t.modelKind ?? 'latent') === 'path'
      if (!pathMode && (cs.length === 0 || cs.some((c) => c.items.length < 2))) return false
    }
```

  In `src/lib/export/rScript/runs-in-r.test.ts`, add the df==0 single-mediator REP to `REPS` (after the `composite-reliability` object near line 159). It uses `scale.csv`'s observed columns `x1`(X) → `x4`(M) → `x7`(Y); df = 0, so stdout must announce the saturated suppression and reach the structural/indirect tables:
```ts
  // path-analysis: observed-only CB-SEM, canonical single-mediator X -> M -> Y (df = 0, saturated).
  // x1 = X, x4 = M, x7 = Y from scale.csv. Asserts the saturation flag fires + the structural/indirect
  // tables reach stdout; fit indices are NOT reported (df == 0).
  { id: 'path-analysis', fixture: 'scale.csv',
    setup: {
      roles: {},
      options: { estimator: 'ML', bootstrap: 5000 },
      props: {},
      blocked: null,
      modelKind: 'path',
      constructs: [
        { id: 1, name: 'X', items: ['x1'] },
        { id: 2, name: 'M', items: ['x4'] },
        { id: 3, name: 'Y', items: ['x7'] },
      ],
      paths: [{ from: 1, to: 2 }, { from: 2, to: 3 }],
    },
    expect: ['Model is saturated (df = 0)', 'Table: Structural paths'],
  },
```
  (`TestSetup` in this test file already permits `constructs`; the added `modelKind`/`paths` fields come from the Unit-2 type widening. The runs-in-r gate emits the real production R via `emitRScript` and asserts exit 0 + the two needles — the native-R parity gate for path mode.)

- [ ] **Step 4: Run, verify PASS**
  Command: `npx vitest run src/lib/registry/pathAnalysis.consistency.test.ts && npx tsc --noEmit && npx vitest run src/lib/export/rScript/runs-in-r.test.ts -t path-analysis`
  Expected: PASS — the 7 consistency cases green; `tsc` exits 0; the native-R gate runs `analysis.R` for `path-analysis` (exit 0) and stdout contains `Model is saturated (df = 0)` + `Table: Structural paths` (skipped automatically if Rscript is absent).

- [ ] **Step 5: Commit**
```
git add src/lib/registry/pathAnalysis.ts src/lib/registry/pathAnalysis.consistency.test.ts src/lib/registry/catalog.ts src/lib/results/builders.ts src/lib/results/buildCbSem.ts src/lib/stats/cbSem.ts src/lib/export/rScript/emitters/latent.ts src/state/session.ts src/lib/export/rScript/runs-in-r.test.ts
git commit -m "feat(sem): path-analysis picker entry + observed-only CB-SEM mode

Distinct path-analysis catalog entry → CB-SEM card in modelKind:'path':
lavaan::sem on observed columns (no =~), single-column rectangle nodes,
measurement/EFA/CFA/reliability/AVE tables suppressed. gateOk relaxes the
>=2-items rule in path mode (>=1 path required). df==0 saturation (canonical
X->M->Y) suppresses the fit table + flags saturation through the shared
predicate, wired identically in builder, emitter, and the runs-in-r native gate.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FfAq2T7wTyGGGx1ZHxpeyr"
```

---

**Notes for the plan assembler (paths, all absolute):**
- New files: `/Users/benjie/Documents/Telos/src/lib/stats/saturation.ts`, `/Users/benjie/Documents/Telos/src/lib/stats/saturation.test.ts`, `/Users/benjie/Documents/Telos/src/lib/registry/pathAnalysis.ts`, `/Users/benjie/Documents/Telos/src/lib/registry/pathAnalysis.consistency.test.ts`.
- Cross-unit dependency: both tasks **consume Unit 6 artifacts** — `runCbSem` (`/Users/benjie/Documents/Telos/src/lib/stats/cbSem.ts`), `buildCbSem` (`/Users/benjie/Documents/Telos/src/lib/results/buildCbSem.ts`), and the `cb-sem` emitter branch in `/Users/benjie/Documents/Telos/src/lib/export/rScript/emitters/latent.ts`. Unit 8 (Tasks 31-32) must be assembled **after** Unit 6. Task 32 also consumes Unit 2 (`Construct.id:number`, `StructuralPath`, `TestSetup.paths/modelKind`, `inputKind:'sem-canvas'`, the `gateOk` `sem-canvas` branch) and Task 31's `isSaturated`/`R_SATURATED_PREDICATE`.
- The legacy `constructsInput?: true` on the existing `ave.ts`/`compositeReliability.ts` specs (and the `gateOk` check at `session.ts:86`) is migrated to `inputKind:'construct-slots'` in Unit 2; Task 32's `gateOk` edit replaces that branch's surroundings — assemble after Unit 2's migration so the `spec.inputKind === 'sem-canvas'` branch already exists.

---

### Task 33: Flip cb-sem/pls-sem to available, add path-analysis picker entry, register all three SPECS
**Files:**
- Modify `src/lib/registry/catalog.ts` (lines 48-49 `CatalogStatus`/`CatalogEntry`, lines 100-104 inline SEM entries + path-analysis insertion, lines 111-124 `SPECS` map, plus imports at top)
- Modify `telos_ui_spec.html` (picktree, lines 277-278: add a `Path analysis` leaf so the 48-leaf tree matches the catalog)
- Modify `src/lib/registry/catalog.consistency.test.ts` (line 20 leaf-count comment + line 24 available-ids list)
- Test: `src/lib/registry/catalog.consistency.test.ts` (existing file; the two assertions are the test)

**Interfaces:** Consumes: `CB_SEM` (`src/lib/registry/cbSem.ts`), `PLS_SEM` (`src/lib/registry/plsSem.ts`), `PATH_ANALYSIS` (`src/lib/registry/pathAnalysis.ts`) — all built in Units 5-8, each a `TestSpec` with `inputKind:'sem-canvas'`. · Produces: `CATALOG` (48 leaves, cb-sem/pls-sem/path-analysis `status:'available'`), `SPECS['cb-sem'|'pls-sem'|'path-analysis']`.

- [ ] **Step 1: Write the failing test** — update the two existing assertions in `catalog.consistency.test.ts` so the leaf-equality test now expects a `Path analysis` leaf and the available-ids list includes the three new ids. Replace the `it('has exactly the 47 leaves…')` comment and the `it('the available tests match the shipped specs…')` body:

```ts
  it('has exactly the 48 leaves, in tree order, under the right family/subfamily', () => { // 48 leaves: +Path analysis (SEM-B); PCA in Data reduction
    expect(rows).toEqual(CATALOG.map((c) => ({ family: c.family, ...(c.subfamily ? { subfamily: c.subfamily } : {}), leaf: c.name })))
  })
  it('the available tests match the shipped specs, in tree order', () => {
    expect(CATALOG.filter((c) => c.status === 'available').map((c) => c.id)).toEqual(['summary-statistics', 'frequencies-crosstabs', 'distribution-normality', 'one-sample-t-test', 'independent-t-test', 'paired-t-test', 'one-way-anova', 'factorial-anova', 'repeated-measures-anova', 'mixed-anova', 'nested-anova', 'welch-anova', 'ancova', 'manova', 'mancova', 'mann-whitney-u', 'wilcoxon-signed-rank', 'kruskal-wallis', 'friedman', 'pearson', 'spearman', 'kendalls-tau', 'chi-square-independence', 'chi-square-goodness-of-fit', 'fishers-exact', 'simple-linear-regression', 'multiple-linear-regression', 'logistic-regression', 'poisson-negative-binomial', 'arima-sarima', 'stationarity-tests', 'granger-causality', 'var', 'fixed-effects', 'random-effects', 'hausman-test', 'did', 'rdd', 'iv-2sls', 'propensity-score-matching', 'cronbachs-alpha', 'ave', 'composite-reliability', 'efa', 'cb-sem', 'pls-sem', 'path-analysis', 'pca'])
  })
```

- [ ] **Step 2: Run it, verify FAIL**
  - Command: `npx vitest run src/lib/registry/catalog.consistency.test.ts`
  - Expected FAIL: the leaf test fails because the ui-spec tree has no `Path analysis` leaf yet (`rows` has 47, `CATALOG` still has 47 and lacks the new entry / mismatched order), and the available-ids test fails because `CATALOG` still marks cb-sem/pls-sem as `later-slice` and has no path-analysis entry — `expected [ …47 ids without cb-sem/pls-sem/path-analysis ] to deeply equal [ …48 ids ]`.

- [ ] **Step 3: Implement** — three edits.

  (a) In `telos_ui_spec.html`, immediately after the PLS-SEM leaf (current line 278), insert a `Path analysis` leaf under the same `Structural equation modeling` subfamily so the tree carries 48 leaves. Replace the PLS-SEM leaf line:

  Find:
  ```html
        <div class="leaf"><span class="box"></span>PLS-SEM <span class="nt">— includes path analysis & mediation via drawn path chains (indirect-effects table, bootstrapped CIs); moderation planned for a later version</span></div>
  ```
  Replace with:
  ```html
        <div class="leaf"><span class="box"></span>PLS-SEM <span class="nt">— includes path analysis & mediation via drawn path chains (indirect-effects table, bootstrapped CIs); moderation planned for a later version</span></div>
        <div class="leaf"><span class="box"></span>Path analysis <span class="nt">— observed-variable structural model (no measurement model): draw paths between single columns; mediation via drawn chains (indirect-effects table, bootstrapped CIs); saturated (df = 0) models suppress the fit table</span></div>
  ```

  (b) In `src/lib/registry/catalog.ts`, add the three imports after line 46 (`import { PCA } from './pca'`):
  ```ts
  import { CB_SEM } from './cbSem'
  import { PLS_SEM } from './plsSem'
  import { PATH_ANALYSIS } from './pathAnalysis'
  ```

  (c) In `src/lib/registry/catalog.ts`, flip the two inline SEM objects to `available` and add the `path-analysis` leaf right after pls-sem. Replace lines 100-103:
  ```ts
    { id: 'cb-sem', name: 'CB-SEM', family: 'Latent variable models', subfamily: 'Structural equation modeling', status: 'later-slice',
      note: '— pipeline stages selectable: CFA & model fit always run, EFA and the structural stage optional (default: all on); includes path analysis & mediation via drawn path chains (indirect-effects table, bootstrapped CIs); moderation planned for a later version' },
    { id: 'pls-sem', name: 'PLS-SEM', family: 'Latent variable models', subfamily: 'Structural equation modeling', status: 'later-slice',
      note: '— includes path analysis & mediation via drawn path chains (indirect-effects table, bootstrapped CIs); moderation planned for a later version' },
  ```
  with:
  ```ts
    { id: 'cb-sem', name: 'CB-SEM', family: 'Latent variable models', subfamily: 'Structural equation modeling', status: 'available',
      note: '— pipeline stages selectable: CFA & model fit always run, EFA and the structural stage optional (default: all on); includes path analysis & mediation via drawn path chains (indirect-effects table, bootstrapped CIs); moderation planned for a later version' },
    { id: 'pls-sem', name: 'PLS-SEM', family: 'Latent variable models', subfamily: 'Structural equation modeling', status: 'available',
      note: '— includes path analysis & mediation via drawn path chains (indirect-effects table, bootstrapped CIs); moderation planned for a later version' },
    { id: 'path-analysis', name: 'Path analysis', family: 'Latent variable models', subfamily: 'Structural equation modeling', status: 'available',
      note: '— observed-variable structural model (no measurement model): draw paths between single columns; mediation via drawn chains (indirect-effects table, bootstrapped CIs); saturated (df = 0) models suppress the fit table' },
  ```

  (d) In `src/lib/registry/catalog.ts`, register the three specs in the `SPECS` map. Replace line 122-123:
  ```ts
    [EFA.id]: EFA,
    [PCA.id]: PCA,
  ```
  with:
  ```ts
    [EFA.id]: EFA,
    [CB_SEM.id]: CB_SEM,
    [PLS_SEM.id]: PLS_SEM,
    [PATH_ANALYSIS.id]: PATH_ANALYSIS,
    [PCA.id]: PCA,
  ```

- [ ] **Step 4: Run, verify PASS**
  - Command: `npx vitest run src/lib/registry/catalog.consistency.test.ts`
  - Expected PASS: all 7 tests green — the 48-leaf tree now equals `CATALOG`, and the available-ids list equals the 48 ids including `cb-sem`, `pls-sem`, `path-analysis`. (The `every table DOM id is unique` test also exercises the three new specs' table ids without collision.)

- [ ] **Step 5: Commit**
  - `git add src/lib/registry/catalog.ts src/lib/registry/catalog.consistency.test.ts telos_ui_spec.html`
  - `git commit -m "feat(catalog): flip cb-sem/pls-sem to available + add path-analysis picker entry; register SEM-B specs"` (with the standard Co-Authored-By / Claude-Session trailer)

---

### Task 34: Migrate the inputKind discriminator in catalog plumbing, extend the decode list, and regenerate the docs catalog + README
**Files:**
- Modify `src/lib/registry/specHtml.ts` (lines 7-22 `decode`: add any glyph entities the three SEM-B output cards introduce that are not already decoded — `ρ` is covered, but the PLS reliability header uses `ρ_A`/`ρ_C` rendered from `&rho;` with literal `_A`/`_C`, and `ω` is covered; add `²`/`χ`/`√` confirmed present — net new is the `&sub2;`-style subscript fallback only if used; see Step 3)
- Modify `docs/TEST_CATALOG.md` (regenerated by script — do not hand-edit)
- Modify `README.md` (line 5: 45→47 live, add SEM-B to the live list, drop CB-SEM/PLS-SEM from "greyed")
- Test: `src/lib/registry/specHtml.test.ts` (create — round-trips the SEM-B entities through `decode`)

**Interfaces:** Consumes: `decode` (`src/lib/registry/specHtml.ts`), the amended `telos_test_outputs.html` SEM-B cards (Unit 5). · Produces: a `decode` covering every entity in the three SEM-B output cards, so the Unit-5 registry consistency tests (`cbSem.consistency.test.ts`, `plsSem.consistency.test.ts`) verbatim-match.

- [ ] **Step 1: Write the failing test** — create `src/lib/registry/specHtml.test.ts` asserting `decode` resolves the glyph entities the SEM-B cards rely on (subscripted ρ headers, √AVE, ω, χ², ≥/≤, →):

```ts
import { describe, it, expect } from 'vitest'
import { decode } from './specHtml'

describe('decode covers every entity used in the SEM-B output cards', () => {
  it('resolves the PLS reliability + CB-SEM glyphs verbatim', () => {
    expect(decode('Construct &middot; &alpha; &middot; &rho;_A &middot; CR (&rho;_C) &middot; AVE'))
      .toBe('Construct · α · ρ_A · CR (ρ_C) · AVE')
    expect(decode('CR &middot; AVE &middot; &omega; &middot; &alpha;')).toBe('CR · AVE · ω · α')
    expect(decode('&radic;AVE')).toBe('√AVE')
    expect(decode('&chi;&sup2;(df, p) &middot; &chi;&sup2;/df')).toBe('χ²(df, p) · χ²/df')
    expect(decode('R&sup2; &ge; .__ &middot; HTMT < .85')).toBe('R² ≥ .__ · HTMT < .85')
    expect(decode('Construct&rarr;Item')).toBe('Construct→Item')
  })
})
```

- [ ] **Step 2: Run it, verify FAIL**
  - Command: `npx vitest run src/lib/registry/specHtml.test.ts`
  - Expected: PASS on every line **if** the existing decode already covers `&rho; &alpha; &omega; &radic; &chi; &sup2; &ge; < &rarr; &middot;` (all confirmed present in lines 7-21). The new file failing to import or a missing entity surfaces here. If all entities are already covered, this test passes immediately and acts as a regression lock — then SKIP the `decode` edit in Step 3(a) and proceed to 3(b)/3(c). (Run first to learn which path applies; do not assume.)

- [ ] **Step 3: Implement**

  (a) **Only if Step 2 reported a missing entity:** add the missing `.replace(...)` to `decode` in `src/lib/registry/specHtml.ts` on the SEM line (lines 20-21), in the established `// Latent-variable / SEM cards` group, keeping `&` last. For example, if a subscript entity like `&#8323;` (₃) is unresolved:
  ```ts
    // Latent-variable / SEM cards (√AVE, ≤, curly apostrophe; SEM-B subscripts)
    .replace(/&radic;/g, '√').replace(/&le;/g, '≤').replace(/&rsquo;/g, '’').replace(/&#8323;/g, '₃')
  ```
  (If Step 2 passed clean, make no change here — the test already locks coverage.)

  (b) Regenerate the docs catalog from the updated registries:
  ```
  npx tsx scripts/gen-test-tree.ts
  ```
  This rewrites `docs/TEST_CATALOG.md`: the header line auto-updates to **47 of 48 tests run live** (path-analysis is a picker re-entry, not a separate live spec — see note below), the live `Latent variable models` subtree gains CB-SEM, PLS-SEM, and Path analysis entries (config + outputs from the registries), and the "Not yet live" tail loses CB-SEM/PLS-SEM. Verify by inspecting the regenerated file (do not hand-edit).

  > Note on the live count: `gen-test-tree.ts` computes `liveCount` as `CATALOG.filter(c => c.status === 'available' && SPECS[c.id])`. With cb-sem, pls-sem, and path-analysis all `available` and all present in `SPECS`, `liveCount` = 48 and `CATALOG.length` = 48 → the header reads **48 of 48 tests run live**, and the "Not yet live" section renders empty. Confirm the regenerated header and that the empty "Not yet live" block is acceptable; if an empty block is undesirable, that is a `gen-test-tree.ts` presentation concern handled separately — the registry data is correct.

  (c) Update `README.md` line 5: change `45 of the 47 run live` → `all 47 run live` (path-analysis is a fourth picker entry that reuses the CB-SEM card, so the human-facing "47 tests" count is unchanged), append the SEM tests to the Latent-variable clause, and drop the "rest remain greyed" tail. Replace the substring:

  Find:
  ```
  and the Latent variable / SEM family (Cronbach's α, AVE, composite reliability, EFA, PCA); the rest remain greyed with honest reasons)
  ```
  Replace with:
  ```
  and the Latent variable / SEM family (Cronbach's α, AVE, composite reliability, EFA, CB-SEM, PLS-SEM, path analysis, PCA))
  ```
  And in the same line change `45 of the 47 run live` to `all 47 run live`.

- [ ] **Step 4: Run, verify PASS**
  - Command: `npx vitest run src/lib/registry/specHtml.test.ts && git diff --stat docs/TEST_CATALOG.md README.md`
  - Expected: the decode test stays green; the diff shows `docs/TEST_CATALOG.md` gained the three SEM-B sections and lost the greyed CB-SEM/PLS-SEM tail, and `README.md` line 5 reflects all-live SEM. (Re-running `npx tsx scripts/gen-test-tree.ts` must produce no further diff — generation is idempotent.)

- [ ] **Step 5: Commit**
  - `git add src/lib/registry/specHtml.ts src/lib/registry/specHtml.test.ts docs/TEST_CATALOG.md README.md`
  - `git commit -m "docs(sem-b): regenerate TEST_CATALOG + README for cb-sem/pls-sem/path-analysis; lock decode coverage"` (with the standard trailer)

---

### Task 35: Final slice integration — run ALL gates (tsc, vitest ×2, e2e, fresh-clone) and the owner click-through
**Files:**
- No source edits in the green path. If any gate fails, fix the *narrowest* offending file under TDD (write/repair the failing test first), then re-run — record each fix as its own commit before re-gating.
- Modify (preview-time only, then revert): none. The click-through is `npm run preview`, no code change.

**Interfaces:** Consumes: the fully assembled slice — `CATALOG`/`SPECS` (Task 33), docs/README (Task 34), the canvas/state/stats/builders/emitters from Units 1-9. · Produces: a GREEN final gate + an owner-ratify checkpoint (the slice is not "done" until Benjie clicks through and rules).

- [ ] **Step 1: Write the failing test** — this integration task's "test" is the gate suite itself; no new unit test. Establish the gate baseline by running the type check first, which must already be clean:
  - Command: `npx tsc --noEmit`
  - This is the standing assertion: a non-zero exit (any TS error introduced by the assembled units) is the failure to drive out before proceeding. If it errors, fix the narrowest file and re-run until exit 0.

- [ ] **Step 2: Run it, verify FAIL** — run the full gate suite once to surface any cross-unit breakage; treat the first red gate as the failure to fix:
  - Commands (run in order; stop at the first failure):
    ```
    npx tsc --noEmit
    npm run test:fast
    npm run test:fast
    npm test            # full WebR vitest incl. runs-in-r native gate (Rscript present on this machine)
    npx playwright test
    ```
  - Expected at this stage: any failure here (a missing `SPECS` wiring, an `inputKind` route gap, a stats-vs-native mismatch, an e2e canvas selector drift, a non-unique table DOM id) is the integration bug to fix. For each: invoke `superpowers:systematic-debugging`, repair the narrowest file under TDD, commit that fix, then resume the gate sequence from the top.

- [ ] **Step 3: Implement** — drive every gate GREEN. Concretely, the passing criteria:
  - `npx tsc --noEmit` → exit 0, no diagnostics.
  - `npm run test:fast` run **twice** (the WebR determinism guard) → both runs identical pass counts, 0 failures. The catalog/specHtml/SEM-B consistency tests and the `cb-sem`/`pls-sem`/`path-analysis` stats tests pass.
  - `npm test` (full suite, includes `src/lib/export/rScript/runs-in-r.test.ts`) → the native-R gate runs `cb-sem`, `pls-sem`, and `path-analysis` emitters under `Rscript` (added to `REPS` in Units 6-8) and they exit 0 with their asserted key numbers; every statistic WebR ≡ native R 4.6.0.
  - `npx playwright test` → the SEM-B e2e journey (define constructs → draw/move/delete paths → run → estimates overlay → export incl. `figure_path-diagram.png`), the id-typing regression, the path-mode + df=0 suppression case, and the mixed reflective/formative PLS run all pass.
  - **Fresh-clone gate:**
    ```
    rm -rf /tmp/telos-fresh && git clone . /tmp/telos-fresh && cd /tmp/telos-fresh && npm ci && npx tsc --noEmit && npm run test:fast
    ```
    → a pristine checkout type-checks and passes test:fast (proves nothing depends on uncommitted local state).
  - Any failure → narrowest fix under TDD → its own commit → re-gate from the top. No gate is "waived".

- [ ] **Step 4: Run, verify PASS** — capture the GREEN evidence in one sweep and present the owner click-through:
  - Command:
    ```
    npx tsc --noEmit && npm run test:fast && npm run test:fast && npm test && npx playwright test && echo "ALL GATES GREEN"
    ```
  - Expected: terminates with `ALL GATES GREEN`; tsc 0, both fast runs equal and 0-fail, full suite (native-R) 0-fail, Playwright all-pass.
  - Then start the owner click-through (no further code change): `npm run preview` and surface the URL to Benjie. He drives: pick CB-SEM → define constructs in the form → draw A→B→C on the canvas → move/delete a node → run → confirm the estimates overlay (β/loadings/R²) → export the bundle and open `figure_path-diagram.png` → repeat for PLS-SEM (toggle a formative construct) and Path analysis (observed rectangles, df=0 suppression). **This is a hard ratify gate — the slice is NOT complete, pushed, or deployed until Benjie rules.** Per `MEMORY.md`: Benjie makes all calls; propose and wait. Do not push or deploy without his explicit word.

- [ ] **Step 5: Commit** — only the assembled-slice metadata/version touch-ups, if any, plus the ratify doc once Benjie signs off:
  - If all gates were green with no fixes, there is nothing new to commit from this task beyond Tasks 33-34 (the integration task is verification, not production). If fixes were needed, they were each committed in Step 3.
  - After Benjie's ratify, record it: write `docs/superpowers/reviews/2026-06-20-sem-b-ratify.md` (gate evidence + his rulings), then `git add docs/superpowers/reviews/2026-06-20-sem-b-ratify.md && git commit -m "docs(sem-b): final gate GREEN + owner ratify — catalog 48/48 live"` (with the standard trailer). **Do not `git push` or deploy** unless Benjie explicitly says so.

---

Grounding notes for the assembler (paths are absolute):
- Catalog flip target: `/Users/benjie/Documents/Telos/src/lib/registry/catalog.ts` — cb-sem/pls-sem are **inline objects** (lines 100-103), NOT `e()` calls; path-analysis is a brand-new inline leaf; `SPECS` map is lines 111-124.
- The 48-leaf consistency assertion is driven by `/Users/benjie/Documents/Telos/telos_ui_spec.html` picktree (the `Path analysis` leaf must be added there too) and `/Users/benjie/Documents/Telos/src/lib/registry/catalog.consistency.test.ts` (lines 20, 24).
- Docs are auto-generated: `/Users/benjie/Documents/Telos/scripts/gen-test-tree.ts` writes `/Users/benjie/Documents/Telos/docs/TEST_CATALOG.md` (regenerate, never hand-edit); README live-count is `/Users/benjie/Documents/Telos/README.md` line 5.
- `decode`/`strip` live in `/Users/benjie/Documents/Telos/src/lib/registry/specHtml.ts` (lines 6-24); the existing SEM line already covers `√ ≤ ’` plus earlier-line `ρ ω α χ ² ≥ < → ·`, so the Task-34 decode edit is conditional on Step 2.
- Native-R gate file: `/Users/benjie/Documents/Telos/src/lib/export/rScript/runs-in-r.test.ts` (Units 6-8 add the cb-sem/pls-sem/path-analysis `REPS`; Task 35 only verifies they pass).
- There is **no `decode`/catalog decode file** separate from `specHtml.ts` — confirmed; all decode logic is `specHtml.ts`.
