# SEM Sub-slice B — Final build + gate record (CB-SEM · PLS-SEM · Path analysis + AMOS canvas)

**Built:** 2026-06-21 (overnight autonomous run, owner asleep, granted "build to green; update + audit docs; make sure everything works").
**Method:** subagent-driven (`superpowers:subagent-driven-development`) — per task: implementer + independent reviewer + fix loop; ledger `.git/sdd/progress.md`.
**State:** all on **local `main`** — **NOTHING PUSHED, NOTHING DEPLOYED** (both are the owner's calls).

## What shipped
The final two tests + path analysis, built around the hybrid AMOS canvas. Catalog now **48 leaves, all available**.
- **CB-SEM** (lavaan): EFA→CFA→fit→structural pipeline, reliability (ω/α/AVE/CR), structural paths (B/SE/z/p/β/CI/R²), bootstrapped indirect effects, df==0 saturation suppression. Construct-named path labels.
- **PLS-SEM** (seminr): outer model, reliability (α/ρA/CR/AVE), HTMT, structural (β/t/p/CI/f²), R²/R²adj/Q²_predict, indirect effects, reflective+formative.
- **Path analysis**: observed-only CB-SEM mode (no measurement model; rectangles; df==0 saturation). Engine + export proven in native R.
- **AMOS canvas** (`SemCanvas`): Full-AMOS render, draw/move/delete/zoom/pan/resize, post-run β/loading/R² estimates overlay, figure rasterized to PNG via `captureNode`.

## Final gate — ALL GREEN (local `main`)
- `tsc --noEmit` 0 · `npm run build` clean
- `npm run test:fast` ×2 = 1119 then 1120 (deterministic; +1 from the matrix-domId fix)
- `npm test` (full WebR vitest, incl. native-R `runs-in-r` gate) = **1308/1308, 0 skipped** — every statistic WebR ≡ native R 4.6.0, incl. the native-R run of all 3 SEM emitters' `analysis.R`
- `npx playwright test` = **18/18** (incl. the CB-SEM canvas journey: define→draw→move→delete→zoom→run→annotated diagram)
- fresh-clone (`git clone` + `npm ci` + tsc 0 + test:fast) — self-contained

**Statistical correctness:** independently re-verified in native R — CB-SEM matches Bollen PoliticalDemocracy exactly (`all.equal(fixture, lavaan::PoliticalDemocracy)` = 0); PLS-SEM matches `seminr::mobi` (rhoA byte-identical to 10 dp). The seminr bootstrap now runs in WebR via the `makeCluster` serial shim (the single biggest unproven risk — de-risked).

## Two production bugs found + fixed during the gate (beyond the plan)
1. **Figure not mounted on the results screen** — the post-run annotated SemCanvas was never rendered on results, so the figure assertion AND production `captureNode` figure-export (`toPng(null)`) were both broken. Mounted the connected SemCanvas (gated to sem-canvas; non-SEM cards byte-identical). Caught by un-skipping the canvas e2e.
2. **Matrix-table export DOM-id mismatch** — Task-33's domId collision-overrides weren't honored by the ApaTable matrix branch, so PLS HTMT export hung (`toPng(null)`). Fixed (`id={table-${domId ?? id}}`); AVE/EFA matrices unaffected. Caught by PLS-SEM's first full UI run (the doc capture).

## Per-test documentation
- `docs/test-documentation/46_cb-sem` + `47_pls-sem` generated through the real app + audited (correct cards, LaTeX compiles incl. HTMT matrix, full export bundle, READMEs). PLS-SEM is now end-to-end UI-proven.
- **path-analysis docs DEFERRED** — see open item #1 (canvas path-mode UI bridge).

## OPEN ITEMS / RULINGS FOR THE OWNER (none block the gate; all in `.git/sdd/progress.md`)
1. **Canvas→runner bridge for PATH mode is unwired (the one real gap).** Path analysis works at the engine/export level (native-R proven) but is **not yet runnable from the UI canvas**: `freshSetup` seeds neither `modelKind` nor `constructs`, there's no `setModelKind`, and path-mode canvas nodes use array-index ids while the runner reads `setup.constructs` by id. Wiring it (on entering path mode: `modelKind:'path'` + seed constructs from columns) touches the path-mode input UX — **left for your call** rather than designed unilaterally. CB-SEM / PLS-SEM (latent, form + canvas) run fine from the UI.
2. **The 2 canvas questions from before the build** — canvas look matches your vision? node-delete = paths-only (kept) or also delete constructs on canvas?
3. **Results-screen canvas is fully interactive post-run** (editing doesn't corrupt the stored result/export, but can diverge the on-screen diagram) — a read-only variant is a small follow-up.
4. **Q² column label**: the value shown is PLSpredict `Q²_predict` (seminr lacks classic blindfolding Q²); the card column header reads **`Q²`** (the spike preferred `Q²_predict`). Relabel?
5. **Bootstrap time estimate**: implemented spike-calibrated (~2.7 min PLS 5k) over the plan's stale 8.5 min. Confirm.
6. **Carryover**: SEM-A ratify (`reviews/2026-06-19-sem-reliability-factor-ratify.md`), econometrics ratify, design-theme menu, §6B prose-completeness (ω in how-to-read/APA), the 47-vs-48 count framing, first deploy, push cadence.

**Deferred (in ROADMAP):** multigroup/invariance, moderation, row-subsetting, model comparison.

**NEVER push or deploy without the owner's explicit word.**
