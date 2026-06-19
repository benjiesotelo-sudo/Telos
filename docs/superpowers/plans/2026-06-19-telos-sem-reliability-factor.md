# SEM Sub-slice A — Reliability & Factor Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 5 no-canvas SEM cards — Cronbach's α, AVE, Composite Reliability, EFA, PCA — report-only, every statistic WebR ≡ native R 4.6.0, on the approved reporting convention.

**Architecture:** Reuse the established stats→builder→emitter→consistency-test trio (41 existing tests). Build three shared pieces first (a matrix-table renderer, hand-rolled parallel analysis, a CFA reliability engine + the `parallel::makeCluster` serial shim), then Cronbach's α as the worked reference, then fan out AVE/CR/EFA/PCA. Spec HTML is updated to the convention and held in sync by consistency tests.

**Tech Stack:** React 19 + TypeScript + Vite 8, WebR 0.6.0 (R 4.6.0) via `src/lib/webr/engine.ts`, vitest 4, Playwright. R packages: `psych`, `lavaan`, `semTools`, `GPArotation` (all spike-verified to load + match native R).

## Global Constraints

- **Authority:** `docs/superpowers/reviews/2026-06-18-sem-reporting-convention.md` (§2 per-card, §4 rulings) + `docs/superpowers/specs/2026-06-19-telos-sem-reliability-factor-design.md`. Render the convention faithfully.
- **Report-only:** cutoffs are labelled guidelines in how-to-read text, never pass/fail verdicts the card "declares".
- **Reliability headline = McDonald's ω; Cronbach's α secondary column** (convention §4a).
- **Discriminant validity: HTMT primary, Fornell-Larcker secondary** (§4c). **CR ≥ .70 cited to Nunnally/Bagozzi-Yi, NOT Fornell-Larcker; KMO labels to Kaiser & Rice 1974** (§5 attribution traps).
- **Factor retention default = parallel analysis** (hand-rolled; `psych::fa.parallel` fails in WASM). **EFA extraction default = principal-axis, rotation = oblimin.**
- **PCA filed under a "Data reduction" group, NOT "Latent variable models"** (§4e); no communalities column.
- **Emit `compRelSEM()` (ω; `tau.eq=TRUE` for α) — NEVER the deprecated `semTools::reliability()`.**
- **`parallel::makeCluster` serial shim is mandatory** in `Engine.init` (WASM has no sockets).
- **Build on local `main`, commit per task, NEVER push/deploy.** Every R statistic native-R-verified (the `runs-in-r` gate). tsc 0 each task.
- **Listwise deletion per card, report N** (project convention).

---

## File Structure

**Create:**
- `src/lib/webr/parallelShim.ts` — the `makeCluster` serial-shim R string (added to `Engine.init`).
- `src/lib/stats/parallelAnalysis.ts` — hand-rolled parallel analysis R + helper (shared by EFA/PCA).
- `src/lib/stats/factorOrder.ts` — deterministic factor/component ordering helper.
- `src/lib/stats/cfaReliability.ts` — shared CFA fit → AVE/CR/ω/α/cor.lv (shared by AVE/CR).
- `src/lib/stats/{cronbachsAlpha,ave,compositeReliability,efa,pca}.ts` — per-card R + result interface + runner.
- `src/lib/registry/{cronbachsAlpha,ave,compositeReliability,efa,pca}.ts` — TestSpec each.
- `src/lib/results/{buildCronbachsAlpha,buildAve,buildCompositeReliability,buildEfa,buildPca}.ts` — builders.
- `src/lib/export/rScript/emitters/latent.ts` — R-script emitters + PACKAGES for the 5 cards.
- `src/lib/registry/{cronbachsAlpha,ave,compositeReliability,efa,pca}.consistency.test.ts` — registry↔HTML.
- `src/lib/stats/{...}.test.ts` — engine known-answer tests (one per card) + `parallelAnalysis.test.ts`, `cfaReliability.test.ts`.
- `src/components/ConstructSlots.tsx` — the AVE/CR construct-grouping input.

**Modify:**
- `src/lib/results/types.ts` — add `MatrixTable` to the `BuiltTable` union.
- `src/components/ApaTable.tsx` — add the matrix-table render branch.
- `src/lib/webr/engine.ts` — add the `makeCluster` shim to `init`.
- `src/lib/registry/catalog.ts` — flip the 5 statuses to `available`, add to `SPECS`, move PCA to a "Data reduction" group.
- `src/lib/results/builders.ts` — register 5 RUNNERS + BUILDERS.
- `src/lib/export/rScript/emitters/index.ts` — merge `latent.ts`.
- `src/components/screens/TestConfigScreen.tsx` — render `ConstructSlots` for AVE/CR.
- `telos_test_outputs.html` / `telos_test_inputs.html` — update the 5 cards to the convention.
- `src/state/session.ts` — construct-map shape in `TestSetup` if needed for AVE/CR.

---

## Phase 0 — Shared infrastructure

### Task 1: `parallel::makeCluster` serial shim (Engine)

**Files:** Create `src/lib/webr/parallelShim.ts`; Modify `src/lib/webr/engine.ts`.

**Interfaces — Produces:** `export const MAKECLUSTER_SHIM: string` (an R block); applied via `webr.evalRVoid(MAKECLUSTER_SHIM)` in `Engine.init` after the detectCores shim.

- [ ] **Step 1:** Write `parallelShim.ts` exporting the verified shim (from the spike — `2026-06-18-sem-spike-data/webr-sem-spike.test.ts`): shim `makeCluster`/`makePSOCKcluster`/`makeForkCluster`→dummy cluster; `parLapply`/`parSapply`→serial (dropping `chunk.size`); `clusterExport`/`clusterEvalQ`/`clusterCall`/`clusterApply`/`clusterApplyLB`/`stopCluster`/`clusterSetRNGStream`→no-op.
- [ ] **Step 2:** In `engine.ts` `init()`, after `evalRVoid(DETECTCORES_SHIM)`, add `await this.webr.evalRVoid(MAKECLUSTER_SHIM)`. Add `lavaan`, `semTools`, `GPArotation` to the preload package loop (psych already present).
- [ ] **Step 3:** Add `src/lib/stats/cfaReliability.test.ts` smoke test: a small 2-construct `cfa` + `semTools::compRelSEM` runs under the Engine and returns finite ω — proves the shim + packages load. Expected native values cross-checked.
- [ ] **Step 4:** Run `npx vitest run src/lib/stats/cfaReliability.test.ts` — PASS.
- [ ] **Step 5:** Commit `feat(sem): makeCluster serial shim + lavaan/semTools/GPArotation preload`.

### Task 2: Matrix-table renderer (`kind:'matrix'`)

**Files:** Modify `src/lib/results/types.ts`, `src/components/ApaTable.tsx`; Test `src/components/ApaTable.test.tsx`.

**Interfaces — Produces:** `MatrixTable = { kind:'matrix'; id:string; caption:string; rowLabels:string[]; colLabels:string[]; cells:(string|number|null)[][]; diagonal?:'bold'|'plain'; lowerOnly?:boolean }`; added to the `BuiltTable` union. ApaTable renders a single `<thead><tr>` (corner cell + colLabels) then one `<tr>` per row (rowLabel + cells); `null`/upper-triangle cells render blank; `diagonal:'bold'` wraps the diagonal cell in `<strong>`.

- [ ] **Step 1:** Add `MatrixTable` to the `BuiltTable` union in `types.ts`.
- [ ] **Step 2:** Add `ApaTable.test.tsx` cases: a 3×3 lower-triangular matrix renders 3 body rows, blank upper cells, bold diagonal when `diagonal:'bold'`, and a `<table id="table-...">` wrapper (capture/zip parity).
- [ ] **Step 3:** Run the test — FAIL (no matrix branch).
- [ ] **Step 4:** Implement the `spec.kind === 'matrix'` branch in `ApaTable.tsx` + matrix styles in `tokens.css`.
- [ ] **Step 5:** Run the test — PASS; `npx tsc -b` clean. Commit `feat(results): matrix-table renderer (kind:matrix)`.

### Task 3: Hand-rolled parallel analysis

**Files:** Create `src/lib/stats/parallelAnalysis.ts`, `src/lib/stats/factorOrder.ts`; Test `src/lib/stats/parallelAnalysis.test.ts`.

**Interfaces — Produces:**
- R string `R_PARALLEL_ANALYSIS` (env: `x` = numeric matrix, `kind` = `'fa'|'pca'`, `nsim` = 500, `seed`): returns `{ retain:int, observed:number[], simP95:number[] }` — observed eigenvalues vs the 95th-percentile simulated eigenvalues; retain = count where observed > simP95.
- `orderFactors(loadings, phi?)` (TS) — returns a column permutation sorting by descending SS-loadings, applied in EFA/PCA builders.

- [ ] **Step 1:** Write `R_PARALLEL_ANALYSIS` (eigen of `cor()` on N×p random-normal data ×`nsim`, seeded; 95th percentile per component). For `kind='fa'` use the reduced correlation matrix (SMC on the diagonal) as psych does.
- [ ] **Step 2:** `parallelAnalysis.test.ts`: on HolzingerSwineford1939 x1–x9, retain == 3 (matches the spike's native fa.parallel = 3). Cross-check `observed` eigenvalues vs native R.
- [ ] **Step 3:** Run — implement to PASS. Add `factorOrder.ts` + a unit test (pure TS, deterministic permutation).
- [ ] **Step 4:** `npx vitest run src/lib/stats/parallelAnalysis.test.ts` — PASS.
- [ ] **Step 5:** Commit `feat(sem): hand-rolled parallel analysis + deterministic factor ordering`.

---

## Phase 1 — Worked reference: Cronbach's α

### Task 4: Cronbach's α — stats module

**Files:** Create `src/lib/stats/cronbachsAlpha.ts`, `src/lib/stats/cronbachsAlpha.test.ts`.

**Interfaces — Produces:** `runCronbachsAlpha(engine, data, items:string[]): Promise<CronbachResult>` where `CronbachResult = { omega:number; omegaCi:[number,number]; alpha:number; alphaCi:[number,number]; nItems:number; nCases:number; itemTotal:{item:string; r:number; alphaDropped:number}[]; figItemTotalPng:Uint8Array }`.

- [ ] **Step 1:** Write the engine test with native-R known answers: build a fixture (reuse an existing CSV with ≥3 correlated numeric columns, or add `tests/e2e/fixtures/scale.csv`), assert `alpha`, `itemTotal[i].r`, `alphaDropped[i]` to 4 dp against `Rscript`-computed values (add a rep to `runs-in-r`).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement: `R_STATS` = `psych::alpha(d)` (α, its 95% CI via `$feldt`/`$total`, corrected item-total `$item.stats$r.drop`, `$alpha.drop$raw_alpha`); ω + ω 95% CI via a 1-factor `lavaan::cfa(std.lv=TRUE, se='bootstrap', bootstrap=2000)` + `semTools::compRelSEM` with `boot.ci`; `R_FIG` = item-total `ggplot2` bar chart. `runCronbachsAlpha` filters listwise, binds env, `runJson` + `capturePlot`.
- [ ] **Step 4:** Run engine test — PASS (WebR), and the `runs-in-r` rep — PASS (native).
- [ ] **Step 5:** Commit `feat(sem): Cronbach's alpha stats module (omega headline)`.

### Task 5: Cronbach's α — registry + builder + emitter + consistency + HTML + wire

**Files:** Create `src/lib/registry/cronbachsAlpha.ts`, `src/lib/results/buildCronbachsAlpha.ts`, `src/lib/registry/cronbachsAlpha.consistency.test.ts`; Modify `catalog.ts`, `builders.ts`, `emitters/latent.ts`(+index), `telos_test_outputs.html`/`telos_test_inputs.html`.

**Interfaces — Produces:** `CRONBACHS_ALPHA: TestSpec`; `buildCronbachsAlpha(spec, result): CardContent`; emitter `'cronbachs-alpha'`.

- [ ] **Step 1:** Update the α card in `telos_test_outputs.html` to the convention (T1 ω-headline + α + 95% CIs + N items + N cases; T2 item-total; bar chart; APA ω-first) and `telos_test_inputs.html` (one `items` role, ≥3).
- [ ] **Step 2:** Write `cronbachsAlpha.consistency.test.ts` (mirrors the existing pattern — captions/columns/roles/options/APA/bundleFiles vs the HTML). Run — FAIL (no spec).
- [ ] **Step 3:** Write `CRONBACHS_ALPHA` TestSpec (roles/options/constraints minRule items≥3/tables/figures/howToRead/apaTemplate/rMap/bundleFiles) to satisfy the consistency test; write `buildCronbachsAlpha` (classic T1/T2 + figure). Register RUNNER/BUILDER; add to `catalog.ts` SPECS + flip status `available`; add emitter + PACKAGES (`psych`,`lavaan`,`semTools`) to `latent.ts`; merge in `index.ts`.
- [ ] **Step 4:** Run consistency + `npx tsc -b` + `npm run test:fast` — PASS.
- [ ] **Step 5:** Commit `feat(sem): Cronbach's alpha card (registry/builder/emitter/consistency)`.

### Task 6: Cronbach's α — emitter native-R verification

- [ ] **Step 1:** Add a `runs-in-r` rep for `cronbachs-alpha` (emitted `analysis.R` runs under native R 4.6.0, asserts an expected α/ω substring).
- [ ] **Step 2:** Run the emitter through `Rscript` — PASS. Commit `test(sem): cronbachs-alpha runs-in-r rep`.

---

## Phase 2 — AVE & Composite Reliability (shared CFA engine + matrices + construct slots)

### Task 7: Construct-slots input

**Files:** Create `src/components/ConstructSlots.tsx`; Modify `TestConfigScreen.tsx`, `src/state/session.ts` (construct-map shape).

**Interfaces — Produces:** constructs stored as `setup.options.constructs: { name:string; items:string[] }[]`; `ConstructSlots` renders repeatable named blocks (name field + item-column multi-select from the dataset columns), `[+ Add construct]`, remove-construct, validation (≥1 construct, ≥2 items each; partitioned columns).

- [ ] **Step 1:** Component test (vitest + RTL): add/name/assign/remove constructs updates the store; renders the dataset's numeric columns as options.
- [ ] **Step 2:** Run — FAIL. Implement `ConstructSlots`; wire into `TestConfigScreen` for `cb`-less latent tests with a `constructs` input flag on the spec.
- [ ] **Step 3:** Run — PASS; tsc clean. Commit `feat(sem): construct-slots input for AVE/CR`.

### Task 8: Shared CFA reliability engine

**Files:** Create `src/lib/stats/cfaReliability.ts` (expand the Task-1 smoke into the real module); Test extends `cfaReliability.test.ts`.

**Interfaces — Produces:** `runCfaReliability(engine, data, constructs): Promise<{ perConstruct:{name:string; ave:number; cr:number; omega:number; alpha:number}[]; fornellLarcker:number[][]; htmt:number[][]; labels:string[] }>` — one `lavaan::cfa` built from the construct map → `semTools::AVE`/`compRelSEM`/`htmt` + `lavInspect(cor.lv)` + √AVE diagonal; `psych::alpha` per construct.

- [ ] **Step 1:** Engine test: HolzingerSwineford 3-construct model → assert AVE (.371/.721/.424), ω (.612/.885/.686), HTMT (.384/.387/.280) to 3 dp vs the spike's native values.
- [ ] **Step 2:** Run — implement (build lavaan model string from `constructs`; native-R-verified) to PASS. Add a `runs-in-r` rep.
- [ ] **Step 3:** Commit `feat(sem): shared CFA reliability engine (AVE/CR/omega/HTMT)`.

### Task 9: AVE card  &  ### Task 10: Composite Reliability card

Each follows the Task-4/5/6 pattern on the shared engine:
- **AVE** — T1 Construct/AVE/CR/ω/α (classic), T2 Fornell-Larcker (**matrix**, √AVE bold diagonal), T3 HTMT (**matrix**), AVE/CR bar chart; constraint ≥1 construct (≥2 for the matrices — else render T1 + a note); APA convergent+discriminant. Update HTML AVE card to add the HTMT matrix.
- **CR** — Construct/CR/AVE/ω/α (classic) + CR bar chart; same engine.
- Each task: registry + builder + emitter + consistency + `runs-in-r` rep + wire; tsc + test:fast green; commit.

---

## Phase 3 — EFA & PCA

### Task 11: EFA card

**Files:** `src/lib/stats/efa.ts`(+test), `src/lib/registry/efa.ts`, `src/lib/results/buildEfa.ts`, consistency test; HTML EFA card.

- [ ] T1 suitability (KMO/Bartlett χ²/df/p); T2 variance explained; T3 rotated pattern loadings + communality (classic, ordered via `factorOrder`, suppress |.32|); **interfactor-corr Φ (matrix)**; scree + parallel-analysis figure. Options: extraction (PAF/ML), rotation (oblimin/varimax), retention (parallel/Kaiser/fixed-n). Engine `psych::fa`/`KMO`/`cortest.bartlett` + `R_PARALLEL_ANALYSIS`. Native-R-verified (KMO .752, Bartlett 904.1, retain 3, loadings/communalities/Φ from the spike). Registry/builder/emitter/consistency/`runs-in-r`/HTML/wire; commit.

### Task 12: PCA card

**Files:** `src/lib/stats/pca.ts`(+test), `src/lib/registry/pca.ts`, `src/lib/results/buildPca.ts`, consistency test; HTML PCA card; `catalog.ts` "Data reduction" group.

- [ ] T1 variance explained; T2 component loadings (correlation-scaled, ordered, **no communality**); scree (+biplot). Engine `prcomp(scale.=TRUE)`/`psych::principal` + `R_PARALLEL_ANALYSIS`. Move PCA to a **"Data reduction"** catalog group/label (out of "Latent variable models"); update the picker grouping + the eligibility/grouping if needed. Native-R-verified (eigenvalues 3.216/1.639/…). Registry/builder/emitter/consistency/`runs-in-r`/HTML/wire; commit.

---

## Phase 4 — Integration & final gate

### Task 13: e2e

- [ ] Extend a Playwright spec to drive each new card (or a representative subset incl. AVE construct-slots + a matrix table + EFA scree): pick test → configure → run → assert tables/figures render → export → unzip asserts the bundle files. Update any zip-count assertions.

### Task 14: catalog/decode integration + docs

- [ ] `catalog.consistency` + the HTML-entity decode list (add any new glyphs: √, etc.). Regen `docs/TEST_CATALOG.md` via the generator. README test count bump.

### Task 15: Final gate (×2 + fresh-clone) + ratify + notify

- [ ] Background gate: build · full WebR vitest ×2 · e2e · fresh-clone (install→build→test:fast→`runs-in-r`) · native-R reps for all 5 cards. On GREEN: finalize the ratify note in the convention doc, update memory, **PushNotification** (build green + ratify list). NEVER push/deploy.

---

## Self-Review

- **Spec coverage:** all 5 cards (Tasks 4–12) + matrix renderer (2) + parallel analysis (3) + shim (1) + construct slots (7) + CFA engine (8) + spec-HTML updates (in each card task) + gates (13–15). Convention §2 cards ✓, §3 infra ✓, §5 constraints ✓, §9 ratify items surfaced in Task 15.
- **Placeholder scan:** per-card R is written test-first against native-R known answers (the spike supplies the reference values for HS/PD datasets); no "TBD".
- **Type consistency:** `MatrixTable` (Task 2) consumed by AVE/EFA builders (9/11); `runCfaReliability` (8) consumed by AVE/CR (9/10); `R_PARALLEL_ANALYSIS`/`orderFactors` (3) consumed by EFA/PCA (11/12); `CronbachResult`/`runCronbachsAlpha` (4) consumed by builder (5).

## Execution

Subagent-driven (recommended), worked-reference-then-fanout: Phase 0 + Cronbach's α as the reference (review + commit), then AVE/CR and EFA/PCA fanned out, controller integrates + runs the per-wave gate (tsc + test:fast incl. consistency), full WebR vitest + `runs-in-r` at the integration gate, ×2 + fresh-clone at the final gate.
