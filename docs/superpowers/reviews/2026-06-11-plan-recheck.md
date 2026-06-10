# Telos walking-skeleton plan recheck — Part 2 (the standing gate)

**Date:** 2026-06-11 · **Method:** 6 lens reviewers (toolchain, stats, WebR API, spec-faithfulness, UI/E2E, plan-process) over the plan's code blocks — NOTHING was built in the repo; all empirical checks ran in throwaway `/tmp` sandboxes against real installs (webr 0.6.0, Vite 8/TS 6/Vitest 4, Playwright Chromium, html-to-image). Every finding adversarially verified by an independent refuter, plus a completeness critic. Run `wf_8f73e04e-024` (46 agents).

**Verdict: the plan's architecture and statistics are sound, but it will NOT execute green as written.** The R code is exactly right (every known-answer value reproduced in real WebR: SE=0.6455, t=−5.477, df=6, d=−3.873, CI direction; Levene implementation proven identical to car::leveneTest's Brown-Forsythe default). The WebR API surface is used correctly except one call. All E2E selectors resolve against the rendered DOM. Fresh-clone postinstall works; `vite preview` serves COOP/COEP; the dist is Cloudflare-Pages-safe. **The sandbox confirmed that after ~5 small fixes the full suite runs 12/12 green and `npm run build` passes.**

**Findings: 39 confirmed, 0 refuted** — 15 blocker / 13 major / 8 minor / 3 nit entries, but the blockers collapse to **7 distinct root causes** (several lenses confirmed the same defect independently):

1. **`env: undefined` crashes webr 0.6.0** — the engine always passes the `env` key; 3 of Task 5's 4 tests fail as written, contradicting the plan's 'pre-verified against WebR' claim. One-line key-omission fix; verified all 4 then pass.
2. **`tsc -b` fails on the `test` key in `vite.config.ts`** (Vite 8's `defineConfig` rejects it; needs the vitest config type reference) — `npm run build` fails, taking the Task 11 E2E webServer and Task 12 deploy with it.
3. **`tsc -b` fails on `new Blob([Uint8Array])`** under TS ~6 (BlobPart) in ResultCard and ExportButton — second independent build failure.
4. **Task 3 font download fetches zero files** — the truncated UA gets a TTF-only stylesheet, the grep targets only `.woff2`, so the locked typography silently never ships.
5. **Task 3 deletes `App.css` while the scaffold `App.tsx` (not replaced until Task 11) still imports it** — dev/build broken for Tasks 3–10.
6. **df/decimal formatting is unfaithful to the spec card** — pooled integer df renders '6.00'/'t(10.00)' where the exemplar shows '58'/'t(58)'; the APA template fills M/SD at 2dp where the card uses 1dp.
7. **`npm test` fails after Task 11** — vitest collects `tests/e2e/slice.spec.ts`; the Done definition's 'npm test green' is unachievable without excluding the e2e dir.

**Decisions only Benjie can make (flagged, not resolved):** (a) the inputs card's option strip (α, tails, equal-variance 'off · Welch', CI) is absent from the slice and the plan silently reinterprets 'equal-variance off' as an automatic Levene gate — spec ambiguity to resolve explicitly; (b) the export bundle is a flat zip of 3 PNGs while `telos_ui_spec.html` shows a `01_independent-t-test/` folder and lists `report.pdf`/`.tex`/`analysis.R`/`cleaned.csv` — omission is fine for a walking skeleton but is acknowledged nowhere; (c) the critic found the figure uses base-R `boxplot()` while the architecture doc, outputs spec, and the plan's own rMap all say ggplot2; (d) build on `main` vs a build branch (plan never says).

---

## Confirmed findings (verifier-checked, with evidence and fixes)

### 1. [BLOCKER] (faithfulness) ResultCard formats df as "58.00" and APA M/SD at 2dp — unfaithful to the exemplar card's "t(58)" and "(M=72.4, SD=8.1)"

**Claim:** Task 10 Step 4 uses a single `f = (n) => n.toFixed(2)` for every value, including df (plan lines 651, 661, 666). The exemplar card shows df as an integer in both Table 2 ("58", outputs line 244) and the APA sentence ("t(58)=", outputs line 257) — pooled df is an integer by definition, so "6.00"/"58.00" is both unfaithful and wrong APA style. The card's APA sentence also deliberately uses 1 decimal for M/SD (Table 1 shows SD=7.55 but the sentence rounds to "SD=7.6", proving it's a convention, not a typo); the plan fills the template at 2dp. This appears on screen AND in the exported table_t-test.png.

**Evidence:** Plan lines 651 (`const f = (n) => n.toFixed(2)`), 661 (`df: f(result.df)`), 666 (`.replace('{df}', f(result.df))`); telos_test_outputs.html:244 (df cell "58"), :257 ("t(58)=−3.21" and "(M=72.4, SD=8.1) ... (M=78.9, SD=7.6)" vs Table 1's 72.40/8.10/78.90/7.55 at :240-241). Sandbox /tmp/telos-recheck-specfaith/check.mjs output: card "58" vs plan f(58)="58.00"; card APA "(M=72.4, SD=8.1)...t(58)" vs plan "(M=72.40, SD=8.10)...t(58.00)".

**Suggested fix:** Add `const fdf = (df: number) => Number.isInteger(df) ? String(df) : df.toFixed(2)` (pooled → integer, Welch → 2dp) and use it for the Table-2 df cell and the {df} replacement. Add `const f1 = (n: number) => n.toFixed(1)` for M/SD inside the APA template fill, keeping 2dp in Table 1, matching the card's two conventions.

### 2. [BLOCKER] (plan-process) Task 3 deletes App.css while the scaffold App.tsx (not replaced until Task 11) still imports it — dev/build broken for Tasks 3-10

**Claim:** Task 3 Step 3 (plan line 157) deletes src/App.css and src/index.css but only edits src/main.tsx. The Vite react-ts scaffold's src/App.tsx contains `import './App.css'` and is not rewritten until Task 11 Step 1 (line 727). So Task 3 Step 4's verification (`npm run dev`, line 159) renders a module-resolution error instead of the app, and any build between Tasks 3 and 11 fails.

**Evidence:** Sandbox /tmp/telos-recheck-structure/telos-app: fresh `npm create vite@latest -- --template react-ts` App.tsx line 5 is `import './App.css'`. After applying Task 3 exactly as written, `npx vite build` fails: "[UNRESOLVED_IMPORT] Could not resolve './App.css' in src/App.tsx (src/App.tsx:5:8)".

**Suggested fix:** Move the App.tsx rewrite (Task 11 Step 1's minimal App, or a placeholder without CSS imports) into Task 3 Step 3, and add src/App.tsx to Task 3 Step 5's `git add` list. Alternatively have Task 3 Step 3 also strip the `import './App.css'` line (and the asset imports the scaffold App uses).

### 3. [BLOCKER] (plan-process) Font download produces zero files: truncated UA gets TTF-only CSS, the grep targets only .woff2 — fonts never committed, typography unfaithful everywhere

**Claim:** Task 3 Step 1 (plan lines 132-137) curls Google Fonts with `User-Agent: Mozilla/5.0 Chrome/124`; that truncated UA is served a TTF-only stylesheet, so `grep -oE 'https://[^)]+\.woff2'` matches nothing and the download loop runs zero times. public/fonts stays empty: the `ls public/fonts` verification shows nothing, Step 5's `git add public/fonts` (line 163) silently stages nothing (confirmed exit 0, 0 files), and the three @font-face rules (lines 142-144) point at files that will 404 on every dev server, clone, and the production deploy — the app falls back to Georgia/system-ui instead of Crimson Pro / Atkinson Hyperlegible.

**Evidence:** Sandbox: `curl -sS -H "User-Agent: Mozilla/5.0 Chrome/124" "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Crimson+Pro:wght@600;700&display=swap"` returned only fonts.gstatic.com/...ttf URLs; `woff2 count: 0`. `git add public/fonts` on the empty dir exits 0 adding nothing.

**Suggested fix:** Use a full Chrome UA string (e.g. `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36`) so Google serves woff2, and harden the verification to a checkable assertion, e.g. `test $(ls public/fonts/*.woff2 | wc -l) -ge 3`, so an empty dir fails loudly instead of silently.

### 4. [BLOCKER] (plan-process) vite.config.ts `test` key fails `tsc -b` (TS2769) — `npm run build` fails, taking the Task 11 e2e webServer and Task 12 deploy with it

**Claim:** Task 1 Step 2's vite.config.ts (plan lines 56-66) imports defineConfig from 'vite' but adds a Vitest `test:` block (line 65). Under the current scaffold (TS ~6.0, Vite 8) Vite's UserConfigExport has no `test` property, so `tsc -b` errors. `npm run build` = `tsc -b && ...` (line 73), and Playwright's webServer runs `npm run build && npm run preview` (line 748), so Task 11 Step 4 (`npm run e2e`) and Task 12 Step 1 both fail.

**Evidence:** Sandbox `npx tsc -b`: "vite.config.ts(9,3): error TS2769: No overload matches this call... 'test' does not exist in type 'UserConfigExport'". Scaffold versions confirmed: typescript ~6.0.2, vite ^8.0.12.

**Suggested fix:** Change the import to `import { defineConfig } from 'vitest/config'` (Vitest's defineConfig accepts the test key and passes everything through to Vite); no other change needed.

### 5. [BLOCKER] (plan-process) `new Blob([Uint8Array])` fails TS ~6.0 typecheck (TS2322 BlobPart) in ResultCard.tsx and ExportButton.tsx — second independent `tsc -b` failure

**Claim:** ResultCard's `new Blob([result.figurePng], ...)` (plan line 656) and ExportButton's `new Blob([buildBundle(files)], ...)` (line 709) fail typechecking with the scaffold's TypeScript ~6: Uint8Array<ArrayBufferLike> is no longer assignable to BlobPart (SharedArrayBuffer split). Same downstream failures as the vite.config error: `npm run build`, the e2e webServer, and Task 12 Step 1.

**Evidence:** Sandbox `npx tsc -b`: "src/components/ExportButton.tsx(23,47): error TS2322: Type 'Uint8Array<ArrayBufferLike>' is not assignable to type 'BlobPart'" and the identical error at src/components/ResultCard.tsx(11,75).

**Suggested fix:** Type the byte payloads as `Uint8Array<ArrayBuffer>` (e.g. TTestResult.figurePng and buildBundle's return), or wrap at the call sites: `new Blob([new Uint8Array(bytes)])` / cast `bytes.buffer as ArrayBuffer`. Verify with `npx tsc -b` in Task 10/11.

### 6. [BLOCKER] (plan-process) Engine passes `env: undefined` to webr 0.6.0 — 3 of 4 engine tests fail at Task 5 Step 4, contradicting the 'Pre-verified against WebR' claim

**Claim:** engine.ts always passes `env: env as any` to captureR/evalRVoid (plan lines 320, 329). When the caller gives no env (engine tests 1, 2, 4 — lines 273, 274, 276-279), webr 0.6.0 receives an explicit `env: undefined` and the worker throws "Can't create object in new environment with empty symbol name". Task 5 Step 4 (line 337) expects "PASS (4 tests)" but 3 of 4 fail; only the env-passing test (and the Task 6 stats test, which always passes env) succeed.

**Evidence:** Sandbox `npx vitest run`: engine.test.ts "4 tests | 3 failed", each with "T: Can't create object in new environment with empty symbol name" from webr-worker.js. After patching both call sites to omit env when undefined (`...(env ? { env: env as any } : {})`), engine + stats reran 5/5 passed — also confirming the stats assertions (t=-5.477, df=6, d=-3.873, pooled) are correct as written.

**Suggested fix:** In runJson: `shelter.captureR(code, { captureStreams: true, ...(env ? { env: env as any } : {}) })`; in capturePlot: `evalRVoid(code, env ? { env: env as any } : undefined)`.

### 7. [BLOCKER] (plan-process) `npm test` (vitest run) collects tests/e2e/slice.spec.ts after Task 11 and fails — the Done definition's 'npm test green' is unachievable

**Claim:** The vite.config.ts test block (plan line 65) sets no include/exclude, and Vitest's default include pattern matches `tests/e2e/slice.spec.ts` (created in Task 11, line 753). Importing @playwright/test under Vitest throws at collection time, so from Task 11 onward `npm test` (line 74) fails, breaking the Done criterion at line 801.

**Evidence:** Sandbox `npx vitest run`: "FAIL tests/e2e/slice.spec.ts — Error: Playwright Test did not expect test() to be called here" → "Test Files 2 failed | 6 passed".

**Suggested fix:** In the vitest config add `include: ['src/**/*.test.ts']` (or `exclude: [...configDefaults.exclude, 'tests/e2e/**']`), ideally in Task 1 Step 2 so it is correct before Task 11 lands.

### 8. [BLOCKER] (stats) Engine passes `env: undefined` to webr; Task 5's no-env tests crash with "Can't create object in new environment with empty symbol name"

**Claim:** Engine.runJson (plan line 320) builds `{ captureStreams: true, env: env as any }` and capturePlot (line 329) builds `{ env: env as any }` even when env is undefined. In webr 0.6.0, an options object whose `env` key is present-but-undefined throws, while omitting the key works. Task 5's engine tests call runJson with no env (lines 273-274: 'list(s = 2 + 3)', 'parallel::detectCores()') and capturePlot with no env (line 277), so 3 of the 4 tests at Task 5 Step 4 (line 337, 'PASS (4 tests)') fail as written. Task 6 always passes env, so its test would pass — but only after Task 5 is already red.

**Evidence:** Sandbox /tmp/telos-recheck-stats with webr@0.6.0 (Node): captureR('cat(1+1)', { captureStreams: true, env: undefined }) -> THROWS "Can't create object in new environment with empty symbol name"; same options with env key omitted -> OK '2'; evalRVoid('invisible(1)', { env: undefined }) -> THROWS same error. Plan refs: lines 273-279 (tests without env), 320 and 329 (env always included).

**Suggested fix:** In engine.ts, include the key only when defined: `await shelter.captureR(..., { captureStreams: true, ...(env ? { env } : {}) })` and in capturePlot `await this.webr.evalRVoid(..., env ? { env } : undefined)` — wait, pass `{}`/no second arg when env is undefined. Re-run Task 5 Step 4 to confirm 4/4 pass.

### 9. [BLOCKER] (toolchain) npm run build fails: Vite 8's defineConfig rejects the 'test' key in vite.config.ts

**Claim:** The plan's vite.config.ts (Task 1 Step 2, lines 56-67) imports defineConfig from 'vite' but includes a 'test' key. With the actually-installed Vite 8.0.12 + TS 6.0.2, 'tsc -b' (the first half of the plan's build script, line 73) fails with TS2769. The first 'npm run build' happens inside the Playwright webServer at Task 11 Step 2/4 (plan line 748) and again at Task 12 Step 1, so the e2e and the deploy both fail.

**Evidence:** Sandbox /tmp/telos-recheck-toolchain with the plan's exact vite.config.ts: 'npx tsc -b' -> "vite.config.ts(9,3): error TS2769: ... 'test' does not exist in type 'UserConfigExport'". 'npm test' (vitest run) still works because vitest transpiles the config without typechecking — so the break only surfaces at Task 11.

**Suggested fix:** In Task 1 Step 2, change the import to `import { defineConfig } from 'vitest/config'` (empirically verified: tsc error disappears, vitest and vite both still work). Alternatively add `/// <reference types="vitest/config" />`.

### 10. [BLOCKER] (toolchain) npm run build fails: Uint8Array is not assignable to BlobPart under TS 6 in ResultCard and ExportButton

**Claim:** With TypeScript ~6.0.2's generic typed arrays, `new Blob([result.figurePng], …)` (ResultCard, plan line 656) and `new Blob([buildBundle(files)], …)` (ExportButton, plan line 709) fail typecheck: `Uint8Array<ArrayBufferLike>` is not assignable to `BlobPart` (requires `ArrayBufferView<ArrayBuffer>`). Same build gate as the vite.config error: Task 11 e2e webServer and Task 12 deploy fail.

**Evidence:** Sandbox tsc output: "src/components/ExportButton.tsx(23,47): error TS2322: Type 'Uint8Array<ArrayBufferLike>' is not assignable to type 'BlobPart'" and "src/components/ResultCard.tsx(11,75): error TS2322: …". Fix verified empirically: tsc -b exits 0 after typing the byte values as Uint8Array<ArrayBuffer>.

**Suggested fix:** Type PNG/zip bytes as `Uint8Array<ArrayBuffer>` end-to-end: in src/lib/stats/types.ts `figurePng: Uint8Array<ArrayBuffer>`; in engine.capturePlot return `(await this.webr.FS.readFile(path)) as Uint8Array<ArrayBuffer>` with matching return type; in bundle.ts `return zipSync(files) as Uint8Array<ArrayBuffer>` with matching return type.

### 11. [BLOCKER] (toolchain) Task 3 font download fetches zero files: truncated UA gets a TTF-only stylesheet so the woff2 grep matches nothing

**Claim:** Plan lines 132-137 download Google Fonts CSS with `-H "User-Agent: Mozilla/5.0 Chrome/124"` then grep for `\.woff2` URLs. Google serves that truncated UA a TTF-only stylesheet (0 woff2 URLs), so the download loop runs zero times, public/fonts stays empty, and the tokens.css @font-face rules (lines 142-144) point at missing files — the locked Crimson Pro / Atkinson Hyperlegible fonts silently fall back, making the rendered output unfaithful to the approved design. Task 3 Step 4's 'fonts load' check fails.

**Evidence:** Sandbox curl with the plan's exact UA against the plan's exact URL: 4 ttf URLs, 0 woff2. With the full UA string "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36": 10 woff2 URLs returned.

**Suggested fix:** Use the full Chrome UA string in the curl command. Also note the woff2 filenames are opaque hashes covering multiple unicode-range subsets per weight; the executor must map each URL to its family/weight by reading /tmp/gf.css before renaming the url(...) paths in Step 2 (the plan's parenthetical at line 155 understates this).

### 12. [BLOCKER] (toolchain) Task 3 Step 4 visual check fails: deleting src/App.css breaks the template App.tsx, which isn't replaced until Task 11

**Claim:** Task 3 Step 3 (plan line 157) deletes src/App.css and src/index.css and rewires main.tsx, but the scaffolded src/App.tsx still contains `import './App.css'` (plus ./assets imports) and is only replaced at Task 11 Step 1 (line 727). At Task 3 Step 4's verification ('npm run dev, open the URL → fonts + APA table styling load') the page shows Vite's unresolved-import error instead of the styled app; any build in Tasks 3-10 fails the same way.

**Evidence:** Sandbox replicating the exact post-Step-3 state: `npx vite build` -> "[UNRESOLVED_IMPORT] Could not resolve './App.css' in src/App.tsx". Scaffolded App.tsx head shows `import './App.css'` and three ./assets imports.

**Suggested fix:** Move the minimal App.tsx replacement (Task 11 Step 1's version, or a placeholder without CSS/asset imports) into Task 3 Step 3, or have Step 3 also strip the template content from src/App.tsx when deleting its stylesheet.

### 13. [BLOCKER] (toolchain) Task 5 engine tests: 3 of 4 fail as written — passing { env: undefined } breaks WebR 0.6.0 evaluation

**Claim:** engine.ts always passes `{ env: env as any }` to shelter.captureR (plan line 320) and evalRVoid (line 329). When runJson/capturePlot are called without an env — as in 3 of the 4 Task 5 tests (lines 273, 274, 276-279) — the options object contains `env: undefined`, which WebR 0.6.0 rejects with "Can't create object in new environment with empty symbol name". Task 5 Step 4 (line 337) expects '4 tests PASS'; it fails, contradicting the plan's 'Pre-verified against WebR' claim (line 13).

**Evidence:** Sandbox vitest run of the plan's exact engine.ts + engine.test.ts: "4 tests | 3 failed" — 'runs R, returns parsed JSON', 'applies the detectCores shim', 'captures a base-R plot as PNG bytes' all fail in webr-worker.js; only the env-supplied 'passes JS vectors into R' passes. After omitting the env key when undefined: 4 passed (4), and the full suite is 12/12 green.

**Suggested fix:** Only include env when defined: in runJson use `{ captureStreams: true, ...(env ? { env: env as any } : {}) }`; in capturePlot pass `env ? { env: env as any } : undefined` as the options argument (both verified in the sandbox).

### 14. [BLOCKER] (ui-e2e) Table 2 df and APA-line df render as '10.00'/'t(10.00)' — spec card shows integer df ('58', 't(58)')

**Claim:** ResultCard formats df with f = (n) => n.toFixed(2) in both the Table 2 cell (plan line 661) and the APA sentence (plan line 666, '.replace('{df}', f(result.df))'). On the default sample-data path the pooled df is exactly 10 (R-verified), so the app renders '10.00' in Table 2 and 't(10.00)' in the APA line. The approved exemplar card renders pooled df as an integer in both places: Table 2 cell '<td>58</td>' and APA 't(58)=−3.21' — and APA style reports pooled df as an integer. The rendered output is therefore unfaithful to the spec card on the very path the E2E exercises.

**Evidence:** Plan lines 651, 661, 666. Spec telos_test_outputs.html line 244 ('<td>&minus;3.21</td><td>58</td><td>.002</td>') and line 257 ('<i>t</i>(58)=&minus;3.21'). Executed the plan's own formatting code in Node (/tmp/telos-recheck-ui/app/apa.js): output 'Table2 df cell: 10.00' and APA line '...t(10.00)=-5.98, p=<.001, d=-3.45.' R run of the plan's exact stats block on the Task 7 SAMPLE confirms pooled selection and df=10 (Levene F=0.38, p=.550).

**Suggested fix:** Add a df formatter and use it in both places: const fdf = (df: number) => Number.isInteger(df) ? String(df) : df.toFixed(2) (or key on result.test: 'pooled' → integer, 'welch' → decimals, which Welch genuinely needs). Replace f(result.df) with fdf(result.df) at plan lines 661 and 666.

### 15. [BLOCKER] (webr) engine.ts passes `env: undefined` to webr, which throws — 3 of Task 5's 4 tests fail as written

**Claim:** In webr@0.6.0 (the version npm resolves today), passing an options object whose `env` key is explicitly `undefined` to captureR/evalRVoid makes the worker throw `Can't create object in new environment with empty symbol name`. The plan's engine.ts always includes the key (`runJson` line 320: `{ captureStreams: true, env: env as any }`; `capturePlot` line 329: `{ env: env as any }`), so every call made WITHOUT an env fails. That kills 3 of the 4 Task 5 tests (`runs R, returns parsed JSON`, `applies the detectCores shim`, `captures a base-R plot as PNG bytes`); only `passes JS vectors into R` (which supplies env) passes. Task 5 Step 4's expected 'PASS (4 tests)' is impossible as written, blocking the plan at its TDD gate. Task 6 happens to always supply env so it is not directly affected, but it sits behind the failed Task 5 gate.

**Evidence:** Plan lines 320 and 329 (engine.ts code block, Task 5). Sandbox /tmp/telos-recheck-webr with webr@0.6.0 + vitest 4.1.8: verbatim plan engine.ts + engine.test.ts -> 'Tests 3 failed | 1 passed (4)' with error 'T: Can't create object in new environment with empty symbol name' at webr-worker.js. Isolation probe: captureR('cat(1+1)', {captureStreams:true}) OK; captureR('cat(1+1)', {captureStreams:true, env:undefined}) FAIL with the same error; evalRVoid('invisible(1)', {env:undefined}) FAIL; with env:{x:[1,2]} OK. Subsequent calls on the same instance recover (no permanent corruption). After a one-line fix omitting the key, the identical test file gives 'Tests 4 passed (4)' in 1.45s.

**Suggested fix:** In runJson use `{ captureStreams: true, ...(env ? { env: env as any } : {}) }` and in capturePlot pass `env ? { env: env as any } : {}` (or `undefined`) as the options argument, so the `env` key is omitted when no environment is supplied. Verified empirically: with exactly this change all 4 Task 5 tests pass, and the Task 6 stats test also passes end-to-end (1 passed, including PNG magic bytes and t = -5.477, df = 6, pooled).

### 16. [MAJOR] (faithfulness) Registry roles are paraphrased, not verbatim from the inputs card — and TestConfig never reads spec.roles at all

**Claim:** Plan line 11 says roles are encoded from telos_test_inputs.html, but all three role strings drift: registry label 'Dependent variable' vs card slot label 'Outcome (DV)'; registry levels 'nominal' vs card constraint 'nominal / ordinal'; registry arity 'exactly 1 (2 levels)' vs card 'exactly 1 · 2 categories'. Worse, the roles array is dead data: TestConfig (Task 10 Step 3) hardcodes its own labels 'Dependent variable (numeric):' / 'Grouping variable (2 levels):' instead of rendering from spec.roles, undermining the registry-driven claim the whole revision was about.

**Evidence:** Plan lines 205-206 (roles array) vs telos_test_inputs.html:393 ('Outcome (DV)'), :395 ('interval / ratio · exactly 1'), :399 ('Grouping variable'), :401 ('nominal / ordinal · exactly 1 · 2 categories'). Plan line 635 hardcodes the select labels; nothing in TestConfig imports the registry.

**Suggested fix:** Set roles to the card's exact text: { id:'outcome', label:'Outcome (DV)', levels:'interval / ratio', arity:'exactly 1' } and { id:'group', label:'Grouping variable', levels:'nominal / ordinal', arity:'exactly 1 · 2 categories' }; make TestConfig render `spec.roles.map(...)` for its labels (e.g. `${role.label} (${role.levels})`), and update the E2E getByLabel selectors (plan lines 759-760) to match.

### 17. [MAJOR] (faithfulness) The consistency test cannot catch drift: a registry built from the wrong card passes every assertion

**Claim:** Plan line 11 claims 'A consistency test asserts the registry can't drift from the specs', but Task 4 Step 3 (lines 230-248) only runs toContain over the ENTIRE outputs HTML. Empirically, a registry corrupted with the Paired t-test's titles ('Paired descriptives', 'Paired-samples t-test') and a frankenbundle (table_descriptives.png + table_t-test.png + figure_difference.png) PASSES all three tests, as does a strict-subset registry. 'two groups', 'Cohen', and 'table_t-test.png' each occur in 3+ different cards; column labels, howToRead, apaTemplate, assumptionNote, rMap, and roles are never checked, telos_test_inputs.html is never read, and the bundle check is subset-only (passes even if the card lists more files than the registry).

**Evidence:** Sandbox run /tmp/telos-recheck-specfaith/check.mjs: 'CORRUPTED registry (paired-test titles + wrong bundle): PASSES the plan consistency test'; 'SUBSET registry: PASSES'. grep counts on telos_test_outputs.html: 'two groups'=3, 'Cohen'=3, 'table_t-test.png'=3 (lines 230, 259, 280 — one-sample, independent, paired bundles).

**Suggested fix:** Scope assertions to the card: `const card = html.slice(html.indexOf('Independent t-test</span>'), html.indexOf('Paired t-test</span>'))`, strip tags/entities (&mdash;→—, &minus;→−, &middot;→·, &rarr;→→), then assert equality, not containment: (1) per table, the `<thead>` label sequence equals spec.tables[i].columns.map(c=>c.label); (2) stripped howread paragraph === spec.howToRead; (3) stripped tbl-note === spec.assumptionNote; (4) stripped R-map line === spec.rMap; (5) stripped bundle line split on ' · ' deep-equals spec.bundleFiles; (6) read telos_test_inputs.html and assert each role's sl-label/sl-cons text. The sandbox script proves this stripping approach works — howToRead/assumptionNote/rMap all string-match exactly today.

### 18. [MAJOR] (faithfulness) Export zip ignores the ui_spec bundle layout (no 01_independent-t-test/ folder) and the omission of report.pdf/tex/analysis.R/cleaned.csv is acknowledged nowhere

**Claim:** telos_ui_spec.html's results-bundle tree puts the three t-test PNGs inside `telos-results/01_independent-t-test/` alongside root-level report.pdf, report.tex, analysis.R and data/cleaned.csv, with the explicit rule 'Each selected test gets its own folder, prefixed NN_'. The plan's ExportButton (Task 10 Step 5) zips the three PNGs flat at the zip root, and the plan goal calls this 'the spec's export bundle' (line 5) while never mentioning report.pdf, report.tex, analysis.R, cleaned.csv, or the NN_ folder — the scope cut is silent, so a reader comparing the downloaded zip to the ui_spec tree will find it unfaithful with no recorded decision.

**Evidence:** telos_ui_spec.html:339-348 (tree: telos-results/ → report.pdf, report.tex, analysis.R, data/cleaned.csv, 01_independent-t-test/ → the 3 PNGs), :364 ('Each selected test gets its own folder, prefixed NN_'); plan lines 703-708 (flat `files` map keyed by bare filenames), line 710 (a.download = 'telos-results.zip'); `grep -in 'report.pdf|analysis.R|cleaned.csv|report.tex|01_independent'` on the plan returns nothing (exit 1).

**Suggested fix:** Prefix the per-test folder in the zip — fflate's zipSync accepts path keys, so `files['01_independent-t-test/' + t1] = ...` (update the Task 9 bundle test to expect the prefixed paths). Add one sentence to the plan's Goal or Task 9 intro explicitly deferring report.pdf/report.tex/analysis.R/data/cleaned.csv to a later plan, so the omission is a decision Benjie approved rather than drift.

### 19. [MAJOR] (faithfulness) The inputs card's option strip (α, tails, equal variance 'off · Welch', CI) is absent, and the plan silently reinterprets 'when equal-variance is off' as an automatic Levene gate

**Claim:** The inputs card defines four user options for this test — α 0.05, tails two, equal variance 'off · Welch', CI 95% — but TestSpec has no options field and the UI exposes none. The outputs card's assumption note says 'a Welch row replaces the pooled row when equal-variance is off', i.e. keyed to that user option (whose displayed value/default on the card is 'off · Welch', implying Welch by default); the plan instead auto-selects pooled vs Welch from Levene's p ≥ .05 (R: `equalvar <- is.na(levP) || levP >= 0.05`), a mechanism appearing in neither card. The sample-data run therefore renders a pooled row where the option-driven reading of the spec would render Welch. This is a spec ambiguity the plan resolves silently — per project norms, Benjie should make this call explicitly.

**Evidence:** telos_test_inputs.html:410-415 (optstrip: α 0.05 / tails two / 'equal variance' 'off · Welch' / CI 95%); telos_test_outputs.html:245 ('a Welch row replaces the pooled row when equal-variance is off'); plan lines 410-411 (Levene-driven `equalvar` → `t.test(..., var.equal = equalvar)`), lines 176-192 (TestSpec has no options), Task 10 Step 3 (no option controls).

**Suggested fix:** Surface the choice to Benjie before Task 6: either (a) add an `options` field to TestSpec encoding the card's four pills and an 'equal variance' toggle in TestConfig whose default matches the card ('off · Welch'), with Levene reported as the assumption check only; or (b) keep auto-Levene for the skeleton but write the interpretation into the plan and registry comment so it is an approved deviation, and defer the option strip explicitly.

### 20. [MAJOR] (plan-process) Task 2 Step 2 expected output is stale: webr 0.6.0 dist ships R.wasm/R.js, not 'R.bin.*'

**Claim:** Plan line 108 says the copy-script verification should list "webr-worker.js, R.bin.*". The currently installed webr (0.6.0) ships no R.bin.* files, so an executor following the plan literally sees the expectation unmet and would halt or flag, even though the copy itself succeeds.

**Evidence:** Sandbox: `npm install webr` resolved 0.6.0; `ls node_modules/webr/dist/` = R.js, R.wasm, libRblas.so, libRlapack.so, repl, tests, vfs, webR, webr-worker.js, webr.cjs, webr.js, webr.mjs (+maps). `node scripts/copy-webr.mjs` itself ran fine ("Copied WebR runtime to public/webr/").

**Suggested fix:** Update the expectation on line 108 to: lists `webr-worker.js`, `R.wasm`, `R.js`, and the `vfs/` directory.

### 21. [MAJOR] (plan-process) Fresh-clone `npm run e2e` fails: Playwright browser install is a one-off Task 1 command, guaranteed by no script and not required of the README

**Claim:** `npx playwright install chromium` appears only once, inside Task 1 Step 1 (plan line 50). It is in no npm script (lines 71-75), and Task 12 Step 4's README instruction (line 792: "document dev/test/e2e/deploy + the COOP/COEP requirement + self-hosted WebR") does not mention it. After the plan completes, `git clone && npm install && npm run e2e` on a fresh machine fails with Playwright's "Executable doesn't exist... run npx playwright install" error, while `npm install` (postinstall → copy-webr) and `npm test` do self-heal.

**Evidence:** Plan lines 50, 71-75, 792: browser install absent from scripts and from the README content list; Playwright browsers live in a per-machine cache, not node_modules, so npm install does not provide them.

**Suggested fix:** Either make the script self-sufficient (`"e2e": "playwright install chromium && playwright test"` — a fast no-op when cached) or add the step explicitly to the Task 12 README requirements.

### 22. [MAJOR] (stats) Pooled df rendered as "6.00"/"10.00" — spec exemplar and APA style show integer df (58, t(58))

**Claim:** ResultCard formats df with f() = toFixed(2) in both Table 2 (line 661: `df: f(result.df)`) and the APA sentence (line 666: `.replace('{df}', f(result.df))`). For the pooled test df is an integer; the spec card's exemplar shows `<td>58</td>` and 't(58)=−3.21', and APA convention reports integer df without decimals. The deployed demo always hits this: Task 7's sample data gives Levene p=.550 -> pooled, df=10, so Table 2 shows '10.00' and the write-up says 't(10.00)=...'. (2 decimals is fine for Welch's fractional df.)

**Evidence:** Spec: telos_test_outputs.html line 244 `<th>df</th>` row `<td>58</td>` (line 245-ish, exemplar tbody) and line 257 APA template '<i>t</i>(58)=&minus;3.21'. Plan lines 651, 661, 666. Sandbox WebR run of the plan's Levene block on Task 7 sample data (control/treatment): F=0.382775 p=0.549954 -> equalvar TRUE -> pooled, df=10.

**Suggested fix:** Format df conditionally in ResultCard: `const fdf = (n: number) => Number.isInteger(n) ? String(n) : f(n)` (or key off result.test === 'pooled') and use it in t2Rows and the {df} replacement.

### 23. [MAJOR] (stats) .telos_json emits invalid JSON for strings containing quotes/backslashes and for ±Inf

**Claim:** The serializer (plan lines 293-301) wraps strings in quotes with no escaping and serializes non-NA numerics via formatC, which renders Inf as the bare token `Inf`. Group labels flow verbatim from user CSVs into R (line 426) and back out through groupStats, so a label containing a double quote or backslash makes runJson throw a cryptic JSON SyntaxError instead of producing a result. ±Inf was NOT reproducible inside the t-test path itself (t.test stops on constant data first, and Levene's perfect-fit case yields a finite FP-residue F of ~8e31 rather than Inf), but the helper is the shared serialization layer the plan reuses for every future test, where Inf-valued statistics are reachable. Tiny p-values are fine: formatC 'g' digits=10 emits valid JSON exponent notation (1.2e-30 parses), and its whitespace padding is legal JSON token separation.

**Evidence:** Sandbox WebR 0.6.0 runs of the exact helper: group 'say "hi"' -> raw `{"lv":["B","say "hi""]}` -> JSON.parse FAILED; string 'back\slash' -> raw `{"s":"back\slash"}` -> 'Bad escaped character in JSON'; x=[Inf,-Inf,NaN,1.2e-30] -> raw `{"inf":        Inf,"ninf":       -Inf,"nan":null,"tiny":    1.2e-30}` -> JSON.parse FAILED on 'Inf' (NaN->null correct, tiny value valid). Plan lines 293-301 (helper), 299 (unescaped strings), 300 (is.na guard only), 426 (user strings enter env).

**Suggested fix:** Harden the helper: escape strings (`gsub('\\\\','\\\\\\\\',x)` then `gsub('"','\\\\"',x)`, plus control chars) and replace the numeric guard with `ifelse(is.finite(x), formatC(x, format='g', digits=10), 'null')` so NaN/NA/±Inf all become null.

### 24. [MAJOR] (toolchain) Task 2 Step 2 verification expectation is wrong: webr 0.6.0 ships R.js/R.wasm, not R.bin.*

**Claim:** Plan line 108 expects `ls public/webr/` to list "webr-worker.js, R.bin.*". The installed webr 0.6.0 dist contains webr-worker.js, R.js and R.wasm — no R.bin.* files exist. The copy itself works and nothing downstream references R.bin, but an executor checking output against the stated expectation will (correctly) conclude the step failed.

**Evidence:** Sandbox: `ls node_modules/webr/dist/` -> R.js, R.wasm, esbuild.d.ts, libRblas.so, libRlapack.so, repl, tests, vfs, webR, webr-worker.js, webr.cjs(.map), webr.js, webr.mjs(.map). Running the plan's copy script + ls public/webr reproduces the same listing.

**Suggested fix:** Change line 108's expectation to "lists webr-worker.js, R.js, R.wasm".

### 25. [MAJOR] (ui-e2e) APA sentence renders malformed 'p=<.001' on the default sample-data path

**Claim:** The registry APA template hardcodes 'p={p}' (plan line 221) and ResultCard substitutes fp(result.p), which returns '<.001' for p < .001 (plan lines 652, 666). The Task 7 sample data yields p = 0.000135 (R-verified), so the APA write-up the demo/E2E path shows reads 'p=<.001' — malformed APA (should be 'p < .001'). The spec card's APA template shows the 'p=.002' form; '=<' never appears in it. The '<.001' value is correct for the Table 2 cell, only the sentence substitution is wrong.

**Evidence:** Plan lines 221, 652, 666. R output for SAMPLE: p=0.000135068 → fp → '<.001'. Node execution of the plan's replace chain produced: 'An independent-samples t-test found a difference between control (M=70.33, SD=3.14) and treatment (M=82.33, SD=3.78), t(10.00)=-5.98, p=<.001, d=-3.45.' Spec telos_test_outputs.html line 257 shows the template form '<i>p</i>=.002'.

**Suggested fix:** Substitute the p clause as a unit: .replace('p={p}', result.p < .001 ? 'p<.001' : `p=${fp(result.p)}`) — or change the template token to 'p{p}' with an fpApa(p) returning '=.002' / '<.001'. Keep fp() as-is for the table cell.

### 26. [MAJOR] (ui-e2e) Exported table PNGs are transparent-background; near-invisible for dark-theme users (88.5% alpha=0, empirically confirmed)

**Claim:** capture() calls toPng(el, { pixelRatio: 2 }) with no backgroundColor (plan line 697), and nothing in tokens.css gives table.apa or any ancestor a background — the className="card" on the ResultCard section (line 668) has NO corresponding .card rule in tokens.css (lines 141-154 define only the --card variable). So the bundled table_*.png files have a fully transparent background. tokens.css defaults to the dark palette (--text:#e8e6df) and only goes light via prefers-color-scheme, so any dark-mode user exports near-white text on transparency — illegible when pasted into a white document, which is the whole point of the spec's export bundle. Light-mode exports are dark-text-on-transparent: legible on white but still fragile. The plan's E2E never opens the zip, so this ships silently.

**Evidence:** Sandbox /tmp/telos-recheck-ui/app: reproduced the exact ResultCard DOM + verbatim tokens.css + html-to-image 1.11.13, ran the plan's exact toPng call in Chromium via Playwright. Output: 'DARK-MODE capture: {"transparentFraction":0.8851, "cornerRGBA":[0,0,0,0], "firstOpaquePixel":[232,230,223,255]}' (light mode identical transparency, firstOpaquePixel [44,44,42,255]). Saved /tmp/telos-recheck-ui/export-dark.png and inspected it: ghostly off-white table on white. Fonts did embed correctly (same-origin /fonts/*.woff2 — no error, glyphs rendered), so that part of the plan is fine.

**Suggested fix:** Pass a background to the capture: toPng(el, { pixelRatio: 2, backgroundColor: getComputedStyle(document.body).backgroundColor }) — or a fixed exportable scheme (e.g. always render exports on var(--card)). Also add the missing .card{background:var(--card);border-radius:...} rule to tokens.css so the on-screen card matches the approved design. Verify by unzipping in Task 11/12 and viewing a PNG on white.

### 27. [MAJOR] (ui-e2e) Result lifecycle: setConfig never invalidates a result, and an error after a successful run leaves a broken Export button (toPng on null)

**Claim:** Two related holes: (1) setDataset clears result/status/error but setConfig does not (plan lines 528-529), so after a run the user can change either dropdown and the old result — tables, APA sentence, export — stays on screen computed from the previous variable choices with no staleness indication; clicking Download then bundles tables that contradict the visible config. (2) setError sets status 'error' but keeps the previous result (line 531); ResultCard's error branch (line 657) replaces the tables with the alert, yet ExportButton still renders because result != null (line 700). Clicking it calls document.getElementById('table-group-statistics')! which is null — toPng(null!) throws inside the un-caught async download(), an unhandled rejection with no user feedback. Re-running after an error does work (button is only disabled while 'running'), so that part is fine.

**Evidence:** Plan lines 528-531 (store actions), 624 (setError path), 656-657 (error branch before tables render), 668-673 (tables only render in the non-error branch), 697 (non-null assertion on getElementById), 700 ('const result = useSession((s) => s.result); if (!result) return null').

**Suggested fix:** In the store: setConfig: (c) => set((s) => ({ config: { ...s.config, ...c }, result: null, status: 'idle', error: null })). In ExportButton, gate on a completed run instead of result alone: const { result, status } = useSession(); if (!result || status !== 'done') return null — that fixes both the error-state crash and exporting during a stale re-run.

### 28. [MAJOR] (webr) Task 2 Step 2 verification expects `R.bin.*`, which does not exist in webr@0.6.0 dist

**Claim:** Plan line 108 says the copy-script verification should show 'webr-worker.js, R.bin.*'. webr@0.6.0's dist contains no R.bin.* files — the runtime binaries are `R.js` and `R.wasm` (plus libRblas.so, libRlapack.so, vfs/, webR/, webr-worker.js). The copy itself succeeds and the copied assets are complete and functional, but a strict executor checking the Expected line will judge the step failed and halt. This CONFIRMS the prior-intel hypothesis.

**Evidence:** ls /tmp/telos-recheck-webr/node_modules/webr/dist/ -> R.js, R.wasm, esbuild.d.ts, libRblas.so, libRlapack.so, repl, tests, vfs, webR, webr-worker.js, webr.cjs, webr.js, webr.mjs (+maps). No R.bin.* anywhere. Plan line 108: 'Expected: lists `webr-worker.js`, `R.bin.*`.'

**Suggested fix:** Change line 108 to: 'Expected: lists `R.js`, `R.wasm`, `webr-worker.js` (and `vfs/`)'. Note the copy strategy itself is sound: all dist files are under 20 MB (R.wasm = 17M, vfs/ = 26M total across many smaller files), so nothing breaches Cloudflare Pages' 25 MiB per-file limit, and repl/ + tests/ add only ~80 KB so copying the whole dist is harmless.

### 29. [MINOR] (faithfulness) Negative values render with ASCII hyphen while the card (and the plan's own Contrast string) use U+2212; CI decimals differ from the exemplar

**Claim:** The card writes every negative stat with a true minus sign (&minus;: '−3.21', '−6.50', '[−10.6, −2.4]', '−0.83', and in the APA sentence), and the plan's contrast string already uses U+2212 ('A − B', confirmed e2 88 92 in the plan bytes). But toFixed() emits ASCII '-', so Table 2 would mix a true minus in the Contrast cell with hyphens in t/Mdiff/CI/d in the same row. The exemplar CI is also 1dp ('[−10.6, −2.4]') vs the plan's 2dp.

**Evidence:** telos_test_outputs.html:244, :257 (all &minus;); plan line 431 hexdump shows e2 88 92 (U+2212); sandbox output: card t '−3.21' vs plan f(-3.21)='-3.21'; card CI '[−10.6, −2.4]' vs plan '[-10.60, -2.40]'.

**Suggested fix:** Wrap the formatters: `const f = (n: number) => n.toFixed(2).replace('-', '−')` (same for fp/df/CI). Ask Benjie whether CI precision should be 1dp per the exemplar or 2dp like the other cells, and record the answer in the registry comment.

### 30. [MINOR] (faithfulness) ResultCard drops card content and emphasis: the question subtitle is never rendered, how-to-read loses its bold/italic teaching emphasis, and the APA line italicizes the whole sentence instead of just the stat symbols

**Claim:** The card header pairs the test name with its question ('do two groups' means differ?'); the registry encodes `question` but ResultCard never renders it (only the h2 name). The card's how-to-read deliberately bolds p, mean difference, 95% CI, Cohen's d and italicizes 'detected' — the registry stores a plain string so all emphasis is lost. The card's APA sentence italicizes only the stat symbols (M, SD, t, p, d) per APA style; the plan instead sets fontStyle italic on the entire line, inverting the convention. rMap is likewise encoded but never rendered (possibly intentional meta — worth confirming with Benjie).

**Evidence:** telos_test_outputs.html:236 (rt-q question in header), :255 (<b>p</b>, <b>mean difference</b>, <b>95% CI</b>, <b>Cohen's d</b>, <i>detected</i>), :257 (<i>M</i>, <i>SD</i>, <i>t</i>, <i>p</i>, <i>d</i> italics); plan lines 669 (h2 renders only spec.name), 678 (plain `<p>{spec.howToRead}</p>`), 679 (`fontStyle: 'italic'` on the whole APA line).

**Suggested fix:** Render `spec.question` as a subtitle under the h2. For emphasis, either store the card's inner HTML for howToRead/apaTemplate in the registry and render with a tiny b/i-only whitelist, or split the APA template so symbol tokens render in <i> while values stay roman; un-italicize the rest of the APA line.

### 31. [MINOR] (stats) Levene is degenerate for 2-observations-per-group data: F is a ratio of FP residues (~8e31), and the UI would print it via toFixed(2)

**Claim:** With n=2 per group, each |x − median| pair is constant within group, so anova(lm(z ~ g)) has true residual SS = 0. Empirically lm leaves FP residue, giving F=8.11e+31, p=1.2e-32 for {1,3} vs {0,4} — the equal-variance decision (line 410) is then driven by rounding noise (always 'welch' when ranges differ at all), and the assumption note (line 674, `f(result.levene.F)`) would render 'Levene F=81129638414606...000.00'. When spreads are identical ({10,12} vs {15,17}) F=NaN and the is.na fallback correctly picks pooled, so the NA guard itself works as designed. The math matches car::leveneTest (same Brown-Forsythe anova), so it is 'faithful' — just degenerate and ugly at minimum n. The plan's own tests (4 and 6 per group) never hit it.

**Evidence:** Sandbox WebR runs of the plan's exact Levene block: score=[1,3,0,4] -> 'F=8.112963841e+31 p=1.232595164e-32' -> welch; score=[10,12,15,17] -> 'F=NaN p=NaN equalvar=TRUE'. Plan lines 408-410 (Levene + decision), 674 (F displayed with f()).

**Suggested fix:** Treat Levene as undefined when any group has n < 3 (set levF/levP to NA so the existing is.na fallback -> pooled, and the note can say 'Levene not defined for n<3 per group'), and/or format the displayed F with significant-digit formatting instead of toFixed(2).

### 32. [MINOR] (toolchain) Tech-stack line says React 18; the scaffold actually produces React 19 / Vite 8 / TS 6 / Vitest 4

**Claim:** Plan line 9 states 'Vite + React 18 + TypeScript'. `npm create vite@latest -- --template react-ts` today scaffolds react ^19.2.6, vite ^8.0.12, typescript ~6.0.2, and the plan's dev installs resolve to vitest ^4.1.8, webr ^0.6.0, @playwright/test ^1.60.0. Nothing in the plan's code requires React 18 (everything ran green on 19 after the other fixes), but the stale claim could mislead an executor into pinning or 'fixing' versions.

**Evidence:** Sandbox telos-app/package.json after scaffold: "react": "^19.2.6", "vite": "^8.0.12", "typescript": "~6.0.2"; post-install devDeps include "vitest": "^4.1.8". Full suite (12/12 tests) and build pass on these versions once the blocker fixes are applied.

**Suggested fix:** Update line 9 to 'Vite 8 + React 19 + TypeScript 6 · … · Vitest 4 + Playwright', or drop version numbers entirely.

### 33. [MINOR] (toolchain) postinstall hook is committed one task before the script it runs exists: any npm install in that window exits 1

**Claim:** Task 1 Step 3 (plan lines 71-76) sets `"postinstall": "node scripts/copy-webr.mjs"` and Step 5 commits it, but scripts/copy-webr.mjs is only created in Task 2 Step 1 (line 98). The plan as written runs no npm install in that window so it doesn't self-break, but any incidental `npm install <pkg>` (e.g. a forgotten dep) or a fresh clone of the Task 1 commit fails hard. The end-state fresh-clone path is fine: postinstall runs after deps install, so node_modules/webr/dist exists and public/webr is populated — empirically confirmed.

**Evidence:** Sandbox with copy-webr.mjs moved away: `npm install` -> exit 1, "npm error command sh -c node scripts/copy-webr.mjs". Fresh-clone simulation (rm -rf node_modules public/webr && npm install) with the script present: postinstall succeeds and public/webr contains R.js, R.wasm, webr-worker.js, etc.

**Suggested fix:** Either move the creation of scripts/copy-webr.mjs into Task 1 Step 3 (before adding the postinstall hook), or guard the hook: "postinstall": "node scripts/copy-webr.mjs || true" until Task 2 lands — preferably the former so every commit is installable.

### 34. [MINOR] (ui-e2e) Boxplot object URLs are never revoked (and StrictMode doubles them in dev — StrictMode is kept by the plan)

**Claim:** useMemo(() => URL.createObjectURL(...), [result]) (plan line 656) creates a blob URL per result and never calls URL.revokeObjectURL, so every re-run leaks the previous PNG blob for the page lifetime. The scaffold's main.tsx wraps <StrictMode> (verified: fresh 'npm create vite@latest -- --template react-ts' renders <StrictMode><App/></StrictMode>) and the plan's Task 3 Step 3 only swaps the CSS import, so in dev StrictMode's double render invokes the useMemo callback twice, creating a second leaked URL per result. Note the related double-init worry is REFUTED: the engine singleton (lines 616-617) is created lazily inside the click handler with ??=, so StrictMode cannot double-boot WebR.

**Evidence:** Plan line 656; plan line 157 (main.tsx edit limited to the style import); sandbox scaffold /tmp/telos-recheck-ui/scaffold-check/src/main.tsx shows StrictMode (React ^19.2.6). MDN/React: useMemo is not a semantic guarantee and StrictMode double-invokes it in dev; createObjectURL requires explicit revoke.

**Suggested fix:** Move URL creation into an effect with cleanup: const [figureUrl, setFigureUrl] = useState<string|null>(null); useEffect(() => { if (!result) return; const u = URL.createObjectURL(new Blob([result.figurePng], { type: 'image/png' })); setFigureUrl(u); return () => URL.revokeObjectURL(u) }, [result]).

### 35. [MINOR] (ui-e2e) E2E asserts only structure ('SE', 'Mdiff' visible) — wrong statistics would pass; add the known sample-data numbers

**Claim:** The E2E (plan lines 763-765) asserts only that the tables contain the column labels 'SE' and 'Mdiff'. A transposed mean, wrong SE formula, or broken env-binding in the browser build would still pass, despite the Done section (line 802) claiming the E2E proves the faithful tables. The unit test (Task 6) checks numbers, but only in Node — the browser/WASM path that E2E exists to validate is never checked numerically. The expected values for the Task 7 SAMPLE are fully deterministic.

**Evidence:** Plan lines 754-769 (no numeric assertions), 454-457 (SAMPLE). R run of the plan's exact stats block on SAMPLE: control M=70.33 SD=3.14 SE=1.28; treatment M=82.33 SD=3.78 SE=1.54; pooled, t=-5.98, df=10, p<.001, Mdiff=-12.00, CI=[-16.47, -7.53], d=-3.45.

**Suggested fix:** Add after the existing assertions: await expect(page.locator('#table-group-statistics')).toContainText('70.33'); ...toContainText('1.28'); ...toContainText('82.33'); ...toContainText('1.54'); await expect(page.locator('#table-t-test')).toContainText('-5.98'); ...toContainText('-12.00'); ...toContainText('[-16.47, -7.53]'); ...toContainText('-3.45'); ...toContainText('<.001'); and (after the df fix) toContainText('10'). If the minus-sign fix below is adopted, use '−5.98' etc. to match.

### 36. [MINOR] (webr) .telos_json helper: logicals throw, Inf produces invalid JSON, strings are not escaped

**Claim:** The plan's R->JSON helper (lines 294-300) has three latent gaps in the generic `runJson` path: (1) an R logical hits the numeric branch and `formatC(TRUE, format='g')` raises 'Error: unsupported type', so runJson cannot return any boolean; (2) `Inf`/`-Inf` serialize as the bare token `Inf`, which JSON.parse rejects; (3) character values are wrapped in quotes without escaping `"` or `\`, and group names in the t-test result come straight from user CSV values, so a group label containing a double quote yields invalid JSON. None of these is triggered by the walking skeleton's actual Task 5/6 payloads (all verified passing), but runJson is the single adapter every future registry test will go through.

**Evidence:** Sandbox probe with the verbatim helper on webr@0.6.0: runJson body for `TRUE` -> R ERROR 'Error in `formatC(x, format = "g", digits = 10)`: unsupported type'; `1/0` -> output 'Inf' -> JSON.parse throws "Unexpected token 'I'"; `NaN` and `NA` -> 'null' (correct); `list(p=2e-16)` -> parses correctly. Plan lines 294-300 show no logical branch and no string escaping.

**Suggested fix:** Harden the helper: add `if (is.logical(x)) v <- ifelse(is.na(x),'null',ifelse(x,'true','false'))` before the numeric branch; map non-finite numerics to 'null' (e.g. `ifelse(!is.finite(x),'null',formatC(...))`, which also covers NA/NaN); and escape strings with `gsub('"','\\\\"', gsub('\\\\','\\\\\\\\', x))` or simply route strings through `encodeString(x, quote='"')`. Low cost now; avoids a confusing failure the first time a registry test returns a flag or a user names a group with a quote.

### 37. [NIT] (stats) Negative numbers render with ASCII hyphen while the spec card (and the plan's own contrast) use U+2212 minus

**Claim:** f()/fp() use toFixed, producing ASCII '-' (e.g. '-5.48'), while the spec exemplar typesets every negative value with &minus; (−3.21, −6.50, [−10.6, −2.4], −0.83) and the plan's contrast string already uses U+2212 (verified bytes e2 88 92 at lines 392/431, matching the test's expectation — that pairing is consistent and correct). The result is mixed minus glyphs within the same table row.

**Evidence:** telos_test_outputs.html lines 244-245 and 257 (&minus; throughout the exemplar row and APA template); plan lines 651-652 (f/fp via toFixed), 431 (U+2212 contrast); hexdump of plan lines 392/431 shows e2 88 92 in both.

**Suggested fix:** In f() (and the CI string), replace the leading ASCII hyphen with U+2212 for display: `n.toFixed(2).replace('-', '−')` — keep raw numbers unchanged in the result object.

### 38. [NIT] (ui-e2e) ExportButton couples PNG filenames to registry array order via positional destructuring

**Claim:** const [t1, t2, fig] = spec.bundleFiles (plan line 703) plus hardcoded DOM ids assumes bundleFiles is exactly [groupStatsTable, tTestTable, figure] in that order. Today it is (line 223 matches the spec card order), and the consistency test (lines 238-240) checks each filename exists in the HTML but not order or count — so reordering or a future test with a different table count silently mislabels PNGs inside the zip. Low risk in this one-test skeleton, but the pattern is the template for tests 2-47.

**Evidence:** Plan lines 223 (bundleFiles), 238-240 (consistency test checks containment only), 671/673 (DOM ids 'table-group-statistics'/'table-t-test' duplicated as string literals in ExportButton lines 705-706).

**Suggested fix:** Derive both DOM ids and filenames from table ids: spec.tables.map(t => ({ domId: `table-${t.id}`, file: `table_${t.id}.png` })) and keep only the figure filename positional (or name it figure_${spec.figure.type}.png); have the consistency test assert the derived names equal spec.bundleFiles.

### 39. [NIT] (ui-e2e) Negative numbers render with ASCII hyphen-minus; the spec card uses true minus (U+2212) throughout

**Claim:** toFixed() emits '-5.98', '-12.00', '[-16.47, -7.53]', '-3.45' (plan lines 651, 661-662), while the exemplar card renders every negative with &minus; (−): '−3.21', '−6.50', '[−10.6, −2.4]', '−0.83', and the APA template '=−3.21'. The plan already uses U+2212 for the contrast separator ('A − B', line 431), so Table 2 mixes true minus in column 1 with hyphen-minus everywhere else — a small but visible departure from the approved card, which also lands in the exported PNGs.

**Evidence:** Plan lines 651, 431; spec telos_test_outputs.html lines 244 ('&minus;3.21 ... [&minus;10.6, &minus;2.4] ... &minus;0.83') and 257; sandbox PNG /tmp/telos-recheck-ui/export-dark.png shows the mixed glyphs.

**Suggested fix:** const f = (n: number) => n.toFixed(2).replace('-', '−') (and same inside fp/df if negative values are possible there); keep raw digits only where machine-parsed.

## Completeness critic — what the six lenses missed

The six lenses were thorough on plan-step mechanics and spec-text fidelity but systematically stopped at the happy path: nothing examined what real user data does to the running app. My two strongest additions are empirical: (1) PapaParse turns empty CSV cells into null and the plan's Number() mapping turns that into score 0 — silently wrong statistics on the shipped upload path; (2) the serializer's deliberate NA→null channel meets unguarded toFixed() in render with no error boundary, so a valid dataset with degenerate Levene (R-verified: {10,12} vs {15,17} returns levene F:null beside a successful t-test) white-screens the entire app — the stats lens analyzed this exact case but missed the crash. I also found the figure pipeline contradicting three sources of truth at once (architecture doc 'ggplot2 inside WebR', outputs spec 'rendered by ggplot2', and the plan's own rMap 'geom_boxplot') while the code runs base-R boxplot — a silent scope cut needing Benjie's call. Hypotheses I tested and REFUTED, recording for the orchestrator: Cloudflare Pages' 25 MiB per-file limit is not hit (R.wasm = 18,062,845 bytes ≈ 17.2 MiB, largest file; 167 files total), and the repo's committed .gitignore already covers node_modules/ and dist/ so Task 1's `git add -A` is safe. On the confirmed list itself: no contradictions, but heavy duplication — the 24 entries collapse to roughly 15 distinct root causes (env:undefined reported 4x; R.bin.* 3x; df-as-2dp 3x; ASCII hyphen 3x; font-UA, App.css deletion, vite-config test key, and Blob/BlobPart each 2x) — worth deduplicating before presenting to Benjie. Remaining unverified-but-low-risk territory I deliberately left out of findings: Safari/Firefox are never tested (only chromium is installed, plan line 50) though modern Safari supports the COOP/COEP+SharedArrayBuffer combo, and accessibility of the result card (no table captions, no aria-live on status) is real but premature for a skeleton whose visual design layer is explicitly deferred.

### [MAJOR] CSV upload silently converts missing score cells to 0 — confidently wrong statistics with no warning

**Claim:** No lens examined what real user CSVs do to the stats. PapaParse with dynamicTyping (plan line 480) parses an empty cell as null, and runIndependentTTest maps rows via `Number(r[outcome])` (plan line 426); `Number(null) === 0`, so every missing outcome cell enters R as the value 0 and the t-test computes wrong means/SDs/t/p with zero indication. A missing group cell becomes the literal string "null" (a third factor level, R errors), and a non-numeric score cell like "N/A" becomes NaN, which kills Levene's lm with the cryptic error "contrasts can be applied only to factors with 2 or more levels". Every plan verification passes because the sample/test data have no missing cells — but CSV upload is a shipped input path (DatasetLoader, plan line 604) and the deferred data-prep step (ui_spec line 284 "step 4 prepares the dataset once (types · levels · missing data)"; architecture doc line 125) does not exist in the skeleton, so nothing stands between a student's messy CSV and fabricated numbers.

**Evidence:** Sandbox /tmp/telos-recheck-completeness: Papa.parse('group,score\nA,10\nA,\nA,11\nB,15\nB,16\nB,17', {header:true, dynamicTyping:true, skipEmptyLines:true}) → rows include {"group":"A","score":null}; applying the plan's exact env mapping yields score array [10,0,11,15,16,17] passed to R. Rscript run of the plan's exact R_STATS block with NaN in score → 'R ERROR: contrasts can be applied only to factors with 2 or more levels'. Plan lines 426, 480, 604; telos_ui_spec.html line 284; architecture doc line 125.

**Suggested fix:** In runIndependentTTest (or parseCsv), exclude rows where the outcome is not a finite number or the group is null/empty, and surface the count ('3 rows excluded: missing/non-numeric') — or refuse to run with a clear message. A one-line filter plus a note in ResultCard keeps the skeleton honest until the real data-prep step exists; add a unit test with a missing cell.

### [MAJOR] Valid datasets with degenerate Levene (F=NaN) white-screen the whole app: unguarded toFixed(null) in render, no error boundary anywhere

**Claim:** The serializer maps R NA/NaN to JSON null by design (plan line 300), but RawStats/TTestResult declare every stat as `number` (plan lines 358-363, 420-423) and no consumer handles null. For any two-group dataset where Levene's fit is perfect with zero spread in |x−median| (e.g. n=2 per group with equal ranges — {10,12} vs {15,17}), the t-test itself SUCCEEDS (pooled, t=-3.54, p=.072) but levene comes back {F:null, p:null}. ResultCard then evaluates `f(result.levene.F)` → `null.toFixed(2)` → TypeError thrown during render (plan line 674), and since neither App.tsx (lines 728-741) nor main.tsx has an error boundary, React unmounts the entire tree: the user gets a blank page for a perfectly valid analysis, with no message and no recovery except reload. The stats lens analyzed this exact degenerate Levene case but concluded only that the F value renders 'ugly' — it missed that the F=NaN branch crashes the app outright. This is the one user-reachable path where the catch-around-runJson safety net (TestConfig line 624-625) cannot help, because the throw happens in render, after setResult.

**Evidence:** Rscript run of the plan's exact R_STATS + .telos_json on score=c(10,12,15,17), group=c('A','A','B','B') → {"...","test":"pooled","t":-3.535533906,"df":2,"p":0.07152330911,...,"levene":{"F":null,"p":null}} (plus R warning 'ANOVA F-tests on an essentially perfect fit are unreliable'). JSON.parse gives result.levene.F === null; plan line 674 calls f(result.levene.F) where f = (n) => n.toFixed(2) (line 651). No ErrorBoundary appears anywhere in the plan's file structure (lines 17-34) or App wiring (lines 728-741).

**Suggested fix:** Type the serialized stats honestly (number | null), guard the assumption-note rendering (omit the parenthetical or print '—' when levene.F is null), and wrap ResultCard in a small error boundary so a formatting bug can never blank the whole app. Add the {10,12} vs {15,17} dataset as a unit-test case.

### [MAJOR] Figure pipeline contradicts the architecture doc, the outputs spec, and the plan's own registry rMap: base-R boxplot() where all three say ggplot2

**Claim:** The faithfulness lens checked tables/text/bundle but not the figure renderer. Three sources of truth lock figures to ggplot2: the architecture doc ('Figures | Rendered by ggplot2 inside WebR', line 31), the outputs spec's Figure(s) zone definition ('the chart type and exactly what it plots (rendered by ggplot2)', outputs html line 133), and the plan's OWN registry rMap ('geom_boxplot() → figure', plan line 222). Yet R_BOXPLOT (plan line 418) draws a base-graphics `boxplot(...)` — visually a different artifact (no ggplot theme/scales), and it ships in the export bundle as figure_boxplot.png. So the registry the plan commits asserts geom_boxplot while the R it executes uses base graphics — an internal contradiction the consistency test can't see. There is a real tradeoff behind the cut (ggplot2 in WebR means a runtime wasm package install, more download), but the plan never records the decision; per project norms (Benjie makes all calls; render the approved design, not a lighter stand-in) this needs an explicit call before Task 6.

**Evidence:** docs/superpowers/specs/2026-06-10-telos-architecture-design.md line 31: 'Figures | Rendered by ggplot2 inside WebR, returned as PNG/SVG'; telos_test_outputs.html line 133: '...the chart type and exactly what it plots (rendered by ggplot2)'; plan line 222 rMap 'geom_boxplot() → figure' vs plan line 418 `const R_BOXPLOT = String.raw\`boxplot(score ~ factor(group), ...)\``; bundle includes figure_boxplot.png (plan line 223, 707).

**Suggested fix:** Ask Benjie: ship base-R boxplot for the walking skeleton (recording the decision in the plan and adjusting/annotating the rMap string) or pay the webr::install('ggplot2') cost now. If base-R is chosen, add one plan sentence acknowledging the deviation and the follow-up plan that restores ggplot2.

### [MINOR] Engine ships with no boot progress, contradicting the architecture doc's 'Async + progress'; first deployed Run hides a multi-MB WebR download behind a static 'Running…' label

**Claim:** The architecture doc defines the R-engine adapter as 'boot, package preload + caching, ... Async + progress' (line 88), but the plan's engine exposes no progress signal and boots lazily inside the first 'Run analysis' click (plan lines 616-617); the only feedback is the button text 'Running…' (line 637). On the deployed site that click triggers downloading the self-hosted runtime — R.wasm alone is 17.2 MiB, the full dist is ~47 MB/167 files — so on a slow connection the app appears frozen for tens of seconds to minutes on the exact demo path the Done criteria celebrate (line 803). The plan's own e2e quietly budgets 120s for this (line 762) but the human user gets no equivalent patience cue. Positive intel from the same check: the hypothesized Cloudflare Pages deploy blocker is REFUTED — no webr dist file exceeds the 25 MiB per-file limit (largest is R.wasm at 18,062,845 bytes) and 167 files is far under the 20,000-file cap, so Task 12 Step 3 will not fail on asset size.

**Evidence:** Architecture doc line 88 ('Async + progress'); plan lines 616-617, 636-637, 762. Sandbox: ls -l node_modules/webr/dist/R.wasm → 18,062,845 bytes; du -sh dist → 47M; find -type f | wc -l → 167; find -size +26214400c → no matches.

**Suggested fix:** Cheapest faithful-to-architecture fix: start getEngine() on page load (or on dataset load) instead of first click, and render a distinct status while engine init is pending ('Preparing statistics engine — first visit downloads ~20 MB'). Full progress wiring can wait for the engine-adapter plan, but the status split should land in the skeleton.

### [MINOR] License compliance gap: deploy ships GPLv3 webR binaries and OFL fonts with no license texts, and the README task omits attribution entirely

**Claim:** webr's LICENSE.md states 'the webR binaries are distributed under the GNU GPL Version 3 Licence'; the plan self-hosts those binaries publicly (public/webr → Cloudflare Pages) but the copy script copies only node_modules/webr/dist (plan line 101), so no license file accompanies them, and the GPL's notice/source-availability terms are never addressed. Likewise Crimson Pro and Atkinson Hyperlegible are SIL OFL 1.1 fonts whose license requires the copyright/license notice to accompany redistributed font files, yet Task 3 commits bare .woff2 files (plan lines 132-137, 163) with no OFL text. Task 12 Step 4's README scope (line 792: dev/test/e2e/deploy + COOP/COEP + self-hosted WebR) mentions neither. Low legal risk in practice (sources are public upstream), but it is a public deployment of GPL binaries and the project already plans a Welcome/credits surface where attribution belongs.

**Evidence:** Sandbox: node_modules/webr/LICENSE.md — 'To remain compatible with the GPL, the webR binaries are distributed under the GNU GPL Version 3 Licence'; package.json license field 'SEE LICENSE IN LICENCE.md'. Plan line 101 copies only 'node_modules/webr/dist'; plan lines 132-137/163 download and commit woff2 files with no license text; plan line 792 README scope.

**Suggested fix:** Have copy-webr.mjs also copy node_modules/webr/LICENSE.md into public/webr/, drop the OFL texts into public/fonts/ when downloading, and add one README line crediting R/webR (GPLv3, source links) and the two OFL fonts.

## Per-lens overall assessments

### toolchain

Empirical recheck in a /tmp sandbox (plan code replicated verbatim, Tasks 1-11) confirms the toolchain skeleton is sound in shape but the plan will not execute green as written: 'npm run build' (tsc -b) fails on three TS 6 type errors (the 'test' key in vite.config.ts imported from 'vite', and two Uint8Array→BlobPart errors in ResultCard/ExportButton), the Task 3 font download fetches zero woff2 files with the truncated UA (locked fonts silently absent → unfaithful render), the Task 3 dev check breaks because the template App.tsx still imports the deleted App.css until Task 11, and 3 of 4 Task 5 engine tests fail because { env: undefined } is passed to WebR 0.6.0 — contradicting the plan's 'pre-verified against WebR' claim. All five have small, sandbox-verified fixes, after which the full suite is 12/12 green, 'npm run build' passes, and the WebR copy lands in dist. Several prior-intel hypotheses were confirmed (React 19/Vite 8/TS 6/Vitest 4 scaffold vs the plan's 'React 18'; webr dist ships R.js/R.wasm not R.bin.*; truncated UA yields TTF) and two concerns were refuted with fresh evidence: fresh-clone postinstall works (webr dist exists at postinstall time), and 'vite preview' does serve the COOP/COEP isolation headers on both the document and /webr/* assets; dist is also Cloudflare-Pages-safe (172 files, largest 17.2 MB < 25 MiB limit). Not exercised: 'npx playwright install chromium' and the Task 11 e2e run itself (heavy browser download); statistics values beyond the plan's own vitest assertions, which all passed against real WebR in Node.

### stats

The statistics in Task 6 are correct and were verified empirically by running the plan's exact R_STATS block and JSON helper in real WebR 0.6.0 (sandbox /tmp/telos-recheck-stats): the known-answer test's expectations all hold precisely (groupStats ordered [A,B], n=4, SE=0.64550, Levene F=0/p=1 -> pooled, df=6, t=-5.47723, p=0.00155<0.01, d=-3.87298, meanDiff=-5, CI [-7.234,-2.766] direction consistent with A−B), the contrast string uses the same U+2212 bytes in test and code (built in JS, no R round-trip), the median-centered anova(lm(z~g)) Levene is mathematically identical to car::leveneTest's default (Brown-Forsythe), factor-level alphabetical ordering is internally consistent between groupStats, the t.test formula contrast, meanDiff, and conf.int for both pooled and Welch (Welch confirmed empirically: meanDiff=-13.49 with CI [-36.80, 9.81]), and the is.na(levP) fallback correctly routes NaN Levene results to pooled. The real problems are at the edges: a blocker in the engine seam (webr 0.6.0 throws on an options object with `env: undefined`, so Task 5's three no-env tests fail as written even though Task 6's env-passing calls work), a faithfulness gap where pooled integer df is rendered '6.00'/'t(10.00)' against the spec card's integer '58'/'t(58)', and a serializer that emits invalid JSON for quote/backslash-containing group labels (user-reachable via CSV) and for ±Inf (not reachable inside this t-test path, but latent in the shared helper). Minor items: Levene degeneracy at n=2 per group (F becomes FP noise ~8e31, displayed via toFixed) and mixed minus-sign typography versus the card.

### webr

Empirical verdict from a real sandbox (/tmp/telos-recheck-webr, webr@0.6.0 + vitest 4.1.8): the plan's WebR API usage is fundamentally sound but ships one real bug. Everything the engine adapter relies on exists in webr@0.6.0 exactly as used — `new WebR({baseUrl})`, `init()`, `evalRVoid(code, options)`, `Shelter` typed as `new () => Promise<Shelter>` (so `await new this.webr.Shelter()` is correct), `shelter.captureR(code, {captureStreams, env})` with `captureStreams?: boolean` and `env?: WebRData` confirmed in dist/webR/webr-chan.d.ts:52-62, `purge()`, `FS.readFile -> Promise<Uint8Array>`, and `close()` (returns void; awaiting it is harmless). JS `env` objects with number[]/string[] convert to named R vectors as the plan assumes (mean(x)=4 test passes; string vectors work too). The BASE_URL logic is right: in Node webr's default baseUrl is `__dirname + '/'` (webr.mjs: `var ur=h?__dirname+\"/\":\"https://webr.r-wasm.org/v0.6.0/\"`), so vitest runs fully offline from node_modules with ~1s boot; in the browser '/webr/' is same-origin, so webr does `new Worker('/webr/webr-worker.js')` against the assets copy-webr.mjs copies (whole dist = 47M, every file under 20M, safe for Cloudflare Pages' 25 MiB per-file cap). `png()` works with no extra packages (Cairo is in the wasm build), writes to /tmp on the virtual FS, and FS.readFile returns a Uint8Array with correct PNG magic; captureR's captureGraphics default self-disables in Node (`typeof OffscreenCanvas` guard in the worker), so no OffscreenCanvas error. The one blocker: the engine always passes the `env` key even when undefined, and webr@0.6.0 throws 'Can't create object in new environment with empty symbol name' for `env: undefined` — 3 of Task 5's 4 tests fail verbatim; a one-line key-omission fix makes all 4 pass, after which Task 6's full t-test + boxplot test also passes with the exact expected statistics. Prior intel confirmed on both counts I could test: dist has R.js/R.wasm (no R.bin.*, so Task 2 Step 2's Expected line is wrong), and webr resolves to 0.6.0. Browser-side '/webr/' loading was verified statically only (no real browser in this sandbox); same-origin Worker construction plus the complete dist copy make it low-risk.

### faithfulness

The verbatim-encoding core of the revision largely holds up: sandbox stripping confirms howToRead, assumptionNote, and rMap are exact character-level matches to the Independent t-test card, both tables' titles and column label sequences (Group/N/M/SD/SE; Contrast/t/df/p/Mdiff/95% CI/d) match the card's theads, the figure caption matches, p-formatting ('.002', '<.001') matches APA/card style, and bundleFiles exactly equal the outputs card's bundle line. The real problems are at the edges of that claim. One fidelity blocker: the single toFixed(2) formatter renders pooled df as '58.00'/'t(6.00)' and fills the APA template at 2dp where the card unambiguously uses integer df and 1dp M/SD (it rounds SD 7.55→7.6). Four majors: the roles are paraphrased rather than copied from the inputs card (and TestConfig never reads spec.roles, so the roles array is dead data); the consistency test is demonstrably non-discriminating — a registry corrupted with the Paired t-test's titles and a frankenbundle passes every assertion, so the plan's 'can't drift' guarantee is currently false; the export zip is flat while telos_ui_spec.html requires a 01_independent-t-test/ folder and lists report.pdf/tex/analysis.R/cleaned.csv that the plan omits without acknowledgment anywhere; and the inputs card's option strip (notably equal variance 'off · Welch') is dropped in favor of a silent auto-Levene reinterpretation of 'when equal-variance is off' — a spec ambiguity Benjie should resolve explicitly. Two minors: ASCII hyphens vs the card's U+2212 (mixed within a single table row) plus CI decimal drift, and lost question subtitle / bold-italic emphasis / APA symbol italics in the rendered card. All fixes are small, plan-text-level edits; none threaten the architecture.

### ui-e2e

UI/state/E2E lens, verified empirically in a /tmp sandbox (real Chromium via Playwright 1.60, html-to-image 1.11.13, R for the stats). The good news: every selector in the Task 11 E2E resolves against the exact DOM Task 10 renders — getByLabel on the label-wrapped selects (including selectOption('score') with value-less options), the h2 heading, the img alt, and all buttons passed verbatim in the sandbox, so the prior-intel selector worries are refuted. Also refuted: StrictMode (which the scaffold ships and the plan keeps) cannot double-boot WebR, because the engine singleton is created inside the click handler, and the Zustand store has no real mutation risk since every update is an immutable spread; the 180s webServer budget looks realistic (not empirically timed). The real problems cluster in output fidelity and result lifecycle: on the default sample-data path the app renders df as '10.00'/'t(10.00)' and the APA sentence as 'p=<.001' (both confirmed by executing the plan's own formatting code; the spec card shows 't(58)' and 'p=.002' forms) — one blocker, one major; the exported table PNGs are transparent-background (88.5% alpha=0 measured; near-white text for dark-theme users, visually confirmed illegible on white) because toPng gets no backgroundColor and the referenced .card class has no CSS rule — major; and setConfig never invalidates a stale result while an error after a successful run leaves a rendered Export button whose click throws on a null element — major. Smaller items: unrevoked blob URLs (doubled in dev by StrictMode), presence-only E2E assertions (concrete R-verified numbers supplied: 70.33/3.14/1.28, 82.33/3.78/1.54, t=-5.98, df=10, p<.001, Mdiff=-12.00, CI=[-16.47,-7.53], d=-3.45), positional bundleFiles destructuring, and hyphen-minus vs the card's U+2212. All fixes are small and local; none threatens the architecture.

### plan-process

Structure and ordering are mostly sound, and several feared problems are empirically CLEAN: the Task 1 rsync merge collides with nothing (fresh scaffold contains README.md, index.html, eslint.config.js, tsconfig*, vite.config.ts, public/, src/ — none exist at the repo root, and the HTML specs/docs are untouched); npm create vite runs non-interactively; the committed .gitignore covers node_modules/ and dist/; tsc -b matches the scaffold's project-references layout; every task's git add covers the files that task creates (only Task 3's `git add public/fonts` stages an empty dir — covered in the fonts finding); the registry consistency test passes against the real telos_test_outputs.html; the ApaTable/ExportButton DOM ids match each other and the bundle filenames; the Done-list test inventory matches the tests the tasks write; and wrangler's `pages project create --production-branch` flag still exists. The prior-intel hypotheses are all CONFIRMED (React 19.2/Vite 8/TS ~6.0 vs line 9's \"React 18\" — cosmetic, nothing depends on it; webr 0.6.0 ships R.wasm/R.js not R.bin.*; the truncated UA yields TTF-only CSS), and full sandbox replication surfaced four NEW execution-stoppers beyond where the dry run reached: the Task 3→11 App.css ordering break, two independent `tsc -b` type failures (vite.config `test` key; Blob/Uint8Array under TS 6) that kill `npm run build` and therefore the e2e webServer and the deploy, the webr `env: undefined` crash failing 3 of 4 Task 5 tests, and vitest collecting the Playwright spec so `npm test` goes red from Task 11 onward. Smaller items not worth findings slots: Task 1 commits a postinstall referencing scripts/copy-webr.mjs that only exists after Task 2 (an `npm install` at Task 1's commit exits nonzero — create the script in Task 1 or set postinstall in Task 2); .gitignore never covers playwright-report//test-results/ (untracked dirt only, since later git adds are path-scoped); and process decisions for Benjie rather than defects: every task commits directly to main with no branch/review gate stated, and Task 3 Step 4 / Task 12 Step 1 are human-eyeball checks with no machine-checkable proxy.
