/**
 * H1 estimator/missing wiring - native-R pinned values for the 7-cell matrix.
 *
 * ADDENDUM (path-mode WLSMV slice): this file also carries PATH_WLSMV_SAT and PATH_WLSMV_STRUCT
 * near the bottom - two path-mode (no latent constructs) WLSMV pins with their own provenance
 * section and doc comment. Same file, same conventions, distinct fixture usage. RE-PINNED at
 * Task 6 per Amendment B (ordered= follows endogeneity) - see that section's header for why the
 * original Task 1 models were replaced.
 *
 * PROVENANCE + COMPARISON RULE (read before using these pins - do not skip this):
 * Every value below is a NATIVE R 4.6.0 / lavaan 0.6-21 result (never a WebR/browser value).
 * Downstream tests MUST compare a real WebR-computed result against these pins with
 * `toBeCloseTo(pin, 7)` (7 decimal places), EXCEPT the two WLSMV cells which compare at
 * `toBeCloseTo(pin, 5)` - see the next paragraph. NEVER assert exact 8dp string/byte equality
 * across engines. The Task 0 spike (docs/superpowers/reviews/2026-07-10-h1-estimator-spike.md,
 * "Cross-engine parity" section) cataloged seven genuine 1-ULP (1e-8) native-vs-WebR discrepancies
 * in se/ci/derived-fit-index values (never in point estimates) - a 7dp tolerance absorbs
 * these and any similar backend-rounding drift without masking a real regression.
 *
 * WLSMV EXCEPTION (cells 6-7 compare at 5dp; controller-ruled 2026-07-10, on the morning ratify
 * list): the real-WebR known-answer run (Task 5, .superpowers/sdd/task-5-report.md, "Finding B")
 * measured a systematic native-vs-WebR drift of 1e-7 to 6e-7 absolute on chisq.scaled and the
 * structural est/se under WLSMV specifically - about 10-60x the 1-ULP class above, concentrated
 * in the DWLS robust-covariance path (WLSMV's scaled chi-square correction and its parameter
 * SEs); cfi/tli/rmsea/srmr/pvalue/df all stayed within ~5e-8. In RELATIVE terms the drift is
 * ~5e-8 (tight); it just exceeds the absolute 7dp rule on values of magnitude ~13. Ruled a
 * genuine engine-difference class, not a defect: WLSMV cells use precision 5 (tolerance 5e-6,
 * ~8x headroom over the worst measured delta of 6.2e-7), which is still far below any
 * statistically meaningful difference and still catches real wiring regressions, which show up
 * at 1e-2 or larger. All non-WLSMV cells stay at the uniform 7dp rule.
 *
 * The matrix is 7 cells, not 8: MLR + missing="pairwise" is lavaan-invalid (a hard `eigen():
 * infinite or missing values` error from inside the robust vcov step, root-caused in the spike's
 * Q2 to lavaan's own documented scoping of "pairwise" to the (W)LS family) and is therefore not a
 * pinnable cell at all - the production dropdown must guard this combination, it does not get a
 * known-answer test.
 *   1. ML    / listwise
 *   2. ML    / fiml    (lavaan missing = "ml")
 *   3. ML    / pairwise
 *   4. MLR   / listwise
 *   5. MLR   / fiml    (lavaan missing = "ml")
 *   6. WLSMV / listwise
 *   7. WLSMV / pairwise
 *
 * Cells 1-5: Bollen PoliticalDemocracy (ind60 =~ x1+x2+x3; dem60 =~ y1+y2+y3+y4; dem60 ~ ind60),
 * fixture tests/e2e/fixtures/politicalDemocracy-missing.csv (6 seeded NA holes in EACH of
 * y1..y4). Captured in scripts/spikes/h1-pin-values.txt (Task 0 spike capture; independently
 * cross-checked there against scripts/spikes/h1-spike-native.txt). Every line number cited below
 * refers to scripts/spikes/h1-pin-values.txt.
 *
 * Cells 6-7: WLSMV needs its OWN missing-data fixture, not the spike's likert5.csv - that fixture
 * has no NA holes at all, so its listwise/pairwise fits are byte-identical (spike Q3 note), which
 * cannot distinguish cells 6 and 7. tests/e2e/fixtures/likert5-missing.csv (same base generator as
 * likert5.csv, seed 20260710, plus a SEPARATE seeded hole-punching step, set.seed(20260711), 1%
 * of cells in a1..b3 ONLY, cont1/cont2 left untouched - see
 * scripts/spikes/h1-likert-missing-pin-values.R) was fit fresh for this task and captured in
 * scripts/spikes/h1-pin-values-likert-missing.txt (this task's new native capture). Every line
 * number cited in cells 6-7 refers to that file. The two cells' chisq.scaled and structural
 * estimates were verified to differ (see h1Pins.test.ts's degeneracy-guard test and the capture
 * file's own "Degeneracy guard" line).
 *
 * PROPER-SOLUTION GUARANTEE for cells 6-7 (controller ruling): both WLSMV fits are verified
 * PROPER solutions - lavaan's post-check passes (no negative lv variances, positive-definite lv
 * covariance) and NO warning fires during fitting; the capture file prints "PROPER: TRUE" per
 * cell (machine-checked - the regeneration script stopifnot()s on it, so an improper fit can
 * never silently produce a capture). The hole rate is 1% because a deterministic sweep showed
 * 2-5% rates push these fits into improper Heywood solutions (negative lv variances, SEs 1-2
 * orders of magnitude above the estimates). If these cells are ever regenerated, both PROPER
 * lines in the fresh capture must read TRUE or the pins are not valid ground truth.
 */

export interface H1PinCell {
  estimator: 'ML' | 'MLR' | 'WLSMV'
  missing: 'listwise' | 'fiml' | 'pairwise'
  /** Headline fitMeasures(), keyed by lavaan's own name. Finite values only - NA-valued fields
   *  (e.g. WLSMV's unscaled `pvalue`, or any estimator/missing combo's always-NA `.robust` family
   *  under WLSMV) are omitted rather than pinned as a sentinel. */
  fit: Record<string, number>
  /** Structural regression path row(s) (the model's `~` line(s), not the `=~` loadings). */
  structural: Array<{ param: string; est: number; se: number; ciLower?: number; ciUpper?: number }>
}

// -------------------------------------------------------------------------------------------
// Cells 1-5: Bollen PoliticalDemocracy. Source: scripts/spikes/h1-pin-values.txt.
// -------------------------------------------------------------------------------------------

/** Cell 1: ML / listwise. scripts/spikes/h1-pin-values.txt lines 4-16. */
export const CELL_1_ML_LISTWISE: H1PinCell = {
  estimator: 'ML',
  missing: 'listwise',
  fit: {
    chisq: 23.53908699, // line 5
    df: 13.0, // line 6
    pvalue: 0.03564413, // line 7
    cfi: 0.96436775, // line 8
    tli: 0.94244021, // line 9
    rmsea: 0.12486138, // line 10
    srmr: 0.05840425, // line 11 (Task 5 fix: was mistranscribed 0.0584042 - the capture's trailing 5 was dropped)
  },
  structural: [
    { param: 'dem60 ~ ind60', est: 1.49440497, se: 0.47740694, ciLower: 0.55870456, ciUpper: 2.43010538 }, // line 16
  ],
}

/** Cell 2: ML / fiml (lavaan missing = "ml"). scripts/spikes/h1-pin-values.txt lines 18-33.
 *  Note (spike Q1): under FIML, plain ML also carries a populated `.robust` fit-index family -
 *  a `missing=` effect on the fitMeasures() name SET, not just its values (cell 1 has none). */
export const CELL_2_ML_FIML: H1PinCell = {
  estimator: 'ML',
  missing: 'fiml',
  fit: {
    chisq: 22.15981477, // line 19
    df: 13.0, // line 20
    pvalue: 0.05293449, // line 21
    cfi: 0.97593041, // line 22
    tli: 0.96111835, // line 23
    rmsea: 0.09692617, // line 24
    srmr: 0.03788058, // line 25
    'cfi.robust': 0.96777765, // line 26
    'tli.robust': 0.94794851, // line 27
    'rmsea.robust': 0.1158785, // line 28
  },
  structural: [
    { param: 'dem60 ~ ind60', est: 1.46283905, se: 0.38994176, ciLower: 0.69856724, ciUpper: 2.22711085 }, // line 33
  ],
}

/** Cell 3: ML / pairwise. scripts/spikes/h1-pin-values.txt lines 35-47. */
export const CELL_3_ML_PAIRWISE: H1PinCell = {
  estimator: 'ML',
  missing: 'pairwise',
  fit: {
    chisq: 23.17939228, // line 36
    df: 13.0, // line 37
    pvalue: 0.03957319, // line 38
    cfi: 0.97483991, // line 39
    tli: 0.95935677, // line 40
    rmsea: 0.10217829, // line 41
    srmr: 0.05047664, // line 42
  },
  structural: [
    { param: 'dem60 ~ ind60', est: 1.39919513, se: 0.36235071, ciLower: 0.6890008, ciUpper: 2.10938947 }, // line 47
  ],
}

/** Cell 4: MLR / listwise. scripts/spikes/h1-pin-values.txt lines 49-70. */
export const CELL_4_MLR_LISTWISE: H1PinCell = {
  estimator: 'MLR',
  missing: 'listwise',
  fit: {
    chisq: 23.53908699, // line 50
    df: 13.0, // line 51
    pvalue: 0.03564413, // line 52
    cfi: 0.96436775, // line 53
    tli: 0.94244021, // line 54
    rmsea: 0.12486138, // line 55
    srmr: 0.05840425, // line 56 (Task 5 fix: was mistranscribed 0.0584042 - the capture's trailing 5 was dropped)
    'chisq.scaled': 23.92735147, // line 57
    'df.scaled': 13.0, // line 58
    'pvalue.scaled': 0.03180492, // line 59
    'cfi.scaled': 0.96176528, // line 60
    'tli.scaled': 0.93823622, // line 61
    'rmsea.scaled': 0.12714056, // line 62
    'cfi.robust': 0.96357043, // line 63
    'tli.robust': 0.94115223, // line 64
    'rmsea.robust': 0.1261048, // line 65
  },
  structural: [
    { param: 'dem60 ~ ind60', est: 1.49440497, se: 0.4333398, ciLower: 0.64507456, ciUpper: 2.34373538 }, // line 70
  ],
}

/** Cell 5: MLR / fiml (lavaan missing = "ml"). scripts/spikes/h1-pin-values.txt lines 72-93. */
export const CELL_5_MLR_FIML: H1PinCell = {
  estimator: 'MLR',
  missing: 'fiml',
  fit: {
    chisq: 22.15981477, // line 73
    df: 13.0, // line 74
    pvalue: 0.05293449, // line 75
    cfi: 0.97593041, // line 76
    tli: 0.96111835, // line 77
    rmsea: 0.09692617, // line 78
    srmr: 0.03788058, // line 79
    'chisq.scaled': 20.7544659, // line 80
    'df.scaled': 13.0, // line 81
    'pvalue.scaled': 0.07792911, // line 82
    'cfi.scaled': 0.97795885, // line 83
    'tli.scaled': 0.96439506, // line 84
    'rmsea.scaled': 0.08918127, // line 85
    'cfi.robust': 0.96911658, // line 86
    'tli.robust': 0.9501114, // line 87
    'rmsea.robust': 0.11363986, // line 88
  },
  structural: [
    { param: 'dem60 ~ ind60', est: 1.46283905, se: 0.32574772, ciLower: 0.82438525, ciUpper: 2.10129284 }, // line 93
  ],
}

// -------------------------------------------------------------------------------------------
// Cells 6-7: WLSMV mixed ordinal (a1..a3, b1..b3) + continuous (cont1, cont2) indicators, on
// likert5-missing.csv (the fixture WITH punched NA holes - see the module doc comment above for
// why the spike's holeless likert5.csv cannot be used here). Model: A =~ a1+a2+a3; C =~
// cont1+cont2; B =~ b1+b2+b3; B ~ A + C. Source: scripts/spikes/h1-pin-values-likert-missing.txt.
// pvalue and the whole `.robust` family are NA under WLSMV for both cells (spike Q1) and are
// omitted here rather than pinned as NaN/sentinel.
// -------------------------------------------------------------------------------------------

/** Cell 6: WLSMV / listwise. scripts/spikes/h1-pin-values-likert-missing.txt lines 8-28
 *  (PROPER: TRUE at line 9). */
export const CELL_6_WLSMV_LISTWISE: H1PinCell = {
  estimator: 'WLSMV',
  missing: 'listwise',
  fit: {
    chisq: 4.02273301, // line 10
    df: 17.0, // line 11
    cfi: 1.0, // line 13
    tli: 1.00498665, // line 14
    rmsea: 0.0, // line 15
    srmr: 0.01639998, // line 16
    wrmr: 0.26801962, // line 17
    'chisq.scaled': 13.32849031, // line 18
    'df.scaled': 17.0, // line 19
    'pvalue.scaled': 0.71393303, // line 20
    'cfi.scaled': 1.0, // line 21
    'tli.scaled': 1.00344299, // line 22
    'rmsea.scaled': 0.0, // line 23
  },
  structural: [
    { param: 'B ~ A', est: -0.66155525, se: 1.28310502 }, // line 27
    { param: 'B ~ C', est: -0.25762892, se: 0.98898067 }, // line 28
  ],
}

/** Cell 7: WLSMV / pairwise. scripts/spikes/h1-pin-values-likert-missing.txt lines 30-50
 *  (PROPER: TRUE at line 31). */
export const CELL_7_WLSMV_PAIRWISE: H1PinCell = {
  estimator: 'WLSMV',
  missing: 'pairwise',
  fit: {
    chisq: 4.42200721, // line 32
    df: 17.0, // line 33
    cfi: 1.0, // line 35
    tli: 1.00462289, // line 36
    rmsea: 0.0, // line 37
    srmr: 0.01673756, // line 38
    wrmr: 0.28100608, // line 39
    'chisq.scaled': 14.25227769, // line 40
    'df.scaled': 17.0, // line 41
    'pvalue.scaled': 0.64917065, // line 42
    'cfi.scaled': 1.0, // line 43
    'tli.scaled': 1.00246658, // line 44
    'rmsea.scaled': 0.0, // line 45
  },
  structural: [
    { param: 'B ~ A', est: -0.58584362, se: 0.89745109 }, // line 49
    { param: 'B ~ C', est: -0.32155693, se: 0.68700198 }, // line 50
  ],
}

// -------------------------------------------------------------------------------------------
// Path-mode WLSMV pins (path-mode WLSMV slice, Task 6 RE-PIN, Amendment B). SUPERSEDES the
// original Task 1 models (`cont2 ~ a1 + b1` [+ `cont1 ~ cont2`]): those had NO ordinal ENDOGENOUS
// variable (a1, b1 were purely exogenous predictors), so under Amendment B - ordered= follows
// endogeneity, declaring only placed ordinal columns that a drawn path points INTO - neither
// model is an achievable app state: the runner would synthesize an EMPTY ordered= and WLSMV's
// threshold machinery would never actually engage. Re-pinned below with models that DO have an
// ordinal endogenous variable, still on the same fixture, no latent constructs (distinct from
// cells 6-7 above, which are CFA/CB-SEM-style measurement models).
//
// Both models below intentionally ALSO include an exogenous ordinal variable (a1) that is NOT
// declared in ordered= - this is the Amendment B disclosure case ("ordinal predictors enter the
// model numerically" for purely-exogenous ordinal columns; only endogenous ordinal columns get a
// threshold structure). estimator = "WLSMV", missing = listwise (default). Source:
// scripts/spikes/pathwlsmv-pin-values.txt (scripts/spikes/pathwlsmv-pin-values.R regenerates it;
// PROPER: TRUE for both cells below with ZERO warnings - unlike the superseded models, neither fit
// here declares an exogenous variable as ordered, so the old "exogenous variable(s) declared as
// ordered" warning class does not fire; the superseded investigation file
// scripts/spikes/pathwlsmv-warning-check.txt has been removed). Compare downstream WebR results
// against these pins at the same WLSMV 5dp tolerance as cells 6-7 (see the module doc comment at
// the top of this file).
//
// PATH_WLSMV_SAT: `b1 ~ a1 + cont1`, ordered = c("b1") only (b1 is ordinal and ENDOGENOUS - a
// path points into it; a1 is ordinal but exogenous, so it is NOT declared and enters numerically -
// the disclosure case). Saturated (df=0) - pinned per the plan's "structural estimates still pin"
// note; only chisq/df carry saturation-evidencing information.
// PATH_WLSMV_STRUCT: `b1 ~ a1 + cont1` + `b2 ~ b1`, ordered = c("b1","b2") (b2 is now also ordinal
// ENDOGENOUS via b1 -> b2; a1 stays numeric/exogenous as above). Non-saturated (df=2), a genuine,
// non-trivial fit-indices-bearing pin.
// -------------------------------------------------------------------------------------------

/** Path-mode WLSMV, saturated: `b1 ~ a1 + cont1` (ordered=c("b1") only; a1 exogenous ordinal
 *  stays numeric - the Amendment B disclosure case). scripts/spikes/pathwlsmv-pin-values.txt
 *  lines 5-25 (PROPER: TRUE at line 6). */
export const PATH_WLSMV_SAT: H1PinCell = {
  estimator: 'WLSMV',
  missing: 'listwise',
  fit: {
    chisq: 0.0, // line 7 (saturated: df=0, trivially perfect fit)
    df: 0.0, // line 8
    cfi: 1.0, // line 10
    tli: 1.0, // line 11
    rmsea: 0.0, // line 12
    srmr: 0.0, // line 13
    'chisq.scaled': 0.0, // line 15
    'df.scaled': 0.0, // line 16
    'cfi.scaled': 1.0, // line 18
    'tli.scaled': 1.0, // line 19
    'rmsea.scaled': 0.0, // line 20
  },
  structural: [
    { param: 'b1 ~ a1', est: -0.13387765, se: 0.05376146 }, // line 24
    { param: 'b1 ~ cont1', est: -0.6972082, se: 0.08627001 }, // line 25
  ],
}

/** Path-mode WLSMV, non-saturated: `b1 ~ a1 + cont1; b2 ~ b1` (ordered=c("b1","b2"); a1 stays
 *  numeric/exogenous). scripts/spikes/pathwlsmv-pin-values.txt lines 27-48
 *  (PROPER: TRUE at line 28). */
export const PATH_WLSMV_STRUCT: H1PinCell = {
  estimator: 'WLSMV',
  missing: 'listwise',
  fit: {
    chisq: 33.13714128, // line 29
    df: 2.0, // line 30
    cfi: 0.0, // line 32
    tli: -1.15835635, // line 33
    rmsea: 0.23169965, // line 34
    srmr: 0.09032279, // line 35
    'chisq.scaled': 34.32232565, // line 37
    'df.scaled': 2.0, // line 38
    'pvalue.scaled': 0.00000004, // line 39
    'cfi.scaled': 0.0, // line 40
    'tli.scaled': -1.24051066, // line 41
    'rmsea.scaled': 0.2360681, // line 42
  },
  structural: [
    { param: 'b1 ~ a1', est: -0.1840309, se: 0.05650942 }, // line 46
    { param: 'b1 ~ cont1', est: -0.83672956, se: 0.08799997 }, // line 47
    { param: 'b2 ~ b1', est: 0.39475332, se: 0.05335241 }, // line 48
  ],
}
