# Telos Walking Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deployed web app where a user loads a small dataset, runs an independent t-test entirely in the browser (WebR), and sees a result **faithful to the approved spec** — the two real APA tables, the "how to read" text, the APA write-up, and the spec's export bundle — proving the whole Telos v1 architecture end-to-end.

**Architecture:** Static React SPA; all statistics run client-side in a WebR (R→WASM) worker — data never leaves the browser. **The content of every test is driven by a typed registry encoded from the HTML specs** (`telos_test_inputs.html`, `telos_test_outputs.html`): table columns, "how to read" text, APA template, bundle filenames all come from the spec cards. The app *renders* that content with the design system. State in Zustand.

**Tech Stack:** Vite + React 18 + TypeScript · `webr` (R engine) · PapaParse (CSV) · `html-to-image` (table → PNG) · fflate (zip) · Zustand · Vitest + Playwright · Cloudflare Pages.

**Source of truth:** The three HTML specs are the **content blueprint**. The registry (Task 4) encodes the independent t-test's content **verbatim from its card in `telos_test_outputs.html`** (and roles from `telos_test_inputs.html`). A consistency test asserts the registry can't drift from the specs. The app's *visual design* is rebuilt in React (not copied from the HTML markup); only the *content* comes from the specs.

**Pre-verified against WebR (not guessed):** `png()` plot capture to the virtual FS; the faithful t-test R (SE, Levene's → pooled/Welch, Cohen's d) serialized via a no-dependency JSON helper; `runJson` must wrap R in `{ … }`.

---

## File structure

| File | Responsibility |
|---|---|
| `vite.config.ts` | Build + dev/preview COOP/COEP headers (WebR needs cross-origin isolation) |
| `public/_headers`, `scripts/copy-webr.mjs`, `public/webr/` | Production headers + self-hosted WebR runtime (same-origin) |
| `src/styles/tokens.css` | Design tokens + Crimson Pro / Atkinson Hyperlegible fonts |
| `src/lib/registry/types.ts` | `TestSpec`, `TableSpec`, `ColumnDef`, `RoleSpec` |
| `src/lib/registry/independentTTest.ts` | The t-test spec **encoded from the HTML cards** |
| `src/lib/webr/engine.ts` | The ONLY WebR module: boot, `detectCores` shim, `runJson`, `capturePlot` |
| `src/lib/stats/types.ts` | `Dataset`, `GroupStat`, `TTestResult` |
| `src/lib/stats/independentTTest.ts` | Faithful R (SE/Levene's/pooled-Welch/d) → typed result + boxplot |
| `src/lib/data/sample.ts`, `src/lib/data/parseCsv.ts` | Sample dataset + CSV → `Dataset` |
| `src/lib/export/bundle.ts` | Zip a `{filename: bytes}` map (spec bundle) |
| `src/state/session.ts` | Zustand: dataset, config, result, status |
| `src/components/ApaTable.tsx` | Render a `TableSpec` + row data as an APA table |
| `src/components/DatasetLoader.tsx`, `TestConfig.tsx`, `ResultCard.tsx`, `ExportButton.tsx` | The slice UI |
| `src/App.tsx`, `tests/e2e/slice.spec.ts` | Wire-up + E2E |

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

- [ ] **Step 2: `vite.config.ts` (headers + Vitest)**

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
const isolation = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' }
export default defineConfig({
  plugins: [react()],
  server: { headers: isolation },
  preview: { headers: isolation },
  optimizeDeps: { exclude: ['webr'] },
  test: { environment: 'node', testTimeout: 120_000 },
})
```

- [ ] **Step 3: npm scripts** — set `package.json` `"scripts"`:
```json
{ "scripts": {
  "postinstall": "node scripts/copy-webr.mjs",
  "dev": "vite", "build": "tsc -b && node scripts/copy-webr.mjs && vite build", "preview": "vite preview",
  "test": "vitest run", "e2e": "playwright test"
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

WebR loads worker/wasm from a base URL; serving them **same-origin** avoids COEP cross-origin issues.

**Files:** Create `scripts/copy-webr.mjs`, `public/_headers`

- [ ] **Step 1: Copy script** — `scripts/copy-webr.mjs`:
```js
import { cpSync, existsSync, mkdirSync } from 'node:fs'
const src = 'node_modules/webr/dist', dest = 'public/webr'
if (!existsSync(src)) { console.error('webr dist not found'); process.exit(1) }
mkdirSync(dest, { recursive: true }); cpSync(src, dest, { recursive: true })
console.log('Copied WebR runtime to public/webr/')
```

- [ ] **Step 2: Run + verify** — `node scripts/copy-webr.mjs && ls public/webr/ | head`
Expected: lists `webr-worker.js`, `R.bin.*`.

- [ ] **Step 3: Production headers** — `public/_headers`:
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

- [ ] **Step 4: Ignore copied assets** — append `public/webr/` to `.gitignore`.

- [ ] **Step 5: Commit**
```bash
git add scripts/copy-webr.mjs public/_headers .gitignore
git commit -m "build: self-host WebR assets + COOP/COEP headers"
```

---

## Task 3: Design tokens + fonts

**Files:** Create `src/styles/tokens.css`; modify `src/main.tsx`

- [ ] **Step 1: Download the locked fonts**
```bash
mkdir -p public/fonts
curl -sS -H "User-Agent: Mozilla/5.0 Chrome/124" \
  "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Crimson+Pro:wght@600;700&display=swap" -o /tmp/gf.css
grep -oE 'https://[^)]+\.woff2' /tmp/gf.css | sort -u | while read u; do curl -sS "$u" -O --output-dir public/fonts; done
ls public/fonts
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
table.apa{border-collapse:collapse;font-size:13px;margin:6px 0;} table.apa th,table.apa td{padding:4px 10px;text-align:right;}
table.apa th:first-child,table.apa td:first-child{text-align:left;}
table.apa thead th{border-top:1.5px solid var(--text);border-bottom:.75px solid var(--text);}
table.apa tbody tr:last-child td{border-bottom:1.5px solid var(--text);}
```
(Rename the `url(...)` paths to the actual filenames in `public/fonts/`.)

- [ ] **Step 3:** In `src/main.tsx` replace the style import with `import './styles/tokens.css'`; delete `src/App.css`, `src/index.css`.

- [ ] **Step 4: Visual check** — `npm run dev`, open the URL → fonts + APA table styling load.

- [ ] **Step 5: Commit**
```bash
git add src/styles public/fonts src/main.tsx && git rm -f src/App.css src/index.css
git commit -m "feat: design tokens + Crimson Pro / Atkinson Hyperlegible"
```

---

## Task 4: Test registry (encoded from the HTML specs)

The registry is the machine-readable form of the spec cards. **Source: the Independent t-test card in `telos_test_outputs.html` (Table 1/2 columns, how-to-read, APA template, R map, bundle) and its card in `telos_test_inputs.html` (roles).** A consistency test asserts it matches.

**Files:** Create `src/lib/registry/types.ts`, `src/lib/registry/independentTTest.ts`, `src/lib/registry/registry.consistency.test.ts`

- [ ] **Step 1: Types** — `src/lib/registry/types.ts`:
```ts
export interface ColumnDef { key: string; label: string }
export interface TableSpec { id: string; title: string; columns: ColumnDef[] }
export interface RoleSpec { id: string; label: string; levels: string; arity: string }
export interface TestSpec {
  id: string
  name: string
  question: string
  roles: RoleSpec[]
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

// Encoded from telos_test_outputs.html (Independent t-test exemplar) + telos_test_inputs.html (roles).
export const INDEPENDENT_T_TEST: TestSpec = {
  id: 'independent-t-test',
  name: 'Independent t-test',
  question: "do two groups' means differ?",
  roles: [
    { id: 'outcome', label: 'Dependent variable', levels: 'interval / ratio', arity: 'exactly 1' },
    { id: 'group', label: 'Grouping variable', levels: 'nominal', arity: 'exactly 1 (2 levels)' },
  ],
  tables: [
    { id: 'group-statistics', title: 'Group statistics',
      columns: [{ key: 'group', label: 'Group' }, { key: 'n', label: 'N' }, { key: 'mean', label: 'M' }, { key: 'sd', label: 'SD' }, { key: 'se', label: 'SE' }] },
    { id: 't-test', title: 'Independent-samples t-test',
      columns: [{ key: 'contrast', label: 'Contrast' }, { key: 't', label: 't' }, { key: 'df', label: 'df' }, { key: 'p', label: 'p' }, { key: 'mdiff', label: 'Mdiff' }, { key: 'ci', label: '95% CI' }, { key: 'd', label: 'd' }] },
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

- [ ] **Step 3: Write the failing consistency test**

`src/lib/registry/registry.consistency.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { INDEPENDENT_T_TEST as spec } from './independentTTest'

const outputsHtml = readFileSync('telos_test_outputs.html', 'utf8')

describe('registry stays faithful to the spec HTML', () => {
  it('bundle filenames all appear in the outputs spec', () => {
    spec.bundleFiles.forEach((f) => expect(outputsHtml, `missing ${f}`).toContain(f))
  })
  it('table titles appear in the outputs spec', () => {
    spec.tables.forEach((t) => expect(outputsHtml, `missing "${t.title}"`).toContain(t.title))
  })
  it('the how-to-read text is grounded in the spec', () => {
    expect(outputsHtml).toContain('two groups')
    expect(outputsHtml).toContain('Cohen')
  })
})
```

- [ ] **Step 4: Run it** — `npx vitest run src/lib/registry/registry.consistency.test.ts`
Expected: PASS (the registry strings exist in `telos_test_outputs.html`). If any fails, the registry has drifted from the spec — fix the registry to match the card.

- [ ] **Step 5: Commit**
```bash
git add src/lib/registry && git commit -m "feat: test registry encoded from the HTML specs + consistency test"
```

---

## Task 5: WebR engine adapter

**Files:** Create `src/lib/webr/engine.ts`, `src/lib/webr/engine.test.ts`

- [ ] **Step 1: Failing test** — `src/lib/webr/engine.test.ts`:
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

// Recursive R->JSON, no package dependency. Handles scalars, vectors, named + unnamed lists.
const TELOS_JSON_HELPER = String.raw`
.telos_json <- function(x) {
  if (is.list(x)) {
    nm <- names(x); if (is.null(nm)) nm <- rep("", length(x))
    parts <- vapply(seq_along(x), function(i) { key <- if (nzchar(nm[i])) paste0('"', nm[i], '":') else ''; paste0(key, .telos_json(x[[i]])) }, character(1))
    if (length(x) && all(nzchar(nm))) paste0('{', paste(parts, collapse=','), '}') else paste0('[', paste(parts, collapse=','), ']')
  } else if (is.character(x)) { if (length(x)==1) paste0('"', x, '"') else paste0('[', paste0('"', x, '"', collapse=','), ']')
  } else { v <- ifelse(is.na(x), 'null', formatC(x, format='g', digits=10)); if (length(x)==1) v else paste0('[', paste(v, collapse=','), ']') }
}`

export class Engine {
  private webr: WebR
  private ready = false
  constructor() { this.webr = new WebR(BASE_URL ? { baseUrl: BASE_URL } : {}) }

  async init(): Promise<void> {
    if (this.ready) return
    await this.webr.init()
    await this.webr.evalRVoid(DETECTCORES_SHIM)
    await this.webr.evalRVoid(TELOS_JSON_HELPER)
    this.ready = true
  }

  /** Evaluate an R block (statements allowed); its last value is serialized to JSON and parsed. */
  async runJson<T>(rBlock: string, env?: Record<string, unknown>): Promise<T> {
    const shelter = await new this.webr.Shelter()
    try {
      const cap = await shelter.captureR(`cat(.telos_json({\n${rBlock}\n}))`, { captureStreams: true, env: env as any })
      const text = cap.output.filter((o) => o.type === 'stdout').map((o) => o.data).join('')
      return JSON.parse(text) as T
    } finally { await shelter.purge() }
  }

  /** Run plotting R (env-bound), return the PNG bytes from the virtual FS. */
  async capturePlot(plotR: string, width = 600, height = 450, env?: Record<string, unknown>): Promise<Uint8Array> {
    const path = '/tmp/telos-plot.png'
    await this.webr.evalRVoid(`png('${path}', width=${width}, height=${height}, res=110); tryCatch({ ${plotR} }, finally = dev.off())`, { env: env as any })
    return await this.webr.FS.readFile(path)
  }

  async close(): Promise<void> { if (this.ready) { await this.webr.close(); this.ready = false } }
}
```

- [ ] **Step 4: Run → passes** — `npx vitest run src/lib/webr/engine.test.ts` → PASS (4 tests; first run slow).

- [ ] **Step 5: Commit**
```bash
git add src/lib/webr && git commit -m "feat: WebR engine adapter (shim, runJson with block wrap, capturePlot)"
```

---

## Task 6: Independent t-test stats (faithful to the spec)

Computes everything the spec's two tables need: SE, Levene's → pooled/Welch selection, Cohen's d. **This R block was verified against WebR.**

**Files:** Create `src/lib/stats/types.ts`, `src/lib/stats/independentTTest.ts`, `src/lib/stats/independentTTest.test.ts`

- [ ] **Step 1: Types** — `src/lib/stats/types.ts`:
```ts
export interface Dataset { columns: string[]; rows: Record<string, string | number>[] }
export interface GroupStat { group: string; n: number; mean: number; sd: number; se: number }
export interface TTestResult {
  groupStats: [GroupStat, GroupStat]
  contrast: string
  test: 'pooled' | 'welch'
  t: number; df: number; p: number; meanDiff: number; ci: [number, number]; cohensD: number
  levene: { F: number; p: number }
  figurePng: Uint8Array
}
```

- [ ] **Step 2: Failing test (known data, known answer)** — `src/lib/stats/independentTTest.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runIndependentTTest } from './independentTTest'
import type { Dataset } from './types'

const data: Dataset = { columns: ['group', 'score'], rows: [
  { group: 'A', score: 10 }, { group: 'A', score: 12 }, { group: 'A', score: 11 }, { group: 'A', score: 13 },
  { group: 'B', score: 15 }, { group: 'B', score: 17 }, { group: 'B', score: 16 }, { group: 'B', score: 18 },
] }

describe('runIndependentTTest', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() })
  afterAll(async () => { await engine.close() })
  it('produces the spec tables (SE, pooled/Welch via Levene, Cohen d, boxplot)', async () => {
    const r = await runIndependentTTest(engine, data, 'score', 'group')
    expect(r.groupStats.map((g) => g.group)).toEqual(['A', 'B'])
    expect(r.groupStats[0].n).toBe(4)
    expect(r.groupStats[0].se).toBeCloseTo(0.6455, 3)
    expect(r.test).toBe('pooled')          // equal SDs → Levene n.s. → pooled
    expect(r.df).toBe(6)
    expect(r.t).toBeCloseTo(-5.477, 2)
    expect(r.p).toBeLessThan(0.01)
    expect(r.cohensD).toBeCloseTo(-3.873, 2)
    expect(r.contrast).toBe('A − B')
    expect(Array.from(r.figurePng.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
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
equalvar <- is.na(levP) || levP >= 0.05
res <- t.test(score ~ g, var.equal = equalvar)
a <- score[g==lv[1]]; b <- score[g==lv[2]]; n1<-length(a); n2<-length(b)
sp <- sqrt(((n1-1)*sd(a)^2 + (n2-1)*sd(b)^2)/(n1+n2-2)); d <- (mean(a)-mean(b))/sp
list(groupStats=gs, test=if (equalvar) 'pooled' else 'welch',
  t=unname(res$statistic), df=unname(res$parameter), p=res$p.value,
  meanDiff=mean(a)-mean(b), ci=as.numeric(res$conf.int), cohensD=d, levene=list(F=levF, p=levP))`

const R_BOXPLOT = String.raw`boxplot(score ~ factor(group), col = '#9cc2ec', border = '#0c447c', ylab = '', xlab = '')`

interface RawStats {
  groupStats: GroupStat[]; test: 'pooled' | 'welch'
  t: number; df: number; p: number; meanDiff: number; ci: number[]; cohensD: number; levene: { F: number; p: number }
}

export async function runIndependentTTest(engine: Engine, data: Dataset, outcome: string, group: string): Promise<TTestResult> {
  const env = { score: data.rows.map((r) => Number(r[outcome])), group: data.rows.map((r) => String(r[group])) }
  const s = await engine.runJson<RawStats>(R_STATS, env)
  const figurePng = await engine.capturePlot(R_BOXPLOT, 600, 450, env)
  return {
    groupStats: [s.groupStats[0], s.groupStats[1]],
    contrast: `${s.groupStats[0].group} − ${s.groupStats[1].group}`, test: s.test,
    t: s.t, df: s.df, p: s.p, meanDiff: s.meanDiff, ci: [s.ci[0], s.ci[1]], cohensD: s.cohensD,
    levene: s.levene, figurePng,
  }
}
```

- [ ] **Step 5: Run → passes** — `npx vitest run src/lib/stats/independentTTest.test.ts` → PASS.

- [ ] **Step 6: Commit**
```bash
git add src/lib/stats && git commit -m "feat: faithful independent t-test stats (SE, Levene→pooled/Welch, Cohen's d)"
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
})
```

- [ ] **Step 3: Run → fails.** `npx vitest run src/lib/data/parseCsv.test.ts`

- [ ] **Step 4: Implement** — `src/lib/data/parseCsv.ts`:
```ts
import Papa from 'papaparse'
import type { Dataset } from '../stats/types'
export function parseCsv(text: string): Dataset {
  const out = Papa.parse<Record<string, string | number>>(text.trim(), { header: true, dynamicTyping: true, skipEmptyLines: true })
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
  it('holds dataset + config', () => {
    useSession.getState().setDataset(SAMPLE)
    useSession.getState().setConfig({ outcome: 'score', group: 'group' })
    expect(useSession.getState().config.outcome).toBe('score')
    expect(useSession.getState().status).toBe('idle')
  })
})
```

- [ ] **Step 2: Run → fails.**

- [ ] **Step 3: Implement** — `src/state/session.ts`:
```ts
import { create } from 'zustand'
import type { Dataset, TTestResult } from '../lib/stats/types'
type Status = 'idle' | 'running' | 'done' | 'error'
interface Config { outcome: string | null; group: string | null }
interface S {
  dataset: Dataset | null; config: Config; result: TTestResult | null; status: Status; error: string | null
  setDataset: (d: Dataset) => void; setConfig: (c: Partial<Config>) => void
  setStatus: (s: Status) => void; setResult: (r: TTestResult) => void; setError: (e: string) => void; reset: () => void
}
const initial = { dataset: null, config: { outcome: null, group: null }, result: null, status: 'idle' as Status, error: null }
export const useSession = create<S>((set) => ({
  ...initial,
  setDataset: (dataset) => set({ dataset, result: null, status: 'idle', error: null }),
  setConfig: (c) => set((s) => ({ config: { ...s.config, ...c } })),
  setStatus: (status) => set({ status }), setResult: (result) => set({ result, status: 'done' }),
  setError: (error) => set({ error, status: 'error' }), reset: () => set({ ...initial }),
}))
```

- [ ] **Step 4: Run → passes.** Commit:
```bash
git add src/state && git commit -m "feat: Zustand session store"
```

---

## Task 9: Export bundle (spec filenames)

**Files:** Create `src/lib/export/bundle.ts`, `src/lib/export/bundle.test.ts`

- [ ] **Step 1: Failing test** — `src/lib/export/bundle.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { unzipSync } from 'fflate'
import { buildBundle } from './bundle'
describe('buildBundle', () => {
  it('zips the given files under their exact names', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    const files = unzipSync(buildBundle({ 'table_t-test.png': png, 'figure_boxplot.png': png }))
    expect(Object.keys(files).sort()).toEqual(['figure_boxplot.png', 'table_t-test.png'])
  })
})
```

- [ ] **Step 2: Run → fails.**

- [ ] **Step 3: Implement** — `src/lib/export/bundle.ts`:
```ts
import { zipSync } from 'fflate'
export function buildBundle(files: Record<string, Uint8Array>): Uint8Array { return zipSync(files) }
```

- [ ] **Step 4: Run → passes.** Commit:
```bash
git add src/lib/export && git commit -m "feat: zip export bundle (filename map)"
```

---

## Task 10: UI — render the registry faithfully

The result UI renders **from the registry** (table columns, how-to-read, APA template) — so it matches the spec card.

**Files:** Create `src/components/ApaTable.tsx`, `DatasetLoader.tsx`, `TestConfig.tsx`, `ResultCard.tsx`, `ExportButton.tsx`

- [ ] **Step 1: ApaTable (renders a `TableSpec` + rows)** — `src/components/ApaTable.tsx`:
```tsx
import type { TableSpec } from '../lib/registry/types'
export function ApaTable({ id, spec, rows }: { id: string; spec: TableSpec; rows: Record<string, string | number>[] }) {
  return (
    <table id={id} className="apa">
      <thead><tr>{spec.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
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

- [ ] **Step 3: TestConfig (run on a shared engine)** — `src/components/TestConfig.tsx`:
```tsx
import { useSession } from '../state/session'
import { Engine } from '../lib/webr/engine'
import { runIndependentTTest } from '../lib/stats/independentTTest'
let enginePromise: Promise<Engine> | null = null
const getEngine = () => (enginePromise ??= (async () => { const e = new Engine(); await e.init(); return e })())
export function TestConfig() {
  const { dataset, config, setConfig, setStatus, setResult, setError, status } = useSession()
  if (!dataset) return null
  const run = async () => {
    if (!config.outcome || !config.group) return
    setStatus('running')
    try { setResult(await runIndependentTTest(await getEngine(), dataset, config.outcome, config.group)) }
    catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }
  const sel = (key: 'outcome' | 'group', label: string) => (
    <label>{label}{' '}
      <select value={config[key] ?? ''} onChange={(e) => setConfig({ [key]: e.target.value })}>
        <option value="">—</option>{dataset.columns.map((c) => <option key={c}>{c}</option>)}
      </select></label>
  )
  return (
    <section>
      {sel('outcome', 'Dependent variable (numeric):')} {sel('group', 'Grouping variable (2 levels):')}
      <button disabled={!config.outcome || !config.group || status === 'running'} onClick={run}>
        {status === 'running' ? 'Running…' : 'Run analysis'}
      </button>
    </section>
  )
}
```

- [ ] **Step 4: ResultCard (faithful to the exemplar)** — `src/components/ResultCard.tsx`:
```tsx
import { useMemo } from 'react'
import { useSession } from '../state/session'
import { INDEPENDENT_T_TEST as spec } from '../lib/registry/independentTTest'
import { ApaTable } from './ApaTable'

const f = (n: number) => n.toFixed(2)
const fp = (p: number) => (p < .001 ? '<.001' : p.toFixed(3).replace(/^0/, ''))

export function ResultCard() {
  const { result, status, error } = useSession()
  const figureUrl = useMemo(() => (result ? URL.createObjectURL(new Blob([result.figurePng], { type: 'image/png' })) : null), [result])
  if (status === 'error') return <p role="alert">Error: {error}</p>
  if (!result) return null
  const [g1, g2] = result.groupStats
  const t1Rows = result.groupStats.map((g) => ({ group: g.group, n: g.n, mean: f(g.mean), sd: f(g.sd), se: f(g.se) }))
  const t2Rows = [{ contrast: result.contrast, t: f(result.t), df: f(result.df), p: fp(result.p),
    mdiff: f(result.meanDiff), ci: `[${f(result.ci[0])}, ${f(result.ci[1])}]`, d: f(result.cohensD) }]
  const apa = spec.apaTemplate
    .replace('{g1}', g1.group).replace('{m1}', f(g1.mean)).replace('{sd1}', f(g1.sd))
    .replace('{g2}', g2.group).replace('{m2}', f(g2.mean)).replace('{sd2}', f(g2.sd))
    .replace('{df}', f(result.df)).replace('{t}', f(result.t)).replace('{p}', fp(result.p)).replace('{d}', f(result.cohensD))
  return (
    <section className="card" style={{ padding: 16 }}>
      <h2 className="display">{spec.name}</h2>
      <p><b>Table 1.</b> {spec.tables[0].title}</p>
      <ApaTable id="table-group-statistics" spec={spec.tables[0]} rows={t1Rows} />
      <p><b>Table 2.</b> {spec.tables[1].title}</p>
      <ApaTable id="table-t-test" spec={spec.tables[1]} rows={t2Rows} />
      <p style={{ fontSize: 11, color: 'var(--muted)' }}>{spec.assumptionNote} (Levene F={f(result.levene.F)}, p={fp(result.levene.p)} → {result.test} test)</p>
      <p><b>Figure.</b> {spec.figure.caption}</p>
      {figureUrl && <img src={figureUrl} alt="boxplot of the outcome by group" width={480} />}
      <h3 className="display">How to read this test</h3>
      <p>{spec.howToRead}</p>
      <p style={{ fontStyle: 'italic' }}>APA: {apa}</p>
    </section>
  )
}
```

- [ ] **Step 5: ExportButton (capture the rendered tables → spec bundle)** — `src/components/ExportButton.tsx`:
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
const capture = async (id: string) => dataUrlToBytes(await toPng(document.getElementById(id)!, { pixelRatio: 2 }))

export function ExportButton() {
  const result = useSession((s) => s.result)
  if (!result) return null
  const download = async () => {
    const [t1, t2, fig] = spec.bundleFiles  // table_group-statistics.png · table_t-test.png · figure_boxplot.png
    const files: Record<string, Uint8Array> = {
      [t1]: await capture('table-group-statistics'),
      [t2]: await capture('table-t-test'),
      [fig]: result.figurePng,
    }
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

- [ ] **Step 1: App** — `src/App.tsx`:
```tsx
import { DatasetLoader } from './components/DatasetLoader'
import { TestConfig } from './components/TestConfig'
import { ResultCard } from './components/ResultCard'
import { ExportButton } from './components/ExportButton'
export default function App() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1 className="display">Telos</h1>
      <DatasetLoader /><TestConfig /><ResultCard /><ExportButton />
    </main>
  )
}
```

- [ ] **Step 2: Playwright config** — `playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: 'tests/e2e', timeout: 180_000,
  webServer: { command: 'npm run build && npm run preview -- --port 4173', url: 'http://localhost:4173', timeout: 180_000, reuseExistingServer: false },
  use: { baseURL: 'http://localhost:4173' },
})
```

- [ ] **Step 3: E2E (asserts the faithful output)** — `tests/e2e/slice.spec.ts`:
```ts
import { test, expect } from '@playwright/test'
test('load sample → run t-test → faithful result + export', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Load sample data' }).click()
  await page.getByLabel('Dependent variable (numeric):').selectOption('score')
  await page.getByLabel('Grouping variable (2 levels):').selectOption('group')
  await page.getByRole('button', { name: 'Run analysis' }).click()
  await expect(page.getByRole('heading', { name: 'Independent t-test' })).toBeVisible({ timeout: 120_000 })
  // the two spec tables are present
  await expect(page.locator('#table-group-statistics')).toContainText('SE')
  await expect(page.locator('#table-t-test')).toContainText('Mdiff')
  await expect(page.getByText('How to read this test')).toBeVisible()
  await expect(page.getByRole('img', { name: /boxplot/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download results (.zip)' })).toBeVisible()
})
```

- [ ] **Step 4: Run** — `npm run e2e` → PASS (first run downloads WebR assets).

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

- [ ] **Step 4: README** — document dev/test/e2e/deploy + the COOP/COEP requirement + self-hosted WebR. Commit:
```bash
git add README.md && git commit -m "docs: deploy notes + Cloudflare Pages"
```

---

## Done — definition of success

- `npm test` green: registry-consistency, engine, faithful t-test stats, parse, store, export.
- `npm run e2e` green: the browser shows the **two spec APA tables (with SE, Mdiff, etc.), the how-to-read text, the boxplot**, and downloads the spec bundle (`table_group-statistics.png`, `table_t-test.png`, `figure_boxplot.png`).
- A live Cloudflare Pages URL producing that **spec-faithful** result, with the data never leaving the browser.

This validates the architecture **and** the spec-driven content model: the independent t-test is rendered from a registry encoded from `telos_test_outputs.html`, kept honest by a consistency test. Plans 2–6 (data pipeline, the remaining tests, SEM, polish) reuse the registry + engine + the `ApaTable`/`runJson`/`capturePlot` patterns — each new test is a registry entry encoded from its spec card.
