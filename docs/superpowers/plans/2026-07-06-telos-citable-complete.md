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

(Per-task detail sections follow - one section per unit, complete code per step. Drafted against the contracts above; integrated and self-reviewed before execution.)
