# Telos Walking Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed web app where a user loads a small dataset, runs an independent t-test entirely in the browser (via WebR), sees an APA-style result table + boxplot, and exports a zip — proving the whole Telos v1 architecture end-to-end.

**Architecture:** Static React SPA. All statistics run client-side in a WebR (R→WebAssembly) worker; the uploaded data never leaves the browser. State in Zustand. Each unit (engine adapter, stats module, store, export) is isolated behind a typed interface so later test families plug in without touching the engine.

**Tech Stack:** Vite + React 18 + TypeScript · `webr` (R engine) · PapaParse (CSV) · fflate (zip) · Zustand (state) · Vitest (unit) + Playwright (E2E) · Cloudflare Pages (host).

**Reference:** Architecture doc `docs/superpowers/specs/2026-06-10-telos-architecture-design.md`. The WebR mechanics here (boot, `detectCores` shim, package install, fit timing) were validated by a spike — see §4 of that doc.

---

## File structure (created by this plan)

| File | Responsibility |
|---|---|
| `vite.config.ts` | Build config + dev/preview COOP/COEP headers (WebR needs cross-origin isolation) |
| `public/_headers` | Production COOP/COEP headers for Cloudflare Pages |
| `public/webr/` | Self-hosted WebR runtime assets (same-origin → avoids COEP cross-origin issues) |
| `scripts/copy-webr.mjs` | Copies `node_modules/webr/dist` → `public/webr/` on install/build |
| `src/styles/tokens.css` | Design tokens (colors, dark/light) + font-face (Crimson Pro, Atkinson Hyperlegible) |
| `src/lib/webr/engine.ts` | The ONLY module that talks to WebR: boot, shim, `runJson`, `capturePlot` |
| `src/lib/stats/independentTTest.ts` | Generate R + parse a typed `TTestResult`; the boxplot R |
| `src/lib/stats/types.ts` | Shared result/dataset types |
| `src/lib/data/sample.ts` | A built-in sample dataset |
| `src/lib/data/parseCsv.ts` | PapaParse wrapper → `Dataset` |
| `src/lib/export/bundle.ts` | Zip a result (table PNG + figure PNG) via fflate |
| `src/state/session.ts` | Zustand store: dataset, config, result, status |
| `src/components/DatasetLoader.tsx` | Load sample or upload CSV |
| `src/components/TestConfig.tsx` | Pick outcome + grouping column; Run button |
| `src/components/ResultCard.tsx` | APA table + boxplot image |
| `src/components/ExportButton.tsx` | Download the zip |
| `src/App.tsx` | Wire the slice flow |
| `tests/e2e/slice.spec.ts` | Playwright: load → configure → run → result → export |

---

## Task 1: Scaffold the project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `vitest.setup.ts`

- [ ] **Step 1: Create the Vite React-TS app in the repo root**

Run:
```bash
npm create vite@latest telos-app -- --template react-ts
# move its contents into the repo root (this repo already holds the specs/docs)
rsync -a telos-app/ ./ && rm -rf telos-app
npm install
npm install webr papaparse fflate zustand
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @playwright/test @types/papaparse
npx playwright install chromium
```
Expected: `node_modules/` populated; `package.json` lists the deps above.

- [ ] **Step 2: Configure Vite with COOP/COEP headers and Vitest**

Create `vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [react()],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  optimizeDeps: { exclude: ['webr'] },
  test: {
    environment: 'node',          // engine/stats tests run WebR in Node (same V8 as Chrome)
    testTimeout: 120_000,         // WebR boot + package install is slow on first run
    setupFiles: [],
  },
})
```

- [ ] **Step 3: Add npm scripts**

In `package.json`, set `"scripts"`:
```json
{
  "scripts": {
    "postinstall": "node scripts/copy-webr.mjs",
    "dev": "vite",
    "build": "tsc -b && node scripts/copy-webr.mjs && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  }
}
```

- [ ] **Step 4: Smoke test the toolchain**

Create `src/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
describe('toolchain', () => {
  it('runs vitest', () => { expect(1 + 1).toBe(2) })
})
```
Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS app with WebR/test deps"
```

---

## Task 2: Self-host the WebR runtime + production headers

WebR loads its worker/wasm from a base URL. Under `COEP: require-corp`, cross-origin assets need special handling; serving WebR's assets **same-origin** avoids that entirely.

**Files:**
- Create: `scripts/copy-webr.mjs`, `public/_headers`

- [ ] **Step 1: Write the asset-copy script**

Create `scripts/copy-webr.mjs`:
```js
import { cpSync, existsSync, mkdirSync } from 'node:fs'
const src = 'node_modules/webr/dist'
const dest = 'public/webr'
if (!existsSync(src)) { console.error('webr dist not found — is webr installed?'); process.exit(1) }
mkdirSync(dest, { recursive: true })
cpSync(src, dest, { recursive: true })
console.log('Copied WebR runtime assets to public/webr/')
```

- [ ] **Step 2: Run it and verify**

Run:
```bash
node scripts/copy-webr.mjs
ls public/webr/ | head
```
Expected: lists `webr-worker.js`, `R.bin.*`, etc. (WebR runtime files).

- [ ] **Step 3: Add production headers for Cloudflare Pages**

Create `public/_headers`:
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

- [ ] **Step 4: Ignore the copied assets**

Append to `.gitignore`:
```
public/webr/
```
(They're regenerated from `node_modules` on install/build.)

- [ ] **Step 5: Commit**

```bash
git add scripts/copy-webr.mjs public/_headers .gitignore
git commit -m "build: self-host WebR assets + COOP/COEP headers"
```

---

## Task 3: Design tokens + fonts

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/main.tsx` (import tokens), `index.html` (remove default Vite styles)

- [ ] **Step 1: Download the two locked fonts into the app**

Run:
```bash
mkdir -p public/fonts
# Crimson Pro (display) + Atkinson Hyperlegible (UI) — woff2 from Google Fonts
curl -sS -H "User-Agent: Mozilla/5.0 Chrome/124" \
  "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Crimson+Pro:wght@500;600;700&display=swap" \
  -o /tmp/gf.css
grep -oE 'https://[^)]+\.woff2' /tmp/gf.css | sort -u | while read u; do curl -sS "$u" -O --output-dir public/fonts; done
ls public/fonts
```
Expected: several `.woff2` files in `public/fonts/`.

- [ ] **Step 2: Write tokens + @font-face**

Create `src/styles/tokens.css` (carry the existing Telos palette from the specs; `@font-face` blocks reference the woff2 files just downloaded — list each weight you saved):
```css
@font-face { font-family:'Crimson Pro'; font-weight:600; font-display:swap; src:url('/fonts/crimson-pro-600.woff2') format('woff2'); }
@font-face { font-family:'Atkinson Hyperlegible'; font-weight:400; font-display:swap; src:url('/fonts/atkinson-400.woff2') format('woff2'); }
@font-face { font-family:'Atkinson Hyperlegible'; font-weight:700; font-display:swap; src:url('/fonts/atkinson-700.woff2') format('woff2'); }

:root{
  --bg:#1b1b1b; --card:#262624; --text:#e8e6df; --muted:#a3a199; --line:rgba(255,255,255,0.18);
  --blue-bg:#0c447c; --blue-tx:#cfe2f6; --amber-bg:#6b4708; --amber-tx:#f7d79a; --teal-bg:#0c5a47; --teal-tx:#bfe9da;
  --font-display:'Crimson Pro', Georgia, serif;
  --font-ui:'Atkinson Hyperlegible', system-ui, sans-serif;
}
@media (prefers-color-scheme: light){
  :root{ --bg:#f0efe9; --card:#fff; --text:#2c2c2a; --muted:#5f5e5a; --line:rgba(0,0,0,0.22); }
}
*{box-sizing:border-box;}
body{margin:0;font-family:var(--font-ui);background:var(--bg);color:var(--text);line-height:1.5;}
h1,h2,h3,.display{font-family:var(--font-display);}
```
(Rename the `url(...)` paths to match the exact filenames in `public/fonts/`.)

- [ ] **Step 3: Import tokens; clean default styles**

In `src/main.tsx`, replace `import './index.css'` with `import './styles/tokens.css'`. Delete `src/App.css` and `src/index.css`.

- [ ] **Step 4: Visual check**

Run: `npm run dev` → open the printed localhost URL.
Expected: page renders with the dark/light background and the new fonts (no Vite default styling).

- [ ] **Step 5: Commit**

```bash
git add src/styles public/fonts src/main.tsx index.html
git rm -f src/App.css src/index.css
git commit -m "feat: design tokens + Crimson Pro / Atkinson Hyperlegible fonts"
```

---

## Task 4: WebR engine adapter (boot + shim + runJson)

The single module that touches WebR. Returns parsed JSON so callers never handle raw R objects. **This is the architecture's keystone — test it against real WebR.**

**Files:**
- Create: `src/lib/webr/engine.ts`, `src/lib/webr/engine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/webr/engine.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from './engine'

describe('Engine', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('runs R and returns parsed JSON', async () => {
    const out = await engine.runJson<{ sum: number }>('list(sum = 2 + 3)')
    expect(out.sum).toBe(5)
  })

  it('applies the detectCores shim so lavaan-style option checks work', async () => {
    const cores = await engine.runJson<number>('parallel::detectCores()')
    expect(cores).toBe(1)
  })

  it('passes JS data into R as vectors', async () => {
    const out = await engine.runJson<number>('mean(x)', { x: [2, 4, 6] })
    expect(out).toBe(4)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/webr/engine.test.ts`
Expected: FAIL — "Cannot find module './engine'".

- [ ] **Step 3: Implement the engine**

Create `src/lib/webr/engine.ts`:
```ts
import { WebR } from 'webr'

// In Node (tests) WebR resolves its own assets; in the browser, point at the self-hosted copy.
const BASE_URL = typeof window === 'undefined' ? undefined : '/webr/'

const DETECTCORES_SHIM = `
local({
  ns <- asNamespace("parallel")
  unlockBinding("detectCores", ns)
  assign("detectCores", function(logical = TRUE, all.tests = FALSE) 1L, envir = ns)
})`

export class Engine {
  private webr: WebR
  private ready = false

  constructor() {
    this.webr = new WebR(BASE_URL ? { baseUrl: BASE_URL } : {})
  }

  async init(): Promise<void> {
    if (this.ready) return
    await this.webr.init()
    await this.webr.evalRVoid(DETECTCORES_SHIM)
    this.ready = true
  }

  async installPackages(pkgs: string[]): Promise<void> {
    await this.webr.installPackages(pkgs)
  }

  /** Run R that prints a JSON string as its LAST stdout line; returns it parsed. */
  async runJson<T>(rExpr: string, env?: Record<string, unknown>): Promise<T> {
    const code = `cat(.telos_json(${rExpr}))`
    const shelter = await new this.webr.Shelter()
    try {
      // .telos_json: minimal R->JSON without a package dependency.
      await this.webr.evalRVoid(TELOS_JSON_HELPER)
      const cap = await shelter.captureR(code, { captureStreams: true, env: env as any })
      const text = cap.output.filter((o) => o.type === 'stdout').map((o) => o.data).join('')
      return JSON.parse(text) as T
    } finally {
      await shelter.purge()
    }
  }

  async close(): Promise<void> {
    if (this.ready) { await this.webr.close(); this.ready = false }
  }

  get raw(): WebR { return this.webr }
}

// Recursive R value -> JSON string. Handles scalars, numeric/char vectors, and named lists.
const TELOS_JSON_HELPER = String.raw`
.telos_json <- function(x) {
  if (is.list(x)) {
    nm <- names(x); if (is.null(nm)) nm <- rep("", length(x))
    parts <- vapply(seq_along(x), function(i) {
      key <- if (nzchar(nm[i])) paste0('"', nm[i], '":') else ''
      paste0(key, .telos_json(x[[i]]))
    }, character(1))
    if (all(nzchar(nm))) paste0('{', paste(parts, collapse=','), '}')
    else paste0('[', paste(parts, collapse=','), ']')
  } else if (is.character(x)) {
    if (length(x) == 1) paste0('"', x, '"') else paste0('[', paste0('"', x, '"', collapse=','), ']')
  } else if (is.logical(x)) {
    v <- tolower(as.character(x)); if (length(x)==1) v else paste0('[', paste(v, collapse=','), ']')
  } else {
    v <- ifelse(is.na(x), 'null', formatC(x, format='g', digits=10))
    if (length(x) == 1) v else paste0('[', paste(v, collapse=','), ']')
  }
}`
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/webr/engine.test.ts`
Expected: PASS (3 tests). First run is slow (WebR boot ~0.5s + any downloads).

- [ ] **Step 5: Commit**

```bash
git add src/lib/webr/engine.ts src/lib/webr/engine.test.ts
git commit -m "feat: WebR engine adapter (boot, detectCores shim, runJson)"
```

---

## Task 5: WebR plot capture

**Files:**
- Modify: `src/lib/webr/engine.ts` (add `capturePlot`)
- Create: `src/lib/webr/plot.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/webr/plot.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from './engine'

describe('Engine.capturePlot', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('captures a base-R plot as PNG bytes', async () => {
    const png = await engine.capturePlot('boxplot(c(1,2,3) ~ c("a","a","b"))')
    expect(png.byteLength).toBeGreaterThan(100)
    // PNG magic number
    expect(Array.from(png.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/webr/plot.test.ts`
Expected: FAIL — `engine.capturePlot is not a function`.

- [ ] **Step 3: Implement `capturePlot` (write PNG in R's virtual FS, read the bytes)**

Add to the `Engine` class in `src/lib/webr/engine.ts`:
```ts
  /** Run plotting R, return the resulting PNG as bytes. */
  async capturePlot(plotR: string, width = 600, height = 450): Promise<Uint8Array> {
    const path = '/tmp/telos-plot.png'
    await this.webr.evalRVoid(
      `png('${path}', width=${width}, height=${height}, res=110); tryCatch({ ${plotR} }, finally = dev.off())`
    )
    const bytes = await this.webr.FS.readFile(path)
    return bytes
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/webr/plot.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/webr/engine.ts src/lib/webr/plot.test.ts
git commit -m "feat: WebR plot capture to PNG bytes"
```

---

## Task 6: Independent t-test stats module

**Files:**
- Create: `src/lib/stats/types.ts`, `src/lib/stats/independentTTest.ts`, `src/lib/stats/independentTTest.test.ts`

- [ ] **Step 1: Define shared types**

Create `src/lib/stats/types.ts`:
```ts
export interface Dataset {
  columns: string[]
  rows: Record<string, string | number>[]
}

export interface TTestResult {
  groups: [string, string]
  n: [number, number]
  mean: [number, number]
  sd: [number, number]
  t: number
  df: number
  p: number
  meanDiff: number
  ci: [number, number]
  cohensD: number
  figurePng: Uint8Array
}
```

- [ ] **Step 2: Write the failing test (known dataset, known answer)**

Create `src/lib/stats/independentTTest.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runIndependentTTest } from './independentTTest'
import type { Dataset } from './types'

const data: Dataset = {
  columns: ['group', 'score'],
  rows: [
    { group: 'A', score: 10 }, { group: 'A', score: 12 }, { group: 'A', score: 11 }, { group: 'A', score: 13 },
    { group: 'B', score: 15 }, { group: 'B', score: 17 }, { group: 'B', score: 16 }, { group: 'B', score: 18 },
  ],
}

describe('runIndependentTTest', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })

  it('computes the Welch t-test, descriptives, and Cohen\'s d', async () => {
    const r = await runIndependentTTest(engine, data, 'score', 'group')
    expect(r.groups).toEqual(['A', 'B'])
    expect(r.n).toEqual([4, 4])
    expect(r.mean[0]).toBeCloseTo(11.5, 5)
    expect(r.mean[1]).toBeCloseTo(16.5, 5)
    expect(r.t).toBeLessThan(0)                 // A < B
    expect(r.p).toBeLessThan(0.01)
    expect(Math.abs(r.cohensD)).toBeGreaterThan(2)
    expect(r.figurePng.byteLength).toBeGreaterThan(100)
  })
})
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run src/lib/stats/independentTTest.test.ts`
Expected: FAIL — cannot find `./independentTTest`.

- [ ] **Step 4: Implement the module**

Create `src/lib/stats/independentTTest.ts`:
```ts
import type { Engine } from '../webr/engine'
import type { Dataset, TTestResult } from './types'

const R_TTEST = String.raw`
g <- factor(group); lv <- levels(g)
a <- score[g == lv[1]]; b <- score[g == lv[2]]
res <- t.test(a, b)              # Welch
n1 <- length(a); n2 <- length(b)
sp <- sqrt(((n1-1)*sd(a)^2 + (n2-1)*sd(b)^2) / (n1+n2-2))
d  <- (mean(a) - mean(b)) / sp
list(
  groups = lv,
  n = c(n1, n2), mean = c(mean(a), mean(b)), sd = c(sd(a), sd(b)),
  t = unname(res$statistic), df = unname(res$parameter), p = res$p.value,
  meanDiff = mean(a) - mean(b), ci = as.numeric(res$conf.int), cohensD = d
)`

const R_BOXPLOT = String.raw`boxplot(score ~ factor(group), col = '#9cc2ec', border = '#0c447c', ylab = '', xlab = '')`

export async function runIndependentTTest(
  engine: Engine, data: Dataset, outcome: string, group: string,
): Promise<TTestResult> {
  const score = data.rows.map((r) => Number(r[outcome]))
  const groupVals = data.rows.map((r) => String(r[group]))
  const env = { score, group: groupVals }

  const stats = await engine.runJson<Omit<TTestResult, 'figurePng' | 'groups'> & { groups: string[] }>(R_TTEST, env)
  const figurePng = await engine.capturePlot(R_BOXPLOT, 600, 450, env) // see Step 5

  return {
    ...stats,
    groups: [stats.groups[0], stats.groups[1]],
    n: stats.n as [number, number],
    mean: stats.mean as [number, number],
    sd: stats.sd as [number, number],
    ci: stats.ci as [number, number],
    figurePng,
  }
}
```

- [ ] **Step 5: Extend `capturePlot` to accept an env (so the boxplot sees the data)**

In `src/lib/webr/engine.ts`, change `capturePlot` to thread an env through `evalR`:
```ts
  async capturePlot(plotR: string, width = 600, height = 450, env?: Record<string, unknown>): Promise<Uint8Array> {
    const path = '/tmp/telos-plot.png'
    await this.webr.evalRVoid(
      `png('${path}', width=${width}, height=${height}, res=110); tryCatch({ ${plotR} }, finally = dev.off())`,
      { env: env as any },
    )
    return await this.webr.FS.readFile(path)
  }
```
(`evalRVoid` accepts `{ env }` to bind the JS vectors; no shelter needed since nothing is returned to JS. The Task-5 test call still passes — it omits `env`, which is fine. Verified against WebR: `png()`/cairo are available and write a valid PNG to the virtual FS.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/lib/stats/independentTTest.test.ts src/lib/webr/plot.test.ts`
Expected: PASS (both files).

- [ ] **Step 7: Commit**

```bash
git add src/lib/stats src/lib/webr/engine.ts
git commit -m "feat: independent t-test stats module (Welch + Cohen's d + boxplot)"
```

---

## Task 7: Sample dataset + CSV parsing

**Files:**
- Create: `src/lib/data/sample.ts`, `src/lib/data/parseCsv.ts`, `src/lib/data/parseCsv.test.ts`

- [ ] **Step 1: Built-in sample dataset**

Create `src/lib/data/sample.ts`:
```ts
import type { Dataset } from '../stats/types'

export const SAMPLE: Dataset = {
  columns: ['group', 'score'],
  rows: [
    { group: 'control', score: 72 }, { group: 'control', score: 68 }, { group: 'control', score: 75 },
    { group: 'control', score: 70 }, { group: 'control', score: 66 }, { group: 'control', score: 71 },
    { group: 'treatment', score: 81 }, { group: 'treatment', score: 79 }, { group: 'treatment', score: 85 },
    { group: 'treatment', score: 83 }, { group: 'treatment', score: 78 }, { group: 'treatment', score: 88 },
  ],
}
```

- [ ] **Step 2: Write the failing CSV-parse test**

Create `src/lib/data/parseCsv.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseCsv } from './parseCsv'

describe('parseCsv', () => {
  it('parses headers + typed rows', () => {
    const ds = parseCsv('group,score\nA,10\nB,12\n')
    expect(ds.columns).toEqual(['group', 'score'])
    expect(ds.rows).toHaveLength(2)
    expect(ds.rows[1]).toEqual({ group: 'B', score: 12 })
  })
})
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx vitest run src/lib/data/parseCsv.test.ts`
Expected: FAIL — cannot find `./parseCsv`.

- [ ] **Step 4: Implement the parser**

Create `src/lib/data/parseCsv.ts`:
```ts
import Papa from 'papaparse'
import type { Dataset } from '../stats/types'

export function parseCsv(text: string): Dataset {
  const out = Papa.parse<Record<string, string | number>>(text.trim(), {
    header: true, dynamicTyping: true, skipEmptyLines: true,
  })
  const rows = out.data
  const columns = out.meta.fields ?? (rows[0] ? Object.keys(rows[0]) : [])
  return { columns, rows }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/data/parseCsv.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/data
git commit -m "feat: sample dataset + CSV parsing"
```

---

## Task 8: Zustand session store

**Files:**
- Create: `src/state/session.ts`, `src/state/session.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/state/session.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSession } from './session'
import { SAMPLE } from '../lib/data/sample'

describe('session store', () => {
  beforeEach(() => useSession.getState().reset())

  it('holds dataset + config and tracks status', () => {
    useSession.getState().setDataset(SAMPLE)
    useSession.getState().setConfig({ outcome: 'score', group: 'group' })
    const s = useSession.getState()
    expect(s.dataset?.columns).toContain('score')
    expect(s.config.outcome).toBe('score')
    expect(s.status).toBe('idle')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/state/session.test.ts`
Expected: FAIL — cannot find `./session`.

- [ ] **Step 3: Implement the store**

Create `src/state/session.ts`:
```ts
import { create } from 'zustand'
import type { Dataset, TTestResult } from '../lib/stats/types'

type Status = 'idle' | 'running' | 'done' | 'error'
interface Config { outcome: string | null; group: string | null }

interface SessionState {
  dataset: Dataset | null
  config: Config
  result: TTestResult | null
  status: Status
  error: string | null
  setDataset: (d: Dataset) => void
  setConfig: (c: Partial<Config>) => void
  setStatus: (s: Status) => void
  setResult: (r: TTestResult) => void
  setError: (e: string) => void
  reset: () => void
}

const initial = { dataset: null, config: { outcome: null, group: null }, result: null, status: 'idle' as Status, error: null }

export const useSession = create<SessionState>((set) => ({
  ...initial,
  setDataset: (dataset) => set({ dataset, result: null, status: 'idle', error: null }),
  setConfig: (c) => set((s) => ({ config: { ...s.config, ...c } })),
  setStatus: (status) => set({ status }),
  setResult: (result) => set({ result, status: 'done' }),
  setError: (error) => set({ error, status: 'error' }),
  reset: () => set({ ...initial }),
}))
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/state/session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state
git commit -m "feat: Zustand session store"
```

---

## Task 9: Export bundle (zip)

**Files:**
- Create: `src/lib/export/bundle.ts`, `src/lib/export/bundle.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/export/bundle.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { unzipSync } from 'fflate'
import { buildBundle } from './bundle'

describe('buildBundle', () => {
  it('zips the figure png and a results text file', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
    const zip = buildBundle({ figurePng: png, summary: 'group A vs B' })
    const files = unzipSync(zip)
    expect(Object.keys(files)).toContain('figure_boxplot.png')
    expect(Object.keys(files)).toContain('results.txt')
    expect(files['figure_boxplot.png']).toEqual(png)
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/lib/export/bundle.test.ts`
Expected: FAIL — cannot find `./bundle`.

- [ ] **Step 3: Implement the bundler**

Create `src/lib/export/bundle.ts`:
```ts
import { zipSync, strToU8 } from 'fflate'

export function buildBundle(input: { figurePng: Uint8Array; summary: string }): Uint8Array {
  return zipSync({
    'figure_boxplot.png': input.figurePng,
    'results.txt': strToU8(input.summary),
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/export/bundle.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export
git commit -m "feat: zip export bundle"
```

---

## Task 10: UI components

Standard React; no new logic. Each component reads/writes the store.

**Files:**
- Create: `src/components/DatasetLoader.tsx`, `src/components/TestConfig.tsx`, `src/components/ResultCard.tsx`, `src/components/ExportButton.tsx`

- [ ] **Step 1: DatasetLoader**

Create `src/components/DatasetLoader.tsx`:
```tsx
import { useSession } from '../state/session'
import { SAMPLE } from '../lib/data/sample'
import { parseCsv } from '../lib/data/parseCsv'

export function DatasetLoader() {
  const setDataset = useSession((s) => s.setDataset)
  const dataset = useSession((s) => s.dataset)
  const onFile = async (f: File) => setDataset(parseCsv(await f.text()))
  return (
    <section>
      <button onClick={() => setDataset(SAMPLE)}>Load sample data</button>
      <input type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      {dataset && <p>{dataset.rows.length} rows · {dataset.columns.join(', ')}</p>}
    </section>
  )
}
```

- [ ] **Step 2: TestConfig (picks columns, runs the test)**

Create `src/components/TestConfig.tsx`:
```tsx
import { useSession } from '../state/session'
import { Engine } from '../lib/webr/engine'
import { runIndependentTTest } from '../lib/stats/independentTTest'

let enginePromise: Promise<Engine> | null = null
function getEngine(): Promise<Engine> {
  if (!enginePromise) enginePromise = (async () => { const e = new Engine(); await e.init(); return e })()
  return enginePromise
}

export function TestConfig() {
  const { dataset, config, setConfig, setStatus, setResult, setError, status } = useSession()
  if (!dataset) return null
  const run = async () => {
    if (!config.outcome || !config.group) return
    setStatus('running')
    try {
      const engine = await getEngine()
      setResult(await runIndependentTTest(engine, dataset, config.outcome, config.group))
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }
  return (
    <section>
      <label>Outcome (numeric):{' '}
        <select value={config.outcome ?? ''} onChange={(e) => setConfig({ outcome: e.target.value })}>
          <option value="">—</option>{dataset.columns.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label>Grouping (2 levels):{' '}
        <select value={config.group ?? ''} onChange={(e) => setConfig({ group: e.target.value })}>
          <option value="">—</option>{dataset.columns.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <button disabled={!config.outcome || !config.group || status === 'running'} onClick={run}>
        {status === 'running' ? 'Running…' : 'Run analysis'}
      </button>
    </section>
  )
}
```

- [ ] **Step 3: ResultCard (APA table + figure)**

Create `src/components/ResultCard.tsx`:
```tsx
import { useMemo } from 'react'
import { useSession } from '../state/session'

export function ResultCard() {
  const { result, status, error } = useSession()
  const figureUrl = useMemo(
    () => (result ? URL.createObjectURL(new Blob([result.figurePng], { type: 'image/png' })) : null),
    [result],
  )
  if (status === 'error') return <p role="alert">Error: {error}</p>
  if (!result) return null
  const f = (n: number) => n.toFixed(2)
  return (
    <section className="card">
      <h2 className="display">Independent t-test</h2>
      <table>
        <thead><tr><th>Group</th><th>N</th><th>M</th><th>SD</th></tr></thead>
        <tbody>
          {result.groups.map((g, i) => (
            <tr key={g}><td>{g}</td><td>{result.n[i]}</td><td>{f(result.mean[i])}</td><td>{f(result.sd[i])}</td></tr>
          ))}
        </tbody>
      </table>
      <p>t({f(result.df)}) = {f(result.t)}, p = {result.p.toFixed(3)}, d = {f(result.cohensD)},
         95% CI [{f(result.ci[0])}, {f(result.ci[1])}]</p>
      {figureUrl && <img src={figureUrl} alt="Boxplot of the outcome by group" width={480} />}
    </section>
  )
}
```

- [ ] **Step 4: ExportButton**

Create `src/components/ExportButton.tsx`:
```tsx
import { useSession } from '../state/session'
import { buildBundle } from '../lib/export/bundle'

export function ExportButton() {
  const result = useSession((s) => s.result)
  if (!result) return null
  const download = () => {
    const summary = `Independent t-test\nt(${result.df.toFixed(2)}) = ${result.t.toFixed(2)}, p = ${result.p.toFixed(3)}, d = ${result.cohensD.toFixed(2)}`
    const zip = buildBundle({ figurePng: result.figurePng, summary })
    const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }))
    const a = document.createElement('a'); a.href = url; a.download = 'telos-results.zip'; a.click()
    URL.revokeObjectURL(url)
  }
  return <button onClick={download}>Download results (.zip)</button>
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components
git commit -m "feat: slice UI components (loader, config, result, export)"
```

---

## Task 11: Wire the App + end-to-end test

**Files:**
- Modify: `src/App.tsx`
- Create: `tests/e2e/slice.spec.ts`, `playwright.config.ts`

- [ ] **Step 1: Compose the app**

Replace `src/App.tsx`:
```tsx
import { DatasetLoader } from './components/DatasetLoader'
import { TestConfig } from './components/TestConfig'
import { ResultCard } from './components/ResultCard'
import { ExportButton } from './components/ExportButton'

export default function App() {
  return (
    <main className="wrap" style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1 className="display">Telos</h1>
      <DatasetLoader />
      <TestConfig />
      <ResultCard />
      <ExportButton />
    </main>
  )
}
```

- [ ] **Step 2: Playwright config (serve the built app with the headers)**

Create `playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  webServer: { command: 'npm run build && npm run preview -- --port 4173', url: 'http://localhost:4173', timeout: 180_000, reuseExistingServer: false },
  use: { baseURL: 'http://localhost:4173' },
})
```

- [ ] **Step 3: Write the E2E test**

Create `tests/e2e/slice.spec.ts`:
```ts
import { test, expect } from '@playwright/test'

test('load sample → run t-test → see result', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Load sample data' }).click()
  await page.getByLabel('Outcome (numeric):').selectOption('score')
  await page.getByLabel('Grouping (2 levels):').selectOption('group')
  await page.getByRole('button', { name: 'Run analysis' }).click()
  // WebR boots + runs; allow time
  await expect(page.getByRole('heading', { name: 'Independent t-test' })).toBeVisible({ timeout: 120_000 })
  await expect(page.getByRole('img', { name: /boxplot/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download results (.zip)' })).toBeVisible()
})
```

- [ ] **Step 4: Run the E2E test**

Run: `npm run e2e`
Expected: PASS (the headers from `vite preview` enable WebR; first run downloads WebR assets).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx tests/e2e playwright.config.ts
git commit -m "feat: wire slice app + Playwright E2E"
```

---

## Task 12: Deploy to Cloudflare Pages

**Files:**
- Create: `wrangler.toml` (optional), deployment notes in `README.md`

- [ ] **Step 1: Production build works locally**

Run: `npm run build && npm run preview`
Expected: build succeeds; opening the preview URL and running the t-test works (confirms `public/_headers` + self-hosted WebR resolve in the production bundle).

- [ ] **Step 2: Create the project on Cloudflare Pages**

Run (one-time, interactive — the user does this):
```bash
npx wrangler pages project create telos --production-branch main
```

- [ ] **Step 3: Deploy**

Run:
```bash
npm run build
npx wrangler pages deploy dist --project-name telos
```
Expected: a live `*.pages.dev` URL. Open it, load the sample, run the t-test — APA result + boxplot render, zip downloads.

- [ ] **Step 4: Document it**

Create `README.md` with: dev (`npm run dev`), test (`npm test`, `npm run e2e`), and deploy (`wrangler pages deploy dist`). Note the COOP/COEP requirement and that WebR assets are self-hosted from `public/webr/`.

- [ ] **Step 5: Commit**

```bash
git add README.md wrangler.toml
git commit -m "docs: deploy notes + Cloudflare Pages config"
```

---

## Done — definition of success

- `npm test` green (engine, plot, t-test, parse, store, export).
- `npm run e2e` green (full browser flow).
- A live Cloudflare Pages URL where loading the sample and running an independent t-test produces the APA table + boxplot and a downloadable zip — **with the data never leaving the browser.**

This validates the entire v1 architecture (static SPA + in-browser WebR + export + deploy). Plans 2–6 (data pipeline, test registry, more families, SEM, polish) build on these exact modules.
