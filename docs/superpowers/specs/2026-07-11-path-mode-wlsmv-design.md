# Path-mode WLSMV: wire the estimator honestly into path analysis

**Date:** 2026-07-11
**Status:** Approved scope (Benjie ruled C2-a with priority 2026-07-11 "path analysis is actually very important in our app"; full-scope option confirmed 2026-07-11 night; spec review delegated for overnight execution - post-hoc review at ratify).
**Origin:** H1 ratify doc held item 2 (`docs/superpowers/reviews/2026-07-10-h1-wiring-ratify.md`).

## Problem

On the path-analysis card WLSMV is permanently greyed with the (now honest) note "WLSMV is not yet available for path analysis."
Two mechanisms block it:

1. **UI detection:** `SemControls`' `hasOrdinalIndicator` reads `setup.constructs`, which is empty in path mode until run-time synthesis (`withPathModeConstructs`), so the check always answers no.
2. **Naming mismatch (the load-bearing one):** in path mode the fitted data frame's columns are SANITIZED construct tokens (`rNameOf`), but the runner's `itemNameOf` degrades to identity (empty `rItemNames`), so `semFitArgs`' `ordered=` would carry RAW column names that do not match the data frame; the export emitter's path-mode `nameOf` sanitizes, so app and export would also disagree.

Also in scope: `src/lib/registry/pathAnalysis.ts` still advertises `{ id: 'estimator', value: 'ML', kind: 'display' }` - a fixed display string, the same unwired-but-visible class H1's origin ruling was about.

## Scope (full, per Benjie)

1. **UI:** on the path-analysis card, WLSMV becomes selectable when at least one USED column's Configure-data level is ordinal (the container reads `s.columns` levels for the used-column set, mirroring how it already computes this for latent constructs). The path-mode "not yet available" note is REMOVED (replaced by the same no-ordinal-indicator hint latent mode shows when applicable). FIML/pairwise/bootstrap greying rules are estimator-driven and already shared - unchanged.
2. **Engine:** in path mode, `semFitArgs` receives `indicatorLevels` keyed by RAW column names (as today) but `itemNameOf` must be the path-mode sanitizer (the construct `rNameOf` mapping), so `orderedR` carries exactly the tokens the data frame uses. `orderedRaw` (disclosure) stays raw display names.
3. **Export:** the emitter's path-mode fragment must be byte-identical to the runner's (same `semFitArgs` inputs; its `nameOf` already sanitizes - align the runner to the same tokens and assert parity in tests).
4. **Registry:** `pathAnalysis.ts` estimator/missing option values updated to the wired truth, mirroring cbSem's strings ('WLSMV (ordinal) / ML / MLR', 'listwise (default) / FIML / pairwise'), keeping `kind: 'display'` (load-bearing for freshSetup, per H1 Task 9). **LOCKED-FILE GATE:** if any consistency test pins these strings against a spec HTML card, the spec-HTML edit is HELD for Benjie's morning approval (present exact before/after); all other tasks proceed.
5. **Verification:** one new native-R-pinned path-mode WLSMV cell (fixture: likert5-missing.csv used as single columns, e.g. `cont2 ~ a1 + b1` with a1/b1 ordinal), known-answer real-WebR test at the H1 tolerance rules (WLSMV cells 5dp), one runs-in-r REP, and an e2e journey (upload, mark ordinal, path analysis, WLSMV selectable, run, export fragment contains `estimator = "WLSMV"` and `ordered = c(...)` with sanitized tokens).
6. **Docs:** regen 48_path-analysis at slice end.

## Non-goals (explicitly out)

- Canvas UX (node delete/move/seed paradigm): AWAITING Benjie's visual-board ruling in the morning; nothing canvas-interaction changes in this slice.
- Moderation in path mode (does not exist), MI (parked), estimator x bootstrap matrix (parked).
- Any change to latent-mode behavior: every H1 pin and test stays byte-green.

## Anti-regression pins

- All H1 cells (7) and their runs-in-r REPs stay green untouched.
- Path-mode ML default output byte-identical (existing snapshots).
- The two spec HTML files untouched EXCEPT via the held gate in scope item 4.

## Amendment A (2026-07-11 ~3am, Benjie's rulings): the P2 canvas paradigm joins this slice

Owner rulings via the canvas-paradigm board (artifact 9a778e65):
1. **P2 - start empty, add from shelf.** The path-mode canvas opens BLANK; every used-eligible column waits as a chip on a shelf; clicking a chip places it on the canvas (auto-position at the next free spot). Only placed columns exist as nodes.
2. **Delete = back to the shelf** (node's drawn paths removed with it; chip reappears, one click to re-place). Nothing destructive.
3. **Move = full drag** in Move mode for path-mode nodes (reuse the latent-mode mechanism; positions persisted in state). The H1 cursor rule inverts naturally (grab shows because drag now works).
4. **WLSMV detection rule = any ON-CANVAS (placed) column whose level is ordinal.** Model synthesis (withPathModeConstructs) switches from used-columns to PLACED columns - the model you see is the model that runs.
5. **Locked-spec amendments PRE-APPROVED as a class** (path-analysis card depiction + ui-spec canvas description updated to the shelf paradigm); exact before/after wording lands on the morning ratify list, consistency green both sides - the MI-amendment pattern.
6. Latent mode is UNCHANGED (its constructs are already opt-in via the form - effectively P2 already).
7. Empty-state hint copy is DRAFT pending Benjie's render review at slice end.
