# Telos SEM slice — Sub-slice A: Reliability & Factor Analysis (design)

> **2026-06-19.** First of two SEM sub-slices (sub-slice B = CB-SEM/PLS-SEM + AMOS canvas, separate spec). Builds the 5 no-canvas cards **Cronbach's α, AVE, Composite Reliability, EFA, PCA** plus the shared infrastructure the SEM cards will reuse. Authority for every reporting choice = the owner-approved **`docs/superpowers/reviews/2026-06-18-sem-reporting-convention.md`** (verified ×2 web-research+adversarial workflows); feasibility proven in **`docs/superpowers/reviews/2026-06-18-sem-feasibility-spike.md`** (WebR 0.6.0 ≡ native R 4.6.0 for all five packages). Owner granted autonomy (2026-06-19) to build to green on local `main`, never push/deploy, leave a ratify list, PushNotification when done.

## 1. Scope

**In scope (5 cards):** Cronbach's α, Average Variance Extracted (AVE), Composite Reliability (CR), Exploratory Factor Analysis (EFA), Principal Component Analysis (PCA). Report-only (the house policy): the student configures inputs, the app emits every table + APA sentence + figure, all statistics present, nothing to compute by hand.

**Out of scope (this sub-slice):** the AMOS canvas, CB-SEM, PLS-SEM, mediation, multigroup (all sub-slice B / later). No bootstrap-progress UI (A's only resampled CI — ω's — is a fast single-scale inline run; the progress-bar infra is built in B).

**Success criteria (verifiable):** every statistic in every card reproduces native R 4.6.0 within tolerance (the `runs-in-r` gate + full WebR vitest); per-card consistency tests tie registry ↔ spec HTML; e2e drives each new card; tsc 0; fresh-clone green.

## 2. Per-card specification

Cutoffs are stated as **labelled guidelines, not pass/fail gates** (report-only policy); the how-to-read text carries the benchmark + citation. All tables/figures match the convention §2 (which refines the spec HTML).

### Card 1 — Cronbach's α (one scale; flat item set)
- **Input:** one role `items` (≥3 item columns, interval/ordinal). No grouping.
- **Outputs:**
  - **T1 Reliability:** **McDonald's ω (headline)** · Cronbach's α · 95% CI · N items · N cases. *(ω is the headline per convention §4a; α retained as a secondary column.)*
  - **T2 Item-total statistics:** Item · corrected item-total r · α-if-item-dropped.
  - **Figure:** item-total correlation bar chart.
- **Engine:** `psych::alpha` (α + its 95% CI [Feldt], corrected item-total, α-if-dropped); ω + ω 95% CI via `semTools::compRelSEM` on a 1-factor `cfa` (bootstrap CI, single scale → fast, inline) with `psych::omega` cross-check.
- **APA:** "Internal consistency was high, ω = .__ (95% CI [.__, .__]); Cronbach's α = .__." Cutoffs: ≥.70 acceptable, ≥.80 good, >.95 redundant (guideline).

### Card 2 — AVE (convergent + discriminant validity; construct slots)
- **Input:** **construct slots** (repeatable named blocks; ≥1 construct, ≥2 items each; the discriminant matrices require ≥2 constructs — see §5 constraint).
- **Outputs:**
  - **T1 Convergent validity:** Construct · AVE · CR · ω · α.
  - **T2 Discriminant validity — Fornell-Larcker:** **matrix** (constructs × constructs), √AVE on the diagonal vs inter-construct correlations.
  - **T3 Discriminant validity — HTMT:** **matrix** (HTMT primary per §4c; Fornell-Larcker legacy/secondary).
  - **Figure:** AVE/CR bar chart per construct.
- **Engine:** one `lavaan::cfa` fit → `semTools::AVE`, `semTools::compRelSEM` (CR=ω), `semTools::htmt`; `lavInspect(fit,"cor.lv")` + √AVE for Fornell-Larcker; `psych::alpha` per construct for α.
- **Cutoffs:** AVE ≥ .50 [V]; CR ≥ .70 (Nunnally/Bagozzi-Yi — **not** Fornell-Larcker); HTMT < .85 (distinct) / < .90 (similar) [V*]. APA: "Convergent validity was supported (all AVE ≥ .50, CR ≥ .70); discriminant validity held (all HTMT < .85)."

### Card 3 — Composite Reliability (construct slots; shares AVE's CFA fit)
- **Input:** construct slots (same as AVE).
- **Outputs:** Construct · CR · AVE · ω · α + CR bar chart.
- **Engine:** same `lavaan::cfa` + `semTools::compRelSEM`/`AVE`. APA: "Composite reliability was satisfactory (CR = .__ ≥ .70)."
- *(AVE and CR are separate cards per the spec/registry but share one CFA engine module; render both faithfully.)*

### Card 4 — EFA (flat item set + options)
- **Input:** role `items` (≥3, ideally ≥ ~5×factors); options: **extraction** (principal-axis default / ML), **rotation** (oblimin default, oblique / varimax), **retention** (parallel analysis default / Kaiser>1 / fixed n-factors).
- **Outputs:**
  - **T1 Suitability:** KMO (overall) · Bartlett χ² · df · p.
  - **T2 Variance explained:** Factor · eigenvalue · % variance · cumulative % (labelled pre/post rotation).
  - **T3 Rotated pattern loadings:** Item · F1 · F2 … · communality (rectangular classic table; suppress |loading| below a stated cutoff, default |.32|, flag cross-loaders).
  - **Interfactor-correlation matrix (Φ)** — **matrix** (required because oblimin is oblique).
  - **Figure:** scree plot with **parallel-analysis** overlay.
- **Engine:** `psych::KMO`, `psych::cortest.bartlett`, `psych::fa` (fm=`pa`/`ml`, rotate=`oblimin`/`varimax`) → loadings/communalities/Φ; **hand-rolled parallel analysis** (psych::fa.parallel fails in WASM); **deterministic factor ordering** (sort by SS loadings).
- **APA:** "EFA (KMO = .__, Bartlett's χ²(__) = __, p < .001) with parallel analysis retained __ factors explaining __% of variance (oblimin rotation)." KMO ≥ .60 acceptable / ≥ .70 preferred (Kaiser & Rice 1974).

### Card 5 — PCA (flat item set + options; **filed under "data reduction"**)
- **Input:** role `items`; options: retention (parallel analysis default / Kaiser>1 / fixed n).
- **Outputs:**
  - **T1 Variance explained:** Component · eigenvalue · % variance · cumulative % (state correlation matrix).
  - **T2 Component loadings:** Variable · PC1 · PC2 … (state correlation-scaled loadings; **no communality column** — PCA is not a latent model, convention §2 Card 5).
  - **Figure:** scree plot (+ optional biplot).
- **Engine:** `prcomp(scale.=TRUE)` / `psych::principal`; hand-rolled parallel analysis; deterministic ordering.
- **Taxonomy:** move out of "Latent variable models" → a **"Data reduction"** subfamily/label (convention §4e); the catalog entry + picker grouping change accordingly.
- **APA:** "PCA (correlation matrix; parallel analysis) retained __ components explaining __% of total variance."

## 3. New shared infrastructure (built once, reused by A and B)

### 3.1 Matrix-table renderer — new `kind:'matrix'` BuiltTable
- **Shape:** `{ kind:'matrix', rowLabels:string[], colLabels:string[], cells:(string|number|null)[][], diagonal?:'bold'|'plain', lower?:boolean }`. Square symmetric tables where row labels = col labels; lower-triangular display (upper cells blank); optional bold diagonal (√AVE on Fornell-Larcker).
- **Renderer:** a new branch in `ApaTable.tsx` (the existing single-`<thead><tr>` model is fine — matrix headers are a single row of construct names; no spanning headers needed). Captured to PNG + zipped like every other table (`<table id="table-…">`).
- **Used by:** Fornell-Larcker (AVE), HTMT (AVE), interfactor-correlation Φ (EFA). Rectangular loadings (items × factors) stay classic tables.
- **Recommendation adopted (owner-approved direction):** a real matrix kind, not long-format faking — it is reused in sub-slice B (HTMT, latent-correlation matrices).

### 3.2 Hand-rolled parallel analysis
- `psych::fa.parallel` errors under WASM (spike). Re-implement: generate K (default 500) random/resampled datasets matching N×p, compute their eigenvalues, take the 95th percentile per component, retain factors whose observed eigenvalue exceeds the simulated percentile. Eigen-decomposition of a correlation matrix is cheap (no iterative factoring), so 500 sims is fast even in WASM. Used by EFA + PCA; native-R verified.

### 3.3 CFA reliability engine + `parallel::makeCluster` serial shim
- One shared module fits `lavaan::cfa` from construct slots and exposes AVE/CR/ω/α + the correlation matrix → feeds AVE & CR cards.
- Add the **serial `parallel::makeCluster`/`parLapply`/`clusterExport`/`clusterEvalQ`/`stopCluster`/`clusterSetRNGStream` shim** to `Engine.init`, beside the `detectCores` shim (spike: required so any clustered bootstrap runs in WASM; harmless to A's inline ω bootstrap, mandatory for B).
- **Deterministic factor ordering** helper (sort factors/components by SS loadings) applied in the EFA/PCA builders.

## 4. Inputs — construct slots (AVE/CR)
Extend the existing drag-slot config UI with a **repeatable construct block**: `[+ Add construct]` → each block has a name field + an item-column multi-select; constructs partition the chosen item columns. Stored in `TestSetup.roles`/`options` as a construct→items map (a new role kind or an options payload — implementer's call within the existing `session.ts` shape). The other three cards (α, EFA, PCA) use a single flat `items` role.

## 5. Constraints & edge cases
- **Cronbach's α:** ≥3 items (per the card min rule); listwise N reported.
- **AVE/CR:** ≥1 construct & ≥2 items/construct for AVE/CR/ω; **Fornell-Larcker + HTMT require ≥2 constructs** — with a single construct, render T1 only and note discriminant validity needs ≥2 constructs (don't error).
- **EFA/PCA:** ≥3 items; guard KMO/Bartlett on tiny samples; if a requested factor count exceeds what's identified, report and fall back.
- **Heywood cases / non-convergence** (CFA for AVE/CR): report cleanly, don't white-screen (ResultBoundary already exists).
- **Listwise deletion** per card, N reported (project convention).

## 6. Wiring (per existing pattern, ×5)
For each card: `src/lib/registry/<id>.ts` (TestSpec) → `src/lib/stats/<id>.ts` (R + result interface + runner) → `src/lib/results/build<Id>.ts` (builder → CardContent) → register in `builders.ts` (RUNNERS/BUILDERS) → emitter in a new `src/lib/export/rScript/emitters/latent.ts` (+ PACKAGES) → add to `catalog.ts` SPECS, flip status `later-slice`→`available` → `<id>.consistency.test.ts`. **Spec HTML** (`telos_test_outputs.html` / `telos_test_inputs.html`) updated to the convention (ω-headline, HTMT matrix, interfactor-corr, real EFA estimator labels, PCA "data reduction") via the established depth-counting splice; consistency tests enforce registry ↔ HTML.

## 7. Build order (worked-reference-then-fanout)
1. **Infra first:** matrix renderer + `makeCluster` shim + hand-rolled parallel analysis + deterministic ordering (landed via the first cards that exercise them).
2. **Cronbach's α** — warm-up reference (reliability stats, trio, ω display, bar chart).
3. **AVE** — rich reference (CFA engine + matrix renderer + construct slots + Fornell-Larcker/HTMT).
4. **CR** — mirrors AVE (shared engine).
5. **EFA** — factor engine + parallel analysis + Φ matrix + estimator/rotation options.
6. **PCA** — mirrors EFA (data-reduction framing, no communalities).

## 8. Testing / gates
Per-card consistency tests; stats verified WebR ≡ native R 4.6.0 (`runs-in-r` reps for each new card + full WebR vitest); e2e drives the new cards (config → run → tables/figures → export unzip); tsc 0; fresh-clone (install→build→test:fast→runs-in-r). Same gauntlet as every prior slice, ×2 + fresh-clone for the final gate.

## 9. Ratify list (judgment calls taken; owner confirms at click-through)
1. **ω-headline wording** on the α card (ω first, α secondary) — convention-approved; confirm the rendered look.
2. **ω 95% CI via inline bootstrap** (single scale, fast) vs ω point-only — taken: include the CI (matches convention APA).
3. **EFA defaults:** extraction = principal-axis, rotation = oblimin, retention = parallel analysis — taken per convention; exposed as options.
4. **PCA relocated** out of "Latent variables" into a "Data reduction" group (convention §4e) — confirm the taxonomy label.
5. **AVE/CR remain two cards** sharing one CFA engine (per spec/registry) — confirm.
6. **Loading suppression cutoff** default |.32| (Tabachnick & Fidell) — confirm.
7. **Spec HTML edited to the convention** (ω/HTMT/Φ/estimator/data-reduction) — faithful to the approved convention, but it touches "his design canvas," so flagged.

## 10. Not building / deferred
AMOS canvas, CB-SEM, PLS-SEM, mediation, multigroup, bootstrap-progress UI, `semboottools`/`semPlot` (sub-slice B decides). `psych::omega` higher-order/bifactor variants beyond the headline ω.
