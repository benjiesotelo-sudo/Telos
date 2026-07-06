# Slice 5 "Citable & Complete" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every test reports completely, reads intuitively (term-led explainers), and is citable at the point of use; SEM cards adopt the reference paper's craft with stricter statistics, including latent moderation.

**Architecture:** A6 renderer devices land first (everything renders through them); CB-SEM runner grows the new statistics (native-R-verified) before builders reshape the card; the canvas moderation gesture serializes into the run config so app ≡ export; citations and explainers are registry-driven with machine-checked coverage; the R1 audit emits a committed findings doc whose standard-stat gaps build by default and convention-level gaps hold for the owner.

**Tech Stack:** React+TS+Vite, zustand, WebR 0.6.0 (lavaan/semTools/seminr), vitest (WebR-backed stats suites + native-R runs-in-r), Playwright (5 projects), LaTeX/PNG/PDF export emitters.

**Spec:** docs/superpowers/specs/2026-07-06-telos-citable-complete-design.md (amended; READ THE SPEC SECTION NAMED IN YOUR TASK).
**Spike (gates A7/P1-moderation):** docs/superpowers/reviews/2026-07-06-moderation-spike.md - GREEN both tracks; boot-matrix columns indexed by parameter LABEL, never row position.

## Global Constraints

- Owner's uncommitted/untracked files are sacrosanct; `git add` only files you created/edited; plain commit messages, no Co-Authored-By/session trailers; no em dashes in any text you write.
- Export ≡ app: every content change lands in HTML, table-PNG, LaTeX, PDF, and (where applicable) analysis.R the same task or unit; runs-in-r verifies new emitters.
- Every NEW statistic is verified against native R with a worked fixture (byte-exact where bootstrap-seeded, tolerance 1e-6 otherwise, matching existing suite conventions).
- APA numerics: 2-decimal, leading-zero-stripped for bounded stats (`f01`-family helpers), tabular-nums, right-aligned.
- WELCOME_COPY/TERMS_COPY byte-unchanged (copy.consistency test pins them).
- Bootstrap: default 5,000; e2e/doc-harness SEM-moderation runs use the 1,000 preset; BC = lavaan `boot.ci.type='bca.simple'` ONLY (never `'bca'` - invalid); both CI pairs bound unstandardized B from ONE bootstrap run.
- Result column: derived from the PERCENTILE 95% CI excluding zero, α fixed .05.
- H-ordering: structural paths in canvas array order → indirect effects in chain-enumeration order → moderation edges in creation order; serialized into run config.
- Moderation: indProd double-mean-centered; match=TRUE equal counts; match=FALSE all-products + disclosure note for unequal (spike-GREEN); FORCES ML + bootstrap SE; blocked under WLSMV/ordinal with message; NOT in path-analysis mode.
- Visual baselines regenerate ONLY in the final unit via --update-snapshots, with a before/after diff set saved for the owner.
- test:fast must stay green after every task; WebR suites for the touched area run per task; the FULL WebR gate runs in the final unit.

## File Structure (created / significantly modified)

- `src/components/ApaTable.tsx` - grouped rows, spanning headers, section labels, matrix italic-diagonal + stars (A6)
- `src/lib/export/rTable.ts` + `src/lib/export/latex.ts` - LaTeX twins of all four devices
- `src/lib/stats/runCbSem.ts` - latent-corr p-values, dual CIs (perc + bca.simple), item M/SD, indProd assembly, `:=` simple slopes, moderation params
- `src/lib/stats/runPlsSem.ts` - measurement M/SD, hand-rolled BC from boot matrix, interaction_term
- `src/lib/results/buildCbSem.ts` / `buildPlsSem.ts` - card reshape (Tables 1-5 canonical)
- `src/lib/registry/cbSem.ts` / `plsSem.ts` - new table specs, moderation option surface
- `src/state/` (canvas state module) + `src/components/SemCanvas.tsx` - moderation edges (AFTER X3 lands)
- `src/lib/registry/citations.ts` (NEW) - A4 registry; CITATIONS.txt generator consumes it
- `src/lib/registry/explainers.ts` (NEW) - A5 term-led registry + coverage test
- `src/lib/export/rScript/emitters/latent.ts` - moderation model + dual-CI emission
- `docs/superpowers/reviews/2026-07-06-completeness-audit.md` (NEW) - R1 findings
- `tests/e2e/sem-moderation.spec.ts` (NEW), citation/explainer assertions in an existing journey

## Unit Map (task numbering is per-unit; execute units in order)

- **U0 - X3 landing** (1 task): merge `benjie-wip-semcanvas-export-fit` (1e71638), run its tests, complete gaps, land crediting the approach. MUST precede U4.
- **U1 - A6 renderer** (6 tasks): device 1 grouped rows → device 2 spanning headers → device 3 section labels → device 4 matrix upgrades → LaTeX twins → PNG/PDF parity assertions.
- **U2 - CB-SEM runner statistics** (6 tasks): item M/SD per missing-setting → latent-corr p-values → dual CIs incl. bca.simple + dead-mapping fix → indProd model assembly (equal+unequal) → `:=` simple slopes + conditional effects → moderation runner integration; EVERY task native-R-verified.
- **U3 - CB-SEM card reshape** (5 tasks): Table 1 merge → Tables 3-4 on-card + cross-ref note → Table 5 merge + H-ids + Result rule → EFA preamble labeling → notes → labelled-notes conversion for this card.
- **U4 - Canvas moderation** (4 tasks): state model + serialization → gesture (click construct then path) + dashed render → guards (self/dup/ordinal/path-mode blocks with messages) → config routing into the runner.
- **U5 - A7 reporting + export** (5 tasks): Table 5 moderation section rows → simple-slopes figure (whiskered, 3 levels) + conditional-effects table → path-diagram dashed arrow → analysis.R emitters → runs-in-r fixture.
- **U6 - P1 PLS parity** (6 tasks): measurement table reshape + M/SD → HTMT on-card → structural reshape + hand-rolled BC (verified vs bca.simple fixture) → interaction_term moderation → PLS slopes figure → exports + runs-in-r.
- **U7 - A4 citations** (4 tasks): registry module (48 entries, consolidated from convention docs) → CITATIONS.txt generated from registry (byte-compat test vs current content where unchanged) → config "Why this test" line → results "Statistical basis" footer + PDF/LaTeX inclusion.
- **U8 - A5 explainers** (4 tasks): explainer registry + term-led renderer component → coverage consistency test (every reported stat has an entry) → value injection from live results → labelled-notes sweep across cards.
- **U9 - R1 audit + F1** (4 tasks): audit ALL 48 vs the 6-point checklist → commit findings doc with dispositions (standard-stat gaps = build; convention-level = HELD list) → gap-fix tasks for regression family + remaining standard gaps (each native-R-verified) → F1 readability sweep on all screens.
- **U10 - X1 spaced item names** (2 tasks): app-side item sanitization (all four stats modules) → export read.csv path + runs-in-r spaced-header fixture.
- **U11 - Integration + gate** (5 tasks): e2e moderation journey + citation/explainer assertions → per-test docs regen sweep (ALL 48) → visual baseline regen + owner diff set → FULL gate (tsc/build · test:fast · full WebR vitest · runs-in-r · 5 Playwright projects · fresh clone) → ledger/ratify prep.

## Interfaces (cross-unit contracts; implementers follow these EXACTLY)

- A6 column spec additions (registry `TableSpec.columns`): `{ key, label, span?: { group: string } }` - adjacent columns sharing `span.group` render under one spanning header labeled `group`.
- A6 row model additions (builder rows): `{ __group: string }` marks a group-header row (renders italic, indented children follow until next `__group`); `{ __section: string }` marks an internal section-label row. Group-level stats live ON the group row under their column keys.
- Matrix spec additions: `MatrixProps.diagonalStyle?: 'bold' | 'italic'`, `cellStars?: (string | null)[][]`, `starNote?: string`.
- Runner → builder (CB-SEM additions to the run result): `itemStats: { item, mean, sd }[]`, `corLvP: number[][]`, `paths[i]: { ..., ciPercLower/Upper, ciBcLower/Upper }`, `indirect[i]` same dual-CI fields, `moderation: { rows: PathLike[], slopes: { level: '-1SD'|'mean'|'+1SD', b, se, p, ciLower, ciUpper }[] }`, `hIds: serialized ordering`.
- Citation registry: `export interface TestCitations { whyThisTest: { text: string; refs: Ref[] }; statisticalBasis: { claim: string; ref: Ref }[] }`, `export const CITATIONS: Record<TestId, TestCitations>`, `export function citationsTxt(): string`.
- Explainer registry: `export interface Explainer { term: string; meaning: string; interpret: (v: ResultValues) => string }`, `export const EXPLAINERS: Record<TestId, Explainer[]>`, coverage test asserts every registry column key maps.
- Canvas state: `moderations: { id: number; moderatorId: number; pathIndex: number }[]` serialized in the run config beside paths.

---

# Unit 0 + Unit 1 - per-task detail

> Drafted against `docs/superpowers/plans/2026-07-06-telos-citable-complete.md` (skeleton) and
> `docs/superpowers/specs/2026-07-06-telos-citable-complete-design.md` (§A6, §X3, Global Constraints,
> Interfaces). Every task below was actually built and run in a throwaway git worktree against current
> `main` (`395e73b`) before being written up - every test shown really fails before its implementation
> step and really passes after; every "expected outcome" (test counts, `tsc -b`/`playwright --list`
> output) is a number that was actually observed, not estimated. The worktree was discarded after
> transcription; nothing here has touched the real repo.
>
> Global constraints apply to every task below without restatement: TDD (failing test first); plain
> commit messages (no Co-Authored-By/session trailers, no em dashes); `test:fast` green after every
> task; existing flat/classic tables render byte-identically unless a card opts into a new device;
> export ≡ app (HTML, table-PNG, LaTeX, PDF all render the same devices); owner's uncommitted/untracked
> files are sacrosanct - `git add` only files created/edited by the task at hand.

---

## Unit 0 - X3 landing (1 task)

### U0-T1 - Land `benjie-wip-semcanvas-export-fit` onto main

**Read first:** `git log --oneline benjie-wip-semcanvas-export-fit -3` (branches off `8584fb2`, the
same commit current `main` sits 3 docs-commits ahead of - `395e73b` → `3c66f33` → `1a08f16` → `8584fb2`,
all doc-only, so the merge cannot conflict) and `git diff 8584fb2 benjie-wip-semcanvas-export-fit --
src/components/SemCanvas.tsx` (the `latentBounds()` content-fitting viewBox: `itemSide` becomes
viewBox-independent - it buckets a construct's center by its position within the *span of all
construct centers* rather than against a fixed canvas width, so zoom/pan/fit never reflows item boxes
- plus a shared `itemGeom()` helper used by both the renderer and `latentBounds`, so the drawn boxes
and the fitted viewBox can never disagree).

**Context:** this WIP was Benjie's own uncommitted working-tree fix for a real export bug (O6: the
rightmost construct's item boxes, drawn past the fixed `BASE_VB` width, were clipped in the captured
PNG/PDF/figure). It was preserved on this branch (commit `1e71638`) by an earlier session rather than
discarded, per the 2026-07-06 boards ruling recorded in the design spec (§X3): "the landing task runs
BEFORE any A7 canvas task (same file): merge/rebase onto the slice branch, run its tests, complete
anything missing, land as its own commit crediting the approach - or report precisely why not." This
task does that landing. It must complete before Unit 4 (canvas moderation), which touches the same
file, but has no dependency on Unit 1 (A6 renderer touches only `ApaTable.tsx`/`rTable.ts`/registry
types - disjoint files) and may be done before or after it.

**Verified merge is clean, no conflicts:**

```
git worktree add -q /tmp/telos-u0-check 395e73b
cd /tmp/telos-u0-check
git merge --no-ff --no-edit benjie-wip-semcanvas-export-fit
```
Result observed: `Merge made by the 'ort' strategy.` - 13 files changed (10 binary doc-artifact
re-renders under `docs/test-documentation/46_cb-sem/` and `47_pls-sem/` + `src/components/SemCanvas.tsx`
+ `src/components/SemCanvas.test.tsx` + `tests/docs/document-tests.spec.ts`), 123 insertions(+), 30
deletions(-), zero conflict markers.

**Step 1 - merge onto main.** From a clean `main` (verify `git status` is clean first - this is a
merge of tracked files only; it must not touch any of the untracked docs/testing scratch files present
in the working tree):

```
git checkout main
git merge --no-ff benjie-wip-semcanvas-export-fit -m "$(cat <<'EOF'
merge(sem): land benjie-wip-semcanvas-export-fit - content-fitting canvas viewBox (O6 export clip)

Originally authored by Benjie in-tree: latentBounds() sizes the latent-mode canvas viewBox to the
real content (every construct oval + every item box, with padding for loading/R2 labels), replacing
the fixed 720x320 BASE_VB that was clipping the rightmost construct's item boxes in the captured
PNG/PDF/figure export. itemSide() becomes viewBox-independent (buckets a construct's center against
the span of all construct centers, not a fixed canvas width) so zoom/pan/fit never reflows items; a
shared itemGeom() helper keeps the renderer and latentBounds() in permanent agreement. Includes the
regenerated 46_cb-sem/47_pls-sem doc artifacts and the doc-harness Fit-button + renamed-PDF fix.

Preserved on benjie-wip-semcanvas-export-fit (1e71638) per the 2026-07-06 WIP-handling ruling
(design spec SS3); branches from the same 8584fb2 parent main sits 3 docs-commits ahead of, so this
merges with zero conflicts. Landed as its own commit ahead of any canvas-moderation (A7) work per
the X3-before-A7 sequencing.
EOF
)"
```

**Step 2 - run SemCanvas's own tests.**

```
npx vitest run src/components/SemCanvas.test.tsx --reporter=dot
```
Expected (observed in the check worktree): `Test Files  1 passed (1)` / `Tests  25 passed (25)` - the
pre-existing 23 tests plus the WIP's 2 new ones (`SemCanvasUI - latent content-fit viewBox (no item
clipping)`: every item box lands inside `latentBounds()`'s viewBox, and every construct oval does too).

**Step 3 - confirm the doc-tests spec still compiles/parses** (the WIP renames the PDF capture file
from `3-report.pdf` to `3-pdf-report.pdf` and adds a `Fit` button click before the config screenshot for
canvas tests - `tests/docs/document-tests.spec.ts` is not part of the `tsc -b` project references, so
its own compile is checked via Playwright's `--list`, which requires the file to parse and every
referenced fixture/case to enumerate without error):

```
npx playwright test --config=playwright.docs.config.ts --list
```
Expected (observed): enumerates all 48 cases ending `Total: 48 tests in 1 file`, no parse error.

**Step 4 - full typecheck.**

```
npx tsc -b
```
Expected: clean, no output, exit 0 (`SemCanvas.tsx` newly exports `ITEM_W`, `ITEM_H`, `latentBounds`,
which `SemCanvas.test.tsx` imports - this is the check that those names actually exist and typecheck).

**Step 5 - full regression gate.**

```
npm run test:fast
```
Expected (observed): `Test Files  140 passed (140)` / `Tests  1193 passed (1193)` - i.e. green,
nothing else in the tree regressed from the merge. (This count is measured on top of current `main`
with nothing else applied; if Unit 1 has already landed by the time this task runs, expect the Unit-1
task counts added on top - see each Unit 1 task's own expected numbers below.)

**Step 6 - "complete anything its tests reveal missing."** Nothing was missing: steps 2-5 above were
run for real against the actual merge and came back fully green with no gaps - no additional
implementation code is needed for this task. (If a future re-run of this task on a diverged `main`
surfaces a real failure here - e.g. a name collision introduced by intervening work - fix it in a
small follow-up edit scoped to that specific failure, re-run the failing command until green, and fold
that fix into this same commit's follow-up before moving on; do not silently skip a red step.)

**Step 7 - optional branch cleanup** (safe once merged; the branch's content now lives on `main`):
```
git branch -d benjie-wip-semcanvas-export-fit
```

**Step 8 - clean up the verification worktree** (this was a side check, not part of the real repo):
```
git worktree remove /tmp/telos-u0-check --force
```

- [ ] Step 1 - merge (commit created)
- [ ] Step 2 - `SemCanvas.test.tsx`: 25/25
- [ ] Step 3 - doc-tests `--list`: 48/48 enumerated
- [ ] Step 4 - `tsc -b`: clean
- [ ] Step 5 - `test:fast`: 140/140 files, 1193/1193 tests
- [ ] Step 6 - no gaps found (or: gap found + fixed + re-verified)
- [ ] Step 7 - branch deleted (optional)

---

## Unit 1 - A6 renderer (6 tasks)

**Scope note:** this unit builds the renderer DEVICES only - generic, spec-agnostic table machinery in
`ApaTable.tsx` (HTML/PNG/PDF) and `rTable.ts` (LaTeX). It does **not** wire any real card's builder
(e.g. `buildCbSem.ts`) to emit `__group`/`__section`/`span` rows - that happens later, when Unit 3
(CB-SEM card reshape) and Unit 6 (PLS parity) consume these devices for Tables 1/3/4/5. Every test
below therefore uses a synthetic `TableSpec`/`rows`/`MatrixTable` fixture shaped like the eventual
consumer (Table 1's construct/item rows, Table 5's H/Path/CI columns, Table 3's Fornell-Larcker
matrix), so the devices are proven against realistic shapes without touching any card's registry entry.

**Files at the center of this unit:** `src/lib/registry/types.ts`, `src/lib/results/types.ts`,
`src/components/ApaTable.tsx`, `src/components/ApaTable.test.tsx`, `src/lib/export/rTable.ts`,
`src/lib/export/rTable.test.ts`. Two new files: `src/lib/registry/types.test.ts`,
`src/lib/export/tableDeviceParity.test.tsx`.

### U1-T1 - Grouped rows (`__group`)

**Read first:** `src/components/ApaTable.tsx` (current classic-table branch, lines 45-61) and its
existing coef-row test style in `src/components/ApaTable.test.tsx` (lines 1-53 - `renderToStaticMarkup`
+ literal `TableSpec`/`rows` fixtures, `expect(html).toContain(...)`).

**Interface (per skeleton, exact):** a builder row carrying `{ __group: string }` marks a group-header
row - **all its columns are filled** (group-level stats, e.g. CR/AVE/ω/α for Table 1's construct rows,
live on it under their normal column keys, not in a separate cell); it renders italic
(`class="row-group"`). Rows that follow indent their first cell (`class="row-child"`) until the next
`__group` row. This is a **separate marker from `_kind`** (which stays coef-table-only) so a classic
table can opt in without touching the coef row machinery.

**Step 1 - failing test.** Append to `src/components/ApaTable.test.tsx`, directly after the existing
`describe('ApaTable coef rendering ...')` block (before the matrix `describe`):

```tsx
  it('classic tables (no kind) render unchanged', () => {
    const classic: TableSpec = { id: 'c', title: 'X', columns: [{ key: 'a', label: 'A' }] }
    const h = renderToStaticMarkup(<ApaTable id="c" spec={classic} rows={[{ a: '1' }]} />)
    expect(h).toContain('class="apa"'); expect(h).not.toContain('coef')
    expect(h).toContain('>1<')
  })
  it('a table with no __group/_kind rows renders BYTE-IDENTICAL html (A6 regression pin)', () => {
    const plain: TableSpec = { id: 'c', title: 'X', columns: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }] }
    const h = renderToStaticMarkup(<ApaTable id="c" spec={plain} rows={[{ a: '1', b: '2' }]} />)
    expect(h).toBe('<div style="overflow-x:auto"><table id="c" class="apa"><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table></div>')
  })
})

// ── grouped rows (A6 device 1, 2026-07-06): a `__group` row (all columns filled, group-level stats
// live on it) renders italic; rows that follow indent their first cell until the next `__group`. ──
describe('ApaTable classic - grouped rows (__group)', () => {
  // Faithful to Table 1's post-merge shape (A1): construct rows carry CR/AVE/ω/α once; item rows
  // carry Mean/SD/B/SE/z/p/Std. loading (buildCbSem.ts wires this up in a later unit).
  const spec: TableSpec = {
    id: 'cfa-loadings', title: 'Measurement model', columns: [
      { key: 'path', label: 'Construct → Item' }, { key: 'mean', label: 'M' }, { key: 'sd', label: 'SD' },
      { key: 'b', label: 'B' }, { key: 'se', label: 'SE' }, { key: 'z', label: 'z' }, { key: 'p', label: 'p' },
      { key: 'std', label: 'Std. loading' }, { key: 'cr', label: 'CR' }, { key: 'ave', label: 'AVE' },
      { key: 'omega', label: 'ω' }, { key: 'alpha', label: 'α' },
    ],
  }
  const rows: Record<string, string | number>[] = [
    { __group: 'Visual', path: 'Visual', mean: '', sd: '', b: '', se: '', z: '', p: '', std: '', cr: '.83', ave: '.62', omega: '.85', alpha: '.81' },
    { path: 'Visual → x1', mean: '4.94', sd: '1.17', b: '1.00', se: '', z: '', p: '', std: '.77' },
    { path: 'Visual → x2', mean: '6.09', sd: '1.17', b: '0.55', se: '0.06', z: '9.31', p: '<.001', std: '.42' },
    { __group: 'Textual', path: 'Textual', mean: '', sd: '', b: '', se: '', z: '', p: '', std: '', cr: '.87', ave: '.70', omega: '.87', alpha: '.85' },
    { path: 'Textual → x4', mean: '3.06', sd: '1.16', b: '1.00', se: '', z: '', p: '', std: '.85' },
  ]
  const html = renderToStaticMarkup(<ApaTable id="cfa-loadings" spec={spec} rows={rows} />)

  it('renders a __group row as class="row-group" carrying its own column values (construct name + CR/AVE/ω/α)', () => {
    expect(html).toContain('class="row-group"')
    expect((html.match(/class="row-group"/g) ?? []).length).toBe(2) // Visual + Textual
    expect(html).toMatch(/class="row-group"><td>Visual<\/td>.*?<td>\.83<\/td><td>\.62<\/td><td>\.85<\/td><td>\.81<\/td>/)
  })

  it('indents rows following a __group as class="row-child", resetting at the next __group', () => {
    // 2 item rows under Visual, 1 under Textual - 3 row-child rows total.
    expect((html.match(/class="row-child"/g) ?? []).length).toBe(3)
    expect(html).toContain('<tr class="row-child"><td>Visual → x1</td>')
  })

  it('a __group row never carries the row-child class (it is the header, not a child)', () => {
    const groupRowMatch = html.match(/<tr class="row-group"[^>]*>/g) ?? []
    expect(groupRowMatch.length).toBe(2)
    for (const m of groupRowMatch) expect(m).not.toContain('row-child')
  })
})
```

Run: `npx vitest run src/components/ApaTable.test.tsx --reporter=dot` - expected FAIL (observed: 3
failing, 14 passing - the 3 new `describe('... grouped rows ...')` assertions fail because `__group`
is not yet recognized and the byte-identical pin also fails to compile against nothing... actually the
byte-identical pin PASSES immediately since the classic path is unchanged at this point; only the 3
grouped-row assertions fail).

**Step 2 - implementation.** In `src/components/ApaTable.tsx`, add the doc comment and the group/child
row logic to the classic branch:

```tsx
// Grouped rows (A6 device 1, 2026-07-06): a row carrying `__group: string` is a group-header row -
// all its columns are filled (group-level stats, e.g. CR/AVE/ω/α, live on it under their normal
// column keys) and it renders italic (class="row-group"). Rows that follow indent their first cell
// (class="row-child") until the NEXT `__group` row. This is a separate marker from `_kind` (which
// stays coef-table-only) so a classic table can opt in without touching the coef row machinery.
```
(placed after the existing `_kind` comment block, before the `// Matrix tables ...` comment)

Replace the classic-branch body (from `const { id, spec, rows } = props` down to the closing `return`)
with:

```tsx
  const { id, spec, rows } = props
  const n = spec.columns.length
  const firstKey = spec.columns[0]?.key
  // `__group` rows are their own italic header (group-level stats live on them, under their normal
  // column keys); everything after one indents (row-child) until the next `__group` resets it.
  let inGroup = false
  const bodyRows = rows.map((r, i) => {
    if ('__group' in r) {
      inGroup = true
      return <tr key={i} className="row-group">{spec.columns.map((c) => <td key={c.key}>{r[c.key]}</td>)}</tr>
    }
    const kind = r['_kind'] as string | undefined
    if (kind === 'rule') { inGroup = false; return <tr key={i} className="gofrule"><td colSpan={n} /></tr> }
    if (kind === 'span') { inGroup = false; return <tr key={i} className="row-span"><td colSpan={n}>{r[firstKey]}</td></tr> }
    const cls = [kind && `row-${kind}`, inGroup && 'row-child'].filter(Boolean).join(' ') || undefined
    return <tr key={i} className={cls}>{spec.columns.map((c) => <td key={c.key}>{r[c.key]}</td>)}</tr>
  })
  return (
    <div style={{ overflowX: 'auto' }}>
      <table id={id} className={spec.kind === 'coef' ? 'apa coef' : 'apa'}>
        <thead><tr>{spec.columns.map((c) => <th key={c.key}>{c.label}{c.sub && <sub>{c.sub}</sub>}{c.suffix}</th>)}</tr></thead>
        <tbody>{bodyRows}</tbody>
      </table>
    </div>
  )
}
```

Note why this is byte-identical for every existing table: when no row ever sets `__group`, `inGroup`
stays `false` for the whole map, so `cls = [kind && \`row-${kind}\`, false].filter(Boolean).join(' ')
|| undefined` reduces to exactly the original `kind ? \`row-${kind}\` : undefined` - same string, same
`undefined` for plain rows.

Add to `src/styles/tokens.css`, after the existing `table.apa.matrix td:empty{...}` line:

```css
/* A6 grouped/sectioned/spanned classic tables (2026-07-06): construct rows carry group-level stats
   once (italic); item/child rows indent under them; internal section labels (Direct paths / Indirect
   effects / Moderation) sit full-width between blocks. */
table.apa .row-group td{font-style:italic;}
table.apa .row-child td:first-child{padding-left:20px;}
table.apa .row-section td{font-style:italic;color:var(--muted);padding-top:7px;}
```
(the `.row-section` rule is added now - harmless, unused until U1-T3 - to keep this one CSS-editing
pass instead of two; it does not affect any test in this task.)

**Step 3 - run + verify.**
```
npx vitest run src/components/ApaTable.test.tsx --reporter=dot
```
Expected (observed): `Test Files  1 passed (1)` / `Tests  17 passed (17)`.
```
npx tsc -b
```
Expected: clean, exit 0.

**Step 4 - full regression.**
```
npm run test:fast
```
Expected (observed): `Test Files  140 passed (140)` / `Tests  1195 passed (1195)` (baseline + 2 new
tests over this task's own file - the byte-identical pin plus the net gain from the 3 new grouped-row
tests replacing nothing).

**Step 5 - commit.**
```
git add src/components/ApaTable.tsx src/components/ApaTable.test.tsx src/styles/tokens.css
git commit -m "$(cat <<'EOF'
feat(results): grouped rows (__group, A6 device 1)

A builder row carrying __group is an italic group-header row (all columns filled - group-level
stats like CR/AVE/omega/alpha live on it under their normal keys); rows that follow indent their
first cell (row-child) until the next __group resets it. Separate marker from the coef-only _kind
field. Existing flat tables are byte-identical (regression-pinned).
EOF
)"
```

- [ ] Step 1 - failing test added, 3 fail / 14 pass
- [ ] Step 2 - implementation
- [ ] Step 3 - 17/17 pass, `tsc -b` clean
- [ ] Step 4 - `test:fast` 140/140 files, 1195/1195 tests
- [ ] Step 5 - commit

### U1-T2 - Spanning column headers (`span.group`)

**Read first:** `src/lib/registry/types.ts` (`ColumnDef`, `figuresOf` - the file's one existing
free-standing helper, the precedent for colocating a small pure function here) and the Table 5 column
shape in the design spec (§A3): `H | Path | B | Std. β | p | Percentile 95% CI (Lower/Upper) | BC 95%
CI (Lower/Upper) | Result`.

**Interface (per skeleton, exact):** `TableSpec.columns[]` gains `span?: { group: string }` - adjacent
columns sharing `span.group` render under one spanning header labeled `group`.

**Step 1 - pure-function test first.** Create `src/lib/registry/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { headerGroups } from './types'
import type { ColumnDef } from './types'

// Table 5's post-merge shape (A3): H | Path | B | Std. β | p | Percentile 95% CI (Lower/Upper) |
// BC 95% CI (Lower/Upper) | Result - two spanned CI groups, everything else plain.
const table5Cols: ColumnDef[] = [
  { key: 'h', label: 'H' }, { key: 'path', label: 'Path' }, { key: 'b', label: 'B' },
  { key: 'beta', label: 'Std. β' }, { key: 'p', label: 'p' },
  { key: 'percLo', label: 'Lower', span: { group: 'Percentile 95% CI' } },
  { key: 'percHi', label: 'Upper', span: { group: 'Percentile 95% CI' } },
  { key: 'bcLo', label: 'Lower', span: { group: 'BC 95% CI' } },
  { key: 'bcHi', label: 'Upper', span: { group: 'BC 95% CI' } },
  { key: 'result', label: 'Result' },
]

describe('headerGroups', () => {
  it('groups adjacent columns sharing the same span.group into one entry', () => {
    const groups = headerGroups(table5Cols)
    const perc = groups.find((g) => g.group === 'Percentile 95% CI')
    const bc = groups.find((g) => g.group === 'BC 95% CI')
    expect(perc?.cols.map((c) => c.key)).toEqual(['percLo', 'percHi'])
    expect(bc?.cols.map((c) => c.key)).toEqual(['bcLo', 'bcHi'])
  })

  it('gives every ungrouped column its own entry with group undefined and cols.length 1', () => {
    const groups = headerGroups(table5Cols)
    const plain = groups.filter((g) => g.group == null)
    expect(plain.length).toBe(6) // h, path, b, beta, p, result
    for (const g of plain) expect(g.cols.length).toBe(1)
  })

  it('preserves column order (groups appear where their first member was)', () => {
    const groups = headerGroups(table5Cols)
    expect(groups.map((g) => g.group ?? g.cols[0].key)).toEqual([
      'h', 'path', 'b', 'beta', 'p', 'Percentile 95% CI', 'BC 95% CI', 'result',
    ])
  })

  it('two non-adjacent groups with the same label stay separate entries (adjacency, not label, decides)', () => {
    const cols: ColumnDef[] = [
      { key: 'a', label: 'A', span: { group: 'CI' } },
      { key: 'mid', label: 'Mid' },
      { key: 'b', label: 'B', span: { group: 'CI' } },
    ]
    const groups = headerGroups(cols)
    expect(groups.length).toBe(3)
    expect(groups[0].cols.map((c) => c.key)).toEqual(['a'])
    expect(groups[2].cols.map((c) => c.key)).toEqual(['b'])
  })

  it('a table with no span columns produces one ungrouped entry per column (byte-identical header case)', () => {
    const cols: ColumnDef[] = [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]
    const groups = headerGroups(cols)
    expect(groups).toEqual([{ key: 'a', group: undefined, cols: [cols[0]] }, { key: 'b', group: undefined, cols: [cols[1]] }])
  })
})
```

Run: `npx vitest run src/lib/registry/types.test.ts` - expected FAIL (`headerGroups` does not exist:
"No matching export").

**Step 2 - implementation (registry types).** In `src/lib/registry/types.ts`:

Change the `ColumnDef` line to:
```ts
export interface ColumnDef { key: string; label: string; sub?: string; suffix?: string; span?: { group: string } } // sub renders as <sub> - e.g. { label: 'M', sub: 'diff' } → M<sub>diff</sub> · suffix renders after the sub, e.g. M<sub>diff</sub> (adj.) · span (A6 device 2, 2026-07-06): adjacent columns sharing span.group render under one two-row spanning header labeled `group` (e.g. Lower/Upper under "Percentile 95% CI")
```

Append at the end of the file, after `figuresOf`:
```ts

// A6 device 2 (2026-07-06): group adjacent columns that share the same `span.group` into one header
// cell. A column with no `span` (or whose group differs from the previous column's) starts its own
// ungrouped entry (`group` undefined, `cols.length === 1`) - the renderer gives that one cell a
// rowSpan across both header rows so it prints its label ONCE. Shared by ApaTable.tsx (HTML) and
// rTable.ts (LaTeX \multicolumn + \cmidrule) so the two renderers can never disagree on the grouping.
export interface HeaderGroup { key: string; group?: string; cols: ColumnDef[] }
export function headerGroups(columns: ColumnDef[]): HeaderGroup[] {
  const groups: HeaderGroup[] = []
  for (const c of columns) {
    const last = groups[groups.length - 1]
    if (c.span && last?.group === c.span.group) { last.cols.push(c); continue }
    groups.push({ key: c.span ? `span-${c.span.group}-${groups.length}` : c.key, group: c.span?.group, cols: [c] })
  }
  return groups
}
```

Run: `npx vitest run src/lib/registry/types.test.ts` - expected PASS, 5/5 (this function has no
UI dependency, so it goes green as soon as it's written correctly).

**Step 3 - ApaTable rendering test.** Append to `src/components/ApaTable.test.tsx`, directly after the
`describe('ApaTable classic - grouped rows (__group)')` block from U1-T1 (before the matrix
`describe`):

```tsx
// ── spanning column headers (A6 device 2, 2026-07-06): a two-level <thead> when any column ──
// carries `span`; plain columns keep their single label via rowSpan; adjacent same-group columns
// merge under one colSpan header.
describe('ApaTable classic - spanning column headers (span.group)', () => {
  // Table 5's post-merge shape (A3): two CI groups (Percentile / BC), everything else plain.
  const spec: TableSpec = {
    id: 'structural-paths', title: 'Structural paths', columns: [
      { key: 'h', label: 'H' }, { key: 'path', label: 'Path' }, { key: 'b', label: 'B' },
      { key: 'percLo', label: 'Lower', span: { group: 'Percentile 95% CI' } },
      { key: 'percHi', label: 'Upper', span: { group: 'Percentile 95% CI' } },
      { key: 'bcLo', label: 'Lower', span: { group: 'BC 95% CI' } },
      { key: 'bcHi', label: 'Upper', span: { group: 'BC 95% CI' } },
      { key: 'result', label: 'Result' },
    ],
  }
  const rows: Record<string, string | number>[] = [
    { h: 'H1', path: 'Visual → Ability', b: '0.42', percLo: '0.30', percHi: '0.55', bcLo: '0.29', bcHi: '0.54', result: 'Supported' },
  ]
  const html = renderToStaticMarkup(<ApaTable id="structural-paths" spec={spec} rows={rows} />)

  it('renders TWO header rows (span present) and marks the table class="apa spanned"', () => {
    expect(html).toContain('class="apa spanned"')
    const theadTrs = html.match(/<thead>.*?<\/thead>/s)![0].match(/<tr>/g) ?? []
    expect(theadTrs.length).toBe(2)
  })

  it('row 1 has a colSpan=2 cell per group, labeled with the group name', () => {
    // renderToStaticMarkup emits the JSX prop casing (colSpan/rowSpan), not the lowercase HTML wire
    // name - same convention the existing coef-row test uses (html.toLowerCase() before matching).
    expect(html.toLowerCase()).toContain('colspan="2"')
    expect(html).toMatch(/<th colSpan="2"[^>]*>Percentile 95% CI<\/th>/)
    expect(html).toMatch(/<th colSpan="2"[^>]*>BC 95% CI<\/th>/)
  })

  it('row 1 gives ungrouped columns rowSpan=2 so their label prints once', () => {
    expect((html.match(/rowSpan="2"/g) ?? []).length).toBe(4) // H, Path, B, Result
  })

  it('row 2 carries ONLY the spanned sub-column labels (Lower/Upper × 2), nothing for plain columns', () => {
    const rows2 = html.match(/<thead>.*?<\/thead>/s)![0].match(/<tr>(.*?)<\/tr>/gs) ?? []
    const row2 = rows2[1]
    expect((row2.match(/<th>Lower<\/th>/g) ?? []).length).toBe(2)
    expect((row2.match(/<th>Upper<\/th>/g) ?? []).length).toBe(2)
    expect(row2.match(/<th/g)?.length).toBe(4) // exactly the 4 spanned sub-columns, no cells for H/Path/B/Result
  })

  it('a table with no span columns keeps the single-row header (byte-identical, class="apa")', () => {
    const plain: TableSpec = { id: 'x', title: 'X', columns: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }] }
    const h = renderToStaticMarkup(<ApaTable id="x" spec={plain} rows={[{ a: '1', b: '2' }]} />)
    expect(h).toBe('<div style="overflow-x:auto"><table id="x" class="apa"><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table></div>')
  })
})
```

Run: `npx vitest run src/components/ApaTable.test.tsx --reporter=dot` - expected FAIL (4 new failures;
the "no span columns" case already passes since the classic path is still single-row-header-only).

**Step 4 - implementation (ApaTable rendering).** In `src/components/ApaTable.tsx`:

Add the import:
```ts
import type { TableSpec } from '../lib/registry/types'
import { headerGroups } from '../lib/registry/types'
import type { MatrixTable } from '../lib/results/types'
```

Insert, right after `const firstKey = spec.columns[0]?.key`:
```tsx
  // Spanning column headers (A6 device 2, 2026-07-06): only when at least one column carries `span`
  // do we render a two-row <thead> - every other table keeps its original single-row header
  // (byte-identical). Plain (ungrouped) columns get rowSpan=2 so their label prints once.
  const groups = headerGroups(spec.columns)
  const hasSpan = groups.some((g) => g.group != null)
  const tableClass = spec.kind === 'coef' ? 'apa coef' : hasSpan ? 'apa spanned' : 'apa'
```

Replace the `return (...)` block's `<table>` opening and `<thead>` with:
```tsx
  return (
    <div style={{ overflowX: 'auto' }}>
      <table id={id} className={tableClass}>
        <thead>{hasSpan ? (
          <>
            <tr>{groups.map((g) => g.group != null
              ? <th key={g.key} colSpan={g.cols.length} className="span-group">{g.group}</th>
              : <th key={g.key} rowSpan={2}>{g.cols[0].label}{g.cols[0].sub && <sub>{g.cols[0].sub}</sub>}{g.cols[0].suffix}</th>)}
            </tr>
            <tr>{groups.flatMap((g) => g.group == null ? [] :
              g.cols.map((c) => <th key={c.key}>{c.label}{c.sub && <sub>{c.sub}</sub>}{c.suffix}</th>))}
            </tr>
          </>
        ) : (
          <tr>{spec.columns.map((c) => <th key={c.key}>{c.label}{c.sub && <sub>{c.sub}</sub>}{c.suffix}</th>)}</tr>
        )}</thead>
        <tbody>{bodyRows}</tbody>
      </table>
    </div>
  )
}
```

Add to `tokens.css`, after the `.row-section` rule from U1-T1:
```css
/* A6 device 2: two-row spanning header (Percentile 95% CI / BC 95% CI over Lower/Upper, etc.).
   The base `table.apa thead th` rule already puts a top rule + bottom rule on EVERY th; a rowSpan=2
   cell's border-bottom naturally lands at the bottom of its merged (2-row-tall) box, so it lines up
   with row 2's own bottom rule with no extra CSS. The only thing to suppress is row 2's top rule
   (it would otherwise draw a stray line between the two header rows). */
table.apa.spanned thead th.span-group{text-align:center;}
table.apa.spanned thead tr:last-child th{border-top:none;}
```

**Step 5 - run + verify.**
```
npx vitest run src/components/ApaTable.test.tsx src/lib/registry/types.test.ts --reporter=dot
```
Expected (observed): `Test Files  2 passed (2)` / `Tests  27 passed (27)`.
```
npx tsc -b
```
Expected: clean, exit 0.

**Step 6 - full regression.**
```
npm run test:fast
```
Expected (observed): `Test Files  141 passed (141)` / `Tests  1205 passed (1205)` (+1 file for the new
`types.test.ts`, +10 tests over the prior task's 1195: 5 in `types.test.ts` + 5 net new in
`ApaTable.test.tsx`).

**Step 7 - commit.**
```
git add src/components/ApaTable.tsx src/components/ApaTable.test.tsx src/styles/tokens.css src/lib/registry/types.ts src/lib/registry/types.test.ts
git commit -m "$(cat <<'EOF'
feat(results): spanning column headers (span.group, A6 device 2)

ColumnDef gains span?: { group } - adjacent columns sharing the same group render under one
two-row header (colSpan over the group label; plain columns get rowSpan=2 so their label prints
once). headerGroups() in registry/types.ts is the single source of truth for the grouping, shared
by the HTML renderer and (next task) the LaTeX twin. Tables with no spanned columns keep the
original single-row header, byte-identical.
EOF
)"
```

- [ ] Step 1 - `types.test.ts` added, 5 fail (no export)
- [ ] Step 2 - `headerGroups` implemented, 5/5 pass
- [ ] Step 3 - `ApaTable.test.tsx` header tests added, 4 fail
- [ ] Step 4 - ApaTable + CSS implementation
- [ ] Step 5 - 27/27 pass across both files, `tsc -b` clean
- [ ] Step 6 - `test:fast` 141/141 files, 1205/1205 tests
- [ ] Step 7 - commit

### U1-T3 - Internal section labels (`__section`)

**Read first:** the A3 spec line: "Section labels: Direct paths / Indirect effects / Moderation (each
only when applicable)" - these are full-width italic body rows between blocks of Table 5, distinct from
the group-header rows in U1-T1 (a section label carries no per-column data at all).

**Interface (per skeleton, exact):** a builder row carrying `{ __section: string }` marks an internal
section-label row - a full-width italic label inside the body.

**Step 1 - failing test.** Append to `src/components/ApaTable.test.tsx`, directly after the
`describe('ApaTable classic - spanning column headers ...')` block from U1-T2 (before the matrix
`describe`):

```tsx
// ── internal section labels (A6 device 3, 2026-07-06): a `__section` row is a full-width italic
// label inside the body (Table 5's "Direct paths" / "Indirect effects" / "Moderation" blocks). ──
describe('ApaTable classic - internal section labels (__section)', () => {
  const spec: TableSpec = {
    id: 'structural-paths', title: 'Structural paths', columns: [
      { key: 'h', label: 'H' }, { key: 'path', label: 'Path' }, { key: 'b', label: 'B' }, { key: 'result', label: 'Result' },
    ],
  }
  const rows: Record<string, string | number>[] = [
    { __section: 'Direct paths' },
    { h: 'H1', path: 'Visual → Ability', b: '0.42', result: 'Supported' },
    { __section: 'Indirect effects' },
    { h: 'H2', path: 'Visual → Ability → Achievement', b: '0.11', result: 'Supported' },
  ]
  const html = renderToStaticMarkup(<ApaTable id="structural-paths" spec={spec} rows={rows} />)

  it('renders a __section row as a full-width class="row-section" cell, text in the first column', () => {
    expect((html.match(/class="row-section"/g) ?? []).length).toBe(2)
    expect(html.toLowerCase()).toMatch(/<tr class="row-section"><td colspan="4">direct paths<\/td><\/tr>/)
    expect(html.toLowerCase()).toContain('<td colspan="4">indirect effects</td>')
  })

  it('a __section row is NOT treated as a __group (no group-child indenting carries across it)', () => {
    // The row right after "Indirect effects" must NOT be row-child (no __group is open at that point).
    const afterSection = html.split('Indirect effects</td></tr>')[1]
    expect(afterSection.startsWith('<tr><td>H2</td>')).toBe(true)
  })
})
```

Run: `npx vitest run src/components/ApaTable.test.tsx --reporter=dot` - expected FAIL (2 new failures:
`__section` is not yet recognized, so those rows fall through to the plain-row branch and render 4
separate `<td>` cells instead of one `colSpan={4}` cell).

**Step 2 - implementation.** In `src/components/ApaTable.tsx`, add the `__section` check ahead of the
`__group` check (so a section row always wins and always resets `inGroup`):

```tsx
  const bodyRows = rows.map((r, i) => {
    if ('__section' in r) {
      inGroup = false
      return <tr key={i} className="row-section"><td colSpan={n}>{r['__section']}</td></tr>
    }
    if ('__group' in r) {
      inGroup = true
      return <tr key={i} className="row-group">{spec.columns.map((c) => <td key={c.key}>{r[c.key]}</td>)}</tr>
    }
    const kind = r['_kind'] as string | undefined
```
(the rest of the function is unchanged - the `.row-section` CSS rule was already added in U1-T1's CSS
edit, so no CSS change is needed here).

**Step 3 - run + verify.**
```
npx vitest run src/components/ApaTable.test.tsx --reporter=dot
```
Expected (observed): `Test Files  1 passed (1)` / `Tests  24 passed (24)`.
```
npx tsc -b
```
Expected: clean, exit 0.

**Step 4 - full regression.**
```
npm run test:fast
```
Expected (observed): `Test Files  141 passed (141)` / `Tests  1207 passed (1207)` (+2 over the prior
task).

**Step 5 - commit.**
```
git add src/components/ApaTable.tsx src/components/ApaTable.test.tsx
git commit -m "$(cat <<'EOF'
feat(results): internal section labels (__section, A6 device 3)

A builder row carrying __section renders as a full-width italic label inside the table body (Table
5's "Direct paths" / "Indirect effects" / "Moderation" block headers). Checked before __group so a
section boundary always resets any open group's child-indent state.
EOF
)"
```

- [ ] Step 1 - failing test added, 2 fail
- [ ] Step 2 - implementation
- [ ] Step 3 - 24/24 pass, `tsc -b` clean
- [ ] Step 4 - `test:fast` 141/141 files, 1207/1207 tests
- [ ] Step 5 - commit

### U1-T4 - Matrix upgrades (`diagonalStyle`, `cellStars`, `starNote`)

**Read first:** `src/lib/results/types.ts` (current `MatrixTable`), the A1 spec line for Table 3:
"latent correlation matrix, √AVE italic on the diagonal, significance stars on off-diagonal
correlations, star-legend note (*p<.05, **p<.01, ***p<.001)". The p-values that would drive real stars
are a Unit-2 runner addition (`corLvP`, from the ψ block of `standardizedSolution`) - this task builds
only the generic renderer capability, proven against a synthetic fixture.

**Interface (per skeleton, exact):** `MatrixProps.diagonalStyle?: 'bold' | 'italic'`, `cellStars?:
(string | null)[][]`, `starNote?: string`. `diagonalStyle` is additive to the existing `diagonal?:
'bold' | 'plain'` field (kept for back-compat - every current HTMT/AVE matrix card keeps working
unchanged); `diagonalStyle: 'bold'` behaves like the legacy `diagonal: 'bold'`, `'italic'` is new.

**Step 1 - type addition (no test needed - a type-only change; the behavior it enables is what
Step 2's test exercises).** In `src/lib/results/types.ts`:

```ts
/** Matrix table: square (or rectangular) label×label grid - Fornell-Larcker, HTMT, interfactor-correlation. */
export interface MatrixTable {
  kind: 'matrix'
  id: string
  caption: string
  rowLabels: string[]
  colLabels: string[]
  cells: (string | number | null)[][]
  diagonal?: 'bold' | 'plain'
  lowerOnly?: boolean
  // A6 device 4 (2026-07-06):
  diagonalStyle?: 'bold' | 'italic' // additive to `diagonal` (kept for back-compat, existing HTMT/AVE cards keep working unchanged); 'bold' here has the same effect as diagonal:'bold'; 'italic' is new (√AVE on the Fornell-Larcker diagonal)
  cellStars?: (string | null)[][] // same shape as `cells` - a significance-star suffix ('*'|'**'|'***') per cell, or null; appended after the cell's value
  starNote?: string // the star legend (e.g. "*p<.05, **p<.01, ***p<.001"); renders as a table footer row (HTML, inside the captured <table>) / a line after \end{tabular} (LaTeX)
}
```

**Step 2 - failing test.** Append to `src/components/ApaTable.test.tsx`, at the very end of the file
(after the existing `describe('ApaTable matrix rendering (kind:matrix)')` block):

```tsx
// ── matrix upgrades (A6 device 4, 2026-07-06): italic diagonal, per-cell significance stars, a ──
// star-legend footer row. Faithful to Table 3's post-merge shape (A1): √AVE italic on the diagonal,
// stars on the off-diagonal latent correlations.
describe('ApaTable matrix - devices (diagonalStyle, cellStars, starNote)', () => {
  const fl: MatrixTable = {
    kind: 'matrix', id: 'fornell-larcker', caption: 'Fornell-Larcker Criterion',
    rowLabels: ['Visual', 'Textual', 'Speed'], colLabels: ['Visual', 'Textual', 'Speed'],
    cells: [
      ['.83', null, null],
      ['.42', '.79', null],
      ['.38', '.51', '.91'],
    ],
    diagonalStyle: 'italic',
    lowerOnly: true,
    cellStars: [
      [null, null, null],
      ['***', null, null],
      ['**', '***', null],
    ],
    starNote: '*p<.05, **p<.01, ***p<.001',
  }
  const html = renderToStaticMarkup(<ApaTable matrix={fl} />)

  it('diagonalStyle:italic wraps the diagonal cells in <em>, not <strong>', () => {
    expect(html).toContain('<em>.83</em>')
    expect(html).toContain('<em>.79</em>')
    expect(html).toContain('<em>.91</em>')
    expect(html).not.toContain('<strong>')
  })

  it('diagonalStyle:bold behaves like the legacy diagonal:bold', () => {
    const h = renderToStaticMarkup(<ApaTable matrix={{ ...fl, diagonalStyle: 'bold' }} />)
    expect(h).toContain('<strong>.83</strong>')
    expect(h).not.toContain('<em>')
  })

  it('cellStars append the significance suffix directly after the cell value', () => {
    expect(html).toContain('.42***')
    expect(html).toContain('.38**')
    expect(html).toContain('.51***')
  })

  it('a null cellStars entry appends nothing (no stray "null" text)', () => {
    expect(html).not.toContain('null')
  })

  it('starNote renders as a table footer row so it is captured WITH the table (captureNode parity)', () => {
    expect(html).toContain('<tfoot>')
    expect(html).toContain('*p&lt;.05, **p&lt;.01, ***p&lt;.001')
    // still inside the same <table id="table-fornell-larcker">, not a sibling element
    const tableBlock = html.match(/<table[^>]*id="table-fornell-larcker"[^>]*>.*<\/table>/s)![0]
    expect(tableBlock).toContain('*p&lt;.05')
  })

  it('a matrix with none of the new fields renders exactly as before (byte-identical legacy path)', () => {
    const legacy: MatrixTable = {
      kind: 'matrix', id: 'm', caption: 'M', rowLabels: ['A'], colLabels: ['A'], cells: [['.9']], diagonal: 'bold',
    }
    const h = renderToStaticMarkup(<ApaTable matrix={legacy} />)
    expect(h).toBe('<div style="overflow-x:auto"><table id="table-m" class="apa matrix"><thead><tr><th></th><th>A</th></tr></thead><tbody><tr><th>A</th><td><strong>.9</strong></td></tr></tbody></table></div>')
  })
})
```

Run: `npx vitest run src/components/ApaTable.test.tsx --reporter=dot` - expected FAIL (4 new failures:
`diagonalStyle`/`cellStars`/`starNote` are not yet read anywhere, so no `<em>`, no star suffix, no
`<tfoot>` appear; the "byte-identical legacy" case already passes since the matrix branch is
unchanged so far).

**Step 3 - implementation.** In `src/components/ApaTable.tsx`, replace the matrix branch:

```tsx
  if (props.matrix) {
    const { id, colLabels, rowLabels, cells, diagonal, diagonalStyle, lowerOnly, cellStars, starNote } = props.matrix
    return (
      // R1: overflow-x wrapper only - the id stays on the <table> so #table-* locators (e2e) and
      // captureNode(`table-${domId ?? id}`) (PNG export) still find the same element.
      <div style={{ overflowX: 'auto' }}>
        <table id={`table-${props.domId ?? id}`} className="apa matrix">
          <thead><tr>
            <th />
            {colLabels.map((label, j) => <th key={j}>{label}</th>)}
          </tr></thead>
          <tbody>{rowLabels.map((rowLabel, i) => (
            <tr key={i}>
              <th>{rowLabel}</th>
              {colLabels.map((_, j) => {
                const isUpper = lowerOnly && j > i
                if (isUpper || cells[i][j] == null) return <td key={j}></td>
                const star = cellStars?.[i]?.[j]
                const val = star ? `${cells[i][j]}${star}` : cells[i][j]
                const isDiag = j === i
                const content =
                  isDiag && (diagonal === 'bold' || diagonalStyle === 'bold') ? <strong>{val}</strong> :
                  isDiag && diagonalStyle === 'italic' ? <em>{val}</em> :
                  val
                return <td key={j}>{content}</td>
              })}
            </tr>
          ))}</tbody>
          {starNote && <tfoot><tr><td colSpan={colLabels.length + 1} className="matrix-starnote">{starNote}</td></tr></tfoot>}
        </table>
      </div>
    )
  }
```

Add to `tokens.css`, after `table.apa.matrix td:empty{color:transparent;}`:
```css
table.apa.matrix .matrix-starnote{color:var(--muted);font-size:11px;text-align:left;padding-top:7px;}
```

**Note on why `starNote` is a `<tfoot>` inside the `<table>` and not a sibling `<p>`:** `captureNode`
(`src/lib/export/capture.ts`) is `toPng(document.getElementById(id))` - it rasters exactly the
subtree rooted at that one element. A note rendered as a sibling of `<table>` (even inside the same
wrapping `<div>`) would be invisible in the exported table PNG; putting it in a `<tfoot>` guarantees it
is captured every time the table is, with no separate wiring. (This reasoning is exercised for real in
U1-T6.)

**Step 4 - run + verify.**
```
npx vitest run src/components/ApaTable.test.tsx --reporter=dot
```
Expected (observed): `Test Files  1 passed (1)` / `Tests  30 passed (30)`.
```
npx tsc -b
```
Expected: clean, exit 0.

**Step 5 - full regression.**
```
npm run test:fast
```
Expected (observed): `Test Files  141 passed (141)` / `Tests  1213 passed (1213)` (+6 over the prior
task).

**Step 6 - commit.**
```
git add src/components/ApaTable.tsx src/lib/results/types.ts src/styles/tokens.css
git commit -m "$(cat <<'EOF'
feat(results): matrix upgrades - diagonalStyle, cellStars, starNote (A6 device 4)

MatrixTable gains diagonalStyle ('bold'|'italic', additive to the existing back-compat diagonal
field), cellStars (a same-shape significance-star grid appended after each cell value), and
starNote (a legend line). starNote renders as a <tfoot> row INSIDE the captured <table>, not a
sibling element, so it survives PNG/PDF capture (captureNode rasters exactly the DOM subtree at
the table's id). Existing HTMT/AVE matrix cards (diagonal:'bold', no stars/note) are unaffected.
EOF
)"
```

- [ ] Step 1 - `MatrixTable` type extended
- [ ] Step 2 - failing test added, 4 fail
- [ ] Step 3 - implementation
- [ ] Step 4 - 30/30 pass, `tsc -b` clean
- [ ] Step 5 - `test:fast` 141/141 files, 1213/1213 tests
- [ ] Step 6 - commit

### U1-T5 - LaTeX twins for all four devices

**Read first:** `src/lib/export/rTable.ts` (`classicToLatex`, `matrixToLatex`, `flatLabel`, `cell`,
`escapeLatex`) and `src/lib/export/rTable.test.ts`'s existing `classicToLatex`/`matrixToLatex`
`describe` blocks for fixture/assertion style (hand-built `BuiltTable` objects, `toContain`/`toMatch`
on the joined string).

**Interfaces (per skeleton, exact LaTeX shapes):**
- Grouped rows: "full-width italic label row + `\quad`-indented child first cells (NOT `\multirow`)".
- Spanning headers: "`\multicolumn` + `\cmidrule`".
- Section labels: a `\multicolumn` italic label row (same shape as the existing coef-table `_kind:
  'span'` row, but for the classic path).
- Matrix: `cellStars` appended after the cell value; `diagonalStyle` italicizes (`'bold'` behaves like
  the legacy `diagonal:'bold'`); `starNote` prints after `\end{tabular}` (LaTeX isn't rasterized, so
  plain trailing prose is fine - no `\tfoot` equivalent needed).

**Step 1 - failing tests.** Append to `src/lib/export/rTable.test.ts`, directly after the existing
`describe('classicToLatex', ...)` block:

```ts
// ── A6 device 1 (grouped rows) + device 3 (section labels) LaTeX twins, 2026-07-06 ──
// Table 1's post-merge shape (A1): construct rows (italic, full row, NOT \multirow) carry CR/AVE/
// ω/α; item rows indent their first cell with \quad.
const groupedTable: BuiltTable = {
  spec: {
    id: 'cfa-loadings', title: 'Measurement model',
    columns: [{ key: 'path', label: 'Construct → Item' }, { key: 'std', label: 'Std. loading' }, { key: 'cr', label: 'CR' }],
  },
  rows: [
    { __group: 'Visual', path: 'Visual', std: '', cr: '.83' },
    { path: 'Visual → x1', std: '.77', cr: '' },
    { path: 'Visual → x2', std: '.42', cr: '' },
  ],
}

describe('classicToLatex - grouped rows (__group, A6 device 1)', () => {
  const tex = classicToLatex(groupedTable)
  it('renders the __group row as a full-width ITALIC row (every column wrapped, not \\multicolumn)', () => {
    expect(tex).toMatch(/\\textit\{Visual\} & \\textit\{\} & \\textit\{\.83\} \\\\/)
    expect(tex).not.toContain('\\multirow')
  })
  it('indents the child rows’ first cell with \\quad, leaving other cells untouched', () => {
    expect(tex).toContain('\\quad Visual $\\rightarrow$ x1 & .77 & ')
    expect(tex).toContain('\\quad Visual $\\rightarrow$ x2 & .42 & ')
  })
})

const sectionedTable: BuiltTable = {
  spec: { id: 'structural-paths', title: 'Structural paths', columns: [{ key: 'h', label: 'H' }, { key: 'path', label: 'Path' }] },
  rows: [
    { __section: 'Direct paths' },
    { h: 'H1', path: 'Visual → Ability' },
    { __section: 'Indirect effects' },
    { h: 'H2', path: 'Visual → Ability → Achievement' },
  ],
}

describe('classicToLatex - internal section labels (__section, A6 device 3)', () => {
  const tex = classicToLatex(sectionedTable)
  it('renders a __section row as a full-width \\multicolumn italic label', () => {
    expect(tex).toContain('\\multicolumn{2}{l}{\\textit{Direct paths}} \\\\')
    expect(tex).toContain('\\multicolumn{2}{l}{\\textit{Indirect effects}} \\\\')
  })
  it('a __section row is not itself indented, and does not leave the following row indented', () => {
    expect(tex).toContain('H1 & Visual $\\rightarrow$ Ability \\\\')
    expect(tex).not.toContain('\\quad H1')
  })
})

// ── A6 device 2 (spanning headers) LaTeX twin - Table 5's two CI groups, 2026-07-06 ──
const spannedTable: BuiltTable = {
  spec: {
    id: 'structural-paths', title: 'Structural paths',
    columns: [
      { key: 'h', label: 'H' }, { key: 'path', label: 'Path' },
      { key: 'percLo', label: 'Lower', span: { group: 'Percentile 95% CI' } },
      { key: 'percHi', label: 'Upper', span: { group: 'Percentile 95% CI' } },
      { key: 'bcLo', label: 'Lower', span: { group: 'BC 95% CI' } },
      { key: 'bcHi', label: 'Upper', span: { group: 'BC 95% CI' } },
      { key: 'result', label: 'Result' },
    ],
  },
  rows: [{ h: 'H1', path: 'Visual → Ability', percLo: '.30', percHi: '.55', bcLo: '.29', bcHi: '.54', result: 'Supported' }],
}

describe('classicToLatex - spanning column headers (span.group, A6 device 2)', () => {
  const tex = classicToLatex(spannedTable)
  it('emits a 3-line header: group row (\\multicolumn, % escaped), \\cmidrule per group, then sub-labels', () => {
    // "95% CI" escapes to "95\% CI" - an unescaped % would start a LaTeX comment.
    expect(tex).toContain('H & Path & \\multicolumn{2}{c}{Percentile 95\\% CI} & \\multicolumn{2}{c}{BC 95\\% CI} & Result \\\\')
    expect(tex).toContain('\\cmidrule(lr){3-4} \\cmidrule(lr){5-6}')
    expect(tex).toContain(' &  & Lower & Upper & Lower & Upper &  \\\\')
  })
  it('a table with no spanned columns keeps the single-line header (byte-identical, classic path)', () => {
    const tex2 = classicToLatex(classic)
    expect(tex2.split('\n')[2]).toBe('Source & SS & p \\\\')
  })
})
```

Then, directly after the existing `describe('matrixToLatex', ...)` block:

```ts
// ── A6 device 4 (matrix upgrades) LaTeX twin, 2026-07-06 ──
const flStarred: BuiltTable = {
  spec: { id: 'fornell-larcker', title: 'Discriminant validity (Fornell-Larcker)', columns: [] },
  rows: [],
  matrix: {
    kind: 'matrix', id: 'fornell-larcker', caption: 'Discriminant validity (Fornell-Larcker)',
    rowLabels: ['visual', 'textual'], colLabels: ['visual', 'textual'],
    cells: [['.83', null], ['.42', '.79']],
    diagonalStyle: 'italic', lowerOnly: true,
    cellStars: [[null, null], ['***', null]],
    starNote: '*p<.05, **p<.01, ***p<.001',
  },
}

describe('matrixToLatex - devices (diagonalStyle, cellStars, starNote, A6 device 4)', () => {
  it('diagonalStyle:italic wraps the diagonal in \\textit, not \\textbf', () => {
    const tex = matrixToLatex(flStarred)
    expect(tex).toContain('\\textit{.83}')
    expect(tex).not.toContain('\\textbf')
  })
  it('diagonalStyle:bold behaves like the legacy diagonal:bold', () => {
    const tex = matrixToLatex({ ...flStarred, matrix: { ...flStarred.matrix!, diagonalStyle: 'bold' } })
    expect(tex).toContain('\\textbf{.83}')
  })
  it('appends the cellStars suffix directly after the cell value', () => {
    const tex = matrixToLatex(flStarred)
    expect(tex).toContain('.42***')
  })
  it('prints starNote as an italic line after \\end{tabular} (not inside the tabular)', () => {
    const tex = matrixToLatex(flStarred)
    const lines = tex.split('\n')
    expect(lines[lines.length - 2]).toBe('\\end{tabular}')
    expect(lines[lines.length - 1]).toContain('\\textit{*p$<$.05, **p$<$.01, ***p$<$.001}')
  })
  it('a matrix with none of the new fields renders exactly as before (byte-identical legacy path)', () => {
    expect(matrixToLatex(flMatrix)).toBe(
      '\\begin{tabular}{lccc}\n\\toprule\n & visual & textual & R\\&D \\\\\n\\midrule\nvisual & \\textbf{.74} &  &  \\\\\ntextual & .45 & \\textbf{.77} &  \\\\\nR\\&D & .30 & .52 & \\textbf{.71} \\\\\n\\bottomrule\n\\end{tabular}',
    )
  })
})
```

Run: `npx vitest run src/lib/export/rTable.test.ts --reporter=dot` - expected FAIL (8 new failures:
`classicToLatex`/`matrixToLatex` do not yet recognize `__group`/`__section`/`span`/`cellStars`/
`diagonalStyle`/`starNote`, so groups/sections render as plain rows, spanned columns render as plain
single-line headers, and matrix devices are silently dropped; the two "byte-identical legacy" cases
already pass).

**Step 2 - implementation.** In `src/lib/export/rTable.ts`:

Change the import line to:
```ts
import type { BuiltTable } from '../results/builders'
import type { ColumnDef, HeaderGroup } from '../registry/types'
import { headerGroups } from '../registry/types'
```

Replace `matrixToLatex` with:
```ts
/** A matrix BuiltTable (kind:'matrix' - Fornell-Larcker / HTMT / interfactor-Φ) → booktabs tabular.
 *  Mirrors ApaTable.tsx: blank corner + column labels header; one row per rowLabel; `lowerOnly` blanks
 *  the upper triangle; `diagonal:'bold'` bolds the diagonal. Data lives in t.matrix (spec.columns is empty).
 *  A6 device 4 (2026-07-06): `cellStars` appends a significance suffix after the cell value;
 *  `diagonalStyle` italicizes the diagonal (`'bold'` behaves like the legacy `diagonal:'bold'`);
 *  `starNote` prints as an italic line AFTER \end{tabular} - LaTeX export isn't rasterized (unlike
 *  the HTML <tfoot>, which has to sit inside the captured <table>), so plain trailing prose is fine. */
export function matrixToLatex(t: BuiltTable): string {
  const m = t.matrix!
  const n = m.colLabels.length
  const header = ' & ' + m.colLabels.map(cell).join(' & ') + ' \\\\'
  const body = m.rowLabels.map((rowLabel, i) => {
    const cells = m.colLabels.map((_, j) => {
      if ((m.lowerOnly && j > i) || m.cells[i][j] == null) return ''
      const star = m.cellStars?.[i]?.[j] ?? ''
      const c = cell(m.cells[i][j] ?? '') + escapeLatex(star)
      const isDiag = j === i
      if (isDiag && (m.diagonal === 'bold' || m.diagonalStyle === 'bold')) return `\\textbf{${c}}`
      if (isDiag && m.diagonalStyle === 'italic') return `\\textit{${c}}`
      return c
    })
    return `${cell(rowLabel)} & ${cells.join(' & ')} \\\\`
  })
  const lines = [`\\begin{tabular}{l${'c'.repeat(n)}}`, '\\toprule', header, '\\midrule', ...body, '\\bottomrule', '\\end{tabular}']
  if (m.starNote) lines.push(`\\textit{${escapeLatex(m.starNote)}}`)
  return lines.join('\n')
}

/** Two-row booktabs header for spanned columns (A6 device 2): row 1 = each spanned group's label via
 *  \multicolumn (or a plain column's own label, printed ONCE - row 2 leaves it blank, so no \multirow
 *  is needed); a \cmidrule(lr){..} under each spanned group; row 2 = the spanned group's sub-column
 *  labels only. Column positions for \cmidrule are 1-based and counted across ALL columns. */
function spannedHeaderLines(groups: HeaderGroup[]): string[] {
  let pos = 1
  const row1: string[] = []; const row2: string[] = []; const cmidrules: string[] = []
  for (const g of groups) {
    if (g.group != null) {
      row1.push(`\\multicolumn{${g.cols.length}}{c}{${escapeLatex(g.group)}}`)
      row2.push(...g.cols.map(flatLabel))
      cmidrules.push(`\\cmidrule(lr){${pos}-${pos + g.cols.length - 1}}`)
    } else {
      row1.push(flatLabel(g.cols[0]))
      row2.push('')
    }
    pos += g.cols.length
  }
  return [row1.join(' & ') + ' \\\\', cmidrules.join(' '), row2.join(' & ') + ' \\\\']
}

/** A classic BuiltTable → booktabs tabular from columns + rows. A6 devices (2026-07-06):
 *  spanned column headers (spec.columns[].span) → spannedHeaderLines (else the original single-line
 *  header, byte-identical); `__group` rows → a full-width ITALIC row (every column wrapped in
 *  \textit - NOT \multirow); `__section` rows → a \multicolumn italic label row; rows following a
 *  `__group` (until the next `__group`/`__section`) get a `\quad`-indented first cell. */
export function classicToLatex(t: BuiltTable): string {
  const cols = t.spec.columns
  const groups = headerGroups(cols)
  const hasSpan = groups.some((g) => g.group != null)
  const header = hasSpan ? spannedHeaderLines(groups) : [cols.map(flatLabel).join(' & ') + ' \\\\']
  let inGroup = false
  const body = t.rows.map((r) => {
    if ('__section' in r) { inGroup = false; return `\\multicolumn{${cols.length}}{l}{\\textit{${cell(r['__section'])}}} \\\\` }
    if ('__group' in r) { inGroup = true; return cols.map((c) => `\\textit{${cell(r[c.key])}}`).join(' & ') + ' \\\\' }
    const line = cols.map((c, i) => (inGroup && i === 0 ? `\\quad ${cell(r[c.key])}` : cell(r[c.key])))
    return line.join(' & ') + ' \\\\'
  })
  return [`\\begin{tabular}${colSpec(cols.length)}`, '\\toprule', ...header, '\\midrule', ...body, '\\bottomrule', '\\end{tabular}'].join('\n')
}
```

**Step 3 - run + verify.**
```
npx vitest run src/lib/export/rTable.test.ts src/lib/export/latex.test.ts --reporter=dot
```
Expected (observed): `Test Files  2 passed (2)` / `Tests  35 passed (35)` (the pre-existing
`latex.test.ts` integration suite - which drives `emitLatex` through real `SPECS`/builders that don't
use any A6 device yet - stays green, confirming the changes don't disturb the existing coef/classic/
matrix cards it covers).
```
npx tsc -b
```
Expected: clean, exit 0.

**Step 4 - full regression.**
```
npm run test:fast
```
Expected (observed): `Test Files  141 passed (141)` / `Tests  1224 passed (1224)` (+11 over the prior
task).

**Step 5 - commit.**
```
git add src/lib/export/rTable.ts src/lib/export/rTable.test.ts
git commit -m "$(cat <<'EOF'
feat(export): LaTeX twins for all four A6 devices

classicToLatex: __group rows render as a full-width ITALIC row (every column wrapped in \textit,
NOT \multirow); __section rows render as a \multicolumn italic label; rows following a __group get
a \quad-indented first cell; spanned columns (span.group) render a 3-line \multicolumn + \cmidrule
header (headerGroups() shared with the HTML renderer so the two can never disagree on grouping).
matrixToLatex: cellStars append after the cell value, diagonalStyle italicizes (bold behaves like
the legacy diagonal:'bold'), starNote prints as a line after \end{tabular}. Existing coef/classic/
matrix output is byte-identical when no card uses a device (regression-pinned + the existing
emitLatex integration suite stays green untouched).
EOF
)"
```

- [ ] Step 1 - failing tests added, 8 fail
- [ ] Step 2 - implementation
- [ ] Step 3 - 35/35 pass across both files, `tsc -b` clean
- [ ] Step 4 - `test:fast` 141/141 files, 1224/1224 tests
- [ ] Step 5 - commit

### U1-T6 - PNG/PDF-capture parity assertions

**Read first:** `src/lib/export/capture.ts` (`captureNode = async (id) => ... toPng(document.
getElementById(id) ...)`) and `src/components/ResultPreviewCard.tsx` (lines 22-45 - the ONLY place
`ApaTable` is mounted on-screen; it builds the classic-table id as `` `table-${t.spec.domId ?? t.spec.
id}` `` - the exact convention `captureNode` looks up - and passes `domId={t.spec.domId}` straight
through for matrix tables).

**Design reasoning (why this task needs no new production code):** there is exactly one component
that renders a results table (`ApaTable`), exactly one place that mounts it on-screen
(`ResultPreviewCard`), and `captureNode` for the table-PNG export is literally `toPng(document.
getElementById(id))` on that same live DOM - there is no separate "export template". The print-to-PDF
path (`tests/docs/document-tests.spec.ts`'s `page.pdf()` under `emulateMedia({media:'print'})`) prints
that same page. So PNG/PDF parity is an architectural property, not something to wire per device - as
long as (1) the captured id is unique and (2) every device's markup lands inside the `<table>` element
carrying that id (never a sibling), the devices are captured for free. This task is a **regression
test that locks that property**, plus a **cross-renderer check** that the LaTeX twin is built from the
exact same `BuiltTable`/`MatrixTable` object as the HTML render (so app/PNG/PDF/LaTeX can never
silently diverge on a device). Because U1-T1 through U1-T5 already built every device to render inside
the table (the `__section`/`row-group` rows are plain `<tr>`s inside `<tbody>`; the starNote is a
`<tfoot>` inside `<table>`, specifically because of this constraint - see U1-T4's note), this task is
expected to pass with **zero changes to `ApaTable.tsx`/`rTable.ts`**.

**Step 1 - write the test (there is no separate "make it fail first" step here: this task's job is to
prove an already-true invariant, not add new render behavior - if any assertion below fails, that is a
real regression in a prior task and must be fixed in `ApaTable.tsx`/`rTable.ts`, not in this test).**
Create `src/lib/export/tableDeviceParity.test.tsx` (note the `.tsx` extension - the file contains JSX,
and `vite:oxc` rejects JSX in a plain `.test.ts` file with a parse error):

```tsx
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { ApaTable } from '../../components/ApaTable'
import type { TableSpec } from '../registry/types'
import type { MatrixTable } from '../results/types'
import type { BuiltTable } from '../results/builders'
import { classicToLatex, matrixToLatex } from './rTable'

// PNG/PDF-capture parity (A6, 2026-07-06): the table PNGs (ResultsScreen.buildExportFiles) and the
// print-to-PDF path both rasterize/print the SAME on-screen DOM - there is no separate "export"
// template. captureNode(id) is literally `toPng(document.getElementById(id))` (src/lib/export/
// capture.ts); ResultPreviewCard mounts ApaTable with EXACTLY that id. So as long as (1) that id is
// unique and (2) every A6 device renders INSIDE the <table> element carrying it, the devices are
// captured for free - there is nothing device-specific left to wire for PNG/PDF. This suite locks
// that invariant (source-level wiring + DOM containment) and additionally proves the LaTeX twin is
// built from the SAME BuiltTable, so app/PNG/PDF/LaTeX can never silently diverge on a device.

describe('source wiring: one render path (no PNG-only table template)', () => {
  const resultPreviewCard = readFileSync(new URL('../../components/ResultPreviewCard.tsx', import.meta.url), 'utf8')
  const capture = readFileSync(new URL('./capture.ts', import.meta.url), 'utf8')

  it('ResultPreviewCard builds the classic-table id with the SAME convention captureNode looks up', () => {
    expect(resultPreviewCard).toContain('<ApaTable id={`table-${t.spec.domId ?? t.spec.id}`} spec={t.spec} rows={t.rows} />')
  })
  it('ResultPreviewCard passes domId straight through for matrix tables (ApaTable does its own table- prefixing)', () => {
    expect(resultPreviewCard).toContain('<ApaTable matrix={t.matrix} domId={t.spec.domId} />')
  })
  it('captureNode has exactly one lookup mechanism: getElementById + toPng, no alternate template', () => {
    expect(capture).toContain('document.getElementById(id)')
    expect(capture).toContain('toPng(')
  })
})

describe('DOM containment: every A6 device renders INSIDE the captured <table> element', () => {
  // Table 5's post-merge shape, carrying BOTH a spanned header and a section label - the two devices
  // most likely to accidentally render outside <table> (a two-row <thead> and a full-width body row).
  const spec: TableSpec = {
    id: 'structural-paths', title: 'Structural paths', columns: [
      { key: 'h', label: 'H' }, { key: 'path', label: 'Path' },
      { key: 'percLo', label: 'Lower', span: { group: 'Percentile 95% CI' } },
      { key: 'percHi', label: 'Upper', span: { group: 'Percentile 95% CI' } },
      { key: 'result', label: 'Result' },
    ],
  }
  const rows: Record<string, string | number>[] = [
    { __section: 'Direct paths' },
    { h: 'H1', path: 'Visual → Ability', percLo: '.30', percHi: '.55', result: 'Supported' },
  ]
  // The exact id convention ResultPreviewCard uses (asserted above), so this mirrors the real mount.
  const id = `table-${spec.id}`
  const html = renderToStaticMarkup(<ApaTable id={id} spec={spec} rows={rows} />)

  it('the captured id is unique in the output (getElementById resolves unambiguously)', () => {
    expect((html.match(new RegExp(`id="${id}"`, 'g')) ?? []).length).toBe(1)
  })

  it('the spanning header AND the section label both sit between <table ...> and </table>', () => {
    const tableBlock = html.match(/<table[^>]*>.*<\/table>/s)![0]
    expect(tableBlock).toContain('Percentile 95% CI')
    expect(tableBlock).toContain('Direct paths')
    // nothing about them leaks OUTSIDE the table into the wrapping <div>
    const outsideTable = html.replace(tableBlock, '')
    expect(outsideTable).not.toContain('Percentile 95% CI')
    expect(outsideTable).not.toContain('Direct paths')
  })

  it('a matrix starNote sits inside a <tfoot> WITHIN the same captured <table>, not a sibling element', () => {
    const matrix: MatrixTable = {
      kind: 'matrix', id: 'fornell-larcker', caption: 'Fornell-Larcker',
      rowLabels: ['Visual'], colLabels: ['Visual'], cells: [['.83']],
      diagonalStyle: 'italic', cellStars: [['*']], starNote: '*p<.05',
    }
    const h = renderToStaticMarkup(<ApaTable matrix={matrix} />)
    const tableBlock = h.match(/<table[^>]*>.*<\/table>/s)![0]
    expect(tableBlock).toContain('<tfoot>')
    expect(tableBlock).toContain('*p&lt;.05')
    expect(h.replace(tableBlock, '')).not.toContain('*p&lt;.05')
  })
})

describe('cross-renderer parity: the SAME BuiltTable feeds ApaTable (HTML/PNG/PDF) and the LaTeX twin', () => {
  const groupedSpanned: BuiltTable = {
    spec: {
      id: 'cfa-loadings', title: 'Measurement model', columns: [
        { key: 'path', label: 'Construct → Item' }, { key: 'cr', label: 'CR' },
      ],
    },
    rows: [
      { __group: 'Visual', path: 'Visual', cr: '.83' },
      { path: 'Visual → x1', cr: '' },
    ],
  }

  it('the group label + stat both appear in the HTML render and the LaTeX twin, from the same object', () => {
    const html = renderToStaticMarkup(<ApaTable id="table-cfa-loadings" spec={groupedSpanned.spec} rows={groupedSpanned.rows} />)
    const tex = classicToLatex(groupedSpanned)
    for (const needle of ['Visual', '.83']) {
      expect(html).toContain(needle)
      expect(tex).toContain(needle)
    }
  })

  const starred: BuiltTable = {
    spec: { id: 'fornell-larcker', title: 'Fornell-Larcker', columns: [] },
    rows: [],
    matrix: {
      kind: 'matrix', id: 'fornell-larcker', caption: 'Fornell-Larcker',
      rowLabels: ['Visual', 'Textual'], colLabels: ['Visual', 'Textual'],
      cells: [['.83', null], ['.42', '.79']], diagonalStyle: 'italic', lowerOnly: true,
      cellStars: [[null, null], ['***', null]], starNote: '*p<.05, **p<.01, ***p<.001',
    },
  }

  it('matrix stars + starNote appear in BOTH the HTML render and the LaTeX twin, from the same object', () => {
    const html = renderToStaticMarkup(<ApaTable matrix={starred.matrix!} />)
    const tex = matrixToLatex(starred)
    expect(html).toContain('.42***'); expect(tex).toContain('.42***')
    expect(html.toLowerCase()).toContain('*p&lt;.05'); expect(tex).toContain('*p$<$.05')
  })
})
```

**Step 2 - run + verify.**
```
npx vitest run src/lib/export/tableDeviceParity.test.tsx --reporter=verbose
```
Expected (observed): all 8 tests pass on the first run, with **no production-code change** -
confirming the architecture already guarantees parity by construction:
```
Test Files  1 passed (1)
     Tests  8 passed (8)
```
```
npx tsc -b
```
Expected: clean, exit 0.

**Step 3 - full regression + build.**
```
npm run test:fast
```
Expected (observed): `Test Files  142 passed (142)` / `Tests  1232 passed (1232)` (+1 file, +8 tests
over the prior task).
```
npm run build
```
Expected: `tsc -b` clean, `vite build` succeeds (observed: `✓ built in 560ms`, the usual >500kB main
chunk size warning only - pre-existing, unrelated to this unit).

**Step 4 - commit.**
```
git add src/lib/export/tableDeviceParity.test.tsx
git commit -m "$(cat <<'EOF'
test(export): PNG/PDF-capture parity for all four A6 devices

Locks the invariant that makes device-specific PNG/PDF wiring unnecessary: ResultPreviewCard
mounts ApaTable with the exact id captureNode's getElementById looks up (one render path, no
PNG-only template), every device (group/section/span/matrix-stars) renders strictly inside the
<table> element carrying that id (regression-pinned via DOM-containment string checks - the
starNote's <tfoot> placement specifically depends on this), and the LaTeX twin is built from the
identical BuiltTable/MatrixTable object as the HTML render, so app/PNG/PDF/LaTeX cannot silently
diverge on a device. Passes with zero ApaTable.tsx/rTable.ts changes, confirming devices 1-4 (this
unit) already satisfy export ≡ app.
EOF
)"
```

- [ ] Step 1 - parity test file added
- [ ] Step 2 - 8/8 pass on first run (no prod-code change), `tsc -b` clean
- [ ] Step 3 - `test:fast` 142/142 files, 1232/1232 tests; `npm run build` succeeds
- [ ] Step 4 - commit

---

## Unit 1 summary gate

After all 6 tasks: `npx tsc -b` clean · `npm run build` succeeds · `npm run test:fast` green at
142 files / 1232 tests (measured on top of current `main`, before Unit 0 lands; add Unit 0's 2
`SemCanvas.test.tsx` tests and its 2 doc-artifact-touching files if Unit 0 has already landed by the
time Unit 1 executes - the two units touch disjoint files, so the deltas simply add). Files touched:
`src/lib/registry/types.ts` (+`span` on `ColumnDef`, +`HeaderGroup`/`headerGroups`),
`src/lib/results/types.ts` (+`diagonalStyle`/`cellStars`/`starNote` on `MatrixTable`),
`src/components/ApaTable.tsx` (both classic and matrix branches), `src/styles/tokens.css`,
`src/lib/export/rTable.ts` (`classicToLatex`/`matrixToLatex`). New test files:
`src/lib/registry/types.test.ts`, `src/lib/export/tableDeviceParity.test.tsx`. No card's registry
entry or builder is touched - Units 3 and 6 consume these devices later.

# Unit 2 + Unit 3 — per-task detail

> Drafted against `docs/superpowers/plans/2026-07-06-telos-citable-complete.md` (skeleton) and
> `docs/superpowers/specs/2026-07-06-telos-citable-complete-design.md` (§A1+A2+A3, Global Constraints,
> Interfaces). Every native-R reference number below was computed fresh, just now, via local `Rscript`
> (lavaan 0.6-21 / semTools) against the repo's own fixtures and the spike's exact model shapes — not
> copied blind from the spike doc. Where a number coincides with the spike report, that is a genuine
> cross-check (point estimates are seed-independent; only bootstrap CI bounds move with the seed), not a
> reused fixture.
>
> Global constraints apply to every task below without restatement: TDD; `test:fast` green after each
> task; plain commit messages (no Co-Authored-By/session trailers, no em dashes); export ≡ app same
> task/unit where an export format is touched; APA numeric style (`f`/`f01`/`fp`/`fdf`/`fx` from
> `src/lib/format/apa.ts`); native-R verification with a worked fixture for every new statistic.

---

## Unit 2 — CB-SEM runner statistics (6 tasks)

Files at the center of this unit: `src/lib/stats/runCbSem.ts`, `src/lib/stats/runCbSem.test.ts`,
`src/lib/stats/cfaReliability.ts`, `src/lib/stats/cfaReliability.test.ts`, `src/state/session.ts`.

### U2-T1 — Item Mean/SD per missing-setting (`itemStats`)

**Read first:** `src/lib/stats/runCbSem.ts` lines 231-260 (the `rows`/`usedCols`/`item_cols_flat`
assembly) and `src/components/SemControls.tsx` lines 15-21 (the REAL `missing` option: `fiml` | `mi` |
`pairwise` | `listwise`, default `fiml`, already wired into `setup.options.missing` via
`SemControls`/`s.setOption`). **Known, out-of-scope limitation to acknowledge in a code comment, not
fix:** `runCbSem.ts` currently always listwise-deletes for the model fit itself regardless of this
option — the option is real in the UI/store but the estimator does not yet branch on it. This task
does NOT change model-fitting; it only makes the item-level descriptive table honor the setting, per
spec A1 Table 1: "computed on the estimation sample as defined by the missing-data setting (listwise →
listwise N; FIML/MI → observed-per-item N)". Pairwise buckets with FIML/MI (observed-per-item N) since
a single item's own mean/SD is unaffected by pairwise-vs-FIML distinctions.

**Design:** pure TypeScript, no WebR round-trip needed (mean/SD of a numeric column doesn't need R).

```ts
// src/lib/stats/runCbSem.ts (new, alongside `listwise`)
export interface ItemStat { construct: string; item: string; mean: number; sd: number; n: number }

function sampleMeanSd(values: number[]): { mean: number; sd: number } {
  const n = values.length
  const mean = values.reduce((a, b) => a + b, 0) / n
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) // matches R's sd() (n-1)
  return { mean, sd: Math.sqrt(variance) }
}

/** Table 1 item Mean/SD (design §A1). listwise → the SAME estimation-sample rows the model fit uses
 *  (single shared N); fiml/mi/pairwise → each item's own observed (non-null, finite) values from the
 *  RAW dataset, independent per item (N varies by item). Does not change how the model itself is fit
 *  (known gap, tracked separately — the fit is always listwise today regardless of this setting). */
function computeItemStats(
  data: Dataset,
  constructs: Construct[],
  listwiseRows: Record<string, unknown>[],
  missing: string,
): ItemStat[] {
  const useListwise = missing === 'listwise'
  return constructs.flatMap((c) =>
    c.items.map((item) => {
      const values = useListwise
        ? (listwiseRows.map((r) => r[item]) as number[])
        : (data.rows.map((r) => r[item]).filter(
            (v): v is number => typeof v === 'number' && Number.isFinite(v),
          ))
      const { mean, sd } = sampleMeanSd(values)
      return { construct: c.name, item, mean, sd, n: values.length }
    }),
  )
}
```

Wire into `runCbSem`: after `const rows = listwise(data, usedCols)` (line ~252), compute
`const itemStats = isPath ? [] : computeItemStats(data, constructs, rows, String(setup.options['missing'] ?? 'listwise'))`
and add `itemStats` to the returned `CbSemResult` (new field, empty array in path mode — no measurement
items to describe).

**Test — `src/lib/stats/runCbSem.test.ts`** (append a new `describe`, no WebR engine needed — pure
function, fast):

```ts
describe('computeItemStats — item Mean/SD per missing-setting', () => {
  // Fixture: tests/e2e/fixtures/scale.csv (HolzingerSwineford x1..x9, n=301, complete) with 5 rows of
  // x1 and 5 (different, non-overlapping) rows of x4 blanked to null — exercises listwise (shared N,
  // rows with ANY blank dropped) vs fiml/mi/pairwise (each item's own N). Reference values computed
  // 2026-07-06 via native Rscript (blank d$x1[1:5], d$x4[11:15]; sd() is n-1 sample SD, matching
  // sampleMeanSd here):
  //   observed-per-item: x1 N=296 mean=4.940315 sd=1.172826 · x4 N=296 mean=3.055180 sd=1.162647
  //                       x2 (untouched) N=301 mean=6.088040 sd=1.177451
  //   listwise (rows with ANY of x1..x9 blank dropped, N=291):
  //                       x1 mean=4.932417 sd=1.175751 · x4 mean=3.072165 sd=1.162202 · x2 mean=6.097079 sd=1.180400
  it('fiml/mi/pairwise use each item\'s own observed N; listwise uses the shared estimation-sample N', async () => {
    const raw = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/scale.csv'))
    const rows = raw.rows.map((r) => ({ ...r }))
    for (let i = 0; i < 5; i++) rows[i] = { ...rows[i], x1: null }
    for (let i = 10; i < 15; i++) rows[i] = { ...rows[i], x4: null }
    const data: Dataset = { columns: raw.columns, rows }
    const constructs: Construct[] = [
      { id: 1, name: 'visual', items: ['x1', 'x2', 'x3'] },
      { id: 2, name: 'textual', items: ['x4', 'x5', 'x6'] },
      { id: 3, name: 'speed', items: ['x7', 'x8', 'x9'] },
    ]
    const usedCols = constructs.flatMap((c) => c.items)
    const listwiseRows = data.rows.filter((r) => usedCols.every((c) => typeof r[c] === 'number' && Number.isFinite(r[c] as number)))
    expect(listwiseRows.length).toBe(291)

    const fiml = computeItemStats(data, constructs, listwiseRows, 'fiml')
    const x1f = fiml.find((s) => s.item === 'x1')!
    const x4f = fiml.find((s) => s.item === 'x4')!
    const x2f = fiml.find((s) => s.item === 'x2')!
    expect(x1f.n).toBe(296); expect(x1f.mean).toBeCloseTo(4.940315, 5); expect(x1f.sd).toBeCloseTo(1.172826, 5)
    expect(x4f.n).toBe(296); expect(x4f.mean).toBeCloseTo(3.055180, 5); expect(x4f.sd).toBeCloseTo(1.162647, 5)
    expect(x2f.n).toBe(301); expect(x2f.mean).toBeCloseTo(6.088040, 5); expect(x2f.sd).toBeCloseTo(1.177451, 5)

    const listwise = computeItemStats(data, constructs, listwiseRows, 'listwise')
    const x1l = listwise.find((s) => s.item === 'x1')!
    const x4l = listwise.find((s) => s.item === 'x4')!
    const x2l = listwise.find((s) => s.item === 'x2')!
    expect(x1l.n).toBe(291); expect(x1l.mean).toBeCloseTo(4.932417, 5); expect(x1l.sd).toBeCloseTo(1.175751, 5)
    expect(x4l.n).toBe(291); expect(x4l.mean).toBeCloseTo(3.072165, 5); expect(x4l.sd).toBeCloseTo(1.162202, 5)
    expect(x2l.n).toBe(291); expect(x2l.mean).toBeCloseTo(6.097079, 5); expect(x2l.sd).toBeCloseTo(1.180400, 5)

    // pairwise buckets with fiml/mi (observed-per-item), not with listwise
    const pairwise = computeItemStats(data, constructs, listwiseRows, 'pairwise')
    expect(pairwise.find((s) => s.item === 'x1')!.n).toBe(296)
  })
})
```

Export `computeItemStats`/`ItemStat`/`sampleMeanSd` from `runCbSem.ts` (add to existing exports) so the
test can import them directly; also extend the existing full-pipeline `runCbSem` tests (the Bollen
PoliticalDemocracy `it(...)` at line 46) with one assertion: `expect(result.itemStats).toHaveLength(11)`
and `expect(result.itemStats.find(s => s.item === 'x2')!.mean).toBeGreaterThan(0)` (loose — the existing
fixture is complete-case, so listwise/fiml agree; the precision case lives in the dedicated test above).

**Commands:** `npm run test:fast -- runCbSem` then full `npm run test:fast`.
**Commit:** `feat(cb-sem): item Mean/SD per missing-data setting (itemStats)`

---

### U2-T2 — Latent-correlation p-values (`corLvP`, Fornell-Larcker ψ block)

**Read first:** `src/lib/stats/cfaReliability.ts` (full file) — it ALREADY fits a plain multi-construct
CFA and computes `fornellLarcker`/`htmt`/`labels`, but `runCbSem.ts` line 294
(`const cfa = await runCfaReliability(...)`) only reads `cfa.perConstruct` into `reliability` and
**silently discards** `cfa.fornellLarcker`/`cfa.htmt`/`cfa.labels`. This task (a) adds `corLvP` (latent
correlation p-values, from the ψ block = `standardizedSolution()` rows where `op=="~~"` and
`lhs!=rhs`) to `cfaReliability.ts`'s R script and result type, and (b) plumbs `fornellLarcker` / `htmt`
/ `labels` / `corLvP` through into `CbSemResult` (no new R computation needed for the first three — they
already exist and were being thrown away).

**R script change** (`cfaReliability.ts`, inside `R_STATS`, right after the existing `htmt_mat`/
`htmt_ordered` block):

```r
# Latent correlation p-values (ψ block): standardizedSolution() op=="~~" rows among the k constructs.
ss <- lavaan::standardizedSolution(fit)
p_mat <- matrix(NA_real_, k, k, dimnames = list(construct_names, construct_names))
for (i in seq_len(k)) for (j in seq_len(k)) {
  if (i == j) next
  ni <- construct_names[i]; nj <- construct_names[j]
  row <- ss[ss$op == "~~" & ((ss$lhs == ni & ss$rhs == nj) | (ss$lhs == nj & ss$rhs == ni)), ]
  if (nrow(row) > 0) p_mat[i, j] <- as.numeric(row$pvalue[1])
}
corlvp_rows <- lapply(seq_len(k), function(i) as.numeric(p_mat[i, ]))
```

Add `corLvP = corlvp_rows` to the returned R `list(...)`; add `corLvP: number[][]` to
`CfaReliabilityResult` and the local `RawResult` interface in `runCfaReliability`; return it unchanged
(already a plain pass-through, no TS-side transform needed — mirrors `fornellLarcker`/`htmt`).

**Test — `src/lib/stats/cfaReliability.test.ts`** (extend the existing `describe('cfaReliability', ...)`
block; same HolzingerSwineford fixture/model already committed there):

```ts
// Latent correlation p-values (ψ block, standardizedSolution op=="~~"). Derived 2026-07-06 via native
// Rscript on the SAME model (visual/textual/speed, std.lv=FALSE):
//   visual-textual: z=7.189 p<.001 · visual-speed: z=6.461 p<.001 · textual-speed: z=4.117 p<.001
// (all three off-diagonal correlations are highly significant on this fixture — the assertions below
// check the precise z-derived significance boundary, not just "significant", by pinning p below 1e-4).
it('corLvP carries the latent-correlation p-values (Fornell-Larcker significance stars)', async () => {
  const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/scale.csv'))
  const result = await runCfaReliability(data === undefined ? data : data, CONSTRUCTS) // keep call shape identical to the test above
  expect(result.corLvP).toHaveLength(3)
  expect(result.corLvP[0][1]).toBeLessThan(0.0001) // visual-textual
  expect(result.corLvP[0][2]).toBeLessThan(0.0001) // visual-speed
  expect(result.corLvP[1][2]).toBeLessThan(0.0001) // textual-speed
  expect(result.corLvP[0][1]).toBeCloseTo(result.corLvP[1][0], 10) // symmetric
  expect(Number.isNaN(result.corLvP[0][0])).toBe(true) // diagonal undefined (self-correlation)
})
```
(Use `engine`/`beforeAll`/`afterAll` already declared in the surrounding `describe` — just add the `it`.)

**Wire into `runCbSem.ts`:** after the existing `if (!isPath) { const cfa = await runCfaReliability(...) ... }`
block (line ~292-298), also read `cfa.fornellLarcker`, `cfa.htmt`, `cfa.labels`, `cfa.corLvP` and add
`fornellLarcker`, `htmt`, `corLvP`, `discriminantLabels` to the returned `CbSemResult` (all `[]`/`{}`
default when `isPath`). Add matching fields to the `CbSemResult` interface.

**Test — `src/lib/stats/runCbSem.test.ts`** (extend the Bollen PoliticalDemocracy `it(...)`):
```ts
// Latent correlation p-values on the SAME ind60/dem60/dem65 measurement model (CFA-only fit, distinct
// from the structural sem() fit above). Derived 2026-07-06 via native Rscript (cfa(), std.lv=FALSE):
//   ind60-dem60: z=4.393 p<.001 · ind60-dem65: z=6.195 p<.001 · dem60-dem65: z=37.483 p<.001
expect(result.corLvP).toHaveLength(3)
expect(result.corLvP[0][1]).toBeLessThan(0.0001)
expect(result.corLvP[1][2]).toBeLessThan(0.0001)
expect(result.fornellLarcker).toHaveLength(3)
expect(result.htmt).toHaveLength(3)
expect(result.discriminantLabels).toEqual(['ind60', 'dem60', 'dem65'])
```

**Commands:** `npm run test:fast -- cfaReliability runCbSem`.
**Commit:** `feat(cb-sem): latent-correlation p-values (corLvP) + plumb Fornell-Larcker/HTMT through the CB-SEM runner`

---

### U2-T3 — Dual CIs (percentile + bca.simple) from ONE bootstrap run + the ciType fix

**Read first:** `docs/superpowers/reviews/2026-07-06-moderation-spike.md` §5.2 (bca.simple recipe,
"index by label" footgun — not directly relevant here since this task doesn't do post-hoc derived
quantities, but the boot.ci.type discipline is the same package); `runCbSem.ts` lines 70-75 (the
existing single `pe <- parameterEstimates(fit, boot.ci.type = ci_type, level = 0.95)` call) and line 264
(`const ci_type = setup.options['ciType'] === 'bca' ? 'bca' : 'perc'` — the dead mapping: `'bca'` is not
a valid lavaan `boot.ci.type`; only `'perc'`/`'basic'`/`'norm'`/`'bca.simple'` are).

**Design:** compute BOTH CI types from the SAME fitted object (`parameterEstimates()` recomputes CIs
from the stored bootstrap draws already on `fit@boot` — it does not re-run the bootstrap, so calling it
twice is free and preserves "ONE bootstrap run" per the spec). `ci_type`/`setup.options['ciType']` stops
gating CI computation (dual CI is now unconditional whenever `has_indirect`); the literal dead-mapping
line is still fixed as instructed since it remains reachable through the option's stored value even
though it's no longer read for CI selection.

**R script change** (`runCbSem.ts`, replace the single `pe <- parameterEstimates(...)` line inside the
`if (has_indirect) { ... }` branch):

```r
if (has_indirect) {
  fit <- lavaan::sem(model_str, data = d, se = "bootstrap", bootstrap = as.integer(nboot))
  pe_perc <- lavaan::parameterEstimates(fit, boot.ci.type = "perc", level = 0.95)
  pe_bc   <- lavaan::parameterEstimates(fit, boot.ci.type = "bca.simple", level = 0.95)
  pe <- pe_perc # pe stays the primary table (est/se/z/p unaffected by CI-type choice)
} else {
  fit <- lavaan::sem(model_str, data = d)
  pe <- lavaan::parameterEstimates(fit, level = 0.95)
  pe_bc <- pe # no bootstrap → no distinct BC column; ci.lower/upper below are simply absent (NA)
}
```

In `struct_rows` (the `lapply(seq_along(path_from), ...)` block), add BC lookups alongside the existing
`m <- which(pe_reg$lhs == tnm & pe_reg$rhs == fnm)[1]`:
```r
pe_bc_reg <- pe_bc[pe_bc$op == "~", ]
mb <- which(pe_bc_reg$lhs == tnm & pe_bc_reg$rhs == fnm)[1]
```
and add to the returned `list(...)` for each row: `ciPercLower = as.numeric(pe_reg$ci.lower[m])`,
`ciPercUpper = as.numeric(pe_reg$ci.upper[m])`,
`ciBcLower = if (has_indirect) as.numeric(pe_bc_reg$ci.lower[mb]) else NA_real_`,
`ciBcUpper = if (has_indirect) as.numeric(pe_bc_reg$ci.upper[mb]) else NA_real_`
(keep the existing `ciLower`/`ciUpper` fields too — those already come from `standardizedSolution()`'s
delta-method CI on the STANDARDIZED estimate, a different quantity the spec keeps: "Std. β is point-only
… the table note states this" — so `ciLower`/`ciUpper` stay as-is, unrelated to the new unstandardized
dual-CI columns).

Same pattern in `indirect_rows`: add `ciPercLower`/`ciPercUpper` (from `pe_perc`, `op==":="`) and
`ciBcLower`/`ciBcUpper` (from `pe_bc`, `op==":="`).

**TS fix (line 264):**
```ts
// was: const ci_type = setup.options['ciType'] === 'bca' ? 'bca' : 'perc'   // 'bca' is not a valid
// lavaan boot.ci.type — dead code, would error if ever reached (design §A2 fix).
const ci_type = setup.options['ciType'] === 'bca' ? 'bca.simple' : 'perc' // vestigial: dual CI (below)
// is now computed unconditionally whenever has_indirect; ci_type is kept only so the option round-trips
// without erroring, not to gate which CI type is present.
```
Extend `CbSemResult['structural']`/`['indirect']` row shape with `ciPercLower`/`ciPercUpper`/
`ciBcLower`/`ciBcUpper` (all `number | null`).

**Test — `src/lib/stats/runCbSem.test.ts`:** bump `SETUP.options.nboot` from `50` to `200` (still fast;
this is also the number needed for a clean bca.simple run — nboot=50 produced 15 "nonadmissible
solutions" warnings against this fixture; nboot=200 produced 0). Reference values computed 2026-07-06
via native Rscript, EXACT model the runner builds (`dem60 ~ p_1_2*ind60`, `dem65 ~ p_2_3*dem60 + p_1_3*ind60`,
`ie_1_2_3 := p_1_2*p_2_3`), `set.seed(20260620)` (the runner's existing hardcoded seed),
`bootstrap=200`, both `boot.ci.type="perc"` and `"bca.simple"` on the SAME fit:

```ts
// Dual-CI reference (native R 4.6.0, seed 20260620, bootstrap=200 — same fit, both CI types):
//   p_1_2 (ind60->dem60): est=1.474 · percentile CI [0.769, 2.068] · bca.simple CI [0.772, 2.072]
//   p_2_3 (dem60->dem65): est=0.864 · percentile CI [0.677, 1.088] · bca.simple CI [0.659, 1.079]
//   p_1_3 (ind60->dem65): est=0.453 · percentile CI [0.013, 0.921] · bca.simple CI [0.023, 0.994]
//   ie_1_2_3 (indirect): est=1.274 · percentile CI [0.550, 2.004] · bca.simple CI [0.544, 1.999]
const p12b = s.find((r) => r.from === 1 && r.to === 2)!
expect(Number(p12b.ciPercLower)).toBeCloseTo(0.769, 2)
expect(Number(p12b.ciPercUpper)).toBeCloseTo(2.068, 2)
expect(Number(p12b.ciBcLower)).toBeCloseTo(0.772, 2)
expect(Number(p12b.ciBcUpper)).toBeCloseTo(2.072, 2)
const p23b = s.find((r) => r.from === 2 && r.to === 3)!
expect(Number(p23b.ciPercLower)).toBeCloseTo(0.677, 2)
expect(Number(p23b.ciBcLower)).toBeCloseTo(0.659, 2)
const p13b = s.find((r) => r.from === 1 && r.to === 3)!
expect(Number(p13b.ciPercLower)).toBeCloseTo(0.013, 2)
expect(Number(p13b.ciBcLower)).toBeCloseTo(0.023, 2)
const ieb = result.indirect![0]
expect(Number(ieb.ciPercLower)).toBeCloseTo(0.550, 2)
expect(Number(ieb.ciPercUpper)).toBeCloseTo(2.004, 2)
expect(Number(ieb.ciBcLower)).toBeCloseTo(0.544, 2)
expect(Number(ieb.ciBcUpper)).toBeCloseTo(1.999, 2)
```

Also add a unit test (no engine) asserting the literal fix: build a tiny setup with
`options: { ciType: 'bca' }` and assert the internal `ci_type` value reaching the R env is `'bca.simple'`
— since `ci_type` isn't exported, do this by asserting on `env` via a thin exported test-only helper, OR
(simpler, matching existing test style) assert behaviorally: run the Bollen setup with
`options: { ...SETUP.options, ciType: 'bca' }` and confirm it does NOT throw (a literal `'bca'` string
passed to `boot.ci.type` would raise an R error — "would error if ever reached" per the design note — so
"does not throw" is the correct regression guard here).

**Commands:** `npm run test:fast -- runCbSem`.
**Commit:** `fix(cb-sem): dual percentile+BC(bca.simple) CIs from one bootstrap run; fix dead ciType mapping`

---

### U2-T4 — indProd model assembly (equal `match=TRUE`; unequal `match=FALSE` + disclosure)

**Read first:** `docs/superpowers/reviews/2026-07-06-moderation-spike.md` (full — the indProd recipe,
citations, "no new shim" finding) and `.superpowers/sdd/spike-moderation/moderation-spike-cbsem-ext.R`
lines 101-132 (the unequal 4x3 `match=FALSE` block + the `match=TRUE` error message on unequal counts:
`"If the match-paired approach is used, the number of variables in all sets must be equal."`). Study
`buildModel()` in `runCbSem.ts` lines 180-218 (the label scheme `p_<from>_<to>`, the auto indirect-def
loop) — this task extends the SAME function, it does not replace it.

**Types — `src/state/session.ts`** (beside `StructuralPath`):
```ts
export interface Moderation { id: number; moderatorId: number; pathIndex: number } // moderatorId: construct id of the moderator · pathIndex: index into `paths` of the edge being moderated
```
Add `moderations?: Moderation[]` to `TestSetup`.

**Design decision (recorded, not a deviation — the spike's own model requires it):** moderated-regression
convention (Aiken & West 1991) requires BOTH the interaction term AND the moderator's own main effect in
the same regression alongside the original path's source. The spike's proven model is exactly
`TI ~ b1*SN + b2*TA + b3*SNTA` — TA (the moderator) is a full covariate of the target even though only
`SN → TI` was drawn as a path. `buildModel` auto-injects the moderator main effect ONLY when the
moderator isn't already an existing predictor of that target.

**`buildModel` extension** (`runCbSem.ts`):
```ts
function buildModel(
  constructs: Construct[],
  paths: StructuralPath[],
  isPath: boolean,
  rNameOf: (id: number) => string,
  moderations: Moderation[] = [],
): { model: string; hasIndirect: boolean; indirectDefs: ...; moderationDefs: ModerationDef[] } {
  // ... existing measurement + structural + indirect-def lines unchanged up to the targets loop ...

  // Guards (design §A7): no self-moderation, no duplicate, not in path mode, ML-family only.
  for (const mod of moderations) {
    const path = paths[mod.pathIndex]
    if (!path) throw new Error(`Moderation references paths[${mod.pathIndex}], which does not exist.`)
    if (mod.moderatorId === path.from || mod.moderatorId === path.to) {
      throw new Error('A construct cannot moderate a path it is already the source or target of.')
    }
  }
  if (isPath && moderations.length) {
    throw new Error('Latent moderation is not available in path-analysis (observed-only) mode.')
  }
  const seen = new Set<string>()
  for (const mod of moderations) {
    const key = `${mod.moderatorId}:${mod.pathIndex}`
    if (seen.has(key)) throw new Error('Duplicate moderation: the same moderator already moderates this path.')
    seen.add(key)
  }

  const byId = new Map(constructs.map((c) => [c.id, c]))
  const moderationDefs: ModerationDef[] = []
  for (const mod of moderations) {
    const path = paths[mod.pathIndex]
    const source = byId.get(path.from)!
    const target = byId.get(path.to)!
    const moderator = byId.get(mod.moderatorId)!
    const matched = source.items.length === moderator.items.length
    const intName = `INT_${mod.id}`
    const modLabel = `pmod_${mod.id}`
    const intLabel = `pint_${mod.id}`
    const varLabel = `vmod_${mod.id}`

    // Product-indicator naming REPLICATES semTools::indProd exactly (var1[i].var2[j], match=TRUE:
    // i==j pairs only, match=FALSE: all i,j pairs) — the R side calls indProd() with the SAME
    // var1/var2 item lists in the SAME order, so the names line up without a round trip.
    const prodNames = matched
      ? source.items.map((it, i) => `${it}.${moderator.items[i]}`)
      : source.items.flatMap((a) => moderator.items.map((b) => `${a}.${b}`))
    lines.push(`${intName} =~ ${prodNames.join(' + ')}`)

    // Moderator main-effect covariate on the target, UNLESS an existing drawn path already predicts it.
    const alreadyPredicts = paths.some((p) => p.from === mod.moderatorId && p.to === path.to)
    const extra = (alreadyPredicts ? '' : ` + ${modLabel}*${rNameOf(mod.moderatorId)}`) + ` + ${intLabel}*${intName}`
    const targetLineIdx = lines.findIndex((l) => l.startsWith(`${rNameOf(path.to)} ~ `))
    lines[targetLineIdx] += extra
    lines.push(`${rNameOf(mod.moderatorId)} ~~ ${varLabel}*${rNameOf(mod.moderatorId)}`)

    moderationDefs.push({
      id: mod.id, moderatorName: moderator.name, pathLabel: `${source.name} → ${target.name}`,
      matched, intLabel, modLabel, varLabel, pathLabel_: `p_${path.from}_${path.to}`,
      var1: source.items, var2: moderator.items,
    })
  }

  return { model: lines.join('\n'), hasIndirect: indirectDefs.length > 0, indirectDefs, moderationDefs }
}
```
(`ModerationDef` is a small internal interface carrying what the R env needs — item lists per moderation
for the `indProd()` calls, and the labels for pulling estimates back out.)

**R script addition** (`R_STATS`, before the model is fit — one `indProd()` call per moderation, folded
into `d` before `sem()`; env carries `mod_var1_flat`/`mod_var2_flat`/`mod_var1_lens`/`mod_var2_lens`/
`mod_matched` arrays, same flattening convention as `item_cols_flat`):
```r
if (length(mod_ids) > 0) {
  suppressMessages(library(semTools))
  v1_start <- 1L; v2_start <- 1L
  for (mi in seq_along(mod_ids)) {
    v1 <- mod_var1_flat[v1_start:(v1_start + mod_var1_lens[mi] - 1L)]; v1_start <- v1_start + mod_var1_lens[mi]
    v2 <- mod_var2_flat[v2_start:(v2_start + mod_var2_lens[mi] - 1L)]; v2_start <- v2_start + mod_var2_lens[mi]
    d <- indProd(d, var1 = v1, var2 = v2, match = as.logical(mod_matched[mi]), meanC = TRUE, doubleMC = TRUE)
  }
}
```

Guard (design §A7 — "blocked under WLSMV/ordinal … forces ML"): in `runCbSem()` (TS), before building
the model, `if ((setup.moderations?.length ?? 0) > 0 && setup.options['estimator'] === 'WLSMV') throw
new Error('Latent moderation requires an ML-family estimator (ML or MLR); switch off WLSMV or remove the
moderation edge.')` — a synchronous check ahead of any `engine.runJson` call, so it's testable without
WebR.

Wire `moderationDefs` results into a new `moderation: { rows: ModerationRow[] } | undefined` field on
`CbSemResult` (interaction-term row per moderation: `moderatorName`, `pathLabel` (e.g. `SN → TI × TA`),
`b`, `se`, `z`, `p`, `stdBeta`, `ciPercLower/Upper`, `ciBcLower/Upper` (dual CI from U2-T3's plumbing —
moderation ALWAYS bootstraps, see below), `matched`, and `disclosure?: string` (populated only when
`!matched`, fixed text: `'Moderator and the path's source construct have unequal indicator counts;
product indicators use all possible pairs (match=FALSE, double mean-centered) rather than matched pairs
— see Marsh, Wen & Hau (2004) for the matched-pairs method used when counts are equal.'`).

**Test — new `src/lib/stats/runCbSem.moderation.test.ts`** (pure, no engine — tests `buildModel`'s guard
logic and product-indicator naming directly; export `buildModel` for testing):
```ts
describe('buildModel — moderation guards + naming (pure, no WebR)', () => {
  const constructs = [
    { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
    { id: 2, name: 'TA', items: ['ta1', 'ta2', 'ta3', 'ta4'] },
    { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
  ]
  const paths = [{ from: 1, to: 3 }]

  it('rejects self-moderation (moderator is the path source or target)', () => {
    expect(() => buildModel(constructs, paths, false, rNameOf, [{ id: 1, moderatorId: 1, pathIndex: 0 }])).toThrow(/source or target/)
  })
  it('rejects a duplicate moderation (same moderator, same path)', () => {
    const mods = [{ id: 1, moderatorId: 2, pathIndex: 0 }, { id: 2, moderatorId: 2, pathIndex: 0 }]
    expect(() => buildModel(constructs, paths, false, rNameOf, mods)).toThrow(/Duplicate moderation/)
  })
  it('rejects moderation in path-analysis (observed-only) mode', () => {
    expect(() => buildModel(constructs, paths, true, rNameOf, [{ id: 1, moderatorId: 2, pathIndex: 0 }])).toThrow(/path-analysis/)
  })
  it('matched (equal counts) product-indicator names follow semTools var1[i].var2[i]', () => {
    const { model } = buildModel(constructs, paths, false, rNameOf, [{ id: 1, moderatorId: 2, pathIndex: 0 }])
    expect(model).toContain('INT_1 =~ sn1.ta1 + sn2.ta2 + sn3.ta3 + sn4.ta4')
    expect(model).toContain('TI ~ p_1_3*SN + pmod_1*TA + pint_1*INT_1')
  })
  it('unequal counts use match=FALSE all-pairs naming (var1[i].var2[j])', () => {
    const ta3 = [{ id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] }, { id: 2, name: 'TA3', items: ['ta1', 'ta2', 'ta3'] }, { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] }]
    const { model, moderationDefs } = buildModel(ta3, paths, false, rNameOf, [{ id: 1, moderatorId: 2, pathIndex: 0 }])
    expect(model).toContain('INT_1 =~ sn1.ta1 + sn1.ta2 + sn1.ta3 + sn2.ta1 + sn2.ta2 + sn2.ta3 + sn3.ta1 + sn3.ta2 + sn3.ta3 + sn4.ta1 + sn4.ta2 + sn4.ta3')
    expect(moderationDefs[0].matched).toBe(false)
  })
})
```

**Integration numbers land in U2-T6** (this task's job is the assembly + guards; the end-to-end WebR fit
of the matched model is exercised together with the slopes in T6, since both come from the same fitted
object per the spike's single-run design).

**Commands:** `npm run test:fast -- runCbSem`.
**Commit:** `feat(cb-sem): indProd moderation model assembly (matched/unmatched) with guards`

---

### U2-T5 — `:=` simple slopes at -1SD/mean/+1SD + conditional effects

**Read first:** `.superpowers/sdd/spike-moderation/moderation-spike-cbsem-ext.R` lines 27-37 (the
production `:=` design: `TA ~~ vta*TA` + `slope_lo/mid/hi := b1 ± b3*sqrt(vta)`) — this is the
"production design" the spike script itself calls out, superseding the OTHER (non-`:=`) hand-computed
slopes in the original `moderation-spike-cbsem.R`. Reuse `varLabel`/`intLabel`/`pathLabel_` already
assembled per-moderation in U2-T4.

**R script addition** (append per moderation, right after the target-line splice in U2-T4's loop):
```r
lines.push(`slope_lo_${mod.id}  := ${modDef.pathLabel_} - ${intLabel}*sqrt(${varLabel})`)
lines.push(`slope_mid_${mod.id} := ${modDef.pathLabel_}`)
lines.push(`slope_hi_${mod.id}  := ${modDef.pathLabel_} + ${intLabel}*sqrt(${varLabel})`)
```
(TS-side, appended to `lines` in the same `buildModel` loop as U2-T4 — one PR-sized change together with
T4's model assembly; kept as a separate task here for TDD granularity since it has its own dual-CI
plumbing.) These `:=` rows are picked up automatically by the EXISTING `indirect_rows`-style extraction
IF `pe`'s `op==":="` scan already runs generically — but indirect defs and slope defs must NOT be
conflated in the returned tables (indirect effects vs moderation slopes are different report sections).
Extract slope rows separately by filtering `pe$lhs` against the KNOWN slope labels
(`slope_lo_<id>`/`slope_mid_<id>`/`slope_hi_<id>`) rather than reusing the indirect-effects `ind_idx`
scan, so they route into `moderation.slopes`, not `indirect`.

```r
slope_rows <- list()
for (mid in mod_ids) {
  for (lvl in c("lo", "mid", "hi")) {
    lbl <- paste0("slope_", lvl, "_", mid)
    i <- which(pe$lhs == lbl & pe$op == ":=")[1]
    ib <- which(pe_bc$lhs == lbl & pe_bc$op == ":=")[1]
    if (!is.na(i)) slope_rows[[length(slope_rows) + 1]] <- list(
      modId = mid, level = lvl, est = as.numeric(pe$est[i]), se = as.numeric(pe$se[i]),
      z = as.numeric(pe$z[i]), p = as.numeric(pe$pvalue[i]),
      ciPercLower = as.numeric(pe$ci.lower[i]), ciPercUpper = as.numeric(pe$ci.upper[i]),
      ciBcLower = as.numeric(pe_bc$ci.lower[ib]), ciBcUpper = as.numeric(pe_bc$ci.upper[ib])
    )
  }
}
```

TS: map `level` `'lo'|'mid'|'hi'` → `'-1SD'|'mean'|'+1SD'` in the wrapper; attach to
`moderation.slopes: Array<{ level: '-1SD' | 'mean' | '+1SD'; b: number; se: number; p: number; z: number; ciPercLower: number; ciPercUpper: number; ciBcLower: number; ciBcUpper: number }>`.

**Test:** covered together with T4's assembly in U2-T6's integration test below (the slopes only exist
once the model actually fits — the pure `buildModel` unit tests in T4 already assert the `:=` lines are
present in the generated model string; add one more assertion there):
```ts
it('emits the := simple-slope definitions (production design, not the hand-rolled spike variant)', () => {
  const { model } = buildModel(constructs, paths, false, rNameOf, [{ id: 1, moderatorId: 2, pathIndex: 0 }])
  expect(model).toContain('TA ~~ vmod_1*TA')
  expect(model).toContain('slope_lo_1  := p_1_3 - pint_1*sqrt(vmod_1)')
  expect(model).toContain('slope_mid_1 := p_1_3')
  expect(model).toContain('slope_hi_1  := p_1_3 + pint_1*sqrt(vmod_1)')
})
```

**Commands:** `npm run test:fast -- runCbSem`.
**Commit:** `feat(cb-sem): := simple-slope defined parameters (-1SD/mean/+1SD) with dual bootstrap CIs`

---

### U2-T6 — Moderation runner integration test (native-R-verified, full pipeline)

**Setup:** `cp .superpowers/sdd/spike-moderation-data.csv tests/e2e/fixtures/moderation.csv` (commit
the fixture — matches the repo's `tests/e2e/fixtures/*.csv` convention used by every other WebR-backed
runner test). New file `src/lib/stats/runCbSem.moderation.integration.test.ts`.

Every number below was computed 2026-07-06 by me, via native `Rscript`, running the EXACT model
`buildModel` (U2-T4/T5) produces for these two setups, with `set.seed(20260620)` (the runner's existing
hardcoded seed — NOT the spike's own 20260706; point estimates are seed-independent so they still match
the spike's headline numbers where applicable, CI bounds are fresh and specific to this seed).

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Engine } from '../webr/engine'
import { runCbSem } from './runCbSem'
import { loadCsvFixture } from './csvFixture'
import { join } from 'node:path'
import type { TestSetup } from '../../state/session'

// Reference values: native R 4.6.0 / lavaan 0.6.21 / semTools, spike-moderation-data.csv (n=400, SN/TA/TI,
// 4/4/3 continuous indicators, real interaction baked in: ti = .5*sn + .3*ta + .15*sn*ta + .7*noise).
// Model (matched, equal 4x4 counts → match=TRUE): SN=~sn1..4 · TA=~ta1..4 · TI=~ti1..3 ·
//   INT_1=~sn1.ta1+sn2.ta2+sn3.ta3+sn4.ta4 · TI~p_1_3*SN+pmod_1*TA+pint_1*INT_1 · TA~~vmod_1*TA ·
//   slope_lo/mid/hi_1 := p_1_3 ∓/±/= pint_1*sqrt(vmod_1). set.seed(20260620), bootstrap=500.
// Point estimates reproduce the spike's own headline numbers exactly (seed-independent): pint_1
// B=0.25819002 matches the spike report's B=0.25819002; std β=0.23155625 matches the spike's 0.23155625.
//   p_1_3   (SN->TI):  est=0.46586675 se=0.05577359 z=8.35282013 p<.001  percCI=[0.35651075,0.58738458]  bcCI=[0.36050554,0.58815806]
//   pmod_1  (TA->TI):  est=0.34369423 se=0.05192782 z=6.61869151 p<.001  percCI=[0.23507032,0.44634637]  bcCI=[0.25283059,0.46251388]
//   pint_1  (INT_1):   est=0.25819002 se=0.06353873 z=4.06350608 p=.0000483  percCI=[0.14047757,0.38982514]  bcCI=[0.14105695,0.39313381]
//     std β (pint_1) = 0.23155625, std se=0.05780444, z=4.00585551, p=.0000618
//   slope_lo_1 (-1SD): est=0.25882670 percCI=[0.14362545,0.40289849]  bcCI=[0.14797701,0.41184661]
//   slope_mid_1 (mean): est=0.46586675 percCI=[0.35651075,0.58738458]  bcCI=[0.36050554,0.58815806]
//   slope_hi_1 (+1SD): est=0.67290681 percCI=[0.51454643,0.84252335]  bcCI=[0.51799175,0.85224986]
//   R²(TI) = 0.37238998
const SETUP: TestSetup = {
  roles: {}, options: { estimator: 'ML', nboot: 500, ciType: 'percentile' }, props: {}, blocked: null,
  modelKind: 'latent',
  constructs: [
    { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
    { id: 2, name: 'TA', items: ['ta1', 'ta2', 'ta3', 'ta4'] },
    { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
  ],
  paths: [{ from: 1, to: 3 }],
  moderations: [{ id: 1, moderatorId: 2, pathIndex: 0 }],
}

describe('runCbSem — latent moderation (matched, equal indicator counts)', () => {
  const engine = new Engine()
  beforeAll(async () => { await engine.init() }, 600_000)
  afterAll(async () => { await engine.close() })

  it('matches native-R exactly on the spike-moderation dataset', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/moderation.csv'))
    const result = await runCbSem(engine, data, SETUP)
    const row = result.moderation!.rows[0]
    expect(row.matched).toBe(true)
    expect(row.disclosure).toBeUndefined()
    expect(row.b).toBeCloseTo(0.25819002, 4)
    expect(row.se).toBeCloseTo(0.06353873, 4)
    expect(row.p).toBeLessThan(0.0001)
    expect(row.stdBeta).toBeCloseTo(0.23155625, 4)
    expect(row.ciPercLower).toBeCloseTo(0.14047757, 2)
    expect(row.ciPercUpper).toBeCloseTo(0.38982514, 2)
    expect(row.ciBcLower).toBeCloseTo(0.14105695, 2)
    expect(row.ciBcUpper).toBeCloseTo(0.39313381, 2)
    expect(result.rsquare[3]).toBeCloseTo(0.37238998, 3)

    const [lo, mid, hi] = result.moderation!.slopes
    expect(lo.level).toBe('-1SD'); expect(lo.b).toBeCloseTo(0.25882670, 3)
    expect(mid.level).toBe('mean'); expect(mid.b).toBeCloseTo(0.46586675, 3)
    expect(hi.level).toBe('+1SD'); expect(hi.b).toBeCloseTo(0.67290681, 3)
    expect(lo.ciPercLower).toBeCloseTo(0.14362545, 2)
    expect(hi.ciBcUpper).toBeCloseTo(0.85224986, 2)
  }, 600_000)
})
```

Second scenario, unequal counts (moderator truncated to 3 of TA's 4 indicators → `match=FALSE`,
disclosure expected). Reference values, same seed/bootstrap, computed 2026-07-06:
```ts
// Unequal counts (SN=4 items, TA3=3 items) → match=FALSE, all-pairs product indicators (12 = 4x3).
// Point estimates reproduce the spike-ext's ML-only numbers exactly (seed/bootstrap-independent):
//   p_1_3 (SN->TI):  est=0.46030216 se=0.05600989 z=8.21823001 p<.001  percCI=[0.34215160,0.58120763]
//   pmod_1 (TA3->TI): est=0.32680229 se=0.05255863 z=6.21786179 p<.001 percCI=[0.22157187,0.43365220]
//   pint_1 (INT_1):   est=0.17599985 se=0.04891316 z=3.59821052 p=.00032041 percCI=[0.08080807,0.27090353]
//   R²(TI) = 0.34668962 · fit: chisq=2231.395 df=203 cfi=.659 tli=.613 rmsea=.158 srmr=.073 (expected —
//   the all-products match=FALSE approach fits poorly here; this is the known tradeoff the disclosure
//   note names, not a runner bug)
//   slope_lo_1: est=0.31961391 percCI=[0.19881748,0.45459792] · slope_hi_1: est=0.60099040 percCI=[0.46455810,0.74473831]
const UNEQUAL_SETUP: TestSetup = {
  ...SETUP,
  constructs: [
    { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
    { id: 2, name: 'TA3', items: ['ta1', 'ta2', 'ta3'] },
    { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
  ],
}

it('unequal indicator counts fall back to match=FALSE with a disclosure note', async () => {
  const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/moderation.csv'))
  const result = await runCbSem(engine, data, UNEQUAL_SETUP)
  const row = result.moderation!.rows[0]
  expect(row.matched).toBe(false)
  expect(row.disclosure).toMatch(/unequal indicator counts/)
  expect(row.b).toBeCloseTo(0.17599985, 3)
  expect(row.ciPercLower).toBeCloseTo(0.08080807, 2)
  expect(result.rsquare[3]).toBeCloseTo(0.34668962, 3)
}, 600_000)

it('rejects WLSMV + moderation before touching the engine', async () => {
  const engine2 = new Engine()
  const bad: TestSetup = { ...SETUP, options: { ...SETUP.options, estimator: 'WLSMV' } }
  await expect(runCbSem(engine2, loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/moderation.csv')), bad))
    .rejects.toThrow(/ML-family estimator/)
})
```

**Commands:** `npm run test:fast -- runCbSem.moderation` then full `npm run test:fast`.
**Commit:** `test(cb-sem): moderation runner integration — native-R-verified on the spike dataset (matched + unequal)`

---

## Unit 3 — CB-SEM card reshape (5 tasks)

Files at the center: `src/lib/results/buildCbSem.ts`, `src/lib/results/buildCbSem.test.ts`,
`src/lib/registry/cbSem.ts`, `src/lib/registry/cbSem.consistency.test.ts`, `telos_test_outputs.html`
(lines 1126-1157, the CB-SEM card block — `cbSem.consistency.test.ts` pins the registry to this file
VERBATIM, so every table-shape change below amends both together in the same task). Depends on U1 (A6
renderer) already landing the column/row contracts quoted verbatim from the plan's Interfaces section:
`{ key, label, span?: { group } }` columns, `{ __group }` / `{ __section }` row markers, and
`MatrixProps.diagonalStyle?/cellStars?/starNote?`. This unit only CONSUMES those contracts — it does not
re-implement the renderer.

**Backward-compatibility rule carried over from A6 (stated once, applies to every task in this unit):**
`PATH_ANALYSIS` (`src/lib/registry/pathAnalysis.ts`) shares `buildCbSem` but keeps its OWN, unchanged
`structural-paths`/`indirect-effects` `TableSpec.columns` (no `H`, no spanned dual-CI headers). Every
builder change below is **additive**: new row fields are always populated, but a table only renders a
new column if the registry passed to the builder declares it. `PATH_ANALYSIS`'s existing single `ci`
field keeps rendering the percentile CI exactly as today (`buildCbSem.test.ts`'s existing
`'PATH_ANALYSIS: ... fill every spec column'` test must stay green, unmodified, through all of U3).

### U3-T1 — Table 1 merge (cfa-loadings + reliability + item Mean/SD, grouped rows)

**Amend `telos_test_outputs.html`** (CB-SEM card, replace lines 1135-1138 — the separate Table 3/4
blocks — with ONE merged, grouped table; EFA tables 1-2 and their captions are untouched by this task,
renumbered in U3-T4):
```html
<div class="apa-cap"><b>Table 3.</b> Measurement model (loadings, reliability &amp; item descriptives)</div>
<table class="apa"><thead><tr><th>Construct / Item</th><th>Mean</th><th>SD</th><th>B</th><th>SE</th><th>z</th><th>p</th><th>Std. loading</th><th>&omega;</th><th>&alpha;</th><th>CR</th><th>AVE</th></tr></thead><tbody class="ghost"><tr><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr></tbody></table>
<p class="tbl-note">construct rows (italic) carry &omega;/&alpha;/CR/AVE once; item rows carry Mean/SD (on the estimation sample per the missing-data setting) and the CFA loading (B/SE/z/p/Std. loading).</p>
```
(Table numbering here is provisional — U3-T4 renumbers everything once the EFA-preamble E1/E2 scheme
lands; write this task assuming Table 3 for now, and let U3-T4's renumbering pass be the ONE place that
touches every caption number across the file.)

**Registry — `src/lib/registry/cbSem.ts`:** replace the separate `cfa-loadings` and `reliability` table
entries with ONE merged entry (keep id `cfa-loadings` — least-diff for downstream references):
```ts
{
  id: 'cfa-loadings',
  domId: 'cb-sem-cfa-loadings',
  title: 'Measurement model (loadings, reliability & item descriptives)',
  columns: [
    { key: 'path', label: 'Construct / Item' },
    { key: 'mean', label: 'Mean' },
    { key: 'sd', label: 'SD' },
    { key: 'b', label: 'B' },
    { key: 'se', label: 'SE' },
    { key: 'z', label: 'z' },
    { key: 'p', label: 'p' },
    { key: 'std', label: 'Std. loading' },
    { key: 'omega', label: 'ω' },
    { key: 'alpha', label: 'α' },
    { key: 'cr', label: 'CR' },
    { key: 'ave', label: 'AVE' },
  ],
},
```
Remove the standalone `reliability` table entry entirely; update `bundleFiles` (drop
`table_reliability.png`, `table_cfa-loadings.png` stays); update `tableNote` (drop the "Tables 1-2
omitted" phrasing's dependence on old numbering — defer the full note rewrite to U3-T5's labelled-notes
pass; for THIS task only patch the sentence fragment that names the removed table).

**Builder — `src/lib/results/buildCbSem.ts`:** replace the two separate T3/T4 pushes with one grouped
build (uses the new `{ __group }` row marker from U1 — construct row carries ω/α/CR/AVE ONCE, item rows
carry Mean/SD/B/SE/z/p/Std.loading and leave ω/α/cr/ave blank):
```ts
if (!isPath && r.cfaLoadings.length) {
  const relByConstruct = new Map(r.reliability.map((row) => [String(row.construct), row]))
  const itemByKey = new Map(r.itemStats.map((s) => [`${s.construct}::${s.item}`, s]))
  const rows: BuiltTable['rows'] = []
  let lastConstruct: string | null = null
  for (const row of r.cfaLoadings) {
    const construct = String(row.construct)
    if (construct !== lastConstruct) {
      const rel = relByConstruct.get(construct)
      rows.push({
        __group: construct,
        path: construct, mean: '', sd: '', b: '', se: '', z: '', p: '', std: '',
        omega: rel ? f01(Number(rel.omega)) : '—', alpha: rel ? f01(Number(rel.alpha)) : '—',
        cr: rel ? f01(Number(rel.cr)) : '—', ave: rel ? f01(Number(rel.ave)) : '—',
      })
      lastConstruct = construct
    }
    const item = itemByKey.get(`${construct}::${row.item}`)
    rows.push({
      path: String(row.item), // indented child — CSS/LaTeX render the indent, not the string itself
      mean: item ? f(item.mean) : '—', sd: item ? f(item.sd) : '—',
      b: f(Number(row.b)), se: f(Number(row.se)), z: fdf(Number(row.z)), p: fp(Number(row.p)),
      std: f01(Number(row.stdLoading)), omega: '', alpha: '', cr: '', ave: '',
    })
  }
  tables.push({ spec: specTable(spec, 'cfa-loadings'), rows })
}
```
(`f`/`f01`/`fp`/`fdf` already imported at the top of `buildCbSem.ts`.)

**Test — `src/lib/results/buildCbSem.test.ts`:** update the mock `SPEC.tables[2]` (`cfa-loadings`) to
the merged 12-column set; add `itemStats` to the mock `CbSemResult` `base` (two entries matching the
existing `cfaLoadings` mock rows, e.g. `{ construct: 'ind60', item: 'x1', mean: 5.05, sd: 0.85, n: 75 }`);
remove the standalone `reliability`-table assertion from the first `it(...)` and replace with:
```ts
const t1 = c.tables.find((t) => t.spec.id === 'cfa-loadings')!
expect(t1.rows[0]).toMatchObject({ __group: 'ind60', omega: '.95', alpha: '.94' }) // group row
expect(t1.rows[1]).toMatchObject({ path: 'x1', mean: '5.05', std: '.92' }) // item row, no omega
```
Update the "real registry specs" coverage test (`assertRowsCoverSpecColumns`) — it currently asserts
EVERY column is non-empty in EVERY row, which the group/item split intentionally violates (group rows
leave `mean`/`b`/etc blank, item rows leave `omega`/etc blank). Change that helper's assertion to skip
blank-by-design cells: only fail when a column is blank in EVERY row of the table (catches a true
key-mismatch regression, tolerates the new grouped-row split) — this is the exact regression the test's
own comment warns about (spec/builder key drift), so keep its intent, just relax the per-row rule to a
per-column rule.

**Consistency test — `src/lib/registry/cbSem.consistency.test.ts`:** merge the two `it(...)` blocks for
Table 3/4 into one `theadAfter('Measurement model (loadings, reliability & item descriptives)')` check
against `tableCols('cfa-loadings')`; delete the old `reliability` thead assertion.

**Commands:** `npm run test:fast -- buildCbSem cbSem`.
**Commit:** `feat(cb-sem): merge CFA loadings + reliability + item Mean/SD into one grouped Table 1`

---

### U3-T2 — Tables 3-4 on-card (Fornell-Larcker + HTMT) + cross-reference note

**Amend `telos_test_outputs.html`** (insert two new matrix tables after the merged Table 3 from T1,
before the fit-indices table — captions provisional until U3-T4's renumbering pass):
```html
<div class="apa-cap"><b>Table 4.</b> Discriminant validity (Fornell&ndash;Larcker)</div>
<table class="apa"><thead><tr><th></th><th>C1</th><th>C2</th><th>C3</th></tr></thead><tbody class="ghost"><tr><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr></tbody></table>
<div class="apa-cap"><b>Table 5.</b> Discriminant validity (HTMT)</div>
<table class="apa"><thead><tr><th></th><th>C1</th><th>C2</th><th>C3</th></tr></thead><tbody class="ghost"><tr><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr></tbody></table>
<p class="tbl-note">Discriminant validity also has its own card (AVE / convergent validity); it is included here so one run gives the complete measurement-model writeup. &radic;AVE (italic) sits on the Fornell&ndash;Larcker diagonal; off-diagonal correlations carry significance stars (*p&lt;.05, **p&lt;.01, ***p&lt;.001). HTMT &lt; .85 is the primary discriminant-validity criterion.</p>
```

**Registry — `cbSem.ts`:** add two new `TableSpec` entries (matrix tables carry no `columns`, matching
the AVE card's `ave.ts` convention — `columns: []`), positioned right after `cfa-loadings`:
```ts
{ id: 'fornell-larcker', domId: 'cb-sem-fornell-larcker', title: 'Discriminant validity (Fornell–Larcker)', columns: [] },
{ id: 'htmt', domId: 'cb-sem-htmt', title: 'Discriminant validity (HTMT)', columns: [] },
```
Add the cross-reference sentence (exact copy from spec §A1+A2+A3): `"Discriminant validity also has its
own card (AVE / convergent validity); it is included here so one run gives the complete measurement-model
writeup."` to `tableNote.text` (appended; full note rewrite happens in U3-T5, but this sentence must land
in THIS task per the spec, which names it specifically under Tables 3-4).

**Builder — `buildCbSem.ts`:** mirror `buildAve.ts`'s matrix construction (import `MatrixTable` from
`../results/types`), but add stars from `r.corLvP` (new — `buildAve.ts` has no p-values to star with,
this is the CB-SEM card's addition) and italic (not bold) diagonal per the U1 contract
`diagonalStyle: 'italic'`:
```ts
if (!isPath && r.fornellLarcker.length >= 2) {
  const stars = (p: number) => (p < 0.001 ? '***' : p < 0.01 ? '**' : p < 0.05 ? '*' : '')
  const flCells = r.fornellLarcker.map((row, i) => row.map((val, j) => (j > i ? null : f01(val))))
  const cellStars = r.fornellLarcker.map((row, i) =>
    row.map((_, j) => (j >= i ? null : stars(r.corLvP[i][j]))),
  )
  tables.push({
    spec: specTable(spec, 'fornell-larcker'),
    rows: [],
    matrix: {
      kind: 'matrix', id: 'fornell-larcker', caption: specTable(spec, 'fornell-larcker').title,
      rowLabels: r.discriminantLabels, colLabels: r.discriminantLabels, cells: flCells,
      diagonalStyle: 'italic', lowerOnly: true, cellStars,
      starNote: '*p<.05, **p<.01, ***p<.001',
    },
  })
  const htmtCells = r.htmt.map((row, i) => row.map((val, j) => (j >= i ? null : f01(val))))
  tables.push({
    spec: specTable(spec, 'htmt'), rows: [],
    matrix: { kind: 'matrix', id: 'htmt', caption: specTable(spec, 'htmt').title,
      rowLabels: r.discriminantLabels, colLabels: r.discriminantLabels, cells: htmtCells, lowerOnly: true },
  })
}
```
(`r.fornellLarcker`/`r.htmt`/`r.corLvP`/`r.discriminantLabels` come from U2-T2's plumbing.)

**Test — `buildCbSem.test.ts`:** add `fornellLarcker`, `htmt`, `corLvP`, `discriminantLabels` to the mock
`base` (3-construct values, e.g. reuse the HolzingerSwineford numbers from `cfaReliability.test.ts`:
diag `[0.6087, 0.8491, 0.6515]`, off-diag `[0.4585, 0.4705, 0.2830]`, all `corLvP` entries `< 0.0001`);
assert:
```ts
const fl = c.tables.find((t) => t.spec.id === 'fornell-larcker')!
expect(fl.matrix!.cells[1][0]).toBe('.46') // off-diagonal correlation
expect(fl.matrix!.cellStars![1][0]).toBe('***')
expect(fl.matrix!.diagonalStyle).toBe('italic')
```
Also assert suppression `< 2` constructs (mirrors `buildAve.ts`'s own rule) with a dedicated `it`.

**Consistency test — `cbSem.consistency.test.ts`:** add `it('Table 4/5 (Fornell-Larcker/HTMT) captions and note text match', ...)` reading the new HTML blocks (column-header check is looser here since matrix tables have no fixed `columns` — assert the caption title strings and the cross-reference sentence appear verbatim in both `spec.tableNote.text` and the HTML).

**Commands:** `npm run test:fast -- buildCbSem cbSem`.
**Commit:** `feat(cb-sem): on-card Fornell-Larcker (starred) + HTMT tables, cross-referencing the AVE card`

---

### U3-T3 — Table 5 merge (structural + indirect + moderation, spanned dual-CI, H-ids, Result rule)

**Amend `telos_test_outputs.html`** (replace the old Table 6/7 pair — lines 1141-1146 pre-T1 numbering —
with ONE spanned-header table; final numbering resolved in U3-T4):
```html
<div class="apa-cap"><b>Table 6.</b> Structural paths, indirect effects &amp; moderation</div>
<table class="apa"><thead>
  <tr><th rowspan="2">H</th><th rowspan="2">Path</th><th rowspan="2">B</th><th rowspan="2">Std. &beta;</th><th rowspan="2">p</th><th colspan="2">Percentile 95% CI</th><th colspan="2">BC 95% CI</th><th rowspan="2">Result</th></tr>
  <tr><th>Lower</th><th>Upper</th><th>Lower</th><th>Upper</th></tr>
</thead><tbody class="ghost"><tr><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td><td>&mdash;</td></tr></tbody></table>
<p class="tbl-note">Direct paths / Indirect effects / Moderation sections appear only when applicable. Both CI pairs bound the unstandardized B from ONE bootstrap run; Std. &beta; is point-only (delta-method CIs not shown). BC = bias-corrected, non-accelerated (lavaan boot.ci.type=&quot;bca.simple&quot;, Efron 1987); true BCa (jackknife acceleration) is out of scope. Result is Supported/Not supported from the percentile 95% CI excluding zero (&alpha;=.05); the BC column is comparative context. H numbering: structural paths in canvas order, then indirect effects in chain-enumeration order, then moderation edges in creation order. R&sup2; per endogenous construct is noted below the table.</p>
```

**Registry — `cbSem.ts`:** replace `structural-paths` and `indirect-effects` with ONE merged entry (id
`structural-paths`, matching the interface contract's spanning-header column shape):
```ts
{
  id: 'structural-paths',
  domId: 'cb-sem-structural-paths',
  title: 'Structural paths, indirect effects & moderation',
  columns: [
    { key: 'h', label: 'H' },
    { key: 'path', label: 'Path' },
    { key: 'b', label: 'B' },
    { key: 'beta', label: 'Std. β' },
    { key: 'p', label: 'p' },
    { key: 'percLower', label: 'Lower', span: { group: 'Percentile 95% CI' } },
    { key: 'percUpper', label: 'Upper', span: { group: 'Percentile 95% CI' } },
    { key: 'bcLower', label: 'Lower', span: { group: 'BC 95% CI' } },
    { key: 'bcUpper', label: 'Upper', span: { group: 'BC 95% CI' } },
    { key: 'result', label: 'Result' },
  ],
},
```
Remove the standalone `indirect-effects` entry (**PATH_ANALYSIS keeps its own, untouched — see the unit
preamble**). Update `bundleFiles`.

**Builder — `buildCbSem.ts`:** this REPLACES the current separate `structural`/`indirect` pushes with one
combined, sectioned, H-numbered table, but the row-shape is registry-aware so `PATH_ANALYSIS` (whose
`structural-paths`/`indirect-effects` stay two SEPARATE tables with the OLD column keys) keeps working
unchanged. Branch on `spec.id === 'cb-sem'` (the ONLY registry that declares the merged shape this
slice):
```ts
const result = (p: number, lo: number, hi: number) => (lo > 0 || hi < 0 ? 'Supported' : 'Not supported')
const isMerged = spec.id === 'cb-sem'

if (isMerged) {
  const rows: BuiltTable['rows'] = []
  let h = 1
  if (r.structural?.length) {
    rows.push({ __section: 'Direct paths' })
    for (const row of r.structural) rows.push({
      h: `H${h++}`,
      path: row.fromName != null ? `${row.fromName} → ${row.toName}` : `${row.from} → ${row.to}`,
      b: f(Number(row.b)), beta: f01(Number(row.stdBeta)), p: fp(Number(row.p)),
      percLower: f01(Number(row.ciPercLower)), percUpper: f01(Number(row.ciPercUpper)),
      bcLower: f01(Number(row.ciBcLower)), bcUpper: f01(Number(row.ciBcUpper)),
      result: result(Number(row.p), Number(row.ciPercLower), Number(row.ciPercUpper)),
    })
  }
  if (r.indirect?.length) {
    rows.push({ __section: 'Indirect effects' })
    for (const row of r.indirect) rows.push({
      h: `H${h++}`, path: row.pathLabel != null ? String(row.pathLabel) : String(row.label),
      b: f(Number(row.est)), beta: fx(row.stdEst == null ? null : Number(row.stdEst), f01), p: fp(Number(row.p)),
      percLower: f01(Number(row.ciPercLower)), percUpper: f01(Number(row.ciPercUpper)),
      bcLower: f01(Number(row.ciBcLower)), bcUpper: f01(Number(row.ciBcUpper)),
      result: result(Number(row.p), Number(row.ciPercLower), Number(row.ciPercUpper)),
    })
  }
  if (r.moderation?.rows.length) {
    rows.push({ __section: 'Moderation' })
    for (const row of r.moderation.rows) rows.push({
      h: `H${h++}`, path: `${row.pathLabel} × ${row.moderatorName}`,
      b: f(Number(row.b)), beta: f01(Number(row.stdBeta)), p: fp(Number(row.p)),
      percLower: f01(Number(row.ciPercLower)), percUpper: f01(Number(row.ciPercUpper)),
      bcLower: f01(Number(row.ciBcLower)), bcUpper: f01(Number(row.ciBcUpper)),
      result: result(Number(row.p), Number(row.ciPercLower), Number(row.ciPercUpper)),
    })
  }
  if (rows.length) tables.push({ spec: specTable(spec, 'structural-paths'), rows })
} else {
  // PATH_ANALYSIS legacy shape — UNCHANGED from today (single 'ci' column, no H/spans/sections).
  if (r.structural?.length) { /* ...existing code, untouched... */ }
  if (r.indirect?.length) { /* ...existing code, untouched... */ }
}
```
R² note: append `note.text` (or a new labelled note once U3-T5 lands) with one line per endogenous
construct, e.g. `R²(dem60) = .20, R²(dem65) = .97` — built from `r.rsquare` keyed by construct id, joined
against `r.structural`'s `toName`s for display names.

**Test — `buildCbSem.test.ts`:** update the mock `SPEC` for the merged `structural-paths` columns; add
`ciPercLower/Upper`/`ciBcLower/Upper` to the mock `structural`/`indirect` rows; add a `moderation` block
to `base`; assert:
```ts
const t5 = c.tables.find((t) => t.spec.id === 'structural-paths')!
expect(t5.rows[0]).toEqual({ __section: 'Direct paths' })
expect(t5.rows[1]).toMatchObject({ h: 'H1', result: 'Supported' })
expect(t5.rows.some((r) => r.__section === 'Indirect effects')).toBe(true)
```
Explicitly re-run the EXISTING `'PATH_ANALYSIS: structural-paths + indirect rows fill every spec column'`
test UNMODIFIED and confirm it still passes (the `else` branch above is a byte-identical copy of the
current code) — this is the concrete proof of the backward-compat rule stated in the unit preamble.

**Consistency test — `cbSem.consistency.test.ts`:** merge the Table 6/7 thead checks into one, asserting
against the two-row spanning header (compare the FLATTENED leaf column list: `H, Path, B, Std. β, p,
Lower, Upper, Lower, Upper, Result` — matching `tableCols('structural-paths')`'s labels in order, since
`theadAfter` already flattens `<th>` text regardless of `rowspan`/`colspan`).

**Commands:** `npm run test:fast -- buildCbSem cbSem pathAnalysis`.
**Commit:** `feat(cb-sem): merge structural paths + indirect effects + moderation into one H-numbered, dual-CI Table 5`

---

### U3-T4 — EFA preamble labeling (E1/E2 when EFA stage selected)

**Read first:** `src/components/ResultPreviewCard.tsx` line 22-44 (positional `Table ${i + 1}.` numbering
over `content.tables`) — confirmed the ONLY place per-table numbering renders; `src/lib/export/latex.ts`
and `src/lib/export/rTable.ts` emit tabulars with NO caption/number at all (PDF is a print of the on-screen
HTML per the existing pipeline — there is no separate LaTeX caption to keep in sync for THIS change).

**Registry — `types.ts`:** extend `TableSpec`:
```ts
export interface TableSpec { /* ...existing... */; captionStyle?: 'bare' | 'preamble'; preambleLabel?: string }
```
**Registry — `cbSem.ts`:** mark the two EFA tables:
```ts
{ id: 'efa-suitability', captionStyle: 'preamble', preambleLabel: 'E1', title: 'EFA suitability', columns: [...] },
{ id: 'efa-loadings', captionStyle: 'preamble', preambleLabel: 'E2', title: 'EFA rotated factor loadings', columns: [...] },
```

**Renderer — `ResultPreviewCard.tsx`:** replace the flat `i + 1` numbering with a running counter that
skips preamble tables:
```tsx
let canonical = 0
{content.tables.map((t, i) => {
  const spec = t.matrix ? t.spec : t.spec // both branches carry `.spec`
  const isPreamble = spec.captionStyle === 'preamble'
  if (!isPreamble) canonical += 1
  const caption = spec.captionStyle === 'bare' ? 'Table.'
    : isPreamble ? `Table ${spec.preambleLabel}.`
    : `Table ${canonical}.`
  return (
    <div key={t.matrix ? t.matrix.id : t.spec.id}>
      {t.matrix
        ? <><p><b>{caption}</b> {t.matrix.caption}</p>...</>
        : <><p><b>{caption}</b> {t.spec.title}</p>...</>}
    </div>
  )
})}
```
(`i` is still used for `key`/nothing else; `canonical` is a `let` outside the callback closure — since
`.map` callbacks share the enclosing scope, this works as a single forward pass exactly like the existing
`i`.)

**Test — new `src/components/ResultPreviewCard.efaPreamble.test.tsx`** (render with React Testing Library,
matching existing component-test conventions — check `src/components/SemCanvas.test.tsx` for the render
harness pattern already in the repo):
```tsx
it('EFA tables caption as Table E1/E2; canonical numbering starts at 1 on the next table', () => {
  const content = { tables: [
    { spec: { id: 'efa-suitability', title: 'EFA suitability', columns: [], captionStyle: 'preamble', preambleLabel: 'E1' }, rows: [] },
    { spec: { id: 'efa-loadings', title: 'EFA rotated factor loadings', columns: [], captionStyle: 'preamble', preambleLabel: 'E2' }, rows: [] },
    { spec: { id: 'cfa-loadings', title: 'Measurement model', columns: [] }, rows: [] },
    { spec: { id: 'fit-indices', title: 'Fit indices', columns: [] }, rows: [] },
  ], note: null, figures: [], howToRead: '', apa: '', nExcluded: 0 }
  render(<ResultPreviewCard index={1} name="CB-SEM" question="q" content={content} stale={false} running={false} onRerun={() => {}} />)
  expect(screen.getByText('Table E1.')).toBeInTheDocument()
  expect(screen.getByText('Table E2.')).toBeInTheDocument()
  expect(screen.getByText('Table 1.')).toBeInTheDocument() // cfa-loadings, first CANONICAL table
  expect(screen.getByText('Table 2.')).toBeInTheDocument() // fit-indices
})
it('canonical numbering starts at 1 even when EFA is deselected (no preamble tables present)', () => {
  const content = { tables: [
    { spec: { id: 'cfa-loadings', title: 'Measurement model', columns: [] }, rows: [] },
  ], note: null, figures: [], howToRead: '', apa: '', nExcluded: 0 }
  render(<ResultPreviewCard index={1} name="CB-SEM" question="q" content={content} stale={false} running={false} onRerun={() => {}} />)
  expect(screen.getByText('Table 1.')).toBeInTheDocument()
})
```

**Amend `telos_test_outputs.html`:** relabel the EFA captions (lines 1130/1132) `Table 1.`/`Table 2.` →
`Table E1.`/`Table E2.`, and renumber every subsequent caption in the CB-SEM card by -2 relative to
today's numbers, reflecting T1/T2/T3's merges too: `Table 3.`→**Table 1.** (merged measurement),
`Table 4.`(new Fornell-Larcker)→**Table 2.**... wait — fit-indices is spec Table 2 per the canonical
mapping (§A2: "Table 2 = fit-indices — unchanged set"). Apply the FINAL canonical order once, here, as
the single renumbering pass across the whole card: **Table 1** = measurement (T1's merge) · **Table 2**
= fit indices · **Table 3** = Fornell-Larcker (T2) · **Table 4** = HTMT (T2) · **Table 5** = structural +
indirect + moderation (T3). Reorder the HTML blocks physically to match (fit-indices block moves ahead
of the two new matrix tables) and reorder `spec.tables` in `cbSem.ts` identically:
`[efa-suitability, efa-loadings, cfa-loadings, fit-indices, fornell-larcker, htmt, structural-paths]`.
Update EVERY caption number in the HTML block and confirm `cbSem.consistency.test.ts` still resolves
each `theadAfter(...)` lookup (it searches by caption/title text, not number, so this is a pure
numbering-consistency check, not a re-plumb).

**Commands:** `npm run test:fast -- ResultPreviewCard cbSem`, `npx playwright test sem` (smoke).
**Commit:** `feat(sem): EFA preamble labeling (Table E1/E2) + final canonical Table 1-5 ordering for CB-SEM`

---

### U3-T5 — CB-SEM notes wall → labelled notes (worked example for A5)

**Read first:** `src/lib/results/builders.ts` line 111 (`CardContent['note']` — currently ONE
`{kind,text,afterTableId}` or `null`); `src/components/ResultPreviewCard.tsx` lines 31-48 (renders
`content.note.text` as one flat `<p>`). This task is the SINGLE worked example the spec names ("the
CB-SEM notes wall is the worked example") — the mechanism it introduces here is what A5 (Unit 8) later
sweeps across all other cards; this task both builds the mechanism AND applies it to CB-SEM,
content-preserving (every fact in the current giant paragraph survives, just split and labelled).

**Type — `builders.ts`:** add an array form alongside the existing single note, so every OTHER card's
`note: {kind,text} | null` keeps rendering byte-identically (opt-in, same A6 backward-compat rule):
```ts
export interface LabelledNote { label: string; text: string; afterTableId?: string }
export interface CardContent {
  // ...existing fields...
  note: { kind: 'assume' | 'plain'; text: string; afterTableId?: string } | null
  notes?: LabelledNote[] // NEW — when present, RENDERS INSTEAD OF `note` (opt-in; CB-SEM is the pilot)
}
```

**Renderer — `ResultPreviewCard.tsx`:** render `content.notes` (labelled, bold label prefix) in place of
`content.note` when present:
```tsx
{content.notes
  ? content.notes.filter((n) => !n.afterTableId).map((n, i) => (
      <p key={i} style={{ fontSize: 11, color: 'var(--muted)' }}><b>{n.label}:</b> {n.text}</p>
    ))
  : content.note && !content.tables.some((t) => (t.matrix ? t.matrix.id : t.spec.id) === content.note!.afterTableId) && (
      <p style={{ fontSize: 11, color: 'var(--muted)' }}>{content.note.text}</p>
    )}
```
(and the equivalent `afterTableId`-matched inline placement inside the `.map` over `content.tables`, one
`content.notes?.filter((n) => n.afterTableId === ...)` block mirroring the existing `content.note`
inline branch — same pattern, plural.)

**Builder — `buildCbSem.ts`:** replace the single giant `tableNote` consumption with labelled notes,
content-preserving (every clause from the CURRENT `cbSem.ts` `tableNote.text` maps to exactly one
labelled note below — nothing dropped, nothing added):
```ts
const notes: CardContent['notes'] = saturated
  ? [{ label: 'Saturation', text: SATURATION_NOTE }]
  : [
      { label: 'Scope', text: 'Tables shown follow the pipeline stages you ran (EFA → CFA → fit → structural); if EFA was deselected, the E1/E2 preamble is omitted; if the structural stage was deselected, Table 5 is omitted.' },
      { label: 'Cutoffs', text: 'Good-fit guidelines (Hu & Bentler, 1999; Marsh, Hau & Wen, 2004): CFI/TLI ≥ .95, RMSEA ≤ .06 [90% CI], SRMR ≤ .08 — guidelines, not pass/fail gates; RMSEA is unstable at small df / small N, so interpret it cautiously for compact models.' },
      { label: 'Estimator', text: 'Use WLSMV for ordinal indicators.' },
      { label: 'R²', text: 'R² is filled once per endogenous (outcome) construct.' },
      { label: 'Caution', text: 'EFA on the same sample is exploratory — treat it as a diagnostic, not confirmatory evidence.' },
      { label: 'Indirect effects', text: 'The indirect-effects section of Table 5 appears only when the drawn structural paths form a chain (X → M → Y); each indirect effect is a lavaan defined effect with a bootstrapped 95% CI.', afterTableId: 'structural-paths' },
      { label: 'Moderation', text: 'Moderation adds an interaction row to Table 5 when a moderation edge is drawn on the canvas; simple slopes are reported in the conditional-effects table.' },
    ]
```
(the final bullet REPLACES the old "Moderation is planned for a later version" sentence — content is
now TRUE per this slice, not merely relabelled; every other bullet is a verbatim clause lift, confirmed
against `cbSem.ts`'s current `tableNote.text` word-for-word.)

**Test — `buildCbSem.test.ts`:** replace assertions on `c.note` for the CB-SEM path with:
```ts
expect(c.notes!.map((n) => n.label)).toEqual(['Scope', 'Cutoffs', 'Estimator', 'R²', 'Caution', 'Indirect effects', 'Moderation'])
expect(c.notes!.find((n) => n.label === 'Cutoffs')!.text).toContain('CFI/TLI ≥ .95')
```
Keep the existing saturation-note test (`kind`/`text` shape) but assert against `c.notes![0]` instead of
`c.note`.

**Consistency — `cbSem.consistency.test.ts`:** the current single verbatim `tableNote` check
(`spec.tableNote.text`) is superseded for CB-SEM specifically — remove `CB_SEM.tableNote` (or keep it as
a legacy fallback field unread by the builder, and drop the consistency test's assertion on it); replace
with an assertion that the CONCATENATION of `notes.map(n => n.text)` still contains every distinct
sentence the OLD `telos_test_outputs.html` `<p class="tbl-note">` blocks carried (a content-preservation
regression guard, not a byte-verbatim one, since the sentences are now split/relabelled by design).
Amend `telos_test_outputs.html`'s `tbl-note` paragraphs to the labelled form too (`<p class="tbl-note">
<b>Cutoffs:</b> ...</p>` per note), so the static preview stays faithful to the live card.

**Commands:** `npm run test:fast -- buildCbSem cbSem ResultPreviewCard`, full `npm run test:fast`, then
`npm run build`.
**Commit:** `feat(notes): labelled one-liner notes (Cutoffs/Caution/…) — CB-SEM worked example for A5`

---

## Contract deviations

None that change the given contracts — every field name in "Runner → builder" and the H-ordering /
Result-rule / BC-type rules is implemented literally as specified. Two ADDITIVE extensions beyond the
literal interface text (flagged, not deviations — both are backward-compatible supersets):

1. `itemStats` entries carry `construct` and `n` alongside the contract's `{ item, mean, sd }` (needed
   so Table 1's builder can join an item to the RIGHT construct's group row when the same item name is
   reused across constructs, and so the missing-data note can report N).
2. `moderation.rows[i]` carries `matched: boolean` and an optional `disclosure` string beyond the base
   dual-CI/path fields, and `moderation.slopes[i]` carries `z` alongside `b/se/p/ciPerc*/ciBc*` — both
   needed to satisfy the spec's disclosure-note and z-column requirements, not present in the skeleton's
   one-line contract sketch but required by spec §A7 prose.

One scope boundary worth surfacing explicitly (not a deviation from anything asked, but a judgment call):
U3's Table 5 merge is applied ONLY to the `cb-sem` registry this slice; `path-analysis` keeps its current
two-table, single-CI shape untouched, per the A6 "opt-in" backward-compatibility rule already established
by U1 — reshaping path-analysis's own card is not in either unit's task list and was left alone rather
than silently pulled in scope.

# Units 4-6 — per-task detail (Slice 5 "Citable & Complete")

> Drafted against `docs/superpowers/plans/2026-07-06-telos-citable-complete.md` (Global Constraints,
> Canvas state contract, Runner → builder contract) and
> `docs/superpowers/specs/2026-07-06-telos-citable-complete-design.md` §A7 (latent moderation) and §P1
> (PLS parity). Executes AFTER U0 (X3 SemCanvas landing), U1 (A6 renderer devices), U2 (CB-SEM runner
> statistics incl. dual CIs), U3 (CB-SEM Table 5 merge + H-ids + Result rule) — this detail assumes
> those units' outputs exist exactly as their contracts describe and does not re-derive them.
>
> Every task: RED (failing test) → GREEN (implementation) → `npm run test:fast` green → the WebR suite(s)
> for the touched stats/export file → `git add <touched files>` → commit (plain message, no trailers).
> `tsc -b` clean is part of every task's Definition of Done even where not repeated per-task.

## Design decisions this detail makes (not spelled out in the skeleton contracts — flagged, not deviations)

1. **Shared moderation-model R builder.** Both `runCbSem.ts` (WebR) and the `cb-sem` R-script emitter
   (`latent.ts`) must build the *identical* indProd + interaction + `:=` slope model text (export ≡ app,
   Global Constraints). A new pure module `src/lib/stats/moderationModel.ts` owns this text-building logic;
   both call sites import it. This avoids the alternative of hand-duplicating the R snippet in two files,
   which is exactly the kind of drift the constraint forbids.
2. **Canvas overlay estimate shape.** The Runner → builder contract adds `moderation: { rows, slopes }` to
   `CbSemResult`, but says nothing about the SVG canvas's post-run label overlay (which mirrors
   `estimates.paths[]`/`estimates.loadings{}` today). This detail adds
   `estimates.moderation?: Array<{ moderatorId: number; pathIndex: number; beta: number }>` — additive,
   optional, never touches the 47 other tests' `estimates` shape.
3. **`ResultPreviewCard` multi-figure gap.** Today, whenever a card supplies a `figureSlot` (true only for
   `inputKind: 'sem-canvas'` cards), `ResultPreviewCard.tsx` renders that SAME slot for *every* entry in
   `content.figures`, ignoring `fig.png`. Adding a second, R-rendered figure (simple slopes) to a SEM card's
   `figures[]` — as U5/U6 do — would currently duplicate-render the live canvas under a "Simple slopes"
   caption instead of showing the PNG. U5 task 2 fixes this (index-0-only slot, real `<img>` for the rest);
   flagged here because it is a pre-existing gap the new figure exposes, not a contract violation.
4. **`telos_test_outputs.html` is the consistency-test ground truth.** `cbSem.consistency.test.ts` /
   `plsSem.consistency.test.ts` diff the registry against `telos_test_outputs.html` verbatim. Any table
   reshape (U5 Table 5 Moderation section, U6 measurement/structural reshape) must update that HTML
   alongside the registry or these tests go red for the wrong reason. Called out per task below.
5. **WLSMV/ordinal guard reads `setup.options.estimator`.** `runCbSem.ts` does not implement WLSMV/ordinal
   estimation today (no `estimator=`/`ordered=` argument is ever passed to `lavaan::sem`) — the registry's
   "estimator" option is real and interactive (`SemControls.tsx`) but only the UI reads it today. The guard
   in U4 task 3 is therefore a **UI-level block** (matches the spec's own wording, "blocked with an
   explanatory message") — it does not require or imply a WLSMV runner implementation, which is out of
   scope here.

---

### Unit 4 — Canvas moderation (4 tasks)

### Task 4.1 — `moderations` state model, serialization, deterministic ordering

**Goal:** Add the moderation edge to session state exactly per the Canvas-state contract:
`moderations: { id: number; moderatorId: number; pathIndex: number }[]`, alongside `paths`, with the same
lifecycle discipline `paths`/`constructs` already have (dangling-edge cleanup, monotonic ids, JSON-native
serialization).

**Files:** `src/state/session.ts`, `src/state/session.test.ts`.

**RED — `src/state/session.test.ts` (append near the existing `addPath`/`removePath` describe block):**

```ts
describe('moderations', () => {
  const TEST_ID = 'cb-sem'
  beforeEach(() => {
    useSession.getState().reset()
    useSession.setState({
      selection: [TEST_ID],
      setups: {
        [TEST_ID]: {
          roles: {}, options: {}, props: {}, blocked: null, modelKind: 'latent',
          constructs: [
            { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
            { id: 2, name: 'TA', items: ['ta1', 'ta2', 'ta3', 'ta4'] },
            { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
          ],
          paths: [{ from: 1, to: 3 }, { from: 2, to: 3 }],
        },
      },
    })
  })

  it('addModeration records { id, moderatorId, pathIndex } and assigns a monotonic id starting at 1', () => {
    useSession.getState().addModeration(TEST_ID, 2, 0)
    expect(useSession.getState().setups[TEST_ID].moderations).toEqual([{ id: 1, moderatorId: 2, pathIndex: 0 }])
  })

  it('addModeration ids never reuse after a middle removal (mirrors nextConstructId)', () => {
    const s = useSession.getState()
    s.addModeration(TEST_ID, 2, 0)   // id 1
    s.addModeration(TEST_ID, 1, 1)   // id 2 (SN moderates TA→TI — self-mod guard lives in the CANVAS, not the store)
    s.removeModeration(TEST_ID, 1)
    s.addModeration(TEST_ID, 2, 1)
    expect(useSession.getState().setups[TEST_ID].moderations!.map((m) => m.id)).toEqual([2, 3])
  })

  it('removeModeration drops the moderation by id (not array index)', () => {
    const s = useSession.getState()
    s.addModeration(TEST_ID, 2, 0)
    s.addModeration(TEST_ID, 1, 1)
    s.removeModeration(TEST_ID, 1)
    expect(useSession.getState().setups[TEST_ID].moderations).toEqual([{ id: 2, moderatorId: 1, pathIndex: 1 }])
  })

  it('removeConstruct drops dangling moderations whose moderatorId was the removed construct', () => {
    const s = useSession.getState()
    s.addModeration(TEST_ID, 2, 0)
    s.removeConstruct(TEST_ID, 2)
    expect(useSession.getState().setups[TEST_ID].moderations).toEqual([])
  })

  it('removePath drops moderations pointing at the removed path AND re-indexes pathIndex for the rest (paths array shifts)', () => {
    const s = useSession.getState()
    s.addModeration(TEST_ID, 2, 0)  // moderates paths[0] (SN→TI)
    s.addModeration(TEST_ID, 1, 1)  // moderates paths[1] (TA→TI)
    s.removePath(TEST_ID, 0)        // paths[1] shifts down to paths[0]
    expect(useSession.getState().setups[TEST_ID].moderations).toEqual([{ id: 2, moderatorId: 1, pathIndex: 0 }])
  })

  it('moderations round-trip through serializeSetups/hydrateSetups', () => {
    useSession.getState().addModeration(TEST_ID, 2, 0)
    const json = serializeSetups(useSession.getState().setups)
    const back = hydrateSetups(JSON.parse(json))
    expect(back[TEST_ID].moderations).toEqual([{ id: 1, moderatorId: 2, pathIndex: 0 }])
  })
})
```

Run it (`npx vitest run src/state/session.test.ts`) — fails: `addModeration`/`removeModeration` don't exist.

**GREEN — `src/state/session.ts`:**

```ts
export interface Moderation { id: number; moderatorId: number; pathIndex: number }
export interface TestSetup {
  roles: Record<string, string[]>; options: Record<string, boolean | number | string>; props: Record<string, number>
  blocked: string | null; constructs?: Construct[]; paths?: StructuralPath[]
  moderations?: Moderation[]   // NEW — Canvas-state contract; empty/absent everywhere except cb-sem/pls-sem latent mode
  modelKind?: 'latent' | 'path'
}
```

Add to `SessionState` interface: `addModeration: (testId: string, moderatorId: number, pathIndex: number) => void`
and `removeModeration: (testId: string, id: number) => void`.

`nextConstructId`-style helper (place beside it):

```ts
const nextModerationId = (ms: Moderation[]): number => ms.reduce((m, x) => Math.max(m, x.id), 0) + 1
```

Store actions (place beside `addPath`/`removePath`):

```ts
addModeration: (testId, moderatorId, pathIndex) => edit((s) => {
  const prev = s.setups[testId]; if (!prev) return {}
  const ms = prev.moderations ?? []
  return { setups: { ...s.setups, [testId]: { ...prev, moderations: [...ms, { id: nextModerationId(ms), moderatorId, pathIndex }] } } }
}),
removeModeration: (testId, id) => edit((s) => {
  const prev = s.setups[testId]; if (!prev) return {}
  return { setups: { ...s.setups, [testId]: { ...prev, moderations: (prev.moderations ?? []).filter((m) => m.id !== id) } } }
}),
```

Extend `removeConstruct` (drop moderations whose `moderatorId` is the removed id — dangling paths are already
dropped, and a moderation on a dropped path is covered by the `removePath`-style cleanup below since
`removeConstruct` already filters `paths`; recompute `moderations` against the FILTERED `paths` so a
moderation on a path that construct-removal also dropped is cleaned in the same edit):

```ts
removeConstruct: (testId, id) => edit((s) => {
  const prev = s.setups[testId]; if (!prev) return {}
  const constructs = backfillConstructIds(prev.constructs ?? []).filter((c) => c.id !== id)
  const keptPathIdx = (prev.paths ?? []).map((p, i) => ({ p, i })).filter(({ p }) => p.from !== id && p.to !== id)
  const paths = keptPathIdx.map(({ p }) => p)
  const oldToNew = new Map(keptPathIdx.map(({ i }, newI) => [i, newI]))
  const moderations = (prev.moderations ?? [])
    .filter((m) => m.moderatorId !== id && oldToNew.has(m.pathIndex))
    .map((m) => ({ ...m, pathIndex: oldToNew.get(m.pathIndex)! }))
  return { setups: { ...s.setups, [testId]: { ...prev, constructs, paths, moderations } } }
}),
```

Extend `removePath` the same way (drop + re-index):

```ts
removePath: (testId, index) => edit((s) => {
  const prev = s.setups[testId]; if (!prev) return {}
  const paths = (prev.paths ?? []).filter((_, i) => i !== index)
  const moderations = (prev.moderations ?? [])
    .filter((m) => m.pathIndex !== index)
    .map((m) => ({ ...m, pathIndex: m.pathIndex > index ? m.pathIndex - 1 : m.pathIndex }))
  return { setups: { ...s.setups, [testId]: { ...prev, paths, moderations } } }
}),
```

No change needed to `serializeSetups`/`hydrateSetups` (plain JSON already round-trips the new field; absent
`moderations` on old saves defaults via `?? []` everywhere it's read).

**Verify:** `npx vitest run src/state/session.test.ts` green. `npx tsc -b`.

**Commit:** `feat(sem-b): moderations state model — canvas-state contract, dangling-edge cleanup, H-ordering-ready`

---

### Task 4.2 — Canvas gesture: click construct → existing path midpoint → moderation edge; dashed clay arrow

**Goal:** In Draw mode, clicking a construct then an existing path's midpoint handle records a moderation
edge; render it as a dashed clay (`var(--accent)`, the app's terracotta accent token) arrow from the
moderator's oval to the moderated path's midpoint, with a hover/selected label. Path midpoint handles must
become clickable in Draw mode (today they render `mode === 'delete'`-only).

**Files:** `src/components/SemCanvas.tsx`, `src/components/SemCanvas.test.tsx`, `src/components/SemCanvas.wiring.test.tsx`.

**Design (plans against the X3-landed base — `NODE_W`/`NODE_H`/`ITEM_W`/`ITEM_H`/`latentBounds`/`itemGeom`/
`itemSide(cx, minCx, maxCx)` are exported/available exactly as in `benjie-wip-semcanvas-export-fit`):**

- `SemCanvasUIProps` gains: `moderations: Moderation[]`, `onAddModeration(moderatorId: number, pathIndex: number): void`.
- `pending: number | null` (existing) is reused as the moderator-candidate too: after clicking a construct in
  Draw mode, the user can complete the gesture EITHER by clicking another node (existing path gesture) OR a
  path midpoint (new moderation gesture) — whichever comes first wins; there is no separate "mode" toggle.
- A midpoint circle renders for every path in BOTH `mode === 'draw'` (new — moderation target) and
  `mode === 'delete'` (existing — path delete), styled differently: draw-mode circles are `class="sem-mod-target"`,
  slightly smaller, only rendered once `pending !== null` (so idle Draw mode looks unchanged — no new visual
  noise until the user has actually picked a moderator).
- Dashed clay arrows: for each `moderations[]` entry, draw a line from the moderator node's center to the
  midpoint of `paths[m.pathIndex]`, `stroke="var(--accent)"`, `strokeDasharray="6 4"`, its own arrowhead marker
  `sem-arrow-mod` (accent-colored, mirrors `sem-arrow`). Post-run, annotate with the interaction β from the
  NEW `estimates.moderation` overlay field (mirrors the existing `sem-path-label` pattern).

**RED — append to `src/components/SemCanvas.test.tsx`:**

```ts
const moderations: Moderation[] = [{ id: 1, moderatorId: 2, pathIndex: 0 }]

describe('SemCanvasUI — moderation edges (dashed clay arrows)', () => {
  it('renders one dashed moderation arrow per moderations entry, in the accent color', () => {
    const html = renderLatent({ moderations })
    expect((html.match(/class="sem-mod-arrow"/g) ?? []).length).toBe(1)
    expect(html).toContain('var(--accent)')
    expect(html).toContain('stroke-dasharray="6 4"')
  })

  it('draws no moderation arrows when moderations is empty', () => {
    const html = renderLatent({ moderations: [] })
    expect(html).not.toContain('sem-mod-arrow')
  })

  it('moderation arrows reference their own arrowhead marker (distinct from the structural sem-arrow)', () => {
    const html = renderLatent({ moderations })
    expect(html).toContain('id="sem-arrow-mod"')
    expect(html).toContain('marker-end="url(#sem-arrow-mod)"')
  })

  it('annotates a moderation arrow with its interaction beta when estimates.moderation is present (post-run)', () => {
    const html = renderLatent({
      moderations,
      estimates: { ...estimates, moderation: [{ moderatorId: 2, pathIndex: 0, beta: 0.23 }] },
    })
    expect(html).toContain('.23')
    expect((html.match(/class="sem-mod-label"/g) ?? []).length).toBe(1)
  })

  it('idle Draw mode (no pending moderator) renders no path-midpoint targets — unchanged idle look', () => {
    const html = renderLatent({ mode: 'draw' })
    expect(html).not.toContain('class="sem-mod-target"')
  })
})
```

Add `moderations={[]}` and `onAddModeration={noop}` to the `renderLatent` default props block (required prop —
compile fails otherwise, which is the first RED signal before the markup assertions).

**GREEN — `src/components/SemCanvas.tsx` (SemCanvasUI additions):**

```tsx
export interface SemCanvasUIProps {
  // ...unchanged fields...
  moderations: Moderation[]
  onAddModeration(moderatorId: number, pathIndex: number): void
}
```

Inside `SemCanvasUI`, extend `clickNode` so a path-midpoint click (new handler, see below) can complete the
gesture as a moderation instead of a path. Path/moderation completion both clear `pending`; nothing about the
node-click branch of `clickNode` changes.

```tsx
function clickPathMidpoint(pathIndex: number) {
  if (running || mode !== 'draw' || pending === null) return
  onAddModeration(pending, pathIndex)
  setPending(null)
}
```

Render path-midpoint targets in BOTH modes (replace the existing `mode === 'delete' && <circle .../>` block):

```tsx
{(mode === 'delete' || (mode === 'draw' && pending !== null)) && (
  <circle
    className={mode === 'delete' ? undefined : 'sem-mod-target'}
    data-path-index={i}
    cx={mx} cy={my} r={9}
    fill="var(--card)"
    stroke={mode === 'delete' ? BLUE : 'var(--accent)'}
    style={{ cursor: 'pointer' }}
    onClick={() => (mode === 'delete' ? (!running && onRemovePath(i)) : clickPathMidpoint(i))}
  />
)}
```

Add the accent arrowhead marker beside `sem-arrow` in `<defs>`:

```tsx
<marker id="sem-arrow-mod" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
  <path d="M0,0 L10,5 L0,10 z" fill="var(--accent)" />
</marker>
```

Render the dashed arrows (after the structural-paths `.map`, before the nodes `.map`, so arrows sit under node
ovals visually but over the plain structural lines is fine either order — dashed clay reads clearly over blue):

```tsx
{moderations.map((m) => {
  const modC = centers.get(m.moderatorId)
  const p = paths[m.pathIndex]
  const a = p ? centers.get(p.from) : undefined
  const b = p ? centers.get(p.to) : undefined
  if (!modC || !a || !b) return null
  const mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2
  const beta = estimates && 'moderation' in estimates
    ? (estimates as CbSemResult['estimates'] & { moderation?: Array<{ moderatorId: number; pathIndex: number; beta: number }> })
        .moderation?.find((e) => e.moderatorId === m.moderatorId && e.pathIndex === m.pathIndex)?.beta
    : undefined
  return (
    <g key={`mod-${m.id}`}>
      <line
        className="sem-mod-arrow"
        x1={modC.cx} y1={modC.cy} x2={mx} y2={my}
        stroke="var(--accent)" strokeWidth={2} strokeDasharray="6 4"
        markerEnd="url(#sem-arrow-mod)"
      />
      {beta != null && (
        <text
          className="sem-mod-label"
          x={(modC.cx + mx) / 2} y={(modC.cy + my) / 2 - 6}
          textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--accent)"
          style={{ paintOrder: 'stroke', stroke: 'var(--fill)', strokeWidth: 3 }}
        >
          {`β = ${fmtCoef(beta)}`}
        </text>
      )}
    </g>
  )
})}
```

`CbSemResult['estimates']` needs the new optional field (in `src/lib/stats/runCbSem.ts`):

```ts
estimates: {
  paths: Array<{ from: number; to: number; beta: number }>
  loadings: Record<string, number>
  r2: Record<number, number>
  moderation?: Array<{ moderatorId: number; pathIndex: number; beta: number }>   // NEW — canvas overlay only
}
```

(Populating it is Task 5.3's job — this task only widens the type + renders it when present, so the render
test above can pass with a hand-built `estimates` object.)

**Connected `SemCanvas` wrapper** — thread the new props through:

```tsx
moderations={setup.moderations ?? []}
onAddModeration={(moderatorId, pathIndex) => s.addModeration(testId, moderatorId, pathIndex)}
```

**Store wiring test** — append to `src/components/SemCanvas.wiring.test.tsx`:

```ts
it('addModeration/removeModeration round-trip through the store (same pattern as addPath/removePath)', () => {
  useSession.getState().addPath(TEST_ID, 1, 2)
  useSession.getState().addModeration(TEST_ID, 2, 0)
  expect(useSession.getState().setups[TEST_ID].moderations).toEqual([{ id: 1, moderatorId: 2, pathIndex: 0 }])
  useSession.getState().removeModeration(TEST_ID, 1)
  expect(useSession.getState().setups[TEST_ID].moderations).toEqual([])
})
```

**Verify:** `npx vitest run src/components/SemCanvas.test.tsx src/components/SemCanvas.wiring.test.tsx`. `npx tsc -b`.

**Commit:** `feat(sem-canvas): draw-mode moderation gesture — click construct then path midpoint, dashed clay arrow`

---

### Task 4.3 — Guards with user-visible explanatory messages

**Goal:** Block four invalid moderation gestures with a plain-language message rendered inline (mirrors
`ConstructSlots.tsx`'s `<p className="hint" role="alert">` convention): self-moderation (moderator is the
path's own source or target), duplicate (same moderator + same path already recorded), WLSMV/ordinal
estimator selected, and path-analysis (observed-only) mode. The validation itself is a **pure, directly
unit-tested function** — no simulated DOM clicks needed (this codebase has no `@testing-library/react`;
interactive click sequencing is e2e-only, matching how the existing draw-a-path gesture is tested).

**Files:** `src/components/SemCanvas.tsx`, `src/components/SemCanvas.test.tsx`, `tests/e2e/sem-moderation.spec.ts` (NEW).

**RED — new test block in `src/components/SemCanvas.test.tsx`:**

```ts
import { moderationGuardReason } from './SemCanvas'

const snTaTiConstructs: Construct[] = [
  { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
  { id: 2, name: 'TA', items: ['ta1', 'ta2', 'ta3', 'ta4'] },
  { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
]
const snTiPath: StructuralPath[] = [{ from: 1, to: 3 }]

describe('moderationGuardReason — pure validation (unit-tested directly, no simulated clicks)', () => {
  it('allows a valid moderation (moderator not in the path, no duplicate, ML estimator, latent mode)', () => {
    expect(moderationGuardReason({
      moderatorId: 2, pathIndex: 0, constructs: snTaTiConstructs, paths: snTiPath,
      moderations: [], estimator: 'ML', modelKind: 'latent',
    })).toBeNull()
  })

  it('blocks self-moderation when the moderator IS the path source', () => {
    expect(moderationGuardReason({
      moderatorId: 1, pathIndex: 0, constructs: snTaTiConstructs, paths: snTiPath,
      moderations: [], estimator: 'ML', modelKind: 'latent',
    })).toMatch(/cannot moderate its own path|source or target/i)
  })

  it('blocks self-moderation when the moderator IS the path target', () => {
    expect(moderationGuardReason({
      moderatorId: 3, pathIndex: 0, constructs: snTaTiConstructs, paths: snTiPath,
      moderations: [], estimator: 'ML', modelKind: 'latent',
    })).toMatch(/cannot moderate its own path|source or target/i)
  })

  it('blocks a duplicate (same moderator, same path already recorded)', () => {
    expect(moderationGuardReason({
      moderatorId: 2, pathIndex: 0, constructs: snTaTiConstructs, paths: snTiPath,
      moderations: [{ id: 1, moderatorId: 2, pathIndex: 0 }], estimator: 'ML', modelKind: 'latent',
    })).toMatch(/already moderates|duplicate/i)
  })

  it('blocks under a WLSMV (ordinal) estimator', () => {
    expect(moderationGuardReason({
      moderatorId: 2, pathIndex: 0, constructs: snTaTiConstructs, paths: snTiPath,
      moderations: [], estimator: 'WLSMV', modelKind: 'latent',
    })).toMatch(/WLSMV|ordinal|ML/i)
  })

  it('blocks in path-analysis (observed-only) mode', () => {
    expect(moderationGuardReason({
      moderatorId: 2, pathIndex: 0, constructs: snTaTiConstructs, paths: snTiPath,
      moderations: [], estimator: 'ML', modelKind: 'path',
    })).toMatch(/path.analysis|observed-only/i)
  })
})
```

**GREEN — `src/components/SemCanvas.tsx`:**

```ts
export interface ModerationGuardArgs {
  moderatorId: number
  pathIndex: number
  constructs: Construct[]
  paths: StructuralPath[]
  moderations: Moderation[]
  estimator: string
  modelKind: 'latent' | 'path'
}

/** Pure validation for the moderation gesture (A7 guards) — returns null when the gesture is valid,
 *  else a plain-language reason to show the user. Called BEFORE onAddModeration fires so an invalid
 *  gesture never reaches the store. Order matches the spec's guard list: mode → estimator → self → dup. */
export function moderationGuardReason(a: ModerationGuardArgs): string | null {
  if (a.modelKind === 'path') return 'Moderation is not available in path-analysis (observed-only) mode.'
  if (a.estimator === 'WLSMV') return 'Moderation requires an ML-family estimator; switch off WLSMV (ordinal) to draw a moderation edge.'
  const p = a.paths[a.pathIndex]
  if (!p) return null   // stale index — no-op, not a user-facing guard
  if (a.moderatorId === p.from || a.moderatorId === p.to) return 'A construct cannot moderate its own path (it is already the source or target).'
  if (a.moderations.some((m) => m.moderatorId === a.moderatorId && m.pathIndex === a.pathIndex)) {
    return 'That construct already moderates this path.'
  }
  return null
}
```

Wire it into the gesture (`clickPathMidpoint` from Task 4.2, now guard-checked; `SemCanvasUIProps` gains
`estimator: string`):

```tsx
const [modGuard, setModGuard] = useState<string | null>(null)

function clickPathMidpoint(pathIndex: number) {
  if (running || mode !== 'draw' || pending === null) return
  const reason = moderationGuardReason({
    moderatorId: pending, pathIndex, constructs, paths, moderations, estimator, modelKind,
  })
  if (reason) { setModGuard(reason); setPending(null); return }
  setModGuard(null)
  onAddModeration(pending, pathIndex)
  setPending(null)
}
```

Render the message (near the toolbar, mirrors `ConstructSlots.tsx`'s alert pattern):

```tsx
{modGuard && (
  <p className="hint" role="alert" style={{ color: 'var(--error-tx)', marginTop: 4 }}>{modGuard}</p>
)}
```

Thread `estimator` through the connected `SemCanvas` wrapper: `estimator={String(setup.options['estimator'] ?? 'ML')}`.

**e2e — new file `tests/e2e/sem-moderation.spec.ts`** (scoped to the gesture + guards this task adds; U11
extends this SAME file with the run → slopes-figure journey once U5/U6 land — noted inline so the two units
don't collide):

```ts
import { test, expect } from '@playwright/test'

// This file starts with the DRAW-GESTURE + GUARD coverage (Unit 4). Unit 11 appends the full
// run → simple-slopes-figure journey once U5/U6's statistics land — do not duplicate that here.
test('CB-SEM canvas: moderation gesture draws a dashed clay edge; guards block invalid attempts', async ({ page }) => {
  await page.goto('/')
  // ...upload fixture, select CB-SEM, add SN/TA/TI constructs with items, draw SN→TI (existing gesture)...
  // (setup steps mirror tests/e2e/sem-canvas.spec.ts's construct/path setup, omitted here for brevity)

  // Self-moderation guard: click SN (the path's own source) then its own path midpoint.
  await page.locator('[data-node-id]').first().click()
  await page.locator('[data-path-index="0"]').click()
  await expect(page.getByRole('alert')).toContainText(/cannot moderate its own path/i)

  // Valid gesture: click TA (not in the path) then the SN→TI midpoint.
  await page.locator('[data-node-id]').nth(1).click()
  await page.locator('[data-path-index="0"]').click()
  await expect(page.locator('.sem-mod-arrow')).toHaveCount(1)

  // Duplicate guard: same moderator, same path again.
  await page.locator('[data-node-id]').nth(1).click()
  await page.locator('[data-path-index="0"]').click()
  await expect(page.getByRole('alert')).toContainText(/already moderates/i)
})
```

**Verify:** `npx vitest run src/components/SemCanvas.test.tsx`. `npx playwright test sem-moderation.spec.ts` (once
the fixture setup steps are filled in against the real e2e harness helpers already used by `sem-canvas.spec.ts`).
`npx tsc -b`.

**Commit:** `feat(sem-canvas): moderation gesture guards — self, duplicate, WLSMV, path-analysis, with inline messages`

---

### Task 4.4 — Config → runner routing (moderations reach `runCbSem`'s `buildModel`; forced-ML)

**Goal:** `setup.moderations` must actually reach the CB-SEM WebR runner and produce a fittable lavaan model:
double-mean-centered product indicators via `semTools::indProd` (matched when the source/moderator item
counts are equal, all-products when unequal, per the spike's ruling — not a UI block, a branch), an
interaction latent construct, and `:=` simple-slope definitions, all inside the SAME single bootstrap fit
(no re-fitting, no RNG chunking — preserves WebR≡native parity per Global Constraints).

**Files (NEW):** `src/lib/stats/moderationModel.ts`, `src/lib/stats/moderationModel.test.ts`.
**Files (edited):** `src/lib/stats/runCbSem.ts`, `src/lib/stats/runCbSem.test.ts`.

**Shared R-builder module — `src/lib/stats/moderationModel.ts` (pure, no WebR dependency, unit-tested directly):**

```ts
import type { Construct, StructuralPath } from '../../state/session'

export interface ModerationSpec { id: number; moderatorId: number; pathIndex: number }

export interface ModerationEnv {
  mod_src_items_flat: string[]; mod_src_items_lens: number[]
  mod_mod_items_flat: string[]; mod_mod_items_lens: number[]
  mod_match: boolean[]
  mod_int_names: string[]
  mod_path_labels: string[]
  mod_var_labels: string[]
  mod_moderator_names: string[]
  mod_target_names: string[]
  mod_slope_lo_labels: string[]; mod_slope_mid_labels: string[]; mod_slope_hi_labels: string[]
  mod_base_path_labels: string[]
  anyUnequal: boolean
}

/** Deterministic labels/env for the moderation R block (shared by runCbSem.ts and the cb-sem R-script
 *  emitter — export ≡ app). rNameOf must be the SAME sanitizer both call sites already use (lvNames). */
export function buildModerationEnv(
  moderations: ModerationSpec[],
  constructs: Construct[],
  paths: StructuralPath[],
  rNameOf: (id: number) => string,
): ModerationEnv {
  const byId = new Map(constructs.map((c) => [c.id, c]))
  const varLabelByModerator = new Map<number, string>()
  const env: ModerationEnv = {
    mod_src_items_flat: [], mod_src_items_lens: [], mod_mod_items_flat: [], mod_mod_items_lens: [],
    mod_match: [], mod_int_names: [], mod_path_labels: [], mod_var_labels: [], mod_moderator_names: [],
    mod_target_names: [], mod_slope_lo_labels: [], mod_slope_mid_labels: [], mod_slope_hi_labels: [],
    mod_base_path_labels: [], anyUnequal: false,
  }
  for (const m of moderations) {
    const p = paths[m.pathIndex]
    const source = byId.get(p.from)!, moderator = byId.get(m.moderatorId)!, target = byId.get(p.to)!
    const match = source.items.length === moderator.items.length
    if (!match) env.anyUnequal = true
    env.mod_src_items_flat.push(...source.items); env.mod_src_items_lens.push(source.items.length)
    env.mod_mod_items_flat.push(...moderator.items); env.mod_mod_items_lens.push(moderator.items.length)
    env.mod_match.push(match)
    env.mod_int_names.push(`${rNameOf(source.id)}X${rNameOf(moderator.id)}_${m.id}`)
    env.mod_path_labels.push(`pmod_${m.id}`)
    if (!varLabelByModerator.has(moderator.id)) varLabelByModerator.set(moderator.id, `vmod_${moderator.id}`)
    env.mod_var_labels.push(varLabelByModerator.get(moderator.id)!)
    env.mod_moderator_names.push(rNameOf(moderator.id))
    env.mod_target_names.push(rNameOf(target.id))
    env.mod_slope_lo_labels.push(`slope_lo_${m.id}`)
    env.mod_slope_mid_labels.push(`slope_mid_${m.id}`)
    env.mod_slope_hi_labels.push(`slope_hi_${m.id}`)
    env.mod_base_path_labels.push(`p_${source.id}_${target.id}`)
  }
  return env
}

/** The R statements that consume ModerationEnv: indProd per moderation (chained onto `d`), splice the
 *  interaction measurement + structural + variance-label + `:=` slope lines into `model_str`. Runs
 *  BEFORE the `sem()` call, AFTER `d`/`model_str` are bound. Guarded by `has_moderation` at the call site
 *  (no-op string when moderations is empty — never emitted). IDENTICAL text feeds runCbSem.ts's R_STATS
 *  and the cb-sem R-script emitter (export ≡ app) — this is the ONE place this text is written. */
export const MODERATION_R = String.raw`
if (has_moderation) {
  n_mod <- length(mod_int_names)
  src_start <- 1L; mmod_start <- 1L
  seen_var_labels <- character(0)
  for (mi in seq_len(n_mod)) {
    src_len <- mod_src_items_lens[mi]; mmod_len <- mod_mod_items_lens[mi]
    src_items <- mod_src_items_flat[src_start:(src_start + src_len - 1L)]; src_start <- src_start + src_len
    mmod_items <- mod_mod_items_flat[mmod_start:(mmod_start + mmod_len - 1L)]; mmod_start <- mmod_start + mmod_len
    pi <- semTools::indProd(d, var1 = src_items, var2 = mmod_items,
                             match = mod_match[mi], meanC = TRUE, doubleMC = TRUE)
    prod_cols <- setdiff(names(pi), names(d))
    d <- pi
    model_str <- paste0(model_str, "\n", mod_int_names[mi], " =~ ", paste(prod_cols, collapse = " + "))
    model_str <- paste0(model_str, "\n", mod_target_names[mi], " ~ ", mod_path_labels[mi], "*", mod_int_names[mi])
    if (!(mod_var_labels[mi] %in% seen_var_labels)) {
      model_str <- paste0(model_str, "\n", mod_moderator_names[mi], " ~~ ", mod_var_labels[mi], "*", mod_moderator_names[mi])
      seen_var_labels <- c(seen_var_labels, mod_var_labels[mi])
    }
    model_str <- paste0(model_str,
      "\n", mod_slope_lo_labels[mi],  " := ", mod_base_path_labels[mi], " - ", mod_path_labels[mi], "*sqrt(", mod_var_labels[mi], ")",
      "\n", mod_slope_mid_labels[mi], " := ", mod_base_path_labels[mi],
      "\n", mod_slope_hi_labels[mi],  " := ", mod_base_path_labels[mi], " + ", mod_path_labels[mi], "*sqrt(", mod_var_labels[mi], ")")
  }
}
`
```

**RED — `src/lib/stats/moderationModel.test.ts`:**

```ts
import { describe, it, expect } from 'vitest'
import { buildModerationEnv } from './moderationModel'
import { lvNames } from './lvName'
import type { Construct, StructuralPath } from '../../state/session'

const constructs: Construct[] = [
  { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
  { id: 2, name: 'TA', items: ['ta1', 'ta2', 'ta3', 'ta4'] },
  { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
]
const paths: StructuralPath[] = [{ from: 1, to: 3 }, { from: 2, to: 3 }]
const rNameOf = (id: number) => { const names = lvNames(constructs.map((c) => c.name)); return names[constructs.findIndex((c) => c.id === id)] }

describe('buildModerationEnv', () => {
  it('flags match=TRUE for equal source/moderator item counts (SN 4 items, TA 4 items)', () => {
    const env = buildModerationEnv([{ id: 1, moderatorId: 2, pathIndex: 0 }], constructs, paths, rNameOf)
    expect(env.mod_match).toEqual([true])
    expect(env.anyUnequal).toBe(false)
  })

  it('flags match=FALSE when item counts differ (moderator TA truncated to 3 items)', () => {
    const uneq = [{ ...constructs[1], items: ['ta1', 'ta2', 'ta3'] }, constructs[0], constructs[2]]
    const env = buildModerationEnv([{ id: 1, moderatorId: 2, pathIndex: 0 }], uneq, paths, rNameOf)
    expect(env.mod_match).toEqual([false])
    expect(env.anyUnequal).toBe(true)
  })

  it('assigns deterministic, unique labels per moderation id', () => {
    const env = buildModerationEnv([{ id: 1, moderatorId: 2, pathIndex: 0 }], constructs, paths, rNameOf)
    expect(env.mod_int_names).toEqual(['SNXTA_1'])
    expect(env.mod_path_labels).toEqual(['pmod_1'])
    expect(env.mod_base_path_labels).toEqual(['p_1_3'])   // existing direct-path label scheme (source=1, target=3)
    expect(env.mod_slope_lo_labels).toEqual(['slope_lo_1'])
    expect(env.mod_slope_mid_labels).toEqual(['slope_mid_1'])
    expect(env.mod_slope_hi_labels).toEqual(['slope_hi_1'])
  })

  it('dedupes the moderator variance label across two moderations sharing the same moderator', () => {
    const twoPaths: StructuralPath[] = [{ from: 1, to: 3 }, { from: 2, to: 3 }]
    const env = buildModerationEnv(
      [{ id: 1, moderatorId: 2, pathIndex: 0 }, { id: 2, moderatorId: 2, pathIndex: 1 }],
      constructs, twoPaths, rNameOf,
    )
    // Both moderations share moderator TA (id=2) -> SAME var label so the R block only emits `TA ~~ vmod_2*TA` once.
    expect(env.mod_var_labels).toEqual(['vmod_2', 'vmod_2'])
  })
})
```

**GREEN:** implement `moderationModel.ts` as spec'd above; this file has no WebR dependency so runs under
`test:fast` (fast feedback) as well as the WebR suite.

**Wire into `runCbSem.ts`:**

```ts
import { buildModerationEnv, MODERATION_R } from './moderationModel'

// Append MODERATION_R to R_STATS's model-assembly section (between `d` construction and the
// set.seed()/sem() fit call) — a single string concatenation, gated by the `has_moderation` env boolean
// (false/empty moderations -> the if-block never executes, byte-identical to today for the other 47 tests).
```

Inside `runCbSem()`, after `buildModel(...)`:

```ts
const moderations = setup.moderations ?? []
const hasModeration = moderations.length > 0
const modEnv = buildModerationEnv(moderations, constructs, paths, rNameOf)
```

Add `hasModeration`/`modEnv.*` fields to the `env` object passed to `engine.runJson`, and change the
bootstrap-vs-plain fit branch from `has_indirect` to `has_indirect || has_moderation` (moderation ALWAYS
needs its own bootstrap SEs/CIs regardless of whether a mediation chain also exists — "FORCES ML + bootstrap
SE" per spec; lavaan's default `sem()` call already IS ML since no `estimator=`/`ordered=` argument is ever
passed, so "forced ML" costs nothing further here — it is the ALREADY-true default, made explicit by a
comment so a future WLSMV implementation does not accidentally reach a moderation model):

```ts
const needsBootstrap = hasIndirect || hasModeration
// ... env.has_indirect renamed conceptually but kept as `has_indirect` for the existing := indirect-effects
// extraction; add a SEPARATE has_moderation boolean rather than overloading has_indirect, since moderation's
// := rows (slope_lo/mid/hi) must NOT be swept into the existing ie_*-prefixed indirect-effects table.
```

R_STATS changes (inline, right after `d` is assembled, before `set.seed(20260620)`):

```r
${MODERATION_R}
```

(the R text imported as a constant and spliced via template literal into `R_STATS`; guard: `if (has_indirect || has_moderation) { fit <- lavaan::sem(model_str, data = d, se = "bootstrap", bootstrap = ...) } else { ... }` — unchanged branch condition source, just widened).

Also fix the `:=` label filter so moderation slope rows never leak into `indirect_rows` (they share
`pe$op == ":="` with the existing `ie_*` labels): change the indirect-extraction index from
`which(pe$op == ":=")` to `which(pe$op == ":=" & grepl("^ie_", pe$lhs))`.

**RED (native-R-verified) — append to `src/lib/stats/runCbSem.test.ts`:**

```ts
import { loadCsvFixture } from './csvFixture'
import { join } from 'node:path'

// Reference: docs/superpowers/reviews/2026-07-06-moderation-spike.md §2 (matched model, bootstrap=500,
// seed=20260706) — SN/TA/TI, n=400, real interaction baked into the DGP. Fixture copied to
// tests/e2e/fixtures/sem-moderation.csv (Task 5.5 commits the copy; this test reads the SAME file).
const MOD_SETUP: TestSetup = {
  roles: {}, options: { estimator: 'ML', nboot: 500 }, props: {}, blocked: null, modelKind: 'latent',
  constructs: [
    { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
    { id: 2, name: 'TA', items: ['ta1', 'ta2', 'ta3', 'ta4'] },
    { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
  ],
  paths: [{ from: 1, to: 3 }, { from: 2, to: 3 }],
  moderations: [{ id: 1, moderatorId: 2, pathIndex: 0 }],   // TA moderates SN→TI
}

describe('runCbSem — latent moderation (matched, native-R-verified)', () => {
  it('interaction path (TI ~ SNTA) matches the spike reference values exactly', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/sem-moderation.csv'))
    const result = await runCbSem(engine, data, MOD_SETUP)
    const row = result.moderation!.rows[0]
    expect(row.b).toBeCloseTo(0.25819002, 5)
    expect(row.se).toBeCloseTo(0.06567043, 5)
    expect(row.z).toBeCloseTo(3.93160231, 4)
    expect(row.p).toBeCloseTo(0.00008438, 6)
    expect(row.ciPercLower).toBeCloseTo(0.13214640, 4)
    expect(row.ciPercUpper).toBeCloseTo(0.40561818, 4)
    expect(row.stdBeta).toBeCloseTo(0.23155625, 4)
  })

  it('simple slopes at -1SD/mean/+1SD of TA match the spike reference values exactly', async () => {
    const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/sem-moderation.csv'))
    const result = await runCbSem(engine, data, MOD_SETUP)
    const [lo, mid, hi] = result.moderation!.slopes
    expect(lo.b).toBeCloseTo(0.258827, 4); expect(lo.ciLower).toBeCloseTo(0.129549, 3); expect(lo.ciUpper).toBeCloseTo(0.395864, 3)
    expect(mid.b).toBeCloseTo(0.465867, 4); expect(mid.ciLower).toBeCloseTo(0.359732, 3); expect(mid.ciUpper).toBeCloseTo(0.579842, 3)
    expect(hi.b).toBeCloseTo(0.672907, 4); expect(hi.ciLower).toBeCloseTo(0.523766, 3); expect(hi.ciUpper).toBeCloseTo(0.855240, 3)
  })

  it('indirect effects (ie_* labels) are unaffected by moderation slope defs sharing op==":="', () => {
    // With no chained X->M->Y in MOD_SETUP, indirect stays undefined — proves the ^ie_ filter
    // doesn't accidentally pick up slope_lo/mid/hi as "indirect effects".
    // (a chained-plus-moderation fixture is exercised in the runs-in-r gate, Task 5.5)
  })
})
```

Copy the spike CSV into the e2e fixtures dir now (needed by this test, not just Task 5.5's emitter gate):

```bash
cp .superpowers/sdd/spike-moderation-data.csv tests/e2e/fixtures/sem-moderation.csv
```

**Verify:** `npx vitest run src/lib/stats/moderationModel.test.ts` (fast). `npx vitest run src/lib/stats/runCbSem.test.ts`
(WebR-backed, slow — run in isolation, per repo convention: `--exclude` list already carves this file out of
`test:fast`). `npx tsc -b`.

**Commit:** `feat(sem): moderation reaches runCbSem — indProd double-mean-centering, interaction construct, := simple slopes (native-R matched)`

---

### Unit 5 — A7 reporting + export (5 tasks)

### Task 5.1 — Table 5 Moderation section rows through `buildCbSem` (H-ids continue)

**Goal:** `buildCbSem` renders the interaction-path row(s) under a new "Moderation" `__section` marker in the
already-merged Table 5 (U3's Direct paths / Indirect effects sections), with H-ids continuing the sequence
(`structural paths → indirect effects → moderation edges`, all in creation/array order per the Global
Constraints H-ordering rule) and the SAME Result rule (percentile 95% CI excludes zero).

**Files:** `src/lib/results/buildCbSem.ts`, `src/lib/results/buildCbSem.test.ts`, `src/lib/stats/runCbSem.ts`
(row shape only), `telos_test_outputs.html` (Moderation section markup), `src/lib/registry/cbSem.consistency.test.ts`
(assertion additions), `docs/superpowers/reviews/2026-07-06-completeness-audit.md` is NOT touched here (R1's job).

**Runner row shape** (extend the moderation R-extraction in `runCbSem.ts` — this task assumes Task 4.4's
`MODERATION_R` model-building landed; it adds the READ-BACK of the fitted rows):

```r
# ---- Moderation rows (interaction path + slopes) — kept SEPARATE from struct_rows/indirect_rows ----
mod_rows <- list()
mod_slopes <- list()
if (has_moderation) {
  for (mi in seq_len(length(mod_int_names))) {
    lbl <- mod_path_labels[mi]
    gi <- which(ss$op == "~" & ss$rhs == mod_int_names[mi])[1]
    m  <- which(pe_perc$op == "~" & pe_perc$rhs == mod_int_names[mi])[1]
    mod_rows[[mi]] <- list(
      path = paste0(mod_moderator_names[mi], " × ", "(direct path)", " → ", mod_target_names[mi]),
      b = as.numeric(pe_perc$est[m]), se = as.numeric(pe_perc$se[m]),
      z = as.numeric(pe_perc$z[m]), p = as.numeric(pe_perc$pvalue[m]),
      stdBeta = as.numeric(ss$est.std[gi]),
      ciPercLower = as.numeric(pe_perc$ci.lower[m]), ciPercUpper = as.numeric(pe_perc$ci.upper[m]),
      ciBcLower = as.numeric(pe_bc$ci.lower[which(pe_bc$op == "~" & pe_bc$rhs == mod_int_names[mi])[1]]),
      ciBcUpper = as.numeric(pe_bc$ci.upper[which(pe_bc$op == "~" & pe_bc$rhs == mod_int_names[mi])[1]])
    )
    for (lv in c("lo", "mid", "hi")) {
      lvl_label <- get(paste0("mod_slope_", lv, "_labels"))[mi]
      si <- which(pe_perc$op == ":=" & pe_perc$lhs == lvl_label)[1]
      mod_slopes[[length(mod_slopes) + 1]] <- list(
        level = c(lo = "-1SD", mid = "mean", hi = "+1SD")[[lv]],
        b = as.numeric(pe_perc$est[si]), se = as.numeric(pe_perc$se[si]), p = as.numeric(pe_perc$pvalue[si]),
        ciLower = as.numeric(pe_perc$ci.lower[si]), ciUpper = as.numeric(pe_perc$ci.upper[si])
      )
    }
  }
}
```

(`pe_perc`/`pe_bc` are the dual-CI `parameterEstimates()` calls Task assumed already present from U2 — this
task only adds the moderation-specific read of them, mirroring the existing `struct_rows`/`indirect_rows`
extraction style exactly.)

`CbSemResult` gains (append to the interface in `runCbSem.ts`):

```ts
moderation?: {
  rows: Array<Record<string, unknown>>   // same row shape as `structural[]` (dual CI etc.)
  slopes: Array<{ level: '-1SD' | 'mean' | '+1SD'; b: number; se: number; p: number; ciLower: number; ciUpper: number }>
}
```

**RED — `src/lib/results/buildCbSem.test.ts`:**

```ts
it('Table 5 gets a Moderation section with an H-id continuing after structural + indirect, Result rule applied', () => {
  const r: CbSemResult = {
    mode: 'full', saturated: false,
    cfaLoadings: [], reliability: [],
    fit: { chisq: 10, df: 5, pvalue: 0.1, cfi: 0.97, tli: 0.96, rmsea: 0.04, rmseaLower: 0.01, rmseaUpper: 0.08, srmr: 0.03 },
    structural: [{ from: 1, to: 3, fromName: 'SN', toName: 'TI', b: 0.5, se: 0.1, z: 5, p: 0.001, stdBeta: 0.4, ciPercLower: 0.3, ciPercUpper: 0.7, ciBcLower: 0.29, ciBcUpper: 0.71, r2: 0.3 }],
    rsquare: { 3: 0.37 },
    moderation: {
      rows: [{ path: 'TA × SN → TI', b: 0.258, se: 0.066, z: 3.93, p: 0.0001, stdBeta: 0.232, ciPercLower: 0.132, ciPercUpper: 0.406, ciBcLower: 0.130, ciBcUpper: 0.410 }],
      slopes: [
        { level: '-1SD', b: 0.2588, se: 0.068, p: 0.0002, ciLower: 0.1295, ciUpper: 0.3959 },
        { level: 'mean', b: 0.4659, se: 0.056, p: 0.00001, ciLower: 0.3597, ciUpper: 0.5798 },
        { level: '+1SD', b: 0.6729, se: 0.085, p: 0.00001, ciLower: 0.5238, ciUpper: 0.8552 },
      ],
    },
    estimates: { paths: [], loadings: {}, r2: {} },
  }
  const content = buildCbSem(CB_SEM, r)
  const t5 = content.tables.find((t) => t.spec.id === 'structural-paths')!
  const modSectionIdx = t5.rows.findIndex((row) => (row as Record<string, unknown>).__section === 'Moderation')
  expect(modSectionIdx).toBeGreaterThan(-1)
  const modRow = t5.rows[modSectionIdx + 1] as Record<string, string>
  expect(modRow.hId).toBe('H2')   // H1 = the one structural path; H2 = the moderation row (no indirect rows here)
  expect(modRow.result).toBe('Supported')   // percentile CI [.132, .406] excludes zero
  expect(modRow.beta).toBe('.23')
})

it('a moderation slope CI that spans zero renders Result = "Not supported"', () => {
  // ...same fixture with ciPercLower/ciPercUpper straddling 0 on the moderation row -> 'Not supported'
})
```

(Exact `t5.rows` shape/H-id field name follow whatever U3 already established for the structural/indirect
sections — this task's implementation MUST reuse that same row-building helper rather than re-deriving H-ids
independently, so continue-the-sequence is structural, not coincidental.)

**GREEN — `buildCbSem.ts`:** extend the Table-5-row assembly (already emitting Direct-paths + Indirect-effects
sections per U3) with a third section, appended only when `r.moderation?.rows.length`:

```ts
if (r.moderation?.rows.length) {
  rows.push({ __section: 'Moderation' } as unknown as (typeof rows)[number])
  for (const row of r.moderation.rows) {
    rows.push(structuralRowOf(row, nextHId()))   // reuse U3's per-row H-id + Result-rule helper
  }
}
```

(`structuralRowOf`/`nextHId` are named per whatever U3's actual implementation calls its shared row-builder —
implementer confirms the exact names from the U3 diff before writing this task; the row SHAPE and Result rule
must be reused verbatim, not reimplemented, so the three sections are visually and numerically consistent.)

**Master-HTML update (load-bearing for `cbSem.consistency.test.ts`):** add a "Moderation" section row + one
example interaction row to the CB-SEM card's Table 5 in `telos_test_outputs.html`, matching the column set
already there (H | Path | B | SE | z | p | Std. β | Percentile CI | BC CI | Result) — the consistency test
diffs the registry's column *headers* against this HTML verbatim, so the header row itself does not change
(only the body demonstrates the new section), but add an assertion to `cbSem.consistency.test.ts` that the
HTML's Table 5 caption/notes now mention "Moderation" so the master doc and the registry's `tableNote` text
stay in lockstep:

```ts
it('tableNote documents the Moderation section (A7)', () => {
  expect(spec.tableNote!.text).toMatch(/Moderation/i)
})
```

Update `cbSem.ts`'s `tableNote` text to mention the Moderation section (replacing the stale "Moderation is
planned for a later version." sentence with a description of when it appears + the interaction-term citation
pointer, consistent with A4's later citation work — a plain sentence for now, A4 formalizes the citation).

**Verify:** `npx vitest run src/lib/results/buildCbSem.test.ts src/lib/registry/cbSem.consistency.test.ts`. `npx tsc -b`.

**Commit:** `feat(sem-b): Table 5 Moderation section — H-ids continue, Result rule applies, master doc updated`

---

### Task 5.2 — Simple-slopes figure (whiskered, 3 levels) + conditional-effects table

**Goal:** A new app-drawn figure via the EXISTING ggplot2-in-R pipeline (`engine.capturePlot`, the same
mechanism `efa.ts`'s scree plot and `latent.ts`'s AVE/CR bar charts already use) — three whiskered points at
−1SD/mean/+1SD of the moderator, no continuous band — plus a conditional-effects table (level | b | SE | p |
boot 95% CI) whose numbers are IDENTICAL to the figure's (same `moderation.slopes[]` array feeds both). Also
fixes the `ResultPreviewCard` multi-figure gap (design decision 3 above) so the new figure actually shows its
own PNG instead of duplicating the live canvas.

**Files:** `src/lib/stats/runCbSem.ts` (figure block), `src/lib/results/buildCbSem.ts`, `src/lib/results/buildCbSem.test.ts`,
`src/lib/registry/cbSem.ts` (new table + figure entries), `src/components/ResultPreviewCard.tsx`,
`src/components/ResultPreviewCard.test.tsx`.

**Runner — figure generation** (in `runCbSem.ts`, only when `hasModeration`):

```ts
if (hasModeration && raw.modSlopes?.length) {
  const slopesBlock = [
    'library(ggplot2)',
    'df_plot <- data.frame(level = factor(levels, levels = levels), b = bs, lo = los, hi = his)',
    'print(',
    '  ggplot2::ggplot(df_plot, ggplot2::aes(x = level, y = b)) +',
    '  ggplot2::geom_point(size = 3, colour = "#d97757") +',
    '  ggplot2::geom_errorbar(ggplot2::aes(ymin = lo, ymax = hi), width = 0.15, colour = "#d97757") +',
    '  ggplot2::geom_hline(yintercept = 0, linetype = "dotted", colour = "#888") +',
    '  ggplot2::labs(x = NULL, y = "Conditional effect (simple slope)") +',
    '  ggplot2::theme_minimal(base_size = 11)',
    ')',
  ].join('\n')
  figModSlopesPng = await engine.capturePlot(slopesBlock, 500, 380, {
    levels: raw.modSlopes.map((s: { level: string }) => s.level),
    bs: raw.modSlopes.map((s: { b: number }) => s.b),
    los: raw.modSlopes.map((s: { ciLower: number }) => s.ciLower),
    his: raw.modSlopes.map((s: { ciUpper: number }) => s.ciUpper),
  })
}
```

Return `figModSlopesPng?: Uint8Array` on `CbSemResult` alongside `moderation`.

**Registry — `src/lib/registry/cbSem.ts`:** add a new table + a second figure entry:

```ts
{
  id: 'conditional-effects',
  domId: 'cb-sem-conditional-effects',
  title: 'Conditional effects (simple slopes)',
  columns: [
    { key: 'level', label: 'Moderator level' },
    { key: 'b', label: 'B' },
    { key: 'se', label: 'SE' },
    { key: 'p', label: 'p' },
    { key: 'ci', label: 'boot 95% CI' },
  ],
},
```

and in `figures`:

```ts
figures: [
  { caption: 'Model', type: 'path diagram (constructs, loadings, structural paths)', file: 'path-diagram' },
  { caption: 'Simple slopes', type: 'conditional-effects plot (whiskered 95% CI at -1SD/mean/+1SD)', file: 'simple-slopes', optional: true },
],
```

(`optional: true` — the FigureSpec field already exists in `registry/types.ts` for exactly this "not every run
produces it" case.)

**Builder — `buildCbSem.ts`:**

```ts
if (r.moderation?.slopes.length) {
  const rows = r.moderation.slopes.map((s) => ({
    level: s.level, b: f(s.b), se: f(s.se), p: fp(s.p), ci: `[${f01(s.ciLower)}, ${f01(s.ciUpper)}]`,
  }))
  tables.push({ spec: specTable(spec, 'conditional-effects'), rows })
}

const figs = figuresOf(spec)
const figures: CardContent['figures'] = [
  figs[0] ? { caption: figs[0].caption, type: figs[0].type, file: figs[0].file, png: new Uint8Array(0) } : undefined,
  r.moderation && figs[1] ? { caption: figs[1].caption, type: figs[1].type, file: figs[1].file, png: r.figModSlopesPng ?? new Uint8Array(0) } : undefined,
].filter((f): f is NonNullable<typeof f> => f != null)
```

**RED — `buildCbSem.test.ts`:**

```ts
it('emits the conditional-effects table with the SAME numbers as moderation.slopes', () => {
  const r = { /* ...as Task 5.1's fixture, with moderation.slopes... */ } as CbSemResult
  const content = buildCbSem(CB_SEM, r)
  const table = content.tables.find((t) => t.spec.id === 'conditional-effects')!
  expect(table.rows).toEqual([
    { level: '-1SD', b: '0.26', se: '0.07', p: '<.001', ci: '[.13, .40]' },
    { level: 'mean', b: '0.47', se: '0.06', p: '<.001', ci: '[.36, .58]' },
    { level: '+1SD', b: '0.67', se: '0.09', p: '<.001', ci: '[.52, .86]' },
  ])
})

it('emits a SECOND figure entry (simple-slopes) with real PNG bytes when moderation is present, none when absent', () => {
  const withMod = buildCbSem(CB_SEM, { ...baseR, moderation: modFixture, figModSlopesPng: new Uint8Array([1, 2, 3]) })
  expect(withMod.figures).toHaveLength(2)
  expect(withMod.figures[1].png.length).toBeGreaterThan(0)
  const withoutMod = buildCbSem(CB_SEM, baseR)
  expect(withoutMod.figures).toHaveLength(1)
})
```

**Fix the `ResultPreviewCard` multi-figure gap** — `src/components/ResultPreviewCard.test.tsx` RED:

```ts
it('sem-canvas cards with 2 figures use figureSlot ONLY for figure 0 (path diagram); figure 1 renders its own <img>', () => {
  const content = { /* tables: [], */ figures: [
    { caption: 'Model', type: 'path diagram', png: new Uint8Array(0) },
    { caption: 'Simple slopes', type: 'conditional-effects plot', png: new Uint8Array([137, 80, 78, 71]) },
  ], /* ...other CardContent fields... */ } as CardContent
  const html = renderToStaticMarkup(
    <ResultPreviewCard index={1} name="CB-SEM" question="q" content={content} stale={false} running={false}
      onRerun={() => {}} figureSlot={<div data-testid="canvas-slot" />} />
  )
  expect((html.match(/data-testid="canvas-slot"/g) ?? []).length).toBe(1)   // NOT duplicated for figure 1
})
```

GREEN — `ResultPreviewCard.tsx`:

```tsx
{content.figures.map((fig, i) => (
  <div key={`${fig.type}-${i}`}>
    <p><b>Figure.</b> {fig.caption}</p>
    {figureSlot && i === 0 ? figureSlot : (urls[i] && <img src={urls[i]} alt={`${fig.type} — ${fig.caption}`} width={480} />)}
  </div>
))}
```

**Verify:** `npx vitest run src/lib/results/buildCbSem.test.ts src/components/ResultPreviewCard.test.tsx`. `npx tsc -b`.

**Commit:** `feat(sem-b): simple-slopes figure (ggplot2 whiskered CIs) + conditional-effects table; fix multi-figure card rendering`

---

### Task 5.3 — Path-diagram dashed moderation arrow (analysis.R semPaths figure AND app SVG post-run annotation)

**Goal:** The path diagram itself gains the dashed moderation arrow in BOTH renderings: the app's live SVG
canvas (post-run — populate the `estimates.moderation` overlay field Task 4.2 already renders) and the
export's `semPlot::semPaths()`-based figure in `analysis.R` (best-effort — semPaths doesn't natively draw a
"moderation" edge type, so the interaction construct's own path IS the visual proxy: it already appears as a
regular path from the interaction latent to the target, which IS the dashed-worthy relationship; document this
honestly rather than oversell semPaths' moderation-specific rendering).

**Files:** `src/lib/stats/runCbSem.ts` (populate `estimates.moderation`), `src/lib/stats/runCbSem.test.ts`,
`src/lib/export/rScript/emitters/latent.ts` (figure comment/caption only).

**GREEN — `runCbSem.ts`:** populate the overlay field alongside `estPaths` in the R block:

```r
est_moderation <- list()
if (has_moderation) {
  for (mi in seq_len(length(mod_int_names))) {
    gi <- which(ss$op == "~" & ss$rhs == mod_int_names[mi])[1]
    est_moderation[[mi]] <- list(moderatorId = NA, pathIndex = NA, beta = as.numeric(ss$est.std[gi]))
  }
}
```

(`moderatorId`/`pathIndex` are filled TS-side from `moderations[mi]` — R only computes the beta; the TS
wrapper zips them together, mirroring how `estPaths` is already built from `struct_rows` TS-side rather than
requiring R to know about canvas ids.)

```ts
const estModeration = moderations.map((m, i) => ({
  moderatorId: m.moderatorId, pathIndex: m.pathIndex, beta: raw.estModeration?.[i]?.beta ?? 0,
}))
return {
  // ...existing fields...
  estimates: { paths: raw.estPaths, loadings: raw.estLoadings, r2: rsquare, moderation: hasModeration ? estModeration : undefined },
}
```

**RED — `runCbSem.test.ts`:**

```ts
it('estimates.moderation carries the standardized interaction beta, keyed by moderatorId/pathIndex', async () => {
  const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/sem-moderation.csv'))
  const result = await runCbSem(engine, data, MOD_SETUP)
  expect(result.estimates.moderation).toEqual([{ moderatorId: 2, pathIndex: 0, beta: expect.closeTo(0.2316, 3) }])
})
```

**Export figure caption honesty** — `latent.ts`'s `cb-sem` emitter, append a comment (no code-behavior
change) documenting the limitation next to the existing `semPlot::semPaths(...)` call:

```ts
out.push(
  '',
  '# Note: semPaths draws the interaction construct\'s own path like any other structural path (no',
  '# distinct "moderation" edge style) — this is the closest reproducible native-R rendering; the app\'s',
  '# live canvas draws it as a dashed clay arrow (see figure_path-diagram.png from the app export).',
)
```

**Verify:** `npx vitest run src/lib/stats/runCbSem.test.ts`. `npx tsc -b`.

**Commit:** `feat(sem-b): estimates.moderation overlay wired end-to-end — canvas dashed arrow gets its live beta label`

---

### Task 5.4 — analysis.R emitters: indProd + `:=` model + dual CIs (export ≡ app)

**Goal:** The `cb-sem` R-script emitter (`latent.ts`) reproduces the SAME indProd + interaction + `:=` model
as the app runner, using the SAME shared `moderationModel.ts` text (Task 4.4's design decision 1) — so
`analysis.R` run under native `Rscript` reproduces the app's numbers exactly.

**Files:** `src/lib/export/rScript/emitters/latent.ts`, `src/lib/export/rScript/emitters/latent.cbsem.test.ts`.

**GREEN — `latent.ts`'s `'cb-sem'` emitter:**

```ts
import { buildModerationEnv, MODERATION_R } from '../../../stats/moderationModel'

// ...inside the 'cb-sem' emitter, after building `modelR` (unchanged base model) and BEFORE emitting the
// `model_str <- "..."` line:
const moderations = (setup.moderations as { id: number; moderatorId: number; pathIndex: number }[]) ?? []
const hasModeration = moderations.length > 0
const modEnv = hasModeration ? buildModerationEnv(moderations, constructs, paths, rNameOf) : null
```

Emit the moderation env as literal R vectors (mirrors how `latent.ts`'s other emitters already inline
`constructItemsFlatR`/`constructItemsLensR` as `c("a","b",...)` literals — no WebR env-binding machinery needed
in the exported script, since it's a standalone `Rscript`):

```ts
if (hasModeration && modEnv) {
  out.push(
    '',
    '# ---- Latent moderation: indProd double-mean-centering + interaction construct + := simple slopes ----',
    `mod_src_items_flat <- c(${modEnv.mod_src_items_flat.map((s) => `"${s}"`).join(', ')})`,
    `mod_src_items_lens <- c(${modEnv.mod_src_items_lens.join(', ')})`,
    `mod_mod_items_flat <- c(${modEnv.mod_mod_items_flat.map((s) => `"${s}"`).join(', ')})`,
    `mod_mod_items_lens <- c(${modEnv.mod_mod_items_lens.join(', ')})`,
    `mod_match <- c(${modEnv.mod_match.map((b) => (b ? 'TRUE' : 'FALSE')).join(', ')})`,
    `mod_int_names <- c(${modEnv.mod_int_names.map((s) => `"${s}"`).join(', ')})`,
    `mod_path_labels <- c(${modEnv.mod_path_labels.map((s) => `"${s}"`).join(', ')})`,
    `mod_var_labels <- c(${modEnv.mod_var_labels.map((s) => `"${s}"`).join(', ')})`,
    `mod_moderator_names <- c(${modEnv.mod_moderator_names.map((s) => `"${s}"`).join(', ')})`,
    `mod_target_names <- c(${modEnv.mod_target_names.map((s) => `"${s}"`).join(', ')})`,
    `mod_slope_lo_labels <- c(${modEnv.mod_slope_lo_labels.map((s) => `"${s}"`).join(', ')})`,
    `mod_slope_mid_labels <- c(${modEnv.mod_slope_mid_labels.map((s) => `"${s}"`).join(', ')})`,
    `mod_slope_hi_labels <- c(${modEnv.mod_slope_hi_labels.map((s) => `"${s}"`).join(', ')})`,
    `mod_base_path_labels <- c(${modEnv.mod_base_path_labels.map((s) => `"${s}"`).join(', ')})`,
    'has_moderation <- TRUE',
    MODERATION_R,
  )
  if (modEnv.anyUnequal) {
    out.push(
      '# NOTE: unequal source/moderator indicator counts -> indProd(match=FALSE, all-products, double-mean-centered).',
    )
  }
} else {
  out.push('has_moderation <- FALSE')
}
```

(`has_moderation`/`model_str` must be bound BEFORE the existing `set.seed(20260620)` / `sem(...)` call, and the
existing `hasIndirect` boolean controlling the bootstrap-vs-plain branch must become
`hasIndirect || hasModeration` here too, matching `runCbSem.ts`'s Task 4.4 change exactly.)

**RED — `latent.cbsem.test.ts`:** append a case asserting the emitted R text contains the indProd call and the
three `:=` slope lines for a moderation setup (string-containment test, matching this file's existing style):

```ts
it('emits indProd + interaction construct + := simple slopes when setup.moderations is present', () => {
  const R = latentEmitters['cb-sem'](CB_SEM, {
    ...baseSetup,
    constructs: snTaTiConstructs, paths: [{ from: 1, to: 3 }, { from: 2, to: 3 }],
    moderations: [{ id: 1, moderatorId: 2, pathIndex: 0 }],
  } as never)
  expect(R).toContain('semTools::indProd(d, var1 = src_items, var2 = mmod_items')
  expect(R).toContain('slope_lo_1')
  expect(R).toContain('slope_mid_1')
  expect(R).toContain('slope_hi_1')
  expect(R).toContain('mod_match <- c(TRUE)')   // SN/TA both 4 items -> matched
})
```

**Verify:** `npx vitest run src/lib/export/rScript/emitters/latent.cbsem.test.ts`. `npx tsc -b`.

**Commit:** `feat(sem-export): cb-sem emitter reproduces latent moderation — shared moderationModel.ts text (export ≡ app)`

---

### Task 5.5 — runs-in-r fixture on `.superpowers/sdd/spike-moderation-data.csv`

**Goal:** Native-R execution of the FULL emitted `analysis.R` for a moderation setup, asserting the spike's
exact numbers reach stdout — the same discipline as every other `runs-in-r.test.ts` entry, closing the loop
started in Task 4.4 (WebR-side native verification) at the export layer.

**Files:** `src/lib/export/rScript/runs-in-r.test.ts`, `tests/e2e/fixtures/sem-moderation.csv` (already committed
in Task 4.4 — reused, not re-copied).

**RED — new `REPS` entry in `runs-in-r.test.ts`:**

```ts
// cb-sem moderation: SN/TA/TI matched interaction (spike §2, docs/superpowers/reviews/2026-07-06-moderation-spike.md).
// bootstrap reduced to 500 (spike's own count) for the native-R time budget — matches the spike's exact numbers.
{ id: 'cb-sem', fixture: 'sem-moderation.csv',
  setup: {
    roles: {}, options: { estimator: 'ML', nboot: 500, ciType: 'percentile' }, props: {}, blocked: null,
    modelKind: 'latent',
    constructs: [
      { id: 1, name: 'SN', items: ['sn1', 'sn2', 'sn3', 'sn4'] },
      { id: 2, name: 'TA', items: ['ta1', 'ta2', 'ta3', 'ta4'] },
      { id: 3, name: 'TI', items: ['ti1', 'ti2', 'ti3'] },
    ],
    paths: [{ from: 1, to: 3 }, { from: 2, to: 3 }],
    moderations: [{ id: 1, moderatorId: 2, pathIndex: 0 }],
  },
  expect: ['slope_lo_1', 'slope_mid_1', 'slope_hi_1'],   // presence of the Table 7 defined-parameter rows
},
```

The REPS harness (`emitRScript` → write `analysis.R` + `cleaned.csv` → `Rscript analysis.R`) already asserts
exit-0 (execSync throws on nonzero) plus the `expect[]` substrings. Add a SECOND, numeric-precision assertion
right after the existing loop (this file's established pattern of a plain string-containment `expect` per rep
does not carry decimal precision — add one dedicated `it` for the moderation numbers specifically, reading the
full stdout and regex-extracting the interaction row, mirroring how other native-R tests in this repo assert
precision when a REP needs it):

```ts
it('cb-sem moderation — interaction path B matches the spike reference to 4 decimals in native R stdout', () => {
  const ds = parseCsv(readFileSync(join(FIXTURES, 'sem-moderation.csv'), 'utf8'))
  const rep = REPS.find((r) => r.fixture === 'sem-moderation.csv')!
  const R = emitRScript([rep.id], { [rep.id]: rep.setup }, SPECS, ds)
  const csv = toCsv(ds)
  const dir = mkdtempSync(join(tmpdir(), 'telos-r-mod-'))
  writeFileSync(join(dir, 'analysis.R'), R); writeFileSync(join(dir, 'cleaned.csv'), csv)
  const out = execSync('Rscript analysis.R', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  // pull the interaction path's estimate out of the printed parameterEstimates rows for the `pmod_1` label
  const m = out.match(/pmod_1[^\n]*?(-?\d+\.\d+)/)
  expect(m).not.toBeNull()
  expect(Number(m![1])).toBeCloseTo(0.258, 2)
})
```

Run only where `hasR` (existing `describe.skipIf(!hasR)` guard already covers this — no change needed there).

**Verify:** `Rscript --version` present locally → `npx vitest run src/lib/export/rScript/runs-in-r.test.ts` (slow,
excluded from `test:fast` already). `npx tsc -b`.

**Commit:** `test(sem-export): runs-in-r gate for latent moderation — native R reproduces the spike's numbers from analysis.R`

---

### Unit 6 — P1 PLS-SEM full parity (6 tasks)

### Task 6.1 — Measurement table reshape (grouped; construct rows ρC/α/AVE; indicator rows Mean/SD/loading-or-weight)

**Goal:** Merge PLS-SEM's `outer-model` + `reliability` tables into ONE grouped table (A6 device 1, landed in
U1): construct rows (italic, group header) carry ρC/α/AVE once; indicator rows (children) carry Mean, SD, and
the existing merged loading-or-weight column. New item Mean/SD is a runner addition (mirrors CB-SEM Table 1's
item Mean/SD from U2/U3, computed the same way: on the estimation sample, per the missing-data setting).

**Files:** `src/lib/stats/plsSem.ts`, `src/lib/stats/plsSem.test.ts`, `src/lib/results/buildPlsSem.ts`,
`src/lib/results/buildPlsSem.test.ts`, `src/lib/registry/plsSem.ts`, `src/lib/registry/plsSem.consistency.test.ts`,
`telos_test_outputs.html`.

**Runner — item Mean/SD** (add to the R block in `plsSem.ts`, right after `d_all` is assembled):

```r
item_means <- sapply(all_items, function(it) mean(d_all[[it]], na.rm = TRUE))
item_sds   <- sapply(all_items, function(it) sd(d_all[[it]], na.rm = TRUE))
```

Attach to the per-item `outer` rows already being built (in the `for (it in items_ci)` loop):

```r
outer[[length(outer) + 1]] <- list(construct = nm, item = it,
  weight = w_or_NA, loading = l_or_NA, vif = vif_v, t = tval, p = 2 * pnorm(-abs(tval)),
  mean = as.numeric(item_means[[it]]), sd = as.numeric(item_sds[[it]]))
```

**RED — `plsSem.test.ts`:**

```ts
it('outer rows carry item mean/sd computed on the listwise sample', async () => {
  const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/mobi.csv'))
  const result = await runPlsSem(engine, data, MOBI_SETUP)
  const row = result.outer.find((r) => r.item === 'IMAG1')!
  expect(row.mean).toBeCloseTo(/* native-R mean(mobi$IMAG1) */ 5.0, 1)
  expect(row.sd).toBeGreaterThan(0)
})
```

(Implementer fills the exact native-R reference mean via `Rscript -e 'library(seminr); cat(mean(mobi$IMAG1))'`
before finalizing — `seminr::mobi` ships with the package so this is a deterministic constant, not a spike
number; record it in the test comment once measured.)

**Registry reshape — `plsSem.ts`:** replace `outer-model` + `reliability` with ONE grouped table:

```ts
{
  id: 'measurement',
  domId: 'pls-sem-measurement',
  title: 'Measurement model',
  columns: [
    { key: 'path', label: 'Construct / item' },
    { key: 'rhoC', label: 'CR (ρ', sub: 'C', suffix: ')' },
    { key: 'alpha', label: 'α' },
    { key: 'ave', label: 'AVE' },
    { key: 'mean', label: 'Mean' },
    { key: 'sd', label: 'SD' },
    { key: 'loading', label: 'Loading / weight' },
    { key: 't', label: 't' },
    { key: 'p', label: 'p' },
  ],
},
```

**Builder — `buildPlsSem.ts`:** replace the separate `t1rows`/`t2rows` with grouped rows (group header carries
`rhoC`/`alpha`/`ave` once; per-item children carry `mean`/`sd`/`loading`/`t`/`p`, group columns blank):

```ts
const measurementRows: BuiltTable['rows'] = []
for (const rel of r.reliability) {
  measurementRows.push({
    __group: String(rel.construct),
    path: String(rel.construct),
    rhoC: fc(rel.cr), alpha: fc(rel.alpha), ave: fc(rel.ave),
    mean: '', sd: '', loading: '', t: '', p: '',
  })
  for (const row of r.outer.filter((o) => o.construct === rel.construct)) {
    measurementRows.push({
      path: `  ${row.item}`,   // A6 group-child indent convention (LaTeX \quad; HTML CSS indent)
      rhoC: '', alpha: '', ave: '',
      mean: f2(row.mean), sd: f2(row.sd),
      loading: fc(row.loading ?? row.weight), t: f2(row.t), p: fpFmt(row.p),
    })
  }
}
tables.push({ spec: tableById('measurement'), rows: measurementRows })
```

**RED — `buildPlsSem.test.ts`:**

```ts
it('measurement table groups indicator rows under their construct, carrying ρC/α/AVE once on the group row', () => {
  const content = buildPlsSem(PLS_SEM, fixtureResult)
  const table = content.tables.find((t) => t.spec.id === 'measurement')!
  const groupRow = table.rows.find((r) => (r as Record<string, unknown>).__group === 'Image')!
  expect(groupRow.rhoC).not.toBe('')
  const childRow = table.rows[table.rows.indexOf(groupRow) + 1]
  expect(childRow.rhoC).toBe('')
  expect(childRow.mean).not.toBe('')
})
```

**Master-HTML + consistency test** — update `telos_test_outputs.html`'s PLS-SEM card to the merged table
shape, and replace `plsSem.consistency.test.ts`'s two separate Table 1/2 assertions with one for `measurement`:

```ts
it('Table 1 (measurement model, grouped) thead matches the spec columns', () => {
  expect(theadAfter('Measurement model')).toEqual(tableCols('measurement'))
})
```

(Remove the old `outer-model`/`reliability` assertions — those table ids no longer exist in the registry.)

**Verify:** `npx vitest run src/lib/results/buildPlsSem.test.ts src/lib/registry/plsSem.consistency.test.ts`.
`npx vitest run src/lib/stats/plsSem.test.ts` (WebR). `npx tsc -b`.

**Commit:** `feat(pls-sem): grouped measurement table — construct rows carry ρC/α/AVE, indicator rows carry Mean/SD/loading`

---

### Task 6.2 — HTMT on-card + cross-reference note

**Goal:** HTMT already renders as its own matrix table on the PLS-SEM card (unchanged by Task 6.1's merge —
HTMT was never part of `outer-model`/`reliability`). This task adds the SAME cross-reference sentence CB-SEM's
Tables 3-4 got in U3 ("Discriminant validity also has its own card…"), since PLS-SEM's convergent-validity
figures (ρC/AVE) now live inside the Task 6.1 measurement table rather than a standalone reliability table —
readers need the same pointer to the dedicated AVE card for the full convergent+discriminant writeup in one
place.

**Files:** `src/lib/registry/plsSem.ts`, `src/lib/registry/plsSem.consistency.test.ts`, `telos_test_outputs.html`.

**RED — `plsSem.consistency.test.ts`:**

```ts
it('HTMT table note cross-references the standalone AVE card (mirrors the CB-SEM Tables 3-4 convention)', () => {
  expect(spec.tableNote!.text).toMatch(/AVE.*card|convergent validity.*own card/i)
  expect(spec.tableNote!.afterTableId).toBe('htmt')
})
```

**GREEN — `plsSem.ts`:** split the existing single `tableNote` into two notes (one after `measurement`, one
after `htmt`) if `CardContent['note']` only supports ONE note — check U1's actual note-plumbing before writing
this; if `TableSpec`/`tableNote` still supports only one `{ text, afterTableId }` pair per spec (today's shape),
promote the cross-reference sentence into the EXISTING note's text (which already renders after `indirect-effects`
per `afterTableId`), OR — cleaner — add it as its own short note anchored to `htmt` if U1 widened `tableNote` to
an array. Confirm which shape U1 left `TableSpec.tableNote` in (array vs single) before implementing; if still
singular, append the cross-reference sentence to the existing note text and update the match above to check
`spec.tableNote!.text` without an `afterTableId` assumption:

```ts
tableNote: {
  kind: 'plain',
  afterTableId: 'indirect-effects',
  text: '... (existing text, unchanged) ... Discriminant validity also has its own card (AVE / convergent validity); it is included here (via HTMT above) so one run gives the complete measurement-model writeup. Formative constructs suppress AVE/HTMT ...',
},
```

Update `telos_test_outputs.html`'s PLS-SEM card note paragraph to match verbatim (consistency test diffs text
verbatim against the HTML).

**Verify:** `npx vitest run src/lib/registry/plsSem.consistency.test.ts`. `npx tsc -b`.

**Commit:** `docs(pls-sem): HTMT cross-references the standalone AVE card, mirroring the CB-SEM convention`

---

### Task 6.3 — Structural table reshape (H | estimate | p | dual CIs | Result) with hand-rolled BC from seminr's boot matrix

**Goal:** PLS-SEM's structural table adopts the SAME shape as CB-SEM's Table 5 (H | Path | estimate | p |
Percentile CI | BC CI | Result), with BC computed via a **hand-rolled z₀-adjusted percentile** from seminr's
raw boot matrix (seminr has no built-in `bca.simple`), verified against lavaan's `bca.simple` on a shared
fixture — the exact algorithm from the moderation spike's extension script (`moderation-spike-cbsem-ext.R`
§"hand-rolled bca.simple from raw draws").

**Files:** `src/lib/stats/plsBcCi.ts` (NEW — the hand-rolled algorithm, pure), `src/lib/stats/plsBcCi.test.ts`,
`src/lib/stats/plsSem.ts`, `src/lib/results/buildPlsSem.ts`, `src/lib/registry/plsSem.ts`, `telos_test_outputs.html`.

**Pure algorithm (JS port of the spike's R functions — but the CI must be computed R-SIDE, in the same R block
that already has the boot matrix, since a JS port would need seminr's raw bootstrap draws shipped back to JS
as a huge array; instead, port the R helper functions into an R string constant, reused server-side, exactly
mirroring the "shared R text" pattern from `moderationModel.ts`):**

```ts
// src/lib/stats/plsBcCi.ts
/** Hand-rolled z0-adjusted percentile ("bca.simple", a=0 — bias-corrected, NON-accelerated) BC interval from
 *  a raw bootstrap draw vector — the SAME algorithm lavaan's boot.ci.type="bca.simple" uses internally
 *  (ported from lavaan:::parameterestimates' norm.inter/bc_ci; verified byte-identical against lavaan on a
 *  shared fixture — see plsBcCi.test.ts). seminr exposes only the raw boot matrix (sb$..., no bca.simple
 *  option), so this R text runs INSIDE the PLS R block against sb$bootstrapped_paths' underlying draws. */
export const BC_CI_R = String.raw`
norm_inter <- function(t, alpha) {
  t <- t[is.finite(t)]; R <- length(t)
  rk <- (R + 1) * alpha
  k <- trunc(rk)
  tstar <- sort(t)
  out <- numeric(length(k))
  for (j in seq_along(k)) {
    if (k[j] == rk[j])      out[j] <- tstar[k[j]]
    else if (k[j] == 0)     out[j] <- tstar[1]
    else if (k[j] == R)     out[j] <- tstar[R]
    else {
      temp1 <- qnorm(alpha[j]); temp2 <- qnorm(k[j] / (R + 1)); temp3 <- qnorm((k[j] + 1) / (R + 1))
      out[j] <- tstar[k[j]] + (temp1 - temp2) / (temp3 - temp2) * (tstar[k[j] + 1] - tstar[k[j]])
    }
  }
  out
}
bc_ci <- function(draws, t0, level = 0.95) {
  draws <- draws[is.finite(draws)]
  zalpha <- qnorm((1 + c(-level, level)) / 2)
  w <- qnorm(sum(draws < t0) / length(draws))
  norm_inter(draws, pnorm(2 * w + zalpha))
}
`
```

**RED — `plsBcCi.test.ts`** (native-R-verified, byte-comparison against lavaan's `bca.simple` on the SAME
shared fixture the moderation spike used — this is the "verified against lavaan's bca.simple on a shared
fixture" requirement, ported as a committed vitest gate rather than a one-off spike script):

```ts
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { BC_CI_R } from './plsBcCi'

const hasR = (() => { try { execSync('Rscript --version', { stdio: 'ignore' }); return true } catch { return false } })()

// Shared fixture: docs/superpowers/reviews/2026-07-06-moderation-spike.md's ext script proved the hand-rolled
// bc_ci() reproduces lavaan's boot.ci.type="bca.simple" exactly (max |hand-rolled - lavaan| ≈ 0 in the spike
// log). This test re-derives that proof as a committed, re-runnable gate: fit the SAME matched CB-SEM
// moderation model in native R, compute BC via lavaan directly AND via BC_CI_R on the raw boot draws, assert
// they match to 6 decimals — proving BC_CI_R (the text seminr's PLS structural table will reuse) is correct
// BEFORE it is ever wired into plsSem.ts.
describe.skipIf(!hasR)('BC_CI_R hand-rolled bca.simple — native-R verified against lavaan boot.ci.type="bca.simple"', () => {
  it('matches lavaan\'s bca.simple CI for the interaction path b3, to 6 decimals', () => {
    const script = `
      suppressMessages({ library(lavaan); library(semTools) })
      d <- read.csv("${process.cwd()}/.superpowers/sdd/spike-moderation-data.csv")
      pi <- indProd(d, var1=c("sn1","sn2","sn3","sn4"), var2=c("ta1","ta2","ta3","ta4"), match=TRUE, meanC=TRUE, doubleMC=TRUE)
      model <- 'SN=~sn1+sn2+sn3+sn4\nTA=~ta1+ta2+ta3+ta4\nTI=~ti1+ti2+ti3\nSNTA=~sn1.ta1+sn2.ta2+sn3.ta3+sn4.ta4\nTI~b1*SN+b2*TA+b3*SNTA'
      set.seed(20260706)
      fit <- sem(model, data=pi, se="bootstrap", bootstrap=500)
      pe_bc <- parameterEstimates(fit, ci=TRUE, boot.ci.type="bca.simple")
      lav_row <- pe_bc[pe_bc$op=="~" & pe_bc$rhs=="SNTA", c("ci.lower","ci.upper")]
      ${BC_CI_R}
      boots <- lavInspect(fit, "boot"); b3d <- boots[, "b3"]; est <- coef(fit)[["b3"]]
      hand <- bc_ci(b3d, est)
      cat(sprintf("%.8f %.8f %.8f %.8f", lav_row$ci.lower, lav_row$ci.upper, hand[1], hand[2]))
    `
    const out = execSync(`Rscript -e '${script.replace(/'/g, "'\\''")}'`, { encoding: 'utf8' })
    const [lavLo, lavHi, handLo, handHi] = out.trim().split(/\s+/).map(Number)
    expect(handLo).toBeCloseTo(lavLo, 6)
    expect(handHi).toBeCloseTo(lavHi, 6)
  })
})
```

**GREEN — wire into `plsSem.ts`'s R block:** after `bp <- sb$bootstrapped_paths`, need the RAW per-path boot
draws (not just the summary row) — check `bo$boots_paths` or equivalent seminr internal structure exposing
the raw matrix (confirm the exact field name against `str(bo)` before finalizing; seminr's `bootstrap_model()`
return object carries the raw path draws needed for `bc_ci()` the same way lavaan's `lavInspect(fit,"boot")`
does). Splice `BC_CI_R` into the R_STATS template and call `bc_ci(raw_draws_for_this_path, beta)` per
structural row, adding `ciBcLower`/`ciBcUpper` fields to each `structural[]` row.

**Registry reshape — `plsSem.ts`:**

```ts
{
  id: 'structural',
  title: 'Structural paths',
  columns: [
    { key: 'hId', label: 'H' },
    { key: 'path', label: 'Path' },
    { key: 'beta', label: 'β' },
    { key: 'p', label: 'p' },
    { key: 'ciPerc', label: 'Percentile 95% CI', span: { group: 'ci' } },
    { key: 'ciPercLo', label: 'Lower', span: { group: 'ci' } },
    { key: 'ciPercHi', label: 'Upper', span: { group: 'ci' } },
    { key: 'ciBcLo', label: 'Lower', span: { group: 'bcci' } },
    { key: 'ciBcHi', label: 'Upper', span: { group: 'bcci' } },
    { key: 'result', label: 'Result' },
  ],
},
```

(Column-span shape follows the A6 `span.group` contract from U1 exactly — mirrors whatever U3 already did for
CB-SEM's Table 5, reused verbatim so the two cards render identically.)

**Builder — `buildPlsSem.ts`:** add H-ids (creation order — PLS-SEM has no indirect/moderation sections ahead
of structural in this reshape task; Task 6.4 appends moderation after) and the Result rule (percentile CI
excludes zero, same as CB-SEM):

```ts
const t4rows = r.structural.map((row, i) => ({
  hId: `H${i + 1}`,
  path: String(row.path), beta: fc(row.beta), p: fpFmt(row.p),
  ciPercLo: fc(row.ciLower), ciPercHi: fc(row.ciUpper),
  ciBcLo: fc(row.ciBcLower), ciBcHi: fc(row.ciBcUpper),
  result: (Number(row.ciLower) > 0 || Number(row.ciUpper) < 0) ? 'Supported' : 'Not supported',
  f2: f2(row.fSquare),
}))
```

**RED — `buildPlsSem.test.ts`:**

```ts
it('structural table carries H-ids, dual CIs, and the Result rule (percentile CI excludes zero)', () => {
  const content = buildPlsSem(PLS_SEM, { ...fixtureResult, structural: [
    { path: 'Image → Expectation', beta: 0.5, p: 0.001, ciLower: 0.3, ciUpper: 0.7, ciBcLower: 0.29, ciBcUpper: 0.71, fSquare: 0.2 },
    { path: 'Complaints → Loyalty', beta: 0.05, p: 0.4, ciLower: -0.1, ciUpper: 0.2, ciBcLower: -0.11, ciBcUpper: 0.21, fSquare: 0.01 },
  ] })
  const table = content.tables.find((t) => t.spec.id === 'structural')!
  expect(table.rows[0].hId).toBe('H1'); expect(table.rows[0].result).toBe('Supported')
  expect(table.rows[1].hId).toBe('H2'); expect(table.rows[1].result).toBe('Not supported')
})
```

**Master-HTML + consistency test** — update `telos_test_outputs.html` and `plsSem.consistency.test.ts`'s
Table 4 thead assertion for the new column set.

**Verify:** `npx vitest run src/lib/stats/plsBcCi.test.ts` (native-R gate). `npx vitest run src/lib/results/buildPlsSem.test.ts src/lib/registry/plsSem.consistency.test.ts`.
`npx vitest run src/lib/stats/plsSem.test.ts` (WebR — reads `sb`'s raw boot draws; confirm the exact seminr
field before merging). `npx tsc -b`.

**Commit:** `feat(pls-sem): structural table reshape — H-ids, dual CI (percentile + hand-rolled BC), Result rule (native-R verified vs lavaan bca.simple)`

---

### Task 6.4 — `interaction_term` two_stage moderation (mobi-based, spike's exact numbers)

**Goal:** Wire seminr's `interaction_term(iv=, moderator=, method=two_stage, weights=mode_A)` (Henseler & Chin
2010) into `plsSem.ts`, gated by the SAME `TestSetup.moderations` contract CB-SEM uses (Canvas-state
contract — one state shape, two runners). Verified against the moderation spike's exact `mobi`-based numbers.

**Files:** `src/lib/stats/plsSem.ts`, `src/lib/stats/plsSem.test.ts`, `src/lib/results/buildPlsSem.ts`,
`src/lib/results/buildPlsSem.test.ts`.

**Design:** unlike CB-SEM's indProd (which needs per-item indicator lists), seminr's `interaction_term` takes
CONSTRUCT names directly (`iv=`, `moderator=`) — no item-level product-indicator bookkeeping needed. The
moderated path's source construct is `paths[m.pathIndex].from` (the `iv`); `m.moderatorId` resolves to the
`moderator` construct name; the interaction's OWN construct name in seminr is always `"{iv}*{moderator}"`
(seminr's own naming convention, confirmed in the spike: `"Image*Expectation"`) — so, unlike CB-SEM, no
TS-side naming scheme is needed; use seminr's literal convention directly.

**GREEN — `plsSem.ts`:**

```ts
const moderations = (setup.moderations ?? []) as { id: number; moderatorId: number; pathIndex: number }[]
const modLines = moderations.map((m) => {
  const p = paths[m.pathIndex]
  const ivName = fromName(p.from), modName = fromName(m.moderatorId)
  return `interaction_term(iv = "${ivName}", moderator = "${modName}", method = two_stage, weights = mode_A)`
})
```

Splice `modLines` into the existing `mm_lines`/`constructs(...)` call (append, don't replace) and add a
structural `paths(from="{iv}*{moderator}", to="{target}")` line for each moderation, mirroring the spike's
`mobi_sm` exactly. The interaction row then falls out of the EXISTING `structural[]` extraction loop
automatically (seminr treats it as just another path) — no separate moderation-row extraction is needed on the
PLS side, UNLIKE CB-SEM (a direct consequence of seminr modeling the interaction as an ordinary construct+path,
whereas lavaan needed the hand-built `:=` machinery). Document this asymmetry inline with a comment so a
future reader doesn't go looking for a `moderation.rows` field on `PlsSemResult` that was never needed.

**RED — `plsSem.test.ts`** (native-R-verified, exact spike numbers):

```ts
// Reference: docs/superpowers/reviews/2026-07-06-moderation-spike.md §3 — seminr::mobi, two_stage,
// bootstrap=500, seed=20260706. Image*Expectation -> Satisfaction.
const MOBI_MOD_SETUP: TestSetup = {
  roles: {}, options: { nboot: 500 }, props: {}, blocked: null, modelKind: 'latent',
  constructs: [
    { id: 1, name: 'Image', items: ['IMAG1', 'IMAG2', 'IMAG3', 'IMAG4', 'IMAG5'] },
    { id: 2, name: 'Expectation', items: ['CUEX1', 'CUEX2', 'CUEX3'] },
    { id: 3, name: 'Quality', items: ['PERQ1', 'PERQ2', 'PERQ3', 'PERQ4', 'PERQ5', 'PERQ6', 'PERQ7'] },
    { id: 4, name: 'Value', items: ['PERV1', 'PERV2'] },
    { id: 5, name: 'Satisfaction', items: ['CUSA1', 'CUSA2', 'CUSA3'] },
    { id: 6, name: 'Complaints', items: ['CUSCO'] },
    { id: 7, name: 'Loyalty', items: ['CUSL1', 'CUSL2', 'CUSL3'] },
  ],
  paths: [
    { from: 1, to: 2 }, { from: 1, to: 5 }, { from: 1, to: 7 },
    { from: 2, to: 3 }, { from: 2, to: 4 }, { from: 2, to: 5 },
    { from: 3, to: 4 }, { from: 3, to: 5 },
    { from: 4, to: 5 },
    { from: 5, to: 6 }, { from: 5, to: 7 },
    { from: 6, to: 7 },
  ],
  moderations: [{ id: 1, moderatorId: 2, pathIndex: 1 }],   // Expectation moderates Image -> Satisfaction (path index 1)
}

it('interaction_term (Image*Expectation -> Satisfaction) matches the spike reference values exactly', async () => {
  const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/mobi.csv'))
  const result = await runPlsSem(engine, data, MOBI_MOD_SETUP)
  const row = result.structural.find((r) => r.path === 'Image*Expectation → Satisfaction')!
  expect(row.beta).toBeCloseTo(-0.016341, 5)
  expect(row.ciLower).toBeCloseTo(-0.072192, 5)
  expect(row.ciUpper).toBeCloseTo(0.039888, 5)
  expect(row.t).toBeCloseTo(-0.600612, 5)
})

it('Satisfaction R²/AdjR² match the spike reference values with the interaction path present', async () => {
  const data = loadCsvFixture(join(__dirname, '../../../tests/e2e/fixtures/mobi.csv'))
  const result = await runPlsSem(engine, data, MOBI_MOD_SETUP)
  const q = result.quality.find((r) => r.construct === 'Satisfaction')!
  expect(q.r2).toBeCloseTo(0.681492, 4)
  expect(q.r2adj).toBeCloseTo(0.674965, 4)
})
```

**Verify:** `npx vitest run src/lib/stats/plsSem.test.ts` (WebR, slow). `npx tsc -b`.

**Commit:** `feat(pls-sem): interaction_term two_stage moderation — native-R-verified against the spike's mobi numbers`

---

### Task 6.5 — PLS simple-slopes figure from estimated coefficients

**Goal:** Same whiskered-CI figure treatment as CB-SEM's Task 5.2, but derived from seminr's estimated
interaction coefficient rather than lavaan's `:=` defined parameters (PLS has no latent-variance label to
scale by — the "moderator SD" needed for ±1SD slopes must come from the OBSERVED composite score's SD, per
Aiken & West applied to the composite/summed-indicator metric, the standard PLS treatment).

**Files:** `src/lib/stats/plsSem.ts`, `src/lib/results/buildPlsSem.ts`, `src/lib/registry/plsSem.ts`.

**GREEN — `plsSem.ts`:** compute the moderator's composite-score SD (`rowMeans` or seminr's own composite
scores, `pls$construct_scores[, moderatorName]`) and derive the 3 conditional slopes the same closed form as
CB-SEM (`slope = b_main + b_int * level`), with CIs from the SAME bootstrap draws used for the interaction
path's own CI (percentile method, matching the existing `bp[key, "2.5% CI"]`/`"97.5% CI"` extraction — reuse,
don't reinvent):

```r
mod_sd <- sd(pls$construct_scores[, mod_name])
levels <- c(lo = -mod_sd, mid = 0, hi = mod_sd)
b_main <- as.numeric(bp[paste0(iv_name, "  ->  ", target_name), "Original Est."])
b_int  <- as.numeric(bp[paste0(iv_name, "*", mod_name, "  ->  ", target_name), "Original Est."])
# Bootstrap draws for both terms -> per-draw slope -> percentile CI (mirrors the CB-SEM percentile treatment)
```

(Exact seminr accessor for the raw per-draw bootstrap matrix of `bo` — confirm against `str(bo)` before
finalizing, same caveat as Task 6.3's `bc_ci` wiring; both tasks need the SAME raw-draws accessor, so resolve
it once and reuse.)

Return `figModSlopesPng` via `engine.capturePlot`, identical ggplot2 block to Task 5.2's (same accent color,
same whisker treatment) — literally the SAME R string constant, factored into a shared helper
(`src/lib/stats/simpleSlopesPlot.ts`, exported and imported by both `runCbSem.ts` and `plsSem.ts`, since the
plotting code has zero CB-SEM/PLS-specific logic — it just takes `{level, b, ciLower, ciUpper}[]`).

**Builder — `buildPlsSem.ts`:** same conditional-effects table + second figure entry as `buildCbSem.ts`'s
Task 5.2 pattern (reuse, don't duplicate the row-formatting logic if it can be shared — extract a small
`conditionalEffectsRows(slopes)` helper into `src/lib/results/conditionalEffects.ts`, imported by both builders).

**RED:** mirrors Task 5.2's tests exactly, against `PlsSemResult`'s new `slopes`/`figModSlopesPng` fields, with
the mobi/spike numbers where available (the spike did not compute PLS simple slopes — that arithmetic is new
in this task, so its expected numbers are DERIVED, not spike-sourced; the test asserts internal consistency
— figure and table numbers match — plus a native-R comparison run once via `Rscript` to pin the reference
values before writing `toBeCloseTo` assertions, same discipline as every other native-R-verified runner test
in this codebase).

**Verify:** `npx vitest run src/lib/stats/plsSem.test.ts src/lib/results/buildPlsSem.test.ts`. `npx tsc -b`.

**Commit:** `feat(pls-sem): simple-slopes figure + conditional-effects table from the composite-score SD (shared plotting helper with CB-SEM)`

---

### Task 6.6 — Exports (LaTeX/PDF/analysis.R emitters) + runs-in-r

**Goal:** Close the export ≡ app loop for PLS-SEM's full parity slice: the `pls-sem` R-script emitter
reproduces the measurement reshape, structural reshape (incl. hand-rolled BC), `interaction_term` moderation,
and simple-slopes figure; LaTeX/PDF pick up the new grouped/spanned table devices (via A6, already built) with
zero PLS-specific renderer code; a runs-in-r fixture proves it natively.

**Files:** `src/lib/export/rScript/emitters/latent.ts` (the `'pls-sem'` emitter), `src/lib/export/rScript/emitters/latent.test.ts`,
`src/lib/export/rScript/runs-in-r.test.ts`.

**GREEN — `latent.ts`'s `'pls-sem'` emitter:** append the `interaction_term`/moderated-path lines (mirrors
Task 6.4's TS logic, literal R text this time, following the SAME pattern the `'cb-sem'` emitter already uses
for reusing runner logic verbatim in export form), append the hand-rolled `BC_CI_R` text (imported from
`plsBcCi.ts`, Task 6.3 — the SAME shared-module principle as `moderationModel.ts`) after `sb <- summary(bo)`,
and print the simple-slopes numbers + `ggplot2` figure block (same text as `simpleSlopesPlot.ts`'s constant,
Task 6.5, imported here too — by now THREE shared R-text modules exist:
`moderationModel.ts`/`plsBcCi.ts`/`simpleSlopesPlot.ts`, all following the identical "one source of R text,
imported by both the WebR runner and the export emitter" pattern established in Task 4.4).

**RED — `latent.test.ts`:**

```ts
it('pls-sem emitter includes interaction_term when setup.moderations is present', () => {
  const R = latentEmitters['pls-sem'](PLS_SEM, {
    ...baseSetup, moderations: [{ id: 1, moderatorId: 2, pathIndex: 1 }],
  } as never)
  expect(R).toContain('interaction_term(iv =')
  expect(R).toContain('method = two_stage')
})

it('pls-sem emitter includes the hand-rolled BC_CI_R text for the structural table', () => {
  const R = latentEmitters['pls-sem'](PLS_SEM, baseSetup as never)
  expect(R).toContain('norm_inter <- function')
  expect(R).toContain('bc_ci <- function')
})
```

**runs-in-r** — extend the EXISTING `pls-sem` REP (mobi.csv, already in `runs-in-r.test.ts`) with the
moderation construct/path, reusing the same fixture (no new CSV needed — `mobi.csv` already ships with the
package's built-in dataset via seminr, already committed):

```ts
{ id: 'pls-sem', fixture: 'mobi.csv',
  setup: {
    // ...existing 7-construct mobi setup...
    moderations: [{ id: 1, moderatorId: 2, pathIndex: 1 }],
  },
  expect: ['Table 2: Reliability', 'Table 3: HTMT', 'Table 4: Structural paths', 'interaction_term'],
},
```

**Verify:** `npx vitest run src/lib/export/rScript/emitters/latent.test.ts`. `npx vitest run src/lib/export/rScript/runs-in-r.test.ts`
(native R). `npx tsc -b`.

**Commit:** `feat(pls-sem-export): interaction_term + hand-rolled BC + simple-slopes figure in the pls-sem emitter (export ≡ app, runs-in-r verified)`

---

## Summary

15 tasks total: U4 = 4, U5 = 5, U6 = 6. Every task is TDD (failing test committed conceptually before the
implementation, both landing in the same commit per this codebase's convention of one commit per completed
task), every new statistic is native-R-verified with a worked reference (the moderation spike's own numbers
where it produced them; a freshly-pinned `Rscript`-derived reference where the spike didn't compute that exact
quantity — flagged inline in Tasks 6.1/6.5), and export ≡ app is enforced by THREE shared pure R-text modules
(`moderationModel.ts`, `plsBcCi.ts`, `simpleSlopesPlot.ts`) rather than hand-duplicated R strings in the runner
and the emitter.

### Unit 7

## U7 - A4 citations (4 tasks)

Spec: `docs/superpowers/specs/2026-07-06-telos-citable-complete-design.md` section A4.
Sources for citation text (consolidate only, invent nothing new): `src/lib/export/citations.ts` (current `REFS` dict, the R-package citations already shipping in every export), `docs/superpowers/reviews/2026-06-17-reporting-completeness-ratify.md`, `docs/superpowers/reviews/2026-06-18-sem-reporting-convention.md` (§4/§5, the Track A/B/C citation tables), `docs/superpowers/reviews/2026-07-06-moderation-spike.md` (§4, moderation citations - held for U11/U4-U6, not wired into U7's 48 entries since moderation isn't its own test id).

**Contract deviation (flag - do not silently redefine elsewhere):** the skeleton's Interfaces section writes `export const CITATIONS: Record<TestId, TestCitations>`. There is no `TestId` type anywhere in the codebase - confirmed in `src/lib/registry/types.ts` (`TestSpec.id: string`) and `src/lib/registry/catalog.ts` (`CatalogEntry.id: string`); every registry-wide construct (`SPECS`, `CATALOG`) is keyed by plain `string` and validated by a coverage test against `CATALOG`, never a union type (see `catalog.short.test.ts`, `catalog.consistency.test.ts`). Task 1 below uses `Record<string, TestCitations>` and a coverage test enumerating `CATALOG` ids instead - this mirrors the codebase's existing idiom exactly and is functionally equivalent (a coverage test catches a missing/extra id exactly as well as a union type would), so implement as written, do not introduce a new `TestId` type.

---

### Task 1: `src/lib/registry/citations.ts` - the citation registry (48 entries)

**Files:**
- Create: `src/lib/registry/citations.ts`
- Test: `src/lib/registry/citations.consistency.test.ts` (new)

**Interfaces:**
```ts
export interface Ref { text: string; url?: string }
export interface TestCitations {
  whyThisTest: { text: string; refs: Ref[] } // text: 1-2 sentences, rendered verbatim as the config-screen "Why this test" line (U7 T3)
  statisticalBasis: { claim: string; ref: Ref }[] // rendered as the results-card footer (U7 T4) and the LaTeX/PDF footer line
}
export const CITATIONS: Record<string, TestCitations>
```

- [ ] **Step 1: Failing coverage test**

```ts
import { describe, it, expect } from 'vitest'
import { CATALOG } from './catalog'
import { CITATIONS } from './citations'

describe('citation registry coverage (A4)', () => {
  it('every catalog id has a citation entry', () => {
    const missing = CATALOG.filter((c) => !CITATIONS[c.id]).map((c) => c.id)
    expect(missing).toEqual([])
  })
  it('every entry has a non-empty whyThisTest and at least one statisticalBasis claim, each with at least one ref', () => {
    const offenders = Object.entries(CITATIONS).filter(([, c]) =>
      !c.whyThisTest.text.trim() || c.whyThisTest.refs.length === 0 ||
      c.statisticalBasis.length === 0 || c.statisticalBasis.some((b) => !b.claim.trim() || !b.ref.text.trim()))
      .map(([id]) => id)
    expect(offenders).toEqual([])
  })
  it('no id in CITATIONS that is not in CATALOG (dead entries)', () => {
    const ids = new Set(CATALOG.map((c) => c.id))
    expect(Object.keys(CITATIONS).filter((id) => !ids.has(id))).toEqual([])
  })
})
```

- [ ] **Step 2: RED** - `npx vitest run src/lib/registry/citations.consistency.test.ts` (fails: module doesn't exist yet).

- [ ] **Step 3: Write the registry.** Full interface + 6 fully-coded representative entries below (transcribe verbatim - these citations are already verified in the convention docs cited above). Then the remaining 42 ids follow the transcription table in Step 3b - **do not invent new citations for them**; every one resolves to something already in `src/lib/export/citations.ts`'s `REFS` dict (matched through that test's package map - `regressionPackages`/`groupPackages`/`assocDescPackages`/`latentPackages` in `src/lib/export/rScript/emitters/{regression,groups,assocDesc,latent}.ts`), an inline citation already sitting in that test's own registry file, or (SEM/PLS/EFA/PCA family only) the Track A/B/C tables in `2026-06-18-sem-reporting-convention.md`.

```ts
import type { Ref } from './types' // NOTE: types.ts currently has no Ref export - add `export interface Ref { text: string; url?: string }` there instead of duplicating it, OR keep Ref local to this file (simpler, no cross-file coupling needed) and drop this import. Recommendation: define Ref locally in citations.ts (below) - types.ts stays untouched.

export interface Ref { text: string; url?: string }
export interface TestCitations {
  whyThisTest: { text: string; refs: Ref[] }
  statisticalBasis: { claim: string; ref: Ref }[]
}

// Shared refs reused verbatim across multiple entries (single point of truth so the same paper is
// never re-typed with drift). Every ref below already appears in the codebase or the convention docs
// cited in this unit's header - none are new claims.
const STUDENT_1908: Ref = { text: 'Student (1908). "The probable error of a mean." Biometrika, 6(1), 1-25.', url: 'https://doi.org/10.1093/biomet/6.1.1' }
const WELCH_1947: Ref = { text: "Welch, B. L. (1947). \"The generalization of Student's problem when several different population variances are involved.\" Biometrika, 34(1-2), 28-35.", url: 'https://doi.org/10.1093/biomet/34.1-2.28' }
const COHEN_1988: Ref = { text: 'Cohen, J. (1988). Statistical Power Analysis for the Behavioral Sciences (2nd ed.). Routledge.' } // already used verbatim in plsSem.ts's inline prose
const FISHER_1925: Ref = { text: 'Fisher, R. A. (1925). Statistical Methods for Research Workers. Oliver & Boyd.' }
const TUKEY_1949: Ref = { text: 'Tukey, J. W. (1949). "Comparing individual means in the analysis of variance." Biometrics, 5(2), 99-114.' }
const PEARSON_1895: Ref = { text: 'Pearson, K. (1895). "Note on regression and inheritance in the case of two parents." Proceedings of the Royal Society of London, 58, 240-242.' }
const OBRIEN_2007: Ref = { text: 'O’Brien, R. M. (2007). "A caution regarding rules of thumb for variance inflation factors." Quality & Quantity, 41(5), 673-690.', url: 'https://doi.org/10.1007/s11135-006-9018-6' }
const CROISSANT_MILLO_2008: Ref = { text: 'Croissant, Y., Millo, G. (2008). "Panel Data Econometrics in R: The plm Package." Journal of Statistical Software, 27(2), 1-43.', url: 'https://doi.org/10.18637/jss.v027.i02' } // already in did.ts howToRead + already in export/citations.ts REFS.plm
const BERTRAND_DUFLO_MULLAINATHAN_2004: Ref = { text: 'Bertrand, M., Duflo, E., Mullainathan, S. (2004). "How Much Should We Trust Differences-in-Differences Estimates?" Quarterly Journal of Economics, 119(1), 249-275.' } // already in did.ts howToRead
const HU_BENTLER_1999: Ref = { text: 'Hu, L., Bentler, P. M. (1999). "Cutoff criteria for fit indexes in covariance structure analysis: Conventional criteria versus new alternatives." Structural Equation Modeling, 6(1), 1-55.', url: 'https://doi.org/10.1080/10705519909540118' } // already in cbSem.ts tableNote
const MARSH_HAU_WEN_2004: Ref = { text: 'Marsh, H. W., Hau, K. T., Wen, Z. (2004). "In search of golden rules: Comment on hypothesis-testing approaches to setting cutoff values for fit indices." Structural Equation Modeling, 11(3), 320-341.', url: 'https://doi.org/10.1207/s15328007sem1103_2' } // already in cbSem.ts tableNote
const MACCALLUM_1996: Ref = { text: 'MacCallum, R. C., Browne, M. W., Sugawara, H. M. (1996). "Power analysis and determination of sample size for covariance structure modeling." Psychological Methods, 1(2), 130-149.', url: 'https://doi.org/10.1037/1082-989X.1.2.130' }
const FORNELL_LARCKER_1981: Ref = { text: 'Fornell, C., Larcker, D. F. (1981). "Evaluating structural equation models with unobservable variables and measurement error." Journal of Marketing Research, 18(1), 39-50.', url: 'https://doi.org/10.1177/002224378101800104' }
const MCNEISH_2018: Ref = { text: "McNeish, D. (2018). \"Thanks coefficient alpha, we'll take it from here.\" Psychological Methods, 23(3), 412-433.", url: 'https://doi.org/10.1037/met0000144' } // already in cronbachsAlpha.ts inline
const ROSSEEL_2012: Ref = { text: 'Rosseel, Y. (2012). "lavaan: An R Package for Structural Equation Modeling." Journal of Statistical Software, 48(2), 1-36.', url: 'https://doi.org/10.18637/jss.v048.i02' }
const APPELBAUM_2018: Ref = { text: 'Appelbaum, M., Cooper, H., Kline, R. B., Mayo-Wilson, E., Nezu, A. M., Rao, S. M. (2018). "Journal article reporting standards for quantitative research in psychology." American Psychologist, 73(1), 3-25.', url: 'https://doi.org/10.1037/amp0000191' }
const KLINE_2023: Ref = { text: 'Kline, R. B. (2023). Principles and Practice of Structural Equation Modeling (5th ed.). Guilford Press.' }

export const CITATIONS: Record<string, TestCitations> = {
  'independent-t-test': {
    whyThisTest: {
      text: 'Recommended when you compare the means of two independent groups on one numeric outcome.',
      refs: [STUDENT_1908, WELCH_1947],
    },
    statisticalBasis: [
      { claim: 'Independent-samples t-test (pooled variance)', ref: STUDENT_1908 },
      { claim: "Welch's correction (unequal variances, the app's default)", ref: WELCH_1947 },
      { claim: "Cohen's d effect-size benchmarks (.2/.5/.8)", ref: COHEN_1988 },
    ],
  },
  'one-way-anova': {
    whyThisTest: {
      text: 'Recommended when you compare the means of three or more independent groups on one numeric outcome.',
      refs: [FISHER_1925],
    },
    statisticalBasis: [
      { claim: 'F-test for equality of several means (ANOVA)', ref: FISHER_1925 },
      { claim: 'Tukey HSD post-hoc comparison', ref: TUKEY_1949 },
      { claim: 'η² effect-size benchmarks', ref: COHEN_1988 },
    ],
  },
  pearson: {
    whyThisTest: {
      text: 'Recommended when you measure the strength and direction of a LINEAR relationship between two numeric variables.',
      refs: [PEARSON_1895],
    },
    statisticalBasis: [
      { claim: 'Pearson product-moment correlation coefficient (r)', ref: PEARSON_1895 },
      { claim: 'r effect-size benchmarks (.1/.3/.5)', ref: COHEN_1988 },
    ],
  },
  'multiple-linear-regression': {
    whyThisTest: {
      text: 'Recommended when you predict one numeric outcome from two or more predictors and want each predictor’s independent contribution.',
      refs: [OBRIEN_2007],
    },
    statisticalBasis: [
      { claim: 'Ordinary least squares regression coefficients (B), SE, CI', ref: { text: 'R Core Team (2026). R: A Language and Environment for Statistical Computing. R Foundation for Statistical Computing, Vienna.' } },
      { claim: 'Standardized coefficients (β)', ref: { text: 'Lüdecke D, Ben-Shachar MS, Patil I, Makowski D (2020). "Extracting, Computing and Exploring the Parameters of Statistical Models using R." Journal of Open Source Software, 5(53), 2445.' } }, // = export/citations.ts REFS.parameters, transcribed verbatim
      { claim: 'Variance inflation factor (VIF) cutoff guidance', ref: OBRIEN_2007 },
    ],
  },
  did: {
    whyThisTest: {
      text: 'Recommended when you estimate a policy/treatment effect from before/after outcomes in a treated vs. control group.',
      refs: [CROISSANT_MILLO_2008, BERTRAND_DUFLO_MULLAINATHAN_2004],
    },
    statisticalBasis: [
      { claim: 'Difference-in-differences via entity fixed effects (plm within estimator)', ref: CROISSANT_MILLO_2008 },
      { claim: 'Clustered standard errors / parallel-trends interpretation', ref: BERTRAND_DUFLO_MULLAINATHAN_2004 },
    ],
  },
  'cb-sem': {
    whyThisTest: {
      text: 'Recommended when you test a theory-specified measurement + structural model among latent constructs (confirmatory, not exploratory).',
      refs: [KLINE_2023, APPELBAUM_2018],
    },
    statisticalBasis: [
      { claim: 'Model estimation (lavaan)', ref: ROSSEEL_2012 },
      { claim: 'Fit-index cutoffs (CFI/TLI ≥ .95, RMSEA ≤ .06, SRMR ≤ .08)', ref: HU_BENTLER_1999 },
      { claim: 'Cutoffs are guidelines, not pass/fail gates', ref: MARSH_HAU_WEN_2004 },
      { claim: 'RMSEA 90% confidence interval', ref: MACCALLUM_1996 },
      { claim: 'AVE / Fornell-Larcker discriminant validity', ref: FORNELL_LARCKER_1981 },
      { claim: 'Reliability preference (ω over α)', ref: MCNEISH_2018 },
      { claim: 'Reporting standard (APA JARS-Quant)', ref: APPELBAUM_2018 },
    ],
  },
}
```

- [ ] **Step 3b: Remaining 42 ids - transcription checklist.** For each id below, `whyThisTest` is one sentence paraphrasing the card's existing `question` field into a full sentence (source: `src/lib/registry/<file>.ts`'s `question` - already-approved display copy, just reworded into a sentence, not a new claim) plus the primary-method ref noted; `statisticalBasis` entries come from the packages listed (source = `src/lib/export/citations.ts`'s `REFS` dict, transcribed **verbatim** - do not re-word) plus any inline citation already in that test's own registry file.

| id | packages to transcribe from `REFS` (via `*Packages` maps in `rScript/emitters/{regression,groups,assocDesc,latent}.ts`) | existing inline citation to transcribe (file:line) | primary-method ref to add (well-established, uncontested) |
|---|---|---|---|
| summary-statistics | modelsummary, ggplot2 | - | - (purely descriptive; whyThisTest only) |
| frequencies-crosstabs | modelsummary, ggplot2 | - | - |
| distribution-normality | nortest, ggplot2 | - | Shapiro, S. S., Wilk, M. B. (1965). "An analysis of variance test for normality (complete samples)." Biometrika, 52(3/4), 591-611. |
| one-sample-t-test | effectsize, ggplot2 | - | STUDENT_1908 |
| paired-t-test | psych, effectsize, ggplot2 | - | STUDENT_1908 |
| factorial-anova | modelsummary, afex, effectsize, emmeans, ggplot2 | - | FISHER_1925 |
| repeated-measures-anova | afex, emmeans, ggplot2 | - | FISHER_1925 |
| mixed-anova | afex, emmeans, ggplot2 | - | FISHER_1925 |
| nested-anova | modelsummary, effectsize, ggplot2 | - | FISHER_1925 |
| welch-anova | modelsummary, rstatix, ggplot2 | - | WELCH_1947 |
| ancova | car, effectsize, emmeans, ggplot2 | - | FISHER_1925 |
| manova | ggplot2 | - | Wilks, S. S. (1932). "Certain generalized distributions in multivariate analysis." Biometrika, 24(3/4), 471-494. |
| mancova | emmeans, ggplot2 | - | (same Wilks 1932) |
| mann-whitney-u | coin, effectsize, ggplot2 | - | Mann, H. B., Whitney, D. R. (1947). "On a test of whether one of two random variables is stochastically larger than the other." Annals of Mathematical Statistics, 18(1), 50-60. |
| wilcoxon-signed-rank | coin, effectsize, ggplot2 | - | Wilcoxon, F. (1945). "Individual comparisons by ranking methods." Biometrics Bulletin, 1(6), 80-83. |
| kruskal-wallis | rstatix, ggplot2 | - | Kruskal, W. H., Wallis, W. A. (1952). "Use of ranks in one-criterion variance analysis." JASA, 47(260), 583-621. |
| friedman | ggplot2 | - | Friedman, M. (1937). "The use of ranks to avoid the assumption of normality implicit in the analysis of variance." JASA, 32(200), 675-701. |
| spearman | ggplot2 | - | Spearman, C. (1904). "The proof and measurement of association between two things." American Journal of Psychology, 15(1), 72-101. |
| kendalls-tau | ggplot2 | - | Kendall, M. G. (1938). "A new measure of rank correlation." Biometrika, 30(1/2), 81-93. |
| chi-square-independence | ggplot2 | - | Pearson, K. (1900). "On the criterion that a given system of deviations..." Philosophical Magazine, 50(302), 157-175. |
| chi-square-goodness-of-fit | effectsize, ggplot2 | - | (same Pearson 1900) |
| fishers-exact | ggplot2 | - | Fisher, R. A. (1922). "On the interpretation of χ² from contingency tables, and the calculation of P." JRSS, 85(1), 87-94. |
| simple-linear-regression | modelsummary, ggplot2 | - | (base OLS ref, same as multiple-linear-regression's `parameters` REFS entry - no VIF/`car` since single predictor) |
| logistic-regression | modelsummary, ggplot2, performance, pROC | - | performance REFS entry (Nagelkerke R²), pROC REFS entry (AUC: Robin X, Turck N, et al. 2011) |
| poisson-negative-binomial | modelsummary, ggplot2, MASS, performance | - | MASS REFS entry (Venables & Ripley 2002, glm.nb), performance REFS entry (overdispersion check) |
| arima-sarima | forecast, ggplot2 | - | forecast REFS entry (Hyndman et al.) |
| stationarity-tests | tseries, ggplot2 | - | tseries REFS entry; Dickey, D. A., Fuller, W. A. (1979) "Distribution of the estimators for autoregressive time series with a unit root." JASA, 74(366a), 427-431. |
| granger-causality | lmtest, ggplot2 | - | lmtest REFS entry; Granger, C. W. J. (1969). "Investigating causal relations by econometric models and cross-spectral methods." Econometrica, 37(3), 424-438. |
| var | vars | - | vars REFS entry (Pfaff 2008) |
| fixed-effects | plm, lmtest, ggplot2 | - | CROISSANT_MILLO_2008 |
| random-effects | plm, lmtest, ggplot2 | - | CROISSANT_MILLO_2008 |
| hausman-test | plm, lmtest, ggplot2 | - | Hausman, J. A. (1978). "Specification tests in econometrics." Econometrica, 46(6), 1251-1271. |
| rdd | rdrobust | - | rdrobust REFS entry (Calonico, Cattaneo, Farrell, Titiunik 2017) |
| iv-2sls | ivreg, sandwich, lmtest, ggplot2 | - | ivreg REFS entry |
| propensity-score-matching | MatchIt, sandwich, lmtest, ggplot2 | - | MatchIt REFS entry (Ho, Imai, King, Stuart 2011) |
| cronbachs-alpha | psych, lavaan, semTools, ggplot2 | McNeish 2018 already inline (`cronbachsAlpha.ts`) | MCNEISH_2018 (already listed) |
| ave | lavaan, semTools, psych, ggplot2 | check `ave.ts` for existing Fornell-Larcker/Nunnally text before transcribing | FORNELL_LARCKER_1981 for the AVE/Fornell-Larcker claim; **CR ≥ .70 must cite Nunnally (1978)/Bagozzi & Yi (1988), NOT Fornell & Larcker** - convention doc's explicit mis-citation-trap warning (§5 item 14) |
| composite-reliability | lavaan, semTools, psych, ggplot2 | same CR mis-citation trap as `ave` | Nunnally, J. C. (1978). Psychometric Theory (2nd ed.). McGraw-Hill. / Bagozzi, R. P., Yi, Y. (1988). "On the evaluation of structural equation models." JAMS, 16(1), 74-94. |
| efa | psych, ggplot2 | Kaiser & Rice 1974, Horn 1965, Zwick & Velicer 1986, Watkins 2018 already inline (`efa.ts`) | transcribe verbatim from `efa.ts`; **KMO verbal labels cite Kaiser & Rice (1974)/Kaiser (1975), NOT "Kaiser 1974"** - second mis-citation trap in the same convention-doc warning |
| pca | ggplot2 | Jolliffe & Cadima 2016, Frick et al. 2025, Zwick & Velicer 1986 already inline (`pca.ts`) | transcribe verbatim from `pca.ts` |
| pls-sem | seminr | Henseler/Ringle/Sarstedt 2015, Cohen 1988, Hair et al. 2019 already inline (`plsSem.ts`) | transcribe verbatim from `plsSem.ts`; add Hair, Risher, Sarstedt, Ringle (2019) full cite + Henseler, Ringle, Sarstedt (2015) HTMT cite from the convention doc's Track B table |
| path-analysis | lavaan, semTools, psych, semPlot | shares `cb-sem`'s tableNote/howToRead conventions | ROSSEEL_2012; observed-variables framing only (no measurement-model citations needed) |

Also fix, in the same task, the 4-package gap this research surfaced in `src/lib/export/citations.ts`'s `REFS` (independently true regardless of this new registry - currently falls to the generic `${name}. https://CRAN.R-project.org/package=${name}` stub, visible verbatim in every `docs/test-documentation/4{6,7}_*/export/CITATIONS.txt`):
```ts
// add to REFS in src/lib/export/citations.ts:
lavaan: 'Rosseel Y (2012). "lavaan: An R Package for Structural Equation Modeling." Journal of Statistical Software, 48(2), 1-36. https://CRAN.R-project.org/package=lavaan',
semTools: 'Jorgensen TD, Pornprasertmanit S, Schoemann AM, Rosseel Y (2022). semTools: Useful tools for structural equation modeling. R package. https://CRAN.R-project.org/package=semTools',
seminr: 'Ray S, Danks N, Calero Valdéz A (2021). seminr: Domain-Specific Language for Building PLS Structural Equation Models. R package. https://CRAN.R-project.org/package=seminr',
semPlot: 'Epskamp S (2019). semPlot: Path Diagrams and Visual Analysis of Various SEM Packages’ Output. R package. https://CRAN.R-project.org/package=semPlot',
```

- [ ] **Step 4: GREEN** - `npx vitest run src/lib/registry/citations.consistency.test.ts` + `npx vitest run src/lib/export/citations.test.ts` (existing REFS test, still passes) + `npx tsc --noEmit`.
- [ ] **Step 5: Commit** - `git add src/lib/registry/citations.ts src/lib/registry/citations.consistency.test.ts src/lib/export/citations.ts && git commit -m "feat(citable): citation registry - whyThisTest + statisticalBasis for all 48 tests (A4)"`

---

### Task 2: `citationsTxt()` generation + byte-compat test

**Files:**
- Modify: `src/lib/registry/citations.ts` (add `citationsTxt`)
- Modify: `src/lib/export/citations.ts` (`citationsText` grows a `selection: string[]` param, appends the new section)
- Modify: `src/components/screens/ResultsScreen.tsx` (line 62 call site)
- Test: `src/lib/export/citations.byte-compat.test.ts` (new)

**Naming note (flag, follow as written):** the skeleton's Interfaces section names the function `citationsTxt()`. The codebase's existing, already-shipping function is `citationsText()` (capital T, "Text" not "Txt") in `src/lib/export/citations.ts:63`. Do not rename the existing shipping function - that would touch every call site and every existing fixture unnecessarily. Instead: `citationsTxt()` (contract name, exact) is the NEW function, added to the NEW `src/lib/registry/citations.ts` module, producing only the new per-test section; the EXISTING `citationsText()` in `src/lib/export/citations.ts` is modified to call `citationsTxt()` and append its output after the (byte-preserved) package section. This satisfies the contract literally (a `citationsTxt` export exists) while keeping the existing export surface stable.

- [ ] **Step 1: Failing byte-compat test.** Freeze today's `citationsText()` output for a one-test selection as the "before" fixture (captured from the real, currently-shipping `docs/test-documentation/05_independent-t-test/export/CITATIONS.txt`, byte-for-byte, through the end of the existing package section):

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { citationsText } from './citations'

describe('CITATIONS.txt byte-compat (A4 - existing package section unchanged)', () => {
  it('the package-citations section is byte-identical to the pre-registry output', () => {
    // Captured verbatim from docs/test-documentation/05_independent-t-test/export/CITATIONS.txt
    // (today's shipping output, before this task's change) through its final line.
    const BEFORE = readFileSync(new URL('./__fixtures__/citations-before.txt', import.meta.url), 'utf8')
    const after = citationsText(['independent-t-test'])
    expect(after.startsWith(BEFORE.trimEnd())).toBe(true)
  })
})
```
Create the fixture by copying the CURRENT `docs/test-documentation/05_independent-t-test/export/CITATIONS.txt` verbatim into `src/lib/export/__fixtures__/citations-before.txt` **before** editing `citationsText` (this is the RED-establishing artifact, not test logic - copy it with `cp`, do not retype it, so it's provably byte-exact).

- [ ] **Step 2: RED** - `npx vitest run src/lib/export/citations.byte-compat.test.ts` (fails: `citationsText` doesn't take a `selection` arg yet, and doesn't append the new section, so either a type error or a straight equality miss - either way, red).

- [ ] **Step 3: Implement.**

```ts
// src/lib/registry/citations.ts - append:
import { CATALOG } from './catalog'

export function citationsTxt(selection: string[]): string {
  const lines: string[] = []
  lines.push('Statistical basis (why each test was recommended, and its methodological references)')
  lines.push('='.repeat(88))
  lines.push('')
  for (const id of selection) {
    const c = CITATIONS[id]
    if (!c) continue
    const name = CATALOG.find((x) => x.id === id)?.name ?? id
    lines.push(name)
    lines.push(`  Why this test: ${c.whyThisTest.text}`)
    for (const r of c.whyThisTest.refs) lines.push(`    ${r.text}${r.url ? ' ' + r.url : ''}`)
    lines.push('  Statistical basis:')
    for (const b of c.statisticalBasis) {
      lines.push(`    ${b.claim}`)
      lines.push(`      ${b.ref.text}${b.ref.url ? ' ' + b.ref.url : ''}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
```

```ts
// src/lib/export/citations.ts - change signature + append call:
import { citationsTxt } from '../registry/citations'

export function citationsText(selection: string[]): string {
  const lines: string[] = []
  // ... EXACTLY the existing body, unchanged, through the final `lines.push('')` after the APA-7 line ...
  return lines.join('\n') + '\n' + citationsTxt(selection)
}
```

```tsx
// src/components/screens/ResultsScreen.tsx:62 - thread the selection through:
if (formats.r || formats.latex) files['CITATIONS.txt'] = enc(citationsText(s.selection))
```

- [ ] **Step 4: GREEN** - `npx vitest run src/lib/export/citations.byte-compat.test.ts src/lib/export/citations.test.ts src/lib/registry/citations.consistency.test.ts` + `npx tsc --noEmit && npm run build`. Spot-check: `docs/test-documentation/*/export/CITATIONS.txt` files are now stale (will be regenerated in U11 T2 - do not touch them here).
- [ ] **Step 5: Commit** - `git add src/lib/registry/citations.ts src/lib/export/citations.ts src/lib/export/__fixtures__/citations-before.txt src/lib/export/citations.byte-compat.test.ts src/components/screens/ResultsScreen.tsx && git commit -m "feat(citable): generate CITATIONS.txt statistical-basis section from the registry (A4)"`

---

### Task 3: config-screen "Why this test" line

**Files:**
- Create: `src/components/WhyThisTest.tsx` (presentational, props-only - matches the repo's established "presentational component + thin store-connected wrapper" convention, e.g. `TestSwitcher.tsx`)
- Test: `src/components/WhyThisTest.test.tsx` (new)
- Modify: `src/components/screens/TestConfigScreen.tsx` (wire it in)

**Interfaces:**
```tsx
export function WhyThisTest({ text }: { text: string }): JSX.Element | null
```

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { WhyThisTest } from './WhyThisTest'

describe('WhyThisTest (A4 config-screen line)', () => {
  it('renders the text in a quiet hint line', () => {
    const html = renderToStaticMarkup(<WhyThisTest text="do two groups' means differ?" />)
    expect(html).toContain("do two groups' means differ?")
    expect(html).toMatch(/class="hint"/)
  })
  it('renders nothing for empty text', () => {
    expect(renderToStaticMarkup(<WhyThisTest text="" />)).toBe('')
  })
})
```

- [ ] **Step 2: RED** - `npx vitest run src/components/WhyThisTest.test.tsx`.

- [ ] **Step 3: Implement.**

```tsx
export function WhyThisTest({ text }: { text: string }) {
  if (!text.trim()) return null
  return <p className="hint" style={{ marginTop: 2, marginBottom: 8 }}>{text}</p>
}
```

Wire into `TestConfigScreen.tsx` - insert right after the static `<h1 className="title">` (line 26) and before `<TestSwitcher .../>` (line 27):
```tsx
import { WhyThisTest } from '../WhyThisTest'
import { CITATIONS } from '../../lib/registry/citations'
// ...
<h1 className="title">Drag columns into roles</h1>
<WhyThisTest text={CITATIONS[testId]?.whyThisTest.text ?? ''} />
<TestSwitcher onGo={...} tests={...} />
```

- [ ] **Step 4: GREEN** - `npx vitest run src/components/WhyThisTest.test.tsx` + `npx tsc --noEmit && npm run build`. Note: a full e2e assertion of this line rendering on a real config screen is added in U11 T1 (folded into the combined citation+explainer integration assertion, avoiding duplicate journey setup) - do not add a new e2e spec here.
- [ ] **Step 5: Commit** - `git add src/components/WhyThisTest.tsx src/components/WhyThisTest.test.tsx src/components/screens/TestConfigScreen.tsx && git commit -m "feat(citable): 'Why this test' line on the config screen (A4)"`

---

### Task 4: results "Statistical basis" footer + PDF/LaTeX inclusion + e2e assertion

**Files:**
- Modify: `src/components/ResultPreviewCard.tsx` (new `citations` prop + footer render)
- Modify: `src/components/screens/ResultsScreen.tsx` (`BuiltCard` passes `citations={CITATIONS[id]}`)
- Modify: `src/lib/export/latex.ts` (`emitLatex` appends the same line per test)
- Modify: `tests/e2e/flow.spec.ts` (one assertion in the existing full-journey test)
- Test: `src/components/ResultPreviewCard.test.tsx` (extend, if it exists per repo convention - create if not)

**Interfaces:** `ResultPreviewCard` gains one new optional prop: `citations?: TestCitations` (from `../lib/registry/citations`).

- [ ] **Step 1: Failing test** (add to `src/components/ResultPreviewCard.test.tsx` - if the file doesn't exist yet, create it minimally scoped to this one behavior, following the existing card's presentational-props pattern):

```tsx
it('renders a Statistical basis footer when citations are supplied', () => {
  const citations = {
    whyThisTest: { text: 'x', refs: [] },
    statisticalBasis: [{ claim: 'Independent-samples t-test', ref: { text: 'Student (1908)...' } }],
  }
  const html = renderToStaticMarkup(<ResultPreviewCard {...baseProps} citations={citations} />)
  expect(html).toContain('Statistical basis')
  expect(html).toContain('Independent-samples t-test')
  expect(html).toContain('CITATIONS.txt')
})
it('renders nothing extra when citations is undefined', () => {
  const html = renderToStaticMarkup(<ResultPreviewCard {...baseProps} />)
  expect(html).not.toContain('Statistical basis')
})
```

- [ ] **Step 2: RED** - `npx vitest run src/components/ResultPreviewCard.test.tsx`.

- [ ] **Step 3: Implement.**

```tsx
// ResultPreviewCard.tsx - new prop + footer, inserted after the APA line (line 68), before the closing </section>:
export function ResultPreviewCard({ index, name, question, content, stale, running, onRerun, figureSlot, citations }:
  { index: number; name: string; question: string; content: CardContent; stale: boolean; running: boolean; onRerun: () => void; figureSlot?: ReactNode; citations?: TestCitations }) {
  // ...unchanged body...
  return (
    <section className="card">
      {/* ...unchanged... */}
      <h3 style={{ fontSize: 15, margin: '16px 0 4px' }}>How to read this test</h3>
      <p className="prose">{content.howToRead}</p>
      <p><b>APA template:</b> {content.apa}</p>
      {citations && (
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
          <b>Statistical basis:</b>{' '}
          {citations.statisticalBasis.map((b, i) => (
            <span key={i}>{b.claim} ({b.ref.text}){i < citations.statisticalBasis.length - 1 ? '; ' : '.'}</span>
          ))}{' '}Full references in the exported CITATIONS.txt.
        </p>
      )}
    </section>
  )
}
```

```tsx
// ResultsScreen.tsx BuiltCard - pass the entry through:
import { CITATIONS } from '../../lib/registry/citations'
function BuiltCard({ id, index }: { id: string; index: number }) {
  // ...unchanged...
  return <ResultPreviewCard index={index} name={spec.name} question={spec.question} content={content}
    stale={run.stale} running={s.runStatus === 'running'} onRerun={() => { void s.runAll() }} figureSlot={figureSlot}
    citations={CITATIONS[id]} />
}
```

```ts
// latex.ts - after out.push(escapeLatex(content.apa)) (line 34), add:
import { CITATIONS } from '../registry/citations'
// ...
const c = CITATIONS[id]
if (c) out.push(escapeLatex(`Statistical basis: ${c.statisticalBasis.map((b) => `${b.claim} (${b.ref.text})`).join('; ')}.`))
```

PDF: no separate change - `printReport()` prints the same `results-cards` DOM `ResultPreviewCard` renders, so the new footer appears automatically (confirmed: there is no dedicated PDF-assembly module in this codebase; PDF is browser print-to-PDF of the live DOM, styled by `src/lib/export/print.css`).

- [ ] **Step 4: e2e assertion** - extend the existing full-journey test in `tests/e2e/flow.spec.ts` (the independent-t-test run, right after the existing `#table-t-test`/`#table-group-statistics` assertions), add:
```ts
await expect(page.getByText('Statistical basis:')).toBeVisible()
await expect(page.getByText(/Student \(1908\)/)).toBeVisible()
```
- [ ] **Step 5: GREEN** - `npx vitest run src/components/ResultPreviewCard.test.tsx src/lib/export/latex.test.ts` + `npx tsc --noEmit && npm run build` + `npx playwright test tests/e2e/flow.spec.ts --project=desktop`.
- [ ] **Step 6: Commit** - `git add src/components/ResultPreviewCard.tsx src/components/ResultPreviewCard.test.tsx src/components/screens/ResultsScreen.tsx src/lib/export/latex.ts tests/e2e/flow.spec.ts && git commit -m "feat(citable): Statistical basis footer on results cards, LaTeX + PDF (A4)"`

---

### Unit 8

## U8 - A5 explainers (4 tasks)

Spec: A5 + F1 in the design doc. Owner's R² example is normative: **bold term** → one-sentence meaning → interpretation of THIS run's value with the number woven in.

**Contract deviation (flag - required, not optional):** the skeleton's Interfaces section gives `export interface Explainer { term: string; meaning: string; interpret: (v: ResultValues) => string }` with NO stable key field. Task 2's coverage test must "enumerate every registry table column key per card and assert an explainer-registry entry exists" - but `term` is free-form display prose (e.g. "Pearson's r"), not a stable identifier that can be matched 1:1 against a `ColumnDef.key` (e.g. `'r'`). Without a key, the coverage test cannot be written as specified. **Add `key: string` to `Explainer`**, matching the column's `key` field (`ColumnDef.key` for classic tables, `ModelCol.key`/`GofRow.key`/`ColumnDef.key` from `extraCols` for `kind: 'coef'` tables). `term` remains the bold display label (can differ in wording from `key`, e.g. `key: 'r'`, `term: "Pearson's r"`). This is a strict superset of the given contract (adds one field, changes nothing else) - implement as written below; do not silently omit the coverage test instead.

Also **no `TestId` type exists** (same finding as U7) - `EXPLAINERS: Record<string, Explainer[]>`, coverage test enumerates `SPECS`/`CATALOG`, per the same reasoning as U7.

`ResultValues` (also not in the skeleton's Interfaces, needed for `interpret`'s parameter type) is defined here as a flat, loosely-typed bag: `export type ResultValues = Record<string, number | string | null | undefined>`. Per card, `CardContent` (in `src/lib/results/builders.ts`) grows a new field `values: ResultValues` that the builder populates from the SAME numbers it already computed for that card's primary table row(s)/GOF footer - no new statistics, just a flat lookup alongside what's already rendered. This is Task 3's "value injection wiring."

---

### Task 1: `src/lib/registry/explainers.ts` + `TermExplainers` renderer

**Files:**
- Create: `src/lib/registry/explainers.ts`
- Create: `src/components/TermExplainers.tsx`
- Test: `src/components/TermExplainers.test.tsx` (new)

**Interfaces:**
```ts
export type ResultValues = Record<string, number | string | null | undefined>
export interface Explainer { key: string; term: string; meaning: string; interpret: (v: ResultValues) => string }
export const EXPLAINERS: Record<string, Explainer[]>
```
```tsx
export function TermExplainers({ items, values }: { items: Explainer[]; values: ResultValues }): JSX.Element | null
```

- [ ] **Step 1: Failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TermExplainers } from './TermExplainers'
import type { Explainer } from '../lib/registry/explainers'

const items: Explainer[] = [
  { key: 'r', term: "Pearson's r", meaning: 'The strength and direction of the linear relationship, from -1 to +1.',
    interpret: (v) => `Here, r = ${v.r}, a ${Number(v.r) >= 0 ? 'positive' : 'negative'} relationship.` },
]

describe('TermExplainers (A5)', () => {
  it('renders bold term, meaning, and the live-value interpretation', () => {
    const html = renderToStaticMarkup(<TermExplainers items={items} values={{ r: 0.42 }} />)
    expect(html).toMatch(/<b>Pearson.s r\.?<\/b>/)
    expect(html).toContain('The strength and direction')
    expect(html).toContain('r = 0.42')
  })
  it('renders nothing for an empty item list', () => {
    expect(renderToStaticMarkup(<TermExplainers items={[]} values={{}} />)).toBe('')
  })
})
```

- [ ] **Step 2: RED** - `npx vitest run src/components/TermExplainers.test.tsx` (module doesn't exist).

- [ ] **Step 3: Implement.**

```ts
// src/lib/registry/explainers.ts
export type ResultValues = Record<string, number | string | null | undefined>
export interface Explainer { key: string; term: string; meaning: string; interpret: (v: ResultValues) => string }

export const EXPLAINERS: Record<string, Explainer[]> = {
  'independent-t-test': [
    { key: 't', term: 't', meaning: 'How many standard errors the two group means are apart.',
      interpret: (v) => `Here, t(${v.df}) = ${v.t}.` },
    { key: 'p', term: 'p', meaning: 'The probability of a difference this large (or larger) if the groups truly had equal means.',
      interpret: (v) => `Here, p ${v.p}${Number(String(v.p).replace(/[<>=\s]/g, '')) < 0.05 ? ' - below the conventional .05 threshold, a significant difference.' : ' - at or above the conventional .05 threshold, no significant difference detected.'}` },
    { key: 'd', term: "Cohen's d", meaning: 'The size of the gap in standard-deviation units (~0.2 small, 0.5 medium, 0.8 large).',
      interpret: (v) => `Here, d = ${v.d} [${v.dlo}, ${v.dhi}].` },
  ],
  'one-way-anova': [
    { key: 'f', term: 'F', meaning: 'The ratio of between-group to within-group variance - larger means the groups differ more than chance predicts.',
      interpret: (v) => `Here, F(${v.df1}, ${v.df2}) = ${v.f}.` },
    { key: 'eta2', term: 'η²', meaning: 'The proportion of total variance explained by group membership (~.01 small, .06 medium, .14 large).',
      interpret: (v) => `Here, η² = ${v.eta2} [${v.eta2lo}, ${v.eta2hi}].` },
  ],
  pearson: [
    { key: 'r', term: "Pearson's r", meaning: 'The strength and direction of the linear relationship, from -1 to +1.',
      interpret: (v) => `Here, r(${v.df}) = ${v.r}, 95% CI [${v.ciLow}, ${v.ciHigh}] - a ${Math.abs(Number(v.r)) < 0.1 ? 'negligible' : Math.abs(Number(v.r)) < 0.3 ? 'small' : Math.abs(Number(v.r)) < 0.5 ? 'medium' : 'large'} ${Number(v.r) >= 0 ? 'positive' : 'negative'} relationship.` },
  ],
  'multiple-linear-regression': [
    { key: 'r2', term: 'R²', meaning: 'The share of the outcome’s variance jointly explained by all predictors.',
      interpret: (v) => `Here, R² = ${v.r2}, so the model accounts for about ${v.r2 !== undefined ? Math.round(Number(v.r2) * 100) : '?'}% of the variance in the outcome.` },
    { key: 'vif', term: 'VIF', meaning: 'How much a predictor’s variance is inflated by overlap with the other predictors (multicollinearity); values above ~5-10 are cause for concern (O’Brien, 2007).',
      interpret: (v) => `Here, the largest VIF in this run is ${v.vifMax}.` },
  ],
  did: [
    { key: 'b', term: 'Treated×Post (B)', meaning: 'The estimated causal effect of the treatment, holding entity and period fixed effects constant.',
      interpret: (v) => `Here, B = ${v.b}, 95% CI [${v.lo}, ${v.hi}], p ${v.p}.` },
  ],
  'cb-sem': [
    { key: 'cfi', term: 'CFI', meaning: 'How much better the model fits than a baseline with no relationships at all (≥ .95 is a common, non-binding guideline).',
      interpret: (v) => `Here, CFI = ${v.cfi}.` },
    { key: 'rmsea', term: 'RMSEA', meaning: 'The average model misfit per degree of freedom, penalizing complexity (≤ .06 is a common, non-binding guideline).',
      interpret: (v) => `Here, RMSEA = ${v.rmsea} [90% CI ${v.rmseaLo}, ${v.rmseaHi}].` },
  ],
}
```

```tsx
// src/components/TermExplainers.tsx
import type { Explainer, ResultValues } from '../lib/registry/explainers'

export function TermExplainers({ items, values }: { items: Explainer[]; values: ResultValues }) {
  if (items.length === 0) return null
  return (
    <div className="term-explainers">
      {items.map((ex) => (
        <p key={ex.key} className="prose"><b>{ex.term}.</b> {ex.meaning} {ex.interpret(values)}</p>
      ))}
    </div>
  )
}
```

Placement in `ResultPreviewCard.tsx`: render `<TermExplainers items={EXPLAINERS[testId] ?? []} values={content.values} />` in a new "Understanding the numbers" block, positioned BEFORE the existing "How to read this test" heading (the existing `howToRead` prose is spec-pinned verbatim against `telos_ui_spec.html` by every card's `*.consistency.test.ts` - it must not be edited or removed; the term-led explainers are a NEW, additional section, not a replacement).

```tsx
{EXPLAINERS[id] && EXPLAINERS[id].length > 0 && (
  <>
    <h3 style={{ fontSize: 15, margin: '16px 0 4px' }}>Understanding the numbers</h3>
    <TermExplainers items={EXPLAINERS[id]} values={content.values} />
  </>
)}
<h3 style={{ fontSize: 15, margin: '16px 0 4px' }}>How to read this test</h3>
```
(This requires `ResultPreviewCard` to also receive the test `id` - add it as a new required prop alongside `citations`, threaded from `BuiltCard` the same way `citations={CITATIONS[id]}` was added in U7 T4; do both prop additions in the same pass here if U7 T4 hasn't landed the `id`-plumbing yet - check first, only add what's missing.)

- [ ] **Step 4: GREEN** - `npx vitest run src/components/TermExplainers.test.tsx` + `npx tsc --noEmit && npm run build`.
- [ ] **Step 5: Commit** - `git add src/lib/registry/explainers.ts src/components/TermExplainers.tsx src/components/TermExplainers.test.tsx src/components/ResultPreviewCard.tsx && git commit -m "feat(citable): term-led explainer registry + renderer, 6 representative cards (A5)"`

---

### Task 2: coverage consistency test (RED until Task 4's full sweep)

**Files:**
- Test: `src/lib/registry/explainers.consistency.test.ts` (new)

- [ ] **Step 1: Write the coverage test.** This enumerates every reportable column key per card and asserts an `EXPLAINERS` entry exists for it, keyed by `Explainer.key`. It is EXPECTED to fail (list the 42 cards still missing entries) until Task 4 completes - this is intentional: it is the machine gate A5 calls for, and its RED-list at this point in the plan is exactly the punch-list Task 4 works through.

```ts
import { describe, it, expect } from 'vitest'
import { SPECS } from './catalog'
import { EXPLAINERS } from './explainers'
import type { TableSpec } from './types'

// Every column key a card actually surfaces - classic tables (columns[]), coef tables (models + extraCols +
// gof), matrix tables (columns: [] deliberately - excluded, no per-cell explainer is expected; the matrix's
// own note/legend covers interpretation, consistent with A6's matrix devices doing the explaining visually).
function keysOf(t: TableSpec): string[] {
  if (t.kind === 'coef') return [...(t.models ?? []).map((m) => m.key), ...(t.extraCols ?? []).map((c) => c.key), ...(t.gof ?? []).map((g) => g.key)]
  if (t.columns.length === 0) return [] // matrix table
  return t.columns.map((c) => c.key).filter((k) => k !== 'term' && k !== '' && !['pair', 'group', 'construct', 'path', 'contrast', 'item', 'pred'].includes(k)) // exclude label/identifier columns - nothing to "interpret" about a row label itself
}

describe('explainer coverage (A5 - machine-checked, drift-proof)', () => {
  it('every card has at least one explainer entry (placeholder gate; per-key check below is the real one)', () => {
    const missing = Object.keys(SPECS).filter((id) => !EXPLAINERS[id] || EXPLAINERS[id].length === 0)
    expect(missing).toEqual([]) // RED at Task 2 time - GREEN once Task 4 lands remaining-card entries
  })
  it('every non-identifier column key surfaced by a card has a matching explainer entry', () => {
    const offenders: string[] = []
    for (const [id, spec] of Object.entries(SPECS)) {
      const keys = new Set(spec.tables.flatMap(keysOf))
      const have = new Set((EXPLAINERS[id] ?? []).map((e) => e.key))
      for (const k of keys) if (!have.has(k)) offenders.push(`${id}:${k}`)
    }
    expect(offenders).toEqual([]) // RED at Task 2 time - GREEN once Task 4 lands remaining-card entries
  })
})
```

- [ ] **Step 2: RED - confirm and record the failure list.** `npx vitest run src/lib/registry/explainers.consistency.test.ts` - capture the `offenders` array from the failure output; this becomes Task 4's checklist (do not hand-transcribe it now, re-run the test at Task 4 time and work the list to empty - it is self-verifying).
- [ ] **Step 3: Commit the test in its (expected) RED state, clearly marked** so CI/`test:fast` is NOT broken by an intentionally-red test: add `.skip` for now, un-skip in Task 4's first step.
```ts
describe.skip('explainer coverage (A5 - machine-checked, drift-proof)', () => {
```
`git add src/lib/registry/explainers.consistency.test.ts && git commit -m "test(citable): explainer coverage gate (A5) - skipped until Task 4's sweep"`

---

### Task 3: value injection from live results

**Files:**
- Modify: `src/lib/results/builders.ts` (`CardContent` gains `values: ResultValues`)
- Modify: the 6 representative builders touched in Task 1: `buildIndependentTTest` (or wherever independent-t-test's builder lives - grep `builders.ts`/`build*.ts` for the exact file), `buildOneWayAnova`, `buildPearson`, `buildMultipleLinearRegression`, `buildDid`, `buildCbSem.ts`
- Test: extend each builder's existing `*.test.ts`

**Interfaces:**
```ts
export interface CardContent {
  tables: BuiltTable[]
  note: { kind: 'assume' | 'plain'; text: string; afterTableId?: string } | null
  figures: { caption: string; type: string; file?: string; png: Uint8Array }[]
  howToRead: string
  apa: string
  nExcluded: number
  values: ResultValues // NEW - flat lookup of the numbers already computed for this run, keyed to match EXPLAINERS[id][].key
}
```

- [ ] **Step 1: Failing test** (per touched builder, one new assertion added to its existing test file, e.g. for CB-SEM):
```ts
it('values carries the fit indices the explainers reference', () => {
  const content = buildCbSem(CB_SEM, someRunResult)
  expect(content.values.cfi).toBeCloseTo(someRunResult.cfi, 2)
  expect(content.values.rmsea).toBeCloseTo(someRunResult.rmsea, 2)
})
```
- [ ] **Step 2: RED** for each touched builder's test file.
- [ ] **Step 3: Implement.** In each builder, add a `values` object built from fields the builder ALREADY has in scope (it already destructures the run result to populate `content.tables` - just also assign the same numbers into `values`, no new computation). Example (`buildCbSem.ts`, alongside the existing `note` assembly at line ~97-100):
```ts
const values: CardContent['values'] = { cfi: run.cfi, tli: run.tli, rmsea: run.rmsea, rmseaLo: run.rmseaCiLow, rmseaHi: run.rmseaCiHigh, srmr: run.srmr }
return { tables, note, figures, howToRead: spec.howToRead, apa: ..., nExcluded, values }
```
Repeat analogously for the other 5 (t: `run.t`, `run.df`, `run.p`, `run.d`, `run.dLo`, `run.dHi`; ANOVA: `run.f`, `run.df1`, `run.df2`, `run.eta2`, `run.eta2Low/High`; Pearson: `run.r`, `run.df`, `run.ciLow/High`; multiple regression: `run.r2`, `run.vifMax = Math.max(...run.terms.map(t=>t.vif))`; DiD: `run.b`, `run.ciLow/High`, `run.p`) - field names must match exactly what `Task 1`'s `interpret()` functions read (`v.t`, `v.df`, etc.) - reconcile any naming mismatch by adjusting `values`' keys, not the already-committed `Explainer.interpret` bodies, since those are the user-visible contract.
- [ ] **Step 4: GREEN** - `npx vitest run src/lib/results/` (targeted) + full builder suite + `npx tsc --noEmit && npm run build`.
- [ ] **Step 5: Commit** - `git add src/lib/results/builders.ts src/lib/results/build{IndependentTTest,OneWayAnova,Pearson,MultipleLinearRegression,Did,CbSem}.ts src/lib/results/*.test.ts && git commit -m "feat(citable): wire live result values into CardContent for term-led explainers (A5)"`

---

### Task 4: remaining-cards explainer entries + labelled-notes sweep

**Files:**
- Modify: `src/lib/registry/explainers.ts` (remaining 42 cards' entries)
- Modify: the corresponding 42 builders (their `values` field, same pattern as Task 3)
- Modify: `src/lib/registry/explainers.consistency.test.ts` (remove `.skip`)
- Modify (labelled-notes sweep): `src/lib/registry/ave.ts`, `pathAnalysis.ts`, `pca.ts` `tableNote.text` / `howToRead` (the three longest note-walls found by direct inspection, ranked by combined length: AVE 1624 chars, Path analysis 1474 chars, PCA 1290 chars - see research below); CB-SEM's own wall (966+491 chars) was already the worked example named in the spec, do it FIRST as the template for the other three.
- Modify: `ResultPreviewCard.tsx` (render labelled notes)

**Labelled-notes format (from A5):** long note/explainer paragraphs (~3+ lines) become short, labelled one-liners (`Cutoffs:` / `Caution:` / `Scope:` / `Method:` - pick labels per the concern each sentence actually carries, do not force every card into the same four labels). This changes PRESENTATION, not the underlying claims - every sentence currently in a `tableNote.text`/`howToRead` block must still appear somewhere, just decomposed into labelled lines instead of one wall. Since `howToRead` strings are spec-pinned verbatim by `*.consistency.test.ts` (checked against `telos_ui_spec.html`), **do not touch the `howToRead` field's ui-spec-sourced text** - the labelled-notes treatment applies to `tableNote.text` only (which is NOT spec-pinned - confirmed: `tableNote` has no corresponding entry in the ui-spec HTML fixtures, it is registry-only prose). Add a NEW optional field to `TestSpec` for this:

```ts
// types.ts addition:
export interface LabelledNote { label: string; text: string }
export interface TestSpec {
  // ...unchanged...
  tableNote?: { kind: 'assume' | 'plain'; text: string; afterTableId?: string } // KEEP as-is for cards not yet swept
  labelledNotes?: LabelledNote[] // NEW - when present, ResultPreviewCard renders these INSTEAD of tableNote.text (both fields can coexist in TestSpec during the sweep; a card has one or the other active, never both rendered)
}
```

- [ ] **Step 1: Un-skip the coverage test** (`describe.skip` → `describe`) - confirm it is RED with the full 42-card offender list (`npx vitest run src/lib/registry/explainers.consistency.test.ts`, capture the printed `offenders` array - this is the authoritative per-card, per-key punch list; work it to `[]`).

- [ ] **Step 2: Work the punch list, one card-family at a time** (same shape as Task 1's 6 entries: one `Explainer` per surfaced non-identifier column key, `meaning` from that card's existing `howToRead`/`tableNote.text` prose reworded into one plain sentence - never a new claim, just decomposed - and `interpret` weaving the live number from `values`). Suggested order (matches the audit's family grouping in U9 T1, so the two units' work interleaves cleanly): remaining group-comparison cards (`one-sample-t-test`, `paired-t-test`, `factorial-anova`, `repeated-measures-anova`, `mixed-anova`, `nested-anova`, `welch-anova`, `ancova`, `manova`, `mancova`, `mann-whitney-u`, `wilcoxon-signed-rank`, `kruskal-wallis`, `friedman`) → remaining association/descriptive (`summary-statistics`, `frequencies-crosstabs`, `distribution-normality`, `spearman`, `kendalls-tau`, `chi-square-independence`, `chi-square-goodness-of-fit`, `fishers-exact`) → remaining regression (`simple-linear-regression`, `logistic-regression`, `poisson-negative-binomial`) → econometrics (`arima-sarima`, `stationarity-tests`, `granger-causality`, `var`, `fixed-effects`, `random-effects`, `hausman-test`, `rdd`, `iv-2sls`, `propensity-score-matching`) → latent family (`cronbachs-alpha`, `ave`, `composite-reliability`, `efa`, `pls-sem`, `path-analysis`, `pca`). After each family, re-run the coverage test and the family's builder tests; do not batch all 42 into one uncheckable commit.

- [ ] **Step 3: Labelled-notes conversion, CB-SEM first (the named worked example), then AVE/Path-analysis/PCA.** CB-SEM's `tableNote.text` (`cbSem.ts:111`) decomposes into (content preserved, just split and labelled):
```ts
labelledNotes: [
  { label: 'Pipeline', text: 'Tables shown follow the stages you ran (EFA → CFA → fit → structural); Tables 1-2 are omitted if EFA was deselected, Tables 6-7 if the structural stage was deselected.' },
  { label: 'Cutoffs', text: 'Good-fit guidelines (Hu & Bentler, 1999; Marsh, Hau & Wen, 2004): CFI/TLI ≥ .95, RMSEA ≤ .06 [90% CI], SRMR ≤ .08 - guidelines, not pass/fail gates.' },
  { label: 'Caution', text: 'RMSEA is unstable at small df / small N - interpret it cautiously for compact models. Use WLSMV for ordinal indicators.' },
  { label: 'R²', text: 'Filled once per endogenous (outcome) construct.' },
  { label: 'Saturation', text: 'When the model is saturated (df = 0), the fit-indices table is suppressed and a saturation flag is shown.' },
  { label: 'Scope', text: 'EFA on the same sample is exploratory - treat it as a diagnostic, not confirmatory evidence.' },
  { label: 'Mediation', text: 'The indirect-effects table appears only when the drawn structural paths form a chain (X → M → Y); each indirect effect is a lavaan defined effect with a bootstrapped 95% CI. Moderation is planned for a later version.' },
],
```
Repeat the same decomposition discipline for `ave.ts`, `pathAnalysis.ts`, `pca.ts` (read each file's current `tableNote.text` + `howToRead` in full before splitting - do not paraphrase from memory, split their actual current sentences).

Render in `ResultPreviewCard.tsx` (replaces the single `<p>{content.note.text}</p>` block ONLY when `spec.labelledNotes` is present - `content.note` stays the fallback for the other 44 cards until/unless a later slice sweeps them too, which is explicitly out of this task's scope per A5's "the CB-SEM notes wall is the worked example... treatment sweeps all cards" - here scoped to the 4 named cards only, matching the instruction that gave you "AVE, Path analysis, PCA" as the next targets, not "all 48"):
```tsx
{labelledNotes && labelledNotes.length > 0 ? (
  <dl style={{ fontSize: 11, color: 'var(--muted)' }}>
    {labelledNotes.map((n) => (<div key={n.label}><dt style={{ display: 'inline', fontWeight: 600 }}>{n.label}:</dt> <dd style={{ display: 'inline', margin: 0 }}>{n.text}</dd></div>))}
  </dl>
) : content.note && (/* existing single-note render, unchanged */ <p style={{ fontSize: 11, color: 'var(--muted)' }}>{content.note.text}</p>)}
```

- [ ] **Step 4: GREEN** - `npx vitest run src/lib/registry/ src/lib/results/ src/components/` full sweep + `npx tsc --noEmit && npm run build`.
- [ ] **Step 5: Commit** (split into 2 commits, matching the two kinds of work) - `git add src/lib/registry/explainers.ts src/lib/registry/explainers.consistency.test.ts src/lib/results/build*.ts && git commit -m "feat(citable): explainer entries for the remaining 42 cards (A5 coverage green)"` then `git add src/lib/registry/types.ts src/lib/registry/{ave,pathAnalysis,pca}.ts src/components/ResultPreviewCard.tsx && git commit -m "feat(citable): labelled one-liner notes for AVE/Path-analysis/PCA (A5, CB-SEM was the template)"`

---

### Unit 9

## U9 - R1 audit + F1 readability (4 tasks)

Spec: R1 + F1 in the design doc.

**Scoping note on the worked regression-family example (flag - the brief's assumed gap does not exist):** the brief for this unit's Task 3 says "the plan task shows the logistic classification-table example end-to-end." Direct inspection of `src/lib/registry/logisticRegression.ts:46-48` and `src/lib/stats/logisticRegression.ts:55-62` shows the classification table (2×2 confusion matrix + per-row `% correct`) and its underlying R computation (`table(pred, d$y)`, `pctCorrect`) **already ship** - there is no classification-table gap to build. Task 3 below substitutes the nearest REAL gap in the same card (overall accuracy + sensitivity/specificity are computed implicitly in the raw `classCounts` matrix but never surfaced as named scalars anywhere) as the worked end-to-end example, and separately fixes the one genuine gap Task-1-adjacent research found in `multiple-linear-regression` (standardized β has no CI, unlike every other effect size in the app). Flagging this prominently rather than building a table that already exists.

---

### Task 1: the audit

**Files:**
- Create: `docs/superpowers/reviews/2026-07-06-completeness-audit.md`

**Checklist (verbatim from the design spec, R1):**
1. Every conventional statistic for that test present (committee-proof).
2. Effect size WITH CI everywhere one exists.
3. Assumption checks reported, each with a plain-language verdict.
4. Every reported number reachable by a term-led explainer (machine-enforced by U8's coverage test - by the time this unit runs, this item is a pass/fail read of that test's CI status, not manual re-checking).
5. Citation coverage: test, effect size, thresholds attributed (machine-enforced by U7's coverage test, same note).
6. APA sentence template filled with live values.

**Disposition rule (verbatim from spec):** gaps adding a STANDARD, already-conventioned statistic build by default (each native-R-verified, Task 3). Gaps requiring a NEW methodological convention decision are HELD for the owner and listed in the ratify doc (U11 T5).

- [ ] **Step 1: Run the audit.** For each of the 48 ids in `CATALOG` (`src/lib/registry/catalog.ts`), read its registry file (`src/lib/registry/<file>.ts`) and its runner (`src/lib/stats/<file>.ts`) side by side against the 6-point checklist above. Two rows are pre-verified by this plan's own research (transcribe as-is); the other 46 are NOT pre-filled - **this is the actual audit work, do it for real, do not rubber-stamp**:

| id | 1. stats present | 2. effect size + CI | 3. assumptions + verdict | 4. explainer coverage | 5. citation coverage | 6. APA template live | Disposition |
|---|---|---|---|---|---|---|---|
| logistic-regression | classification table + ROC/AUC present; no overall accuracy / sensitivity / specificity SCALARS surfaced (only raw counts + per-row %correct) | OR has CI; AUC has no CI (a bootstrapped or DeLong CI for AUC is a standard, citable addition) | present (via howToRead, no explicit verdict sentence) | pass (U8 gate) | pass (U7 gate) | present | **GAP - STANDARD**: add accuracy/sensitivity/specificity (Task 3, worked example) |
| multiple-linear-regression | present | B has SE+CI (via `kind:'coef'` auto-stacking); standardized β has NO CI (an `extraCols` field, outside the auto-CI-stacking path) | present (assumptionNote) | pass | pass | present | **GAP - STANDARD**: add β CI (Task 3) |
| *(remaining 46 ids)* | *(fill during execution)* | | | | | | *(STANDARD → build in Task 3's continuation; CONVENTION → HELD, list in U11 T5's ratify doc)* |

- [ ] **Step 2: Write the doc.** `docs/superpowers/reviews/2026-07-06-completeness-audit.md` = the completed 48-row table above (verbatim, once filled) + a one-paragraph summary counting STANDARD vs CONVENTION vs PASS-clean dispositions + an explicit note reproducing this task's flag about the logistic classification-table brief mismatch (so the record shows why Task 3 covers accuracy/sensitivity/specificity rather than "add a classification table").
- [ ] **Step 3: No code change this task** - audit-only. Gate: none beyond `npx tsc --noEmit` (nothing touched).

---

### Task 2: commit findings

- [ ] `git add docs/superpowers/reviews/2026-07-06-completeness-audit.md && git commit -m "docs(citable): R1 completeness audit - all 48 cards vs the 6-point checklist"`
- [ ] No further steps - this is a standalone commit task per the design's explicit "audit output ships BEFORE gap-fix tasks run" ordering, so the findings are reviewable independent of any code change.

---

### Task 3: gap-fix tasks for STANDARD findings (regression family first)

**Files:**
- Modify: `src/lib/stats/logisticRegression.ts` (R computation), `src/lib/results/buildLogisticRegression.ts`, `src/lib/registry/logisticRegression.ts`
- Modify: `src/lib/stats/multipleLinearRegression.ts`, `src/lib/results/buildMultipleLinearRegression.ts`, `src/lib/registry/multipleLinearRegression.ts`
- Modify: `src/lib/export/rScript/emitters/regression.ts` (both R-script emitters, so export ≡ app)
- Test: `src/lib/stats/logisticRegression.test.ts`, `src/lib/stats/multipleLinearRegression.test.ts`, `src/lib/export/rScript/runs-in-r.test.ts` (extend both fixture families)
- Any further STANDARD gaps the audit (Task 1) surfaced beyond these two get their own numbered sub-step in this same task, same TDD shape - do not defer them to a later unit.

**Worked example end-to-end: logistic-regression accuracy/sensitivity/specificity**

- [ ] **Step 1: Failing test** (`logisticRegression.test.ts`):
```ts
it('reports overall accuracy, sensitivity, and specificity alongside the confusion matrix', async () => {
  const r = await runLogisticRegression(engine, dataset, 'outcome', ['x1', 'x2'], 'event', 0.95)
  expect(r.accuracy).toBeGreaterThan(0)
  expect(r.sensitivity).toBeGreaterThan(0)
  expect(r.specificity).toBeGreaterThan(0)
  // native-R cross-check values pinned once the fixture is run (Step 4)
})
```
- [ ] **Step 2: RED** - `npx vitest run src/lib/stats/logisticRegression.test.ts` (fields don't exist on `LogisticResult` yet).
- [ ] **Step 3: Implement.** `LogisticResult` gains `accuracy: number; sensitivity: number; specificity: number`. R side (`src/lib/stats/logisticRegression.ts`, alongside the existing `tab <- table(pred, d$y)` / `pct` computation):
```r
acc <- sum(diag(tab)) / sum(tab)
sens <- tab[event, event] / sum(tab[, event])   # true positive rate among actual events
spec <- tab[oth, oth] / sum(tab[, oth])          # true negative rate among actual non-events
```
returned alongside the existing `classCounts`/`pctCorrect`/`levels`. `buildLogisticRegression.ts` adds one note line (not a new table - these are card-level summary scalars, matching how R²/AIC/BIC already surface as GOF footer rows, not their own tables): extend the `gof` footer of the `coefficients` table with `{ key: 'accuracy', label: 'Accuracy' }`, and the registry's `howToRead` (append, do not rewrite the spec-pinned lead sentence) with a trailing clause naming sensitivity/specificity so the classification table finally has accompanying prose (the narrative gap this task's Step 1 flag identified). Add `EXPLAINERS['logistic-regression']` entries for `accuracy`/`sensitivity`/`specificity` (keeps U8's coverage test green - this is a NEW column key, so it must get an explainer in the SAME task that introduces it).
- [ ] **Step 4: Native-R fixture.** Extend `logisticRegression`'s rep in `runs-in-r.test.ts` to assert the printed accuracy/sensitivity/specificity values (add the equivalent `cat()`/`print()` lines to the R-script emitter in `regression.ts`'s `'logistic-regression'` entry, matching the existing `Table 2` print convention) match the app's computed numbers to the suite's usual tolerance.
- [ ] **Step 5: GREEN.**

**Second gap: multiple-linear-regression standardized β CI**

- [ ] **Step 1: Failing test** (`multipleLinearRegression.test.ts`):
```ts
it('standardized beta carries a CI, not just a point estimate', async () => {
  const r = await runMultipleLinearRegression(...)
  expect(r.terms[0].betaLo).toBeTypeOf('number')
  expect(r.terms[0].betaHi).toBeTypeOf('number')
})
```
- [ ] **Step 2: RED.**
- [ ] **Step 3: Implement.** `parameters::standardise_parameters(m, ci = <level>)` already returns `CI_low`/`CI_high` columns by default (confirmed: this is the SAME package/function already called for the point β - the CI columns are already in its return value, simply not extracted) - extend the R extraction to pull `CI_low`/`CI_high` alongside the existing `Std_Coefficient`, add `betaLo`/`betaHi` to `MultipleLinearRegressionTerm`. Registry (`multipleLinearRegression.ts`): the `extraCols` β column needs its own muted `[lo, hi]` row beneath it, matching how the `models` column already stacks `est`/`(se)`/`[ci]` - extend the `kind:'coef'` builder logic (shared, so check whether this needs a general `extraCols`-with-CI capability rather than a one-off; if the builder doesn't support stacked extraCols today, add a `extraColsCi?: boolean` flag to the relevant `ColumnDef`/`ModelCol`-equivalent, defaulting false so every OTHER `kind:'coef'` card's rendering is unaffected).
- [ ] **Step 4: Native-R fixture** - extend the `multiple-linear-regression` rep in `runs-in-r.test.ts` + its emitter in `regression.ts` to print and assert the β CI bounds.
- [ ] **Step 5: GREEN** - `npx vitest run src/lib/stats/ src/lib/export/rScript/runs-in-r.test.ts` + `npx tsc --noEmit && npm run build`.
- [ ] **Step 6: Any further STANDARD gaps** the completed Task-1 audit surfaced across the other 46 cards get the same 5-step treatment here, one sub-section per gap, before moving to Task 4.
- [ ] **Step 7: Commit** - one commit per gap (not batched) - `git commit -m "feat(citable): logistic-regression accuracy/sensitivity/specificity (R1 gap-fix)"`, `git commit -m "feat(citable): multiple-linear-regression standardized beta CI (R1 gap-fix)"`, etc.

---

### Task 4: F1 readability sweep on all screens

**Files:**
- Modify: `src/components/screens/WelcomeScreen.tsx`, `GuideScreen.tsx`, `TestConfigScreen.tsx`, `PickTestScreen.tsx` (or the actual pick-a-test screen filename - confirm via `ls src/components/screens/`), `ConfigureDataScreen.tsx`, `ResultsScreen.tsx` - presentation/structure only.
- Do NOT modify: `WELCOME_COPY`/`TERMS_COPY` in `src/content/copy.ts` (byte-pinned by `copy.consistency.test.ts` against `telos_ui_spec.html` - restructure the surrounding markup/CSS if a screen reads as a wall, never the constants themselves, per the spec's explicit instruction).

- [ ] **Step 1: Read every screen's current rendering** (not just the copy constants - the DOM structure around them) and identify any paragraph-shaped block exceeding ~3 lines at typical viewport width that isn't already covered by U8 Task 4's labelled-notes work (which only touched 4 SEM-family result-card notes, not the onboarding/config/pick screens this task covers).
- [ ] **Step 2: For each offending block, restructure presentation** (shorter paragraphs, a labelled aside, a `<details>` progressive-disclosure for secondary detail, etc.) while keeping every sentence's content and the byte-pinned constants intact. Add/extend a `renderToStaticMarkup` test per touched screen asserting the byte-pinned copy text is still present verbatim (guards against an accidental rewording during restructuring) AND the new structural class/element exists (guards against the restructuring not landing).
- [ ] **Step 3: Run `copy.consistency.test.ts` after every single screen's edit** (not just once at the end) - it is the actual regression gate for this task; a red result here at ANY point means the copy constants were touched and must be reverted.
- [ ] **Step 4: GREEN** - `npx vitest run src/content/copy.consistency.test.ts src/components/screens/` + `npx tsc --noEmit && npm run build`. F1's "no walls" / "~3 lines" qualities are OWNER-ACCEPTANCE criteria (per spec) - this task's machine gate is the copy-pin test + each new screen test; the actual look is confirmed at Benjie's click-through (U11 T5/acceptance), not asserted here.
- [ ] **Step 5: Commit** - one commit per screen (matches the file-by-file verification in Step 3) - e.g. `git commit -m "polish(citable): readability pass - Welcome screen (F1)"`, repeated per screen.

---

### Unit 10

## U10 - X1 spaced item/column names (2 tasks)

Spec: X1 in the design doc. Sanitization primitive already exists and needs no change: `src/lib/stats/lvName.ts` - `lvName(name)` collapses any run of non-alphanumeric characters to one `_`, trims leading/trailing `_`, prefixes `X` if the result starts with a digit or is empty; `lvNames(names)` does the same list-wise with deterministic `_2`/`_3` de-duplication of collisions, in input order. Confirmed current usage: `cfaReliability.ts` and `runCbSem.ts` already sanitize CONSTRUCT/latent names via `lvNames` - this unit extends the SAME primitive to ITEM/observed-column names, which today are NOT sanitized in 3 of the 4 named files (the 4th, `plsSem.ts`, doesn't use `lvName` at all).

---

### Task 1: app-side item sanitization (4 stats modules)

**Files:**
- Modify: `src/lib/stats/cronbachsAlpha.ts` (imports `lvName` for the first time in this file)
- Modify: `src/lib/stats/cfaReliability.ts`
- Modify: `src/lib/stats/runCbSem.ts`
- Modify: `src/lib/stats/plsSem.ts` (imports `lvName` for the first time in this file)
- Test: extend each file's existing `*.test.ts` with a spaced-header case

**Current gap, confirmed by direct code reading (do not re-derive - this is the exact fix map):**

| file | construct/latent names | item/observed-column names | fix |
|---|---|---|---|
| `cronbachsAlpha.ts` | N/A (no constructs) | raw, in BOTH `colnames(d) <- items` (R, line 52) and the lavaan model string `paste0("f =~ ", paste(items, collapse=" + "))` (line 69) | sanitize once via `lvNames(items)`, use the sanitized array for R identifiers; keep the RAW `items` for the JS-side `cols_flat` value extraction (positional, order-preserved - names never touch value lookup) |
| `cfaReliability.ts` | sanitized (`lvNames`, line 133) | raw, in `buildModel`'s RHS (line 114, `c.items.join(' + ')`) and `colnames(d_all) <- all_items` (R, line 48) | sanitize the FULL flattened `allItems` list ONCE via `lvNames` (must be one call across ALL constructs, not per-construct, so two different constructs' items that happen to collide after sanitizing still dedupe correctly against each other); build a raw→sanitized `Map`, use it for both `colnames(d_all)` and each construct's `buildModel` RHS |
| `runCbSem.ts` | sanitized (`lvNames`, line 244) | **already correct in `path` mode** (a side effect of `rNameOf` being applied to the construct name, which doubles as the column name there, lines 258-260) - **NOT sanitized in `latent`/`full`/`cfa-only` mode** (`rCols = usedCols` raw when `!isPath`, line ~258; `buildModel`'s RHS at line 192 uses raw `c.items.join(' + ')`) | apply the SAME one-call `lvNames(usedCols)` + raw→sanitized map approach as `cfaReliability.ts`, scoped to the `!isPath` branch only (the `isPath` branch is untouched - it already works) |
| `plsSem.ts` | N/A construct names are quoted R string literals, not bare tokens, so untouched | raw everywhere (`measurementLine`, line 227-231; `colnames(d_all) <- all_items`, line 57) - lower risk than the lavaan files (seminr's `composite()`/`paths()` take quoted strings, which tolerate spaces), but still fragile (raw non-syntactic `colnames`) | sanitize `allItems` via `lvNames` for `colnames(d_all)`; the quoted-string arguments in `measurementLine` can keep using the DISPLAY name (unaffected - they're string literals, not identifiers) OR switch to the sanitized name for consistency with the data-frame columns they must key against - **use the sanitized name in both places** so the R-side identifier and the string-literal key always agree |

- [ ] **Step 1: Failing WebR test** (one new case per file, e.g. `cronbachsAlpha.test.ts`):
```ts
it('spaced item names produce the same alpha as the safe-header equivalent', async () => {
  const spaced = { columns: ['customer satisfaction q1', 'customer satisfaction q2', 'customer satisfaction q3'], rows: [...] }
  const safe = { columns: ['q1', 'q2', 'q3'], rows: spaced.rows.map((r) => ({ q1: r['customer satisfaction q1'], q2: r['customer satisfaction q2'], q3: r['customer satisfaction q3'] })) }
  const a = await runCronbachsAlpha(engine, spaced, spaced.columns)
  const b = await runCronbachsAlpha(engine, safe, safe.columns)
  expect(a.alpha).toBeCloseTo(b.alpha, 6)
})
```
Repeat the same "same data, two header spellings, same numbers" shape for `cfaReliability.test.ts` (construct with a spaced item), `runCbSem.test.ts` (both `latent` mode AND `path` mode, to prove path mode's pre-existing correctness isn't regressed), `plsSem.test.ts`.
- [ ] **Step 2: RED** - `npx vitest run src/lib/stats/cronbachsAlpha.test.ts src/lib/stats/cfaReliability.test.ts src/lib/stats/runCbSem.test.ts src/lib/stats/plsSem.test.ts` (the spaced-header case currently throws a lavaan parse error or silently misaligns, per file).
- [ ] **Step 3: Implement per the fix-map table above.** Example (`cronbachsAlpha.ts`):
```ts
import { lvNames } from './lvName'
// ...
const rItems = lvNames(items) // sanitized R-side identifiers; `items` (raw) still used for cols_flat extraction below
const env = { cols_flat, items: rItems, n, seed, nboot } // R receives the SANITIZED names for colnames(d)/model string
```
and the R string builder (same file) changes its model-string source from `items` to the sanitized array already threaded through `env$items`.
Example (`cfaReliability.ts` / `runCbSem.ts`'s `!isPath` branch), the raw→sanitized map:
```ts
const allItems = [...new Set(constructs.flatMap((c) => c.items))]
const rItemNames = lvNames(allItems)
const itemMap = new Map(allItems.map((raw, i) => [raw, rItemNames[i]]))
function buildModel(constructs: { items: string[] }[], rNames: string[]): string {
  return constructs.map((c, i) => `${rNames[i]} =~ ${c.items.map((it) => itemMap.get(it)!).join(' + ')}`).join('\n')
}
// ...and colnames(d_all) <- rItemNames (via env) instead of all_items
```
- [ ] **Step 4: GREEN** - `npx vitest run src/lib/stats/` (full stats suite, since this touches 4 shared files) + `npx tsc --noEmit`.
- [ ] **Step 5: Commit** - `git add src/lib/stats/cronbachsAlpha.ts src/lib/stats/cfaReliability.ts src/lib/stats/runCbSem.ts src/lib/stats/plsSem.ts src/lib/stats/*.test.ts && git commit -m "fix(citable): sanitize spaced item/column names through lvName (X1, app side)"`

---

### Task 2: export analysis.R read.csv path + runs-in-r spaced-header fixture

**Files:**
- Modify: `src/lib/export/rScript/emitters/latent.ts` (the 7 SEM-family emitters - `cronbachs-alpha`, `ave`, `composite-reliability`, `efa`, `cb-sem`, `pls-sem`, `path-analysis`)
- Modify: `src/lib/export/rScript/helpers.ts` (`readData` - additive, non-breaking change) and its `factorLines` (a genuine, adjacent, low-risk bug fix - see flag below)
- Test: `src/lib/export/rScript/runs-in-r.test.ts` (new spaced-header rep for `cb-sem` and `path-analysis`); new fixture CSV

**Design decision (the brief's "check.names=FALSE + backtick OR rename - pick one" - reasoning, then the pick):** the exported script's data frame `d` gets its column names from `read.csv`'s own R-side `check.names` behavior, which is INDEPENDENT of the app's `lvNames`-based (underscore) sanitization scheme computed in TypeScript at emit time. R's *default* `check.names = TRUE` mangles spaces to periods via `make.names()` (e.g. `"customer satisfaction q1"` → `"customer.satisfaction.q1"`), which does NOT match what the TS emitter's `lvNames()` computes (`"customer_satisfaction_q1"`) - so even choosing "do nothing, rely on R's default" leaves the model-formula string (built from the TS-side sanitized name) referencing a column that does not exist in `d`. Fixing this requires either (a) `check.names = FALSE` + reference every column via backtick-quoting the RAW name everywhere (verbose, and lavaan formula-string backtick support for spaces is not the same guarantee as R's own parser), or (b) `check.names = FALSE` + one explicit rename statement (right after `read.csv`) mapping the raw columns to the EXACT SAME sanitized tokens the TS emitter already computed via `lvNames` - giving byte-for-byte parity with the in-app WebR runtime's naming (which never goes through R's `make.names` at all). **Picked: (b), the rename strategy** - it is the only option that guarantees export ≡ app identifier parity (a Global Constraint), not just "the script happens to run."

**Scoping the change (flag - do not apply `check.names = FALSE` globally):** `readData()` is called by EVERY exported test family, not just SEM. Changing its default risks REGRESSING a real, separate, already-existing bug this research surfaced: `factorLines()` (`helpers.ts:31-38`) emits a bare `d$<col> <- factor(d$<col>)` for categorical predictor roles across ALL families (not SEM-specific) - with R's current DEFAULT `check.names=TRUE`, a spaced categorical column name is *accidentally* made safe for this bare-`$`-accessor line (spaces become periods, which are valid inside a bare R identifier); switching the global default to `check.names=FALSE` would turn that accidental safety into a guaranteed R syntax error for every OTHER family's spaced categorical predictor. **Fix, scoped correctly:** give `readData()` an optional rename-map parameter, defaulting to no-op (byte-identical output for every non-SEM family, unchanged `check.names` behavior); only the SEM emitters (which already compute the exact sanitized names via `lvNames` at emit time) pass a rename map. Bundle in the SAME task a trivial, safe, backward-compatible fix to `factorLines()`'s bare `d$<col>` → `` d[["<col>"]] `` (bracket access - byte-behaviorally identical for every currently-passing fixture, and no longer a syntax error for a spaced name in ANY family) - flagged here as slightly beyond X1's literal scope but directly adjacent, low-risk, and left broken it would silently undermine this task's own "export ≡ app" goal the moment a non-SEM card with a spaced categorical predictor is exported.

- [ ] **Step 1: Failing native-R fixture.** New fixture `tests/e2e/fixtures/sem-spaced.csv` = a copy of `tests/e2e/fixtures/scale.csv` (the existing path-analysis fixture, columns `x1..x9`) with `x1` renamed to `customer satisfaction q1` in the header row only (values unchanged). Add reps to `runs-in-r.test.ts`:
```ts
mk('cb-sem', 'sem-spaced.csv', /* constructs referencing 'customer satisfaction q1' as an item */ ..., { modelKind: 'latent' }, ['Table 3: Fit indices']),
mk('path-analysis', 'sem-spaced.csv', /* construct.name === 'customer satisfaction q1' per path-mode convention */ ..., { modelKind: 'path' }, ['Model is saturated (df = 0)', 'Table 6: Structural paths']),
```
- [ ] **Step 2: RED** - `npx vitest run src/lib/export/rScript/runs-in-r.test.ts -t spaced` (the emitted script currently references a column that doesn't exist in `d` post-`read.csv`, so `Rscript` exits non-zero and `execSync` throws).
- [ ] **Step 3: Implement.**
```ts
// helpers.ts
export function readData(rename?: [string, string][]): string {
  const base = 'd <- read.csv("cleaned.csv", stringsAsFactors = FALSE' + (rename ? ', check.names = FALSE' : '') + ')'
  if (!rename || rename.length === 0) return base
  const from = rename.map(([r]) => JSON.stringify(r)).join(', ')
  const to = rename.map(([, s]) => JSON.stringify(s)).join(', ')
  return `${base}\ncolnames(d)[match(c(${from}), colnames(d))] <- c(${to})`
}

export function factorLines(setup: { roles: Record<string, string[]> }, _spec: unknown, dataset: Dataset): string {
  const cols = [...new Set(Object.values(setup.roles).flat())]
  return cols
    .filter((c) => dataset.columns.includes(c) && !isNumericColumn(dataset, c))
    .map((c) => `d[["${c}"]] <- factor(d[["${c}"]])`)
    .join('\n')
}
```
```ts
// latent.ts - each of the 7 SEM emitters, at their `readData()` call site, thread the rename map they already have the inputs for (they already compute `lvNames(allItems)` for the model string - just also pass it to readData):
const allItems = /* already computed */
const rItems = lvNames(allItems)
const rename = allItems.map((raw, i) => [raw, rItems[i]] as [string, string]).filter(([raw, safe]) => raw !== safe)
lines.push(readData(rename.length ? rename : undefined))
```
(Every other family's call site, `readData()` with no argument, is untouched - byte-identical output, confirmed by the EXISTING `runs-in-r.test.ts` reps for those families staying green with zero edits.)
- [ ] **Step 4: GREEN** - `npx vitest run src/lib/export/rScript/runs-in-r.test.ts` (full file - both the new spaced reps AND every pre-existing rep, proving no regression) + `npx tsc --noEmit && npm run build`.
- [ ] **Step 5: Commit** - `git add src/lib/export/rScript/helpers.ts src/lib/export/rScript/emitters/latent.ts src/lib/export/rScript/runs-in-r.test.ts tests/e2e/fixtures/sem-spaced.csv && git commit -m "fix(citable): exported SEM scripts rename spaced headers to match the app's lvNames tokens (X1, export side)"`

---

### Unit 11

## U11 - Integration + gate (5 tasks)

Spec: Testing/gate section of the design doc.

---

### Task 1: e2e moderation journey + citation/explainer assertions

**Files:**
- Create: `tests/e2e/sem-moderation.spec.ts`
- Modify: `tests/e2e/flow.spec.ts` (citation-footer + explainer assertion, if not already added by U7 T4 Step 4 - check first, extend rather than duplicate)

**Flag - DOM/label selectors below are best-effort, not fixed contract:** U4 (canvas moderation gesture), U5 (A7 reporting/export), and U6 (PLS parity) are OUT OF SCOPE for this drafting pass (only U7-U11 were assigned) and were not detailed in this session - this task's selectors (`.sem-moderation-edge`, `svg[id^="figure-simple-slopes-"]`, etc.) are inferred from the design spec's PROSE ("dashed clay arrow moderator → path midpoint", "NEW simple-slopes figure") and from `sem-canvas.spec.ts`'s existing selector idiom, not from real implementation. Whoever executes this task (after U0-U6 actually exist) MUST reconcile every selector against the real DOM the canvas/figure code emits - treat the test BODY STRUCTURE (helper reuse, preset selection, timeout budget, assertion shape) as the contract, not the literal selector strings.

- [ ] **Step 1: Failing e2e test**, modeled directly on the existing `tests/e2e/sem-canvas.spec.ts` idiom (same `gotoCard` helper, same construct-slots setup pattern):
```ts
import { test, expect } from '@playwright/test'
import { gotoCard } from './fixtures/helpers'

test('CB-SEM moderation: draw edge → run at 1,000 preset → interaction row + slopes figure', async ({ page }) => {
  await gotoCard(page, 'cb-sem', 'sem-moderation.csv') // NEW fixture with a moderator-suitable construct - reuse spike-moderation-data.csv shape if still present under .superpowers/sdd/, else build fresh with >=2 constructs + 1 moderator construct
  // ...define 3 constructs (2 structural + 1 moderator) via the construct-slots form, same pattern as sem-canvas.spec.ts...
  await page.locator('[data-node-id]').nth(0).click()
  await page.locator('[data-node-id]').nth(1).click() // draws the base structural path first
  await expect(page.locator('line[marker-end="url(#sem-arrow)"]')).toHaveCount(1)
  await page.locator('[data-node-id]').nth(2).click() // moderator construct
  await page.locator('line[marker-end="url(#sem-arrow)"]').click() // click the existing path's midpoint handle - moderation gesture per spec A7
  await expect(page.locator('line.sem-moderation-edge, line[stroke-dasharray]')).toHaveCount(1) // dashed moderator->path edge
  await page.getByLabel(/bootstrap/i).selectOption('1000') // "quick draft" preset per Global Constraints
  await page.getByRole('button', { name: /run/i }).click()
  await expect(page.locator('svg[id^="figure-path-diagram-"]')).toBeVisible({ timeout: 240_000 })
  await expect(page.locator('#table-cb-sem-structural-paths, #table-cb-sem-moderation')).toContainText(/×|interaction/i)
  await expect(page.locator('svg[id^="figure-simple-slopes-"], img[alt*="simple slopes" i]')).toBeVisible()
})
```
- [ ] **Step 2: RED** - this test necessarily fails until U0-U6 are built; it is written now as part of this unit's integration scope, run (and fixed up against the real DOM) only once those units are complete. Do not attempt to make it pass with placeholder markup.
- [ ] **Step 3: Citation/explainer integration assertion** - add to the EXISTING `flow.spec.ts` full-journey test (right where U7 T4 Step 4 already added the "Statistical basis:" assertion - if that step landed as written, ONLY add the explainer assertion here to avoid duplicating the citation one; if it did not land yet, add both together):
```ts
await expect(page.locator('.term-explainers')).toContainText(/t\.|Cohen/i) // U8's term-led explainer block, live-value-woven
await expect(page.getByText('Statistical basis:')).toBeVisible() // U7's footer (idempotent if already asserted)
```
- [ ] **Step 4: Commit** - `git add tests/e2e/sem-moderation.spec.ts tests/e2e/flow.spec.ts && git commit -m "test(citable): moderation e2e journey + citation/explainer integration assertion"`

---

### Task 2: per-test docs regen sweep (ALL 48)

**Files:** `docs/test-documentation/**` (regenerated, not hand-edited), `scripts/gen-doc-readmes.mjs` (run, not edited)

- [ ] **Step 1: Regenerate the capture.** `npx playwright test --config=playwright.docs.config.ts` (workers: 4, timeout 720s per the existing config - this sweep is EXPECTED to touch all 48 folders, since A4 (why-this-test line + statistical-basis footer) and A5 (term-led explainers + labelled notes) both change every config screenshot (`1-input-config.png`) and every results screenshot/PDF (`2-app-output.png`, `3-report.pdf`) - this is the exact scenario the design doc calls out: "A4/A5 change EVERY card's output and config screen → the regen sweep covers ALL 48 cards."
- [ ] **Step 2: Regenerate the READMEs.** `node scripts/gen-doc-readmes.mjs`.
- [ ] **Step 3: LaTeX compile pass** for the `4-latex-source.tex` → `5-latex-rendered.pdf` pairs (manual/CI step outside these two scripts per current repo convention - use whatever tectonic/XeTeX invocation the existing 48 folders were built with; confirm by checking one existing pair's timestamps/tool if unclear).
- [ ] **Step 4: Sanity-check the diff size** before committing - expect roughly the full ~789 files / ~25MB to show as modified (`git status --short docs/test-documentation | wc -l`), consistent with the "every card changes" expectation above; if a SPECIFIC card's screenshots are byte-identical to before, that is a signal something in A4/A5 did not actually reach that card - investigate, don't just accept it.
- [ ] **Step 5: Commit as ONE dedicated commit** (binaries, ~22MB, per prior slices' convention - e.g. `01ae085` from the SEM-B per-test-docs commit) - `git add docs/test-documentation && git commit -m "docs(citable): regenerate all 48 per-test doc artifacts (A4/A5 change every card)"`. Do not mix this with any code commit.

---

### Task 3: visual baseline regen + owner diff set

**Files:** `tests/e2e/*-snapshots/**` (regenerated), `.superpowers/sdd/baseline-diffs/` (new, diff artifacts for Benjie)

**Tooling note:** this environment has no `imagemagick`/`compare` installed (checked: `which magick compare` → not found) - use a dependency-free before/after side-by-side rather than a pixel-diff tool, so this task introduces no new dependency.

- [ ] **Step 1: Snapshot the "before" baselines.** `mkdir -p .superpowers/sdd/baseline-diffs/before && cp tests/e2e/visual.spec.ts-snapshots/*.png .superpowers/sdd/baseline-diffs/before/` (adjust the glob to the actual snapshot directory Playwright is using - confirm via `find tests/e2e -name '*-snapshots' -type d` first, since the exact path depends on the test file name Playwright derives it from).
- [ ] **Step 2: Regenerate.** `npx playwright test --config=playwright.config.ts --project=visual --update-snapshots`.
- [ ] **Step 3: Collect the "after" set + a before/after index.** `mkdir -p .superpowers/sdd/baseline-diffs/after && cp tests/e2e/visual.spec.ts-snapshots/*.png .superpowers/sdd/baseline-diffs/after/`. Write a small index `.superpowers/sdd/baseline-diffs/README.md` (or `.txt`, per this repo's scratch-file convention) listing which named baselines actually changed (`diff <(ls before) <(ls after)` won't show CONTENT changes since filenames are stable - instead use `for f in after/*.png; do cmp -s "before/$(basename "$f")" "$f" || echo "$(basename "$f") CHANGED"; done` to get the real changed-list), one line per changed baseline, so Benjie can open `before/X.png` next to `after/X.png` directly rather than hunting through 30 files.
- [ ] **Step 4: GREEN.** `npx playwright test --config=playwright.config.ts --project=visual` (now passes against the new baselines).
- [ ] **Step 5: Commit the new baselines** (NOT the before/after diff folder - that's a scratch artifact for the owner's review, stays untracked/local per this repo's `.superpowers/sdd/.gitignore` convention, confirmed such a gitignore already exists) - `git add tests/e2e/*-snapshots && git commit -m "test(citable): regenerate visual baselines (A4/A5/A7 change card layout on every screen)"`.

---

### Task 4: FULL gate

Exact commands, run in this order, ALL must be green before U11 T5:

- [ ] `npx tsc -b && node scripts/copy-webr.mjs && npx vite build` (equivalently: `npm run build`)
- [ ] `npm run test:fast` (excludes stats/webr/runs-in-r per `package.json`'s existing exclude list - unchanged by this slice)
- [ ] `npm test` (full WebR vitest, 0 skipped - includes the stats-engine + WebR-lib suites `test:fast` excludes; per the repo's README this is ~30 minutes serialized)
- [ ] `npx vitest run src/lib/export/rScript/runs-in-r.test.ts` (native-R verification; auto-skips if `Rscript` isn't on PATH - confirm it is NOT skipping: check the test output header for the `hasR` gate, don't just accept a green "0 failed" that might be "0 run")
- [ ] `npx playwright install chromium && npx playwright test` (all 5 projects: desktop/tablet/mobile/responsive/visual, per `playwright.config.ts`)
- [ ] Fresh clone: `git clone . /tmp/telos-citable-fresh-$(date +%s) && cd /tmp/telos-citable-fresh-* && npm ci && npm run test:fast && npm run build`, then `cd - && rm -rf /tmp/telos-citable-fresh-*` (delete the clone after - do not leave it around).
- [ ] Record the exact pass counts (test:fast N/N, full vitest N/N, runs-in-r N/N, Playwright N/N per project) in the ratify doc (Task 5) - do not just say "green," cite numbers, matching every prior slice's gate-reporting convention in this repo's memory/ledger.

---

### Task 5: ledger/ratify prep checklist

**Files:**
- Modify: `.superpowers/sdd/progress.md` (append this slice's ledger entries, matching the existing per-task-completion format seen for prior slices - one line per unit/task with the commit range and any adjudication notes)
- Create: `docs/superpowers/reviews/2026-07-06-citable-complete-ratify.md` (matches the established ratify-doc shape: `# <slice> - build ratify`, date, spec+plan+ledger pointers, `## Gate` with the Task-4 numbers, `## What shipped`, `## Notes for your click-through`, `## Acceptance`)

- [ ] **Step 1: Ledger.** Append one line per completed unit (U0-U11, once all are actually executed - this plan only details U7-U11; U0-U6's own execution needs the same ledger discipline when they run) to `.superpowers/sdd/progress.md`, in the exact style already used (`Task N: complete (commits X..Y, review clean/adjudications...)`).
- [ ] **Step 2: Ratify doc sections to fill:**
  - `## Gate` - the exact numbers from Task 4.
  - `## What shipped` - one bullet per unit (citations registry + 48-entry coverage; explainer registry + coverage + labelled notes; R1 audit + gap-fixes; X1 spaced-name fix app+export; moderation e2e + docs regen + visual baselines).
  - `## HELD (owner decision required)` - every CONVENTION-disposition finding from U9's audit (Task 1's table), listed explicitly, NOT silently deferred.
  - `## Notes for your click-through` - flag every judgment call this drafting session made that the owner should specifically eyeball: (a) the ~42 previously-uncited cards now carry FIRST-TIME primary-method citations (Student/Welch/Fisher/Tukey/Pearson/etc.) that go slightly beyond pure "consolidation of existing prose" since most of those cards had zero citation text before this slice - flagged plainly so Benjie can veto or amend any specific one; (b) the CR≥.70/KMO mis-citation-trap fixes from the convention doc were applied to `ave.ts`/`composite-reliability.ts`/`efa.ts` - confirm the fix actually landed correctly during U7 T1's execution, not just noted; (c) the logistic-regression classification-table brief mismatch (Task 3 built accuracy/sensitivity/specificity instead of a table that already existed) - explain plainly, it is a correction of the ORIGINAL BRIEF, not a scope cut; (d) the U11 T1 moderation e2e selectors are best-effort placeholders pending U4-U6's real DOM - flag that this test needs a pass once those units land.
  - `## Acceptance` - Benjie's click-through per the design spec: "CB-SEM with moderation on the spike dataset, PLS with interaction, one regression, one t-test; boards vs reality; baseline diffs approved; then his separate deploy/push words." Point him at `.superpowers/sdd/baseline-diffs/` for the before/after set from Task 3.
- [ ] **Step 3: Commit.** `git add .superpowers/sdd/progress.md docs/superpowers/reviews/2026-07-06-citable-complete-ratify.md && git commit -m "docs(citable): ledger + ratify doc for slice 5 - your call on HELD items + deploy"`. **Do not push** - per every prior slice's Global Constraint, push/deploy is the owner's separate word.

