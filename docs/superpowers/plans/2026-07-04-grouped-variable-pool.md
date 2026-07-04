# Grouped Variable Pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the "Your columns" drag pool into four fixed measurement-level shelves with two-tier compatibility, tag badges, an assigned-chip marker, and a cross-slot reuse guard.

**Architecture:** A new pure module `poolShelves.ts` derives shelf state from the existing `slotCompatibility` rules; `DragSlots.tsx` renders shelves from it; the store's `addRole` gains a one-line cross-role duplicate guard.
Drag mechanics, eligibility rules, stats, engine, and export are untouched.

**Tech Stack:** React 18, zustand (`useSession`), dnd-kit, vitest + `renderToStaticMarkup` (repo's component-test idiom, see `ConstructSlots.test.tsx`), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-07-04-grouped-variable-pool-design.md` (read it first).

## Global Constraints

- Shelf headings are the four levels verbatim, always in this order: `nominal`, `ordinal`, `interval`, `ratio` (spec R1).
- Scope is `DragSlots` only; do NOT touch `ConstructSlots.tsx`, `SemConfig.tsx`, `SemCanvas.tsx` (spec R2).
- All new user-facing strings live in `src/content/copy.ts` (spec Copy section).
- New copy uses plain dashes or no dashes, never the em dash "—" (owner's global writing rule; existing strings keep theirs).
- Chips keep dataset order within a shelf (the order of `s.columns`).
- Unused columns and id-tagged columns stay out of the pool exactly as today (`c.used` filter; id columns are auto-unused).
- Every task: run `npx tsc --noEmit` before committing; expect 0 errors.
- Tests run with `npx vitest run <file>` (fast, no WebR needed for these files).

---

### Task 1: Pool copy strings + `buildShelves` pure module

**Files:**
- Modify: `src/content/copy.ts` (append at end)
- Create: `src/lib/eligibility/poolShelves.ts`
- Test: `src/lib/eligibility/poolShelves.test.ts`

**Interfaces:**
- Consumes: `slotCompatibility(role, col, working)` from `src/lib/eligibility/eligibility.ts`; types `Level`, `RoleConstraint` from `src/lib/registry/types.ts`; `ColumnMeta` from `src/lib/data/columnMeta.ts`; `Dataset` from `src/lib/stats/types.ts`.
- Produces (Task 3 relies on these exact names):
  - `LEVEL_ORDER: Level[]`
  - `interface ShelfChip { col: ColumnMeta; assigned: boolean; ok: boolean; reason: string | null }`
  - `interface Shelf { level: Level; chips: ShelfChip[]; dim: boolean; note: string | null }`
  - `buildShelves(columns: ColumnMeta[], openRoles: RoleConstraint[], assigned: Set<string>, working: Dataset): Shelf[]`
  - From copy.ts: `POOL_SHELF_NOTE(level: Level): string`, `POOL_TEACH: Record<Level, string>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/eligibility/poolShelves.test.ts`:

```tsx
import { describe, it, expect } from 'vitest'
import { buildShelves, LEVEL_ORDER } from './poolShelves'
import type { ColumnMeta } from '../data/columnMeta'
import type { RoleConstraint } from '../registry/types'
import type { Dataset } from '../stats/types'

const col = (over: Partial<ColumnMeta> & { name: string }): ColumnMeta =>
  ({ detected: 'float64', tags: [], level: 'ratio', used: true, ...over })

// study-style fixture: one column per level + a date + a count
const group = col({ name: 'group', detected: 'object', level: 'nominal' })
const region = col({ name: 'region', detected: 'object', level: 'nominal' })
const rating = col({ name: 'rating', detected: 'int64', level: 'ordinal', tags: ['count'] })
const day = col({ name: 'day', detected: 'datetime64', level: 'interval', tags: ['datetime'] })
const score = col({ name: 'score' })
const arrests = col({ name: 'arrests', detected: 'int64', tags: ['count'] })
const COLS = [group, region, rating, day, score, arrests]

const working: Dataset = { columns: COLS.map((c) => c.name), rows: [
  { group: 'a', region: 'x', rating: 1, day: '2026-01-01', score: 1.5, arrests: 0 },
  { group: 'b', region: 'y', rating: 2, day: '2026-01-02', score: 2.5, arrests: 3 },
  { group: 'a', region: 'z', rating: 2, day: '2026-01-03', score: 3.5, arrests: 1 },
] }

// independent-t-test-shaped roles
const outcome: RoleConstraint = { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } }
const groupRole: RoleConstraint = { roleId: 'group', levels: ['nominal'], arity: { min: 1, max: 1 }, categories: { exact: 2 } }
// time-series-shaped roles
const time: RoleConstraint = { roleId: 'time', levels: [], arity: { min: 1, max: 1 }, timeOrder: true }
const series: RoleConstraint = { roleId: 'series', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 }, excludeTag: 'datetime' }

const none = new Set<string>()

describe('buildShelves', () => {
  it('returns the four shelves in fixed level order with dataset-order membership', () => {
    const shelves = buildShelves(COLS, [outcome, groupRole], none, working)
    expect(shelves.map((s) => s.level)).toEqual(LEVEL_ORDER)
    expect(shelves[0].chips.map((c) => c.col.name)).toEqual(['group', 'region'])
    expect(shelves[3].chips.map((c) => c.col.name)).toEqual(['score', 'arrests'])
  })

  it('dims a shelf whose level no open slot accepts, with one note and clean chips', () => {
    const shelves = buildShelves(COLS, [outcome, groupRole], none, working)
    const ordinal = shelves[1]
    expect(ordinal.dim).toBe(true)
    expect(ordinal.note).toBe('no open slot takes ordinal')
    expect(ordinal.chips[0].reason).toBeNull() // note replaces the per-chip sentence
  })

  it('keeps a shelf lit when the level fits but a chip fails an individual constraint', () => {
    const shelves = buildShelves(COLS, [outcome, groupRole], none, working)
    const nominal = shelves[0]
    expect(nominal.dim).toBe(false)
    expect(nominal.chips.find((c) => c.col.name === 'group')!.ok).toBe(true)
    const bad = nominal.chips.find((c) => c.col.name === 'region')!
    expect(bad.ok).toBe(false)
    expect(bad.reason).toBe('needs exactly 2 categories')
  })

  it('time-series probe: Time slot lights the ordinal shelf and the date chip; Series rejects the date chip individually', () => {
    const shelves = buildShelves(COLS, [time, series], none, working)
    expect(shelves[1].dim).toBe(false) // ordinal shelf lit via timeOrder
    expect(shelves[1].chips[0].ok).toBe(true)
    const interval = shelves[2]
    expect(interval.dim).toBe(false)
    expect(interval.chips[0].ok).toBe(true) // day fits the Time slot
    const nominal = shelves[0]
    expect(nominal.dim).toBe(true) // neither role takes nominal
  })

  it('assigned chips are marked, non-draggable, reasonless, and ignored by the dim probe', () => {
    const shelves = buildShelves(COLS, [groupRole], new Set(['score']), working)
    const chip = shelves[3].chips.find((c) => c.col.name === 'score')!
    expect(chip.assigned).toBe(true)
    expect(chip.ok).toBe(false)
    expect(chip.reason).toBeNull()
    expect(shelves[3].dim).toBe(true) // ratio shelf still dims on level, assignment does not veto the probe
  })

  it('all slots filled: nothing draggable, no notes, no reasons', () => {
    const shelves = buildShelves(COLS, [], none, working)
    for (const s of shelves) {
      expect(s.dim).toBe(false)
      expect(s.note).toBeNull()
      for (const c of s.chips) { expect(c.ok).toBe(false); expect(c.reason).toBeNull() }
    }
  })

  it('empty shelf: no chips, never dim', () => {
    const shelves = buildShelves([group, score], [outcome, groupRole], none, working)
    expect(shelves[1].chips).toEqual([])
    expect(shelves[1].dim).toBe(false)
    expect(shelves[1].note).toBeNull()
  })

  it('unused columns and level-less columns are excluded', () => {
    const shelves = buildShelves([col({ name: 'dead', used: false }), col({ name: 'noLevel', level: null })], [outcome], none, working)
    expect(shelves.every((s) => s.chips.length === 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/eligibility/poolShelves.test.ts`
Expected: FAIL - cannot resolve `./poolShelves`.

- [ ] **Step 3: Append the copy strings**

Append to `src/content/copy.ts`:

```tsx
import type { Level } from '../lib/registry/types'

// Grouped variable pool (test-config drag screens) — spec 2026-07-04
export const POOL_SHELF_NOTE = (level: Level) => `no open slot takes ${level}`
export const POOL_TEACH: Record<Level, string> = {
  nominal: 'No nominal columns yet. If a column holds unordered categories (e.g. groups or labels), set its level in step 4.',
  ordinal: 'No ordinal columns yet. If a column holds ordered categories (e.g. a rating scale), set its level in step 4.',
  interval: 'No interval columns yet. If a column is numeric without a true zero (e.g. dates or temperatures), set its level in step 4.',
  ratio: 'No ratio columns yet. If a column is numeric with a true zero (e.g. scores or amounts), set its level in step 4.',
}
```

Note: the `import type` line goes at the top of the file with no other changes to existing strings.

- [ ] **Step 4: Write the module**

Create `src/lib/eligibility/poolShelves.ts`:

```tsx
import type { Level, RoleConstraint } from '../registry/types'
import type { ColumnMeta } from '../data/columnMeta'
import type { Dataset } from '../stats/types'
import { slotCompatibility } from './eligibility'
import { POOL_SHELF_NOTE } from '../../content/copy'

export const LEVEL_ORDER: Level[] = ['nominal', 'ordinal', 'interval', 'ratio']

export interface ShelfChip { col: ColumnMeta; assigned: boolean; ok: boolean; reason: string | null }
export interface Shelf { level: Level; chips: ShelfChip[]; dim: boolean; note: string | null }

/** Does any open slot accept this level in principle? Mirrors slotCompatibility's level rules:
 *  a timeOrder role takes ordinal columns or a date-tagged chip regardless of its (empty) levels list. */
function levelAccepted(level: Level, openRoles: RoleConstraint[], shelfCols: ColumnMeta[]): boolean {
  return openRoles.some((r) => r.timeOrder
    ? level === 'ordinal' || shelfCols.some((c) => c.tags.includes('datetime'))
    : r.levels.includes(level))
}

/** Spec 2026-07-04 two-tier verdicts: shelf dims when the level alone rules every chip out (one shared
 *  note, chips clean); chips failing secondary constraints dim alone inside a lit shelf. */
export function buildShelves(columns: ColumnMeta[], openRoles: RoleConstraint[], assigned: Set<string>, working: Dataset): Shelf[] {
  return LEVEL_ORDER.map((level) => {
    const cols = columns.filter((c) => c.used && c.level === level)
    const dim = cols.length > 0 && openRoles.length > 0 && !levelAccepted(level, openRoles, cols)
    const chips = cols.map((col): ShelfChip => {
      if (assigned.has(col.name)) return { col, assigned: true, ok: false, reason: null }
      const fits = openRoles.map((r) => slotCompatibility(r, col, working))
      const ok = fits.some((v) => v.ok)
      const reason = ok || dim || !openRoles.length ? null : fits[0].reason
      return { col, assigned: false, ok, reason }
    })
    return { level, chips, dim, note: dim ? POOL_SHELF_NOTE(level) : null }
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/eligibility/poolShelves.test.ts`
Expected: PASS (8 tests).
Also run: `npx vitest run src/content/copy.consistency.test.ts` - expected PASS (new exports don't disturb the spec-fidelity checks).
Also run: `npx tsc --noEmit` - expected 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/eligibility/poolShelves.ts src/lib/eligibility/poolShelves.test.ts src/content/copy.ts
git commit -m "feat(config-ui): buildShelves two-tier pool verdicts + shelf copy (spec 2026-07-04)"
```

---

### Task 2: Cross-slot reuse guard in `addRole`

**Files:**
- Modify: `src/state/session.ts:245-252` (the `addRole` action)
- Test: `src/state/session.test.ts` (append inside the `back-edit invalidation` describe, after the arity test near line 98)

**Interfaces:**
- Consumes: existing `addRole(testId, roleId, column)` store action.
- Produces: same signature; new behavior - a column already present in ANY role of that test's setup is refused (state unchanged).

- [ ] **Step 1: Write the failing test**

In `src/state/session.test.ts`, directly after the test `'addRole enforces the arity maximum — a second column on an exactly-1 slot is refused'` (same describe block, which already seeds `load()` + `toggleSelection('independent-t-test')` in its `beforeEach`):

```tsx
  it('addRole refuses a column already assigned to another role of the same test (spec 2026-07-04 R5)', () => {
    useSession.getState().addRole('independent-t-test', 'outcome', 'score')
    useSession.getState().addRole('independent-t-test', 'group', 'score')
    expect(useSession.getState().setups['independent-t-test'].roles['group']).toEqual([])
    // removal restores draggability's precondition: the column can be re-assigned elsewhere
    useSession.getState().removeRole('independent-t-test', 'outcome', 'score')
    useSession.getState().addRole('independent-t-test', 'group', 'score')
    expect(useSession.getState().setups['independent-t-test'].roles['group']).toEqual(['score'])
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/session.test.ts -t "refuses a column already assigned"`
Expected: FAIL - `roles['group']` equals `['score']` on the first assertion (the store currently accepts the duplicate).

- [ ] **Step 3: Implement the guard**

In `src/state/session.ts`, `addRole` currently reads:

```tsx
      const cur = setup.roles[roleId]
      if (cur.includes(column) || cur.length >= role.arity.max) return {}
```

Replace those two lines with:

```tsx
      const cur = setup.roles[roleId]
      // one column, one slot per test — cross-role reuse is never statistically meaningful here (spec 2026-07-04 R5)
      if (cur.length >= role.arity.max || Object.values(setup.roles).some((cols) => cols.includes(column))) return {}
```

(The cross-role check subsumes the old same-role `cur.includes(column)` check.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/state/session.test.ts`
Expected: ALL PASS, including the pre-existing arity test (still covered by the new check).
Also run: `npx tsc --noEmit` - expected 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/state/session.ts src/state/session.test.ts
git commit -m "feat(config-ui): addRole refuses cross-slot column reuse within a test (spec R5)"
```

---

### Task 3: Shelf rendering in DragSlots + CSS

**Files:**
- Modify: `src/components/DragSlots.tsx`
- Modify: `src/styles/tokens.css` (append shelf/tag rules)
- Test: `src/components/DragSlots.test.tsx` (new)

**Interfaces:**
- Consumes: `buildShelves`, `LEVEL_ORDER` semantics from Task 1; `POOL_TEACH` from copy.ts; store guard from Task 2.
- Produces: the rendered pool DOM - `.shelf` sections containing `.shelf-head` and the existing `.chip` elements (class names `chip assigned` / `chip incompatible` preserved for e2e).

- [ ] **Step 1: Write the failing test**

Create `src/components/DragSlots.test.tsx` (repo idiom: `renderToStaticMarkup` + seeded store, see `ConstructSlots.test.tsx`):

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { useSession } from '../state/session'
import { SPECS } from '../lib/registry/catalog'
import { DragSlots } from './DragSlots'
import type { Dataset } from '../lib/stats/types'

const TEST_ID = 'independent-t-test'

// one column per level + a date + a count + a 3-category nominal that fails group's exact-2
const ds: Dataset = { columns: ['group', 'region', 'rating', 'day', 'score', 'arrests'], rows: [
  { group: 'a', region: 'x', rating: 1, day: '2026-01-01', score: 1.5, arrests: 0 },
  { group: 'b', region: 'y', rating: 2, day: '2026-01-02', score: 2.5, arrests: 3 },
  { group: 'a', region: 'z', rating: 2, day: '2026-01-03', score: 3.5, arrests: 1 },
] }
const info = { name: 'study.csv', rows: 3, cols: 6, encoding: 'UTF-8' }

function seed() {
  const st = useSession.getState()
  st.loadDataset(ds, info)
  st.setColumnLevel('rating', 'ordinal') // int64 auto-suggests ratio; the fixture wants an ordinal shelf member
  st.visitGuide()
  st.toggleSelection(TEST_ID)
}

const render = () => renderToStaticMarkup(<DragSlots testId={TEST_ID} spec={SPECS[TEST_ID]} />)

describe('DragSlots grouped pool', () => {
  beforeEach(() => { useSession.getState().reset(); seed() })

  it('renders the four shelves in fixed order with counts', () => {
    const html = render()
    // shelf-head renders as `<div class="shelf-head">nominal <span class="count">…` — match the `>level <` prefix
    const order = ['nominal', 'ordinal', 'interval', 'ratio'].map((l) => html.indexOf(`>${l} <`))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('dims the ordinal shelf with one note and no per-chip sentence', () => {
    const html = render()
    expect(html).toContain('no open slot takes ordinal')
    expect(html).not.toContain('needs an interval / ratio column') // the old per-chip noise is gone
  })

  it('keeps nominal lit and dims only the 3-category chip with its own reason', () => {
    const html = render()
    expect(html).toContain('needs exactly 2 categories')
    expect(html).not.toContain('no open slot takes nominal')
  })

  it('renders date and count badges', () => {
    const html = render()
    expect(html).toContain('<span class="tag">date</span>')
    expect(html).toContain('<span class="tag">count</span>')
  })

  it('shows teaching copy on an empty shelf', () => {
    useSession.getState().setColumnLevel('rating', 'ratio') // empty the ordinal shelf
    const html = render()
    expect(html).toContain('No ordinal columns yet.')
  })

  it('marks an assigned chip in the pool (slot copy + pool copy)', () => {
    expect(render().match(/chip assigned/g)).toBeNull()
    useSession.getState().addRole(TEST_ID, 'outcome', 'score')
    expect(render().match(/chip assigned/g)).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/DragSlots.test.tsx`
Expected: FAIL on the shelf assertions (current DOM has one flat pool).
If `renderToStaticMarkup` throws inside dnd-kit instead, add this mock at the top of the test file (below the imports) and re-run - the assertions are unchanged:

```tsx
import { vi } from 'vitest'
vi.mock('@dnd-kit/core', async (orig) => ({ ...(await orig() as object),
  DndContext: ({ children }: { children?: unknown }) => <>{children as never}</>,
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null }),
  useDroppable: () => ({ isOver: false, setNodeRef: () => {} }),
}))
```

- [ ] **Step 3: Restructure the pool render**

In `src/components/DragSlots.tsx`:

Replace the `Chip` component with (assigned tint wins over incompatible fade; badges after the name; reason only for unassigned incompatibles - the existing " — reason" idiom stays):

```tsx
function Chip({ name, disabled, reason, assigned, badges }: {
  name: string; disabled: boolean; reason: string | null; assigned: boolean; badges: string[]
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: name, disabled })
  return (
    <span ref={setNodeRef} {...listeners} {...attributes}
      className={`chip${assigned ? ' assigned' : disabled ? ' incompatible' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), touchAction: 'none', cursor: disabled ? (assigned ? 'default' : 'not-allowed') : 'grab' }}>
      {name}{badges.map((b) => <span key={b} className="tag">{b}</span>)}
      {!assigned && disabled && reason ? <span className="hint"> — {reason}</span> : null}
    </span>
  )
}
```

In the `DragSlots` body, add the shelf derivation after the `openRoles` line:

```tsx
  const assignedSet = new Set(Object.values(s.setups[testId]?.roles ?? {}).flat())
  const shelves = buildShelves(s.columns, openRoles, assignedSet, working)
```

Replace the pool card's inner flat chip list (the `<div style={{ display: 'flex', flexWrap: 'wrap', ... }}>` block with the `s.columns.filter(...).map(...)` inside) with:

```tsx
          {shelves.map((sh) => (
            <div key={sh.level} className={`shelf${sh.dim ? ' off' : ''}`}>
              <div className="shelf-head">{sh.level} <span className="count">{sh.chips.length}</span>
                {sh.note && <span className="note"> · {sh.note}</span>}</div>
              {sh.chips.length ? (
                <div className="pool">
                  {sh.chips.map((ch) => (
                    <Chip key={ch.col.name} name={ch.col.name} disabled={!ch.ok} reason={ch.reason} assigned={ch.assigned}
                      badges={ch.col.tags.filter((t) => t === 'datetime' || t === 'count').map((t) => t === 'datetime' ? 'date' : t)} />
                  ))}
                </div>
              ) : (
                <p className="hint teach">{POOL_TEACH[sh.level]}</p>
              )}
            </div>
          ))}
```

Add the imports:

```tsx
import { buildShelves } from '../lib/eligibility/poolShelves'
import { POOL_TEACH } from '../content/copy'
```

`onDragEnd` stays as-is: the disabled chip can't be picked up and the store guard (Task 2) is the single enforcement point.

- [ ] **Step 4: Add the CSS**

Append to `src/styles/tokens.css`:

```css
/* grouped variable pool — level shelves (config-ui, 2026-07-04) */
.shelf{margin-top:10px;padding-top:8px;border-top:1px solid var(--line);}
.shelf:first-of-type{margin-top:6px;padding-top:0;border-top:0;}
.shelf-head{font-size:11px;color:var(--text);text-transform:uppercase;letter-spacing:.08em;font-weight:700;}
.shelf-head .count{color:var(--muted);font-weight:400;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}
.shelf-head .note{color:var(--muted);font-weight:400;text-transform:none;letter-spacing:0;}
.shelf.off .shelf-head,.shelf.off .pool{opacity:.5;}
.shelf .teach{margin:6px 0 0;font-style:italic;}
.pool{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;}
.chip .tag{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10px;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:0 4px;margin-left:5px;vertical-align:1px;}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/DragSlots.test.tsx`
Expected: PASS (6 tests).
Run: `npx tsc --noEmit` - expected 0 errors.

- [ ] **Step 6: Eyeball it rendered**

Run: `npm run dev`, upload `tests/e2e/fixtures/study.csv`, pick Independent t-test, and check: four shelves in order, ordinal/interval empty with teaching copy, dragging `score` to Outcome tints it in the pool, dragging it again onto Group is refused.
Stop the dev server after.

- [ ] **Step 7: Commit**

```bash
git add src/components/DragSlots.tsx src/components/DragSlots.test.tsx src/styles/tokens.css
git commit -m "feat(config-ui): grouped variable pool — level shelves, badges, assigned marker"
```

---

### Task 4: Full gate

**Files:**
- No new files; possible selector touch-ups in `tests/e2e/*.spec.ts` only if the gate flags them (drag behavior is unchanged and pool chips keep the `.chip` class, so none are expected).

**Interfaces:**
- Consumes: everything above.
- Produces: green gate - the slice's definition of done.

- [ ] **Step 1: Fast suite**

Run: `npm run test:fast`
Expected: all green (was 1132 before this slice; now +15).

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 errors, build succeeds.

- [ ] **Step 3: e2e**

Run: `npx playwright test`
Expected: 19/19 (pre-slice count). The drag helpers locate `.chip` by text and slot assertions are scoped to `[data-role=...]`, both preserved.
A pre-scan found no e2e or docs-harness config assigning one column to two roles of the same test, so the reuse guard breaks nothing.
If a spec fails on a selector, fix the selector only - never weaken an assertion.

- [ ] **Step 4: Commit any e2e touch-ups**

Only if Step 3 required them:

```bash
git add tests/e2e
git commit -m "test(e2e): selector touch-ups for the grouped pool DOM"
```

- [ ] **Step 5: Report**

Report gate numbers (test:fast count, e2e count, tsc/build) back to the session for the ratify note.
Known follow-ups recorded for the owner, NOT part of this slice: per-test doc screenshots (`docs/test-documentation/*/1-input-config.png`) now show the old flat pool and get regenerated whenever Benjie says so; SEM picker revisit + hover echo live in the visual-redesign slice.
