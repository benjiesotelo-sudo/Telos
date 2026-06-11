# Telos Walking Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed web app where a user loads a small dataset, runs an independent t-test entirely in the browser (WebR), and sees a result **faithful to the approved spec** — the two real APA tables, the "how to read" text, the APA write-up, and the spec's export bundle (the per-test image folder; the report files are explicitly deferred, see Task 9) — proving the whole Telos v1 architecture end-to-end.

**Architecture:** Static React SPA; all statistics run client-side in a WebR (R→WASM) worker — data never leaves the browser. **The content of every test is driven by a typed registry encoded from the HTML specs** (`telos_test_inputs.html`, `telos_test_outputs.html`): table columns, "how to read" text, APA template, bundle filenames, roles and option pills all come from the spec cards. The app *renders* that content with the design system. State in Zustand.

**Tech Stack:** Vite 8 + React 19 + TypeScript 6 · `webr` 0.6 (R engine; **ggplot2 installed at runtime** from the WebR package repo) · PapaParse (CSV) · `html-to-image` (table → PNG) · fflate (zip) · Zustand · Vitest 4 + Playwright · Cloudflare Pages. (These are the versions the scaffold actually produces today — do not pin React 18.)

**Source of truth:** The three HTML specs are the **content blueprint**. The registry (Task 4) encodes the independent t-test's content **verbatim from its card in `telos_test_outputs.html`** (and roles + options from `telos_test_inputs.html`). A consistency test asserts the registry can't drift from the specs — card-scoped, equality not containment. The app's *visual design* is rebuilt in React (not copied from the HTML markup); only the *content* comes from the specs.

**Pre-verified (empirically, not guessed):** the 2026-06-11 sandbox recheck (`docs/superpowers/reviews/2026-06-11-plan-recheck.md`, 39 confirmed findings — all folded into this revision) ran this plan's code against real installs: webr 0.6.0 env-key handling, `png()` capture, the t-test values, the Vite 8/TS 6/Vitest 4 toolchain fixes, fresh-clone postinstall, COOP/COEP preview — suite 12/12 green with these fixes. This amendment's additions (Welch values for both toggle positions, the hardened JSON serializer, ggplot2 `installPackages` + `print()` capture in WebR, the card-scoped consistency assertions against the current spec HTML) were re-verified the same day in a fresh `/tmp` sandbox.

**Process:** execute directly on `main` (Benjie's call, 2026-06-11) — Benjie decides every push point.

---

## File structure

| File | Responsibility |
|---|---|
| `vite.config.ts` | Build + dev/preview COOP/COEP headers (WebR needs cross-origin isolation) |
| `public/_headers`, `scripts/copy-webr.mjs`, `public/webr/` | Production headers + self-hosted WebR runtime (same-origin) |
| `src/styles/tokens.css` | Design tokens + Crimson Pro / Atkinson Hyperlegible fonts |
| `src/lib/registry/types.ts` | `TestSpec`, `TableSpec`, `ColumnDef` (with `sub` for M<sub>diff</sub>), `RoleSpec`, `OptionSpec` |
| `src/lib/registry/independentTTest.ts` | The t-test spec **encoded from the HTML cards** |
| `src/lib/webr/engine.ts` | The ONLY WebR module: boot + ggplot2 install (with status callback), `detectCores` shim, `runJson`, `capturePlot` |
| `src/lib/stats/types.ts` | `Dataset`, `GroupStat`, `TTestResult` |
| `src/lib/stats/independentTTest.ts` | Faithful R (SE · option-driven pooled/Welch · Levene check · d) → typed result + ggplot2 boxplot; listwise exclusion |
| `src/lib/data/sample.ts`, `src/lib/data/parseCsv.ts` | Sample dataset + CSV → `Dataset` |
| `src/lib/export/bundle.ts` | Zip a `{filename: bytes}` map (spec bundle) |
| `src/state/session.ts` | Zustand: dataset, config, result, status |
| `src/components/ApaTable.tsx` | Render a `TableSpec` + row data as an APA table |
| `src/components/DatasetLoader.tsx`, `TestConfig.tsx`, `ResultCard.tsx`, `ExportButton.tsx` | The slice UI |
| `src/App.tsx`, `tests/e2e/slice.spec.ts` | Wire-up (+ result error boundary) + E2E |

---

## Task 1: Scaffold the project

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Create the app + install deps**

```bash
npm create vite@latest telos-app -- --template react-ts
rsync -a --exclude='.gitignore' telos-app/ ./ && rm -rf telos-app   # merge in; keep our committed .gitignore
npm install
npm install webr papaparse fflate zustand html-to-image
npm install -D vitest @playwright/test @types/papaparse
npx playwright install chromium
```
Expected: deps in `package.json`; `node_modules/` populated.

- [ ] **Step 2: `vite.config.ts` (headers + Vitest)** — import `defineConfig` from **`vitest/config`** (it accepts the `test` key and passes everything through to Vite; importing from plain `'vite'` fails `tsc -b` with TS2769 under Vite 8/TS 6 — sandbox-verified):

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
const isolation = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' }
export default defineConfig({
  plugins: [react()],
  server: { headers: isolation },
  preview: { headers: isolation },
  optimizeDeps: { exclude: ['webr'] },
  // include keeps vitest away from tests/e2e (Playwright specs crash vitest collection);
  // hookTimeout covers Engine.init's ggplot2 download in beforeAll (~30 s observed, slower on bad networks).
  test: { environment: 'node', testTimeout: 120_000, hookTimeout: 300_000, include: ['src/**/*.test.ts'] },
})
```

- [ ] **Step 3: npm scripts** — set `package.json` `"scripts"` (no `postinstall` yet — it is added in Task 2 **together with** the script it runs, so every commit stays `npm install`-able; `e2e` self-installs Chromium so a fresh clone's `npm run e2e` works — a fast no-op when cached):
```json
{ "scripts": {
  "dev": "vite", "build": "tsc -b && node scripts/copy-webr.mjs && vite build", "preview": "vite preview",
  "test": "vitest run", "e2e": "playwright install chromium && playwright test"
} }
```

- [ ] **Step 4: Smoke test** — create `src/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
describe('toolchain', () => { it('runs', () => expect(1 + 1).toBe(2)) })
```
Run: `npm test` → Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "chore: scaffold Vite + React + TS with WebR/test deps"
```

---

## Task 2: Self-host the WebR runtime + production headers

WebR loads worker/wasm from a base URL; serving them **same-origin** avoids COEP cross-origin issues. Note: **ggplot2 is NOT part of this dist copy** — it installs at runtime from the WebR package repo (`repo.r-wasm.org`): network on first run; the browser caches it across visits, Node (vitest) re-downloads per fresh engine instance.

**The VFS must be decompressed at copy time (browser-verified 2026-06-11):** webr's own CDN relies on `Content-Encoding: gzip` negotiation for its lazy VFS images (`vfs/**/*.data.gz` + `.js.metadata` with `gzip:true` — the worker downloads the `.gz` and gunzips it itself). Self-hosting must ship plain `.data` files, because Vite dev/preview (and many static hosts) serve `*.gz` with `Content-Encoding: gzip`: Chromium transparently decompresses once, the worker gunzips a second time, and every lazy package/graphics load in the browser aborts with an empty error (Node reads the VFS from disk, so tsc/vitest/build never see this). Size impact verified: `public/webr`/`dist` grow 47 MB → 70 MB; largest decompressed file 9.3 MB — still safe under Cloudflare Pages' 25 MiB per-file limit, and CF compresses on the wire anyway.

**Files:** Create `scripts/copy-webr.mjs`, `public/_headers`; modify `package.json`

- [ ] **Step 1: Copy script** — `scripts/copy-webr.mjs` (the webR binaries are GPLv3 — ship their licence alongside them):
```js
import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'
const src = 'node_modules/webr/dist', dest = 'public/webr'
if (!existsSync(src)) { console.error('webr dist not found'); process.exit(1) }
mkdirSync(dest, { recursive: true }); cpSync(src, dest, { recursive: true })
copyFileSync('node_modules/webr/LICENSE.md', `${dest}/LICENSE.md`)

// Decompress the lazy VFS images: served as-is, *.data.gz gets double-gunzipped
// (server Content-Encoding + the worker's own gunzip) and aborts in the browser.
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
  d.isDirectory() ? walk(join(dir, d.name)) : d.name.endsWith('.js.metadata') ? [join(dir, d.name)] : [])
let n = 0
for (const metaPath of walk(`${dest}/vfs`)) {
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
  if (!meta.gzip) continue
  const base = metaPath.replace(/\.js\.metadata$/, '')
  const data = gunzipSync(readFileSync(`${base}.data.gz`))
  writeFileSync(`${base}.data`, data); unlinkSync(`${base}.data.gz`)
  writeFileSync(metaPath, JSON.stringify({ ...meta, gzip: false, remote_package_size: data.length }))
  n++
}
console.log(`Copied WebR runtime to public/webr/ (decompressed ${n} VFS images)`)
```

- [ ] **Step 2: Run + verify** — `node scripts/copy-webr.mjs && ls public/webr/ | head`
Expected: the script prints `Copied WebR runtime to public/webr/ (decompressed 47 VFS images)`; `ls` lists `R.js`, `R.wasm`, `webr-worker.js` (and the `vfs/` directory) — webr 0.6.0 ships no `R.bin.*` files. `ls public/webr/vfs | grep -c '\.data\.gz$'` → `0` (all VFS images decompressed). (Largest decompressed file 9.3 MB, safe for Cloudflare Pages' 25 MiB per-file limit.)

- [ ] **Step 3: `postinstall` hook** — now that the script exists, add to `package.json` `"scripts"`: `"postinstall": "node scripts/copy-webr.mjs"` (fresh clones self-populate `public/webr/`).

- [ ] **Step 4: Production headers** — `public/_headers`:
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

- [ ] **Step 5: Ignore copied assets** — append `public/webr/` to `.gitignore`.

- [ ] **Step 6: Commit**
```bash
git add scripts/copy-webr.mjs public/_headers .gitignore package.json
git commit -m "build: self-host WebR assets + COOP/COEP headers"
```

---

## Task 3: Design tokens + fonts

**Files:** Create `src/styles/tokens.css`; modify `src/main.tsx`, `src/App.tsx`

- [ ] **Step 1: Download the locked fonts** — the **full** Chrome UA is required (a truncated UA gets a TTF-only stylesheet → zero woff2 matches, sandbox-verified); the `test` makes an empty download fail loudly; the OFL texts must accompany redistributed font files:
```bash
mkdir -p public/fonts
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
curl -sS -H "User-Agent: $UA" \
  "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Crimson+Pro:wght@600;700&display=swap" -o /tmp/gf.css
grep -oE 'https://[^)]+\.woff2' /tmp/gf.css | sort -u | while read u; do curl -sS "$u" -O --output-dir public/fonts; done
test "$(ls public/fonts/*.woff2 | wc -l)" -ge 3 || { echo 'FONT DOWNLOAD FAILED: no woff2 files'; exit 1; }
curl -sS -o public/fonts/OFL-CrimsonPro.txt https://raw.githubusercontent.com/google/fonts/main/ofl/crimsonpro/OFL.txt
curl -sS -o public/fonts/OFL-AtkinsonHyperlegible.txt https://raw.githubusercontent.com/google/fonts/main/ofl/atkinsonhyperlegible/OFL.txt
```

- [ ] **Step 2: `src/styles/tokens.css`** (carry the spec palette; point `@font-face` at the saved files):
```css
@font-face{font-family:'Crimson Pro';font-weight:600;font-display:swap;src:url('/fonts/CRIMSON_600.woff2') format('woff2');}
@font-face{font-family:'Atkinson Hyperlegible';font-weight:400;font-display:swap;src:url('/fonts/ATKINSON_400.woff2') format('woff2');}
@font-face{font-family:'Atkinson Hyperlegible';font-weight:700;font-display:swap;src:url('/fonts/ATKINSON_700.woff2') format('woff2');}
:root{ --bg:#1b1b1b; --card:#262624; --text:#e8e6df; --muted:#a3a199; --line:rgba(255,255,255,0.18);
  --blue-sub:#9cc2ec; --font-display:'Crimson Pro',Georgia,serif; --font-ui:'Atkinson Hyperlegible',system-ui,sans-serif; }
@media (prefers-color-scheme:light){ :root{ --bg:#f0efe9; --card:#fff; --text:#2c2c2a; --muted:#5f5e5a; --line:rgba(0,0,0,0.22); } }
*{box-sizing:border-box;} body{margin:0;font-family:var(--font-ui);background:var(--bg);color:var(--text);line-height:1.5;}
h1,h2,h3,.display{font-family:var(--font-display);}
.card{background:var(--card);border-radius:12px;}
table.apa{border-collapse:collapse;font-size:13px;margin:6px 0;} table.apa th,table.apa td{padding:4px 10px;text-align:right;}
table.apa th:first-child,table.apa td:first-child{text-align:left;}
table.apa thead th{border-top:1.5px solid var(--text);border-bottom:.75px solid var(--text);}
table.apa tbody tr:last-child td{border-bottom:1.5px solid var(--text);}
```
(Rename the `url(...)` paths to the actual filenames in `public/fonts/` — the downloaded names are opaque hashes covering several unicode-range subsets per weight; read `/tmp/gf.css` to map each URL to its family/weight, keeping the latin subset of each.)

- [ ] **Step 3:** In `src/main.tsx` replace the style import with `import './styles/tokens.css'`. **Replace `src/App.tsx`** with a minimal placeholder — the scaffold App imports the about-to-be-deleted `App.css` plus assets, which would break every dev/build between here and Task 11 (sandbox-verified `[UNRESOLVED_IMPORT]`):
```tsx
export default function App() {
  return <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}><h1 className="display">Telos</h1></main>
}
```
Then delete `src/App.css`, `src/index.css` (and the now-unused `src/assets/`).

- [ ] **Step 4: Visual check** — `npm run dev`, open the URL → fonts + heading styling load (no unresolved-import error).

- [ ] **Step 5: Commit**
```bash
git add src/styles public/fonts src/main.tsx src/App.tsx && git rm -rf src/App.css src/index.css src/assets
git commit -m "feat: design tokens + Crimson Pro / Atkinson Hyperlegible"
```

---

## Task 4: Test registry (encoded from the HTML specs)

The registry is the machine-readable form of the spec cards. **Source: the Independent t-test card in `telos_test_outputs.html` (Table 1/2 columns incl. the M<sub>diff</sub> subscript, how-to-read, APA template, R map, bundle) and its card in `telos_test_inputs.html` (roles + the option strip).** The consistency test scopes to that card in each file and asserts **equality, not containment** — a registry corrupted with another card's content must fail (the old containment test demonstrably passed a paired-t-test frankenregistry).

**Files:** Create `src/lib/registry/types.ts`, `src/lib/registry/independentTTest.ts`, `src/lib/registry/registry.consistency.test.ts`

- [ ] **Step 1: Types** — `src/lib/registry/types.ts`:
```ts
export interface ColumnDef { key: string; label: string; sub?: string } // sub renders as <sub> — e.g. { label: 'M', sub: 'diff' } → M<sub>diff</sub>
export interface TableSpec { id: string; title: string; columns: ColumnDef[] }
export interface RoleSpec { id: string; label: string; levels: string; arity: string }
export interface OptionSpec { id: string; label: string; value: string } // one option pill from the inputs card, verbatim
export interface TestSpec {
  id: string
  name: string
  question: string
  roles: RoleSpec[]
  options: OptionSpec[]
  tables: TableSpec[]
  assumptionNote: string
  figure: { caption: string; type: string }
  howToRead: string
  apaTemplate: string
  rMap: string
  bundleFiles: string[]
}
```

- [ ] **Step 2: The t-test spec, verbatim from the cards** — `src/lib/registry/independentTTest.ts`:
```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html (Independent t-test exemplar) + telos_test_inputs.html (roles, option strip).
export const INDEPENDENT_T_TEST: TestSpec = {
  id: 'independent-t-test',
  name: 'Independent t-test',
  question: "do two groups' means differ?",
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1' },
    { id: 'group', label: 'Grouping variable', levels: 'nominal / ordinal', arity: 'exactly 1 · 2 categories' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05' },
    { id: 'tails', label: 'tails', value: 'two' },
    { id: 'equalVariance', label: 'equal variance', value: 'off · Welch' }, // drawn default: OFF → Welch runs (Benjie's ruling)
    { id: 'ci', label: 'CI', value: '95%' },
  ],
  tables: [
    { id: 'group-statistics', title: 'Group statistics',
      columns: [{ key: 'group', label: 'Group' }, { key: 'n', label: 'N' }, { key: 'mean', label: 'M' }, { key: 'sd', label: 'SD' }, { key: 'se', label: 'SE' }] },
    { id: 't-test', title: 'Independent-samples t-test',
      columns: [{ key: 'contrast', label: 'Contrast' }, { key: 't', label: 't' }, { key: 'df', label: 'df' }, { key: 'p', label: 'p' }, { key: 'mdiff', label: 'M', sub: 'diff' }, { key: 'ci', label: '95% CI' }, { key: 'd', label: 'd' }] },
  ],
  assumptionNote: "assumption check: Levene's test for equal variances; a Welch row replaces the pooled row when equal-variance is off.",
  figure: { caption: 'Distribution of the outcome by group', type: 'boxplot' },
  howToRead:
    "Asks whether two groups' averages differ by more than chance. Look at p: below alpha (e.g. .05) means significant. " +
    "The mean difference and 95% CI show the size and precision of the gap; Cohen's d gives effect size (~0.2 small, 0.5 medium, 0.8 large). " +
    "A large p means no significant difference was detected — not that the group means are equal.",
  apaTemplate:
    'An independent-samples t-test found a difference between {g1} (M={m1}, SD={sd1}) and {g2} (M={m2}, SD={sd2}), t({df})={t}, p={p}, d={d}.',
  rMap: 't.test() → Table 2 · summary → Table 1 · effectsize::cohens_d() → d · car::leveneTest() → assumption · geom_boxplot() → figure',
  bundleFiles: ['table_group-statistics.png', 'table_t-test.png', 'figure_boxplot.png'],
}
```

- [ ] **Step 3: Write the consistency test** (card-scoped, equality assertions — every extraction below was verified against the current spec HTML in the 2026-06-11 amendment sandbox, all green):

`src/lib/registry/registry.consistency.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { INDEPENDENT_T_TEST as spec } from './independentTTest'

// Scope each file to THIS test's card, so another card's content can never satisfy an assertion.
const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')
const card = outputsHtml.slice(outputsHtml.indexOf('Independent t-test</span>'), outputsHtml.indexOf('Paired t-test</span>'))
const inputsHtml = readFileSync('telos_test_inputs.html', 'utf8')
const inCard = inputsHtml.slice(inputsHtml.indexOf('<div class="ttl">Independent t-test</div>'), inputsHtml.indexOf('One-way ANOVA'))

const decode = (s: string) => s
  .replace(/&mdash;/g, '—').replace(/&minus;/g, '−').replace(/&middot;/g, '·')
  .replace(/&rarr;/g, '→').replace(/&alpha;/g, 'α').replace(/&amp;/g, '&')
const strip = (s: string) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

describe('registry stays faithful to the spec HTML (verbatim, card-scoped)', () => {
  it('table theads equal the card column sequences — including the M<sub>diff</sub> markup', () => {
    const theads = [...card.matchAll(/<thead>(.*?)<\/thead>/gs)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((t) => t[1]))
    expect(theads).toEqual(spec.tables.map((t) => t.columns.map((c) => (c.sub ? `${c.label}<sub>${c.sub}</sub>` : c.label))))
  })
  it('table titles equal the card captions', () => {
    const caps = [...card.matchAll(/<div class="apa-cap"><b>Table \d\.<\/b> (.*?)<\/div>/g)].map((m) => m[1])
    expect(caps).toEqual(spec.tables.map((t) => t.title))
  })
  it('question, assumption note, figure caption, how-to-read and R map match verbatim', () => {
    expect(strip(card.match(/<span class="rt-q">(.*?)<\/span>/s)![1])).toBe(spec.question)
    expect(strip(card.match(/<p class="tbl-note assume">(.*?)<\/p>/s)![1])).toBe(spec.assumptionNote)
    expect(strip(card.match(/<div class="fcap"><b>Figure\.<\/b>(.*?)<\/div>/s)![1])).toBe(spec.figure.caption)
    expect(strip(card.match(/<div class="howread">(.*?)<\/div>/s)![1])).toBe(spec.howToRead)
    expect(strip(card.match(/<b>R map:<\/b>(.*?)<\/div>/s)![1])).toBe(spec.rMap)
  })
  it('bundle line EQUALS bundleFiles, and the names derive from table ids + figure type', () => {
    expect(strip(card.match(/<div class="m bundle">(.*?)<\/div>/s)![1]).split(' · ')).toEqual(spec.bundleFiles)
    expect([...spec.tables.map((t) => `table_${t.id}.png`), `figure_${spec.figure.type}.png`]).toEqual(spec.bundleFiles)
  })
  it('roles equal the inputs card slot labels + constraints', () => {
    const labels = [...inCard.matchAll(/<div class="sl-label">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    const cons = [...inCard.matchAll(/<div class="sl-cons">(.*?)<\/div>/g)].map((m) => strip(m[1]))
    expect(labels).toEqual(spec.roles.map((r) => r.label))
    expect(cons).toEqual(spec.roles.map((r) => `${r.levels} · ${r.arity}`))
  })
  it('options equal the inputs card option strip', () => {
    const pills = [...inCard.matchAll(/<span class="optpill"><span class="k">(.*?)<\/span><span class="v">(.*?)<\/span>/g)]
      .map((m) => ({ label: strip(m[1]), value: strip(m[2]) }))
    expect(pills).toEqual(spec.options.map((o) => ({ label: o.label, value: o.value })))
  })
})
```

- [ ] **Step 4: Run it** — `npx vitest run src/lib/registry/registry.consistency.test.ts`
Expected: PASS (every registry field equals its card text). If any fails, the registry — or a regex against a changed card layout — has drifted from the spec; fix the registry to match the card.

- [ ] **Step 5: Commit**
```bash
git add src/lib/registry && git commit -m "feat: test registry encoded from the HTML specs + consistency test"
```

---

## Task 5: WebR engine adapter

**Files:** Create `src/lib/webr/engine.ts`, `src/lib/webr/engine.test.ts`

- [ ] **Step 1: Failing test** — `src/lib/webr/engine.test.ts` (the `beforeAll` downloads ggplot2 from the WebR repo on a fresh engine — needs network, ~30 s observed; covered by the config's `hookTimeout`):
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from './engine'
describe('Engine', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })
  it('runs R, returns parsed JSON', async () => expect((await engine.runJson<{ s: number }>('list(s = 2 + 3)')).s).toBe(5))
  it('applies the detectCores shim', async () => expect(await engine.runJson<number>('parallel::detectCores()')).toBe(1))
  it('passes JS vectors into R', async () => expect(await engine.runJson<number>('mean(x)', { x: [2, 4, 6] })).toBe(4))
  it('serializes quoted strings, backslashes, non-finite numbers and logicals safely', async () => {
    const r = await engine.runJson<{ s: string; inf: number | null; ok: boolean }>(String.raw`list(s = 'say "hi" \\', inf = 1/0, ok = TRUE)`)
    expect(r).toEqual({ s: 'say "hi" \\', inf: null, ok: true })
  })
  it('captures a base-R plot as PNG bytes', async () => {
    const png = await engine.capturePlot('boxplot(c(1,2,3,4) ~ c("a","a","b","b"))')
    expect(Array.from(png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })
})
```

- [ ] **Step 2: Run → fails** — `npx vitest run src/lib/webr/engine.test.ts` → FAIL (no module).

- [ ] **Step 3: Implement** — `src/lib/webr/engine.ts`:
```ts
import { WebR } from 'webr'

const BASE_URL = typeof window === 'undefined' ? undefined : '/webr/'
const DETECTCORES_SHIM = `local({ ns <- asNamespace("parallel"); unlockBinding("detectCores", ns); assign("detectCores", function(logical = TRUE, all.tests = FALSE) 1L, envir = ns) })`

// Recursive R->JSON, no package dependency. Handles scalars, vectors, named + unnamed lists, logicals;
// escapes strings (backslash, quote, control chars); maps NA/NaN/±Inf to null. Sandbox-verified.
const TELOS_JSON_HELPER = String.raw`
.telos_str <- function(s) {
  s <- gsub('\\', '\\\\', s, fixed=TRUE); s <- gsub('"', '\\"', s, fixed=TRUE)
  s <- gsub('\n', '\\n', s, fixed=TRUE); s <- gsub('\r', '\\r', s, fixed=TRUE); s <- gsub('\t', '\\t', s, fixed=TRUE)
  paste0('"', s, '"')
}
.telos_json <- function(x) {
  if (is.list(x)) {
    nm <- names(x); if (is.null(nm)) nm <- rep("", length(x))
    parts <- vapply(seq_along(x), function(i) { key <- if (nzchar(nm[i])) paste0('"', nm[i], '":') else ''; paste0(key, .telos_json(x[[i]])) }, character(1))
    if (length(x) && all(nzchar(nm))) paste0('{', paste(parts, collapse=','), '}') else paste0('[', paste(parts, collapse=','), ']')
  } else if (is.logical(x)) { v <- ifelse(is.na(x), 'null', ifelse(x, 'true', 'false')); if (length(x)==1) v else paste0('[', paste(v, collapse=','), ']')
  } else if (is.character(x)) { v <- vapply(x, function(s) if (is.na(s)) 'null' else .telos_str(s), character(1)); if (length(x)==1) v else paste0('[', paste(v, collapse=','), ']')
  } else { v <- ifelse(is.finite(x), formatC(x, format='g', digits=10), 'null'); if (length(x)==1) v else paste0('[', paste(v, collapse=','), ']') }
}`

export class Engine {
  private webr: WebR
  private ready = false
  constructor() { this.webr = new WebR(BASE_URL ? { baseUrl: BASE_URL } : {}) }

  /** Boot R, install ggplot2 (first run downloads from the WebR package repo — the browser caches it; Node re-downloads per instance). */
  async init(onStatus?: (msg: string) => void): Promise<void> {
    if (this.ready) return
    onStatus?.('Loading R engine (first run downloads ~20 MB)…')
    await this.webr.init()
    await this.webr.evalRVoid(DETECTCORES_SHIM)
    await this.webr.evalRVoid(TELOS_JSON_HELPER)
    onStatus?.('Loading ggplot2…')
    await this.webr.installPackages(['ggplot2'], { quiet: true })
    this.ready = true
  }

  /** Evaluate an R block (statements allowed); its last value is serialized to JSON and parsed. */
  async runJson<T>(rBlock: string, env?: Record<string, unknown>): Promise<T> {
    const shelter = await new this.webr.Shelter()
    try {
      // NEVER pass `env: undefined` — webr 0.6.0 throws on a present-but-undefined env key (sandbox-verified); omit the key instead.
      const cap = await shelter.captureR(`cat(.telos_json({\n${rBlock}\n}))`, { captureStreams: true, ...(env ? { env: env as any } : {}) })
      const text = cap.output.filter((o) => o.type === 'stdout').map((o) => o.data).join('')
      return JSON.parse(text) as T
    } finally { await shelter.purge() }
  }

  /** Run plotting R (env-bound), return the PNG bytes from the virtual FS. ggplot2 objects must be print()ed to reach the device. */
  async capturePlot(plotR: string, width = 600, height = 450, env?: Record<string, unknown>): Promise<Uint8Array<ArrayBuffer>> {
    const path = '/tmp/telos-plot.png'
    await this.webr.evalRVoid(`png('${path}', width=${width}, height=${height}, res=110); tryCatch({ ${plotR} }, finally = dev.off())`, env ? { env: env as any } : undefined)
    return (await this.webr.FS.readFile(path)) as Uint8Array<ArrayBuffer> // typed buffer: Uint8Array<ArrayBufferLike> is not a BlobPart under TS 6
  }

  async close(): Promise<void> { if (this.ready) { await this.webr.close(); this.ready = false } }
}
```

- [ ] **Step 4: Run → passes** — `npx vitest run src/lib/webr/engine.test.ts` → PASS (5 tests; first run slow — WebR boot + ggplot2 download).

- [ ] **Step 5: Commit**
```bash
git add src/lib/webr && git commit -m "feat: WebR engine adapter (shim, hardened runJson, capturePlot, ggplot2 install, boot status)"
```

---

## Task 6: Independent t-test stats (faithful to the spec)

Computes everything the spec's two tables need: SE, **pooled/Welch from the user's equal-variance option** (the inputs card's pill, drawn default `off · Welch` — Benjie's ruling; Levene's test is still computed and reported as the assumption check, it is NOT a gate), Cohen's d, and the **ggplot2** boxplot (the architecture doc, outputs spec and the registry rMap all lock figures to ggplot2). Missing data: **per-test listwise** (the ui spec's step-4a default) — rows with a missing/non-numeric value in either role column are excluded and counted, never coerced (PapaParse's `null` for an empty cell would otherwise become `Number(null) === 0`: silently wrong statistics). **Both toggle positions' values and the ggplot2 capture were verified against real WebR in the 2026-06-11 amendment sandbox.**

**Files:** Create `src/lib/stats/types.ts`, `src/lib/stats/independentTTest.ts`, `src/lib/stats/independentTTest.test.ts`

- [ ] **Step 1: Types** — `src/lib/stats/types.ts`:
```ts
export interface Dataset { columns: string[]; rows: Record<string, string | number | null>[] } // null: PapaParse's empty-cell value
export interface GroupStat { group: string; n: number; mean: number; sd: number; se: number }
export interface TTestResult {
  groupStats: [GroupStat, GroupStat]
  contrast: string
  test: 'pooled' | 'welch'
  t: number; df: number; p: number; meanDiff: number; ci: [number, number]; cohensD: number
  levene: { F: number | null; p: number | null } // null when degenerate (n < 3 per group) — rendered as em-dash
  nExcluded: number                              // rows dropped listwise (missing/non-numeric role value)
  figurePng: Uint8Array<ArrayBuffer>
}
```

- [ ] **Step 2: Failing test (known data, known answers — BOTH toggle positions, sandbox-verified)** — `src/lib/stats/independentTTest.test.ts`. Note the equal-variance toggle is exercised on an **unequal-variance, balanced** dataset: on the perfectly balanced equal-SD `data` below, Welch and pooled coincide exactly (df = 6 either way), so only `unequal` can prove `var.equal` really flowed into R (Welch df goes fractional):
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runIndependentTTest } from './independentTTest'
import type { Dataset } from './types'

const data: Dataset = { columns: ['group', 'score'], rows: [
  { group: 'A', score: 10 }, { group: 'A', score: 12 }, { group: 'A', score: 11 }, { group: 'A', score: 13 },
  { group: 'B', score: 15 }, { group: 'B', score: 17 }, { group: 'B', score: 16 }, { group: 'B', score: 18 },
  { group: 'A', score: null }, { group: null, score: 14 }, // listwise: both rows must be EXCLUDED, never coerced to 0
] }

// Same numbers as Task 7's SAMPLE (unequal SDs: 3.14 vs 3.78) — inlined because sample.ts lands in Task 7.
const unequal: Dataset = { columns: ['group', 'score'], rows: [
  { group: 'control', score: 72 }, { group: 'control', score: 68 }, { group: 'control', score: 75 }, { group: 'control', score: 70 }, { group: 'control', score: 66 }, { group: 'control', score: 71 },
  { group: 'treatment', score: 81 }, { group: 'treatment', score: 79 }, { group: 'treatment', score: 85 }, { group: 'treatment', score: 83 }, { group: 'treatment', score: 78 }, { group: 'treatment', score: 88 },
] }

describe('runIndependentTTest', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('equal variance ON → pooled row; spec tables, listwise exclusion, Levene, Cohen d, boxplot', async () => {
    const r = await runIndependentTTest(engine, data, 'score', 'group', true)
    expect(r.nExcluded).toBe(2)
    expect(r.groupStats.map((g) => g.group)).toEqual(['A', 'B'])
    expect(r.groupStats[0].n).toBe(4)
    expect(r.groupStats[0].se).toBeCloseTo(0.6455, 3)
    expect(r.test).toBe('pooled')
    expect(r.df).toBe(6)
    expect(r.t).toBeCloseTo(-5.477, 2)
    expect(r.p).toBeLessThan(0.01)
    expect(r.cohensD).toBeCloseTo(-3.873, 2)
    expect(r.contrast).toBe('A − B')
    expect(r.levene.F).toBe(0) // equal SDs
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('equal variance OFF (the drawn default) → Welch row: fractional df, Welch CI', async () => {
    const r = await runIndependentTTest(engine, unequal, 'score', 'group', false)
    expect(r.test).toBe('welch')
    expect(r.t).toBeCloseTo(-5.983, 2)
    expect(r.df).toBeCloseTo(9.678, 2)   // Welch–Satterthwaite (pooled would be exactly 10)
    expect(r.ci[0]).toBeCloseTo(-16.489, 2)
    expect(r.ci[1]).toBeCloseTo(-7.511, 2)
    expect(r.nExcluded).toBe(0)
  })
})
```

- [ ] **Step 3: Run → fails** — `npx vitest run src/lib/stats/independentTTest.test.ts` → FAIL.

- [ ] **Step 4: Implement** — `src/lib/stats/independentTTest.ts`:
```ts
import type { Engine } from '../webr/engine'
import type { Dataset, GroupStat, TTestResult } from './types'

const R_STATS = String.raw`
g <- factor(group); lv <- levels(g)
gs <- lapply(lv, function(l){ v <- score[g==l]; list(group=l, n=length(v), mean=mean(v), sd=sd(v), se=sd(v)/sqrt(length(v))) })
med <- tapply(score, g, median); z <- abs(score - med[as.character(g)])
lev <- anova(lm(z ~ g)); levF <- lev[["F value"]][1]; levP <- lev[["Pr(>F)"]][1]
# Levene is degenerate below n=3 per group (F is floating-point residue) - report as null, render as em-dash
if (min(table(g)) < 3) { levF <- NA_real_; levP <- NA_real_ }
# The user's equal-variance option decides pooled vs Welch (card pill, drawn default off -> Welch).
# Levene above is the reported assumption check, NOT a gate.
res <- t.test(score ~ g, var.equal = equal_variance)
a <- score[g==lv[1]]; b <- score[g==lv[2]]; n1<-length(a); n2<-length(b)
sp <- sqrt(((n1-1)*sd(a)^2 + (n2-1)*sd(b)^2)/(n1+n2-2)); d <- (mean(a)-mean(b))/sp
list(groupStats=gs, test=if (equal_variance) 'pooled' else 'welch',
  t=unname(res$statistic), df=unname(res$parameter), p=res$p.value,
  meanDiff=mean(a)-mean(b), ci=as.numeric(res$conf.int), cohensD=d, levene=list(F=levF, p=levP))`

// ggplot2 (per the architecture doc / outputs spec / rMap); print() renders into the active png() device.
const R_BOXPLOT = String.raw`
print(ggplot2::ggplot(data.frame(group = factor(group), score = score), ggplot2::aes(group, score)) +
  ggplot2::geom_boxplot(fill = '#9cc2ec', colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL))`

interface RawStats {
  groupStats: GroupStat[]; test: 'pooled' | 'welch'
  t: number; df: number; p: number; meanDiff: number; ci: number[]; cohensD: number; levene: { F: number | null; p: number | null }
}

export async function runIndependentTTest(engine: Engine, data: Dataset, outcome: string, group: string, equalVariance: boolean): Promise<TTestResult> {
  // Per-test listwise (spec step-4a default): drop rows missing/non-numeric in either role column.
  const rows = data.rows.filter((r) =>
    typeof r[outcome] === 'number' && Number.isFinite(r[outcome] as number) && r[group] != null && String(r[group]).trim() !== '')
  const nExcluded = data.rows.length - rows.length
  const env = { score: rows.map((r) => r[outcome] as number), group: rows.map((r) => String(r[group])), equal_variance: equalVariance }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_BOXPLOT, 600, 450, env)
  return {
    groupStats: [s.groupStats[0], s.groupStats[1]],
    contrast: `${s.groupStats[0].group} − ${s.groupStats[1].group}`, test: s.test,
    t: s.t, df: s.df, p: s.p, meanDiff: s.meanDiff, ci: [s.ci[0], s.ci[1]], cohensD: s.cohensD,
    levene: s.levene, nExcluded, figurePng,
  }
}
```

- [ ] **Step 5: Run → passes** — `npx vitest run src/lib/stats/independentTTest.test.ts` → PASS.

- [ ] **Step 6: Commit**
```bash
git add src/lib/stats && git commit -m "feat: faithful t-test stats (SE, option-driven pooled/Welch, Levene check, Cohen's d, ggplot2 boxplot, listwise)"
```

---

## Task 7: Sample dataset + CSV parsing

**Files:** Create `src/lib/data/sample.ts`, `src/lib/data/parseCsv.ts`, `src/lib/data/parseCsv.test.ts`

- [ ] **Step 1: Sample** — `src/lib/data/sample.ts`:
```ts
import type { Dataset } from '../stats/types'
export const SAMPLE: Dataset = { columns: ['group', 'score'], rows: [
  { group: 'control', score: 72 }, { group: 'control', score: 68 }, { group: 'control', score: 75 }, { group: 'control', score: 70 }, { group: 'control', score: 66 }, { group: 'control', score: 71 },
  { group: 'treatment', score: 81 }, { group: 'treatment', score: 79 }, { group: 'treatment', score: 85 }, { group: 'treatment', score: 83 }, { group: 'treatment', score: 78 }, { group: 'treatment', score: 88 },
] }
```

- [ ] **Step 2: Failing test** — `src/lib/data/parseCsv.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseCsv } from './parseCsv'
describe('parseCsv', () => {
  it('parses headers + typed rows', () => {
    const ds = parseCsv('group,score\nA,10\nB,12\n')
    expect(ds.columns).toEqual(['group', 'score'])
    expect(ds.rows[1]).toEqual({ group: 'B', score: 12 })
  })
  it('keeps missing cells as null — never 0 (the listwise filter downstream relies on this)', () => {
    const ds = parseCsv('group,score\nA,\nB,12\n')
    expect(ds.rows[0]).toEqual({ group: 'A', score: null })
  })
})
```

- [ ] **Step 3: Run → fails.** `npx vitest run src/lib/data/parseCsv.test.ts`

- [ ] **Step 4: Implement** — `src/lib/data/parseCsv.ts`:
```ts
import Papa from 'papaparse'
import type { Dataset } from '../stats/types'
export function parseCsv(text: string): Dataset {
  const out = Papa.parse<Record<string, string | number | null>>(text.trim(), { header: true, dynamicTyping: true, skipEmptyLines: true })
  return { columns: out.meta.fields ?? Object.keys(out.data[0] ?? {}), rows: out.data }
}
```

- [ ] **Step 5: Run → passes.** Commit:
```bash
git add src/lib/data && git commit -m "feat: sample dataset + CSV parsing"
```

---

## Task 8: Zustand session store

**Files:** Create `src/state/session.ts`, `src/state/session.test.ts`

- [ ] **Step 1: Failing test** — `src/state/session.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSession } from './session'
import { SAMPLE } from '../lib/data/sample'
describe('session', () => {
  beforeEach(() => useSession.getState().reset())
  it('holds dataset + config; equal variance defaults OFF (Welch, per the card)', () => {
    useSession.getState().setDataset(SAMPLE)
    useSession.getState().setConfig({ outcome: 'score', group: 'group' })
    expect(useSession.getState().config.outcome).toBe('score')
    expect(useSession.getState().config.equalVariance).toBe(false)
    expect(useSession.getState().status).toBe('idle')
  })
  it('changing config invalidates a displayed result; an error clears it (Export must never capture stale/null)', () => {
    useSession.getState().setDataset(SAMPLE)
    useSession.getState().setResult({} as never)
    expect(useSession.getState().status).toBe('done')
    useSession.getState().setConfig({ outcome: 'score' })
    expect(useSession.getState().result).toBeNull()
    expect(useSession.getState().status).toBe('idle')
    useSession.getState().setResult({} as never)
    useSession.getState().setError('boom')
    expect(useSession.getState().result).toBeNull()
    expect(useSession.getState().status).toBe('error')
  })
})
```

- [ ] **Step 2: Run → fails.**

- [ ] **Step 3: Implement** — `src/state/session.ts`:
```ts
import { create } from 'zustand'
import type { Dataset, TTestResult } from '../lib/stats/types'
type Status = 'idle' | 'running' | 'done' | 'error'
interface Config { outcome: string | null; group: string | null; equalVariance: boolean }
interface S {
  dataset: Dataset | null; config: Config; result: TTestResult | null; status: Status; error: string | null
  setDataset: (d: Dataset) => void; setConfig: (c: Partial<Config>) => void
  setStatus: (s: Status) => void; setResult: (r: TTestResult) => void; setError: (e: string) => void; reset: () => void
}
// equalVariance: false = the card's drawn default 'off · Welch'
const initial = { dataset: null, config: { outcome: null, group: null, equalVariance: false }, result: null, status: 'idle' as Status, error: null }
export const useSession = create<S>((set) => ({
  ...initial,
  setDataset: (dataset) => set({ dataset, result: null, status: 'idle', error: null }),
  // a config change invalidates any displayed result — the screen must never show output of a previous config
  setConfig: (c) => set((s) => ({ config: { ...s.config, ...c }, result: null, status: 'idle', error: null })),
  setStatus: (status) => set({ status }), setResult: (result) => set({ result, status: 'done' }),
  // an error clears the previous result so ExportButton can't capture a half-gone DOM
  setError: (error) => set({ error, status: 'error', result: null }), reset: () => set({ ...initial }),
}))
```

- [ ] **Step 4: Run → passes.** Commit:
```bash
git add src/state && git commit -m "feat: Zustand session store"
```

---

## Task 9: Export bundle (spec filenames, per-test folder)

Per `telos_ui_spec.html`'s bundle tree, each test's images live in an `NN_<test-id>/` folder — this slice ships `01_independent-t-test/`. **Deferred (recorded decision, not drift):** the full spec bundle's root-level `report.pdf`, `report.tex`, `analysis.R` and `data/cleaned.csv` are deferred to a later plan.

**Files:** Create `src/lib/export/bundle.ts`, `src/lib/export/bundle.test.ts`

- [ ] **Step 1: Failing test** — `src/lib/export/bundle.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { unzipSync } from 'fflate'
import { buildBundle } from './bundle'
describe('buildBundle', () => {
  it('zips files under their exact paths (per-test folder per the ui spec tree)', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    const files = unzipSync(buildBundle({ '01_independent-t-test/table_t-test.png': png, '01_independent-t-test/figure_boxplot.png': png }))
    expect(Object.keys(files).sort()).toEqual(['01_independent-t-test/figure_boxplot.png', '01_independent-t-test/table_t-test.png'])
  })
})
```

- [ ] **Step 2: Run → fails.**

- [ ] **Step 3: Implement** — `src/lib/export/bundle.ts`:
```ts
import { zipSync } from 'fflate'
// Typed buffer return: Uint8Array<ArrayBufferLike> is not assignable to BlobPart under TS 6.
export function buildBundle(files: Record<string, Uint8Array>): Uint8Array<ArrayBuffer> { return zipSync(files) as Uint8Array<ArrayBuffer> }
```

- [ ] **Step 4: Run → passes.** Commit:
```bash
git add src/lib/export && git commit -m "feat: zip export bundle (filename map)"
```

---

## Task 10: UI — render the registry faithfully

The result UI renders **from the registry** (table columns incl. M<sub>diff</sub>, roles, the equal-variance option, how-to-read, APA template) — so it matches the spec cards. Scope decisions recorded here: only the **equal-variance** option gets a control in this slice (Benjie's R3 ruling) — α/tails/CI are encoded + consistency-checked but their controls are deferred; CI cells render at 2 dp like every other cell (the exemplar's 1-dp CI is treated as illustrative rounding); the card's bold/italic emphasis layer (how-to-read emphasis, APA symbol italics) is deferred to the visual-design pass — the registry stores plain text, and the APA line renders roman (whole-line italics would invert the card's symbol-only convention); `rMap` stays meta (encoded, not rendered).

**Files:** Create `src/components/ApaTable.tsx`, `DatasetLoader.tsx`, `TestConfig.tsx`, `ResultCard.tsx`, `ExportButton.tsx`

- [ ] **Step 1: ApaTable (renders a `TableSpec` + rows)** — `src/components/ApaTable.tsx`:
```tsx
import type { TableSpec } from '../lib/registry/types'
export function ApaTable({ id, spec, rows }: { id: string; spec: TableSpec; rows: Record<string, string | number>[] }) {
  return (
    <table id={id} className="apa">
      <thead><tr>{spec.columns.map((c) => <th key={c.key}>{c.label}{c.sub && <sub>{c.sub}</sub>}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{spec.columns.map((c) => <td key={c.key}>{r[c.key]}</td>)}</tr>)}</tbody>
    </table>
  )
}
```

- [ ] **Step 2: DatasetLoader** — `src/components/DatasetLoader.tsx`:
```tsx
import { useSession } from '../state/session'
import { SAMPLE } from '../lib/data/sample'
import { parseCsv } from '../lib/data/parseCsv'
export function DatasetLoader() {
  const { dataset, setDataset } = useSession()
  return (
    <section>
      <button onClick={() => setDataset(SAMPLE)}>Load sample data</button>
      <input type="file" accept=".csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setDataset(parseCsv(await f.text())) }} />
      {dataset && <p>{dataset.rows.length} rows · {dataset.columns.join(', ')}</p>}
    </section>
  )
}
```

- [ ] **Step 3: TestConfig (run on a shared engine; labels from `spec.roles`; equal-variance control; boot progress)** — `src/components/TestConfig.tsx`:
```tsx
import { useState } from 'react'
import { useSession } from '../state/session'
import { Engine } from '../lib/webr/engine'
import { runIndependentTTest } from '../lib/stats/independentTTest'
import { INDEPENDENT_T_TEST as spec } from '../lib/registry/independentTTest'
import type { RoleSpec } from '../lib/registry/types'
let enginePromise: Promise<Engine> | null = null
const getEngine = (onStatus?: (m: string) => void) => (enginePromise ??= (async () => { const e = new Engine(); await e.init(onStatus); return e })())
export function TestConfig() {
  const { dataset, config, setConfig, setStatus, setResult, setError, status } = useSession()
  const [phase, setPhase] = useState<string | null>(null) // boot/run progress — first click downloads the WebR runtime + ggplot2
  if (!dataset) return null
  const run = async () => {
    if (!config.outcome || !config.group) return
    setStatus('running')
    try {
      const engine = await getEngine(setPhase)
      setPhase('Running analysis…')
      setResult(await runIndependentTTest(engine, dataset, config.outcome, config.group, config.equalVariance))
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setPhase(null) }
  }
  // Role labels + level requirements come from the registry (the inputs card), never hardcoded strings.
  const [outcomeRole, groupRole] = spec.roles
  const sel = (key: 'outcome' | 'group', role: RoleSpec) => (
    <label>{role.label} ({role.levels} · {role.arity}){' '}
      <select value={config[key] ?? ''} onChange={(e) => setConfig({ [key]: e.target.value })}>
        <option value="">—</option>{dataset.columns.map((c) => <option key={c}>{c}</option>)}
      </select></label>
  )
  const eqOpt = spec.options.find((o) => o.id === 'equalVariance')!
  return (
    <section>
      {sel('outcome', outcomeRole)} {sel('group', groupRole)}
      <label>
        <input type="checkbox" checked={config.equalVariance} onChange={(e) => setConfig({ equalVariance: e.target.checked })} />
        {' '}{eqOpt.label} ({eqOpt.value})
      </label>
      <button disabled={!config.outcome || !config.group || status === 'running'} onClick={run}>
        {status === 'running' ? (phase ?? 'Running…') : 'Run analysis'}
      </button>
    </section>
  )
}
```

- [ ] **Step 4: ResultCard (faithful to the exemplar)** — `src/components/ResultCard.tsx`. Formatting conventions taken from the card itself: U+2212 minus on negatives (the card uses `&minus;` throughout), **integer df when mathematically integer** ("t(58)", pooled) and 2 dp only for Welch's fractional df, **1 dp for M/SD inside the APA sentence** (the card rounds Table 1's 7.55 to "SD=7.6" — a convention, not a typo), p substituted **as a clause** so the floored case renders "p<.001" never "p=<.001", and em-dash for undefined stats (degenerate Levene) so `toFixed(null)` can never throw in render:
```tsx
import { useEffect, useState } from 'react'
import { useSession } from '../state/session'
import { INDEPENDENT_T_TEST as spec } from '../lib/registry/independentTTest'
import { ApaTable } from './ApaTable'

const minus = (s: string) => s.replace(/-/g, '−')                                  // U+2212, as the card typesets negatives
const f = (n: number) => minus(n.toFixed(2))
const f1 = (n: number) => minus(n.toFixed(1))                                      // APA-sentence M/SD, per the card
const fdf = (n: number) => (Number.isInteger(n) ? String(n) : f(n))                // 't(58)' pooled · 't(9.68)' Welch
const fp = (p: number) => (p < 0.001 ? '<.001' : p.toFixed(3).replace(/^0/, ''))
const fx = (n: number | null, fmt: (v: number) => string) => (n == null || !Number.isFinite(n) ? '—' : fmt(n))

export function ResultCard() {
  const { result, status, error } = useSession()
  const [figureUrl, setFigureUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!result) { setFigureUrl(null); return }
    const url = URL.createObjectURL(new Blob([result.figurePng], { type: 'image/png' }))
    setFigureUrl(url)
    return () => URL.revokeObjectURL(url) // revoke on result change/unmount — no blob leaks (StrictMode-safe)
  }, [result])
  if (status === 'error') return <p role="alert">Error: {error}</p>
  if (!result) return null
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
    <section className="card" style={{ padding: 16 }}>
      <h2 className="display">{spec.name}</h2>
      <p style={{ color: 'var(--muted)' }}>{spec.question}</p>
      <p><b>Table 1.</b> {spec.tables[0].title}</p>
      <ApaTable id={`table-${spec.tables[0].id}`} spec={spec.tables[0]} rows={t1Rows} />
      <p><b>Table 2.</b> {spec.tables[1].title}</p>
      <ApaTable id={`table-${spec.tables[1].id}`} spec={spec.tables[1]} rows={t2Rows} />
      <p style={{ fontSize: 11, color: 'var(--muted)' }}>{spec.assumptionNote} (Levene F={fx(result.levene.F, f)}, p={fx(result.levene.p, fp)} · {result.test} test)</p>
      {result.nExcluded > 0 && <p style={{ fontSize: 11, color: 'var(--muted)' }}>{result.nExcluded} rows excluded (missing values)</p>}
      <p><b>Figure.</b> {spec.figure.caption}</p>
      {figureUrl && <img src={figureUrl} alt="boxplot of the outcome by group" width={480} />}
      <h3 className="display">How to read this test</h3>
      <p>{spec.howToRead}</p>
      <p>APA: {apa}</p>
    </section>
  )
}
```

- [ ] **Step 5: ExportButton (capture the rendered tables → spec bundle)** — `src/components/ExportButton.tsx`. Filenames + DOM ids derive **from table ids** (the consistency test pins them to `bundleFiles`), the zip nests everything in the ui spec's `01_independent-t-test/` folder, the capture gets an **explicit background from the live theme** (otherwise html-to-image produces transparent PNGs — 88.5% alpha-0 measured, illegible from dark mode), and the button only renders for a **completed** run (an error or config change clears `result`, so it can never capture missing nodes):
```tsx
import { toPng } from 'html-to-image'
import { useSession } from '../state/session'
import { buildBundle } from '../lib/export/bundle'
import { INDEPENDENT_T_TEST as spec } from '../lib/registry/independentTTest'

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.split(',')[1]); const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
const capture = async (id: string) =>
  dataUrlToBytes(await toPng(document.getElementById(id)!, { pixelRatio: 2, backgroundColor: getComputedStyle(document.body).backgroundColor }))

export function ExportButton() {
  const { result, status } = useSession()
  if (!result || status !== 'done') return null
  const download = async () => {
    const folder = `01_${spec.id}/` // per the ui spec bundle tree: each test's images in an NN_<id>/ folder
    const files: Record<string, Uint8Array> = {}
    for (const t of spec.tables) files[`${folder}table_${t.id}.png`] = await capture(`table-${t.id}`)
    files[`${folder}figure_${spec.figure.type}.png`] = result.figurePng
    const url = URL.createObjectURL(new Blob([buildBundle(files)], { type: 'application/zip' }))
    const a = document.createElement('a'); a.href = url; a.download = 'telos-results.zip'; a.click(); URL.revokeObjectURL(url)
  }
  return <button onClick={download}>Download results (.zip)</button>
}
```

- [ ] **Step 6: Commit**
```bash
git add src/components && git commit -m "feat: registry-driven result UI (faithful APA tables, how-to-read, APA template, spec bundle)"
```

---

## Task 11: Wire the app + E2E

**Files:** Modify `src/App.tsx`; create `tests/e2e/slice.spec.ts`, `playwright.config.ts`

- [ ] **Step 1: App** — `src/App.tsx` (a small error boundary so a render bug — e.g. an unexpected null stat — degrades to a message instead of white-screening the whole app):
```tsx
import { Component, type ReactNode } from 'react'
import { DatasetLoader } from './components/DatasetLoader'
import { TestConfig } from './components/TestConfig'
import { ResultCard } from './components/ResultCard'
import { ExportButton } from './components/ExportButton'

class ResultBoundary extends Component<{ children: ReactNode }, { msg: string | null }> {
  state = { msg: null as string | null }
  static getDerivedStateFromError(e: unknown) { return { msg: e instanceof Error ? e.message : String(e) } }
  render() { return this.state.msg ? <p role="alert">Display error: {this.state.msg}</p> : this.props.children }
}

export default function App() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1 className="display">Telos</h1>
      <DatasetLoader /><TestConfig />
      <ResultBoundary><ResultCard /><ExportButton /></ResultBoundary>
    </main>
  )
}
```

- [ ] **Step 2: Playwright config** — `playwright.config.ts` (the webServer builds + serves the prod bundle with the COOP/COEP preview headers; `npm run e2e` already self-installs Chromium via the Task 1 script):
```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'tests/e2e', timeout: 300_000, // two analysis runs + first-visit WebR assets + the ggplot2 download from the WebR repo (network)
  webServer: { command: 'npm run build && npm run preview -- --port 4173', url: 'http://localhost:4173', timeout: 180_000, reuseExistingServer: false },
  use: { baseURL: 'http://localhost:4173' },
})
```

- [ ] **Step 3: E2E (asserts the faithful numbers, both equal-variance positions)** — `tests/e2e/slice.spec.ts`. Every expected value below is sandbox-verified R output for the sample data, formatted with the card's conventions (U+2212 minus, integer pooled df):
```ts
import { test, expect } from '@playwright/test'
test('load sample → run (Welch default) → toggle equal variance → pooled — faithful numbers + export', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Load sample data' }).click()
  await page.getByLabel(/Outcome \(DV\)/).selectOption('score')
  await page.getByLabel(/Grouping variable/).selectOption('group')

  // 1) drawn default: equal variance OFF → Welch runs
  await page.getByRole('button', { name: 'Run analysis' }).click()
  await expect(page.getByRole('heading', { name: 'Independent t-test' })).toBeVisible({ timeout: 240_000 })
  const t1 = page.locator('#table-group-statistics'), t2 = page.locator('#table-t-test')
  await expect(t1).toContainText('SE')
  await expect(t1).toContainText('70.33'); await expect(t1).toContainText('3.14'); await expect(t1).toContainText('1.28')
  await expect(t1).toContainText('82.33'); await expect(t1).toContainText('3.78'); await expect(t1).toContainText('1.54')
  await expect(t2).toContainText('Mdiff') // M<sub>diff</sub> header text
  await expect(t2).toContainText('−5.98'); await expect(t2).toContainText('9.68') // Welch df, fractional
  await expect(t2).toContainText('<.001'); await expect(t2).toContainText('−12.00')
  await expect(t2).toContainText('[−16.49, −7.51]'); await expect(t2).toContainText('−3.45')

  // 2) toggling the control invalidates the result, re-running gives the pooled row
  await page.getByLabel(/equal variance/).check()
  await expect(t2).toHaveCount(0) // stale result cleared by the config change
  await page.getByRole('button', { name: 'Run analysis' }).click()
  await expect(page.locator('#table-t-test')).toBeVisible({ timeout: 120_000 })
  await expect(page.locator('#table-t-test')).toContainText('10') // integer pooled df
  await expect(page.locator('#table-t-test')).toContainText('[−16.47, −7.53]')

  await expect(page.getByText('How to read this test')).toBeVisible()
  await expect(page.getByRole('img', { name: /boxplot/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download results (.zip)' })).toBeVisible()
})
```

- [ ] **Step 4: Run** — `npm run e2e` → PASS (first run downloads the Playwright browser if missing, the WebR assets, and ggplot2 — network required). `npm test` must ALSO still be green: the vitest `include` pattern keeps it away from `tests/e2e/`.

- [ ] **Step 5: Commit**
```bash
git add src/App.tsx tests/e2e playwright.config.ts && git commit -m "feat: wire slice app + faithful-output E2E"
```

---

## Task 12: Deploy to Cloudflare Pages

**Files:** Create `README.md`

- [ ] **Step 1: Production build runs** — `npm run build && npm run preview` → open URL, run the t-test → faithful tables + boxplot + zip work (confirms `_headers` + self-hosted WebR in the prod bundle).

- [ ] **Step 2: Create the Pages project (user, one-time)** — `npx wrangler pages project create telos --production-branch main`

- [ ] **Step 3: Deploy** — `npm run build && npx wrangler pages deploy dist --project-name telos`
Expected: a live `*.pages.dev` URL; loading the sample + running the t-test renders the faithful result and downloads the zip.

- [ ] **Step 4: README** — document: dev/test/e2e/deploy commands (note `npm run e2e` installs Chromium itself; first runs need network for the browser AND for ggplot2 from the WebR package repo, which the browser then caches); the COOP/COEP requirement; self-hosted WebR; **licensing/attribution** — R + the webR binaries are GPLv3 (`LICENSE.md` ships in `public/webr/`, source links to the upstream projects), Crimson Pro and Atkinson Hyperlegible are SIL OFL 1.1 (OFL texts in `public/fonts/`); and a **bundle section** noting the export zip currently contains only the `01_independent-t-test/` images — `report.pdf`/`report.tex`/`analysis.R`/`data/cleaned.csv` come in a later plan, which will also add a LICENSES note to the bundle. Commit:
```bash
git add README.md && git commit -m "docs: deploy notes, prerequisites + licence attribution"
```

---

## Done — definition of success

- `npm test` green (Vitest — `tests/e2e/` excluded by the `include` pattern, so this stays green after Task 11): registry-consistency (card-scoped equality against BOTH spec files, incl. the M<sub>diff</sub> markup and the option strip), engine (5 tests incl. serializer hardening), faithful t-test stats (**both equal-variance positions** + listwise exclusion), parse (missing cells stay null), store (result invalidation + error clearing), export (foldered zip paths).
- `npm run e2e` green **separately** (Playwright): the browser shows the two spec APA tables with the **sandbox-verified sample numbers for both equal-variance positions** (Welch by default — df 9.68; pooled after toggling — df 10), U+2212 minus, the how-to-read text, the **ggplot2** boxplot, and downloads the bundle zip with the `01_independent-t-test/` folder.
- A live Cloudflare Pages URL producing that **spec-faithful** result, with the data never leaving the browser.
- **Deferred by decision (later plans), not drift:** the bundle's root-level `report.pdf`, `report.tex`, `analysis.R`, `data/cleaned.csv`; the α/tails/CI option controls (encoded + consistency-checked now); the card's bold/italic emphasis layer and APA symbol italics (registry stores plain text for the skeleton).

This validates the architecture **and** the spec-driven content model: the independent t-test is rendered from a registry encoded from `telos_test_outputs.html` + `telos_test_inputs.html`, kept honest by a card-scoped equality consistency test. Plans 2–6 (data pipeline, the remaining tests, SEM, polish) reuse the registry + engine + the `ApaTable`/`runJson`/`capturePlot` patterns — each new test is a registry entry encoded from its spec card.
