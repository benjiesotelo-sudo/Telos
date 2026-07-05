# Polish, Onboarding & Mobile (Slice 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Test-switcher pills, first-run rail hint, the approved motion register, and acceptance-grade mobile - per spec rulings R1-R6.

**Architecture:** All new UI follows the repo idioms: presentational components (props only, `renderToStaticMarkup`-testable) + thin store-connected wrappers; styling through tokens.css classes; copy through copy.ts; motion CSS-only behind the existing `--motion` token and reduced-motion kill switch. Tap-to-assign ships unconditionally (plan ruling: simulated touch-drag is unassertable in CI; taps are deterministic and double as an a11y win) - drag stays the primary interaction.

**Tech Stack:** React 18, zustand, dnd-kit, vitest + `renderToStaticMarkup`, Playwright (new mobile project).

**Spec:** `docs/superpowers/specs/2026-07-05-telos-polish-onboarding-mobile-design.md` (read first).

## Global Constraints

- Owner's working tree contains uncommitted files (docs/test-documentation/*, src/components/SemCanvas.tsx/.test.tsx, tests/docs/document-tests.spec.ts, untracked docs) - NEVER touch/commit/stash them; `git add` only files you edit; commit messages plain, no trailers.
- New copy: copy.ts only, never the em dash "—"; `WELCOME_COPY`/`TERMS_COPY` byte-unchanged.
- No hex colors in components - tokens only. All animation rides `var(--motion)` or named keyframes and dies under the existing `@media (prefers-reduced-motion:reduce)` block.
- DOM contracts preserved: `nav[aria-label="Progress"]`, `.chip`/`.chip.assigned`/`[data-role]`/`.eyebrow`/`.title`, heading texts, `#table-*`.
- Stats/engine/exports/print/APA/SemCanvas untouched. Every task: `npx tsc --noEmit` AND `npm run build` (the real type gate) + eslint 0 new problems before commit.

## File Map

- T1 `src/lib/registry/catalog.ts` (+ new `catalog.short.test.ts`) - short names
- T2 `src/components/TestSwitcher.tsx` (new) + `TestConfigScreen.tsx` (wire + R5 removal) - switcher
- T3 `src/components/HintBar.tsx` (new) + `Stepper.tsx` (render site) + copy.ts + tokens.css - hint + affordances
- T4 tokens.css + `WelcomeScreen.tsx` + `App.tsx` - motion register
- T5 tokens.css + `ConfigureDataScreen.tsx` - mobile CSS + table scroll
- T6 `DragSlots.tsx` (tap-to-assign) + `playwright.config.ts` + `tests/e2e/mobile.spec.ts` - touch
- T7 gate

---

### Task 1: `CATALOG.short` for every long name (R6)

**Files:**
- Modify: `src/lib/registry/catalog.ts` (the `e(...)` calls + 3 SEM object literals)
- Test: `src/lib/registry/catalog.short.test.ts` (new)

**Interfaces:**
- Produces: every `CatalogEntry` where `name.length > 18` carries a `short` with `short.length <= 18`. Consumers (`railModel`'s `shortName`, T2's switcher) already prefer `short ?? name`.

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { CATALOG } from './catalog'

describe('catalog short names (spec R6)', () => {
  it('every long name carries a compact short', () => {
    const offenders = CATALOG.filter((c) => c.name.length > 18 && !(c.short && c.short.length <= 18))
    expect(offenders.map((c) => c.id)).toEqual([])
  })
  it('shorts are never longer than names', () => {
    expect(CATALOG.filter((c) => c.short && c.short.length > c.name.length)).toEqual([])
  })
})
```

- [ ] **Step 2: RED** - `npx vitest run src/lib/registry/catalog.short.test.ts` (offender list non-empty).

- [ ] **Step 3: Add shorts** - `e()` already accepts a 6th `short` param (see its signature at catalog.ts:55). Owner-reviewed table (apply verbatim; entries not listed are already <= 18 chars and get NO short):

| id | short |
|---|---|
| frequencies-crosstabs | Frequencies |
| distribution-normality | Normality |
| one-way-anova | One-way ANOVA |
| repeated-measures-anova | RM ANOVA |
| wilcoxon-signed-rank | Wilcoxon |
| chi-square-independence | χ² independence |
| chi-square-goodness-of-fit | χ² goodness-of-fit |
| simple-linear-regression | Simple regression |
| multiple-linear-regression | Multiple regression |
| logistic-regression | Logistic |
| poisson-negative-binomial | Poisson / NB |
| stationarity-tests | ADF / KPSS |
| difference-in-differences (id: did) | DiD |
| regression discontinuity (id: rdd) | RDD |
| iv-2sls | IV / 2SLS |
| propensity-score-matching | PSM |
| average variance extracted (id: ave) | AVE |
| composite-reliability | CR |
| exploratory factor analysis (id: efa) | EFA |
| principal component analysis (id: pca) | PCA |

Run the definitive audit yourself (`node -e` over CATALOG printing every `name.length > 18` id) - if it surfaces an entry NOT in this table (e.g. long SEM names), coin a short in the same register and record it in your report for the owner.
Do not change any `name` (registry consistency tests pin them).

- [ ] **Step 4: GREEN** - the new test + `npx vitest run src/lib/registry/ src/state/stages.test.ts` (railModel already prefers short - RM ANOVA sub-dots shrink for free) + `npx tsc --noEmit && npm run build`.
- [ ] **Step 5: Commit** - `git add src/lib/registry/catalog.ts src/lib/registry/catalog.short.test.ts && git commit -m "feat(polish): compact short names for every long catalog entry (R6)"`

---

### Task 2: TestSwitcher + wiring + dead-module removal (R1, R5)

**Files:**
- Create: `src/components/TestSwitcher.tsx`
- Modify: `src/components/screens/TestConfigScreen.tsx` (render under the title; remove the unreachable `running && <RunModule .../>` block and its import if unused)
- Modify: `src/styles/tokens.css` (append switcher classes)
- Test: `src/components/TestSwitcher.test.tsx`

**Interfaces:**
- Produces:
```tsx
export interface SwitchTest { id: string; label: string; n: number; state: 'done' | 'current' | 'todo'; enabled: boolean }
export function TestSwitcher({ tests, onGo }: { tests: SwitchTest[]; onGo: (id: string) => void })
```
TestConfigScreen derives: selection order; `label` = `CATALOG short ?? name`; `n` = index+1; `state` = current test id ? 'current' : gateOk(s, \`test:${id}\`) ? 'done' : 'todo'; `enabled` = `canEnter(s, 'test:'+id)` and not running. Import `gateOk`, `canEnter` are already exported from session.

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TestSwitcher } from './TestSwitcher'

const tests = [
  { id: 'independent-t-test', label: 'Independent t', n: 1, state: 'done' as const, enabled: true },
  { id: 'one-way-anova', label: 'One-way ANOVA', n: 2, state: 'current' as const, enabled: true },
  { id: 'kruskal-wallis', label: 'Kruskal-Wallis', n: 3, state: 'todo' as const, enabled: false },
]
const h = () => renderToStaticMarkup(<TestSwitcher tests={tests} onGo={() => {}} />)

describe('TestSwitcher (spec R1)', () => {
  it('renders one button per test in order, numbered, with state classes', () => {
    const html = h()
    expect(html.match(/tswitch-pill/g)!.length).toBeGreaterThanOrEqual(3)
    expect(html.indexOf('Independent t')).toBeLessThan(html.indexOf('One-way ANOVA'))
    expect(html).toContain('tswitch-pill done')
    expect(html).toContain('tswitch-pill current')
    expect(html).toContain('aria-current="true"')
  })
  it('done tests carry the check, disabled tests are real disabled buttons', () => {
    const html = h()
    expect(html).toMatch(/done[^>]*>[^<]*✓/)
    expect(html).toContain('disabled')
  })
  it('renders nothing for a single test', () => {
    expect(renderToStaticMarkup(<TestSwitcher tests={tests.slice(0, 1)} onGo={() => {}} />)).toBe('')
  })
})
```

- [ ] **Step 2: RED**, then implement:

```tsx
export interface SwitchTest { id: string; label: string; n: number; state: 'done' | 'current' | 'todo'; enabled: boolean }

/** Spec R1: the on-screen test switcher - finger-sized targets; rail sub-dots stay indicators only. */
export function TestSwitcher({ tests, onGo }: { tests: SwitchTest[]; onGo: (id: string) => void }) {
  if (tests.length < 2) return null
  return (
    <div className="tswitch" role="group" aria-label="Your tests">
      {tests.map((t) => (
        <button key={t.id} type="button" className={`tswitch-pill ${t.state}`}
          aria-current={t.state === 'current' ? 'true' : undefined}
          disabled={!t.enabled || t.state === 'current'}
          onClick={() => onGo(t.id)}>
          {t.state === 'done' && <span className="tick">✓ </span>}{t.n} · {t.label}
        </button>
      ))}
    </div>
  )
}
```

tokens.css append:
```css
/* test switcher (slice 3, R1) */
.tswitch{display:flex;flex-wrap:wrap;gap:7px;margin:2px 0 14px;}
.tswitch-pill{font-size:13px;font-family:var(--font-ui);border:1px solid var(--line);border-radius:999px;padding:6px 15px;background:var(--card);color:var(--muted);cursor:pointer;transition:border-color var(--motion) ease-out;}
.tswitch-pill.done{color:var(--text);}
.tswitch-pill .tick{color:var(--accent-deep);font-weight:700;}
.tswitch-pill.current{background:var(--text);border-color:var(--text);color:var(--bg);font-weight:650;cursor:default;}
.tswitch-pill:disabled:not(.current){opacity:.5;cursor:not-allowed;}
```

TestConfigScreen wiring, directly under the `<h1 className="title">` line:
```tsx
<TestSwitcher onGo={(id) => s.goTo(`test:${id}` as never)} tests={s.selection.map((tid, ti) => ({
  id: tid, n: ti + 1,
  label: CATALOG.find((c) => c.id === tid)?.short ?? SPECS[tid]?.name ?? tid,
  state: tid === testId ? 'current' as const : gateOk(s, `test:${tid}`) ? 'done' as const : 'todo' as const,
  enabled: !running && canEnter(s, `test:${tid}` as never),
}))} />
```
(imports: `TestSwitcher`, `CATALOG`, and add `gateOk`/`canEnter` to the existing session import - `gateOk` is already imported.)
R5 in the same commit: delete the `{running && <RunModule .../>}` block above `.btn-row` and the `RunModule` import.

- [ ] **Step 3: GREEN** - new test + `npx vitest run src/components/ && npx tsc --noEmit && npm run build`; eslint touched files.
- [ ] **Step 4: Commit** - `git add src/components/TestSwitcher.tsx src/components/TestSwitcher.test.tsx src/components/screens/TestConfigScreen.tsx src/styles/tokens.css && git commit -m "feat(polish): on-screen test switcher pills; drop the unreachable config RunModule (R1, R5)"`

---

### Task 3: First-run hint bar + rail affordances (R2)

**Files:**
- Create: `src/components/HintBar.tsx`
- Modify: `src/components/Stepper.tsx` (connected `Stepper` renders HintBar under the nav), `src/content/copy.ts` (one string), `src/styles/tokens.css` (hintbar + affordance rules)
- Test: `src/components/HintBar.test.tsx`

**Interfaces:**
- Produces: `HintBar({ text, storageKey }: { text: string; storageKey: string })` - renders the bar unless `sessionStorage[storageKey]` is set; the close button sets it and hides. Also exports `dismissHint(storageKey: string)` for the Stepper to call on any rail navigation.
- copy.ts: `export const RAIL_HINT = 'Tip: the journey bar is clickable - jump back to any finished stage, or between your tests, anytime.'`

- [ ] **Step 1: Failing test** (sessionStorage exists in happy-dom/jsdom; if the vitest env is node for this dir, mock `globalThis.sessionStorage` with a Map-backed stub in the test):

```tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { HintBar, dismissHint } from './HintBar'

const KEY = 'telos-hint-rail'
const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  globalThis.sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0,
  } as Storage
})

describe('HintBar (spec R2)', () => {
  it('renders the tip with a dismiss button on first run', () => {
    const html = renderToStaticMarkup(<HintBar text="Tip: hello" storageKey={KEY} />)
    expect(html).toContain('hintbar')
    expect(html).toContain('Tip: hello')
    expect(html).toContain('aria-label="Dismiss tip"')
  })
  it('renders nothing once dismissed', () => {
    dismissHint(KEY)
    expect(renderToStaticMarkup(<HintBar text="Tip: hello" storageKey={KEY} />)).toBe('')
  })
})
```

- [ ] **Step 2: RED**, then implement:

```tsx
import { useState } from 'react'

export function dismissHint(storageKey: string) { try { sessionStorage.setItem(storageKey, '1') } catch { /* SSR/no storage: hint just shows again */ } }
const seen = (k: string) => { try { return sessionStorage.getItem(k) !== null } catch { return false } }

/** Spec R2: one-time disclosure that the rail is navigation. Session-scoped on purpose. */
export function HintBar({ text, storageKey }: { text: string; storageKey: string }) {
  const [hidden, setHidden] = useState(() => seen(storageKey))
  if (hidden) return null
  return (
    <div className="hintbar" role="note">
      <span aria-hidden="true">💡</span>
      <span>{text}</span>
      <button type="button" className="hintbar-x" aria-label="Dismiss tip"
        onClick={() => { dismissHint(storageKey); setHidden(true) }}>✕</button>
    </div>
  )
}
```

Stepper wiring (connected `Stepper` only; StepperUI stays pure): render `<HintBar text={RAIL_HINT} storageKey="telos-hint-rail" />` directly AFTER the `<StepperUI .../>` element (fragment), and wrap `onGo`: `(step) => { dismissHint('telos-hint-rail'); s.goTo(step as never) }`.
Note: dismissal state is read at HintBar mount; the bar disappearing on the NEXT screen change (not the same render) is acceptable and spec-compliant ("dismissed ... automatically after the user's first rail jump" - the jump remounts the screen).

tokens.css:
```css
/* first-run hint + rail affordances (slice 3, R2) */
.hintbar{display:flex;align-items:center;gap:10px;max-width:640px;margin:0 auto 10px;border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:10px;background:var(--card);padding:8px 13px;font-size:12.5px;}
.hintbar-x{margin-left:auto;border:0;background:none;color:var(--muted);font-size:13px;cursor:pointer;padding:2px 6px;}
.stage-btn:not(:disabled):hover .lbl,.stage-btn:focus-visible .lbl{text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--accent);}
.stage-btn:not(:disabled):hover .node{transform:translateY(-1px);}
.stage-btn .node{transition:transform var(--motion) ease-out,background var(--motion) ease-out,box-shadow var(--motion) ease-out;}
```
(Verify the inner stage button's class name in Stepper.tsx - it is `stage-btn` per the final-review restructure; adjust the selector if it differs.)

- [ ] **Step 3: GREEN** - new test + `npx vitest run src/components/ && npx tsc --noEmit && npm run build`; copy.consistency untouched.
- [ ] **Step 4: Commit** - `git add src/components/HintBar.tsx src/components/HintBar.test.tsx src/components/Stepper.tsx src/content/copy.ts src/styles/tokens.css && git commit -m "feat(polish): first-run rail hint + hover/focus affordances (R2)"`

---

### Task 4: Motion register (R3)

**Files:**
- Modify: `src/styles/tokens.css` (keyframes + hooks), `src/components/screens/WelcomeScreen.tsx` (entrance classes), `src/App.tsx` (screen cross-fade)
- Test: `src/components/screens/WelcomeScreen.test.tsx` (extend: entrance classes present)

**Interfaces:** CSS-only; class names produced: `.enter-1..4` (welcome stagger), `.screen-fade` (App), `chipIn` applied via existing `.slot .chip.assigned`.

- [ ] **Step 1: Extend the welcome test (RED first)** - add to the existing suite:

```tsx
  it('carries the entrance-stagger classes (motion register R3a)', () => {
    const html = h()
    for (const c of ['enter-1', 'enter-2', 'enter-3', 'enter-4']) expect(html).toContain(c)
  })
```

- [ ] **Step 2: tokens.css append** (verbatim):

```css
/* motion register (slice 3, R3) — all dies under the reduced-motion block above */
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes dotIn{0%{opacity:0;transform:translateY(-12px) scale(.4)}60%{opacity:1;transform:translateY(2px) scale(1.05)}100%{opacity:1;transform:none}}
@keyframes drawPath{from{stroke-dashoffset:520}to{stroke-dashoffset:0}}
@keyframes checkPop{0%{transform:scale(.4)}70%{transform:scale(1.18)}100%{transform:scale(1)}}
@keyframes chipIn{from{opacity:.4;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
@keyframes screenIn{from{opacity:0}to{opacity:1}}
.enter-1{animation:fadeUp .5s ease-out both}
.enter-2{animation:fadeUp .55s ease-out .12s both}
.enter-3 path{stroke-dasharray:520;animation:drawPath 1.1s ease-out .45s both}
.enter-3 circle{opacity:0;animation:dotIn .5s ease-out both}
.enter-3 circle:nth-of-type(1){animation-delay:.65s}.enter-3 circle:nth-of-type(2){animation-delay:.78s}
.enter-3 circle:nth-of-type(3){animation-delay:.91s}.enter-3 circle:nth-of-type(4){animation-delay:1.04s}
.enter-3 circle:nth-of-type(5){animation-delay:1.17s}.enter-3 circle:nth-of-type(6){animation-delay:1.3s}
.enter-3 circle:nth-of-type(7){animation-delay:1.43s}
.enter-4{animation:fadeUp .55s ease-out 1.5s both}
.enter-5{animation:fadeUp .5s ease-out 1.75s both}
.screen-fade{animation:screenIn 150ms ease-out both}
.stage.done .node{animation:checkPop .4s cubic-bezier(.3,1.4,.5,1) both}
.rail-fill{transition:width 320ms cubic-bezier(.3,1.15,.4,1)}
.slot .chip.assigned{animation:chipIn 180ms ease-out both}
```
Note the `.rail-fill` line REPLACES its existing `transition:width var(--motion) ease-out` declaration (the overshoot-and-settle easing is R3b) - edit in place, don't duplicate the selector.

- [ ] **Step 3: WelcomeScreen hooks** - add classes: eyebrow -> `className="eyebrow enter-1"`, the `<h1>` -> append ` enter-2`, the `<svg>` -> add `className="enter-3"`, the prose `<p>` -> append ` enter-4`, the CTA button -> `className="btn enter-5"`, credit line -> append ` enter-4` is WRONG (it would replay with prose timing; give it ` enter-5`). Keep test Step 1 green (it checks 1-4; 5 comes free).
- [ ] **Step 4: App.tsx cross-fade** - the screen switch is the ternary chain in `App()`. Wrap it: `<div className="screen-fade" key={typeof step === 'string' ? step : step}>` around the existing ternary result (key = step id string so React remounts and the animation replays per screen).
- [ ] **Step 5: GREEN + audit note** - welcome tests + `npx vitest run src/components/ && npx tsc --noEmit && npm run build`. Append one line to `docs/superpowers/reviews/2026-07-05-redesign-contrast-audit.md`'s motion section: new keyframes fadeUp/dotIn/drawPath/checkPop/chipIn/screenIn all under the global reduced-motion kill (verify with the grep from that doc).
- [ ] **Step 6: Commit** - `git add src/styles/tokens.css src/components/screens/WelcomeScreen.tsx src/components/screens/WelcomeScreen.test.tsx src/App.tsx docs/superpowers/reviews/2026-07-05-redesign-contrast-audit.md && git commit -m "feat(polish): motion register - welcome entrance, completion pop, cross-fades, chip settle (R3)"`

---

### Task 5: Mobile layout fixes (R4 CSS half)

**Files:**
- Modify: `src/styles/tokens.css` (compact rail rewrite + hit areas), `src/components/screens/ConfigureDataScreen.tsx` (table scroll wrapper)
- Test: `src/components/screens/ConfigureDataScreen` has no test file; the wrapper is pinned by the mobile e2e (T6). CSS is eyeballed at T6's screenshots.

- [ ] **Step 1: Compact rail** - REPLACE the existing `@media (max-width:560px)` rail block in tokens.css with:

```css
@media (max-width:560px){
  .rail{padding:10px 8px 12px;}
  .rail .stages{margin-top:-12px;align-items:center;}
  .stage{flex-direction:row;gap:6px;padding:0 4px;}
  .stage .node{width:24px;height:24px;}
  .stage span.lbl{display:none;font-size:11px;}
  .stage.current span.lbl{display:inline;}
  .stage .sublabel{display:none;}
  .stage .subdots{display:none;} /* R1: the on-screen switcher owns test-switching on phones */
  .rail .thread-frac{display:inline;position:absolute;right:10px;top:14px;}
  .rail{position:sticky;} /* unchanged, restated for clarity */
}
```
(Adapt selectors to the real DOM: the stage wrapper is a `span.stage` containing `button.stage-btn`; put `flex-direction:row` where it lays out node+label - verify in the browser during T6, the mobile screenshots are the check.)

- [ ] **Step 2: Hit areas** - append:

```css
/* 24px minimum hit areas (R4) */
.subdot{position:relative;}
.subdot::after{content:'';position:absolute;inset:-9px;}
.hintbar-x::after{content:'';position:absolute;inset:-8px;}
.hintbar-x{position:relative;}
```

- [ ] **Step 3: Table scroll container** - in `ConfigureDataScreen.tsx`, the columns `<table className="cols-table">` sits in a `.card` with `padding: 0`. Wrap the table: `<div style={{ overflowX: 'auto' }}><table className="cols-table">...</table></div>`. Nothing else in the file changes.
- [ ] **Step 4: Verify** - `npx vitest run src/components/ && npx tsc --noEmit && npm run build` (the wrapper div must not break any screen test).
- [ ] **Step 5: Commit** - `git add src/styles/tokens.css src/components/screens/ConfigureDataScreen.tsx && git commit -m "fix(polish): one-line compact rail, 24px hit areas, configure-data table scrolls (R4)"`

---

### Task 6: Tap-to-assign + mobile e2e (R4 interaction half)

**Files:**
- Modify: `src/components/DragSlots.tsx` (armed-chip tap flow in DragSlotsUI), `src/styles/tokens.css` (armed style), `playwright.config.ts` (projects)
- Create: `tests/e2e/mobile.spec.ts`
- Test: `src/components/DragSlots.test.tsx` (extend)

**Interfaces:**
- DragSlotsUI gains internal `armed: string | null` state plus an optional `armedChip` test-override prop (same pattern as `echoRole`). Tapping (onClick) an enabled pool chip arms it (`chip armed` class); tapping a slot while armed calls `onDrop(roleId, armed)` and disarms; tapping the armed chip again disarms. Drag still works unchanged (dnd-kit listeners co-exist; a drag's synthetic click is already suppressed by dnd-kit).

- [ ] **Step 1: Failing unit tests** (extend DragSlots.test.tsx):

```tsx
  it('tap-to-assign: an armed chip carries the armed class (test-override prop)', () => {
    const html = renderUI({ armedChip: 'score' }) // adapt to the file's existing render helper + new prop
    expect(html).toContain('chip armed')
  })
```
(The click-flow behavior is exercised in the mobile e2e; static markup can't fire taps.)

- [ ] **Step 2: Implement** - in DragSlotsUI: `const [armedState, setArmed] = useState<string | null>(null); const armed = armedChip ?? armedState`. Chip gets `onClick` (only when enabled): arm/disarm. Slot wrapper div `onClick`: `if (armed) { onDrop(role.roleId, armed); setArmed(null) }`. Chip className: `chip${ch.assigned ? ' assigned' : disabled ? ' incompatible' : ''}${armed === ch.col.name ? ' armed' : ''}`. tokens.css: `.chip.armed{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);}`

- [ ] **Step 3: Playwright projects** - edit `playwright.config.ts`:

```ts
  projects: [
    { name: 'desktop', testIgnore: '**/mobile.spec.ts' },
    { name: 'mobile', testMatch: '**/mobile.spec.ts', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
```
(Everything else in the config unchanged; `use.baseURL` stays top-level and inherits.)

- [ ] **Step 4: Mobile spec** - `tests/e2e/mobile.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('mobile journey: upload → configure → pick → tap-to-assign → run gate enabled', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/study.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  // the Use column is reachable (table scrolls, not the page)
  await expect(page.getByLabel('use score')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()
  await page.getByRole('checkbox', { name: 'Independent t-test' }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()
  await expect(page.getByRole('heading', { name: 'Drag columns into roles' })).toBeVisible()
  // tap-to-assign: tap the chip, tap the slot
  await page.locator('.chip', { hasText: 'score' }).first().tap()
  await expect(page.locator('.chip.armed')).toHaveCount(1)
  await page.locator('[data-role="outcome"]').tap()
  await expect(page.locator('[data-role="outcome"] .chip.assigned')).toContainText('score')
  await page.locator('.chip', { hasText: 'group' }).first().tap()
  await page.locator('[data-role="group"]').tap()
  await expect(page.locator('[data-role="group"] .chip.assigned')).toContainText('group')
  await expect(page.getByRole('button', { name: 'Run analysis' })).toBeEnabled()
  // compact rail: one line, no sub-dots, fraction visible
  await expect(page.locator('.subdot')).toHaveCount(0)
  await expect(page.locator('.thread-frac')).toBeVisible()
  await page.screenshot({ path: 'test-results/mobile-config.png' })
})
```
(Stops before running WebR - the run gate being enabled is the assertion; the desktop suite covers real runs.)

- [ ] **Step 5: Verify** - `npx vitest run src/components/DragSlots.test.tsx` green; `npx playwright test --project=mobile` green; `npx playwright test --project=desktop tests/e2e/flow.spec.ts -g "full journey"` still green (config restructure sanity); tsc + build. Read the screenshot `test-results/mobile-config.png` and confirm the compact rail matches T5's intent; fix CSS if not.
- [ ] **Step 6: Commit** - `git add src/components/DragSlots.tsx src/components/DragSlots.test.tsx src/styles/tokens.css playwright.config.ts tests/e2e/mobile.spec.ts && git commit -m "feat(polish): tap-to-assign + mobile e2e project + compact-rail verification (R4)"`

---

### Task 7: Full gate

- [ ] **Step 1:** `npm run test:fast` - all green (~+10 over 1174).
- [ ] **Step 2:** `npx tsc --noEmit && npm run build` - clean.
- [ ] **Step 3:** `npx playwright test` - 19 desktop + 1 mobile = 20/20.
- [ ] **Step 4:** Fresh-clone: clone to /tmp, `npm ci && npm run test:fast && npm run build`, clean up.
- [ ] **Step 5:** Report gate numbers + the T1 short-name additions list for the owner's ratify note. Owner acceptance: desktop AND phone-sized click-through, both themes, Reduce Motion on/off.
