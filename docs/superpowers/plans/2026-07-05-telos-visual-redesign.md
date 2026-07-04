# Telos Visual Redesign (Anthropic Tribute) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin and re-choreograph the whole app to the approved direction C - Anthropic palette, inverted type roles, stage-rail wayfinding, narrated run module - without touching statistics, engine, export content, or APA table structure.

**Architecture:** All color/type flows through the existing `tokens.css` variable seam. New presentation components follow the repo's props-based `*UI` + connected-wrapper idiom (zustand 5's SSR snapshot ignores seeded state under `renderToStaticMarkup`, so only props components are unit-testable). Wayfinding logic becomes a pure `railModel` helper; the run narration reads the existing `runPhase`/`runProgress` store channel.

**Tech Stack:** React 18, zustand, dnd-kit, vitest + `renderToStaticMarkup`, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-04-telos-visual-redesign-design.md` (read it first). Mockup references: artifacts 27e2288d (C v2), de9fc34b (stage rail), c9d33ec7 (four decisions).

## Global Constraints

- Palette verbatim (spec R1): light `--bg:#faf9f5` `--card:#ffffff` `--text:#141413` `--muted:#6e6c64` line `rgba(20,20,19,.16)` fill `#e8e6dc`; dark `--bg:#141413` `--card:#211f1c` `--text:#faf9f5` `--muted:#b0aea5` line `rgba(250,249,245,.16)`; accent `#d97757`, deep accent `#a44a2e` (small text/strokes on light), soft `#f6e3db` (dark soft `#3d2a22`); sky `#6a9bcc` and olive `#788c5d` are figure/semantic colors only, never actions.
- Type roles (R6): Archivo = display + UI (`--font-display`, `--font-ui`); Crimson Pro = prose only (`--font-prose`); mono stack for tabular numerics. Atkinson Hyperlegible retires.
- No component hardcodes a hex; everything reads tokens.
- Preserve these DOM contracts (e2e depends on them): `nav[aria-label="Progress"]` containing `button`s whose accessible names include each test's short name and each stage label; classes `.chip`, `.chip.assigned`, `.chip.incompatible`, `[data-role=...]`, `.eyebrow`, `.title`, `.card`, `.btn`, `.pill`, `.slot`, `.hint`, `.error-box`, `table.apa` and `#table-*` ids; heading texts unchanged.
- `WELCOME_COPY`, `TERMS_COPY` constants unchanged (copy.consistency pins them); all NEW user-facing strings go in `src/content/copy.ts`; new copy never uses the em dash "—".
- APA table structure (columns, rules, stacked rows) unchanged - colors only. SEM canvas/picker recolor only. print.css untouched except tokens it already reads.
- `prefers-reduced-motion: reduce` disables every transition/animation added by this plan.
- Every task: `npx tsc --noEmit` 0 errors and `npx eslint <touched files>` 0 new problems before committing.
- Stats, runners, exports, engine: out of scope; if a task seems to need them, STOP and report BLOCKED.

## File Map

- `public/fonts/` + `src/styles/tokens.css` - Archivo faces + full token/component rewrite (Tasks 1-2)
- `src/state/stages.ts` (new) - pure rail model (Task 3)
- `src/components/Stepper.tsx` - becomes the stage rail (`StepperUI` + connected `Stepper`) (Task 4)
- `src/components/RunModule.tsx` (new) - narrated progress (Task 5), integrated in `ResultsScreen` (Task 6)
- `src/components/screens/WelcomeScreen.tsx` + `src/content/copy.ts` (Task 7)
- `src/lib/registry/optionGroups.ts` (new) + `src/components/OptionRows.tsx` (new) + `TestConfigScreen.tsx` (Task 8)
- `src/components/DragSlots.tsx` + `src/lib/eligibility/poolShelves.ts` (hover echo) (Task 9)
- Remaining screens + `licenses.ts` font credit (Task 10)
- Contrast audit script (Task 11), motion audit (Task 12), full gate (Task 13)

---

### Task 1: Archivo fonts, self-hosted

**Files:**
- Create: `public/fonts/OFL-Archivo.txt` + three Archivo woff2 files
- Modify: `src/styles/tokens.css:1-3` (@font-face block only), `src/lib/export/licenses.ts:61-66`
- Test: `src/lib/export/licenses.test.ts` (or wherever `licensesText` is asserted - `grep -rln "licensesText" src`)

**Interfaces:**
- Produces: `@font-face` families `'Archivo'` weights 400/600/700; Crimson Pro faces kept; Atkinson faces removed.

- [ ] **Step 1: Download Archivo woff2 (Google Fonts needs a FULL Chrome UA or it serves TTF)**

```bash
cd /Users/benjie/Documents/Telos
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
curl -s -A "$UA" 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700&display=swap' -o /tmp/archivo.css
grep -o 'https://[^)]*latin[^)]*woff2\|https://fonts.gstatic.com[^)]*.woff2' /tmp/archivo.css | sort -u
```
Download each printed latin-subset URL (one per weight) into `public/fonts/` keeping the gstatic basename, e.g. `curl -s -A "$UA" -o public/fonts/<basename>.woff2 '<url>'`. Verify: `file public/fonts/<each>.woff2` reports "Web Open Font Format 2".
Fetch the OFL text: `curl -s https://raw.githubusercontent.com/Omnibus-Type/Archivo/master/OFL.txt -o public/fonts/OFL-Archivo.txt` (verify non-empty and mentions "SIL OPEN FONT LICENSE").

- [ ] **Step 2: Swap the @font-face block in `src/styles/tokens.css`**

Replace lines 1-3 (the three existing @font-face lines) with (substitute the real basenames):

```css
@font-face{font-family:'Crimson Pro';font-weight:600;font-display:swap;src:url('/fonts/q5uDsoa5M_tv7IihmnkabARboYF6CsKj.woff2') format('woff2');}
@font-face{font-family:'Archivo';font-weight:400;font-display:swap;src:url('/fonts/<archivo-400>.woff2') format('woff2');}
@font-face{font-family:'Archivo';font-weight:600;font-display:swap;src:url('/fonts/<archivo-600>.woff2') format('woff2');}
@font-face{font-family:'Archivo';font-weight:700;font-display:swap;src:url('/fonts/<archivo-700>.woff2') format('woff2');}
```

Keep the Crimson Pro 600 face; ALSO add a Crimson Pro 400 face if a regular-weight file exists in `public/fonts` (check the `q5uD*` files with `file` - there are three; the two non-600 ones are regular/italic from the original download; wire the regular one at weight 400). Delete the two Atkinson `9Bt*` @font-face lines. Delete the `9Bt*` woff2 files and `OFL-AtkinsonHyperlegible.txt` with `git rm`.

- [ ] **Step 3: Update the font credit in `src/lib/export/licenses.ts`**

Replace lines 64-65:
```ts
  lines.push('  Atkinson Hyperlegible — Copyright 2020 Braille Institute of America, Inc.')
  lines.push('  https://www.brailleinstitute.org/freefont')
```
with:
```ts
  lines.push('  Archivo — Copyright 2019 Omnibus-Type')
  lines.push('  https://github.com/Omnibus-Type/Archivo')
```
(Keep the em dashes here: this file's list style already uses them; the no-em-dash rule is for NEW user-facing app copy.)

- [ ] **Step 4: Fix any test pinning the old credit**

Run: `npx vitest run $(grep -rln "licensesText\|Atkinson" src --include="*.test.*" | tr '\n' ' ')`
If a test asserts the Atkinson line, update the assertion to the Archivo line verbatim. Expected: PASS after edit.

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npm run build` - 0 errors, build green (fonts are static assets; build failure = bad path).
```bash
git add public/fonts src/styles/tokens.css src/lib/export/licenses.ts
git commit -m "feat(redesign): self-host Archivo (OFL), retire Atkinson, update font credits"
```

---

### Task 2: Token + component-language rewrite (`tokens.css`)

**Files:**
- Modify: `src/styles/tokens.css` (everything below the @font-face block)

**Interfaces:**
- Produces (later tasks rely on these class names/vars): `--font-prose`, `--accent-deep`, `--accent-soft`, `--good`(olive), `--info`(sky), `--fill`, `--motion` (duration), classes `.btn` (pill), `.btn.ghost`, `.pill`, `.pill.on`, `.chip`, `.chip.assigned`, `.slot`, `.slot.over`, `.shelf`, `.shelf.off`, `.shelf.echo`, `.opt-group`, `.opt-label`, `.run-card`, `.run-track`, `.run-fill`, `.run-fill.indeterminate`, `.rail`, `.rail-track`, `.rail-fill`, `.stage`, `.stage .node`, `.stage.done/.current/.todo`, `.stage .subdots`, `.stage .subdot`, `.stage .sublabel`, `.credit-line`, `.prose`.

- [ ] **Step 1: Replace the token blocks**

Replace the current `:root`/theme blocks (lines 4-17 of the old file) with:

```css
:root{ --bg:#faf9f5; --card:#fff; --text:#141413; --muted:#6e6c64; --line:rgba(20,20,19,.16); --fill:#e8e6dc;
  --accent:#d97757; --accent-deep:#a44a2e; --accent-contrast:#faf9f5; --accent-soft:#f6e3db;
  --info:#6a9bcc; --good:#788c5d; --disabled:#b0aea5;
  --error-bg:#f9ede8; --error-line:#d9a08c; --error-tx:#8c3a1d;
  --font-display:'Archivo',system-ui,sans-serif; --font-ui:'Archivo',system-ui,sans-serif;
  --font-prose:'Crimson Pro',Georgia,serif; --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --motion:200ms; }
:root[data-theme=dark]{ --bg:#141413; --card:#211f1c; --text:#faf9f5; --muted:#b0aea5; --line:rgba(250,249,245,.16); --fill:#2a2825;
  --accent:#d97757; --accent-deep:#d97757; --accent-contrast:#141413; --accent-soft:#3d2a22;
  --disabled:#57554e; --error-bg:#3a2620; --error-line:#7a3a24; --error-tx:#f0b9a0; }
@media (prefers-color-scheme:dark){ :root[data-theme=auto]{ --bg:#141413; --card:#211f1c; --text:#faf9f5; --muted:#b0aea5; --line:rgba(250,249,245,.16); --fill:#2a2825;
  --accent:#d97757; --accent-deep:#d97757; --accent-contrast:#141413; --accent-soft:#3d2a22;
  --disabled:#57554e; --error-bg:#3a2620; --error-line:#7a3a24; --error-tx:#f0b9a0; } }
```

Note: the SECOND legacy `:root` accent block (old lines 15-17) is deleted - accents now live in the single block above. Search the file for `#185fa5|#9cc2ec|#e8f0fe|#0c447c` afterwards: zero hits allowed.

- [ ] **Step 2: Restyle the component classes in place**

Keep every selector name; change declarations. The full replacement for the classes below (leave `table.apa`, `.cols-table`, `.mono`, coef/matrix rules untouched except that they already read `var(--text)`):

```css
*{box-sizing:border-box;} html{scroll-padding-top:76px;}
body{margin:0;font-family:var(--font-ui);background:var(--bg);color:var(--text);line-height:1.55;}
.theme-select{position:fixed;top:10px;right:12px;z-index:30;font-size:11px;color:var(--muted);background:var(--card);border:1px solid var(--line);border-radius:999px;padding:4px 10px;font-family:var(--font-ui);}
.screen{max-width:760px;margin:0 auto;padding:24px 16px 64px;}
.eyebrow{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;font-weight:600;}
.title{font-family:var(--font-display);font-size:27px;font-weight:650;letter-spacing:-.015em;margin:4px 0 14px;}
.prose{font-family:var(--font-prose);font-size:15.5px;line-height:1.7;}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin:10px 0;}
.btn{border:0;border-radius:999px;padding:10px 24px;font-size:14px;font-weight:600;font-family:var(--font-ui);cursor:pointer;background:var(--text);color:var(--bg);transition:transform var(--motion) ease-out,opacity var(--motion) ease-out;}
.btn:not(:disabled):active{transform:scale(.98);}
.btn:disabled{background:var(--disabled);color:var(--bg);cursor:not-allowed;}
.btn.ghost{background:transparent;color:var(--text);box-shadow:inset 0 0 0 1.3px var(--line);}
.btn.ghost:disabled{color:var(--disabled);box-shadow:inset 0 0 0 1.3px var(--disabled);background:transparent;}
.btn-row{display:flex;justify-content:flex-end;align-items:center;gap:12px;margin-top:14px;}
.hint{font-size:12px;color:var(--muted);}
.pill{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:3px 13px;font-size:13px;color:var(--muted);}
.pill.on{background:var(--text);border-color:var(--text);color:var(--bg);font-weight:600;}
.error-box{background:var(--error-bg);border:1px solid var(--error-line);border-radius:10px;padding:9px 13px;font-size:13px;color:var(--error-tx);margin-top:10px;font-family:var(--font-prose);}
.chip{background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:3.5px 13px;font-size:13px;display:inline-block;transition:background var(--motion) ease-out,border-color var(--motion) ease-out;}
.chip.assigned{background:var(--accent-soft);border-color:var(--accent);color:var(--accent-deep);font-weight:600;}
.chip.incompatible{opacity:.45;}
.chip .tag{font-family:var(--mono);font-size:10px;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:0 4px;margin-left:5px;vertical-align:1px;}
.slot{background:var(--card);border:1.4px dashed var(--line);border-radius:11px;padding:9px 13px;margin:8px 0;font-size:13px;transition:border-color var(--motion) ease-out,background var(--motion) ease-out;}
.slot.over{border-color:var(--accent);border-style:solid;background:var(--accent-soft);}
.shelf{margin-top:10px;padding-top:8px;border-top:1px solid var(--line);transition:opacity var(--motion) ease-out;}
.eyebrow + .shelf{margin-top:6px;padding-top:0;border-top:0;}
.shelf-head{font-size:11px;color:var(--text);text-transform:uppercase;letter-spacing:.09em;font-weight:700;}
.shelf-head .count{color:var(--muted);font-weight:400;font-family:var(--mono);}
.shelf-head .note{color:var(--muted);font-weight:400;text-transform:none;letter-spacing:0;font-style:italic;}
.shelf.off .shelf-head,.shelf.off .pool{opacity:.5;}
.shelf.echo .shelf-head{color:var(--accent-deep);}
.shelf .teach{margin:6px 0 0;font-family:var(--font-prose);font-style:italic;}
.pool{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;}
.opt-group{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}
.opt-label{font-size:10px;letter-spacing:.09em;text-transform:uppercase;font-weight:700;color:var(--muted);min-width:86px;}
.run-card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin-top:14px;}
.run-top{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;font-weight:650;}
.run-top .pct{font-family:var(--mono);font-weight:400;color:var(--muted);font-size:12px;}
.run-track{height:8px;border-radius:999px;background:var(--fill);overflow:hidden;margin:9px 0 10px;}
.run-fill{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--accent),var(--accent-deep));transition:width var(--motion) ease-out;}
.run-fill.indeterminate{width:35%;animation:run-slide 1.6s ease-in-out infinite;}
@keyframes run-slide{0%{margin-left:-35%}100%{margin-left:100%}}
.run-phases{display:flex;gap:15px;font-size:11.5px;color:var(--muted);flex-wrap:wrap;}
.run-phases .ok{color:var(--good);font-weight:700;}
.run-phases .now{color:var(--accent-deep);font-weight:650;}
.run-phases .todo{opacity:.55;}
.rail{position:sticky;top:0;z-index:20;background:var(--bg);max-width:640px;margin:0 auto 8px;padding:12px 4px 14px;box-shadow:0 6px 8px -6px rgba(0,0,0,.14);}
.rail-track{position:relative;height:2px;background:var(--fill);border-radius:999px;margin:13px 10px 0;}
.rail-fill{position:absolute;left:0;top:0;bottom:0;background:var(--accent);border-radius:999px;transition:width var(--motion) ease-out;}
.rail .stages{display:flex;justify-content:space-between;margin-top:-12px;position:relative;}
.stage{display:flex;flex-direction:column;align-items:center;gap:5px;font-size:11px;color:var(--muted);background:none;border:0;padding:0 6px;font-family:var(--font-ui);cursor:default;}
.stage:not(:disabled){cursor:pointer;}
.stage .node{width:23px;height:23px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;background:var(--bg);border:1.4px solid var(--line);color:var(--muted);transition:background var(--motion) ease-out,box-shadow var(--motion) ease-out;}
.stage.done .node{background:var(--accent);border-color:var(--accent);color:var(--accent-contrast);}
.stage.current{color:var(--text);font-weight:650;}
.stage.current .node{border-color:var(--accent);color:var(--accent-deep);box-shadow:0 0 0 4px var(--accent-soft);}
.stage .subdots{display:flex;gap:5px;margin-top:1px;}
.stage .subdot{width:7px;height:7px;border-radius:50%;background:var(--fill);border:0;padding:0;cursor:pointer;}
.stage .subdot.done{background:var(--accent);}
.stage .subdot.current{background:var(--bg);border:1.3px solid var(--accent);}
.stage .subdot:disabled{cursor:default;}
.stage .sublabel{font-size:10px;color:var(--muted);font-weight:400;}
.rail .thread-frac{display:none;font-family:var(--mono);font-size:11px;color:var(--muted);}
@media (max-width:560px){ .stage span.lbl{display:none} .stage.current span.lbl{display:inline} .rail .thread-frac{display:inline} }
.credit-line{font-size:11px;color:var(--muted);border-top:1px solid var(--line);padding-top:12px;margin-top:26px;display:inline-block;}
.credit-line b{color:var(--accent-deep);font-weight:600;}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px;}
@media (prefers-reduced-motion:reduce){ *,*::before,*::after{transition:none!important;animation:none!important;} }
```

Delete the old `.stepper`, `.step`, `.step .dot`, `.connector` rules (the rail replaces them - Task 4 lands the component in the same commit series; the app is allowed to look unstyled on the stepper between Tasks 2 and 4 only if Tasks 2-4 are committed before any gate run; run `npm run dev` only after Task 4).

- [ ] **Step 3: Verify no stray hexes and commit**

Run: `grep -n "185fa5\|9cc2ec\|e8f0fe\|0c447c\|f0efe9\|2c2c2a\|5f5e5a\|Atkinson" src/styles/tokens.css` - expected: no output.
Run: `npx tsc --noEmit && npx vitest run src/content/copy.consistency.test.ts` - PASS.
```bash
git add src/styles/tokens.css
git commit -m "feat(redesign): direction-C tokens + component language (palette, pills, rail/run classes, motion, reduced-motion)"
```

---

### Task 3: `railModel` - pure stage derivation

**Files:**
- Create: `src/state/stages.ts`
- Test: `src/state/stages.test.ts`

**Interfaces:**
- Consumes: `stepsOf(s)`, `canEnter(s, step)`, `SPECS`/`CATALOG` short names, `s.step`, `s.runStatus`, `s.runPhase`, `s.selection`.
- Produces:
```ts
export interface SubDot { step: string; label: string; state: 'done' | 'current' | 'todo'; enabled: boolean }
export interface Stage { id: 'upload' | 'data' | 'pick' | 'configure' | 'results'; label: string;
  state: 'done' | 'current' | 'todo'; enabled: boolean; firstStep: string | null;
  sub: SubDot[]; sublabel: string | null }
export interface RailModel { stages: Stage[]; fraction: number; frac: string }
export function railModel(s: SessionState): RailModel
```

- [ ] **Step 1: Write the failing test**

`src/state/stages.test.ts`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSession } from './session'
import { railModel } from './stages'
import type { Dataset } from '../lib/stats/types'

vi.mock('../lib/webr/getEngine', () => ({ getEngine: vi.fn(async () => ({} as never)) }))

const ds: Dataset = { columns: ['group', 'score'], rows: [
  { group: 'control', score: 72 }, { group: 'control', score: 68 }, { group: 'control', score: 75 },
  { group: 'treatment', score: 81 }, { group: 'treatment', score: 79 }, { group: 'treatment', score: 85 },
] }
const load = () => useSession.getState().loadDataset(ds, { name: 'study.csv', rows: 6, cols: 2, encoding: 'UTF-8' })

describe('railModel', () => {
  beforeEach(() => { useSession.getState().reset() })

  it('always yields the five stages in order', () => {
    const m = railModel(useSession.getState())
    expect(m.stages.map((st) => st.id)).toEqual(['upload', 'data', 'pick', 'configure', 'results'])
    expect(m.stages.map((st) => st.label)).toEqual(['Upload', 'Data', 'Pick tests', 'Configure', 'Results'])
  })

  it('maps guide + configure-data into the Data stage and marks done/current/todo correctly', () => {
    load(); useSession.getState().visitGuide(); useSession.getState().goTo('configure-data')
    const m = railModel(useSession.getState())
    expect(m.stages[0].state).toBe('done')      // upload
    expect(m.stages[1].state).toBe('current')   // data (currently on configure-data)
    expect(m.stages[2].state).toBe('todo')
  })

  it('per-test sub-dots live in Configure with a plain-words counter', () => {
    load(); useSession.getState().visitGuide(); useSession.getState().toggleSelection('independent-t-test')
    useSession.getState().toggleSelection('one-way-anova')
    useSession.getState().goTo('pick-tests')
    useSession.getState().goTo('test:one-way-anova')
    const m = railModel(useSession.getState())
    const cfg = m.stages[3]
    expect(cfg.state).toBe('current')
    expect(cfg.sub).toHaveLength(2)
    expect(cfg.sub[0].state).toBe('done')
    expect(cfg.sub[1].state).toBe('current')
    expect(cfg.sublabel).toMatch(/2 of 2/)
  })

  it('fraction advances with the journey and stages disable while running', () => {
    load(); useSession.getState().visitGuide()
    const before = railModel(useSession.getState()).fraction
    useSession.getState().goTo('configure-data')
    const after = railModel(useSession.getState()).fraction
    expect(after).toBeGreaterThan(before)
    useSession.setState({ runStatus: 'running' })
    expect(railModel(useSession.getState()).stages.every((st) => !st.enabled)).toBe(true)
  })

  it('welcome yields fraction 0 and Upload current', () => {
    const m = railModel(useSession.getState())
    expect(m.stages[0].state).toBe('current')
    expect(m.fraction).toBe(0)
  })

  it('while running, Results carries the counter and the fill tracks run progress (spec R3/§3)', () => {
    load(); useSession.getState().visitGuide(); useSession.getState().toggleSelection('independent-t-test')
    useSession.getState().toggleSelection('one-way-anova')
    useSession.setState({ step: 'results', runStatus: 'running', runPhase: 'Running Independent t-test…' })
    const m = railModel(useSession.getState())
    expect(m.stages[4].sublabel).toBe('running · test 1 of 2')
    expect(m.fraction).toBeGreaterThan(0.7) // inside the final segment
    expect(m.fraction).toBeLessThan(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails** - `npx vitest run src/state/stages.test.ts` - FAIL: cannot resolve `./stages`.

- [ ] **Step 3: Implement `src/state/stages.ts`**

```tsx
import { stepsOf, canEnter, type SessionState } from './session'
import { CATALOG } from '../lib/registry/catalog'

export interface SubDot { step: string; label: string; state: 'done' | 'current' | 'todo'; enabled: boolean }
export interface Stage { id: 'upload' | 'data' | 'pick' | 'configure' | 'results'; label: string;
  state: 'done' | 'current' | 'todo'; enabled: boolean; firstStep: string | null;
  sub: SubDot[]; sublabel: string | null }
export interface RailModel { stages: Stage[]; fraction: number; frac: string }

const GROUPS: [Stage['id'], string, (st: string) => boolean][] = [
  ['upload', 'Upload', (st) => st === 'upload'],
  ['data', 'Data', (st) => st === 'guide' || st === 'configure-data'],
  ['pick', 'Pick tests', (st) => st === 'pick-tests'],
  ['configure', 'Configure', (st) => st.startsWith('test:')],
  ['results', 'Results', (st) => st === 'results'],
]

const shortName = (testId: string) => {
  const c = CATALOG.find((x) => x.id === testId)
  return c?.short ?? c?.name ?? testId
}

/** Presentation model for the stage rail. Pure: navigation gates stay in canEnter/goTo. */
export function railModel(s: SessionState): RailModel {
  const steps = stepsOf(s).filter((st) => st !== 'welcome')
  const cur = s.step === 'welcome' ? -1 : steps.indexOf(s.step)
  const running = s.runStatus === 'running'
  const stages = GROUPS.map(([id, label, match]): Stage => {
    const own = steps.map((st, i) => [st, i] as const).filter(([st]) => match(st))
    const idxs = own.map(([, i]) => i)
    const state: Stage['state'] = !idxs.length || cur < idxs[0]
      ? (id === 'upload' && cur <= 0 && (cur === 0 || s.step === 'welcome') ? 'current' : 'todo')
      : cur > idxs[idxs.length - 1] ? 'done' : 'current'
    const firstEnterable = own.find(([st]) => canEnter(s, st as never))?.[0] ?? null
    const sub: SubDot[] = id !== 'configure' ? [] : own.map(([st, i]) => ({
      step: st, label: shortName(st.slice(5)),
      state: i < cur ? 'done' : i === cur ? 'current' : 'todo',
      enabled: !running && canEnter(s, st as never),
    }))
    const curSub = sub.findIndex((d) => d.state === 'current')
    const sublabel = state === 'current' && curSub >= 0 ? `${sub[curSub].label} · ${curSub + 1} of ${sub.length}` : null
    return { id, label, state, enabled: !running && firstEnterable !== null, firstStep: firstEnterable, sub, sublabel }
  })
  // welcome: Upload reads as current (the journey's door), nothing done
  if (cur === -1) stages[0].state = 'current'
  let fraction = steps.length > 1 ? Math.max(0, cur) / (steps.length - 1) : 0
  // spec §3: while a run is active the rail fill IS the live progress line and Results carries the counter
  if (running) {
    const total = s.selection.length
    const done = s.selection.filter((id) => s.runs[id] && !s.runs[id].stale).length
    stages[4].sublabel = `running · test ${Math.min(done + 1, Math.max(total, 1))} of ${Math.max(total, 1)}`
    if (steps.length > 1) fraction = (steps.length - 2 + (total ? done / total : 0)) / (steps.length - 1)
  }
  return { stages, fraction, frac: `${Math.max(0, cur) + 1} / ${steps.length}` }
}
```

Note on the `state` expression: simplify while implementing if a cleaner equivalent passes the tests; the tests are the contract, not this exact ternary. `canEnter`'s parameter type may require a cast (`as never` shown) - match the real signature from `session.ts`.

- [ ] **Step 4: Run to verify PASS** - `npx vitest run src/state/stages.test.ts` (5 tests). Then `npx tsc --noEmit`.

- [ ] **Step 5: Commit** - `git add src/state/stages.ts src/state/stages.test.ts && git commit -m "feat(redesign): railModel - pure five-stage wayfinding model"`

---

### Task 4: The stage rail (`Stepper.tsx` rewrite)

**Files:**
- Modify: `src/components/Stepper.tsx` (full rewrite; keep the `Stepper` export name - `App.tsx` stays untouched)
- Test: `src/components/Stepper.test.tsx` (new)

**Interfaces:**
- Consumes: `railModel` (Task 3), rail classes (Task 2).
- Produces: `StepperUI({ model, onGo }: { model: RailModel; onGo: (step: string) => void })` and connected `Stepper()`.
- DOM contract (e2e): `<nav className="rail" aria-label="Progress">`; each stage is a `<button className="stage ...">` whose text includes its label; each sub-dot is a `<button className="subdot ..." aria-label={dot.label}>`; `aria-current="step"` on the current stage.

- [ ] **Step 1: Write the failing test**

`src/components/Stepper.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StepperUI } from './Stepper'
import type { RailModel } from '../state/stages'

const model: RailModel = {
  fraction: 0.6, frac: '5 / 7',
  stages: [
    { id: 'upload', label: 'Upload', state: 'done', enabled: true, firstStep: 'upload', sub: [], sublabel: null },
    { id: 'data', label: 'Data', state: 'done', enabled: true, firstStep: 'guide', sub: [], sublabel: null },
    { id: 'pick', label: 'Pick tests', state: 'done', enabled: true, firstStep: 'pick-tests', sub: [], sublabel: null },
    { id: 'configure', label: 'Configure', state: 'current', enabled: true, firstStep: 'test:independent-t-test',
      sub: [
        { step: 'test:independent-t-test', label: 'Independent t', state: 'done', enabled: true },
        { step: 'test:one-way-anova', label: 'One-way ANOVA', state: 'current', enabled: true },
      ], sublabel: 'One-way ANOVA · 2 of 2' },
    { id: 'results', label: 'Results', state: 'todo', enabled: false, firstStep: null, sub: [], sublabel: null },
  ],
}
const html = () => renderToStaticMarkup(<StepperUI model={model} onGo={() => {}} />)

describe('StepperUI (stage rail)', () => {
  it('is the Progress nav with five stage buttons', () => {
    const h = html()
    expect(h).toContain('aria-label="Progress"')
    for (const l of ['Upload', 'Data', 'Pick tests', 'Configure', 'Results']) expect(h).toContain(l)
  })
  it('marks done/current stages and disables unreachable ones', () => {
    const h = html()
    expect(h).toContain('aria-current="step"')
    expect(h.match(/class="stage done"/g)?.length).toBe(3)
    expect(h).toContain('disabled')
  })
  it('renders sub-dots with test-name labels and the counter', () => {
    const h = html()
    expect(h).toContain('aria-label="Independent t"')
    expect(h).toContain('aria-label="One-way ANOVA"')
    expect(h).toContain('One-way ANOVA · 2 of 2')
  })
  it('the fill width follows the fraction and the compact fraction renders', () => {
    const h = html()
    expect(h).toContain('width:60%')
    expect(h).toContain('5 / 7')
  })
})
```

- [ ] **Step 2: Run to verify FAIL** - `npx vitest run src/components/Stepper.test.tsx` - StepperUI not exported.

- [ ] **Step 3: Rewrite `src/components/Stepper.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { useSession } from '../state/session'
import { railModel, type RailModel } from '../state/stages'

export function StepperUI({ model, onGo }: { model: RailModel; onGo: (step: string) => void }) {
  return (
    <nav className="rail" aria-label="Progress">
      <div className="rail-track"><span className="rail-fill" style={{ width: `${Math.round(model.fraction * 100)}%` }} /></div>
      <div className="stages">
        {model.stages.map((st) => (
          <button key={st.id} type="button" className={`stage ${st.state}`} disabled={!st.enabled}
            aria-current={st.state === 'current' ? 'step' : undefined}
            onClick={() => st.firstStep && onGo(st.firstStep)}>
            <span className="node">{st.state === 'done' ? '✓' : model.stages.indexOf(st) + 1}</span>
            <span className="lbl">{st.label}</span>
            {st.sub.length > 0 && (
              <span className="subdots">
                {st.sub.map((d) => (
                  <span key={d.step} role="button" aria-label={d.label} aria-disabled={!d.enabled}
                    className={`subdot ${d.state}`}
                    onClick={(e) => { e.stopPropagation(); if (d.enabled) onGo(d.step) }} />
                ))}
              </span>
            )}
            {st.sublabel && <span className="sublabel">{st.sublabel}</span>}
          </button>
        ))}
      </div>
      <span className="thread-frac">{model.frac}</span>
    </nav>
  )
}

export function Stepper() {
  const s = useSession()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.scrollIntoView({ block: 'nearest' }) }, [s.step])
  if (s.step === 'welcome') return null
  return <div ref={ref}><StepperUI model={railModel(s)} onGo={(step) => s.goTo(step as never)} /></div>
}
```

Nested-button note: sub-dots are `<span role="button">` INSIDE the stage `<button>` because HTML forbids nested buttons - the `role`/`aria-label` keep the e2e contract (`getByRole('button', { name: <test short name> })` matches role=button elements). Nodes show the stage number (1-5) until done, then the check - matching the approved stepper-concepts mockup.

- [ ] **Step 4: Run to verify PASS** - `npx vitest run src/components/Stepper.test.tsx` and `npx vitest run src/state/stages.test.ts`; `npx tsc --noEmit`.

Check the stage-node markup against the test's `class="stage done"` assertion (exact attribute order matters with `renderToStaticMarkup`; adjust the test's regex to `/class="stage done"/g` matching the template literal `stage ${st.state}` output).

- [ ] **Step 5: Eyeball** - `npm run dev`, walk welcome → upload → guide: rail renders, fill advances, no `.step`/`.stepper` leftovers (`grep -rn "className=\"step\|\.stepper" src` - no output). Kill server.

- [ ] **Step 6: Commit** - `git add src/components/Stepper.tsx src/components/Stepper.test.tsx && git commit -m "feat(redesign): stage rail replaces the per-step stepper (StepperUI + railModel wiring)"`

---

### Task 5: RunModule - narrated progress

**Files:**
- Create: `src/components/RunModule.tsx`
- Test: `src/components/RunModule.test.tsx`

**Interfaces:**
- Consumes: run classes from Task 2.
- Produces:
```tsx
export interface RunModuleProps { phase: string | null; progress: { message: string; elapsedMs?: number; estMs?: number } | null; testsDone: number; testsTotal: number }
export function RunModule(props: RunModuleProps): JSX.Element | null
```
Renders null when `phase` is null. Phase list derivation: `engine` = phase not starting with 'Running'; `tests` = phase starting with 'Running'. Four fixed narrated phases: 'Reading your data' (always ok once running), 'Loading the R engine' (now while engine, ok after), 'Running N tests' (now while tests; text uses testsTotal and shows `phase` verbatim as the title), 'Drawing figures' (todo; folded into the tests phase - it flips to now only if `phase` contains 'figure'). Percentage: when `progress?.estMs` is a positive number, `pct = Math.min(99, Math.round((progress.elapsedMs ?? 0) / progress.estMs * 100))` and the fill takes that width; otherwise the fill gets `indeterminate`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RunModule } from './RunModule'

describe('RunModule', () => {
  it('renders nothing when idle', () => {
    expect(renderToStaticMarkup(<RunModule phase={null} progress={null} testsDone={0} testsTotal={2} />)).toBe('')
  })
  it('engine phase: title, indeterminate fill, narrated list with engine current', () => {
    const h = renderToStaticMarkup(<RunModule phase="Loading R engine…" progress={null} testsDone={0} testsTotal={2} />)
    expect(h).toContain('Loading R engine')
    expect(h).toContain('run-fill indeterminate')
    expect(h).toContain('Reading your data')
    expect(h).toMatch(/now[^>]*>[^<]*Loading the R engine/)
    expect(h).toContain('Running 2 tests')
  })
  it('test phase with estimate: percentage fill and tests phase current', () => {
    const h = renderToStaticMarkup(<RunModule phase="Running PLS-SEM…" progress={{ message: 'bootstrap', elapsedMs: 30000, estMs: 60000 }} testsDone={1} testsTotal={2} />)
    expect(h).toContain('width:50%')
    expect(h).toContain('50%')
    expect(h).toMatch(/now[^>]*>[^<]*Running 2 tests/)
    expect(h).toMatch(/ok[^>]*>[^<]*Loading the R engine/)
  })
})
```

- [ ] **Step 2: FAIL** - `npx vitest run src/components/RunModule.test.tsx` - module missing.

- [ ] **Step 3: Implement**

```tsx
export interface RunModuleProps { phase: string | null; progress: { message: string; elapsedMs?: number; estMs?: number } | null; testsDone: number; testsTotal: number }

/** Narrated run progress (spec R3). Reads the store's runPhase/runProgress channel via props. */
export function RunModule({ phase, progress, testsDone, testsTotal }: RunModuleProps) {
  if (phase === null) return null
  const inTests = phase.startsWith('Running')
  const pct = progress?.estMs ? Math.min(99, Math.round(((progress.elapsedMs ?? 0) / progress.estMs) * 100)) : null
  const phases: [string, 'ok' | 'now' | 'todo'][] = [
    ['Reading your data', 'ok'],
    ['Loading the R engine', inTests ? 'ok' : 'now'],
    [`Running ${testsTotal} test${testsTotal === 1 ? '' : 's'}`, inTests ? 'now' : 'todo'],
    ['Drawing figures', 'todo'],
  ]
  const glyph = { ok: '✓', now: '●', todo: '○' } as const
  return (
    <div className="run-card" role="status" aria-live="polite">
      <div className="run-top"><span>{phase}</span>{pct !== null && <span className="pct">{pct}%</span>}
        {inTests && pct === null && <span className="pct">{testsDone + 1} of {testsTotal}</span>}</div>
      <div className="run-track">
        <span className={`run-fill${pct === null ? ' indeterminate' : ''}`} style={pct === null ? undefined : { width: `${pct}%` }} />
      </div>
      <div className="run-phases">
        {phases.map(([label, state]) => <span key={label} className={state}>{glyph[state]} {label}</span>)}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: PASS** - `npx vitest run src/components/RunModule.test.tsx`; `npx tsc --noEmit`.
- [ ] **Step 5: Commit** - `git add src/components/RunModule.tsx src/components/RunModule.test.tsx && git commit -m "feat(redesign): RunModule - narrated run progress with percentage/indeterminate fill"`

---

### Task 6: ResultsScreen integration

**Files:**
- Modify: `src/components/screens/ResultsScreen.tsx` (the running-state render path only - find the block that currently renders `s.runPhase` / the progress bar; `grep -n "runPhase\|runProgress" src/components/screens/ResultsScreen.tsx`)
- Test: `src/components/screens/ResultsScreen.progress.test.tsx` (adapt existing assertions)

**Interfaces:**
- Consumes: `RunModule` (Task 5).

- [ ] **Step 1: Read the current progress markup and its test**

`ResultsScreen.progress.test.tsx` pins the current progress rendering. Read both files first. The new render is:

```tsx
<RunModule phase={s.runPhase} progress={s.runProgress}
  testsDone={s.selection.filter((id) => s.runs[id] && !s.runs[id].stale).length}
  testsTotal={s.selection.length} />
```
replacing the existing phase/progress markup (keep any surrounding conditions - it should render while `s.runStatus === 'running'` exactly where the old bar rendered). Download buttons in the export row: change `className` from `btn ghost`-equivalents only if they don't already use `.btn`/`.btn.ghost` (they restyle for free via Task 2).

- [ ] **Step 2: Update the progress test to the RunModule contract**

Rewrite the assertions in `ResultsScreen.progress.test.tsx` that matched the old bar to match: `run-card` present while running, phase text rendered, `run-fill indeterminate` without estimate, `width:NN%` with estimate. Keep the test's existing store-seeding approach (it already knows how to fake a running state). Preserve any assertions about elapsed/estimate text by mapping them onto the `pct` span.

- [ ] **Step 3: FAIL first** - run the adapted test before changing the screen: `npx vitest run src/components/screens/ResultsScreen.progress.test.tsx` - FAIL (old markup).
- [ ] **Step 4: Apply the screen change; PASS** - same command; then the screen's other suites: `npx vitest run src/components/screens/` - all green; `npx tsc --noEmit`.
- [ ] **Step 5: Commit** - `git add src/components/screens/ResultsScreen.tsx src/components/screens/ResultsScreen.progress.test.tsx && git commit -m "feat(redesign): ResultsScreen runs narrate through RunModule"`

---

### Task 7: WelcomeScreen - wordmark, curve, credit

**Files:**
- Modify: `src/components/screens/WelcomeScreen.tsx` (full rewrite), `src/content/copy.ts` (append one constant)
- Test: `src/components/screens/WelcomeScreen.test.tsx` (new)

**Interfaces:**
- Consumes: `WELCOME_COPY`, `LINKEDIN_URL` (existing); `.credit-line`, `.prose`, `.btn` (Task 2).
- Produces: `CREDIT_SUFFIX` in copy.ts; `WelcomeScreen` renders wordmark + curve + prose + subline + single CTA + credit.

- [ ] **Step 1: Append to `src/content/copy.ts`**

```ts
// Welcome credit row (redesign spec R4/tribute inventory - new copy, not spec-pinned)
export const CREDIT_SUFFIX = 'designed and built with Claude Fable 5'
```

- [ ] **Step 2: Write the failing test**

`src/components/screens/WelcomeScreen.test.tsx` (WelcomeScreen only reads `goTo` from the store - static render works with the pristine store):

```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { WelcomeScreen } from './WelcomeScreen'
import { WELCOME_COPY, CREDIT_SUFFIX } from '../../content/copy'

const h = () => renderToStaticMarkup(<WelcomeScreen />)

describe('WelcomeScreen (redesign)', () => {
  it('wordmark carries the clay full stop', () => {
    expect(h()).toMatch(/Telos<span class="dot"[^>]*>\.<\/span>/)
  })
  it('renders the settling-curve svg gesture', () => {
    expect(h()).toContain('<svg')
    expect(h()).toContain('aria-hidden="true"')
  })
  it('shows the approved copy verbatim across paragraph, subline and credit', () => {
    const html = h().replace(/<[^>]+>/g, '')
    // every sentence of WELCOME_COPY appears (split across the layout, nothing dropped or rewritten)
    for (const part of ['Telos runs your statistics', 'Your data never leaves your browser', 'Built by Benjamin Sotelo'])
      expect(html).toContain(part)
    expect(html).toContain(CREDIT_SUFFIX)
  })
  it('has exactly one CTA: Get started', () => {
    expect(h().match(/class="btn"/g)).toHaveLength(1)
    expect(h()).toContain('Get started')
    expect(h()).not.toContain('How it works')
  })
})
```

- [ ] **Step 3: FAIL** - `npx vitest run src/components/screens/WelcomeScreen.test.tsx`.

- [ ] **Step 4: Rewrite `WelcomeScreen.tsx`**

```tsx
import { useSession } from '../../state/session'
import { WELCOME_COPY, LINKEDIN_URL, CREDIT_SUFFIX } from '../../content/copy'

const PRIVACY = 'Your data never leaves your browser.'
const BYLINE = 'Built by Benjamin Sotelo'

/** Split the spec-pinned paragraph for layout WITHOUT changing a word of it (spec F1a):
 *  body ¶ = everything before the privacy sentence · subline = the privacy sentence ·
 *  credit = the byline (+ the new CREDIT_SUFFIX) with the LinkedIn link. */
function segments() {
  const [body, tail] = WELCOME_COPY.split(PRIVACY)
  return { body: body.trim(), tail: tail.trim() } // tail = 'Built by Benjamin Sotelo — linkedin…'
}

export function WelcomeScreen() {
  const goTo = useSession((s) => s.goTo)
  const { body } = segments()
  return (
    <section style={{ textAlign: 'center', paddingTop: 40 }}>
      <div className="eyebrow">In-browser statistics for thesis students</div>
      <h1 className="title" style={{ fontSize: 46, margin: '10px 0 0' }}>Telos<span className="dot" style={{ color: 'var(--accent)' }}>.</span></h1>
      <svg viewBox="0 0 420 64" width="100%" height="64" aria-hidden="true" style={{ maxWidth: 420, display: 'block', margin: '14px auto 2px' }}>
        <path d="M8 58 C 90 58, 140 10, 210 10 C 280 10, 330 58, 412 58" fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity=".85" />
        <g fill="var(--accent)">
          <circle cx="60" cy="52" r="2.1" opacity=".45" /><circle cx="105" cy="40" r="2.1" opacity=".55" />
          <circle cx="150" cy="22" r="2.1" opacity=".7" /><circle cx="210" cy="13" r="2.4" opacity=".95" />
          <circle cx="268" cy="21" r="2.1" opacity=".7" /><circle cx="318" cy="41" r="2.1" opacity=".55" />
          <circle cx="362" cy="53" r="2.1" opacity=".45" />
        </g>
      </svg>
      <p className="prose" style={{ maxWidth: 520, margin: '8px auto 4px', textAlign: 'center' }}>{body}</p>
      <p className="hint" style={{ margin: '2px 0 22px' }}>{PRIVACY}</p>
      <button className="btn" onClick={() => goTo('upload')}>Get started</button>
      <br />
      <span className="credit-line">{BYLINE} · {CREDIT_SUFFIX} · <a href={LINKEDIN_URL} target="_blank" rel="noopener">linkedin.com/in/benjaminsotelo1</a></span>
    </section>
  )
}
```

Layout note: `segments().body` still ends with the sentence before the privacy line; the tail (byline + URL) is intentionally NOT rendered verbatim - the credit line re-sets it with the link and suffix. The copy test (Step 2) asserts all three anchors appear, so nothing from the approved paragraph disappears.

- [ ] **Step 5: PASS** - the new test + `npx vitest run src/content/copy.consistency.test.ts` (untouched constants) + any existing welcome assertions in e2e are string-level ('Get started' heading 'Telos') - `grep -n "Welcome\|Get started\|'Telos'" tests/e2e/flow.spec.ts` and confirm compatibility: the heading check `getByRole('heading', { name: 'Telos' })` must still match - it does ("Telos." accessible name includes the dot; if the e2e uses exact name, change the locator to `{ name: /Telos/ }`). `npx tsc --noEmit`.
- [ ] **Step 6: Commit** - `git add src/components/screens/WelcomeScreen.tsx src/components/screens/WelcomeScreen.test.tsx src/content/copy.ts && git commit -m "feat(redesign): welcome - wordmark with clay stop, settling-curve gesture, credit line, single CTA"`

---

### Task 8: Grouped option rows

**Files:**
- Create: `src/lib/registry/optionGroups.ts`, `src/components/OptionRows.tsx`
- Modify: `src/components/screens/TestConfigScreen.tsx` (the `spec.options.map` block, lines ~28-68)
- Test: `src/components/OptionRows.test.tsx`

**Interfaces:**
- Produces:
```ts
// optionGroups.ts
export function optionGroup(o: { id: string; kind: string }): string
```
Rule: `display` kind → `'Display'`; ids in the seed map → their label (`tails → 'Hypothesis'`, `equal-variance → 'Variances'`, `posthoc → 'Post-hoc'`); everything else → `'Settings'`.
```tsx
// OptionRows.tsx - presentational; TestConfigScreen keeps ALL current control logic per kind,
// OptionRows only re-arranges the SAME rendered controls into labeled rows.
export function OptionRows({ children }: { children: { group: string; node: React.ReactNode }[] })
```

- [ ] **Step 1: Write the failing tests**

`src/components/OptionRows.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { OptionRows } from './OptionRows'
import { optionGroup } from '../lib/registry/optionGroups'

describe('optionGroup', () => {
  it('maps known ids, display kind, and the fallback', () => {
    expect(optionGroup({ id: 'tails', kind: 'select' })).toBe('Hypothesis')
    expect(optionGroup({ id: 'equal-variance', kind: 'toggle' })).toBe('Variances')
    expect(optionGroup({ id: 'alpha', kind: 'display' })).toBe('Display')
    expect(optionGroup({ id: 'anything-else', kind: 'number' })).toBe('Settings')
  })
})

describe('OptionRows', () => {
  it('buckets children under uppercase group labels, preserving group order of first appearance', () => {
    const h = renderToStaticMarkup(<OptionRows children={[
      { group: 'Hypothesis', node: <span key="a">two-tailed</span> },
      { group: 'Display', node: <span key="b">alpha</span> },
      { group: 'Hypothesis', node: <span key="c">one-tailed</span> },
    ]} />)
    expect(h.indexOf('Hypothesis')).toBeLessThan(h.indexOf('Display'))
    expect(h.match(/opt-label/g)).toHaveLength(2)
    expect(h.indexOf('two-tailed')).toBeLessThan(h.indexOf('one-tailed'))
  })
})
```

- [ ] **Step 2: FAIL**, then implement both files:

```ts
// src/lib/registry/optionGroups.ts
const BY_ID: Record<string, string> = { tails: 'Hypothesis', 'equal-variance': 'Variances', posthoc: 'Post-hoc' }
/** Presentational grouping only (spec §2). Extend BY_ID when a new option deserves a named row. */
export function optionGroup(o: { id: string; kind: string }): string {
  return o.kind === 'display' ? 'Display' : BY_ID[o.id] ?? 'Settings'
}
```

```tsx
// src/components/OptionRows.tsx
import type { ReactNode } from 'react'
export function OptionRows({ children }: { children: { group: string; node: ReactNode }[] }) {
  const order = [...new Set(children.map((c) => c.group))]
  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
      {order.map((g) => (
        <div key={g} className="opt-group">
          <span className="opt-label">{g}</span>
          {children.filter((c) => c.group === g).map((c) => c.node)}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Wire into `TestConfigScreen.tsx`**

The existing `spec.options.map((o) => ...)` block stays byte-for-byte as the per-kind control renderer; wrap it: build `const rendered = spec.options.map((o) => ({ group: optionGroup(o), node: <existing JSX for o> }))` and replace the flat `<div style={{ display:'flex', gap:8, ... }}>{...}</div>` wrapper with `<OptionRows children={rendered} />`. The conditional blocks BELOW the strip (one-tailed warning, custom proportions, arima manual order, hints) stay exactly where they are.

- [ ] **Step 4: Run module on the config screen too (spec §5)** - in `TestConfigScreen.tsx`, directly above the `.btn-row`, add `{running && <RunModule phase={s.runPhase} progress={s.runProgress} testsDone={s.selection.filter((id) => s.runs[id] && !s.runs[id].stale).length} testsTotal={s.selection.length} />}` with the import `import { RunModule } from '../RunModule'` - the brief moment between clicking Run and landing on Results narrates instead of freezing.

- [ ] **Step 5: PASS** - `npx vitest run src/components/OptionRows.test.tsx src/components/screens/` and `npx tsc --noEmit`. Eyeball one option-heavy test (independent t-test) in `npm run dev`.
- [ ] **Step 6: Commit** - `git add src/lib/registry/optionGroups.ts src/components/OptionRows.tsx src/components/OptionRows.test.tsx src/components/screens/TestConfigScreen.tsx && git commit -m "feat(redesign): grouped option rows + run narration on the config screen"`

---

### Task 9: Slot-to-shelf hover echo

**Files:**
- Modify: `src/lib/eligibility/poolShelves.ts` (export the existing `roleAcceptsLevel`), `src/components/DragSlots.tsx`
- Test: `src/components/DragSlots.test.tsx` (add cases)

**Interfaces:**
- Produces: `export function roleAcceptsLevel(r: RoleConstraint, level: Level, shelfCols: ColumnMeta[]): boolean` (same body, now exported); `DragSlotsUI` gains internal hover state - Slot gets `onMouseEnter/onMouseLeave/onFocus/onBlur` setting `echoRole: string | null`; a shelf whose level the echoed role accepts gets class `shelf echo` (in addition to `off` handling; echo only applies to non-dim shelves).

- [ ] **Step 1: Add the failing tests** (append to `DragSlots.test.tsx`; static markup cannot fire hover, so test the class derivation through the exported helper + a direct render of the internal derivation):

```tsx
import { roleAcceptsLevel } from '../lib/eligibility/poolShelves'

describe('hover echo derivation', () => {
  it('roleAcceptsLevel is exported and mirrors slot rules', () => {
    const outcome = SPECS['independent-t-test'].constraints.roles.find((r) => r.roleId === 'outcome')!
    expect(roleAcceptsLevel(outcome, 'ratio', [])).toBe(true)
    expect(roleAcceptsLevel(outcome, 'nominal', [])).toBe(false)
  })
})
```
Plus one DOM assertion: temporarily render `DragSlotsUI` with a new optional prop `echoRole` (see Step 2) set to `'outcome'` and assert `class="shelf echo"` appears on the ratio shelf and NOT on the nominal shelf.

- [ ] **Step 2: Implement**

In `poolShelves.ts`: change `function roleAcceptsLevel` to `export function roleAcceptsLevel` (no body change).
In `DragSlots.tsx`: `DragSlotsUI` gets `const [echo, setEcho] = useState<string | null>(null)` plus an optional `echoRole` prop that overrides the state for tests: `const active = echoRole ?? echo`. Slot wrapper div gets the four handlers calling `setEcho(role.roleId)` / `setEcho(null)`. Shelf className becomes:

```tsx
const echoed = active && !sh.dim && sh.chips.length > 0 &&
  roleAcceptsLevel(spec.constraints.roles.find((r) => r.roleId === active)!, sh.level, sh.chips.map((c) => c.col))
<div key={sh.level} className={`shelf${sh.dim ? ' off' : ''}${echoed ? ' echo' : ''}`}>
```

- [ ] **Step 3: PASS** - `npx vitest run src/components/DragSlots.test.tsx src/lib/eligibility/poolShelves.test.ts`; `npx tsc --noEmit`; eyeball hover in `npm run dev`.
- [ ] **Step 4: Commit** - `git add src/lib/eligibility/poolShelves.ts src/components/DragSlots.tsx src/components/DragSlots.test.tsx && git commit -m "feat(redesign): slot-to-shelf hover echo (deferred slice-1 microinteraction)"`

---

### Task 10: Remaining screens sweep

**Files:**
- Modify: `src/components/screens/UploadScreen.tsx`, `GuideScreen.tsx`, `ConfigureDataScreen.tsx`, `PickTestsScreen.tsx`, `ResultsScreen.tsx` (headings/prose classes only), `src/App.tsx` (nothing expected - verify), `src/components/ResultPreviewCard.tsx` if it hardcodes colors (`grep -n "#" src/components/*.tsx src/components/screens/*.tsx | grep -v "//"`)

**Interfaces:** none new - this task applies Task 2's language where inline styles fight it.

- [ ] **Step 1: Hex sweep** - `grep -rn "#[0-9a-fA-F]\{3,6\}\b" src/components src/App.tsx | grep -v test | grep -v "var(--"` - for every hit that is a COLOR (not an id/anchor), replace with the matching token. Expected hits: none or a handful; SemCanvas colors count as recolor-to-tokens ONLY if they are plain fills/strokes - if a hex encodes semantics (e.g. estimate signs), map to `var(--info)`/`var(--good)`/`var(--accent)` equivalents and note each mapping in the commit body.
- [ ] **Step 2: Prose roles (spec §1/§5)** - exactly three reading passages gain the `prose` class: the Guide terms paragraph, the pick-tests intro paragraph, and the results "How to read this" explainer paragraphs (find them: `grep -rn "How to read" src/components` - they render via ResultPreviewCard/builders; add `prose` to the explainer `<p>`'s className at the render site, not in the builders). Micro-hints stay `hint`.
- [ ] **Step 2b: Export-busy narration (spec §4)** - `grep -n "building\|zip\|exporting" src/components/screens/ResultsScreen.tsx`; if an export-in-progress text state exists, restyle that one line as `<span className="hint"><span className="mono">…</span></span>` narration ("Building your bundle…"); if none exists (export is synchronous-fast), record "N/A - export builds are instant" in the Task 13 report and move on. Do NOT add an async state.
- [ ] **Step 3: Run every screen test** - `npx vitest run src/components/ src/state/ src/content/` - all green. `npx tsc --noEmit`.
- [ ] **Step 4: Eyeball all seven screens** in `npm run dev`, both themes (theme select top-right). Fix only token/spacing violations of the approved mockups; anything structural gets noted, not changed.
- [ ] **Step 5: Commit** - `git add -A src/ && git commit -m "feat(redesign): screen sweep - tokens everywhere, prose roles for reading passages"`

---

### Task 11: Contrast audit (WCAG AA)

**Files:**
- Create: `docs/superpowers/reviews/2026-07-05-redesign-contrast-audit.md` (results record; script is throwaway in scratchpad)

- [ ] **Step 1: Run the audit script**

```bash
node -e '
const L=(hex)=>{const c=hex.match(/\w\w/g).map(x=>parseInt(x,16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]}
const ratio=(a,b)=>{const[x,y]=[L(a),L(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05)}
const pairs=[["text/bg","141413","faf9f5"],["muted/bg","6e6c64","faf9f5"],["accent-deep/bg","a44a2e","faf9f5"],["accent/bg (large only)","d97757","faf9f5"],["btn text","faf9f5","141413"],["dark text/bg","faf9f5","141413"],["dark muted/bg","b0aea5","141413"],["dark accent/bg","d97757","141413"],["error/errbg","8c3a1d","f9ede8"]]
for(const[n,f,b]of pairs)console.log(n.padEnd(24),ratio(f,b).toFixed(2))
'
```
Expected: every body-text pair ≥ 4.5; `accent/bg (large only)` may land ~3-4 - that is why `--accent-deep` exists for small text; record the numbers.

- [ ] **Step 2: Record + act** - write the table into the audit doc. If any pair used for small text is < 4.5, darken that token (e.g. muted) minimally and re-run Task 2's grep + this script; note the adjustment.
- [ ] **Step 3: Commit** - `git add docs/superpowers/reviews/2026-07-05-redesign-contrast-audit.md src/styles/tokens.css && git commit -m "docs(redesign): WCAG AA contrast audit (+token adjustments if any)"`

---

### Task 12: Motion + reduced-motion audit

**Files:**
- Modify: `src/styles/tokens.css` only if gaps found

- [ ] **Step 1: Verify every transition added by this plan sits behind `var(--motion)` or a named keyframe** - `grep -n "transition\|animation" src/styles/tokens.css` - each hit uses `var(--motion)` or `run-slide`.
- [ ] **Step 2: Verify the reduced-motion kill switch** - in `npm run dev` with macOS Reduce Motion on (System Settings → Accessibility → Display), confirm: no rail-fill animation, no shimmer, instant chip/slot state changes. If any animation survives, it is missing from the `@media (prefers-reduced-motion:reduce)` block - fix.
- [ ] **Step 3: Commit if changed** - `git commit -am "fix(redesign): reduced-motion coverage"` (skip if no change).

---

### Task 13: Full gate

**Files:** possible selector touch-ups in `tests/e2e/*.spec.ts` and `tests/docs/document-tests.spec.ts` only.

- [ ] **Step 1:** `npm run test:fast` - all green (expect ~+20 tests over 1149).
- [ ] **Step 2:** `npx tsc --noEmit && npm run build` - clean.
- [ ] **Step 3:** `npx playwright test` - 19/19. Known risk points, fix selectors only, never assertions: the welcome heading (`{ name: 'Telos' }` vs "Telos."), stepper navigation (`nav[aria-label=Progress]` buttons - stage labels changed from step labels: `configureStep` clicks test-name buttons which are now sub-dot `role="button"` elements - still matched by `getByRole('button', { name: stepName })`), and `.eyebrow` first-text assertions (unchanged).
- [ ] **Step 4:** Fresh-clone proof: clone to a temp dir, `npm ci && npm run test:fast && npm run build` green (fonts postinstall unaffected; new woff2 are committed assets).
- [ ] **Step 5:** Commit any touch-ups as `test(e2e): selector touch-ups for the redesign DOM`, then report gate numbers for the ratify note. Owner acceptance (both-themes click-through of all screens) happens after this gate - it is the slice's real finish line, per the spec's Verification section.
