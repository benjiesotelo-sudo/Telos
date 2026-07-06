# Slice 5 "Citable & Complete" - Design Spec

Owner-approved 2026-07-06 via the visual decision boards (comparison → side-by-side → master board → A7 moderation → charter → complete board).
Reference paper: Huang et al. (2026), *Journal of Hospitality and Tourism Insights*, JHTI-08-2025-0939 (Benjie's sample; its Tables 2/3/4 + Figures 2/3 are the format anchors).
Decision ledger of record: the "complete board" artifact, restated normatively here.

## Goal

Every test in Telos reports completely, reads intuitively, and is citable at the point of use - so a student can lift methods text, numbers, and references straight into a thesis without leaving the app, and the SEM cards match or beat the reporting craft of a published Emerald paper.

## Rulings of record (who decided what)

- A1-A7, P1, R1, F1: Benjie (boards approved 2026-07-06; moderation ruled IN, deadline explicitly unhooked: quality over speed).
- H-numbering detail, X2 push, X3 WIP handling: delegated to Claude, resolutions recorded below.
- Held (NOT this slice): multigroup analysis, model comparison, Johnson-Neyman intervals, deploy (owner's separate word), editable hypothesis labels (fast-follow).

## A6 - Table craft (renderer upgrade; build FIRST, everything else renders through it)

The ApaTable renderer learns three devices, spec'd from the paper's typesetting:

1. **Grouped section rows**: a row may be a group header (italic, carries group-level stat columns once) with indented child rows beneath.
   Used by: SEM measurement tables (construct row carries ω/α/CR/AVE; items indented), any future grouped table.
2. **Spanning column headers**: a two-level header where a label spans 2+ subcolumns (e.g. "Percentile 95% CI" over Lower/Upper beside "BCa 95% CI" over Lower/Upper).
3. **Internal section labels**: an italic full-width label row inside the body (e.g. "Direct paths" / "Indirect effects" / "Moderation").

Constraints:
- APA numeric style preserved (2-decimal, leading-zero-stripped for bounded stats, tabular-nums, right-aligned numerics).
- LaTeX, table-PNG, and PDF exports render the same structures (multirow/multicolumn in LaTeX; the export emitters share the column/row model).
- Existing flat tables render byte-identically unless a card opts into the new devices (no global reflow of the other 40 cards' tables except where R1/A5 change content).
- This unlocks the deferred MANOVA/MANCOVA "Option A spanning transpose" - NOT built this slice, but the renderer capability must not preclude it.

## A1+A2+A3 - CB-SEM card content (Track A convention unchanged underneath)

Table numbering below is the CANONICAL post-slice card layout:

- **Table 1. Descriptive statistics, measurement model, and reliability** (merges old Tables 1-2).
  Grouped: construct rows (italic) carry ω, α, CR, AVE once; item rows carry Mean, SD, B, SE, Std. loading.
  z and p per item move to an expandable/secondary presentation if space demands, but must remain available (JARS both-metrics stays).
  Item Mean/SD computed from the analysis sample (listwise N used by the fit).
- **Table 2. Fit indices** - unchanged set: χ²(df, p), χ²/df, CFI, TLI, RMSEA [90% CI], SRMR.
- **Table 3. Discriminant validity - Fornell-Larcker**: latent correlation matrix, √AVE italic on the diagonal, significance stars on off-diagonal correlations (*p<.05, **p<.01, ***p<.001 note line).
  This fully replaces the paper's Table 3 (their "correlations + √AVE" table IS this).
- **Table 4. Discriminant validity - HTMT** (≤ .85 note; stays primary criterion per approved convention).
  Under Tables 3-4, one note: "Discriminant validity also has its own card (AVE / convergent validity); it is included here so one run gives the complete measurement-model writeup." (Owner's phrasing preserved in spirit; exact copy in the plan.)
  The AVE card KEEPS its tables (both homes).
- **Table 5. Structural paths, indirect effects, and moderation** (merges old Tables 4-5; spanned headers).
  Columns: H | Path | B | Std. β | p | Percentile 95% CI (Lower/Upper) | BCa 95% CI (Lower/Upper) | Result.
  Section labels: Direct paths / Indirect effects / Moderation (each present only when applicable).
  H-IDs auto-assigned in path-draw order (H1, H2, …); indirect and interaction rows continue the sequence.
  Result column: "Supported" / "Not supported", derived ONLY from the CI excluding zero at the user's α (default .05); never hand-set.
  BCa CIs computed from the SAME single bootstrap run as percentile (no second bootstrap); bootstrap default stays 5,000 (presets/custom/progress unchanged).
  R² per endogenous construct in a note line under the table.

## A7 - Latent moderation (CB-SEM)

- Canvas gesture: in Draw mode, clicking a construct then an EXISTING path (its midpoint handle) creates a moderation edge; rendered as a dashed clay arrow from moderator to the path midpoint, labeled on hover/selection; Delete tool removes it like any path.
  Guards: no self-moderation (moderator ≠ source/target), no duplicate moderation on the same path by the same moderator, path-analysis (observed-only) mode allowed with observed product terms only if the spike proves it - otherwise latent mode only this slice (spike verdict governs; spec amendment recorded post-spike).
- Statistics: double-mean-centered product indicators via semTools::indProd (match=TRUE), latent interaction construct, ML estimation; convention doc: docs/superpowers/reviews/2026-07-06-moderation-spike.md (citations: Marsh, Wen & Hau 2004; Lin, Wen, Marsh & Lin 2010; simple slopes: Aiken & West 1991).
- Reporting: interaction row(s) in Table 5's Moderation section; NEW simple-slopes figure (focal → outcome at −1 SD / mean / +1 SD of the moderator, bootstrap CIs shaded/whiskered); NEW conditional-effects table (level | b | SE | p | boot 95% CI).
- Figure: app-drawn through the existing ggplot2/captureNode pipeline; ships in all exports; path diagram gains the dashed moderation arrow.
- Export: analysis.R reproduces the indProd + interaction model exactly (export ≡ app; runs-in-r native verification required).

## P1 - PLS-SEM full parity

The PLS card mirrors every element in Hair et al. (2019) terms:
- Integrated measurement table (grouped): construct rows carry ρC (and α), AVE; indicator rows carry Mean, SD, loading (reflective) / weight (formative), with the merged "Loading / weight" column convention kept.
- HTMT table on-card (same cross-reference note).
- Structural table: same H | Path | estimate | p | dual bootstrap CI | Result shape; R²/f² note line; Q² as currently reported.
- Moderation via seminr interaction_term (two_stage; Henseler & Chin 2010) - included IFF the spike proves WebR ≡ native R; otherwise recorded as the one parity gap with owner sign-off at ratify.
- Same figure treatments (path diagram; simple slopes for PLS moderation from the estimated model).

## A4 - Citations at point of use (ALL 48 tests)

- One **citation registry** module: per test id → { whyThisTest: 1-2 sentences + 1-2 citations; statisticalBasis: list of {claim, citation} }.
  Single source of truth: CITATIONS.txt export is GENERATED from this registry (no drift), preserving its current content/format guarantees.
- Config screen: one quiet "Why this test" line under the test title (copy + citation from registry).
- Results card: "Statistical basis" footer (compact citation line naming reporting standard, thresholds, effect sizes, per-test methods) + pointer to CITATIONS.txt in exports.
- Citations must match the approved convention docs (2026-06-17 reporting standard, 2026-06-18 SEM convention, moderation spike note); no new statistical claims invented - every threshold/choice already has its citation in those docs; the registry consolidates them.
- PDF/LaTeX exports include the statistical-basis line per test.

## A5 + F1 - Term-led explainers and readability (ALL 48 tests + all screens)

- **Term-led explainer format** (owner's R² example is normative):
  `**Statistic**` (bold) → one-sentence meaning → interpretation of THIS run's value with the actual number woven in (values injected from results).
  Every statistic a card reports must be reachable by an explainer entry; the "How to read this test" prose converts to this format.
- **Labelled notes**: any explainer/guideline paragraph longer than ~3 lines becomes labelled one-liners (Cutoffs / Caution / Which tables / …) - the CB-SEM notes wall is the worked example; the same treatment sweeps all cards.
- **Readability pass on every screen** (Welcome, Guide, Configure data, Pick tests, Test config, Results): no unbroken multi-sentence walls; WELCOME_COPY/TERMS_COPY constants remain byte-unchanged (spec-pinned by copy.consistency test) - if their rendering needs reflow, restructure presentation around the constants, not the constants.
- APA sentence template stays, filled with live values where it isn't already.

## R1 - Completeness audit (ALL 48 tests; regression family first)

Checklist per card (audit finding → gap-fix task):
1. Every conventional statistic for that test present (committee-proof).
2. Effect size WITH CI everywhere one exists.
3. Assumption checks reported, each with a plain-language verdict.
4. Every reported number reachable by a term-led explainer (A5).
5. Citation coverage: test, effect size, thresholds attributed (A4).
6. APA sentence template filled with live values.

Regression family named first (owner's complaint): simple, multiple (incl. B-vs-β explainer, VIF), logistic (OR explainers, pseudo-R² with caveat, classification table), Poisson/NB (rate ratios, overdispersion → NB rationale).
Audit output: a findings table committed under docs/superpowers/reviews/ before gap-fix tasks run; stats engine changes ONLY where the audit finds a missing conventional statistic (each new stat native-R-verified like all others).

## X1 - Spaced item/column names (carryover fix)

Item/CSV-column names with spaces (or other non-identifier characters) must work end-to-end:
- App: cronbachsAlpha, cfaReliability, runCbSem, runPlsSem item vectors (same lvName class of fix, applied to items; display names preserved in tables).
- Export: analysis.R read.csv path (make.names mangling) - exported scripts must reproduce with spaced headers (backtick/quote or rename strategy, runs-in-r-verified).
- Path-analysis observed-column mode included.

## X3 note - Benjie's SemCanvas WIP

Preserved at branch `benjie-wip-semcanvas-export-fit` (1e71638): latentBounds() content-fitting viewBox (fixes O6 export clip), viewBox-independent item-side selection, tests, regenerated 46/47 doc artifacts.
This slice EVALUATES landing it (it touches the same file as A7): a build task rebases/merges it onto the slice branch, runs its tests, completes anything missing, and lands it as its own commit crediting the approach - or reports precisely why not.

## Exports (cross-cutting)

Every content/format change lands in ALL export formats the same slice: on-screen ≡ PDF ≡ LaTeX ≡ table PNGs ≡ analysis.R output tables (where applicable).
runs-in-r native-R verification covers the new emitters (moderation model, dual CIs, grouped tables' LaTeX).

## Out of scope

Multigroup SEM, model comparison tables, Johnson-Neyman, editable H-labels (fast-follow), any stats-engine change not demanded by the R1 audit, visual theme changes beyond table craft, deploy.

## Testing / gate

- TDD throughout; every new statistic verified against native R (runs-in-r) with worked references.
- Spike gates A7/P1-moderation: docs/superpowers/reviews/2026-07-06-moderation-spike.md must be GREEN per track before those tasks build; RED → owner decides (ship slice without that track's moderation + record, or hold).
- Full gate: tsc/build · test:fast · FULL WebR vitest (0 skipped) · native-R runs-in-r · all 5 Playwright projects · fresh clone.
- Visual baselines WILL change (tables reshape): regenerate via --update-snapshots ONLY at the end, with a before/after diff set delivered to Benjie for approval at his gate (baseline protocol honored, not bypassed).
- Per-test docs: regenerate at slice end for every card whose output changed (46/47 currently show pre-fix empty columns; the sweep fixes those too).
- E2e: new journeys for moderation (draw → run → slopes figure asserted) and at least one citation-footer + explainer assertion on an ordinary card.

## Acceptance (owner)

Benjie's click-through: run CB-SEM with moderation on the spike dataset, PLS with interaction, one regression, one t-test; verify the boards match reality; approve baseline diffs; then his separate deploy/push words.
