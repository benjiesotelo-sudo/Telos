# Slice 5 "Citable & Complete" - Design Spec

Owner-approved 2026-07-06 via the visual decision boards (comparison → side-by-side → master board → A7 moderation → charter → complete board).
Amended same day per adversarial spec review (21 findings folded in; review agent verdict "NEEDS REWORK → plan-ready with amendments").
Reference paper: Huang et al. (2026), *Journal of Hospitality and Tourism Insights*, JHTI-08-2025-0939 (Benjie's sample; its Tables 2/3/4 + Figures 2/3 are the format anchors).

## Goal

Every test in Telos reports completely, reads intuitively, and is citable at the point of use - so a student can lift methods text, numbers, and references straight into a thesis without leaving the app, and the SEM cards match or beat the reporting craft of a published Emerald paper.

## Rulings of record

- A1-A7, P1, R1, F1: Benjie (boards approved 2026-07-06; moderation ruled IN; deadline explicitly unhooked - quality over speed).
- H-numbering detail, X2 push (done: origin=8584fb2), X3 WIP handling (done: branch `benjie-wip-semcanvas-export-fit` @ 1e71638), CI-type/Result-rule/z-p-presentation details: delegated to Claude, resolutions recorded inline below.
- Supersession: the dual-CI design below supersedes the 2026-06-20 "percentile-only default / BCa@10k opt-in" ruling (owner, boards 2026-07-06).
- Held (NOT this slice): multigroup analysis, model comparison, Johnson-Neyman, editable hypothesis labels (fast-follow), MANOVA/MANCOVA spanning transpose (A6 must not preclude it), deploy (owner's separate word).

## A6 - Table craft (renderer upgrade; build FIRST, everything else renders through it)

The table renderers learn FOUR devices, spec'd from the paper's typesetting:

1. **Grouped section rows** (classic-table path): a row may be a group header (italic, carries group-level stat columns once) with indented child rows beneath.
   LaTeX shape: full-width italic label row + `\quad`-indented child first cells (NOT `\multirow`).
2. **Spanning column headers**: a two-level header where a label spans 2+ subcolumns (e.g. "Percentile 95% CI" over Lower/Upper).
   LaTeX shape: `\multicolumn` + `\cmidrule`.
3. **Internal section labels**: an italic full-width label row inside the body (e.g. "Direct paths" / "Indirect effects" / "Moderation").
4. **Matrix-table upgrades** (matrix path is separate code - `MatrixProps` + `matrixToLatex`): italic-diagonal option, per-cell significance stars, star-legend note row.
   Requires latent-correlation p-values as a NEW CB-SEM runner output (from the ψ block of standardizedSolution), native-R-verified.

Constraints:
- APA numeric style preserved (2-decimal, leading-zero-stripped for bounded stats, tabular-nums, right-aligned numerics).
- HTML, table-PNG capture, LaTeX, and PDF all render all four devices (export ≡ app).
- Existing flat tables render byte-identically unless a card opts into the new devices.

## A1+A2+A3 - CB-SEM card content (Track A convention unchanged underneath)

Canonical post-slice layout, mapped to CURRENT card table ids ("old Tables 1-2/4-5" on the boards referred to the PAPER's numbering):

- **Table 1 = merge of `cfa-loadings` + `reliability`** (+ new item Mean/SD): grouped - construct rows (italic) carry ω, α, CR, AVE once; item rows carry Mean, SD, B, SE, z, p, Std. loading.
  z and p remain PLAIN COLUMNS in all formats - no disclosure UI this slice; the wide table scrolls in its overflow container per the slice-4 responsive rules.
  Item Mean/SD computed on the estimation sample as defined by the missing-data setting (listwise → listwise N; FIML/MI → observed-per-item N); the table note states which.
- **Table 2 = `fit-indices`** - unchanged set: χ²(df, p), χ²/df, CFI, TLI, RMSEA [90% CI], SRMR.
- **Table 3 = NEW Fornell-Larcker**: latent correlation matrix, √AVE italic on the diagonal, significance stars on off-diagonal correlations, star-legend note (*p<.05, **p<.01, ***p<.001).
- **Table 4 = NEW HTMT** (≤ .85 note; stays the primary criterion per the approved convention).
  Under Tables 3-4: "Discriminant validity also has its own card (AVE / convergent validity); it is included here so one run gives the complete measurement-model writeup."
  The AVE card KEEPS its tables (both homes).
- **Table 5 = merge of `structural-paths` + `indirect-effects` + new moderation rows** (spanned headers).
  Columns: H | Path | B | Std. β | p | Percentile 95% CI (Lower/Upper) | BC 95% CI (Lower/Upper) | Result.
  Both CI pairs bound the UNSTANDARDIZED B, from ONE bootstrap run; Std. β is point-only (delta-method CIs not shown); the table note states this.
  **BC = bias-corrected (non-accelerated)**: lavaan `boot.ci.type='bca.simple'` (Efron, 1987); provenance note discloses "bias-corrected, non-accelerated"; true BCa (jackknife acceleration) is OUT of scope.
  Fix the existing dead `ciType==='bca'` → invalid `'bca'` mapping in runCbSem.ts:264 to `'bca.simple'` as part of this work.
  When BC prints from <7,000 resamples, the provenance note states the Andrews & Buchinsky floor and points at the 10,000 "publication-grade" preset (accuracy honesty; default stays 5,000).
  Section labels: Direct paths / Indirect effects / Moderation (each only when applicable).
  **Result rule**: "Supported" / "Not supported" derived ONLY from the PERCENTILE 95% CI excluding zero (the BC column is comparative context); α fixed at .05 this slice - no new α option.
  **H-ordering (deterministic)**: structural paths in canvas array order, then indirect effects in chain-enumeration order, then moderation edges in creation order; the ordering serializes into the run config so app ≡ export ≡ docs.
  R² per endogenous construct in a note line.
- **EFA pipeline stage**: when selected, its tables render BEFORE Table 1, labeled "Exploratory preamble - Table E1/E2" (canonical numbering unaffected).

## A7 - Latent moderation (CB-SEM)

- Canvas gesture: Draw mode, click a construct then an EXISTING path (midpoint handle) → moderation edge; dashed clay arrow moderator → path midpoint; Delete removes it like any path.
  Guards: no self-moderation (moderator ≠ source/target); no duplicate (same moderator, same path); NOT available in path-analysis (observed-only) mode this slice.
- Statistics: double-mean-centered product indicators via `semTools::indProd`, latent interaction construct.
  Equal indicator counts → `match=TRUE` (matched pairs; Marsh, Wen & Hau 2004).
  Unequal counts → the spike's ruling governs (match=FALSE all-products with disclosure note IF the spike proves WebR ≡ native, else the gesture is blocked for unequal constructs with an explanatory message); ruling recorded in the spike doc.
  Moderation FORCES ML estimation + bootstrap SEs; drawing a moderation edge under WLSMV/ordinal settings is blocked with an explanatory message (recorded limitation).
- Simple slopes: lavaan `:=` defined parameters (slope at −1 SD / mean / +1 SD of the moderator), so estimates AND bootstrap CIs come from the SAME single run.
- Reporting: interaction row(s) in Table 5's Moderation section; NEW simple-slopes figure - WHISKERED CIs at the three levels (no continuous band); NEW conditional-effects table (level | b | SE | p | boot 95% CI) whose numbers are identical to the figure's.
- Figure: app-drawn through the existing pipeline; ships in all exports; the path diagram gains the dashed moderation arrow.
- Export: analysis.R reproduces the indProd + interaction + `:=` model exactly (export ≡ app; runs-in-r native verification).
- Gate: docs/superpowers/reviews/2026-07-06-moderation-spike.md (PRODUCED by the in-flight spike task; citations verified there) must be GREEN for this track before A7 tasks build; RED → owner decides.

## P1 - PLS-SEM full parity

- Integrated measurement table (grouped): construct rows carry ρC (and α), AVE; indicator rows carry Mean, SD, loading (reflective) / weight (formative) in the kept merged column.
- HTMT on-card (same cross-reference note).
- Structural table: same H | Path | estimate | p | Percentile + BC 95% CIs | Result shape (BC hand-rolled z₀-adjusted percentile from seminr's boot matrix, native-R-verified against lavaan's bca.simple on a shared fixture); R²/f² note line; Q² reported under its CURRENT label (this RESOLVES ratify item 3 of 2026-06-21: keep the current label).
- Moderation via seminr `interaction_term` (two_stage; Henseler & Chin 2010) - included IFF the spike proves WebR ≡ native; otherwise recorded as the one parity gap for owner sign-off at ratify.
- Same figure treatments.

## A4 - Citations at point of use (ALL 48 tests)

- One **citation registry** module: per test id → { whyThisTest: 1-2 sentences + 1-2 citations; statisticalBasis: list of {claim, citation} }.
  CITATIONS.txt is GENERATED from this registry (single source of truth, no drift), preserving current content guarantees.
- Config screen: one quiet "Why this test" line under the test title.
- Results card: "Statistical basis" footer + pointer to CITATIONS.txt.
- Citations must match the approved convention docs (2026-06-17 reporting standard, 2026-06-18 SEM convention, and the moderation spike note once produced); the registry consolidates existing attributed claims - no new statistical claims invented.
- PDF/LaTeX exports include the statistical-basis line per test.

## A5 + F1 - Term-led explainers and readability

- **Term-led format** (owner's R² example is normative): `**Statistic**` (bold) → one-sentence meaning → interpretation of THIS run's value with the number woven in (values injected from results).
- **Coverage is machine-checked**: a consistency test enumerates every registry table column key / reported statistic per card and asserts an explainer-registry entry exists (drift-proof).
- **Labelled notes**: explainer/guideline paragraphs longer than ~3 lines become labelled one-liners (Cutoffs / Caution / …); the CB-SEM notes wall is the worked example; treatment sweeps all cards.
- **Readability pass on every screen**; WELCOME_COPY/TERMS_COPY constants byte-unchanged (copy.consistency-pinned) - restructure presentation around the constants if needed, never the constants.
- F1's prose qualities ("no walls", "~3 lines") are OWNER-ACCEPTANCE criteria at the click-through; the machine gate is the coverage test + copy pins.
- APA sentence template stays, filled with live values where it isn't already.

## R1 - Completeness audit (ALL 48 tests; regression family first)

Checklist per card:
1. Every conventional statistic for that test present (committee-proof).
2. Effect size WITH CI everywhere one exists.
3. Assumption checks reported, each with a plain-language verdict.
4. Every reported number reachable by a term-led explainer (A5's coverage test enforces).
5. Citation coverage: test, effect size, thresholds attributed (A4).
6. APA sentence template filled with live values.

Regression family first: simple, multiple (B-vs-β explainer, VIF), logistic (OR explainers, pseudo-R² + caveat, classification table), Poisson/NB (rate ratios, overdispersion → NB rationale).
Audit output: a findings table committed under docs/superpowers/reviews/ BEFORE gap-fix tasks run.
Disposition rule (per owner's completeness delegation): gaps that add a STANDARD, already-conventioned statistic build by default (each native-R-verified); any gap requiring a NEW methodological convention decision is HELD for the owner and listed in the ratify doc; the full findings table with per-finding disposition ships in the ratify doc regardless.

## X1 - Spaced item/column names (carryover fix)

- App: cronbachsAlpha, cfaReliability, runCbSem, runPlsSem item vectors (lvName-class fix applied to items; display names preserved).
- Export: analysis.R read.csv path (make.names mangling) - exported scripts reproduce with spaced headers, runs-in-r-verified.
- Path-analysis observed-column mode included.

## X3 - Benjie's SemCanvas WIP (SEQUENCED BEFORE A7)

Preserved at `benjie-wip-semcanvas-export-fit` (1e71638): latentBounds() content-fitting viewBox (fixes the O6 export clip), viewBox-independent item sides, tests, regenerated 46/47 artifacts.
The landing task runs BEFORE any A7 canvas task (same file): merge/rebase onto the slice branch, run its tests, complete anything missing, land as its own commit crediting the approach - or report precisely why not.

## Exports (cross-cutting)

Every content/format change lands in ALL export formats the same slice: on-screen ≡ PDF ≡ LaTeX ≡ table PNGs ≡ analysis.R output tables.
runs-in-r native verification covers the new emitters (moderation model, dual CIs, grouped/spanned/matrix LaTeX).

## Testing / gate

- TDD throughout; every new statistic native-R-verified (runs-in-r) with worked references.
- Spike gates A7 and P1-moderation per track (GREEN required; RED → owner decides).
- E2e + doc-harness SEM-moderation runs use the 1,000 "quick draft" bootstrap preset (WASM time); the spike records 5k-with-interaction timing so preset time disclaimers stay honest.
- Full gate: tsc/build · test:fast · FULL WebR vitest (0 skipped) · native-R runs-in-r · all 5 Playwright projects · fresh clone.
- Visual baselines WILL change: regenerate via --update-snapshots ONLY at the end; before/after diff set delivered to Benjie for approval at his gate.
- Per-test docs: A4/A5 change EVERY card's output and config screen → the regen sweep covers ALL 48 cards (~700+ files incl. 1-input-config shots; budgeted as its own task), which also replaces the stale pre-fix 46/47 screenshots.
- E2e: new journeys for moderation (draw → run → slopes figure asserted) and at least one citation-footer + explainer assertion on an ordinary card.

## Acceptance (owner)

Benjie's click-through: CB-SEM with moderation on the spike dataset, PLS with interaction, one regression, one t-test; boards vs reality; baseline diffs approved; then his separate deploy/push words.
