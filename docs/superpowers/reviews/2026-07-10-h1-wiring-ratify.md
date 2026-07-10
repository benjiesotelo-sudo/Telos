# H1 wiring slice - ratify document (2026-07-10)

Slice: estimator + missing-data dropdowns drive the lavaan fit (spec `docs/superpowers/specs/2026-07-10-h1-estimator-missing-wiring-design.md`, plan `docs/superpowers/plans/2026-07-10-h1-estimator-missing-wiring.md`).
Base commit `aa8f03a`; final slice commit at gate time listed in section D.
This document collects every ruling applied during the build, the verification-matrix evidence, and the items HELD FOR BENJIE.
Never pushed; push and deploy remain Benjie's word only.

## A. What shipped

The CB-SEM card's estimator dropdown (ML / MLR / WLSMV) and missing-data dropdown (listwise / FIML / pairwise) now genuinely parameterize the lavaan fit, identically in the app and in the exported analysis.R.
A new pure module `src/lib/stats/semFitArgs.ts` is the single source of truth for the lavaan argument fragment, the guard errors, and the disclosure facts; `runCbSem.ts` and the latent export emitter both consume it, so app and export arguments are byte-identical by construction.
MI is removed from the missing dropdown (owner ruling 1); WLSMV auto-declares `ordered=` from Configure-data column levels (ruling 2); bootstrap runs under estimator ML only, with MLR/WLSMV reporting robust SEs and delta-method CIs through the existing `bootstrapped: false` path (ruling 3); and the step-4a mismatch note is wired (plan Task 2 - not spec ruling 4, which is the Approach B architecture ruling; fixed a mislabel here during the final-review fix wave).
Untouched defaults (ML + listwise) emit an empty fragment and stay byte-identical everywhere, except the spec-governed always-on Estimation note and APA estimator naming (see ruling B4).
Results cards carry estimator-aware fit labels ((scaled)/(robust)), APA estimator naming, and Estimation/ordinal/FIML/pairwise/delta disclosures; exports carry the same fragment plus a student-readable comment block; four new method citations attach conditionally, only when the option that earns them actually ran.

### Verification matrix (7 cells, WebR result vs native R 4.6.0 pins)

Pins live in `src/lib/stats/h1Pins.ts` (per-value provenance comments name the capture file and line).
Real-WebR known-answer tests: `src/lib/stats/runCbSem.test.ts` (Task 5, 25/25 in ~4m21s).
Native-R export proof: `src/lib/export/rScript/runs-in-r.test.ts` (+7 REPs, one per cell).

| Cell | Estimator | Missing | Fixture | Tolerance vs native pin | Result |
|---|---|---|---|---|---|
| 1 | ML | listwise | politicalDemocracy-missing.csv | toBeCloseTo(pin, 7) | GREEN |
| 2 | ML | fiml (missing = "ml") | politicalDemocracy-missing.csv | toBeCloseTo(pin, 7) | GREEN |
| 3 | ML | pairwise | politicalDemocracy-missing.csv | toBeCloseTo(pin, 7) | GREEN |
| 4 | MLR | listwise | politicalDemocracy-missing.csv | toBeCloseTo(pin, 7) | GREEN |
| 5 | MLR | fiml (missing = "ml") | politicalDemocracy-missing.csv | toBeCloseTo(pin, 7) | GREEN |
| 6 | WLSMV | listwise | likert5-missing.csv | toBeCloseTo(pin, 5) (see ruling B2) | GREEN |
| 7 | WLSMV | pairwise | likert5-missing.csv | toBeCloseTo(pin, 5) (see ruling B2) | GREEN |

MLR + pairwise is deliberately NOT a cell: it is lavaan-invalid (ruling B1), so the matrix is 7 cells, not the plan's original 8.
Both WLSMV cells are machine-verified PROPER solutions (ruling B5).

## B. Rulings applied during the build (each needs Benjie's ratify)

1. **MLR + pairwise = lavaan-invalid; matrix is 7 cells and the combination is guarded.**
   The Task 0 spike root-caused a hard lavaan error (`eigen(): infinite or missing values` inside the robust vcov step) for `estimator = "MLR", missing = "pairwise"` in BOTH native R and WebR; lavaan itself documents pairwise as scoped to the (W)LS family.
   Ruling: the production dropdown guards the combination (semFitArgs throws before any engine call; SemControls greys it) and it gets no known-answer cell.
   Evidence: `docs/superpowers/reviews/2026-07-10-h1-estimator-spike.md` (Q2); guard tests in `src/lib/stats/semFitArgs.test.ts`; module doc comment in `src/lib/stats/h1Pins.ts`.
   Softened claim (final-review fix wave, Important I3 note): "SemControls greys it" only greys the OPTION currently being chosen, not a selection already in place - neither dropdown resets the other on change, so two selection-order paths genuinely DO reach `semFitArgs`'s thrown guard with a clear error rather than being fully prevented: (i) pick ML + pairwise (valid), then switch the estimator to MLR while pairwise stays selected; (ii) pick ML/MLR + FIML (valid), then switch the estimator to WLSMV while FIML stays selected. This is defense-in-depth, not a closed door - the guard exists precisely because the UI cannot fully prevent every invalid combination, and it throws a clear, actionable message rather than silently mis-fitting. Follow-up candidate: coerce the missing-data selection back to a valid value (e.g. listwise) whenever an estimator change makes the current one invalid, closing this last reachable path.

2. **WLSMV cells compare cross-engine at 5dp, all other cells at 7dp.**
   Task 5's real-WebR run measured a genuine, systematic native-vs-WebR drift of 1e-7 to 6e-7 absolute (~5e-8 relative) on chisq.scaled and the structural est/se under WLSMV only, concentrated in the DWLS robust-covariance path; ML/MLR cells sit in the known 1-ULP class and passed at 7dp first try.
   Ruling: engine-difference class, not a defect; WLSMV cells pin at `toBeCloseTo(pin, 5)` (tolerance 5e-6, ~8x headroom over the worst measured delta), all other cells stay at the uniform 7dp rule.
   Evidence: `.superpowers/sdd/task-5-report.md` (Finding B); the self-contained WLSMV EXCEPTION paragraph in `src/lib/stats/h1Pins.ts`.

3. **WLSMV citation = Muthen, du Toit and Spisic (1997), unpublished technical report.**
   The provenance check (reviewer independently fetched the actual PDF from statmodel.com plus Linda Muthen's statmodel discussion-board confirmation, message 2852) supports the 1997 unpublished technical report as the WLSMV source, NOT the distinct Muthen (1984) Psychometrika paper (a precursor).
   It is cited honestly as "Unpublished technical report" in `src/lib/registry/citations.ts` (MUTHEN_DUTOIT_SPISIC_1997).
   Evidence: ledger Task 8; `src/lib/registry/citations.ts` lines 136-149.

4. **Spec-over-plan adjudication: default CB-SEM cards now name the estimator.**
   The plan's defaults-byte-pin collided with the spec's always-on Estimation note and APA estimator naming.
   Controller ruling: the spec governs; default CB-SEM cards now say "estimated with maximum likelihood" and carry the Estimation note, while all numbers and the fit table spec remain byte-pinned (5 pre-existing string assertions updated, verified additive-only).
   Evidence: ledger Task 6; `src/lib/results/buildCbSem.ts` and its test.

5. **Heywood reconditioning of the WLSMV pin fixture.**
   Task 4's first capture of cells 6-7 pinned an improper Heywood solution (negative latent variance, SE 11x the estimate) at a 5% hole rate.
   Controller ruling: recondition, do not pin an improper solution.
   The fixture hole rate went 5% to 1% (holes-only change, base data byte-identical); both WLSMV cells are now machine-enforced PROPER (stopifnot in the regen script; "PROPER: TRUE" lines in the capture); an R lazy-evaluation seed bug found in the scratch sweep is documented and the committed script verified eager and deterministic.
   Evidence: `.superpowers/sdd/task-4-report.md`; `src/lib/stats/h1Pins.ts` PROPER-SOLUTION GUARANTEE paragraph; `scripts/spikes/h1-likert-missing-pin-values.R`.

6. **columnLevels production threading (implementer-caught gap, controller-ruled into the slice).**
   The plan never named the wiring path that carries Configure-data column levels into the runner, so as first built, a real user selecting WLSMV would always hit the no-ordinal guard even with ordinal columns configured.
   Ruling: thread `s.columns` through production - `Runner` type gains an optional `columnLevels` 5th param, `session.runAll` forwards it, the cb-sem and path-analysis RUNNERS closures consume it - with store-level seam tests (positive WLSMV path and guard path) rather than leaving it a dead parameter.
   The export side mirrors this: `emitRScript` takes optional `columnLevels` and `ResultsScreen.buildExportFiles` passes `s.columns`.
   Evidence: `.superpowers/sdd/task-3-report.md` (concern 1 + follow-up commit section); `.superpowers/sdd/task-7-report.md`; `src/lib/results/builders.ts`, `src/state/session.ts`, `src/lib/export/rScript/emit.ts`.

7. **Export bootstrap gate fix (real parity gap closed, bonus to the plan).**
   The export emitter's bootstrap gate was `hasIndirect || hasModeration` only, so an MLR/WLSMV run with indirect paths would previously have silently bootstrapped in the export while the app did not.
   Ruling: the gate is now estimator-aware via `semFitArgs.needsBootstrap` (ML only), with an emitter-level regression pin that was verified to fail (credible RED) against the old gate.
   Evidence: ledger Task 7; commit `5ba35b1`; `src/lib/export/rScript/emitters/latent.cbsem.test.ts`.

8. **Four owner-approved spec amendments (locked files, each approved by Benjie on 2026-07-10 while awake).**
   a. The planned CB-SEM card amendment: MI row deleted, listwise drawn as selected default, ddcap and how-to guidance match wired reality (`2d50946`, telos_test_inputs.html + telos_test_outputs.html rMap line, the consistency-pinned twin, disclosed at review).
   b. Residual-MI mini-amendment, 3 lines: the missing optpill value (inputs.html:2595 area), the card note line (inputs.html:2615 area), and the ui-spec branch line (telos_ui_spec.html:345) (`cf311ef`).
   c. Fourth residual: the PLS-SEM card ddcap's stale "estimator-aware FIML / MI dropdown" contrast reworded to "no estimator or missing-data dropdown" (`7f143e2`).
   d. The registry text edits that ride the same ruling: `src/lib/registry/cbSem.ts` options strings and the rMap correction to `lavaan::sem(estimator=, missing=, ordered=)` (part of `2d50946`).
   Whole-file MI cleanliness was verified with zero hits across both spec files after the amendments; spec-consistency suite 49/49 both sides.

## C. HELD FOR BENJIE

1. **compRelSEM all-ordinal crash - CORRECTED (was reachability-checked here as not-reachable; a final-review pass found it WAS export-reachable, and it is now FIXED).**
   Discovery: `semTools::compRelSEM` has an `isShared` bug that fires when the FIRST-processed composite handed to it is all-ordinal (not "every composite" as first summarized here) - the runs-in-r fixture originally worked around it via construct declaration order.
   Correction to the gate reachability check above: the export side WAS crash-reachable.
   The cb-sem export emitter's Table 4 (`src/lib/export/rScript/emitters/latent.ts`) called `semTools::compRelSEM(fit)` on the PARAMETERIZED structural `fit` - the same fit object carrying `estimator = "WLSMV"`/`ordered = c(...)` when that estimator is selected - so a WLSMV export with an all-ordinal composite declared first crashed native R with `object 'isShared' not found` (reviewer-reproduced on `likert5-missing.csv`; RED evidence in the final-review fix-wave report).
   Fix: Table 4 now fits its own SEPARATE continuous CFA (mirrors `cfaReliability.ts` exactly - `lavaan::cfa(model_str, data = d, std.lv = FALSE)`, never given `ordered=`), matching what the app card already computes (`cfaReliability.ts:52`, called from `runCbSem.ts:671`). This kills the crash for every construct order and restores app === export for reliability numbers under every estimator, not just the default.
   The app side was, and remains, unaffected: `cfaReliability.ts` never passed `ordered=` before this fix and still doesn't - the correction above is to the EXPORT half of the original reachability check only.
   Evidence: final-review fix-wave report (`.superpowers/sdd/final-fix-wave-report.md`), Fix 1; `src/lib/export/rScript/emitters/latent.ts`; `src/lib/export/rScript/emitters/latent.cbsem.test.ts`; `src/lib/export/rScript/runs-in-r.test.ts` (ordinal-first regression REP).

2. **Path-mode WLSMV posture needs Benjie's ruling (new held item, final-review fix wave).**
   Today WLSMV is permanently greyed out on the path-analysis card: `SemControls.tsx`'s `hasOrdinalIndicator` reads `setup.constructs`, which is empty in path mode until run-time synthesis, so the option can never become selectable regardless of the dataset's actual column levels.
   The final-review fix wave made the greyed state HONEST rather than wiring it: in path mode the note now reads "WLSMV is not yet available for path analysis; use ML or MLR." instead of the false "all your indicators are scale-level" claim (which path mode cannot know at that point) - `SemControls.tsx`, `SemControls.test.tsx`.
   Full path-mode WLSMV support needs ordinal detection from the columns actually used by the synthesized model, plus a sanitizer/domain fix: the ledgered Task 7 minor notes that the runner passes RAW column names into `ordered=` in path mode (`runCbSem.ts`'s `itemNameOf` degrades to identity when `usedCols` is empty at guard-build time), while the export emitter's path-mode data frames carry SANITIZED tokens (`latent.ts`'s `nameOf`, routed through the shared selection-global map) - the two sides disagree on what name `ordered=` should carry before any of this can be wired safely.
   Folded into the same honesty class: `src/lib/registry/pathAnalysis.ts` still advertises `{ id: 'estimator', label: 'estimator', value: 'ML', kind: 'display' }` - a fixed display string, not sourced from the actual (currently ML-only, soon to be selectable) estimator choice - the same "unwired but visible" gap the H1 slice's own origin item (H1) was about.
   Ruling needed from Benjie: wire path-mode WLSMV (ordinal detection + sanitizer fix + registry text) as a follow-on slice, or leave it deferred longer; either way the registry's fixed `'ML'` text should get the same wire-or-annotate treatment H1's own origin ruling gave the CB-SEM card.

3. **Minor list (every 'minor' line from the slice ledger, none blocking, for disposition at will).**
   - Task 1: no nominal-level exclusion test; WLSMV + moderation + no-ordinal guard-precedence combination unexercised.
   - Task 2: `globalMissingPolicy` typed as plain string (file convention); dual role=note co-occurrence is pre-existing; mismatch-note wording is an owner-eyeball item at preview.
   - Task 3: the pre-guard fixture carries 1 verbatim em dash (provenance-ruled OK); WLSMV + self-moderation guard precedence unexercised; R-side guard execution proof deferred to Task 5's real-engine matrix (done).
   - Task 6: report undercounted updated assertions 4 vs 5 (audit-trail nit).
   - Task 7: path-mode sanitizer mismatch - emitter `nameOf` vs runner identity-degraded `itemNameOf` (pre-existing, Task-3-inherited edge; the emitter is arguably more correct); special-char path-mode WLSMV column untested. See held item 2 above - this is the same gap, now with a ruling request attached.
   - Task 8: estimatorOf/missingOf default literals duplicated vs CB_SEM_DEFAULT_MISSING (module-boundary rationale documented in code).
   - Task 11 (backlog): app-wide role=note elements lack accessible names (pre-existing a11y).

4. **Visual baselines.**
   See section D for the gate run's verdict.
   Rule honored: no baseline was regenerated; the final e2e attempt (workers=2) passed all 6 visual-project screens (desktop/tablet/phone x light/dark) with zero mismatch, so no diff set was needed at `.superpowers/sdd/h1-baseline-diffs/`.

5. **The two pre-existing desktop e2e load-flakes (`flow.spec.ts:27`, `association.spec.ts:47`).**
   Three prior attempts at the default worker count rotated failures between these two specs (40/41, 39/41, 22/23), each isolated-green, each untouched by this slice.
   The final gate attempt at `--workers=2` (per the Task 12 brief's reduced-parallelism instruction) ran fully green, 41/41, single attempt, zero retries - both specs passed cleanly (29.8s and 37.6s respectively).
   Held for Benjie: no code changes were made to chase this; it is recorded as machine-load flake evidence in case it recurs on CI or a busier machine. If it does, the fix candidate is either raising `workers` down further in CI config or hardening the two specs' wait conditions (`#table-t-test` visibility wait; the χ² GoF `Next:` button enable wait).

6. **The tectonic LaTeX-compile timeout flake (`latex.compile.test.ts`, full-suite run 2 of 2).**
   One test timed out at the fixed 10000ms `testTimeout` (took 12074ms under full-suite load: tectonic compile competing with WebR fork workers); it passed in run 1 (218/218 green) and passes in isolation (3.25s).
   Held for Benjie: candidate fix is bumping that test's `testTimeout` (e.g. to 20000-30000ms) to give headroom under full parallel load; not done here since it is a pre-existing test-infra tolerance, not H1 product code, and the brief scoped Task 12 to gate-and-document, not to touch test files.
   Evidence: `.superpowers/sdd/task-12-report.md` step 3 (run 2).

7. **Stale doc-capture artifacts noticed during the Task 12 docs regen (not corrected here).**
   `docs/test-documentation/46_cb-sem/` and `48_path-analysis/`'s screenshots and `export/` artifacts are dated 2026-07-08, predating this slice (started 2026-07-10 night, base `aa8f03a`).
   For these two DEFAULT-config tests the numbers/export fragment are unaffected (byte-identical-defaults rule), but the on-screen "Estimation note" UI text (ruling B4) would not appear in the stale `2-app-output.png` screenshot.
   `docs/build-test-doc.mjs` only re-runs native R against the existing `export/` artifacts and rewraps the HTML - it does not recapture screenshots, which is a separate, larger capture-harness step outside this task's scope.
   Held for Benjie: recapture 46/48 (and audit the rest of the catalog for the same staleness) as a future doc-hygiene pass, not urgent since no numbers are wrong.

## D. Gate evidence (Task 12, commands run in order)

| Step | Command | Result |
|---|---|---|
| 1 | `npx tsc -b --force` | 0 errors, exit 0 |
| 2 | `npm run test:fast` | 159 files / 1589 tests passed, 23.6s |
| 3a | `npm test` (FULL, run 1) | 218 files / 1883 tests passed, 0 skipped, 3643.7s |
| 3b | `npx vitest run --reporter=verbose` (FULL, run 2) | 217 files passed, 1 failed (tectonic timeout flake, held item C.5); 1882/1883 tests; 0 skipped; runs-in-r 38/38 native |
| 4 | `npx playwright test --workers=2` (5 projects, main repo) | **41/41 passed, single attempt, 9.0m** - both prior rotating flakes (flow.spec.ts:27, association.spec.ts:47) passed clean; visual project 6/6, zero baseline mismatch |
| 5 | Fresh clone + install + test:fast + build | PASS - HEAD `9793857`; test:fast 159/159 files, 1589/1589 tests (26.22s, exact match); build succeeded (dist/ produced) |
| 6 | Docs regen 46_cb-sem + 48_path-analysis + index; visual audit | PASS - both native-R re-embeds succeeded (17.8s, 12.5s); index regenerated (date/commit stamp only diff); disclosures match expected default-config empty-fragment state (see report) |

runs-in-r: 38/38 native-R executions passed (run 2 verbose log), matching the expected 38/38 (31 pre-existing + 7 H1-matrix REPs).
Full per-step logs: `.superpowers/sdd/task-12-report.md`.
