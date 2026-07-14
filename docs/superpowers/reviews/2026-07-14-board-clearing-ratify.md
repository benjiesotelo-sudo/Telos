# Board-clearing slice - ratify list (built 2026-07-14/15)

Every item was owner-ruled BEFORE building (D1-D7 confirmed + wiring-inspection verdicts + figure rulings).
14 tasks, subagent-driven with per-task adversarial review; 3 session-limit interruptions survived with zero lost work (phased checkpoints).
Commits `d8ecce9..ea14441` (17 on main, not pushed).

## (a) Rulings executed - all 17 shipped

| R | Ruling | Outcome |
|---|---|---|
| R1 | Wire the EFA stage (your H2 find) | Tables E1-E2 render when selected; **record correction: the stage was dead END-TO-END** (the runner never computed EFA either; the old audit phrasing overstated it) - wired runner + builder + export from one shared R fragment, native-verified |
| R2 | Wire the CI pill (4 tests) | Emitters thread the chosen level into every screen-visible CI call; deliberate parity-by-default kept where the app pins 95% (AUC, smooth band); native-verified at 95% AND 90% |
| R3 | Wire the stationarity selector | Genuinely subsets app + export; 'both' byte-identical except the new "Tests run:" disclosure; KPSS inverted-null verdict verified correct + test-pinned |
| R4 | Line chart replaces whiskers | Two-line interaction chart on both SEM cards, computed from the SAME := parameters as the conditional-effects table (which stays); default R styling per your colors ruling; CB export gains the figure it never had |
| R5 | "null" label | Product-indicator groups labeled `IV×Moderator (product indicators)`; bonus fix: multi-moderation groups no longer merge |
| R6 | PLS Hair-2019 completeness | f² + inner VIF added (straight from seminr; honest dash for single-antecedent); f² was computed-but-never-exported = another parity break fixed; tradition explainers on both cards; Q² verified untouched |
| R7 | WLSMV auto-fallback | Store-level guard in revalidated() covers every mutation; visible reset hint; e2e-proven |
| R8 | Saturated disclosure | Ordinal-treatment note renders on saturated path models; fit suppression unchanged |
| R9 | Canvas auto-layout + auto-Fit | Diamond slots (render-time, manual drag always wins, live reclassification); auto-Fit unless you panned/zoomed; export inherits; 6-construct e2e needs no Fit click |
| R10 | "Multiple regression" | Catalog label + pins updated |
| R11 | Combined correlation matrix | "Table 3a" after HTMT (√AVE italic diagonal, Mean/SD appended, definition disclosed on-card); no new runner R; native-pinned two datasets |
| R12 | Rename remaps construct items | Store fix, collision-safe |
| R13 | Hygiene | semEndogeneity.ts single source (4 hand-synced copies deleted, transplant byte-verified); path-analysis registry pins added |
| R14 | Phone overlap | Theme-select floats bottom-right at <=560px; geometry e2e at 2 viewports; 12 phone baselines regenerated (diff set below) |
| R15 | Pre-commit guard | Blocks all 7 owner-doc groups (review caught + fixed a missing 7th pattern); auto-installs on npm install (fresh-clone-proven) |
| R16 | Sweep = permanent gate | 160ms fast-suite gate, 48 tests x every option x every promised table; allowlist exact BOTH directions (reviewer mutation-proved); the fixed defects are NOT allowlisted |
| R17 | Docs regen | 9 affected auditor pages + index regenerated from fresh app captures with native-R reruns |

## (b) NEEDS YOUR WORD - one real decision

**The MLR residual CI gap (T2 discovery):** multiple-linear-regression's own main coefficient table does not thread the CI level into the export (the sweep missed it because its beta calls do change the script). Same class as the four you ruled WIRE. One-word verdict: wire it (one argument into its modelsummaryCall - minutes) or hold. Recommend WIRE, ideally before push so the slice ships the class complete.

## (c) Ratify notes - flag anything you want changed

1. "Table 3a" label for the new matrix (chosen to avoid renumbering the deeply pinned Table 5) - bless or rename.
2. The read-only spec twin still says "whiskered"/simple-slopes and numbers tables differently than the live card (both PRE-EXISTING divergences) - a twin refresh is your call, separately.
3. T3's "Tests run:" disclosure now also appears on default 'both' runs - sanctioned by your R3 ruling, but it is the one default-path output change.
4. Landscape-phone band (561-700px) still has the old theme-select overlap - pre-existing, not created by R14; backlog candidate.
5. Visual-gate tolerance (200 maxDiffPixels) let 11 stale phone baselines pass - consider tightening; owner call.
6. Auto-layout calibration: extreme item counts (5+ on a mediator, 7+ side items) can graze neighbors; a drag recovers.
7. T13's one future gap: a break INSIDE the fixed-n branch would hide behind the retention-gated allowlist entries; cure = one fixed-n REP later.
8. T11's one-time test-collection flake did NOT reappear at the full gate - closed as transient.
9. Baseline diff set for your review: `.superpowers/sdd/board-clearing-baseline-diffs/` (the 12 phone screens).

## (d) Gate evidence (final HEAD `ea14441`)

| Gate | Result |
|---|---|
| tsc -b --force | clean |
| test:fast | 1782/1782, 165 files (incl. the new 160ms wiring gate) |
| FULL vitest (WebR + native-R) | 2107/2107, 225 files, 61 min |
| Playwright, all 5 projects | 56/56 (all pending-gate e2e executed) |
| Docs regen | 9 pages + index, every exported analysis.R re-verified native |
| Fresh clone | install + tsc + 1782/1782 + build clean + guard hook auto-installed |
| Wiring sweep (CLI) | 0 NEW, 0 stale, 48/48 coverage |

## (e) After your click-through

Push word -> push + redeploy (the live site and the Pages docs update together). The agenda then holds only the parked epic, JOSS (November), and whatever your faculty auditors send this week.
