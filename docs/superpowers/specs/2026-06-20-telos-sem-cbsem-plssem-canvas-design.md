# Telos — SEM Sub-slice B: CB-SEM, PLS-SEM & the AMOS canvas (design)

**Date:** 2026-06-20
**Status:** DRAFT v2 for owner review — design ruled by owner (visual companion); **vetted by a 4-lens adversarial review** (stats-correctness · code/architecture-fit · completeness vs the drawn cards · scope/risk), all findings folded in below.
**Authority:** stack/architecture `specs/2026-06-10-telos-architecture-design.md`; product content the three root spec HTML files; methodology `reviews/2026-06-18-sem-reporting-convention.md` (owner-approved) + `reviews/2026-06-18-sem-feasibility-spike.md` (GREEN, but see §0). Slice `ROADMAP.md` #1.
**Builds on:** SEM Sub-slice A (`specs+plans/2026-06-15-telos-sem-a*`) — 45/47 live.

---

## 0. Adversarial-review fold-in (what changed from v1)

The review found 4 blockers + 11 majors that v1 got wrong or under-specified. Key corrections, all integrated:

- **Figure pipeline** was architecturally wrong (invented an `svgToPng`; figures are async DOM-rastered, not builder-produced). Fixed to **reuse the existing `captureNode`/`html-to-image` path** (§4.2).
- **Chunked bootstrap would break the native-R parity gate** (chunking changes RNG draws). Fixed: **single awaited call, time-based progress, no RNG chunking** (§5.3).
- **The drawn INPUT cards contradict our hybrid decision** (they show drag-items-onto-canvas). Added as **input-card amendments** (§6) — surfaced to owner.
- **Discriminator/gate/state plumbing** (`constructsInput` boolean, no canvas gate, no progress channel, index-based constructs) spelled out concretely (§4).
- **Several PLS outputs (Q², f², indirect-effect significance, formative validity) were asserted as spike-GREEN but the spike never tested them** → flagged spike-UNVERIFIED + three de-risking spikes added as **Unit 0** (§9, §10).
- **Bootstrap CI type** (percentile vs BCa) — the convention bounced this to the spec; now **ruled** (§5.3, §11).

---

## 1. Goal & scope

Ship the final two tests → catalog **47/47 live**:

- **CB-SEM** (`cb-sem`), **PLS-SEM** (`pls-sem`), **Path analysis** (picker entry → CB-SEM card in auto-detected observed-only mode), **mediation** embedded in both (chained paths → indirect-effects table). Headline new UI = the **AMOS path canvas**.

### 1.1 Non-goals (deferred — `ROADMAP.md` "Deferred from SEM slice B", owner-ruled 2026-06-20)

Multigroup/invariance · moderation · row-subsetting ("only females") · model comparison. **B is single model, one group, no moderation.**

---

## 2. Owner decisions of record

| # | Decision | Ruling |
|---|---|---|
| D1 | Canvas direction | **Hybrid**: construct-slots **form defines** constructs+items; canvas = **structural paths only** (not drag-items-onto-ovals). |
| D2 | Structural render | **Full AMOS** — ovals with item boxes + measurement lines. |
| D3 | Layout | Canvas **on top, full-width**; construct form **below**. |
| D4 | Canvas controls | Draw-path / Move / Delete **+ zoom / pan / resize**. |
| D5 | Estimates on diagram | **Post-run** (results state): fitted β/loadings/R² annotate the diagram; that annotated diagram is the exported figure. |
| D6 | Bootstrap default | **5,000 both tracks**; presets 1k/5k/10k + free entry + time estimate + progress; resample count printed. |
| D7 | Heavy-op handling | **Single awaited bootstrap job** (NOT RNG-chunked — preserves WebR≡native parity), non-blocking (WebR is in a worker), `gc()` around it, **time-based progress** (elapsed + spike-calibrated estimate). |
| D8 | Figure | **App-drawn**: live SVG on screen; export PNG via the existing `captureNode`/html-to-image raster of the annotated SVG; `analysis.R` uses `semPlot::semPaths()` as the reproducible stand-in (native R only). |
| D9 | Visual language | App tokens (blue `#185fa5`, white, paper, Crimson Pro). Latent = oval; observed (path mode) = rectangle. |
| D10 | Bootstrap CI type | **Percentile at 5k** for both tracks (cross-track consistency + exact lavaan/seminr/native parity); **BCa reserved for the 10k "publication-grade final" preset** (BCa needs ~7k to be accurate). Identical `boot.ci.type` in the WebR block and `analysis.R`. **(Ratified 2026-06-20.)** |
| D11 | Input discriminator | Replace `constructsInput?: true` with `inputKind?: 'construct-slots' \| 'sem-canvas'`; migrate AVE/CR + the 3 call sites. |

All methodology rulings from the convention stand (ω headline/α secondary · HTMT primary · `compRelSEM()` not `reliability()` · `standardizedSolution()`/`standardizedSolution_boot()` · RMSEA **90% CI** · Hu&Bentler = guidelines-not-gates · df=0 saturation suppression · CB-SEM mediation + PLS final bootstrap counts per D6).

---

## 3. Input design — canvas + form

### 3.1 Layout (step 6)

Canvas (Full AMOS) on top with toolbar `[Draw path][Move][Delete] [zoom − + Fit] ⌟resize`; status line + path list; **construct-slots form below**; then the pipeline strip (CB-SEM) + option pills.

### 3.2 Construct-slots form (reused)

`ConstructSlots` is the single source of truth for the measurement model. **Gate: hard ≥2 items/construct** (R runner needs it); **advisory "recommend 3"** note to match the CB-SEM config guide ("at least 3 — 2 only works inside a larger model"). The canvas renders one oval per construct from `setup.constructs`.

### 3.3 The canvas (`SemCanvas`, new)

- **Render:** oval per latent construct + item boxes + measurement lines (Full AMOS), blue. Incomplete (<2 items) → dashed/muted. **Path mode → rectangles** (observed), no items.
- **Tools:** Draw path (click source → target; cancel on same; dedupe), Move (drag node; items keep their side), Delete (path or node). **Default tool: Draw path.**
- **View:** zoom/pan (SVG viewBox) + resize grip (canvas height). Node positions persist in state.
- **Mediation auto-detect:** chained `A→B→C` → status badge → indirect-effects table.
- **Estimates overlay (post-run, D5):** annotate paths (β), measurement lines (loadings), endogenous ovals (R²). This annotated SVG is what `captureNode` rasterizes for export (§4.2).
- **Split:** pure `SemCanvasUI` (props in / callbacks out, `renderToStaticMarkup`-testable) + connected `SemCanvas` (`useSession`), mirroring `ConstructSlotsUI`/`ConstructSlots`. `SemCanvasUI` takes **both** a `constructs` prop and a `columns` prop (path mode sources nodes from columns, latent mode from constructs). **IDs typed `number` end-to-end** (the prototype's string/number `===` bug class).

### 3.4 CB-SEM input + supported model shapes

- **Pipeline modes (enumerated, not a free matrix):** the EFA/structural toggles resolve to a **fixed set of output shapes** — `full` (EFA?+CFA+fit+structural), `cfa-only` (structural off), `path` (§3.6). EFA is an on/off sub-toggle within `full`/`cfa-only`. CFA + fit always on. **Owner-ruled (2026-06-20): keep `cfa-only`. The card DEFAULTS to `full` (all stages on — a beginner never touches the toggles and gets the complete model); the pipeline selector is presented as OPTIONAL/ADVANCED and supports the standard two-step (measurement-then-structural) CB-SEM workflow (Anderson & Gerbing / Kline).**
- **Bespoke controls (NOT generic `OptionSpec.kind`s):** the pipeline-stage selector (locked/toggle stages), the estimator-aware missing-data dropdown (FIML/MI/pairwise/listwise, conditional greying), and the bootstrap control (presets + free entry + live time estimate) are **bespoke UI inside the canvas/form composite** — the generic option-pill loop can't express locked stages, conditional greying, or a computed estimate.
- Estimator: WLSMV / ML / MLR.

### 3.5 PLS-SEM input

- **Per-construct reflective/formative** mode on each oval. **Formative reporting is spike-UNVERIFIED** (the spike tested reflective only) — see §5.2/§9 Unit 0.
- Bespoke bootstrap control (5000 default); `weighting` (path); `missing` follows global step-4a (no estimator dropdown).
- No pipeline strip.

### 3.6 Path-analysis mode (observed-only CB-SEM)

Distinct picker entry → CB-SEM card with `modelKind:'path'`. Nodes = single observed columns (no item assignment); canvas draws **rectangles**. **Suppress** measurement/EFA/CFA/reliability/AVE tables. `lavaan::sem` on observed vars. **Suppression keys strictly on `fitMeasures(fit,'df') == 0`** (saturated), NOT on recursiveness — df=0 (canonical X→M→Y) suppresses the fit table + emits a saturation flag; df>0 reports fit (with the small-df RMSEA caveat, §5.1). Path analysis has **no drawn card** — it reuses the CB-SEM output card with measurement tables suppressed; the saturation-flag wording is spec-authored.

---

## 4. State model & plumbing

### 4.1 `TestSetup` / `Construct` (`src/state/session.ts`)

```ts
interface Construct { id: number; name: string; items: string[]; mode?: 'reflective'|'formative'; x?: number; y?: number }
interface StructuralPath { from: number; to: number }
interface TestSetup { /* …existing… */ paths?: StructuralPath[]; modelKind?: 'latent'|'path' }
```

- **Id migration:** `addConstruct` assigns a monotonic numeric `id` (today it pushes `{name:'',items:[]}`). On load of a legacy setup whose constructs lack `id`, **back-fill ids by array index** (keeps existing AVE/CR/EFA setups working). Slots actions migrate from index- to id-addressed for consistency with the canvas.
- **`gateOk` new branch** (keyed on `inputKind:'sem-canvas'`): `≥1 construct with ≥2 items` (latent) **AND** `(t.paths?.length ?? 0) >= 1`. Path mode relaxes the ≥2-items rule (each node = 1 column). The existing `constructsInput` construct branch becomes the `inputKind:'construct-slots'` branch (AVE/CR).
- **`freshSetup`** leaves `paths`/`modelKind`/`mode`/`x`/`y` undefined; every reader defaults (`?? []`, `?? 'latent'`).
- **New actions** (through `edit()`→`revalidated()`): `addPath`, `removePath`, `moveNode(id,x,y)`, `setConstructMode(id,mode)`.
- **TestConfigScreen** first-failing-gate hint logic extended for the canvas branch.

### 4.2 Figure pipeline (corrected) & discriminator

- **On screen:** render the live annotated SVG directly (no PNG).
- **Export:** in `ResultsScreen.download()`, rasterize the annotated-diagram DOM node via the **existing `captureNode(id)`** (`src/lib/export/capture.ts`, `html-to-image` `toPng`, `pixelRatio:2`) — the same async, DOM-bound path that already produces every `table_*.png` under COOP/COEP. The diagram is **NOT** routed through `CardContent.figures[].png` (the builder is sync/no-DOM and can't produce it); it's layered in `download()` like table images, and the LaTeX `\includegraphics` path consumes that same PNG. **Risk + Unit-0 spike:** prove an SVG with the Crimson Pro / Atkinson **webfonts** rasters correctly via `html-to-image` (headless Playwright + a real browser); fallback = inline the font as a data-URL in the SVG, or system-font fallback. Canonical raster DPR pinned so screen ≈ export ≈ semPaths stand-in are not three different sizes.
- **Discriminator (D11):** `TestSpec.inputKind?: 'construct-slots' | 'sem-canvas'` replaces `constructsInput?: true`. Migrate: `TestConfigScreen` route, `gateOk` branch, `eligibility.ts` (`roles:[]` handling), and the ave/compositeReliability consistency tests that assert `constructsInput === true`.

### 4.3 Progress channel (new plumbing, needed early)

`Runner = (engine, ds, setup) => Promise<unknown>` and `runAll` today set only a coarse `runPhase: string` (`Running ${spec.name}…`). Add a **progress setter threaded from `runAll` into the runner** (or a store action the runner calls) so the SEM runners can post `{elapsed, est, message}` to a results-screen progress bar during the single bootstrap call. This is a change to the `Runner` type + the `runAll` loop + a `runProgress` state field — done **early (Unit 9a)** because `runCbSem`/`runPlsSem` depend on it.

---

## 5. Output cards

Faithful to `telos_test_outputs.html` + the §6 amendments. Exact column tuples below are the consistency-test source of truth.

### 5.1 CB-SEM tables

| # | Table | Columns (exact) | When | R |
|---|---|---|---|---|
| 1 | EFA suitability | `KMO · Bartlett's χ² · df · p` | EFA on | `psych::KMO`/`cortest.bartlett` |
| 2 | EFA rotated loadings | `Item · Factor 1..k · Communality` | EFA on | `psych::fa` (hand-rolled parallel analysis; deterministic order) |
| 3 | Measurement model (CFA) | `Construct→Item · B · SE · z · p · Std. loading` | latent | `lavaan::sem` + `standardizedSolution()` |
| 4 | Reliability & validity | `Construct · CR · AVE · ω · α` | latent | `semTools::compRelSEM()`/`AVE()` · `psych::alpha` |
| 5 | Fit indices | `χ²(df, p) · χ²/df · CFI · TLI · RMSEA [90% CI] · SRMR` | unless `df==0` | `lavaan::fitMeasures(…, 'rmsea.ci.lower/upper')` |
| 6 | Structural paths | `Path · B · SE · z · p · Std. β · 95% CI · R²` | structural on | `standardizedSolution()` + `lavInspect(fit,'rsquare')` |
| 7 | Indirect effects | `Path · est (std+unstd) · SE · bootstrap 95% CI · p` | chained | `:=` defined effects + `semboottools::standardizedSolution_boot()` |

- **Figure:** app-drawn diagram (D8). **Fit how-to-read:** guidelines-not-gates (Hu&Bentler / Marsh-Hau-Wen) **+ the small-df/small-N RMSEA-instability caveat** (carries into the df>0 path branch too).
- **`df==0`** → suppress table 5 + saturation flag. One **shared `df==0` predicate** used by the builder, the `latent.ts` emitter, and the `runs-in-r` gate so screen/export/native agree.
- **Standardized indirect CI:** `standardizedSolution_boot()` lives in **`semboottools`**, which the spike listed **NOT-yet-tested** → Unit-0 build rule: if `semboottools` fails the WebR/native parity gate, **hand-roll** standardized bootstrap CIs (re-standardize per resample; the bootstrap machinery is already present). The *unstandardized* indirect CI is spike-verified.

### 5.2 PLS-SEM tables (seminr) — several spike-UNVERIFIED, see flags

| # | Table | Columns (exact) | seminr source | Spike? |
|---|---|---|---|---|
| 1 | Outer loadings/weights | `Construct→Item · loading/weight · t · p` | bootstrapped model | ✅ paths verified |
| 2 | Reliability & convergent validity | `Construct · α · ρ_A · CR (ρ_C) · AVE` | `summary(pls)$reliability` — **raw order `alpha/rhoC/AVE/rhoA`; builder must SELECT+REORDER** to the display tuple | ✅ values verified |
| 3 | Discriminant validity — **HTMT** | construct × construct matrix | `summary$validity$htmt` | ✅ |
| 4 | Structural paths | `Path · β · t · p · 95% CI · f²` | bootstrapped paths + **`summary(pls)$fSquare`** | ⚠️ **f² UNVERIFIED** |
| 5 | Structural quality | `Construct · R² · R²adj · Q²` | `summary` (R²/adj) + **Q² (see note)** | ⚠️ **Q² UNVERIFIED** |
| 6 | Indirect effects | `Path · est · SE · bootstrap 95% CI · p` | **`specific_effect_significance()`** on the bootstrapped model | ⚠️ **UNVERIFIED** |

- **Q² note (owner-ruled 2026-06-20):** seminr's `predict_pls()` is **PLSpredict (out-of-sample, per-indicator RMSE/MAE/Q²_predict vs an LM benchmark)** — NOT the construct-level blindfolding redundancy Q² the convention's "Q²>0" cutoff refers to. Prefer classic blindfolding Q² (with the >0 cutoff) **if** the Unit-0 spike shows seminr exposes it cheaply; **otherwise show PLSpredict `Q²_predict`** (relabel the column; the modern out-of-sample metric, Shmueli 2019) — **do not omit and do not hand-roll**. The Unit-0 spike confirms which is available.
- **No global fit indices.** SRMR: framed **only** as an exploratory approximate-fit heuristic (the convention says PLS "deliberately has none") — confirm seminr exposes it before retaining; not a gate.
- **Formative constructs (spike-UNVERIFIED):** suppress AVE+HTMT for that construct; report redundancy-analysis convergent validity (≥.70, needs an auxiliary single-item-global estimation), indicator VIF (<3), weight significance, loading-≥.50 fallback. Unit-0 spike must verify weights/VIF/redundancy under WebR≡native; **fallback: defer the formative-specific *validity tables* (not the reflective/formative mode toggle) to a follow-on if redundancy proves too heavy** — owner-visible if triggered.

### 5.3 Bootstrap & runtime

- **5,000 both** (D6). **CI type = percentile (D10)** wired identically into the WebR block and `analysis.R` (`boot.ci.type='perc'` for lavaan; matching seminr CI); BCa only at the 10k preset.
- **Single awaited call (D7)** — NOT RNG-chunked (chunking changes the resample sequence → would fail the single-call native gate). Non-blocking (WebR worker). `gc()` before/after. **Progress = elapsed timer + estimate** from spike-calibrated per-resample time; an indeterminate/elapsed bar, not per-resample counts. *(True per-resample progress would need a hand-rolled fixed-index bootstrap — noted follow-on, not in B.)*
- **Measured WASM costs (spike, for the estimate + QA):** CB-SEM mediation 5k ≈ **~2.7 min**; PLS 5k ≈ **~8.5 min**; PLS 10k ≈ **~17 min**. seminr bootstrap uses the existing `makeCluster` serial shim.

---

## 6. Spec-HTML amendments (owner-visible — these change the drawn cards + consistency tests)

### 6A. INPUT cards (`telos_test_inputs.html`) — **NEW, the big one**

The drawn CB-SEM/PLS-SEM input cards currently show **drag-items-onto-canvas** (palette of column chips, "drag an item onto a construct", `+ Construct` on the amosbar) and the inputs legend says "the student drags items into constructs and draws the paths." Our hybrid decision (D1–D4) is the **opposite**. Amend the drawn cards to match:

1. **Measurement model = construct-slots form below the canvas** (rewrite zone-tags, remove the column-chip palette + "drag items onto a construct" copy + the config guides at ~lines 2586/2892).
2. **Amosbar redesign:** drop `+ Construct`; default tool **Draw path**; add zoom/pan/resize affordances.
3. **Inputs legend (~line 2911):** rewrite "drags items into constructs and draws the paths" → defines constructs in the form, draws paths on the canvas.

### 6B. OUTPUT cards (`telos_test_outputs.html`)

1. **CFA loadings** (T3): add `B · SE · z · p` alongside `Std. loading` (label stays **"Std. loading"**, not "Std. λ").
2. **CB-SEM reliability** (T4): add **ω** → `CR · AVE · ω · α`.
3. **Structural paths** (T6): add **B** alongside `Std. β`.
4. **PLS reliability** (T2): final header **exactly** `Construct · α · ρ_A · CR (ρ_C) · AVE`.
5. **PLS rMap** (~line 1184): drop/footnote `plspm`; the analysis.R PLS diagram call decided (seminr plot vs semPaths note).
6. **Code-correctness:** `compRelSEM()` not `reliability()`; `standardizedSolution()`; RMSEA 90% CI; `standardizedSolution_boot()` (`semboottools`, hand-roll fallback).

### 6C. Bundle-file manifest (consistency-test source of truth)

- **CB-SEM (8):** `table_efa-suitability.png`*, `table_efa-loadings.png`*, `table_cfa-loadings.png`, `table_reliability.png`, `table_fit-indices.png`†, `table_structural-paths.png`‡, `table_indirect-effects.png`§, `figure_path-diagram.png`. (* EFA stage · † unless df=0 · ‡ structural stage · § chained paths)
- **PLS-SEM (7):** `table_outer-model.png`, `table_reliability.png`, `table_htmt.png`, `table_structural.png`, `table_structural-quality.png`, `table_indirect-effects.png`§, `figure_path-diagram.png`.
- **howToRead / apaTemplate / rMap:** registries copy the drawn text **verbatim** from the named output-card lines (1150-1154 CB-SEM, 1181-1185 PLS) so the consistency test has a fixed source.

---

## 7. Stats engines (`src/lib/stats/`)

- **Reuse** `runCfaReliability` (by `{name,items}` — id migration doesn't touch stats).
- **`runCbSem`** — lavaan model from `constructs` (`=~`) + `paths` (`~`) + auto `:=` indirect defs; `lavaan::sem`; `fitMeasures`/`standardizedSolution`/`lavInspect rsquare`; single bootstrap call for mediation (D7, percentile CI). Path mode omits `=~`.
- **`runPlsSem`** — seminr measurement+structural from constructs/modes/paths; `estimate_pls`; `bootstrap_model` (serial shim); extract loadings/weights, reliability (reorder), HTMT, paths + **`$fSquare`**, R²/adj, **Q² (per §5.2 note)**, indirect via `specific_effect_significance`. Formative path per §5.2.
- **Engine (`engine.ts`):** add **`seminr`** to preload (lavaan/semTools/GPArotation already there; shims present). **Unit-1 decision: eager vs lazy** — seminr is the heaviest install (~14–44s) and only the PLS card needs it; measure the cold-boot delta and **prefer lazy on-demand install** (install on first `pls-sem` run) per the engine's stated size discipline, unless the delta is negligible. Record the measured cost.

## 8. Builders, emitters & catalog (corrected wiring)

- **Builders:** `buildCbSem.ts`, `buildPlsSem.ts` → `CardContent` (reuse matrix renderer for HTMT/Fornell-Larcker). `buildPlsSem` **explicitly selects+reorders** seminr's reliability matrix. Register in `RUNNERS`/`BUILDERS` (`src/lib/results/builders.ts`).
- **Emitters:** `cb-sem`/`pls-sem` in `src/lib/export/rScript/emitters/latent.ts` + `PACKAGES` (lavaan/semTools/seminr/**semboottools**/**semPlot**/ggplot2). analysis.R diagram = `semPlot::semPaths()` (CB-SEM/path) and the decided PLS call (§6B-5). df==0 shared predicate drops the LaTeX fit table.
- **Catalog (NO `decode` file exists):** `src/lib/registry/catalog.ts` — flip the **inline** `cb-sem`/`pls-sem` entries `status: 'later-slice' → 'available'` (they're inline objects carrying a `note`, not the `e()` helper), add the **path-analysis** picker entry, register specs in the `SPECS` map. Update `catalog.consistency.test.ts`, `src/lib/registry/specHtml.ts`, `docs/.../TEST_CATALOG.md`, README.
- **Registry:** `registry/cbSem.ts`, `registry/plsSem.ts` (`inputKind:'sem-canvas'`, bespoke-control metadata, tables, figures, howToRead/apaTemplate/rMap verbatim, bundleFiles per §6C) + consistency tests.

## 9. Testing (full gauntlet)

**Unit 0 — three de-risking spikes BEFORE the build (project process norm; the feasibility spike did NOT cover these):**
- **(0a) SVG→PNG raster** with the app webfonts via `html-to-image`, headless + real browser; pin DPR.
- **(0b) Single 5k bootstrap** completes in WASM for CB-SEM + PLS; calibrate timing; confirm percentile CI WebR≡native.
- **(0c) PLS extras** — `$fSquare`, the chosen Q², `specific_effect_significance` (returns a bootstrap **CI**, not just p), and a **mixed reflective+formative** model (weights, VIF, redundancy convergent validity, loading-≥.50 fallback) — all WebR≡native.

**Then:** per-card stats tests WebR≡native on `HolzingerSwineford1939`/`PoliticalDemocracy`/seminr `mobi`; `runs-in-r` adds cb-sem/pls-sem/path-analysis; consistency tests verbatim-match the amended HTML; **Playwright e2e** drives the canvas (define→draw/move/delete→drag→zoom→run→estimates→export) incl. an **explicit id-typing regression**, path-mode + df=0 suppression, and a **mixed reflective/formative** PLS run.

**Determinism gates (explicit):** chunked≡single-call is moot (single call); **figure raster** asserted by presence + a tolerant check (state hash-vs-presence choice in 0a); **state round-trip** test (serialize→deserialize preserves ids/paths/modelKind/mode/positions); one committed stats test runs the **production resample count** against native R (e2e uses a reduced nboot for time).

**Gates:** tsc 0 · full WebR vitest ×2 · e2e · fresh-clone · every statistic native-R-verified.

## 10. Units of work (serial edges annotated — for writing-plans)

- **Unit 0** — spikes 0a/0b/0c *(prerequisite; gates the rest)*.
- **Unit 1** — engine: seminr preload (eager/lazy decision + cost) *(blocks 7)*.
- **Unit 2** — state: `Construct.id` + migration + `paths`/`modelKind`/`mode`/positions + actions + `gateOk` branch + `inputKind` discriminator migration *(blocks 3,6,7)*.
- **Unit 9a** — progress-channel plumbing (Runner sig + runAll + `runProgress` state) *(blocks 6,7; do early)*.
- **Unit 3a** — static Full-AMOS `SemCanvasUI` render *(after 2)*.
- **Unit 3b** — interaction tools (draw/move/delete/zoom/pan/resize) *(after 3a)*.
- **Unit 4** — `TestConfigScreen` `sem-canvas` routing + bespoke controls.
- **Unit 5** — spec-HTML amendments (§6A+6B) + registries cbSem/plsSem + consistency tests.
- **Unit 6** — `runCbSem` + builder + emitter + stats test + runs-in-r *(after 1,2,9a)*.
- **Unit 7** — `runPlsSem` + builder + emitter + stats test + runs-in-r *(after 0c,1,2,9a)*.
- **Unit 3c** — post-run estimates overlay + `captureNode` figure raster *(after 6/7)*.
- **Unit 8** — path-analysis entry + observed mode + shared df==0 predicate + test.
- **Unit 10** — catalog/specHtml/docs; integration; full gates; owner click-through.

## 11. Owner rulings (all resolved 2026-06-20)

1. **Input-card amendments (§6A)** — **accepted.** Rewrite the drawn CB-SEM/PLS-SEM input cards + inputs legend from drag-onto-canvas to form-defines + paths-only canvas (+ amosbar redesign). The faithful realization of D1–D4.
2. **Output-card amendments (§6B)** — **accepted.** Add B columns (CFA loadings, structural paths), ω (CB-SEM reliability), α (PLS reliability) — required by the approved convention.
3. **CI type (D10)** — **ratified.** Percentile@5k both tracks; BCa at the 10k preset.
4. **`cfa-only` mode (§3.4)** — **keep**, default to the full model, pipeline toggles optional/advanced (supports + teaches the two-step convention without burdening beginners).
5. **PLS Q² (§5.2)** — if the Unit-0 spike shows classic blindfolding Q² is not cheaply available, **show PLSpredict `Q²_predict`** (relabeled); do not omit or hand-roll.

Everything is ruled (D1–D11 + the five above).

---

*Out of scope (`ROADMAP.md`): multigroup/invariance · moderation · row-subsetting · model comparison.*
