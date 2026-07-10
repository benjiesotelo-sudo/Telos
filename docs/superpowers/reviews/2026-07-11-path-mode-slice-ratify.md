# Ratify: path-mode slice - P2 shelf paradigm + WLSMV per endogeneity

**Date:** 2026-07-11 (overnight slice; morning ratify package assembled by the T10 gate agent).
**Spec:** `docs/superpowers/specs/2026-07-11-path-mode-wlsmv-design.md` (incl. Amendment A).
**Plan:** `docs/superpowers/plans/2026-07-11-path-mode-wlsmv.md` (incl. Amendments A and B + the HELD WORDING section).
**Ledger:** `.superpowers/sdd/progress.md`, section "SDD ledger - path-mode WLSMV slice".
**Commits:** `db4d01d..24d8dbd` plus this gate's docs commits (local main; NOT pushed, app never deployed).

## (a) What shipped

1. **P2 shelf paradigm for the path-analysis canvas** (owner rulings via the canvas-paradigm board, ~3am).
   The path-mode canvas opens BLANK; every used-eligible column waits as a chip on a shelf below the svg; clicking a chip places it (auto-position at the next free spot).
   Delete returns the node to the shelf (its drawn paths removed; nothing destructive).
   Move is full drag in Move mode, reusing the latent-mode mechanism; positions persist in state; the H1 grab-cursor rule inverts naturally because drag now works.
   Model synthesis (`withPathModeConstructs`) reads PLACED columns, not used columns - the model you see is the model that runs.
   Latent mode is byte-unchanged (its constructs were already opt-in via the form).
2. **WLSMV genuinely wired on the path-analysis card, per endogeneity (Amendment B).**
   WLSMV becomes selectable exactly when at least one PLACED ordinal column is ENDOGENOUS in the drawn paths (a path points into it) - dynamic with drawing.
   `ordered =` declares only endogenous ordinal columns, carrying the SANITIZED tokens the fitted data frame actually uses (the load-bearing naming fix).
   Exogenous ordinal predictors enter numerically and are DISCLOSED (on-card note + analysis.R comment) - this matches lavaan's threshold semantics and produces zero warnings.
   The old "WLSMV is not yet available for path analysis" note is gone, replaced by honest state-dependent hints.
3. **Registry truth:** `src/lib/registry/pathAnalysis.ts` estimator option now reads the wired truth ('WLSMV (ordinal) / ML / MLR'), a `missing` option was added ('listwise (default) / FIML / pairwise'), and the rMap names the real fit call (`lavaan::sem(estimator=, missing=, ordered=)`); all still `kind: 'display'` (load-bearing for freshSetup per H1 Task 9).
4. **Export parity:** the emitter's path-mode fragment is byte-identical to the runner's `semFitArgs` output (6 parity tests incl. a cross-assert of runner source vs emitted script on the same setup), plus the exogenous-disclosure comment and an ML byte-pin.
5. **Verification layer:** native pins, real-WebR known-answer cells, one runs-in-r REP, a full e2e journey, and updated docs capture (details below).

### Pins table (native R 4.6.0 / lavaan 0.6-21; provenance `scripts/spikes/pathwlsmv-pin-values.{R,txt}`, transcribed into `src/lib/stats/h1Pins.ts`)

| Pin | Model | ordered= | df | Key pinned values |
|---|---|---|---|---|
| PATH_WLSMV_SAT | `b1 ~ a1 + cont1` | `c("b1")` (b1 endogenous ordinal; a1 ordinal but exogenous -> numeric, the disclosure case) | 0 (saturated) | b1~a1 est -0.13387765 se 0.05376146; b1~cont1 est -0.6972082 se 0.08627001; chisq/df 0 |
| PATH_WLSMV_STRUCT | `b1 ~ a1 + cont1; b2 ~ b1` | `c("b1","b2")` | 2 | chisq 33.13714128; chisq.scaled 34.32232565; rmsea.scaled 0.2360681; b1~a1 -0.1840309; b1~cont1 -0.83672956; b2~b1 0.39475332 |

**Tolerances (H1 rules, unchanged):** WLSMV cells compare real-WebR vs native at `toBeCloseTo(pin, 5)` (the controller-ruled WLSMV exception - systematic 1e-7..6e-7 DWLS drift class); everything else at 7dp.
Both path-mode WebR cells matched the pins at 5dp on the FIRST run (T7, `26135ee`).

## (b) Rulings applied

- **Owner P1/P2/P3 board ruling = P2** (start empty + add from shelf) + delete-to-shelf + full drag + on-canvas ordinal detection; latent unchanged; spec amendments pre-approved as a class with morning wording review; empty-state hint copy DRAFT pending render review. (Artifact board 9a778e65; spec Amendment A.)
- **Controller Amendment B (endogeneity), morning-ratify flagged - RATIFY HERE.**
  T1 evidence: lavaan warns on EXOGENOUS ordered variables ("no thresholds") and treats them numerically anyway (coefficients identical to ~9 significant figures with/without `ordered=`; max diff 3.09e-8).
  Ruling: `ordered=` follows endogeneity; exogenous ordinals numeric + disclosed; WLSMV enablement requires >=1 placed ordinal ENDOGENOUS column.
  Consequence: T1's original pinned models (`cont2 ~ a1 + b1`, no ordinal endogenous variable) were no longer achievable app states; T6 re-pinned with ordinal-endogenous models (the table above), zero lavaan warnings, same provenance discipline (`6921b0e`).
- **Pre-approved spec-amendment class: UNUSED.** T6's finding, stated plainly: NO path-analysis card exists in either spec-HTML doc-mockup file (`telos_test_inputs.html` / `telos_test_outputs.html` - path analysis reuses the CB-SEM output card, per that card's own header comment), and no spec-HTML text anywhere claims path-mode canvas seeding.
  So zero locked-file edits were forced; the pre-approval was never exercised.
  Full evidence in the plan's HELD WORDING section (registry before/after quoted there for the wording pass; consistency suites 51/51 green on both sides of the registry edit).
- **Spec review was owner-delegated overnight** (Benjie's word at slice start: full-scope confirmed, review post-hoc).
  This document IS the post-hoc review vehicle: the spec, both amendments, and all rulings above are presented here for morning ratification.

## (c) DRAFT COPY for owner render review (all overnight-drafted; quote-verbatim below; none is final until Benjie rules)

1. **Empty-canvas hint** (`src/components/SemCanvas.tsx`, path mode):
   > Your canvas is empty. Add variables from the shelf below, then draw paths between them.
2. **WLSMV hint, ordinal placed but none endogenous** (`src/components/SemControls.tsx`):
   > WLSMV applies ordered-threshold modeling to ordinal outcome variables; draw a path into an ordinal variable to enable it.
3. **WLSMV hint, no ordinal column placed at all** (`src/components/SemControls.tsx`):
   > WLSMV needs at least one ordinal variable on the canvas; all your placed variables are scale-level - use ML or MLR.
4. **"Ordinal predictors" on-card note** (`src/lib/results/buildCbSem.ts`; singular/plural template - singular form shown with the e2e model's variable):
   > Ordinal predictor a1 enters the model numerically, standard practice; ordered-threshold modeling applies to endogenous variables.
5. **Exogenous-disclosure comment in exported analysis.R** (`src/lib/export/rScript/emitters/latent.ts`, same template family):
   > # Ordinal predictor (not declared ordered =): a1 - enters the model numerically, standard practice; ordered-threshold modeling applies to endogenous variables.

## (d) HELD / follow-ups (from the ledger)

1. **TICKET - registry drift guard:** `PATH_ANALYSIS.options`/`rMap` strings have NO consistency pin anywhere (unlike CB-SEM's spec-twin pins), a future silent-drift class (T6+T7 review finding).
2. **TICKET - shared-helper refactor:** the isEndogenous/indicatorLevels/exogenousOrdinals block is duplicated (hand-synced) between `runCbSem.ts` and the export emitter; 3-test-guarded today, extract into one shared helper (T8+T9 review finding).
3. **RENDER REVIEW - shelf chip visual + shelf-in-SemCanvas seam:** the shelf lives inside the SemCanvas component (adjudicated no-regression at T3 review, store stays in the connected wrapper), chip button chrome and shelf placement are morning render items, alongside the DRAFT hint copy in (c).
4. **T9 saturation note re disclosures:** on a SATURATED path model the card suppresses the fit block and (by design, `buildCbSem.ts`) the "Ordinal predictors" note only renders when non-saturated in path mode; the e2e journey therefore asserts BOTH disclosures on the pinned non-saturated STRUCT model - a saturation-aware judgment call, reviewed sound. Benjie may want to rule whether the exogenous-ordinal disclosure should ALSO appear on saturated path models.
5. Prior H1/SEM-A/econ ratify carry-overs unchanged (see `reviews/2026-07-10-h1-wiring-ratify.md` and the memory agenda).

## (e) Gate evidence (T10, run 2026-07-11 morning; full log `.superpowers/sdd/pw-task-10-report.md`)

| Step | Command | Result |
|---|---|---|
| 1 | `npx tsc -b --force` | exit 0 |
| 2 | `npm run test:fast` | 162 files / 1667 tests, all green (24.5s) |
| 3 | `npm test` (FULL, once) | 221 files / 1974 tests, all green, 0 skipped (3592s); no tectonic flake recurrence; runs-in-r re-run standalone for the count: 40/40 in 171s (native Rscript) |
| 4 | `npm run e2e` (five Playwright projects) | 43 passed (6.4m), 0 retries: desktop 25, tablet 1, mobile 1, responsive 10, visual 6; ALL visual baselines matched (zero diffs, none regenerated) - T9's zero-path-canvas-baseline prediction verified |
| 5 | fresh clone: `npm install` + `test:fast` + `build` | clone of 24d8dbd: install clean, test:fast 1667/1667, build succeeded |
| 6 | docs regen 48_path-analysis (fresh P2 capture + native-R re-embed) + index | capture 1 passed (59.7s); HTML rebuilt w/ native R 4.6.0 embed (R ok in 9.0s); index 48 linked; commit `1cafdb7`. The new config screenshot shows the placed-nodes canvas, the verbatim all-scale WLSMV hint, and the new registry DISPLAY chips; 2-app-output.png regenerated byte-identical (determinism evidence) |

Full command tails in `.superpowers/sdd/pw-task-10-report.md`.
NEVER pushed; NEVER deployed; no visual baseline regenerated.
