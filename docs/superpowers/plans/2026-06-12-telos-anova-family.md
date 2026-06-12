# ANOVA Family Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Process (owner-ruled lighter regimen + parallel worktrees):** Tasks 1–4 (backbone) run SERIALLY on main. Tasks 5–15 (one per test) run in PARALLEL git worktrees — each touches ONLY its own six files + nothing shared; they must NOT edit catalog.ts, builders.ts, session.ts, or any component. Task 16 (integration) is serial on main after all worktrees merge. One combined slice-end review replaces per-task reviews. Implementers: `npm run test:fast` is your inner loop; the FULL `npm test` is slow (~10–20 min, WebR suites serialized) — run it in FOREGROUND with a long timeout, only at your task's gate.

**Goal:** Add the 11 ANOVA-family tests (one-way, factorial, repeated-measures, mixed, nested, Welch's, ANCOVA, MANOVA, MANCOVA, Kruskal-Wallis, Friedman) to the finished shell, registry-faithful to the spec cards, with spike-verified statistics.

**Architecture:** Per approved spec `docs/superpowers/specs/2026-06-12-telos-anova-family-design.md` — serial backbone (engine preload, shared post-hoc/sphericity/adjusted-means R snippets + TS types, eligibility extensions) frozen before 11 per-test worktrees (registry + consistency test + stats + builder + tests each), then serial integration (catalog/RUNNERS/BUILDERS + e2e journeys).

**Tech Stack:** React 19 / TS / Vite 8 / vitest 4 / Playwright; WebR 0.6.0 with afex, emmeans, car, rstatix (all spike-verified to reproduce native R 4.6.0 exactly — run `wf_0a8e8e23-be0`, report `/tmp/anova-spike/spike-report.md`; 117 comparisons, 0 mismatches). PMCMRplus does NOT load under WebR (Rmpfr has no wasm binary) — Nemenyi is hand-rolled, validated exactly against native PMCMRplus.

---

## Spike facts every implementer must know

- **Fixture:** `src/lib/stats/fixtures/anova.csv` (committed in Task 1; identical copy at `tests/e2e/fixtures/anova.csv`). 60 rows; columns: `subject_id` (S01–S60), `group` (control/drug_a/drug_b, 20 each), `gender` (f/m alternating), `school` (north/south/west, 20 each), `classroom` (6 labels, unique within school, e.g. north_c1), `baseline`, `outcome`, `outcome2`, `score_t1`, `score_t2`, `score_t3` (numeric).
- **Known answers** (native R 4.6.0 ≡ WebR, full precision, the comparison pair is always control vs drug_a, condition pair t1 vs t2): embedded per task below. Tolerance in tests: `toBeCloseTo(value, 6)` unless stated.
- **WebR gotchas** (already handled by `Engine`): detectCores shim, `.telos_json`, `{ }` wrapping, never pass `env: undefined`.
- **afex:** `aov_ez(..., anova_table = list(es = "pes", correction = ...))` — es MUST be "pes" (partial η²; afex default "ges" is NOT what the cards draw). Type III by default (cards' SPSS convention). Mauchly + GG/HF come from `summary(m$Anova)`.
- **Levene (Brown-Forsythe):** hand-rolled `aov(abs(y - ave(y, g, FUN = median)) ~ g)` ≡ `car::leveneTest` (spike-proven for 3 groups, matches to 1e-13). Use the hand-rolled form — no car dependency for the note.
- **rstatix rounds `p.adj`** in `games_howell_test` (e.g. 0.82) — known answers reflect that; assert the rounded value for GH only.
- **Dunn:** rstatix `dunn_test(p.adjust.method=...)`; spike proved the hand-rolled z/holm identical — use rstatix (card map).
- **Nemenyi:** HAND-ROLLED (PMCMRplus installs but cannot load under WebR — Rmpfr has no wasm binary): for conditions i,j with per-subject within-row mean ranks `Rbar`, `q = (Rbar_j - Rbar_i) / sqrt(k*(k+1)/(6*n))`, `p = ptukey(abs(q)*sqrt(2), k, Inf, lower.tail = FALSE)`. Spike-validated EXACTLY against native PMCMRplus 1.9.12 (2.83863931227479e-05).
- **SS types per card R maps (design §4.10):** factorial/RM/mixed = afex Type III · ANCOVA = `car::Anova(type=3)` on an `lm` with `contrasts = list(<factor> = contr.sum)` (REQUIRED for valid Type III) · MANOVA = sequential `stats::manova()` · MANCOVA = `car::Manova()` (Type II).
- **Engine preload grows** (Task 1): the browser pays a bigger first download; e2e timeouts already accommodate engine init.

## Recorded decisions (surface in the slice-end report for Benjie's audit)

1. APA templates stay card-literal even where dynamic values would read better: one-way always says "Tukey post-hoc tests showed…" (even with Bonferroni/Scheffé selected), RM says "(GG-corrected)" (even with HF/none), factorial/nested keep abstract "A×B"/"A", MANOVA/MANCOVA report Pillai's V (always computed) even when the table shows Wilks. Byte-fidelity to the drawn cards wins; B-list candidates.
2. Post-hoc tables render unconditionally EXCEPT factorial (its card: "when an effect is significant"). Factorial with no significant effect renders no Table 3 and its bundle omits table_simple-effects.png.
3. Subject-ID roles accept all four levels (`nominal/ordinal/interval/ratio` — the app has no 'id' level; id-tagged columns default to unused, so the user marks Used + level via the existing step-4 flow; e2e journey B proves it).
4. Wide-only for RM/Mixed/Friedman (no auto-reshape); listwise = complete across subject + all chosen measure columns, own N reported.
5. Figures use computed means/CI in R data frames + geom_pointrange/geom_line (no Hmisc dependency); multi-line plots use default ggplot hue palette pending the design pass.
6. Friedman figure = profile of condition means (card ftype "profile / box plot", bundle figure_profile.png).
7. Nested/crossed detection (design §5.4): warning sentence appended to the card's plain note when a nested-factor level appears under >1 parent.
8. ANCOVA/MANCOVA slope checks + one-way/factorial Levene + Shapiro-on-residuals append computed values to the card's assume note, t-test pattern: `${cardNote} (Levene F=…, p=… · Shapiro W=…, p=…)`.

## File map

| Area | Files |
|---|---|
| Task 1 | `src/lib/webr/engine.ts` (preload), `scripts/copy-webr.mjs` (no change needed — verify), `package.json` (test:fast), `src/lib/stats/fixtures/anova.csv` + `anova.ts` (loader), `tests/e2e/fixtures/anova.csv` |
| Task 2 | `src/lib/stats/posthoc.ts` + `posthoc.test.ts` |
| Task 3 | `src/lib/stats/sphericity.ts` + `sphericity.test.ts` |
| Task 4 | `src/lib/stats/adjustedMeans.ts` + test, `src/lib/registry/types.ts` (select kind, ColumnDef.suffix, categories.min, MinRule additions), `src/lib/eligibility/eligibility.ts` + test, `src/state/session.ts` (select defaults), `src/components/TestConfigScreen.tsx` (select pill) |
| Tasks 5–15 | per test: `src/lib/registry/<name>.ts` + `<name>.consistency.test.ts`, `src/lib/stats/<name>.ts` + `.test.ts`, `src/lib/results/build<Name>.ts` + `.test.ts` |
| Task 16 | `src/lib/registry/catalog.ts`, `catalog.consistency.test.ts`, `src/lib/results/builders.ts` |
| Task 17 | `tests/e2e/anova.spec.ts` |
| Task 18 | `README.md`, `docs/superpowers/ROADMAP.md`, screenshots |

---

### Task 1: Engine preload, fixture, test:fast (backbone B1)

**Files:**
- Modify: `src/lib/webr/engine.ts:38`
- Create: `src/lib/stats/fixtures/anova.csv`, `src/lib/stats/fixtures/anova.ts`
- Create: `tests/e2e/fixtures/anova.csv`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Copy the spike fixture into the repo (both copies identical)**

```bash
cp /tmp/anova-spike/fixture.csv src/lib/stats/fixtures/anova.csv
cp /tmp/anova-spike/fixture.csv tests/e2e/fixtures/anova.csv
```
(If /tmp/anova-spike is gone, regenerate with the seeded R script in the design-doc appendix of `/tmp/anova-spike/fixture.R`; the file is also reproducible via `set.seed(42)` — see spike report. Verify `shasum` of both copies match.)

- [ ] **Step 2: Fixture loader**

`src/lib/stats/fixtures/anova.ts`:
```ts
import { readFileSync } from 'node:fs'
import type { Dataset } from '../types'

/** Test-only loader for the spike fixture (simple CSV: no quotes/embedded commas). */
export function loadAnovaFixture(): Dataset {
  const [head, ...lines] = readFileSync('src/lib/stats/fixtures/anova.csv', 'utf8').trim().split('\n')
  const cols = head.split(',').map((c) => c.replace(/^"|"$/g, ''))
  const rows = lines.map((l) => {
    const vals = l.split(',').map((v) => v.replace(/^"|"$/g, ''))
    return Object.fromEntries(cols.map((c, i) => {
      const n = Number(vals[i])
      return [c, vals[i] !== '' && Number.isFinite(n) && /^-?[\d.]+$/.test(vals[i]) ? n : vals[i]]
    }))
  })
  return { rows } as Dataset
}
```
(Check `Dataset`'s exact shape in `src/lib/stats/types.ts` first; if it carries more fields than `rows`, construct them the way existing tests do.)

- [ ] **Step 3: Extend the engine preload list**

In `src/lib/webr/engine.ts` replace the package loop array:
```ts
    for (const pkg of ['ggplot2', 'nortest', 'effectsize', 'psych', 'coin', 'janitor',
      'afex', 'emmeans', 'car', 'rstatix']) {
```
Keep the comment above it and append: `// ANOVA slice additions spike-verified under WebR 0.6.0 (wf_0a8e8e23-be0): afex (lme4/Matrix/car deps), emmeans, rstatix. PMCMRplus cannot load (Rmpfr lacks a wasm binary) — Nemenyi is hand-rolled in the Friedman stats module.`

- [ ] **Step 4: test:fast script**

In `package.json` scripts add (engine-dependent suites all live next to the engine or import it — exclude by path):
```json
"test:fast": "vitest run --exclude '**/node_modules/**' --exclude 'src/lib/stats/**/*.test.ts' --exclude 'src/lib/webr/**'"
```
Run `npm run test:fast` — expect all non-WebR suites green in seconds. (If results/* builder tests are pure — they are — they stay included.)

- [ ] **Step 5: Engine smoke test for the new packages**

Append to `src/lib/webr/engine.test.ts` a test asserting the new packages load:
```ts
it('loads the ANOVA-slice packages', async () => {
  const ok = await engine.runJson<string[]>(`
    pkgs <- c('afex','emmeans','car','rstatix')
    as.list(pkgs[vapply(pkgs, requireNamespace, logical(1), quietly = TRUE)])`)
  expect(ok).toEqual(['afex', 'emmeans', 'car', 'rstatix'])
}, 600_000)
```
(Mirror the file's existing structure — one shared Engine in beforeAll with the long hookTimeout.)

- [ ] **Step 6: Gates + commit**

Run: `npx tsc -b` (expect 0), `npm test` (FOREGROUND, long timeout — expect all green; first run downloads the new packages), `npx playwright test` (expect existing e2e green — engine init now downloads more, the journeys already wait on the Download gate).
```bash
git add -A && git commit -m "feat(anova): engine preload afex/emmeans/car/rstatix/PMCMRplus; spike fixture + loader; test:fast script"
```

---

### Task 2: Shared post-hoc module (backbone B2)

**Files:**
- Create: `src/lib/stats/posthoc.ts`, `src/lib/stats/posthoc.test.ts`

- [ ] **Step 1: Write the module**

`src/lib/stats/posthoc.ts`:
```ts
/** Shared parametric post-hoc machinery (design §3 B2). Six cards draw the same
 * Pair / M_diff / SE / p_adj / 95% CI table; emmeans computes all of them.
 * Rank-based tables (Dunn, Nemenyi) have different shapes and live in their tests' modules. */

export interface PosthocRow { pair: string; diff: number; se: number; pAdj: number; ciLo: number; ciHi: number }

/** R helper: define once per stats block, call with an emmeans object + adjust method.
 * summary(pairs(...), infer=TRUE) yields estimate/SE/p.value/lower.CL/upper.CL under ONE adjustment. */
export const POSTHOC_EMM_R = String.raw`
.telos_posthoc <- function(emm, adjust) {
  s <- summary(pairs(emm, adjust = adjust), infer = TRUE)
  lapply(seq_len(nrow(s)), function(i) list(
    pair = as.character(s$contrast[i]), diff = s$estimate[i], se = s$SE[i],
    pAdj = s$p.value[i], ciLo = s$lower.CL[i], ciHi = s$upper.CL[i]))
}`

/** Render rows for the drawn table (builders import this; column keys match the cards). */
export const posthocTableRows = (rows: PosthocRow[], fmt: { f: (n: number) => string; fp: (p: number) => string }) =>
  rows.map((r) => ({ pair: r.pair, mdiff: fmt.f(r.diff), se: fmt.f(r.se), padj: fmt.fp(r.pAdj), ci: `[${fmt.f(r.ciLo)}, ${fmt.f(r.ciHi)}]` }))
```
(Bare `pairs`, NOT `graphics::pairs` — emmeans registers the method on the generic; spike-verified.)

- [ ] **Step 2: Engine test with one-way known answers (all three adjustments)**

`src/lib/stats/posthoc.test.ts` (shared-Engine scaffold identical to existing stats tests; 300s hookTimeout):
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { loadAnovaFixture } from './fixtures/anova'
import { POSTHOC_EMM_R, type PosthocRow } from './posthoc'

let engine: Engine
beforeAll(async () => { engine = new Engine(); await engine.init() }, 600_000)
afterAll(async () => { await engine.close() })

const run = (adjust: string) => {
  const ds = loadAnovaFixture()
  const env = {
    y: ds.rows.map((r) => r['outcome'] as number),
    g: ds.rows.map((r) => String(r['group'])),
    adjust,
  }
  return engine.runJson<PosthocRow[]>(`
    ${POSTHOC_EMM_R}
    m <- aov(y ~ g, data = data.frame(y = y, g = factor(g)))
    .telos_posthoc(emmeans::emmeans(m, ~g), adjust)`, env)
}

describe('shared emmeans post-hoc (spike known answers, control - drug_a row)', () => {
  it('tukey', async () => {
    const rows = await run('tukey')
    const r = rows.find((x) => x.pair === 'control - drug_a')!
    expect(r.diff).toBeCloseTo(-1.37, 6)
    expect(r.se).toBeCloseTo(2.33956998597995, 6)
    expect(r.pAdj).toBeCloseTo(0.828376280197589, 6)
    expect(r.ciLo).toBeCloseTo(-6.99998369176902, 5)
    expect(r.ciHi).toBeCloseTo(4.25998369176902, 5)
    expect(rows).toHaveLength(3)
  }, 300_000)
  it('bonferroni', async () => {
    const r = (await run('bonferroni')).find((x) => x.pair === 'control - drug_a')!
    expect(r.pAdj).toBeCloseTo(1, 6)
    expect(r.ciLo).toBeCloseTo(-7.14098686270864, 5)
    expect(r.ciHi).toBeCloseTo(4.40098686270864, 5)
  }, 300_000)
  it('scheffe', async () => {
    const r = (await run('scheffe')).find((x) => x.pair === 'control - drug_a')!
    expect(r.pAdj).toBeCloseTo(0.842874697999946, 6)
    expect(r.ciLo).toBeCloseTo(-7.25051064370089, 5)
    expect(r.ciHi).toBeCloseTo(4.51051064370089, 5)
  }, 300_000)
})
```

- [ ] **Step 3: Run the new suite, then gates + commit**

Run: `npx vitest run src/lib/stats/posthoc.test.ts` (FOREGROUND, expect 3 passed), `npx tsc -b`, `npm run test:fast`.
```bash
git add src/lib/stats/posthoc.ts src/lib/stats/posthoc.test.ts
git commit -m "feat(anova): shared emmeans post-hoc module (tukey/bonferroni/scheffe spike-verified)"
```

---

### Task 3: Sphericity module (backbone B3)

**Files:**
- Create: `src/lib/stats/sphericity.ts`, `src/lib/stats/sphericity.test.ts`

- [ ] **Step 1: Write the module**

`src/lib/stats/sphericity.ts`:
```ts
/** Mauchly + GG/HF extraction from an afex model (design §3 B3). Used by RM + Mixed ANOVA.
 * Card rule: with a 2-level repeated factor sphericity is automatically met — callers omit the table (null). */

export interface SphericityInfo { effect: string; w: number; p: number; ggEps: number; hfEps: number }

/** R helper: afex model -> per-effect Mauchly W/p + GG/HF epsilons.
 * summary(m$Anova) carries sphericity.tests (W, p) and pval.adjustments (GG eps, HF eps) for
 * every within/interaction term; row order matches. Returns a list of rows, or an empty list
 * when the design has a 2-level repeated factor (no tests exist). */
export const SPHERICITY_R = String.raw`
.telos_sphericity <- function(m) {
  s <- summary(m$Anova, multivariate = FALSE)
  st <- s$sphericity.tests; pa <- s$pval.adjustments
  if (is.null(st) || nrow(st) == 0) return(list())
  lapply(rownames(st), function(e) list(
    effect = e, w = unname(st[e, 'Test statistic']), p = unname(st[e, 'p-value']),
    ggEps = unname(pa[e, 'GG eps']), hfEps = unname(pa[e, 'HF eps'])))
}`
```

- [ ] **Step 2: Engine test (RM 3-level + 2-level omission), spike known answers**

`src/lib/stats/sphericity.test.ts` (same scaffold as Task 2):
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { loadAnovaFixture } from './fixtures/anova'
import { SPHERICITY_R, type SphericityInfo } from './sphericity'

let engine: Engine
beforeAll(async () => { engine = new Engine(); await engine.init() }, 600_000)
afterAll(async () => { await engine.close() })

const rmSpher = (cols: string[]) => {
  const ds = loadAnovaFixture()
  const env = {
    sid: ds.rows.map((r) => String(r['subject_id'])),
    scores_flat: cols.flatMap((c) => ds.rows.map((r) => r[c] as number)),
    conds: cols, n: ds.rows.length,
  }
  return engine.runJson<SphericityInfo[]>(`
    ${SPHERICITY_R}
    long <- data.frame(sid = factor(rep(sid, length(conds))),
      condition = factor(rep(conds, each = n), levels = conds),
      score = scores_flat)
    m <- suppressWarnings(suppressMessages(afex::aov_ez(id = 'sid', dv = 'score', data = long, within = 'condition')))
    .telos_sphericity(m)`, env)
}

describe('sphericity module (spike known answers)', () => {
  it('3-level RM: Mauchly W/p + GG/HF eps', async () => {
    const rows = await rmSpher(['score_t1', 'score_t2', 'score_t3'])
    expect(rows).toHaveLength(1)
    expect(rows[0].w).toBeCloseTo(0.873515789948938, 6)
    expect(rows[0].p).toBeCloseTo(0.0198085203154266, 6)
    expect(rows[0].ggEps).toBeCloseTo(0.88771772482694, 6)
    expect(rows[0].hfEps).toBeCloseTo(0.913297705282412, 6)
  }, 300_000)
  it('2-level RM: empty (table omitted per the card rule)', async () => {
    expect(await rmSpher(['score_t1', 'score_t2'])).toEqual([])
  }, 300_000)
})
```

- [ ] **Step 3: Run suite (expect 2 passed), gates, commit**

```bash
git add src/lib/stats/sphericity.ts src/lib/stats/sphericity.test.ts
git commit -m "feat(anova): sphericity module — Mauchly + GG/HF from afex, 2-level omission rule"
```

---

### Task 4: Adjusted means + chassis/eligibility extensions (backbone B4+B5)

**Files:**
- Create: `src/lib/stats/adjustedMeans.ts`, `src/lib/stats/adjustedMeans.test.ts`
- Modify: `src/lib/registry/types.ts`
- Modify: `src/lib/eligibility/eligibility.ts`, `src/lib/eligibility/eligibility.test.ts`
- Modify: `src/state/session.ts` (option defaults), `src/components/TestConfigScreen.tsx` (select pill)

- [ ] **Step 1: Adjusted-means module**

`src/lib/stats/adjustedMeans.ts`:
```ts
/** Estimated marginal (adjusted) means via emmeans (design §3 B4). ANCOVA/MANCOVA. */
export interface AdjustedMeanRow { group: string; mean: number; se: number; ciLo: number; ciHi: number }

export const ADJMEANS_R = String.raw`
.telos_adjmeans <- function(emm) {
  s <- as.data.frame(emm)
  grp_cols <- setdiff(names(s), c('emmean', 'SE', 'df', 'lower.CL', 'upper.CL'))
  lapply(seq_len(nrow(s)), function(i) list(
    group = paste(vapply(grp_cols, function(c) as.character(s[[c]][i]), character(1)), collapse = ' × '),
    mean = s$emmean[i], se = s$SE[i], ciLo = s$lower.CL[i], ciHi = s$upper.CL[i]))
}`
```

- [ ] **Step 2: Adjusted-means engine test (ANCOVA type-3 known answers)**

`src/lib/stats/adjustedMeans.test.ts` (same scaffold as Task 2's test — shared Engine in beforeAll):
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { loadAnovaFixture } from './fixtures/anova'
import { ADJMEANS_R, type AdjustedMeanRow } from './adjustedMeans'

let engine: Engine
beforeAll(async () => { engine = new Engine(); await engine.init() }, 600_000)
afterAll(async () => { await engine.close() })

describe('adjusted means via emmeans (ANCOVA type-3 spike known answers)', () => {
  it('control row matches native R', async () => {
    const ds = loadAnovaFixture()
    const env = {
      y: ds.rows.map((r) => r['outcome'] as number),
      cov: ds.rows.map((r) => r['baseline'] as number),
      g: ds.rows.map((r) => String(r['group'])),
    }
    const rows = await engine.runJson<AdjustedMeanRow[]>(`
      ${ADJMEANS_R}
      d <- data.frame(y = y, cov = cov, g = factor(g))
      m <- lm(y ~ cov + g, data = d, contrasts = list(g = contr.sum))
      .telos_adjmeans(emmeans::emmeans(m, ~g))`, env)
    expect(rows).toHaveLength(3)
    const c = rows.find((r) => r.group === 'control')!
    expect(c.mean).toBeCloseTo(31.4221627207434, 6)
    expect(c.se).toBeCloseTo(1.10991244962393, 6)
    expect(c.ciLo).toBeCloseTo(29.1987409073006, 5)
    expect(c.ciHi).toBeCloseTo(33.6455845341862, 5)
  }, 300_000)
})
```

- [ ] **Step 3: types.ts extensions (surgical)**

In `src/lib/registry/types.ts`:
- `ColumnDef` gains `suffix?: string` — comment: `// renders after the sub, e.g. M<sub>diff</sub> (adj.)`
- `OptionSpec.kind` union gains `'select'`; OptionSpec gains `choices?: string[]` — comment: `// select kind: choices verbatim from the card; value = the drawn default`
- `RoleConstraint.categories` becomes `{ exact?: number; min?: number }`
- `MinRule` union gains `| { kind: 'complete-wide-rows'; n: number } // RM/Mixed/Friedman: ≥n rows complete across ≥2 candidate measure columns`

- [ ] **Step 4: eligibility.ts**

In `slotCompatibility` replace the categories check:
```ts
  if (role.categories) {
    const d = distinct(working, col.name)
    if (role.categories.exact !== undefined && d !== role.categories.exact)
      return { ok: false, reason: `needs exactly ${role.categories.exact} categories` }
    if (role.categories.min !== undefined && d < role.categories.min)
      return { ok: false, reason: `needs ${role.categories.min}+ categories` }
  }
```
In `testEligibility` add before the final 'used-columns' fallthrough:
```ts
  if (rule.kind === 'complete-wide-rows') {
    const measures = candidates[candidates.length - 1] // the repeated-measures role is last by convention in this family
    for (const a of measures) for (const b of measures)
      if (a.name !== b.name && completePairs(working, a.name, b.name) >= rule.n) return { ok: true, reason: null }
    return { ok: false, reason: `needs at least ${rule.n} complete rows across two repeated-measure columns` }
  }
```
Add the nested/crossed detector at the bottom:
```ts
/** Design §5.4: child levels appearing under >1 parent level (nested ANOVA sanity check). */
export function nestedLevelReuse(ds: Dataset, parent: string, child: string): string[] {
  const seen = new Map<string, Set<string>>()
  for (const r of ds.rows) {
    const p = r[parent], c = r[child]
    if (p == null || c == null || String(p).trim() === '' || String(c).trim() === '') continue
    if (!seen.has(String(c))) seen.set(String(c), new Set())
    seen.get(String(c))!.add(String(p))
  }
  return [...seen.entries()].filter(([, ps]) => ps.size > 1).map(([c]) => c).sort()
}
```

- [ ] **Step 5: eligibility tests**

Extend `src/lib/eligibility/eligibility.test.ts` mirroring its existing style: (a) categories.min — a 2-category column fails a min-3 role with reason `needs 3+ categories`, a 3-category passes; (b) complete-wide-rows — passes with ≥n complete pairs across two numeric candidates, fails below; (c) nestedLevelReuse — `[['a','x'],['a','y'],['b','x']]`-style rows where child x sits under parents a+b returns `['x']`, clean nesting returns `[]`.

- [ ] **Step 6: ColumnDef.suffix in the table-header renderer**

Find the component that renders table headers from `ColumnDef` (search `src/components/` for `c.sub` — existing composition is `c.sub ? <>{label}<sub>{sub}</sub></> : label`). Extend it to append the suffix: `<>{c.label}{c.sub && <sub>{c.sub}</sub>}{c.suffix}</>`. ANCOVA's `M<sub>diff</sub> (adj.)` header (Task 12) depends on this. Add a suffix assertion to that component's existing test file.

- [ ] **Step 7: select option kind in state + UI**

`src/state/session.ts`: wherever option defaults initialize (toggle → `default` boolean, number → `default` number), add: select → `o.value` if no `default`, else `String(o.default)`. Follow the existing pattern exactly — search for `kind === 'toggle'`.
`src/components/TestConfigScreen.tsx`: in the option-pill rendering, add a `select` branch rendering `<select aria-label={o.label} value={...} onChange={set}>` with `o.choices!.map(...)`, styled like the existing pill kinds (match the toggle pill classes; the ThemeSelect pill in App.tsx is the visual precedent). Selects must be `disabled={running}` exactly like the other controls (standing controls-lock rule).
Extend the existing TestConfig component test (find it next to the component) with: select renders the card default, changing it updates the store, disabled while running. Mirror the file's existing test idioms.

- [ ] **Step 8: Gates + commit**

`npx tsc -b` 0 · `npm run test:fast` green · `npx vitest run src/lib/stats/adjustedMeans.test.ts` green (FOREGROUND) · full `npm test` green · `npx playwright test` green (no select exists in shipped specs yet — flow unchanged).
```bash
git add -A && git commit -m "feat(anova): adjusted-means module; select option kind; categories.min + complete-wide-rows eligibility; nested/crossed detector"
```

---

## Per-test tasks (5–15) — common rules

Every per-test task runs in its OWN git worktree (`git worktree add ../telos-<id> main` after Task 4 merges) and touches ONLY its six files. The scaffolds are identical to Task 5's exemplar files — copy its structure exactly and substitute the content given in your task. Common rules:

- **domId on every table**: `<test-id>-<table-id>` (e.g. `mixed-anova-posthoc`). Zip filenames keep the card-faithful `table_<id>.png`.
- **Consistency test anchors:** inputs card scope = `inputsHtml.slice(indexOf('<div class="ttl">{THIS}</div>'), indexOf('<div class="ttl">{NEXT}</div>'))`; outputs scope = `outputsHtml.slice(indexOf('{THIS}</span>'), indexOf('{NEXT}</span>'))`. The NEXT anchors are given per task (tree order matters).
- **Consistency assertions per card** (adapt the exemplar; every test includes): theads (with sub/suffix composition), captions (numbered or bare per card), question, note text + kind, figure caption + ftype (`'type: ' + figures[i].type` where `type` is the FULL stripped string after "type: "), how-to-read, R map, APA-with-`__`, bundle line VERBATIM (no filename derivation assert — ANOVA figure names don't derive from types), role labels + cons lines + sl-hint lines, option pills (label+value) + kinds + select choices/hint where drawn.
- **Mutation check (one per test, after the consistency suite is green):** temporarily change one transcribed string in your registry file (e.g. a column label), run your consistency suite, verify it FAILS, revert, verify green. Record pass in your report.
- **Stats tests**: shared-Engine scaffold (Task 2's test shows it); `loadAnovaFixture()`; known answers below; FOREGROUND runs.
- **Builder tests**: pure (no engine) — feed a hand-built result object, assert table rows, note text, APA string.
- **Listwise**: filter rows in TS exactly like `runMannWhitneyU` does (numeric-finite for numeric roles, non-blank for categorical roles), `nExcluded` reported.
- **Adjust-method map** (select value → emmeans adjust): `{'Tukey HSD':'tukey','Bonferroni':'bonferroni','Scheffé':'scheffe'}`.
- **Commit** only your six files: `git add src/lib/registry/<name>* src/lib/stats/<name>* src/lib/results/build<Name>*` then `git commit -m "feat(anova): <test-id> registry+stats+builder (spike numbers verified)"`.

### Task 5: One-way ANOVA + post-hoc (EXEMPLAR — read fully even if implementing another test)

**Files:**
- Create: `src/lib/registry/oneWayAnova.ts`, `src/lib/registry/oneWayAnova.consistency.test.ts`
- Create: `src/lib/stats/oneWayAnova.ts`, `src/lib/stats/oneWayAnova.test.ts`
- Create: `src/lib/results/buildOneWayAnova.ts`, `src/lib/results/buildOneWayAnova.test.ts`

- [ ] **Step 1: Registry (transcribed verbatim from both cards — consistency test enforces every string)**

`src/lib/registry/oneWayAnova.ts`:
```ts
import type { TestSpec } from './types'

// Encoded from telos_test_outputs.html + telos_test_inputs.html (One-way ANOVA cards) — display strings verbatim.
export const ONE_WAY_ANOVA: TestSpec = {
  id: 'one-way-anova',
  name: 'One-way ANOVA + post-hoc',
  question: 'do 3+ groups differ, and which pairs?',
  roles: [
    { id: 'outcome', label: 'Outcome (DV)', levels: 'interval / ratio', arity: 'exactly 1',
      hint: 'e.g. the numeric result you measured — test score, income' },
    { id: 'factor', label: 'Factor (grouping)', levels: 'nominal / ordinal', arity: 'exactly 1 · 3+ categories',
      hint: 'e.g. label splitting cases into groups — teaching method' },
  ],
  options: [
    { id: 'alpha', label: 'α', value: '0.05', kind: 'display' },
    { id: 'posthoc', label: 'post-hoc', value: 'Tukey HSD', kind: 'select',
      choices: ['Tukey HSD', 'Bonferroni', 'Scheffé'],
      hint: "post-hoc choices: Tukey HSD · Bonferroni · Scheffé (Games-Howell lives under Welch's ANOVA, for unequal variances)" },
    { id: 'ci', label: 'CI', value: '95%', kind: 'display' },
  ],
  constraints: {
    roles: [
      { roleId: 'outcome', levels: ['interval', 'ratio'], arity: { min: 1, max: 1 } },
      { roleId: 'factor', levels: ['nominal', 'ordinal'], arity: { min: 1, max: 1 }, categories: { min: 3 } },
    ],
    minRule: { kind: 'rows-per-group', n: 3 }, // DRAFT family rule, same as the t-test
  },
  tables: [
    { id: 'descriptives', domId: 'one-way-anova-descriptives', title: 'Descriptives by group',
      columns: [{ key: 'group', label: 'Group' }, { key: 'n', label: 'N' }, { key: 'm', label: 'M' }, { key: 'sd', label: 'SD' }] },
    { id: 'anova', domId: 'one-way-anova-anova', title: 'ANOVA',
      columns: [{ key: 'source', label: 'Source' }, { key: 'ss', label: 'SS' }, { key: 'df', label: 'df' },
        { key: 'ms', label: 'MS' }, { key: 'f', label: 'F' }, { key: 'p', label: 'p' }, { key: 'eta2', label: 'η²' }] },
    { id: 'posthoc', domId: 'one-way-anova-posthoc', title: 'Post-hoc comparisons',
      columns: [{ key: 'pair', label: 'Pair' }, { key: 'mdiff', label: 'M', sub: 'diff' }, { key: 'se', label: 'SE' },
        { key: 'padj', label: 'p', sub: 'adj' }, { key: 'ci', label: '95% CI' }] },
  ],
  tableNote: { kind: 'assume', text: "assumption checks: Levene's (equal variances) & normality of residuals." },
  figures: [{ caption: 'Group means', type: 'means plot with 95% CI error bars' }],
  howToRead:
    'The F and its p tell you whether the groups differ overall; η² (or ω²) is the effect size. ' +
    'If significant, the post-hoc table shows which specific pairs differ, with multiplicity-adjusted p-values.',
  apaTemplate: 'A one-way ANOVA found an effect of group, F({df1},{df2})={f}, p={p}, η²={eta2}. Tukey post-hoc tests showed…',
  rMap: 'aov() → Table 2 · emmeans pairwise contrasts (Mdiff, SE, padj, CI) → Table 3 · effectsize::eta_squared() · ggplot2 → means plot',
  bundleFiles: ['table_descriptives.png', 'table_anova.png', 'table_posthoc.png', 'figure_means-plot.png'],
}
```

- [ ] **Step 2: Consistency test**

`src/lib/registry/oneWayAnova.consistency.test.ts` — clone the structure of `mannWhitneyU.consistency.test.ts` with:
- Outputs anchors: `'One-way ANOVA + post-hoc</span>'` → `'Factorial ANOVA</span>'`. Inputs anchors: `'<div class="ttl">One-way ANOVA + post-hoc</div>'` → `'<div class="ttl">One-sample t-test</div>'` (the inputs file's card order differs from the outputs file — verify with grep before assuming).
- Same thead/caption/question/note/howread/rmap/apa/bundle assertions (bundle: assert verbatim equality with `spec.bundleFiles` ONLY — drop the derivation assertion; the figure filename `figure_means-plot.png` does not derive from the type string).
- Figure: `fcap` strip equals `spec.figures[0].caption`; `ftype` strip equals `'type: ' + spec.figures[0].type`.
- Roles: labels + cons lines AND the sl-hint lines: `[...inCard.matchAll(/<div class="sl-hint">(.*?)<\/div>/g)].map(m => strip(m[1]))` equals `spec.roles.map(r => r.hint)`.
- Options: pills (label+value) equal; kinds equal `['display','select','display']`; `spec.options[1]` matchObject `{ id: 'posthoc', choices: ['Tukey HSD','Bonferroni','Scheffé'] }`; the under-strip note div (`class="s"` inside the options inner) strip-equals `spec.options[1].hint`.
- Run `npx vitest run src/lib/registry/oneWayAnova.consistency.test.ts` — green. Then the MUTATION CHECK (common rules).

- [ ] **Step 3: Stats module**

`src/lib/stats/oneWayAnova.ts`:
```ts
import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import { POSTHOC_EMM_R, type PosthocRow } from './posthoc'

export interface GroupDescRow { group: string; n: number; m: number; sd: number }
export interface OneWayAnovaResult {
  desc: GroupDescRow[]
  ssB: number; dfB: number; msB: number; f: number; p: number; eta2: number
  ssW: number; dfW: number; msW: number
  levene: { F: number | null; p: number | null }
  shapiro: { W: number | null; p: number | null }
  posthoc: PosthocRow[]
  nExcluded: number
  figurePng: Uint8Array<ArrayBuffer>
}

const R_STATS = String.raw`
gf <- factor(g)
d <- data.frame(y = y, g = gf)
m <- aov(y ~ g, data = d)
s <- summary(m)[[1]]; rownames(s) <- trimws(rownames(s))
desc <- lapply(levels(gf), function(l) { v <- y[gf == l]; list(group = l, n = length(v), m = mean(v), sd = sd(v)) })
eta2 <- as.numeric(effectsize::eta_squared(m, partial = FALSE)$Eta2)
lev <- tryCatch({ ls <- summary(aov(abs(y - ave(y, gf, FUN = median)) ~ gf))[[1]]
  list(F = ls[1, 'F value'], p = ls[1, 'Pr(>F)']) }, error = function(e) list(F = NULL, p = NULL))
sh <- tryCatch({ t <- shapiro.test(residuals(m)); list(W = unname(t$statistic), p = t$p.value) },
  error = function(e) list(W = NULL, p = NULL))
ph <- .telos_posthoc(emmeans::emmeans(m, ~g), adjust)
list(desc = desc, ssB = s['g', 'Sum Sq'], dfB = s['g', 'Df'], msB = s['g', 'Mean Sq'],
  f = s['g', 'F value'], p = s['g', 'Pr(>F)'], eta2 = eta2,
  ssW = s['Residuals', 'Sum Sq'], dfW = s['Residuals', 'Df'], msW = s['Residuals', 'Mean Sq'],
  levene = lev, shapiro = sh, posthoc = ph)`

// Means plot with t-based 95% CI error bars (card figure; no Hmisc — computed in R).
const R_FIGURE = String.raw`
gf <- factor(g)
agg <- data.frame(g = levels(gf), m = as.numeric(tapply(y, gf, mean)))
n <- as.numeric(tapply(y, gf, length)); sdv <- as.numeric(tapply(y, gf, sd))
se <- sdv / sqrt(n); tq <- qt(0.975, n - 1)
agg$lo <- agg$m - tq * se; agg$hi <- agg$m + tq * se
print(ggplot2::ggplot(agg, ggplot2::aes(g, m)) +
  ggplot2::geom_pointrange(ggplot2::aes(ymin = lo, ymax = hi), colour = '#0c447c') +
  ggplot2::labs(x = NULL, y = NULL))`

export async function runOneWayAnova(engine: Engine, data: Dataset, outcome: string, factor: string,
  posthocChoice: string): Promise<OneWayAnovaResult> {
  const rows = data.rows.filter((r) =>
    typeof r[outcome] === 'number' && Number.isFinite(r[outcome] as number) && r[factor] != null && String(r[factor]).trim() !== '')
  const nExcluded = data.rows.length - rows.length
  const adjust = ({ 'Tukey HSD': 'tukey', 'Bonferroni': 'bonferroni', 'Scheffé': 'scheffe' } as Record<string, string>)[posthocChoice] ?? 'tukey'
  const env = { y: rows.map((r) => r[outcome] as number), g: rows.map((r) => String(r[factor])), adjust }
  const s = await engine.runJson<Omit<OneWayAnovaResult, 'nExcluded' | 'figurePng'>>(`${POSTHOC_EMM_R}\n${R_STATS}`, env)
  const figurePng = await engine.capturePlot(R_FIGURE, 600, 450, env)
  return { ...s, nExcluded, figurePng }
}
```

- [ ] **Step 4: Stats engine test (spike known answers)**

`src/lib/stats/oneWayAnova.test.ts` — Task 2 scaffold; one run per adjust where needed:
```ts
const res = await runOneWayAnova(engine, loadAnovaFixture(), 'outcome', 'group', 'Tukey HSD')
expect(res.f).toBeCloseTo(2.80500665877123, 6)
expect(res.dfB).toBe(2); expect(res.dfW).toBe(57)
expect(res.p).toBeCloseTo(0.0688787403297547, 6)
expect(res.eta2).toBeCloseTo(0.0896024935993843, 6)
expect(res.levene.F!).toBeCloseTo(0.0224210736545674, 6)
expect(res.levene.p!).toBeCloseTo(0.977837029926746, 6)
expect(res.shapiro.W).not.toBeNull() // value asserted loosely: 0 < W <= 1
expect(res.desc).toHaveLength(3)
expect(res.desc[0]).toMatchObject({ group: 'control', n: 20 })
const ph = res.posthoc.find((x) => x.pair === 'control - drug_a')!
expect(ph.pAdj).toBeCloseTo(0.828376280197589, 6)
expect(res.nExcluded).toBe(0)
expect(res.figurePng.length).toBeGreaterThan(1000)
// second engine call: posthocChoice 'Scheffé' → that pair pAdj 0.842874697999946 (closeTo 6)
```

- [ ] **Step 5: Builder**

`src/lib/results/buildOneWayAnova.ts`:
```ts
import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { OneWayAnovaResult } from '../stats/oneWayAnova'
import type { CardContent } from './builders'
import { f, fdf, fp, fx } from '../format/apa'
import { posthocTableRows } from '../stats/posthoc'

export function buildOneWayAnova(spec: TestSpec, r: OneWayAnovaResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{df1}', fdf(r.dfB)).replace('{df2}', fdf(r.dfW)).replace('{f}', f(r.f))
    .replace('p={p}', r.p < 0.001 ? 'p<.001' : `p=${fp(r.p)}`)
    .replace('{eta2}', f(r.eta2))
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: r.desc.map((g) => ({ group: g.group, n: g.n, m: f(g.m), sd: f(g.sd) })) },
      { spec: spec.tables[1], rows: [
        { source: 'Between', ss: f(r.ssB), df: fdf(r.dfB), ms: f(r.msB), f: f(r.f), p: fp(r.p), eta2: f(r.eta2) },
        { source: 'Within', ss: f(r.ssW), df: fdf(r.dfW), ms: f(r.msW), f: '', p: '', eta2: '' }, // card draws empty cells
      ] },
      { spec: spec.tables[2], rows: posthocTableRows(r.posthoc, { f, fp }) },
    ],
    note: { kind: 'assume', text: `${spec.tableNote!.text} (Levene F=${fx(r.levene.F, f)}, p=${fx(r.levene.p, fp)} · Shapiro W=${fx(r.shapiro.W, f)}, p=${fx(r.shapiro.p, fp)})${r.levene.p != null && r.levene.p < 0.05 ? " — equal variances look doubtful; consider Welch's ANOVA" : ''}` }, // design §4.4: suggest, never auto-switch
    figures: [{ caption: fig.caption, type: fig.type, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
```

- [ ] **Step 6: Builder test (pure)**

`src/lib/results/buildOneWayAnova.test.ts`: hand-build an `OneWayAnovaResult` with the spike numbers (figurePng `new Uint8Array(1)`), call the builder with `ONE_WAY_ANOVA`, assert: Table 2 row 0 equals `{ source: 'Between', ss: …, df: '2', ms: …, f: '2.81', p: '.069', eta2: '0.09' }`, Within row has `f: ''`; APA string equals `'A one-way ANOVA found an effect of group, F(2,57)=2.81, p=.069, η²=0.09. Tukey post-hoc tests showed…'`; note ends with the computed parenthetical; posthoc row renders `ci: '[−7.00, 4.26]'` (U+2212 via f()).

- [ ] **Step 7: Suites green + mutation check + commit (common rules)**

---

### Task 6: Welch's ANOVA

**Files:** `src/lib/registry/welchAnova.ts` + consistency, `src/lib/stats/welchAnova.ts` + test, `src/lib/results/buildWelchAnova.ts` + test (id `welch-anova`, name `Welch's ANOVA`).

- [ ] **Step 1: Registry** — exemplar shape with:
- question `'3+ groups, unequal variances'`
- roles: outcome as exemplar; factor `{ id: 'factor', label: 'Factor', levels: 'nominal / ordinal', arity: 'exactly 1 · 3+ categories', hint: 'e.g. a grouping label — teaching method' }`; constraints as exemplar (categories min 3), minRule rows-per-group 3.
- options: alpha display; `{ id: 'posthoc', label: 'post-hoc', value: 'Games-Howell', kind: 'display' }` (locked — no choices drawn).
- tables: `descriptives` (Group/N/M/SD as exemplar, domId `welch-anova-descriptives`) · `welch-anova` title `"Welch's ANOVA"` columns `[{f:'F'},{df1:'df1'},{df2:'df2'},{p:'p'}]` · `posthoc` title `'Games-Howell post-hoc'` columns `[Pair, {label:'M',sub:'diff'}, {label:'p',sub:'adj'}, '95% CI']` — NO SE column (card-drawn).
- tableNote `{ kind: 'plain', text: "Welch's adjusts the degrees of freedom so equal variances are not assumed (df2 is fractional)." }`
- figures `[{ caption: 'Group means', type: 'means plot with 95% CI error bars' }]`
- howToRead: `'A one-way ANOVA that relaxes the equal-variance assumption but still assumes roughly normal data within each group. A significant F means at least one group mean differs from the others; the Games-Howell post-hoc (also variance-robust) then shows which specific pairs differ.'`
- apaTemplate: `"Welch's ANOVA found an effect of group, F({df1},{df2})={f}, p={p}."`
- rMap: `'oneway.test(var.equal=FALSE) → Table 2 · rstatix::games_howell_test() → Table 3'`
- bundleFiles: `['table_descriptives.png', 'table_welch-anova.png', 'table_posthoc.png', 'figure_means-plot.png']`
- Consistency anchors: outputs `"Welch's ANOVA</span>"` → `'ANCOVA</span>'`; inputs `'<div class="ttl">Welch\'s ANOVA</div>'` → `'<div class="ttl">ANCOVA</div>'`. Note kind PLAIN (assert no `tbl-note assume` in card scope).

- [ ] **Step 2: Stats** — R block:
```r
gf <- factor(g)
res <- oneway.test(y ~ gf, var.equal = FALSE)
desc <- lapply(levels(gf), function(l) { v <- y[gf == l]; list(group = l, n = length(v), m = mean(v), sd = sd(v)) })
gh <- rstatix::games_howell_test(data.frame(y = y, g = gf), y ~ g)
ph <- lapply(seq_len(nrow(gh)), function(i) list(pair = paste(gh$group1[i], '-', gh$group2[i]),
  diff = gh$estimate[i], pAdj = gh$p.adj[i], ciLo = gh$conf.low[i], ciHi = gh$conf.high[i]))
list(desc = desc, f = unname(res$statistic), df1 = unname(res$parameter[1]), df2 = unname(res$parameter[2]),
  p = res$p.value, posthoc = ph)
```
Figure: the exemplar's `R_FIGURE` verbatim. Result type: `WelchAnovaResult { desc; f; df1; df2; p; posthoc: { pair; diff; pAdj; ciLo; ciHi }[]; nExcluded; figurePng }`. Listwise as exemplar. NOTE: rstatix p.adj is ROUNDED (spike fact) — assert the rounded value.
**Known answers:** F 2.57990466333335 · df1 2 · df2 37.9023295774865 · p 0.0890313047549131 · GH control–drug_a: estimate 1.37, ciLo −4.1779984409316, ciHi 6.9179984409316, p.adj 0.82.

- [ ] **Step 3: Builder** — Welch table row `{ f: f(r.f), df1: fdf(r.df1), df2: fdf(r.df2), p: fp(r.p) }` (df2 renders '37.90'); posthoc rows `{ pair, mdiff: f(diff), padj: fp(pAdj), ci: '[lo, hi]' }`; APA `F(2,37.90)=2.58, p=.089`; note = card plain text verbatim (NO computed append — this card runs no checks). Builder test asserts those strings.

- [ ] **Step 4: Suites + mutation + commit (common rules).**

---

### Task 7: Kruskal-Wallis

**Files:** `src/lib/registry/kruskalWallis.ts` + consistency, `src/lib/stats/kruskalWallis.ts` + test, `src/lib/results/buildKruskalWallis.ts` + test (id `kruskal-wallis`, name `Kruskal-Wallis`).

- [ ] **Step 1: Registry** —
- question `'nonparametric 3+ group comparison'`
- roles: `{ id: 'outcome', label: 'Outcome', levels: 'ordinal / interval / ratio', arity: 'exactly 1', hint: 'e.g. the numeric result you measured — test score, income' }` · `{ id: 'group', label: 'Grouping var', levels: 'nominal / ordinal', arity: 'exactly 1 · 3+ categories', hint: 'e.g. label splitting cases into 3+ groups — teaching method' }`; constraints: outcome levels `['ordinal','interval','ratio']`, group categories `{ min: 3 }`; minRule rows-per-group 3.
- options: alpha display · `{ id: 'posthoc', label: 'post-hoc', value: "Dunn's test", kind: 'display' }`.
- tables: `rank-summary` domId `kruskal-wallis-rank-summary` title `'Rank summary'` columns `[Group, N, 'Mean rank']` (keys group/n/meanRank) · `kruskal-wallis` title `'Kruskal-Wallis test'` columns `[{h:'H'},{df:'df'},{p:'p'},{eps2:'ε²'}]` · `posthoc` domId `kruskal-wallis-posthoc` title `'Dunn post-hoc'` columns `[Pair, Z, {label:'p',sub:'adj'}]` (keys pair/z/padj).
- NO tableNote (card has none — assert absence like Wilcoxon does).
- figures `[{ caption: 'Distribution by group', type: 'boxplot' }]`
- howToRead: `'The nonparametric counterpart to one-way ANOVA. The H/p tests whether any group tends to have systematically higher or lower values (stochastic dominance) — read it as a "median difference" only when the groups have similar distribution shapes. If significant, Dunn\'s post-hoc shows which pairs differ, with adjusted p-values. ε² is the effect size.'`
- apaTemplate: `'A Kruskal-Wallis test found a difference, H({df})={h}, p={p}, ε²={eps2}.'`
- rMap: `'kruskal.test() → H, df, p · rstatix::kruskal_effsize() / effectsize::rank_epsilon_squared() → ε² · dunn.test/FSA::dunnTest() → Table 3'`
- bundleFiles: `['table_rank-summary.png', 'table_kruskal-wallis.png', 'table_posthoc.png', 'figure_boxplot.png']`
- Consistency anchors: outputs `'Kruskal-Wallis</span>'` → `'Friedman</span>'`; inputs `'<div class="ttl">Kruskal-Wallis</div>'` → `'<div class="ttl">Friedman</div>'`. Quote nuance: the how-to-read contains typographic quotes around “median difference” in the HTML — transcribe EXACTLY what `strip()` yields (run the test to see; the decode list in specHtml handles &ldquo;/&rdquo; only if present — check `strip`'s decode table first and transcribe to match).
- [ ] **Step 2: Stats** — R block:
```r
gf <- factor(g)
kw <- kruskal.test(y ~ gf)
rk <- rank(y)
ranks <- lapply(levels(gf), function(l) { v <- rk[gf == l]; list(group = l, n = length(v), meanRank = mean(v)) })
n <- length(y); h <- unname(kw$statistic)
eps2 <- h * (n + 1) / (n^2 - 1)  # ≡ effectsize::rank_epsilon_squared (spike-proven)
dn <- rstatix::dunn_test(data.frame(y = y, g = gf), y ~ g, p.adjust.method = 'holm')
ph <- lapply(seq_len(nrow(dn)), function(i) list(pair = paste(dn$group1[i], '-', dn$group2[i]),
  z = dn$statistic[i], pAdj = dn$p.adj[i]))
list(ranks = ranks, h = h, df = unname(kw$parameter), p = kw$p.value, eps2 = eps2, posthoc = ph)
```
Figure: the Mann-Whitney boxplot recipe verbatim (same colours). Listwise as exemplar.
**Known answers:** H 6.56495733622387 · df 2 · p 0.0375351043416359 · ε² 0.111270463325828 · mean ranks control 24.9 / drug_a 28.15 / drug_b 38.45 · Dunn rows (holm): control–drug_a z 0.588572301903464 p 0.556148218919164 · control–drug_b z 2.4538937510129 p 0.0423956188352741 · drug_a–drug_b z 1.86532144910944 p 0.124272720791776.
- [ ] **Step 3: Builder** — rank rows `{ group, n, meanRank: f(...) }`; KW row `{ h: f(h), df: fdf(df), p: fp(p), eps2: f(eps2) }`; Dunn rows `{ pair, z: f(z), padj: fp(pAdj) }`; APA `H(2)=6.56, p=.038, ε²=0.11`; note null. Builder test asserts those.
- [ ] **Step 4: Suites + mutation + commit (common rules).**

---

### Task 8: Factorial ANOVA

**Files:** `src/lib/registry/factorialAnova.ts` + consistency, `src/lib/stats/factorialAnova.ts` + test, `src/lib/results/buildFactorialAnova.ts` + test (id `factorial-anova`).

- [ ] **Step 1: Registry** —
- question `'main effects + interaction of 2+ factors'`
- roles: outcome as exemplar · `{ id: 'factors', label: 'Factors', levels: 'nominal / ordinal', arity: 'two or more', hint: 'e.g. grouping labels — method, gender' }`; constraints: factors `arity { min: 2, max: Infinity }`; minRule rows-per-group 3 (DRAFT — outcome × each factor candidate).
- options: alpha display · `{ id: 'interactions', label: 'interactions', value: 'on', kind: 'toggle', default: true }` · `{ id: 'posthoc', label: 'post-hoc', value: 'Tukey', kind: 'display' }` · CI display.
- tables: `cell-descriptives` title `'Cell descriptives'` columns `[{cell:'Factor A × B'}, N, M, SD]` · `anova` title `'ANOVA (main effects + interaction)'` columns `[Source, SS, df, MS, F, p, {pes:'partial η²'}]` · `simple-effects` title `'Simple effects / post-hoc'` columns `[{contrast:'Contrast'}, {label:'M',sub:'diff'}, SE, {label:'p',sub:'adj'}, '95% CI']`. domIds `factorial-anova-*`.
- tableNote assume: `"assumption checks: Levene's & normality of residuals; post-hoc / simple-effects table when an effect is significant."`
- figures `[{ caption: 'Interaction', type: 'interaction plot (one line per level of a factor)' }]`
- howToRead: `"Each factor's F/p is its main effect; the A×B row tests whether the effect of one factor depends on the other. A significant interaction usually takes priority — read it from the interaction plot before the main effects. A significant effect for any factor with 3+ levels tells you the levels differ somewhere, not which ones — use the post-hoc / simple-effects (emmeans) table to find the specific pairs."`
- apaTemplate: `'A two-way ANOVA found a significant A×B interaction, F({df1},{df2})={f}, p={p}, partial η²={pes}.'`
- rMap: `'aov() / afex::aov_car() → Table 2 · emmeans → Table 3 · ggplot2 → interaction plot'`
- bundleFiles: `['table_cell-descriptives.png', 'table_anova.png', 'table_simple-effects.png', 'figure_interaction.png']`
- Anchors: outputs `'Factorial ANOVA</span>'` → `'Repeated-measures ANOVA</span>'`; inputs ttl `Factorial ANOVA` → ttl `Repeated-measures ANOVA`.

- [ ] **Step 2: Stats** — env passes `y`, `fvals_flat` (k·n factor values, factor-major), `fnames` (slot order), `n`, `interactions` (bool). R core:
```r
k <- length(fnames)
d <- data.frame(.sid = factor(seq_len(n)), y = y)
for (i in seq_len(k)) d[[fnames[i]]] <- factor(fvals_flat[((i - 1) * n + 1):(i * n)])
rhs <- paste(fnames, collapse = if (interactions) ' * ' else ' + ')
m <- suppressWarnings(suppressMessages(afex::aov_car(
  as.formula(paste('y ~', rhs, '+ Error(.sid)')), data = d, anova_table = list(es = 'pes'))))
at <- m$anova_table
a3 <- m$Anova; ssr <- a3['Residuals', 'Sum Sq']
rows <- lapply(rownames(at), function(t) list(
  source = gsub(':', ' × ', t), ss = a3[t, 'Sum Sq'], df = at[t, 'num Df'],
  ms = a3[t, 'Sum Sq'] / at[t, 'num Df'], f = at[t, 'F'], p = at[t, 'Pr(>F)'], pes = at[t, 'pes']))
cell <- interaction(d[fnames], sep = ' × ')
desc <- lapply(levels(cell), function(l) { v <- y[cell == l]; list(cell = l, n = length(v), m = mean(v), sd = sd(v)) })
lev <- tryCatch({ ls <- summary(aov(abs(y - ave(y, cell, FUN = median)) ~ cell))[[1]]
  list(F = ls[1, 'F value'], p = ls[1, 'Pr(>F)']) }, error = function(e) list(F = NULL, p = NULL))
sh <- tryCatch({ t <- shapiro.test(residuals(m$lm)); list(W = unname(t$statistic), p = t$p.value) },
  error = function(e) list(W = NULL, p = NULL))
# Simple effects: ALWAYS computed; the BUILDER filters by term significance (recorded decision 2).
se_rows <- list()
for (fn in fnames) {
  e <- .telos_posthoc(emmeans::emmeans(m, as.formula(paste('~', fn))), 'tukey')
  se_rows <- c(se_rows, lapply(e, function(r) { r$term <- fn; r }))
}
if (interactions && k >= 2) {
  emm2 <- emmeans::emmeans(m, as.formula(paste('~', fnames[1], '|', fnames[2])))
  s2 <- summary(pairs(emm2, adjust = 'bonferroni'), infer = TRUE)
  by2 <- as.character(s2[[fnames[2]]])
  se_rows <- c(se_rows, lapply(seq_len(nrow(s2)), function(i) list(
    pair = paste0(as.character(s2$contrast[i]), ' | ', by2[i]), diff = s2$estimate[i], se = s2$SE[i],
    pAdj = s2$p.value[i], ciLo = s2$lower.CL[i], ciHi = s2$upper.CL[i],
    term = paste(fnames[1], '×', fnames[2]))))
}
list(rows = rows, desc = desc, levene = lev, shapiro = sh, simpleEffects = se_rows)
```
(Prepend `POSTHOC_EMM_R`.) Result type carries `rows: {source,ss,df,ms,f,p,pes}[]`, `simpleEffects: (PosthocRow & {term:string})[]`. Figure (first two factors; facet by any remaining):
```r
a <- factor(fvals_flat[1:n]); b <- factor(fvals_flat[(n + 1):(2 * n)])
agg <- aggregate(list(m = y), by = list(a = a, b = b), FUN = mean)
print(ggplot2::ggplot(agg, ggplot2::aes(a, m, group = b, colour = b)) +
  ggplot2::geom_line() + ggplot2::geom_point() +
  ggplot2::labs(x = NULL, y = NULL, colour = fnames[2]))
```
**Known answers** (afex Type III, fixture `outcome ~ group * gender`): group F 3.04188224848381 df 2/54 p 0.0560001080368759 pes 0.101254715777249 · gender F 2.84368260584025 df 1/54 p 0.097503832286258 pes 0.050026361338315 · group × gender F 2.48491031233834 df 2/54 p 0.0928168303408816 pes 0.0842773569943164 · assert `ms ≈ ss/df` per row and ss > 0 · simple-effects row `'control - drug_a | f'`: diff −3.55000000000001, se 3.17721634512094, pAdj 0.806399369392838, ciLo −11.4004190074112, ciHi 4.30041900741119 · marginal tukey rows present (3 group pairs + 1 gender pair) with finite values · desc has 6 cells, each n 10.

- [ ] **Step 3: Builder** — Table 2 rows from `rows` (f/fdf/fp formatting; pes via f). Table 3 (decision 2): include marginal rows of factor X only if X's table row p < .05; include interaction rows only if the interaction row p < .05; if no rows survive, OMIT the table entirely (slice `tables` to 2). On the fixture nothing is significant → builder test asserts Table 3 absent; a second builder-test case feeds a doctored result (interaction p .01) and asserts only interaction rows render. APA from the interaction row: `F(2,54)=2.48, p=.093, partial η²=0.08`. Note = card note + ` (Levene F=…, p=… · Shapiro W=…, p=…)`.

- [ ] **Step 4: Suites + mutation + commit (common rules).**

---

### Task 9: Repeated-measures ANOVA

**Files:** `src/lib/registry/repeatedMeasuresAnova.ts` + consistency, `src/lib/stats/repeatedMeasuresAnova.ts` + test, `src/lib/results/buildRepeatedMeasuresAnova.ts` + test (id `repeated-measures-anova`).

- [ ] **Step 1: Registry** —
- question `'3+ conditions on the same subjects'`
- roles: `{ id: 'subject', label: 'Subject ID', levels: 'any level', arity: 'exactly 1', hint: 'e.g. the column identifying each person — participant_id' }` · `{ id: 'measures', label: 'Repeated measures', levels: 'interval / ratio', arity: '2 or more', hint: 'e.g. same measure each time — score_t1, score_t2, score_t3' }`
- constraints: subject `levels: ['nominal','ordinal','interval','ratio'], arity {1,1}` (recorded decision 3) · measures `['interval','ratio'], arity {2,Infinity}` · minRule `{ kind: 'complete-wide-rows', n: 3 }`.
- options: alpha display · `{ id: 'sphericity', label: 'sphericity', value: 'GG correction', kind: 'select', choices: ['GG correction', 'HF correction', 'none'] }` · `{ id: 'posthoc', label: 'post-hoc', value: 'on', kind: 'toggle', default: true }`.
- tables (domIds `repeated-measures-anova-*`): `descriptives` title `'Condition descriptives'` columns `[{condition:'Condition'}, N, M, SD]` · `rm-anova` title `'Repeated-measures ANOVA'` columns `[Source, SS, df, MS, F, p, {pes:'partial η²'}]` · `sphericity` title `"Sphericity (Mauchly's test)"` columns `[{effect:'Effect'}, {w:'W'}, {p:'p'}, {gg:'GG ε'}, {hf:'HF ε'}]` · `posthoc` title `'Post-hoc comparisons'` columns `[Pair, {label:'M',sub:'diff'}, SE, {label:'p',sub:'adj'}, '95% CI']`.
- tableNote assume: `"when sphericity is violated the F-test uses the Greenhouse–Geisser / Huynh–Feldt correction; post-hoc table follows. Mauchly's test & the GG/HF corrections apply only when the repeated factor has 3+ levels (with 2 levels sphericity is automatically met and this table is omitted)."`
- figures `[{ caption: 'Means across conditions', type: 'profile plot (means ± CI across conditions)' }]`
- howToRead: `'Tests whether the average differs across conditions measured on the same people. Check sphericity first — if violated, read the corrected F/p. A significant result means conditions differ; post-hoc tests show which.'`
- apaTemplate: `'A repeated-measures ANOVA (GG-corrected) found an effect of condition, F({df1},{df2})={f}, p={p}, partial η²={pes}.'`
- rMap: `'dplyr::group_by()+summarise() → Table 1 (per-condition N/M/SD) · afex::aov_ez() → Tables 2–3 · emmeans → Table 4 (post-hoc) · ggplot2 → profile plot'`
- bundleFiles: `['table_descriptives.png', 'table_rm-anova.png', 'table_sphericity.png', 'table_posthoc.png', 'figure_profile.png']`
- Anchors: outputs `'Repeated-measures ANOVA</span>'` → `'Mixed ANOVA</span>'`; inputs ttl `Repeated-measures ANOVA` → ttl `Mixed ANOVA`. Inputs greyed/palette text is NOT asserted (no test asserts palettes — slots/options only, exemplar pattern).

- [ ] **Step 2: Stats** — listwise: keep rows where subject non-blank AND every chosen measure is numeric-finite. env `sid`, `conds` (measure column names, slot order), `scores_flat` (condition-major), `n`, `correction` ('GG'|'HF'|'none' — TS maps the select value), `posthocOn`. R core (prepend `POSTHOC_EMM_R` + `SPHERICITY_R`):
```r
long <- data.frame(sid = factor(rep(sid, length(conds))),
  condition = factor(rep(conds, each = n), levels = conds), score = scores_flat)
m <- suppressWarnings(suppressMessages(afex::aov_ez(id = 'sid', dv = 'score', data = long,
  within = 'condition', anova_table = list(es = 'pes', correction = correction))))
at <- m$anova_table
u <- summary(m$Anova, multivariate = FALSE)$univariate.tests
ss <- u['condition', 'Sum Sq']
anova_row <- list(source = 'Condition', ss = ss, df1 = at['condition', 'num Df'], df2 = at['condition', 'den Df'],
  ms = ss / at['condition', 'num Df'], f = at['condition', 'F'], p = at['condition', 'Pr(>F)'], pes = at['condition', 'pes'])
spher <- .telos_sphericity(m)
desc <- lapply(conds, function(cn) { v <- long$score[long$condition == cn]; list(condition = cn, n = length(v), m = mean(v), sd = sd(v)) })
ph <- if (posthocOn) .telos_posthoc(emmeans::emmeans(m, ~condition), 'bonferroni') else list()
list(anova = anova_row, sphericity = spher, desc = desc, posthoc = ph)
```
Figure (in the same env):
```r
mat <- matrix(scores_flat, ncol = length(conds))
mm <- colMeans(mat); sdv <- apply(mat, 2, sd); se <- sdv / sqrt(nrow(mat)); tq <- qt(0.975, nrow(mat) - 1)
agg <- data.frame(cond = factor(conds, levels = conds), m = mm, lo = mm - tq * se, hi = mm + tq * se)
print(ggplot2::ggplot(agg, ggplot2::aes(cond, m, group = 1)) + ggplot2::geom_line(colour = '#0c447c') +
  ggplot2::geom_pointrange(ggplot2::aes(ymin = lo, ymax = hi), colour = '#0c447c') + ggplot2::labs(x = NULL, y = NULL))
```
**Known answers** (3 measures, GG): F 78.5112991613406 · displayed df1 1.77543544965388 (= 2 × GG ε), df2 104.750691529579 · p 3.57330988681511e-20 · pes 0.570944348865645 · with correction 'none': df 2/118, p 2.08115277471139e-22 · sphericity row: W 0.873515789948938, p 0.0198085203154266, GG ε 0.88771772482694, HF ε 0.913297705282412 · posthoc `'t1 - t2'`-style pair (emmeans uses the column names: `'score_t1 - score_t2'`): diff −2.86333333333332, se 0.419866582701343, pAdj 1.63816152413875e-08, ciLo −3.8979494382861, ciHi −1.82871722838054 · 2-measure run: `sphericity` empty array · desc n 60 each.

- [ ] **Step 3: Builder** — Table 2 single row (df via fdf → '1.78'/'104.75' under GG); sphericity table only when rows non-empty; posthoc table only when toggle produced rows; APA `F(1.78,104.75)=78.51, p<.001, partial η²=0.57`. Builder test asserts those + the 2-level case omits the sphericity table (3 tables, bundle-consistent).

- [ ] **Step 4: Suites + mutation + commit (common rules).**

---

### Task 10: Mixed ANOVA

**Files:** `src/lib/registry/mixedAnova.ts` + consistency, `src/lib/stats/mixedAnova.ts` + test, `src/lib/results/buildMixedAnova.ts` + test (id `mixed-anova`).

- [ ] **Step 1: Registry** — transcribe from the NEW card (committed `42526c1`):
- question `'between-groups × repeated conditions'`
- roles: subject (as Task 9) · `{ id: 'between', label: 'Between-groups factor', levels: 'nominal / ordinal', arity: 'exactly 1', hint: 'e.g. the column splitting people into groups — treatment vs control' }` · measures (as Task 9).
- constraints: subject all-four-levels {1,1} · between `['nominal','ordinal']` {1,1} · measures `['interval','ratio']` {2,∞} · minRule `complete-wide-rows` 3.
- options: alpha display · sphericity select (as Task 9) · posthoc toggle on.
- tables (domIds `mixed-anova-*`): `descriptives` title `'Descriptives by group × condition'` columns `[Group, Condition, N, M, SD]` · `mixed-anova` title `'Mixed ANOVA'` columns `[Source, SS, df, MS, F, p, {pes:'partial η²'}]` · `sphericity` (exact Task 9 shape) · `posthoc` title `'Post-hoc comparisons (condition pairs)'` columns `[Pair, {label:'M',sub:'diff'}, SE, {label:'p',sub:'adj'}, '95% CI']`.
- tableNote assume: `"between and within effects are tested against different error terms; when sphericity is violated the within and interaction F-tests use the Greenhouse–Geisser / Huynh–Feldt correction. Mauchly's test & the GG/HF corrections apply only when the repeated factor has 3+ levels (with 2 levels sphericity is automatically met and this table is omitted)."`
- figures `[{ caption: 'Means across conditions by group', type: 'profile plot (one line per group, means ± CI across conditions)' }]`
- howToRead: `"Read the Group × Condition interaction first — a significant interaction means the groups changed differently across conditions; only then read the main effects. Check sphericity for the within and interaction terms — if violated, read the corrected F/p. When the group × condition interaction is significant, the overall condition comparisons in the post-hoc table can mislead — read each group's line on the profile plot instead."`
- apaTemplate: `'A mixed ANOVA found a significant group × time interaction, F({df1},{df2})={f}, p={p}, partial η²={pes}.'`
- rMap: `'dplyr::group_by()+summarise() → Table 1 (group × condition N/M/SD) · afex::aov_ez() → Tables 2–3 · emmeans → Table 4 (post-hoc) · ggplot2 → profile plot'`
- bundleFiles: `['table_descriptives.png', 'table_mixed-anova.png', 'table_sphericity.png', 'table_posthoc.png', 'figure_profile.png']`
- Anchors: outputs `'Mixed ANOVA</span>'` → `'Nested ANOVA</span>'`; inputs ttl `Mixed ANOVA` → ttl `Nested ANOVA`.

- [ ] **Step 2: Stats** — listwise: subject + between non-blank + all measures numeric. afex `aov_ez(id, dv, between = 'grp', within = 'condition', anova_table = list(es='pes', correction))` on the long frame (Task 9 reshape + `grp` column repeated). Three rows from `anova_table` (between row df/p never corrected — afex handles), labels: `` `${betweenName} (between)` ``, `'Condition (within)'`, `` `${betweenName} × Condition` ``; SS per row from `univariate.tests` (`'grp'`, `'condition'`, `'grp:condition'` — match by rowname). Sphericity via `.telos_sphericity` (rows: condition + interaction). Posthoc: condition pairs bonferroni (as Task 9). Descriptives: group × condition cells. Levene (recorded decision 9 — Levene on per-subject means across the chosen measures, by group; hand-rolled BF): appended to the note as `(Levene on subject means F=…, p=…)`.
**Known answers** (GG): group F 0.24690089648661 p 0.782049251682351 pes 0.00858878309615581 df 2/57 · condition F 82.5610819498742 p(GG) 1.51705412973608e-19 pes 0.591576683100862, displayed df 1.67166869889464 / 95.2851158369946 (= GG ε × 2 / × 114) · interaction F 2.52167386781147 p(GG) 0.0561473099306867 pes 0.0812874855998016, df 3.34333739778929 / 95.2851158369946 · Mauchly W 0.803590686765588 p 0.00219268908877968 GG ε 0.835834349447321 · posthoc `'score_t1 - score_t2'`: diff −2.86333333333332, se 0.420150001061303, pAdj 1.9397562305748e-08, ciLo −3.89971187769057, ciHi −1.82695478897608 · desc 9 cells (3 groups × 3 conditions) n 20.

- [ ] **Step 3: Builder** — Table 2 three rows; APA from the INTERACTION row (`F(3.34,95.29)=2.52, p=.056, partial η²=0.08`); sphericity/posthoc table omission rules as Task 9. Figure: one line per group:
```r
mat <- matrix(scores_flat, ncol = length(conds)); g <- factor(grp)
agg <- do.call(rbind, lapply(levels(g), function(l) {
  sub <- mat[g == l, , drop = FALSE]; mm <- colMeans(sub); se <- apply(sub, 2, sd) / sqrt(nrow(sub))
  tq <- qt(0.975, nrow(sub) - 1)
  data.frame(grp = l, cond = factor(conds, levels = conds), m = mm, lo = mm - tq * se, hi = mm + tq * se) }))
print(ggplot2::ggplot(agg, ggplot2::aes(cond, m, group = grp, colour = grp)) + ggplot2::geom_line() +
  ggplot2::geom_pointrange(ggplot2::aes(ymin = lo, ymax = hi)) + ggplot2::labs(x = NULL, y = NULL, colour = NULL))
```

- [ ] **Step 4: Suites + mutation + commit (common rules).**

---

### Task 11: Nested ANOVA

**Files:** `src/lib/registry/nestedAnova.ts` + consistency, `src/lib/stats/nestedAnova.ts` + test, `src/lib/results/buildNestedAnova.ts` + test (id `nested-anova`).

- [ ] **Step 1: Registry** —
- question `'one factor nested within another'`
- roles: outcome (exemplar) · `{ id: 'factor', label: 'Factor', levels: 'nominal / ordinal', arity: 'exactly 1', hint: 'e.g. a grouping label — teaching method' }` · `{ id: 'nested', label: 'Nested factor', levels: 'nominal / ordinal', arity: 'exactly 1 · within Factor', hint: 'e.g. a sub-group inside the factor — classroom within school' }`
- constraints: both factor roles `['nominal','ordinal']` {1,1} (the "within Factor" phrase is arity TEXT; enforcement is the crossed-data warning, design §5.4) · minRule rows-per-group 3 (outcome × factor).
- options: alpha display · `{ id: 'nesting', label: 'nesting', value: 'random', kind: 'select', choices: ['random', 'fixed'] }`.
- tables: ONE — `{ id: 'nested-anova', domId: 'nested-anova-nested-anova', title: 'Nested ANOVA', captionStyle: 'bare', columns: [Source, SS, df, MS, F, p, {omega2:'ω²'}] }` (the card draws bare `Table.` — assert `captionStyle === 'bare'` like Summary's test does).
- tableNote PLAIN: `"under random nesting the F for the upper factor (A) uses the nested factor's mean square B(A) as its error term, while B(A) is tested against the residual — so the two F rows do not share the same denominator. Variance components (or ω²) are reported as the effect size where estimable."`
- figures `[{ caption: 'Grouped means', type: 'grouped means plot (nested groups within each top-level group)' }]`
- howToRead: `'Used when one factor sits inside another (e.g. classes within schools). The top factor is tested against variation among its nested units, not raw residuals — a significant F means the top-level groups differ beyond the nested-unit variability.'`
- apaTemplate: `'A nested ANOVA found an effect of A, F({df1},{df2})={f}, p={p}.'`
- rMap: `'aov(y ~ A + Error(A:B)) (random) / aov(y ~ A/B) (fixed) → table · effectsize::omega_squared() → effect size · ggplot2 → figure'`
- bundleFiles: `['table_nested-anova.png', 'figure_grouped-means.png']`
- Anchors: outputs `'Nested ANOVA</span>'` → `"Welch's ANOVA</span>"`; inputs ttl `Nested ANOVA` → ttl `Welch's ANOVA`.

- [ ] **Step 2: Stats** — env `y`, `a` (factor), `b` (nested), `random` (bool). R:
```r
af <- factor(a); bf <- factor(b)
m <- aov(y ~ af / bf)
s <- summary(m)[[1]]; rownames(s) <- trimws(rownames(s))
msA <- s['af', 'Mean Sq']; msB <- s['af:bf', 'Mean Sq']; msR <- s['Residuals', 'Mean Sq']
dfA <- s['af', 'Df']; dfB <- s['af:bf', 'Df']; dfR <- s['Residuals', 'Df']
fA <- if (random) msA / msB else msA / msR
pA <- pf(fA, dfA, if (random) dfB else dfR, lower.tail = FALSE)
fB <- msB / msR; pB <- pf(fB, dfB, dfR, lower.tail = FALSE)
o2 <- tryCatch(as.numeric(effectsize::omega_squared(m, partial = FALSE)$Omega2), error = function(e) c(NA, NA))
list(rows = list(
  list(source = 'A', ss = s['af', 'Sum Sq'], df = dfA, ms = msA, f = fA, p = pA, omega2 = o2[1], errDf = if (random) dfB else dfR),
  list(source = 'B', ss = s['af:bf', 'Sum Sq'], df = dfB, ms = msB, f = fB, p = pB, omega2 = o2[2], errDf = dfR)))
```
TS substitutes display labels: row A source = factor column name, row B = `` `${nested} (nested in ${factor})` ``. TS-side: `nestedLevelReuse(data, factor, nested)` (Task 4) → `crossed: string[]` in the result. Figure:
```r
cellm <- aggregate(list(m = y), by = list(a = af, b = bf), FUN = mean)
nc <- aggregate(list(n = y), by = list(a = af, b = bf), FUN = length)
sdv <- aggregate(list(s = y), by = list(a = af, b = bf), FUN = sd)
cellm$lo <- cellm$m - qt(0.975, nc$n - 1) * sdv$s / sqrt(nc$n)
cellm$hi <- cellm$m + qt(0.975, nc$n - 1) * sdv$s / sqrt(nc$n)
print(ggplot2::ggplot(cellm, ggplot2::aes(a, m, colour = b)) +
  ggplot2::geom_pointrange(ggplot2::aes(ymin = lo, ymax = hi), position = ggplot2::position_dodge(width = 0.5)) +
  ggplot2::labs(x = NULL, y = NULL, colour = NULL))
```
**Known answers** (fixture `outcome ~ school/classroom`): SS 307.069 / 311.228999999999 / 2808.716 · MS 153.5345 / 103.743 / 52.0132592592592 · RANDOM: F_school 1.4799504544885, df 2/3 (errDf 3), p 0.357127524540067 · FIXED: F_school 2.95183386287543, df 2/54, p 0.0607280510032202 · F_class 1.99454911069684, df 3/54, p 0.12570562659026 · ω² rows 0.0583618541479071 / 0.0446070727986374 · `crossed` empty on the fixture; a doctored dataset (classroom relabelled `c1/c2` in every school) yields `['c1','c2']`.

- [ ] **Step 3: Builder** — two rows (omega2 via `fx(r.omega2, f)` — em-dash when not estimable); APA from row A with its errDf: random `F(2,3)=1.48, p=.357`. Note: card plain text + (when `crossed.length`) ` — ${nested} labels repeat across ${factor} levels; results assume distinct groups within each ${factor} — check your coding` (design §5.4 wording with role names substituted). Builder test asserts both states.

- [ ] **Step 4: Suites + mutation + commit (common rules).**

---

### Task 12: ANCOVA

**Files:** `src/lib/registry/ancova.ts` + consistency, `src/lib/stats/ancova.ts` + test, `src/lib/results/buildAncova.ts` + test (id `ancova`).

- [ ] **Step 1: Registry** —
- question `'group means adjusted for a covariate'`
- roles: outcome (exemplar) · `{ id: 'factor', label: 'Factor', levels: 'nominal / ordinal', arity: 'one or more', hint: 'e.g. a grouping label — teaching method' }` `{1,∞}` · `{ id: 'covariates', label: 'Covariate(s)', levels: 'interval / ratio', arity: 'one or more', hint: 'e.g. numeric control(s) to hold constant — baseline score, age' }` `{1,∞}`
- options: alpha display · `{ id: 'posthoc', label: 'post-hoc', value: 'adjusted means', kind: 'display' }` · CI display.
- tables (domIds `ancova-*`): `adjusted-means` title `'Adjusted (estimated marginal) means'` columns `[Group, {adjm:'Adj. M'}, SE, '95% CI']` · `ancova` title `'ANCOVA'` columns `[Source, SS, df, MS, F, p, {pes:'partial η²'}]` · `posthoc` title `'Post-hoc comparisons (adjusted means)'` columns `[Pair, { key:'mdiff', label:'M', sub:'diff', suffix:' (adj.)' }, SE, {label:'p',sub:'adj'}, '95% CI']` — uses ColumnDef.suffix (Task 4); the consistency thead assertion composes `label + <sub> + suffix`.
- tableNote assume: `"assumption checks: homogeneity of regression slopes (factor×covariate interaction) & Levene's; post-hoc on adjusted means."`
- figures `[{ caption: 'Adjusted means', type: 'adjusted means plot (covariate-controlled, ± CI)' }]`
- howToRead: `"Compares group means after statistically removing the influence of a numeric covariate. First confirm the factor×covariate interaction is non-significant (homogeneity of slopes) — if it is significant, the adjusted-means interpretation is not valid and a different model is needed. Then read the Factor row's F/p for the adjusted group effect, and the adjusted means for the covariate-controlled group values."`
- apaTemplate: `'Controlling for the covariate, an ANCOVA found a group effect, F({df1},{df2})={f}, p={p}, partial η²={pes}.'`
- rMap: `'car::Anova(type=3) → Table 2 (SS/df/F/p) · effectsize::eta_squared(partial=TRUE) → partial η² · emmeans → adjusted means & Table 3 (post-hoc) · ggplot2 → figure'`
- bundleFiles: `['table_adjusted-means.png', 'table_ancova.png', 'table_posthoc.png', 'figure_adjusted-means.png']`
- Anchors: outputs `'ANCOVA</span>'` → `'MANOVA</span>'` (first occurrences are correct — ANCOVA's card precedes MANOVA's; verify with indexOf positions before trusting); inputs ttl `ANCOVA` → ttl `MANOVA`.

- [ ] **Step 2: Stats** — env: `y`, `covs_flat`+`covnames` (covariate-major), `fvals_flat`+`fnames`, `n`. Type III needs sum contrasts on every factor. R (prepend `POSTHOC_EMM_R` + `ADJMEANS_R`):
```r
d <- data.frame(y = y)
for (i in seq_along(covnames)) d[[covnames[i]]] <- covs_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(fnames)) d[[fnames[i]]] <- factor(fvals_flat[((i - 1) * n + 1):(i * n)])
ctr <- setNames(lapply(fnames, function(x) 'contr.sum'), fnames)
frhs <- paste(fnames, collapse = ' * ')
m <- lm(as.formula(paste('y ~', paste(covnames, collapse = ' + '), '+', frhs)), data = d, contrasts = ctr)
a3 <- car::Anova(m, type = 3)
pes <- effectsize::eta_squared(a3, partial = TRUE)
terms <- setdiff(rownames(a3), c('(Intercept)', 'Residuals'))
ssr <- a3['Residuals', 'Sum Sq']; dfr <- a3['Residuals', 'Df']
rows <- lapply(terms, function(t) list(source = gsub(':', ' × ', t),
  ss = a3[t, 'Sum Sq'], df = a3[t, 'Df'], ms = a3[t, 'Sum Sq'] / a3[t, 'Df'],
  f = a3[t, 'F value'], p = a3[t, 'Pr(>F)'],
  pes = pes$Eta2_partial[match(t, pes$Parameter)]))
dfres <- dfr
emm <- emmeans::emmeans(m, as.formula(paste('~', frhs)))
adj <- .telos_adjmeans(emm)
ph <- .telos_posthoc(emm, 'tukey')
mi <- lm(as.formula(paste('y ~ (', paste(covnames, collapse = ' + '), ') * (', frhs, ')')), data = d, contrasts = ctr)
ai <- car::Anova(mi, type = 3)
slope_terms <- grep(':', setdiff(rownames(ai), c('(Intercept)', 'Residuals')), value = TRUE)
slope_terms <- slope_terms[vapply(slope_terms, function(t) any(startsWith(t, paste0(covnames, ':'))) ||
  any(vapply(covnames, function(cv) grepl(cv, t, fixed = TRUE), logical(1))), logical(1))]
slopes <- lapply(slope_terms, function(t) list(term = gsub(':', ' × ', t), p = ai[t, 'Pr(>F)']))
cellf <- interaction(d[fnames], sep = ' × ')
lev <- tryCatch({ ls <- summary(aov(abs(y - ave(y, cellf, FUN = median)) ~ cellf))[[1]]
  list(F = ls[1, 'F value'], p = ls[1, 'Pr(>F)']) }, error = function(e) list(F = NULL, p = NULL))
list(rows = rows, dfRes = dfres, adjusted = adj, posthoc = ph, slopes = slopes, levene = lev)
```
Figure: pointrange of the adjusted means (`as.data.frame(emm)` → first factor on x; if 2+ factors, x = the interaction label). **Known answers** (baseline + group): covariate row F 72.2282718865225 p 1.17661542618733e-11 pes 0.563278837216507 · group row F 8.0678942699764 df 2 (dfRes 56) p 0.000833763379568619 pes 0.223686312530096 · adjusted control: 31.4221627207434 / SE 1.10991244962393 / CI [29.1987409073006, 33.6455845341862] · slopes: one term, p 0.875021940147328 · posthoc `'control - drug_a'`: diff −3.59989132599919, se 1.58175880993269, pAdj 0.0675916797250294, CI [−7.40807585588051, 0.208293203882136] · levene asserted finite only (not spiked).

- [ ] **Step 3: Builder** — Table 1 from `adjusted` (`ci: '[lo, hi]'`); Table 2 from `rows`; Table 3 `posthocTableRows`. APA from the FIRST FACTOR row + dfRes: `F(2,56)=8.07, p<.001, partial η²=0.22`. Note: card text + ` (slopes p=…${perTerm} · Levene F=…, p=…)` — one `slopes p(<term>)=` clause per slope term. Builder test asserts all three tables' first rows + APA + note.

- [ ] **Step 4: Suites + mutation + commit (common rules).**

---

### Task 13: MANOVA

**Files:** `src/lib/registry/manova.ts` + consistency, `src/lib/stats/manova.ts` + test, `src/lib/results/buildManova.ts` + test (id `manova`).

- [ ] **Step 1: Registry** —
- question `'groups compared on several outcomes at once'`
- roles: `{ id: 'outcomes', label: 'Outcomes (DVs)', levels: 'interval / ratio', arity: 'two or more', hint: 'e.g. two or more numeric outcomes — score, satisfaction' }` `{2,∞}` · `{ id: 'factors', label: 'Factor(s)', levels: 'nominal / ordinal', arity: 'one or more', hint: 'e.g. grouping labels — method, gender' }` `{1,∞}`
- options: alpha display · `{ id: 'statistic', label: 'test statistic', value: 'Pillai', kind: 'select', choices: ['Pillai', 'Wilks'] }` · `{ id: 'followups', label: 'follow-up ANOVAs', value: 'on', kind: 'toggle', default: true }`
- tables (domIds `manova-*`): `multivariate` title `'Multivariate tests'` columns `[{effect:'Effect'}, {stat:'Pillai / Wilks'}, {f:'approx F'}, df1, df2, p]` · `univariate-followups` title `'Follow-up univariate ANOVAs (per DV)'` columns `[{dv:'DV'}, F, df1, df2, p, {pes:'partial η²'}]`
- NO tableNote (card has none).
- figures `[{ caption: 'Group means per outcome', type: 'means plot faceted by DV' }]`
- howToRead: `"Tests whether groups differ on a set of outcomes jointly. Read the multivariate p (Pillai's trace is robust) first; if significant, the per-DV follow-up ANOVAs show which individual outcomes drive it. Because you run one ANOVA per outcome, correct those follow-up p-values for multiple comparisons (e.g. Bonferroni: divide alpha by the number of outcomes) before calling each significant."`
- apaTemplate: `"A MANOVA found a multivariate group effect, Pillai's V={v}, F({df1},{df2})={f}, p={p}."`
- rMap: `'manova() + summary(.., test="Pillai") → Table 1 · summary.aov() → Table 2 (F/df/p) · effectsize::eta_squared(partial=TRUE) → partial η²'`
- bundleFiles: `['table_multivariate.png', 'table_univariate-followups.png', 'figure_means.png']`
- Anchors: outputs `'MANOVA</span>'` → `'MANCOVA</span>'` (NOTE: `'MANOVA</span>'` first occurrence IS the MANOVA card — it precedes MANCOVA; verify); inputs ttl `MANOVA` → ttl `MANCOVA`.

- [ ] **Step 2: Stats** — env `dvs_flat`+`dvnames`, `fvals_flat`+`fnames`, `n`, `statistic` ('Pillai'|'Wilks'), `followups` (bool). R:
```r
d <- data.frame(row.names = seq_len(n))
for (i in seq_along(dvnames)) d[[dvnames[i]]] <- dvs_flat[((i - 1) * n + 1):(i * n)]
for (i in seq_along(fnames)) d[[fnames[i]]] <- factor(fvals_flat[((i - 1) * n + 1):(i * n)])
frhs <- paste(fnames, collapse = ' * ')
fml <- as.formula(paste('cbind(', paste(dvnames, collapse = ', '), ') ~', frhs))
m <- manova(fml, data = d)
grab <- function(test) { s <- summary(m, test = test)$stats; s[setdiff(rownames(s), 'Residuals'), , drop = FALSE] }
sc <- grab(statistic); sp <- grab('Pillai')
mv <- lapply(rownames(sc), function(t) list(effect = gsub(':', ' × ', t),
  stat = sc[t, 2], f = sc[t, 'approx F'], df1 = sc[t, 'num Df'], df2 = sc[t, 'den Df'], p = sc[t, 'Pr(>F)'],
  pillai = sp[t, 2], pillaiF = sp[t, 'approx F'], pillaiDf1 = sp[t, 'num Df'], pillaiDf2 = sp[t, 'den Df'], pillaiP = sp[t, 'Pr(>F)']))
fu <- list()
if (followups) for (dv in dvnames) {
  a <- aov(as.formula(paste(dv, '~', frhs)), data = d)
  s <- summary(a)[[1]]; rownames(s) <- trimws(rownames(s))
  terms <- setdiff(rownames(s), 'Residuals')
  for (t in terms) fu[[length(fu) + 1]] <- list(
    dv = if (length(terms) > 1) paste0(dv, ' (', gsub(':', ' × ', t), ')') else dv,
    f = s[t, 'F value'], df1 = s[t, 'Df'], df2 = s['Residuals', 'Df'], p = s[t, 'Pr(>F)'],
    pes = s[t, 'Sum Sq'] / (s[t, 'Sum Sq'] + s['Residuals', 'Sum Sq']))
}
list(multivariate = mv, followups = fu)
```
(Column 2 of `summary(manova)$stats` is the statistic value — its column NAME is the test name; index positionally.) Figure (facet by DV):
```r
gf <- factor(fvals_flat[1:n])
agg <- do.call(rbind, lapply(seq_along(dvnames), function(i) {
  v <- dvs_flat[((i - 1) * n + 1):(i * n)]
  mm <- tapply(v, gf, mean); nn <- tapply(v, gf, length); ss <- tapply(v, gf, sd)
  se <- ss / sqrt(nn); tq <- qt(0.975, nn - 1)
  data.frame(dv = dvnames[i], g = names(mm), m = as.numeric(mm),
    lo = as.numeric(mm - tq * se), hi = as.numeric(mm + tq * se)) }))
print(ggplot2::ggplot(agg, ggplot2::aes(g, m)) +
  ggplot2::geom_pointrange(ggplot2::aes(ymin = lo, ymax = hi), colour = '#0c447c') +
  ggplot2::facet_wrap(~dv, scales = 'free_y') + ggplot2::labs(x = NULL, y = NULL))
```
Listwise: all DVs numeric + all factors non-blank. **Known answers** (outcome+outcome2 ~ group): Pillai 0.285431562210818, F 4.74451724627428, df 4/114, p 0.00140868628003122 · Wilks run: stat 0.715289868403666, F 5.10678393890843, p 0.000811876083019458 (its Pillai fields still carry the Pillai numbers) · follow-ups: outcome F 2.80500665877123 df 2/57 p 0.0688787403297547 pes 0.0896024935993843 · outcome2 F 7.71055236740481 p 0.00108711814052799 · followups=false → empty.

- [ ] **Step 3: Builder** — Table 1 rows `{ effect, stat: f(stat), f: f(F), df1: fdf, df2: fdf, p: fp }`; Table 2 from followups, OMITTED entirely when toggle off (and bundle then lacks it). APA ALWAYS from the Pillai fields of the FIRST effect row (recorded decision 1): `Pillai's V=0.29, F(4,114)=4.74, p=.001`. Builder test asserts the Wilks-selected case still APAs Pillai.

- [ ] **Step 4: Suites + mutation + commit (common rules).**

---

### Task 14: MANCOVA

**Files:** `src/lib/registry/mancova.ts` + consistency, `src/lib/stats/mancova.ts` + test, `src/lib/results/buildMancova.ts` + test (id `mancova`).

- [ ] **Step 1: Registry** —
- question `'MANOVA with covariate control'`
- roles: outcomes (as Task 13) · factors (as Task 13) · covariates (as Task 12).
- options: alpha display · statistic select (as Task 13 — no followups toggle drawn on this card).
- tables (domIds `mancova-*`): `multivariate` title `'Multivariate tests (covariate-adjusted)'` columns as Task 13 Table 1 · `univariate-followups` title `'Adjusted univariate follow-ups'` columns as Task 13 Table 2.
- tableNote assume: `'assumption checks include homogeneity of regression slopes for each covariate.'`
- figures `[{ caption: 'Adjusted means per outcome', type: 'adjusted means plot faceted by DV' }]`
- howToRead: `'Like MANOVA, but group differences on the set of outcomes are assessed after controlling for one or more covariates. Interpret the univariate follow-ups only if the multivariate p is significant, and adjust them for the number of DVs (e.g. Bonferroni) to control familywise error.'`
- apaTemplate: `"A MANCOVA found a covariate-adjusted group effect, Pillai's V={v}, F({df1},{df2})={f}, p={p}."`
- rMap: `'car::Manova() → Table 1 · car::Anova() → Table 2 (F/df/p) · effectsize::eta_squared(partial=TRUE) → partial η² · emmeans → adjusted means'`
- bundleFiles: `['table_multivariate.png', 'table_univariate-followups.png', 'figure_adjusted-means.png']`
- Anchors: outputs `'MANCOVA</span>'` → `'Mann-Whitney U</span>'`; inputs ttl `MANCOVA` → ttl `Mann-Whitney U`.

- [ ] **Step 2: Stats** — **RECORDED DEVIATION (slice report + Benjie ratify):** the card's R map names `car::Manova()`, but car's `Anova.mlm`/`linearHypothesis.mlm` objects carry no programmatic stats table (only SSPH/SSPE; the statistics live in the print method — probed during plan-writing). Implementation uses sequential `stats::manova(cbind(DVs) ~ covariates + factors)` — covariates first, factor LAST, which makes the factor row IDENTICAL to car::Manova's Type II factor row (spike-proven: Pillai_group 0.367525003974141 both ways); covariate rows are sequential. Hand-rolling Pillai/Wilks/approx-F from eigenvalues was rejected as an unverified fresh error surface.
R: as Task 13's block with `fml <- cbind(DVs) ~ cov1 + cov2 + … + f1 * f2 …` and follow-ups per DV via `aov(dv ~ covs + factors)` taking the FACTOR rows only (each factor term; pes = SS/(SS+SSres)). The multivariate table reports rows for every term (covariates + factors), labels real names. Slope checks per covariate: for each DV? No — per covariate against the factor set on the FIRST DV is under-defined; use the multivariate interaction: `manova(cbind(DVs) ~ covs + factors + cov_i:(f1*…))` p of the chosen statistic for each `cov_i` interaction term, appended to the note as `slopes p(<cov> × <factor>)=…`. Keep it ONE extra manova fit with all cov:factor interactions; read each interaction term's row.
Figure: emmeans adjusted means per DV — fit `lm(dv ~ covs + factors)` per DV, `as.data.frame(emmeans(…, ~factors))`, facet by DV (Task 13's figure shape with emmean/lower.CL/upper.CL).
**Known answers** (outcome+outcome2 ~ baseline + group): group row (statistic Pillai): 0.367525003974141, F 6.30374133529023, p 0.000130150921618041 · Wilks-selected: 0.634151614316368 · follow-ups: outcome group row F 8.0678942699764 p 0.000833763379568619 (df 2/56) · outcome2 group row F 7.47387842662194 p 0.00132733951909915 (assert closeTo 6; from the type-II addendum — sequential per-DV `aov(outcome2 ~ baseline + group)` group row equals it, last-term property) · covariate row present with finite values.

- [ ] **Step 3: Builder** — as Task 13 (no followups toggle — table always renders); APA from the first FACTOR row's Pillai fields: `Pillai's V=0.37, F(4,112)=6.30, p<.001`. Note: card text + per-covariate slopes p values appended.

- [ ] **Step 4: Suites + mutation + commit (common rules).**

---

### Task 15: Friedman

**Files:** `src/lib/registry/friedman.ts` + consistency, `src/lib/stats/friedman.ts` + test, `src/lib/results/buildFriedman.ts` + test (id `friedman`).

- [ ] **Step 1: Registry** —
- question `'nonparametric repeated measures'`
- roles: subject (as Task 9) · `{ id: 'measures', label: 'Repeated measures', levels: 'ordinal / interval / ratio', arity: '2 or more', hint: 'e.g. same measure each time — score_t1, score_t2, score_t3' }` (constraints levels `['ordinal','interval','ratio']` {2,∞}) · minRule `complete-wide-rows` 3.
- options: alpha display · `{ id: 'posthoc', label: 'post-hoc', value: 'Nemenyi', kind: 'display' }`.
- tables (domIds `friedman-*`): `rank-summary` title `'Rank summary'` columns `[{condition:'Condition'}, {meanRank:'Mean rank'}]` (NO N column — card-drawn) · `friedman` title `'Friedman test'` columns `[{chi2:'χ²'}, df, p, {w:"Kendall's W"}]` · `posthoc` title `'Post-hoc (Nemenyi)'` columns `[Pair, {label:'p',sub:'adj'}]`.
- NO tableNote.
- figures `[{ caption: 'Across conditions', type: 'profile / box plot' }]`
- howToRead: `"The nonparametric counterpart to repeated-measures ANOVA. The χ²/p tests whether ranks differ across conditions; Kendall's W is the effect size (0–1 agreement). Post-hoc shows which conditions differ."`
- apaTemplate: `'A Friedman test found a difference across conditions, χ²({df})={chi2}, p={p}, W={w}.'`
- rMap: `'colMeans(apply(data, 1, rank)) → Table 1 (per-condition mean rank) · friedman.test() → χ², df, p · rstatix::friedman_effsize() / effectsize::kendalls_w() → Kendall's W · PMCMRplus (Nemenyi) → Table 3'` (display text verbatim from the card; the implementation hand-rolls Nemenyi — spike-validated ≡ PMCMRplus).
- bundleFiles: `['table_rank-summary.png', 'table_friedman.png', 'table_posthoc.png', 'figure_profile.png']`
- Anchors: outputs `'Friedman</span>'` → `'Pearson correlation</span>'`; inputs ttl `Friedman` → ttl `Pearson correlation`.

- [ ] **Step 2: Stats** — listwise as Task 9 (subject + all measures). env `conds`, `scores_flat`, `n`. R:
```r
mat <- matrix(scores_flat, ncol = length(conds), dimnames = list(NULL, conds))
ft <- friedman.test(mat)
k <- ncol(mat); n2 <- nrow(mat)
rk <- t(apply(mat, 1, rank)); rbar <- colMeans(rk)
ranks <- lapply(seq_len(k), function(i) list(condition = conds[i], meanRank = rbar[i]))
chi2 <- unname(ft$statistic)
w <- chi2 / (n2 * (k - 1))
ph <- list()
for (i in 1:(k - 1)) for (j in (i + 1):k) {
  q <- (rbar[j] - rbar[i]) / sqrt(k * (k + 1) / (6 * n2))
  ph[[length(ph) + 1]] <- list(pair = paste(conds[i], '-', conds[j]),
    pAdj = ptukey(abs(q) * sqrt(2), k, Inf, lower.tail = FALSE))
}
list(ranks = ranks, chi2 = chi2, df = unname(ft$parameter), p = ft$p.value, w = w, posthoc = ph)
```
Figure: Task 9's single-line profile recipe (condition means ± CI). **Known answers:** χ² 67.1882845188285 · df 2 · p 2.57187224967219e-15 · W 0.559902370990237 · Nemenyi `'score_t1 - score_t2'` pAdj 2.83863931227479e-05 (hand-rolled ≡ native PMCMRplus, spike-proven) · mean ranks strictly increasing t1 < t2 < t3 and summing to n·k(k+1)/2 ÷ n = 6 per row.

- [ ] **Step 3: Builder** — ranks rows `{ condition, meanRank: f(...) }`; test row `{ chi2: f, df: fdf, p: fp, w: f }`; posthoc `{ pair, padj: fp }`; APA `χ²(2)=67.19, p<.001, W=0.56`; note null.

- [ ] **Step 4: Suites + mutation + commit (common rules).**

---

### Task 16: Integration (serial, on main, after all worktrees merge)

**Files:** Modify `src/lib/registry/catalog.ts`, `src/lib/registry/catalog.consistency.test.ts`, `src/lib/results/builders.ts`. Check `src/lib/registry/registry.consistency.test.ts` for global assertions to extend.

- [ ] **Step 1: Merge the 11 worktree branches into main** (they touch disjoint files — merges are clean by construction; if any merge conflicts, a worktree broke isolation: STOP and fix that first).
- [ ] **Step 2: catalog.ts** — import the 11 specs; flip their entries to `'available'` (5th arg) and add all to `SPECS`. Keep tree order.
- [ ] **Step 3: catalog.consistency.test.ts** — the available-ids assertion becomes (TREE ORDER):
```ts
['summary-statistics', 'frequencies-crosstabs', 'distribution-normality', 'one-sample-t-test', 'independent-t-test', 'paired-t-test', 'one-way-anova', 'factorial-anova', 'repeated-measures-anova', 'mixed-anova', 'nested-anova', 'welch-anova', 'ancova', 'manova', 'mancova', 'mann-whitney-u', 'wilcoxon-signed-rank', 'kruskal-wallis', 'friedman']
```
- [ ] **Step 4: builders.ts** — add 11 RUNNERS + 11 BUILDERS entries. Exact role/option keys:
```ts
'one-way-anova': (e, ds, s) => runOneWayAnova(e, ds, s.roles['outcome'][0], s.roles['factor'][0], s.options['posthoc'] as string),
'factorial-anova': (e, ds, s) => runFactorialAnova(e, ds, s.roles['outcome'][0], s.roles['factors'], s.options['interactions'] as boolean),
'repeated-measures-anova': (e, ds, s) => runRepeatedMeasuresAnova(e, ds, s.roles['subject'][0], s.roles['measures'], s.options['sphericity'] as string, s.options['posthoc'] as boolean),
'mixed-anova': (e, ds, s) => runMixedAnova(e, ds, s.roles['subject'][0], s.roles['between'][0], s.roles['measures'], s.options['sphericity'] as string, s.options['posthoc'] as boolean),
'nested-anova': (e, ds, s) => runNestedAnova(e, ds, s.roles['outcome'][0], s.roles['factor'][0], s.roles['nested'][0], (s.options['nesting'] as string) === 'random'),
'welch-anova': (e, ds, s) => runWelchAnova(e, ds, s.roles['outcome'][0], s.roles['factor'][0]),
'ancova': (e, ds, s) => runAncova(e, ds, s.roles['outcome'][0], s.roles['factor'], s.roles['covariates']),
'manova': (e, ds, s) => runManova(e, ds, s.roles['outcomes'], s.roles['factors'], s.options['statistic'] as string, s.options['followups'] as boolean),
'mancova': (e, ds, s) => runMancova(e, ds, s.roles['outcomes'], s.roles['factors'], s.roles['covariates'], s.options['statistic'] as string),
'kruskal-wallis': (e, ds, s) => runKruskalWallis(e, ds, s.roles['outcome'][0], s.roles['group'][0]),
'friedman': (e, ds, s) => runFriedman(e, ds, s.roles['subject'][0], s.roles['measures']),
```
(BUILDERS mirror the existing cast pattern.) The sphericity select maps to afex codes inside the runners: `{'GG correction':'GG','HF correction':'HF','none':'none'}`.
- [ ] **Step 5: registry.consistency.test.ts** — extend whatever global assertions exist (SPECS key set, domId global uniqueness across registries, decode-entity coverage) to the 19-spec set. If domId uniqueness is NOT yet asserted globally, ADD it: all `tables[].domId ?? tables[].id` across SPECS are unique.
- [ ] **Step 6: FULL gates on main:** `npx tsc -b` 0 · full `npm test` green (FOREGROUND; expect ~166 + ≈90 new = ~250+ tests) · `npm run build` green · `npx playwright test` green (existing journeys untouched).
- [ ] **Step 7: Commit** `feat(anova): integrate 11 tests — catalog available, runners+builders registered`.

---

### Task 17: e2e journeys

**Files:** Create `tests/e2e/anova.spec.ts` (existing `tests/e2e/flow.spec.ts` stays BYTE-UNTOUCHED — core-slice rule). Reuse its helpers by extracting NOTHING; copy the helper functions you need (configureStep, runAnalysis, level-assignment, zip-unzip assertions) into the new spec if they are not already exported.

- [ ] **Journey A (between-subjects):** upload `tests/e2e/fixtures/anova.csv` → step 4 (levels auto: numerics ratio, strings nominal; `subject_id` id-tagged stays unused — fine here) → pick One-way ANOVA + Factorial ANOVA + Kruskal-Wallis → configure: one-way outcome+group (post-hoc select shows 'Tukey HSD'); factorial outcome + factors group,gender; KW outcome+group → run all → assert rendered: one-way `F(2,57)=2.81` · `p=.069` · `η²=0.09` · post-hoc row p `.828`; factorial interaction row `2.48` / `.093` AND **no 'Simple effects / post-hoc' caption** (nothing significant — recorded decision 2); KW `H` row `6.56` / `.038` / `0.11`, Dunn row `.042` present → Download zip → unzip → assert exact paths: `01_one-way-anova/` table_descriptives.png · table_anova.png · table_posthoc.png · figure_means-plot.png; `02_factorial-anova/` table_cell-descriptives.png · table_anova.png · figure_interaction.png (NO table_simple-effects.png); `03_kruskal-wallis/` all 4 names.
- [ ] **Journey B (wide/repeated):** upload fixture → step 4: mark `subject_id` **Used** + level **nominal** (the id-tag flow — recorded decision 3) → pick RM + Mixed + Friedman → configure: RM subject + score_t1..t3 (sphericity select shows 'GG correction'); Mixed adds between=group; Friedman subject + the three scores → run → assert: RM table df `1.78` / `104.75`, `F` `78.51`, `p<.001` rendering, sphericity table caption present with `W` `0.87` and `p` `.020`; Mixed interaction row p `.056` + sphericity present; Friedman `67.19` / `<.001` / `0.56`, Nemenyi row `<.001` → back-edit RM config to only score_t1+score_t2 → stale → re-run → **sphericity caption ABSENT** on the RM card → zip: `01_repeated-measures-anova/` has NO table_sphericity.png (2-level run), Mixed + Friedman folders complete.
- [ ] Run `npx playwright test` (all e2e files) repeatedly until stable green ×2 consecutive. Commit `test(anova): e2e journeys — between-subjects + wide repeated-measures incl. sphericity omission`.

---

### Task 18: Finalization (STOP at Benjie's gate)

- [ ] README: update test counts (live tests 8 → 19), file/test counts to REAL totals (`git ls-files src | wc -l`, vitest summary), mention the ANOVA family in the feature list — follow README's existing voice.
- [ ] ROADMAP.md: slice 1 row — list corrected to the 11 ACTUAL tests (Welch's was missing, "mixed" now exists as a spec'd card — note the spec addition `42526c1`), status → done with date; update the estimates table if present.
- [ ] Screenshots into `.superpowers/screens/`: pick-tests (19 live), results page from journey A (3 ANOVA cards), test-config-mixed-anova (three slots + sphericity select). Production preview (`npm run build && npm run preview`), 1280×900, visually verify each against the locked design before saving.
- [ ] FINAL GATES, all FOREGROUND: `npx tsc -b` → 0 · full `npm test` → all green · `npm run build` → green · `npx playwright test` → all green ×2 · fresh-clone proof: clone to /tmp, `npm install && npm test && npm run build`, then DELETE the clone.
- [ ] Commit `docs(anova): README + ROADMAP for the ANOVA family slice`.
- [ ] **STOP. Do NOT push. Do NOT deploy.** Produce the slice-end report: recorded decisions 1–9 + the MANCOVA R-map deviation (Task 14) + anything found during the build, for Benjie's click-through gate.
