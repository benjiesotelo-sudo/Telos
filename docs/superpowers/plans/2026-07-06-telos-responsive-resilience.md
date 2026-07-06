# Responsive Resilience (Slice 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any viewport 320px+, any input, forever - a permanent overflow auditor, hover gated on capability, sticky-rail assertion, a tablet project, and 30 visual baselines.

**Architecture:** The R1 audit is not a one-off script - it ships as `tests/e2e/responsive.spec.ts`, a permanent Playwright spec that walks the five deterministic screens at seven widths asserting zero horizontal overflow (plus the sticky-rail check). Visual baselines live in a separate `visual` project with reduced-motion emulation. CSS fixes are audit-driven and minimal.

**Tech Stack:** Playwright (projects: desktop, mobile, tablet, responsive, visual), CSS media/capability queries. No app-logic changes.

**Spec:** `docs/superpowers/specs/2026-07-06-telos-responsive-resilience-design.md`.

## Global Constraints

- Owner's uncommitted working-tree files (SemCanvas.*, docs/test-documentation/*, tests/docs/document-tests.spec.ts, untracked docs) - NEVER touch/stage; `git add` only files you edit; plain commit messages, no trailers.
- House rule (spec R1): the page body NEVER scrolls horizontally at any width >= 320px; wide content scrolls inside its own container.
- No app-behavior changes: this slice is CSS + tests only (the only .tsx edits allowed are className/style-level fixes the R1 audit demands - report any that feel bigger as BLOCKED).
- Baselines are committed assets; regeneration only via `--update-snapshots` + owner diff approval (spec R3).
- Existing suites stay green: desktop 19, mobile 1. Every task: `npx tsc --noEmit && npm run build` clean before commit.
- Kill stale preview servers before Playwright runs: `lsof -ti:4173 | xargs kill 2>/dev/null`.

## File Map

- T1 `tests/e2e/responsive.spec.ts` (new) + minimal CSS/style fixes it demands - overflow auditor
- T2 `src/styles/tokens.css` - hover:hover gating
- T3 `tests/e2e/responsive.spec.ts` - sticky-rail assertion
- T4 `playwright.config.ts` + `tests/e2e/mobile.spec.ts` (title only) - tablet project
- T5 `tests/e2e/visual.spec.ts` (new) + `tests/e2e/visual.spec.ts-snapshots/` (30 baselines) + `playwright.config.ts` - visual project
- T6 gate

---

### Task 1: The overflow auditor + audit-driven fixes (R1)

**Files:**
- Create: `tests/e2e/responsive.spec.ts`
- Modify: `playwright.config.ts` (add the `responsive` project), plus ONLY the CSS/style fixes the audit demands (expected candidates below)

**Interfaces:**
- Produces: project name `responsive`; helper `walkToConfig(page)` (exported for T3/T5 reuse via a shared module IF T5 wants it - keep it local to each spec for now, specs are self-contained by repo convention).

- [ ] **Step 1: Write the auditor (this IS the failing test)**

`tests/e2e/responsive.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'

const WIDTHS = [320, 390, 560, 680, 834, 1024, 1280]

// The five deterministic screens (no WebR). Returns after test-config is reached with one assignment.
async function walkToConfig(page: Page, assertNoOverflow: (label: string) => Promise<void>) {
  await page.goto('/')
  await assertNoOverflow('welcome')
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/study.csv')
  await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
  await assertNoOverflow('guide')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
  await assertNoOverflow('configure-data')
  await page.getByRole('button', { name: 'Confirm & pick test' }).click()
  await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
  await assertNoOverflow('pick-tests')
  await page.getByRole('checkbox', { name: 'Independent t-test' }).check()
  await page.getByRole('button', { name: 'Confirm selection' }).click()
  await expect(page.getByRole('heading', { name: 'Drag columns into roles' })).toBeVisible()
  // tap-to-assign works at every width and is layout-independent (drags need stable geometry)
  await page.locator('.chip', { hasText: 'score' }).first().tap()
  await page.locator('[data-role="outcome"]').tap()
  await expect(page.locator('[data-role="outcome"] .chip.assigned', { hasText: 'score' })).toBeVisible()
  await assertNoOverflow('test-config')
}

for (const width of WIDTHS) {
  test(`no horizontal overflow at ${width}px on any screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const assertNoOverflow = async (label: string) => {
      await page.waitForTimeout(120) // let wraps settle
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(over, `${label} overflows horizontally by ${over}px at ${width}px`).toBeLessThanOrEqual(0)
    }
    await walkToConfig(page, assertNoOverflow)
  })
}
```

- [ ] **Step 2: Add the project** - in `playwright.config.ts` projects array append:

```ts
    { name: 'responsive', testMatch: '**/responsive.spec.ts', use: { hasTouch: true } },
```
AND add `'**/responsive.spec.ts'` to the desktop project's `testIgnore` (make it an array: `testIgnore: ['**/mobile.spec.ts', '**/responsive.spec.ts']`).

- [ ] **Step 3: RED** - `npx playwright test --project=responsive` and RECORD which width/screen pairs fail (expected suspects: the test-config pool/slots row - `src/components/DragSlots.tsx` renders `<div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>` with two flex children and NO wrap; at 320-560px this can force overflow).

- [ ] **Step 4: Fix ONLY what failed.** Candidate recipes (apply the ones the audit demands, adapt values to the real failure):
- DragSlots pool/slots row: `style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}` and give the two children a min basis so they stack when squeezed: pool `style={{ flex: '1 1 260px', marginTop: 0 }}`, slots wrapper `style={{ flex: '1.2 1 280px' }}`.
- Any other offender: prefer a container-level `flexWrap`/`minWidth: 0`/`overflow-x: auto` (inner container, never the body) in tokens.css or the inline style; record each fix in the report.
- [ ] **Step 5: GREEN** - `npx playwright test --project=responsive` 7/7; `npx vitest run src/components/` still green (DragSlots markup assertions); `npx tsc --noEmit && npm run build`.
- [ ] **Step 6: Commit** - `git add tests/e2e/responsive.spec.ts playwright.config.ts <fixed files> && git commit -m "test(responsive): permanent 7-width overflow auditor + audit-driven layout fixes (R1)"`

---

### Task 2: Capability-gated hover affordances (R2)

**Files:**
- Modify: `src/styles/tokens.css:132-133`

- [ ] **Step 1: Replace** the two rail-affordance rules:

```css
.stage-btn:not(:disabled):hover .lbl,.stage-btn:focus-visible .lbl{text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--accent);}
.stage-btn:not(:disabled):hover .node{transform:translateY(-1px);}
```
with focus-visible kept universal and hover gated on real hover capability:

```css
.stage-btn:focus-visible .lbl{text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--accent);}
@media (hover: hover){
  .stage-btn:not(:disabled):hover .lbl{text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--accent);}
  .stage-btn:not(:disabled):hover .node{transform:translateY(-1px);}
}
```
Audit for other `:hover` rules: `grep -n ":hover" src/styles/tokens.css` - gate any remaining hover-only affordance the same way (as of writing, 132-133 are the only ones; `.slot.over` and `.shelf.echo` are JS/dnd-driven states, NOT CSS hover - leave them).

- [ ] **Step 2: Verify + commit** - `npx tsc --noEmit && npm run build`; `git add src/styles/tokens.css && git commit -m "fix(responsive): hover affordances gated on hover-capable devices - iPads are wide AND touch (R2)"`

---

### Task 3: Sticky-rail assertion (R4)

**Files:**
- Modify: `tests/e2e/responsive.spec.ts` (append one test)

- [ ] **Step 1: Append**

```ts
test('the rail stays stuck to the top when a tall screen scrolls (R4)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 }) // short viewport forces scrolling on test-config
  await walkToConfig(page, async () => {})
  await page.mouse.wheel(0, 2000)
  await page.waitForTimeout(200)
  const rail = page.getByRole('navigation', { name: 'Progress' })
  await expect(rail).toBeVisible()
  const box = (await rail.boundingBox())!
  expect(box.y, 'rail must remain pinned at the top while scrolled').toBeGreaterThanOrEqual(-1)
  expect(box.y).toBeLessThanOrEqual(40)
  const scrolled = await page.evaluate(() => window.scrollY)
  expect(scrolled, 'the page must actually have scrolled for this test to mean anything').toBeGreaterThan(100)
})
```

- [ ] **Step 2: RED-check the guard, GREEN the test** - temporarily verify the test would catch the old bug ONLY by reasoning (the wrapper-div regression made box.y go negative off-screen; do not reintroduce it); run `npx playwright test --project=responsive` - all green including the new test.
- [ ] **Step 3: Commit** - `git add tests/e2e/responsive.spec.ts && git commit -m "test(responsive): sticky rail asserted under scroll (R4)"`

---

### Task 4: Tablet project (R5)

**Files:**
- Modify: `playwright.config.ts`, `tests/e2e/mobile.spec.ts` (test title only)

- [ ] **Step 1: Config** - append to projects:

```ts
    { name: 'tablet', testMatch: '**/mobile.spec.ts', use: { viewport: { width: 834, height: 1112 }, isMobile: true, hasTouch: true } },
```
(desktop already ignores mobile.spec.ts; the responsive project matches only its own file - no cross-matching.)

- [ ] **Step 2: Title** - in `tests/e2e/mobile.spec.ts` rename the test from mentioning "mobile" to device-neutral: `test('touch journey: upload → configure → pick → tap-to-assign → run gate enabled', ...)` (the SAME spec now runs at phone and tablet sizes). Verify the spec's assertions hold at 834px: `.subdot:visible` count-0 assertion is width-dependent (subdots HIDE under 560px only) - at 834px subdots ARE visible, so guard that assertion by viewport: `const { width } = page.viewportSize()!; if (width < 560) { await expect(page.locator('.subdot').first()).not.toBeVisible() }` (replace the unconditional form; same for the thread-frac visibility check, which is mobile-only). Single-test pills assertion etc. are width-independent - leave.
- [ ] **Step 3: Verify** - `npx playwright test --project=tablet --project=mobile` -> 2/2 green. `npx tsc --noEmit`.
- [ ] **Step 4: Commit** - `git add playwright.config.ts tests/e2e/mobile.spec.ts && git commit -m "test(responsive): permanent tablet project runs the touch journey at 834x1112 (R5)"`

---

### Task 5: Visual-regression baselines (R3)

**Files:**
- Create: `tests/e2e/visual.spec.ts` + committed `tests/e2e/visual.spec.ts-snapshots/` (30 PNGs)
- Modify: `playwright.config.ts`

- [ ] **Step 1: Config** - append to projects:

```ts
    { name: 'visual', testMatch: '**/visual.spec.ts', use: { contextOptions: { reducedMotion: 'reduce' } } },
```
and add `'**/visual.spec.ts'` to the desktop testIgnore array. Also add a top-level screenshot tolerance to the config object (sibling of `use`):

```ts
  expect: { toHaveScreenshot: { maxDiffPixels: 200 } },
```

- [ ] **Step 2: The spec** - `tests/e2e/visual.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test'

// Spec R3: 5 deterministic screens x 3 viewports x 2 themes = 30 committed baselines.
// Results screens excluded (WebR figure rendering is not pixel-deterministic).
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'phone', width: 390, height: 844 },
]
const THEMES = ['light', 'dark'] as const

async function setTheme(page: Page, theme: string) {
  await page.locator('.theme-select').selectOption(theme === 'light' ? 'light' : 'dark')
  await page.waitForTimeout(150)
}

for (const vp of VIEWPORTS) for (const theme of THEMES) {
  test(`baselines: ${vp.name} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const snap = (label: string) =>
      expect(page).toHaveScreenshot(`${label}-${vp.name}-${theme}.png`, { fullPage: true })

    await page.goto('/')
    await setTheme(page, theme)
    await snap('welcome')
    await page.getByRole('button', { name: 'Get started' }).click()
    await page.setInputFiles('input[type=file]', 'tests/e2e/fixtures/study.csv')
    await expect(page.getByRole('heading', { name: 'Terms guide' })).toBeVisible()
    await snap('guide')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { name: 'Configure data' })).toBeVisible()
    await snap('configure-data')
    await page.getByRole('button', { name: 'Confirm & pick test' }).click()
    await expect(page.getByRole('heading', { name: 'Pick a test' })).toBeVisible()
    await snap('pick-tests')
    await page.getByRole('checkbox', { name: 'Independent t-test' }).check()
    await page.getByRole('button', { name: 'Confirm selection' }).click()
    await expect(page.getByRole('heading', { name: 'Drag columns into roles' })).toBeVisible()
    await page.locator('.chip', { hasText: 'score' }).first().click()
    await page.locator('[data-role="outcome"]').click()
    await expect(page.locator('[data-role="outcome"] .chip.assigned', { hasText: 'score' })).toBeVisible()
    await snap('test-config')
  })
}
```
Note `click()` not `tap()` here: the visual project has no `hasTouch`, and tap-to-assign works with any pointer - clicks keep this project touch-agnostic.
Note the hint bar: it renders on the first post-welcome screen and WILL be in the guide/configure-data baselines - that is the accepted design (first-run state); its presence must be deterministic (fresh context per test = sessionStorage empty = hint always present). Fine.

- [ ] **Step 3: Generate baselines** - `npx playwright test --project=visual --update-snapshots` -> creates 30 PNGs under `tests/e2e/visual.spec.ts-snapshots/`. Inspect a few (Read the welcome + test-config ones) - they must look like the accepted design, no half-rendered fonts (the `waitForTimeout(150)` after theme + reduced motion should suffice; if fonts race, add `await page.evaluate(() => document.fonts.ready)` before the first snap).
- [ ] **Step 4: Verify determinism** - run WITHOUT the flag twice: `npx playwright test --project=visual` x2 -> 6/6 both times. If flaky pixels appear, bump per-call `maxDiffPixels` only as far as needed and record it.
- [ ] **Step 5: Commit** - `git add tests/e2e/visual.spec.ts tests/e2e/visual.spec.ts-snapshots playwright.config.ts && git commit -m "test(visual): 30 design baselines - 5 screens x 3 viewports x 2 themes, reduced-motion determinism (R3)"`

---

### Task 6: Full gate

- [ ] **Step 1:** `npm run test:fast` - all green.
- [ ] **Step 2:** `npx tsc --noEmit && npm run build` - clean.
- [ ] **Step 3:** `npx playwright test` - ALL projects: desktop 19 + mobile 1 + tablet 1 + responsive 8 + visual 6 = 35 expected.
- [ ] **Step 4:** Fresh-clone: clone to /tmp, `npm ci && npm run test:fast && npm run build` (baselines travel in the clone; do NOT run playwright there - the visual compare needs the same machine's renderer anyway and the main checkout already proved it).
- [ ] **Step 5:** Report gate numbers + the audit's found-and-fixed list for the ratify note.
