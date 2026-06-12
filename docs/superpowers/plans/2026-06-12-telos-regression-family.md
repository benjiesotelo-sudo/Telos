# Regression & Prediction Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four Regression & prediction tests live in the shell — simple linear, multiple linear, logistic, Poisson / negative binomial. 29/47 live after the slice.

**Architecture:** Approach A per the approved spec (`docs/superpowers/specs/2026-06-12-telos-regression-family-design.md`): a thin serial backbone on main (spec amendments B3 + count-tag constraint B1 + level-select option kind B2 + engine preload B4 + shared fixture), then four parallel per-test worktrees each delivering the established trio (registry + consistency test, stats module + known-answer test, builder + test), then one serial integration task, one e2e journey, one combined slice-end review. **No shared regression chassis** — the four tests' tables genuinely differ (t vs z, β vs OR vs IRR, different fit columns); shared-looking R snippets (the data.frame builder, the residual-panel recipe) are deliberately duplicated per module so worktrees never touch a shared file.

**Tech Stack:** React/TS/Vite shell (built), WebR engine (`src/lib/webr/engine.ts`), vitest + Playwright. Full `npm test` is serialized (`fileParallelism: false`) and slow (**~8 min**) — implementers run ONLY their own test files in FOREGROUND with long timeouts; the full suite gates at integration.

**Process (lighter regimen, ruled 2026-06-12):** card-scoped consistency tests + mutation checks; full gates every commit on main (worktree commits gate on own files + tsc); one combined slice-end review; Benjie's click-through at the end. **NOTHING is pushed or deployed without Benjie's explicit say-so.**

**Spike facts (ground truth: `docs/superpowers/reviews/regression-spike-data/*.csv`, report `docs/superpowers/reviews/2026-06-12-regression-spike-report.md`):**
- WebR 0.6.0 ≡ native R 4.6.0 on **343/343 battery keys** (every table cell of all four tests, both event categories, both count models, ±offset). All numeric literals in the tests below are spike-verified in BOTH engines. **The frozen `regression.csv` is the ground truth, not the seed.**
- **Ladder verdicts (D1–D4, resolved — no design reopening):** SHIP `pROC` (2.54 MiB closure) + `parameters` (4.35 MiB) + `performance` (2.36 MiB). **Do NOT ship `caret`** (loads, but 51-pkg / ≥26.8 MiB closure for an unused dep — classification table is hand-computed per convention 8) and **do NOT ship `broom`** (23.05 MiB / 21 pkgs, nothing computed needs it). Their card R-map lines get one-line truth-fixes in Task 1 (ratify list). `MASS` ships with base R (`glm.nb` works incl. in-formula offset) — load-checked only.
- **β refit semantics:** `parameters::standardise_parameters(m, method='refit')` — numeric terms β = B·SD(x)/SD(y); **dummy terms β = B/SD(y)** (response-only; NOT B·SD(dummy)/SD(y)). Standardized intercept ≈ 0 (≤1e-17) → the β intercept cell renders blank per the ghost row.
- **AUC is event-category-invariant** (0.76 both relevels — the fitted P(event) flips with the event, so the ROC is identical). The e2e event-switch assertion targets **sign-flipped B / inverted OR, NOT a changed AUC**.
- **GVIF:** with any multi-df term `car::vif(m)` returns a matrix `GVIF | Df | GVIF^(1/(2*Df))`; the table reports **(GVIF^(1/(2·Df)))²** for every term (≡ plain GVIF for 1-df terms); every dummy row shows its parent term's value. With exactly 1 predictor `car::vif` errors `"model contains fewer than 2 terms"` → VIF cells render em-dash (the modules guard the call instead of catching).
- **Profile CIs** (`confint` on glm/glm.nb) need `suppressMessages()` ("Waiting for profiling…") to keep engine JSON clean. `performance::check_overdispersion(m)` carries its statistic in **`$dispersion_ratio`** (≡ hand Pearson χ²/df to full precision).
- **Residual-diagnostics figure = ONE file**: single ggplot, `facet_wrap(~panel, scales='free')` over a stacked long frame (fitted-vs-residuals + hand Q–Q `qnorm(ppoints(n))` vs `sort(resid)`), per-panel reference lines via `geom_abline(data=refs)` — no patchwork/gridExtra.
- Dummy coefficient rownames are R-glued (`groupb`, `methodonline`, `methodworkshop`; references `a`, `lecture`, first-alphabetical); the builder rows render `<column>: <level>`.

**Recorded decisions (this plan; flag at slice end for Benjie's ratify list — alongside the spec's 15 conventions and the three Task-1 spec amendments):**
1. **Predictor numeric/categorical classification by storage type**: a predictor column whose non-missing values are all numbers enters the model as a linear term; any other column enters as a factor (dummy-coded, first-alphabetical reference). Matches R's own `read.csv` behavior and the drawn cards' examples (numeric `satisfaction · ordinal` in the simple-linear palette is a linear term).
2. **Logistic min-rule = `used-columns` n 1** (draft approximation): spec convention 14 says "2-category nominal candidate + ≥3 complete pairs", but the existing `complete-pairs` eligibility helper is numeric-only — a string outcome always counts 0 pairs and would grey logistic forever. The role-candidate check already enforces the 2-category nominal candidate; the adequacy gate is the run itself (the spec's own caveat for simple/multiple).
3. **APA "X" substitution:** the card-literal sentences keep their drawn wording (ANOVA precedent — "was significant"/"was associated" regardless of p); the literal `predictor X`/`Predictor X` is replaced with the **first non-intercept coefficient row's** term label, and the value placeholders fill from that row.
4. **`report odds ratios` off masks the APA's OR/CI slots with em-dashes too** (same R1 semantics as the table cells); `standardize` has no APA slot, so it masks table cells only.
5. **Event-category pill placeholder:** while no outcome column is assigned, the pill renders a disabled select showing `—` (no drawn empty state exists; the drawn `passed · second level` is the assigned-state example). The run gate blocks on the empty role regardless.
6. **Poisson outcome machine constraint** = `levels: ['interval','ratio']` + `tag: 'count'` (the drawn `count · non-negative integers · exactly 1` is the display string; `count` is a columnMeta tag, not a measurement level).
7. **Simple-linear figure with a categorical predictor:** scatter without the lm line (`geom_smooth(method='lm')` is undefined on a discrete axis); the spiked numeric path is the journey-covered one.
8. **Intercept ghost cells:** β and VIF render blank `''` on the intercept row (per the drawn ghost rows); R1 toggle/k=1 masks on predictor rows render `—`.
9. **Multiple-linear R map keeps the drawn `ggplot2`/`performance::check_model()` alternative phrasing** (the `/` reads as either-or, mosaic-precedent; `performance` ships, figures are pure ggplot2 per convention 12 — no truth-fix needed).
10. **NB dispersion cell = theta in the same drawn Dispersion column** (the card's own note prescribes exactly this swap; no extra label).
11. **Exposure run gate** (convention 11): every present numeric exposure value must be > 0 (`log(exposure)` must exist); named-gate hint `exposure values must be strictly positive (its log is the offset)`.
12. **The three Task-1 spec amendments** (R2 "changeable" dropped; `caret::confusionMatrix()` → `table(predicted, observed)`; `broom::glance()/tidy()` segment dropped) — all three for Benjie's ratify list.
13. **`d <- data.frame(y = y)` outcome-name pattern** shares the established ancova edge (a predictor literally named `y` would collide) — house precedent, unchanged.
14. **Dispersion source under Poisson = `performance::check_overdispersion(m)$dispersion_ratio`** (card-faithful R map; spike-pinned ≡ the hand Pearson ratio).

**HOUSE RULES (every implementer):**
- Full `npm test` is serialized, **~8 min** — run gates in FOREGROUND with long timeouts (or let the orchestrator run them). The stats test files each boot a real WebR engine (first run downloads ~80 s; a file takes 3–6 min).
- Rendered negative numbers use **U+2212 minus** (the `minus()`/`f()` helpers in `src/lib/format/apa.ts` do this — never hand-format).
- House formatting: statistics 2 dp via `f()`; dfs via `fdf()` (integers bare); p via `fp()` (`<.001` floor, no leading zero); percentages 1 dp; missing/masked cells `—` (U+2014 em-dash).
- Listwise missing-data handling **per test** across DV + predictors (+ exposure), own N reported (Benjie's standing ruling, convention 15).
- ggplot house styling: points `#0c447c`, bands/fills `#9cc2ec`, reference lines dashed `#9cc2ec`, no titles, no `theme_minimal`.
- Spec-HTML entities decode via the established `decode()` list in `src/lib/registry/specHtml.ts` (Task 1 adds `&beta;` — the only new entity these cards need).
- The registry strings in this plan are transcribed in full, but **the spec HTML is the authority** — if a string below disagrees with the card, the card wins (the consistency test will tell you).

---

## Slice base

Before Task 1, record the slice base for the combined review: `git rev-parse HEAD` → note as BASE.

---

### Task 1: Spec-HTML amendments (B3 + R-map truth-fixes) + decode β [serial, main]

**Files:**
- Modify: `telos_test_inputs.html` (multiple-linear cfgguide, ~line 1657)
- Modify: `telos_test_outputs.html` (logistic R map ~line 760, simple-linear R map ~line 717)
- Modify: `src/lib/registry/specHtml.ts` (decode list)

All three card edits are **flagged for Benjie's ratify list** (recorded decision 12). They land BEFORE any consistency test transcribes the cards, so the registries assert against the amended truth (B3).

- [ ] **Step 1: R2 — drop "changeable" from the multiple-linear config guide**

In `telos_test_inputs.html` (Multiple linear regression card, cfgguide paragraph), replace exactly:

```
reference level: first alphabetical, changeable)
```

with

```
reference level: first alphabetical)
```

(The word appears exactly once in the repo's spec HTMLs — verify with `grep -c "changeable" telos_test_inputs.html telos_test_outputs.html` → expect `1` then `0` before the edit, `0` and `0` after.)

- [ ] **Step 2: D4 truth-fix — the logistic R map names what actually runs**

In `telos_test_outputs.html` (Logistic regression card meta block), replace exactly:

```html
<code>caret::confusionMatrix()</code> &rarr; Table 3 (classification)
```

with

```html
<code>table(predicted, observed)</code> &rarr; Table 3 (classification)
```

(Spike D4: caret loads but is NOT shipped — 51-pkg / ≥26.8 MiB closure for a table the module hand-computes as a 2×2 tabulation.)

- [ ] **Step 3: B4 truth-fix — drop the broom segment from the simple-linear R map**

In `telos_test_outputs.html` (Simple linear regression card meta block), replace exactly:

```html
<code>parameters::standardise_parameters()</code> &rarr; &beta; &middot; <code>broom::glance()/tidy()</code> &middot; <code>ggplot2</code> &rarr; figures
```

with

```html
<code>parameters::standardise_parameters()</code> &rarr; &beta; &middot; <code>ggplot2</code> &rarr; figures
```

(Spike: broom loads but costs 23.05 MiB / 21 packages and no computed value needs it — every value comes from `summary()`/`confint()`.)

- [ ] **Step 4: decode() gains β**

In `src/lib/registry/specHtml.ts`, after the Association-family line and before the final `&amp;` rule, add:

```ts
  // Regression-family cards
  .replace(/&beta;/g, 'β')
```

(All other entities the four cards use — `&sup2; &minus; &chi; &mdash; &middot; &rarr; &ldquo; &rdquo; &ndash; &hellip; &gt; &lt;` — are already in the list.)

- [ ] **Step 5: Gates**

Run: `npm run test:fast` → green (no shipped registry reads these cards yet). Run: `npx tsc -b` → 0 errors.

- [ ] **Step 6: Commit**

```bash
git add telos_test_inputs.html telos_test_outputs.html src/lib/registry/specHtml.ts
git commit -m "docs(regression): spec amendments — R2 drops 'changeable'; R-map truth-fixes caret→table(), broom dropped (spike D4/B4); decode gains β"
```

---

### Task 2: B1 count-tag role constraint + exposure-positive run gate [serial, main]

**Files:**
- Modify: `src/lib/registry/types.ts` (RoleConstraint)
- Modify: `src/lib/eligibility/eligibility.ts` (slotCompatibility + testEligibility reason)
- Modify: `src/lib/eligibility/eligibility.test.ts`
- Modify: `src/lib/data/props.ts`, `src/lib/data/props.test.ts` (strictlyPositive)
- Modify: `src/state/session.ts` (gateOk exposure clause)
- Modify: `src/components/screens/TestConfigScreen.tsx` (named-gate hint fallback)

`columnMeta` already tags non-negative-integer columns `count` (`detectTags`) — no detection changes. Novel machinery → spot-validated per the regimen (the Task 11 journey drives the count gate and the exposure slot end-to-end).

- [ ] **Step 1: Write the failing eligibility tests**

Append to `src/lib/eligibility/eligibility.test.ts` (the file's existing `col()` helper builds `tags: []`; extend imports with `RoleConstraint` from `../registry/types` and `CatalogEntry` from `../registry/catalog`):

```ts
describe('count-tag role constraint (B1)', () => {
  const countRole: RoleConstraint = { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, tag: 'count' }
  const countCol: ColumnMeta = { name: 'complaints', detected: 'int64', tags: ['count'], level: 'ratio', used: true }
  const floatCol: ColumnMeta = { name: 'months', detected: 'float64', tags: [], level: 'ratio', used: true }
  it('accepts a count-tagged column', () =>
    expect(slotCompatibility(countRole, countCol, ds).ok).toBe(true))
  it('rejects a non-count ratio column with the readable reason', () =>
    expect(slotCompatibility(countRole, floatCol, ds)).toEqual({ ok: false, reason: 'needs a count column (non-negative whole numbers)' }))
  it('the level check still precedes the tag check', () =>
    expect(slotCompatibility(countRole, { ...floatCol, level: 'nominal' }, ds).reason).toBe('needs an interval / ratio column'))
  it('an untagged role still accepts a count column (palette house rule: counts fit Predictors)', () => {
    const anyRole: RoleConstraint = { roleId: 'predictor', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } }
    expect(slotCompatibility(anyRole, countCol, ds).ok).toBe(true)
  })
  it('testEligibility names the count requirement when no count column exists', () => {
    const spec = { id: 'x', name: 'X', question: '', options: [], tables: [], howToRead: '', apaTemplate: '', rMap: '', bundleFiles: [],
      roles: [{ id: 'outcome', label: 'Outcome (DV)', levels: 'count', arity: 'non-negative integers · exactly 1' }],
      constraints: { roles: [countRole], minRule: { kind: 'complete-pairs', n: 3 } } } as unknown as TestSpec
    const entry = { id: 'x', name: 'X', family: 'F', status: 'available' } as CatalogEntry
    expect(testEligibility(entry, spec, [floatCol], ds).reason).toBe('needs a count column (non-negative whole numbers) for Outcome (DV)')
  })
})
```

Run: `npx vitest run src/lib/eligibility/eligibility.test.ts` → FAIL (tag unknown / reasons differ).

- [ ] **Step 2: Implement**

`src/lib/registry/types.ts` line 6 — `RoleConstraint` gains the tag:

```ts
export interface RoleConstraint { roleId: string; levels: Level[]; arity: { min: number; max: number }; categories?: { exact?: number; min?: number }; tag?: 'count' } // max: Infinity allowed · tag: column must carry this columnMeta tag (B1 — Poisson count outcome)
```

`src/lib/eligibility/eligibility.ts` — in `slotCompatibility`, directly after the levels check (before the `categories` block):

```ts
  if (role.tag && !col.tags.includes(role.tag))
    return { ok: false, reason: 'needs a count column (non-negative whole numbers)' }
```

and in `testEligibility`, the unmeetable-role reason becomes tag-aware (replace the existing `return { ok: false, reason: ... }` inside the candidates loop):

```ts
      return { ok: false, reason: role.tag
        ? `needs a count column (non-negative whole numbers) for ${label}`
        : `needs ${role.levels[0] === 'interval' ? 'an' : 'a'} ${role.levels.join(' / ')} column for ${label}` }
```

Run: `npx vitest run src/lib/eligibility/eligibility.test.ts` → PASS.

- [ ] **Step 3: strictlyPositive helper (TDD)**

Append to `src/lib/data/props.test.ts`:

```ts
describe('strictlyPositive (poisson exposure run gate, design convention 11)', () => {
  const mk = (vals: (number | string | null)[]): Dataset => ({ columns: ['e'], rows: vals.map((v) => ({ e: v })) })
  it('passes when every present value is a positive number (missing rows are listwise territory)', () => {
    expect(strictlyPositive(mk([1, 0.5, null, 12]), 'e')).toBe(true)
  })
  it('fails on zero, negatives, and non-numeric presence', () => {
    expect(strictlyPositive(mk([1, 0]), 'e')).toBe(false)
    expect(strictlyPositive(mk([1, -2]), 'e')).toBe(false)
    expect(strictlyPositive(mk([1, 'soon']), 'e')).toBe(false)
  })
})
```

(Extend the file's imports: `strictlyPositive` from `./props`.) Run → FAIL. Then append to `src/lib/data/props.ts`:

```ts
/** Poisson exposure run gate (design convention 11): every PRESENT value must be a number > 0 — log(exposure) must exist. Missing values are the stats module's listwise territory. */
export const strictlyPositive = (ds: Dataset, col: string): boolean =>
  ds.rows.every((r) => { const v = r[col]; return v === null || v === undefined || String(v).trim() === '' || (typeof v === 'number' && Number.isFinite(v) && v > 0) })
```

Run → PASS.

- [ ] **Step 4: gateOk exposure clause**

`src/state/session.ts` — extend the props import line to also bring `strictlyPositive`, and in `gateOk`'s `test:` branch, after the proportions clause and before `return true`:

```ts
    // Poisson exposure (design convention 11): an assigned exposure column must be strictly positive — log(exposure).
    if (id === 'poisson-negative-binomial') {
      const ex = t.roles['exposure']?.[0]
      if (ex && !strictlyPositive(workingDataset(s), ex)) return false
    }
```

(Spec-dependent gateOk tests land in Task 10 with the registries — the same sequencing the proportions gate used in the Association slice.)

- [ ] **Step 5: named-gate hint fallback**

`src/components/screens/TestConfigScreen.tsx` — in the named-gate IIFE, replace the two-line `return rolesOk ? … : …` with:

```tsx
            if (!rolesOk) return 'fill every required slot here to enable Run · first run loads the R engine'
            if (spec.options.some((o) => o.kind === 'proportions')) return 'custom proportions must sum to 1 to enable Run'
            return 'exposure values must be strictly positive (its log is the offset)'
```

(Behavior-preserving for every shipped test: with roles complete, the only screen-level gate a GoF config can fail is the props sum, and the only one a Poisson config can fail is the exposure sign. Task 3 inserts the level-select line above the proportions one.)

- [ ] **Step 6: Gates**

Run: `npm run test:fast` → green. Run: `npx tsc -b` → 0. Run: `npx playwright test` → existing e2e green (the GoF hint string is unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/lib/registry/types.ts src/lib/eligibility/eligibility.ts src/lib/eligibility/eligibility.test.ts src/lib/data/props.ts src/lib/data/props.test.ts src/state/session.ts src/components/screens/TestConfigScreen.tsx
git commit -m "feat(regression): count-tag role constraint + strictly-positive exposure run gate (B1, convention 11)"
```

---

### Task 3: B2 `level-select` option kind [serial, main]

**Files:**
- Modify: `src/lib/registry/types.ts` (OptionSpec)
- Modify: `src/lib/data/props.ts`, `src/lib/data/props.test.ts` (defaultEventLevel)
- Modify: `src/state/session.ts` (freshSetup, addRole/removeRole sync, gateOk)
- Modify: `src/components/screens/TestConfigScreen.tsx` (rendering + hint line)

Powers logistic's **event category** pill: choices resolved at runtime from the categories of the column assigned to a named role (`fromRole: 'outcome'`), default = **SECOND level alphabetically** (the drawn `passed · second level`; R's glm models the second factor level). Stored in the session as the chosen level string; reset to the default when the outcome column is assigned/reassigned, cleared on unassign. Novel machinery → spot-validated (Task 10 session tests + Task 11 journey drive choices-on-drop, reset-on-reassign, and the chosen level reaching R as a flipped OR).

- [ ] **Step 1: defaultEventLevel helper (TDD)**

Append to `src/lib/data/props.test.ts` (extend the import with `defaultEventLevel`):

```ts
describe('defaultEventLevel (level-select default, B2)', () => {
  it('picks the SECOND level alphabetically (drawn "passed · second level"; glm models the second factor level)', () => {
    expect(defaultEventLevel(['no', 'yes'])).toBe('yes')
  })
  it('degrades to the only level, then to empty', () => {
    expect(defaultEventLevel(['only'])).toBe('only')
    expect(defaultEventLevel([])).toBe('')
  })
})
```

Run → FAIL. Then append to `src/lib/data/props.ts`:

```ts
/** level-select default (B2): the SECOND level alphabetically — matches the drawn 'passed · second level' and R glm's modeled (second) factor level. */
export const defaultEventLevel = (cats: string[]): string => cats[1] ?? cats[0] ?? ''
```

Run → PASS.

- [ ] **Step 2: OptionSpec gains the kind + fromRole**

`src/lib/registry/types.ts` line 4 — the kind union gains `'level-select'` and the interface gains `fromRole?: string` (keep the existing trailing comment, append to it):

```ts
export interface OptionSpec { id: string; label: string; value: string; kind: 'display' | 'toggle' | 'number' | 'select' | 'proportions' | 'level-select'; default?: boolean | number; choices?: string[]; hint?: string; fromRole?: string } // default only for interactive kinds; choices: select kind: choices verbatim from the card; value = the drawn default · hint: the card's set-it warning (design §3 — μ₀) · proportions: select equal/custom + per-category number inputs (GoF, design R1) · level-select: choices = categories of the column assigned to fromRole, default = second level alphabetically (logistic event category, B2)
```

- [ ] **Step 3: Session — freshSetup init, assign/reassign sync, gateOk validity**

`src/state/session.ts`:

1. Extend the props import to `import { categoriesOf, propsArray, propsSumOk, strictlyPositive, defaultEventLevel } from '../lib/data/props'`.

2. `freshSetup` initializes a level-select to the empty placeholder (no column is assigned at selection time):

```ts
const freshSetup = (id: string): TestSetup => ({
  roles: Object.fromEntries((SPECS[id]?.constraints.roles ?? []).map((r) => [r.roleId, []])),
  options: Object.fromEntries((SPECS[id]?.options ?? []).filter((o) => o.kind !== 'display').map((o) => [o.id,
    o.kind === 'level-select' ? '' :
    o.kind === 'select' || o.kind === 'proportions' ? (o.default != null ? String(o.default) : o.value) : o.default!,
  ])),
  props: {},
  blocked: null,
})
```

3. New module-level helper (next to `freshSetup`):

```ts
/** B2: a level-select option follows its fromRole column — reset to the default (second level) on assign/reassign, '' on unassign. Edits to OTHER roles never touch the stored choice. */
const syncLevelSelect = (s: SessionState, testId: string, roleId: string, setup: TestSetup): TestSetup => {
  const opt = SPECS[testId]?.options.find((o) => o.kind === 'level-select' && o.fromRole === roleId)
  if (!opt) return setup
  const col = setup.roles[roleId][0]
  const value = col ? defaultEventLevel(categoriesOf(workingDataset(s), col)) : ''
  return { ...setup, options: { ...setup.options, [opt.id]: value } }
}
```

4. `addRole` and `removeRole` route their new setup through it:

```ts
    addRole: (testId, roleId, column) => edit((s) => {
      const setup = s.setups[testId]; const role = SPECS[testId]?.constraints.roles.find((r) => r.roleId === roleId)
      if (!setup || !role) return {}
      const cur = setup.roles[roleId]
      if (cur.includes(column) || cur.length >= role.arity.max) return {}
      const next = syncLevelSelect(s, testId, roleId, { ...setup, roles: { ...setup.roles, [roleId]: [...cur, column] } })
      return { setups: { ...s.setups, [testId]: next } }
    }),
    removeRole: (testId, roleId, column) => edit((s) => {
      const setup = s.setups[testId]; if (!setup) return {}
      const next = syncLevelSelect(s, testId, roleId, { ...setup, roles: { ...setup.roles, [roleId]: setup.roles[roleId].filter((c) => c !== column) } })
      return { setups: { ...s.setups, [testId]: next } }
    }),
```

5. `gateOk`'s `test:` branch gains the validity clause directly after the proportions clause (before the poisson exposure clause): the stored level must be a live category of the assigned column — this also catches a configure-data edit that changed the column's categories under a kept assignment:

```ts
    const lvlOpt = spec.options.find((o) => o.kind === 'level-select')
    if (lvlOpt) {
      const col = t.roles[lvlOpt.fromRole!]?.[0]
      if (!col || !categoriesOf(workingDataset(s), col).includes(String(t.options[lvlOpt.id]))) return false
    }
```

(No shipped spec carries a level-select option until Task 10 registers logistic — `npm run test:fast` stays green; the spec-dependent session tests land in Task 10, the same sequencing the proportions gate used.)

- [ ] **Step 4: TestConfigScreen rendering + hint line**

`src/components/screens/TestConfigScreen.tsx`:

1. In the options row, add the branch BEFORE the `select`/`proportions` branch:

```tsx
        ) : o.kind === 'level-select' ? (
          (() => {
            const col = setup.roles[o.fromRole!]?.[0]
            const cats = col ? categoriesOf(workingDataset(s), col) : []
            return (
              <label key={o.id} className="pill">
                {o.label}{' '}
                <select aria-label={o.label} value={String(setup.options[o.id] ?? '')} disabled={running || !col}
                  onChange={(e) => s.setOption(testId, o.id, e.target.value)}
                  style={{ border: 0, background: 'transparent', font: 'inherit', color: 'inherit' }}>
                  {cats.length ? cats.map((c) => <option key={c} value={c}>{c}</option>) : <option value="">—</option>}
                </select>
              </label>
            )
          })()
        ) : o.kind === 'select' || o.kind === 'proportions' ? (
```

(Placeholder state per recorded decision 5: disabled select showing `—` while the fromRole slot is empty.)

2. In the named-gate IIFE, insert ABOVE the proportions line:

```tsx
            if (spec.options.some((o) => o.kind === 'level-select')) return 'pick an event category to enable Run'
```

- [ ] **Step 5: Gates**

Run: `npm run test:fast` → green. Run: `npx tsc -b` → 0. Run: `npx playwright test` → existing e2e green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/registry/types.ts src/lib/data/props.ts src/lib/data/props.test.ts src/state/session.ts src/components/screens/TestConfigScreen.tsx
git commit -m "feat(regression): level-select option kind — choices from the assigned outcome column, second-level default, reset on reassign (B2)"
```

---

### Task 4: B4 engine preload — pROC, parameters, performance [serial, main]

**Files:**
- Modify: `src/lib/webr/engine.ts` (install loop + comment)
- Modify: `src/lib/webr/engine.test.ts` (library() load check)

**How preloading actually works in this repo:** the "preload list" is the `installPackages` loop in `Engine.init()` — packages download from the WebR package repository on first run (the browser caches them; Node re-downloads per Engine instance). `scripts/copy-webr.mjs` only copies + decompresses the **base R runtime** VFS into `public/webr/` — R packages are NOT in that directory, so **copy-webr.mjs needs NO change** and nothing new approaches the Cloudflare Pages 25 MiB-per-file limit (the decompressed-VFS rule applies to `public/webr/` only — verified: only the base `etc/usr/var` images live there). Do not hunt for a package list in copy-webr.mjs.

- [ ] **Step 1: Extend the install loop**

`src/lib/webr/engine.ts` — extend the loop array and add the slice comment above it (keep the existing comments):

```ts
    // Regression slice additions spike-verified under WebR 0.6.0 (343/343 ≡ native R 4.6.0): pROC (closure 2.54 MiB),
    // parameters (4.35 MiB — β via refit), performance (2.36 MiB — Nagelkerke R², dispersion ratio). caret and broom
    // deliberately NOT shipped (spike D4/B4: 51-pkg ≥26.8 MiB and 21-pkg 23.05 MiB closures; nothing computed needs them
    // — classification is a hand 2×2 tabulation). MASS ships with base R (glm.nb) — load-checked only.
    for (const pkg of ['ggplot2', 'nortest', 'effectsize', 'psych', 'coin', 'janitor',
      'afex', 'emmeans', 'car', 'rstatix',
      'pROC', 'parameters', 'performance']) {
```

- [ ] **Step 2: library() load-check test**

Append to `src/lib/webr/engine.test.ts` (inside the existing `describe`):

```ts
  it('loads the Regression-slice packages (library(), not just requireNamespace) incl. preinstalled MASS', async () => {
    const ok = await engine.runJson<string[]>(`
      pkgs <- c('pROC','parameters','performance','MASS')
      as.list(pkgs[vapply(pkgs, function(p) tryCatch({ library(p, character.only = TRUE); TRUE }, error = function(e) FALSE), logical(1))])`)
    expect(ok).toEqual(['pROC', 'parameters', 'performance', 'MASS'])
  }, 600_000)
```

- [ ] **Step 3: Gates (FOREGROUND, long timeout)**

Run: `npx vitest run src/lib/webr/engine.test.ts` — this boots a real engine and now downloads 13 packages (~3–7 min; full-suite serialization exists precisely because parallel engine inits contend). → PASS. Run: `npx tsc -b` → 0. Run: `npm run test:fast` → green.

- [ ] **Step 4: Commit**

```bash
git add src/lib/webr/engine.ts src/lib/webr/engine.test.ts
git commit -m "feat(regression): engine preload gains pROC + parameters + performance (spike-shipped ladder, B4); MASS load-checked"
```

---

### Task 5: Shared fixture — the frozen spike CSV [serial, main]

**Files:**
- Create: `tests/e2e/fixtures/regression.csv`
- Create: `src/lib/stats/fixtures/regression.ts`

The four stats test suites and the e2e journey all use the SAME data, so every spike number carries verbatim. **Column names already match the drawn cards — no renames** (`pre_score, age, group, method, post_score, passed, complaints, months_observed`; references `a`/`lecture` first-alphabetical; `passed` levels `no`/`yes`; `complaints` is non-negative integers → `count` tag; `months_observed` strictly positive).

- [ ] **Step 1: Copy the frozen CSV + generate the loader module**

From the repo root:

```bash
cp docs/superpowers/reviews/regression-spike-data/regression.csv tests/e2e/fixtures/regression.csv
node - <<'EOF'
const fs = require('fs')
const lines = fs.readFileSync('tests/e2e/fixtures/regression.csv', 'utf8').trim().split('\n')
const cols = lines[0].split(',').map((c) => c.replace(/"/g, ''))
const objs = lines.slice(1).map((l) => { const cs = l.split(',').map((c) => c.replace(/"/g, '')); return Object.fromEntries(cols.map((c, i) => [c, isNaN(Number(cs[i])) ? cs[i] : Number(cs[i])])) })
fs.writeFileSync('src/lib/stats/fixtures/regression.ts',
`import type { Dataset } from '../types'

// The frozen spike fixture (docs/superpowers/reviews/regression-spike-data/regression.csv) VERBATIM — the CSV is the
// ground truth, not the seed; every number in the spike ground-truth CSVs applies to this data as-is.
// Regenerate via the Task 5 script in plans/2026-06-12-telos-regression-family.md.
export const loadRegressionFixture = (): Dataset => ({
  columns: ${JSON.stringify(cols)},
  rows: [
${objs.map((o) => '    ' + JSON.stringify(o) + ',').join('\n')}
  ],
})
`)
EOF
```

- [ ] **Step 2: Sanity-check**

Run: `head -3 tests/e2e/fixtures/regression.csv` → header + 2 data rows starting `66.2,24,"b","online",57.5,"yes",3,12.5`. Run: `grep -c '},' src/lib/stats/fixtures/regression.ts` → 40. Run: `npx tsc -b` → 0.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/fixtures/regression.csv src/lib/stats/fixtures/regression.ts
git commit -m "test(regression): shared fixture — frozen spike regression.csv committed verbatim (spike numbers carry as-is)"
```

---

## Parallel phase — Tasks 6–9, one worktree per test

Worktree mechanics (per test `<id>` with branch `reg/<id>`):

```bash
git worktree add ../telos-wt-<id> -b reg/<id>
cd ../telos-wt-<id> && npm install   # plain install — NEVER symlink node_modules (ANOVA incident)
```

**Implementer rules (put in every dispatch):** touch ONLY the six files your task names (+ nothing shared). Run ONLY your own test files — the stats test boots a real WebR engine (first run downloads ~80 s; the whole file takes 3–6 min): run it in FOREGROUND with a long timeout. Do not run the full suite (engine suites contend; full `npm test` is serialized ~8 min and belongs to integration). Gates per worktree: your test files green + `npx tsc -b` 0 errors. Commit with the exact message given. Do NOT register in catalog/RUNNERS/BUILDERS — the serial integration task does that. The registry strings are transcribed in full below, but the spec HTML is the authority — if a string below disagrees with the card, the card wins (the consistency test will tell you).

**Mutation check (every task, after the consistency test passes):** corrupt one registry display string (the first table title's case, e.g. `'Model fit'` → `'Model Fit'`), re-run the consistency test, expect RED; restore the exact original (revert the edit — `git checkout -- <file>` only if uncommitted), re-run, expect GREEN. Report both runs in your summary — the check must PROVE it bites.

---

### Task 6: Simple linear regression [worktree reg/simple-linear-regression]

**Files:**
- Create: `src/lib/registry/simpleLinearRegression.ts`, `src/lib/registry/simpleLinearRegression.consistency.test.ts`
- Create: `src/lib/stats/simpleLinearRegression.ts`, `src/lib/stats/simpleLinearRegression.test.ts`
- Create: `src/lib/results/buildSimpleLinearRegression.ts`, `src/lib/results/buildSimpleLinearRegression.test.ts`

Self-contained context: outcome = one interval/ratio column; predictor = exactly one column of ANY level. A predictor whose non-missing values are all numbers enters `lm()` as a linear term; any other column enters as a factor (first-alphabetical reference; recorded decision 1). Listwise per test: outcome numeric-finite + predictor complete (numeric-finite or non-blank), own N (convention 15). β always computed (the card draws no standardize pill). One drawn figbox exports TWO files (`figure_fit.png` + `figure_residuals.png`) — two FigureSpecs sharing caption+type with `file` slugs, the distribution-normality precedent. The card's R map was amended in Task 1 (broom dropped) — transcribe the AMENDED truth. Spike ground truth: `docs/superpowers/reviews/regression-spike-data/simple-linear.csv`.

- [ ] **Step 1: Registry**

`src/lib/registry/simpleLinearRegression.ts`:

```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Simple linear regression cards) — display strings
// verbatim, AFTER the Task-1 B4 truth-fix (broom segment dropped from the R map; spike: nothing computed needs broom).
export const SIMPLE_LINEAR_REGRESSION: TestSpec = {
  id: 'simple-linear-regression',
  name: 'Simple linear regression',
  question: 'one numeric outcome, one predictor',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1',
      hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'predictor', label: 'Predictor', levels: 'any level', arity: 'exactly 1',
      hint: 'e.g. one explanatory variable — hours studied' },
  ],
  options: [
    // House convention: α / CI pills are display-only (ratified Association decision 1).
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'ci', label: 'CI', value: '95%', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'predictor', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
    ],
    minRule: { kind: 'complete-pairs', n: 3 }, // design convention 14 — the real adequacy gate is the run itself
  },
  tables: [
    { id: 'model-fit', title: 'Model fit', domId: 'simple-linear-model-fit', // all four regression cards draw 'model-fit' (zip keeps it; DOM must not collide)
      columns: [{ key: 'r2', label: 'R²' }, { key: 'adjR2', label: 'Adj. R²' }, { key: 'f', label: 'F' },
        { key: 'df1', label: 'df1' }, { key: 'df2', label: 'df2' }, { key: 'p', label: 'p' }, { key: 'se', label: 'SE' }] },
    { id: 'coefficients', title: 'Coefficients', domId: 'simple-linear-coefficients',
      columns: [{ key: 'term', label: 'Term' }, { key: 'b', label: 'B' }, { key: 'se', label: 'SE' }, { key: 'beta', label: 'β' },
        { key: 't', label: 't' }, { key: 'p', label: 'p' }, { key: 'ci', label: '95% CI' }] },
  ],
  tableNote: { kind: 'assume', text: 'assumption checks: linearity, normality of residuals, homoscedasticity.' },
  figures: [ // one drawn figbox, two exported files (bundle line) → two specs sharing caption + type (distribution-normality precedent)
    { caption: 'Fit & residuals', type: 'fitted-line scatter + residual diagnostic plots', file: 'fit' },
    { caption: 'Fit & residuals', type: 'fitted-line scatter + residual diagnostic plots', file: 'residuals' },
  ],
  howToRead:
    "R² is the share of outcome variance explained. The predictor's B is the slope (change in outcome per unit), " +
    'with p testing whether it differs from zero and the CI showing precision. β is the standardized slope ' +
    '(change in outcome in SDs per 1 SD change in the predictor), useful for comparing effect sizes on a common scale.',
  apaTemplate: 'The predictor significantly predicted the outcome, B={b}, t({df})={t}, p={p}, R²={r2}.',
  rMap: 'lm() → Tables 1–2 · parameters::standardise_parameters() → β · ggplot2 → figures',
  bundleFiles: ['table_model-fit.png', 'table_coefficients.png', 'figure_fit.png', 'figure_residuals.png'],
}
```

- [ ] **Step 2: Consistency test**

`src/lib/registry/simpleLinearRegression.consistency.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SIMPLE_LINEAR_REGRESSION as spec } from './simpleLinearRegression'
import { figuresOf } from './types'
import { strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Simple linear regression</span>'), outputsHtml.indexOf('Multiple linear regression</span>'))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
// NOTE: the inputs file draws Multiple linear FIRST — the card after Simple linear there is Logistic regression.
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Simple linear regression</div>'), inputsHtml.indexOf('<div class="ttl">Logistic regression</div>'))

describe('simple-linear-regression registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences (decoded — R², β)', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => c.label)))
  })
  it('numbered table captions equal the card captions', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('the ghost intercept row pins convention 1: the β cell is EMPTY (not em-dash) on the intercept', () => {
    expect(card.includes('<tr><td>(Intercept)</td><td>&mdash;</td><td>&mdash;</td><td></td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr>')).toBe(true)
  })
  it('question, assume table note, how-to-read and R map match verbatim (amended R map: no broom)', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(spec.tableNote).toEqual({ kind: 'assume', text: strip(card.match(/<p class="tbl-note assume">(.*?)<\/p>/s)![1]) })
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
    expect(spec.rMap.includes('broom')).toBe(false) // the Task-1 truth-fix holds
  })
  it('one drawn figbox ↔ two FigureSpecs sharing caption + type, file slugs fit/residuals', () => {
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figures![0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${spec.figures![0].type}`)
    expect(figuresOf(spec).map((g) => ({ caption: g.caption, type: g.type, file: g.file }))).toEqual([
      { caption: 'Fit & residuals', type: 'fitted-line scatter + residual diagnostic plots', file: 'fit' },
      { caption: 'Fit & residuals', type: 'fitted-line scatter + residual diagnostic plots', file: 'residuals' },
    ])
  })
  it('APA line equals the template with every {placeholder} as __', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__')}”`)
  })
  it('bundle line EQUALS bundleFiles, names derive from table ids + figure file slugs', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...figuresOf(spec).map((g) => `figure_${g.file ?? g.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + hints + constraint lines', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const hints = [...inCard.matchAll(/<div class="sl-hint">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(hints).toEqual(spec.roles.map((r) => r.hint))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
  })
  it('options equal the inputs card option strip; both display-only', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.every((o) => o.kind === 'display')).toBe(true)
  })
})
```

Run: `npx vitest run src/lib/registry/simpleLinearRegression.consistency.test.ts` → PASS. Then the mutation check (`'Model fit'` → `'Model Fit'`) → RED → restore → GREEN. Report both runs.

- [ ] **Step 3: Stats module**

`src/lib/stats/simpleLinearRegression.ts`:

```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface SimpleLinearTerm { term: string; b: number; se: number; beta: number | null; t: number; p: number; ciLow: number; ciHigh: number }
export interface SimpleLinearResult {
  outcome: string; predictor: string
  r2: number; adjR2: number; f: number; df1: number; df2: number; p: number; sigma: number // sigma = summary(m)$sigma — the Table 1 SE (convention 3)
  terms: SimpleLinearTerm[]
  n: number; nExcluded: number
  figFitPng: Uint8Array<ArrayBuffer>
  figResidualsPng: Uint8Array<ArrayBuffer>
}

// β via parameters::standardise_parameters (refit — the card's R map). Spike-pinned identities: numeric β = B·SD(x)/SD(y);
// dummy β = B/SD(y); standardized intercept ≈ 0 → NA_real_ → JSON null → blank cell per the ghost row.
// Dummy term names arrive R-glued (e.g. 'groupb') → rendered '<column>: <level>' (convention 1).
// lm confint is t-based — no profiling messages to suppress here.
const R_STATS = String.raw`
d <- data.frame(y = y)
d[[xname]] <- if (x_is_factor) factor(x) else x
m <- lm(as.formula(paste('y ~', xname)), data = d)
s <- summary(m)
cf <- s$coefficients; ci <- confint(m)
sp <- parameters::standardise_parameters(m, method = 'refit')
betas <- setNames(sp$Std_Coefficient, sp$Parameter)
labs <- rownames(cf)
pretty <- vapply(labs, function(t) {
  if (t != '(Intercept)' && x_is_factor && startsWith(t, xname)) paste0(xname, ': ', substring(t, nchar(xname) + 1)) else t
}, character(1))
terms <- lapply(seq_along(labs), function(i) list(
  term = pretty[i], b = cf[i, 1], se = cf[i, 2],
  beta = if (labs[i] == '(Intercept)') NA_real_ else unname(betas[labs[i]]),
  t = cf[i, 3], p = cf[i, 4], ciLow = ci[i, 1], ciHigh = ci[i, 2]))
fst <- s$fstatistic
list(r2 = s$r.squared, adjR2 = s$adj.r.squared, f = unname(fst[1]), df1 = unname(fst[2]), df2 = unname(fst[3]),
     p = pf(fst[1], fst[2], fst[3], lower.tail = FALSE), sigma = s$sigma, terms = terms, n = nrow(d))`

// Card figure 1: fitted-line scatter (house styling). Categorical predictor → points only (recorded decision 7:
// geom_smooth(method='lm') is undefined on a discrete axis).
const R_FIT = String.raw`
p <- if (x_is_factor) {
  ggplot2::ggplot(data.frame(x = factor(x), y = y), ggplot2::aes(x, y)) +
    ggplot2::geom_point(colour = '#0c447c') +
    ggplot2::labs(x = xlab, y = ylab)
} else {
  ggplot2::ggplot(data.frame(x = x, y = y), ggplot2::aes(x, y)) +
    ggplot2::geom_point(colour = '#0c447c') +
    ggplot2::geom_smooth(method = 'lm', formula = y ~ x, se = TRUE, colour = '#0c447c', fill = '#9cc2ec') +
    ggplot2::labs(x = xlab, y = ylab)
}
print(p)`

// Card figure 2: residual diagnostics — ONE file, one ggplot, facet_wrap over a stacked long frame (spike-pinned
// composition): fitted-vs-residuals + Normal Q-Q (hand quantiles), per-panel reference lines via geom_abline(data=refs)
// (y = 0 line; quartile qqline slope = IQR(resid)/IQR(z)). No patchwork, no gridExtra.
const R_RESID = String.raw`
d <- data.frame(y = y)
d[[xname]] <- if (x_is_factor) factor(x) else x
m <- lm(as.formula(paste('y ~', xname)), data = d)
r <- residuals(m); fv <- fitted(m); nn <- length(r)
panels <- rbind(
  data.frame(panel = 'Residuals vs fitted', x = fv, y = r),
  data.frame(panel = 'Normal Q-Q', x = qnorm(ppoints(nn)), y = sort(r)))
panels$panel <- factor(panels$panel, levels = c('Residuals vs fitted', 'Normal Q-Q'))
qs <- quantile(r, c(0.25, 0.75)); zs <- qnorm(c(0.25, 0.75))
slope <- diff(qs) / diff(zs); intercept <- qs[1] - slope * zs[1]
refs <- data.frame(panel = factor(c('Residuals vs fitted', 'Normal Q-Q'), levels = levels(panels$panel)),
                   slope = c(0, slope), intercept = c(0, intercept))
print(ggplot2::ggplot(panels, ggplot2::aes(x, y)) +
  ggplot2::geom_abline(data = refs, ggplot2::aes(slope = slope, intercept = intercept), colour = '#9cc2ec', linetype = 'dashed') +
  ggplot2::geom_point(colour = '#0c447c') +
  ggplot2::facet_wrap(~panel, scales = 'free') +
  ggplot2::labs(x = NULL, y = NULL))`

interface RawStats { r2: number; adjR2: number; f: number; df1: number; df2: number; p: number; sigma: number; terms: SimpleLinearTerm[]; n: number }

/** Storage-type classification (recorded decision 1): all-numeric non-missing values → linear term; else factor. */
const isNumericColumn = (data: Dataset, col: string): boolean => {
  const vals = data.rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
  return vals.length > 0 && vals.every((v) => typeof v === 'number')
}

export async function runSimpleLinearRegression(engine: Engine, data: Dataset, outcome: string, predictor: string): Promise<SimpleLinearResult> {
  const xNumeric = isNumericColumn(data, predictor)
  // Per-test listwise (convention 15): outcome numeric-finite; predictor numeric-finite (numeric) or non-blank (categorical).
  const rows = data.rows.filter((r) =>
    typeof r[outcome] === 'number' && Number.isFinite(r[outcome] as number)
    && (xNumeric
      ? typeof r[predictor] === 'number' && Number.isFinite(r[predictor] as number)
      : r[predictor] !== null && r[predictor] !== undefined && String(r[predictor]).trim() !== ''))
  const nExcluded = data.rows.length - rows.length
  const env = {
    y: rows.map((r) => r[outcome] as number),
    x: xNumeric ? rows.map((r) => r[predictor] as number) : rows.map((r) => String(r[predictor])),
    xname: predictor, x_is_factor: !xNumeric, xlab: predictor, ylab: outcome,
  }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figFitPng = await engine.capturePlot(R_FIT, 600, 450, env)
  const figResidualsPng = await engine.capturePlot(R_RESID, 800, 420, env)
  return { outcome, predictor, ...s, nExcluded, figFitPng, figResidualsPng }
}
```

- [ ] **Step 4: Stats known-answer test**

`src/lib/stats/simpleLinearRegression.test.ts` (spike values from `regression-spike-data/simple-linear.csv`, embedded verbatim):

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runSimpleLinearRegression } from './simpleLinearRegression'
import { loadRegressionFixture } from './fixtures/regression'
import type { Dataset } from './types'

describe('runSimpleLinearRegression', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike known answers — post_score ~ pre_score (fit, coefficients, t-CIs, β refit, sigma)', async () => {
    const r = await runSimpleLinearRegression(engine, loadRegressionFixture(), 'post_score', 'pre_score')
    expect(r.r2).toBeCloseTo(0.659416639, 6)
    expect(r.adjR2).toBeCloseTo(0.650453919, 6)
    expect(r.f).toBeCloseTo(73.573272020, 5)
    expect(r.df1).toBe(1)
    expect(r.df2).toBe(38)
    expect(r.p).toBeCloseTo(2.024931906e-10, 9)
    expect(r.sigma).toBeCloseTo(5.605309647, 6)
    expect(r.terms.map((t) => t.term)).toEqual(['(Intercept)', 'pre_score'])
    const [int, pre] = r.terms
    expect(int.b).toBeCloseTo(20.070279220, 5)
    expect(int.se).toBeCloseTo(4.539674859, 6)
    expect(int.beta).toBeNull() // standardized intercept ≈ 0 (≤1e-17 in the spike) → NA_real_ → null → blank cell
    expect(int.t).toBeCloseTo(4.421082972, 6)
    expect(int.p).toBeCloseTo(7.946544031e-5, 9)
    expect(int.ciLow).toBeCloseTo(10.880187930, 5)
    expect(int.ciHigh).toBeCloseTo(29.260370510, 5)
    expect(pre.b).toBeCloseTo(0.641817080, 6)
    expect(pre.se).toBeCloseTo(0.074825777, 6)
    expect(pre.beta).toBeCloseTo(0.812044727, 6) // refit β ≡ hand B·SD(x)/SD(y)
    expect(pre.t).toBeCloseTo(8.577486346, 6)
    expect(pre.p).toBeCloseTo(2.024931906e-10, 9)
    expect(pre.ciLow).toBeCloseTo(0.490340214, 6)
    expect(pre.ciHigh).toBeCloseTo(0.793293946, 6)
    expect(r.n).toBe(40)
    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figFitPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(Array.from(r.figResidualsPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('categorical predictor — factor path, "<column>: <level>" naming, points-only figure (structure, not spike-pinned)', async () => {
    const r = await runSimpleLinearRegression(engine, loadRegressionFixture(), 'post_score', 'group')
    expect(r.terms.map((t) => t.term)).toEqual(['(Intercept)', 'group: b']) // reference 'a' first-alphabetical
    expect(r.terms[1].beta).not.toBeNull()
    expect(r.n).toBe(40)
    expect(Array.from(r.figFitPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 300_000)

  it('listwise: drops rows missing either column, own N (convention 15)', async () => {
    const ds: Dataset = { columns: ['a', 'b'], rows: [
      { a: 1, b: 2 }, { a: 2, b: 4 }, { a: 3, b: 5 }, { a: 4, b: 9 },
      { a: null, b: 1 }, { a: 5, b: null },
    ] }
    const r = await runSimpleLinearRegression(engine, ds, 'b', 'a')
    expect(r.n).toBe(4)
    expect(r.nExcluded).toBe(2)
  }, 300_000)
})
```

Run: `npx vitest run src/lib/stats/simpleLinearRegression.test.ts` (FOREGROUND, long timeout — boots an engine, 3–6 min) → PASS.

- [ ] **Step 5: Builder + test**

`src/lib/results/buildSimpleLinearRegression.ts`:

```ts
import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { SimpleLinearResult } from '../stats/simpleLinearRegression'
import type { CardContent } from './builders'
import { f, fdf, fp } from '../format/apa'

export function buildSimpleLinearRegression(spec: TestSpec, r: SimpleLinearResult): CardContent {
  // Convention 1 / recorded decision 8: intercept β renders blank '' (ghost row); no toggles on this card — β always fills.
  const coefRows = r.terms.map((x) => ({
    term: x.term, b: f(x.b), se: f(x.se),
    beta: x.beta == null ? '' : f(x.beta),
    t: f(x.t), p: fp(x.p), ci: `[${f(x.ciLow)}, ${f(x.ciHigh)}]`,
  }))
  const pred = r.terms.find((x) => x.term !== '(Intercept)')! // APA fills from the predictor row (recorded decision 3)
  const apa = spec.apaTemplate
    .replace('{b}', f(pred.b)).replace('{df}', fdf(r.df2)).replace('{t}', f(pred.t))
    .replace('p={p}', pred.p < 0.001 ? 'p<.001' : `p=${fp(pred.p)}`)
    .replace('{r2}', f(r.r2))
  const figs = figuresOf(spec)
  return {
    tables: [
      { spec: spec.tables[0], rows: [{ r2: f(r.r2), adjR2: f(r.adjR2), f: f(r.f), df1: fdf(r.df1), df2: fdf(r.df2), p: fp(r.p), se: f(r.sigma) }] },
      { spec: spec.tables[1], rows: coefRows },
    ],
    note: spec.tableNote ?? null,
    figures: [
      { caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: r.figFitPng },
      { caption: figs[1].caption, type: figs[1].type, file: figs[1].file, png: r.figResidualsPng },
    ],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
```

`src/lib/results/buildSimpleLinearRegression.test.ts` (spike values in, rendered 2dp out):

```ts
import { describe, it, expect } from 'vitest'
import { buildSimpleLinearRegression } from './buildSimpleLinearRegression'
import { SIMPLE_LINEAR_REGRESSION } from '../registry/simpleLinearRegression'
import type { SimpleLinearResult } from '../stats/simpleLinearRegression'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
// The spike's pinned numbers (simple-linear.csv) — assertions below are their house-rendered 2dp forms.
const res: SimpleLinearResult = { outcome: 'post_score', predictor: 'pre_score',
  r2: 0.659416639, adjR2: 0.650453919, f: 73.573272020, df1: 1, df2: 38, p: 2.024931906e-10, sigma: 5.605309647,
  terms: [
    { term: '(Intercept)', b: 20.070279220, se: 4.539674859, beta: null, t: 4.421082972, p: 7.946544031e-5, ciLow: 10.880187930, ciHigh: 29.260370510 },
    { term: 'pre_score', b: 0.641817080, se: 0.074825777, beta: 0.812044727, t: 8.577486346, p: 2.024931906e-10, ciLow: 0.490340214, ciHigh: 0.793293946 },
  ],
  n: 40, nExcluded: 0, figFitPng: png, figResidualsPng: png }

describe('buildSimpleLinearRegression', () => {
  it('Table 1 = fit row (SE = sigma, convention 3); Table 2 = coefficient rows with blank intercept β', () => {
    const c = buildSimpleLinearRegression(SIMPLE_LINEAR_REGRESSION, res)
    expect(c.tables[0].rows).toEqual([{ r2: '0.66', adjR2: '0.65', f: '73.57', df1: '1', df2: '38', p: '<.001', se: '5.61' }])
    expect(c.tables[1].rows).toEqual([
      { term: '(Intercept)', b: '20.07', se: '4.54', beta: '', t: '4.42', p: '<.001', ci: '[10.88, 29.26]' },
      { term: 'pre_score', b: '0.64', se: '0.07', beta: '0.81', t: '8.58', p: '<.001', ci: '[0.49, 0.79]' },
    ])
    expect(c.note).toEqual(SIMPLE_LINEAR_REGRESSION.tableNote)
  })
  it('two figures carry the fit/residuals file slugs in card order', () => {
    const c = buildSimpleLinearRegression(SIMPLE_LINEAR_REGRESSION, res)
    expect(c.figures.map((g) => g.file)).toEqual(['fit', 'residuals'])
  })
  it('APA fills from the predictor row; tiny p becomes p<.001', () => {
    expect(buildSimpleLinearRegression(SIMPLE_LINEAR_REGRESSION, res).apa)
      .toBe('The predictor significantly predicted the outcome, B=0.64, t(38)=8.58, p<.001, R²=0.66.')
  })
})
```

Run: `npx vitest run src/lib/results/buildSimpleLinearRegression.test.ts` → PASS.

- [ ] **Step 6: Gates + commit**

Run: `npx tsc -b` → 0; all three own test files green.

```bash
git add src/lib/registry/simpleLinearRegression.ts src/lib/registry/simpleLinearRegression.consistency.test.ts src/lib/stats/simpleLinearRegression.ts src/lib/stats/simpleLinearRegression.test.ts src/lib/results/buildSimpleLinearRegression.ts src/lib/results/buildSimpleLinearRegression.test.ts
git commit -m "feat(regression): simple-linear-regression — registry+consistency, stats (lm + refit β, spike-verified), builder"
```

---

### Task 7: Multiple linear regression [worktree reg/multiple-linear-regression]

**Files:**
- Create: `src/lib/registry/multipleLinearRegression.ts`, `src/lib/registry/multipleLinearRegression.consistency.test.ts`
- Create: `src/lib/stats/multipleLinearRegression.ts`, `src/lib/stats/multipleLinearRegression.test.ts`
- Create: `src/lib/results/buildMultipleLinearRegression.ts`, `src/lib/results/buildMultipleLinearRegression.test.ts`

Self-contained context: outcome = one interval/ratio column; predictors = 1+ columns of ANY level. A predictor whose non-missing values are all numbers enters `lm()` as a linear term; any other column enters as a factor (first-alphabetical reference; recorded decision 1). Listwise per test across outcome + ALL predictors, own N (convention 15). β is ALWAYS computed (one R path, spike numbers always verified); the `standardize` toggle (drawn OFF) only masks the β cells in the builder — off → `—`, on → filled (Benjie's R1 ruling). VIF convention (spike-pinned): `car::vif` is per-TERM; report **(GVIF^(1/(2·Df)))²** for every term (≡ plain GVIF for 1-df terms); every dummy row of one factor shows its parent term's value; with exactly 1 predictor `car::vif` errors `"model contains fewer than 2 terms"` → guard the call, VIF cells render `—`. Intercept β/VIF cells render blank `''` per the ghost row (recorded decision 8). ONE figure (residual diagnostics; the card's "(and optional coefficient plot)" is marked optional → skipped this slice). The inputs cfgguide was amended in Task 1 (R2: "changeable" dropped). Spike ground truth: `regression-spike-data/multiple-linear.csv`.

- [ ] **Step 1: Registry**

`src/lib/registry/multipleLinearRegression.ts`:

```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Multiple linear regression cards) — display strings
// verbatim, AFTER the Task-1 R2 amendment ('changeable' dropped from the config guide). The R map keeps the drawn
// ggplot2/performance::check_model() either-or phrasing (recorded decision 9 — figures are pure ggplot2, performance ships).
export const MULTIPLE_LINEAR_REGRESSION: TestSpec = {
  id: 'multiple-linear-regression',
  name: 'Multiple linear regression',
  question: 'one numeric outcome, several predictors',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1',
      hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'predictors', label: 'Predictors', levels: 'any level', arity: 'one or more',
      hint: 'e.g. explanatory variables — age, gender, hours studied' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'ci', label: 'CI', value: '95%', kind: 'display' },
    // Drawn OFF. R1 ruling: off → em-dash β cells, on → filled; the column set is card-fixed either way.
    { id: 'standardize', label: 'standardize', value: 'off', kind: 'toggle', default: false,
      hint: 'Turn standardize on if you want comparable (beta) coefficients.' },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'predictors', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 1, max: Infinity } },
    ],
    minRule: { kind: 'complete-pairs', n: 3 }, // design convention 14 — the real adequacy gate is the run itself
  },
  tables: [
    { id: 'model-fit', title: 'Model fit', domId: 'multiple-linear-model-fit',
      columns: [{ key: 'r2', label: 'R²' }, { key: 'adjR2', label: 'Adj. R²' }, { key: 'f', label: 'F' },
        { key: 'df1', label: 'df1' }, { key: 'df2', label: 'df2' }, { key: 'p', label: 'p' }] },
    { id: 'coefficients', title: 'Coefficients', domId: 'multiple-linear-coefficients',
      columns: [{ key: 'term', label: 'Term' }, { key: 'b', label: 'B' }, { key: 'se', label: 'SE' }, { key: 'beta', label: 'β' },
        { key: 't', label: 't' }, { key: 'p', label: 'p' }, { key: 'ci', label: '95% CI' }, { key: 'vif', label: 'VIF' }] },
  ],
  tableNote: { kind: 'assume', text: 'assumption checks: linearity, normality, homoscedasticity, and multicollinearity (VIF).' },
  figures: [{ caption: 'Residual diagnostics', type: 'residual / diagnostic plots (and optional coefficient plot)', file: 'residuals' }],
  howToRead:
    "Each predictor's B is its effect holding the others constant; p and CI assess it. R² is the joint variance " +
    'explained; VIF flags predictors that overlap too much (multicollinearity). B is in each predictor\'s own units, ' +
    'so to compare which predictors matter most use the standardized coefficient (β), not B.',
  apaTemplate: 'The model explained R²={r2} of the variance, F({df1},{df2})={f}, p={p}; predictor X was significant, B={b}, p={p2}.',
  rMap: 'lm() → Tables 1–2 · parameters::standardise_parameters() → β · car::vif() → VIF · ggplot2/performance::check_model() → figures',
  bundleFiles: ['table_model-fit.png', 'table_coefficients.png', 'figure_residuals.png'],
}
```

- [ ] **Step 2: Consistency test**

`src/lib/registry/multipleLinearRegression.consistency.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { MULTIPLE_LINEAR_REGRESSION as spec } from './multipleLinearRegression'
import { figuresOf } from './types'
import { strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Multiple linear regression</span>'), outputsHtml.indexOf('Logistic regression</span>'))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
// NOTE: the inputs file draws Multiple linear FIRST in family 4 — the next inputs card is Simple linear regression.
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Multiple linear regression</div>'), inputsHtml.indexOf('<div class="ttl">Simple linear regression</div>'))

describe('multiple-linear-regression registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences (decoded — R², β)', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => c.label)))
  })
  it('numbered table captions equal the card captions', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('the ghost intercept row pins convention 1 + decision 8: β AND VIF cells EMPTY on the intercept', () => {
    expect(card.includes('<tr><td>(Intercept)</td><td>&mdash;</td><td>&mdash;</td><td></td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td></td></tr>')).toBe(true)
  })
  it('question, assume table note, figure caption + type, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(spec.tableNote).toEqual({ kind: 'assume', text: strip(card.match(/<p class="tbl-note assume">(.*?)<\/p>/s)![1]) })
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figures![0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${spec.figures![0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('APA line equals the template with every {placeholder} as __ (predictor X stays literal on the card)', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__')}”`)
  })
  it('bundle line EQUALS bundleFiles, names derive from table ids + figure file slug', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...figuresOf(spec).map((g) => `figure_${g.file ?? g.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + hints + constraint lines', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const hints = [...inCard.matchAll(/<div class="sl-hint">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(hints).toEqual(spec.roles.map((r) => r.hint))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
  })
  it('options equal the inputs card option strip; standardize is a default-OFF toggle (R1)', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['display', 'display', 'toggle'])
    expect(spec.options[2]).toMatchObject({ id: 'standardize', default: false })
  })
  it('the standardize hint is the drawn config-guide sentence; the R2 amendment holds (no "changeable")', () => {
    const guide = strip(inCard.match(/<div class="cfgguide">(.*?)<\/p>/s)![1])
    expect(guide).toContain(spec.options[2].hint!)
    expect(guide.includes('changeable')).toBe(false)
  })
})
```

Run: `npx vitest run src/lib/registry/multipleLinearRegression.consistency.test.ts` → PASS. Then the mutation check (`'Model fit'` → `'Model Fit'`) → RED → restore → GREEN. Report both runs.

- [ ] **Step 3: Stats module**

`src/lib/stats/multipleLinearRegression.ts`:

```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface MultipleLinearTerm { term: string; b: number; se: number; beta: number | null; t: number; p: number; ciLow: number; ciHigh: number; vif: number | null }
export interface MultipleLinearResult {
  outcome: string
  standardize: boolean // R1 display toggle — β is always computed; the builder masks
  r2: number; adjR2: number; f: number; df1: number; df2: number; p: number
  terms: MultipleLinearTerm[]
  n: number; nExcluded: number
  figResidualsPng: Uint8Array<ArrayBuffer>
}

// Data frame assembled with REAL column names (ancova flat-pack precedent) so coefficient rownames carry them.
// β via parameters::standardise_parameters(refit): numeric β = B·SD(x)/SD(y); dummy β = B/SD(y) (spike-pinned);
// intercept β ≈ 0 → NA_real_ → null → blank cell. VIF: car::vif is per-TERM; report (GVIF^(1/(2*Df)))^2 for every
// term (matrix column 3 squared; ≡ plain GVIF when all Df==1, where vif() returns a vector); every dummy row shows
// its parent term's value. k = 1 predictor: car::vif errors 'model contains fewer than 2 terms' (spike-pinned
// verbatim, both engines) → the call is guarded and VIF arrives NA_real_ → null → em-dash cells.
const R_STATS = String.raw`
d <- data.frame(y = y)
for (i in seq_along(numnames)) d[[numnames[i]]] <- nums_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(catnames)) d[[catnames[i]]] <- factor(cats_flat[((i - 1) * n + 1):(i * n)])
m <- lm(as.formula(paste('y ~', paste(prednames, collapse = ' + '))), data = d)
s <- summary(m)
cf <- s$coefficients; ci <- confint(m)
sp <- parameters::standardise_parameters(m, method = 'refit')
betas <- setNames(sp$Std_Coefficient, sp$Parameter)
vift <- if (length(prednames) >= 2) { v <- car::vif(m); if (is.matrix(v)) v[, 3]^2 else v } else NULL
labs <- rownames(cf)
parent <- vapply(labs, function(t) {
  if (t == '(Intercept)') return('')
  for (cn in catnames) if (startsWith(t, cn) && nchar(t) > nchar(cn)) return(cn)
  t
}, character(1))
pretty <- vapply(seq_along(labs), function(i) {
  if (labs[i] == '(Intercept)') labs[i]
  else if (parent[i] %in% catnames) paste0(parent[i], ': ', substring(labs[i], nchar(parent[i]) + 1))
  else labs[i]
}, character(1))
terms <- lapply(seq_along(labs), function(i) list(
  term = pretty[i], b = cf[i, 1], se = cf[i, 2],
  beta = if (labs[i] == '(Intercept)') NA_real_ else unname(betas[labs[i]]),
  t = cf[i, 3], p = cf[i, 4], ciLow = ci[i, 1], ciHigh = ci[i, 2],
  vif = if (is.null(vift) || labs[i] == '(Intercept)') NA_real_ else unname(vift[parent[i]])))
fst <- s$fstatistic
list(r2 = s$r.squared, adjR2 = s$adj.r.squared, f = unname(fst[1]), df1 = unname(fst[2]), df2 = unname(fst[3]),
     p = pf(fst[1], fst[2], fst[3], lower.tail = FALSE), terms = terms, n = nrow(d))`

// Residual diagnostics — ONE file, one ggplot, facet_wrap over a stacked long frame (spike-pinned composition).
const R_RESID = String.raw`
d <- data.frame(y = y)
for (i in seq_along(numnames)) d[[numnames[i]]] <- nums_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(catnames)) d[[catnames[i]]] <- factor(cats_flat[((i - 1) * n + 1):(i * n)])
m <- lm(as.formula(paste('y ~', paste(prednames, collapse = ' + '))), data = d)
r <- residuals(m); fv <- fitted(m); nn <- length(r)
panels <- rbind(
  data.frame(panel = 'Residuals vs fitted', x = fv, y = r),
  data.frame(panel = 'Normal Q-Q', x = qnorm(ppoints(nn)), y = sort(r)))
panels$panel <- factor(panels$panel, levels = c('Residuals vs fitted', 'Normal Q-Q'))
qs <- quantile(r, c(0.25, 0.75)); zs <- qnorm(c(0.25, 0.75))
slope <- diff(qs) / diff(zs); intercept <- qs[1] - slope * zs[1]
refs <- data.frame(panel = factor(c('Residuals vs fitted', 'Normal Q-Q'), levels = levels(panels$panel)),
                   slope = c(0, slope), intercept = c(0, intercept))
print(ggplot2::ggplot(panels, ggplot2::aes(x, y)) +
  ggplot2::geom_abline(data = refs, ggplot2::aes(slope = slope, intercept = intercept), colour = '#9cc2ec', linetype = 'dashed') +
  ggplot2::geom_point(colour = '#0c447c') +
  ggplot2::facet_wrap(~panel, scales = 'free') +
  ggplot2::labs(x = NULL, y = NULL))`

interface RawStats { r2: number; adjR2: number; f: number; df1: number; df2: number; p: number; terms: MultipleLinearTerm[]; n: number }

/** Storage-type classification (recorded decision 1): all-numeric non-missing values → linear term; else factor. */
const isNumericColumn = (data: Dataset, col: string): boolean => {
  const vals = data.rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
  return vals.length > 0 && vals.every((v) => typeof v === 'number')
}

export async function runMultipleLinearRegression(engine: Engine, data: Dataset, outcome: string, predictors: string[],
  standardize: boolean): Promise<MultipleLinearResult> {
  const numPreds = predictors.filter((c) => isNumericColumn(data, c))
  const catPreds = predictors.filter((c) => !isNumericColumn(data, c))
  // Per-test listwise (convention 15): outcome numeric-finite + every predictor complete in the same row.
  const rows = data.rows.filter((r) =>
    typeof r[outcome] === 'number' && Number.isFinite(r[outcome] as number)
    && numPreds.every((c) => typeof r[c] === 'number' && Number.isFinite(r[c] as number))
    && catPreds.every((c) => r[c] !== null && r[c] !== undefined && String(r[c]).trim() !== ''))
  const nExcluded = data.rows.length - rows.length
  const n = rows.length
  const env = {
    y: rows.map((r) => r[outcome] as number),
    prednames: predictors, // drag order = term order
    numnames: numPreds, nums_flat: numPreds.flatMap((c) => rows.map((r) => r[c] as number)),
    catnames: catPreds, cats_flat: catPreds.flatMap((c) => rows.map((r) => String(r[c]))),
    n,
  }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figResidualsPng = await engine.capturePlot(R_RESID, 800, 420, env)
  return { outcome, standardize, ...s, nExcluded, figResidualsPng }
}
```

- [ ] **Step 4: Stats known-answer test**

`src/lib/stats/multipleLinearRegression.test.ts` (spike values from `regression-spike-data/multiple-linear.csv`, embedded verbatim):

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runMultipleLinearRegression } from './multipleLinearRegression'
import { loadRegressionFixture } from './fixtures/regression'

describe('runMultipleLinearRegression', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike known answers — post_score ~ pre_score + age + group + method (fit, B/SE/t/p/CI, refit β, GVIF convention)', async () => {
    const r = await runMultipleLinearRegression(engine, loadRegressionFixture(), 'post_score', ['pre_score', 'age', 'group', 'method'], false)
    expect(r.r2).toBeCloseTo(0.750223512, 6)
    expect(r.adjR2).toBeCloseTo(0.713491675, 6)
    expect(r.f).toBeCloseTo(20.424339860, 5)
    expect(r.df1).toBe(5)
    expect(r.df2).toBe(34)
    expect(r.p).toBeCloseTo(2.245462388e-9, 9)
    // Term order = drag order; dummy rows '<column>: <level>' (R-glued names mapped; references a / lecture).
    expect(r.terms.map((t) => t.term)).toEqual(['(Intercept)', 'pre_score', 'age', 'group: b', 'method: online', 'method: workshop'])
    const [int, pre, age, grp, onl, wks] = r.terms
    expect(int.b).toBeCloseTo(20.361340940, 5)
    expect(int.se).toBeCloseTo(6.030400820, 5)
    expect(int.beta).toBeNull()
    expect(int.vif).toBeNull()
    expect(pre.b).toBeCloseTo(0.612871402, 6)
    expect(pre.se).toBeCloseTo(0.075712457, 6)
    expect(pre.t).toBeCloseTo(8.094723475, 5)
    expect(pre.p).toBeCloseTo(1.941055777e-9, 9)
    expect(pre.ciLow).toBeCloseTo(0.459005177, 6)
    expect(pre.ciHigh).toBeCloseTo(0.766737627, 6)
    expect(pre.beta).toBeCloseTo(0.775421855, 6)   // numeric refit β ≡ hand B·SD(x)/SD(y)
    expect(pre.vif).toBeCloseTo(1.249106308, 6)
    expect(age.b).toBeCloseTo(0.018242579, 6)
    expect(age.p).toBeCloseTo(0.788294904, 6)
    expect(age.beta).toBeCloseTo(0.027593357, 6)
    expect(age.vif).toBeCloseTo(1.414860417, 6)
    expect(grp.b).toBeCloseTo(5.353172626, 5)
    expect(grp.t).toBeCloseTo(3.258776701, 6)
    expect(grp.p).toBeCloseTo(0.002542392, 6)
    expect(grp.beta).toBeCloseTo(0.564629882, 6)   // dummy refit β ≡ hand B/SD(y) — NOT B·SD(dummy)/SD(y)
    expect(grp.vif).toBeCloseTo(1.037328861, 6)
    expect(onl.b).toBeCloseTo(-2.049172535, 5)
    expect(onl.beta).toBeCloseTo(-0.216138004, 6)
    expect(onl.vif).toBeCloseTo(1.247536921, 6)    // method (Df=2): (GVIF^(1/4))^2 = 1.116931923^2
    expect(wks.b).toBeCloseTo(-3.247840455, 5)
    expect(wks.p).toBeCloseTo(0.162160847, 6)
    expect(wks.ciLow).toBeCloseTo(-7.867110628, 5)
    expect(wks.ciHigh).toBeCloseTo(1.371429717, 5)
    expect(wks.beta).toBeCloseTo(-0.342568398, 6)
    expect(wks.vif).toBeCloseTo(1.247536921, 6)    // both method dummy rows share the parent term's value
    expect(r.n).toBe(40)
    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figResidualsPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('k = 1 predictor — VIF undefined (car::vif would error "fewer than 2 terms") → null; fit ≡ the simple-linear spike', async () => {
    const r = await runMultipleLinearRegression(engine, loadRegressionFixture(), 'post_score', ['pre_score'], true)
    expect(r.r2).toBeCloseTo(0.659416639, 6)       // cross-check against simple-linear ground truth
    expect(r.terms.map((t) => t.term)).toEqual(['(Intercept)', 'pre_score'])
    expect(r.terms[1].vif).toBeNull()
    expect(r.terms[1].beta).toBeCloseTo(0.812044727, 6)
    expect(r.standardize).toBe(true)
  }, 300_000)
})
```

Run: `npx vitest run src/lib/stats/multipleLinearRegression.test.ts` (FOREGROUND, long timeout — boots an engine, 3–6 min) → PASS.

- [ ] **Step 5: Builder + test**

`src/lib/results/buildMultipleLinearRegression.ts`:

```ts
import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { MultipleLinearResult } from '../stats/multipleLinearRegression'
import type { CardContent } from './builders'
import { f, fdf, fp } from '../format/apa'

export function buildMultipleLinearRegression(spec: TestSpec, r: MultipleLinearResult): CardContent {
  // R1 + recorded decision 8: intercept β/VIF blank '' (ghost row); standardize off → predictor β cells '—';
  // k = 1 (vif null) → predictor VIF cells '—'.
  const coefRows = r.terms.map((x) => {
    const isInt = x.term === '(Intercept)'
    return {
      term: x.term, b: f(x.b), se: f(x.se),
      beta: isInt ? '' : r.standardize ? f(x.beta!) : '—',
      t: f(x.t), p: fp(x.p), ci: `[${f(x.ciLow)}, ${f(x.ciHigh)}]`,
      vif: isInt ? '' : x.vif == null ? '—' : f(x.vif),
    }
  })
  const first = r.terms.find((x) => x.term !== '(Intercept)')! // APA "predictor X" = first coefficient row (recorded decision 3)
  const apa = spec.apaTemplate
    .replace('{r2}', f(r.r2)).replace('{df1}', fdf(r.df1)).replace('{df2}', fdf(r.df2)).replace('{f}', f(r.f))
    .replace('p={p}', r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`)
    .replace('predictor X', `predictor ${first.term}`)
    .replace('{b}', f(first.b))
    .replace('p={p2}', first.p < 0.001 ? 'p<.001' : `p=${fp(first.p)}`)
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: [{ r2: f(r.r2), adjR2: f(r.adjR2), f: f(r.f), df1: fdf(r.df1), df2: fdf(r.df2), p: fp(r.p) }] },
      { spec: spec.tables[1], rows: coefRows },
    ],
    note: spec.tableNote ?? null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figResidualsPng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
```

`src/lib/results/buildMultipleLinearRegression.test.ts` (spike values in, rendered 2dp out — incl. the U+2212 minus):

```ts
import { describe, it, expect } from 'vitest'
import { buildMultipleLinearRegression } from './buildMultipleLinearRegression'
import { MULTIPLE_LINEAR_REGRESSION } from '../registry/multipleLinearRegression'
import type { MultipleLinearResult } from '../stats/multipleLinearRegression'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
// The spike's pinned numbers (multiple-linear.csv).
const res: MultipleLinearResult = { outcome: 'post_score', standardize: false,
  r2: 0.750223512, adjR2: 0.713491675, f: 20.424339860, df1: 5, df2: 34, p: 2.245462388e-9,
  terms: [
    { term: '(Intercept)', b: 20.361340940, se: 6.030400820, beta: null, t: 3.376449021, p: 0.001851288, ciLow: 8.106091987, ciHigh: 32.616589900, vif: null },
    { term: 'pre_score', b: 0.612871402, se: 0.075712457, beta: 0.775421855, t: 8.094723475, p: 1.941055777e-9, ciLow: 0.459005177, ciHigh: 0.766737627, vif: 1.249106308 },
    { term: 'age', b: 0.018242579, se: 0.067402312, beta: 0.027593357, t: 0.270652118, p: 0.788294904, ciLow: -0.118735401, ciHigh: 0.155220558, vif: 1.414860417 },
    { term: 'group: b', b: 5.353172626, se: 1.642693905, beta: 0.564629882, t: 3.258776701, p: 0.002542392, ciLow: 2.014816956, ciHigh: 8.691528296, vif: 1.037328861 },
    { term: 'method: online', b: -2.049172535, se: 2.021575603, beta: -0.216138004, t: -1.013651199, p: 0.317908726, ciLow: -6.157508455, ciHigh: 2.059163385, vif: 1.247536921 },
    { term: 'method: workshop', b: -3.247840455, se: 2.272989373, beta: -0.342568398, t: -1.428885016, p: 0.162160847, ciLow: -7.867110628, ciHigh: 1.371429717, vif: 1.247536921 },
  ],
  n: 40, nExcluded: 0, figResidualsPng: png }

describe('buildMultipleLinearRegression', () => {
  it('standardize OFF (the drawn default) → β cells em-dash; intercept β/VIF blank; VIF filled (GVIF convention)', () => {
    const c = buildMultipleLinearRegression(MULTIPLE_LINEAR_REGRESSION, res)
    expect(c.tables[0].rows).toEqual([{ r2: '0.75', adjR2: '0.71', f: '20.42', df1: '5', df2: '34', p: '<.001' }])
    expect(c.tables[1].rows[0]).toEqual({ term: '(Intercept)', b: '20.36', se: '6.03', beta: '', t: '3.38', p: '.002', ci: '[8.11, 32.62]', vif: '' })
    expect(c.tables[1].rows[1]).toEqual({ term: 'pre_score', b: '0.61', se: '0.08', beta: '—', t: '8.09', p: '<.001', ci: '[0.46, 0.77]', vif: '1.25' })
    expect(c.tables[1].rows[4]).toEqual({ term: 'method: online', b: '−2.05', se: '2.02', beta: '—', t: '−1.01', p: '.318', ci: '[−6.16, 2.06]', vif: '1.25' })
  })
  it('standardize ON → β fills (R1)', () => {
    const c = buildMultipleLinearRegression(MULTIPLE_LINEAR_REGRESSION, { ...res, standardize: true })
    expect(c.tables[1].rows.map((row) => row.beta)).toEqual(['', '0.78', '0.03', '0.56', '−0.22', '−0.34'])
  })
  it('k = 1 (vif null) → predictor VIF cells em-dash', () => {
    const one = { ...res, terms: res.terms.slice(0, 2).map((t) => ({ ...t, vif: null })) }
    const c = buildMultipleLinearRegression(MULTIPLE_LINEAR_REGRESSION, one)
    expect(c.tables[1].rows.map((row) => row.vif)).toEqual(['', '—'])
  })
  it('APA: card-literal wording, predictor X = first coefficient row (recorded decision 3)', () => {
    expect(buildMultipleLinearRegression(MULTIPLE_LINEAR_REGRESSION, res).apa)
      .toBe('The model explained R²=0.75 of the variance, F(5,34)=20.42, p<.001; predictor pre_score was significant, B=0.61, p<.001.')
  })
})
```

Run: `npx vitest run src/lib/results/buildMultipleLinearRegression.test.ts` → PASS.

- [ ] **Step 6: Gates + commit**

Run: `npx tsc -b` → 0; all three own test files green.

```bash
git add src/lib/registry/multipleLinearRegression.ts src/lib/registry/multipleLinearRegression.consistency.test.ts src/lib/stats/multipleLinearRegression.ts src/lib/stats/multipleLinearRegression.test.ts src/lib/results/buildMultipleLinearRegression.ts src/lib/results/buildMultipleLinearRegression.test.ts
git commit -m "feat(regression): multiple-linear-regression — registry+consistency, stats (lm + GVIF convention + refit β, spike-verified), builder (R1 em-dash toggle)"
```

---

### Task 8: Logistic regression [worktree reg/logistic-regression]

**Files:**
- Create: `src/lib/registry/logisticRegression.ts`, `src/lib/registry/logisticRegression.consistency.test.ts`
- Create: `src/lib/stats/logisticRegression.ts`, `src/lib/stats/logisticRegression.test.ts`
- Create: `src/lib/results/buildLogisticRegression.ts`, `src/lib/results/buildLogisticRegression.test.ts`

Self-contained context: outcome = one nominal column with EXACTLY 2 categories; predictors = 1+ columns of ANY level (storage-type classification: all-numeric → linear term, else factor with first-alphabetical reference; recorded decision 1). Listwise per test across outcome + all predictors, own N (convention 15). The **event category** (a `level-select` option, Task 3 machinery; `fromRole: 'outcome'`, default = second level alphabetically) is re-leveled so the chosen level is glm's SECOND factor level: `levels = c(other, event)` — switching the pill flips B signs and inverts ORs exactly, while −2LL/AIC/omnibus/Nagelkerke **and AUC stay invariant** (spike-pinned both ways). Profile CIs need `suppressMessages()`. Classification table is HAND-computed (cutoff P(event) ≥ 0.5; rows = PREDICTED levels in factor order; % correct = per-predicted-row 100·diag/rowsum) — caret is NOT shipped; the card's R map was truth-fixed in Task 1 to `table(predicted, observed)`. AUC via `pROC` (D1: SHIP). `report odds ratios` (drawn ON) masks the OR + 95% CI (OR) cells — and the APA's OR/CI slots (recorded decision 4) — with `—` when off (R1). Spike ground truth: `regression-spike-data/logistic-event-yes.csv` + `logistic-event-no.csv`.

- [ ] **Step 1: Registry**

`src/lib/registry/logisticRegression.ts`:

```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Logistic regression cards) — display strings
// verbatim, AFTER the Task-1 D4 truth-fix (caret::confusionMatrix() → table(predicted, observed): caret is not
// shipped; the classification table is a hand 2×2 tabulation).
export const LOGISTIC_REGRESSION: TestSpec = {
  id: 'logistic-regression',
  name: 'Logistic regression',
  question: 'predict a yes/no outcome',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'nominal', arity: 'exactly 1 · 2 categories',
      hint: 'e.g. the yes/no result you measured — passed, churned' },
    { id: 'predictors', label: 'Predictors', levels: 'any level', arity: 'one or more',
      hint: 'e.g. explanatory variables — age, gender, hours studied' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'ci', label: 'CI', value: '95%', kind: 'display' },
    // Drawn ON. R1 ruling: off → em-dash OR + 95% CI (OR) cells (and the APA's OR/CI slots — recorded decision 4).
    { id: 'reportOR', label: 'report odds ratios', value: 'on', kind: 'toggle', default: true,
      hint: 'Keep report odds ratios on so each coefficient reads as the multiplier on the odds of the outcome.' },
    // B2 level-select: choices = the assigned outcome column's two levels; default = second level alphabetically.
    { id: 'event', label: 'event category', value: 'passed · second level', kind: 'level-select', fromRole: 'outcome',
      hint: 'Event category is the outcome level the model predicts (here passed, the second level) — switch it if the odds should describe the other category.' },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['nominal'], arity: { min: 1, max: 1 }, categories: { exact: 2 } },
      { roleId: 'predictors', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 1, max: Infinity } },
    ],
    // Recorded decision 2: complete-pairs is numeric-only (a string outcome counts 0 pairs) — the role-candidate
    // check enforces the 2-category nominal candidate; the adequacy gate is the run itself.
    minRule: { kind: 'used-columns', n: 1 },
  },
  tables: [
    { id: 'model-fit', title: 'Model fit', domId: 'logistic-model-fit',
      columns: [{ key: 'm2ll', label: '−2LL' }, { key: 'aic', label: 'AIC' }, { key: 'nagelkerke', label: 'Nagelkerke R²' },
        { key: 'chisq', label: 'Omnibus χ²' }, { key: 'p', label: 'p' }] },
    { id: 'coefficients', title: 'Coefficients', domId: 'logistic-coefficients',
      columns: [{ key: 'term', label: 'Term' }, { key: 'b', label: 'B' }, { key: 'se', label: 'SE' }, { key: 'z', label: 'z' },
        { key: 'p', label: 'p' }, { key: 'or', label: 'OR' }, { key: 'ci', label: '95% CI (OR)' }] },
    { id: 'classification', title: 'Classification', // unique id across all shipped specs — no domId needed
      // Drawn placeholders; the builder replaces 0/1 with the REAL outcome level names (convention 7).
      columns: [{ key: 'pred', label: 'Predicted \\ Observed' }, { key: 'c0', label: '0' }, { key: 'c1', label: '1' }, { key: 'pct', label: '% correct' }] },
  ],
  figures: [{ caption: 'Classifier performance', type: 'ROC curve (with AUC)', file: 'roc' }],
  howToRead:
    "Each predictor's odds ratio tells how the odds of the outcome change per unit (>1 increases, <1 decreases); " +
    'p tests significance (read it from the z column, z = B/SE). Model fit and the ROC/AUC show how well it classifies overall.',
  apaTemplate: 'Predictor X was associated with the outcome, OR={or}, 95% CI [{ciLow}, {ciHigh}], p={p} (AUC={auc}).',
  rMap: 'glm(family=binomial) → B/SE/z/p · exp(cbind(OR=coef(m), confint(m))) → OR + 95% CI · performance::r2_nagelkerke(m) → Nagelkerke R² · AIC(m) → AIC · anova(m, test="Chisq") → omnibus χ² / −2LL · table(predicted, observed) → Table 3 (classification) · pROC → ROC/AUC',
  bundleFiles: ['table_model-fit.png', 'table_coefficients.png', 'table_classification.png', 'figure_roc.png'],
}
```

- [ ] **Step 2: Consistency test**

`src/lib/registry/logisticRegression.consistency.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { LOGISTIC_REGRESSION as spec } from './logisticRegression'
import { figuresOf } from './types'
import { strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Logistic regression</span>'), outputsHtml.indexOf('Poisson / negative binomial</span>'))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Logistic regression</div>'), inputsHtml.indexOf('<div class="ttl">Poisson / negative binomial</div>'))

describe('logistic-regression registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences (decoded — −2LL, Nagelkerke R², Omnibus χ², Predicted \\ Observed)', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => c.label)))
  })
  it('numbered table captions equal the card captions (three tables)', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('question, figure caption + type, how-to-read and R map match verbatim; NO table note on this card; R map = amended truth (no caret)', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(card.includes('tbl-note')).toBe(false)
    expect(spec.tableNote).toBeUndefined()
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figures![0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${spec.figures![0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
    expect(spec.rMap.includes('caret')).toBe(false) // the Task-1 truth-fix holds
  })
  it('APA line equals the template with every {placeholder} as __ (Predictor X stays literal on the card)', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__')}”`)
  })
  it('bundle line EQUALS bundleFiles, names derive from table ids + figure file slug', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...figuresOf(spec).map((g) => `figure_${g.file ?? g.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + hints + constraint lines (2-categories arity on the outcome)', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const hints = [...inCard.matchAll(/<div class="sl-hint">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(hints).toEqual(spec.roles.map((r) => r.hint))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
    expect(spec.constraints.roles[0].categories).toEqual({ exact: 2 })
  })
  it('options equal the inputs card option strip; reportOR is a default-ON toggle, event is the level-select (B2)', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['display', 'display', 'toggle', 'level-select'])
    expect(spec.options[2]).toMatchObject({ id: 'reportOR', default: true })
    expect(spec.options[3]).toMatchObject({ id: 'event', fromRole: 'outcome' })
  })
  it('the interactive option hints are the drawn config-guide sentences (cfgguide wording)', () => {
    const guide = strip(inCard.match(/<div class="cfgguide">(.*?)<\/p>/s)![1])
    expect(guide).toContain(spec.options[2].hint!)
    expect(guide).toContain(spec.options[3].hint!)
  })
})
```

Run: `npx vitest run src/lib/registry/logisticRegression.consistency.test.ts` → PASS. Then the mutation check (`'Model fit'` → `'Model Fit'`) → RED → restore → GREEN. Report both runs.

- [ ] **Step 3: Stats module**

`src/lib/stats/logisticRegression.ts`:

```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface LogisticTerm { term: string; b: number; se: number; z: number; p: number; or: number; orLow: number; orHigh: number }
export interface LogisticResult {
  outcome: string; event: string
  reportOR: boolean // R1 display toggle — ORs always computed; the builder masks
  m2ll: number; aic: number; nagelkerke: number
  omnibusChisq: number; omnibusDf: number; omnibusP: number
  terms: LogisticTerm[]
  levels: string[]                 // factor order [other, event] — classification row/column order
  classCounts: number[][]          // rows = PREDICTED level (levels order), cols = observed (levels order)
  pctCorrect: (number | null)[]    // per-predicted-row 100·diag/rowsum; null when a row predicts nothing
  auc: number
  n: number; nExcluded: number
  figRocPng: Uint8Array<ArrayBuffer>
}

// Event re-level (convention 7): chosen level becomes glm's SECOND factor level — levels = c(other, event).
// −2LL = −2·logLik; omnibus χ² = null − residual deviance, df = df.null − df.residual, p from pchisq (convention 6).
// Nagelkerke via performance::r2_nagelkerke (D3: SHIP). Profile CIs need suppressMessages (spike risk 7).
// Classification HAND-computed (convention 8): cutoff P(event) ≥ 0.5, rows = predicted levels, caret never consulted.
// AUC via pROC (D1: SHIP) — spike-pinned ≡ hand rank/Mann-Whitney identity, and INVARIANT to the event choice.
const R_STATS = String.raw`
oth <- setdiff(sort(unique(yv)), event)
d <- data.frame(y = factor(yv, levels = c(oth, event)))
for (i in seq_along(numnames)) d[[numnames[i]]] <- nums_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(catnames)) d[[catnames[i]]] <- factor(cats_flat[((i - 1) * n + 1):(i * n)])
m <- glm(as.formula(paste('y ~', paste(prednames, collapse = ' + '))), family = binomial, data = d)
s <- summary(m)
cf <- s$coefficients
ci <- suppressMessages(confint(m))
labs <- rownames(cf)
parent <- vapply(labs, function(t) {
  if (t == '(Intercept)') return('')
  for (cn in catnames) if (startsWith(t, cn) && nchar(t) > nchar(cn)) return(cn)
  t
}, character(1))
pretty <- vapply(seq_along(labs), function(i) {
  if (labs[i] == '(Intercept)') labs[i]
  else if (parent[i] %in% catnames) paste0(parent[i], ': ', substring(labs[i], nchar(parent[i]) + 1))
  else labs[i]
}, character(1))
terms <- lapply(seq_along(labs), function(i) list(
  term = pretty[i], b = cf[i, 1], se = cf[i, 2], z = cf[i, 3], p = cf[i, 4],
  or = exp(cf[i, 1]), orLow = exp(ci[i, 1]), orHigh = exp(ci[i, 2])))
omni <- m$null.deviance - m$deviance
odf <- m$df.null - m$df.residual
p <- fitted(m)
pred <- factor(ifelse(p >= 0.5, event, oth), levels = levels(d$y))
tab <- table(pred, d$y)
pct <- ifelse(rowSums(tab) > 0, 100 * diag(tab) / rowSums(tab), NA_real_)
auc <- as.numeric(pROC::auc(pROC::roc(d$y, p, quiet = TRUE)))
list(m2ll = -2 * as.numeric(logLik(m)), aic = AIC(m), nagelkerke = as.numeric(performance::r2_nagelkerke(m)),
     omnibusChisq = omni, omnibusDf = odf, omnibusP = pchisq(omni, odf, lower.tail = FALSE),
     terms = terms, levels = levels(d$y),
     classCounts = lapply(seq_len(nrow(tab)), function(i) as.numeric(tab[i, ])),
     pctCorrect = as.numeric(pct), auc = auc, n = nrow(d))`

// ROC figure (convention 9, spike recipe): hand threshold sweep — thresholds = −Inf, midpoints of sorted unique
// fitted probs, +Inf; the polyline IS the staircase (consecutive points differ in one coordinate). AUC annotated
// via the rank identity (≡ pROC, spike-pinned). House styling.
const R_ROC = String.raw`
oth <- setdiff(sort(unique(yv)), event)
d <- data.frame(y = factor(yv, levels = c(oth, event)))
for (i in seq_along(numnames)) d[[numnames[i]]] <- nums_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(catnames)) d[[catnames[i]]] <- factor(cats_flat[((i - 1) * n + 1):(i * n)])
m <- glm(as.formula(paste('y ~', paste(prednames, collapse = ' + '))), family = binomial, data = d)
p <- fitted(m)
u <- sort(unique(p)); th <- c(-Inf, (u[-1] + u[-length(u)]) / 2, Inf)
tpr <- vapply(th, function(t) mean(p[d$y == event] >= t), numeric(1))
fpr <- vapply(th, function(t) mean(p[d$y != event] >= t), numeric(1))
ord <- order(fpr, tpr)
n1 <- sum(d$y == event); n0 <- sum(d$y != event); rk <- rank(p)
auc <- (sum(rk[d$y == event]) - n1 * (n1 + 1) / 2) / (n1 * n0)
print(ggplot2::ggplot(data.frame(fpr = fpr[ord], tpr = tpr[ord]), ggplot2::aes(fpr, tpr)) +
  ggplot2::geom_abline(slope = 1, intercept = 0, colour = '#9cc2ec', linetype = 'dashed') +
  ggplot2::geom_line(colour = '#0c447c', linewidth = 0.8) +
  ggplot2::annotate('text', x = 0.7, y = 0.15, label = sprintf('AUC = %.3f', auc)) +
  ggplot2::coord_equal() +
  ggplot2::labs(x = '1 - Specificity', y = 'Sensitivity'))`

interface RawStats {
  m2ll: number; aic: number; nagelkerke: number; omnibusChisq: number; omnibusDf: number; omnibusP: number
  terms: LogisticTerm[]; levels: string[]; classCounts: number[][]; pctCorrect: (number | null)[]; auc: number; n: number
}

/** Storage-type classification (recorded decision 1): all-numeric non-missing values → linear term; else factor. */
const isNumericColumn = (data: Dataset, col: string): boolean => {
  const vals = data.rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
  return vals.length > 0 && vals.every((v) => typeof v === 'number')
}

export async function runLogisticRegression(engine: Engine, data: Dataset, outcome: string, predictors: string[],
  event: string, reportOR: boolean): Promise<LogisticResult> {
  const numPreds = predictors.filter((c) => isNumericColumn(data, c))
  const catPreds = predictors.filter((c) => !isNumericColumn(data, c))
  // Per-test listwise (convention 15): outcome non-blank (stringified — the level-select choices are strings) +
  // every predictor complete in the same row.
  const rows = data.rows.filter((r) =>
    r[outcome] !== null && r[outcome] !== undefined && String(r[outcome]).trim() !== ''
    && numPreds.every((c) => typeof r[c] === 'number' && Number.isFinite(r[c] as number))
    && catPreds.every((c) => r[c] !== null && r[c] !== undefined && String(r[c]).trim() !== ''))
  const nExcluded = data.rows.length - rows.length
  const n = rows.length
  const env = {
    yv: rows.map((r) => String(r[outcome])), event,
    prednames: predictors,
    numnames: numPreds, nums_flat: numPreds.flatMap((c) => rows.map((r) => r[c] as number)),
    catnames: catPreds, cats_flat: catPreds.flatMap((c) => rows.map((r) => String(r[c]))),
    n,
  }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figRocPng = await engine.capturePlot(R_ROC, 550, 550, env)
  return { outcome, event, reportOR, ...s, nExcluded, figRocPng }
}
```

- [ ] **Step 4: Stats known-answer test**

`src/lib/stats/logisticRegression.test.ts` (spike values from `regression-spike-data/logistic-event-yes.csv` + `logistic-event-no.csv`, embedded verbatim):

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runLogisticRegression } from './logisticRegression'
import { loadRegressionFixture } from './fixtures/regression'

describe('runLogisticRegression', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike known answers — event = yes (passed ~ pre_score + age + group): fit, profile-OR CIs, classification, AUC', async () => {
    const r = await runLogisticRegression(engine, loadRegressionFixture(), 'passed', ['pre_score', 'age', 'group'], 'yes', true)
    expect(r.m2ll).toBeCloseTo(45.908685210, 5)
    expect(r.aic).toBeCloseTo(53.908685210, 5)
    expect(r.nagelkerke).toBeCloseTo(0.283002870, 6)
    expect(r.omnibusChisq).toBeCloseTo(9.543089235, 6)
    expect(r.omnibusDf).toBe(3)
    expect(r.omnibusP).toBeCloseTo(0.022877354, 6)
    expect(r.terms.map((t) => t.term)).toEqual(['(Intercept)', 'pre_score', 'age', 'group: b'])
    const [, pre, age, grp] = r.terms
    expect(pre.b).toBeCloseTo(0.079190519, 6)
    expect(pre.se).toBeCloseTo(0.037506735, 6)
    expect(pre.z).toBeCloseTo(2.111367978, 6)
    expect(pre.p).toBeCloseTo(0.034740695, 6)
    expect(pre.or).toBeCloseTo(1.082410522, 6)
    expect(pre.orLow).toBeCloseTo(1.012732368, 6)   // profile-likelihood (suppressMessages), NOT Wald
    expect(pre.orHigh).toBeCloseTo(1.176927471, 6)
    expect(age.b).toBeCloseTo(0.031993651, 6)
    expect(age.p).toBeCloseTo(0.239276896, 6)
    expect(grp.b).toBeCloseTo(1.240356431, 6)
    expect(grp.or).toBeCloseTo(3.456845371, 5)
    expect(grp.orLow).toBeCloseTo(0.866707308, 6)
    expect(grp.orHigh).toBeCloseTo(15.442995620, 4)
    // Classification (convention 8): rows = PREDICTED levels in factor order [other, event] = [no, yes].
    expect(r.levels).toEqual(['no', 'yes'])
    expect(r.classCounts).toEqual([[13, 7], [7, 13]])
    expect(r.pctCorrect).toEqual([65, 65])
    expect(r.auc).toBeCloseTo(0.76, 9)
    expect(r.n).toBe(40)
    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figRocPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('event = no — B sign-flips and ORs invert EXACTLY; fit rows and AUC are INVARIANT (spike-pinned symmetry)', async () => {
    const r = await runLogisticRegression(engine, loadRegressionFixture(), 'passed', ['pre_score', 'age', 'group'], 'no', true)
    expect(r.levels).toEqual(['yes', 'no']) // releveled: chosen event is glm's second level
    const [, pre, , grp] = r.terms
    expect(pre.b).toBeCloseTo(-0.079190519, 6)      // exact sign flip
    expect(pre.or).toBeCloseTo(0.923863894, 6)      // exact inversion: 1/1.082410522
    expect(pre.orLow).toBeCloseTo(0.849670031, 6)   // bounds swap AND invert
    expect(pre.orHigh).toBeCloseTo(0.987427707, 6)
    expect(grp.or).toBeCloseTo(0.289281091, 6)      // 1/3.456845371
    expect(grp.orLow).toBeCloseTo(0.064754276, 6)   // = 1/orHigh(yes)
    expect(grp.orHigh).toBeCloseTo(1.153792048, 6)
    expect(r.m2ll).toBeCloseTo(45.908685210, 5)     // invariant
    expect(r.aic).toBeCloseTo(53.908685210, 5)      // invariant
    expect(r.nagelkerke).toBeCloseTo(0.283002870, 6) // invariant
    expect(r.auc).toBeCloseTo(0.76, 9)              // INVARIANT — not 1 − AUC (spike surprise 4)
    expect(r.classCounts).toEqual([[13, 7], [7, 13]]) // mirrored table (symmetric here), rows now predicted yes/no
    expect(r.pctCorrect).toEqual([65, 65])
  }, 300_000)
})
```

Run: `npx vitest run src/lib/stats/logisticRegression.test.ts` (FOREGROUND, long timeout — boots an engine, 3–6 min) → PASS.

- [ ] **Step 5: Builder + test**

`src/lib/results/buildLogisticRegression.ts`:

```ts
import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { LogisticResult } from '../stats/logisticRegression'
import type { CardContent } from './builders'
import { f, fp } from '../format/apa'

const pc = (x: number | null) => (x == null ? '—' : `${x.toFixed(1)}%`) // percentages 1 dp (house rule)

export function buildLogisticRegression(spec: TestSpec, r: LogisticResult): CardContent {
  // R1: report-OR off → em-dash OR + CI cells (B/SE/z/p always fill — the column set is card-fixed).
  const coefRows = r.terms.map((x) => ({
    term: x.term, b: f(x.b), se: f(x.se), z: f(x.z), p: fp(x.p),
    or: r.reportOR ? f(x.or) : '—',
    ci: r.reportOR ? `[${f(x.orLow)}, ${f(x.orHigh)}]` : '—',
  }))
  // Classification (convention 7): real level names replace the drawn 0/1 headers; rows = predicted levels.
  const classColumns = [{ key: 'pred', label: 'Predicted \\ Observed' },
    { key: 'c0', label: r.levels[0] }, { key: 'c1', label: r.levels[1] }, { key: 'pct', label: '% correct' }]
  const classRows = r.levels.map((lvl, i) => ({
    pred: lvl, c0: r.classCounts[i][0], c1: r.classCounts[i][1], pct: pc(r.pctCorrect[i]),
  }))
  const first = r.terms.find((x) => x.term !== '(Intercept)')! // APA "Predictor X" = first coefficient row (recorded decision 3)
  const apa = spec.apaTemplate
    .replace('Predictor X', `Predictor ${first.term}`)
    .replace('{or}', r.reportOR ? f(first.or) : '—')           // decision 4: the toggle masks the APA slots too
    .replace('{ciLow}', r.reportOR ? f(first.orLow) : '—').replace('{ciHigh}', r.reportOR ? f(first.orHigh) : '—')
    .replace('p={p}', first.p < 0.001 ? 'p<.001' : `p=${fp(first.p)}`)
    .replace('{auc}', f(r.auc))
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: [{ m2ll: f(r.m2ll), aic: f(r.aic), nagelkerke: f(r.nagelkerke), chisq: f(r.omnibusChisq), p: fp(r.omnibusP) }] },
      { spec: spec.tables[1], rows: coefRows },
      { spec: { ...spec.tables[2], columns: classColumns }, rows: classRows },
    ],
    note: spec.tableNote ?? null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figRocPng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
```

`src/lib/results/buildLogisticRegression.test.ts` (spike values in, rendered 2dp out):

```ts
import { describe, it, expect } from 'vitest'
import { buildLogisticRegression } from './buildLogisticRegression'
import { LOGISTIC_REGRESSION } from '../registry/logisticRegression'
import type { LogisticResult } from '../stats/logisticRegression'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
// The spike's pinned numbers (logistic-event-yes.csv).
const res: LogisticResult = { outcome: 'passed', event: 'yes', reportOR: true,
  m2ll: 45.908685210, aic: 53.908685210, nagelkerke: 0.283002870,
  omnibusChisq: 9.543089235, omnibusDf: 3, omnibusP: 0.022877354,
  terms: [
    { term: '(Intercept)', b: -6.593371937, se: 2.919607358, z: -2.258307755, p: 0.023926479, or: 0.001369415, orLow: 2.097886128e-6, orHigh: 0.243330545 },
    { term: 'pre_score', b: 0.079190519, se: 0.037506735, z: 2.111367978, p: 0.034740695, or: 1.082410522, orLow: 1.012732368, orHigh: 1.176927471 },
    { term: 'age', b: 0.031993651, se: 0.027187081, z: 1.176796110, p: 0.239276896, or: 1.032510950, orLow: 0.980657994, orHigh: 1.093010423 },
    { term: 'group: b', b: 1.240356431, se: 0.724147424, z: 1.712850712, p: 0.086740008, or: 3.456845371, orLow: 0.866707308, orHigh: 15.442995620 },
  ],
  levels: ['no', 'yes'], classCounts: [[13, 7], [7, 13]], pctCorrect: [65, 65], auc: 0.76,
  n: 40, nExcluded: 0, figRocPng: png }

describe('buildLogisticRegression', () => {
  it('Table 1 fit row; Table 2 coefficient rows with ORs filled (drawn default ON)', () => {
    const c = buildLogisticRegression(LOGISTIC_REGRESSION, res)
    expect(c.tables[0].rows).toEqual([{ m2ll: '45.91', aic: '53.91', nagelkerke: '0.28', chisq: '9.54', p: '.023' }])
    expect(c.tables[1].rows[1]).toEqual({ term: 'pre_score', b: '0.08', se: '0.04', z: '2.11', p: '.035', or: '1.08', ci: '[1.01, 1.18]' })
    expect(c.tables[1].rows[3]).toEqual({ term: 'group: b', b: '1.24', se: '0.72', z: '1.71', p: '.087', or: '3.46', ci: '[0.87, 15.44]' })
    expect(c.note).toBeNull()
  })
  it('Table 3 classification: real level names as headers, rows = predicted levels, 1 dp % correct (convention 7/8)', () => {
    const c = buildLogisticRegression(LOGISTIC_REGRESSION, res)
    expect(c.tables[2].spec.columns.map((x) => x.label)).toEqual(['Predicted \\ Observed', 'no', 'yes', '% correct'])
    expect(c.tables[2].rows).toEqual([
      { pred: 'no', c0: 13, c1: 7, pct: '65.0%' },
      { pred: 'yes', c0: 7, c1: 13, pct: '65.0%' },
    ])
  })
  it('report-OR OFF → em-dash OR/CI cells AND em-dash APA slots (R1 + recorded decision 4)', () => {
    const c = buildLogisticRegression(LOGISTIC_REGRESSION, { ...res, reportOR: false })
    expect(c.tables[1].rows[1]).toMatchObject({ or: '—', ci: '—' })
    expect(c.apa).toBe('Predictor pre_score was associated with the outcome, OR=—, 95% CI [—, —], p=.035 (AUC=0.76).')
  })
  it('APA: card-literal wording, Predictor X = first coefficient row, AUC at 2 dp', () => {
    expect(buildLogisticRegression(LOGISTIC_REGRESSION, res).apa)
      .toBe('Predictor pre_score was associated with the outcome, OR=1.08, 95% CI [1.01, 1.18], p=.035 (AUC=0.76).')
  })
})
```

Run: `npx vitest run src/lib/results/buildLogisticRegression.test.ts` → PASS.

- [ ] **Step 6: Gates + commit**

Run: `npx tsc -b` → 0; all three own test files green.

```bash
git add src/lib/registry/logisticRegression.ts src/lib/registry/logisticRegression.consistency.test.ts src/lib/stats/logisticRegression.ts src/lib/stats/logisticRegression.test.ts src/lib/results/buildLogisticRegression.ts src/lib/results/buildLogisticRegression.test.ts
git commit -m "feat(regression): logistic-regression — registry+consistency, stats (event relevel + profile ORs + hand classification + pROC AUC, spike-verified both events), builder"
```

---

### Task 9: Poisson / negative binomial [worktree reg/poisson-negative-binomial]

**Files:**
- Create: `src/lib/registry/poissonNegativeBinomial.ts`, `src/lib/registry/poissonNegativeBinomial.consistency.test.ts`
- Create: `src/lib/stats/poissonNegativeBinomial.ts`, `src/lib/stats/poissonNegativeBinomial.test.ts`
- Create: `src/lib/results/buildPoissonNegativeBinomial.ts`, `src/lib/results/buildPoissonNegativeBinomial.test.ts`

Self-contained context: outcome = one count-tagged column (B1 machinery, Task 2: constraint `tag: 'count'` + machine levels interval/ratio — recorded decision 6); predictors = 1+ columns of ANY level (storage-type classification: all-numeric → linear term, else factor; recorded decision 1); Exposure = optional (0–1) interval/ratio column whose `log()` enters the formula as an in-formula offset for BOTH models (convention 11; the run gate for strict positivity landed in Task 2; the drawn `offset · from Exposure` pill is display-only — it reflects the role slot). The `model` select (drawn `Poisson`) picks `glm(family=poisson)` vs `MASS::glm.nb` (MASS is preinstalled with base R — load-checked in Task 4, never `installPackages`-ed). **Dispersion column (convention 10):** under Poisson = `performance::check_overdispersion(m)$dispersion_ratio` (≡ hand Pearson χ²/df, spike-pinned); under negative binomial = **theta** (`m$theta` — the card note's exact prescription; recorded decision 10). Profile CIs (`confint` on glm/glm.nb) need `suppressMessages()`. IRR = `exp(coef)`, CI = `exp(confint)`. Listwise per test across outcome + predictors + exposure, own N (convention 15). The drawn dispersion note ships card-literal/static. Spike ground truth: `regression-spike-data/poisson-nb.csv` (po_/pooff_/nb_/nboff_ key families).

- [ ] **Step 1: Registry**

`src/lib/registry/poissonNegativeBinomial.ts`:

```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Poisson / negative binomial cards) — display strings verbatim.
export const POISSON_NEGATIVE_BINOMIAL: TestSpec = {
  id: 'poisson-negative-binomial',
  name: 'Poisson / negative binomial',
  question: 'predict a count outcome',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'count', arity: 'non-negative integers · exactly 1',
      hint: 'e.g. a count of events you tallied — complaints, visits' },
    { id: 'predictors', label: 'Predictors', levels: 'any level', arity: 'one or more',
      hint: 'e.g. explanatory variables — age, gender, hours studied' },
    { id: 'exposure', label: 'Exposure (optional)', levels: 'interval / ratio', arity: '0 or 1 · offset',
      hint: 'e.g. observation time / population at risk (log offset)' },
  ],
  options: [
    { id: 'model', label: 'model', value: 'Poisson', kind: 'select', choices: ['Poisson', 'negative binomial'],
      hint: 'Start with Poisson, but switch to negative binomial if the dispersion check shows the counts are over-dispersed.' },
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'ci', label: 'CI', value: '95%', kind: 'display' },
    // Display-only (convention 11): the pill reflects the Exposure role slot, exactly as drawn.
    { id: 'offset', label: 'offset', value: 'from Exposure', kind: 'display' },
  ],
  constraints: {
    roles: [
      // Recorded decision 6: 'count' is a columnMeta TAG (B1), not a measurement level — machine levels are interval/ratio.
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, tag: 'count' },
      { roleId: 'predictors', levels: ['nominal', 'ordinal', 'interval', 'ratio'], arity: { min: 1, max: Infinity } },
      { roleId: 'exposure', levels: ['interval', 'ratio'], arity: { min: 0, max: 1 } },
    ],
    minRule: { kind: 'complete-pairs', n: 3 }, // count outcome is numeric — complete-pairs works here (convention 14)
  },
  tables: [
    { id: 'model-fit', title: 'Model fit', domId: 'poisson-nb-model-fit',
      columns: [{ key: 'aic', label: 'AIC' }, { key: 'dev', label: 'Residual deviance' }, { key: 'df', label: 'df' }, { key: 'dispersion', label: 'Dispersion' }] },
    { id: 'coefficients', title: 'Coefficients', domId: 'poisson-nb-coefficients',
      columns: [{ key: 'term', label: 'Term' }, { key: 'b', label: 'B' }, { key: 'se', label: 'SE' }, { key: 'z', label: 'z' },
        { key: 'p', label: 'p' }, { key: 'irr', label: 'IRR' }, { key: 'ci', label: '95% CI (IRR)' }] },
  ],
  tableNote: { kind: 'assume', text:
    'dispersion check (Poisson): if variance >> mean (over-dispersion), switch to negative binomial, which instead reports theta (its overdispersion parameter) rather than this ratio.' },
  figures: [{ caption: 'Fit / residuals', type: 'fitted vs. residual plot', file: 'residuals' }],
  howToRead:
    "Models event counts. Each predictor's incidence-rate ratio (IRR) gives the multiplicative change in the expected " +
    'count per unit (>1 more, <1 fewer); p tests significance. Check dispersion to pick Poisson vs. negative binomial. ' +
    'If cases have unequal exposure (different observation time/area/population), add an offset of log(exposure) so the ' +
    'model predicts rates, not raw counts — omitting it biases the IRRs.',
  apaTemplate: 'Predictor X was associated with the count, IRR={irr}, 95% CI [{ciLow}, {ciHigh}], p={p}.',
  rMap: 'glm(family=poisson, offset=log(exposure)) / MASS::glm.nb() → B/SE/z/p · exp(cbind(IRR=coef(m), confint(m))) → IRR + 95% CI · performance::check_overdispersion() → dispersion',
  bundleFiles: ['table_model-fit.png', 'table_coefficients.png', 'figure_residuals.png'],
}
```

- [ ] **Step 2: Consistency test**

`src/lib/registry/poissonNegativeBinomial.consistency.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { POISSON_NEGATIVE_BINOMIAL as spec } from './poissonNegativeBinomial'
import { figuresOf } from './types'
import { strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Poisson / negative binomial</span>'), outputsHtml.indexOf('5 · Econometrics'))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Poisson / negative binomial</div>'), inputsHtml.indexOf('<div class="ttl">ARIMA / SARIMA</div>'))

describe('poisson-negative-binomial registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => c.label)))
  })
  it('numbered table captions equal the card captions', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('question, assume table note (the drawn dispersion note, card-literal), figure, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(spec.tableNote).toEqual({ kind: 'assume', text: strip(card.match(/<p class="tbl-note assume">(.*?)<\/p>/s)![1]) })
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figures![0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${spec.figures![0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('APA line equals the template with every {placeholder} as __ (Predictor X stays literal on the card)', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__')}”`)
  })
  it('bundle line EQUALS bundleFiles, names derive from table ids + figure file slug', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...figuresOf(spec).map((g) => `figure_${g.file ?? g.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + hints + constraint lines (count outcome, optional offset exposure)', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const hints = [...inCard.matchAll(/<div class="sl-hint">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label)) // 'Exposure (optional)' — styled span strips to this
    expect(hints).toEqual(spec.roles.map((r) => r.hint))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
    expect(spec.constraints.roles[0].tag).toBe('count')                       // B1 — recorded decision 6
    expect(spec.constraints.roles[2].arity).toEqual({ min: 0, max: 1 })       // optional slot never blocks
  })
  it('options equal the inputs card option strip; model is the select with the two drawn choices', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['select', 'display', 'display', 'display'])
    expect(spec.options[0]).toMatchObject({ id: 'model', choices: ['Poisson', 'negative binomial'] })
  })
  it('the model hint is the drawn config-guide sentence (cfgguide wording)', () => {
    const guide = strip(inCard.match(/<div class="cfgguide">(.*?)<\/p>/s)![1])
    expect(guide).toContain(spec.options[0].hint!)
  })
})
```

Run: `npx vitest run src/lib/registry/poissonNegativeBinomial.consistency.test.ts` → PASS. Then the mutation check (`'Model fit'` → `'Model Fit'`) → RED → restore → GREEN. Report both runs.

- [ ] **Step 3: Stats module**

`src/lib/stats/poissonNegativeBinomial.ts`:

```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface PoissonNbTerm { term: string; b: number; se: number; z: number; p: number; irr: number; irrLow: number; irrHigh: number }
export interface PoissonNbResult {
  outcome: string
  model: 'Poisson' | 'negative binomial'
  aic: number; deviance: number; dfResid: number
  dispersion: number // Poisson: check_overdispersion $dispersion_ratio (≡ hand Pearson χ²/df); NB: theta (convention 10)
  terms: PoissonNbTerm[]
  n: number; nExcluded: number
  figResidualsPng: Uint8Array<ArrayBuffer>
}

// Offset enters IN-FORMULA as offset(log(.telos_exposure)) for BOTH models (convention 11; spike-verified glm.nb
// accepts it and profile CIs converge). The exposure column gets a synthetic frame name so it can never collide
// with a predictor name. Profile CIs need suppressMessages (spike risk 7). theta from m$theta (convention 10).
const R_STATS = String.raw`
d <- data.frame(y = y)
for (i in seq_along(numnames)) d[[numnames[i]]] <- nums_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(catnames)) d[[catnames[i]]] <- factor(cats_flat[((i - 1) * n + 1):(i * n)])
rhs <- paste(prednames, collapse = ' + ')
if (has_offset) { d$.telos_exposure <- exposure; rhs <- paste(rhs, '+ offset(log(.telos_exposure))') }
m <- if (negbin) MASS::glm.nb(as.formula(paste('y ~', rhs)), data = d)
     else glm(as.formula(paste('y ~', rhs)), family = poisson, data = d)
s <- summary(m)
cf <- s$coefficients
ci <- suppressMessages(confint(m))
labs <- rownames(cf)
parent <- vapply(labs, function(t) {
  if (t == '(Intercept)') return('')
  for (cn in catnames) if (startsWith(t, cn) && nchar(t) > nchar(cn)) return(cn)
  t
}, character(1))
pretty <- vapply(seq_along(labs), function(i) {
  if (labs[i] == '(Intercept)') labs[i]
  else if (parent[i] %in% catnames) paste0(parent[i], ': ', substring(labs[i], nchar(parent[i]) + 1))
  else labs[i]
}, character(1))
terms <- lapply(seq_along(labs), function(i) list(
  term = pretty[i], b = cf[i, 1], se = cf[i, 2], z = cf[i, 3], p = cf[i, 4],
  irr = exp(cf[i, 1]), irrLow = exp(ci[i, 1]), irrHigh = exp(ci[i, 2])))
disp <- if (negbin) m$theta else as.numeric(performance::check_overdispersion(m)$dispersion_ratio)
list(aic = AIC(m), deviance = m$deviance, dfResid = m$df.residual, dispersion = disp, terms = terms, n = nrow(d))`

// Card figure: fitted vs. Pearson residuals + dashed y = 0 (spike recipe, house styling).
const R_FITRES = String.raw`
d <- data.frame(y = y)
for (i in seq_along(numnames)) d[[numnames[i]]] <- nums_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(catnames)) d[[catnames[i]]] <- factor(cats_flat[((i - 1) * n + 1):(i * n)])
rhs <- paste(prednames, collapse = ' + ')
if (has_offset) { d$.telos_exposure <- exposure; rhs <- paste(rhs, '+ offset(log(.telos_exposure))') }
m <- if (negbin) MASS::glm.nb(as.formula(paste('y ~', rhs)), data = d)
     else glm(as.formula(paste('y ~', rhs)), family = poisson, data = d)
pd <- data.frame(fitted = fitted(m), resid = residuals(m, type = 'pearson'))
print(ggplot2::ggplot(pd, ggplot2::aes(fitted, resid)) +
  ggplot2::geom_hline(yintercept = 0, colour = '#9cc2ec', linetype = 'dashed') +
  ggplot2::geom_point(colour = '#0c447c') +
  ggplot2::labs(x = 'Fitted values', y = 'Pearson residuals'))`

interface RawStats { aic: number; deviance: number; dfResid: number; dispersion: number; terms: PoissonNbTerm[]; n: number }

/** Storage-type classification (recorded decision 1): all-numeric non-missing values → linear term; else factor. */
const isNumericColumn = (data: Dataset, col: string): boolean => {
  const vals = data.rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
  return vals.length > 0 && vals.every((v) => typeof v === 'number')
}

export async function runPoissonNegativeBinomial(engine: Engine, data: Dataset, outcome: string, predictors: string[],
  exposure: string | null, model: 'Poisson' | 'negative binomial'): Promise<PoissonNbResult> {
  const numPreds = predictors.filter((c) => isNumericColumn(data, c))
  const catPreds = predictors.filter((c) => !isNumericColumn(data, c))
  // Per-test listwise (convention 15): outcome + every predictor + exposure (when assigned) complete in the same row.
  const rows = data.rows.filter((r) =>
    typeof r[outcome] === 'number' && Number.isFinite(r[outcome] as number)
    && numPreds.every((c) => typeof r[c] === 'number' && Number.isFinite(r[c] as number))
    && catPreds.every((c) => r[c] !== null && r[c] !== undefined && String(r[c]).trim() !== '')
    && (exposure === null || (typeof r[exposure] === 'number' && Number.isFinite(r[exposure] as number))))
  const nExcluded = data.rows.length - rows.length
  const n = rows.length
  const env = {
    y: rows.map((r) => r[outcome] as number),
    prednames: predictors,
    numnames: numPreds, nums_flat: numPreds.flatMap((c) => rows.map((r) => r[c] as number)),
    catnames: catPreds, cats_flat: catPreds.flatMap((c) => rows.map((r) => String(r[c]))),
    has_offset: exposure !== null,
    exposure: exposure === null ? [0] : rows.map((r) => r[exposure] as number), // [0] placeholder, never read (has_offset gates)
    negbin: model === 'negative binomial',
    n,
  }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figResidualsPng = await engine.capturePlot(R_FITRES, 600, 450, env)
  return { outcome, model, ...s, nExcluded, figResidualsPng }
}
```

- [ ] **Step 4: Stats known-answer test**

`src/lib/stats/poissonNegativeBinomial.test.ts` (spike values from `regression-spike-data/poisson-nb.csv` — all four model×offset cells, embedded verbatim):

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runPoissonNegativeBinomial } from './poissonNegativeBinomial'
import { loadRegressionFixture } from './fixtures/regression'

describe('runPoissonNegativeBinomial', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike known answers — Poisson, no exposure (complaints ~ age + group): fit, dispersion ratio, profile IRR CIs', async () => {
    const r = await runPoissonNegativeBinomial(engine, loadRegressionFixture(), 'complaints', ['age', 'group'], null, 'Poisson')
    expect(r.aic).toBeCloseTo(222.367487400, 5)
    expect(r.deviance).toBeCloseTo(87.564440000, 4)
    expect(r.dfResid).toBe(37)
    expect(r.dispersion).toBeCloseTo(2.107972385, 6) // check_overdispersion $dispersion_ratio ≡ hand Pearson χ²/df
    expect(r.terms.map((t) => t.term)).toEqual(['(Intercept)', 'age', 'group: b'])
    const [, age, grp] = r.terms
    expect(age.b).toBeCloseTo(0.010598371, 6)
    expect(age.se).toBeCloseTo(0.004845496, 6)
    expect(age.z).toBeCloseTo(2.187262248, 6)
    expect(age.p).toBeCloseTo(0.028723385, 6)
    expect(age.irr).toBeCloseTo(1.010654733, 6)
    expect(age.irrLow).toBeCloseTo(1.001083633, 6)   // profile (suppressMessages), NOT Wald
    expect(age.irrHigh).toBeCloseTo(1.020301670, 6)
    expect(grp.irr).toBeCloseTo(1.062525031, 6)
    expect(r.n).toBe(40)
    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figResidualsPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('spike known answers — Poisson WITH exposure offset (offset(log(months_observed)) in-formula)', async () => {
    const r = await runPoissonNegativeBinomial(engine, loadRegressionFixture(), 'complaints', ['age', 'group'], 'months_observed', 'Poisson')
    expect(r.aic).toBeCloseTo(202.368510500, 5)
    expect(r.deviance).toBeCloseTo(67.565463040, 5)
    expect(r.dispersion).toBeCloseTo(1.686886555, 6)
    const age = r.terms[1]
    expect(age.b).toBeCloseTo(0.013258484, 6)
    expect(age.p).toBeCloseTo(0.007042652, 6)
    expect(age.irr).toBeCloseTo(1.013346767, 6)
  }, 300_000)

  it('spike known answers — negative binomial, no exposure: dispersion cell = theta (convention 10)', async () => {
    const r = await runPoissonNegativeBinomial(engine, loadRegressionFixture(), 'complaints', ['age', 'group'], null, 'negative binomial')
    expect(r.aic).toBeCloseTo(211.223026200, 5)
    expect(r.deviance).toBeCloseTo(45.150147170, 5)
    expect(r.dfResid).toBe(37)
    expect(r.dispersion).toBeCloseTo(4.474253358, 6) // m$theta
    expect(r.terms[1].irr).toBeCloseTo(1.010798495, 6)
    expect(r.model).toBe('negative binomial')
  }, 300_000)

  it('spike known answers — negative binomial WITH exposure: theta + profile IRR CIs (glm.nb in-formula offset)', async () => {
    const r = await runPoissonNegativeBinomial(engine, loadRegressionFixture(), 'complaints', ['age', 'group'], 'months_observed', 'negative binomial')
    expect(r.aic).toBeCloseTo(200.096113400, 5)
    expect(r.deviance).toBeCloseTo(45.810830490, 5)
    expect(r.dispersion).toBeCloseTo(9.000773027, 5) // theta
    const age = r.terms[1]
    expect(age.p).toBeCloseTo(0.034619623, 6)
    expect(age.irr).toBeCloseTo(1.013285719, 6)
    expect(age.irrLow).toBeCloseTo(1.001024427, 6)
    expect(age.irrHigh).toBeCloseTo(1.025753033, 6)
  }, 300_000)
})
```

Run: `npx vitest run src/lib/stats/poissonNegativeBinomial.test.ts` (FOREGROUND, long timeout — boots an engine; four model fits, 4–7 min) → PASS.

- [ ] **Step 5: Builder + test**

`src/lib/results/buildPoissonNegativeBinomial.ts`:

```ts
import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { PoissonNbResult } from '../stats/poissonNegativeBinomial'
import type { CardContent } from './builders'
import { f, fdf, fp } from '../format/apa'

export function buildPoissonNegativeBinomial(spec: TestSpec, r: PoissonNbResult): CardContent {
  // Convention 10 / recorded decision 10: the Dispersion cell carries the Pearson ratio (Poisson) or theta (NB) —
  // same drawn column either way; the card-literal note explains the swap.
  const coefRows = r.terms.map((x) => ({
    term: x.term, b: f(x.b), se: f(x.se), z: f(x.z), p: fp(x.p),
    irr: f(x.irr), ci: `[${f(x.irrLow)}, ${f(x.irrHigh)}]`,
  }))
  const first = r.terms.find((x) => x.term !== '(Intercept)')! // APA "Predictor X" = first coefficient row (recorded decision 3)
  const apa = spec.apaTemplate
    .replace('Predictor X', `Predictor ${first.term}`)
    .replace('{irr}', f(first.irr))
    .replace('{ciLow}', f(first.irrLow)).replace('{ciHigh}', f(first.irrHigh))
    .replace('p={p}', first.p < 0.001 ? 'p<.001' : `p=${fp(first.p)}`)
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: [{ aic: f(r.aic), dev: f(r.deviance), df: fdf(r.dfResid), dispersion: f(r.dispersion) }] },
      { spec: spec.tables[1], rows: coefRows },
    ],
    note: spec.tableNote ?? null, // card-literal/static (convention 10)
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figResidualsPng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
```

`src/lib/results/buildPoissonNegativeBinomial.test.ts` (spike values in, rendered 2dp out — the offset-model cells the journey asserts):

```ts
import { describe, it, expect } from 'vitest'
import { buildPoissonNegativeBinomial } from './buildPoissonNegativeBinomial'
import { POISSON_NEGATIVE_BINOMIAL } from '../registry/poissonNegativeBinomial'
import type { PoissonNbResult } from '../stats/poissonNegativeBinomial'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
// The spike's pinned numbers (poisson-nb.csv, pooff_ keys — Poisson with offset).
const poisson: PoissonNbResult = { outcome: 'complaints', model: 'Poisson',
  aic: 202.368510500, deviance: 67.565463040, dfResid: 37, dispersion: 1.686886555,
  terms: [
    { term: '(Intercept)', b: -1.463347276, se: 0.234537250, z: -6.239295777, p: 4.395451914e-10, irr: 0.231460215, irrLow: 0.145023055, irrHigh: 0.363902957 },
    { term: 'age', b: 0.013258484, se: 0.004919987, z: 2.694820707, p: 0.007042652, irr: 1.013346767, irrLow: 1.003600186, irrHigh: 1.023164956 },
    { term: 'group: b', b: 0.173785589, se: 0.139443640, z: 1.246278344, p: 0.212662225, irr: 1.189800432, irrLow: 0.903978021, irrHigh: 1.562820565 },
  ],
  n: 40, nExcluded: 0, figResidualsPng: png }
// nboff_ keys — negative binomial with offset: the Dispersion cell carries theta.
const negbin: PoissonNbResult = { ...poisson, model: 'negative binomial',
  aic: 200.096113400, deviance: 45.810830490, dispersion: 9.000773027,
  terms: [
    { term: '(Intercept)', b: -1.468307103, se: 0.293799781, z: -4.997645325, p: 5.803459981e-7, irr: 0.230315055, irrLow: 0.129237738, irrHigh: 0.406340052 },
    { term: 'age', b: 0.013198238, se: 0.006246859, z: 2.112779763, p: 0.034619623, irr: 1.013285719, irrLow: 1.001024427, irrHigh: 1.025753033 },
    { term: 'group: b', b: 0.182543786, se: 0.177552067, z: 1.028114113, p: 0.303896153, irr: 1.200266705, irrLow: 0.847592634, irrHigh: 1.699016754 },
  ] }

describe('buildPoissonNegativeBinomial', () => {
  it('Poisson: Dispersion cell = Pearson ratio; coefficient rows with IRR + profile CI', () => {
    const c = buildPoissonNegativeBinomial(POISSON_NEGATIVE_BINOMIAL, poisson)
    expect(c.tables[0].rows).toEqual([{ aic: '202.37', dev: '67.57', df: '37', dispersion: '1.69' }])
    expect(c.tables[1].rows[1]).toEqual({ term: 'age', b: '0.01', se: '0.00', z: '2.69', p: '.007', irr: '1.01', ci: '[1.00, 1.02]' })
    expect(c.tables[1].rows[0]).toMatchObject({ term: '(Intercept)', b: '−1.46', z: '−6.24', p: '<.001' })
    expect(c.note).toEqual(POISSON_NEGATIVE_BINOMIAL.tableNote) // card-literal/static
  })
  it('negative binomial: the SAME Dispersion cell carries theta (convention 10 / recorded decision 10)', () => {
    const c = buildPoissonNegativeBinomial(POISSON_NEGATIVE_BINOMIAL, negbin)
    expect(c.tables[0].rows).toEqual([{ aic: '200.10', dev: '45.81', df: '37', dispersion: '9.00' }])
    expect(c.tables[1].rows[2]).toEqual({ term: 'group: b', b: '0.18', se: '0.18', z: '1.03', p: '.304', irr: '1.20', ci: '[0.85, 1.70]' })
  })
  it('APA: card-literal wording, Predictor X = first coefficient row', () => {
    expect(buildPoissonNegativeBinomial(POISSON_NEGATIVE_BINOMIAL, poisson).apa)
      .toBe('Predictor age was associated with the count, IRR=1.01, 95% CI [1.00, 1.02], p=.007.')
  })
})
```

Run: `npx vitest run src/lib/results/buildPoissonNegativeBinomial.test.ts` → PASS.

- [ ] **Step 6: Gates + commit**

Run: `npx tsc -b` → 0; all three own test files green.

```bash
git add src/lib/registry/poissonNegativeBinomial.ts src/lib/registry/poissonNegativeBinomial.consistency.test.ts src/lib/stats/poissonNegativeBinomial.ts src/lib/stats/poissonNegativeBinomial.test.ts src/lib/results/buildPoissonNegativeBinomial.ts src/lib/results/buildPoissonNegativeBinomial.test.ts
git commit -m "feat(regression): poisson-negative-binomial — registry+consistency, stats (glm/glm.nb + in-formula offset + theta vs dispersion ratio, spike-verified ×4), builder"
```

---

### Task 10: Integration [serial, main]

**Files:**
- Modify: `src/lib/registry/catalog.ts` (4 entries → available; SPECS map)
- Modify: `src/lib/results/builders.ts` (4 RUNNERS + 4 BUILDERS)
- Modify: `src/lib/registry/catalog.consistency.test.ts` (available list + Regression figure-name assertion)
- Modify: `src/state/session.test.ts` (level-select + exposure-gate behavioral tests — deferred from Tasks 2/3 because they need a shipped spec)

- [ ] **Step 1: Merge the four worktree branches**

```bash
git merge reg/simple-linear-regression reg/multiple-linear-regression reg/logistic-regression reg/poisson-negative-binomial
git worktree remove ../telos-wt-simple-linear-regression  # …and the other three
git branch -d reg/simple-linear-regression reg/multiple-linear-regression reg/logistic-regression reg/poisson-negative-binomial
```

(Each branch touches only its own new files — merges must be clean; if not, STOP and inspect.)

- [ ] **Step 2: Catalog flip + SPECS**

`src/lib/registry/catalog.ts` — the four `e()` entries gain `'available'` (no subfamily in this family):

```ts
  e('simple-linear-regression', 'Simple linear regression', 'Regression & prediction', undefined, 'available'),
  e('multiple-linear-regression', 'Multiple linear regression', 'Regression & prediction', undefined, 'available'),
  e('logistic-regression', 'Logistic regression', 'Regression & prediction', undefined, 'available'),
  e('poisson-negative-binomial', 'Poisson / negative binomial', 'Regression & prediction', undefined, 'available'),
```

and the SPECS map gains (imports at top with the existing block, entries appended in catalog order):

```ts
import { SIMPLE_LINEAR_REGRESSION } from './simpleLinearRegression'
import { MULTIPLE_LINEAR_REGRESSION } from './multipleLinearRegression'
import { LOGISTIC_REGRESSION } from './logisticRegression'
import { POISSON_NEGATIVE_BINOMIAL } from './poissonNegativeBinomial'
…
  [SIMPLE_LINEAR_REGRESSION.id]: SIMPLE_LINEAR_REGRESSION, [MULTIPLE_LINEAR_REGRESSION.id]: MULTIPLE_LINEAR_REGRESSION,
  [LOGISTIC_REGRESSION.id]: LOGISTIC_REGRESSION, [POISSON_NEGATIVE_BINOMIAL.id]: POISSON_NEGATIVE_BINOMIAL,
```

- [ ] **Step 3: RUNNERS + BUILDERS**

`src/lib/results/builders.ts` (imports follow the existing block style):

```ts
import { runSimpleLinearRegression, type SimpleLinearResult } from '../stats/simpleLinearRegression'
import { buildSimpleLinearRegression } from './buildSimpleLinearRegression'
import { runMultipleLinearRegression, type MultipleLinearResult } from '../stats/multipleLinearRegression'
import { buildMultipleLinearRegression } from './buildMultipleLinearRegression'
import { runLogisticRegression, type LogisticResult } from '../stats/logisticRegression'
import { buildLogisticRegression } from './buildLogisticRegression'
import { runPoissonNegativeBinomial, type PoissonNbResult } from '../stats/poissonNegativeBinomial'
import { buildPoissonNegativeBinomial } from './buildPoissonNegativeBinomial'
```

RUNNERS entries:

```ts
  'simple-linear-regression': (engine, ds, setup) =>
    runSimpleLinearRegression(engine, ds, setup.roles['outcome'][0], setup.roles['predictor'][0]),
  'multiple-linear-regression': (engine, ds, setup) =>
    runMultipleLinearRegression(engine, ds, setup.roles['outcome'][0], setup.roles['predictors'], setup.options['standardize'] as boolean),
  'logistic-regression': (engine, ds, setup) =>
    runLogisticRegression(engine, ds, setup.roles['outcome'][0], setup.roles['predictors'], String(setup.options['event']), setup.options['reportOR'] as boolean),
  'poisson-negative-binomial': (engine, ds, setup) =>
    runPoissonNegativeBinomial(engine, ds, setup.roles['outcome'][0], setup.roles['predictors'], setup.roles['exposure'][0] ?? null, setup.options['model'] as 'Poisson' | 'negative binomial'),
```

BUILDERS entries:

```ts
  'simple-linear-regression': (spec, result) => buildSimpleLinearRegression(spec, result as SimpleLinearResult),
  'multiple-linear-regression': (spec, result) => buildMultipleLinearRegression(spec, result as MultipleLinearResult),
  'logistic-regression': (spec, result) => buildLogisticRegression(spec, result as LogisticResult),
  'poisson-negative-binomial': (spec, result) => buildPoissonNegativeBinomial(spec, result as PoissonNbResult),
```

- [ ] **Step 4: catalog.consistency.test.ts**

1. The available-ids assertion gains, after `'fishers-exact'`: `'simple-linear-regression', 'multiple-linear-regression', 'logistic-regression', 'poisson-negative-binomial'`.
2. New assertion alongside the ANOVA/Association figure-name ones:

```ts
  it('Regression-family zip figure names derive from FigureSpec.file ?? type and equal the card bundle entries', () => {
    for (const id of ['simple-linear-regression', 'multiple-linear-regression', 'logistic-regression', 'poisson-negative-binomial']) {
      const s = SPECS[id]!
      expect(s.figures!.map((f) => `figure_${f.file ?? f.type}.png`)).toEqual(s.bundleFiles.filter((b) => b.startsWith('figure_')))
    }
  })
```

(The existing DOM-id uniqueness test now covers the four new registries automatically — all four draw `model-fit` + `coefficients`, decoupled via the per-test `domId`s; it must stay green.)

- [ ] **Step 5: session.test.ts — the deferred B1/B2 behavioral tests**

Append to `src/state/session.test.ts` (now that the specs are registered; columns chosen so columnMeta auto-derives cleanly — values deliberately NON-consecutive so the id-tag heuristic never fires):

```ts
describe('level-select option kind (B2 — needs the shipped logistic spec)', () => {
  const lds: Dataset = { columns: ['passed', 'pre'], rows: [
    { passed: 'no', pre: 10 }, { passed: 'yes', pre: 20 }, { passed: 'no', pre: 15 },
  ] }
  beforeEach(() => {
    useSession.getState().reset()
    useSession.getState().loadDataset(lds, { name: 'x.csv', rows: 3, cols: 2, encoding: 'UTF-8' })
    useSession.getState().visitGuide()
    useSession.getState().toggleSelection('logistic-regression')
  })
  it('initialises empty, defaults to the SECOND level on outcome assignment, clears on unassign', () => {
    expect(useSession.getState().setups['logistic-regression'].options['event']).toBe('')
    useSession.getState().addRole('logistic-regression', 'outcome', 'passed')
    expect(useSession.getState().setups['logistic-regression'].options['event']).toBe('yes') // second alphabetically
    useSession.getState().setOption('logistic-regression', 'event', 'no')
    useSession.getState().removeRole('logistic-regression', 'outcome', 'passed')
    expect(useSession.getState().setups['logistic-regression'].options['event']).toBe('')
  })
  it('reassignment resets a user-changed choice to the default; OTHER-role edits never touch it', () => {
    useSession.getState().addRole('logistic-regression', 'outcome', 'passed')
    useSession.getState().setOption('logistic-regression', 'event', 'no')
    useSession.getState().addRole('logistic-regression', 'predictors', 'pre')
    expect(useSession.getState().setups['logistic-regression'].options['event']).toBe('no') // predictor edit: untouched
    useSession.getState().removeRole('logistic-regression', 'outcome', 'passed')
    useSession.getState().addRole('logistic-regression', 'outcome', 'passed')
    expect(useSession.getState().setups['logistic-regression'].options['event']).toBe('yes') // back to the default
  })
  it('gateOk blocks while the stored level is not a live category of the assigned column', () => {
    useSession.getState().addRole('logistic-regression', 'outcome', 'passed')
    useSession.getState().addRole('logistic-regression', 'predictors', 'pre')
    expect(gateOk(useSession.getState(), 'test:logistic-regression')).toBe(true)
    useSession.getState().setOption('logistic-regression', 'event', 'maybe')
    expect(gateOk(useSession.getState(), 'test:logistic-regression')).toBe(false)
  })
})

describe('poisson exposure run gate (B1/convention 11 — needs the shipped poisson spec)', () => {
  const pds: Dataset = { columns: ['complaints', 'age', 'months'], rows: [
    { complaints: 3, age: 20, months: 5 }, { complaints: 0, age: 30, months: 0 }, { complaints: 5, age: 40, months: 7 },
  ] }
  beforeEach(() => {
    useSession.getState().reset()
    useSession.getState().loadDataset(pds, { name: 'p.csv', rows: 3, cols: 3, encoding: 'UTF-8' })
    useSession.getState().visitGuide()
    useSession.getState().toggleSelection('poisson-negative-binomial')
    useSession.getState().addRole('poisson-negative-binomial', 'outcome', 'complaints') // count-tagged int column
    useSession.getState().addRole('poisson-negative-binomial', 'predictors', 'age')
  })
  it('without an exposure the gate passes; an exposure containing 0 blocks (log offset undefined)', () => {
    expect(gateOk(useSession.getState(), 'test:poisson-negative-binomial')).toBe(true)
    useSession.getState().addRole('poisson-negative-binomial', 'exposure', 'months')
    expect(gateOk(useSession.getState(), 'test:poisson-negative-binomial')).toBe(false)
    useSession.getState().removeRole('poisson-negative-binomial', 'exposure', 'months')
    expect(gateOk(useSession.getState(), 'test:poisson-negative-binomial')).toBe(true)
  })
})
```

Run: `npx vitest run src/state/session.test.ts` → PASS.

- [ ] **Step 6: Full gates (FOREGROUND, long timeouts)**

Run: `npx tsc -b` → 0. Run: `npm test` (full serialized suite, **expect ~8–15 min** — run it patiently in the foreground or let the orchestrator run it) → ALL green. Run: `npm run build` → green. Run: `npx playwright test` → existing e2e green and byte-untouched.

- [ ] **Step 7: Commit**

```bash
git add src/lib/registry/catalog.ts src/lib/results/builders.ts src/lib/registry/catalog.consistency.test.ts src/state/session.test.ts
git commit -m "feat(regression): integrate 4 tests — catalog available, runners+builders registered, figure-name + domId assertions, level-select + exposure-gate session tests"
```

---

### Task 11: E2E journey [serial, main]

**Files:**
- Create: `tests/e2e/regression.spec.ts`
- (Fixture `tests/e2e/fixtures/regression.csv` landed in Task 5.)

One new Playwright test; existing journeys stay byte-untouched. Two runs total: run 1 with the drawn defaults (standardize OFF → em-dash β asserted FIRST; event = auto-defaulted `yes`; model Poisson) and run 2 after flipping all three (standardize ON → β fills; event `no` → OR inverts, AUC does NOT change; model negative binomial → theta). All rendered numbers are the spike values through the house 2dp/`fp` formatting. Em-dash/minus characters in assertions are U+2014 `—` / U+2212 `−`.

- [ ] **Step 1: Write the journey**

`tests/e2e/regression.spec.ts` — copy the module-local helpers (`dragChip`, `configureStep`, `runAnalysis`) **byte-identical** from `tests/e2e/association.spec.ts` (race-hardened, nav-scoped — established convention). One test:

```ts
test('Journey: regression — simple, multiple (β em-dash→fill), logistic (event flip inverts OR, AUC invariant), Poisson→NB (theta)', async ({ page }) => {
  // ── 1. Upload & Terms guide ──
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/regression.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  // ── 2. Configure data: defaults are fine (numerics ratio, strings nominal; complaints auto-tags count) ──
  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  // ── 3. Pick tests (catalog order) ──
  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  for (const name of ['Simple linear regression', 'Multiple linear regression', 'Logistic regression', 'Poisson / negative binomial'])
    await page.getByRole('checkbox', { name }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  // ── 4. Configure: Simple linear — post_score → outcome, pre_score → predictor ──
  await expect(page.locator('.eyebrow').first()).toContainText('Simple linear regression')
  await dragChip(page, 'post_score', 'outcome')
  await expect(page.locator('[data-role="outcome"]')).toContainText('post_score')
  await dragChip(page, 'pre_score', 'predictor')
  await expect(page.locator('[data-role="predictor"]')).toContainText('pre_score')

  // ── Configure: Multiple linear — standardize stays drawn-OFF ──
  await configureStep(page, /Multiple linear regression/, [
    ['post_score', 'outcome'],
    ['pre_score', 'predictors'],
    ['age', 'predictors'],
    ['group', 'predictors'],
    ['method', 'predictors'],
  ])

  // ── Configure: Logistic — event-category pill is the disabled — placeholder until the outcome drops, then defaults to the SECOND level ──
  await expect(async () => {
    await page.getByRole('navigation', { name: 'Progress' }).getByRole('button', { name: /Logistic regression/ }).click()
    await expect(page.locator('.eyebrow').first()).toHaveText(/Logistic regression/, { timeout: 1000 })
  }).toPass()
  await expect(page.getByLabel('event category')).toBeDisabled() // placeholder state (recorded decision 5)
  await dragChip(page, 'passed', 'outcome')
  await expect(page.locator('[data-role="outcome"]')).toContainText('passed')
  await expect(page.getByLabel('event category')).toBeEnabled()
  await expect(page.getByLabel('event category')).toHaveValue('yes') // second level alphabetically (B2)
  await dragChip(page, 'pre_score', 'predictors')
  await expect(page.locator('[data-role="predictors"]')).toContainText('pre_score')
  await dragChip(page, 'age', 'predictors')
  await expect(page.locator('[data-role="predictors"]')).toContainText('age')
  await dragChip(page, 'group', 'predictors')
  await expect(page.locator('[data-role="predictors"]')).toContainText('group')

  // ── Configure: Poisson / NB — count outcome + optional Exposure slot; model stays drawn Poisson ──
  await configureStep(page, /Poisson \/ negative binomial/, [
    ['complaints', 'outcome'],
    ['age', 'predictors'],
    ['group', 'predictors'],
    ['months_observed', 'exposure'],
  ])

  // ── 5. Run 1 (drawn defaults); wait for Download enabled ──
  await runAnalysis(page)
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 360_000 })

  // ── 6. Run-1 assertions (spike numbers, house 2dp) ──

  // Simple linear: fit R²=0.66, F=73.57, p<.001, SE(sigma)=5.61; coefficients B=0.64, β=0.81 (always filled — no standardize pill)
  const slFit = page.locator('#table-simple-linear-model-fit')
  await expect(slFit).toContainText('0.66')
  await expect(slFit).toContainText('73.57')
  await expect(slFit).toContainText('<.001')
  await expect(slFit).toContainText('5.61')
  const slCoef = page.locator('#table-simple-linear-coefficients')
  await expect(slCoef).toContainText('0.64')
  await expect(slCoef).toContainText('0.81')
  await expect(page.getByText('The predictor significantly predicted the outcome, B=0.64, t(38)=8.58, p<.001, R²=0.66.')).toBeVisible()

  // Multiple linear: standardize OFF → β cells are em-dash (asserted FIRST, before the flip); VIF filled (GVIF convention)
  const mlCoef = page.locator('#table-multiple-linear-coefficients')
  await expect(mlCoef).toContainText('—')        // the masked β cells (R1 off-state)
  await expect(mlCoef).toContainText('1.25')     // VIF pre_score AND (GVIF^(1/(2·Df)))² for method
  await expect(mlCoef).toContainText('1.41')     // VIF age
  await expect(mlCoef).toContainText('5.35')     // B group: b
  await expect(mlCoef).toContainText('group: b') // dummy-row naming (convention 1)
  await expect(mlCoef).toContainText('−2.05')    // B method: online — U+2212 minus
  await expect(page.locator('#table-multiple-linear-model-fit')).toContainText('20.42')
  await expect(page.getByText('The model explained R²=0.75 of the variance, F(5,34)=20.42, p<.001; predictor pre_score was significant, B=0.61, p<.001.')).toBeVisible()

  // Logistic (event yes): fit −2LL=45.91, Nagelkerke=0.28, omnibus 9.54/.023; OR group: b = 3.46 [0.87, 15.44]; classification 65.0%; AUC in APA
  const lgFit = page.locator('#table-logistic-model-fit')
  await expect(lgFit).toContainText('45.91')
  await expect(lgFit).toContainText('53.91')
  await expect(lgFit).toContainText('0.28')
  await expect(lgFit).toContainText('9.54')
  await expect(lgFit).toContainText('.023')
  const lgCoef = page.locator('#table-logistic-coefficients')
  await expect(lgCoef).toContainText('3.46')
  await expect(lgCoef).toContainText('[0.87, 15.44]')
  const lgClass = page.locator('#table-classification')
  await expect(lgClass).toContainText('no')      // real level names as headers (convention 7)
  await expect(lgClass).toContainText('yes')
  await expect(lgClass).toContainText('65.0%')
  await expect(page.getByText('Predictor pre_score was associated with the outcome, OR=1.08, 95% CI [1.01, 1.18], p=.035 (AUC=0.76).')).toBeVisible()

  // Poisson (offset model): AIC=202.37, deviance=67.57, df=37, dispersion ratio=1.69; IRR age = 1.01
  const poFit = page.locator('#table-poisson-nb-model-fit')
  await expect(poFit).toContainText('202.37')
  await expect(poFit).toContainText('67.57')
  await expect(poFit).toContainText('37')
  await expect(poFit).toContainText('1.69')
  await expect(page.getByText('Predictor age was associated with the count, IRR=1.01, 95% CI [1.00, 1.02], p=.007.')).toBeVisible()

  // ── 7. Flip all three config switches (each edit stales ALL runs — journey-B rule), then re-run once ──
  await expect(async () => {
    await page.getByRole('navigation', { name: 'Progress' }).getByRole('button', { name: /Multiple linear regression/ }).click()
    await expect(page.locator('.eyebrow').first()).toHaveText(/Multiple linear regression/, { timeout: 1000 })
  }).toPass()
  await page.getByLabel(/standardize/).check()
  await expect(async () => {
    await page.getByRole('navigation', { name: 'Progress' }).getByRole('button', { name: /Logistic regression/ }).click()
    await expect(page.locator('.eyebrow').first()).toHaveText(/Logistic regression/, { timeout: 1000 })
  }).toPass()
  await page.getByLabel('event category').selectOption('no')
  await expect(async () => {
    await page.getByRole('navigation', { name: 'Progress' }).getByRole('button', { name: /Poisson \/ negative binomial/ }).click()
    await expect(page.locator('.eyebrow').first()).toHaveText(/Poisson \/ negative binomial/, { timeout: 1000 })
  }).toPass()
  await page.getByLabel('model').selectOption('negative binomial')
  await runAnalysis(page)
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 360_000 })

  // ── 8. Run-2 assertions ──

  // Multiple linear: standardize ON → β fills (R1)
  await expect(page.locator('#table-multiple-linear-coefficients')).toContainText('0.78')   // β pre_score
  await expect(page.locator('#table-multiple-linear-coefficients')).toContainText('−0.22')  // β method: online

  // Logistic (event no): OR group: b INVERTS to 0.29 [0.06, 1.15]; fit row AND AUC INVARIANT (spike surprise 4 — NOT 1−AUC)
  await expect(page.locator('#table-logistic-coefficients')).toContainText('0.29')
  await expect(page.locator('#table-logistic-coefficients')).toContainText('[0.06, 1.15]')
  await expect(page.locator('#table-logistic-model-fit')).toContainText('45.91')
  await expect(page.getByText('Predictor pre_score was associated with the outcome, OR=0.92, 95% CI [0.85, 0.99], p=.035 (AUC=0.76).')).toBeVisible()

  // Negative binomial (offset): theta replaces the dispersion ratio in the SAME cell (convention 10)
  const nbFit = page.locator('#table-poisson-nb-model-fit')
  await expect(nbFit).toContainText('200.10')
  await expect(nbFit).toContainText('45.81')
  await expect(nbFit).toContainText('9.00')

  // ── 9. Download & unzip — assert the exact 14-file path set (NN = selection order; card-faithful names) ──
  await page.getByRole('checkbox', { name: /Table images/ }).check()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('telos-results.zip')
  const entries = Object.keys(unzipSync(new Uint8Array(readFileSync((await download.path())!)))).sort()

  // 01_simple-linear-regression: 4 files (two figures from one drawn figbox)
  expect(entries).toContain('01_simple-linear-regression/table_model-fit.png')
  expect(entries).toContain('01_simple-linear-regression/table_coefficients.png')
  expect(entries).toContain('01_simple-linear-regression/figure_fit.png')
  expect(entries).toContain('01_simple-linear-regression/figure_residuals.png')

  // 02_multiple-linear-regression: 3 files
  expect(entries).toContain('02_multiple-linear-regression/table_model-fit.png')
  expect(entries).toContain('02_multiple-linear-regression/table_coefficients.png')
  expect(entries).toContain('02_multiple-linear-regression/figure_residuals.png')

  // 03_logistic-regression: 4 files
  expect(entries).toContain('03_logistic-regression/table_model-fit.png')
  expect(entries).toContain('03_logistic-regression/table_coefficients.png')
  expect(entries).toContain('03_logistic-regression/table_classification.png')
  expect(entries).toContain('03_logistic-regression/figure_roc.png')

  // 04_poisson-negative-binomial: 3 files
  expect(entries).toContain('04_poisson-negative-binomial/table_model-fit.png')
  expect(entries).toContain('04_poisson-negative-binomial/table_coefficients.png')
  expect(entries).toContain('04_poisson-negative-binomial/figure_residuals.png')
  expect(entries.filter((e) => /^0[1-4]_/.test(e)).length).toBe(14)
})
```

Implementation notes for the agent: imports mirror `association.spec.ts` (`test, expect, type Page` from `@playwright/test`; `readFileSync` from `node:fs`; `unzipSync` from `fflate`). If the standardize toggle's accessible name differs from `/standardize/` (it renders as a labeled checkbox pill `standardize (off)`), use the label text the DOM actually exposes — the assertion contract (em-dash before, `0.78` after) is what matters. The two zip-figure files for simple linear and the `table_classification.png` name are card-bundle-faithful and load-bearing — do not rename.

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/regression.spec.ts` (FOREGROUND, long timeout — two full WebR runs, expect 5–10 min) → green. Then the FULL e2e suite: `npx playwright test` → all green, existing journeys byte-untouched.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/regression.spec.ts
git commit -m "test(regression): e2e journey — 4 tests, β em-dash→fill, OR inversion on event switch (AUC invariant), NB theta, 14-file zip"
```

---

### Task 12: Combined slice-end review [serial, main]

- [ ] **Step 1: Dispatch ONE opus reviewer over the whole slice diff** (`git diff BASE..HEAD`), with the spec + this plan as context. Brief: (a) card-faithfulness — every registry string vs the live (amended) spec HTML, including the three Task-1 amendments; (b) statistical correctness — independently recompute each test's headline numbers in native R 4.6.0 from `tests/e2e/fixtures/regression.csv` (lm fit + β refit, GVIF convention, logistic under BOTH event categories incl. the hand classification table and pROC AUC, Poisson + NB ±offset incl. dispersion ratio and theta); (c) the spec §3 conventions 1–15 and this plan's recorded decisions 1–14 honored; (d) code quality / dead code / type safety; (e) UI spot-check of the novel machinery (drive `npm run preview` with Playwright: count column gates the Poisson outcome slot with the readable reason; event-category choices appear on drop, reset on reassignment, chosen level reaches R and flips the OR; exposure-zero gate hint).
- [ ] **Step 2: Triage findings** — fix blockers/majors, record minors for the ratify list. Re-run full gates after any fix (`npx tsc -b`, `npm test`, `npm run build`, `npx playwright test`).
- [ ] **Step 3: Commit fixes** (if any): `fix(regression): slice-end review findings — <summary>`

---

### Task 13: Finalize — README, ROADMAP, screenshots, STOP at Benjie's gate [serial, main]

- [ ] **Step 1: README truth-update** — live-test count 25 → **29** (47-card tree unchanged; the step-5 sentence gains "and the Regression family (simple linear, multiple linear, logistic, Poisson / negative binomial)"); the preload note "ten R packages … The Association slice adds no packages." becomes **thirteen** R packages with `pROC, parameters, performance` appended to the list (drop the stale Association sentence); update the file/test counts to the REAL totals **at this commit** (`git ls-files src tests | wc -l` for files; the final `npm test` summary line for tests — "real total" rule, core-slice precedent; do NOT copy counts from this plan).
- [ ] **Step 2: ROADMAP** — move the Regression row to Done: `| Regression & prediction — 4 tests live (simple linear, multiple linear, logistic incl. event-category level-select (B2), Poisson/negative binomial incl. count-tag gate (B1) + exposure offset); pROC/parameters/performance preloaded | 2026-06-13 | specs+plans/2026-06-12-telos-regression-family*, spike reviews/2026-06-12-regression-spike-report.md |` and drop slice 1 from Remaining (renumber).
- [ ] **Step 3: Screenshots** — refresh `.superpowers/screens/`: `pick-tests.png` (29 live), `test-config-logistic-event.png` (the event-category pill populated with the outcome's levels), `results-regression-multi.png` (the 4-card results page). Drive the production preview (`npm run build && npm run preview`) with Playwright; visually verify each shot before claiming it.
- [ ] **Step 4: Final gates ×2** — `npx tsc -b` 0 · full `npm test` green (~8–15 min, foreground) · `npm run build` green · `npx playwright test` green TWICE consecutively. Fresh-clone proof: clone to /tmp, `npm install` (postinstall VFS copy), `npx tsc -b`, full `npm test`, `npm run build` — then DELETE the clone.
- [ ] **Step 5: Commit** — `docs(regression): README 47 tree / 29 live, real counts, preload list +pROC/parameters/performance; ROADMAP Regression slice done`
- [ ] **Step 6: STOP at Benjie's click-through gate.** Assemble and report: gates evidence (both runs), screenshots, the preview URL, and the **ratify list** — the spec's 15 recorded conventions (§3), this plan's recorded decisions 1–14 (incl. the three Task-1 spec amendments), plus anything discovered during the build or the review. **DO NOT push. DO NOT deploy. Both are Benjie's calls alone.**
