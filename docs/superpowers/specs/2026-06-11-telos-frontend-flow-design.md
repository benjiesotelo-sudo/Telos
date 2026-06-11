# Telos Frontend Flow — Design

**Date:** 2026-06-11 · **Status:** approved scope, awaiting Benjie's review of this document
**Decided through:** brainstorming session with visual companion (mockups in `.superpowers/brainstorm/62447-1781152335/content/`, gitignored)

## Goal

Build the **full `telos_ui_spec.html` experience** — the stepper-driven flow Welcome → Upload → Terms guide → Configure data → Pick tests (all 46 drawn) → per-test configure (drag-slots) → Results/export — with the **independent t-test running live end-to-end** through it, on top of the proven walking-skeleton engine. Purpose (Benjie's framing): the rendered product must demonstrate the vision, not a lighter stand-in. The other 45 tests appear exactly where the spec draws them, greyed with the honest reason "arrives in a later slice."

This re-sequences the original plan tail: the visual/flow layer moves ahead of the remaining test slices. Later slices then land inside a finished shell.

## Decisions made in this session (all Benjie's)

1. **Scope = full flow, t-test live** (chose over polish-current-page and static-prototype options).
2. **Design language:** dominantly **white** tool surfaces (Google-Analytics restraint), **Workday-style numbered stepper** (checkmarks for done, blue ring current, gray locked; grows a numbered per-test step on selection — the spec's "expanding bar" in stepper idiom), **blue `#185fa5` as the single accent** (harmonizes with the locked ggplot boxplot blues), small gray uppercase labels, hairline borders, Crimson Pro in page titles only, Atkinson Hyperlegible everywhere else. The earlier purple navbar and amber markers were explicitly dropped. Light is the canonical design; dark remains only as the automatic `prefers-color-scheme` variant from the tokens. Warm paper background `#f0efe9` kept from the locked palette (Benjie saw it in mockups and approved).
3. **Excel now:** `.xlsx`/`.xls` via SheetJS, with the spec's sheet picker.
4. **Export bar shows all five formats** (PDF, LaTeX, R script, table images, figure images) with the three unbuilt ones visibly disabled — "coming in a later slice."
5. **Approach A:** wizard as a state machine in the existing Zustand store; no URL router (session-based v1 — deep links into a half-configured session are meaningless).
6. **"Load sample data" button is removed** — the spec's Upload step doesn't have one; e2e uploads fixture files. (Flagged to Benjie; standing unless vetoed at doc review.)

## Architecture

### Flow layer (state machine in the session store)

- **Spine:** `welcome → upload → guide → configure-data → pick-tests → [test-1 … test-N] → results`; the bracketed steps derive from the selected tests in selection order.
- **Gates** (single source of truth — navigator and Continue buttons read the same rules):
  - upload complete = a parsed `Dataset` exists
  - guide complete = visited
  - configure-data complete = every *Used* column has a level
  - each test step complete = all role slots filled (options always have valid defaults)
  - "Run analysis" enables when every selected test is fully configured; clicking it enters the results step, which shows per-test run progress (first run includes WebR boot progress, per the spec's run-state note) and then the previews
- **Back-edit invalidation** (the spec's navcap rules, implemented once, centrally): any earlier-step edit re-evaluates all later gates; still-valid work is kept; a test config whose columns became invalid is **blocked with the stored reason**; rendered results are marked **stale** and "Run analysis" re-enables. The walking skeleton's config-change-clears-result behavior and its tests carry forward inside this.
- Controls lock while an analysis runs (also closes the walking-skeleton review's mid-run race finding by construction).

### Data layer

- **Parsing:** CSV via PapaParse (delimiter auto-detect built in); Excel via SheetJS → sheet names → picker (default first) → same `Dataset` shape. Parse failure/empty file → spec's inline error, stay on Upload. DRAFT size guidance implemented as written: warn above 20 MB or 100,000 rows.
- **Column metadata:** `ColumnMeta { name, detectedType: int64|float64|object|bool|datetime64, tags: (count|datetime|id|nested)[], level: nominal|ordinal|interval|ratio|null, used: boolean }`. Detected types/tags computed client-side, read-only in UI (with the spec's "fix type" override for numeric-as-text). Level pre-filled from detected type (numeric → ratio, text → nominal, …), changeable within compatibility; columns renamable; Use togglable.
- **Missing data (step 4a, per the R2 ruling):** three functional options — **Leave as-is** (default; the raw dataset passes through and each test applies its own listwise exclusion, reporting its own N — the t-test's existing behavior), **Drop rows** (a transformed working dataset with rows dropped globally over Used columns, count shown), **Impute** (a transformed working dataset — mean for interval/ratio, mode for nominal/ordinal — with caution text that imputation understates variance). Tests always consume the working dataset; only Leave-as-is leaves residual missingness for the per-test filters. SEM estimator exception deferred with SEM.
- **Eligibility engine:** registry gains (a) a **catalog** of all 46 tests — id, name, family, subfamily, `available | later-slice` — consistency-tested by equality against the ui-spec picker tree; (b) **machine-readable constraints** beside the verbatim display strings: per-role allowed levels + arity (+ category count), per-test minimum data (DRAFT "≥3 complete rows per group", implemented as written for the t-test). One engine answers step 5's greyed-with-reason and step 6's slot compatibility / blocked-with-reason.

### Screens (content verbatim from the specs, incl. all DRAFT passages — Benjie reviews them rendered)

1. **Welcome** — Crimson Pro wordmark, DRAFT about-copy, LinkedIn credit, Get started. No stepper yet.
2. **Upload** — drop zone (.csv/.xlsx/.xls, header = row 1), sheet picker for multi-sheet workbooks, inline parse errors, DRAFT size guidance.
3. **Terms guide** — the DRAFT type-vs-level / four-levels / missing-data copy, Continue.
4. **Configure data** — missing-data control on top; file summary banner (rows · cols · encoding); columns table: detected type read-only, level dropdown, rename, Use toggle; "Confirm & pick test" disabled until every Used column has a level.
5. **Pick a test** — the full six-family tree, hint line, multi-select; t-test live; 45 greyed + honest reason; all-greyed explainer panel pointing back to steps 2/4.
6. **Configure each test** — one step per selected test: drag columns into role slots (dnd-kit; incompatible columns greyed with reason), option pills (α, tails, equal-variance toggle per the R3 ruling, CI), Run analysis with WebR boot progress.
7. **Results** — export bar on top (5 formats, 3 disabled), per-test preview cards (`NN · Test name`, APA tables, ggplot figure, how-to-read), stale marking after back-edits, feedback button (placeholder Google Form URL — standing open item), zip download per the spec's bundle naming (existing `01_independent-t-test/` machinery).

### What carries over vs. is replaced

- **Untouched:** WebR engine, t-test stats, registry t-test card + consistency tests, zip bundle, result formatting conventions (U+2212, df, p-clause, APA sentence), `ApaTable`.
- **Replaced:** the one-page `App` (becomes the stepped app), `DatasetLoader` (→ Upload screen), `TestConfig` (→ per-test configure screen). `ResultCard` restructures into the results preview card.
- **Extended:** session store (flow layer), registry (catalog + constraints), tokens.css (light-first component tokens for stepper/cards/buttons).

## Testing

1. **Consistency suite:** existing t-test card tests unchanged; new catalog-vs-ui-spec-tree equality test (same mutation-discrimination discipline).
2. **Unit:** table-driven step-machine tests (every gate + invalidation rule in the spec); known-answer tests for type detection, level suggestion, impute arithmetic, eligibility verdicts. Existing 19 tests stay green throughout.
3. **E2E (real Chromium):** full journey — fixture CSV upload → all steps → drag roles → Welch run (sandbox-verified numbers) → toggle → pooled re-run → back-edit a level → result goes stale → re-run → zip download with foldered paths; second path through the Excel sheet picker; disabled export formats asserted.
4. **Rendered review:** screenshot checkpoints per screen during the build; Benjie clicks through the preview before any deploy. DRAFT copy confirmations happen there.
5. **Gates as before:** `tsc -b`, `npm test`, `npm run build`, fresh-clone install.

## Explicitly deferred (recorded decisions, not drift)

- The 45 other tests' configs/outputs (subsequent slices, into this shell), and the SEM model-building canvas.
- PDF / LaTeX / R-script export, `data/cleaned.csv`, bundle LICENSES note (report slice) — shown disabled.
- Cookieless analytics counters (visited/used/finished) — provider is Benjie's call (Cloudflare Web Analytics recommended at deploy time).
- Real Google Form feedback URL (standing open item).
- Dark mode polish (automatic variant only); moderation (per R1); app-source licence choice.

## Resolved at doc review (Benjie, 2026-06-11)

1. **Sample-data button removed** — confirmed; the Upload step is spec-faithful, e2e uses fixture files.
2. **Warm paper white `#f0efe9` stays** — Benjie's call: "keep what we currently have, I like it."
3. Spec document approved as the basis for the implementation plan.
