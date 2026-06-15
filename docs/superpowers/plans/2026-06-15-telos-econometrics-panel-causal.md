# Econometrics sub-slice 2 — Panel + cross-sectional causal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 7 panel + causal econometrics tests — Fixed effects, Random effects, Hausman, DiD, IV/2SLS,
RDD, PSM — live in Telos, faithful to the drawn cards, at full econometrics-grade, with verified native-R
numbers and the testing-data documentation updated for an external completeness review.

**Architecture:** Spec `docs/superpowers/specs/2026-06-15-telos-econometrics-panel-causal-design.md`. Each test
follows the established 4-layer pattern: catalog leaf (flip `later-slice`→`available`) → `TestSpec` registry
file → stats runner in `RUNNERS` → builder in `BUILDERS`. One new `entity` RoleConstraint + one new `panel`
MinRule are the only backbone additions; the `time` role + `excludeTag:'datetime'` come free from sub-slice 1.
Lighter regimen: a verification spike first, backbone serial, 7 tests in parallel worktrees, serial
integration, two e2e journeys, one combined opus review, gates ×2 + fresh clone.

**Tech Stack:** React/TS/Vite; WebR 0.6.0; R packages `plm`, `sandwich`, `lmtest` (have), `ivreg`, `rdrobust`,
`MatchIt`; ggplot2 + base graphics for figures; vitest + Playwright.

**Conventions (all from the spec — apply everywhere):** report-only APA (neutralise Hausman + PSM verdicts,
soften IV); adjustable α + CI level threaded `{pct}% CI` (no tails); distinct `TableSpec.domId` per table on
multi-table cards; `figure_*.png` bundle names; `decode()` re-scan for unmapped entities; mirror the analog
`var.ts` comment convention documenting card deviations.

---

## File structure

**Create (registry):** `src/lib/registry/{fixedEffects,randomEffects,hausmanTest,did,ivTwoStage,rdd,
propensityScoreMatching}.ts`
**Create (stats runners):** `src/lib/stats/{fixedEffects,randomEffects,hausmanTest,did,ivTwoStage,rdd,
propensityScoreMatching}.ts`
**Create (builders):** `src/lib/results/{buildFixedEffects,buildRandomEffects,buildHausmanTest,buildDid,
buildIvTwoStage,buildRdd,buildPropensityScoreMatching}.ts`
**Create (tests):** one `*.test.ts` beside each stats runner + each builder; card-consistency cases extend the
existing consistency test.
**Create (fixtures):** `tests/e2e/fixtures/panel.csv`, `tests/e2e/fixtures/causal.csv`; builder scripts
`docs/testing/build-panel.mjs`, `docs/testing/build-causal.mjs`.
**Create (e2e):** `tests/e2e/econometrics-panel.spec.ts`, `tests/e2e/econometrics-causal.spec.ts`.
**Modify:** `src/lib/registry/types.ts` (add `panel` MinRule), `src/lib/eligibility/eligibility.ts` (panel
branch + helpers + test), `src/lib/registry/catalog.ts` (imports + flip 7 leaves + SPECS), `src/lib/results/
builders.ts` (RUNNERS/BUILDERS), the WebR preload list (`src/lib/webr/engine.ts`), `src/lib/format/decode.ts`
(entities, if any), `docs/testing/build-wage1-extended.mjs` (causal columns), `docs/testing/
test-config-guide.md`, `docs/TEST_CATALOG.md` (regen), `README.md`, `docs/superpowers/ROADMAP.md`.

---

## Task 1: Fixtures + verification spike (ground truth)

**Files:**
- Create: `docs/testing/build-panel.mjs`, `docs/testing/build-causal.mjs`, `tests/e2e/fixtures/panel.csv`,
  `tests/e2e/fixtures/causal.csv`
- Create: `docs/superpowers/reviews/2026-06-15-panel-causal-spike.md` + `…/panel-causal-spike-data/*.json`
- Modify: `docs/testing/build-wage1-extended.mjs` (add the same causal columns to the shared dataset)

- [ ] **Step 1: Write `build-panel.mjs`** — deterministic, no `Math.random` (seed = id/period hash, the
  `wage1-extended` pattern). Emit `panel.csv`: 12 firms (`firm01`…`firm12`) × 8 years (2017–2024) = 96 rows.
  Columns: `firm`, `year`, `roa` (outcome), `leverage`, `rd_spend`, `size` (regressors with within-firm
  variation), `treated` (1 for firm01–06), `post` (1 if `year >= 2021`). Build `roa` with a real
  within-effect of `leverage` + `rd_spend` and a DiD jump on `treated*post` (so FE/Hausman/DiD are
  non-degenerate). Round to 3 dp.
- [ ] **Step 2: Write `build-causal.mjs`** — deterministic, ~200 rows, separate clean outcome per method.
  Columns `id, wage, educ, educ_iv, score, running_var, health, enroll, exper, age, ability`:
  - **IV:** `ability` (unobserved confounder), `educ = a + b*educ_iv + c*ability + jitter`,
    `wage = d + e*educ + f*ability + jitter` → `educ_iv` exogenous, excluded from wage ⇒ 2SLS recovers `e`.
  - **RDD:** `score = g + h*running_var + JUMP*(running_var >= 50) + jitter`, `running_var` 0–100. Pick `JUMP`
    large vs the jitter so `rdrobust` detects it cleanly.
  - **PSM:** propensity `p = logistic(k0 + k1*exper + k2*age + k3*ability)`, `enroll = 1 if p > median(p)`
    (≈50% treated, deterministic), `health = m + ATT*enroll + n*ability + jitter` (selection via ability).
  - Round to 3 dp. Tune the constants in the spike (Step 5) so each target is clean and non-degenerate.
- [ ] **Step 3: Generate the CSVs** — `node docs/testing/build-panel.mjs > tests/e2e/fixtures/panel.csv` and
  likewise `causal.csv`. Verify row/column counts.
- [ ] **Step 4: Copy the two fixtures to the shared-dataset folder** — `cp tests/e2e/fixtures/panel.csv
  docs/testing/` and `…/causal.csv docs/testing/` (the shared sub-slice-2 datasets, alongside the unchanged
  `wage1-extended.csv`). The `~/Documents/` copies happen in Task 13. **`wage1-extended.csv` is NOT modified**
  (spec §4.2: a clean purpose-built causal.csv beats bolting synthetic columns onto real wage data).
- [ ] **Step 5: Write + run the WebR-in-node verification spike** (after the final gate frees the machine; do
  NOT run concurrently with e2e). Cross-check each test's statistics on `panel.csv` / `causal.csv` against
  native R 4.6.0 to ≥5 sig figs, capturing the clustered/robust SE recipes the feasibility spike did not:
  - FE: `plm(roa ~ leverage + rd_spend + size, data=pdata.frame(d, index=c('firm','year')), model='within')`;
    clustered SE `lmtest::coeftest(fit, vcov=plm::vcovHC(fit, method='arellano', type='HC1', cluster='group'))`;
    CI `lmtest::coefci(fit, vcov=…, level=)`; within R² + F from `summary(fit)`.
  - RE: same with `model='random', random.method='swamy-arora'`; R²/adj.R² from summary.
  - Hausman: `plm::phtest(fe, re)` → χ²/df/p; align `coef(fe)` vs `coef(re)`.
  - DiD: `lm(roa ~ treated*post, data=d)`; clustered SE `sandwich::vcovCL(fit, cluster=~firm)` →
    `lmtest::coeftest`/`coefci`.
  - IV: first stage `lm(educ ~ educ_iv + exper + age)` (coef/SE/partial F); `ivreg::ivreg(wage ~ educ + exper +
    age | educ_iv + exper + age)`, `summary(…, diagnostics=TRUE)` → 2SLS coefs + weak-IV F / Wu–Hausman /
    Sargan; robust SE `sandwich::vcovHC`.
  - RDD: `rdrobust::rdrobust(d$wage, d$running_var, c=50, p=1, level=95)` → bandwidth/estimate/SE/z/p/CI/Nh.
  - PSM: `MatchIt::matchit(program ~ exper + age + ability, data=d, method='nearest', ratio=1)`; balance
    (`summary(m)$sum.all` / `$sum.matched` std mean diff + var ratio); ATT `lm(wage ~ program,
    data=MatchIt::match.data(m), weights=weights)` → estimate/SE/t/p/CI.
  - Confirm `sandwich` loads; confirm whether `cobalt` loads (→ decide hand-rolled love plot).
- [ ] **Step 6: Commit ground truth** — per-test JSON under `…/panel-causal-spike-data/` + the spike report.
  Each later task asserts against these exact values.
- [ ] **Step 7: Commit**

```bash
git add docs/testing/build-panel.mjs docs/testing/build-causal.mjs tests/e2e/fixtures/panel.csv tests/e2e/fixtures/causal.csv docs/testing/panel.csv docs/testing/causal.csv docs/superpowers/reviews/2026-06-15-panel-causal-spike.md docs/superpowers/reviews/2026-06-15-panel-causal-spike-data
git commit -m "test(econ): panel+causal fixtures + verification spike (native-R ground truth)"
# NOTE: docs/testing/*.csv are untracked per Benjie's call on the testing dataset — only commit if he has
# opted to track them; otherwise leave them untracked (the e2e fixtures under tests/e2e/ are the committed copies).
```

---

## Task 2: Backbone — `entity` role, `panel` MinRule, preload

**Files:**
- Modify: `src/lib/registry/types.ts`, `src/lib/eligibility/eligibility.ts`,
  `src/lib/eligibility/eligibility.test.ts`, the WebR preload list (`src/lib/webr/engine.ts`)

- [ ] **Step 1: Add the `panel` MinRule** to `types.ts`:

```ts
export type MinRule =
  | { kind: 'rows-per-group'; n: number }
  | { kind: 'complete-pairs'; n: number }
  | { kind: 'values'; n: number }
  | { kind: 'used-columns'; n: number }
  | { kind: 'complete-wide-rows'; n: number }
  | { kind: 'panel'; n: number } // FE/RE/Hausman: ≥2 entities, ≥2 periods, ≥n complete (entity,time,outcome,≥1 regressor)
```

- [ ] **Step 2: Write the failing eligibility test** in `eligibility.test.ts`: a panel spec (roles
  entity/time/outcome/regressors, `minRule:{kind:'panel',n:12}`) is eligible on `panel.csv`'s columns and
  greyed when only 1 entity or <12 complete rows.
- [ ] **Step 3: Add the `panel` branch** to `testEligibility` (roles order = entity, time, outcome,
  regressors → candidates[0..3]) with a `completePanelRows` helper:

```ts
// helper
export function panelStructure(ds: Dataset, entity: string, time: string, outcome: string, regressors: string[]) {
  let complete = 0
  for (const r of ds.rows) {
    const e = r[entity], t = r[time], o = r[outcome]
    const eOk = e != null && String(e).trim() !== '', tOk = t != null && String(t).trim() !== ''
    const oOk = typeof o === 'number' && Number.isFinite(o)
    const xOk = regressors.some((x) => typeof r[x] === 'number' && Number.isFinite(r[x] as number))
    if (eOk && tOk && oOk && xOk) complete++
  }
  return complete
}
// branch in testEligibility, after 'complete-wide-rows':
if (rule.kind === 'panel') {
  for (const ent of candidates[0]) for (const tm of candidates[1]) for (const out of candidates[2]) {
    if (distinct(working, ent.name) < 2 || distinct(working, tm.name) < 2) continue
    const regs = candidates[3].map((c) => c.name)
    if (panelStructure(working, ent.name, tm.name, out.name, regs) >= rule.n) return { ok: true, reason: null }
  }
  return { ok: false, reason: `needs ≥2 entities, ≥2 periods, and ≥${rule.n} complete observations` }
}
```

- [ ] **Step 4: Run eligibility tests** — `npm run test:fast -- eligibility` → PASS. (No new `slotCompatibility`
  code: the `entity` role is a plain `levels:['nominal','ordinal']` constraint the existing levels check
  already handles.)
- [ ] **Step 5: Add preload packages** — append `plm`, `sandwich`, `ivreg`, `rdrobust`, `MatchIt` to the WebR
  init preload loop (after the sub-slice-1 additions; `lmtest` already present). Match the existing eager
  pattern.
- [ ] **Step 6: Commit**

```bash
git add src/lib/registry/types.ts src/lib/eligibility/eligibility.ts src/lib/eligibility/eligibility.test.ts src/lib/webr/engine.ts
git commit -m "feat(econ): panel backbone — entity role, panel minRule, plm/ivreg/rdrobust/MatchIt preload"
```

---

## Tasks 3–9: the 7 tests (parallel worktrees)

Each worktree touches ONLY its own 3 files + tests. Pattern per task (follow analogs `var.ts` / `buildVar.ts`
/ `stats/var.ts`):
1. **Registry file** — `TestSpec` literal exactly as the spec §2 section dictates (roles/options/tables/
   columns/figures/howToRead/neutralised apaTemplate/rMap/bundleFiles + distinct `domId`s). Header comment
   documents card-deviations (report-only neutralisation + §2.8 additions), `var.ts`-style.
2. **Stats runner** — the R recipe from Task 1 Step 5; return a typed result (add to `stats/types.ts`).
   Include the runtime structural guards from spec §1.4 (graceful `stop()` → per-test error card).
3. **Builder** — map the result into the card's tables/figures/note/APA; thread `{pct}% CI` + `α`; emit the
   `figure_*.png`. Follow `buildVar.ts`.
4. **Tests** — stats test asserts every cell against Task-1 ground truth; builder test asserts table/APA
   strings; a mutation check proves the card-consistency case bites.

### Task 3: Fixed effects (`fixed-effects`)
- Registry: spec §2.1. Roles entity/time/outcome(excl datetime)/regressors(excl datetime). Options `effects`
  (entity/time/two-way), `std errors` (clustered/classical), α, CI. Tables T1 Coefficients (Term·B·Clustered
  SE·t·p·{pct}% CI, `domId:'fe-coefficients'`) + T2 Model fit (Within R²·F·N obs·N entities,
  `domId:'fe-model-fit'`). Figure `figure_coefficients.png`. `tableNote` (plain): poolability F (§2.8) +
  the card's within-variation caveat. APA "In a fixed-effects (within) model, [predictor] gave B=__, p=__
  (clustered SE)." `minRule:{kind:'panel',n:12}`.
- Runner: FE recipe (Task 1 Step 5) + `plm::pFtest`. Guards: ≥2 entities/periods; all-regressors-dropped →
  clear error.
- Assert against `…/fixed-effects.json`.

### Task 4: Random effects (`random-effects`)
- Registry: spec §2.2. Same roles. Options `std errors`, α, CI. T1 Coefficients (`domId:'re-coefficients'`) +
  T2 Model fit (R²·Adj. R²·N obs·N entities, `domId:'re-model-fit'`). Figure `figure_coefficients.png`. APA
  "In a random-effects model, [predictor] gave B=__, p=__." `minRule:{kind:'panel',n:12}`.
- Runner: RE recipe. Assert against `…/random-effects.json`.

### Task 5: Hausman test (`hausman-test`)
- Registry: spec §2.3. Roles entity/time/outcome/regressors. Option α. T1 Hausman (χ²·df·p·Decision,
  `domId:'hausman'`) + T2 FE vs RE (Term·FE B·RE B·Difference, `domId:'hausman-fe-vs-re'`). Figure
  `figure_coefficients.png`. **APA NEUTRALISED:** "A Hausman test comparing the fixed- and random-effects
  estimates gave χ²(__)=__, p=__." Decision column computed from p vs α. `minRule:{kind:'panel',n:12}`.
- Runner: fit FE+RE, `phtest`, align coefs; classical-Hausman fallback if vcov non-PD. Assert against
  `…/hausman.json`.

### Task 6: DiD (`did`)
- Registry: spec §2.4. Roles outcome / treatment(nominal, exactly 2 cats) / period(nominal, exactly 2 cats) /
  entity / time. Options `std errors`, α, CI. Table DiD model (Term·B·Clustered SE·t·p·{pct}% CI; rows
  Treated/Post/Treated×Post; `domId:'did-model'`). Figure `figure_parallel-trends.png`. APA "The DiD estimate
  (Treated×Post) was B=__, {pct}% CI [__, __], p=__ (clustered SE)." Eligibility `minRule:{kind:'values',n:12}`
  on the outcome + the 2×2 runtime guard.
- Runner: `lm(y~treated*post)` + `vcovCL` cluster by entity; parallel-trends plot (group means over time).
  Guard: all 4 cells non-empty. Assert against `…/did.json`.

### Task 7: IV / 2SLS (`iv-2sls`)
- Registry: spec §2.5. Roles outcome / endogenous(1+) / instruments(1+) / controls(0+). Options `std errors`
  (robust/classical), weak-instrument test (display, on), α, CI. T1 First stage (Instrument·Coef.·SE·Partial
  F·p, `domId:'iv-first-stage'`) + T2 2SLS (Term·B·SE·t·p·{pct}% CI, `domId:'iv-2sls'`). `tableNote` (plain):
  weak-IV F + Wu–Hausman + Sargan (when over-identified) — §2.8 surfaced. Figure `figure_coefficients.png`
  (OLS vs 2SLS). **APA softened:** "The 2SLS estimate for [endogenous] was B=__, p=__ (first-stage F=__)."
  Eligibility `minRule:{kind:'values',n:20}` + #instruments≥#endogenous guard.
- Runner: first stage `lm` + `ivreg` diagnostics + robust SE. Assert against `…/iv-2sls.json`.

### Task 8: RDD (`rdd`)
- Registry: spec §2.6. Roles outcome / running variable. Options `cutoff` (number, 50), `bandwidth` (display
  auto), `polynomial order` (1/2), α, CI. Table RD estimate (Bandwidth·Estimate·SE·z·p·{pct}% CI·N(left/right),
  `domId:'rd-estimate'`). Figure `figure_rd-plot.png`. APA "At the cutoff, the RD estimate was __, {pct}% CI
  [__, __], p=__." Eligibility `minRule:{kind:'values',n:20}` + both-sides-of-cutoff guard.
- Runner: `rdrobust(..., c=cutoff, p=order, level=ci)` + `rdplot`. Assert against `…/rdd.json`.

### Task 9: PSM (`propensity-score-matching`)
- Registry: spec §2.7. Roles outcome / treatment(nominal, exactly 2 cats) / covariates(1+). Options `matching
  method` (nearest/optimal/full), `caliper` (number, off), `ratio` (1:1/2:1/3:1), α, CI. T1 Balance
  (Covariate·Std. mean diff (pre)·Std. mean diff (post)·Variance ratio, `domId:'psm-balance'`) + T2 ATT
  (Estimate·SE·t·p·{pct}% CI, `domId:'psm-att'`). Figure `figure_love-plot.png` (hand-rolled ggplot if cobalt
  unavailable — Task 1 decides). **APA NEUTRALISED:** "After propensity-score matching, the ATT was __,
  {pct}% CI [__, __], p=__." Eligibility `minRule:{kind:'rows-per-group',n:10}` (treatment as group) + match
  guard.
- Runner: `matchit` + balance + ATT via weighted `lm`. Assert against `…/propensity-score-matching.json`.

**Each task commits:** `git commit -m "feat(econ): <test> (registry+stats+builder+tests, native-R verified)"`.

---

## Task 10: Integration (serial, on main)

**Files:** `src/lib/registry/catalog.ts`, `src/lib/results/builders.ts`, `src/lib/format/decode.ts`,
`telos_test_outputs.html` (APA neutralisation mirror), the consistency test.

- [ ] **Step 1:** Octopus-merge the 7 worktrees (or land sequentially); delete branches/worktrees.
- [ ] **Step 2:** `catalog.ts` — import the 7 specs; flip leaves 77–83 to `'available'`
  (`e('fixed-effects', …, 'Panel data', 'available')` etc.); add all 7 to `SPECS`.
- [ ] **Step 3:** `builders.ts` — add the 7 `RUNNERS[id]` + `BUILDERS[id]` entries (reuse `alphaOf` / `ciLevel`;
  no `alternativeOf` — no tails here).
- [ ] **Step 4:** `decode.ts` — re-scan the 7 cards for unmapped HTML entities (≥, ≤, Λ, …); add any missing.
- [ ] **Step 5:** Mirror the report-only APA neutralisation into `telos_test_outputs.html` for hausman-test,
  iv-2sls, propensity-score-matching (Hausman verdict → factual; PSM balance claim dropped; IV softened) so
  the card-consistency test passes against the HTML. **No card-structure HTML edits** (the §2.8 additions stay
  registry-only; structural HTML sync deferred to Benjie's review — ratify item).
- [ ] **Step 6:** Run the full suite gate once — `npm test` → all green (expect 7 new registries × consistency
  + per-test stats/builder tests). Fix integration issues.
- [ ] **Step 7: Commit** — `git commit -m "feat(econ): integrate 7 panel+causal tests (catalog/builders/decode/APA mirror)"`.

---

## Task 11: e2e journeys

**Files:** `tests/e2e/econometrics-panel.spec.ts`, `tests/e2e/econometrics-causal.spec.ts`.

- [ ] **Panel journey** on `panel.csv`: set `year` ordinal; configure FE (firm/year/roa/leverage+rd_spend+
  size) → Hausman → DiD (roa/treated/post/firm/year); run; assert tables render, figures present, zip names
  per `NN_<id>/`.
- [ ] **Causal journey** on `causal.csv`: IV (wage/educ/educ_iv/exper+age) → RDD (wage/running_var, cutoff 50)
  → PSM (wage/program/exper+age+ability); run; assert tables/figures + zip.
- [ ] Run `npm run e2e` → green. Commit `test(econ): panel + causal e2e journeys`.

---

## Task 12: Combined slice-end review (one opus pass)

- [ ] Dispatch one review over the whole diff: independent native-R recomputation of every statistic on the
  committed fixtures + UI spot-check (drive each of the 7 on its fixture; confirm neutralised APA, `{pct}% CI`
  threading, figures, error-card guards). Apply confirmed fixes; re-gate.

---

## Task 13: Docs + gates + ratify

- [ ] **Test-config guide** — replace the "Coming with sub-slice 2" stub in `docs/testing/test-config-guide.md`
  with: a Panel-data fixture section, FE/RE/Hausman/DiD sections, a Causal-inference fixture section, IV/RDD/PSM
  sections (Question / Roles / Options / Expect each), verified selectable against `eligibility.ts`.
- [ ] **Regenerate** `docs/TEST_CATALOG.md` — `npx tsx scripts/gen-test-tree.ts` (now 40 live).
- [ ] **Copy** `panel.csv` + the updated `wage1-extended.csv` to `~/Documents/`.
- [ ] **README + ROADMAP** — counts (40 live, file/test totals from `npm test` summary); ROADMAP econ row → Done.
- [ ] **Gates ×2 + fresh clone** — tsc 0 · `npm test` ×2 green · `npm run e2e` green · fresh-clone install/
  tsc/build/test green. Refresh screenshots in `.superpowers/screens/`.
- [ ] **Assemble the ratify list** (spec §6 + sub-slice-1 carryover) and **send a PushNotification**. STOP at
  Benjie's click-through gate. **Never push/deploy.**

---

## Self-review (against the spec)

- **Coverage:** §1 backbone → Task 2; §2.1–2.7 the 7 tests → Tasks 3–9; §2.8 extras → in Tasks 3 (poolability)
  + 7 (IV diagnostics); §3 conventions → applied across registry tasks + Task 10 (APA mirror, decode, domId);
  §4 fixtures/guide/catalog → Tasks 1 + 13; §5 process → task order; §6 ratify → Task 13. ✓
- **Placeholder scan:** numeric test values intentionally reference Task-1 committed ground truth (the
  codebase pattern); recipes are concrete. No "TODO/handle edge cases". ✓
- **Type consistency:** `panel` MinRule defined in Task 2 used in Tasks 3–5; `entity` role levels consistent;
  file/builder names consistent across File-structure + tasks. ✓
- **Open forks (spec §6):** DiD pre-trend test + RDD McCrary/placebo deferred (flagged), not tasks.
