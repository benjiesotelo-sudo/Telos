# Telos Frontend Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full `telos_ui_spec.html` experience — Workday-style stepper, Welcome → Upload (CSV + Excel) → Terms guide → Configure data → 46-test picker → drag-slot test config → Results/export — with the independent t-test running live end-to-end, per the approved spec `docs/superpowers/specs/2026-06-11-telos-frontend-flow-design.md`.

**Architecture:** Wizard as a state machine in the existing Zustand store (no router). All screen content verbatim from the spec files, enforced by consistency tests (t-test card, 46-test catalog vs the ui-spec tree, Welcome/Terms copy). Data layer: PapaParse CSV + SheetJS Excel → one `Dataset`; client-side type detection / level suggestion / missing-data policy; one eligibility engine for picker grey-outs and slot compatibility. The proven WebR engine / stats / zip / APA-formatting layers are untouched.

**Design language (locked by Benjie):** dominantly white tool surfaces on the warm paper background (`--bg` light `#f0efe9`), Workday-style numbered stepper (✓ done · blue-ring current · gray locked; grows a numbered per-test step), blue `#185fa5` as the single accent, small gray uppercase labels, hairline borders, Crimson Pro in page titles only. Light is canonical; dark remains the automatic `prefers-color-scheme` variant.

**Tech Stack additions:** `xlsx` (SheetJS, via the official SheetJS CDN tarball) · `@dnd-kit/core` + `@dnd-kit/utilities` (drag-slots). Everything else as shipped in the walking skeleton.

**Process:** directly on `main` — confirmed by Benjie at kickoff (2026-06-11), with subagent-driven execution and no pre-build full replay; Benjie decides every push point. **NEVER push.**

**Pre-validation:** the mechanics marked ⚠ in tasks below (SheetJS tarball/API, dnd-kit+Playwright drag recipe, datetime detection, new consistency regexes against the real spec HTML) must be confirmed by the empirical validation workflow before execution; amendments land in this file with rationale.

---

## File structure

| File | Responsibility |
|---|---|
| `src/lib/registry/types.ts` | + `Level`, `RoleConstraint`, `TestConstraints`; `TestSpec` gains `constraints` |
| `src/lib/registry/catalog.ts` | All 46 tests: id, name, family, subfamily, status (`available`/`later-slice`) |
| `src/lib/registry/specHtml.ts` | Shared spec-HTML test helpers: `decode`, `strip`, `readSpec` (tests only) |
| `src/lib/registry/catalog.consistency.test.ts` | Catalog ≡ ui-spec picker tree (equality) |
| `src/lib/registry/independentTTest.ts` | + machine-readable `constraints` (display strings untouched) |
| `src/lib/data/columnMeta.ts` | `ColumnMeta`, `detectType`, `detectTags`, `suggestLevel`, `deriveColumns`, `fixType` |
| `src/lib/data/parseExcel.ts` | SheetJS workbook → sheet names + `Dataset` |
| `src/lib/data/missing.ts` | `applyMissingPolicy` (leave / drop / impute mean-mode) |
| `src/lib/eligibility/eligibility.ts` | `testEligibility`, `slotCompatibility` (one engine for steps 5 + 6) |
| `src/content/copy.ts` | Welcome / Terms / Upload copy verbatim from ui_spec (DRAFT passages as written) |
| `src/content/copy.consistency.test.ts` | Copy ≡ ui-spec explain blocks |
| `src/lib/webr/getEngine.ts` | The memoized engine singleton (moved out of the old TestConfig) |
| `src/state/session.ts` | REWRITE: flow state machine — steps, gates, back-edit invalidation, run lifecycle |
| `src/components/Stepper.tsx` | Workday-style stepper driven by the store |
| `src/components/DragSlots.tsx` | dnd-kit chips → role slots |
| `src/components/screens/*.tsx` | `WelcomeScreen`, `UploadScreen`, `GuideScreen`, `ConfigureDataScreen`, `PickTestsScreen`, `TestConfigScreen`, `ResultsScreen` |
| `src/components/ResultPreviewCard.tsx` | The `NN · Test name` preview card (APA tables, figure, how-to-read, APA line) |
| `src/lib/export/capture.ts` | `captureNode` / `dataUrlToBytes` (moved from the old ExportButton) |
| `src/styles/tokens.css` | + stepper/card/button/pill/label component styles (light-first) |
| `src/App.tsx` | Stepper + screen switch + ResultBoundary |
| `tests/e2e/flow.spec.ts` | Full-journey e2e (replaces `slice.spec.ts`) |
| Deleted in Task 16 | `DatasetLoader.tsx`, `TestConfig.tsx`, `ResultCard.tsx`, `ExportButton.tsx`, `src/lib/data/sample.ts`, `tests/e2e/slice.spec.ts` |

**Shared type contracts (used by every later task — defined once here):**

```ts
// src/lib/registry/types.ts (additions)
export type Level = 'nominal' | 'ordinal' | 'interval' | 'ratio'
export interface RoleConstraint { roleId: string; levels: Level[]; arity: { exact: number }; categories?: { exact: number } }
export interface TestConstraints { roles: RoleConstraint[]; minRowsPerGroup: number }

// src/lib/data/columnMeta.ts
export type DetectedType = 'int64' | 'float64' | 'object' | 'bool' | 'datetime64'
export type Tag = 'count' | 'datetime' | 'id' | 'nested' // full spec tag vocabulary; 'nested' has no auto-detector in this slice (recorded decision — never emitted by detectTags)
export interface ColumnMeta { name: string; detected: DetectedType; tags: Tag[]; level: Level | null; used: boolean }

// src/state/session.ts
export type StepId = 'welcome' | 'upload' | 'guide' | 'configure-data' | 'pick-tests' | `test:${string}` | 'results'
export type MissingPolicy = 'leave' | 'drop' | 'impute'
export interface FileInfo { name: string; rows: number; cols: number; encoding: string }
export interface TestSetup { roles: Record<string, string | null>; equalVariance: boolean; blocked: string | null }
export interface TestRun { result: TTestResult; stale: boolean }
```

`Dataset` (in `src/lib/stats/types.ts`) widens its row value type to `string | number | boolean | null` (PapaParse and SheetJS both emit booleans; the listwise filter already excludes them from numeric roles).

---

## Task 1: Dependencies + design tokens

**Files:** Modify `package.json` (via npm install), `src/styles/tokens.css`

- [ ] **Step 1: Install** ⚠ (SheetJS official channel is the CDN tarball; the validation workflow pins the exact working URL/version)

```bash
npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
npm i @dnd-kit/core @dnd-kit/utilities
```
Expected: `xlsx`, `@dnd-kit/core`, `@dnd-kit/utilities` in `package.json` dependencies; `npm test` still 19/19.

- [ ] **Step 2: Extend `src/styles/tokens.css`** — append component styles (palette/font tokens already exist; light values are canonical, dark inherits the existing media-query mechanism):

```css
:root{ --accent:#185fa5; --accent-contrast:#ffffff; --accent-soft:#e8f0fe; --error-bg:#fdf3f1; --error-line:#e5b3a4; --error-tx:#993c1d; --disabled:#c8c7c0; }
@media (prefers-color-scheme:dark){ :root{ --accent:#9cc2ec; --accent-contrast:#0c2a4c; --accent-soft:#0c447c; --error-bg:#3a2620; --error-line:#7a2d16; --error-tx:#f4c4b0; } }
.screen{max-width:760px;margin:0 auto;padding:24px 16px 64px;}
.eyebrow{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.09em;font-weight:700;}
.title{font-family:var(--font-display);font-size:28px;font-weight:600;margin:4px 0 14px;}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin:10px 0;}
.btn{border:0;border-radius:8px;padding:9px 22px;font-size:14px;font-weight:700;font-family:var(--font-ui);cursor:pointer;background:var(--accent);color:var(--accent-contrast);}
.btn:disabled{background:var(--disabled);cursor:not-allowed;}
.btn-row{display:flex;justify-content:flex-end;align-items:center;gap:12px;margin-top:14px;}
.hint{font-size:12px;color:var(--muted);}
.pill{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:3px 12px;font-size:13px;color:var(--muted);}
.pill.on{background:var(--accent-soft);border-color:var(--accent);color:var(--accent);font-weight:600;}
.error-box{background:var(--error-bg);border:1px solid var(--error-line);border-radius:8px;padding:8px 12px;font-size:13px;color:var(--error-tx);margin-top:10px;}
.stepper{position:sticky;top:0;z-index:20;background:var(--bg);display:flex;align-items:center;justify-content:space-between;max-width:560px;margin:0 auto 8px;padding:10px 0 6px;}
.step{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;color:var(--muted);background:none;border:0;padding:0;font-family:var(--font-ui);cursor:default;}
.step .dot{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:var(--card);border:1.5px solid var(--line);color:var(--muted);}
.step.done .dot{background:var(--accent);border-color:var(--accent);color:var(--accent-contrast);}
.step.current{color:var(--text);font-weight:700;}
.step.current .dot{border:2px solid var(--accent);color:var(--accent);}
.step.done{cursor:pointer;}
.connector{flex:1;height:1.5px;background:var(--line);margin:0 6px 15px;}
.connector.done{background:var(--accent);}
.chip{background:var(--bg);border:1px solid var(--line);border-radius:7px;padding:3px 10px;font-size:13px;display:inline-block;}
.chip.assigned{background:var(--accent-soft);border-color:var(--accent);color:var(--accent);font-weight:600;}
.chip.incompatible{opacity:.45;}
.slot{background:var(--card);border:1.5px dashed var(--line);border-radius:10px;padding:9px 13px;margin:8px 0;font-size:13px;}
.slot.over{border-color:var(--accent);}
.cols-table{width:100%;border-collapse:collapse;font-size:13.5px;}
.cols-table th{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;text-align:left;padding:7px 10px;}
.cols-table td{padding:7px 10px;border-top:1px solid var(--line);}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;color:var(--muted);}
```
Note — three changes to the EXISTING rules (validation findings): (1) the old `.card{background:var(--card);border-radius:12px;}` rule is REPLACED by the `.card` rule above (delete the old line); (2) the old `h1,h2,h3,.display{font-family:var(--font-display);}` line is DELETED — `.title` alone carries Crimson Pro (decision: page titles only; the retired ResultCard that used `.display` is deleted in Task 10); (3) the base palette is FLIPPED to light-canonical per the locked design decision — replace:
```css
:root{ --bg:#1b1b1b; --card:#262624; --text:#e8e6df; --muted:#a3a199; --line:rgba(255,255,255,0.18);
  --blue-sub:#9cc2ec; --font-display:'Crimson Pro',Georgia,serif; --font-ui:'Atkinson Hyperlegible',system-ui,sans-serif; }
@media (prefers-color-scheme:light){ :root{ --bg:#f0efe9; --card:#fff; --text:#2c2c2a; --muted:#5f5e5a; --line:rgba(0,0,0,0.22); } }
```
with:
```css
:root{ --bg:#f0efe9; --card:#fff; --text:#2c2c2a; --muted:#5f5e5a; --line:rgba(0,0,0,0.22);
  --blue-sub:#9cc2ec; --font-display:'Crimson Pro',Georgia,serif; --font-ui:'Atkinson Hyperlegible',system-ui,sans-serif; }
@media (prefers-color-scheme:dark){ :root{ --bg:#1b1b1b; --card:#262624; --text:#e8e6df; --muted:#a3a199; --line:rgba(255,255,255,0.18); } }
```
(keeps the approved warm paper `#f0efe9` and makes light canonical; dark stays the automatic variant). The `table.apa` rules stay exactly as shipped.

- [ ] **Step 3: Verify** — `npx tsc -b` exit 0; `npm test` 19/19; `npm run dev` loads (placeholder app unchanged).

- [ ] **Step 4: Commit**
```bash
git add package.json package-lock.json src/styles/tokens.css
git commit -m "build: xlsx + dnd-kit deps; light-first component tokens"
```

---

## Task 2: Spec-HTML test helper (shared, with the extended entity list)

**Files:** Create `src/lib/registry/specHtml.ts`; modify `src/lib/registry/registry.consistency.test.ts`

- [ ] **Step 1: Create `src/lib/registry/specHtml.ts`** (imported by tests only):

```ts
import { readFileSync } from 'node:fs'

export const readSpec = (file: 'telos_ui_spec.html' | 'telos_test_inputs.html' | 'telos_test_outputs.html') =>
  readFileSync(file, 'utf8')

export const decode = (s: string) => s
  .replace(/&mdash;/g, '—').replace(/&minus;/g, '−').replace(/&middot;/g, '·')
  .replace(/&rarr;/g, '→').replace(/&alpha;/g, 'α').replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
  .replace(/&hellip;/g, '…').replace(/&times;/g, '×').replace(/&ndash;/g, '–').replace(/&deg;/g, '°')
  .replace(/&amp;/g, '&')

export const strip = (s: string) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
```

- [ ] **Step 2: Refactor `src/lib/registry/registry.consistency.test.ts`** to import `strip` from `./specHtml` (ONLY `strip` — `decode` is used solely inside `strip`; importing it too fails `npx tsc -b` with TS6133 under `noUnusedLocals` — sandbox-verified) and delete the local `decode`/`strip` copies (lines 11-14 of the current file). Exact new import line: `import { strip } from './specHtml'`. Assertions, slices, and everything else stay byte-identical. (Rationale: Task 3/9 reuse these helpers; the extended entity list was a recorded reviewer recommendation from the walking-skeleton build.)

- [ ] **Step 3: Run** — `npx vitest run src/lib/registry/registry.consistency.test.ts` → 6/6 PASS (no behavior change). `npm test` 19/19.

- [ ] **Step 4: Commit**
```bash
git add src/lib/registry && git commit -m "refactor: shared spec-HTML test helpers with extended entity decoding"
```

---

## Task 3: The 46-test catalog + consistency test

**Files:** Create `src/lib/registry/catalog.ts`, `src/lib/registry/catalog.consistency.test.ts`

- [ ] **Step 1: `src/lib/registry/catalog.ts`** — every leaf of the ui-spec picker tree, in tree order:

```ts
export type CatalogStatus = 'available' | 'later-slice'
export interface CatalogEntry { id: string; name: string; family: string; subfamily?: string; status: CatalogStatus; short?: string; note?: string } // note: the ui-spec tree's inline leaf annotation (SEM leaves), rendered verbatim

// Encoded from telos_ui_spec.html "5 · Pick a test" tree. Names verbatim (entities decoded).
const e = (id: string, name: string, family: string, subfamily?: string, status: CatalogStatus = 'later-slice', short?: string): CatalogEntry =>
  ({ id, name, family, ...(subfamily ? { subfamily } : {}), status, ...(short ? { short } : {}) })

export const CATALOG: CatalogEntry[] = [
  e('summary-statistics', 'Summary statistics', 'Descriptive statistics'),
  e('frequencies-crosstabs', 'Frequencies & cross-tabs', 'Descriptive statistics'),
  e('distribution-normality', 'Distribution & normality', 'Descriptive statistics'),
  e('one-sample-t-test', 'One-sample t-test', 'Group comparisons', 'Parametric'),
  e('independent-t-test', 'Independent t-test', 'Group comparisons', 'Parametric', 'available', 't-test'),
  e('paired-t-test', 'Paired t-test', 'Group comparisons', 'Parametric'),
  e('one-way-anova', 'One-way ANOVA + post-hoc', 'Group comparisons', 'Parametric'),
  e('factorial-anova', 'Factorial ANOVA', 'Group comparisons', 'Parametric'),
  e('repeated-measures-anova', 'Repeated-measures ANOVA', 'Group comparisons', 'Parametric'),
  e('nested-anova', 'Nested ANOVA', 'Group comparisons', 'Parametric'),
  e('welch-anova', "Welch's ANOVA", 'Group comparisons', 'Parametric'),
  e('ancova', 'ANCOVA', 'Group comparisons', 'Parametric'),
  e('manova', 'MANOVA', 'Group comparisons', 'Parametric'),
  e('mancova', 'MANCOVA', 'Group comparisons', 'Parametric'),
  e('mann-whitney-u', 'Mann-Whitney U', 'Group comparisons', 'Nonparametric'),
  e('wilcoxon-signed-rank', 'Wilcoxon signed-rank', 'Group comparisons', 'Nonparametric'),
  e('kruskal-wallis', 'Kruskal-Wallis', 'Group comparisons', 'Nonparametric'),
  e('friedman', 'Friedman', 'Group comparisons', 'Nonparametric'),
  e('pearson', 'Pearson', 'Association', 'Correlation'),
  e('spearman', 'Spearman', 'Association', 'Correlation'),
  e('kendalls-tau', "Kendall's tau", 'Association', 'Correlation'),
  e('chi-square-independence', 'Chi-square independence', 'Association', 'Categorical'),
  e('chi-square-goodness-of-fit', 'Chi-square goodness-of-fit', 'Association', 'Categorical'),
  e('fishers-exact', "Fisher's exact", 'Association', 'Categorical'),
  e('simple-linear-regression', 'Simple linear regression', 'Regression & prediction'),
  e('multiple-linear-regression', 'Multiple linear regression', 'Regression & prediction'),
  e('logistic-regression', 'Logistic regression', 'Regression & prediction'),
  e('poisson-negative-binomial', 'Poisson / negative binomial', 'Regression & prediction'),
  e('arima-sarima', 'ARIMA / SARIMA', 'Econometrics', 'Time series'),
  e('stationarity-tests', 'Stationarity tests (ADF, KPSS)', 'Econometrics', 'Time series'),
  e('granger-causality', 'Granger causality', 'Econometrics', 'Time series'),
  e('var', 'VAR', 'Econometrics', 'Time series'),
  e('fixed-effects', 'Fixed effects', 'Econometrics', 'Panel data'),
  e('random-effects', 'Random effects', 'Econometrics', 'Panel data'),
  e('hausman-test', 'Hausman test', 'Econometrics', 'Panel data'),
  e('did', 'Difference-in-differences (DiD)', 'Econometrics', 'Causal inference'),
  e('rdd', 'Regression discontinuity (RDD)', 'Econometrics', 'Causal inference'),
  e('iv-2sls', 'Instrumental variables (IV / 2SLS)', 'Econometrics', 'Causal inference'),
  e('propensity-score-matching', 'Propensity score matching', 'Econometrics', 'Causal inference'),
  e('cronbachs-alpha', "Cronbach's alpha", 'Latent variable models', 'Reliability'),
  e('ave', 'Average variance extracted (AVE)', 'Latent variable models', 'Reliability'),
  e('composite-reliability', 'Composite reliability (CR)', 'Latent variable models', 'Reliability'),
  e('efa', 'Exploratory factor analysis (EFA)', 'Latent variable models', 'Factor analysis'),
  e('pca', 'Principal component analysis (PCA)', 'Latent variable models', 'Factor analysis'),
  { id: 'cb-sem', name: 'CB-SEM', family: 'Latent variable models', subfamily: 'Structural equation modeling', status: 'later-slice',
    note: '— pipeline stages selectable: CFA & model fit always run, EFA and the structural stage optional (default: all on); includes path analysis & mediation via drawn path chains (indirect-effects table, bootstrapped CIs); moderation planned for a later version' },
  { id: 'pls-sem', name: 'PLS-SEM', family: 'Latent variable models', subfamily: 'Structural equation modeling', status: 'later-slice',
    note: '— includes path analysis & mediation via drawn path chains (indirect-effects table, bootstrapped CIs); moderation planned for a later version' },
]

export const FAMILIES = [...new Set(CATALOG.map((c) => c.family))] // tree order
export const LATER_SLICE_REASON = 'arrives in a later slice'
```

- [ ] **Step 2: Failing consistency test** ⚠ (regexes verified against the real file by the validation workflow) — `src/lib/registry/catalog.consistency.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CATALOG } from './catalog'
import { readSpec, strip } from './specHtml'

// Scope to the picker tree: from the picktree div to the assumption-diagnostics tbd line.
const html = readSpec('telos_ui_spec.html')
const tree = html.slice(html.indexOf('class="picktree"'), html.indexOf('Assumption diagnostics'))

// Parse the tree into [{ family, subfamily, leaf }] in document order.
const rows: { family: string; subfamily?: string; leaf: string }[] = []
let family = '', subfamily: string | undefined
for (const m of tree.matchAll(/<div class="(fam|sub|leaf)">(.*?)<\/div>/gs)) {
  const text = strip(m[2].replace(/<span class="nt">.*?<\/span>/gs, '')) // drop tree-note annotations (e.g. the SEM pipeline note)
  if (m[1] === 'fam') { family = text.replace(/^\d+ · /, ''); subfamily = undefined }
  else if (m[1] === 'sub') subfamily = text
  else rows.push({ family, ...(subfamily ? { subfamily } : {}), leaf: text })
}

describe('catalog stays faithful to the ui-spec picker tree', () => {
  it('has exactly the 46 leaves, in tree order, under the right family/subfamily', () => {
    expect(rows).toEqual(CATALOG.map((c) => ({ family: c.family, ...(c.subfamily ? { subfamily: c.subfamily } : {}), leaf: c.name })))
  })
  it('exactly one test is available in this slice: the independent t-test', () => {
    expect(CATALOG.filter((c) => c.status === 'available').map((c) => c.id)).toEqual(['independent-t-test'])
  })
})
```

- [ ] **Step 3: Run** — `npx vitest run src/lib/registry/catalog.consistency.test.ts` → PASS (if the leaf parse mismatches, fix the CATALOG to match the tree — the spec HTML is the source of truth; report any such fix).

- [ ] **Step 3b: Mutation check (same discipline as the t-test card):** temporarily change `'Pearson'` to `'Pearson r'` in catalog.ts → run → must FAIL; swap the catalog order of `'one-sample-t-test'` and `'independent-t-test'` → must FAIL; flip `independent-t-test`'s status to `'later-slice'` → the available-tests assertion must FAIL. Revert all; re-run → PASS.

- [ ] **Step 4: Commit**
```bash
git add src/lib/registry && git commit -m "feat: 46-test catalog encoded from the ui-spec tree + consistency test"
```

---

## Task 4: Machine-readable constraints on the t-test registry entry

**Files:** Modify `src/lib/registry/types.ts`, `src/lib/registry/independentTTest.ts`

- [ ] **Step 1: Add to `src/lib/registry/types.ts`** (append; nothing existing changes):

```ts
export type Level = 'nominal' | 'ordinal' | 'interval' | 'ratio'
export interface RoleConstraint { roleId: string; levels: Level[]; arity: { exact: number }; categories?: { exact: number } }
export interface TestConstraints { roles: RoleConstraint[]; minRowsPerGroup: number }
```
And extend the `TestSpec` interface with one field: `constraints: TestConstraints`.

- [ ] **Step 2: Add to `src/lib/registry/independentTTest.ts`** — inside `INDEPENDENT_T_TEST`, after `options`:

```ts
  // Machine-readable mirror of the verbatim role strings above (display strings stay the spec's text).
  // minRowsPerGroup: the ui-spec step-5 DRAFT 'at least 3 complete rows per group', implemented as written.
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { exact: 1 } },
      { roleId: 'group', levels: ['nominal', 'ordinal'], arity: { exact: 1 }, categories: { exact: 2 } },
    ],
    minRowsPerGroup: 3,
  },
```

- [ ] **Step 3: Export the runnable-spec lookup** — append to `src/lib/registry/catalog.ts` (single source for "which tests can actually run"; the store and every screen import THIS, never their own copies):

```ts
import type { TestSpec } from './types'
import { INDEPENDENT_T_TEST } from './independentTTest'

/** Runnable test specs this slice ships; later slices add entries here. Keys = catalog ids. */
export const SPECS: Record<string, TestSpec> = { [INDEPENDENT_T_TEST.id]: INDEPENDENT_T_TEST }
```
(Imports go at the top of catalog.ts.)

- [ ] **Step 4: Run** — `npm test` → all green (the existing consistency tests assert specific fields by equality; a new field cannot break them). `npx tsc -b` → 0.

- [ ] **Step 5: Commit**
```bash
git add src/lib/registry && git commit -m "feat: machine-readable role constraints for the t-test + SPECS lookup"
```

---

## Task 5: Column metadata — type detection, tags, level suggestion

**Files:** Create `src/lib/data/columnMeta.ts`, `src/lib/data/columnMeta.test.ts`; modify `src/lib/stats/types.ts`

- [ ] **Step 1: Widen `Dataset`** in `src/lib/stats/types.ts` — change the rows type to:

```ts
export interface Dataset { columns: string[]; rows: Record<string, string | number | boolean | null>[] } // null: empty cell; boolean: PapaParse/SheetJS native
```

- [ ] **Step 2: Failing test** — `src/lib/data/columnMeta.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { deriveColumns, detectType, suggestLevel, fixType, compatibleLevels } from './columnMeta'
import type { Dataset } from '../stats/types'

const ds: Dataset = { columns: ['id', 'wage', 'female', 'hired', 'note', 'start'], rows: [
  { id: 1, wage: 12.5, female: 0, hired: true, note: 'a', start: '2024-01-05' },
  { id: 2, wage: 9.25, female: 1, hired: false, note: 'b', start: '2024-02-11' },
  { id: 3, wage: 11.0, female: 1, hired: true, note: null, start: '2024-03-20' },
] }

describe('detectType', () => {
  it('classifies with the spec vocabulary', () => {
    expect(detectType([1, 2, 3])).toBe('int64')
    expect(detectType([1.5, 2, null])).toBe('float64')   // nulls ignored
    expect(detectType([true, false])).toBe('bool')
    expect(detectType(['2024-01-05', '2024-02-11'])).toBe('datetime64')
    expect(detectType(['a', 'b'])).toBe('object')
    expect(detectType([null, null])).toBe('object')      // nothing to go on
    expect(detectType(['1', '2'])).toBe('object')        // numeric-as-text stays object — that's what fix-type is for
  })
})

describe('deriveColumns', () => {
  const cols = deriveColumns(ds)
  it('detects types, tags and pre-fills suggested levels', () => {
    expect(cols.map((c) => [c.name, c.detected, c.level, c.used])).toEqual([
      ['id', 'int64', null, false],          // id tag → excluded by default, no level
      ['wage', 'float64', 'ratio', true],
      ['female', 'int64', 'ratio', true],    // numeric → ratio suggestion (student corrects to nominal in the UI)
      ['hired', 'bool', 'nominal', true],
      ['note', 'object', 'nominal', true],
      ['start', 'datetime64', 'interval', true],
    ])
  })
  it('tags: consecutive unique ints → id; nonneg ints → count; datetime64 → datetime', () => {
    expect(cols.find((c) => c.name === 'id')!.tags).toContain('id')
    expect(cols.find((c) => c.name === 'female')!.tags).toContain('count')
    expect(cols.find((c) => c.name === 'start')!.tags).toEqual(['datetime'])
  })
})

describe('fixType', () => {
  it('coerces numeric-as-text to numbers; unparseable becomes null (missing)', () => {
    const d: Dataset = { columns: ['x'], rows: [{ x: '12' }, { x: ' 3.5 ' }, { x: 'n/a' }] }
    const fixed = fixType(d, 'x')
    expect(fixed.rows.map((r) => r.x)).toEqual([12, 3.5, null])
  })
})

describe('suggestLevel', () => {
  it('maps detected type → level per the spec note', () => {
    expect(suggestLevel('int64')).toBe('ratio'); expect(suggestLevel('float64')).toBe('ratio')
    expect(suggestLevel('object')).toBe('nominal'); expect(suggestLevel('bool')).toBe('nominal')
    expect(suggestLevel('datetime64')).toBe('interval')
  })
})

describe('compatibleLevels', () => {
  it('limits level choices to what the stored type supports (spec 4d: "within compatibility")', () => {
    expect(compatibleLevels('float64')).toEqual(['nominal', 'ordinal', 'interval', 'ratio'])
    expect(compatibleLevels('object')).toEqual(['nominal', 'ordinal'])
    expect(compatibleLevels('bool')).toEqual(['nominal', 'ordinal'])
    expect(compatibleLevels('datetime64')).toEqual(['nominal', 'ordinal', 'interval'])
  })
})
```

- [ ] **Step 3: Run → fails** — `npx vitest run src/lib/data/columnMeta.test.ts` → FAIL (no module).

- [ ] **Step 4: Implement** — `src/lib/data/columnMeta.ts`:

```ts
import type { Dataset } from '../stats/types'
import type { Level } from '../registry/types'

export type DetectedType = 'int64' | 'float64' | 'object' | 'bool' | 'datetime64'
export type Tag = 'count' | 'datetime' | 'id' | 'nested' // full spec tag vocabulary; 'nested' has no auto-detector in this slice (recorded decision — never emitted by detectTags)
export interface ColumnMeta { name: string; detected: DetectedType; tags: Tag[]; level: Level | null; used: boolean }

const DATE_RE = /^\d{4}-\d{2}-\d{2}([T ].*)?$/ // ⚠ conservative ISO-date heuristic; validation workflow probes edge cases

export function detectType(values: (string | number | boolean | null)[]): DetectedType {
  const v = values.filter((x): x is string | number | boolean => x !== null)
  if (!v.length) return 'object'
  if (v.every((x) => typeof x === 'boolean')) return 'bool'
  if (v.every((x) => typeof x === 'number')) return v.every((x) => Number.isInteger(x)) ? 'int64' : 'float64'
  if (v.every((x) => typeof x === 'string' && DATE_RE.test(x))) return 'datetime64'
  return 'object'
}

export function detectTags(values: (string | number | boolean | null)[], detected: DetectedType): Tag[] {
  const tags: Tag[] = []
  const v = values.filter((x) => x !== null)
  if (detected === 'datetime64') tags.push('datetime')
  if (detected === 'int64') {
    const nums = v as number[]
    if (nums.every((x) => x >= 0)) tags.push('count')
    // id = a serial column: unique ints forming ONE consecutive run (1..n style). Plain uniqueness is not
    // enough — real outcome columns (test scores, wages) are routinely all-unique and must stay Used.
    // (min/max via loop: spread Math.max(...nums) throws RangeError at ~125k elements; spec allows 100k rows)
    let min = Infinity, max = -Infinity
    for (const x of nums) { min = Math.min(min, x); max = Math.max(max, x) }
    if (nums.length > 1 && new Set(nums).size === nums.length && max - min === nums.length - 1) tags.push('id')
  }
  return tags
}

export function suggestLevel(detected: DetectedType): Level {
  if (detected === 'int64' || detected === 'float64') return 'ratio'
  if (detected === 'datetime64') return 'interval'
  return 'nominal' // object, bool
}

export function deriveColumns(ds: Dataset): ColumnMeta[] {
  return ds.columns.map((name) => {
    const values = ds.rows.map((r) => r[name] ?? null)
    const detected = detectType(values)
    const tags = detectTags(values, detected)
    const isId = tags.includes('id')
    return { name, detected, tags, level: isId ? null : suggestLevel(detected), used: !isId }
  })
}

/** Spec 4d: the level is changeable only within what the stored type supports; "fix type" is the route to numeric levels. */
export function compatibleLevels(detected: DetectedType): Level[] {
  if (detected === 'int64' || detected === 'float64') return ['nominal', 'ordinal', 'interval', 'ratio']
  if (detected === 'datetime64') return ['nominal', 'ordinal', 'interval']
  return ['nominal', 'ordinal'] // object, bool — DRAFT mapping, Benjie confirms at rendered review
}

/** The spec's "fix type" override: numeric-as-text → numbers; unparseable → null (missing). */
export function fixType(ds: Dataset, column: string): Dataset {
  const rows = ds.rows.map((r) => {
    const raw = r[column]
    if (typeof raw !== 'string') return r
    const n = Number(raw.trim())
    return { ...r, [column]: raw.trim() !== '' && Number.isFinite(n) ? n : null }
  })
  return { ...ds, rows }
}
```

- [ ] **Step 5: Run → passes.** `npx tsc -b` → 0. Commit:
```bash
git add src/lib/data src/lib/stats/types.ts
git commit -m "feat: column metadata - type detection, tags, level suggestion, fix-type"
```

---

## Task 6: Excel parsing (SheetJS)

**Files:** Create `src/lib/data/parseExcel.ts`, `src/lib/data/parseExcel.test.ts`

- [ ] **Step 1: Failing test** ⚠ (SheetJS API verified by the validation workflow) — `src/lib/data/parseExcel.test.ts` builds a real in-memory workbook, so no binary fixture is committed:

```ts
import { describe, it, expect } from 'vitest'
import { utils, write } from 'xlsx'
import { listSheets, parseExcelSheet } from './parseExcel'

function workbookBytes(): ArrayBuffer {
  const wb = utils.book_new()
  utils.book_append_sheet(wb, utils.aoa_to_sheet([['group', 'score', 'start'], ['A', 10, new Date(2024, 0, 5)], ['B', null, null], ['A', 12.5, new Date(2024, 2, 20)]], { cellDates: true }), 'Survey')
  utils.book_append_sheet(wb, utils.aoa_to_sheet([['x'], [1]]), 'Extra')
  return write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

describe('parseExcel', () => {
  const bytes = workbookBytes()
  it('lists sheet names in workbook order', () => {
    expect(listSheets(bytes)).toEqual(['Survey', 'Extra'])
  })
  it('parses the chosen sheet: header row 1, typed cells, empty cells stay null, dates → ISO day', () => {
    const ds = parseExcelSheet(bytes, 'Survey')
    expect(ds.columns).toEqual(['group', 'score', 'start'])
    expect(ds.rows).toEqual([
      { group: 'A', score: 10, start: '2024-01-05' },
      { group: 'B', score: null, start: null },
      { group: 'A', score: 12.5, start: '2024-03-20' },
    ])
  })
})
```

- [ ] **Step 2: Run → fails.** `npx vitest run src/lib/data/parseExcel.test.ts`

- [ ] **Step 3: Implement** — `src/lib/data/parseExcel.ts`:

```ts
import { read, utils } from 'xlsx'
import type { Dataset } from '../stats/types'

export function listSheets(bytes: ArrayBuffer): string[] {
  return read(bytes, { type: 'array' }).SheetNames
}

/** Header = row 1 (per the ui spec). Empty cells → null. Dates → ISO 'YYYY-MM-DD' via cellDates:true + sheet_to_json UTC:true (without cellDates, date cells silently arrive as Excel serial numbers, e.g. 45296). */
export function parseExcelSheet(bytes: ArrayBuffer, sheet: string): Dataset {
  const wb = read(bytes, { type: 'array', cellDates: true })
  const ws = wb.Sheets[sheet]
  if (!ws) throw new Error(`Sheet "${sheet}" not found`)
  const aoa = utils.sheet_to_json<(string | number | boolean | Date | null)[]>(ws, { header: 1, defval: null, UTC: true }) // UTC:true — without it Dates shift by the local offset and the ISO day is wrong east of UTC (sandbox-verified)
  const [header, ...body] = aoa
  const columns = (header ?? []).map((h) => String(h))
  const rows = body.map((cells) => Object.fromEntries(columns.map((c, i) => {
    const v = cells[i] ?? null
    return [c, v instanceof Date ? v.toISOString().slice(0, 10) : v]
  })))
  return { columns, rows }
}
```

- [ ] **Step 4: Run → passes.** `npx tsc -b` → 0. Commit:
```bash
git add src/lib/data && git commit -m "feat: Excel parsing via SheetJS (sheet list + chosen-sheet Dataset)"
```

---

## Task 7: Missing-data policy

**Files:** Create `src/lib/data/missing.ts`, `src/lib/data/missing.test.ts`

- [ ] **Step 1: Failing test** — `src/lib/data/missing.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyMissingPolicy } from './missing'
import type { Dataset } from '../stats/types'
import type { ColumnMeta } from './columnMeta'

const ds: Dataset = { columns: ['g', 'x'], rows: [
  { g: 'a', x: 1 }, { g: 'a', x: null }, { g: 'b', x: 3 }, { g: null, x: 4 },
] }
const meta: ColumnMeta[] = [
  { name: 'g', detected: 'object', tags: [], level: 'nominal', used: true },
  { name: 'x', detected: 'int64', tags: ['count'], level: 'ratio', used: true },
]

describe('applyMissingPolicy', () => {
  it('leave: passes the dataset through untouched (per-test listwise happens downstream)', () => {
    const r = applyMissingPolicy(ds, meta, 'leave')
    expect(r.dataset).toEqual(ds); expect(r.droppedCount).toBe(0)
  })
  it('drop: removes rows with any missing value in a Used column, and counts them', () => {
    const r = applyMissingPolicy(ds, meta, 'drop')
    expect(r.dataset.rows).toEqual([{ g: 'a', x: 1 }, { g: 'b', x: 3 }]); expect(r.droppedCount).toBe(2)
  })
  it('impute: mean for interval/ratio, mode for nominal/ordinal', () => {
    const r = applyMissingPolicy(ds, meta, 'impute')
    expect(r.dataset.rows[1].x).toBeCloseTo((1 + 3 + 4) / 3, 10) // mean of non-missing x
    expect(r.dataset.rows[3].g).toBe('a')                        // mode of g
    expect(r.droppedCount).toBe(0)
  })
  it('impute ignores unused columns', () => {
    const m2 = meta.map((c) => (c.name === 'x' ? { ...c, used: false } : c))
    const r = applyMissingPolicy(ds, m2, 'impute')
    expect(r.dataset.rows[1].x).toBeNull()
  })
})
```

- [ ] **Step 2: Run → fails.** `npx vitest run src/lib/data/missing.test.ts`

- [ ] **Step 3: Implement** — `src/lib/data/missing.ts`:

```ts
import type { Dataset } from '../stats/types'
import type { ColumnMeta } from './columnMeta'

export type MissingPolicy = 'leave' | 'drop' | 'impute'
export interface MissingResult { dataset: Dataset; droppedCount: number }

const isMissing = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

/** Step-4a semantics (Benjie's R2 ruling): leave = pass-through (tests do their own listwise);
 *  drop = global listwise over Used columns; impute = mean (interval/ratio) / mode (nominal/ordinal). */
export function applyMissingPolicy(ds: Dataset, meta: ColumnMeta[], policy: MissingPolicy): MissingResult {
  if (policy === 'leave') return { dataset: ds, droppedCount: 0 }
  const used = meta.filter((c) => c.used).map((c) => c.name)
  if (policy === 'drop') {
    const rows = ds.rows.filter((r) => used.every((c) => !isMissing(r[c])))
    return { dataset: { ...ds, rows }, droppedCount: ds.rows.length - rows.length }
  }
  // impute
  const fill: Record<string, string | number | boolean> = {}
  for (const c of meta) {
    if (!c.used || c.level === null) continue
    const present = ds.rows.map((r) => r[c.name]).filter((v) => !isMissing(v)) as (string | number | boolean)[]
    if (!present.length) continue
    if (c.level === 'interval' || c.level === 'ratio') {
      const nums = present.filter((v): v is number => typeof v === 'number')
      if (nums.length) fill[c.name] = nums.reduce((a, b) => a + b, 0) / nums.length
    } else {
      const counts = new Map<string | number | boolean, number>()
      for (const v of present) counts.set(v, (counts.get(v) ?? 0) + 1)
      fill[c.name] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    }
  }
  const rows = ds.rows.map((r) => {
    const out = { ...r }
    for (const c of used) if (isMissing(out[c]) && c in fill) out[c] = fill[c]
    return out
  })
  return { dataset: { ...ds, rows }, droppedCount: 0 }
}
```

- [ ] **Step 4: Run → passes.** Commit:
```bash
git add src/lib/data && git commit -m "feat: missing-data policy (leave/drop/impute per the R2 ruling)"
```

---

## Task 8: Eligibility engine

**Files:** Create `src/lib/eligibility/eligibility.ts`, `src/lib/eligibility/eligibility.test.ts`

- [ ] **Step 1: Failing test** — `src/lib/eligibility/eligibility.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { slotCompatibility, testEligibility, completeRowsPerGroup } from './eligibility'
import { INDEPENDENT_T_TEST } from '../registry/independentTTest'
import { CATALOG } from '../registry/catalog'
import type { ColumnMeta } from '../data/columnMeta'
import type { Dataset } from '../stats/types'

const col = (name: string, level: ColumnMeta['level'], used = true): ColumnMeta =>
  ({ name, detected: 'float64', tags: [], level, used })
const ds: Dataset = { columns: ['score', 'group'], rows: [
  { score: 1, group: 'a' }, { score: 2, group: 'a' }, { score: 3, group: 'a' },
  { score: 4, group: 'b' }, { score: 5, group: 'b' }, { score: 6, group: 'b' },
] }
const tt = CATALOG.find((c) => c.id === 'independent-t-test')!
const outcomeRole = INDEPENDENT_T_TEST.constraints.roles[0]
const groupRole = INDEPENDENT_T_TEST.constraints.roles[1]

describe('slotCompatibility', () => {
  it('accepts a used ratio column for the outcome role', () =>
    expect(slotCompatibility(outcomeRole, col('score', 'ratio'), ds).ok).toBe(true))
  it('rejects wrong level with a readable reason', () =>
    expect(slotCompatibility(outcomeRole, col('group', 'nominal'), ds)).toEqual({ ok: false, reason: 'needs an interval / ratio column' }))
  it('rejects unused / missing-level columns', () => {
    expect(slotCompatibility(outcomeRole, col('score', 'ratio', false), ds).reason).toBe('column is not marked Use')
    expect(slotCompatibility(outcomeRole, col('score', null), ds).reason).toBe('needs a measurement level')
  })
  it('enforces the exact category count on the grouping role', () => {
    const three: Dataset = { columns: ['group'], rows: [{ group: 'a' }, { group: 'b' }, { group: 'c' }] }
    expect(slotCompatibility(groupRole, col('group', 'nominal'), three)).toEqual({ ok: false, reason: 'needs exactly 2 categories' })
  })
})

describe('completeRowsPerGroup', () => {
  it('counts complete (outcome numeric, group present) rows per group', () => {
    const holes: Dataset = { columns: ['score', 'group'], rows: [
      { score: 1, group: 'a' }, { score: null, group: 'a' }, { score: 2, group: 'b' },
    ] }
    expect(completeRowsPerGroup(holes, 'score', 'group')).toEqual({ a: 1, b: 1 })
  })
})

describe('testEligibility', () => {
  const cols = [col('score', 'ratio'), col('group', 'nominal')]
  it('t-test eligible on a ratio outcome + 2-category group with ≥3 complete rows per group', () =>
    expect(testEligibility(tt, INDEPENDENT_T_TEST, cols, ds)).toEqual({ ok: true, reason: null }))
  it('later-slice tests carry the honest reason', () =>
    expect(testEligibility(CATALOG.find((c) => c.id === 'pearson')!, null, cols, ds)).toEqual({ ok: false, reason: 'arrives in a later slice' }))
  it('reports the first unmeetable role', () =>
    expect(testEligibility(tt, INDEPENDENT_T_TEST, [col('a', 'nominal'), col('b', 'nominal')], ds).reason).toBe('needs an interval / ratio column for Outcome (DV)'))
  it('reports the min-rows rule when role-compatible pairs all lack data', () => {
    const tiny: Dataset = { columns: ['score', 'group'], rows: [
      { score: 1, group: 'a' }, { score: 2, group: 'a' }, { score: 3, group: 'b' },
    ] }
    expect(testEligibility(tt, INDEPENDENT_T_TEST, cols, tiny).reason).toBe('needs at least 3 complete rows per group')
  })
})
```

- [ ] **Step 2: Run → fails.** `npx vitest run src/lib/eligibility/eligibility.test.ts`

- [ ] **Step 3: Implement** — `src/lib/eligibility/eligibility.ts`:

```ts
import type { RoleConstraint, TestSpec } from '../registry/types'
import type { CatalogEntry } from '../registry/catalog'
import { LATER_SLICE_REASON } from '../registry/catalog'
import type { ColumnMeta } from '../data/columnMeta'
import type { Dataset } from '../stats/types'

export interface Verdict { ok: boolean; reason: string | null }

const distinct = (ds: Dataset, colName: string) =>
  new Set(ds.rows.map((r) => r[colName]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '')).size

/** Can THIS column sit in THIS role? (step-6 slot rule — also reused per-config by the store's revalidation) */
export function slotCompatibility(role: RoleConstraint, col: ColumnMeta | undefined, working: Dataset): Verdict {
  if (!col) return { ok: false, reason: 'column not found' }
  if (!col.used) return { ok: false, reason: 'column is not marked Use' }
  if (col.level === null) return { ok: false, reason: 'needs a measurement level' }
  if (!role.levels.includes(col.level)) return { ok: false, reason: `needs ${role.levels[0] === 'interval' ? 'an' : 'a'} ${role.levels.join(' / ')} column` }
  if (role.categories && distinct(working, col.name) !== role.categories.exact)
    return { ok: false, reason: `needs exactly ${role.categories.exact} categories` }
  return { ok: true, reason: null }
}

/** Complete = outcome is a finite number AND group is present (mirrors the stats listwise filter). */
export function completeRowsPerGroup(ds: Dataset, outcome: string, group: string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const r of ds.rows) {
    const o = r[outcome], g = r[group]
    if (typeof o === 'number' && Number.isFinite(o) && g !== null && g !== undefined && String(g).trim() !== '')
      counts[String(g)] = (counts[String(g)] ?? 0) + 1
  }
  return counts
}

/** Step-5 verdict: greyed + reason, or eligible. Brute-forces candidate role assignments (cheap at 46 tests × small role counts). */
export function testEligibility(entry: CatalogEntry, spec: TestSpec | null, columns: ColumnMeta[], working: Dataset): Verdict {
  if (entry.status === 'later-slice' || !spec) return { ok: false, reason: LATER_SLICE_REASON }
  const candidates = spec.constraints.roles.map((role) => columns.filter((c) => slotCompatibility(role, c, working).ok))
  for (let i = 0; i < candidates.length; i++) {
    if (!candidates[i].length) {
      const role = spec.constraints.roles[i]
      const label = spec.roles.find((r) => r.id === role.roleId)?.label ?? role.roleId
      return { ok: false, reason: `needs ${role.levels[0] === 'interval' ? 'an' : 'a'} ${role.levels.join(' / ')} column for ${label}` }
    }
  }
  // any disjoint assignment meeting the min-rows rule? (t-test: outcome × group pairs)
  for (const o of candidates[0]) for (const g of candidates[1]) {
    if (o.name === g.name) continue
    const per = completeRowsPerGroup(working, o.name, g.name)
    if (Object.keys(per).length && Object.values(per).every((n) => n >= spec.constraints.minRowsPerGroup)) return { ok: true, reason: null }
  }
  return { ok: false, reason: `needs at least ${spec.constraints.minRowsPerGroup} complete rows per group` }
}
```

- [ ] **Step 4: Run → passes.** `npx tsc -b` → 0. Commit:
```bash
git add src/lib/eligibility && git commit -m "feat: eligibility engine (picker grey-outs + slot compatibility, one rule set)"
```

---

## Task 9: Spec copy module + consistency test

**Files:** Create `src/content/copy.ts`, `src/content/copy.consistency.test.ts`

- [ ] **Step 1: `src/content/copy.ts`** — app copy, verbatim from the ui-spec DRAFT blocks (Benjie reviews rendered):

```ts
export const LINKEDIN_URL = 'https://www.linkedin.com/in/benjaminsotelo1/'
export const FEEDBACK_URL = 'https://docs.google.com/forms/REPLACE_WITH_YOUR_FORM' // standing open item

export const WELCOME_COPY =
  'Telos runs your statistics in the browser — built for thesis students. Upload your data, get guided to the right tests, ' +
  'and read APA-7 results with plain-language explainers. Export everything as one bundle: PDF, R script, figures. ' +
  'Your data never leaves your browser. Built by Benjamin Sotelo — linkedin.com/in/benjaminsotelo1.'

// Rendered with <b> on the b-segments, exactly as the spec draws emphasis.
export const TERMS_COPY: { b?: string; t?: string }[] = [
  { b: 'Type vs level:' }, { t: ' the type is how a column is stored (numbers, text, dates); the level is what its values mean for analysis — you set the level. ' },
  { b: 'Nominal' }, { t: ' — named categories with no order (gender, region). ' },
  { b: 'Ordinal' }, { t: ' — ordered categories with uneven steps (a 1–5 satisfaction rating). ' },
  { b: 'Interval' }, { t: ' — equal steps but no true zero (temperature in °C). ' },
  { b: 'Ratio' }, { t: ' — equal steps and a true zero (income, test score). ' },
  { b: 'Missing data:' }, { t: ' empty cells — by default each test simply skips the rows that are incomplete for its own columns (step 4a lets you change this).' },
]

export const UPLOAD_ACCEPT = '.csv,.xlsx,.xls'
export const UPLOAD_NOTE = '.csv · .xlsx · .xls — header row assumed to be row 1'
export const SIZE_WARN = { mb: 20, rows: 100_000 } // ui-spec DRAFT: 'warn above 20 MB or 100,000 rows'
export const SIZE_WARN_TEXT = 'Large file — analysis may be slow in the browser.' // wording ours (DRAFT review happens rendered)
```

- [ ] **Step 2: Failing consistency test** ⚠ (slices verified against the real file by the validation workflow) — `src/content/copy.consistency.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readSpec, strip } from '../lib/registry/specHtml'
import { WELCOME_COPY, TERMS_COPY, SIZE_WARN } from './copy'

const html = readSpec('telos_ui_spec.html')
const block = (from: string, to: string) => html.slice(html.indexOf(from), html.indexOf(to))
const explainP = (s: string) => strip(s.match(/<div class="explain"[^>]*>.*?<p>(.*?)<\/p>/s)![1])

describe('app copy stays faithful to the ui-spec DRAFT blocks', () => {
  it('welcome copy equals the spec paragraph (the spec wraps it in curly quotes)', () => {
    expect(explainP(block('1 · Welcome / about', 'Click "Get started"'))).toBe(`“${WELCOME_COPY}”`)
  })
  it('terms copy segments reassemble the spec paragraph exactly', () => {
    const joined = TERMS_COPY.map((s) => s.b ?? s.t).join('').replace(/\s+/g, ' ').trim()
    expect(explainP(block('3 · Terms guide', 'Click "Continue"'))).toBe(`“${joined}”`)
  })
  it('upload rules + size guidance appear in the spec upload block', () => {
    const upload = strip(block('2 · Upload data', 'File parsed'))
    expect(upload).toContain('(.csv · .xlsx · .xls)')
    expect(upload).toContain('header row assumed to be row 1')
    expect(upload).toContain(`warn above ${SIZE_WARN.mb} MB or ${SIZE_WARN.rows.toLocaleString('en-US')} rows`)
  })
})
```

- [ ] **Step 3: Run** — `npx vitest run src/content/copy.consistency.test.ts` → PASS (if a string mismatches, fix `copy.ts` to match the spec text — the HTML is the source of truth; report the fix).

- [ ] **Step 3b: Mutation check:** change one word of `WELCOME_COPY` ('thesis' → 'PhD') → run → must FAIL; remove the `{ b: 'Ordinal' }` segment from `TERMS_COPY` → must FAIL; set `SIZE_WARN.mb` to 25 → must FAIL. Revert; re-run → PASS.

- [ ] **Step 4: Commit**
```bash
git add src/content && git commit -m "feat: spec copy module (welcome/terms/upload) + consistency test"
```

---

## Task 10: Session store rewrite — the flow state machine

**Files:** Create `src/lib/webr/getEngine.ts`; rewrite `src/state/session.ts`, `src/state/session.test.ts`; replace `src/App.tsx` with a placeholder; DELETE `src/components/DatasetLoader.tsx`, `src/components/TestConfig.tsx`, `src/components/ResultCard.tsx`, `src/components/ExportButton.tsx`, `src/lib/data/sample.ts`

The old single-page components consume the old store shape — they are replaced by the screens in Tasks 11-16, so they (and the sample dataset that existed only for them) are deleted HERE, together with the store change that breaks them. `App.tsx` becomes the Task-3-style placeholder until Task 11 wires the stepper. The old e2e `tests/e2e/slice.spec.ts` stays on disk until Task 17 replaces it, but **do not run `npm run e2e` between Tasks 10 and 16** — the page it asserts no longer exists (vitest never collects it, so `npm test` stays green throughout).

- [ ] **Step 1: `src/lib/webr/getEngine.ts`** (the memoized singleton, moved verbatim from the old TestConfig):

```ts
import { Engine } from './engine'
let enginePromise: Promise<Engine> | null = null
export const getEngine = (onStatus?: (m: string) => void) =>
  (enginePromise ??= (async () => { const e = new Engine(); await e.init(onStatus); return e })())
```

- [ ] **Step 2: Failing tests** — rewrite `src/state/session.test.ts` (replaces the old two tests; their invalidation semantics are re-asserted in the new shape):

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSession, stepsOf, canEnter, workingDataset } from './session'
import type { Dataset, TTestResult } from '../lib/stats/types'

const ds: Dataset = { columns: ['group', 'score'], rows: [
  { group: 'control', score: 72 }, { group: 'control', score: 68 }, { group: 'control', score: 75 },
  { group: 'treatment', score: 81 }, { group: 'treatment', score: 79 }, { group: 'treatment', score: 85 },
] }
const info = { name: 'study.csv', rows: 6, cols: 2, encoding: 'UTF-8' }
const load = () => useSession.getState().loadDataset(ds, info)
const fakeRun = () => useSession.setState((s) => ({ runs: { ...s.runs, 'independent-t-test': { result: {} as TTestResult, stale: false } } }))

describe('flow gates', () => {
  beforeEach(() => useSession.getState().reset())
  it('spine derives from the selection, in order', () => {
    load(); useSession.getState().toggleSelection('independent-t-test')
    expect(stepsOf(useSession.getState())).toEqual(['welcome', 'upload', 'guide', 'configure-data', 'pick-tests', 'test:independent-t-test', 'results'])
  })
  it('future steps lock until prior gates pass', () => {
    expect(canEnter(useSession.getState(), 'guide')).toBe(false)        // nothing uploaded
    load()
    expect(canEnter(useSession.getState(), 'guide')).toBe(true)
    expect(canEnter(useSession.getState(), 'configure-data')).toBe(false) // guide not visited
    useSession.getState().visitGuide()
    expect(canEnter(useSession.getState(), 'configure-data')).toBe(true)  // levels auto-suggested → gate already satisfiable
    expect(canEnter(useSession.getState(), 'pick-tests')).toBe(true)      // every used column has a suggested level
  })
  it('configure-data gate fails while any used column lacks a level', () => {
    load(); useSession.getState().visitGuide()
    useSession.getState().setColumnLevel('score', null)
    expect(canEnter(useSession.getState(), 'pick-tests')).toBe(false)
  })
  it('goTo refuses locked steps', () => {
    useSession.getState().goTo('results')
    expect(useSession.getState().step).toBe('welcome')
  })
})

describe('back-edit invalidation (the spec navcap rules)', () => {
  beforeEach(() => { useSession.getState().reset(); load(); useSession.getState().visitGuide(); useSession.getState().toggleSelection('independent-t-test') })
  const assign = () => {
    useSession.getState().assignRole('independent-t-test', 'outcome', 'score')
    useSession.getState().assignRole('independent-t-test', 'group', 'group')
  }
  it('selection creates a setup with the drawn defaults (equal variance OFF)', () => {
    expect(useSession.getState().setups['independent-t-test']).toEqual({ roles: { outcome: null, group: null }, equalVariance: false, blocked: null })
  })
  it('a level edit that breaks an assigned role blocks the config with the reason and marks results stale', () => {
    assign(); fakeRun()
    useSession.getState().setColumnLevel('score', 'nominal')
    const setup = useSession.getState().setups['independent-t-test']
    expect(setup.blocked).toBe('Outcome (DV): needs an interval / ratio column')
    expect(setup.roles.outcome).toBe('score') // assignment kept, marked blocked — spec: "blocked with the reason"
    expect(useSession.getState().runs['independent-t-test'].stale).toBe(true)
    useSession.getState().setColumnLevel('score', 'ratio')
    expect(useSession.getState().setups['independent-t-test'].blocked).toBeNull() // still-valid work kept
  })
  it('missing-policy and equal-variance edits mark results stale; deselection drops the run', () => {
    assign(); fakeRun()
    useSession.getState().setMissingPolicy('drop')
    expect(useSession.getState().runs['independent-t-test'].stale).toBe(true)
    fakeRun(); useSession.getState().setEqualVariance('independent-t-test', true)
    expect(useSession.getState().runs['independent-t-test'].stale).toBe(true)
    useSession.getState().toggleSelection('independent-t-test')
    expect(useSession.getState().runs['independent-t-test']).toBeUndefined()
  })
  it('rename propagates to role assignments and the working dataset', () => {
    assign()
    useSession.getState().renameColumn('score', 'wage')
    expect(useSession.getState().setups['independent-t-test'].roles.outcome).toBe('wage')
    expect(workingDataset(useSession.getState()).columns).toContain('wage')
  })
  it('re-upload keeps still-valid work and stales results; vanished columns block with the reason', () => {
    assign(); fakeRun()
    load() // same-schema re-upload
    expect(useSession.getState().selection).toEqual(['independent-t-test'])
    expect(useSession.getState().setups['independent-t-test'].roles.outcome).toBe('score')
    expect(useSession.getState().runs['independent-t-test'].stale).toBe(true)
    useSession.getState().loadDataset({ columns: ['a'], rows: [{ a: 1 }] }, { name: 'other.csv', rows: 1, cols: 1, encoding: 'UTF-8' })
    expect(useSession.getState().setups['independent-t-test'].blocked).toBe('Outcome (DV): column not found')
  })
  it('results stay locked until every selected test has all role slots filled', () => {
    expect(canEnter(useSession.getState(), 'results')).toBe(false)
    assign()
    expect(canEnter(useSession.getState(), 'results')).toBe(true)
  })
})
```

- [ ] **Step 3: Run → fails.** `npx vitest run src/state/session.test.ts`

- [ ] **Step 4: Implement** — rewrite `src/state/session.ts`:

```ts
import { create } from 'zustand'
import type { Dataset, TTestResult } from '../lib/stats/types'
import type { Level } from '../lib/registry/types'
import type { ColumnMeta } from '../lib/data/columnMeta'
import { deriveColumns, fixType } from '../lib/data/columnMeta'
import { applyMissingPolicy, type MissingPolicy } from '../lib/data/missing'
import { slotCompatibility } from '../lib/eligibility/eligibility'
import { SPECS } from '../lib/registry/catalog'
import { runIndependentTTest } from '../lib/stats/independentTTest'
import { getEngine } from '../lib/webr/getEngine'

export type StepId = 'welcome' | 'upload' | 'guide' | 'configure-data' | 'pick-tests' | `test:${string}` | 'results'
export interface FileInfo { name: string; rows: number; cols: number; encoding: string }
export interface TestSetup { roles: Record<string, string | null>; equalVariance: boolean; blocked: string | null }
export interface TestRun { result: TTestResult; stale: boolean }

export interface SessionState {
  step: StepId
  raw: Dataset | null
  fileInfo: FileInfo | null
  guideVisited: boolean
  columns: ColumnMeta[]
  missingPolicy: MissingPolicy
  selection: string[]
  setups: Record<string, TestSetup>
  runs: Record<string, TestRun>
  errors: Record<string, string>          // per-test failure → readable error card; other tests' results stay intact (spec run-state rule)
  runStatus: 'idle' | 'running' | 'error'
  runPhase: string | null
  runError: string | null
  loadDataset: (d: Dataset, info: FileInfo) => void
  visitGuide: () => void
  setColumnLevel: (name: string, level: Level | null) => void
  setColumnUsed: (name: string, used: boolean) => void
  renameColumn: (name: string, next: string) => void
  applyFixType: (name: string) => void
  setMissingPolicy: (p: MissingPolicy) => void
  toggleSelection: (id: string) => void
  assignRole: (testId: string, roleId: string, column: string | null) => void
  setEqualVariance: (testId: string, on: boolean) => void
  goTo: (step: StepId) => void
  runAll: () => Promise<void>
  reset: () => void
}

export const stepsOf = (s: Pick<SessionState, 'selection'>): StepId[] =>
  ['welcome', 'upload', 'guide', 'configure-data', 'pick-tests', ...s.selection.map((id) => `test:${id}` as StepId), 'results']

export const workingDataset = (s: Pick<SessionState, 'raw' | 'columns' | 'missingPolicy'>): Dataset =>
  s.raw ? applyMissingPolicy(s.raw, s.columns, s.missingPolicy).dataset : { columns: [], rows: [] }

/** Is this step's own completion gate satisfied? (what it takes to move PAST it) */
export const gateOk = (s: SessionState, step: StepId): boolean => {
  if (step === 'welcome') return true
  if (step === 'upload') return s.raw !== null
  if (step === 'guide') return s.guideVisited
  if (step === 'configure-data') { const used = s.columns.filter((c) => c.used); return used.length > 0 && used.every((c) => c.level !== null) }
  if (step === 'pick-tests') return s.selection.length > 0
  if (step.startsWith('test:')) { const t = s.setups[step.slice(5)]; return !!t && !t.blocked && Object.values(t.roles).every(Boolean) }
  return true // results
}

export const canEnter = (s: SessionState, target: StepId): boolean => {
  const steps = stepsOf(s); const i = steps.indexOf(target)
  return i >= 0 && steps.slice(0, i).every((st) => gateOk(s, st))
}

const freshSetup = (id: string): TestSetup =>
  ({ roles: Object.fromEntries((SPECS[id]?.constraints.roles ?? []).map((r) => [r.roleId, null])), equalVariance: false, blocked: null })

/** Re-evaluate every later gate after an upstream edit: keep still-valid work, block invalid configs
 *  with the reason, mark rendered results stale (the spec's navcap rules, in one place). */
const revalidated = (s: SessionState): Pick<SessionState, 'setups' | 'runs'> => {
  const working = workingDataset(s)
  const setups: Record<string, TestSetup> = {}
  for (const id of s.selection) {
    const spec = SPECS[id]; const prev = s.setups[id] ?? freshSetup(id)
    let blocked: string | null = null
    if (spec) for (const role of spec.constraints.roles) {
      const colName = prev.roles[role.roleId]
      if (!colName) continue
      const verdict = slotCompatibility(role, s.columns.find((c) => c.name === colName), working)
      if (!verdict.ok) { blocked = `${spec.roles.find((r) => r.id === role.roleId)?.label ?? role.roleId}: ${verdict.reason}`; break }
    }
    setups[id] = { ...prev, blocked }
  }
  const runs = Object.fromEntries(Object.entries(s.runs)
    .filter(([id]) => s.selection.includes(id))
    .map(([id, r]) => [id, { ...r, stale: true }]))
  return { setups, runs }
}

const initial = {
  step: 'welcome' as StepId, raw: null, fileInfo: null, guideVisited: false,
  columns: [] as ColumnMeta[], missingPolicy: 'leave' as MissingPolicy,
  selection: [] as string[], setups: {} as Record<string, TestSetup>, runs: {} as Record<string, TestRun>, errors: {} as Record<string, string>,
  runStatus: 'idle' as const, runPhase: null, runError: null,
}

export const useSession = create<SessionState>((set, get) => {
  const edit = (mut: (s: SessionState) => Partial<SessionState>) =>
    set((s) => { const next = { ...s, ...mut(s) }; return { ...mut(s), ...revalidated(next) } })
  return {
    ...initial,
    // Re-upload is an earlier-step edit like any other (navcap): keep still-valid work, revalidate the rest.
    loadDataset: (d, fileInfo) => edit((s) => {
      const columns = deriveColumns(d).map((fresh) => s.columns.find((c) => c.name === fresh.name && c.detected === fresh.detected) ?? fresh)
      return { raw: d, fileInfo, columns }
    }),
    visitGuide: () => set({ guideVisited: true }),
    setColumnLevel: (name, level) => edit((s) => ({ columns: s.columns.map((c) => (c.name === name ? { ...c, level } : c)) })),
    setColumnUsed: (name, used) => edit((s) => ({ columns: s.columns.map((c) => (c.name === name ? { ...c, used } : c)) })),
    renameColumn: (name, next) => edit((s) => {
      if (!next.trim() || s.columns.some((c) => c.name === next)) return {}
      const raw = s.raw && { columns: s.raw.columns.map((c) => (c === name ? next : c)),
        rows: s.raw.rows.map((r) => { const { [name]: v, ...rest } = r; return name in r ? { ...rest, [next]: v } : r }) }
      const setups = Object.fromEntries(Object.entries(s.setups).map(([id, t]) => [id,
        { ...t, roles: Object.fromEntries(Object.entries(t.roles).map(([k, v]) => [k, v === name ? next : v])) }]))
      return { raw, setups, columns: s.columns.map((c) => (c.name === name ? { ...c, name: next } : c)) }
    }),
    applyFixType: (name) => edit((s) => {
      if (!s.raw) return {}
      const raw = fixType(s.raw, name)
      return { raw, columns: deriveColumns(raw).map((fresh) => {
        const old = s.columns.find((c) => c.name === fresh.name)
        return fresh.name === name ? fresh : (old ?? fresh) // re-derive only the fixed column; keep user edits elsewhere
      }) }
    }),
    setMissingPolicy: (missingPolicy) => edit(() => ({ missingPolicy })),
    toggleSelection: (id) => edit((s) => {
      const selection = s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id]
      const setups = { ...s.setups }; const runs = { ...s.runs }; const errors = { ...s.errors }
      if (!selection.includes(id)) { delete setups[id]; delete runs[id]; delete errors[id] } else setups[id] = freshSetup(id)
      return { selection, setups, runs, errors }
    }),
    assignRole: (testId, roleId, column) => edit((s) => ({
      setups: { ...s.setups, [testId]: { ...s.setups[testId], roles: { ...s.setups[testId].roles, [roleId]: column } } },
    })),
    setEqualVariance: (testId, on) => edit((s) => ({
      setups: { ...s.setups, [testId]: { ...s.setups[testId], equalVariance: on } },
    })),
    goTo: (step) => { if (canEnter(get(), step)) set({ step }) },
    runAll: async () => {
      set({ runStatus: 'running', runError: null, step: 'results' })
      try {
        const engine = await getEngine((m) => set({ runPhase: m }))
        set({ runPhase: 'Running analysis…' })
        const s = get(); const ds = workingDataset(s)
        for (const id of s.selection) {
          const spec = SPECS[id]; const setup = s.setups[id]
          if (!spec || !setup || setup.blocked) continue
          set({ runPhase: `Running ${spec.name}…` })
          try {
            const result = await runIndependentTTest(engine, ds, setup.roles['outcome']!, setup.roles['group']!, setup.equalVariance)
            const { [id]: _drop, ...rest } = get().errors
            set({ runs: { ...get().runs, [id]: { result, stale: false } }, errors: rest })
          } catch (e) {
            // readable per-test error card on the results page; later tests still run (spec run-state rule)
            set({ errors: { ...get().errors, [id]: e instanceof Error ? e.message : String(e) } })
          }
        }
        set({ runStatus: 'idle' })
      } catch (e) { set({ runStatus: 'error', runError: e instanceof Error ? e.message : String(e) }) } // boot failure only
      finally { set({ runPhase: null }) }
    },
    reset: () => set({ ...initial }),
  }
})
```

- [ ] **Step 5: Replace `src/App.tsx`** with the placeholder (Task 11 wires the real shell):

```tsx
export default function App() {
  return <main className="screen"><h1 className="title">Telos</h1></main>
}
```
Then DELETE `src/components/DatasetLoader.tsx`, `src/components/TestConfig.tsx`, `src/components/ResultCard.tsx`, `src/components/ExportButton.tsx`, `src/lib/data/sample.ts`.

- [ ] **Step 6: Run → passes** — `npx vitest run src/state/session.test.ts` → PASS; full `npm test` green; `npx tsc -b` → 0 (nothing references the deleted files any more).

- [ ] **Step 7: Commit**
```bash
git add -A src/state src/lib/webr/getEngine.ts src/App.tsx src/components src/lib/data
git commit -m "feat: flow state machine (gates + back-edit invalidation); retire single-page UI"
```

---

## Task 11: Stepper + app shell + Welcome & Guide screens

**Files:** Create `src/components/Stepper.tsx`, `src/components/screens/WelcomeScreen.tsx`, `src/components/screens/GuideScreen.tsx`, and stub screens `UploadScreen.tsx`, `ConfigureDataScreen.tsx`, `PickTestsScreen.tsx`, `TestConfigScreen.tsx`, `ResultsScreen.tsx`; rewrite `src/App.tsx`

- [ ] **Step 1: `src/components/Stepper.tsx`**:

```tsx
import { useSession, stepsOf, type StepId } from '../state/session'
import { CATALOG } from '../lib/registry/catalog'

const label = (st: StepId): string =>
  st === 'upload' ? 'Upload' : st === 'guide' ? 'Guide' : st === 'configure-data' ? 'Configure data'
  : st === 'pick-tests' ? 'Pick tests' : st === 'results' ? 'Results'
  : (() => { const c = CATALOG.find((c) => c.id === st.slice(5)); return c?.short ?? c?.name ?? st.slice(5) })()

export function Stepper() {
  const s = useSession()
  if (s.step === 'welcome') return null
  const steps = stepsOf(s).filter((st) => st !== 'welcome')
  const cur = steps.indexOf(s.step)
  return (
    <nav className="stepper" aria-label="Progress">
      {steps.map((st, i) => (
        <span key={st} style={{ display: 'contents' }}>
          {i > 0 && <span className={`connector${i <= cur ? ' done' : ''}`} />}
          <button type="button" className={`step${i < cur ? ' done' : ''}${i === cur ? ' current' : ''}`}
            onClick={() => s.runStatus !== 'running' && s.goTo(st)} // nav reads the gates (goTo refuses locked steps); ALL nav locks while an analysis runs (design rule)
            aria-current={i === cur ? 'step' : undefined}>
            <span className="dot">{i < cur ? '✓' : i + 1}</span>{label(st)}
          </button>
        </span>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: Welcome + Guide screens**:

`src/components/screens/WelcomeScreen.tsx`:
```tsx
import { useSession } from '../../state/session'
import { WELCOME_COPY, LINKEDIN_URL } from '../../content/copy'

export function WelcomeScreen() {
  const goTo = useSession((s) => s.goTo)
  const [before, after] = WELCOME_COPY.split('linkedin.com/in/benjaminsotelo1')
  return (
    <section style={{ textAlign: 'center', paddingTop: 48 }}>
      <h1 className="title" style={{ fontSize: 44 }}>Telos</h1>
      <div className="card" style={{ textAlign: 'left', maxWidth: 520, margin: '0 auto' }}>
        <p style={{ margin: 0, lineHeight: 1.8 }}>{before}<a href={LINKEDIN_URL} target="_blank" rel="noopener">linkedin.com/in/benjaminsotelo1</a>{after}</p>
      </div>
      <div style={{ marginTop: 22 }}><button className="btn" onClick={() => goTo('upload')}>Get started</button></div>
    </section>
  )
}
```

`src/components/screens/GuideScreen.tsx`:
```tsx
import { useSession } from '../../state/session'
import { TERMS_COPY } from '../../content/copy'

export function GuideScreen() {
  const { visitGuide, goTo } = useSession()
  return (
    <section>
      <div className="eyebrow">Step 3</div>
      <h1 className="title">Terms guide</h1>
      <div className="card"><p style={{ margin: 0, lineHeight: 1.8 }}>
        {TERMS_COPY.map((seg, i) => (seg.b ? <b key={i}>{seg.b}</b> : <span key={i}>{seg.t}</span>))}
      </p></div>
      <div className="btn-row"><button className="btn" onClick={() => { visitGuide(); goTo('configure-data') }}>Continue</button></div>
    </section>
  )
}
```

- [ ] **Step 3: Stubs** (each replaced by its own later task; one file each under `src/components/screens/`):
```tsx
// UploadScreen.tsx
export function UploadScreen() { return <section><h1 className="title">Upload data</h1></section> }
// ConfigureDataScreen.tsx
export function ConfigureDataScreen() { return <section><h1 className="title">Configure data</h1></section> }
// PickTestsScreen.tsx
export function PickTestsScreen() { return <section><h1 className="title">Pick a test</h1></section> }
// ResultsScreen.tsx
export function ResultsScreen() { return <section><h1 className="title">Results</h1></section> }
// TestConfigScreen.tsx
export function TestConfigScreen({ testId }: { testId: string }) { return <section><h1 className="title">{testId}</h1></section> }
```

- [ ] **Step 4: Rewrite `src/App.tsx`**:

```tsx
import { Component, type ReactNode } from 'react'
import { useSession } from './state/session'
import { Stepper } from './components/Stepper'
import { WelcomeScreen } from './components/screens/WelcomeScreen'
import { UploadScreen } from './components/screens/UploadScreen'
import { GuideScreen } from './components/screens/GuideScreen'
import { ConfigureDataScreen } from './components/screens/ConfigureDataScreen'
import { PickTestsScreen } from './components/screens/PickTestsScreen'
import { TestConfigScreen } from './components/screens/TestConfigScreen'
import { ResultsScreen } from './components/screens/ResultsScreen'

class ResultBoundary extends Component<{ children: ReactNode }, { msg: string | null }> {
  state = { msg: null as string | null }
  static getDerivedStateFromError(e: unknown) { return { msg: e instanceof Error ? e.message : String(e) } }
  render() { return this.state.msg ? <p role="alert">Display error: {this.state.msg}</p> : this.props.children }
}

export default function App() {
  const step = useSession((s) => s.step)
  return (
    <main className="screen">
      <Stepper />
      {step === 'welcome' ? <WelcomeScreen /> : step === 'upload' ? <UploadScreen />
        : step === 'guide' ? <GuideScreen /> : step === 'configure-data' ? <ConfigureDataScreen />
        : step === 'pick-tests' ? <PickTestsScreen />
        : step === 'results' ? <ResultBoundary><ResultsScreen /></ResultBoundary>
        : <TestConfigScreen testId={step.slice(5)} />}
    </main>
  )
}
```

- [ ] **Step 5: Verify** — `npx tsc -b` → 0; `npm test` green; `npm run dev` → Welcome renders (wordmark, copy, link, button); clicking Get started shows the Upload stub with the stepper (Upload current, rest locked). Screenshot both states to `.superpowers/screens/` (untracked) for Benjie:
```bash
mkdir -p .superpowers/screens && node /tmp/shot.mjs   # tiny playwright script: goto dev URL, screenshot welcome.png; click Get started, screenshot upload-stub.png
```

- [ ] **Step 6: Commit**
```bash
git add src/components src/App.tsx && git commit -m "feat: stepper + app shell + welcome/guide screens"
```

---

## Task 12: Upload screen

**Files:** Rewrite `src/components/screens/UploadScreen.tsx`

- [ ] **Step 1: Implement** (auto-advance to Guide on clean parse; stay to show the sheet picker or a size warning; inline errors keep you on step 2 per spec):

```tsx
import { useState } from 'react'
import { useSession } from '../../state/session'
import { parseCsv } from '../../lib/data/parseCsv'
import { listSheets, parseExcelSheet } from '../../lib/data/parseExcel'
import { UPLOAD_ACCEPT, UPLOAD_NOTE, SIZE_WARN, SIZE_WARN_TEXT } from '../../content/copy'
import type { Dataset } from '../../lib/stats/types'

export function UploadScreen() {
  const { loadDataset, goTo } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [warn, setWarn] = useState<string | null>(null)
  const [pending, setPending] = useState<{ name: string; size: number; bytes: ArrayBuffer; sheets: string[]; sheet: string } | null>(null)

  const finish = (ds: Dataset, name: string, sizeBytes: number, encoding: string) => {
    if (!ds.columns.length || !ds.rows.length) { setError(`${name} parsed but contains no data rows — fix the file and re-upload.`); return }
    loadDataset(ds, { name, rows: ds.rows.length, cols: ds.columns.length, encoding })
    const big = sizeBytes > SIZE_WARN.mb * 1024 * 1024 || ds.rows.length > SIZE_WARN.rows
    if (big) setWarn(SIZE_WARN_TEXT) // stay so the warning is read; Continue proceeds
    else goTo('guide')
  }
  const onFile = async (f: File) => {
    setError(null); setWarn(null); setPending(null)
    try {
      if (/\.(xlsx|xls)$/i.test(f.name)) {
        const bytes = await f.arrayBuffer()
        const sheets = listSheets(bytes)
        if (sheets.length > 1) { setPending({ name: f.name, size: f.size, bytes, sheets, sheet: sheets[0] }); return }
        finish(parseExcelSheet(bytes, sheets[0]), f.name, f.size, 'UTF-8')
      } else {
        // ui-spec DRAFT: UTF-8 and Latin-1 accepted — strict-UTF-8 first, fall back to windows-1252, report honestly in the banner
        const buf = await f.arrayBuffer()
        let text = '', encoding = 'UTF-8'
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf) }
        catch { text = new TextDecoder('windows-1252').decode(buf); encoding = 'Latin-1' }
        finish(parseCsv(text), f.name, f.size, encoding)
      }
    } catch (e) { setError(`Couldn't parse ${f.name}: ${e instanceof Error ? e.message : String(e)} — fix the file and re-upload.`) }
  }

  return (
    <section>
      <div className="eyebrow">Step 2</div>
      <h1 className="title">Upload data</h1>
      <label className="slot" style={{ display: 'block', textAlign: 'center', padding: '30px 16px', cursor: 'pointer' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void onFile(f) }}>
        Drop a file here or <b style={{ color: 'var(--accent)' }}>browse</b>
        <div className="hint" style={{ marginTop: 6 }}>{UPLOAD_NOTE}</div>
        <input type="file" accept={UPLOAD_ACCEPT} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f) }} />
      </label>
      {pending && (
        <div className="card">
          {pending.name} · {pending.sheets.length} sheets →{' '}
          <label>Sheet:{' '}
            <select value={pending.sheet} onChange={(e) => setPending({ ...pending, sheet: e.target.value })}>
              {pending.sheets.map((s) => <option key={s}>{s}</option>)}
            </select></label>{' '}
          <span className="hint">(default: first)</span>
          <button className="btn" style={{ marginLeft: 12 }}
            onClick={() => { try { finish(parseExcelSheet(pending.bytes, pending.sheet), pending.name, pending.size, 'UTF-8') } catch (e) { setError(`Couldn't parse sheet "${pending.sheet}": ${e instanceof Error ? e.message : String(e)}`) } }}>
            Use this sheet</button>
        </div>
      )}
      {warn && (
        <div className="card">
          <div className="error-box" style={{ marginTop: 0 }}>{warn}</div>
          <div className="btn-row"><button className="btn" onClick={() => goTo('guide')}>Continue</button></div>
        </div>
      )}
      {error && <div className="error-box" role="alert">{error}</div>}
    </section>
  )
}
```

- [ ] **Step 2: Verify** — `npx tsc -b` → 0; `npm test` green; `npm run dev` → upload a small CSV → lands on Terms guide; drag-drop the same CSV onto the zone → lands on Terms guide; upload a corrupt file (e.g. a renamed PNG as .xlsx) → inline error, still on Upload. Screenshot to `.superpowers/screens/upload.png`.

- [ ] **Step 3: Commit**
```bash
git add src/components/screens/UploadScreen.tsx && git commit -m "feat: upload screen (CSV + Excel with sheet picker, inline errors, size guidance)"
```

---

## Task 13: Configure-data screen

**Files:** Rewrite `src/components/screens/ConfigureDataScreen.tsx`

- [ ] **Step 1: Implement**:

```tsx
import { useSession, gateOk } from '../../state/session'
import { applyMissingPolicy } from '../../lib/data/missing'
import { compatibleLevels } from '../../lib/data/columnMeta'
import type { Level } from '../../lib/registry/types'
import type { MissingPolicy } from '../../lib/data/missing'

const POLICIES: [MissingPolicy, string][] = [['drop', 'Drop rows'], ['impute', 'Impute'], ['leave', 'Leave as-is']]

export function ConfigureDataScreen() {
  const s = useSession()
  const ready = gateOk(s, 'configure-data')
  const dropped = s.raw ? applyMissingPolicy(s.raw, s.columns, 'drop').droppedCount : 0
  // ui-spec 4c: the fix-type override is for a NUMERIC column mis-parsed as text — not every text column
  const numericAsText = (name: string) => {
    const vals = (s.raw?.rows ?? []).map((r) => r[name]).filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    return vals.length > 0 && vals.filter((v) => Number.isFinite(Number(v.trim()))).length >= vals.length / 2 // DRAFT heuristic — Benjie reviews rendered
  }
  return (
    <section>
      <div className="eyebrow">Step 4</div>
      <h1 className="title">Configure data</h1>

      <div className="card">
        <div className="eyebrow">Missing data</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {POLICIES.map(([v, lbl]) => (
            <button key={v} type="button" className={`pill${s.missingPolicy === v ? ' on' : ''}`} style={{ cursor: 'pointer' }}
              onClick={() => s.setMissingPolicy(v)}>{lbl}</button>
          ))}
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>
          {s.missingPolicy === 'leave' && 'Default — each test analyzes complete cases on its own columns and reports its own N.'}
          {s.missingPolicy === 'drop' && `Rows with a missing value in any Used column are removed — ${dropped} rows dropped.`}
          {s.missingPolicy === 'impute' && 'Mean (interval/ratio) or mode (nominal/ordinal). Caution: imputation understates variance.'}
        </p>
      </div>

      {s.fileInfo && <div className="card mono">{s.fileInfo.rows} rows · {s.fileInfo.cols} columns · {s.fileInfo.encoding}</div>}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="cols-table">
          <thead><tr><th>Column</th><th>Detected type</th><th>Measurement level</th><th>Use</th></tr></thead>
          <tbody>
            {s.columns.map((c) => (
              <tr key={c.name} style={c.used ? undefined : { opacity: 0.5 }}>
                <td><input defaultValue={c.name} aria-label={`rename ${c.name}`} style={{ border: 0, background: 'transparent', font: 'inherit', color: 'inherit', width: '10em' }}
                  onBlur={(e) => { if (e.target.value !== c.name) s.renameColumn(c.name, e.target.value) }} /></td>
                <td className="mono">{c.detected}{c.tags.length ? ` · ${c.tags.join(' · ')}` : ''}
                  {c.detected === 'object' && numericAsText(c.name) && <button type="button" className="pill" style={{ marginLeft: 8, cursor: 'pointer' }} onClick={() => s.applyFixType(c.name)}>fix type</button>}</td>
                <td>
                  <select aria-label={`level of ${c.name}`} value={c.level ?? ''} disabled={!c.used}
                    onChange={(e) => s.setColumnLevel(c.name, (e.target.value || null) as Level | null)}>
                    <option value="">—</option>{compatibleLevels(c.detected).map((l) => <option key={l}>{l}</option>)}
                  </select>
                </td>
                <td><input type="checkbox" aria-label={`use ${c.name}`} checked={c.used} onChange={(e) => s.setColumnUsed(c.name, e.target.checked)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">Derived tags (count · datetime · id) are auto-detected column properties used by test eligibility — not levels you set.</p>

      <div className="btn-row">
        <span className="hint">disabled until every used column has a level</span>
        <button className="btn" disabled={!ready} onClick={() => s.goTo('pick-tests')}>Confirm &amp; pick test</button>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify** — `npx tsc -b` → 0; `npm test` green; dev: upload → guide → table shows detected types + pre-filled levels; un-set a level → Confirm disables. Screenshot `.superpowers/screens/configure-data.png`.

- [ ] **Step 3: Commit**
```bash
git add src/components/screens/ConfigureDataScreen.tsx && git commit -m "feat: configure-data screen (missing policy, banner, types/levels/use table)"
```

---

## Task 14: Pick-tests screen

**Files:** Rewrite `src/components/screens/PickTestsScreen.tsx`

- [ ] **Step 1: Implement**:

```tsx
import { useSession, workingDataset } from '../../state/session'
import { CATALOG, SPECS } from '../../lib/registry/catalog'
import { testEligibility } from '../../lib/eligibility/eligibility'

export function PickTestsScreen() {
  const s = useSession()
  const working = workingDataset(s)
  const verdicts = new Map(CATALOG.map((c) => [c.id, testEligibility(c, SPECS[c.id] ?? null, s.columns, working)]))
  const families = [...new Set(CATALOG.map((c) => c.family))]
  const allGreyed = CATALOG.every((c) => !verdicts.get(c.id)!.ok)
  return (
    <section>
      <div className="eyebrow">Step 5</div>
      <h1 className="title">Pick a test</h1>
      <p className="hint">Folders expand only · tick individual tests · multi-select on · greyed + reason if data unsupported — eligibility = level/arity fit plus per-test minimum data requirements (registry-defined · DRAFT — confirm: e.g. at least 3 complete rows per group) · if every test is greyed, a panel explains why and points back to steps 2/4</p>
      {allGreyed && (
        <div className="error-box" role="alert">
          No test fits the current data: every option is greyed out. Check the uploaded file (step 2) or the column levels and Use toggles (step 4).
        </div>
      )}
      <div className="card">
        {families.map((fam, fi) => (
          <div key={fam}>
            <div style={{ fontWeight: 700, marginTop: fi ? 12 : 0 }}>{fi + 1} · {fam}</div>
            {[...new Set(CATALOG.filter((c) => c.family === fam).map((c) => c.subfamily))].map((sub) => (
              <div key={sub ?? 'none'} style={{ marginLeft: 16 }}>
                {sub && <div className="eyebrow" style={{ marginTop: 6 }}>{sub}</div>}
                {CATALOG.filter((c) => c.family === fam && c.subfamily === sub).map((c) => {
                  const v = verdicts.get(c.id)!
                  return (
                    <div key={c.id} style={{ margin: '4px 0', ...(v.ok ? {} : { opacity: 0.5 }) }}>
                      <label>
                        <input type="checkbox" disabled={!v.ok} checked={s.selection.includes(c.id)}
                          onChange={() => s.toggleSelection(c.id)} style={{ marginRight: 8 }} />
                        {c.name}
                      </label>
                      {c.note && <span className="hint"> {c.note}</span>}
                      {!v.ok && <span className="hint"> — {v.reason}</span>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        ))}
        <p className="hint" style={{ marginBottom: 0 }}>7 · Assumption diagnostics — inline checks under each test (no standalone cards)</p>
      </div>
      <div className="btn-row">
        <span className="hint">→ the stepper grows one step per selected test</span>
        <button className="btn" disabled={!s.selection.length} onClick={() => s.goTo(`test:${s.selection[0]}`)}>Confirm selection</button>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify** — `npx tsc -b` → 0; `npm test` green; dev: all 46 visible grouped by family/subfamily; only Independent t-test tickable (given a 2-category dataset); reasons shown on the rest. Screenshot `.superpowers/screens/pick-tests.png`.

- [ ] **Step 3: Commit**
```bash
git add src/components/screens/PickTestsScreen.tsx && git commit -m "feat: pick-tests screen (46-test tree, eligibility grey-outs, all-greyed panel)"
```

---

## Task 15: Test-config screen with drag-slots

**Files:** Create `src/components/DragSlots.tsx`; rewrite `src/components/screens/TestConfigScreen.tsx`

- [ ] **Step 1: `src/components/DragSlots.tsx`** ⚠ (dnd-kit pointer interaction + the e2e drag recipe are validation-workflow items):

```tsx
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { TestSpec, RoleConstraint } from '../lib/registry/types'
import { useSession, workingDataset } from '../state/session'
import { slotCompatibility } from '../lib/eligibility/eligibility'

function Chip({ name, disabled, reason }: { name: string; disabled: boolean; reason: string | null }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: name, disabled })
  return (
    <span ref={setNodeRef} {...listeners} {...attributes} className={`chip${disabled ? ' incompatible' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), touchAction: 'none', cursor: disabled ? 'not-allowed' : 'grab' }}>
      {name}{disabled && reason ? <span className="hint"> — {reason}</span> : null}
    </span>
  )
}

function Slot({ testId, spec, role }: { testId: string; spec: TestSpec; role: RoleConstraint }) {
  const s = useSession()
  const { isOver, setNodeRef } = useDroppable({ id: role.roleId })
  const display = spec.roles.find((r) => r.id === role.roleId)!
  const assigned = s.setups[testId]?.roles[role.roleId] ?? null
  return (
    <div ref={setNodeRef} className={`slot${isOver ? ' over' : ''}`} data-role={role.roleId}>
      {display.label} <span className="hint">{display.levels} · {display.arity}</span>
      {assigned && (
        <div style={{ marginTop: 5 }}>
          <span className="chip assigned">{assigned}{' '}
            <button type="button" aria-label={`remove ${assigned}`} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'inherit' }}
              onClick={() => s.assignRole(testId, role.roleId, null)}>×</button>
          </span>
        </div>
      )}
    </div>
  )
}

export function DragSlots({ testId, spec }: { testId: string; spec: TestSpec }) {
  const s = useSession()
  const working = workingDataset(s)
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return
    const role = spec.constraints.roles.find((r) => r.roleId === String(e.over!.id))
    const col = s.columns.find((c) => c.name === String(e.active.id))
    if (role && col && slotCompatibility(role, col, working).ok) s.assignRole(testId, role.roleId, col.name)
  }
  const openRoles = spec.constraints.roles.filter((r) => !s.setups[testId]?.roles[r.roleId])
  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div className="card" style={{ flex: 1, marginTop: 0 }}>
          <div className="eyebrow">Your columns</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {s.columns.filter((c) => c.used).map((c) => {
              // a chip is draggable if at least one OPEN slot accepts it
              const fits = openRoles.map((r) => slotCompatibility(r, c, working))
              const ok = fits.some((v) => v.ok)
              const reason = ok || !openRoles.length ? null : fits[0].reason
              return <Chip key={c.name} name={c.name} disabled={!ok} reason={reason} />
            })}
          </div>
        </div>
        <div style={{ flex: 1.2 }}>
          {spec.constraints.roles.map((r) => <Slot key={r.roleId} testId={testId} spec={spec} role={r} />)}
        </div>
      </div>
    </DndContext>
  )
}
```

- [ ] **Step 2: Rewrite `src/components/screens/TestConfigScreen.tsx`**:

```tsx
import { useSession, gateOk, stepsOf } from '../../state/session'
import { SPECS } from '../../lib/registry/catalog'
import { DragSlots } from '../DragSlots'

export function TestConfigScreen({ testId }: { testId: string }) {
  const s = useSession()
  const spec = SPECS[testId]
  const setup = s.setups[testId]
  if (!spec || !setup) return null
  const idx = s.selection.indexOf(testId) + 1
  const eq = spec.options.find((o) => o.id === 'equalVariance')!
  const fixedOptions = spec.options.filter((o) => o.id !== 'equalVariance') // α/tails/CI encoded; controls deferred (recorded scope)
  const allReady = stepsOf(s).filter((st) => st.startsWith('test:')).every((st) => gateOk(s, st))
  const running = s.runStatus === 'running'
  return (
    <section>
      <div className="eyebrow">{idx} · {spec.name}</div>
      <h1 className="title">Drag columns into roles</h1>
      {setup.blocked && <div className="error-box" role="alert">Blocked: {setup.blocked}</div>}
      <DragSlots testId={testId} spec={spec} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {fixedOptions.map((o) => <span key={o.id} className="pill">{o.label} {o.value}</span>)}
        <label className={`pill${setup.equalVariance ? ' on' : ''}`} style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={setup.equalVariance} disabled={running}
            onChange={(e) => s.setEqualVariance(testId, e.target.checked)} style={{ marginRight: 6 }} />
          {eq.label} ({eq.value})
        </label>
      </div>
      <div className="btn-row">
        <span className="hint">{running ? '' : 'enabled when every selected test is fully configured · first run loads the R engine'}</span>
        <button className="btn" disabled={!allReady || running} onClick={() => { void s.runAll() }}>
          {running ? (s.runPhase ?? 'Running…') : 'Run analysis'}
        </button>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verify** — `npx tsc -b` → 0; `npm test` green; dev: drag `score` → Outcome, `group` → Grouping (mouse), incompatible chips greyed with reason, × unassigns, Run enables only when both filled; Run boots WebR (phase text on the button) and lands on the Results stub. Screenshot `.superpowers/screens/test-config.png`.

- [ ] **Step 4: Commit**
```bash
git add src/components/DragSlots.tsx src/components/screens/TestConfigScreen.tsx
git commit -m "feat: test-config screen (dnd-kit drag-slots, option pills, run wiring)"
```

---

## Task 16: Results screen + preview card + capture helpers

**Files:** Create `src/lib/export/capture.ts`, `src/components/ResultPreviewCard.tsx`; rewrite `src/components/screens/ResultsScreen.tsx`

- [ ] **Step 1: `src/lib/export/capture.ts`** (moved verbatim from the retired ExportButton):

```ts
import { toPng } from 'html-to-image'

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.split(',')[1]); const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export const captureNode = async (id: string) =>
  dataUrlToBytes(await toPng(document.getElementById(id)!, { pixelRatio: 2, backgroundColor: getComputedStyle(document.body).backgroundColor }))
```

- [ ] **Step 2: `src/components/ResultPreviewCard.tsx`** — the old ResultCard, generalized to `NN · Test name` preview form. The formatting helpers are IDENTICAL to the walking skeleton (U+2212 minus, integer-when-integer df, p-clause, em-dash via fx):

```tsx
import { useEffect, useState } from 'react'
import type { TestSpec } from '../lib/registry/types'
import type { TTestResult } from '../lib/stats/types'
import { ApaTable } from './ApaTable'

const minus = (s: string) => s.replace(/-/g, '−')                                  // U+2212, as the card typesets negatives
const f = (n: number) => minus(n.toFixed(2))
const f1 = (n: number) => minus(n.toFixed(1))                                      // APA-sentence M/SD, per the card
const fdf = (n: number) => (Number.isInteger(n) ? String(n) : f(n))                // 't(58)' pooled · 't(9.68)' Welch
const fp = (p: number) => (p < 0.001 ? '<.001' : p.toFixed(3).replace(/^0/, ''))
const fx = (n: number | null, fmt: (v: number) => string) => (n == null || !Number.isFinite(n) ? '—' : fmt(n))

export function ResultPreviewCard({ index, spec, result, stale, running, onRerun }:
  { index: number; spec: TestSpec; result: TTestResult; stale: boolean; running: boolean; onRerun: () => void }) {
  const [figureUrl, setFigureUrl] = useState<string | null>(null)
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([result.figurePng], { type: 'image/png' }))
    setFigureUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [result])
  const [g1, g2] = result.groupStats
  const t1Rows = result.groupStats.map((g) => ({ group: g.group, n: g.n, mean: f(g.mean), sd: f(g.sd), se: f(g.se) }))
  const t2Rows = [{ contrast: result.contrast, t: f(result.t), df: fdf(result.df), p: fp(result.p),
    mdiff: f(result.meanDiff), ci: `[${f(result.ci[0])}, ${f(result.ci[1])}]`, d: f(result.cohensD) }]
  const apa = spec.apaTemplate
    .replace('{g1}', g1.group).replace('{m1}', f1(g1.mean)).replace('{sd1}', f1(g1.sd))
    .replace('{g2}', g2.group).replace('{m2}', f1(g2.mean)).replace('{sd2}', f1(g2.sd))
    .replace('{df}', fdf(result.df)).replace('{t}', f(result.t))
    .replace('p={p}', result.p < 0.001 ? 'p<.001' : `p=${fp(result.p)}`)
    .replace('{d}', f(result.cohensD))
  return (
    <section className="card">
      <div className="eyebrow">{String(index).padStart(2, '0')} · {spec.name}</div>
      {stale && (
        <div className="error-box">Stale — the configuration changed since this ran.{' '}
          <button type="button" disabled={running} onClick={onRerun}>Run analysis again</button></div>
      )}
      <p style={{ color: 'var(--muted)' }}>{spec.question}</p>
      <p><b>Table 1.</b> {spec.tables[0].title}</p>
      <ApaTable id={`table-${spec.tables[0].id}`} spec={spec.tables[0]} rows={t1Rows} />
      <p><b>Table 2.</b> {spec.tables[1].title}</p>
      <ApaTable id={`table-${spec.tables[1].id}`} spec={spec.tables[1]} rows={t2Rows} />
      <p style={{ fontSize: 11, color: 'var(--muted)' }}>{spec.assumptionNote} (Levene F={fx(result.levene.F, f)}, p={fx(result.levene.p, fp)} · {result.test} test)</p>
      {result.nExcluded > 0 && <p style={{ fontSize: 11, color: 'var(--muted)' }}>{result.nExcluded} rows excluded (missing values)</p>}
      <p><b>Figure.</b> {spec.figure.caption}</p>
      {figureUrl && <img src={figureUrl} alt="boxplot of the outcome by group" width={480} />}
      <h3 style={{ fontSize: 15, margin: '16px 0 4px' }}>How to read this test</h3>
      <p>{spec.howToRead}</p>
      <p>APA: {apa}</p>
    </section>
  )
}
```

- [ ] **Step 3: Rewrite `src/components/screens/ResultsScreen.tsx`** (export on top — 5 formats, 3 disabled; spec's drawn default ticks among the live two: figures ✓, tables ☐; one-file export downloads directly, no zip, per the spec rule):

```tsx
import { useState } from 'react'
import { useSession } from '../../state/session'
import { SPECS } from '../../lib/registry/catalog'
import { buildBundle } from '../../lib/export/bundle'
import { captureNode } from '../../lib/export/capture'
import { FEEDBACK_URL } from '../../content/copy'
import { ResultPreviewCard } from '../ResultPreviewCard'

const saveBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}

export function ResultsScreen() {
  const s = useSession()
  const [formats, setFormats] = useState({ tables: false, figures: true })
  const fresh = s.selection.filter((id) => s.runs[id] && !s.runs[id].stale)
  const running = s.runStatus === 'running'

  const download = async () => {
    const files: Record<string, Uint8Array> = {}
    for (const id of fresh) {
      const spec = SPECS[id]!; const folder = `${String(s.selection.indexOf(id) + 1).padStart(2, '0')}_${id}/`
      if (formats.tables) for (const t of spec.tables) files[`${folder}table_${t.id}.png`] = await captureNode(`table-${t.id}`)
      if (formats.figures) files[`${folder}figure_${spec.figure.type}.png`] = s.runs[id].result.figurePng
    }
    const names = Object.keys(files)
    if (names.length === 1) saveBlob(new Blob([files[names[0]] as Uint8Array<ArrayBuffer>], { type: 'image/png' }), names[0].split('/')[1])
    else saveBlob(new Blob([buildBundle(files)], { type: 'application/zip' }), 'telos-results.zip')
  }

  return (
    <section>
      <div className="eyebrow">Results</div>
      <h1 className="title">Results</h1>

      <div className="card">
        <div className="eyebrow">Export &amp; download · tick one or more</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
          {[['PDF report', 'APA-7 tables, figures, how-to-read text — in selection order'], ['LaTeX file (.tex)', 'the same report as a LaTeX source'], ['R script (.R)', 'reproduces every computation & figure, same sequence · ships with the cleaned dataset']].map(([lbl, why]) => (
            <label key={lbl} className="hint" title={why} style={{ opacity: 0.5 }}>
              <input type="checkbox" disabled /> {lbl} <em>(coming in a later slice)</em>
            </label>
          ))}
          <label title="each test's tables as standalone images"><input type="checkbox" checked={formats.tables} onChange={(e) => setFormats({ ...formats, tables: e.target.checked })} /> Table images (.png)</label>
          <label title="each test's graphs / diagrams as standalone images"><input type="checkbox" checked={formats.figures} onChange={(e) => setFormats({ ...formats, figures: e.target.checked })} /> Figure images (.png)</label>
          <button className="btn" style={{ marginLeft: 'auto' }} disabled={running || !fresh.length || (!formats.tables && !formats.figures)}
            onClick={() => { void download() }}>Download</button>
        </div>
      </div>

      {running && <p className="hint" role="status">{s.runPhase ?? 'Running…'}</p>}
      {s.runStatus === 'error' && (
        <div className="error-box" role="alert">Error: {s.runError}{' '}
          <button type="button" onClick={() => { void s.runAll() }}>Try again</button></div>
      )}

      {s.selection.map((id, i) => {
        const spec = SPECS[id]
        if (!spec) return null
        const nn = String(i + 1).padStart(2, '0')
        if (s.errors[id]) return ( // per-test readable error card; other tests' results stay intact (spec run-state rule)
          <section key={id} className="card">
            <div className="eyebrow">{nn} · {spec.name}</div>
            <div className="error-box" role="alert">This test failed: {s.errors[id]}{' '}
              <button type="button" onClick={() => { void s.runAll() }}>Try again</button></div>
          </section>
        )
        const run = s.runs[id]
        if (!run) return running ? ( // per-test progress while its run is pending
          <section key={id} className="card"><div className="eyebrow">{nn} · {spec.name}</div>
            <p className="hint" role="status">{s.runPhase ?? 'Running…'}</p></section>
        ) : null
        return <ResultPreviewCard key={id} index={i + 1} spec={spec} result={run.result} stale={run.stale} running={running} onRerun={() => { void s.runAll() }} />
      })}

      <p className="hint" style={{ textAlign: 'center', marginTop: 18, marginBottom: 6 }}>
        After export · optional feedback — an anonymous, optional satisfaction survey — opens a short Google Form in a new tab
      </p>
      <p style={{ textAlign: 'center', marginTop: 0 }}>
        <a className="pill" href={FEEDBACK_URL} target="_blank" rel="noopener">How did it go? — Share feedback →</a>
      </p>
    </section>
  )
}
```

- [ ] **Step 4: Verify** — `npx tsc -b` → 0; `npm test` green; dev: full manual journey → Welch tables/figure/how-to-read/APA render; Download with figures-only → a single `figure_boxplot.png` downloads directly; tables+figures → `telos-results.zip` with the `01_independent-t-test/` folder. Screenshot `.superpowers/screens/results.png`.

- [ ] **Step 5: Commit**
```bash
git add src/lib/export/capture.ts src/components/ResultPreviewCard.tsx src/components/screens/ResultsScreen.tsx
git commit -m "feat: results screen (export bar 5 formats/3 deferred, preview cards, stale + feedback)"
```

---

## Task 17: Full-journey E2E

**Files:** Create `tests/e2e/fixtures/study.csv`, rewrite `tests/e2e/` (DELETE `tests/e2e/slice.spec.ts`, create `tests/e2e/flow.spec.ts`)

- [ ] **Step 1: Fixture** — `tests/e2e/fixtures/study.csv` (the walking skeleton's sample numbers — every expected value below is the same sandbox-verified R output):

```csv
group,score
control,72
control,68
control,75
control,70
control,66
control,71
treatment,81
treatment,79
treatment,85
treatment,83
treatment,78
treatment,88
```

- [ ] **Step 2: Delete the old spec** — `git rm tests/e2e/slice.spec.ts` (its page no longer exists; flow.spec.ts supersedes it).

- [ ] **Step 3: `tests/e2e/flow.spec.ts`** ⚠ (the `dragChip` mouse recipe is a validation-workflow item):

```ts
import { test, expect, type Page } from '@playwright/test'
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { utils, write } from 'xlsx'
import { unzipSync } from 'fflate'

async function dragChip(page: Page, chip: string, roleId: string) {
  const src = page.locator('.chip', { hasText: chip }).first()
  const dst = page.locator(`[data-role="${roleId}"]`)
  const a = (await src.boundingBox())!, b = (await dst.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.up()
}

test('full journey: welcome → upload → guide → configure → pick → drag → Welch run → toggle → pooled re-run → level back-edit → stale → re-run → zip export', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Telos' })).toBeVisible()
  await page.getByRole('button', { name: 'Get started' }).click()

  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/study.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible() // clean parse auto-advances
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  await expect(page.getByText('12 rows · 2 columns · UTF-8')).toBeVisible()
  await expect(page.getByLabel('level of score')).toHaveValue('ratio')   // suggested level pre-filled
  await expect(page.getByLabel('level of group')).toHaveValue('nominal')
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()

  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  await expect(page.getByText('arrives in a later slice').first()).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Pearson' })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Independent t-test' }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()

  await expect(page.getByRole('heading', { name: 'Drag columns into roles' })).toBeVisible()
  await dragChip(page, 'score', 'outcome')
  await dragChip(page, 'group', 'group')
  await expect(page.locator('[data-role="outcome"] .chip.assigned')).toContainText('score')
  await expect(page.locator('[data-role="group"] .chip.assigned')).toContainText('group')
  await page.getByRole('button', { name: 'Run analysis' }).click()

  // Results — Welch (drawn default: equal variance off)
  const t2 = page.locator('#table-t-test')
  await expect(t2).toBeVisible({ timeout: 240_000 })
  await expect(page.locator('#table-group-statistics')).toContainText('70.33')
  await expect(page.locator('#table-group-statistics')).toContainText('3.78')
  await expect(t2).toContainText('Mdiff')
  await expect(t2).toContainText('−5.98'); await expect(t2).toContainText('9.68')
  await expect(t2).toContainText('<.001'); await expect(t2).toContainText('[−16.49, −7.51]'); await expect(t2).toContainText('−3.45')
  await expect(page.getByText('How to read this test')).toBeVisible()
  await expect(page.getByRole('img', { name: /boxplot/i })).toBeVisible()

  // Back-edit via the stepper: toggle equal variance → re-run → pooled
  await page.getByRole('button', { name: /t-test/ }).click() // stepper step (accessible name includes the dot glyph)
  await page.getByLabel(/equal variance/).check()
  await page.getByRole('button', { name: 'Run analysis' }).click()
  await expect(page.locator('#table-t-test')).toBeVisible({ timeout: 120_000 })
  await expect(page.locator('#table-t-test')).toContainText('10')            // integer pooled df
  await expect(page.locator('#table-t-test')).toContainText('[−16.47, −7.53]')

  // Back-edit a LEVEL (earlier-step edit) → result goes stale → re-run (spec Testing §3)
  await page.getByRole('button', { name: 'Configure data' }).click()
  await page.getByLabel('level of score').selectOption('interval') // still t-test-compatible: config stays valid, run goes stale
  await page.getByRole('button', { name: 'Results' }).click()      // forward nav via the gates (stepper reads canEnter)
  await expect(page.getByText(/Stale — the configuration changed/)).toBeVisible()
  await page.getByRole('button', { name: 'Run analysis again' }).click()
  await expect(page.getByText(/Stale — the configuration changed/)).toHaveCount(0, { timeout: 120_000 })

  // Disabled export formats asserted (spec Testing §3)
  for (const name of [/PDF report/, /LaTeX file/, /R script/])
    await expect(page.getByRole('checkbox', { name })).toBeDisabled()

  // Zip download with foldered paths (spec Testing §3)
  await page.getByRole('checkbox', { name: /Table images/ }).check()
  await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('telos-results.zip')
  const entries = Object.keys(unzipSync(new Uint8Array(readFileSync((await download.path())!))))
  expect(entries.sort()).toEqual([
    '01_independent-t-test/figure_boxplot.png',
    '01_independent-t-test/table_group-statistics.png',
    '01_independent-t-test/table_t-test.png',
  ])
})

test('excel path: multi-sheet workbook → sheet picker → guide', async ({ page }) => {
  const wb = utils.book_new()
  utils.book_append_sheet(wb, utils.aoa_to_sheet([['group', 'score'], ['a', 1], ['a', 2], ['a', 3], ['b', 4], ['b', 5], ['b', 6]]), 'Data')
  utils.book_append_sheet(wb, utils.aoa_to_sheet([['x'], [1]]), 'Notes')
  const file = join(mkdtempSync(join(tmpdir(), 'telos-')), 'two-sheets.xlsx')
  writeFileSync(file, Buffer.from(write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer))

  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', file)
  await expect(page.getByText('two-sheets.xlsx · 2 sheets')).toBeVisible()
  await page.getByRole('button', { name: 'Use this sheet' }).click()
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
})
```

- [ ] **Step 4: Run** — `npm run e2e` → 2/2 PASS (first run boots WebR + downloads ggplot2 in the browser — network). `npm test` must ALSO still be green (vitest never collects tests/e2e).

- [ ] **Step 5: Commit**
```bash
git add tests/e2e && git rm -q tests/e2e/slice.spec.ts 2>/dev/null; git commit -m "feat: full-journey e2e (flow, drag, both variance positions, excel sheet picker)"
```

---

## Task 18: README refresh + final gates + Benjie checkpoint

**Files:** Modify `README.md`

- [ ] **Step 1: Update README** — rewrite the "What this is" paragraph to describe the stepped flow (Welcome → Upload (CSV/Excel) → Terms guide → Configure data → Pick tests (46 drawn, t-test live) → drag-slot config → Results/export); note the design language line (white, Workday stepper, blue accent); update the Export bundle section (still images-only; PDF/LaTeX/R-script checkboxes visible but deferred). Commands/licences/architecture sections stay.

- [ ] **Step 2: Full gates** — run and confirm ALL of:
```bash
npx tsc -b          # exit 0
npm test            # all unit + consistency suites green
npm run build       # green
npm run e2e         # 2/2 green
```

- [ ] **Step 3: Fresh-clone check** — `git clone . /tmp/telos-fresh && cd /tmp/telos-fresh && npm install && npm test && npm run build` → all green; delete the clone.

- [ ] **Step 4: Screenshot set for Benjie** — regenerate `.superpowers/screens/*.png` for all seven screens at the production preview (`npm run build && npm run preview`), then STOP: Benjie clicks through the preview and reviews the rendered DRAFT copy (Welcome, Terms, upload limits, min-N reason strings) before any push/deploy. **Never push.**

- [ ] **Step 5: Commit**
```bash
git add README.md && git commit -m "docs: README for the stepped flow slice"
```

---

## Done — definition of success

- `npm test` green: all walking-skeleton suites (registry card, engine, stats known-answers, parse, bundle) PLUS catalog-vs-tree consistency, copy consistency, columnMeta, parseExcel, missing-policy, eligibility, and the table-driven flow-gate/invalidation suites.
- `npm run e2e` green separately: the full journey in real Chromium — upload fixture → stepper gates → 46-test tree with honest grey-outs → drag-slots → Welch by default (df 9.68) → equal-variance toggle → pooled re-run (df 10) → back-edit a level → result marked stale → re-run clears it → three disabled export formats asserted → zip download verified to contain the `01_independent-t-test/` foldered paths; plus the Excel sheet-picker path.
- Every screen's content verbatim from the specs (consistency-tested where the spec carries the text; DRAFT passages rendered for Benjie's in-situ review).
- The other 45 tests visible exactly where the spec draws them, each greyed with an honest reason; eligibility reasons reflect real data checks for the t-test.
- Benjie has clicked through the rendered preview (Task 18 checkpoint) before any push or deploy — both remain his calls.
- **Deferred by decision, not drift:** PDF/LaTeX/R-script export + cleaned.csv; the 45 tests' configs/outputs; SEM canvas; analytics counters; real feedback-form URL; dark-mode polish; moderation.
