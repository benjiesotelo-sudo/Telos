# Telos Core Tests Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Light up 7 more tests end-to-end in the finished shell — Summary statistics, Frequencies & cross-tabs, Distribution & normality, One-sample t-test, Paired t-test, Mann-Whitney U, Wilcoxon signed-rank — per the approved spec `docs/superpowers/specs/2026-06-11-telos-core-tests-1-design.md`, including the first real multi-test journey.

**Architecture:** Approach A (Benjie's ruling): shared result **chassis** + per-test **builders**. The registry keeps holding card content verbatim (consistency-tested per card, both spec files); per-test stats modules run the cards' pinned R functions in the proven WebR engine with cross-verified known-answer tests; `RUNNERS`/`BUILDERS` maps replace the store's hardcoded t-test call.

**Tech Stack additions:** R packages installed at engine init from the WebR repo (all spike-verified working under WebR 0.6.0 / R 4.6.0): `nortest` (1.6s), `effectsize` (13.2s), `coin` (28.2s), `janitor` (31.0s), `psych` (7.2s) — alongside the existing ggplot2.

**Process:** directly on `main` (standing ruling); subagent-driven; Benjie decides every push point. **NEVER push.**

**Known answers:** every asserted statistic in this plan was computed independently in BOTH the app's WebR engine (R 4.6.0 wasm) and native R 4.6.0 — identical to all reported digits (spike `wf_fe92c580-dcb`; values archived in the plan tasks themselves).

**Spike-discovered facts the plan encodes (do not "fix" these):**
1. **R 4.6.0 computes EXACT Wilcoxon p-values even with ties** (both environments verified; method string stays "…exact test", V can be non-integer midrank, no warning). Default runs use R's default path (exact at these N). The **continuity-correction toggle maps to `correct=` and matters only on the asymptotic path**, so its known-answer tests pass `exact=FALSE` explicitly. The Z column always comes from `coin` (asymptotic, equals `exact=FALSE, correct=FALSE` p) per the cards' R maps — a card-specified mix of exact p and asymptotic Z in one row.
2. **One-sample `t.test` conf.int is the CI of the MEAN.** The card's Table 2 pairs `95% CI` with `M_diff` and the how-to-read says the CI shows "by how much" — so the rendered CI is the **difference CI = conf.int − μ₀** (recorded decision; for μ₀=0 they coincide).
3. **`psych::describe` default type=3** (Joanes & Gill b-family; kurtosis is EXCESS). This differs from SPSS's G1/G2 — faithful to the card's R map; noted for Benjie's awareness. **Never call `describeBy(vector, g)`** (treats the vector as factor codes — garbage); describe per-subset data.frame and extract numeric columns, never parse printed output.
4. **`janitor::tabyl` orders categories alphabetically** and emits proportions 0–1 (×100 for display); cumulative % via `cumsum` over that order; cross-tab percentages via `adorn_percentages` with `adorn_totals(c('row','col'))`.
5. **Factors must be `as.character()`-ed before `.telos_json`**; the serializer caps at 10 significant figures (ample for 2-3dp display).
6. `effectsize::cohens_d(x, y, paired=TRUE)` prints an advisory *message* (not a warning) — harmless; `captureR` keeps it off stdout.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/webr/engine.ts` | MODIFY: init installs the full package list with per-package status |
| `src/lib/format/apa.ts` | NEW: the locked APA formatting helpers (minus/f/f1/fdf/fp/fx), extracted from ResultPreviewCard |
| `src/lib/registry/types.ts` | MODIFY: arity ranges, `minRule`, option `kind`/`default`, `FigureSpec`, `figures?`/`tableNote?`, `figuresOf` |
| `src/lib/registry/independentTTest.ts` | MODIFY: constraints migrate to the new shapes (display strings untouched) |
| `src/lib/registry/<seven>.ts` | NEW ×7: card content verbatim + constraints (one file per test) |
| `src/lib/registry/<seven>.consistency.test.ts` | NEW ×7: card-scoped equality vs BOTH spec files + mutation checks |
| `src/lib/registry/catalog.ts` | MODIFY: `SPECS` gains the 7 entries; their `status` flips to `'available'` |
| `src/lib/eligibility/eligibility.ts` | MODIFY: arity ranges, per-kind `minRule` checks + reason strings, generalized candidate search |
| `src/lib/stats/<seven>.ts` + `.test.ts` | NEW ×7: R module + typed result + cross-verified known-answer tests |
| `src/lib/results/builders.ts` | NEW: `CardContent`/`BuiltTable`/`Runner` types + `RUNNERS`/`BUILDERS` maps |
| `src/lib/results/build<Eight>.ts` (+ tests) | NEW ×8: per-test builders (incl. the t-test's, extracted) |
| `src/state/session.ts` | MODIFY: `TestSetup.roles` become `string[]` per role; `options` record; runAll walks `RUNNERS` |
| `src/state/session.test.ts` | MODIFY: updated to the new setup shape + multi-slot gates |
| `src/components/ResultPreviewCard.tsx` | MODIFY: becomes the chassis (renders any `CardContent`) |
| `src/components/DragSlots.tsx` | MODIFY: multi-chip slots (arity ranges), per-chip remove |
| `src/components/screens/TestConfigScreen.tsx` | MODIFY: option strip renders by `kind` (display/toggle/number) |
| `src/components/screens/ResultsScreen.tsx` | MODIFY: builds `CardContent` via `BUILDERS`; export derives files from built content |
| `tests/e2e/flow.spec.ts` + `tests/e2e/fixtures/paired.csv` | MODIFY/NEW: existing journey unchanged + the multi-test journey |
| `README.md` | MODIFY: test count, first-boot package note |

## Shared contracts (FINAL shapes — every task and every imported symbol below conforms to these EXACTLY)

```ts
// src/lib/registry/types.ts — final state after Task 3
export interface ColumnDef { key: string; label: string; sub?: string }
export interface TableSpec { id: string; title: string; columns: ColumnDef[]; captionStyle?: 'bare'; domId?: string } // 'bare' renders "Table." (Summary, Distribution); default = numbered "Table N." · domId: DOM/capture id when the card-faithful id would collide on a combined results page (zip names keep id)
export interface RoleSpec { id: string; label: string; levels: string; arity: string; hint?: string } // hint: drawn helper line under the slot (design §3 — Frequencies)
export interface OptionSpec { id: string; label: string; value: string; kind: 'display' | 'toggle' | 'number'; default?: boolean | number; hint?: string } // default only for interactive kinds; hint: the card's set-it warning (design §3 — μ₀)
export type Level = 'nominal' | 'ordinal' | 'interval' | 'ratio'
export interface RoleConstraint { roleId: string; levels: Level[]; arity: { min: number; max: number }; categories?: { exact: number } } // max: Infinity allowed
export type MinRule =
  | { kind: 'rows-per-group'; n: number }   // t-test, Mann-Whitney
  | { kind: 'complete-pairs'; n: number }   // Paired t, Wilcoxon
  | { kind: 'values'; n: number }           // One-sample, Distribution
  | { kind: 'used-columns'; n: number }     // Summary, Frequencies (≥1 compatible Used column)
export interface TestConstraints { roles: RoleConstraint[]; minRule: MinRule }
export interface FigureSpec { caption: string; type: string; optional?: true }
export interface TestSpec {
  id: string; name: string; question: string
  roles: RoleSpec[]; options: OptionSpec[]; tables: TableSpec[]
  assumptionNote?: string                    // t-test only (locked); new entries use tableNote
  tableNote?: { kind: 'assume' | 'plain'; text: string } // absent = no note (Wilcoxon)
  figure?: FigureSpec                        // t-test only (locked)
  figures?: FigureSpec[]                     // new entries
  howToRead: string; apaTemplate: string; rMap: string; bundleFiles: string[]
  constraints: TestConstraints
}
export const figuresOf = (s: TestSpec): FigureSpec[] => s.figures ?? (s.figure ? [s.figure] : [])
```

```ts
// src/lib/results/builders.ts — created in Task 4; per-test tasks APPEND their RUNNERS/BUILDERS entries
import type { TestSpec, TableSpec } from '../registry/types'
import type { Engine } from '../webr/engine'
import type { Dataset } from '../stats/types'
import type { TestSetup } from '../../state/session'
export interface BuiltTable { spec: TableSpec; rows: Record<string, string | number>[] }
export interface CardContent {
  tables: BuiltTable[]
  note: { kind: 'assume' | 'plain'; text: string } | null
  figures: { caption: string; type: string; png: Uint8Array }[]
  howToRead: string
  apa: string
  nExcluded: number          // 0 = nothing to report
}
export type Runner = (engine: Engine, ds: Dataset, setup: TestSetup) => Promise<unknown>
export const RUNNERS: Record<string, Runner> = { /* filled per test task */ }
export const BUILDERS: Record<string, (spec: TestSpec, result: unknown) => CardContent> = { /* filled per test task */ }
```

```ts
// src/state/session.ts — shapes after Task 3
export interface TestSetup { roles: Record<string, string[]>; options: Record<string, boolean | number>; blocked: string | null }
// gateOk(test step) = every role's assigned count ≥ its arity.min (max is enforced at assignment time) and !blocked
// freshSetup(id): roles = each constraint roleId → []; options = each spec option with kind ≠ 'display' → its default
```

```ts
// src/lib/format/apa.ts — created in Task 2 (extracted verbatim from ResultPreviewCard)
export const minus: (s: string) => string   // ASCII '-' → U+2212
export const f: (n: number) => string       // 2 dp
export const f1: (n: number) => string      // 1 dp (APA-sentence M/SD)
export const fdf: (n: number) => string     // integer df as integer, else 2 dp
export const fp: (p: number) => string      // '<.001' floored, no leading zero
export const fx: (n: number | null, fmt: (v: number) => string) => string // null/non-finite → '—'
```

**Runtime export naming (Task 4):** the zip derives filenames from BUILT content — `table_<builtTable.spec.id>.png` for each table actually produced, `figure_<figureSpec.type>.png` for each figure actually produced — under the existing `NN_<testId>/` folder. The registry `bundleFiles` line remains the consistency-tested card text (it lists the card's full possible set; conditional tables/figures appear only when produced, per the ui-spec's "a folder or file appears only if…" rule).

---

## Task 1: Engine installs the full package list

**Files:** Modify `src/lib/webr/engine.ts`

- [ ] **Step 1: Replace the ggplot2-only install in `init()`** — change:

```ts
    onStatus?.('Loading ggplot2…')
    await this.webr.installPackages(['ggplot2'], { quiet: true })
```
to:

```ts
    // Spike-verified under WebR 0.6.0 (R 4.6.0): ggplot2 + nortest + effectsize + psych + coin + janitor all
    // install from the WebR repo. First visit pays the download (~80s Node-side total); the browser caches.
    for (const pkg of ['ggplot2', 'nortest', 'effectsize', 'psych', 'coin', 'janitor']) {
      onStatus?.(`Loading ${pkg}…`)
      await this.webr.installPackages([pkg], { quiet: true })
    }
```

- [ ] **Step 2: Verify** — `npx vitest run src/lib/webr/engine.test.ts` → 5/5 (slower first run — six package downloads, hookTimeout 300s covers it); full `npm test` 53/53; `npx tsc -b` → 0.

- [ ] **Step 3: Commit**
```bash
git add src/lib/webr/engine.ts && git commit -m "feat: engine preloads the core-tests R packages (spike-verified under WebR)"
```

---

## Task 2: Extract the APA formatting helpers

**Files:** Create `src/lib/format/apa.ts`; modify `src/components/ResultPreviewCard.tsx`

- [ ] **Step 1: Create `src/lib/format/apa.ts`** — the six helpers moved VERBATIM from ResultPreviewCard (same bytes, now exported):

```ts
export const minus = (s: string) => s.replace(/-/g, '−')                                  // U+2212, as the card typesets negatives
export const f = (n: number) => minus(n.toFixed(2))
export const f1 = (n: number) => minus(n.toFixed(1))                                      // APA-sentence M/SD, per the card
export const fdf = (n: number) => (Number.isInteger(n) ? String(n) : f(n))                // 't(58)' pooled · 't(9.68)' Welch
export const fp = (p: number) => (p < 0.001 ? '<.001' : p.toFixed(3).replace(/^0/, ''))
export const fx = (n: number | null, fmt: (v: number) => string) => (n == null || !Number.isFinite(n) ? '—' : fmt(n))
```

- [ ] **Step 2: In `src/components/ResultPreviewCard.tsx`** delete the six local helper lines and add `import { f, f1, fdf, fp, fx } from '../lib/format/apa'` (note: `minus` is only used inside the helpers — do not import it, `noUnusedLocals` would fail).

- [ ] **Step 3: Verify** — `npm test` 53/53; `npx tsc -b` → 0; `npm run e2e` → 2/2 (output numbers must be IDENTICAL — this is a pure move).

- [ ] **Step 4: Commit**
```bash
git add src/lib/format src/components/ResultPreviewCard.tsx
git commit -m "refactor: shared APA formatting helpers"
```

---

## Task 3: Registry v2 + flow generalization (atomic — types, t-test migration, eligibility, store, slots, options UI)

This task is atomic because the type changes ripple: arity ranges + options records touch the registry, eligibility, store, DragSlots and TestConfigScreen together. Everything below lands in ONE commit; `npm test` and the e2e must be green at its end with the t-test behaving identically.

**Files:** Modify `src/lib/registry/types.ts`, `src/lib/registry/independentTTest.ts`, `src/lib/eligibility/eligibility.ts`, `src/state/session.ts`, `src/state/session.test.ts`, `src/components/DragSlots.tsx`, `src/components/screens/TestConfigScreen.tsx`

- [ ] **Step 1: `src/lib/registry/types.ts`** — replace the constraint/option/figure type block with the **Shared contracts** version above (`TableSpec.captionStyle`, `OptionSpec.kind/default`, `RoleConstraint.arity {min,max}`, `MinRule`, `TestConstraints.minRule`, `FigureSpec`, `TestSpec.assumptionNote?/tableNote?/figure?/figures?`, `figuresOf`). `ColumnDef`, `RoleSpec`, and all display-string fields are unchanged.

- [ ] **Step 2: Migrate `src/lib/registry/independentTTest.ts`** (display strings byte-untouched — the consistency tests prove it):

```ts
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'tails', label: 'tails', value: 'two', kind: 'display' },
    { id: 'equalVariance', label: 'equal variance', value: 'off · Welch', kind: 'toggle', default: false }, // drawn default: OFF → Welch runs (Benjie's ruling)
    { id: 'ci', label: 'CI', value: '95%', kind: 'display' },
  ],
```
and:
```ts
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'group', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { exact: 2 } },
    ],
    minRule: { kind: 'rows-per-group', n: 3 }, // ui-spec step-5 DRAFT 'at least 3 complete rows per group', as written
  },
```

- [ ] **Step 2b: non-null-assert the three locked `spec.figure` accesses that predate the chassis** (the first two are interim — Task 4 deletes them; the consistency-test ones are permanent):
  - `src/lib/registry/registry.consistency.test.ts` line 24 becomes: `expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figure!.caption)`
  - `src/lib/registry/registry.consistency.test.ts` line 30 becomes: `expect([...spec.tables.map((t) => `table_${t.id}.png`), `figure_${spec.figure!.type}.png`]).toEqual(spec.bundleFiles)`
  - `src/components/ResultPreviewCard.tsx`: `<p><b>Figure.</b> {spec.figure!.caption}</p>`
  - `src/components/screens/ResultsScreen.tsx`: `if (formats.figures) files[`${folder}figure_${spec.figure!.type}.png`] = s.runs[id].result.figurePng`

- [ ] **Step 3: `src/lib/eligibility/eligibility.ts`** — `slotCompatibility` and `completeRowsPerGroup` keep their exact bodies and reason strings. Add the helpers and generalize `testEligibility`:

```ts
/** Complete pairs: both condition columns numeric-finite in the same row (mirrors the paired listwise unit). */
export function completePairs(ds: Dataset, a: string, b: string): number {
  return ds.rows.filter((r) => typeof r[a] === 'number' && Number.isFinite(r[a] as number)
    && typeof r[b] === 'number' && Number.isFinite(r[b] as number)).length
}

/** Numeric-finite values present in one column. */
export function numericValues(ds: Dataset, col: string): number {
  return ds.rows.filter((r) => typeof r[col] === 'number' && Number.isFinite(r[col] as number)).length
}

/** Step-5 verdict: greyed + reason, or eligible. Candidate sets per role, then the test's minRule. */
export function testEligibility(entry: CatalogEntry, spec: TestSpec | null, columns: ColumnMeta[], working: Dataset): Verdict {
  if (entry.status === 'later-slice' || !spec) return { ok: false, reason: LATER_SLICE_REASON }
  const candidates = spec.constraints.roles.map((role) => columns.filter((c) => slotCompatibility(role, c, working).ok))
  for (let i = 0; i < candidates.length; i++) {
    const role = spec.constraints.roles[i]
    if (candidates[i].length < role.arity.min) {
      const label = spec.roles.find((r) => r.id === role.roleId)?.label ?? role.roleId
      return { ok: false, reason: `needs ${role.levels[0] === 'interval' ? 'an' : 'a'} ${role.levels.join(' / ')} column for ${label}` }
    }
  }
  const rule = spec.constraints.minRule
  if (rule.kind === 'rows-per-group') {
    for (const o of candidates[0]) for (const g of candidates[1]) {
      if (o.name === g.name) continue
      const per = completeRowsPerGroup(working, o.name, g.name)
      if (Object.keys(per).length && Object.values(per).every((n) => n >= rule.n)) return { ok: true, reason: null }
    }
    return { ok: false, reason: `needs at least ${rule.n} complete rows per group` }
  }
  if (rule.kind === 'complete-pairs') {
    for (const a of candidates[0]) for (const b of candidates[1] ?? candidates[0])
      if (a.name !== b.name && completePairs(working, a.name, b.name) >= rule.n) return { ok: true, reason: null }
    return { ok: false, reason: `needs at least ${rule.n} complete pairs` }
  }
  if (rule.kind === 'values') {
    if (candidates[0].some((c) => numericValues(working, c.name) >= rule.n)) return { ok: true, reason: null }
    return { ok: false, reason: `needs at least ${rule.n} values` }
  }
  if (candidates[0].length >= rule.n) return { ok: true, reason: null } // 'used-columns'
  return { ok: false, reason: `needs at least ${rule.n} usable column${rule.n > 1 ? 's' : ''}` }
}
```
(The existing `src/lib/eligibility/eligibility.test.ts` must pass UNCHANGED — the t-test path and every reason string it asserts are preserved.)

- [ ] **Step 4: rewrite `src/state/session.test.ts` first (failing)** — the t-test suite re-expressed against the new setup shape, plus the option-record default:

The current file's 10 tests stay semantically identical with these mechanical updates (apply ALL of them; everything else byte-identical):
- every `assignRole('independent-t-test', 'outcome', 'score')` → `addRole('independent-t-test', 'outcome', 'score')` (and likewise for 'group');
- the defaults assertion becomes
  `expect(useSession.getState().setups['independent-t-test']).toEqual({ roles: { outcome: [], group: [] }, options: { equalVariance: false }, blocked: null })`;
- every `roles.outcome).toBe('score')` → `roles.outcome).toEqual(['score'])` (and `'wage'` → `['wage']`);
- `setEqualVariance('independent-t-test', true)` → `setOption('independent-t-test', 'equalVariance', true)`;
and add one new test at the end of the back-edit describe:
```ts
  it('removeRole empties the slot and the results gate re-locks', () => {
    assign(); fakeRun()
    useSession.getState().removeRole('independent-t-test', 'outcome', 'score')
    expect(useSession.getState().setups['independent-t-test'].roles.outcome).toEqual([])
    expect(canEnter(useSession.getState(), 'results')).toBe(false)
  })
  it('addRole enforces the arity maximum — a second column on an exactly-1 slot is refused', () => {
    useSession.getState().addRole('independent-t-test', 'outcome', 'score')
    useSession.getState().addRole('independent-t-test', 'outcome', 'group')
    expect(useSession.getState().setups['independent-t-test'].roles.outcome).toEqual(['score'])
  })
```
(session suite → 12/12; totals are indicative per ASSEMBLER NOTE 1.)

- [ ] **Step 5: `src/state/session.ts`** — mechanical generalization (every other action, gate, and the revalidation flow unchanged):

```ts
export interface TestSetup { roles: Record<string, string[]>; options: Record<string, boolean | number>; blocked: string | null }
```
```ts
const freshSetup = (id: string): TestSetup => ({
  roles: Object.fromEntries((SPECS[id]?.constraints.roles ?? []).map((r) => [r.roleId, []])),
  options: Object.fromEntries((SPECS[id]?.options ?? []).filter((o) => o.kind !== 'display').map((o) => [o.id, o.default!])),
  blocked: null,
})
```
`gateOk` test-step branch:
```ts
  if (step.startsWith('test:')) {
    const id = step.slice(5); const t = s.setups[id]; const spec = SPECS[id]
    return !!t && !!spec && !t.blocked && spec.constraints.roles.every((r) => t.roles[r.roleId].length >= r.arity.min)
  }
```
`revalidated` role check (assignments kept, blocked with the reason — now over arrays):
```ts
    if (spec) outer: for (const role of spec.constraints.roles) {
      for (const colName of prev.roles[role.roleId]) {
        const verdict = slotCompatibility(role, s.columns.find((c) => c.name === colName), working)
        if (!verdict.ok) { blocked = `${spec.roles.find((r) => r.id === role.roleId)?.label ?? role.roleId}: ${verdict.reason}`; break outer }
      }
    }
```
Actions — replace `assignRole`/`setEqualVariance` with:
```ts
    addRole: (testId, roleId, column) => edit((s) => {
      const setup = s.setups[testId]; const role = SPECS[testId]?.constraints.roles.find((r) => r.roleId === roleId)
      if (!setup || !role) return {}
      const cur = setup.roles[roleId]
      if (cur.includes(column) || cur.length >= role.arity.max) return {}
      return { setups: { ...s.setups, [testId]: { ...setup, roles: { ...setup.roles, [roleId]: [...cur, column] } } } }
    }),
    removeRole: (testId, roleId, column) => edit((s) => {
      const setup = s.setups[testId]; if (!setup) return {}
      return { setups: { ...s.setups, [testId]: { ...setup, roles: { ...setup.roles, [roleId]: setup.roles[roleId].filter((c) => c !== column) } } } }
    }),
    setOption: (testId, optionId, value) => edit((s) => ({
      setups: { ...s.setups, [testId]: { ...s.setups[testId], options: { ...s.setups[testId].options, [optionId]: value } } },
    })),
```
(interface `SessionState` updates accordingly: `addRole/removeRole: (testId: string, roleId: string, column: string) => void`, `setOption: (testId: string, optionId: string, value: boolean | number) => void`.)
`renameColumn`'s setups remap becomes array-aware:
```ts
      const setups = Object.fromEntries(Object.entries(s.setups).map(([id, t]) => [id,
        { ...t, roles: Object.fromEntries(Object.entries(t.roles).map(([k, v]) => [k, v.map((c) => (c === name ? next : c))])) }]))
```
`runAll`'s t-test call (until Task 4 swaps in RUNNERS):
```ts
          const result = await runIndependentTTest(engine, ds, setup.roles['outcome'][0], setup.roles['group'][0], setup.options['equalVariance'] as boolean)
```

- [ ] **Step 6: `src/components/DragSlots.tsx`** — slots hold chip LISTS; open = below max:

In `Slot`, replace the single-assigned block with:
```tsx
  const assigned = s.setups[testId]?.roles[role.roleId] ?? []
  ...
      {assigned.map((col) => (
        <div key={col} style={{ marginTop: 5 }}>
          <span className="chip assigned">{col}{' '}
            <button type="button" aria-label={`remove ${col}`} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'inherit' }}
              onClick={() => s.removeRole(testId, role.roleId, col)}>×</button>
          </span>
        </div>
      ))}
```
In `DragSlots`: `const openRoles = spec.constraints.roles.filter((r) => (s.setups[testId]?.roles[r.roleId] ?? []).length < r.arity.max)`; `onDragEnd` adds via `s.addRole(testId, role.roleId, col.name)` when the target role is open and compatible (also skip if the chip is already in that slot). A chip is draggable when SOME open role accepts it (same `fits` computation, over `openRoles`).

Also in `Slot`, directly under the existing `{display.label} <span className="hint">{display.levels} · {display.arity}</span>` line, render the optional helper line (design §3 — Frequencies' cross-tab hint):
```tsx
      {display.hint && <div className="hint" style={{ marginTop: 4 }}>{display.hint}</div>}
```

- [ ] **Step 7: `src/components/screens/TestConfigScreen.tsx`** — option strip renders by kind (replaces the hardcoded equal-variance block):

```tsx
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {spec.options.map((o) => o.kind === 'display' ? (
          <span key={o.id} className="pill">{o.label} {o.value}</span>
        ) : o.kind === 'toggle' ? (
          <label key={o.id} className={`pill${setup.options[o.id] ? ' on' : ''}`} style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={!!setup.options[o.id]} disabled={running}
              onChange={(e) => s.setOption(testId, o.id, e.target.checked)} style={{ marginRight: 6 }} />
            {o.label} ({o.value})
          </label>
        ) : (
          <label key={o.id} className="pill">
            {o.label}{' '}
            <input type="number" value={Number(setup.options[o.id] ?? 0)} disabled={running} aria-label={o.label}
              onChange={(e) => s.setOption(testId, o.id, Number(e.target.value))}
              style={{ width: '5em', border: 0, background: 'transparent', font: 'inherit', color: 'inherit' }} />
          </label>
        ))}
      </div>
```
and immediately after that option-strip `</div>`, render the set-it warning for any option carrying a hint (design §3 — μ₀):
```tsx
      {spec.options.filter((o) => o.hint).map((o) => (
        <p key={o.id} className="hint" style={{ marginTop: 6 }}>{o.hint}</p>
      ))}
```
(`const eq = …` (line 11) and `const fixedOptions = …` (line 12) are deleted. The t-test renders pixel-equivalently: three display pills + the toggle with the same accessible name "equal variance (off · Welch)".)

- [ ] **Step 8: Run everything** — `npx vitest run src/state/session.test.ts` → 11/11; full `npm test` → 54/54 (the new removeRole test is +1); `npx tsc -b` → 0; `npm run e2e` → 2/2 UNCHANGED (the t-test journey must not notice the refactor).

- [ ] **Step 9: Commit**
```bash
git add src/lib/registry src/lib/eligibility src/state src/components
git commit -m "refactor: arity ranges, option kinds, minRule - the flow generalizes beyond one test"
```

---

## Task 4: Result chassis + RUNNERS/BUILDERS + the t-test builder

**Files:** Create `src/lib/results/builders.ts`, `src/lib/results/buildIndependentTTest.ts`, `src/lib/results/buildIndependentTTest.test.ts`; modify `src/components/ResultPreviewCard.tsx`, `src/components/screens/ResultsScreen.tsx`, `src/state/session.ts`

- [ ] **Step 1: `src/lib/results/builders.ts`** — the contract module (per-test tasks APPEND their imports + two registration lines each):

```ts
import type { TestSpec, TableSpec } from '../registry/types'
import type { Engine } from '../webr/engine'
import type { Dataset, TTestResult } from '../stats/types'
import type { TestSetup } from '../../state/session'
import { runIndependentTTest } from '../stats/independentTTest'
import { buildIndependentTTest } from './buildIndependentTTest'

export interface BuiltTable { spec: TableSpec; rows: Record<string, string | number>[] }
export interface CardContent {
  tables: BuiltTable[]
  note: { kind: 'assume' | 'plain'; text: string } | null
  figures: { caption: string; type: string; png: Uint8Array }[]
  howToRead: string
  apa: string
  nExcluded: number
}
export type Runner = (engine: Engine, ds: Dataset, setup: TestSetup) => Promise<unknown>

export const RUNNERS: Record<string, Runner> = {
  'independent-t-test': (engine, ds, setup) =>
    runIndependentTTest(engine, ds, setup.roles['outcome'][0], setup.roles['group'][0], setup.options['equalVariance'] as boolean),
}
export const BUILDERS: Record<string, (spec: TestSpec, result: unknown) => CardContent> = {
  'independent-t-test': (spec, result) => buildIndependentTTest(spec, result as TTestResult),
}
```

- [ ] **Step 2: Failing builder test** — `src/lib/results/buildIndependentTTest.test.ts` (synthetic result with the e2e's sandbox-verified Welch numbers):

```ts
import { describe, it, expect } from 'vitest'
import { buildIndependentTTest } from './buildIndependentTTest'
import { INDEPENDENT_T_TEST as spec } from '../registry/independentTTest'
import type { TTestResult } from '../stats/types'

const r: TTestResult = {
  groupStats: [
    { group: 'control', n: 6, mean: 70.33333, sd: 3.14113, se: 1.28236 },
    { group: 'treatment', n: 6, mean: 82.33333, sd: 3.77712, se: 1.54200 },
  ],
  contrast: 'control − treatment', test: 'welch',
  t: -5.98340, df: 9.67829, p: 0.00015, meanDiff: -12, ci: [-16.48886, -7.51114], cohensD: -3.45437,
  levene: { F: null, p: null }, nExcluded: 0, figurePng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
}

describe('buildIndependentTTest', () => {
  const c = buildIndependentTTest(spec, r)
  it('shapes both tables with the locked formatting', () => {
    expect(c.tables[0].rows[0]).toEqual({ group: 'control', n: 6, mean: '70.33', sd: '3.14', se: '1.28' })
    expect(c.tables[1].rows[0]).toMatchObject({ t: '−5.98', df: '9.68', p: '<.001', mdiff: '−12.00', ci: '[−16.49, −7.51]', d: '−3.45' })
  })
  it('renders the assumption note with em-dashes for the degenerate Levene', () => {
    expect(c.note).toEqual({ kind: 'assume', text: `${spec.assumptionNote} (Levene F=—, p=— · welch test)` })
  })
  it('fills the APA sentence as a p-clause with 1-dp M/SD', () => {
    expect(c.apa).toContain('control (M=70.3, SD=3.1)')
    expect(c.apa).toContain('p<.001')
  })
  it('carries the figure with its type for alt-text and export naming', () => {
    expect(c.figures).toHaveLength(1)
    expect(c.figures[0].type).toBe('boxplot')
  })
})
```

- [ ] **Step 3: Implement `src/lib/results/buildIndependentTTest.ts`** (the old ResultCard mapping, relocated):

```ts
import type { TestSpec } from '../registry/types'
import type { TTestResult } from '../stats/types'
import type { CardContent } from './builders'
import { f, f1, fdf, fp, fx } from '../format/apa'

export function buildIndependentTTest(spec: TestSpec, r: TTestResult): CardContent {
  const [g1, g2] = r.groupStats
  const apa = spec.apaTemplate
    .replace('{g1}', g1.group).replace('{m1}', f1(g1.mean)).replace('{sd1}', f1(g1.sd))
    .replace('{g2}', g2.group).replace('{m2}', f1(g2.mean)).replace('{sd2}', f1(g2.sd))
    .replace('{df}', fdf(r.df)).replace('{t}', f(r.t))
    .replace('p={p}', r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`)
    .replace('{d}', f(r.cohensD))
  return {
    tables: [
      { spec: spec.tables[0], rows: r.groupStats.map((g) => ({ group: g.group, n: g.n, mean: f(g.mean), sd: f(g.sd), se: f(g.se) })) },
      { spec: spec.tables[1], rows: [{ contrast: r.contrast, t: f(r.t), df: fdf(r.df), p: fp(r.p), mdiff: f(r.meanDiff), ci: `[${f(r.ci[0])}, ${f(r.ci[1])}]`, d: f(r.cohensD) }] },
    ],
    note: { kind: 'assume', text: `${spec.assumptionNote} (Levene F=${fx(r.levene.F, f)}, p=${fx(r.levene.p, fp)} · ${r.test} test)` },
    figures: [{ caption: spec.figure!.caption, type: spec.figure!.type, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
```

- [ ] **Step 4: Chassis** — rewrite `src/components/ResultPreviewCard.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { CardContent } from '../lib/results/builders'
import { ApaTable } from './ApaTable'

export function ResultPreviewCard({ index, name, question, content, stale, running, onRerun }:
  { index: number; name: string; question: string; content: CardContent; stale: boolean; running: boolean; onRerun: () => void }) {
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    const u = content.figures.map((fig) => URL.createObjectURL(new Blob([fig.png as Uint8Array<ArrayBuffer>], { type: 'image/png' })))
    setUrls(u)
    return () => u.forEach((x) => URL.revokeObjectURL(x))
  }, [content])
  return (
    <section className="card">
      <div className="eyebrow">{String(index).padStart(2, '0')} · {name}</div>
      {stale && (
        <div className="error-box">Stale — the configuration changed since this ran.{' '}
          <button type="button" disabled={running} onClick={onRerun}>Run analysis again</button></div>
      )}
      <p style={{ color: 'var(--muted)' }}>{question}</p>
      {content.tables.map((t, i) => (
        <div key={t.spec.id}>
          <p><b>{t.spec.captionStyle === 'bare' ? 'Table.' : `Table ${i + 1}.`}</b> {t.spec.title}</p>
          <ApaTable id={`table-${t.spec.domId ?? t.spec.id}`} spec={t.spec} rows={t.rows} />
        </div>
      ))}
      {content.note && <p style={{ fontSize: 11, color: 'var(--muted)' }}>{content.note.text}</p>}
      {content.nExcluded > 0 && <p style={{ fontSize: 11, color: 'var(--muted)' }}>{content.nExcluded} rows excluded (missing values)</p>}
      {content.figures.map((fig, i) => (
        <div key={`${fig.type}-${i}`}>
          <p><b>Figure.</b> {fig.caption}</p>
          {urls[i] && <img src={urls[i]} alt={`${fig.type} — ${fig.caption}`} width={480} />}
        </div>
      ))}
      <h3 style={{ fontSize: 15, margin: '16px 0 4px' }}>How to read this test</h3>
      <p>{content.howToRead}</p>
      <p>APA: {content.apa}</p>
    </section>
  )
}
```
(`alt` keeps the figure TYPE in the accessible name, so the e2e's `getByRole('img', { name: /boxplot/i })` still resolves.)

- [ ] **Step 4b: Chassis render test (design §5)** — create `src/components/ResultPreviewCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ResultPreviewCard } from './ResultPreviewCard'
import type { CardContent } from '../lib/results/builders'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const base: CardContent = {
  tables: [{ spec: { id: 'one', title: 'Only table', columns: [{ key: 'a', label: 'A' }] }, rows: [{ a: '1' }] }],
  note: null, figures: [], howToRead: 'How.', apa: 'APA.', nExcluded: 0,
}
const render = (content: CardContent) => renderToStaticMarkup(
  <ResultPreviewCard index={1} name="Name" question="q?" content={content} stale={false} running={false} onRerun={() => {}} />)

describe('chassis renders each card shape (design §5)', () => {
  it('numbered caption by default, bare "Table." when captionStyle is bare', () => {
    expect(render(base)).toContain('Table 1.')
    const bare = { ...base, tables: [{ ...base.tables[0], spec: { ...base.tables[0].spec, captionStyle: 'bare' as const } }] }
    expect(render(bare)).toContain('Table.')
    expect(render(bare)).not.toContain('Table 1.')
  })
  it('note paragraph appears only when present; the exclusion line only when nExcluded > 0', () => {
    expect(render(base)).not.toContain('rows excluded')
    expect(render({ ...base, note: { kind: 'plain', text: 'note text' } })).toContain('note text')
    expect(render({ ...base, nExcluded: 2 })).toContain('2 rows excluded (missing values)')
  })
  it('renders one Figure block per figure (two-figure shape)', () => {
    const two = { ...base, figures: [{ caption: 'Shape', type: 'histogram', png }, { caption: 'Shape', type: 'qq', png }] }
    expect(render(two).match(/<b>Figure\.<\/b>/g)).toHaveLength(2)
  })
})
```
(`renderToStaticMarkup` skips effects, so the blob-URL `useEffect` never runs — node env suffices; Task 4 Step 7's counts shift per ASSEMBLER NOTE 1.)

- [ ] **Step 5: `src/components/screens/ResultsScreen.tsx`** — build content through the maps; export derives from BUILT content:

Replace the `SPECS`-based card loop body so the success branch becomes:
```tsx
        const run = s.runs[id]
        if (!run) return running ? (
          <section key={id} className="card"><div className="eyebrow">{nn} · {spec.name}</div>
            <p className="hint" role="status">{s.runPhase ?? 'Running…'}</p></section>
        ) : null
        const content = BUILDERS[id](spec, run.result)
        return <ResultPreviewCard key={id} index={i + 1} name={spec.name} question={spec.question} content={content}
          stale={run.stale} running={running} onRerun={() => { void s.runAll() }} />
```
and `download()` becomes content-driven:
```tsx
  const download = async () => {
    const files: Record<string, Uint8Array> = {}
    for (const id of fresh) {
      const spec = SPECS[id]!; const folder = `${String(s.selection.indexOf(id) + 1).padStart(2, '0')}_${id}/`
      const content = BUILDERS[id](spec, s.runs[id].result)
      if (formats.tables) for (const t of content.tables) files[`${folder}table_${t.spec.id}.png`] = await captureNode(`table-${t.spec.domId ?? t.spec.id}`)
      if (formats.figures) for (const fig of content.figures) files[`${folder}figure_${fig.type}.png`] = fig.png
    }
    const names = Object.keys(files)
    if (names.length === 1) saveBlob(new Blob([files[names[0]] as Uint8Array<ArrayBuffer>], { type: 'image/png' }), names[0].split('/')[1])
    else saveBlob(new Blob([buildBundle(files)], { type: 'application/zip' }), 'telos-results.zip')
  }
```
(add `import { BUILDERS } from '../../lib/results/builders'`; keep everything else — error cards, export bar, feedback — untouched.)

- [ ] **Step 6: `src/state/session.ts`** — runAll walks the map; results become shape-agnostic:

`export interface TestRun { result: unknown; stale: boolean }`; replace the t-test import + call with `import { RUNNERS } from '../lib/results/builders'` and:
```ts
          const runner = RUNNERS[id]
          if (!runner) continue
          set({ runPhase: `Running ${spec.name}…` })
          try {
            const result = await runner(engine, ds, setup)
            ...unchanged success/error handling...
```
(`runIndependentTTest` import is removed from session.ts, and the stats type import shrinks to `import type { Dataset } from '../lib/stats/types'` — `TTestResult` is now unused (noUnusedLocals would fail). (session.test.ts keeps its own `TTestResult` import — still used by the `fakeRun` cast.) NOTE: builders.ts imports `TestSetup` from session.ts while session.ts imports `RUNNERS` from builders.ts — TYPE-only in one direction (builders imports only the type), so no runtime cycle: ES modules tolerate this and the spike validation must confirm `tsc`/vitest agree.)

- [ ] **Step 7: Run everything** — `npx vitest run src/lib/results` → 4/4; full `npm test` → 58/58; `npx tsc -b` → 0; `npm run e2e` → 2/2 with IDENTICAL assertions (the chassis migration must be invisible).

- [ ] **Step 8: Commit**
```bash
git add src/lib/results src/components/ResultPreviewCard.tsx src/components/screens/ResultsScreen.tsx src/state/session.ts
git commit -m "feat: result chassis + RUNNERS/BUILDERS maps (t-test re-expressed as the first builder)"
```

---

> **ASSEMBLER NOTES for Tasks 5-11 (override any conflicting in-section text):**
> 1. **Full-suite counts** quoted inside Tasks 5-11 are indicative only (the authors worked in parallel); the authoritative expectation everywhere is **ALL SUITES GREEN + `npx tsc -b` exit 0**. The validation replay pins exact totals.
> 2. **`catalog.consistency.test.ts` available-ids array** grows cumulatively in CATALOG TREE ORDER. The exact expected array after each task: T5 `['one-sample-t-test','independent-t-test']` · T6 `+ 'paired-t-test'` (after independent) · T7 `+ 'mann-whitney-u'` · T8 `+ 'wilcoxon-signed-rank'` · T9 `'distribution-normality'` prepended · T10 `'summary-statistics'` prepended · T11 `'frequencies-crosstabs'` inserted after summary-statistics. Final: `['summary-statistics','frequencies-crosstabs','distribution-normality','one-sample-t-test','independent-t-test','paired-t-test','mann-whitney-u','wilcoxon-signed-rank']`.
> 3. **`specHtml.ts` decode() edits happen in Task 5 ONLY** — its Step 1 adds ALL FOUR new entities (`&mu;` `&#8320;` `&gt;` `&nbsp;`; the last two were Task 9's request, hoisted here because several cards' APA lines carry `&nbsp;`). Any later section repeating a decode instruction is skipped. Per-test consistency tests that ALSO locally normalize `&nbsp;` stay correct (double-normalizing is a no-op).
> 4. Result types live in each stats module (e.g. `MannWhitneyUResult` exported from `src/lib/stats/mannWhitneyU.ts`) — `src/lib/stats/types.ts` is never touched by Tasks 5-11. The `forceApprox` test-only argument convention applies to BOTH nonparametric modules.

## Task 5: One-sample t-test

**Files:** Modify `src/lib/registry/specHtml.ts`, `src/lib/results/builders.ts`, `src/lib/registry/catalog.ts`, `src/lib/registry/catalog.consistency.test.ts`; create `src/lib/registry/oneSampleTTest.ts`, `src/lib/registry/oneSampleTTest.consistency.test.ts`, `src/lib/stats/oneSampleTTest.ts`, `src/lib/stats/oneSampleTTest.test.ts`, `src/lib/results/buildOneSampleTTest.ts`, `src/lib/results/buildOneSampleTTest.test.ts`

Known answers (cross-verified archive, TEST 1 — x = post6 = 81/79/85/83/78/88): μ0=70 → t=7.99824747, df=5, p=0.000493413, M=82.3333333, SD=3.77712413, SE=1.54200447, meanDiff=12.3333333, mean CI [78.3694847, 86.2971820] → **difference CI [8.3694847, 16.2971820]**, d=3.26527086. μ0=0 → t=53.3937061, p=4.357e-08, meanDiff=82.3333333, difference CI = mean CI, d=21.7978892. Shapiro–Wilk(post6): W=0.963536355, p=0.846536958 (native R 4.6.0, this session — archive supplement; WebR side proven by the test run itself).

- [ ] **Step 1: Extend `decode` in `src/lib/registry/specHtml.ts`** — the inputs card's μ₀ pill uses entities the helper doesn't know. Insert before the `&amp;` line (which must stay last):

```ts
  .replace(/&mu;/g, 'μ').replace(/&#8320;/g, '₀').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
```
(Additive: neither entity occurs in the t-test card or the picker tree, so existing consistency tests are untouched.)

- [ ] **Step 2: Failing consistency test** — `src/lib/registry/oneSampleTTest.consistency.test.ts` (card-scoped against BOTH files; the APA line is exemplar-style blanks, so it's asserted as equality after mechanical normalization of the template):

```ts
import { describe, it, expect } from 'vitest'
import { ONE_SAMPLE_T_TEST as spec } from './oneSampleTTest'
import { figuresOf } from './types'
import { readSpec, strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readSpec('telos_test_outputs.html')
const card = outputsHtml.slice(outputsHtml.indexOf('One-sample t-test</span>'), outputsHtml.indexOf('Independent t-test</span>'))
const inputsHtml = readSpec('telos_test_inputs.html')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">One-sample t-test</div>'), inputsHtml.indexOf('<div class="ttl">Paired t-test</div>'))

describe('one-sample t-test registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences — including the M<sub>diff</sub> markup', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => t[1]))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}<sub>${c.sub}</sub>` : c.label))))
  })
  it('table titles equal the card captions, and both captions are NUMBERED (no bare style)', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('question, assume note, figure caption + type line, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(strip(card.match(/<p class="tbl-note assume">(.*?)<\/p>/s)![1])).toBe(spec.tableNote!.text)
    expect(spec.tableNote!.kind).toBe('assume')
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(figuresOf(spec)[0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toContain(figuresOf(spec)[0].type) // 'type: distribution / boxplot with a reference line at the test value'
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('bundle line EQUALS bundleFiles, and the names derive from table ids + figure type', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...figuresOf(spec).map((g) => `figure_${g.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it("the card's exemplar APA line equals the template with placeholders as blanks", () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1]).replace(/&nbsp;/g, ' ')
    expect(line).toBe(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__').replace(/=/g, ' = ')}”`)
  })
  it('roles equal the inputs card slot labels + constraint lines; arity mirrors "exactly 1"', () => {
    expect([...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))).toEqual(spec.roles.map((r) => r.label))
    expect([...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
    expect(spec.constraints.roles).toEqual([{ roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } }])
  })
  it('options equal the inputs card option strip; μ₀ is the only interactive (number, default 0)', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['number', 'display', 'display', 'display'])
    expect(spec.options[0]).toMatchObject({ id: 'mu0', default: 0 })
  })
})
```

- [ ] **Step 3: Create `src/lib/registry/oneSampleTTest.ts`** — all display strings verbatim from the cards (entities decoded):

```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html (One-sample t-test card) + telos_test_inputs.html (Outcome slot, option strip).
export const ONE_SAMPLE_T_TEST: TestSpec = {
  id: 'one-sample-t-test',
  name: 'One-sample t-test',
  question: 'does a mean differ from a fixed value?',
  roles: [
    { id: 'outcome', label: 'Outcome', levels: 'interval / ratio', arity: 'exactly 1' },
  ],
  options: [
    // μ₀ is interactive this slice (design ruling): typed scalar, drawn default 0 — feeds Table 2's 'Test value' cell and the figure's reference line.
    { id: 'mu0', label: 'test value (μ₀)', value: '0', kind: 'number', default: 0,
      hint: 'The test value defaults to 0, so be sure to set it to the figure that actually matters for your question.' },
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'tails', label: 'tails', value: 'two', kind: 'display' },
    { id: 'ci', label: 'CI', value: '95%', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
    ],
    minRule: { kind: 'values', n: 3 }, // design §4: N ≥ 3 single column (Shapiro lower bound)
  },
  tables: [
    { id: 'descriptives', domId: 'one-sample-descriptives', title: 'Descriptives', // domId: '#table-descriptives' would collide with Summary statistics on a combined page
      columns: [{ key: 'variable', label: 'Variable' }, { key: 'n', label: 'N' }, { key: 'mean', label: 'M' }, { key: 'sd', label: 'SD' }, { key: 'se', label: 'SE' }] },
    { id: 't-test', domId: 'one-sample-t-test', title: 'One-sample t-test', // domId: '#table-t-test' would collide with the independent/paired Table 2 on a combined page; the zip keeps table_t-test.png
      columns: [{ key: 'mu0', label: 'Test value' }, { key: 't', label: 't' }, { key: 'df', label: 'df' }, { key: 'p', label: 'p' }, { key: 'mdiff', label: 'M', sub: 'diff' }, { key: 'ci', label: '95% CI' }, { key: 'd', label: 'd' }] },
  ],
  tableNote: { kind: 'assume', text: 'assumption check: normality (Shapiro-Wilk) reported under the descriptives.' },
  figures: [{ caption: 'Value vs. test value', type: 'distribution' }],
  howToRead:
    'Compares your sample mean to a fixed value. A p below alpha means the mean differs from that value; ' +
    'the mean difference and 95% CI show by how much (its sign tells you whether the mean is above or below the test value), ' +
    "and Cohen's d gives the effect size. A p at or above alpha does not prove the mean equals the test value — only that you lack evidence it differs.",
  apaTemplate: 'A one-sample t-test showed M={m} differed from {mu0}, t({df})={t}, p={p}, d={d}.',
  rMap: 't.test(x, mu=) → Table 2 · effectsize::cohens_d() → d · ggplot2 → figure',
  bundleFiles: ['table_descriptives.png', 'table_t-test.png', 'figure_distribution.png'],
}
```

- [ ] **Step 4: Run + mutation checks** — `npx vitest run src/lib/registry/oneSampleTTest.consistency.test.ts` → 7/7. Then prove the equality bites: (a) change Table 2's `label: 'Test value'` to `'Test Value'` → suite FAILS (thead equality); revert. (b) delete the trailing period of `tableNote.text` → suite FAILS (note equality); revert → 7/7 again.

- [ ] **Step 5: Failing stats known-answer test** — `src/lib/stats/oneSampleTTest.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runOneSampleTTest } from './oneSampleTTest'
import type { Dataset } from './types'

// post6 = the archive's treatment scores (TEST 1). Two junk rows exercise the single-column drop:
// null and a non-numeric string must be EXCLUDED, never coerced to 0.
const data: Dataset = { columns: ['post_score'], rows: [
  { post_score: 81 }, { post_score: 79 }, { post_score: 85 }, { post_score: 83 }, { post_score: 78 }, { post_score: 88 },
  { post_score: null }, { post_score: 'n/a' },
] }

describe('runOneSampleTTest', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('μ0 = 70: descriptives, t/df/p, DIFFERENCE CI (conf.int − μ0), d, Shapiro-Wilk, exclusions, PNG', async () => {
    const r = await runOneSampleTTest(engine, data, 'post_score', 70)
    expect(r.nExcluded).toBe(2)
    expect(r.variable).toBe('post_score')
    expect(r.n).toBe(6)
    expect(r.mean).toBeCloseTo(82.3333, 3)
    expect(r.sd).toBeCloseTo(3.7771, 3)
    expect(r.se).toBeCloseTo(1.542, 3)
    expect(r.mu0).toBe(70)
    expect(r.t).toBeCloseTo(7.9982, 3)
    expect(r.df).toBe(5)
    expect(r.p).toBeCloseTo(0.000493, 5)
    expect(r.meanDiff).toBeCloseTo(12.3333, 3)
    expect(r.ci[0]).toBeCloseTo(8.3695, 3)   // 78.3694847 − 70: the rendered CI is the DIFFERENCE CI
    expect(r.ci[1]).toBeCloseTo(16.2972, 3)  // 86.2971820 − 70
    expect(r.cohensD).toBeCloseTo(3.2653, 3)
    expect(r.shapiro.W).toBeCloseTo(0.9635, 3)
    expect(r.shapiro.p).toBeCloseTo(0.8465, 3)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('μ0 = 0 (the drawn default): t/p/meanDiff/d move, the difference CI coincides with the mean CI', async () => {
    const r = await runOneSampleTTest(engine, data, 'post_score', 0)
    expect(r.t).toBeCloseTo(53.3937, 3)
    expect(r.df).toBe(5)
    expect(r.p).toBeLessThan(1e-6)           // archived: 4.357e-08
    expect(r.meanDiff).toBeCloseTo(82.3333, 3)
    expect(r.ci[0]).toBeCloseTo(78.3695, 3)  // − 0: identical to the mean CI (archived fact)
    expect(r.ci[1]).toBeCloseTo(86.2972, 3)
    expect(r.cohensD).toBeCloseTo(21.7979, 3)
  })
})
```

- [ ] **Step 6: Implement `src/lib/stats/oneSampleTTest.ts`** — R per the card's R map; env-passed vector like the t-test module:

```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface OneSampleTTestResult {
  variable: string
  n: number; mean: number; sd: number; se: number
  mu0: number
  t: number; df: number; p: number
  meanDiff: number                                // M − μ0
  ci: [number, number]                            // DIFFERENCE CI — see the spike-fact comment below
  cohensD: number
  shapiro: { W: number | null; p: number | null } // null outside Shapiro's 3–5000 range — rendered as em-dash
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

// Card R map: t.test(x, mu=) → Table 2 · effectsize::cohens_d() → d. shapiro.test feeds the assume note
// ('normality (Shapiro-Wilk) reported under the descriptives').
// SPIKE FACT (do not "fix"): one-sample t.test conf.int is the CI of the MEAN. The card pairs '95% CI' with
// M_diff and the how-to-read says the CI shows 'by how much' — so the rendered CI is the DIFFERENCE CI
// = conf.int − μ0 (recorded decision; for μ0 = 0 the two coincide).
const R_STATS = String.raw`
n <- length(x)
res <- t.test(x, mu = mu0)
d <- effectsize::cohens_d(x, mu = mu0)
sw <- if (n >= 3 && n <= 5000) shapiro.test(x) else NULL
list(n = n, mean = mean(x), sd = sd(x), se = sd(x)/sqrt(n),
  t = unname(res$statistic), df = unname(res$parameter), p = res$p.value,
  meanDiff = mean(x) - mu0,
  ci = as.numeric(res$conf.int) - mu0,
  cohensD = d$Cohens_d,
  shapiro = list(W = if (is.null(sw)) NA_real_ else unname(sw$statistic), p = if (is.null(sw)) NA_real_ else sw$p.value))`

// Card figure: 'distribution / boxplot with a reference line at the test value' → histogram + dashed vline at μ0.
const R_DISTRIBUTION = String.raw`
print(ggplot2::ggplot(data.frame(x = x), ggplot2::aes(x)) +
  ggplot2::geom_histogram(bins = nclass.Sturges(x), fill = '#9cc2ec', colour = '#0c447c') +
  ggplot2::geom_vline(xintercept = mu0, colour = '#0c447c', linetype = 'dashed') +
  ggplot2::labs(x = NULL, y = NULL))`

interface RawStats {
  n: number; mean: number; sd: number; se: number
  t: number; df: number; p: number; meanDiff: number; ci: number[]; cohensD: number
  shapiro: { W: number | null; p: number | null }
}

export async function runOneSampleTTest(engine: Engine, data: Dataset, outcome: string, mu0: number): Promise<OneSampleTTestResult> {
  // Per-test single-column drop (design §2, global R2 policy): keep rows whose outcome value is a finite number.
  const values = data.rows.map((r) => r[outcome]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  const nExcluded = data.rows.length - values.length
  const env = { x: values, mu0 }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_DISTRIBUTION, 600, 450, env)
  return {
    variable: outcome, n: s.n, mean: s.mean, sd: s.sd, se: s.se, mu0,
    t: s.t, df: s.df, p: s.p, meanDiff: s.meanDiff, ci: [s.ci[0], s.ci[1]], cohensD: s.cohensD,
    shapiro: s.shapiro, nExcluded, figurePng,
  }
}
```
(No categorical outputs here, so the as.character-before-`.telos_json` rule has nothing to bite on; `list(... NULL)`-shaped Shapiro is avoided by emitting `NA_real_`, which the serializer maps to JSON null.)

- [ ] **Step 7: Run the stats suite** — `npx vitest run src/lib/stats/oneSampleTTest.test.ts` → 2/2 (network ok; WebR boots + installs once in beforeAll).

- [ ] **Step 8: Failing builder test** — `src/lib/results/buildOneSampleTTest.test.ts` (synthetic typed result = the verified μ0=70 numbers; the variant branch uses the natively-pinned μ0=90 derivation):

```ts
import { describe, it, expect } from 'vitest'
import { buildOneSampleTTest } from './buildOneSampleTTest'
import { ONE_SAMPLE_T_TEST as spec } from '../registry/oneSampleTTest'
import type { OneSampleTTestResult } from '../stats/oneSampleTTest'

// Archived cross-verified numbers: post6 vs μ0 = 70 (the difference CI is already μ0-shifted by the stats module).
const r: OneSampleTTestResult = {
  variable: 'post_score', n: 6, mean: 82.33333, sd: 3.77712, se: 1.542,
  mu0: 70, t: 7.99825, df: 5, p: 0.000493, meanDiff: 12.33333, ci: [8.36948, 16.29718], cohensD: 3.26527,
  shapiro: { W: 0.96354, p: 0.84654 }, nExcluded: 2,
  figurePng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
}

describe('buildOneSampleTTest', () => {
  const c = buildOneSampleTTest(spec, r)
  it("shapes both tables — Table 2's Test value cell shows the user's μ0", () => {
    expect(c.tables[0].rows[0]).toEqual({ variable: 'post_score', n: 6, mean: '82.33', sd: '3.78', se: '1.54' })
    expect(c.tables[1].rows[0]).toEqual({ mu0: '70', t: '8.00', df: '5', p: '<.001', mdiff: '12.33', ci: '[8.37, 16.30]', d: '3.27' })
  })
  it('appends the Shapiro-Wilk values to the assume note', () => {
    expect(c.note).toEqual({ kind: 'assume', text: `${spec.tableNote!.text} (Shapiro-Wilk W=0.96, p=.847)` })
  })
  it('fills the APA sentence as a p-clause with a 1-dp M', () => {
    expect(c.apa).toBe('A one-sample t-test showed M=82.3 differed from 70, t(5)=8.00, p<.001, d=3.27.')
  })
  it('carries the distribution figure with its type, plus the exclusion count', () => {
    expect(c.figures).toEqual([{ caption: 'Value vs. test value', type: 'distribution', png: r.figurePng }])
    expect(c.nExcluded).toBe(2)
    expect(c.howToRead).toBe(spec.howToRead)
  })
  it('branches: Shapiro null → em-dashes; p ≥ .001 stays a p= clause; negatives typeset U+2212', () => {
    // μ0 = 90 derivation pinned in native R: t = −4.971884, p = 0.004205, diff CI [−11.630515, −3.702818], d = −2.029763.
    const v = buildOneSampleTTest(spec, { ...r, mu0: 90, t: -4.971884, p: 0.004205, meanDiff: -7.66667, ci: [-11.630515, -3.702818], cohensD: -2.029763, shapiro: { W: null, p: null } })
    expect(v.note!.text).toBe(`${spec.tableNote!.text} (Shapiro-Wilk W=—, p=—)`)
    expect(v.tables[1].rows[0]).toEqual({ mu0: '90', t: '−4.97', df: '5', p: '.004', mdiff: '−7.67', ci: '[−11.63, −3.70]', d: '−2.03' })
    expect(v.apa).toBe('A one-sample t-test showed M=82.3 differed from 90, t(5)=−4.97, p=.004, d=−2.03.')
  })
})
```

- [ ] **Step 9: Implement `src/lib/results/buildOneSampleTTest.ts`** (apa helpers; t-test builder pattern incl. the p-clause rule):

```ts
import type { TestSpec } from '../registry/types'
import type { OneSampleTTestResult } from '../stats/oneSampleTTest'
import type { CardContent } from './builders'
import { minus, f, f1, fdf, fp, fx } from '../format/apa'

export function buildOneSampleTTest(spec: TestSpec, r: OneSampleTTestResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{m}', f1(r.mean)).replace('{mu0}', minus(String(r.mu0)))
    .replace('{df}', fdf(r.df)).replace('{t}', f(r.t))
    .replace('p={p}', r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`)
    .replace('{d}', f(r.cohensD))
  return {
    tables: [
      { spec: spec.tables[0], rows: [{ variable: r.variable, n: r.n, mean: f(r.mean), sd: f(r.sd), se: f(r.se) }] },
      { spec: spec.tables[1], rows: [{ mu0: minus(String(r.mu0)), t: f(r.t), df: fdf(r.df), p: fp(r.p), mdiff: f(r.meanDiff), ci: `[${f(r.ci[0])}, ${f(r.ci[1])}]`, d: f(r.cohensD) }] },
    ],
    note: { kind: 'assume', text: `${spec.tableNote!.text} (Shapiro-Wilk W=${fx(r.shapiro.W, f)}, p=${fx(r.shapiro.p, fp)})` },
    figures: [{ caption: spec.figures![0].caption, type: spec.figures![0].type, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
```
`npx vitest run src/lib/results/buildOneSampleTTest.test.ts` → 5/5.

- [ ] **Step 10: Register** — APPEND to `src/lib/results/builders.ts`: the import line

```ts
import { runOneSampleTTest, type OneSampleTTestResult } from '../stats/oneSampleTTest'
import { buildOneSampleTTest } from './buildOneSampleTTest'
```
one `RUNNERS` entry (the adapter maps TestSetup roles/options to the stats args):
```ts
  'one-sample-t-test': (engine, ds, setup) =>
    runOneSampleTTest(engine, ds, setup.roles['outcome'][0], setup.options['mu0'] as number),
```
and one `BUILDERS` entry:
```ts
  'one-sample-t-test': (spec, result) => buildOneSampleTTest(spec, result as OneSampleTTestResult),
```
In `src/lib/registry/catalog.ts`: add `import { ONE_SAMPLE_T_TEST } from './oneSampleTTest'`; flip the entry to
```ts
  e('one-sample-t-test', 'One-sample t-test', 'Group comparisons', 'Parametric', 'available'),
```
and grow SPECS:
```ts
export const SPECS: Record<string, TestSpec> = { [INDEPENDENT_T_TEST.id]: INDEPENDENT_T_TEST, [ONE_SAMPLE_T_TEST.id]: ONE_SAMPLE_T_TEST }
```
In `src/lib/registry/catalog.consistency.test.ts`, replace the second test — tasks execute in order, so this expected array grows CUMULATIVELY: each per-test task adds its own id at its CATALOG (tree) position. After this task it is:
```ts
  it('available ids = the tests lit up so far, in tree order', () => {
    expect(CATALOG.filter((c) => c.status === 'available').map((c) => c.id)).toEqual(['one-sample-t-test', 'independent-t-test'])
  })
```
(one-sample precedes independent in the tree; later tasks insert summary-statistics etc. ahead of it.)

- [ ] **Step 11: Run everything** — `npx vitest run src/lib/registry src/lib/results src/lib/stats` green; full `npm test` → 72/72 (58 from Task 4 + 7 consistency + 2 stats + 5 builder); `npx tsc -b` → 0; `npm run e2e` → 2/2 (the t-test journey must not notice the new catalog entry).

- [ ] **Step 12: Commit**
```bash
git add src/lib/registry src/lib/stats src/lib/results
git commit -m "feat: one-sample-t-test — registry, stats, builder (card-faithful)"
```

## Task 6: Paired t-test

**Files:** Create `src/lib/registry/pairedTTest.ts`, `src/lib/registry/pairedTTest.consistency.test.ts`, `src/lib/stats/pairedTTest.ts`, `src/lib/stats/pairedTTest.test.ts`, `src/lib/results/buildPairedTTest.ts`, `src/lib/results/buildPairedTTest.test.ts`; modify `src/lib/results/builders.ts`, `src/lib/registry/catalog.ts`, `src/lib/registry/catalog.consistency.test.ts`

Card decisions this task encodes: diffs = **A − B** (the card: "their sign depends on the subtraction order, A−B"); Table 1 has **NO SE column** (4 columns — the card draws Condition · N · M · SD); `FigureSpec.type = 'difference'` so the locked `figure_<type>.png` derivation reproduces the card's `figure_difference.png` (the drawn "type: paired-lines / difference plot" line is pinned LITERALLY in the consistency test instead); the table note is the card's static text — no computed numbers appended (the card draws no blanks in it, and no cross-verified Shapiro-on-diffs value exists). All three option pills are `kind: 'display'` (rulings: only One-sample μ₀ and the MW/Wilcoxon continuity toggle are interactive). APA template (card line is exemplar-style with `__` blanks — fragments asserted, not byte-matched): `'A paired-samples t-test showed a change of M={mdiff}, t({df})={t}, p={p}, dz={dz}.'`

- [ ] **Step 1: Failing consistency test** — `src/lib/registry/pairedTTest.consistency.test.ts` (boundary markers verified unique in both files):

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PAIRED_T_TEST as spec } from './pairedTTest'
import { figuresOf } from './types'
import { strip } from './specHtml'

// Scope each file to THIS test's card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Paired t-test</span>'), outputsHtml.indexOf('One-way ANOVA + post-hoc</span>'))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Paired t-test</div>'), inputsHtml.indexOf('<div class="ttl">Factorial ANOVA</div>'))

describe('paired-t-test registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences — incl. M<sub>diff</sub> and d<sub>z</sub>; Table 1 has no SE column', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => t[1]))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}<sub>${c.sub}</sub>` : c.label))))
    expect(theads[0]).toHaveLength(4) // Condition · N · M · SD — the card draws no SE
  })
  it('table titles equal the numbered card captions', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true) // numbered "Table N.", not bare
  })
  it('question, note, figure caption + drawn type, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(strip(card.match(/<p class="tbl-note assume">(.*?)<\/p>/s)![1])).toBe(spec.tableNote!.text)
    expect(spec.tableNote!.kind).toBe('assume')
    expect([...card.matchAll(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/gs)].map((m) => strip(m[1]))).toEqual(figuresOf(spec).map((fg) => fg.caption))
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe('type: paired-lines / difference plot')
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('APA exemplar contains every fixed fragment of the template', () => {
    const apa = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    for (const frag of spec.apaTemplate.split(/\{[a-z]+\}/).filter(Boolean)) expect(apa).toContain(frag)
  })
  it('bundle line EQUALS bundleFiles, and the names derive from table ids + figure types', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...figuresOf(spec).map((fg) => `figure_${fg.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + constraint lines; machine constraints mirror "exactly 1"', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
    expect(spec.constraints.roles.map((r) => r.arity)).toEqual([{ min: 1, max: 1 }, { min: 1, max: 1 }])
    expect(spec.constraints.minRule).toEqual({ kind: 'complete-pairs', n: 3 })
  })
  it('options equal the inputs card option strip — all display pills (no interactive option on this card)', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.every((o) => o.kind === 'display')).toBe(true)
  })
})
```

Run `npx vitest run src/lib/registry/pairedTTest.consistency.test.ts` → FAILS (module missing).

- [ ] **Step 2: Create `src/lib/registry/pairedTTest.ts`** — all display strings verbatim from the cards:

```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html (Paired t-test card) + telos_test_inputs.html (roles, option strip).
export const PAIRED_T_TEST: TestSpec = {
  id: 'paired-t-test',
  name: 'Paired t-test',
  question: 'do two related measurements differ?',
  roles: [
    { id: 'conditionA', label: 'Condition A', levels: 'interval / ratio', arity: 'exactly 1' },
    { id: 'conditionB', label: 'Condition B', levels: 'interval / ratio', arity: 'exactly 1' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'tails', label: 'tails', value: 'two', kind: 'display' },
    { id: 'ci', label: 'CI', value: '95%', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'conditionA', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'conditionB', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
    ],
    minRule: { kind: 'complete-pairs', n: 3 },
  },
  tables: [
    { id: 'paired-descriptives', title: 'Paired descriptives',
      columns: [{ key: 'condition', label: 'Condition' }, { key: 'n', label: 'N' }, { key: 'mean', label: 'M' }, { key: 'sd', label: 'SD' }] },
    { id: 't-test', domId: 'paired-t-test', title: 'Paired-samples t-test', // domId: '#table-t-test' would collide with the independent/one-sample Table 2 on a combined page; the zip keeps table_t-test.png
      columns: [{ key: 'pair', label: 'Pair' }, { key: 't', label: 't' }, { key: 'df', label: 'df' }, { key: 'p', label: 'p' },
        { key: 'mdiff', label: 'M', sub: 'diff' }, { key: 'ci', label: '95% CI' }, { key: 'd', label: 'd', sub: 'z' }] },
  ],
  tableNote: { kind: 'assume', text: 'assumption check: normality of the difference scores.' },
  // type 'difference' derives the card's bundle name figure_difference.png; the drawn
  // "type: paired-lines / difference plot" line is pinned literally in the consistency test.
  figures: [{ caption: 'Change per case', type: 'difference' }],
  howToRead:
    'Tests whether the average change between two related measurements (e.g. before vs. after) differs from zero. ' +
    'A p below alpha means a significant change; the mean difference, CI and dz describe its size (their sign depends on the subtraction order, A−B). ' +
    'A p at or above alpha does not prove there was no change — only that none was detected.',
  apaTemplate: 'A paired-samples t-test showed a change of M={mdiff}, t({df})={t}, p={p}, dz={dz}.',
  rMap: 'dplyr::summarise() / psych::describe() → Table 1 (per-condition N/M/SD) · t.test(paired=TRUE) → Table 2 · effectsize::cohens_d(paired=TRUE) → dz · ggplot2 → figure',
  bundleFiles: ['table_paired-descriptives.png', 'table_t-test.png', 'figure_difference.png'],
}
```

Run the consistency test → 7/7 PASS.

- [ ] **Step 3: Mutation check** — prove the test bites: (a) in `pairedTTest.ts` change Table 2's last column to `{ key: 'd', label: 'd' }` (drop `sub: 'z'`) → rerun → MUST FAIL (thead assertion); revert. (b) Drop the trailing period from the tableNote text → rerun → MUST FAIL (note assertion); revert → 7/7 PASS again.

- [ ] **Step 4: Failing stats known-answer test** — `src/lib/stats/pairedTTest.test.ts`. Fixture = the cross-verified pre6/post6 pairs (diffs A−B = −9, −11, −10, −13, −12, −17) plus two incomplete rows the complete-pairs listwise unit MUST drop:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runPairedTTest } from './pairedTTest'
import type { Dataset } from './types'

// pre6/post6 — the cross-verified paired fixture (WebR R 4.6.0 ≡ native R 4.6.0), row-paired in this order.
const data: Dataset = { columns: ['pre', 'post'], rows: [
  { pre: 72, post: 81 }, { pre: 68, post: 79 }, { pre: 75, post: 85 },
  { pre: 70, post: 83 }, { pre: 66, post: 78 }, { pre: 71, post: 88 },
  { pre: 70, post: null }, { pre: null, post: 80 }, // complete-pairs listwise: both rows EXCLUDED, never coerced
] }

describe('runPairedTTest', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('cross-verified numbers: per-condition describe, t/df/p, difference CI, dz, listwise pairs, figure', async () => {
    const r = await runPairedTTest(engine, data, 'pre', 'post')
    expect(r.nExcluded).toBe(2)
    expect(r.conditions.map((c) => c.condition)).toEqual(['pre', 'post'])
    expect(r.conditions[0].n).toBe(6)
    expect(r.conditions[0].mean).toBeCloseTo(70.333, 3)
    expect(r.conditions[0].sd).toBeCloseTo(3.141, 3)
    expect(r.conditions[1].mean).toBeCloseTo(82.333, 3)
    expect(r.conditions[1].sd).toBeCloseTo(3.777, 3)
    expect(r.pair).toBe('pre − post')               // U+2212, A − B subtraction order
    expect(r.t).toBeCloseTo(-10.392, 3)
    expect(r.df).toBe(5)
    expect(r.p).toBeCloseTo(0.000142, 5)
    expect(r.meanDiff).toBeCloseTo(-12, 6)
    expect(r.ci[0]).toBeCloseTo(-14.968, 3)
    expect(r.ci[1]).toBeCloseTo(-9.032, 3)
    expect(r.dz).toBeCloseTo(-4.243, 3)              // = mean(diff)/sd(diff), effectsize agrees to all digits
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })
})
```

- [ ] **Step 5: Implement `src/lib/stats/pairedTTest.ts`** — runner-shaped, env-passed vectors, R per the card's R map (psych::describe numeric columns — NEVER parsed printout; cohens_d's advisory message stays off stdout, spike fact 6):

```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface ConditionStat { condition: string; n: number; mean: number; sd: number }
export interface PairedTTestResult {
  conditions: [ConditionStat, ConditionStat]
  pair: string                          // 'A − B' (U+2212); diffs = A − B per the card's subtraction order
  t: number; df: number; p: number
  meanDiff: number                      // mean(A − B) = t.test estimate
  ci: [number, number]                  // 95% CI of the mean difference
  dz: number                            // effectsize::cohens_d(paired=TRUE)
  nExcluded: number                     // incomplete pairs dropped listwise
  figurePng: Uint8Array<ArrayBuffer>
}

const R_STATS = String.raw`
desc <- psych::describe(data.frame(a = a, b = b))
res <- t.test(a, b, paired = TRUE)
dz <- effectsize::cohens_d(a, b, paired = TRUE)$Cohens_d
list(stats = list(list(n = desc$n[1], mean = desc$mean[1], sd = desc$sd[1]),
                  list(n = desc$n[2], mean = desc$mean[2], sd = desc$sd[2])),
  t = unname(res$statistic), df = unname(res$parameter), p = res$p.value,
  meanDiff = unname(res$estimate), ci = as.numeric(res$conf.int), dz = dz)`

// The card's "paired-lines / difference plot": one line per case from Condition A to Condition B.
const R_FIGURE = String.raw`
df <- data.frame(case = rep(seq_along(a), 2),
  cond = factor(rep(c(la, lb), each = length(a)), levels = c(la, lb)),
  value = c(a, b))
print(ggplot2::ggplot(df, ggplot2::aes(cond, value, group = case)) +
  ggplot2::geom_line(colour = '#9cc2ec') + ggplot2::geom_point(colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL))`

interface RawStats { stats: { n: number; mean: number; sd: number }[]; t: number; df: number; p: number; meanDiff: number; ci: number[]; dz: number }

export async function runPairedTTest(engine: Engine, data: Dataset, conditionA: string, conditionB: string): Promise<PairedTTestResult> {
  // Complete-pairs listwise (the card's missing-data unit): keep rows where BOTH condition columns are numeric-finite.
  const rows = data.rows.filter((r) =>
    typeof r[conditionA] === 'number' && Number.isFinite(r[conditionA] as number) &&
    typeof r[conditionB] === 'number' && Number.isFinite(r[conditionB] as number))
  const nExcluded = data.rows.length - rows.length
  const env = { a: rows.map((r) => r[conditionA] as number), b: rows.map((r) => r[conditionB] as number), la: conditionA, lb: conditionB }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_FIGURE, 600, 450, env)
  return {
    conditions: [
      { condition: conditionA, n: s.stats[0].n, mean: s.stats[0].mean, sd: s.stats[0].sd },
      { condition: conditionB, n: s.stats[1].n, mean: s.stats[1].mean, sd: s.stats[1].sd },
    ],
    pair: `${conditionA} − ${conditionB}`,
    t: s.t, df: s.df, p: s.p, meanDiff: s.meanDiff, ci: [s.ci[0], s.ci[1]], dz: s.dz,
    nExcluded, figurePng,
  }
}
```

Run `npx vitest run src/lib/stats/pairedTTest.test.ts` (network ok — engine downloads packages in beforeAll, hookTimeout 300s covers it) → 1/1 PASS.

- [ ] **Step 6: Failing builder test** — `src/lib/results/buildPairedTTest.test.ts` (synthetic typed result = the verified numbers; exact formatted strings, U+2212 minuses):

```ts
import { describe, it, expect } from 'vitest'
import { buildPairedTTest } from './buildPairedTTest'
import { PAIRED_T_TEST as spec } from '../registry/pairedTTest'
import type { PairedTTestResult } from '../stats/pairedTTest'

const r: PairedTTestResult = {
  conditions: [
    { condition: 'pre', n: 6, mean: 70.33333, sd: 3.14113 },
    { condition: 'post', n: 6, mean: 82.33333, sd: 3.77712 },
  ],
  pair: 'pre − post',
  t: -10.39230, df: 5, p: 0.000142, meanDiff: -12, ci: [-14.96825, -9.03175], dz: -4.24264,
  nExcluded: 2, figurePng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
}

describe('buildPairedTTest', () => {
  const c = buildPairedTTest(spec, r)
  it('Table 1: one row per condition, 4 columns (no SE), 2-dp strings', () => {
    expect(c.tables[0].spec.id).toBe('paired-descriptives')
    expect(c.tables[0].rows).toEqual([
      { condition: 'pre', n: 6, mean: '70.33', sd: '3.14' },
      { condition: 'post', n: 6, mean: '82.33', sd: '3.78' },
    ])
  })
  it('Table 2: the pair row with M_diff, difference CI and d_z', () => {
    expect(c.tables[1].rows).toEqual([
      { pair: 'pre − post', t: '−10.39', df: '5', p: '<.001', mdiff: '−12.00', ci: '[−14.97, −9.03]', d: '−4.24' },
    ])
  })
  it('carries the card note verbatim and the excluded-pairs count', () => {
    expect(c.note).toEqual({ kind: 'assume', text: 'assumption check: normality of the difference scores.' })
    expect(c.nExcluded).toBe(2)
  })
  it('fills the APA sentence with the p-clause rule and 1-dp change', () => {
    expect(c.apa).toBe('A paired-samples t-test showed a change of M=−12.0, t(5)=−10.39, p<.001, dz=−4.24.')
  })
  it('p ≥ .001 renders as p=… (the other p-clause branch)', () => {
    expect(buildPairedTTest(spec, { ...r, p: 0.042 }).apa).toContain('p=.042')
  })
  it('carries the figure with its type for alt-text and export naming', () => {
    expect(c.figures).toEqual([{ caption: 'Change per case', type: 'difference', png: r.figurePng }])
  })
})
```

- [ ] **Step 7: Implement `src/lib/results/buildPairedTTest.ts`**:

```ts
import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { PairedTTestResult } from '../stats/pairedTTest'
import type { CardContent } from './builders'
import { f, f1, fdf, fp } from '../format/apa'

export function buildPairedTTest(spec: TestSpec, r: PairedTTestResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{mdiff}', f1(r.meanDiff))
    .replace('{df}', fdf(r.df)).replace('{t}', f(r.t))
    .replace('p={p}', r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`)
    .replace('{dz}', f(r.dz))
  return {
    tables: [
      { spec: spec.tables[0], rows: r.conditions.map((c) => ({ condition: c.condition, n: c.n, mean: f(c.mean), sd: f(c.sd) })) },
      { spec: spec.tables[1], rows: [{ pair: r.pair, t: f(r.t), df: fdf(r.df), p: fp(r.p), mdiff: f(r.meanDiff), ci: `[${f(r.ci[0])}, ${f(r.ci[1])}]`, d: f(r.dz) }] },
    ],
    note: spec.tableNote ?? null, // the card's static text — no computed values (the card draws no blanks)
    figures: figuresOf(spec).map((fg) => ({ caption: fg.caption, type: fg.type, png: r.figurePng })),
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
```

Run `npx vitest run src/lib/results/buildPairedTTest.test.ts` → 6/6 PASS.

- [ ] **Step 8: Register runner + builder** — APPEND to `src/lib/results/builders.ts`: imports (top, after the t-test's):

```ts
import type { PairedTTestResult } from '../stats/pairedTTest'
import { runPairedTTest } from '../stats/pairedTTest'
import { buildPairedTTest } from './buildPairedTTest'
```

one `RUNNERS` entry (the adapter maps the TestSetup role arrays — no options; all this card's pills are display):

```ts
  'paired-t-test': (engine, ds, setup) =>
    runPairedTTest(engine, ds, setup.roles['conditionA'][0], setup.roles['conditionB'][0]),
```

one `BUILDERS` entry:

```ts
  'paired-t-test': (spec, result) => buildPairedTTest(spec, result as PairedTTestResult),
```

- [ ] **Step 9: Catalog flip** — in `src/lib/registry/catalog.ts`: add `import { PAIRED_T_TEST } from './pairedTTest'`; change the entry to `e('paired-t-test', 'Paired t-test', 'Group comparisons', 'Parametric', 'available'),`; add `[PAIRED_T_TEST.id]: PAIRED_T_TEST` to `SPECS`. In `src/lib/registry/catalog.consistency.test.ts`: ADD `'paired-t-test'` to the expected available-ids array. The tasks execute in order and the array grows cumulatively — keep every id earlier tasks added, and insert `'paired-t-test'` at its CATALOG (tree) position, immediately AFTER `'independent-t-test'` (the filter emits tree order, not task order). If the it() title still hardcodes a count, rename it to `'the available tests match the shipped specs, in tree order'` (an earlier task may already have).

- [ ] **Step 10: Verify** — `npx vitest run src/lib/registry/pairedTTest.consistency.test.ts src/lib/stats/pairedTTest.test.ts src/lib/results/buildPairedTTest.test.ts` → 14/14; full `npm test` green (this task adds 14 tests to whatever count the preceding tasks left); `npx tsc -b` → 0.

- [ ] **Step 11: Commit**
```bash
git add src/lib/registry src/lib/stats src/lib/results
git commit -m "feat: paired-t-test — registry, stats, builder (card-faithful)"
```

## Task 7: Mann-Whitney U

**Files:** Create `src/lib/registry/mannWhitneyU.ts`, `src/lib/registry/mannWhitneyU.consistency.test.ts`, `src/lib/stats/mannWhitneyU.ts`, `src/lib/stats/mannWhitneyU.test.ts`, `src/lib/results/buildMannWhitneyU.ts`, `src/lib/results/buildMannWhitneyU.test.ts`; modify `src/lib/results/builders.ts`, `src/lib/registry/catalog.ts`, `src/lib/registry/catalog.consistency.test.ts`

Card facts this task encodes: Table 1 = per-group pooled-rank summary; Table 2 = `U · Z · p · r` (no df, no CI); plain note "r is the rank-biserial effect size."; one boxplot figure. Per spike facts 1: `wilcox.test` W **is** U for the FIRST factor level (alphabetical — `control`); the default run keeps R's default path (**EXACT** at these N); the **continuity toggle maps to `correct=` and matters only on the asymptotic path**, so its known-answer tests pass `exact=FALSE` explicitly via a test-only `forceApprox` arg the runner adapter never passes; **Z always comes from `coin::wilcox_test` (asymptotic)** — the card-specified mix of exact p and asymptotic Z in one row. All asserted numbers are the cross-verified TEST 4a/4b values (fixtures = the spike's exact `ovl12`/`long12` vectors).

- [ ] **Step 1: Failing consistency test** — create `src/lib/registry/mannWhitneyU.consistency.test.ts` (fails: module doesn't exist yet):

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { MANN_WHITNEY_U as spec } from './mannWhitneyU'
import { strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Mann-Whitney U</span>'), outputsHtml.indexOf('Wilcoxon signed-rank</span>'))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Mann-Whitney U</div>'), inputsHtml.indexOf('<div class="ttl">Wilcoxon signed-rank</div>'))

describe('mann-whitney-u registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => t[1]))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}<sub>${c.sub}</sub>` : c.label))))
  })
  it('numbered table captions equal the card captions (this card has no bare "Table.")', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('question, plain table note, figure caption + type, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(spec.tableNote).toEqual({ kind: 'plain', text: strip(card.match(/<p class="tbl-note">(.*?)<\/p>/s)![1]) })
    expect(card.includes('tbl-note assume')).toBe(false) // plain note, NOT an assumption note
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figures![0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${spec.figures![0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('APA line equals the template with every {placeholder} as __', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__')}”`)
  })
  it('bundle line EQUALS bundleFiles, and the names derive from table ids + figure types', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...spec.figures!.map((f) => `figure_${f.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + constraint lines', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
  })
  it('options equal the inputs card option strip; continuity is the only interactive pill (drawn on)', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['display', 'display', 'toggle'])
    expect(spec.options[2]).toMatchObject({ id: 'continuity', default: true })
  })
})
```

- [ ] **Step 2: Registry entry** — create `src/lib/registry/mannWhitneyU.ts`; `npx vitest run src/lib/registry/mannWhitneyU.consistency.test.ts` → 7/7:

```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Mann-Whitney U cards) — display strings verbatim.
export const MANN_WHITNEY_U: TestSpec = {
  id: 'mann-whitney-u',
  name: 'Mann-Whitney U',
  question: 'nonparametric two-group comparison',
  roles: [
    { id: 'outcome', label: 'Outcome', levels: 'ordinal / interval / ratio', arity: 'exactly 1' },
    { id: 'group', label: 'Grouping var', levels: 'nominal / ordinal', arity: 'exactly 1 · 2 categories' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'tails', label: 'tails', value: 'two', kind: 'display' },
    // Drawn ON. Maps to wilcox.test correct= — only effective on the asymptotic path (spike fact 1).
    { id: 'continuity', label: 'continuity correction', value: 'on', kind: 'toggle', default: true },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'group', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { exact: 2 } },
    ],
    minRule: { kind: 'rows-per-group', n: 3 }, // design §4: same DRAFT rule as the t-test
  },
  tables: [
    { id: 'rank-summary', title: 'Rank summary',
      columns: [{ key: 'group', label: 'Group' }, { key: 'n', label: 'N' }, { key: 'meanRank', label: 'Mean rank' }, { key: 'sumRanks', label: 'Sum of ranks' }] },
    { id: 'mann-whitney', title: 'Mann-Whitney test',
      columns: [{ key: 'u', label: 'U' }, { key: 'z', label: 'Z' }, { key: 'p', label: 'p' }, { key: 'r', label: 'r' }] },
  ],
  tableNote: { kind: 'plain', text: 'r is the rank-biserial effect size.' },
  figures: [{ caption: 'Distribution by group', type: 'boxplot' }],
  howToRead:
    'The nonparametric counterpart to the independent t-test, comparing whole distributions via ranks rather than means. ' +
    "A p below alpha means one group's values tend to be systematically higher or lower (stochastic dominance) — " +
    'this equals a difference in medians only when the two groups have similar distribution shapes. r gives the effect size.',
  apaTemplate: 'A Mann-Whitney U test showed a difference, U={u}, Z={z}, p={p}, r={r}.',
  rMap: 'dplyr rank + group_by/summarise (N, mean rank, sum of ranks) → Table 1 · wilcox.test() → U, p · coin::wilcox_test() → standardized Z · effectsize::rank_biserial() → r · geom_boxplot() → figure',
  bundleFiles: ['table_rank-summary.png', 'table_mann-whitney.png', 'figure_boxplot.png'],
}
```

- [ ] **Step 3: Mutation checks** — prove the net catches drift, then restore: (a) change Table 1's `label: 'Mean rank'` to `'Mean Rank'` → run the suite → MUST FAIL (thead equality); revert. (b) change the tableNote text to `'r is the rank biserial effect size.'` (hyphen dropped) → MUST FAIL; revert. Suite back to 7/7.

- [ ] **Step 4: Failing known-answer stats test** — create `src/lib/stats/mannWhitneyU.test.ts` (fixtures are the spike's exact vectors; network ok — engine.init downloads packages, global hookTimeout 300 s covers it). p assertions use 5–6 dp deliberately: exact (.064935), corrected (.065552) and uncorrected (.054664) differ only in the 3rd–4th decimal, and distinguishing the paths is the point:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runMannWhitneyU } from './mannWhitneyU'
import type { Dataset } from './types'

// Spike fixture ovl12 (overlapping ranges, tie-free): control pooled ranks {6,2,9,4,1,5} → sum 27, U = 6.
const overlap12: Dataset = { columns: ['group', 'score'], rows: [
  { group: 'control', score: 72 }, { group: 'control', score: 68 }, { group: 'control', score: 75 },
  { group: 'control', score: 70 }, { group: 'control', score: 66 }, { group: 'control', score: 71 },
  { group: 'treatment', score: 74 }, { group: 'treatment', score: 79 }, { group: 'treatment', score: 69 },
  { group: 'treatment', score: 83 }, { group: 'treatment', score: 78 }, { group: 'treatment', score: 73 },
] }

// Spike fixture long12 (complete separation; same values as the t-test test's `unequal`) + two listwise rows.
const long12: Dataset = { columns: ['group', 'score'], rows: [
  { group: 'control', score: 72 }, { group: 'control', score: 68 }, { group: 'control', score: 75 },
  { group: 'control', score: 70 }, { group: 'control', score: 66 }, { group: 'control', score: 71 },
  { group: 'treatment', score: 81 }, { group: 'treatment', score: 79 }, { group: 'treatment', score: 85 },
  { group: 'treatment', score: 83 }, { group: 'treatment', score: 78 }, { group: 'treatment', score: 88 },
  { group: 'control', score: null }, { group: null, score: 70 }, // listwise: EXCLUDED, never coerced to 0
] }

describe('runMannWhitneyU', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('overlap12 default run: pooled rank summary, U for the first (alphabetical) level, EXACT p, coin Z, rank-biserial r, boxplot', async () => {
    const r = await runMannWhitneyU(engine, overlap12, 'score', 'group', true)
    expect(r.ranks).toEqual([
      { group: 'control', n: 6, meanRank: 4.5, sumRanks: 27 },
      { group: 'treatment', n: 6, meanRank: 8.5, sumRanks: 51 },
    ])
    expect(r.u).toBe(6)                       // wilcox.test W = U for alphabetical-first 'control'
    expect(r.p).toBeCloseTo(0.064935, 5)      // EXACT path (= 60/924), R 4.6.0 default at these N
    expect(r.z).toBeCloseTo(-1.92154, 4)      // coin asymptotic Z — card mixes exact p with asymptotic Z
    expect(r.rankBiserial).toBeCloseTo(-0.6667, 3)
    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('continuity toggle drives correct= on the asymptotic branch (exact=FALSE): both positions', async () => {
    const on = await runMannWhitneyU(engine, overlap12, 'score', 'group', true, true)
    const off = await runMannWhitneyU(engine, overlap12, 'score', 'group', false, true)
    expect(on.u).toBe(6); expect(off.u).toBe(6)
    expect(on.p).toBeCloseTo(0.065552, 5)
    expect(off.p).toBeCloseTo(0.054664, 5)    // equals the coin-Z normal p (uncorrected)
  })

  it('long12 (complete separation): U=0, exact p=2/924, Z, r=−1, listwise exclusion', async () => {
    const r = await runMannWhitneyU(engine, long12, 'score', 'group', true)
    expect(r.nExcluded).toBe(2)
    expect(r.ranks).toEqual([
      { group: 'control', n: 6, meanRank: 3.5, sumRanks: 21 },
      { group: 'treatment', n: 6, meanRank: 9.5, sumRanks: 57 },
    ])
    expect(r.u).toBe(0)
    expect(r.p).toBeCloseTo(0.0021645, 6)
    expect(r.z).toBeCloseTo(-2.88231, 4)
    expect(r.rankBiserial).toBeCloseTo(-1, 6) // degenerate, complete separation
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('long12 asymptotic branch: corrected vs uncorrected', async () => {
    const on = await runMannWhitneyU(engine, long12, 'score', 'group', true, true)
    const off = await runMannWhitneyU(engine, long12, 'score', 'group', false, true)
    expect(on.p).toBeCloseTo(0.005075, 5)
    expect(off.p).toBeCloseTo(0.003948, 5)
  })
})
```

- [ ] **Step 5: Stats module** — create `src/lib/stats/mannWhitneyU.ts`; `npx vitest run src/lib/stats/mannWhitneyU.test.ts` → 4/4:

```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface RankSummaryRow { group: string; n: number; meanRank: number; sumRanks: number }
export interface MannWhitneyUResult {
  ranks: [RankSummaryRow, RankSummaryRow]
  u: number; z: number; p: number; rankBiserial: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

const R_STATS = String.raw`
g <- factor(group); lv <- levels(g)
df <- data.frame(score = score, g = g)
rk <- rank(score)  # pooled midranks — base equivalent of the card's "dplyr rank + group_by/summarise"
ranks <- lapply(lv, function(l) { v <- rk[g == l]; list(group = l, n = length(v), meanRank = mean(v), sumRanks = sum(v)) })
# Default run keeps wilcox.test's own path choice (R 4.6.0: EXACT at these N, even with ties — spike fact 1).
# correct= only matters on the asymptotic branch; force_approx pins exact=FALSE so the known-answer tests can
# verify both toggle positions (large-N/tied data reaches that branch on its own in real runs).
res <- if (force_approx) wilcox.test(score ~ g, data = df, exact = FALSE, correct = continuity)
       else wilcox.test(score ~ g, data = df, correct = continuity)
# wilcox.test W IS the Mann-Whitney U for the FIRST factor level (alphabetical) — spike-verified.
z <- as.numeric(coin::statistic(coin::wilcox_test(score ~ g, data = df)))  # asymptotic standardized Z (card R map)
r <- as.numeric(effectsize::rank_biserial(score ~ g, data = df)$r_rank_biserial)
list(ranks = ranks, u = unname(res$statistic), z = z, p = res$p.value, rankBiserial = r)`

// Same boxplot as the t-test's (card figure type: boxplot); print() renders into the active png() device.
const R_BOXPLOT = String.raw`
print(ggplot2::ggplot(data.frame(group = factor(group), score = score), ggplot2::aes(group, score)) +
  ggplot2::geom_boxplot(fill = '#9cc2ec', colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL))`

interface RawStats { ranks: RankSummaryRow[]; u: number; z: number; p: number; rankBiserial: number }

/** forceApprox is test-only (and the implicit large-N path): exact=FALSE pins the branch where correct= matters. */
export async function runMannWhitneyU(engine: Engine, data: Dataset, outcome: string, group: string,
  continuity: boolean, forceApprox = false): Promise<MannWhitneyUResult> {
  // Per-test listwise (spec step-4a default): drop rows missing/non-numeric in either role column.
  const rows = data.rows.filter((r) =>
    typeof r[outcome] === 'number' && Number.isFinite(r[outcome] as number) && r[group] != null && String(r[group]).trim() !== '')
  const nExcluded = data.rows.length - rows.length
  const env = { score: rows.map((r) => r[outcome] as number), group: rows.map((r) => String(r[group])), continuity, force_approx: forceApprox }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_BOXPLOT, 600, 450, env)
  return { ranks: [s.ranks[0], s.ranks[1]], u: s.u, z: s.z, p: s.p, rankBiserial: s.rankBiserial, nExcluded, figurePng }
}
```

(`ranks` items are built from `levels(g)` — already character, nothing needs `as.character()` before `.telos_json`.)

- [ ] **Step 6: Failing builder test** — create `src/lib/results/buildMannWhitneyU.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildMannWhitneyU } from './buildMannWhitneyU'
import { MANN_WHITNEY_U as spec } from '../registry/mannWhitneyU'
import type { MannWhitneyUResult } from '../stats/mannWhitneyU'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const overlap: MannWhitneyUResult = { // cross-verified overlap12 numbers
  ranks: [
    { group: 'control', n: 6, meanRank: 4.5, sumRanks: 27 },
    { group: 'treatment', n: 6, meanRank: 8.5, sumRanks: 51 },
  ],
  u: 6, z: -1.92153785, p: 0.0649350649, rankBiserial: -0.666666667, nExcluded: 0, figurePng: png,
}

describe('buildMannWhitneyU', () => {
  const c = buildMannWhitneyU(spec, overlap)
  it('Table 1: per-group rank rows at 2 dp', () => {
    expect(c.tables[0].spec.id).toBe('rank-summary')
    expect(c.tables[0].rows).toEqual([
      { group: 'control', n: 6, meanRank: '4.50', sumRanks: '27.00' },
      { group: 'treatment', n: 6, meanRank: '8.50', sumRanks: '51.00' },
    ])
  })
  it('Table 2: U · Z · p · r with U+2212 minuses (no df, no CI)', () => {
    expect(c.tables[1].rows).toEqual([{ u: '6', z: '−1.92', p: '.065', r: '−0.67' }])
    expect(c.tables[1].spec.columns.map((col) => col.key)).toEqual(['u', 'z', 'p', 'r'])
  })
  it('carries the plain rank-biserial note and the boxplot figure', () => {
    expect(c.note).toEqual({ kind: 'plain', text: 'r is the rank-biserial effect size.' })
    expect(c.figures).toEqual([{ caption: 'Distribution by group', type: 'boxplot', png }])
    expect(c.nExcluded).toBe(0)
  })
  it('fills the APA exemplar (p ≥ .001 branch)', () => {
    expect(c.apa).toBe('A Mann-Whitney U test showed a difference, U=6, Z=−1.92, p=.065, r=−0.67.')
  })
  it('p-clause flips to p<.001; a midrank U renders at 2 dp', () => {
    const c2 = buildMannWhitneyU(spec, { ...overlap, u: 6.5, p: 0.0004 })
    expect(c2.apa).toContain('U=6.50')
    expect(c2.apa).toContain('p<.001')
    expect(c2.tables[1].rows[0].p).toBe('<.001')
  })
})
```

- [ ] **Step 7: Builder** — create `src/lib/results/buildMannWhitneyU.ts`; `npx vitest run src/lib/results/buildMannWhitneyU.test.ts` → 5/5:

```ts
import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { MannWhitneyUResult } from '../stats/mannWhitneyU'
import type { CardContent } from './builders'
import { f, fdf, fp } from '../format/apa'

export function buildMannWhitneyU(spec: TestSpec, r: MannWhitneyUResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{u}', fdf(r.u)).replace('{z}', f(r.z))
    .replace('p={p}', r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`)
    .replace('{r}', f(r.rankBiserial))
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: r.ranks.map((g) => ({ group: g.group, n: g.n, meanRank: f(g.meanRank), sumRanks: f(g.sumRanks) })) },
      { spec: spec.tables[1], rows: [{ u: fdf(r.u), z: f(r.z), p: fp(r.p), r: f(r.rankBiserial) }] },
    ],
    note: spec.tableNote ?? null,
    figures: [{ caption: fig.caption, type: fig.type, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
```

- [ ] **Step 8: Register + catalog** — three appends:

(a) `src/lib/results/builders.ts` — add the import next to the t-test's and one entry in EACH map:
```ts
import { runMannWhitneyU, type MannWhitneyUResult } from '../stats/mannWhitneyU'
import { buildMannWhitneyU } from './buildMannWhitneyU'
```
```ts
  'mann-whitney-u': (engine, ds, setup) =>
    runMannWhitneyU(engine, ds, setup.roles['outcome'][0], setup.roles['group'][0], setup.options['continuity'] as boolean),
```
```ts
  'mann-whitney-u': (spec, result) => buildMannWhitneyU(spec, result as MannWhitneyUResult),
```
(The adapter never passes `forceApprox` — real runs always take R's default exact/approx choice.)

(b) `src/lib/registry/catalog.ts` — flip the entry to available and register the spec:
```ts
  e('mann-whitney-u', 'Mann-Whitney U', 'Group comparisons', 'Nonparametric', 'available'),
```
add `import { MANN_WHITNEY_U } from './mannWhitneyU'` and `[MANN_WHITNEY_U.id]: MANN_WHITNEY_U` inside `SPECS`.

(c) `src/lib/registry/catalog.consistency.test.ts` — ADD `'mann-whitney-u'` to the expected available-ids array. Tasks execute in order and this array grows cumulatively, one id per test task; the filter preserves CATALOG document order, so insert it at its catalog position (after whichever of `summary-statistics`/`frequencies-crosstabs`/`distribution-normality`/`one-sample-t-test`/`independent-t-test`/`paired-t-test` are already present, before `wilcoxon-signed-rank` if it lands later). Update the it-description if it still counts the tests.

- [ ] **Step 9: Verify everything** — `npx vitest run src/lib/registry/mannWhitneyU.consistency.test.ts src/lib/stats/mannWhitneyU.test.ts src/lib/results/buildMannWhitneyU.test.ts` → 16/16; full `npm test` green (+16 over the pre-task count, catalog test still green); `npx tsc -b` → 0.

- [ ] **Step 10: Commit**
```bash
git add src/lib/registry/mannWhitneyU.ts src/lib/registry/mannWhitneyU.consistency.test.ts src/lib/stats/mannWhitneyU.ts src/lib/stats/mannWhitneyU.test.ts src/lib/results/buildMannWhitneyU.ts src/lib/results/buildMannWhitneyU.test.ts src/lib/results/builders.ts src/lib/registry/catalog.ts src/lib/registry/catalog.consistency.test.ts
git commit -m "feat: mann-whitney-u — registry, stats, builder (card-faithful)"
```

## Task 8: Wilcoxon signed-rank

**Files:** Create `src/lib/registry/wilcoxonSignedRank.ts`, `src/lib/registry/wilcoxonSignedRank.consistency.test.ts`, `src/lib/stats/wilcoxonSignedRank.ts`, `src/lib/stats/wilcoxonSignedRank.test.ts`, `src/lib/results/buildWilcoxonSignedRank.ts`, `src/lib/results/buildWilcoxonSignedRank.test.ts`; modify `src/lib/results/builders.ts`, `src/lib/registry/catalog.ts`, `src/lib/registry/catalog.consistency.test.ts`

Card facts encoded here: Table 1 "Rank summary" (Sign · N · Mean rank · Sum of ranks; rows Positive/Negative/Ties from `rank(abs(d))` split by `sign(d)`, per the card's R map); Table 2 "Signed-rank test" with the LITERAL `V / W` header; both captions NUMBERED (no `captionStyle`); **no table note** (asserted ABSENT — design ruling); figure "Change per case", type `difference` (bundle `figure_difference.png`); the APA line faithfully omits V/W — only Z, p, r (flagged to Benjie, built as drawn). The continuity pill (drawn **on**) is the interactive toggle and maps to `wilcox.test(correct=)` — per spike fact 1 it matters ONLY on the asymptotic path, so its known-answer tests pass `exact=FALSE` explicitly; the Z column always comes from `coin` (asymptotic). **APA template (explicit):** `'A Wilcoxon signed-rank test showed a change, Z={z}, p={p}, r={r}.'` — the consistency test asserts the card's exemplar line contains every fixed fragment (the t-test plan's approach for templates that can't byte-match).

- [ ] **Step 1: Failing consistency test** — create `src/lib/registry/wilcoxonSignedRank.consistency.test.ts` (fails: module doesn't exist yet):

```ts
import { describe, it, expect } from 'vitest'
import { WILCOXON_SIGNED_RANK as spec } from './wilcoxonSignedRank'
import { figuresOf } from './types'
import { readSpec, strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readSpec('telos_test_outputs.html')
const card = outputsHtml.slice(outputsHtml.indexOf('Wilcoxon signed-rank</span>'), outputsHtml.indexOf('Kruskal-Wallis</span>'))
const inputsHtml = readSpec('telos_test_inputs.html')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Wilcoxon signed-rank</div>'), inputsHtml.indexOf('<div class="ttl">Kruskal-Wallis</div>'))

describe('wilcoxon-signed-rank registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences — including the literal "V / W" header', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => t[1]))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}<sub>${c.sub}</sub>` : c.label))))
  })
  it('table titles equal the card captions, both NUMBERED (no bare captionStyle)', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.map((t) => t.captionStyle)).toEqual([undefined, undefined])
  })
  it('question, figure caption, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(figuresOf(spec)[0].caption)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('the drawn card has NO table note — and neither does the registry entry', () => {
    expect(card).not.toMatch(/class="tbl-note/)
    expect(spec.tableNote).toBeUndefined()
  })
  it('the card APA exemplar contains every fixed fragment of the registry template (Z, p, r only — no V/W, as drawn)', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    for (const frag of spec.apaTemplate.split(/\{[a-z]+\}/)) expect(line).toContain(frag)
  })
  it('bundle line EQUALS bundleFiles, and the names derive from table ids + figure type', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...figuresOf(spec).map((g) => `figure_${g.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + constraint lines; machine mirror matches the drawn arity', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
    expect(spec.constraints.roles).toEqual([
      { roleId: 'conditionA', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'conditionB', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
    ])
    expect(spec.constraints.minRule).toEqual({ kind: 'complete-pairs', n: 3 })
  })
  it('options equal the inputs card option strip; only continuity is interactive (toggle, drawn on)', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['display', 'display', 'toggle'])
    expect(spec.options[2]).toMatchObject({ id: 'continuity', default: true })
  })
})
```

- [ ] **Step 2: Registry entry** — create `src/lib/registry/wilcoxonSignedRank.ts`; then `npx vitest run src/lib/registry/wilcoxonSignedRank.consistency.test.ts` → 8/8:

```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html (Wilcoxon signed-rank card) + telos_test_inputs.html (roles, option strip).
export const WILCOXON_SIGNED_RANK: TestSpec = {
  id: 'wilcoxon-signed-rank',
  name: 'Wilcoxon signed-rank',
  question: 'nonparametric paired comparison',
  roles: [
    { id: 'conditionA', label: 'Condition A', levels: 'ordinal / interval / ratio', arity: 'exactly 1' },
    { id: 'conditionB', label: 'Condition B', levels: 'ordinal / interval / ratio', arity: 'exactly 1' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'tails', label: 'tails', value: 'two', kind: 'display' },
    // Maps to wilcox.test(correct=); matters only on the asymptotic path — the default path is EXACT at small N (spike fact 1).
    { id: 'continuity', label: 'continuity correction', value: 'on', kind: 'toggle', default: true },
  ],
  constraints: {
    roles: [
      { roleId: 'conditionA', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'conditionB', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
    ],
    minRule: { kind: 'complete-pairs', n: 3 }, // design ruling: ≥3 complete pairs (Paired, Wilcoxon)
  },
  tables: [
    { id: 'rank-summary', domId: 'wilcoxon-rank-summary', title: 'Rank summary', // domId: '#table-rank-summary' would collide with Mann-Whitney on a combined page
      columns: [{ key: 'sign', label: 'Sign' }, { key: 'n', label: 'N' }, { key: 'meanRank', label: 'Mean rank' }, { key: 'sumRanks', label: 'Sum of ranks' }] },
    { id: 'signed-rank', title: 'Signed-rank test',
      columns: [{ key: 'v', label: 'V / W' }, { key: 'z', label: 'Z' }, { key: 'p', label: 'p' }, { key: 'r', label: 'r' }] },
  ],
  // NO tableNote: the drawn Wilcoxon card has no note under either table (design ruling; consistency test asserts the absence).
  figures: [{ caption: 'Change per case', type: 'difference' }],
  howToRead:
    'The nonparametric counterpart to the paired t-test. It ranks the size of each paired change; a p below alpha means a systematic shift ' +
    'between the two conditions, with r as the effect size. The shift maps to the median difference only when the within-pair differences are ' +
    'roughly symmetric; the sign of the median difference (or Hodges–Lehmann estimate) gives the direction.',
  // Faithful to the drawn card: the APA line reports only Z, p, r — it omits the V/W its own Table 2 shows (flagged to Benjie, built as drawn).
  apaTemplate: 'A Wilcoxon signed-rank test showed a change, Z={z}, p={p}, r={r}.',
  rMap: 'rank(abs(d)) split by sign(d) → Table 1 (per-sign N / mean rank / sum of ranks) · wilcox.test(paired=TRUE) → V, p · coin::wilcoxsign_test() → standardized Z · effectsize::rank_biserial(paired=TRUE) → r',
  bundleFiles: ['table_rank-summary.png', 'table_signed-rank.png', 'figure_difference.png'],
}
```

- [ ] **Step 3: Mutation checks** — prove the consistency suite bites: (1) change Table 2's first column label `'V / W'` → `'V/W'`, run the suite → MUST FAIL (thead equality); revert. (2) add `tableNote: { kind: 'plain', text: 'r is the rank-biserial effect size.' }` to the entry, run → MUST FAIL (the no-note assertion); revert. Run once more → 8/8 PASS.

- [ ] **Step 4: Failing stats known-answer test** — create `src/lib/stats/wilcoxonSignedRank.test.ts` (cross-verified numbers: WebR R 4.6.0 + native R 4.6.0 identical; network ok for engine init):

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runWilcoxonSignedRank } from './wilcoxonSignedRank'
import type { Dataset } from './types'

// pre6/post6 (diffs A−B = −9,−11,−10,−13,−12,−17: no ties, no zeros) + two incomplete rows (listwise pairs: EXCLUDED, never coerced).
const paired: Dataset = { columns: ['pre', 'post'], rows: [
  { pre: 72, post: 81 }, { pre: 68, post: 79 }, { pre: 75, post: 85 }, { pre: 70, post: 83 }, { pre: 66, post: 78 }, { pre: 71, post: 88 },
  { pre: null, post: 90 }, { pre: 70, post: 'absent' },
] }

// Spike's tiedpre6/tiedpost6 diffs A−B = −2,−1,−3,+1,−3,−6 (tied |d|: {1,1} and {3,3} → midranks). Signed-rank stats depend only on the diffs.
const tied: Dataset = { columns: ['pre', 'post'], rows: [
  { pre: 10, post: 12 }, { pre: 10, post: 11 }, { pre: 10, post: 13 }, { pre: 10, post: 9 }, { pre: 10, post: 13 }, { pre: 10, post: 16 },
] }

describe('runWilcoxonSignedRank', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('default path: exact p, coin Z, rank-biserial r, per-sign rank summary, listwise pairs, difference figure', async () => {
    const r = await runWilcoxonSignedRank(engine, paired, 'pre', 'post', true)
    expect(r.nExcluded).toBe(2)
    expect(r.ranks).toEqual([
      { sign: 'Positive', n: 0, meanRank: null, sumRanks: 0 },
      { sign: 'Negative', n: 6, meanRank: 3.5, sumRanks: 21 },
      { sign: 'Ties', n: 0, meanRank: null, sumRanks: 0 },
    ])
    expect(r.v).toBe(0)
    expect(r.p).toBeCloseTo(0.03125, 5)      // exact 2/64 — 'Wilcoxon signed rank exact test'
    expect(r.method).toContain('exact')
    expect(r.z).toBeCloseTo(-2.20140, 4)     // coin::wilcoxsign_test (asymptotic) — card-specified mix with the exact p
    expect(r.r).toBeCloseTo(-1, 6)           // rank_biserial: complete separation
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('continuity toggle maps to correct= on the asymptotic path (exact=FALSE): both positions', async () => {
    const on = await runWilcoxonSignedRank(engine, paired, 'pre', 'post', true, true)
    expect(on.v).toBe(0)
    expect(on.p).toBeCloseTo(0.03603, 4)
    const off = await runWilcoxonSignedRank(engine, paired, 'pre', 'post', false, true)
    expect(off.p).toBeCloseTo(0.02771, 4)    // = the coin Z p (uncorrected normal approximation)
    expect(off.z).toBeCloseTo(-2.20140, 4)   // Z ignores correct= — always coin's standardized statistic
  })

  it('tied diffs: midrank V=1.5, exact-with-ties p (R 4.6.0 — spike-verified in BOTH environments, no warning)', async () => {
    const r = await runWilcoxonSignedRank(engine, tied, 'pre', 'post', true)
    expect(r.ranks).toEqual([
      { sign: 'Positive', n: 1, meanRank: 1.5, sumRanks: 1.5 },
      { sign: 'Negative', n: 5, meanRank: 3.9, sumRanks: 19.5 },
      { sign: 'Ties', n: 0, meanRank: null, sumRanks: 0 },
    ])
    expect(r.v).toBe(1.5)
    expect(r.p).toBeCloseTo(0.09375, 5)      // exact 6/64 — verified by full 2^6 sign-flip enumeration
    expect(r.method).toContain('exact')
    expect(r.z).toBeCloseTo(-1.89737, 4)
    expect(r.r).toBeCloseTo(-0.857143, 5)
    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('tied diffs, asymptotic path: both continuity positions', async () => {
    const on = await runWilcoxonSignedRank(engine, tied, 'pre', 'post', true, true)
    expect(on.v).toBe(1.5)
    expect(on.p).toBeCloseTo(0.07314, 4)
    const off = await runWilcoxonSignedRank(engine, tied, 'pre', 'post', false, true)
    expect(off.p).toBeCloseTo(0.05778, 4)
  })
})
```

- [ ] **Step 5: Stats module** — create `src/lib/stats/wilcoxonSignedRank.ts`; then `npx vitest run src/lib/stats/wilcoxonSignedRank.test.ts` → 4/4:

```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

const R_STATS = String.raw`
d <- a - b
rk <- rank(abs(d)); sg <- sign(d)
srow <- function(label, idx) list(sign=label, n=length(idx),
  meanRank=if (length(idx)) mean(rk[idx]) else NA_real_, sumRanks=sum(rk[idx]))
# Default path: R decides exact vs approx (R 4.6.0: EXACT even with ties — spike fact 1).
# force_approx is the known-answer hook for the asymptotic path, where correct= (the continuity pill) matters.
wt <- if (force_approx) wilcox.test(a, b, paired=TRUE, exact=FALSE, correct=continuity)
      else wilcox.test(a, b, paired=TRUE, correct=continuity)
zt <- coin::wilcoxsign_test(a ~ b)
rb <- effectsize::rank_biserial(a, b, paired=TRUE)
list(ranks=list(srow('Positive', which(sg > 0)), srow('Negative', which(sg < 0)), srow('Ties', which(sg == 0))),
  v=unname(wt$statistic), z=as.numeric(coin::statistic(zt)), p=wt$p.value,
  r=rb$r_rank_biserial, method=wt$method)`

// Difference plot ("Change per case", type: difference) — ggplot2 per the architecture doc; print() renders into png().
const R_DIFFPLOT = String.raw`
print(ggplot2::ggplot(data.frame(case = factor(seq_along(a)), d = a - b), ggplot2::aes(case, d)) +
  ggplot2::geom_col(fill = '#9cc2ec', colour = '#0c447c') +
  ggplot2::geom_hline(yintercept = 0, colour = '#0c447c') +
  ggplot2::labs(x = 'Case', y = 'Difference (A - B)'))`

export interface SignedRankRow { sign: 'Positive' | 'Negative' | 'Ties'; n: number; meanRank: number | null; sumRanks: number }
export interface WilcoxonSignedRankResult {
  ranks: [SignedRankRow, SignedRankRow, SignedRankRow]   // Positive, Negative, Ties — card row order
  v: number; z: number; p: number; r: number; method: string
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}
interface RawStats { ranks: SignedRankRow[]; v: number; z: number; p: number; r: number; method: string }

export async function runWilcoxonSignedRank(
  engine: Engine, data: Dataset, conditionA: string, conditionB: string, continuity: boolean, forceApprox = false,
): Promise<WilcoxonSignedRankResult> {
  // Complete pairs (card's missing-data unit): keep rows where BOTH condition columns are numeric-finite.
  const rows = data.rows.filter((r) =>
    typeof r[conditionA] === 'number' && Number.isFinite(r[conditionA] as number) &&
    typeof r[conditionB] === 'number' && Number.isFinite(r[conditionB] as number))
  const nExcluded = data.rows.length - rows.length
  const env = { a: rows.map((r) => r[conditionA] as number), b: rows.map((r) => r[conditionB] as number), continuity, force_approx: forceApprox }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_DIFFPLOT, 600, 450, env)
  return { ranks: [s.ranks[0], s.ranks[1], s.ranks[2]], v: s.v, z: s.z, p: s.p, r: s.r, method: s.method, nExcluded, figurePng }
}
```

- [ ] **Step 6: Failing builder test** — create `src/lib/results/buildWilcoxonSignedRank.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildWilcoxonSignedRank } from './buildWilcoxonSignedRank'
import { WILCOXON_SIGNED_RANK as spec } from '../registry/wilcoxonSignedRank'
import type { WilcoxonSignedRankResult } from '../stats/wilcoxonSignedRank'

// pre6/post6 verified numbers (V=0, exact p=.03125, coin Z=−2.20139816, r=−1) + 2 excluded pairs.
const base: WilcoxonSignedRankResult = {
  ranks: [
    { sign: 'Positive', n: 0, meanRank: null, sumRanks: 0 },
    { sign: 'Negative', n: 6, meanRank: 3.5, sumRanks: 21 },
    { sign: 'Ties', n: 0, meanRank: null, sumRanks: 0 },
  ],
  v: 0, z: -2.20139816, p: 0.03125, r: -1, method: 'Wilcoxon signed rank exact test',
  nExcluded: 2, figurePng: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>,
}

describe('buildWilcoxonSignedRank', () => {
  const c = buildWilcoxonSignedRank(spec, base)
  it('Table 1: per-sign rows, em-dash mean rank for empty signs', () => {
    expect(c.tables[0].spec.id).toBe('rank-summary')
    expect(c.tables[0].rows).toEqual([
      { sign: 'Positive', n: 0, meanRank: '—', sumRanks: '0.00' },
      { sign: 'Negative', n: 6, meanRank: '3.50', sumRanks: '21.00' },
      { sign: 'Ties', n: 0, meanRank: '—', sumRanks: '0.00' },
    ])
  })
  it('Table 2: one row under the literal V / W header, U+2212 minuses', () => {
    expect(c.tables[1].rows).toEqual([{ v: '0.00', z: '−2.20', p: '.031', r: '−1.00' }])
  })
  it('NO note (the drawn card has none); excluded pairs and how-to-read carry through', () => {
    expect(c.note).toBeNull()
    expect(c.nExcluded).toBe(2)
    expect(c.howToRead).toBe(spec.howToRead)
  })
  it('APA omits V/W — only Z, p, r, exactly as drawn', () => {
    expect(c.apa).toBe('A Wilcoxon signed-rank test showed a change, Z=−2.20, p=.031, r=−1.00.')
  })
  it('figure carries the difference type for alt-text and export naming', () => {
    expect(c.figures).toEqual([{ caption: 'Change per case', type: 'difference', png: base.figurePng }])
  })
  it('p-clause branch: tiny p renders p<.001 in table and sentence; midrank V keeps 2 dp', () => {
    const c2 = buildWilcoxonSignedRank(spec, { ...base, v: 1.5, p: 0.0002 })
    expect(c2.tables[1].rows[0]).toMatchObject({ v: '1.50', p: '<.001' })
    expect(c2.apa).toContain('Z=−2.20, p<.001, r=−1.00.')
  })
})
```

- [ ] **Step 7: Builder** — create `src/lib/results/buildWilcoxonSignedRank.ts`; then `npx vitest run src/lib/results/buildWilcoxonSignedRank.test.ts` → 6/6:

```ts
import type { TestSpec } from '../registry/types'
import type { CardContent } from './builders'
import type { WilcoxonSignedRankResult } from '../stats/wilcoxonSignedRank'
import { f, fp, fx } from '../format/apa'

export function buildWilcoxonSignedRank(spec: TestSpec, r: WilcoxonSignedRankResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{z}', f(r.z))
    .replace('p={p}', r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`)
    .replace('{r}', f(r.r))
  const fig = spec.figures![0]
  return {
    tables: [
      { spec: spec.tables[0], rows: r.ranks.map((row) => ({ sign: row.sign, n: row.n, meanRank: fx(row.meanRank, f), sumRanks: f(row.sumRanks) })) },
      { spec: spec.tables[1], rows: [{ v: f(r.v), z: f(r.z), p: fp(r.p), r: f(r.r) }] },
    ],
    note: null, // the drawn Wilcoxon card has no table note (design ruling)
    figures: [{ caption: fig.caption, type: fig.type, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
```

- [ ] **Step 8: Register + catalog flip** — three files:

1. `src/lib/results/builders.ts` — APPEND the imports and one entry per map (the adapter maps `TestSetup` roles arrays/options to the stats args; `forceApprox` stays at its default — the UI never forces the asymptotic path):

```ts
import { runWilcoxonSignedRank, type WilcoxonSignedRankResult } from '../stats/wilcoxonSignedRank'
import { buildWilcoxonSignedRank } from './buildWilcoxonSignedRank'
```
```ts
  // in RUNNERS:
  'wilcoxon-signed-rank': (engine, ds, setup) =>
    runWilcoxonSignedRank(engine, ds, setup.roles['conditionA'][0], setup.roles['conditionB'][0], setup.options['continuity'] as boolean),
  // in BUILDERS:
  'wilcoxon-signed-rank': (spec, result) => buildWilcoxonSignedRank(spec, result as WilcoxonSignedRankResult),
```

2. `src/lib/registry/catalog.ts` — flip the entry to available and add the spec: the line `e('wilcoxon-signed-rank', 'Wilcoxon signed-rank', 'Group comparisons', 'Nonparametric')` becomes `e('wilcoxon-signed-rank', 'Wilcoxon signed-rank', 'Group comparisons', 'Nonparametric', 'available')`; add `import { WILCOXON_SIGNED_RANK } from './wilcoxonSignedRank'` and the SPECS entry `[WILCOXON_SIGNED_RANK.id]: WILCOXON_SIGNED_RANK,`.

3. `src/lib/registry/catalog.consistency.test.ts` — ADD `'wilcoxon-signed-rank'` to the expected available-ids array. Tasks execute in order and the array grows cumulatively: by this task it already holds `'independent-t-test'` plus every id Tasks 5–7 flipped — do NOT remove any. Insert `'wilcoxon-signed-rank'` immediately AFTER `'mann-whitney-u'` (the filter emits CATALOG document order, and wilcoxon-signed-rank directly follows mann-whitney-u in the tree).

- [ ] **Step 9: Verify** — `npx vitest run src/lib/registry/wilcoxonSignedRank.consistency.test.ts src/lib/stats/wilcoxonSignedRank.test.ts src/lib/results/buildWilcoxonSignedRank.test.ts` → 18/18; full `npm test` green (cumulative count grows by 18 over Task 7's total); `npx tsc -b` → 0.

- [ ] **Step 10: Commit**
```bash
git add src/lib/registry src/lib/stats src/lib/results
git commit -m "feat: wilcoxon-signed-rank — registry, stats, builder (card-faithful)"
```

## Task 9: Distribution & normality

**Files:** Create `src/lib/registry/distributionNormality.ts`, `src/lib/registry/distributionNormality.consistency.test.ts`, `src/lib/stats/distributionNormality.ts`, `src/lib/stats/distributionNormality.test.ts`, `src/lib/results/buildDistributionNormality.ts`, `src/lib/results/buildDistributionNormality.test.ts`; modify `src/lib/registry/specHtml.ts` (decode additions — skip if already present), `src/lib/results/builders.ts`, `src/lib/registry/catalog.ts`, `src/lib/registry/catalog.consistency.test.ts`

**Known answers (long12 = the sample's 12 scores; spike `wf_fe92c580-dcb`, WebR ≡ native R 4.6.0):** Shapiro-Wilk W = 0.963261809, p = 0.829180865 · Lilliefors D = 0.146181269, p = 0.681426721. Card shape: ONE bare-caption table (Test · Statistic · N · p, two rows), plain note, TWO figures (histogram + Q–Q) drawn as one figbox but exported as two files (`figure_histogram.png` · `figure_qq.png`) → two `FigureSpec`s sharing the caption. **apaTemplate (stated):** `'Normality was assessed with the Shapiro-Wilk test, W = {w}, p = {p}.'` — replacing both placeholders with `__` re-yields the card's exemplar byte-for-byte, so the consistency test asserts full equality, not just fragments.

- [ ] **Step 1: Extend `decode` in `src/lib/registry/specHtml.ts`** (skip if an earlier task already added these) — this card's how-to-read uses `&gt;` and its APA exemplar uses `&nbsp;`; neither is in the decoder. Insert before the final `&amp;` rule (which must stay last):

```ts
  .replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
```
Additive and safe: the locked t-test card regions contain none of these entities (verified), so the existing consistency tests are untouched.

- [ ] **Step 2: Failing consistency test** — `src/lib/registry/distributionNormality.consistency.test.ts` (fails: the registry module doesn't exist yet):

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { DISTRIBUTION_NORMALITY as spec } from './distributionNormality'
import { figuresOf } from './types'
import { decode, strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Distribution &amp; normality</span>'), outputsHtml.indexOf('One-sample t-test</span>'))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Distribution &amp; normality</div>'), inputsHtml.indexOf('<div class="ttl">Independent t-test</div>'))

describe('distribution-normality registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('the single thead equals the card column sequence', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => t[1]))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}<sub>${c.sub}</sub>` : c.label))))
  })
  it('the card prints a bare "Table." caption and the title matches', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables[0].captionStyle).toBe('bare')
  })
  it('ghost row labels pin the builder strings — the K–S row label carries the en-dash', () => {
    const ghost = card.match(/<tbody class="ghost">(.*?)<\/tbody>/s)![1]
    expect([...ghost.matchAll(/<tr><td>(.*?)<\/td>/g)].map((m) => decode(m[1]))).toEqual(['Shapiro-Wilk', 'K–S (Lilliefors)'])
  })
  it('question, plain table note, how-to-read and R map match verbatim; no assume note', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(strip(card.match(/<p class="tbl-note">(.*?)<\/p>/s)![1])).toBe(spec.tableNote!.text)
    expect(spec.tableNote!.kind).toBe('plain')
    expect(spec.assumptionNote).toBeUndefined()
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('one drawn figbox ("histogram + Q–Q plot") ↔ two FigureSpecs sharing the caption, neither optional', () => {
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe('Distribution shape')
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe('type: histogram + Q–Q plot')
    expect(figuresOf(spec)).toEqual([{ caption: 'Distribution shape', type: 'histogram' }, { caption: 'Distribution shape', type: 'qq' }])
  })
  it('the APA template re-yields the card exemplar when placeholders become __', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace('{w}', '__').replace('{p}', '__')}”`)
  })
  it('bundle line EQUALS bundleFiles, and the names derive from table ids + figure types', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...figuresOf(spec).map((g) => `figure_${g.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('role equals the inputs card slot label + constraint line; machine constraints mirror it', () => {
    expect([...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))).toEqual(spec.roles.map((r) => r.label))
    expect([...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
    expect(spec.constraints).toEqual({ roles: [{ roleId: 'variable', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } }], minRule: { kind: 'values', n: 3 } })
  })
  it('options equal the inputs card option strip — both display-only pills', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.every((o) => o.kind === 'display')).toBe(true)
  })
})
```

- [ ] **Step 3: Create `src/lib/registry/distributionNormality.ts`** — all display strings verbatim from the cards (entities decoded: `&amp;`→&, `&ndash;`→–, `&mdash;`→—, `&gt;`→>, `&nbsp;`→space):

```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html (Distribution & normality card) + telos_test_inputs.html (role slot, option strip).
export const DISTRIBUTION_NORMALITY: TestSpec = {
  id: 'distribution-normality',
  name: 'Distribution & normality',
  question: 'is a variable normally distributed?',
  roles: [
    { id: 'variable', label: 'Variable', levels: 'interval / ratio', arity: 'exactly 1' },
  ],
  options: [ // descriptive card: no α/tails/CI; both pills display-only this slice (design ruling — only μ₀ and continuity correction are interactive)
    { id: 'normalityTests', label: 'normality tests', value: 'Shapiro-Wilk + K–S', kind: 'display' },
    { id: 'bins', label: 'bins', value: 'auto', kind: 'display' },
  ],
  constraints: {
    roles: [{ roleId: 'variable', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } }],
    minRule: { kind: 'values', n: 3 }, // Shapiro-Wilk lower bound (design §constraints: N≥3 single column)
  },
  tables: [
    { id: 'normality', title: 'Normality tests', captionStyle: 'bare', // the card prints bare "Table."
      columns: [{ key: 'test', label: 'Test' }, { key: 'statistic', label: 'Statistic' }, { key: 'n', label: 'N' }, { key: 'p', label: 'p' }] },
  ],
  tableNote: { kind: 'plain', text: 'skewness & kurtosis are reported alongside; Shapiro-Wilk applies for 3–5000 cases.' },
  figures: [ // one drawn figbox, two exported files (bundle line) → two specs sharing the caption
    { caption: 'Distribution shape', type: 'histogram' },
    { caption: 'Distribution shape', type: 'qq' },
  ],
  howToRead:
    'A small p (below .05) suggests the data depart from normality. With large samples these tests over-flag trivial deviations; ' +
    'with small samples they have low power, so a p > .05 does not prove normality — it only means no departure was detected. ' +
    'Either way, judge normality mainly from the Q–Q plot — points hugging the diagonal indicate normality.',
  apaTemplate: 'Normality was assessed with the Shapiro-Wilk test, W = {w}, p = {p}.',
  rMap: 'shapiro.test() (returns W, p) / nortest::lillie.test() (returns D, p) → table · ggplot2 + stat_qq() → figures',
  bundleFiles: ['table_normality.png', 'figure_histogram.png', 'figure_qq.png'],
}
```

- [ ] **Step 4: Run + mutation check** — `npx vitest run src/lib/registry/distributionNormality.consistency.test.ts` → 9/9. Then prove the net catches drift: (a) in the registry change the note's `3–5000` to ASCII `3-5000` → suite MUST fail (note test); revert. (b) change `figures[1].type` `'qq'` → `'q-q'` → suite MUST fail (bundle-derivation test); revert. Re-run → 9/9 PASS.

- [ ] **Step 5: Failing known-answer stats test** — `src/lib/stats/distributionNormality.test.ts` (network ok; engine init covered by hookTimeout 300s):

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runDistributionNormality } from './distributionNormality'
import type { Dataset } from './types'

// long12 = the sample's 12 scores. Cross-verified (spike wf_fe92c580-dcb): WebR R 4.6.0 ≡ native R 4.6.0 on every digit.
const scores = [72, 68, 75, 70, 66, 71, 81, 79, 85, 83, 78, 88]
const data: Dataset = { columns: ['score'], rows: [
  ...scores.map((score) => ({ score })),
  { score: null }, { score: 'n/a' }, // single-column drop: both rows EXCLUDED, never coerced to 0
] }

describe('runDistributionNormality', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('long12 known answers: Shapiro W/p + Lilliefors D/p, single-column drop, both PNGs', async () => {
    const r = await runDistributionNormality(engine, data, 'score')
    expect(r.nExcluded).toBe(2)
    expect(r.n).toBe(12)
    expect(r.shapiro.W).toBeCloseTo(0.9633, 3)   // 0.963261809
    expect(r.shapiro.p).toBeCloseTo(0.8292, 3)   // 0.829180865
    expect(r.ks.D).toBeCloseTo(0.1462, 3)        // 0.146181269
    expect(r.ks.p).toBeCloseTo(0.6814, 3)        // 0.681426721
    expect(Array.from(r.histogramPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(Array.from(r.qqPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('N above 5000 → Shapiro nulls (outside 3–5000), K–S still reports (structural — no unverified numbers)', async () => {
    const big: Dataset = { columns: ['x'], rows: Array.from({ length: 5001 }, (_, i) => ({ x: ((i * 37) % 1000) + i / 5001 })) }
    const r = await runDistributionNormality(engine, big, 'x')
    expect(r.n).toBe(5001)
    expect(r.shapiro).toEqual({ W: null, p: null })
    expect(r.ks.D).toBeGreaterThan(0)
    expect(r.ks.p).toBeGreaterThanOrEqual(0)
    expect(r.ks.p).toBeLessThanOrEqual(1)
    expect(Array.from(r.histogramPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(Array.from(r.qqPng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('N = 4 (minRule admits 3): Shapiro runs, Lilliefors guarded null below its n = 5 floor (structural)', async () => {
    const r = await runDistributionNormality(engine, { columns: ['x'], rows: [66, 72, 79, 88].map((x) => ({ x })) }, 'x')
    expect(r.shapiro.W).not.toBeNull()
    expect(r.ks).toEqual({ D: null, p: null })
  })
})
```

- [ ] **Step 6: Implement `src/lib/stats/distributionNormality.ts`** — runner-shaped, env-passed vector like the t-test module (no factors here, so the as.character rule is N/A); `NA_real_` serializes to JSON null via `.telos_json`:

```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

// Card R map: shapiro.test() / nortest::lillie.test() → table · ggplot2 + stat_qq() → figures.
// Shapiro-Wilk applies for 3–5000 cases (card note) — outside that range it reports nulls (builder renders em-dashes).
// nortest::lillie.test stops below n = 5 ("sample size must be greater than 4") — guarded the same way,
// because minRule admits N = 3 and the runner must not crash on eligible data.
const R_STATS = String.raw`
n <- length(x)
sh <- if (n >= 3 && n <= 5000) shapiro.test(x) else NULL
ks <- if (n >= 5) nortest::lillie.test(x) else NULL
list(n = n,
  shapiro = if (is.null(sh)) list(W = NA_real_, p = NA_real_) else list(W = unname(sh$statistic), p = sh$p.value),
  ks = if (is.null(ks)) list(D = NA_real_, p = NA_real_) else list(D = unname(ks$statistic), p = ks$p.value))`

// ggplot2 objects must be print()ed to reach the active png() device. bins = 30 IS ggplot2's "auto"
// default (the bins pill), passed explicitly to silence the advisory message.
const R_HISTOGRAM = String.raw`
print(ggplot2::ggplot(data.frame(x = x), ggplot2::aes(x)) +
  ggplot2::geom_histogram(bins = 30, fill = '#9cc2ec', colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL))`

const R_QQ = String.raw`
print(ggplot2::ggplot(data.frame(x = x), ggplot2::aes(sample = x)) +
  ggplot2::stat_qq(colour = '#0c447c') + ggplot2::stat_qq_line(colour = '#9cc2ec') +
  ggplot2::labs(x = NULL, y = NULL))`

interface RawStats { n: number; shapiro: { W: number | null; p: number | null }; ks: { D: number | null; p: number | null } }
export interface DistributionNormalityResult extends RawStats {
  nExcluded: number
  histogramPng: Uint8Array<ArrayBuffer>
  qqPng: Uint8Array<ArrayBuffer>
}

export async function runDistributionNormality(engine: Engine, data: Dataset, variable: string): Promise<DistributionNormalityResult> {
  // Single-column drop (the card's missing-data unit under the global R2 policy): keep numeric-finite values only.
  const values = data.rows.map((r) => r[variable]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  const nExcluded = data.rows.length - values.length
  const env = { x: values }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const histogramPng = await engine.capturePlot(R_HISTOGRAM, 600, 450, env)
  const qqPng = await engine.capturePlot(R_QQ, 600, 450, env)
  return { ...s, nExcluded, histogramPng, qqPng }
}
```

- [ ] **Step 7: Run the stats suite** — `npx vitest run src/lib/stats/distributionNormality.test.ts` → 3/3 (first run downloads packages; hookTimeout covers it).

- [ ] **Step 8: Failing builder test** — `src/lib/results/buildDistributionNormality.test.ts` (synthetic typed result, exact formatted cells; W/D/p are non-negative so no U+2212 arises — `f` still routes through `minus`):

```ts
import { describe, it, expect } from 'vitest'
import { buildDistributionNormality } from './buildDistributionNormality'
import { DISTRIBUTION_NORMALITY as spec } from '../registry/distributionNormality'
import type { DistributionNormalityResult } from '../stats/distributionNormality'

const png = (b: number) => new Uint8Array([b, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const inRange: DistributionNormalityResult = {
  n: 12, shapiro: { W: 0.963261809, p: 0.829180865 }, ks: { D: 0.146181269, p: 0.681426721 },
  nExcluded: 2, histogramPng: png(1), qqPng: png(2),
}

describe('buildDistributionNormality', () => {
  const c = buildDistributionNormality(spec, inRange)
  it('shapes the bare-caption table: ghost-row labels, statistic letter + value, shared N, fp p', () => {
    expect(c.tables).toHaveLength(1)
    expect(c.tables[0].spec).toBe(spec.tables[0])
    expect(c.tables[0].rows).toEqual([
      { test: 'Shapiro-Wilk', statistic: 'W 0.96', n: 12, p: '.829' },
      { test: 'K–S (Lilliefors)', statistic: 'D 0.15', n: 12, p: '.681' },
    ])
  })
  it('keeps the plain card note verbatim in range and fills the APA exemplar', () => {
    expect(c.note).toEqual({ kind: 'plain', text: spec.tableNote!.text })
    expect(c.apa).toBe('Normality was assessed with the Shapiro-Wilk test, W = 0.96, p = .829.')
    expect(c.nExcluded).toBe(2)
    expect(c.howToRead).toBe(spec.howToRead)
  })
  it('carries both figures with types for alt-text and export naming', () => {
    expect(c.figures.map((g) => ({ caption: g.caption, type: g.type }))).toEqual([
      { caption: 'Distribution shape', type: 'histogram' }, { caption: 'Distribution shape', type: 'qq' },
    ])
    expect(c.figures[0].png).toBe(inRange.histogramPng)
    expect(c.figures[1].png).toBe(inRange.qqPng)
  })
  it('out-of-range Shapiro → em-dash cells, reason folded into the note, em-dash APA fill', () => {
    const c2 = buildDistributionNormality(spec, { ...inRange, n: 6000, shapiro: { W: null, p: null } })
    expect(c2.tables[0].rows[0]).toEqual({ test: 'Shapiro-Wilk', statistic: 'W —', n: '—', p: '—' })
    expect(c2.tables[0].rows[1]).toEqual({ test: 'K–S (Lilliefors)', statistic: 'D 0.15', n: 6000, p: '.681' })
    expect(c2.note).toEqual({ kind: 'plain', text: `${spec.tableNote!.text} Shapiro-Wilk not computed: N = 6000 is outside that range.` })
    expect(c2.apa).toBe('Normality was assessed with the Shapiro-Wilk test, W = —, p = —.')
  })
  it('p-clause rule: tiny Shapiro p reads "p < .001"', () => {
    const c3 = buildDistributionNormality(spec, { ...inRange, shapiro: { W: 0.5, p: 0.0001 } })
    expect(c3.apa).toBe('Normality was assessed with the Shapiro-Wilk test, W = 0.50, p < .001.')
  })
  it('guarded K–S (N below 5) → em-dash K–S row, note unchanged', () => {
    const c4 = buildDistributionNormality(spec, { ...inRange, n: 4, ks: { D: null, p: null } })
    expect(c4.tables[0].rows[1]).toEqual({ test: 'K–S (Lilliefors)', statistic: 'D —', n: '—', p: '—' })
    expect(c4.note).toEqual({ kind: 'plain', text: spec.tableNote!.text })
  })
})
```

- [ ] **Step 9: Implement `src/lib/results/buildDistributionNormality.ts`** — **builder decisions (recorded):** Shapiro outside 3–5000 renders `W —` / `—` / `—` cells AND an em-dash APA fill, with the reason appended to the plain note as `Shapiro-Wilk not computed: N = <n> is outside that range.` (referring back to the note's own "applies for 3–5000 cases" sentence); the Statistic cell mirrors the ghost rows — letter, space, value, no equals sign:

```ts
import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { DistributionNormalityResult } from '../stats/distributionNormality'
import type { CardContent } from './builders'
import { f, fp, fx } from '../format/apa'

export function buildDistributionNormality(spec: TestSpec, r: DistributionNormalityResult): CardContent {
  const row = (test: string, letter: 'W' | 'D', stat: number | null, p: number | null) =>
    ({ test, statistic: `${letter} ${fx(stat, f)}`, n: stat == null ? '—' : r.n, p: fx(p, fp) })
  const note = r.shapiro.W == null
    ? `${spec.tableNote!.text} Shapiro-Wilk not computed: N = ${r.n} is outside that range.`
    : spec.tableNote!.text
  const apa = spec.apaTemplate
    .replace('{w}', fx(r.shapiro.W, f))
    .replace('p = {p}', r.shapiro.p != null && r.shapiro.p < 0.001 ? 'p < .001' : `p = ${fx(r.shapiro.p, fp)}`)
  return {
    tables: [{ spec: spec.tables[0], rows: [row('Shapiro-Wilk', 'W', r.shapiro.W, r.shapiro.p), row('K–S (Lilliefors)', 'D', r.ks.D, r.ks.p)] }],
    note: { kind: spec.tableNote!.kind, text: note },
    figures: figuresOf(spec).map((g, i) => ({ caption: g.caption, type: g.type, png: i === 0 ? r.histogramPng : r.qqPng })),
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
```
Run `npx vitest run src/lib/results/buildDistributionNormality.test.ts` → 6/6.

- [ ] **Step 10: Register + flip the catalog (test-first)** — FIRST, in `src/lib/registry/catalog.consistency.test.ts`, ADD `'distribution-normality'` to the expected available-ids array. Tasks execute in order and the array grows cumulatively — do NOT remove ids added by earlier tasks; keep CATALOG order (the assertion maps `CATALOG.filter(available)`), i.e. `summary-statistics → frequencies-crosstabs → distribution-normality → one-sample-t-test → independent-t-test → paired-t-test → mann-whitney-u → wilcoxon-signed-rank`, including whichever subset exists at this point. Run it → MUST fail. Then:

In `src/lib/registry/catalog.ts`: add the import, flip the entry, extend `SPECS`:
```ts
import { DISTRIBUTION_NORMALITY } from './distributionNormality'
```
```ts
  e('distribution-normality', 'Distribution & normality', 'Descriptive statistics', undefined, 'available'),
```
```ts
  [DISTRIBUTION_NORMALITY.id]: DISTRIBUTION_NORMALITY,   // appended inside the existing SPECS record
```

In `src/lib/results/builders.ts`: APPEND the import lines and one entry to each map (the runner adapter maps the single Variable role from TestSetup; no interactive options on this card):
```ts
import { runDistributionNormality, type DistributionNormalityResult } from '../stats/distributionNormality'
import { buildDistributionNormality } from './buildDistributionNormality'
```
```ts
  'distribution-normality': (engine, ds, setup) => runDistributionNormality(engine, ds, setup.roles['variable'][0]),
```
```ts
  'distribution-normality': (spec, result) => buildDistributionNormality(spec, result as DistributionNormalityResult),
```

- [ ] **Step 11: Verify everything** — `npx vitest run src/lib/registry/distributionNormality.consistency.test.ts src/lib/results/buildDistributionNormality.test.ts src/lib/registry/catalog.consistency.test.ts` → 17/17; `npx vitest run src/lib/stats/distributionNormality.test.ts` → 3/3; full `npm test` → ALL green (the total grows cumulatively across tasks — do not pin a number); `npx tsc -b` → 0 errors.

- [ ] **Step 12: Commit**
```bash
git add src/lib/registry src/lib/stats src/lib/results
git commit -m "feat: distribution-normality — registry, stats, builder (card-faithful)"
```

## Task 10: Summary statistics

The first descriptive card: one bare-captioned table (`Table.`), a multi-column "Variables to summarize" slot {1,∞} + optional "Group by" {0,1}, per-variable N as the missing-data unit, `psych::describe` (default type=3 — Joanes & Gill b-family, EXCESS kurtosis; spike fact 3: data.frame path only, never `describeBy(vector, g)`), and one optional histogram per variable. Both option pills are `display`. No p-value anywhere — the APA line is the card's fixed sentence.

**Files:** Create `src/lib/registry/summaryStatistics.ts`, `src/lib/registry/summaryStatistics.consistency.test.ts`, `src/lib/stats/summaryStatistics.ts`, `src/lib/stats/summaryStatistics.test.ts`, `src/lib/results/buildSummaryStatistics.ts`, `src/lib/results/buildSummaryStatistics.test.ts`; modify `src/lib/results/builders.ts`, `src/lib/registry/catalog.ts`, `src/lib/registry/catalog.consistency.test.ts`

- [ ] **Step 1: Failing consistency test** — `src/lib/registry/summaryStatistics.consistency.test.ts` (card-scoped to BOTH files; every string verbatim; fails on the missing module):

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SUMMARY_STATISTICS as spec } from './summaryStatistics'
import { strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Summary statistics</span>'), outputsHtml.indexOf('Frequencies &amp; cross-tabs</span>'))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Summary statistics</div>'), inputsHtml.indexOf('<div class="ttl">Frequencies &amp; cross-tabs</div>'))

describe('summary-statistics registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('the single table thead equals the card column sequence', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => t[1]))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}<sub>${c.sub}</sub>` : c.label))))
  })
  it('the caption is the bare "Table." style with the card title — no numbered caption in this card', () => {
    expect([...card.matchAll(/<div class="apa-cap"><b>Table\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables[0].captionStyle).toBe('bare')
    expect(card).not.toMatch(/<b>Table \d\.<\/b>/)
  })
  it('question, plain table note, figure caption/type, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(strip(card.match(/<p class="tbl-note">(.*?)<\/p>/s)![1])).toBe(spec.tableNote!.text)
    expect(card).not.toContain('tbl-note assume') // a plain note, not an assumption note
    expect(spec.tableNote!.kind).toBe('plain')
    const fig = spec.figures![0]
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(fig.caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${fig.type} per variable (optional)`)
    expect(fig.optional).toBe(true)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('bundle line EQUALS bundleFiles; names derive from table id + figure type (+ the card\'s optional tag)', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), `figure_${spec.figures![0].type}.png (optional)`]).toEqual(spec.bundleFiles)
  })
  it('the card APA line contains every fixed fragment of the apaTemplate', () => {
    // strip() leaves the card's literal '&nbsp;' entity alone — map it to a space before the containment check.
    const apaLine = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1]).replace(/&nbsp;/g, ' ')
    for (const fragment of spec.apaTemplate.split(/\{[a-z0-9]+\}/)) expect(apaLine).toContain(fragment)
  })
  it('roles equal the inputs card slot labels + constraint lines; machine arity mirrors the drawn text', () => {
    expect([...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))).toEqual(spec.roles.map((r) => r.label))
    expect([...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
    expect(spec.constraints.roles.map((r) => r.arity)).toEqual([{ min: 1, max: Infinity }, { min: 0, max: 1 }]) // 'one or more' · '0 or 1'
    expect(spec.constraints.minRule).toEqual({ kind: 'used-columns', n: 1 })
  })
  it('options equal the inputs card option strip — both display-only pills (the design ruling)', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.every((o) => o.kind === 'display')).toBe(true)
  })
})
```

- [ ] **Step 2: Registry entry** — `src/lib/registry/summaryStatistics.ts` (all display strings verbatim from the two cards; sandbox-verified against the real HTML):

```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Summary statistics cards).
export const SUMMARY_STATISTICS: TestSpec = {
  id: 'summary-statistics',
  name: 'Summary statistics',
  question: 'central tendency & spread of numeric variables',
  roles: [
    { id: 'variables', label: 'Variables to summarize', levels: 'interval / ratio', arity: 'one or more' },
    { id: 'groupBy', label: 'Group by (optional)', levels: 'nominal / ordinal', arity: '0 or 1' },
  ],
  options: [
    { id: 'statistics', label: 'statistics', value: 'mean, SD, median, min/max', kind: 'display' },
    { id: 'add', label: 'add', value: 'skew / kurtosis', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'variables', levels: ['interval', 'ratio'], arity: { min: 1, max: Infinity } },
      { roleId: 'groupBy', levels: ['nominal', 'ordinal'], arity: { min: 0, max: 1 } },
    ],
    minRule: { kind: 'used-columns', n: 1 }, // ≥1 usable numeric column (design §min-data)
  },
  tables: [
    { id: 'descriptives', title: 'Descriptive statistics', captionStyle: 'bare',
      columns: [
        { key: 'variable', label: 'Variable' }, { key: 'n', label: 'N' }, { key: 'mean', label: 'M' }, { key: 'sd', label: 'SD' },
        { key: 'min', label: 'Min' }, { key: 'max', label: 'Max' }, { key: 'median', label: 'Median' },
        { key: 'skew', label: 'Skew' }, { key: 'kurtosis', label: 'Kurtosis' },
      ] },
  ],
  tableNote: { kind: 'plain', text: 'one row per chosen variable; a Group column is added when "Group by" is used (stats repeat per group).' },
  figures: [{ caption: 'Distribution', type: 'histogram', optional: true }],
  howToRead:
    'Descriptives summarize your data: the mean and median show the center, the SD and range show the spread, ' +
    'and skew/kurtosis show how far the shape departs from a normal bell curve. There is no significance test here.',
  // The card's exemplar sentence; the builder fills {x} with the literal 'X' — bare "Table." captions mean
  // there is no in-app table number to substitute (recorded decision).
  apaTemplate: 'Table {x} reports descriptive statistics for the study variables.',
  rMap: 'psych::describe() / dplyr summary → table · ggplot2::geom_histogram() → figure',
  bundleFiles: ['table_descriptives.png', 'figure_histogram.png (optional)'],
}
```

Run `npx vitest run src/lib/registry/summaryStatistics.consistency.test.ts` → 7/7.

- [ ] **Step 3: Mutation check** — prove the consistency net catches drift, then restore:

```bash
# mutation 1: in summaryStatistics.ts change title 'Descriptive statistics' → 'Descriptive Statistics'
npx vitest run src/lib/registry/summaryStatistics.consistency.test.ts   # MUST FAIL (caption equality)
# revert mutation 1: change the title back to 'Descriptive statistics' (the file is uncommitted until Step 10 — git checkout cannot restore it)
# mutation 2: in bundleFiles[1] delete the trailing ' (optional)'
npx vitest run src/lib/registry/summaryStatistics.consistency.test.ts   # MUST FAIL (bundle line + derivation)
# revert mutation 2: restore the trailing ' (optional)'
npx vitest run src/lib/registry/summaryStatistics.consistency.test.ts   # PASS again, 7/7
```

- [ ] **Step 4: Failing known-answer stats test** — `src/lib/stats/summaryStatistics.test.ts`. The fixture's score/group columns are EXACTLY the spike's long12; `age` exists only to prove per-variable N (one null ⇒ N=11) and is never numerically asserted. Every asserted statistic is from the cross-verified archive (WebR ≡ native R 4.6.0); 4-dp `toBeCloseTo` margins all verified < 0.5e-4:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runSummaryStatistics } from './summaryStatistics'
import type { Dataset } from './types'

const long12: Dataset = { columns: ['group', 'score', 'age'], rows: [
  { group: 'control', score: 72, age: 31 }, { group: 'control', score: 68, age: 24 }, { group: 'control', score: 75, age: 29 },
  { group: 'control', score: 70, age: null }, { group: 'control', score: 66, age: 35 }, { group: 'control', score: 71, age: 27 },
  { group: 'treatment', score: 81, age: 22 }, { group: 'treatment', score: 79, age: 30 }, { group: 'treatment', score: 85, age: 26 },
  { group: 'treatment', score: 83, age: 33 }, { group: 'treatment', score: 78, age: 28 }, { group: 'treatment', score: 88, age: 25 },
] }

describe('runSummaryStatistics', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('overall: one row per variable, per-variable N, psych type-3 skew/excess kurtosis, a histogram per variable', async () => {
    const r = await runSummaryStatistics(engine, long12, ['score', 'age'])
    expect(r.grouped).toBe(false)
    expect(r.nExcluded).toBe(0) // per-variable N carries the missing-data story; nothing extra to report
    expect(r.rows.map((x) => x.variable)).toEqual(['score', 'age']) // drag order, one row each
    const s = r.rows[0]
    expect(s.n).toBe(12)
    expect(s.mean).toBeCloseTo(76.3333, 4)
    expect(s.sd).toBeCloseTo(7.0882, 4)
    expect(s.min).toBe(66); expect(s.max).toBe(88)
    expect(s.median).toBe(76.5)
    expect(s.skew).toBeCloseTo(0.1144, 4)      // describe type-3 b1 — NOT SPSS G1 (spike fact 3)
    expect(s.kurtosis).toBeCloseTo(-1.4922, 4) // EXCESS kurtosis b2−3
    expect(r.rows[1].n).toBe(11)               // age drops ITS OWN null only — per-variable N
    expect(r.histograms.map((h) => h.variable)).toEqual(['score', 'age'])
    for (const h of r.histograms) expect(Array.from(h.png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('group-by: stats repeat per group, groups alphabetical; the histogram stays one per variable', async () => {
    const r = await runSummaryStatistics(engine, long12, ['score'], 'group')
    expect(r.grouped).toBe(true)
    expect(r.rows.map((x) => [x.variable, x.group])).toEqual([['score', 'control'], ['score', 'treatment']])
    const [c, t] = r.rows
    expect(c.n).toBe(6)
    expect(c.mean).toBeCloseTo(70.3333, 4); expect(c.sd).toBeCloseTo(3.1411, 4)
    expect(c.min).toBe(66); expect(c.max).toBe(75); expect(c.median).toBe(70.5)
    expect(c.skew).toBeCloseTo(0.0669, 4); expect(c.kurtosis).toBeCloseTo(-1.5201, 4)
    expect(t.n).toBe(6)
    expect(t.mean).toBeCloseTo(82.3333, 4); expect(t.sd).toBeCloseTo(3.7771, 4)
    expect(t.min).toBe(78); expect(t.max).toBe(88); expect(t.median).toBe(82)
    expect(t.skew).toBeCloseTo(0.2488, 4); expect(t.kurtosis).toBeCloseTo(-1.7217, 4)
    expect(r.histograms).toHaveLength(1)
    expect(Array.from(r.histograms[0].png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })
})
```

- [ ] **Step 5: Stats module** — `src/lib/stats/summaryStatistics.ts` (R per the card's R map; numeric columns extracted in R, never printed output; env-passed vectors like the t-test module):

```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

// psych::describe default type=3 (Joanes & Gill b-family; kurtosis is EXCESS — spike fact 3).
// Always the data.frame path: NEVER describeBy(vector, g) — psych 2.6.3 treats the vector as factor codes (garbage).
const R_DESCRIBE = String.raw`
d <- psych::describe(data.frame(x = x))
list(n=d$n[1], mean=d$mean[1], sd=d$sd[1], min=d$min[1], max=d$max[1], median=d$median[1], skew=d$skew[1], kurtosis=d$kurtosis[1])`

const R_DESCRIBE_BY = String.raw`
gs <- sort(unique(as.character(g)))  # alphabetical; as.character before .telos_json (spike fact 5)
lapply(gs, function(l) {
  d <- psych::describe(data.frame(x = x[g == l]))  # per-subset data.frame path — matches describeBy(data.frame…) verbatim (spike)
  list(group=l, n=d$n[1], mean=d$mean[1], sd=d$sd[1], min=d$min[1], max=d$max[1], median=d$median[1], skew=d$skew[1], kurtosis=d$kurtosis[1])
})`

// bins=12 fixed (not card-specified): explicit bins keeps stat_bin's pick-a-binwidth message out of the run.
const R_HIST = String.raw`
print(ggplot2::ggplot(data.frame(x = x), ggplot2::aes(x)) +
  ggplot2::geom_histogram(bins = 12, fill = '#9cc2ec', colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL))`

export interface SummaryRow {
  variable: string; group?: string; n: number
  mean: number | null; sd: number | null; min: number | null; max: number | null
  median: number | null; skew: number | null; kurtosis: number | null  // null (e.g. sd at n=1) renders as em-dash
}
export interface SummaryStatsResult {
  rows: SummaryRow[]                 // ungrouped: one per variable; grouped: variable × group (groups alphabetical)
  grouped: boolean
  histograms: { variable: string; png: Uint8Array<ArrayBuffer> }[]  // one per variable, ALL kept values (card: per variable)
  nExcluded: number                  // always 0 — the per-variable N column carries missingness (recorded decision)
}
type RawRow = Omit<SummaryRow, 'variable' | 'group'>
type RawGroupRow = RawRow & { group: string }

export async function runSummaryStatistics(engine: Engine, data: Dataset, variables: string[], groupBy?: string): Promise<SummaryStatsResult> {
  const rows: SummaryRow[] = []
  const histograms: { variable: string; png: Uint8Array<ArrayBuffer> }[] = []
  for (const variable of variables) {
    // Per-variable N (the card's missing-data unit): each variable drops its own missing/non-numeric cells;
    // grouped rows additionally need a present group value in the same row.
    const kept = data.rows.filter((r) => typeof r[variable] === 'number' && Number.isFinite(r[variable] as number))
    if (groupBy) {
      const paired = kept.filter((r) => r[groupBy] != null && String(r[groupBy]).trim() !== '')
      const env = { x: paired.map((r) => r[variable] as number), g: paired.map((r) => String(r[groupBy])) }
      for (const g of await engine.runJson<RawGroupRow[]>(R_DESCRIBE_BY, env)) rows.push({ variable, ...g })
    } else {
      rows.push({ variable, ...(await engine.runJson<RawRow>(R_DESCRIBE, { x: kept.map((r) => r[variable] as number) })) })
    }
    histograms.push({ variable, png: await engine.capturePlot(R_HIST, 600, 450, { x: kept.map((r) => r[variable] as number) }) })
  }
  return { rows, grouped: !!groupBy, histograms, nExcluded: 0 }
}
```

Run `npx vitest run src/lib/stats/summaryStatistics.test.ts` → 2/2 (network ok; first run pays the package downloads under the 300 s hookTimeout).

- [ ] **Step 6: Failing builder test** — `src/lib/results/buildSummaryStatistics.test.ts` (synthetic typed results carrying the verified numbers; BOTH branches — plain and group-by — plus the null→em-dash path):

```ts
import { describe, it, expect } from 'vitest'
import { buildSummaryStatistics } from './buildSummaryStatistics'
import { SUMMARY_STATISTICS as spec } from '../registry/summaryStatistics'
import type { SummaryStatsResult } from '../stats/summaryStatistics'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>

const overall: SummaryStatsResult = {
  grouped: false,
  rows: [
    { variable: 'score', n: 12, mean: 76.33333, sd: 7.08819, min: 66, max: 88, median: 76.5, skew: 0.11440, kurtosis: -1.49220 },
    { variable: 'age', n: 1, mean: 34, sd: null, min: 34, max: 34, median: 34, skew: null, kurtosis: null },
  ],
  histograms: [{ variable: 'score', png: PNG }, { variable: 'age', png: PNG }],
  nExcluded: 0,
}
const byGroup: SummaryStatsResult = {
  grouped: true,
  rows: [
    { variable: 'score', group: 'control', n: 6, mean: 70.33333, sd: 3.14113, min: 66, max: 75, median: 70.5, skew: 0.06692, kurtosis: -1.52006 },
    { variable: 'score', group: 'treatment', n: 6, mean: 82.33333, sd: 3.77712, min: 78, max: 88, median: 82, skew: 0.24881, kurtosis: -1.72169 },
  ],
  histograms: [{ variable: 'score', png: PNG }],
  nExcluded: 0,
}

describe('buildSummaryStatistics', () => {
  it('plain branch: card columns untouched, one formatted row per variable, nulls as em-dashes', () => {
    const c = buildSummaryStatistics(spec, overall)
    expect(c.tables[0].spec.columns.map((col) => col.label)).toEqual(['Variable', 'N', 'M', 'SD', 'Min', 'Max', 'Median', 'Skew', 'Kurtosis'])
    expect(c.tables[0].spec.captionStyle).toBe('bare')
    expect(c.tables[0].rows[0]).toEqual({ variable: 'score', n: 12, mean: '76.33', sd: '7.09', min: '66.00', max: '88.00', median: '76.50', skew: '0.11', kurtosis: '−1.49' })
    expect(c.tables[0].rows[1]).toEqual({ variable: 'age', n: 1, mean: '34.00', sd: '—', min: '34.00', max: '34.00', median: '34.00', skew: '—', kurtosis: '—' })
    expect(c.nExcluded).toBe(0)
  })
  it('group-by branch: a Group column is INSERTED first and stats repeat per group — the registry spec object stays unmutated', () => {
    const c = buildSummaryStatistics(spec, byGroup)
    expect(c.tables[0].spec.columns.map((col) => col.label)).toEqual(['Group', 'Variable', 'N', 'M', 'SD', 'Min', 'Max', 'Median', 'Skew', 'Kurtosis'])
    expect(c.tables[0].rows[0]).toEqual({ group: 'control', variable: 'score', n: 6, mean: '70.33', sd: '3.14', min: '66.00', max: '75.00', median: '70.50', skew: '0.07', kurtosis: '−1.52' })
    expect(c.tables[0].rows[1]).toEqual({ group: 'treatment', variable: 'score', n: 6, mean: '82.33', sd: '3.78', min: '78.00', max: '88.00', median: '82.00', skew: '0.25', kurtosis: '−1.72' })
    expect(spec.tables[0].columns[0].key).toBe('variable') // dynamic insert never touches the registry
  })
  it('carries the plain card note, the fixed APA sentence, and per-variable typed figures', () => {
    const c = buildSummaryStatistics(spec, overall)
    expect(c.note).toEqual({ kind: 'plain', text: 'one row per chosen variable; a Group column is added when "Group by" is used (stats repeat per group).' })
    expect(c.apa).toBe('Table X reports descriptive statistics for the study variables.')
    expect(c.howToRead).toBe(spec.howToRead)
    expect(c.figures.map((f) => f.type)).toEqual(['histogram_score', 'histogram_age']) // unique types ⇒ unique export names
    expect(c.figures[0].caption).toBe('Distribution — score')
  })
})
```

- [ ] **Step 7: Implement the builder** — `src/lib/results/buildSummaryStatistics.ts`:

```ts
import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { SummaryStatsResult } from '../stats/summaryStatistics'
import type { CardContent } from './builders'
import { f, fx } from '../format/apa'

export function buildSummaryStatistics(spec: TestSpec, r: SummaryStatsResult): CardContent {
  const base = spec.tables[0]
  // Per the card note, group-by ADDS a Group column (inserted first); non-mutating copy of the registry spec.
  const tableSpec = r.grouped ? { ...base, columns: [{ key: 'group', label: 'Group' }, ...base.columns] } : base
  const fig = figuresOf(spec)[0]
  return {
    tables: [{ spec: tableSpec, rows: r.rows.map((row) => ({
      ...(r.grouped ? { group: row.group! } : {}),
      variable: row.variable, n: row.n,
      mean: fx(row.mean, f), sd: fx(row.sd, f), min: fx(row.min, f), max: fx(row.max, f),
      median: fx(row.median, f), skew: fx(row.skew, f), kurtosis: fx(row.kurtosis, f),
    })) }],
    note: spec.tableNote ?? null,
    // type is per-variable so Task 4's export names (figure_<type>.png) never collide across histograms.
    figures: r.histograms.map((h) => ({ caption: `${fig.caption} — ${h.variable}`, type: `${fig.type}_${h.variable}`, png: h.png })),
    howToRead: spec.howToRead,
    apa: spec.apaTemplate.replace('{x}', 'X'), // bare "Table." captions — the card's exemplar sentence stands as written
    nExcluded: r.nExcluded,
  }
}
```

Run `npx vitest run src/lib/results/buildSummaryStatistics.test.ts` → 3/3.

- [ ] **Step 8: Register runner + builder, flip the catalog** —

In `src/lib/results/builders.ts` APPEND to the imports:
```ts
import { runSummaryStatistics, type SummaryStatsResult } from '../stats/summaryStatistics'
import { buildSummaryStatistics } from './buildSummaryStatistics'
```
one entry inside `RUNNERS` (the adapter maps the TestSetup role arrays to the stats args; the optional slot's `[0]` is `undefined` when empty):
```ts
  'summary-statistics': (engine, ds, setup) =>
    runSummaryStatistics(engine, ds, setup.roles['variables'], setup.roles['groupBy'][0]),
```
and one inside `BUILDERS`:
```ts
  'summary-statistics': (spec, result) => buildSummaryStatistics(spec, result as SummaryStatsResult),
```

In `src/lib/registry/catalog.ts`: add `import { SUMMARY_STATISTICS } from './summaryStatistics'`, flip the entry to
```ts
  e('summary-statistics', 'Summary statistics', 'Descriptive statistics', undefined, 'available'),
```
and add `[SUMMARY_STATISTICS.id]: SUMMARY_STATISTICS,` inside `SPECS`.

In `src/lib/registry/catalog.consistency.test.ts`: ADD `'summary-statistics'` to the expected available-ids array. The assertion maps over CATALOG (tree) order — `summary-statistics` is the catalog's FIRST entry, so insert it at the HEAD of the array, before whatever ids earlier tasks have already added (tasks execute in order; this array grows cumulatively, one id per per-test task). If this is the first per-test task to land, also reword the it() title from `'exactly one test is available in this slice: the independent t-test'` to `'the available tests of this slice, in tree order'`.

- [ ] **Step 8b: Arity-gate unit tests (design §3: minimums gate; optional slots never block)** — extend `src/state/session.test.ts`'s import line with `gateOk` and append:
```ts
describe('arity gates (design §3: minimums gate; optional slots never block)', () => {
  beforeEach(() => { useSession.getState().reset(); load(); useSession.getState().visitGuide(); useSession.getState().toggleSelection('summary-statistics') })
  it('{1,∞} gates on its minimum; the empty {0,1} Group-by never blocks', () => {
    expect(gateOk(useSession.getState(), 'test:summary-statistics')).toBe(false)
    useSession.getState().addRole('summary-statistics', 'variables', 'score')
    expect(gateOk(useSession.getState(), 'test:summary-statistics')).toBe(true)
  })
})
```

- [ ] **Step 9: Verify** — `npx vitest run src/lib/registry/summaryStatistics.consistency.test.ts src/lib/stats/summaryStatistics.test.ts src/lib/results/buildSummaryStatistics.test.ts` → 12/12; full `npm test` green (count = whatever the previously landed tasks left + 12); `npx tsc -b` → 0.

- [ ] **Step 10: Commit**
```bash
git add src/lib/registry/summaryStatistics.ts src/lib/registry/summaryStatistics.consistency.test.ts \
  src/lib/registry/catalog.ts src/lib/registry/catalog.consistency.test.ts \
  src/lib/stats/summaryStatistics.ts src/lib/stats/summaryStatistics.test.ts \
  src/lib/results/buildSummaryStatistics.ts src/lib/results/buildSummaryStatistics.test.ts src/lib/results/builders.ts \
  src/state/session.test.ts
git commit -m "feat: summary-statistics — registry, stats, builder (card-faithful)"
```

## Task 11: Frequencies & cross-tabs

**Files:** Create `src/lib/registry/frequenciesCrosstabs.ts`, `src/lib/registry/frequenciesCrosstabs.consistency.test.ts`, `src/lib/stats/frequenciesCrosstabs.ts`, `src/lib/stats/frequenciesCrosstabs.test.ts`, `src/lib/results/buildFrequenciesCrosstabs.ts`, `src/lib/results/buildFrequenciesCrosstabs.test.ts`; modify `src/lib/results/builders.ts`, `src/lib/registry/catalog.ts`, `src/lib/registry/catalog.consistency.test.ts`

One role `Variable(s)` (nominal/ordinal, arity 1–2). One variable → Table 1 (frequency distribution); two → Table 2 (cross-tab) — the table TITLES say "(one variable)"/"(two variables)", so exactly ONE table is built per run, and the export bundle includes only the produced table per the ui-spec's conditional-file rule. **Conventions (recorded decisions):** the stats module emits percentages already ×100; the builder renders them at 1 dp (`16.7`) — % sign lives in the column header for Table 1 and inside the cell for cross-tab cells; interior cross-tab cells are `n (row% / col%)` per the card note; Total row/col cells show the plain count (their own row%/col% are 100% by construction); the plain table note renders only on the cross-tab branch (its text describes the cross-tab); the figure slot is type `bar` on BOTH branches (the bundle lists only `figure_bar.png`; the 2-var run draws the grouped bar per the card's "(grouped bar for a cross-tab)"). **The one sanctioned spec-vs-built TABLE divergence in this plan (Task 10's per-variable histogram captions/filenames are the recorded FIGURE counterpart):** the registry's crosstab columns are the card's drawn placeholders (`Row \ Column · Col 1 · Col 2 · … · Total`); the builder REPLACES them at build time with one column per category of the SECOND variable plus Total — justified by the card note "cross-tab columns expand to the number of categories in the column variable". **APA template (exemplar card line "Frequencies (and cross-tabulations) are reported in Table X."):** `'Frequencies (and cross-tabulations) are reported in Table {n}.'`; the builder fills `{n}` with `'1'` (exactly one table is built per run, and the chassis numbers built tables from 1).

- [ ] **Step 1: Failing consistency test** — `src/lib/registry/frequenciesCrosstabs.consistency.test.ts` (card-scoped to THIS card in both files; end anchors searched AFTER the start so a stray earlier mention can never mis-scope; theads go through `strip` because this card's `…` column is the `&hellip;` entity — no sub/sup columns here):

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FREQUENCIES_CROSSTABS as spec } from './frequenciesCrosstabs'
import { figuresOf } from './types'
import { strip } from './specHtml'

// Scope each file to THIS test's card (Frequencies → Distribution & normality in both spec files).
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const oStart = outputsHtml.indexOf('Frequencies &amp; cross-tabs</span>')
const card = outputsHtml.slice(oStart, outputsHtml.indexOf('Distribution &amp; normality</span>', oStart))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const iStart = inputsHtml.indexOf('<div class="ttl">Frequencies &amp; cross-tabs</div>')
const inCard = inputsHtml.slice(iStart, inputsHtml.indexOf('<div class="ttl">Distribution &amp; normality</div>', iStart))

describe('frequencies registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences — incl. the literal Row \\ Column and the … placeholder column', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => c.label))) // no sub/sup columns on this card
    expect(theads[1][0]).toBe('Row \\ Column') // single backslash at runtime — the card's literal
    expect(theads[1][3]).toBe('…')             // the drawn dynamic-width placeholder
  })
  it('table titles equal the card captions, numbered Table 1./Table 2. (no bare captionStyle)', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('question, PLAIN table note, figure caption, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(strip(card.match(/<p class="tbl-note">(.*?)<\/p>/s)![1])).toBe(spec.tableNote!.text)
    expect(spec.tableNote!.kind).toBe('plain')        // card class is bare "tbl-note" —
    expect(card).not.toContain('tbl-note assume')     // — not "tbl-note assume"
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(figuresOf(spec)[0].caption)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it("the card's APA line contains the template's fixed fragments", () => {
    // The card writes "Table&nbsp;X." — &nbsp; is not in decode()'s entity list, so normalize it here.
    const apa = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1]).replace(/&nbsp;/g, ' ')
    for (const frag of spec.apaTemplate.split(/\{[a-z]+\}/)) expect(apa).toContain(frag)
  })
  it('bundle line EQUALS bundleFiles, derived from table ids + figure type', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...figuresOf(spec).map((f) => `figure_${f.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('role slot + constraint line verbatim; arity mirrors "1 to 2"; options both display-only (Benjie ruling)', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
    expect(spec.constraints.roles).toEqual([{ roleId: 'variables', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 2 } }])
    expect(spec.constraints.minRule).toEqual({ kind: 'used-columns', n: 1 })
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.every((o) => o.kind === 'display')).toBe(true)
  })
})
```

Run `npx vitest run src/lib/registry/frequenciesCrosstabs.consistency.test.ts` → FAILS (module missing).

- [ ] **Step 2: Registry entry** — `src/lib/registry/frequenciesCrosstabs.ts` (every display string verbatim from the cards, entities decoded):

```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html (Frequencies & cross-tabs card) + telos_test_inputs.html (role slot, option strip).
export const FREQUENCIES_CROSSTABS: TestSpec = {
  id: 'frequencies-crosstabs',
  name: 'Frequencies & cross-tabs',
  question: 'counts for categorical data',
  roles: [
    { id: 'variables', label: 'Variable(s)', levels: 'nominal / ordinal', arity: '1 to 2',
      hint: 'Drag one category column into Variable(s) for a simple frequency table, or drag a second category column to build a cross-tab that counts the combinations of the two.' },
  ],
  options: [ // both pills informational — interactive options this slice are ONLY One-sample μ₀ + the MW/Wilcoxon continuity toggle (Benjie's ruling)
    { id: 'countsPercentages', label: 'counts / percentages', value: 'counts', kind: 'display' },
    { id: 'crosstab', label: 'cross-tab', value: 'when 2 variables', kind: 'display' },
  ],
  constraints: {
    roles: [{ roleId: 'variables', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 2 } }],
    minRule: { kind: 'used-columns', n: 1 }, // ≥1 compatible Used column
  },
  tables: [
    { id: 'frequencies', title: 'Frequency distribution (one variable)',
      columns: [{ key: 'category', label: 'Category' }, { key: 'n', label: 'n' }, { key: 'pct', label: '%' }, { key: 'cumpct', label: 'Cumulative %' }] },
    // Drawn PLACEHOLDER columns. The builder replaces Col 1/Col 2/… with one column per category of the
    // SECOND variable + Total ("cross-tab columns expand to the number of categories in the column variable").
    { id: 'crosstab', title: 'Cross-tabulation (two variables · n, row %, col %)',
      columns: [{ key: 'rowcat', label: 'Row \\ Column' }, { key: 'c1', label: 'Col 1' }, { key: 'c2', label: 'Col 2' }, { key: 'more', label: '…' }, { key: 'total', label: 'Total' }] },
  ],
  tableNote: { kind: 'plain', text: 'cross-tab columns expand to the number of categories in the column variable; each cell shows the count plus row and column percentages.' },
  figures: [{ caption: 'Category counts', type: 'bar' }], // card ftype "bar chart (grouped bar for a cross-tab)" → one slot, type 'bar' (bundle: figure_bar.png)
  howToRead:
    'Frequencies show how many cases fall in each category and what share of the total that is. ' +
    'A cross-tab shows counts for combinations of two categories — to test whether the two are related, run a chi-square test.',
  apaTemplate: 'Frequencies (and cross-tabulations) are reported in Table {n}.',
  rMap: 'janitor::tabyl() (+ adorn_* for cross-tab %, cumsum() for cumulative %) → tables · ggplot2::geom_bar() → figure',
  bundleFiles: ['table_frequencies.png', 'table_crosstab.png', 'figure_bar.png'],
}
```

Run the consistency suite → 6/6 PASS.

- [ ] **Step 3: Mutation checks** (prove the suite bites): (a) change the crosstab `…` column label to `'...'` → thead test MUST fail; revert. (b) change the tableNote's last word `percentages.` → `percent.` → note test MUST fail; revert. Suite → 6/6 PASS again.

- [ ] **Step 4: Failing stats known-answer test** — `src/lib/stats/frequenciesCrosstabs.test.ts` (every number from the cross-verified spike values, TEST 6):

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runFrequenciesCrosstabs } from './frequenciesCrosstabs'
import type { Dataset } from './types'

// The spike's region6/gender6 fixture: counts east 1 / north 2 / south 3; gender f=3, m=3.
// Rows deliberately NOT alphabetical — janitor::tabyl must emit east, north, south (spike fact 4).
const region6: Dataset = { columns: ['region', 'gender'], rows: [
  { region: 'north', gender: 'f' }, { region: 'south', gender: 'f' }, { region: 'east', gender: 'm' },
  { region: 'south', gender: 'm' }, { region: 'north', gender: 'm' }, { region: 'south', gender: 'f' },
] }
// Missing-data fixture: present-category counting is per the USED columns only.
const messy: Dataset = { columns: ['region', 'gender'], rows: [
  ...region6.rows,
  { region: null, gender: 'f' },     // region missing → excluded from every run that uses region
  { region: 'south', gender: null }, // gender missing → excluded ONLY when gender is used
] }

describe('runFrequenciesCrosstabs', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('one variable → alphabetical frequency rows with cumulative %, bar PNG', async () => {
    const r = await runFrequenciesCrosstabs(engine, region6, ['region'])
    expect(r.kind).toBe('one')
    expect(r.freq!.map((x) => x.category)).toEqual(['east', 'north', 'south']) // tabyl alphabetical, NOT first-appearance
    expect(r.freq!.map((x) => x.n)).toEqual([1, 2, 3])
    expect(r.freq![0].pct).toBeCloseTo(16.667, 2)
    expect(r.freq![1].pct).toBeCloseTo(33.333, 2)
    expect(r.freq![2].pct).toBeCloseTo(50, 2)
    expect(r.freq![0].cumPct).toBeCloseTo(16.667, 2)
    expect(r.freq![1].cumPct).toBeCloseTo(50, 2)
    expect(r.freq![2].cumPct).toBeCloseTo(100, 2)
    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('two variables → adorned cross-tab: counts incl. totals, row %, col %, grouped-bar PNG', async () => {
    const r = await runFrequenciesCrosstabs(engine, region6, ['region', 'gender'])
    const ct = r.crosstab!
    expect(ct.rowCats).toEqual(['east', 'north', 'south'])
    expect(ct.colCats).toEqual(['f', 'm'])
    expect(ct.counts).toEqual([[0, 1, 1], [1, 1, 2], [2, 1, 3], [3, 3, 6]]) // rows east/north/south/Total × cols f/m/Total
    expect(ct.rowPct[0][1]).toBeCloseTo(100, 2)    // east,m row%
    expect(ct.rowPct[1][0]).toBeCloseTo(50, 2)     // north,f row%
    expect(ct.rowPct[2][0]).toBeCloseTo(66.667, 2) // south,f row%
    expect(ct.rowPct[3][0]).toBeCloseTo(50, 2)     // Total row row% (spike: 0.5/0.5)
    expect(ct.colPct[0][1]).toBeCloseTo(33.333, 2) // east,m col%
    expect(ct.colPct[2][0]).toBeCloseTo(66.667, 2) // south,f col%
    expect(ct.colPct[0][2]).toBeCloseTo(16.667, 2) // Total-col col% = total% marginal (spike)
    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('missing data counts per USED columns: a gender-missing row still counts for region-only', async () => {
    const one = await runFrequenciesCrosstabs(engine, messy, ['region'])
    expect(one.nExcluded).toBe(1)                        // only the null-region row drops
    expect(one.freq!.map((x) => x.n)).toEqual([1, 2, 4]) // the gender-missing south row IS counted
    const two = await runFrequenciesCrosstabs(engine, messy, ['region', 'gender'])
    expect(two.nExcluded).toBe(2)                        // both rows drop; cells return to the verified table
    expect(two.crosstab!.counts).toEqual([[0, 1, 1], [1, 1, 2], [2, 1, 3], [3, 3, 6]])
  })
})
```

Run it → FAILS (module missing).

- [ ] **Step 5: Stats module** — `src/lib/stats/frequenciesCrosstabs.ts` (R per the card's R map; row-objects/`as.list` so single-category vectors still serialize as JSON arrays; categories `as.character()`-ed before `.telos_json` — spike fact 5; the adorn-over-totals pipeline is the spike-verified one):

```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface FrequencyRow { category: string; n: number; pct: number; cumPct: number } // pct/cumPct already ×100
export interface CrossTab {
  rowCats: string[]; colCats: string[] // alphabetical (janitor::tabyl order — spike fact 4)
  counts: number[][]; rowPct: number[][]; colPct: number[][] // (rowCats+Total) × (colCats+Total), Total last; pct ×100
}
export interface FrequenciesResult {
  kind: 'one' | 'two'
  freq: FrequencyRow[] | null      // kind 'one'
  crosstab: CrossTab | null        // kind 'two'
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

// tabyl emits proportions 0–1 (spike fact 4) — ×100 here so display values match the verified numbers.
const R_FREQ = String.raw`
t <- janitor::tabyl(v1)
lapply(seq_len(nrow(t)), function(i) list(category = as.character(t[[1]][i]), n = as.numeric(t$n[i]),
  pct = as.numeric(t$percent[i]) * 100, cumPct = as.numeric(cumsum(t$percent)[i]) * 100))`

// adorn_totals FIRST, then adorn_percentages — janitor keeps the Total row/col inside the % tables
// (spike-verified: Total row row% = 0.5/0.5; Total col col% = the column marginals).
const R_CROSSTAB = String.raw`
d <- data.frame(r = v1, c = v2, stringsAsFactors = FALSE)
ct <- janitor::tabyl(d, r, c)
tot <- janitor::adorn_totals(ct, c('row','col'))
rp <- janitor::adorn_percentages(tot, 'row'); cp <- janitor::adorn_percentages(tot, 'col')
m <- as.matrix(tot[, -1]); rpm <- as.matrix(rp[, -1]); cpm <- as.matrix(cp[, -1])
list(rowCats = as.list(as.character(ct[[1]])), colCats = as.list(as.character(names(ct)[-1])),
  counts = lapply(seq_len(nrow(m)), function(i) as.numeric(m[i, ])),
  rowPct = lapply(seq_len(nrow(rpm)), function(i) as.numeric(rpm[i, ]) * 100),
  colPct = lapply(seq_len(nrow(cpm)), function(i) as.numeric(cpm[i, ]) * 100))`

const R_BAR = String.raw`
print(ggplot2::ggplot(data.frame(v = v1), ggplot2::aes(v)) +
  ggplot2::geom_bar(fill = '#9cc2ec', colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL))`

const R_GROUPED_BAR = String.raw`
print(ggplot2::ggplot(data.frame(r = v1, c = v2), ggplot2::aes(r, fill = c)) +
  ggplot2::geom_bar(position = 'dodge', colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL, fill = NULL))`

const present = (v: unknown) => v != null && String(v).trim() !== ''

export async function runFrequenciesCrosstabs(engine: Engine, data: Dataset, variables: string[]): Promise<FrequenciesResult> {
  // Present-category counting (design ruling): a row is used iff every USED column has a value.
  const used = variables.slice(0, 2)
  const rows = data.rows.filter((r) => used.every((c) => present(r[c])))
  const nExcluded = data.rows.length - rows.length
  if (used.length === 1) {
    const env = { v1: rows.map((r) => String(r[used[0]])) }
    const freq = await engine.runJson<FrequencyRow[]>(R_FREQ, env)
    const figurePng = await engine.capturePlot(R_BAR, 600, 450, env)
    return { kind: 'one', freq, crosstab: null, nExcluded, figurePng }
  }
  const env = { v1: rows.map((r) => String(r[used[0]])), v2: rows.map((r) => String(r[used[1]])) }
  const crosstab = await engine.runJson<CrossTab>(R_CROSSTAB, env)
  const figurePng = await engine.capturePlot(R_GROUPED_BAR, 600, 450, env)
  return { kind: 'two', freq: null, crosstab, nExcluded, figurePng }
}
```

Run `npx vitest run src/lib/stats/frequenciesCrosstabs.test.ts` → 3/3 (network: WebR package downloads in beforeAll).

- [ ] **Step 6: Failing builder test** — `src/lib/results/buildFrequenciesCrosstabs.test.ts` (synthetic typed results carrying the verified numbers; BOTH branches; no negatives exist on this card so 1-dp strings need no U+2212):

```ts
import { describe, it, expect } from 'vitest'
import { buildFrequenciesCrosstabs } from './buildFrequenciesCrosstabs'
import { FREQUENCIES_CROSSTABS as spec } from '../registry/frequenciesCrosstabs'
import type { FrequenciesResult } from '../stats/frequenciesCrosstabs'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const oneVar: FrequenciesResult = { kind: 'one', crosstab: null, nExcluded: 0, figurePng: png,
  freq: [
    { category: 'east', n: 1, pct: 16.6666667, cumPct: 16.6666667 },
    { category: 'north', n: 2, pct: 33.3333333, cumPct: 50 },
    { category: 'south', n: 3, pct: 50, cumPct: 100 },
  ] }
const twoVar: FrequenciesResult = { kind: 'two', freq: null, nExcluded: 1, figurePng: png,
  crosstab: {
    rowCats: ['east', 'north', 'south'], colCats: ['f', 'm'],
    counts: [[0, 1, 1], [1, 1, 2], [2, 1, 3], [3, 3, 6]],
    rowPct: [[0, 100, 100], [50, 50, 100], [66.6666667, 33.3333333, 100], [50, 50, 100]],
    colPct: [[0, 33.3333333, 16.6666667], [33.3333333, 33.3333333, 33.3333333], [66.6666667, 33.3333333, 50], [100, 100, 100]],
  } }

describe('buildFrequenciesCrosstabs', () => {
  it('one variable → the frequency table only, 1-dp percentages, NO note, APA filled with Table 1', () => {
    const c = buildFrequenciesCrosstabs(spec, oneVar)
    expect(c.tables).toHaveLength(1)
    expect(c.tables[0].spec.id).toBe('frequencies')
    expect(c.tables[0].rows).toEqual([
      { category: 'east', n: 1, pct: '16.7', cumpct: '16.7' },
      { category: 'north', n: 2, pct: '33.3', cumpct: '50.0' },
      { category: 'south', n: 3, pct: '50.0', cumpct: '100.0' },
    ])
    expect(c.note).toBeNull()
    expect(c.figures).toEqual([{ caption: 'Category counts', type: 'bar', png }])
    expect(c.apa).toBe('Frequencies (and cross-tabulations) are reported in Table 1.')
    expect(c.nExcluded).toBe(0)
  })
  it('two variables → DATA-DRIVEN columns, n (row% / col%) cells, count margins, the card note', () => {
    const c = buildFrequenciesCrosstabs(spec, twoVar)
    expect(c.tables).toHaveLength(1)
    expect(c.tables[0].spec.id).toBe('crosstab')
    expect(c.tables[0].spec.title).toBe(spec.tables[1].title)
    expect(c.tables[0].spec.columns.map((col) => col.label)).toEqual(['Row \\ Column', 'f', 'm', 'Total'])
    expect(c.tables[0].rows[0]).toEqual({ rowcat: 'east', c0: '0 (0.0% / 0.0%)', c1: '1 (100.0% / 33.3%)', total: '1' })
    expect(c.tables[0].rows[1]).toEqual({ rowcat: 'north', c0: '1 (50.0% / 33.3%)', c1: '1 (50.0% / 33.3%)', total: '2' })
    expect(c.tables[0].rows[2]).toEqual({ rowcat: 'south', c0: '2 (66.7% / 66.7%)', c1: '1 (33.3% / 33.3%)', total: '3' })
    expect(c.tables[0].rows[3]).toEqual({ rowcat: 'Total', c0: '3', c1: '3', total: '6' })
    expect(c.note).toEqual({ kind: 'plain', text: spec.tableNote!.text })
    expect(c.apa).toBe('Frequencies (and cross-tabulations) are reported in Table 1.')
    expect(c.nExcluded).toBe(1)
  })
})
```

Run it → FAILS.

- [ ] **Step 7: Builder** — `src/lib/results/buildFrequenciesCrosstabs.ts`:

```ts
import type { TestSpec } from '../registry/types'
import type { CardContent } from './builders'
import type { FrequenciesResult } from '../stats/frequenciesCrosstabs'

// Display convention (recorded): percentages arrive ×100 from the stats module, rendered at 1 dp.
// The % sign lives in Table 1's column header, and inside the cell for cross-tab cells. No negatives exist here.
const pc = (x: number) => x.toFixed(1)

export function buildFrequenciesCrosstabs(spec: TestSpec, r: FrequenciesResult): CardContent {
  const fig = spec.figures![0]
  const base = {
    figures: [{ caption: fig.caption, type: fig.type, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa: spec.apaTemplate.replace('{n}', '1'), // exactly one table is built per run → always Table 1 at runtime
    nExcluded: r.nExcluded,
  }
  if (r.kind === 'one') {
    return { ...base, note: null,
      tables: [{ spec: spec.tables[0], rows: r.freq!.map((x) => ({ category: x.category, n: x.n, pct: pc(x.pct), cumpct: pc(x.cumPct) })) }] }
  }
  const ct = r.crosstab!
  // THE one sanctioned divergence from the registry spec: replace the drawn Col 1/Col 2/… placeholders with
  // one column per category of the SECOND variable + Total (card note: "cross-tab columns expand to the
  // number of categories in the column variable").
  const columns = [{ key: 'rowcat', label: 'Row \\ Column' },
    ...ct.colCats.map((cat, j) => ({ key: `c${j}`, label: cat })), { key: 'total', label: 'Total' }]
  const R = ct.rowCats.length, C = ct.colCats.length
  const cell = (i: number, j: number) => `${ct.counts[i][j]} (${pc(ct.rowPct[i][j])}% / ${pc(ct.colPct[i][j])}%)`
  const rows = ct.rowCats.map((cat, i) => {
    const row: Record<string, string | number> = { rowcat: cat, total: String(ct.counts[i][C]) }
    ct.colCats.forEach((_, j) => { row[`c${j}`] = cell(i, j) })
    return row
  })
  const totalRow: Record<string, string | number> = { rowcat: 'Total', total: String(ct.counts[R][C]) }
  ct.colCats.forEach((_, j) => { totalRow[`c${j}`] = String(ct.counts[R][j]) }) // margins: plain counts (their %s are 100% by construction)
  return { ...base, note: spec.tableNote ?? null,
    tables: [{ spec: { ...spec.tables[1], columns }, rows: [...rows, totalRow] }] }
}
```

Run `npx vitest run src/lib/results/buildFrequenciesCrosstabs.test.ts` → 2/2.

- [ ] **Step 8: Register + catalog.** In `src/lib/results/builders.ts` APPEND to the imports:

```ts
import { runFrequenciesCrosstabs, type FrequenciesResult } from '../stats/frequenciesCrosstabs'
import { buildFrequenciesCrosstabs } from './buildFrequenciesCrosstabs'
```
add to `RUNNERS`:
```ts
  'frequencies-crosstabs': (engine, ds, setup) => runFrequenciesCrosstabs(engine, ds, setup.roles['variables']),
```
add to `BUILDERS`:
```ts
  'frequencies-crosstabs': (spec, result) => buildFrequenciesCrosstabs(spec, result as FrequenciesResult),
```
(Both options are `display`-kind, so `freshSetup` yields `options: {}` — the runner consumes only the roles array.)

In `src/lib/registry/catalog.ts`: add `import { FREQUENCIES_CROSSTABS } from './frequenciesCrosstabs'`; flip the catalog line to
```ts
  e('frequencies-crosstabs', 'Frequencies & cross-tabs', 'Descriptive statistics', undefined, 'available'),
```
and add `[FREQUENCIES_CROSSTABS.id]: FREQUENCIES_CROSSTABS` to the `SPECS` record.

In `src/lib/registry/catalog.consistency.test.ts`: ADD `'frequencies-crosstabs'` to the expected available-ids array. Tasks execute in order and this array grows cumulatively — it already holds whatever ids earlier tasks flipped plus `'independent-t-test'`; the filter emits CATALOG (tree) order, so insert `'frequencies-crosstabs'` in tree position (immediately after `'summary-statistics'` if present, otherwise first). If the test name still claims a fixed count, reword it to describe the current available set.

- [ ] **Step 9: Run everything** — `npx vitest run src/lib/registry/frequenciesCrosstabs.consistency.test.ts src/lib/stats/frequenciesCrosstabs.test.ts src/lib/results/buildFrequenciesCrosstabs.test.ts` → 11/11; full `npm test` green (suite grows by 11 over wherever the previous task left it, catalog test still green); `npx tsc -b` → 0.

- [ ] **Step 10: Commit**
```bash
git add src/lib/registry src/lib/stats src/lib/results
git commit -m "feat: frequencies-crosstabs — registry, stats, builder (card-faithful)"
```

---

## Task 12: Multi-test E2E journeys

**Files:** Create `tests/e2e/fixtures/paired.csv`; modify `tests/e2e/flow.spec.ts` (the two existing tests stay byte-untouched)

- [ ] **Step 1: Fixture** — `tests/e2e/fixtures/paired.csv` (pre = the control six, post = the treatment six — every assertion below is a spike-verified number):

```csv
pre,post
72,81
68,79
75,85
70,83
66,78
71,88
```

- [ ] **Step 2: Append journey A to `tests/e2e/flow.spec.ts`** — five tests on one dataset (the existing `study.csv` IS the spike's long12 fixture), exercising multi-select, five config steps, the combined NN-ordered results page, and the multi-folder zip:

```ts
async function configureStep(page: Page, stepName: RegExp, drags: [string, string][]) {
  // dnd-kit suppresses the first document click after a drag — click until the step screen actually swaps
  await expect(async () => {
    await page.getByRole('button', { name: stepName }).click()
    await expect(page.locator('.eyebrow').first()).toHaveText(stepName, { timeout: 1000 })
  }).toPass()
  for (const [chip, role] of drags) {
    await dragChip(page, chip, role)
    await expect(page.locator(`[data-role="${role}"] .chip.assigned`)).toContainText(chip) // the drop commits async (dnd-kit) — anchor before the next click
  }
}

async function runAnalysis(page: Page) {
  await expect(async () => { // same post-drag click suppression guard for the run button
    await page.getByRole('button', { name: 'Run analysis' }).click()
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible({ timeout: 1000 })
  }).toPass()
}

test('multi-test journey A: five tests, one dataset → combined results + 13-file zip', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/study.csv')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  for (const name of ['Summary statistics', 'Frequencies & cross-tabs', 'Distribution & normality', 'Independent t-test', 'Mann-Whitney U'])
    await page.getByRole('checkbox', { name }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  // tick order = tree order → steps/result order 01..05
  await dragChip(page, 'score', 'variables')                                   // 01 Summary (Group by left empty — optional)
  await expect(page.locator('[data-role="variables"] .chip.assigned')).toContainText('score')
  await configureStep(page, /Frequencies/, [['group', 'variables']])           // 02 Frequencies (1 variable → frequency table)
  await configureStep(page, /Distribution/, [['score', 'variable']])           // 03 Distribution & normality
  await configureStep(page, /Independent t-test|t-test/, [['score', 'outcome'], ['group', 'group']]) // 04
  await configureStep(page, /Mann-Whitney/, [['score', 'outcome'], ['group', 'group']])              // 05
  await runAnalysis(page)

  // 01 · Summary statistics — psych type-3 values (bare "Table." caption)
  await expect(page.getByText('01 · Summary statistics')).toBeVisible({ timeout: 300_000 })
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 300_000 }) // the 01 · eyebrow shows on the running placeholder too — Download enables only when ALL runs land
  const t01 = page.locator('#table-descriptives')
  await expect(t01).toContainText('76.33'); await expect(t01).toContainText('7.09')
  await expect(t01).toContainText('76.50'); await expect(t01).toContainText('0.11'); await expect(t01).toContainText('−1.49')
  // 02 · Frequencies — alphabetical categories, 1-dp %
  const t02 = page.locator('#table-frequencies')
  await expect(t02).toContainText('control'); await expect(t02).toContainText('50.0')
  // 03 · Distribution & normality — both test rows + both figures
  const t03 = page.locator('#table-normality')
  await expect(t03).toContainText('W 0.96'); await expect(t03).toContainText('.829')
  await expect(t03).toContainText('K–S (Lilliefors)'); await expect(t03).toContainText('D 0.15'); await expect(t03).toContainText('.681')
  await expect(page.getByRole('img', { name: /qq/i })).toBeVisible()
  // 04 · Independent t-test — the locked Welch numbers, unchanged by everything around them
  const t04 = page.locator('#table-t-test')
  await expect(t04).toContainText('−5.98'); await expect(t04).toContainText('9.68'); await expect(t04).toContainText('[−16.49, −7.51]')
  // 05 · Mann-Whitney — rank summary + APA with exact p
  const t05 = page.locator('#table-rank-summary')
  await expect(t05).toContainText('3.50'); await expect(t05).toContainText('21.00')
  await expect(page.locator('#table-mann-whitney')).toContainText('−2.88')
  await expect(page.getByText('A Mann-Whitney U test showed a difference, U=0, Z=−2.88, p=.002, r=−1.00.')).toBeVisible()

  // Combined zip: 13 files across five NN_ folders
  await page.getByRole('checkbox', { name: /Table images/ }).check()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download' }).click()])
  const entries = Object.keys(unzipSync(new Uint8Array(readFileSync((await download.path())!))))
  expect(entries.sort()).toEqual([
    '01_summary-statistics/figure_histogram_score.png',
    '01_summary-statistics/table_descriptives.png',
    '02_frequencies-crosstabs/figure_bar.png',
    '02_frequencies-crosstabs/table_frequencies.png',
    '03_distribution-normality/figure_histogram.png',
    '03_distribution-normality/figure_qq.png',
    '03_distribution-normality/table_normality.png',
    '04_independent-t-test/figure_boxplot.png',
    '04_independent-t-test/table_group-statistics.png',
    '04_independent-t-test/table_t-test.png',
    '05_mann-whitney-u/figure_boxplot.png',
    '05_mann-whitney-u/table_mann-whitney.png',
    '05_mann-whitney-u/table_rank-summary.png',
  ])
})
```
⚠ If a built table id in Tasks 5-11 differs from the ids used above (`descriptives`, `frequencies`, `normality`, `rank-summary`, `mann-whitney`), the registry is the source of truth — align THIS spec file to the registry ids and report the alignment.

- [ ] **Step 3: Append journey B** — the paired family + the μ₀ number input:

```ts
test('multi-test journey B: paired fixture → one-sample (typed μ₀), paired t, wilcoxon', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/paired.csv')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  for (const name of ['One-sample t-test', 'Paired t-test', 'Wilcoxon signed-rank'])
    await page.getByRole('checkbox', { name }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  // 01 One-sample: outcome ← post, μ₀ typed as 70 (the kind:'number' option control)
  await dragChip(page, 'post', 'outcome')
  await expect(page.locator('[data-role="outcome"] .chip.assigned')).toContainText('post')
  await page.getByLabel('test value (μ₀)').fill('70')
  await configureStep(page, /Paired t-test/, [['pre', 'conditionA'], ['post', 'conditionB']])
  await configureStep(page, /Wilcoxon/, [['pre', 'conditionA'], ['post', 'conditionB']])
  await runAnalysis(page)

  // 01 · One-sample — difference CI (mean CI − μ₀), spike-verified
  await expect(page.getByText('01 · One-sample t-test')).toBeVisible({ timeout: 300_000 })
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled({ timeout: 300_000 }) // the 01 · eyebrow shows on the running placeholder too — Download enables only when ALL runs land
  const o = page.locator('#table-one-sample-t-test')
  await expect(o).toContainText('70')      // Test value cell = the typed μ₀
  await expect(o).toContainText('8.00'); await expect(o).toContainText('[8.37, 16.30]'); await expect(o).toContainText('3.27')
  await expect(page.getByText('A one-sample t-test showed M=82.3 differed from 70, t(5)=8.00, p<.001, d=3.27.')).toBeVisible()
  // 02 · Paired t — d_z and the A−B difference CI
  await expect(page.getByText('A paired-samples t-test showed a change of M=−12.0, t(5)=−10.39, p<.001, dz=−4.24.')).toBeVisible()
  const pt = page.locator('#table-paired-t-test')
  await expect(pt).toContainText('−10.39'); await expect(pt).toContainText('[−14.97, −9.03]'); await expect(pt).toContainText('−4.24')
  // 03 · Wilcoxon — exact p with the asymptotic Z (card-specified mix)
  await expect(page.getByText('A Wilcoxon signed-rank test showed a change, Z=−2.20, p=.031, r=−1.00.')).toBeVisible()
  const w = page.locator('#table-signed-rank')
  await expect(w).toContainText('0.00'); await expect(w).toContainText('−2.20'); await expect(w).toContainText('−1.00')
})
```
⚠ Both new-test Table-2 specs reuse the id `t-test` in their cards (`table_t-test.png` in both bundles) — if Tasks 5/6 disambiguated the DOM ids (they must, since `#table-t-test` would collide across cards on one page), align journey B's locators to the registry ids and report. **This collision is a real cross-task seam: the validation replay MUST confirm the one-sample and paired Table-2 DOM ids are unique on a combined page, and that their zip filenames (scoped inside different `NN_` folders) keep the card-faithful `table_t-test.png` name.**

- [ ] **Step 4: Run** — `npm run e2e` → 4/4 (the two pre-existing tests byte-untouched and green; the two journeys green). `npm test` still all green. NOTE: if port 4173 is busy — e.g. a leftover preview — kill it or use an alternate-port config; the committed playwright.config.ts stays untouched.

- [ ] **Step 5: Commit**
```bash
git add tests/e2e && git commit -m "feat: multi-test e2e journeys (five-test combined run + paired family with typed μ₀)"
```

---

## Task 13: README + final gates + Benjie checkpoint

**Files:** Modify `README.md`

- [ ] **Step 1: README** — update the flow paragraph: "8 of the 46 tests run live (descriptives, frequencies, normality, the t-test family, Mann-Whitney, Wilcoxon); the rest remain greyed with honest reasons." Update the unit-test count to the real total (35 vitest files / 161 tests); note the engine now preloads six R packages on first visit (cached afterwards).

- [ ] **Step 2: Full gates** — `npx tsc -b` → 0 · `npm test` → ALL green · `npm run build` → green · `npm run e2e` → 4/4.

- [ ] **Step 3: Fresh-clone check** — clone → `npm install` → `npm test` → `npm run build` → green; delete the clone; report timings.

- [ ] **Step 4: Screenshot set** — production preview: refresh `.superpowers/screens/` with `pick-tests.png` (8 live tests), `results-multi.png` (journey A's five-card results page), `test-config-onesample.png` (the μ₀ input). **Then STOP: Benjie clicks through before any push/deploy.** Never push.

- [ ] **Step 5: Commit**
```bash
git add README.md && git commit -m "docs: README for the core-tests slice"
```

---

## Done — definition of success

- All unit/consistency suites green: the walking-skeleton + flow suites unchanged, PLUS 7 new card consistency suites (equality + mutation-proven, both spec files), 7 stats modules with cross-verified known answers (both toggle positions / both μ₀ values / both frequencies branches), 8 builders tested, generalized store/eligibility suites.
- `npm run e2e` 4/4: both existing journeys byte-untouched; journey A (five tests, one dataset, 13-file NN-foldered zip); journey B (paired family + typed μ₀, difference-CI).
- The picker shows 8 live tests; 38 still greyed honestly. Every rendered word on the new cards traces to the spec HTML through a consistency test.
- Benjie's click-through (Task 13 checkpoint) before any push/deploy — both remain his calls.
- **Deferred (recorded):** the other 38 tests; report formats; α/tails/CI + descriptive-pill controls; SEM canvas; analytics; feedback URL.
