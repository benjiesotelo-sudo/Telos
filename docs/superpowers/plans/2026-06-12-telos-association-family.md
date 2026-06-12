# Association Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Six Association tests live in the shell — Pearson, Spearman, Kendall's tau, χ² goodness-of-fit (with custom expected proportions), χ² independence, Fisher's exact.

**Architecture:** Approach A per the approved spec (`docs/superpowers/specs/2026-06-12-telos-association-family-design.md`): a thin serial backbone on main (spec amendment + the `proportions` option kind + shared fixture), then six parallel per-test worktrees each delivering the established trio (registry + consistency test, stats module + known-answer test, builder + test), then one serial integration task, one e2e journey, one combined slice-end review. No new shared stats modules; no new WebR packages (spike verdict: Cramér's V is hand-rolled — see Spike facts).

**Tech Stack:** React/TS/Vite shell (built), WebR engine (`src/lib/webr/engine.ts`), vitest + Playwright. Full `npm test` is serialized and slow (~10+ min) — implementers run ONLY their own test files in FOREGROUND with long timeouts; the full suite gates at integration.

**Process (lighter regimen, ruled 2026-06-12):** card-scoped consistency tests + mutation checks; full gates every commit on main (worktree commits gate on own files + tsc); one combined slice-end review; Benjie's click-through at the end. NOTHING is pushed or deployed without Benjie's explicit say-so.

**Spike facts (ground truth: `docs/superpowers/reviews/association-spike-data/`, report `docs/superpowers/reviews/2026-06-12-association-spike-report.md`):**
- WebR 0.6.0 ≡ native R 4.6.0 on every battery key (tolerance 1e-9 rel) — all numeric literals in the tests below are spike-verified in BOTH engines.
- **rcompanion: DO NOT SHIP** — installs (65-pkg / 53.65 MiB closure) but `library(rcompanion)` cannot load under webr 0.6.0 (`rootSolve`, a DescTools hard dep, has no wasm binary — the PMCMRplus lesson repeated). **Cramér's V ships as the hand formula on the UNCORRECTED χ²**, `sqrt(χ²_unc/(N·min(r−1,c−1)))`, which reproduces `rcompanion::cramerV`'s native default to full precision (0.350438322 ≡ cramerV's 0.3504; the Yates-corrected value 0.3003757 does NOT match). NO new WebR packages this slice; spec D1's fallback fired → the independence card's R-map V entry is amended in Task 1 (flag on the ratify list).
- **effectsize::cohens_w(tab, p = …) accepts custom proportions under webr**, identical to native (and equals √(χ²/N)); effectsize already ships — no fallback needed.
- `cor.test(method="kendall", exact=FALSE)` statistic is named `z`; `method="spearman"` statistic is `S` — matching the drawn columns.
- Fixture: `fixture.csv` (seed 42, n=40) — the association fixture below is the same data with renamed headers/values (order-preserving maps, so every statistic carries over exactly).

**Recorded decisions (this plan; flag at slice end for Benjie's ratify list):**
1. α / tails / CI pills ship as `display` (house convention ratified in prior slices — independent t, Mann-Whitney). The spec §3.3 tails mapping therefore applies at its drawn value (`two.sided` always); the spec's "non-2×2 Fisher tails" check-note is unreachable and not built.
2. GoF APA renders the actual df where the card draws "k−1" (the consistency test asserts the card line via `{df}`→`k−1`); same spirit as table cells filling "—" slots.
3. Fisher 2×2 APA inserts the card's add-on before the period: `…gave p=.030 (OR=2.50, 95% CI [0.61, 11.23]).`; non-2×2 renders the base sentence only, with em-dash OR/CI cells.
4. Expected counts and Cramér's V/Cohen's w format with `f()` (2 dp); percentages 1 dp (frequencies precedent); contingency cell = `obs [exp] (row% / col%)`, Fisher contingency cell = plain count.
5. χ² independence builder appends a dynamic small-expected warning sentence to the drawn table note when min expected < 5 (the note itself promises this warning); APA keeps the card-literal "was significant" wording (ANOVA precedent).
6. Correlation scatters pass the two column names as axis labels; Spearman/Kendall plot raw values (spec §3.9); GoF custom proportions are normalized to sum exactly 1 before reaching `chisq.test` (the gate enforces |Σ−1| ≤ 0.001, R demands exactness).
7. Category order everywhere = JS `Array.sort()` on strings ≡ R C-locale `table()` order for ASCII data (verified by the custom-props known answers flowing through unchanged).

---

## Slice base

Before Task 1, record the slice base for the combined review: `git rev-parse HEAD` → note as BASE.

---

### Task 1: Spec amendment (R2) + decode entities [serial, main]

**Files:**
- Modify: `telos_test_outputs.html` (χ² independence card ~line 649–650, Fisher card ~line 691–692)
- Modify: `src/lib/registry/specHtml.ts:13`

- [ ] **Step 1: Amend the two outputs cards (Benjie's R2 ruling + the flagged R-map truth fix)**

In `telos_test_outputs.html`, χ² independence card meta block: replace

```html
        <div class="m"><b>R map:</b> <code>chisq.test()</code> &rarr; Table 2 &middot; <code>rcompanion::cramerV()</code> &rarr; V &middot; <code>ggplot2</code>/<code>vcd::mosaic()</code> &rarr; figure</div>
        <div class="m bundle">table_contingency.png &middot; table_chi-square.png &middot; figure_mosaic.png (per figure choice: mosaic or grouped bar)</div>
```

with

```html
        <div class="m"><b>R map:</b> <code>chisq.test()</code> &rarr; Table 2 &middot; <code>sqrt(&chi;&sup2;/(N&middot;min(r&minus;1,c&minus;1)))</code> (matches <code>rcompanion::cramerV</code>) &rarr; V &middot; <code>ggplot2::geom_bar()</code> &rarr; figure</div>
        <div class="m bundle">table_contingency.png &middot; table_chi-square.png &middot; figure_bar.png</div>
```

(The V entry is the spec-D1 fallback amendment: rcompanion cannot load under WebR, and the hand formula reproduces its native default exactly — the card's R map must name what actually runs. Flag on the ratify list.)

Fisher card meta block: replace

```html
        <div class="m"><b>R map:</b> <code>fisher.test()</code> &rarr; Table 2 &middot; <code>ggplot2</code>/<code>vcd::mosaic()</code> &rarr; figure</div>
        <div class="m bundle">table_contingency.png &middot; table_fisher.png &middot; figure_mosaic.png (per figure choice: mosaic or grouped bar)</div>
```

with

```html
        <div class="m"><b>R map:</b> <code>fisher.test()</code> &rarr; Table 2 &middot; <code>ggplot2::geom_bar()</code> &rarr; figure</div>
        <div class="m bundle">table_contingency.png &middot; table_fisher.png &middot; figure_bar.png</div>
```

The drawn ftype lines ("mosaic or grouped bar chart" / "mosaic / grouped bar chart") stay — R2: the figure type text already covers a grouped bar.

- [ ] **Step 2: Verify no stray references**

Run: `grep -c "figure_mosaic" telos_test_outputs.html telos_test_inputs.html telos_ui_spec.html`
Expected: 0 in all three (the ui_spec example tree has no association folder; if a hit appears, inspect before touching).

- [ ] **Step 3: Extend decode() for the association cards**

In `src/lib/registry/specHtml.ts`, the ANOVA-family decode line block gains (before the final `&amp;` rule):

```ts
  // Association-family cards
  .replace(/&rho;/g, 'ρ').replace(/&tau;/g, 'τ').replace(/&ge;/g, '≥').replace(/&lt;/g, '<')
```

- [ ] **Step 4: Gates**

Run: `npm run test:fast` → green. Run: `npx tsc -b` → 0 errors.

- [ ] **Step 5: Commit**

```bash
git add telos_test_outputs.html src/lib/registry/specHtml.ts
git commit -m "docs(association): R2 spec amendment — grouped-bar figure (bundle figure_bar.png, R-map ggplot2::geom_bar) on χ² independence + Fisher; decode gains ρ/τ/≥/<"
```

---

### Task 2: `proportions` option kind [serial, main]

**Files:**
- Create: `src/lib/data/props.ts`, `src/lib/data/props.test.ts`
- Modify: `src/lib/registry/types.ts:4` (kind union), `src/state/session.ts` (TestSetup, freshSetup, gateOk, setProp), `src/components/screens/TestConfigScreen.tsx`
- Modify: `src/state/session.test.ts` (setProp staling test)

Pure helpers live in `src/lib/data/props.ts` because `builders.ts` may only import *types* from `session.ts` (session imports RUNNERS from builders — a value import back would be a cycle).

- [ ] **Step 1: Write the failing helper tests**

`src/lib/data/props.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { categoriesOf, propsArray, propsSumOk } from './props'
import type { Dataset } from '../stats/types'

const ds: Dataset = { columns: ['m'], rows: [
  { m: 'lecture' }, { m: 'discussion' }, { m: 'seminar' }, { m: 'lecture' },
  { m: null }, { m: '  ' }, { m: 7 },
] }

describe('props helpers', () => {
  it('categoriesOf: distinct non-empty values, stringified, sorted (R table() order for ASCII)', () => {
    expect(categoriesOf(ds, 'm')).toEqual(['7', 'discussion', 'lecture', 'seminar'])
  })
  it('propsArray: stored value or equal split default', () => {
    expect(propsArray(['a', 'b', 'c'], { b: 0.5 })).toEqual([1 / 3, 0.5, 1 / 3])
  })
  it('propsSumOk: needs ≥2 categories, all > 0, |Σ−1| ≤ 0.001', () => {
    expect(propsSumOk([0.5, 0.3, 0.2])).toBe(true)
    expect(propsSumOk([0.5, 0.2995, 0.2])).toBe(true)  // within tolerance
    expect(propsSumOk([0.5, 0.25, 0.2])).toBe(false)   // sums to .95
    expect(propsSumOk([0.5, 0.5, 0])).toBe(false)      // zero proportion
    expect(propsSumOk([1])).toBe(false)                // one category
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/data/props.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/data/props.ts`**

```ts
import type { Dataset } from '../stats/types'

/** Distinct non-empty values of a column, stringified + sorted — matches R's C-locale table() order for ASCII data. */
export const categoriesOf = (ds: Dataset, col: string): string[] =>
  [...new Set(ds.rows.map((r) => r[col])
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== '').map(String))].sort()

/** Effective custom proportions: stored value per category, equal split where unset. */
export const propsArray = (cats: string[], props: Record<string, number>): number[] =>
  cats.map((c) => props[c] ?? 1 / cats.length)

/** Run-gate rule for custom proportions (design R1): every value > 0, sum within 0.001 of 1. */
export const propsSumOk = (vals: number[]): boolean =>
  vals.length >= 2 && vals.every((v) => Number.isFinite(v) && v > 0)
  && Math.abs(vals.reduce((a, b) => a + b, 0) - 1) <= 0.001
```

Run: `npx vitest run src/lib/data/props.test.ts` → PASS.

- [ ] **Step 4: Extend the option kind + setup state**

`src/lib/registry/types.ts` line 4 — the kind union gains `'proportions'`:

```ts
export interface OptionSpec { id: string; label: string; value: string; kind: 'display' | 'toggle' | 'number' | 'select' | 'proportions'; default?: boolean | number; choices?: string[]; hint?: string } // … existing comment … · proportions: select equal/custom + per-category number inputs (GoF, design R1)
```

`src/state/session.ts`:

1. `TestSetup` gains props: `export interface TestSetup { roles: Record<string, string[]>; options: Record<string, boolean | number | string>; props: Record<string, number>; blocked: string | null }`
2. `freshSetup` initializes the mode from the drawn value and an empty props map:

```ts
const freshSetup = (id: string): TestSetup => ({
  roles: Object.fromEntries((SPECS[id]?.constraints.roles ?? []).map((r) => [r.roleId, []])),
  options: Object.fromEntries((SPECS[id]?.options ?? []).filter((o) => o.kind !== 'display').map((o) => [o.id,
    o.kind === 'select' || o.kind === 'proportions' ? (o.default != null ? String(o.default) : o.value) : o.default!,
  ])),
  props: {},
  blocked: null,
})
```

3. `gateOk`'s `test:` branch gains the props gate (import `categoriesOf, propsArray, propsSumOk` from `../lib/data/props`):

```ts
  if (step.startsWith('test:')) {
    const id = step.slice(5); const t = s.setups[id]; const spec = SPECS[id]
    if (!t || !spec || t.blocked || !spec.constraints.roles.every((r) => t.roles[r.roleId].length >= r.arity.min)) return false
    const propOpt = spec.options.find((o) => o.kind === 'proportions')
    if (propOpt && t.options[propOpt.id] === 'custom') {
      const col = t.roles[spec.constraints.roles[0].roleId][0]
      if (!col || !propsSumOk(propsArray(categoriesOf(workingDataset(s), col), t.props))) return false
    }
    return true
  }
```

(The dataset walk only happens when a proportions option is set to custom — no cost to other tests.)

4. New action `setProp`, the exact `setOption` shape (the shared `edit()` already stales ALL runs on any config edit — journey-B rule):

```ts
    setProp: (testId, category, value: number) => edit((s) => ({
      setups: { ...s.setups, [testId]: { ...s.setups[testId], props: { ...s.setups[testId].props, [category]: value } } },
    })),
```

and in `SessionState`: `setProp: (testId: string, category: string, value: number) => void`

- [ ] **Step 5: setProp staling test**

Append to `src/state/session.test.ts` (follow that file's existing store-seeding pattern for state setup):

```ts
it('setProp stales every run (any config edit stales ALL runs)', () => {
  // seed: one selected test with a fresh run, then edit a proportion
  useSession.setState({ selection: ['independent-t-test'],
    setups: { 'independent-t-test': { roles: { outcome: [], group: [] }, options: {}, props: {}, blocked: null } },
    runs: { 'independent-t-test': { result: {}, stale: false } } })
  useSession.getState().setProp('independent-t-test', 'a', 0.4)
  expect(useSession.getState().runs['independent-t-test'].stale).toBe(true)
  expect(useSession.getState().setups['independent-t-test'].props).toEqual({ a: 0.4 })
})
```

Run: `npx vitest run src/state/session.test.ts` → PASS (adjust seeding to the file's local helpers if it has them — keep the two assertions).

- [ ] **Step 6: TestConfigScreen rendering**

`src/components/screens/TestConfigScreen.tsx`:

1. Imports gain: `import { useSession, gateOk, stepsOf, workingDataset } from '../../state/session'` and `import { categoriesOf, propsArray, propsSumOk } from '../../lib/data/props'`.
2. In the options row, add a branch before the final number-input fallback — `proportions` renders its mode select exactly like the `select` kind but with fixed choices:

```tsx
        ) : o.kind === 'select' || o.kind === 'proportions' ? (
          <label key={o.id} className="pill">
            {o.label}{' '}
            <select aria-label={o.label} value={String(setup.options[o.id] ?? o.value)} disabled={running}
              onChange={(e) => s.setOption(testId, o.id, e.target.value)}
              style={{ border: 0, background: 'transparent', font: 'inherit', color: 'inherit' }}>
              {(o.kind === 'proportions' ? ['equal', 'custom'] : o.choices!).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        ) : (
```

3. Directly after the options row `</div>`, the per-category inputs (rendered only in custom mode):

```tsx
      {spec.options.filter((o) => o.kind === 'proportions' && setup.options[o.id] === 'custom').map((o) => {
        const col = setup.roles[spec.constraints.roles[0].roleId][0]
        if (!col) return <p key={o.id} className="hint" style={{ marginTop: 6 }}>assign a column to {spec.roles[0].label} to set custom proportions</p>
        const cats = categoriesOf(workingDataset(s), col)
        const vals = propsArray(cats, setup.props)
        const sum = vals.reduce((a, b) => a + b, 0)
        return (
          <div key={o.id} style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {cats.map((c, i) => (
              <label key={c} className="pill">
                {c}{' '}
                <input type="number" step={0.01} min={0} value={Number(vals[i].toFixed(4))} disabled={running}
                  aria-label={`proportion: ${c}`} onChange={(e) => s.setProp(testId, c, Number(e.target.value))}
                  style={{ width: '5em', border: 0, background: 'transparent', font: 'inherit', color: 'inherit' }} />
              </label>
            ))}
            <span className="hint">{propsSumOk(vals) ? `Σ = ${sum.toFixed(2)}` : `Σ = ${sum.toFixed(2)} — proportions must sum to 1`}</span>
          </div>
        )
      })}
```

4. The named-gate hint IIFE learns the props case — replace the `firstOpen === \`test:${testId}\`` line with:

```tsx
          if (firstOpen === `test:${testId}`) {
            const rolesOk = spec.constraints.roles.every((r) => setup.roles[r.roleId].length >= r.arity.min)
            return rolesOk ? 'custom proportions must sum to 1 to enable Run'
              : 'fill every required slot here to enable Run · first run loads the R engine'
          }
```

(When roles are complete, the only remaining gate this screen can fail is the props sum.)

- [ ] **Step 7: Gates**

Run: `npm run test:fast` → green (existing suites unaffected: no shipped spec has a proportions option yet). Run: `npx tsc -b` → 0. Run: `npx playwright test` → existing e2e green.

- [ ] **Step 8: Commit**

```bash
git add src/lib/data/props.ts src/lib/data/props.test.ts src/lib/registry/types.ts src/state/session.ts src/state/session.test.ts src/components/screens/TestConfigScreen.tsx
git commit -m "feat(association): proportions option kind — equal/custom select, per-category inputs, sum-to-1 run gate (design R1)"
```

---

### Task 3: Association fixture [serial, main]

**Files:**
- Create: `src/lib/stats/fixtures/association.ts`
- Create: `tests/e2e/fixtures/association.csv`

The fixture is the spike fixture (`docs/superpowers/reviews/association-spike-data/fixture.csv`, seed 42, n=40) with renamed headers and order-preserving value maps, so every spike statistic applies verbatim:

| spike column | fixture column | value map (order-preserving) |
|---|---|---|
| x | hours_studied | — |
| y | exam_score | — |
| ord1 | satisfaction | — |
| ord2 | motivation | — |
| cat3 | method | alpha→discussion, beta→lecture, gamma→seminar |
| cat3b | grade_band | — (high/low/mid) |
| bin1 | passed | — (no/yes) |
| bin2 | gender | fail→female, pass→male |

- [ ] **Step 1: Generate both files from the committed spike fixture**

Run this one-off from the repo root (writes both targets; the loader module mirrors `src/lib/stats/fixtures/anova.ts` — copy that file's export shape):

```bash
node - <<'EOF'
const fs = require('fs')
const lines = fs.readFileSync('docs/superpowers/reviews/association-spike-data/fixture.csv', 'utf8').trim().split('\n')
const header = 'hours_studied,exam_score,satisfaction,motivation,method,grade_band,passed,gender'
const map = { alpha: 'discussion', beta: 'lecture', gamma: 'seminar', fail: 'female', pass: 'male' }
const rows = lines.slice(1).map((l) => l.split(',').map((c) => { const v = c.replace(/"/g, ''); return map[v] ?? v }).join(','))
fs.writeFileSync('tests/e2e/fixtures/association.csv', [header, ...rows].join('\n') + '\n')
const cols = header.split(',')
const objs = rows.map((l) => { const cs = l.split(','); return Object.fromEntries(cols.map((c, i) => [c, isNaN(Number(cs[i])) ? cs[i] : Number(cs[i])])) })
fs.writeFileSync('src/lib/stats/fixtures/association.ts',
`import type { Dataset } from '../types'

// Spike fixture (seed 42, n = 40) with renamed headers + order-preserving value maps — every number in
// docs/superpowers/reviews/association-spike-data/native.json applies verbatim. Regenerate via the Task 3 script.
export const loadAssociationFixture = (): Dataset => ({
  columns: ${JSON.stringify(cols)},
  rows: [
${objs.map((o) => '    ' + JSON.stringify(o) + ',').join('\n')}
  ],
})
`)
EOF
```

- [ ] **Step 2: Sanity-check**

Run: `head -3 tests/e2e/fixtures/association.csv` → header + 2 data rows with mapped values. Run: `npx tsc -b` → 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stats/fixtures/association.ts tests/e2e/fixtures/association.csv
git commit -m "test(association): shared fixture — spike data with order-preserving renames (spike numbers carry over verbatim)"
```

---

## Parallel phase — Tasks 4–9, one worktree per test

Worktree mechanics (per test `<id>` with branch `assoc/<id>`):

```bash
git worktree add ../telos-wt-<id> -b assoc/<id>
cd ../telos-wt-<id> && npm install   # plain install — NEVER symlink node_modules (ANOVA incident)
```

**Implementer rules (put in every dispatch):** touch ONLY the six files your task names (+ nothing shared). Run ONLY your own test files — the stats test boots a real WebR engine (first run downloads ~80 s; the whole file takes 3–6 min): run it in FOREGROUND with a long timeout. Do not run the full suite (engine suites contend). Gates per worktree: your test files green + `npx tsc -b` 0 errors. Commit with the exact message given. The registry strings are transcribed in full below, but the spec HTML is the authority — if a string below disagrees with the card, the card wins (the consistency test will tell you).

**Mutation check (every task, after the consistency test passes):** corrupt one registry display string (the table title's case, e.g. `'Pearson correlation'` → `'Pearson Correlation'`), re-run the consistency test, expect RED; restore (`git checkout -- src/lib/registry/<file>.ts` only if uncommitted; otherwise revert the edit), re-run, expect GREEN. Report both runs in your summary.

---

### Task 4: Pearson correlation [worktree assoc/pearson]

**Files:**
- Create: `src/lib/registry/pearson.ts`, `src/lib/registry/pearson.consistency.test.ts`
- Create: `src/lib/stats/pearson.ts`, `src/lib/stats/pearson.test.ts`
- Create: `src/lib/results/buildPearson.ts`, `src/lib/results/buildPearson.test.ts`

- [ ] **Step 1: Registry**

`src/lib/registry/pearson.ts`:

```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Pearson correlation cards) — display strings verbatim.
export const PEARSON: TestSpec = {
  id: 'pearson',
  name: 'Pearson correlation',
  question: 'linear association of two numeric variables',
  roles: [
    { id: 'variableA', label: 'Variable A', levels: 'interval / ratio', arity: 'exactly 1' },
    { id: 'variableB', label: 'Variable B', levels: 'interval / ratio', arity: 'exactly 1' },
  ],
  options: [
    // House convention (recorded decision 1): α / tails / CI pills are display-only.
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'tails', label: 'tails', value: 'two', kind: 'display' },
    { id: 'ci', label: 'CI', value: '95%', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'variableA', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'variableB', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
    ],
    minRule: { kind: 'complete-pairs', n: 3 }, // r needs df = n−2 ≥ 1
  },
  tables: [
    { id: 'correlation', title: 'Pearson correlation', captionStyle: 'bare', domId: 'pearson-correlation', // three correlation cards share id 'correlation' (zip keeps it; DOM must not collide)
      columns: [{ key: 'pair', label: 'Pair' }, { key: 'r', label: 'r' }, { key: 'ci', label: '95% CI' }, { key: 't', label: 't' }, { key: 'df', label: 'df' }, { key: 'p', label: 'p' }, { key: 'n', label: 'N' }] },
  ],
  figures: [{ caption: 'Relationship', type: 'scatter plot with fitted line', file: 'scatter' }],
  howToRead:
    'r ranges from −1 to +1: the sign is the direction, the magnitude the strength (~.1 small, .3 medium, .5 large). ' +
    'p tests whether it differs from zero; the 95% CI shows the precision. r measures only linear association — ' +
    'a strong curved relationship can give r near 0, and r is sensitive to outliers, so always inspect the scatterplot ' +
    "(use Spearman's rs for monotonic-but-nonlinear or outlier-affected data). Correlation does not imply causation.",
  apaTemplate: '[X] and [Y] were correlated, r({df})={r}, p={p}, 95% CI [{ciLow}, {ciHigh}].',
  rMap: 'cor.test() → table · geom_point()+geom_smooth(method="lm") → figure',
  bundleFiles: ['table_correlation.png', 'figure_scatter.png'],
}
```

- [ ] **Step 2: Consistency test**

`src/lib/registry/pearson.consistency.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PEARSON as spec } from './pearson'
import { strip } from './specHtml'

// Scope each file to THIS card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Pearson correlation</span>'), outputsHtml.indexOf('Spearman correlation</span>'))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Pearson correlation</div>'), inputsHtml.indexOf('<div class="ttl">Chi-square independence</div>'))

describe('pearson registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table thead equals the card column sequence', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => t[1]))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}<sub>${c.sub}</sub>` : c.label))))
  })
  it('bare table caption equals the card caption', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables[0].captionStyle).toBe('bare')
  })
  it('question, figure caption + type, how-to-read and R map match verbatim (no table note on this card)', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(card.includes('tbl-note')).toBe(false)
    expect(spec.tableNote).toBeUndefined()
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figures![0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${spec.figures![0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('APA line equals the template with every {placeholder} as __', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__')}”`)
  })
  it('bundle line EQUALS bundleFiles, names derive from table ids + figure file slug', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...spec.figures!.map((f) => `figure_${f.file ?? f.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + constraint lines', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
  })
  it('options equal the inputs card option strip; all display-only (recorded decision 1)', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.every((o) => o.kind === 'display')).toBe(true)
  })
})
```

Run: `npx vitest run src/lib/registry/pearson.consistency.test.ts` → PASS. Then the mutation check (title case) → RED → restore → GREEN.

- [ ] **Step 3: Stats module**

`src/lib/stats/pearson.ts`:

```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface PearsonResult {
  varA: string; varB: string // role names — builders get (spec, result) only
  r: number; t: number; df: number; p: number; ciLow: number; ciHigh: number; n: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

const R_STATS = String.raw`
ct <- cor.test(x, y)
list(r = unname(ct$estimate), t = unname(ct$statistic), df = unname(ct$parameter), p = ct$p.value,
     ciLow = ct$conf.int[1], ciHigh = ct$conf.int[2], n = length(x))`

// Card R map: geom_point()+geom_smooth(method="lm") — default se band; column names as axis labels (recorded decision 6).
const R_SCATTER = String.raw`
print(ggplot2::ggplot(data.frame(x = x, y = y), ggplot2::aes(x, y)) +
  ggplot2::geom_point(colour = '#0c447c') +
  ggplot2::geom_smooth(method = 'lm', colour = '#0c447c', fill = '#9cc2ec') +
  ggplot2::labs(x = xlab, y = ylab))`

interface RawStats { r: number; t: number; df: number; p: number; ciLow: number; ciHigh: number; n: number }

export async function runPearson(engine: Engine, data: Dataset, varA: string, varB: string): Promise<PearsonResult> {
  // Per-test listwise (spec step-4a default): both role columns numeric-finite in the same row.
  const rows = data.rows.filter((r) =>
    typeof r[varA] === 'number' && Number.isFinite(r[varA] as number)
    && typeof r[varB] === 'number' && Number.isFinite(r[varB] as number))
  const nExcluded = data.rows.length - rows.length
  const env = { x: rows.map((r) => r[varA] as number), y: rows.map((r) => r[varB] as number), xlab: varA, ylab: varB }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_SCATTER, 600, 450, env)
  return { varA, varB, ...s, nExcluded, figurePng }
}
```

- [ ] **Step 4: Stats known-answer test**

`src/lib/stats/pearson.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runPearson } from './pearson'
import { loadAssociationFixture } from './fixtures/association'
import type { Dataset } from './types'

describe('runPearson', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike known answers (hours_studied × exam_score)', async () => {
    const r = await runPearson(engine, loadAssociationFixture(), 'hours_studied', 'exam_score')
    expect(r.r).toBeCloseTo(0.7016484693, 6)
    expect(r.t).toBeCloseTo(6.070330284, 6)
    expect(r.df).toBe(38)
    expect(r.p).toBeCloseTo(4.558820127e-07, 9)
    expect(r.ciLow).toBeCloseTo(0.4992630807, 6)
    expect(r.ciHigh).toBeCloseTo(0.8314317357, 6)
    expect(r.n).toBe(40)
    expect(r.nExcluded).toBe(0)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 900_000)

  it('listwise: excludes rows missing either variable', async () => {
    const ds: Dataset = { columns: ['a', 'b'], rows: [
      { a: 1, b: 2 }, { a: 2, b: 4 }, { a: 3, b: 5 }, { a: 4, b: 9 },
      { a: null, b: 1 }, { a: 5, b: null },
    ] }
    const r = await runPearson(engine, ds, 'a', 'b')
    expect(r.n).toBe(4)
    expect(r.nExcluded).toBe(2)
  }, 300_000)
})
```

Run: `npx vitest run src/lib/stats/pearson.test.ts` (FOREGROUND, long timeout) → PASS.

- [ ] **Step 5: Builder + test**

`src/lib/results/buildPearson.ts`:

```ts
import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { PearsonResult } from '../stats/pearson'
import type { CardContent } from './builders'
import { f, fdf, fp } from '../format/apa'

export function buildPearson(spec: TestSpec, r: PearsonResult): CardContent {
  const apa = spec.apaTemplate
    .replace('[X]', r.varA).replace('[Y]', r.varB)
    .replace('{df}', fdf(r.df)).replace('{r}', f(r.r))
    .replace('p={p}', r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`)
    .replace('{ciLow}', f(r.ciLow)).replace('{ciHigh}', f(r.ciHigh))
  const fig = figuresOf(spec)[0]
  return {
    tables: [{ spec: spec.tables[0], rows: [{
      pair: `${r.varA} – ${r.varB}`, r: f(r.r), ci: `[${f(r.ciLow)}, ${f(r.ciHigh)}]`,
      t: f(r.t), df: fdf(r.df), p: fp(r.p), n: r.n,
    }] }],
    note: null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
```

`src/lib/results/buildPearson.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildPearson } from './buildPearson'
import { PEARSON } from '../registry/pearson'
import type { PearsonResult } from '../stats/pearson'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const res: PearsonResult = { varA: 'hours_studied', varB: 'exam_score',
  r: 0.61234, t: 4.7789, df: 38, p: 0.0000271, ciLow: 0.3712, ciHigh: 0.7741, n: 40, nExcluded: 0, figurePng: png }

describe('buildPearson', () => {
  it('fills the correlation row per format conventions', () => {
    const c = buildPearson(PEARSON, res)
    expect(c.tables[0].rows).toEqual([{ pair: 'hours_studied – exam_score', r: '0.61', ci: '[0.37, 0.77]', t: '4.78', df: '38', p: '<.001', n: 40 }])
    expect(c.note).toBeNull()
    expect(c.figures[0].file).toBe('scatter')
  })
  it('APA substitutes names + values; tiny p becomes p<.001', () => {
    const c = buildPearson(PEARSON, res)
    expect(c.apa).toBe('hours_studied and exam_score were correlated, r(38)=0.61, p<.001, 95% CI [0.37, 0.77].')
  })
})
```

Run: `npx vitest run src/lib/results/buildPearson.test.ts` → PASS.

- [ ] **Step 6: Gates + commit**

Run: `npx tsc -b` → 0.

```bash
git add src/lib/registry/pearson.ts src/lib/registry/pearson.consistency.test.ts src/lib/stats/pearson.ts src/lib/stats/pearson.test.ts src/lib/results/buildPearson.ts src/lib/results/buildPearson.test.ts
git commit -m "feat(association): pearson — registry+consistency, stats (cor.test, spike-verified), builder"
```

---

### Task 5: Spearman correlation [worktree assoc/spearman]

**Files:**
- Create: `src/lib/registry/spearman.ts`, `src/lib/registry/spearman.consistency.test.ts`
- Create: `src/lib/stats/spearman.ts`, `src/lib/stats/spearman.test.ts`
- Create: `src/lib/results/buildSpearman.ts`, `src/lib/results/buildSpearman.test.ts`

- [ ] **Step 1: Registry**

`src/lib/registry/spearman.ts`:

```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Spearman correlation cards) — display strings verbatim.
export const SPEARMAN: TestSpec = {
  id: 'spearman',
  name: 'Spearman correlation',
  question: 'rank association (ordinal / monotonic)',
  roles: [
    { id: 'variableA', label: 'Variable A', levels: 'ordinal / interval / ratio', arity: 'exactly 1' },
    { id: 'variableB', label: 'Variable B', levels: 'ordinal / interval / ratio', arity: 'exactly 1' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'tails', label: 'tails', value: 'two', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'variableA', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'variableB', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
    ],
    minRule: { kind: 'complete-pairs', n: 3 },
  },
  tables: [
    { id: 'correlation', title: 'Spearman correlation', captionStyle: 'bare', domId: 'spearman-correlation',
      columns: [{ key: 'pair', label: 'Pair' }, { key: 'rho', label: 'ρ' }, { key: 's', label: 'S' }, { key: 'p', label: 'p' }, { key: 'n', label: 'N' }] },
  ],
  tableNote: { kind: 'plain', text: 'no confidence interval — cor.test does not return one for rank correlation.' },
  figures: [{ caption: 'Relationship', type: 'scatter plot (optionally on ranks)', file: 'scatter' }],
  howToRead:
    'ρ measures how well the relationship follows a consistent up-or-down trend (monotonic), using ranks. ' +
    "Read sign and magnitude like Pearson's r; p tests significance.",
  apaTemplate: 'A Spearman correlation was ρ={rho}, p={p}, N={n}.',
  rMap: 'cor.test(method="spearman") → table · ggplot2 → figure',
  bundleFiles: ['table_correlation.png', 'figure_scatter.png'],
}
```

- [ ] **Step 2: Consistency test**

`src/lib/registry/spearman.consistency.test.ts` — same shape as Pearson's with these scopes and additions:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { SPEARMAN as spec } from './spearman'
import { strip } from './specHtml'

const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Spearman correlation</span>'), outputsHtml.indexOf("Kendall's tau</span>"))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Spearman correlation</div>'), inputsHtml.indexOf('<div class="ttl">Kendall\'s tau</div>'))

describe('spearman registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table thead equals the card column sequence', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => c.label))) // ρ arrives as &rho; — compare decoded
  })
  it('bare table caption equals the card caption', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables[0].captionStyle).toBe('bare')
  })
  it('question, plain table note, figure caption + type, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(spec.tableNote).toEqual({ kind: 'plain', text: strip(card.match(/<p class="tbl-note">(.*?)<\/p>/s)![1]) })
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figures![0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${spec.figures![0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('APA line equals the template with every {placeholder} as __', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__')}”`)
  })
  it('bundle line EQUALS bundleFiles, names derive from table ids + figure file slug', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...spec.figures!.map((f) => `figure_${f.file ?? f.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + constraint lines', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
  })
  it('options equal the inputs card option strip; all display-only', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.every((o) => o.kind === 'display')).toBe(true)
  })
})
```

Note the thead assertion strips each `<th>` (the ρ header is an entity; no `<sub>` columns on this card). Run + mutation check as in Task 4.

- [ ] **Step 3: Stats module**

`src/lib/stats/spearman.ts`:

```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface SpearmanResult {
  varA: string; varB: string
  rho: number; s: number; p: number; n: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

// exact = FALSE (recorded in design §3.2): deterministic asymptotic path — the exact path is unavailable
// with ties anyway, and this pins WebR ≡ native R regardless of tie pattern. Spike-verified both ways.
// suppressWarnings: the tie warning is expected, and the spike battery ran exactly this form.
const R_STATS = String.raw`
ct <- suppressWarnings(cor.test(x, y, method = 'spearman', exact = FALSE))
list(rho = unname(ct$estimate), s = unname(ct$statistic), p = ct$p.value, n = length(x))`

// Card R map: ggplot2 → figure; raw values (design §3.9), column names as axis labels.
const R_SCATTER = String.raw`
print(ggplot2::ggplot(data.frame(x = x, y = y), ggplot2::aes(x, y)) +
  ggplot2::geom_point(colour = '#0c447c') +
  ggplot2::labs(x = xlab, y = ylab))`

interface RawStats { rho: number; s: number; p: number; n: number }

export async function runSpearman(engine: Engine, data: Dataset, varA: string, varB: string): Promise<SpearmanResult> {
  const rows = data.rows.filter((r) =>
    typeof r[varA] === 'number' && Number.isFinite(r[varA] as number)
    && typeof r[varB] === 'number' && Number.isFinite(r[varB] as number))
  const nExcluded = data.rows.length - rows.length
  const env = { x: rows.map((r) => r[varA] as number), y: rows.map((r) => r[varB] as number), xlab: varA, ylab: varB }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_SCATTER, 600, 450, env)
  return { varA, varB, ...s, nExcluded, figurePng }
}
```

- [ ] **Step 4: Stats known-answer test**

`src/lib/stats/spearman.test.ts` (same harness shape as Task 4 Step 4):

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runSpearman } from './spearman'
import { loadAssociationFixture } from './fixtures/association'

describe('runSpearman', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('spike known answers — tied ordinal pair (satisfaction × motivation)', async () => {
    const r = await runSpearman(engine, loadAssociationFixture(), 'satisfaction', 'motivation')
    expect(r.rho).toBeCloseTo(0.8468402828, 6)
    expect(r.s).toBeCloseTo(1632.682586, 4)
    expect(r.p).toBeCloseTo(5.716192287e-12, 9)
    expect(r.n).toBe(40)
  }, 900_000)

  it('spike known answers — continuous pair (hours_studied × exam_score)', async () => {
    const r = await runSpearman(engine, loadAssociationFixture(), 'hours_studied', 'exam_score')
    expect(r.rho).toBeCloseTo(0.6549233014, 6)
    expect(r.s).toBeCloseTo(3678.517607, 4)
    expect(r.p).toBeCloseTo(4.536450066e-06, 9)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 300_000)
})
```

- [ ] **Step 5: Builder + test**

`src/lib/results/buildSpearman.ts`:

```ts
import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { SpearmanResult } from '../stats/spearman'
import type { CardContent } from './builders'
import { f, fdf, fp } from '../format/apa'

export function buildSpearman(spec: TestSpec, r: SpearmanResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{rho}', f(r.rho))
    .replace('p={p}', r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`)
    .replace('{n}', String(r.n))
  const fig = figuresOf(spec)[0]
  return {
    tables: [{ spec: spec.tables[0], rows: [{
      pair: `${r.varA} – ${r.varB}`, rho: f(r.rho), s: fdf(r.s), p: fp(r.p), n: r.n,
    }] }],
    note: spec.tableNote ?? null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
```

`src/lib/results/buildSpearman.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildSpearman } from './buildSpearman'
import { SPEARMAN } from '../registry/spearman'
import type { SpearmanResult } from '../stats/spearman'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const res: SpearmanResult = { varA: 'satisfaction', varB: 'motivation',
  rho: 0.7321, s: 2854.4, p: 0.00321, n: 40, nExcluded: 1, figurePng: png }

describe('buildSpearman', () => {
  it('fills the row; S uses fdf (integers bare, ties give decimals)', () => {
    const c = buildSpearman(SPEARMAN, res)
    expect(c.tables[0].rows).toEqual([{ pair: 'satisfaction – motivation', rho: '0.73', s: '2854.40', p: '.003', n: 40 }])
    expect(c.note).toEqual(SPEARMAN.tableNote)
    expect(c.nExcluded).toBe(1)
  })
  it('APA line', () => {
    expect(buildSpearman(SPEARMAN, res).apa).toBe('A Spearman correlation was ρ=0.73, p=.003, N=40.')
  })
})
```

- [ ] **Step 6: Gates + commit**

`npx tsc -b` → 0; own tests green.

```bash
git add src/lib/registry/spearman.ts src/lib/registry/spearman.consistency.test.ts src/lib/stats/spearman.ts src/lib/stats/spearman.test.ts src/lib/results/buildSpearman.ts src/lib/results/buildSpearman.test.ts
git commit -m "feat(association): spearman — registry+consistency, stats (exact=FALSE asymptotic path, spike-verified), builder"
```

---

### Task 6: Kendall's tau [worktree assoc/kendalls-tau]

**Files:**
- Create: `src/lib/registry/kendallsTau.ts`, `src/lib/registry/kendallsTau.consistency.test.ts`
- Create: `src/lib/stats/kendallsTau.ts`, `src/lib/stats/kendallsTau.test.ts`
- Create: `src/lib/results/buildKendallsTau.ts`, `src/lib/results/buildKendallsTau.test.ts`

- [ ] **Step 1: Registry**

`src/lib/registry/kendallsTau.ts`:

```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Kendall's tau cards) — display strings verbatim.
export const KENDALLS_TAU: TestSpec = {
  id: 'kendalls-tau',
  name: "Kendall's tau",
  question: 'rank association, robust to ties',
  roles: [
    { id: 'variableA', label: 'Variable A', levels: 'ordinal / interval / ratio', arity: 'exactly 1' },
    { id: 'variableB', label: 'Variable B', levels: 'ordinal / interval / ratio', arity: 'exactly 1' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'tails', label: 'tails', value: 'two', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'variableA', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'variableB', levels: ['ordinal', 'interval', 'ratio'], arity: { min: 1, max: 1 } },
    ],
    minRule: { kind: 'complete-pairs', n: 3 },
  },
  tables: [
    { id: 'correlation', title: "Kendall's tau", captionStyle: 'bare', domId: 'kendalls-tau-correlation',
      columns: [{ key: 'pair', label: 'Pair' }, { key: 'tau', label: 'τ' }, { key: 'z', label: 'z' }, { key: 'p', label: 'p' }, { key: 'n', label: 'N' }] },
  ],
  figures: [{ caption: 'Relationship', type: 'scatter plot (optionally on ranks — τ measures monotonic, not linear, association)', file: 'scatter' }],
  howToRead:
    'τ is a rank correlation based on concordant vs. discordant pairs — well suited to small samples and many ties. ' +
    'Sign = direction, magnitude = strength; p tests significance.',
  apaTemplate: "Kendall's τ={tau}, p={p}, N={n}.",
  rMap: 'cor.test(method="kendall") → table · ggplot2 → figure',
  bundleFiles: ['table_correlation.png', 'figure_scatter.png'],
}
```

- [ ] **Step 2: Consistency test**

`src/lib/registry/kendallsTau.consistency.test.ts` — Task 5's shape with: outputs scope `outputsHtml.indexOf("Kendall's tau</span>")` → `outputsHtml.indexOf('Chi-square independence</span>')`; inputs scope `inputsHtml.indexOf('<div class="ttl">Kendall\'s tau</div>')` → `inputsHtml.indexOf('<div class="ttl">Chi-square goodness-of-fit</div>')`; import `KENDALLS_TAU as spec`; this card has NO tbl-note (assert `card.includes('tbl-note')` false and `spec.tableNote` undefined, as in Task 4); thead compared with `strip()` per cell (τ entity). All other assertions identical. Run + mutation check.

- [ ] **Step 3: Stats module**

`src/lib/stats/kendallsTau.ts`:

```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface KendallsTauResult {
  varA: string; varB: string
  tau: number; z: number; p: number; n: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

// exact = FALSE (design §3.2): ONLY the asymptotic path returns the z statistic the card draws
// (the exact path's statistic is T). Spike-verified: statistic name is 'z' on this path, tied and untied.
// suppressWarnings: the tie warning is expected, and the spike battery ran exactly this form.
const R_STATS = String.raw`
ct <- suppressWarnings(cor.test(x, y, method = 'kendall', exact = FALSE))
list(tau = unname(ct$estimate), z = unname(ct$statistic), p = ct$p.value, n = length(x))`

const R_SCATTER = String.raw`
print(ggplot2::ggplot(data.frame(x = x, y = y), ggplot2::aes(x, y)) +
  ggplot2::geom_point(colour = '#0c447c') +
  ggplot2::labs(x = xlab, y = ylab))`

interface RawStats { tau: number; z: number; p: number; n: number }

export async function runKendallsTau(engine: Engine, data: Dataset, varA: string, varB: string): Promise<KendallsTauResult> {
  const rows = data.rows.filter((r) =>
    typeof r[varA] === 'number' && Number.isFinite(r[varA] as number)
    && typeof r[varB] === 'number' && Number.isFinite(r[varB] as number))
  const nExcluded = data.rows.length - rows.length
  const env = { x: rows.map((r) => r[varA] as number), y: rows.map((r) => r[varB] as number), xlab: varA, ylab: varB }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_SCATTER, 600, 450, env)
  return { varA, varB, ...s, nExcluded, figurePng }
}
```

- [ ] **Step 4: Stats known-answer test**

`src/lib/stats/kendallsTau.test.ts` — Task 5 Step 4's harness with:

```ts
  it('spike known answers — tied ordinal pair (satisfaction × motivation)', async () => {
    const r = await runKendallsTau(engine, loadAssociationFixture(), 'satisfaction', 'motivation')
    expect(r.tau).toBeCloseTo(0.7490683239, 6)
    expect(r.z).toBeCloseTo(5.708916072, 6)
    expect(r.p).toBeCloseTo(1.136979369e-08, 9)
    expect(r.n).toBe(40)
  }, 900_000)

  it('spike known answers — continuous pair (hours_studied × exam_score)', async () => {
    const r = await runKendallsTau(engine, loadAssociationFixture(), 'hours_studied', 'exam_score')
    expect(r.tau).toBeCloseTo(0.4688504499, 6)
    expect(r.z).toBeCloseTo(4.253493058, 6)
    expect(r.p).toBeCloseTo(2.104614657e-05, 9)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 300_000)
```

- [ ] **Step 5: Builder + test**

`src/lib/results/buildKendallsTau.ts` — Task 5's builder shape: row `{ pair, tau: f(r.tau), z: f(r.z), p: fp(r.p), n: r.n }`, `note: null` (no tableNote), APA replaces `{tau}`/`p={p}`/`{n}`. Test `src/lib/results/buildKendallsTau.test.ts` mirrors Task 5's with: result `{ varA: 'satisfaction', varB: 'motivation', tau: 0.512, z: 3.456, p: 0.00055, n: 40, nExcluded: 0, figurePng: png }`, expected row `{ pair: 'satisfaction – motivation', tau: '0.51', z: '3.46', p: '<.001', n: 40 }` — note `fp(0.00055)` is `'<.001'` and the APA becomes `"Kendall's τ=0.51, p<.001, N=40."`.

- [ ] **Step 6: Gates + commit**

`npx tsc -b` → 0; own tests green.

```bash
git add src/lib/registry/kendallsTau.ts src/lib/registry/kendallsTau.consistency.test.ts src/lib/stats/kendallsTau.ts src/lib/stats/kendallsTau.test.ts src/lib/results/buildKendallsTau.ts src/lib/results/buildKendallsTau.test.ts
git commit -m "feat(association): kendalls-tau — registry+consistency, stats (asymptotic z path, spike-verified), builder"
```

---

### Task 7: Chi-square goodness-of-fit [worktree assoc/chi-square-goodness-of-fit]

**Files:**
- Create: `src/lib/registry/chiSquareGof.ts`, `src/lib/registry/chiSquareGof.consistency.test.ts`
- Create: `src/lib/stats/chiSquareGof.ts`, `src/lib/stats/chiSquareGof.test.ts`
- Create: `src/lib/results/buildChiSquareGof.ts`, `src/lib/results/buildChiSquareGof.test.ts`

- [ ] **Step 1: Registry**

`src/lib/registry/chiSquareGof.ts`:

```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Chi-square goodness-of-fit cards) — display strings verbatim.
export const CHI_SQUARE_GOF: TestSpec = {
  id: 'chi-square-goodness-of-fit',
  name: 'Chi-square goodness-of-fit',
  question: 'do counts match an expected split?',
  roles: [
    { id: 'variable', label: 'Variable', levels: 'nominal / ordinal', arity: 'exactly 1' },
  ],
  options: [
    // Card order: expected proportions first, then α. R1 ruling: custom proportions ship now.
    { id: 'expectedProps', label: 'expected proportions', value: 'equal', kind: 'proportions' },
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'variable', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { min: 2 } },
    ],
    minRule: { kind: 'used-columns', n: 1 },
  },
  tables: [
    { id: 'observed-expected', title: 'Observed vs. expected',
      columns: [{ key: 'category', label: 'Category' }, { key: 'observed', label: 'Observed' }, { key: 'expected', label: 'Expected' }, { key: 'stdres', label: 'Std. residual' }] },
    { id: 'chi-square', title: 'Goodness-of-fit test', domId: 'gof-chi-square', // 'chi-square' also lives on the independence card
      columns: [{ key: 'chisq', label: 'χ²' }, { key: 'df', label: 'df (k−1)' }, { key: 'p', label: 'p' }, { key: 'w', label: "Cohen's w" }] },
  ],
  tableNote: { kind: 'plain', text: 'here df = number of categories − 1 (not (r−1)(c−1) as in the independence test).' },
  figures: [{ caption: 'Observed vs. expected', type: 'bar chart (observed vs. expected)', file: 'bar' }],
  howToRead:
    "Tests whether one categorical variable's counts depart from an expected distribution (equal by default). " +
    'A p below alpha means the observed split differs from expected; a standardized residual beyond about ±1.96 flags ' +
    'a category that significantly drives the result. Valid only when expected counts are mostly ≥ 5 (some texts allow ' +
    '≥ 1 if no more than 20% are below 5); for sparse categories use an exact / simulated test instead.',
  apaTemplate: 'A goodness-of-fit test, χ²({df}, N={n})={chisq}, p={p}, w={w}.',
  rMap: 'chisq.test(x, p=) → Table 2 · chisq.test(...)$stdres → Table 1 std. residuals · effectsize::cohens_w() → w · chisq.test(..., simulate.p.value=TRUE) for sparse data · ggplot2 → figure',
  bundleFiles: ['table_observed-expected.png', 'table_chi-square.png', 'figure_bar.png'],
}
```

- [ ] **Step 2: Consistency test**

`src/lib/registry/chiSquareGof.consistency.test.ts` — numbered captions on this card; scopes: outputs `indexOf('Chi-square goodness-of-fit</span>')` → `indexOf("Fisher's exact</span>")`, inputs `indexOf('<div class="ttl">Chi-square goodness-of-fit</div>')` → `indexOf('<div class="ttl">Fisher\'s exact</div>')`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CHI_SQUARE_GOF as spec } from './chiSquareGof'
import { strip } from './specHtml'

const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Chi-square goodness-of-fit</span>'), outputsHtml.indexOf("Fisher's exact</span>"))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Chi-square goodness-of-fit</div>'), inputsHtml.indexOf('<div class="ttl">Fisher\'s exact</div>'))

describe('chi-square-goodness-of-fit registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences (decoded — χ², k−1)', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => strip(t[1])))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => c.label)))
  })
  it('numbered table captions equal the card captions', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
    expect(spec.tables.every((t) => t.captionStyle === undefined)).toBe(true)
  })
  it('question, plain table note, figure caption + type, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(spec.tableNote).toEqual({ kind: 'plain', text: strip(card.match(/<p class="tbl-note">(.*?)<\/p>/s)![1]) })
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figures![0].caption)
    expect(strip(card.match(/<div class="ftype">(.*?)<\/div>/s)![1])).toBe(`type: ${spec.figures![0].type}`)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('APA line equals the template with {df} as the drawn k−1 and every other {placeholder} as __ (recorded decision 2)', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toBe(`“${spec.apaTemplate.replace('{df}', 'k−1').replace(/\{\w+\}/g, '__')}”`)
  })
  it('bundle line EQUALS bundleFiles, names derive from table ids + figure file slug', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), ...spec.figures!.map((f) => `figure_${f.file ?? f.type}.png`)]).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + constraint lines', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
  })
  it('options equal the inputs card option strip; expected proportions is the proportions kind (R1)', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
    expect(spec.options.map((o) => o.kind)).toEqual(['proportions', 'display'])
  })
})
```

Run + mutation check.

- [ ] **Step 3: Stats module**

`src/lib/stats/chiSquareGof.ts`:

```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface GofRow { category: string; observed: number; expected: number; stdRes: number }
export interface ChiSquareGofResult {
  variable: string
  rows: GofRow[]
  chisq: number; df: number; p: number; w: number; n: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

// props arrive normalized from propsArray (gate enforces |Σ−1| ≤ 0.001); R demands exactness → renormalize (decision 6).
// Spike: effectsize::cohens_w accepts p= custom proportions, identical native/webr (= √(χ²/N)). suppressWarnings:
// sparse-data approximation warnings are expected user territory (the card's own how-to-read covers it).
const R_STATS = String.raw`
tab <- table(v)
pr <- if (use_props) props / sum(props) else rep(1 / length(tab), length(tab))
g <- suppressWarnings(chisq.test(tab, p = pr))
w <- as.numeric(effectsize::cohens_w(tab, p = pr)$Cohens_w)
list(categories = names(tab), observed = as.numeric(tab), expected = as.numeric(g$expected),
     stdres = as.numeric(g$stdres), chisq = unname(g$statistic), df = unname(g$parameter),
     p = g$p.value, w = w, n = sum(tab))`

// Dodged observed-vs-expected bars (card figure: bar chart (observed vs. expected)); house palette.
const R_BAR = String.raw`
tab <- table(v)
pr <- if (use_props) props / sum(props) else rep(1 / length(tab), length(tab))
g <- suppressWarnings(chisq.test(tab, p = pr))
k <- length(tab)
d <- data.frame(category = factor(rep(names(tab), 2), levels = names(tab)),
  kind = factor(rep(c('Observed', 'Expected'), each = k), levels = c('Observed', 'Expected')),
  count = c(as.numeric(tab), as.numeric(g$expected)))
print(ggplot2::ggplot(d, ggplot2::aes(category, count, fill = kind)) +
  ggplot2::geom_col(position = 'dodge', colour = '#0c447c') +
  ggplot2::scale_fill_manual(values = c(Observed = '#9cc2ec', Expected = '#f0efe9')) +
  ggplot2::labs(x = NULL, y = NULL, fill = NULL))`

interface RawStats { categories: string[]; observed: number[]; expected: number[]; stdres: number[]; chisq: number; df: number; p: number; w: number; n: number }

/** props: alphabetical-category-order proportions (custom mode) or null (equal split). */
export async function runChiSquareGof(engine: Engine, data: Dataset, variable: string, props: number[] | null): Promise<ChiSquareGofResult> {
  // Per-test listwise: non-empty value (categorical — numbers allowed, stringified like the column meta does).
  const vals = data.rows.map((r) => r[variable]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '').map(String)
  const nExcluded = data.rows.length - vals.length
  const env = { v: vals, props: props ?? [0], use_props: props !== null }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_BAR, 600, 450, env)
  return { variable,
    rows: s.categories.map((c, i) => ({ category: c, observed: s.observed[i], expected: s.expected[i], stdRes: s.stdres[i] })),
    chisq: s.chisq, df: s.df, p: s.p, w: s.w, n: s.n, nExcluded, figurePng }
}
```

- [ ] **Step 4: Stats known-answer test**

`src/lib/stats/chiSquareGof.test.ts` (harness as Task 4):

```ts
  it('spike known answers — equal proportions on method', async () => {
    const r = await runChiSquareGof(engine, loadAssociationFixture(), 'method', null)
    expect(r.chisq).toBeCloseTo(0.95, 6)
    expect(r.df).toBe(2)
    expect(r.p).toBeCloseTo(0.6218850565, 6)
    expect(r.w).toBeCloseTo(0.1541103501, 6)
    expect(r.rows.map((x) => x.category)).toEqual(['discussion', 'lecture', 'seminar']) // alphabetical = R table() order
    expect(r.rows[0].stdRes).toBeCloseTo(0.894427191, 6)
    expect(r.rows[1].stdRes).toBeCloseTo(-0.1118033989, 6)
    expect(r.rows[2].stdRes).toBeCloseTo(-0.7826237921, 6)
    expect(r.n).toBe(40)
  }, 900_000)

  it('spike known answers — custom proportions 0.5/0.3/0.2 (w computed against the same split)', async () => {
    const r = await runChiSquareGof(engine, loadAssociationFixture(), 'method', [0.5, 0.3, 0.2])
    expect(r.chisq).toBeCloseTo(2.008333333, 6)
    expect(r.p).toBeCloseTo(0.3663497991, 6)
    expect(r.w).toBeCloseTo(0.224072161, 6)
    expect(r.rows[0].expected).toBeCloseTo(20, 6) // 0.5 × 40
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 300_000)
```

- [ ] **Step 5: Builder + test**

`src/lib/results/buildChiSquareGof.ts`:

```ts
import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { ChiSquareGofResult } from '../stats/chiSquareGof'
import type { CardContent } from './builders'
import { f, fdf, fp } from '../format/apa'

export function buildChiSquareGof(spec: TestSpec, r: ChiSquareGofResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{df}', fdf(r.df)) // the drawn "k−1" slot carries the real df at runtime (recorded decision 2)
    .replace('{n}', String(r.n)).replace('{chisq}', f(r.chisq))
    .replace('p={p}', r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`)
    .replace('{w}', f(r.w))
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: r.rows.map((x) => ({ category: x.category, observed: x.observed, expected: f(x.expected), stdres: f(x.stdRes) })) },
      { spec: spec.tables[1], rows: [{ chisq: f(r.chisq), df: fdf(r.df), p: fp(r.p), w: f(r.w) }] },
    ],
    note: spec.tableNote ?? null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
```

`src/lib/results/buildChiSquareGof.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildChiSquareGof } from './buildChiSquareGof'
import { CHI_SQUARE_GOF } from '../registry/chiSquareGof'
import type { ChiSquareGofResult } from '../stats/chiSquareGof'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const res: ChiSquareGofResult = { variable: 'method',
  rows: [
    { category: 'discussion', observed: 18, expected: 20, stdRes: -0.632 },
    { category: 'lecture', observed: 14, expected: 12, stdRes: 0.683 },
    { category: 'seminar', observed: 8, expected: 8, stdRes: 0 },
  ],
  chisq: 0.5333, df: 2, p: 0.7659, w: 0.1155, n: 40, nExcluded: 0, figurePng: png }

describe('buildChiSquareGof', () => {
  it('Table 1 rows (expected 2 dp, stdres 2 dp with U+2212 minus) + Table 2', () => {
    const c = buildChiSquareGof(CHI_SQUARE_GOF, res)
    expect(c.tables[0].rows[0]).toEqual({ category: 'discussion', observed: 18, expected: '20.00', stdres: '−0.63' })
    expect(c.tables[1].rows).toEqual([{ chisq: '0.53', df: '2', p: '.766', w: '0.12' }])
    expect(c.note).toEqual(CHI_SQUARE_GOF.tableNote)
  })
  it('APA renders the real df in the drawn k−1 slot', () => {
    expect(buildChiSquareGof(CHI_SQUARE_GOF, res).apa).toBe('A goodness-of-fit test, χ²(2, N=40)=0.53, p=.766, w=0.12.')
  })
})
```

- [ ] **Step 6: Gates + commit**

`npx tsc -b` → 0; own tests green.

```bash
git add src/lib/registry/chiSquareGof.ts src/lib/registry/chiSquareGof.consistency.test.ts src/lib/stats/chiSquareGof.ts src/lib/stats/chiSquareGof.test.ts src/lib/results/buildChiSquareGof.ts src/lib/results/buildChiSquareGof.test.ts
git commit -m "feat(association): chi-square-goodness-of-fit — registry+consistency, stats (custom props + Cohen's w, spike-verified), builder"
```

---

### Task 8: Chi-square independence [worktree assoc/chi-square-independence]

**Files:**
- Create: `src/lib/registry/chiSquareIndependence.ts`, `src/lib/registry/chiSquareIndependence.consistency.test.ts`
- Create: `src/lib/stats/chiSquareIndependence.ts`, `src/lib/stats/chiSquareIndependence.test.ts`
- Create: `src/lib/results/buildChiSquareIndependence.ts`, `src/lib/results/buildChiSquareIndependence.test.ts`

- [ ] **Step 1: Registry**

`src/lib/registry/chiSquareIndependence.ts`:

```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Chi-square independence cards) — display strings
// verbatim, AFTER the Task-1 amendments (R2: figure_bar.png bundle + ggplot2::geom_bar R map; D1: hand-V R-map entry).
export const CHI_SQUARE_INDEPENDENCE: TestSpec = {
  id: 'chi-square-independence',
  name: 'Chi-square independence',
  question: 'are two categorical variables related?',
  roles: [
    { id: 'rowVar', label: 'Row variable', levels: 'nominal / ordinal', arity: 'exactly 1' },
    { id: 'colVar', label: 'Column variable', levels: 'nominal / ordinal', arity: 'exactly 1' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    // Drawn ON; only effective for 2×2 in R (the card footnote teaches this).
    { id: 'continuity', label: 'continuity correction', value: 'on (2×2)', kind: 'toggle', default: true },
  ],
  constraints: {
    roles: [
      { roleId: 'rowVar', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { min: 2 } },
      { roleId: 'colVar', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { min: 2 } },
    ],
    minRule: { kind: 'used-columns', n: 2 }, // needs two distinct categorical columns
  },
  tables: [
    { id: 'contingency', title: 'Contingency (observed [expected])', domId: 'chi-square-independence-contingency',
      // Drawn placeholders; the builder replaces them with one column per category + Total (frequencies' sanctioned divergence).
      columns: [{ key: 'rowcat', label: 'Row \\ Column' }, { key: 'c0', label: 'Col 1' }, { key: 'c1', label: 'Col 2' }, { key: 'more', label: '…' }, { key: 'total', label: 'Total' }] },
    { id: 'chi-square', title: 'Chi-square test', domId: 'chi-square-independence-chi-square',
      columns: [{ key: 'chisq', label: 'χ²' }, { key: 'df', label: 'df' }, { key: 'p', label: 'p' }, { key: 'v', label: "Cramér's V" }] },
  ],
  tableNote: { kind: 'plain', text:
    "the contingency table is r×c — columns expand to the number of categories in the column variable; expected counts and row/column percentages are shown, with a warning (suggesting Fisher's exact) if expected counts are too small. For 2×2 tables chisq.test() applies Yates' continuity correction by default (set correct=FALSE for the uncorrected χ²)." },
  figures: [{ caption: 'Cross-classification', type: 'mosaic or grouped bar chart', file: 'bar' }],
  howToRead:
    'Tests whether two categorical variables are associated. A p below alpha means they are related; ' +
    "Cramér's V gives the strength of association (0–1). Valid only when expected counts are mostly ≥ 5 " +
    "(the app flags this and suggests Fisher's exact) and each case appears once (raw counts, not percentages).",
  apaTemplate: 'A chi-square test of independence was significant, χ²({df}, N={n})={chisq}, p={p}, V={v}.',
  rMap: 'chisq.test() → Table 2 · sqrt(χ²/(N·min(r−1,c−1))) (matches rcompanion::cramerV) → V · ggplot2::geom_bar() → figure',
  bundleFiles: ['table_contingency.png', 'table_chi-square.png', 'figure_bar.png'],
}
```

- [ ] **Step 2: Consistency test**

`src/lib/registry/chiSquareIndependence.consistency.test.ts` — Task 7's shape with: outputs scope `indexOf('Chi-square independence</span>')` → `indexOf('Chi-square goodness-of-fit</span>')`; inputs scope `indexOf('<div class="ttl">Chi-square independence</div>')` → `indexOf('<div class="ttl">Spearman correlation</div>')`; numbered captions; theads decoded with `strip()` per cell ('Row \ Column' arrives as `Row \ Column` — note the registry label is `'Row \\ Column'`, one backslash in the string); the APA assertion is the plain all-`__` form (no k−1 on this card); options assertion expects kinds `['display', 'toggle']` and `spec.options[1]).toMatchObject({ id: 'continuity', default: true })`. Run + mutation check.

- [ ] **Step 3: Stats module**

`src/lib/stats/chiSquareIndependence.ts`:

```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface ContingencyData {
  rowCats: string[]; colCats: string[]
  counts: number[][]           // (R+1) × (C+1) — margins included (addmargins order)
  expected: number[][]; rowPct: number[][]; colPct: number[][] // R × C
}
export interface ChiSquareIndependenceResult extends ContingencyData {
  rowVar: string; colVar: string
  chisq: number; df: number; p: number; v: number; minExpected: number; n: number
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

// Spike verdict (spec D1 fallback): rcompanion cannot load under webr (rootSolve lacks a wasm binary).
// Hand V on the UNCORRECTED χ² reproduces rcompanion::cramerV's native default exactly (the Yates-corrected
// value does NOT match) — V stays convention-stable while the test's own χ² follows the continuity toggle.
const R_STATS = String.raw`
tab <- table(rv, cv)
g <- suppressWarnings(chisq.test(tab, correct = continuity))
rp <- prop.table(tab, 1) * 100; cp <- prop.table(tab, 2) * 100
m <- addmargins(tab)
v <- sqrt(unname(suppressWarnings(chisq.test(tab, correct = FALSE))$statistic) / (sum(tab) * (min(dim(tab)) - 1)))
list(rowCats = rownames(tab), colCats = colnames(tab),
     counts = lapply(seq_len(nrow(m)), function(i) as.numeric(m[i, ])),
     expected = lapply(seq_len(nrow(tab)), function(i) as.numeric(g$expected[i, ])),
     rowPct = lapply(seq_len(nrow(tab)), function(i) as.numeric(rp[i, ])),
     colPct = lapply(seq_len(nrow(tab)), function(i) as.numeric(cp[i, ])),
     chisq = unname(g$statistic), df = unname(g$parameter), p = g$p.value,
     v = v, minExpected = min(g$expected), n = sum(tab))`

// Grouped (dodged) bar — frequencies-crosstabs styling.
const R_GROUPED_BAR = String.raw`
d <- data.frame(rv = factor(rv), cv = factor(cv))
print(ggplot2::ggplot(d, ggplot2::aes(rv, fill = cv)) +
  ggplot2::geom_bar(position = 'dodge', colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL, fill = NULL))`

interface RawStats extends ContingencyData { chisq: number; df: number; p: number; v: number; minExpected: number; n: number }

export async function runChiSquareIndependence(engine: Engine, data: Dataset, rowVar: string, colVar: string,
  continuity: boolean): Promise<ChiSquareIndependenceResult> {
  const rows = data.rows.filter((r) =>
    r[rowVar] !== null && r[rowVar] !== undefined && String(r[rowVar]).trim() !== ''
    && r[colVar] !== null && r[colVar] !== undefined && String(r[colVar]).trim() !== '')
  const nExcluded = data.rows.length - rows.length
  const env = { rv: rows.map((r) => String(r[rowVar])), cv: rows.map((r) => String(r[colVar])), continuity }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_GROUPED_BAR, 600, 450, env)
  return { rowVar, colVar, ...s, nExcluded, figurePng }
}
```

- [ ] **Step 4: Stats known-answer test**

`src/lib/stats/chiSquareIndependence.test.ts` (harness as Task 4):

```ts
  it('spike known answers — 2×2 passed × gender, correction ON (Yates default)', async () => {
    const r = await runChiSquareIndependence(engine, loadAssociationFixture(), 'passed', 'gender', true)
    expect(r.chisq).toBeCloseTo(3.609022556, 6)
    expect(r.df).toBe(1)
    expect(r.p).toBeCloseTo(0.05746688583, 6)
    expect(r.v).toBeCloseTo(0.350438322, 6) // hand V on the UNCORRECTED χ² ≡ rcompanion native default
    expect(r.rowCats).toEqual(['no', 'yes'])
    expect(r.colCats).toEqual(['female', 'male'])
    expect(r.counts.at(-1)!.at(-1)).toBe(40) // grand total margin
    expect(r.n).toBe(40)
  }, 900_000)

  it('spike known answers — 2×2 correction OFF', async () => {
    const r = await runChiSquareIndependence(engine, loadAssociationFixture(), 'passed', 'gender', false)
    expect(r.chisq).toBeCloseTo(4.912280702, 6)
    expect(r.p).toBeCloseTo(0.02666640835, 6)
  }, 300_000)

  it('spike known answers — 3×2 method × passed (correction inert for non-2×2)', async () => {
    const r = await runChiSquareIndependence(engine, loadAssociationFixture(), 'method', 'passed', true)
    expect(r.chisq).toBeCloseTo(4.903517535, 6)
    expect(r.df).toBe(2)
    expect(r.p).toBeCloseTo(0.08614194953, 6)
    expect(r.v).toBeCloseTo(0.3501256037, 6)
    expect(r.minExpected).toBeCloseTo(5.225, 6)
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 300_000)
```

- [ ] **Step 5: Builder + test**

`src/lib/results/buildChiSquareIndependence.ts`:

```ts
import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { ChiSquareIndependenceResult } from '../stats/chiSquareIndependence'
import type { CardContent } from './builders'
import { f, f1, fdf, fp } from '../format/apa'

const pc = (x: number) => x.toFixed(1) // percentages at 1 dp (frequencies precedent)

export function buildChiSquareIndependence(spec: TestSpec, r: ChiSquareIndependenceResult): CardContent {
  // The sanctioned divergence (frequencies precedent): drawn Col 1/Col 2/… placeholders become one column
  // per category of the column variable + Total. Cell = obs [exp] (row% / col%) — recorded decision 4.
  const columns = [{ key: 'rowcat', label: 'Row \\ Column' },
    ...r.colCats.map((cat, j) => ({ key: `c${j}`, label: cat })), { key: 'total', label: 'Total' }]
  const R = r.rowCats.length, C = r.colCats.length
  const cell = (i: number, j: number) =>
    `${r.counts[i][j]} [${f(r.expected[i][j])}] (${pc(r.rowPct[i][j])}% / ${pc(r.colPct[i][j])}%)`
  const bodyRows = r.rowCats.map((cat, i) => {
    const row: Record<string, string | number> = { rowcat: cat, total: String(r.counts[i][C]) }
    r.colCats.forEach((_, j) => { row[`c${j}`] = cell(i, j) })
    return row
  })
  const totalRow: Record<string, string | number> = { rowcat: 'Total', total: String(r.counts[R][C]) }
  r.colCats.forEach((_, j) => { totalRow[`c${j}`] = String(r.counts[R][j]) })

  // Dynamic small-expected warning appended to the drawn note (the note itself promises this warning) — decision 5.
  const warn = r.minExpected < 5 ? ` Smallest expected count here is ${f1(r.minExpected)} — consider Fisher's exact test.` : ''
  const apa = spec.apaTemplate
    .replace('{df}', fdf(r.df)).replace('{n}', String(r.n)).replace('{chisq}', f(r.chisq))
    .replace('p={p}', r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`)
    .replace('{v}', f(r.v))
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: { ...spec.tables[0], columns }, rows: [...bodyRows, totalRow] },
      { spec: spec.tables[1], rows: [{ chisq: f(r.chisq), df: fdf(r.df), p: fp(r.p), v: f(r.v) }] },
    ],
    note: spec.tableNote ? { ...spec.tableNote, text: spec.tableNote.text + warn } : null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
```

`src/lib/results/buildChiSquareIndependence.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildChiSquareIndependence } from './buildChiSquareIndependence'
import { CHI_SQUARE_INDEPENDENCE } from '../registry/chiSquareIndependence'
import type { ChiSquareIndependenceResult } from '../stats/chiSquareIndependence'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const res: ChiSquareIndependenceResult = { rowVar: 'passed', colVar: 'gender',
  rowCats: ['no', 'yes'], colCats: ['female', 'male'],
  counts: [[8, 10, 18], [12, 10, 22], [20, 20, 40]],
  expected: [[9, 9], [11, 11]], rowPct: [[44.444, 55.556], [54.545, 45.455]], colPct: [[40, 50], [60, 50]],
  chisq: 0.2020, df: 1, p: 0.6531, v: 0.1005, minExpected: 9, n: 40, nExcluded: 0, figurePng: png }

describe('buildChiSquareIndependence', () => {
  it('contingency expands columns; cell = obs [exp] (row% / col%); margins plain', () => {
    const c = buildChiSquareIndependence(CHI_SQUARE_INDEPENDENCE, res)
    expect(c.tables[0].spec.columns.map((x) => x.label)).toEqual(['Row \\ Column', 'female', 'male', 'Total'])
    expect(c.tables[0].rows[0]).toEqual({ rowcat: 'no', c0: '8 [9.00] (44.4% / 40.0%)', c1: '10 [9.00] (55.6% / 50.0%)', total: '18' })
    expect(c.tables[0].rows[2]).toEqual({ rowcat: 'Total', c0: '20', c1: '20', total: '40' })
    expect(c.tables[1].rows).toEqual([{ chisq: '0.20', df: '1', p: '.653', v: '0.10' }])
  })
  it('min expected ≥ 5 → drawn note verbatim, no warning appended', () => {
    const c = buildChiSquareIndependence(CHI_SQUARE_INDEPENDENCE, res)
    expect(c.note!.text).toBe(CHI_SQUARE_INDEPENDENCE.tableNote!.text)
  })
  it('min expected < 5 → warning sentence appended (decision 5)', () => {
    const c = buildChiSquareIndependence(CHI_SQUARE_INDEPENDENCE, { ...res, minExpected: 3.2 })
    expect(c.note!.text).toBe(CHI_SQUARE_INDEPENDENCE.tableNote!.text + " Smallest expected count here is 3.2 — consider Fisher's exact test.")
  })
  it('APA keeps the card-literal wording with real values', () => {
    expect(buildChiSquareIndependence(CHI_SQUARE_INDEPENDENCE, res).apa)
      .toBe('A chi-square test of independence was significant, χ²(1, N=40)=0.20, p=.653, V=0.10.')
  })
})
```

- [ ] **Step 6: Gates + commit**

`npx tsc -b` → 0; own tests green.

```bash
git add src/lib/registry/chiSquareIndependence.ts src/lib/registry/chiSquareIndependence.consistency.test.ts src/lib/stats/chiSquareIndependence.ts src/lib/stats/chiSquareIndependence.test.ts src/lib/results/buildChiSquareIndependence.ts src/lib/results/buildChiSquareIndependence.test.ts
git commit -m "feat(association): chi-square-independence — registry+consistency, stats (Yates toggle + Cramér's V, spike-verified), builder"
```

---

### Task 9: Fisher's exact [worktree assoc/fishers-exact]

**Files:**
- Create: `src/lib/registry/fishersExact.ts`, `src/lib/registry/fishersExact.consistency.test.ts`
- Create: `src/lib/stats/fishersExact.ts`, `src/lib/stats/fishersExact.test.ts`
- Create: `src/lib/results/buildFishersExact.ts`, `src/lib/results/buildFishersExact.test.ts`

- [ ] **Step 1: Registry**

`src/lib/registry/fishersExact.ts`:

```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (Fisher's exact cards) — display strings
// verbatim, AFTER the Task-1 R2 amendment (figure_bar.png bundle + ggplot2::geom_bar R map).
export const FISHERS_EXACT: TestSpec = {
  id: 'fishers-exact',
  name: "Fisher's exact",
  question: 'exact test for small categorical tables',
  roles: [
    { id: 'rowVar', label: 'Row variable', levels: 'nominal / ordinal', arity: 'exactly 1' },
    { id: 'colVar', label: 'Column variable', levels: 'nominal / ordinal', arity: 'exactly 1' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'tails', label: 'tails', value: 'two', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'rowVar', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { min: 2 } },
      { roleId: 'colVar', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { min: 2 } },
    ],
    minRule: { kind: 'used-columns', n: 2 },
  },
  tables: [
    { id: 'contingency', title: 'Contingency', domId: 'fishers-exact-contingency',
      columns: [{ key: 'rowcat', label: 'Row \\ Column' }, { key: 'c0', label: 'Col 1' }, { key: 'c1', label: 'Col 2' }, { key: 'total', label: 'Total' }] },
    { id: 'fisher', title: "Fisher's exact test",
      columns: [{ key: 'p', label: 'p (exact)' }, { key: 'or', label: 'Odds ratio' }, { key: 'ci', label: '95% CI' }] },
  ],
  tableNote: { kind: 'plain', text: 'odds ratio & CI are reported for 2×2 tables only; larger tables report the exact p only.' },
  figures: [{ caption: 'Cross-classification', type: 'mosaic / grouped bar chart', file: 'bar' }],
  howToRead:
    'An exact alternative to chi-square for small samples. A p below alpha means the two categories are associated; ' +
    'for 2×2 tables the odds ratio quantifies the association — OR>1 means the outcome is more likely in the first ' +
    'row/group, OR<1 less likely, OR=1 no association. Check the row/column order before reading direction, ' +
    "since the OR reflects the table's orientation.",
  apaTemplate: "A Fisher's exact test of [Var1] by [Var2] gave p={p}.",
  rMap: 'fisher.test() → Table 2 · ggplot2::geom_bar() → figure',
  bundleFiles: ['table_contingency.png', 'table_fisher.png', 'figure_bar.png'],
}
```

- [ ] **Step 2: Consistency test**

`src/lib/registry/fishersExact.consistency.test.ts` — Task 8's shape with: outputs scope `indexOf("Fisher's exact</span>")` → `indexOf('4 · Regression')`; inputs scope `indexOf('<div class="ttl">Fisher\'s exact</div>')` → `indexOf('<div class="ttl">Multiple linear regression</div>')`; numbered captions; the APA assertion handles this card's composite line (recorded decision 3):

```ts
  it('APA line contains the base template (placeholders as __) AND the 2×2 add-on fragment', () => {
    const line = strip(card.match(/<b>APA template:<\/b>(.*?)<\/div>/s)![1])
    expect(line).toContain(`“${spec.apaTemplate.replace(/\{\w+\}/g, '__')}”`)
    expect(line).toContain('“(OR=__, 95% CI [__, __])”')
  })
```

Options assertion: both `display`. Run + mutation check.

- [ ] **Step 3: Stats module**

`src/lib/stats/fishersExact.ts`:

```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface FishersExactResult {
  rowVar: string; colVar: string
  rowCats: string[]; colCats: string[]
  counts: number[][]            // (R+1) × (C+1) with margins
  p: number; is2x2: boolean
  or?: number; ciLow?: number; ciHigh?: number // 2×2 only
  n: number; nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

const R_STATS = String.raw`
tab <- table(rv, cv)
ft <- fisher.test(tab)
is22 <- all(dim(tab) == 2)
m <- addmargins(tab)
c(list(rowCats = rownames(tab), colCats = colnames(tab),
       counts = lapply(seq_len(nrow(m)), function(i) as.numeric(m[i, ])),
       p = ft$p.value, is2x2 = is22, n = sum(tab)),
  if (is22) list(or = unname(ft$estimate), ciLow = ft$conf.int[1], ciHigh = ft$conf.int[2]))`

const R_GROUPED_BAR = String.raw`
d <- data.frame(rv = factor(rv), cv = factor(cv))
print(ggplot2::ggplot(d, ggplot2::aes(rv, fill = cv)) +
  ggplot2::geom_bar(position = 'dodge', colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL, fill = NULL))`

interface RawStats { rowCats: string[]; colCats: string[]; counts: number[][]; p: number; is2x2: boolean; n: number; or?: number; ciLow?: number; ciHigh?: number }

export async function runFishersExact(engine: Engine, data: Dataset, rowVar: string, colVar: string): Promise<FishersExactResult> {
  const rows = data.rows.filter((r) =>
    r[rowVar] !== null && r[rowVar] !== undefined && String(r[rowVar]).trim() !== ''
    && r[colVar] !== null && r[colVar] !== undefined && String(r[colVar]).trim() !== '')
  const nExcluded = data.rows.length - rows.length
  const env = { rv: rows.map((r) => String(r[rowVar])), cv: rows.map((r) => String(r[colVar])) }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_GROUPED_BAR, 600, 450, env)
  return { rowVar, colVar, ...s, nExcluded, figurePng }
}
```

- [ ] **Step 4: Stats known-answer test**

`src/lib/stats/fishersExact.test.ts` (harness as Task 4):

```ts
  it('spike known answers — 2×2 passed × gender (p, OR, CI)', async () => {
    const r = await runFishersExact(engine, loadAssociationFixture(), 'passed', 'gender')
    expect(r.p).toBeCloseTo(0.05616092643, 6)
    expect(r.is2x2).toBe(true)
    expect(r.or).toBeCloseTo(4.163405972, 6)
    expect(r.ciLow).toBeCloseTo(0.9694478355, 6)
    expect(r.ciHigh).toBeCloseTo(20.18251251, 5)
    expect(r.counts.at(-1)!.at(-1)).toBe(40)
    expect(r.n).toBe(40)
  }, 900_000)

  it('spike known answers — 3×3 method × grade_band (exact p only)', async () => {
    const r = await runFishersExact(engine, loadAssociationFixture(), 'method', 'grade_band')
    expect(r.p).toBeCloseTo(0.5354022782, 6)
    expect(r.is2x2).toBe(false)
    expect(r.or).toBeUndefined()
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  }, 300_000)
```

- [ ] **Step 5: Builder + test**

`src/lib/results/buildFishersExact.ts`:

```ts
import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { FishersExactResult } from '../stats/fishersExact'
import type { CardContent } from './builders'
import { f, fp } from '../format/apa'

export function buildFishersExact(spec: TestSpec, r: FishersExactResult): CardContent {
  const columns = [{ key: 'rowcat', label: 'Row \\ Column' },
    ...r.colCats.map((cat, j) => ({ key: `c${j}`, label: cat })), { key: 'total', label: 'Total' }]
  const R = r.rowCats.length, C = r.colCats.length
  const bodyRows = r.rowCats.map((cat, i) => {
    const row: Record<string, string | number> = { rowcat: cat, total: String(r.counts[i][C]) }
    r.colCats.forEach((_, j) => { row[`c${j}`] = String(r.counts[i][j]) }) // plain counts (recorded decision 4)
    return row
  })
  const totalRow: Record<string, string | number> = { rowcat: 'Total', total: String(r.counts[R][C]) }
  r.colCats.forEach((_, j) => { totalRow[`c${j}`] = String(r.counts[R][j]) })

  const pStr = r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`
  // 2×2: the card's add-on slots in before the period (recorded decision 3); larger tables: base sentence only.
  const base = spec.apaTemplate.replace('[Var1]', r.rowVar).replace('[Var2]', r.colVar).replace('p={p}', pStr)
  const apa = r.is2x2
    ? base.replace(/\.$/, ` (OR=${f(r.or!)}, 95% CI [${f(r.ciLow!)}, ${f(r.ciHigh!)}]).`)
    : base
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: { ...spec.tables[0], columns }, rows: [...bodyRows, totalRow] },
      { spec: spec.tables[1], rows: [r.is2x2
        ? { p: fp(r.p), or: f(r.or!), ci: `[${f(r.ciLow!)}, ${f(r.ciHigh!)}]` }
        : { p: fp(r.p), or: '—', ci: '—' }] },
    ],
    note: spec.tableNote ?? null,
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
```

`src/lib/results/buildFishersExact.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildFishersExact } from './buildFishersExact'
import { FISHERS_EXACT } from '../registry/fishersExact'
import type { FishersExactResult } from '../stats/fishersExact'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]) as Uint8Array<ArrayBuffer>
const base: FishersExactResult = { rowVar: 'passed', colVar: 'gender',
  rowCats: ['no', 'yes'], colCats: ['female', 'male'],
  counts: [[8, 10, 18], [12, 10, 22], [20, 20, 40]],
  p: 0.7508, is2x2: true, or: 0.6712, ciLow: 0.1612, ciHigh: 2.7344, n: 40, nExcluded: 0, figurePng: png }

describe('buildFishersExact', () => {
  it('2×2 → OR + CI cells and the APA add-on before the period', () => {
    const c = buildFishersExact(FISHERS_EXACT, base)
    expect(c.tables[1].rows).toEqual([{ p: '.751', or: '0.67', ci: '[0.16, 2.73]' }])
    expect(c.apa).toBe("A Fisher's exact test of passed by gender gave p=.751 (OR=0.67, 95% CI [0.16, 2.73]).")
  })
  it('non-2×2 → em-dash OR/CI cells, base APA only', () => {
    const c = buildFishersExact(FISHERS_EXACT, { ...base, is2x2: false, or: undefined, ciLow: undefined, ciHigh: undefined, p: 0.0834 })
    expect(c.tables[1].rows).toEqual([{ p: '.083', or: '—', ci: '—' }])
    expect(c.apa).toBe("A Fisher's exact test of passed by gender gave p=.083.")
  })
  it('contingency cells are plain counts with margins', () => {
    const c = buildFishersExact(FISHERS_EXACT, base)
    expect(c.tables[0].rows[0]).toEqual({ rowcat: 'no', c0: '8', c1: '10', total: '18' })
    expect(c.tables[0].rows[2]).toEqual({ rowcat: 'Total', c0: '20', c1: '20', total: '40' })
  })
})
```

- [ ] **Step 6: Gates + commit**

`npx tsc -b` → 0; own tests green.

```bash
git add src/lib/registry/fishersExact.ts src/lib/registry/fishersExact.consistency.test.ts src/lib/stats/fishersExact.ts src/lib/stats/fishersExact.test.ts src/lib/results/buildFishersExact.ts src/lib/results/buildFishersExact.test.ts
git commit -m "feat(association): fishers-exact — registry+consistency, stats (2×2 OR/CI + r×c exact p, spike-verified), builder"
```

---

### Task 10: Integration [serial, main]

**Files:**
- Modify: `src/lib/registry/catalog.ts` (6 entries → available; SPECS map)
- Modify: `src/lib/results/builders.ts` (6 RUNNERS + 6 BUILDERS)
- Modify: `src/lib/registry/catalog.consistency.test.ts` (available list + association figure-name assertion)

- [ ] **Step 1: Merge the six worktree branches**

```bash
git merge assoc/pearson assoc/spearman assoc/kendalls-tau assoc/chi-square-goodness-of-fit assoc/chi-square-independence assoc/fishers-exact
git worktree remove ../telos-wt-pearson  # …and the other five
git branch -d assoc/pearson assoc/spearman assoc/kendalls-tau assoc/chi-square-goodness-of-fit assoc/chi-square-independence assoc/fishers-exact
```

(Each branch touches only its own new files — merges must be clean; if not, STOP and inspect.)

- [ ] **Step 2: Catalog flip + SPECS**

`src/lib/registry/catalog.ts` — the six `e()` entries gain `'available'`:

```ts
  e('pearson', 'Pearson', 'Association', 'Correlation', 'available'),
  e('spearman', 'Spearman', 'Association', 'Correlation', 'available'),
  e('kendalls-tau', "Kendall's tau", 'Association', 'Correlation', 'available'),
  e('chi-square-independence', 'Chi-square independence', 'Association', 'Categorical', 'available'),
  e('chi-square-goodness-of-fit', 'Chi-square goodness-of-fit', 'Association', 'Categorical', 'available'),
  e('fishers-exact', "Fisher's exact", 'Association', 'Categorical', 'available'),
```

and the SPECS map gains (imports at top, entries in catalog order):

```ts
import { PEARSON } from './pearson'
import { SPEARMAN } from './spearman'
import { KENDALLS_TAU } from './kendallsTau'
import { CHI_SQUARE_INDEPENDENCE } from './chiSquareIndependence'
import { CHI_SQUARE_GOF } from './chiSquareGof'
import { FISHERS_EXACT } from './fishersExact'
…
  'pearson': PEARSON, 'spearman': SPEARMAN, 'kendalls-tau': KENDALLS_TAU,
  'chi-square-independence': CHI_SQUARE_INDEPENDENCE, 'chi-square-goodness-of-fit': CHI_SQUARE_GOF,
  'fishers-exact': FISHERS_EXACT,
```

- [ ] **Step 3: RUNNERS + BUILDERS**

`src/lib/results/builders.ts` (imports follow the existing block style; `categoriesOf`/`propsArray` from `../data/props` — value imports are safe there, no session cycle):

```ts
import { runPearson, type PearsonResult } from '../stats/pearson'
import { buildPearson } from './buildPearson'
import { runSpearman, type SpearmanResult } from '../stats/spearman'
import { buildSpearman } from './buildSpearman'
import { runKendallsTau, type KendallsTauResult } from '../stats/kendallsTau'
import { buildKendallsTau } from './buildKendallsTau'
import { runChiSquareGof, type ChiSquareGofResult } from '../stats/chiSquareGof'
import { buildChiSquareGof } from './buildChiSquareGof'
import { runChiSquareIndependence, type ChiSquareIndependenceResult } from '../stats/chiSquareIndependence'
import { buildChiSquareIndependence } from './buildChiSquareIndependence'
import { runFishersExact, type FishersExactResult } from '../stats/fishersExact'
import { buildFishersExact } from './buildFishersExact'
import { categoriesOf, propsArray } from '../data/props'
```

RUNNERS entries:

```ts
  'pearson': (engine, ds, setup) => runPearson(engine, ds, setup.roles['variableA'][0], setup.roles['variableB'][0]),
  'spearman': (engine, ds, setup) => runSpearman(engine, ds, setup.roles['variableA'][0], setup.roles['variableB'][0]),
  'kendalls-tau': (engine, ds, setup) => runKendallsTau(engine, ds, setup.roles['variableA'][0], setup.roles['variableB'][0]),
  'chi-square-goodness-of-fit': (engine, ds, setup) => {
    const v = setup.roles['variable'][0]
    const custom = setup.options['expectedProps'] === 'custom'
    return runChiSquareGof(engine, ds, v, custom ? propsArray(categoriesOf(ds, v), setup.props) : null)
  },
  'chi-square-independence': (engine, ds, setup) =>
    runChiSquareIndependence(engine, ds, setup.roles['rowVar'][0], setup.roles['colVar'][0], setup.options['continuity'] as boolean),
  'fishers-exact': (engine, ds, setup) => runFishersExact(engine, ds, setup.roles['rowVar'][0], setup.roles['colVar'][0]),
```

BUILDERS entries:

```ts
  'pearson': (spec, result) => buildPearson(spec, result as PearsonResult),
  'spearman': (spec, result) => buildSpearman(spec, result as SpearmanResult),
  'kendalls-tau': (spec, result) => buildKendallsTau(spec, result as KendallsTauResult),
  'chi-square-goodness-of-fit': (spec, result) => buildChiSquareGof(spec, result as ChiSquareGofResult),
  'chi-square-independence': (spec, result) => buildChiSquareIndependence(spec, result as ChiSquareIndependenceResult),
  'fishers-exact': (spec, result) => buildFishersExact(spec, result as FishersExactResult),
```

- [ ] **Step 4: catalog.consistency.test.ts**

1. The available-ids assertion gains, after `'friedman'`: `'pearson', 'spearman', 'kendalls-tau', 'chi-square-independence', 'chi-square-goodness-of-fit', 'fishers-exact'`.
2. New assertion alongside the ANOVA figure-name one:

```ts
  it('Association-family zip figure names derive from FigureSpec.file ?? type and equal the card bundle entries', () => {
    for (const id of ['pearson', 'spearman', 'kendalls-tau', 'chi-square-independence', 'chi-square-goodness-of-fit', 'fishers-exact']) {
      const s = SPECS[id]!
      expect(s.figures!.map((f) => `figure_${f.file ?? f.type}.png`)).toEqual(s.bundleFiles.filter((b) => b.startsWith('figure_')))
    }
  })
```

(The existing DOM-id uniqueness test now covers the six new registries automatically — it must stay green.)

- [ ] **Step 5: Full gates (FOREGROUND, long timeouts)**

Run: `npx tsc -b` → 0. Run: `npm test` (full serialized suite, expect ~15 min) → ALL green. Run: `npm run build` → green. Run: `npx playwright test` → existing e2e green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/registry/catalog.ts src/lib/results/builders.ts src/lib/registry/catalog.consistency.test.ts
git commit -m "feat(association): integrate 6 tests — catalog available, runners+builders registered, figure-name + domId assertions"
```

---

### Task 11: E2E journey [serial, main]

**Files:**
- Create: `tests/e2e/association.spec.ts`
- (Fixture `tests/e2e/fixtures/association.csv` landed in Task 3.)

- [ ] **Step 1: Write the journey**

`tests/e2e/association.spec.ts` — copy the module-local helpers (`dragChip`, `configureStep`, `runAnalysis`) byte-identical from `tests/e2e/anova.spec.ts` (established convention). One test:

1. Upload `tests/e2e/fixtures/association.csv`; Terms guide → Continue.
2. Configure data: numerics default ratio, strings nominal — set `satisfaction` and `motivation` to **ordinal** via their level selects (copy the level-edit interaction from `flow.spec.ts`). Confirm.
3. Pick (catalog order): Pearson, Spearman, Kendall's tau, Chi-square independence, Chi-square goodness-of-fit, Fisher's exact. Confirm selection.
4. Configure, using the Next button between configs:
   - Pearson: hours_studied → variableA, exam_score → variableB.
   - Spearman: satisfaction → variableA, motivation → variableB.
   - Kendall: satisfaction → variableA, motivation → variableB.
   - Independence: method → rowVar, passed → colVar (continuity toggle stays drawn-on).
   - GoF: method → variable; set `expected proportions` select to `custom`; **gate check:** type 0.5 into `proportion: discussion`, 0.5 into `proportion: lecture`, 0.5 into `proportion: seminar` → expect Run disabled + hint `custom proportions must sum to 1 to enable Run`; then fix to 0.5 / 0.3 / 0.2 → Run enabled.
   - Fisher: passed → rowVar, gender → colVar.
5. Run; wait for Download enabled (timeout 360_000).
6. Assert (formatted spike values through the `f`/`fp`/`fdf` conventions):
   - `#table-pearson-correlation` contains `0.70`, `6.07`, `38`, `<.001`; APA line visible: `hours_studied and exam_score were correlated, r(38)=0.70, p<.001, 95% CI [0.50, 0.83].`
   - `#table-spearman-correlation` contains `0.85`, `1632.68`, `<.001` (tied pair); `#table-kendalls-tau-correlation` contains `0.75`, `5.71`, `<.001`.
   - `#table-chi-square-independence-chi-square` contains `4.90`, `.086`, `0.35` (3×2); `#table-chi-square-independence-contingency` contains `[` (expected counts present) and a `Total` row.
   - `#table-gof-chi-square` contains `2.01`, `.366`, `0.22` — the CUSTOM-proportions numbers, proof the typed split reached R (equal-split would read `0.95`/`.622`/`0.15`); `#table-observed-expected` shows expected `20.00` for discussion (0.5 × 40).
   - `#table-fishers-exact-contingency` present; the Fisher table shows `.056`, `4.16`, `[0.97, 20.18]`; Fisher APA contains `(OR=4.16, 95% CI [0.97, 20.18])`.
7. Download with Table images + Figure images checked; unzip (fflate) and assert the exact path set: `01_pearson/table_correlation.png`, `01_pearson/figure_scatter.png`, `02_spearman/…`, `03_kendalls-tau/…`, `04_chi-square-independence/table_contingency.png`, `04_chi-square-independence/table_chi-square.png`, `04_chi-square-independence/figure_bar.png`, `05_chi-square-goodness-of-fit/table_observed-expected.png`, `05_chi-square-goodness-of-fit/table_chi-square.png`, `05_chi-square-goodness-of-fit/figure_bar.png`, `06_fishers-exact/table_contingency.png`, `06_fishers-exact/table_fisher.png`, `06_fishers-exact/figure_bar.png` (mirror the anova.spec.ts unzip assertion style; NN = selection order).

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/association.spec.ts` (FOREGROUND, long timeout) → green. Then the FULL e2e suite: `npx playwright test` → all green.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/association.spec.ts
git commit -m "test(association): e2e journey — 6 tests incl. custom-props gate + 13-file zip with card-faithful names"
```

---

### Task 12: Combined slice-end review [serial, main]

- [ ] **Step 1: Dispatch ONE opus reviewer over the whole slice diff** (`git diff BASE..HEAD`), with the spec + this plan as context. Brief: (a) card-faithfulness — every registry string vs the live spec HTML; (b) statistical correctness — independently recompute each test's headline numbers in native R 4.6.0 from `tests/e2e/fixtures/association.csv` (including the custom-props GoF and Cramér's V convention); (c) the spec §3 recorded conventions honored; (d) code quality / dead code / type safety; (e) the proportions UI spot-check (drive `npm run preview` with Playwright: inputs appear on drop, reset path, sum gate, values reach R).
- [ ] **Step 2: Triage findings** — fix blockers/majors, record minors for the ratify list. Re-run full gates after any fix (`npx tsc -b`, `npm test`, `npm run build`, `npx playwright test`).
- [ ] **Step 3: Commit fixes** (if any): `fix(association): slice-end review findings — <summary>`

---

### Task 13: Finalize — README, ROADMAP, screenshots, STOP at Benjie's gate [serial, main]

- [ ] **Step 1: README** — live-test count 19 → 25 (47-card tree unchanged); update the file/test counts to the REAL totals at this commit (`git ls-files src tests | wc -l` for files; the vitest summary line for tests — "real total" instruction, core-slice precedent).
- [ ] **Step 2: ROADMAP** — move the Association row to Done: `| Association — 6 tests live (Pearson, Spearman, Kendall's tau, χ² independence, χ² goodness-of-fit incl. custom expected proportions (R1), Fisher's exact); proportions option kind | 2026-06-12 | specs+plans/2026-06-12-telos-association-family*, spike reviews/2026-06-12-association-spike-report.md |` and drop slice 1 from Remaining (renumber).
- [ ] **Step 3: Screenshots** — refresh `.superpowers/screens/`: pick-tests (25 live), test-config-gof-custom-props (custom inputs + Σ readout visible), results-association-multi (6-card page). Drive the production preview (`npm run build && npm run preview`) with Playwright; visually verify each shot before claiming it.
- [ ] **Step 4: Final gates ×2** — `npx tsc -b` 0 · full `npm test` green · `npm run build` green · `npx playwright test` green TWICE consecutively. Fresh-clone proof: clone to /tmp, `npm install` (postinstall VFS copy), `npm test`, `npm run build`, then delete.
- [ ] **Step 5: Commit** — `docs(association): README 47 tree / 25 live, real counts; ROADMAP Association slice done`
- [ ] **Step 6: STOP.** Report to Benjie: gates evidence, screenshots, the updated ratify list (slice decisions 1–7 above + anything from the review), and the preview URL for his click-through. **DO NOT push. DO NOT deploy.**
