# H1 wiring: estimator and missing-data dropdowns drive the lavaan fit

**Date:** 2026-07-10
**Status:** Approved by Benjie (brainstorm 2026-07-10; all four sections approved in sequence)
**Origin:** Slice-5 ratify item H1 (`docs/superpowers/reviews/2026-07-08-slice5-citable-complete-ratify.md`): the CB-SEM card's estimator and missing-data dropdowns have never been wired into the fit; it always runs ML + listwise.
Benjie ruled: wire them (not remove), before first deploy.

## Problem

`SemControls.tsx` renders an estimator dropdown (WLSMV / ML / MLR) and a missing-data dropdown (FIML / Multiple imputation / Pairwise / Listwise) on the CB-SEM card.
`runCbSem.ts` calls `lavaan::sem(model_str, data = d)` with no `estimator=` or `missing=` argument, in both the bootstrap and plain paths.
The exported `analysis.R` mirrors the same unparameterized call.
A supervisor reading a student's methods section would catch the mismatch.

## Rulings (all Benjie's, 2026-07-10)

1. **Multiple imputation is dropped from the dropdown.**
   MI is not a lavaan argument; it requires mice plus pooled fits (lavaan.mi), unproven in WebR/WASM.
   His bar for its return, recorded on the agenda recommendations list: a spike proving mice + pooled lavaan fits run error-free in WebR and match native R.
   The missing-data explainer gains a line saying FIML is generally preferred over MI for SEM.
2. **WLSMV auto-declares ordinal indicators.**
   Indicators whose Configure-data level is ordinal are passed to lavaan via `ordered = c(...)`; scale-level indicators stay continuous; mixed models are allowed.
   The card discloses exactly which indicators were treated as ordinal.
   WLSMV is greyed out when no indicator is ordinal ("all your indicators are scale-level; use ML/MLR") and remains blocked under moderation (existing guard).
3. **Bootstrap under ML only.**
   ML keeps today's behavior: bootstrap control, percentile/BCa indirect-effect CIs.
   MLR and WLSMV disable the bootstrap fieldset (with a note); the fit reports the estimator's own robust standard errors and corrected fit statistics, and indirect effects get delta-method CIs, disclosed on the card.
   The full estimator-by-bootstrap combination matrix is parked on the agenda recommendations list.
4. **Approach B: shared fit-args module** (over per-template interpolation or registry plumbing).

## Scope

The CB-SEM card only, in its three modes: latent, path, and cfa-only pipeline stage.

Out of scope, confirmed during brainstorm:
- PLS-SEM: has no estimator dropdown (PLS is its own estimation method); its missing handling follows the global Configure-data policy and is honestly disclosed today.
- Reliability cards (alpha/AVE/CR) and EFA/PCA: run their own CFA/analyses under documented defaults, show no estimator controls, claim nothing false.
- The econ display-only sweep (part of H3-H12): separate held item.

Defaults are unchanged: ML + listwise.
An untouched setup must produce byte-identical output to today, everywhere (screen, exports, docs).

## Architecture

New module `src/lib/stats/semFitArgs.ts`, the single source of truth for CB-SEM fit parameterization.

Input: the test setup (estimator, missing) plus configured column levels for the model's indicator/observed columns.
Output (one structured object):
- the lavaan argument fragment as an R string: `estimator = "MLR"`, `missing = "ml"` (FIML) / `"pairwise"` / `"listwise"`, `ordered = c("pu1","pu2")` when applicable, or the empty fragment for the ML + listwise default;
- disclosure facts for the builder: effective estimator, effective missing method, ordered-indicator list, CI method for indirect effects (bootstrap percentile/BCa vs delta).

All guards live here and nowhere else: FIML requires ML-family; WLSMV requires at least one ordinal indicator and no moderation; bootstrap requires ML.
Pure TypeScript, unit-testable without WebR.

Consumers:
- `runCbSem.ts` interpolates the fragment into its R template (both bootstrap and plain paths).
- The analysis.R export emitter interpolates the same string, so app and export arguments are byte-identical by construction; the runs-in-r gate then proves equivalence per combination.

This extends the shared-module pattern slice 5 established with `moderationModel.ts`/`buildModel`.

`SemControls.tsx` changes: MI option deleted; bootstrap fieldset greys with a note when the estimator is not ML; WLSMV option greys when the model has no ordinal indicator (new) in addition to the existing moderation grey.

## Card and report behavior

- Fit-measures table becomes estimator-aware: under MLR, the chi-square row reports the Yuan-Bentler scaled statistic and CFI/TLI/RMSEA switch to robust variants labeled "robust" in the table; under WLSMV, the mean-and-variance-adjusted statistic with the same robust labeling; SRMR unchanged.
  Hu and Bentler cutoff verdicts apply to the robust indices, per the reporting-convention doc.
- The APA model sentence names the estimator (for example "estimated with robust maximum likelihood (MLR)").
- Disclosure notes: effective estimator + missing method (exists today); under WLSMV, the exact ordered indicators; under FIML, that all available cases were used, with effective N; under pairwise, the N basis; under MLR/WLSMV with mediation, "Indirect-effect CIs: delta method (bootstrap CIs available under ML)".

## Exports and citations

- `analysis.R` carries the identical fragment plus a student-readable comment block explaining each choice.
- LaTeX report and table images inherit the robust labels from the shared builder output; no new machinery.
- Citation registry gains four point-of-use references, attached conditionally (only when the option that earns them ran): Yuan and Bentler (2000) for MLR; Muthen (1997) for WLSMV; Enders and Bandalos (2001) for FIML; Sobel (1982) for delta-method indirect CIs.
  Each is web-verified against the actual source before entering the registry (slice-5 provenance standard).
- CITATIONS.txt and references.bib pick these up through the existing bridge.

## Verification matrix and testing

Valid cells (8): ML x {listwise, FIML, pairwise}, MLR x {listwise, FIML, pairwise}, WLSMV x {listwise, pairwise}.
Bootstrap CIs additionally verified under ML (percentile and BCa paths exist today).

1. Unit tests on `semFitArgs.ts`: every guard, every fragment string byte-exact, MI absent.
2. Known-answer engine tests (WebR) for all 8 cells against native R 4.6.0 at the repo's usual precision.
   Latent cells use the PoliticalDemocracy worked reference.
   WLSMV needs a new fixture with genuinely ordinal (Likert-type) indicators; expected values pinned from a native-R run first, TDD-style.
3. Runs-in-r gate: one exported analysis.R executed under native R per verified cell, extending the existing gate.
4. UI and journey tests: component tests for the new greying rules; one Playwright journey running an MLR fit through the real app (other cells covered by the engine layer).

Anti-regression pins: ML + listwise output byte-identical (existing snapshots); visual baselines regenerate only if the greyed bootstrap fieldset changes a captured screen, owner-gated.

## Open flag (implementation-time, comes back to Benjie)

If the locked spec HTML's CB-SEM card lists "Multiple imputation" in its drawn dropdown, removing the option requires an explicit approved spec amendment; it will be presented, never silently edited.
The registry rMap text that "advertises estimator choices" (H1 note) is updated to match the wired reality; consistency tests keep registry and spec aligned.

## Parked (agenda recommendations list)

- Multiple imputation, with Benjie's return bar (error-free WebR proof matching native R).
- Full estimator x bootstrap combination matrix.
