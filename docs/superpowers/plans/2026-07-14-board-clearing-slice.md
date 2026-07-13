# Board-clearing slice - implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Each task = fresh implementer + task review; final whole-branch review on the strongest model. Spec: `docs/superpowers/specs/2026-07-14-board-clearing-slice-design.md` (R1-R17, every item owner-ruled - do not re-litigate any ruling).

**Goal:** execute R1-R17 and empty the agenda of fixable items.
**Architecture:** no new subsystems - every task lands inside existing seams (builders, emitters, SemCanvas/SemControls, registry, scripts, docs harness).
**Tech stack:** existing (React/Zustand/WebR/lavaan/seminr; vitest + Playwright + native-R gates).

## Global constraints

- Statistics changes (T2, T3, T4, T6) are native-R-verified: every touched emitter's runs-in-r REP re-runs green, and any new pinned value carries provenance comments (same discipline as h1Pins.ts).
- NO em dashes in code, comments, or commit messages (owner rule). Table empty-cell em-dash sentinel is the ONE exception (APA convention, owner-confirmed R10).
- Byte-pinned spec twins (docs/specs/*.html) are read-only.
- Figure styling: R-package defaults; NO custom color scheme anywhere new (owner ruling in R4).
- Owner's untracked personal docs are never staged (docs/Telos-*, docs/testing/*, docs/paper/paper.pdf and friends); commit by explicit path only.
- app == export parity: whatever a card shows, its analysis.R reproduces (T2, T3, T4 exist because this broke).
- test:fast green after every task; suites touched by a task run in that task.

## Tasks

### T1 (R1): render the EFA stage tables
Files: src/lib/results/buildCbSem.ts (+ its test), src/lib/registry/cbSem.ts untouched.
When `setup.options['pipeline']` includes the EFA stage: push `specTable(spec, 'efa-suitability')` (KMO, Bartlett chi-square/df/p rows from the runner's existing efa payload) and `specTable(spec, 'efa-loadings')` (rotated loadings matrix, same matrix-table idiom as the FL/HTMT tables). When deselected: omitted (note already documents both behaviors). RED first: builder unit test with an efa-bearing fixture result asserting both tables present/absent by option. Then the wiring-sweep B check for cb-sem goes clean (verify by running scripts/wiring-sweep.mts).
Also T1b: extend the CB-SEM e2e (or docs-harness capture) to select EFA and assert `#table-cb-sem-efa-suitability` visible after run.

### T2 (R2): CI pill honored by four emitters
Files: src/lib/export/rScript/emitters/regression.ts (simple-linear, logistic, poisson), src/lib/export/rScript/emitters/groups.ts (factorial-anova), + their emitter tests.
Pattern: `const level = ciOf(setup.options['ci'])` and pass into every CI-bearing call the emitter prints (modelsummary conf_level, parameters::standardise_parameters ci=, effectsize::eta_squared ci=, confint level=, pROC::ci.auc conf.level=), exactly as multiple-linear-regression already does. RED: emitter unit tests asserting the level literal appears and flips with the option (90% -> 0.9). Gate: the four tests' runs-in-r REPs re-run green under native R at BOTH 95% and 90%; sweep A shows the four `ci` suspects gone.

### T3 (R3): stationarity selector wired, app + export
Files: src/lib/results/builders.ts (pass `setup.options['test']` through), src/lib/stats/stationarityTests.ts (accept + subset which tests run/report), src/lib/results/buildStationarityTests.ts (render only the selected tests; disclosure line names what ran), src/lib/export/rScript/emitters/regression.ts (stationarity emitter subsets the printed tests; PP stays with 'both' as today).
RED: runner/builder unit tests per choice + emitter test asserting 'ADF only' omits kpss.test. Native-R: stationarity REP re-runs green per choice. Sweep A `test` suspect gone.

### T4 (R4): two-line interaction chart replaces the whisker figure
Files: the R figure code for moderation in src/lib/stats (CB: runCbSem/analysis.R figure block; PLS: plsSem equivalent), the export emitters' figure sections, report.tex figure references, registry figure captions if named.
The chart: predicted outcome at IV -1SD/+1SD, one line per moderator level (-1SD solid/filled point, +1SD dashed/square point), legend, R default styling (no custom colors - owner ruling). Same numbers as the conditional-effects table (which STAYS). Whisker figure removed from card + export + report.
RED: figure-name/manifest assertions in existing capture tests flip to the new figure id; runs-in-r for both SEM REPs green; e2e moderation journey asserts the new figure img name.

### T5 (R5): real label for the product-indicator group
Files: src/lib/results/buildCbSem.ts (+ test). The interaction construct's measurement-table group header renders `<IV>×<Moderator> (product indicators)` derived from the moderation's construct names; never null. RED: unit test on a moderation-bearing fixture.

### T6 (R6): PLS completeness vs Hair 2019 + tradition explainers
Files: src/lib/stats/plsSem.ts (+ runner test), src/lib/results/buildPlsSem.ts, src/lib/export/rScript/emitters/latent.ts, src/lib/registry/plsSem.ts + cbSem.ts notes.
Add if absent: f-squared effect sizes table/rows, inner-model VIF column; verify Q2 presentation matches the ruled label. Add the two-sentence which-tradition-when note to both cards (CB: confirmatory, global fit, factor-based; PLS: prediction-oriented, composite-based, no global fit by design). Registry note edits ride the existing consistency-test discipline (update pins in the same task). Native-R: seminr parity for any new statistic.

### T7 (R7+R8): WLSMV auto-fallback + saturated disclosure
Files: src/state/session.ts or src/components/SemControls.tsx (whichever owns the reset discipline - follow syncLevelSelect's pattern), src/lib/results/buildCbSem.ts (saturated path models render the exogenous-ordinal disclosure).
RED: store test - estimator WLSMV + canvas edit removing the last ordinal-endogenous column resets option to 'ML'; builder test - saturated fixture with exogenous ordinal shows the disclosure note. e2e: the path WLSMV journey gains a fallback assertion.

### T8 (R9): latent-canvas auto-layout + auto-Fit
Files: src/components/SemCanvas.tsx (+ test), possibly session.ts defaults.
On construct add (and on moderation-edge add for moderator placement): un-dragged constructs take diamond slots - exogenous (no incoming path) left column, endogenous-with-outgoing center, terminal endogenous right, moderation-only low center; viewBox auto-Fits after every add. Any construct with a manual position keeps it. Path mode untouched.
RED: layout unit tests (positions by role in a 6-construct model); e2e: 6-construct model needs NO Fit click (all ovals inside viewBox - reuse the geometry assertion idiom). Visual baselines: SEM screens regenerate; stage owner diff set at .superpowers/sdd/board-clearing-baseline-diffs/.

### T9 (R10+R11): catalog label + combined correlation matrix
Files: src/lib/registry/catalog.ts ('Mult. regression' -> 'Multiple regression'; update any pinned strings/tests), src/lib/results/buildCbSem.ts + registry cbSem.ts (new 'correlation-matrix' table: construct correlations, sqrt-AVE italic diagonal, Mean + SD columns appended; placed after HTMT; FL/HTMT untouched), emitter parity (analysis.R prints the same matrix - lavInspect cor.lv + item-composite means/SDs), consistency pins updated.
Native-R: values verified against lavaan on the sem REP.

### T10 (R12): renameColumn remaps construct items
Files: src/state/session.ts (+ test). renameColumn maps `setups[id].constructs[].items` entries (and moderation-safe: construct names unaffected). RED: store test - rename an item column, construct still measures it under the new name; canvas/run unaffected.

### T11 (R13): pins + shared endogeneity helper
Files: new src/lib/stats/semEndogeneity.ts (single source for isEndogenous/indicatorLevels/exogenousOrdinals), consumed by runCbSem.ts and emitters/latent.ts (delete the duplicated blocks; the 3 guard tests keep passing unchanged); new pathAnalysis.consistency additions pinning options/rMap strings spec-twin style.

### T12 (R14+R15): phone overlap fix + pre-commit path guard
Files: src/styles/tokens.css (theme-select vs compact rail stacking/inset on narrow widths; mobile e2e assertion), plus .githooks/pre-commit + a package.json prepare line (or .git/hooks install script committed under scripts/) blocking staged paths matching the owner's personal-doc patterns (docs/Telos-*.{txt,pdf}, docs/testing/*, docs/paper/paper.pdf) with a clear message; hook self-test via a script-level unit (spawn git in a temp repo).

### T13 (R16): the wiring sweep becomes a permanent gate
Files: scripts/wiring-sweep.mts refactored into src/lib/... testable core + a vitest spec (test:fast-safe: static sweep B always; sweep A emitter-diff over the REP+supplemental setups - pure functions, fast) with the false-positive ledger encoded as an explicit allowlist WITH per-entry justification comments (alpha=runner-wired, reportOR/standardize=display-wired, nFactors/nComponents=gated, single-choice selects). A NEW suspect = failing test naming the option.
After T1-T3 land, the allowlist needs NO entries for efa-suitability/efa-loadings/ci-quartet/test - assert that.

### T14 (R17): docs regen + final gate + ratify
Regenerate affected per-test docs (26, 28, 29, 08, 31, 46, 47 at minimum - plus any whose output changed per the harness diff) + doc index via the existing harness; full gate (tsc, test:fast, full WebR vitest, all-project Playwright with regenerated SEM baselines, fresh clone, native-R REPs); write reviews/2026-07-14-board-clearing-ratify.md (per-R outcomes, held notes, baseline diff pointer); update the agenda file (owner rule: same turn as completion).

## Self-review notes
- T2/T3/T4 all touch emitters/regression.ts - serialize T2 -> T3 -> T4 (no parallel implementers on one file).
- T4 and T6 both touch PLS surfaces - T4 before T6.
- T8's baseline regen must run AFTER all UI-affecting tasks (T7 hint, T8 layout) - fold regen into T14 if ordering gets tight.
- T13 depends on T1-T3 (their suspects must be genuinely gone, not allowlisted).
