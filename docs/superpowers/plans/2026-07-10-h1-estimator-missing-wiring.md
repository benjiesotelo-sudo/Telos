# H1 Wiring Implementation Plan: estimator + missing-data dropdowns drive the lavaan fit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the CB-SEM card's estimator (ML/MLR/WLSMV) and missing-data (listwise/FIML/pairwise) dropdowns actually parameterize the lavaan fit, identically in the app and the exported analysis.R, per the approved spec `docs/superpowers/specs/2026-07-10-h1-estimator-missing-wiring-design.md`.

**Architecture:** A new pure module `src/lib/stats/semFitArgs.ts` computes the lavaan argument fragment and all guard/disclosure facts once; `runCbSem.ts` and the latent export emitter both consume it, so app and export arguments are byte-identical by construction. Approach B from the spec.

**Tech Stack:** TypeScript + React (Zustand), WebR (lavaan in WASM), vitest, Playwright, native R 4.6.0 for verification.

## Global Constraints

- NEVER use the em dash character anywhere (code, copy, spec HTML, commit messages). The repo has an emdash guard test; plain dash only. (Owner rule.)
- Defaults are sacred: an untouched setup (estimator ML, missing listwise) must produce byte-identical output everywhere. `semFitArgs` returns an EMPTY fragment for that cell.
- `tsc --noEmit` is VACUOUS in this repo (files:[] root tsconfig). Always verify with `npx tsc -b --force`.
- Never push or deploy; commits stay local. Benjie's word governs pushes.
- Run `npm run test:fast` before every commit; the full suite (`npm test`) and e2e run at the gates named in Tasks 11-12.
- The three root spec HTMLs are LOCKED except for the exact amendment in Task 9, which Benjie approved on 2026-07-10.
- All native-R verification uses R 4.6.0 (`Rscript`), same machine standard as the existing runs-in-r gate.
- New citations must be web-verified against their actual sources before entering the registry (slice-5 provenance standard).

## Statistical rulings this plan encodes (from the spec, all Benjie's)

1. MI is REMOVED from the missing dropdown. Missing options: `fiml`, `pairwise`, `listwise` (default).
2. WLSMV auto-declares `ordered=` from Configure-data column levels; requires >= 1 ordinal indicator; blocked under moderation (existing guard); FIML requires ML-family (ML or MLR).
3. Bootstrap runs under estimator ML ONLY. Under MLR/WLSMV, `se` stays the estimator's robust default and indirect/moderation CIs are delta-method, flowing through the EXISTING `bootstrapped: false` builder path (see `CbSemResult.bootstrapped` in runCbSem.ts:76-83).
4. The step-4a mismatch warning is wired (spec amendment kept the promise): when the CB-SEM missing choice differs from the global `missingPolicy`, the config card shows a note.

## File structure (created / modified)

| File | Responsibility |
|---|---|
| Create `src/lib/stats/semFitArgs.ts` | THE single source of fit parameterization: fragment string, guards, disclosure facts |
| Create `src/lib/stats/semFitArgs.test.ts` | Pure unit tests: every guard, every fragment byte-exact |
| Create `docs/testing/likert5.csv` + `docs/testing/politicalDemocracy-missing.csv` | Ordinal fixture; missing-data fixture (Task 4) |
| Create `scripts/spikes/h1-estimator-spike.R` + WebR twin | Task 0 spike artifacts |
| Modify `src/lib/stats/runCbSem.ts` | Consume semFitArgs; full-rows-with-NA env path; robust fitMeasures; bootstrap gate |
| Modify `src/components/SemControls.tsx` (+ test) | MI removed; bootstrap greyed under non-ML; WLSMV greyed w/o ordinal; 4a warning |
| Modify `src/lib/results/buildCbSem.ts` (+ test) | Robust fit-index labels; estimator in APA sentence; disclosure notes |
| Modify `src/lib/export/rScript/emitters/latent.ts` (+ tests) | Same fragment + comment block in analysis.R |
| Modify `src/lib/registry/citations.ts` | 4 new refs, conditional-basis mechanism |
| Modify `src/lib/registry/cbSem.ts` | options strings + rMap text match wired reality |
| Modify `telos_test_inputs.html` | Task 9 approved amendment ONLY |
| Modify `src/lib/export/rScript/runs-in-r.test.ts` | One REP per verified matrix cell |
| Modify `tests/e2e/` (sem spec) | One MLR journey |

## Verification matrix (8 cells, each: WebR === native R, and export reproduces)

| | listwise | fiml | pairwise |
|---|---|---|---|
| ML | cell 1 (today's behavior, byte-pin) | cell 2 | cell 3 |
| MLR | cell 4 | cell 5 | cell 6 |
| WLSMV | cell 7 | guarded (FIML needs ML-family) | cell 8 |

---

### Task 0: Feasibility + calibration spike (native R first, then WebR)

The spike answers five questions the rest of the plan depends on. Its numeric outputs become the pinned expectations of Tasks 4-5. No production code changes.

**Files:**
- Create: `scripts/spikes/h1-estimator-spike.R`
- Create: `scripts/spikes/h1-estimator-spike.node.mjs` (WebR twin; copy the harness pattern from the SEM feasibility spike referenced in `docs/superpowers/reviews/2026-06-18-sem-feasibility-spike.md`)
- Create: `docs/superpowers/reviews/2026-07-10-h1-estimator-spike.md` (findings)

**Interfaces:**
- Produces: pinned numeric expectations (8dp) per matrix cell for Tasks 4, 5, 10; confirmed lavaan fitMeasures key names per estimator; confirmed NaN-as-NA marshalling behavior.

- [ ] **Step 1: Write the native-R spike script**

```r
# scripts/spikes/h1-estimator-spike.R
# Q1: exact fitMeasures names available under MLR and WLSMV (robust vs scaled)
# Q2: missing="ml"/"pairwise"/"listwise" all run under sem() for ML and MLR
# Q3: WLSMV with mixed ordered= + continuous indicators fits
# Q4: parameterEstimates() CIs without bootstrap are delta-method (documents cell 4-8 CI provenance)
# Q5 lives in the WebR twin: NaN in the data.frame is treated as missing (is.na(NaN) is TRUE)
library(lavaan)
data(PoliticalDemocracy)
model <- '
  ind60 =~ x1 + x2 + x3
  dem60 =~ y1 + y2 + y3 + y4
  dem60 ~ ind60
'
# Punch deterministic holes for the missing cells (seeded, ~8% of cells in y1..y4)
set.seed(20260710)
pd <- PoliticalDemocracy
for (col in c("y1","y2","y3","y4")) {
  idx <- sample(seq_len(nrow(pd)), size = 6)
  pd[idx, col] <- NA
}
write.csv(pd, "scripts/spikes/politicalDemocracy-missing.csv", row.names = FALSE)

cells <- list(
  list(est = "ML",    miss = "listwise"),
  list(est = "ML",    miss = "ml"),
  list(est = "ML",    miss = "pairwise"),
  list(est = "MLR",   miss = "listwise"),
  list(est = "MLR",   miss = "ml"),
  list(est = "MLR",   miss = "pairwise")
)
for (c_ in cells) {
  fit <- lavaan::sem(model, data = pd, estimator = c_$est, missing = c_$miss)
  cat("=== ", c_$est, "/", c_$miss, " ===\n")
  print(round(lavaan::fitMeasures(fit), 8))          # Q1: dump EVERY name; note .scaled/.robust
  print(round(lavaan::parameterEstimates(fit)[, c("lhs","op","rhs","est","se","ci.lower","ci.upper")], 8))
}

# Q3: WLSMV, mixed ordinal + continuous (likert5 fixture written here too)
set.seed(20260710)
n <- 300
lv <- rnorm(n)
lik <- function(x) cut(x + rnorm(n, sd = .8), breaks = c(-Inf, -1, -.3, .3, 1, Inf), labels = FALSE)
likert <- data.frame(a1 = lik(lv), a2 = lik(lv), a3 = lik(lv),
                     b1 = lik(-lv), b2 = lik(-lv), b3 = lik(-lv),
                     cont1 = lv + rnorm(n, sd = .5), cont2 = lv + rnorm(n, sd = .5))
write.csv(likert, "docs/testing/likert5.csv", row.names = FALSE)
mixed_model <- '
  A =~ a1 + a2 + a3
  C =~ cont1 + cont2
  B =~ b1 + b2 + b3
  B ~ A + C
'
for (miss in c("listwise", "pairwise")) {
  fit <- lavaan::sem(mixed_model, data = likert, estimator = "WLSMV",
                     ordered = c("a1","a2","a3","b1","b2","b3"), missing = miss)
  cat("=== WLSMV /", miss, " ===\n")
  print(round(lavaan::fitMeasures(fit), 8))
  print(round(lavaan::parameterEstimates(fit)[, c("lhs","op","rhs","est","se")], 8))
}
```

- [ ] **Step 2: Run it under native R; capture output**

Run: `Rscript scripts/spikes/h1-estimator-spike.R > scripts/spikes/h1-spike-native.txt 2>&1; echo "exit $?"`
Expected: `exit 0`; output contains `cfi.robust`/`rmsea.robust` rows under MLR and `cfi.scaled`/`chisq.scaled` under WLSMV (record WHICH names exist; if `.robust` is absent for WLSMV, the plan's Task 5 uses `.scaled` for it - the spike report states the final name set).

- [ ] **Step 3: Write and run the WebR twin for the same cells + the NaN question**

The twin loads the same model/cells through the repo's WebR node harness and additionally asserts: a JS `NaN` marshalled into the env arrives as a missing value in R (`is.na()` TRUE) so the full-rows env path of Task 3 is sound.
Run: `node scripts/spikes/h1-estimator-spike.node.mjs > scripts/spikes/h1-spike-webr.txt 2>&1; echo "exit $?"`
Expected: `exit 0`; every printed estimate/fit number matches native to 8dp; NaN check prints `NA-ok`.

- [ ] **Step 4: Write the findings doc and commit**

`docs/superpowers/reviews/2026-07-10-h1-estimator-spike.md` records: the confirmed fitMeasures name set per estimator (this becomes Task 3's `fm` vector), the 8dp pinned values per cell (these become Task 5/10 expectations), NaN-marshalling verdict, and both fixture files' provenance (seed 20260710).

```bash
git add scripts/spikes/ docs/superpowers/reviews/2026-07-10-h1-estimator-spike.md docs/testing/likert5.csv
git commit -m "spike(h1): estimator/missing matrix runs in native R + WebR; fitMeasures names + NaN marshalling pinned"
```

**GATE: if any spike question fails (a cell errors in WebR, NaN does not marshal as NA), STOP and surface to Benjie before any production task.**

---

### Task 1: `semFitArgs.ts` - the shared fit-args module (TDD)

**Files:**
- Create: `src/lib/stats/semFitArgs.ts`
- Test: `src/lib/stats/semFitArgs.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (pure).
- Produces (exact, used by Tasks 3, 6, 7):

```ts
export type SemEstimator = 'ML' | 'MLR' | 'WLSMV'
export type SemMissing = 'listwise' | 'fiml' | 'pairwise'

export interface SemFitArgsInput {
  estimator: string                       // raw setup.options['estimator'] ?? 'ML'
  missing: string                         // raw setup.options['missing'] ?? CB_SEM_DEFAULT_MISSING
  /** raw (display) indicator/observed column name -> measurement level from Configure-data */
  indicatorLevels: Record<string, 'scale' | 'ordinal' | 'nominal' | string>
  /** raw -> sanitized R token (runCbSem's itemNameOf; identity in the emitter default path) */
  itemNameOf: (raw: string) => string
  hasModeration: boolean
  wantsBootstrap: boolean                 // hasIndirect || hasModeration (the CURRENT needsBootstrap)
}

export interface SemFitArgs {
  estimator: SemEstimator
  missing: SemMissing
  /** lavaan argument fragment WITHOUT leading comma; '' exactly for ML+listwise (the byte-pin) */
  fragment: string
  orderedRaw: string[]                    // raw names, for the card disclosure
  orderedR: string[]                      // sanitized tokens, inside fragment's ordered=c(...)
  bootstrapAllowed: boolean               // estimator === 'ML'
  needsBootstrap: boolean                 // wantsBootstrap && bootstrapAllowed
  ciMethod: 'bootstrap' | 'delta'         // what indirect/moderation CIs actually are
  robustLabels: boolean                   // estimator !== 'ML' -> fit table uses robust/scaled names
  /** true when missing !== 'listwise': the runner must pass FULL rows (with NA) to R */
  passFullRows: boolean
}

export function semFitArgs(input: SemFitArgsInput): SemFitArgs
```

Guard errors (thrown, exact messages):
- `'FIML requires an ML-family estimator (ML or MLR); under WLSMV use pairwise or listwise.'`
- `'WLSMV requires at least one ordinal indicator; all indicators are scale-level - use ML or MLR.'`
- `'Latent moderation requires an ML-family estimator (ML or MLR); switch off WLSMV or remove the moderation edge.'` (verbatim the existing runCbSem message, which moves here)

Fragment rules (exact strings, asserted byte-exactly in tests):
- ML + listwise: `''`
- estimator when not ML: `estimator = "MLR"` or `estimator = "WLSMV"`
- missing when not listwise: `missing = "ml"` (for fiml) / `missing = "pairwise"`
- WLSMV always adds: `ordered = c("a1", "a2")` (sanitized tokens, construct-then-item order, comma-space separated)
- parts joined with `', '` in the order estimator, missing, ordered.

- [ ] **Step 1: Write the failing tests** (representative set; write all of these)

```ts
import { describe, it, expect } from 'vitest'
import { semFitArgs } from './semFitArgs'

const id = (s: string) => s
const scaleLevels = { x1: 'scale', x2: 'scale' }
const mixedLevels = { a1: 'ordinal', a2: 'ordinal', c1: 'scale' }

describe('semFitArgs', () => {
  it('ML + listwise is the byte-identical empty fragment', () => {
    const r = semFitArgs({ estimator: 'ML', missing: 'listwise', indicatorLevels: scaleLevels, itemNameOf: id, hasModeration: false, wantsBootstrap: true })
    expect(r.fragment).toBe('')
    expect(r.needsBootstrap).toBe(true)
    expect(r.ciMethod).toBe('bootstrap')
    expect(r.robustLabels).toBe(false)
    expect(r.passFullRows).toBe(false)
  })
  it('unknown option values fall back to the defaults (display-era junk must not throw)', () => {
    const r = semFitArgs({ estimator: 'mi', missing: 'mi', indicatorLevels: scaleLevels, itemNameOf: id, hasModeration: false, wantsBootstrap: false })
    expect(r.estimator).toBe('ML'); expect(r.missing).toBe('listwise')
  })
  it('MLR + fiml: fragment exact, bootstrap suppressed, delta CIs', () => {
    const r = semFitArgs({ estimator: 'MLR', missing: 'fiml', indicatorLevels: scaleLevels, itemNameOf: id, hasModeration: false, wantsBootstrap: true })
    expect(r.fragment).toBe('estimator = "MLR", missing = "ml"')
    expect(r.needsBootstrap).toBe(false)
    expect(r.ciMethod).toBe('delta')
    expect(r.robustLabels).toBe(true)
    expect(r.passFullRows).toBe(true)
  })
  it('WLSMV auto-declares only the ordinal indicators, sanitized', () => {
    const r = semFitArgs({ estimator: 'WLSMV', missing: 'pairwise', indicatorLevels: mixedLevels, itemNameOf: (s) => s + '_r', hasModeration: false, wantsBootstrap: false })
    expect(r.fragment).toBe('estimator = "WLSMV", missing = "pairwise", ordered = c("a1_r", "a2_r")')
    expect(r.orderedRaw).toEqual(['a1', 'a2'])
  })
  it('guards: FIML under WLSMV / WLSMV without ordinal / WLSMV under moderation', () => {
    expect(() => semFitArgs({ estimator: 'WLSMV', missing: 'fiml', indicatorLevels: mixedLevels, itemNameOf: id, hasModeration: false, wantsBootstrap: false }))
      .toThrow('FIML requires an ML-family estimator')
    expect(() => semFitArgs({ estimator: 'WLSMV', missing: 'listwise', indicatorLevels: scaleLevels, itemNameOf: id, hasModeration: false, wantsBootstrap: false }))
      .toThrow('at least one ordinal indicator')
    expect(() => semFitArgs({ estimator: 'WLSMV', missing: 'listwise', indicatorLevels: mixedLevels, itemNameOf: id, hasModeration: true, wantsBootstrap: true }))
      .toThrow('Latent moderation requires an ML-family estimator')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/stats/semFitArgs.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement the module** (complete; guards first, then normalization, then fragment assembly exactly per the rules above)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/stats/semFitArgs.test.ts` -> PASS. Then `npm run test:fast` -> all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats/semFitArgs.ts src/lib/stats/semFitArgs.test.ts
git commit -m "feat(sem): semFitArgs - single source of lavaan fit parameterization (guards + byte-exact fragment)"
```

---

### Task 2: SemControls UI - MI gone, greying rules, 4a warning (TDD)

**Files:**
- Modify: `src/components/SemControls.tsx` (MISSING_OPTS at :18-23; estimator select at :84-121; container at :150-180)
- Test: `src/components/SemControls.test.tsx` (extend)

**Interfaces:**
- Consumes: `semFitArgs` types only for naming consistency; greying logic stays presentational (props).
- Produces: new `SemControlsUIProps` fields consumed by the container:

```ts
hasOrdinalIndicator: boolean   // any construct item's column level is 'ordinal'
globalMissingPolicy: string    // session missingPolicy ('leave' | 'impute' | ...)
```

Behavior (each a test):
1. MISSING_OPTS no longer contains `mi`; snapshot of option ids is exactly `['fiml','pairwise','listwise']`.
2. Bootstrap fieldset controls get `disabled` and a note `'Bootstrap CIs require the ML estimator; MLR/WLSMV report their own robust standard errors and delta-method CIs.'` when estimator !== 'ML'.
3. WLSMV `<option>` disabled when `!hasOrdinalIndicator`, with hint `'WLSMV needs at least one ordinal indicator; all your indicators are scale-level - use ML or MLR.'` shown while it is the (stale) selection or on hover-free render when disabled for that reason.
4. Step-4a mismatch note when `missingOptionValue(o) !== 'listwise'` differs in spirit from `globalMissingPolicy` - shown whenever the SEM missing choice is not `'listwise'` AND `globalMissingPolicy !== 'leave'`: `'Your Configure-data missing setting is "<label>"; this SEM fit uses <FIML|pairwise> instead.'`
5. A stale `missing: 'mi'` in a saved setup renders as the default (listwise) - `missingOptionValue` maps unknown ids to `CB_SEM_DEFAULT_MISSING`.

Steps: failing tests -> run (`npx vitest run src/components/SemControls.test.tsx`) -> implement -> pass -> `npm run test:fast` -> commit `feat(sem-ui): missing dropdown drops MI; bootstrap greys under robust estimators; WLSMV needs an ordinal indicator; step-4a mismatch note`.

---

### Task 3: Wire the runner (TDD against mocked engine, then real WebR in Task 5)

**Files:**
- Modify: `src/lib/stats/runCbSem.ts`
- Test: `src/lib/stats/runCbSem.test.ts` (extend the existing mocked-engine tests)

**Interfaces:**
- Consumes: `semFitArgs(input)` from Task 1.
- Produces (Tasks 6-7 rely on these): `CbSemResult` gains

```ts
estimator?: SemEstimator        // what actually ran; default 'ML' in builder for old fixtures
orderedItems?: string[]         // raw names disclosed as ordinal (WLSMV only)
ciMethod?: 'bootstrap' | 'delta'
```

Changes, in order:
1. Replace the inline moderation-WLSMV throw (:463-469) with the `semFitArgs` call placed there; build `indicatorLevels` from `data.columns` (ColumnMeta level per used raw column) - path mode uses the observed columns' levels.
2. `R_STATS` becomes `const rStats = (fragment: string) => String.raw\`...\`` and the two sem() lines interpolate: `fit <- lavaan::sem(model_str, data = d, se = "bootstrap", bootstrap = as.integer(nboot)${frag})` and `fit <- lavaan::sem(model_str, data = d${frag})` where `const frag = fitArgs.fragment ? ', ' + fitArgs.fragment : ''`. With an empty fragment the emitted R is byte-identical to today (assert in test).
3. `needsBootstrap` becomes `fitArgs.needsBootstrap` (bootstrap-under-ML-only); the progress message's bootstrap branch keys off it unchanged.
4. Data path: when `fitArgs.passFullRows`, `rows = data.rows` and non-finite/missing values marshal as `NaN` (spike-verified NA); `n = rows.length`; `computeItemStats` keeps receiving the LISTWISE rows for its listwise branch (compute them separately as today).
5. Fit measures: extend the `fm` vector conditionally. When `robustLabels`, request the spike-confirmed names (MLR: `chisq.scaled, df.scaled, pvalue.scaled, cfi.robust, tli.robust, rmsea.robust, rmsea.ci.lower.robust, rmsea.ci.upper.robust, srmr`; WLSMV: the `.scaled` set per the spike report) and map them into the SAME `fit_list` keys (`chisq`, `cfi`, ...) so the builder's shape is stable; add `fit_list$robust = TRUE`.
6. Return the three new `CbSemResult` fields; update the stale comments at :95-101 and :104-107 (CB_SEM_DEFAULT_MISSING doc: the gap is now closed) and delete the vestigial `ci_type` env binding plus its R-side comment (:157-159, :510-514) - it was kept only to round-trip an option that now genuinely gates behavior.

Tests (mocked engine): fragment reaches the R source for MLR+fiml; empty fragment for defaults (byte-compare the generated R string to a snapshot taken BEFORE the change); full-rows path passes NaN rows when fiml; `needsBootstrap` false for MLR even with indirect paths; new result fields populated.

Commit: `feat(sem): runCbSem consumes semFitArgs - fragment, robust fit measures, full-rows missing path, ML-only bootstrap`.

---

### Task 4: Fixtures - ordinal likert5 + PoliticalDemocracy-with-missing (pins from native R)

**Files:**
- Create: `tests/e2e/fixtures/likert5.csv` (copy of the spike's `docs/testing/likert5.csv`)
- Create: `src/lib/stats/fixtures/politicalDemocracy-missing.csv` (from the spike; placed per existing fixture conventions - check where runCbSem.test.ts loads PoliticalDemocracy today and mirror)
- Create: `src/lib/stats/h1Pins.ts` - the 8dp expected values per matrix cell, copied from `scripts/spikes/h1-spike-native.txt`, one exported const per cell with a comment naming the spike line range it came from.

Steps: transcribe pins -> a tiny test asserts the pins file parses and covers all 8 cells -> commit `test(sem): H1 fixtures + native-R pins for the 8-cell estimator/missing matrix`.

---

### Task 5: Known-answer engine tests - all 8 cells in real WebR

**Files:**
- Modify: `src/lib/stats/runCbSem.test.ts` (the real-WebR describe block; follow the existing PoliticalDemocracy known-answer pattern in that file)

One `it` per matrix cell: build the setup (constructs/paths as in the existing PoliticalDemocracy tests; likert5 constructs A/B/C for WLSMV cells), set `setup.options.estimator/missing`, run against the real engine, assert structural estimates + fit measures equal the Task-4 pins to 8dp, `result.bootstrapped === false` for MLR/WLSMV cells, `result.ciMethod === 'delta'` there, and `result.orderedItems` lists exactly the likert items for WLSMV cells.

Run: `npx vitest run src/lib/stats/runCbSem.test.ts` (engine suite, serialized; minutes not seconds).
Commit: `test(sem): 8-cell known-answer matrix vs native R pins (real WebR)`.

---

### Task 6: Builder - robust labels, APA estimator, disclosures (TDD)

**Files:**
- Modify: `src/lib/results/buildCbSem.ts` (+ its test)

Changes, each with a failing test first:
1. Fit-indices table rows relabel when `r.estimator` is MLR/WLSMV: `chisq` label gains `' (scaled)'`, `cfi`/`tli`/`rmsea` labels gain `' (robust)'` (WLSMV per spike naming); Hu & Bentler cutoffs note unchanged (applies to robust indices).
2. APA sentence names the estimator: ML -> `'maximum likelihood'`, MLR -> `'robust maximum likelihood (MLR)'`, WLSMV -> `'diagonally weighted least squares with mean- and variance-adjusted test statistics (WLSMV)'`.
3. Labelled notes (existing notes mechanism at :263-287): `{ label: 'Estimation', text: ... }` always present, stating estimator + missing actually used; under WLSMV adds `'Treated as ordinal: a1, a2, a3, b1, b2, b3.'` from `r.orderedItems`; under fiml adds the all-available-cases + effective-N sentence; under pairwise the N-basis sentence; when `r.ciMethod === 'delta'` and indirect/moderation rows exist, adds `'Indirect-effect and moderation CIs are delta-method (bootstrap CIs are available under the ML estimator).'`
4. Table 5 CI column provenance under delta reuses the EXISTING `bootstrapped: false` rendering (no fabricated BC columns) - add a regression test asserting an MLR result with indirect rows renders percentile columns as Wald CIs and no BC columns, mirroring runCbSem.ts:76-83's contract.
5. Defaults pin: a fixture with no estimator field renders byte-identically to the current snapshot (old fixtures stay green untouched).

Commit: `feat(sem-report): estimator-aware fit labels, APA estimator naming, ordered/FIML/delta disclosures`.

---

### Task 7: Export emitter parity (TDD)

**Files:**
- Modify: `src/lib/export/rScript/emitters/latent.ts` (sem() call sites at :495 and :504)
- Test: `src/lib/export/rScript/emitters/latent.cbsem.test.ts` (extend)

The emitter builds the SAME `SemFitArgsInput` (levels come from the export's column metadata; `itemNameOf` = the emitter's existing sanitizer from `buildItemMap`) and interpolates `fitArgs.fragment` into both sem() lines exactly as the runner does. Above the fit, emit the student-readable comment block, one line per non-default choice:

```r
# Estimator: MLR (robust maximum likelihood) - robust standard errors and scaled fit statistics.
# Missing data: FIML (missing = "ml") - uses all available cases instead of dropping incomplete rows.
# Ordinal indicators (ordered =): a1, a2, a3 - declared from your Configure-data measurement levels.
```

Tests: default setup emits byte-identical script to the pre-change snapshot; MLR+fiml emits the fragment + comment block; WLSMV emits ordered=c(...) with sanitized names; the emitted fragment string equals `semFitArgs(...).fragment` verbatim (import and compare - the parity assertion).
Commit: `feat(export): analysis.R carries the identical semFitArgs fragment + choice comments`.

---

### Task 8: Citations - four refs, conditional attachment (TDD)

**Files:**
- Modify: `src/lib/registry/citations.ts`
- Modify: the citations bridge/test that renders the footer + CITATIONS.txt (locate `citationsText`/`citationsTxt` call sites; extend their tests)

Mechanism: `TestCitations` gains an optional `conditionalBasis?: Array<{ optionKey: string; matches: string[]; claim: string; ref: Ref }>`; the renderers filter by the run's `setup.options` (default-filled), so the refs appear ONLY when the option ran. Wire for `cb-sem` (and `path-analysis` if it shares the entry - check CATALOG):

- estimator=MLR -> Yuan, K.-H., Bentler, P. M. (2000), "Three likelihood-based methods for mean and covariance structure analysis with nonnormal missing data", Sociological Methodology, 30, 165-200.
- estimator=WLSMV -> Muthen, B. O. (1997)... **WEB-VERIFY the exact Muthen WLSMV source before entering it** (candidates: Muthen 1984 Psychometrika or Muthen, du Toit & Spisic 1997 unpublished; pick what the provenance check supports, as the slice-5 audit did).
- missing=fiml -> Enders, C. K., Bandalos, D. L. (2001), "The relative performance of full information maximum likelihood estimation for missing data in structural equation models", Structural Equation Modeling, 8(3), 430-457.
- ciMethod=delta (estimator != ML with indirect defs) -> Sobel, M. E. (1982), "Asymptotic confidence intervals for indirect effects in structural equation models", Sociological Methodology, 13, 290-312.

Each ref: fetch the actual source page/DOI, confirm authors/year/title/venue verbatim, THEN transcribe. Tests: footer shows Yuan-Bentler only for MLR runs; CITATIONS.txt/references.bib include the refs only when earned; default run's citation output is unchanged.
Commit: `feat(citations): conditional method refs - Yuan-Bentler, WLSMV source, Enders-Bandalos, Sobel (web-verified)`.

---

### Task 9: The approved locked-spec amendment + registry text

**Files:**
- Modify: `telos_test_inputs.html` (CB-SEM card only: the `ddcap`/`ddmenu` block near :2598-2605 and the how-to paragraph at :2608)
- Modify: `src/lib/registry/cbSem.ts` (:16-17 options values; :134 rMap)

Approved by Benjie 2026-07-10. Exact replacements:

ddcap: `missing-data method &middot; FIML needs ML/MLR; under WLSMV use pairwise`
ddmenu rows (MI row DELETED, listwise becomes selected):

```html
<div class="ddrow off"><span class="o">FIML</span><span class="g">all available data, no deletions - needs ML/MLR; generally preferred over imputation for SEM</span></div>
<div class="ddrow"><span class="o">pairwise</span><span class="g">each pair's available cases - use with WLSMV; assumes data missing completely at random</span></div>
<div class="ddrow sel"><span class="o">listwise &#10003;</span><span class="g">drops any row with a missing value - the default; simplest, but loses data</span></div>
```

How-to sentence replacing the MI promise (keep the surrounding text; the warning promise is KEPT because Task 2 wires it): `Missing data: choose FIML (needs ML/MLR; generally preferred over multiple imputation for SEM) or pairwise under WLSMV; listwise is the default. Telos notes when your choice differs from your global step-4a setting.`

Registry: options value strings become `'WLSMV (ordinal) / ML / MLR'` (unchanged) and `'listwise (default) / FIML / pairwise'`; both lose `kind: 'display'` if that key is what excludes them from `freshSetup` persistence - CHECK `freshSetup`'s filter (SemControls.tsx:151-154 comment) and keep the default-suppression behavior working (untouched dropdowns must still not write options). rMap: append `' - estimator/missing/ordered wired via semFitArgs (H1)'` is NOT needed; instead correct it to name the actual arguments: replace `'lavaan::sem() (estimator ML/MLR or WLSMV)'` with `'lavaan::sem(estimator=, missing=, ordered=)'`.

Steps: consistency tests run BEFORE (green), edit, consistency + fast suite run AFTER (green), visual check of the card in the browser (open the spec HTML), commit `docs(spec): CB-SEM card - MI removed per H1 ruling, listwise default drawn, guidance matches wired reality (owner-approved amendment)`.

---

### Task 10: runs-in-r gate - one REP per matrix cell

**Files:**
- Modify: `src/lib/export/rScript/runs-in-r.test.ts` (REPS list; follow the existing REP shape at :51+)

Eight REPs (or extend existing cb-sem REPs with option variants): each builds the export for a cell's setup, executes under native `Rscript`, asserts exit 0 plus a cell-distinguishing needle in stdout (e.g. the MLR scaled chi-square value from the Task-4 pins, formatted as the script prints it).
Run: `npm test -- runs-in-r` (native R required).
Commit: `test(export): runs-in-r covers the 8-cell estimator/missing matrix`.

---

### Task 11: e2e journey - MLR through the real app

**Files:**
- Modify: `tests/e2e/` sem spec (follow the existing CB-SEM journey; drag helpers already handle below-fold chips)

Journey: upload likert5.csv -> configure levels (a/b items ordinal) -> CB-SEM -> constructs A/B + path -> pick MLR + FIML -> run -> assert the results card shows `(robust)` fit labels, the Estimation note naming MLR + FIML, and no bootstrap-progress copy; export zip contains analysis.R with `estimator = "MLR", missing = "ml"`.
Run: `npm run e2e` (all projects).
Commit: `test(e2e): MLR+FIML journey - robust labels, estimation disclosure, export fragment`.

---

### Task 12: Final gate + docs + ratify

- [ ] `npx tsc -b --force` -> 0 errors
- [ ] `npm run test:fast` -> green; `npm test` FULL suite twice -> green, 0 skipped
- [ ] `npm run e2e` -> green, all five Playwright projects
- [ ] Fresh-clone proof (clone to a temp dir, install, test:fast, build)
- [ ] Regenerate per-test doc 46_cb-sem (and 48_path-analysis if touched) via `docs/build-test-doc.mjs`; visual audit
- [ ] Check visual baselines: if the greyed bootstrap fieldset changed a captured screen, produce the diff set for Benjie's approval; do NOT regenerate without his word
- [ ] Write `docs/superpowers/reviews/2026-07-10-h1-wiring-ratify.md`: rulings applied, matrix results table, anything held
- [ ] Commit; NO push (Benjie's word)

## Self-review (run before handoff)

1. Spec coverage: rulings 1-4 -> Tasks 2/9 (MI), 1/3 (WLSMV ordered), 1/3/6 (bootstrap-ML-only + delta), 2 (4a warning); architecture -> 1/3/7; card behavior -> 6; exports/citations -> 7/8; matrix + fixtures -> 0/4/5/10; UI/journey -> 2/11; pins -> every task's default-byte-identical assertions.
2. Placeholders: the one deliberate open lookup is the exact Muthen WLSMV source in Task 8, which is itself specified as a web-verification step with named candidates - allowed by the provenance standard, not a TBD.
3. Type consistency: `semFitArgs`/`SemFitArgs`/`SemFitArgsInput` names match across Tasks 1/3/7; `CbSemResult.estimator/orderedItems/ciMethod` match across 3/6; fragment byte-rules identical in 1/3/7/9.
