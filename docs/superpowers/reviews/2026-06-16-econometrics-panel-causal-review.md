# Econometrics panel+causal — adversarial review + fixes (2026-06-16)

Independent adversarial review (workflow `wf_930d6209-4b8`, 16 agents: 4 lenses — panel stats, causal stats,
faithfulness, code — each recomputing/rechecking from scratch; every finding adversarially refuted; + a
completeness critic). **10 confirmed, 1 refuted.** Headline: **every statistic independently recomputed in
native R 4.6.0 matched the shipped values** — the numbers are correct. Issues were in faithfulness, robustness,
and disclosure. Dispositions below.

## Fixed (this pass)
1. **DiD/PSM sign-flip on string labels** *(latent correctness)* — treatment/period were coded by alphabetical
   order, so `"pre"/"post"` → post=0 (post < pre), flipping the DiD sign. New `src/lib/stats/binaryCoding.ts`
   (`positiveLevel`/`binaryCode`): numeric pair → larger=1; else a positive token (post/after/treated/yes/true);
   else alphabetical. Applied to DiD treatment+period and PSM treatment. Regression test `binaryCoding.test.ts`
   (6/6). 0/1 fixtures unchanged → all stats values identical.
2. **FE drawn table note silently dropped** *(major faithfulness — my miss).* The FE card's drawn within-variation
   warning (telos_test_outputs.html:882) is now in `fixedEffects.ts` as `tableNote` and rendered, with the §2.8
   poolability F appended (the IV-diagnostics pattern). Added the verbatim note assertion to
   `fixedEffects.consistency.test.ts`; corrected the false "no drawn note" comments + the ratify-list line.
3. **DiD parallel-trends plot NaN on date columns** *(major).* `Number("2024-01-05")`→NaN broke the plot for a
   datetime Time column. Now: real numeric value when all-numeric (e.g. year), else rank of the sorted distinct
   values — plots in order for ISO-date strings / ordinal labels.
4. **APA + table header hardcoded "clustered SE"** even when classical SEs chosen (FE/RE/DiD). Builders now show
   "(classical SE)" / "SE" when `seType==='classical'` (the report-only-faithfulness pattern used for the verdicts).
5. **Spike-doc stale IV numbers** — weak-IV F 451→**438.5**, Wu-Hausman 1212→**1022.75** (match the shipped test).

## Your call — not changed
- **#8 DiD model:** the drawn card's note describes an entity-FE DiD (Treated absorbed), but the build is plain
  `lm(roa ~ treated*post)` (Treated estimated). Options: **A** keep plain 2×2 + drop the "absorbed" sentence;
  **B** switch to entity-FE DiD (matches the drawn note, modern-standard). Pending your ruling — the note is left
  as-is until then.

## Disclosure / judgment — optional (not changed)
- Small-cluster inference (G=12 firms): clustered-SE CIs use large residual df → slightly anti-conservative below
  ~30 clusters; correct vcovCL/vcovHC output, undisclosed. (A how-to-read caveat?)
- RDD row mixes Conventional point estimate (9.90) with Robust inference (CI centered on 9.88) — rdrobust's
  recommended reporting, but the row is internally inconsistent and undisclosed.
- Poolability note says "entity effects" even when `effects=time/two-way`; RDD eligibility checks ≥20 total
  values, not ≥5 per side of the cutoff (one-sided data passes the gate then errors gracefully at runtime).
- **Nit:** IV "Partial F" (per-instrument) vs APA "first-stage F" (joint weak-IV) — coincide for one instrument.

## Refuted (1)
The adversarial verify pass killed one finding as not a real issue.

**Verification after fixes:** tsc 0 · fast suite 637/637 · DiD+PSM WebR stats 4/4 (values unchanged) ·
binaryCoding 6/6. The default-path e2e (clustered SE, 0/1 fixtures) is unaffected by these latent-only fixes.
