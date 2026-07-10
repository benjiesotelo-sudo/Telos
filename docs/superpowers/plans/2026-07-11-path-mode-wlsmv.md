# Path-mode WLSMV Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make WLSMV genuinely selectable and correct on the path-analysis card, per `docs/superpowers/specs/2026-07-11-path-mode-wlsmv-design.md`.

**Architecture:** Reuse H1's `semFitArgs` machinery wholesale; the slice only fixes the path-mode INPUTS to it (levels detection in the UI container, sanitizer mapping in runner+emitter) plus registry truth and the verification layer.

**Tech Stack:** identical to H1 (TypeScript/React/Zustand, WebR lavaan, vitest, Playwright, native R 4.6.0).

## Global Constraints

- NEVER any em dash anywhere (guard test exists; sweep added lines before commit).
- `npx tsc -b --force` (plain --noEmit is vacuous). `npm run test:fast` green before every commit. Commits local only; NEVER push (controller pushes/deploys on owner word).
- H1 pins sacred: all 7 matrix cells, their REPs, and latent-mode snapshots stay green untouched.
- Cross-engine comparison rules from H1: pins are native values; WLSMV cells compare at toBeCloseTo(pin, 5), everything else 7 (see src/lib/stats/h1Pins.ts doc).
- LOCKED-FILE GATE: telos_test_inputs.html / telos_test_outputs.html / telos_ui_spec.html may NOT be edited in this slice. If a consistency test forces a spec-HTML twin for the registry change, STOP that task, record the exact before/after needed, and mark it HELD-FOR-OWNER; continue other tasks.
- Canvas interaction code (SemCanvas pointer handlers, node seeding/layout) is OUT OF SCOPE.

## Key code facts (verified during H1 + the C2 diagnosis; re-verify before relying)

- UI greying: `src/components/SemControls.tsx` - `hasOrdinalIndicator` prop computed in the container (~:213) from `setup.constructs` (empty in path mode); path-mode note text added by the H1 fix wave (branch on `modelKind`).
- Runner: `src/lib/stats/runCbSem.ts` - path mode: `usedCols` = construct names (= the used columns), `rCols` = sanitized via `rNameOf`; `rItemNames` empty so `itemNameOf` = identity; `indicatorLevels` built from `columnLevels` param keyed by raw names (H1 Task 3 threading).
- Emitter: `src/lib/export/rScript/emitters/latent.ts` path mode uses a real sanitizer (`nameOf`); consumes columnLevels via the optional Emitter param (H1 Task 7).
- Registry: `src/lib/registry/pathAnalysis.ts` options include `{ id: 'estimator', label: 'estimator', value: 'ML', kind: 'display' }`; H1 Task 9 confirmed no `missing` option and no rMap string shared with cbSem's spec twin - re-verify which consistency tests read pathAnalysis before editing.
- Fixture with ordinal columns: `tests/e2e/fixtures/likert5-missing.csv` (a1..a3,b1..b3 ordinal-able, cont1/cont2 scale).
- Pin transcription convention: `scripts/spikes/h1-pin-values.R` pattern (sprintf %.8f, committed capture).

## Task list (compressed format - each task carries the standard TDD cycle: failing test, RED run, implement, GREEN, tsc -b --force, test:fast, commit; implementers write full report files per SDD convention)

### Task 1: Native pins for the path-mode WLSMV cell
Create `scripts/spikes/pathwlsmv-pin-values.R`: reads tests/e2e/fixtures/likert5-missing.csv, fits `lavaan::sem('cont2 ~ a1 + b1', data, estimator = "WLSMV", ordered = c("a1","b1"))` (listwise; df=0 saturated is FINE - saturation suppression applies to fit indices, structural estimates still pin) AND a second non-saturated variant `cont2 ~ a1 + b1; cont1 ~ cont2` for a fit-indices-bearing pin. Print estimates + fitMeasures at %.8f; capture to committed .txt; add pins const(s) to `src/lib/stats/h1Pins.ts` (same provenance style, PATH_WLSMV_* names) + extend h1Pins.test.ts (exports parse finite). Commit: 'test(sem): native pins for path-mode WLSMV cells'.

### Task 2: UI - path-mode ordinal detection
`SemControls` container: in path mode, `hasOrdinalIndicator` = any USED column's level === 'ordinal' (from `s.columns`, the same source latent mode reads; 'used' per the canvas seeding rule s.columns.filter(c => c.used)). Remove the 'WLSMV is not yet available for path analysis' branch: path mode now shows the SAME hint semantics as latent (WLSMV disabled only when no ordinal column, with the all-scale hint). Component tests: ordinal-marked dataset -> WLSMV enabled in path mode; all-scale -> disabled with the standard hint; latent behavior byte-unchanged. Commit: 'feat(sem-ui): path mode detects ordinal columns - WLSMV selectable (C2-a)'.

### Task 3: Runner - sanitized ordered= tokens in path mode
`runCbSem.ts`: in path mode, `itemNameOf` passed to semFitArgs maps raw column name -> its sanitized construct token (the same `rNameOf(construct.id)` used for `rCols`), so `fitArgs.orderedR` matches the data frame. Mocked-engine tests: path-mode WLSMV setup with ordinal columnLevels emits R source containing `ordered = c("<sanitized>")` matching an rCols token exactly (assert against the actual sanitizer output for a spaced/special column name too - cover the ledgered special-char edge); orderedRaw still raw for disclosure; ML path-mode default source byte-unchanged. Commit: 'fix(sem): path-mode ordered= carries the data frame's sanitized tokens'.

### Task 4: Real-WebR known-answer cell(s)
Extend the real-engine describe in runCbSem.test.ts: the Task-1 pinned model(s) through the production-shaped path-mode setup (constructs synthesized; columnLevels param), compare at 5dp (WLSMV rule), assert orderedItems raw names + estimator + ciMethod delta. Run the file directly; report timing. Commit: 'test(sem): path-mode WLSMV known-answer vs native pins (real WebR)'.

### Task 5: Emitter parity + runs-in-r REP
Emitter tests: path-mode WLSMV setup emits fragment verbatim-equal to semFitArgs output (existing parity pattern), sanitized ordered tokens identical to the runner's (cross-assert runner source vs emitted script fragment on the same setup). Add ONE runs-in-r REP (the non-saturated Task-1 model; needle from the pins at R's printed precision, se-style if est degenerate). Full runs-in-r suite green natively (expect 40/40). Commit: 'feat(export): path-mode WLSMV parity + runs-in-r cell'.

### Task 6: Registry truth (LOCKED-FILE GATE applies)
Re-verify which consistency tests read pathAnalysis.ts options/rMap. Update estimator option value to 'WLSMV (ordinal) / ML / MLR' and ADD the missing option mirroring cbSem ('listwise (default) / FIML / pairwise', kind display) IF the card genuinely shows the missing dropdown in path mode (it does - SemControls isCb; verify). rMap: mirror cbSem's 'lavaan::sem(estimator=, missing=, ordered=)' phrasing where the pathAnalysis rMap names the fit call. If ANY spec-HTML twin is pinned: STOP, record exact before/after, mark HELD-FOR-OWNER in the report + ledger, skip the edit, keep tests green (registry unchanged in that case). Commit accordingly.

### Task 7: e2e journey
New spec (desktop project): upload likert5-missing.csv -> mark a1..a3,b1..b3 ordinal -> Path analysis -> draw cont2<-a1 and cont2<-b1 (canvas mechanics from existing sem specs; note cont1 unused is fine) -> Estimation: WLSMV now SELECTABLE, select it -> run (no bootstrap; fast) -> results show ordered-items disclosure + (scaled)/(robust) labels -> export zip: analysis.R contains estimator = "WLSMV" and ordered = c( with sanitized tokens. 3x green isolated. Commit: 'test(e2e): path-mode WLSMV journey'.

### Task 8: Gate + docs + ratify addendum
tsc -b --force; test:fast; FULL npm test once (accept the known tectonic-timeout flake class if it recurs - now 30s so unlikely); e2e full desktop project; fresh-clone fast+build; regen docs/build-test-doc.mjs 48_path-analysis + index; append a dated addendum section to docs/superpowers/reviews/2026-07-10-h1-wiring-ratify.md (or a new small ratify doc if cleaner): what shipped, pins evidence, the registry/spec-twin HELD item if any, note that spec review was owner-delegated overnight. Commit docs.

## Self-review
Spec coverage: scope 1->T2, 2->T3, 3->T5, 4->T6, 5->T1/T4/T5/T7, 6->T8; non-goals respected (no canvas interaction files); locked-file gate encoded in T6 + global constraints; H1 pins protected by full-suite gate.

## Amendment A - revised task list (P2 + WLSMV combined; supersedes the list above where they conflict)

Order: T1 pins (unchanged, running) -> T2 P2 state model (session: placedColumns + positions for path mode; place/remove/move actions; withPathModeConstructs reads PLACED not used; store tests incl. remove-clears-paths) -> T3 P2 canvas UI (SemCanvas path mode: empty start, shelf chips, click-to-place, delete-to-shelf, drag via the latent mechanism, cursor rule inverts, empty-state DRAFT hint; component tests; the run gate requires >=1 path as before) -> T4 WLSMV UI detection (on-canvas ordinal rule; hint semantics per spec Amendment A) -> T5 runner sanitized ordered= (as original T3, but placed-columns basis) -> T6 real-WebR cells (original T4) -> T7 emitter parity + REP (original T5) -> T8 registry + PRE-APPROVED spec amendments (original T6 minus the hold: record exact before/after for morning ratify) -> T9 e2e journey under P2 (shelf place, draw, WLSMV, run, export; replaces original T7; also UPDATE existing path-mode e2e journeys/docs-capture flows that assumed seeded-full canvas - inventory them first: sem specs + picker-reupload-trap.spec.ts draw steps + tests/docs capture for 48) -> T10 gate + docs 48 regen + ratify addendum (original T8 + P2 wording items).
Visual baselines: if any captured screen includes the path canvas, diffs are OWNER-GATED as always.
