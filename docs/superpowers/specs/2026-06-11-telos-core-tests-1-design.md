# Telos Core Tests — Slice 1 (7 tests) — Design

**Date:** 2026-06-11 · **Status:** design approved in session (Benjie: sections 1–3 explicitly, 4–5 delegated "I trust your judgement"); doc review pending
**Scope ruling (Benjie):** the first bite of the remaining 45 tests = **t-test siblings + descriptives, 7 tests**: Summary statistics · Frequencies & cross-tabs · Distribution & normality · One-sample t-test · Paired t-test · Mann-Whitney U · Wilcoxon signed-rank.
**Architecture ruling (Benjie):** **Approach A — shared chassis, per-test builders.** Generic where cards are alike, hand-written exactly where the spec is specific.

## Goal

Light up 7 more tests in the finished shell, end-to-end: picker → drag-slot config → run → faithful card-spec output → export. First real exercise of **multi-test selection** (several config steps, combined NN-ordered results page, multi-folder zip). Every card's content encoded verbatim from `telos_test_outputs.html` + `telos_test_inputs.html` with card-scoped equality consistency tests (mutation-proven), exactly like the t-test's.

## Extraction facts that drive the design (verified against the spec HTML)

- Cards are methodologically precise; **zero open stats questions**. Normality = Shapiro-Wilk (`shapiro.test`, 3–5000 cases) + K–S/Lilliefors (`nortest::lillie.test`). Nonparametric effect size = rank-biserial r (`effectsize::rank_biserial`), standardized Z via `coin`. Paired effect size = d_z. One-sample/Independent = d.
- Shape variety: one-table cards with bare "Table." captions (Summary, Distribution); two-figure card (Distribution: histogram + Q–Q); optional figure (Summary); dynamic-width cross-tab with n + row% + col% cells (Frequencies); rank-summary first tables (Mann-Whitney by group; Wilcoxon split by sign Positive/negative/ties); polymorphic statistic labels ("Statistic" = W or D; "V / W").
- New input shapes: One-sample's **typed scalar option μ₀** (default 0, feeds Table 2's "Test value" column + the figure's reference line); Paired/Wilcoxon's **two same-type measurement roles** (Condition A/B — wide data); Frequencies' **one slot, arity 1–2** (second column switches frequency table → cross-tab); Summary's **"one or more" multi-column slot + optional "0 or 1" Group-by** (group-by adds a Group column and repeats stats per group).
- Option vocabulary: descriptive cards have no α/tails/CI; nonparametric cards swap CI/equal-variance for **continuity correction (drawn on)**.
- Table notes vary: `assume` note (One-sample: normality reported under descriptives; Paired: normality of difference scores), plain note (Summary, Frequencies, Distribution, Mann-Whitney), **none** (Wilcoxon).
- **Faithfulness item flagged to Benjie:** the Wilcoxon card's APA line reports only Z, p, r — omitting the V/W statistic its own Table 2 shows. Built as drawn (his locked card).
- Cross-file family ordering differs between the two spec files; per-card consistency tests slice each file by its own card boundaries (`<div class="rtest">`/`rt-name` in outputs; `<div class="config">`/`ttl` in inputs), so the mismatch is harmless.

## Design

### 1 · Registry extensions (backward-compatible; the t-test entry is untouched)

- `figures: FigureSpec[]` (list; `optional?: true` for Summary's histogram). **Decided:** the t-test entry keeps its existing `figure` field untouched (its locked consistency tests assert it); new entries use `figures`; `TestSpec` carries both as optional with exactly one present, and a tiny `figuresOf(spec)` accessor normalizes for the chassis/builders.
- `RoleSpec`/`RoleConstraint` arity becomes a range: `{ min, max }` (exactly-1 = {1,1}; "one or more" = {1, ∞}; "0 or 1" = {0,1}; "1 to 2" = {1,2}).
- `OptionSpec` gains `kind: 'display' | 'toggle' | 'number'`. Interactive this slice: **μ₀ (number, default 0)** and **continuity correction (toggle, default on)** — same precedent as the R3 equal-variance ruling. α/tails/CI/descriptive pills stay `display` (controls deferred to the options pass, as recorded in slice 2).
- `TableSpec` gains caption style (numbered "Table N." vs bare "Table.") and a `note` slot: `{ kind: 'assume' | 'plain', text } | none` (Wilcoxon: none, rendered as none).
- Per-test wiring maps: `RUNNERS: Record<id, (engine, ds, setup) => Promise<Result>>` and `BUILDERS: Record<id, (spec, result) => CardContent>`; the store's run loop walks these instead of hardcoding the t-test.
- 7 new registry entries + 7 card-scoped consistency tests (outputs + inputs assertions each, mutation checks per the established discipline).

### 2 · Stats modules (src/lib/stats/, one per test)

R functions exactly per each card's R-map line. Typed results per test. Known-answer tests for every number in every table, **both positions of every toggle** (continuity correction on/off; μ₀ varied), all values independently recomputed in native R before being baked into tests. Missing data per card's natural unit under the global R2 policy: complete pairs (Paired, Wilcoxon — excluded count reported), single-column drop (One-sample, Distribution), per-variable N (Summary), present-category counting (Frequencies). Shapiro-Wilk outside 3–5000 → em-dash row with reason; K–S still reports. Figures all ggplot2 via the existing capturePlot: boxplot, paired-lines/difference, histogram + μ₀ reference line, histogram + Q–Q, per-variable histograms (optional), bar/grouped bar.

**Pre-build validation MUST empirically confirm `nortest`, `coin`, `effectsize`, `janitor` install and run under WebR** (repo.r-wasm.org), like ggplot2 did. Any that fail get a base-R equivalent computing the identical statistic, recorded as a deviation for Benjie.

### 3 · UI generalization

- `ResultPreviewCard` becomes the **chassis**: renders `CardContent` = `{ tables: {spec, rows}[], note?, figures: {caption, png}[], howToRead, apa }` with the locked typography conventions. The t-test re-expressed as the first builder — output pixel-identical (existing e2e numbers must not change).
- Cross-tab dynamic columns: the Frequencies builder constructs the column list from the data (`Row \ Column · <categories…> · Total`; cells "n (row% / col%)"); `ApaTable` already renders arbitrary columns.
- Drag-slots: multi-chip slots for {1,∞} and {1,2} arities (chips individually removable), "(optional)" tag for {0,1}, helper line under Frequencies' slot in the card's words (second column → cross-tab).
- Option strip by kind: display pills unchanged; toggle = the equal-variance pattern; number = labeled input (μ₀) with the card's set-it warning.
- Gates: test step complete = every role's arity minimum satisfied; optional slots never block. Back-edit invalidation unchanged (slot-by-slot revalidation already generalizes).
- Results page: already NN-ordered, per-test errors isolated, `NN_<id>/` zip folders from each card's bundle line. Optional figures simply absent when not produced.

### 4 · Eligibility generalization

Constraints use the arity ranges; nonparametric outcome slots accept ordinal (per cards). Per-test min-data rules from the cards: ≥3 complete pairs (Paired, Wilcoxon), ≥3 per group (Mann-Whitney, same DRAFT rule as the t-test), N≥3 single column (One-sample, Distribution — Shapiro lower bound), ≥1 usable numeric column (Summary), ≥1 usable categorical column (Frequencies). Candidate search generalizes from the t-test's pair brute-force to per-role candidate sets with disjoint assignment across roles. Same honest reason-string discipline, picker + slots.

### 5 · Testing & verification

- Consistency: 7 cards × both files, equality + mutation checks.
- Unit: known-answer stats (native-R verified), builder row-shaping tests (incl. cross-tab width, sign-split rows, μ₀ cell), gate tests for new arities, chassis render of each shape.
- E2E: existing single-test journey must stay green untouched; NEW multi-test journey — select two tests (one descriptive + one paired), walk both config steps, combined results page, zip with `01_…/` + `02_…/` folders asserted by unzip.
- Pre-build validation workflow: WebR package spikes (the four new packages), known-answer replays, consistency regexes against the real HTML, chassis/builder compile + sandbox replay of the lib layer. Plan amendments recorded, then subagent-driven execution with per-task dual review (the established regimen).
- End gate: rendered screenshots + Benjie's click-through before any push/deploy (his calls).

## Deferred (recorded, not drift)

The remaining 38 tests (ANOVA family next per sequence); report/export formats (PDF/LaTeX/R script); α/tails/CI and descriptive-pill controls; SEM canvas; analytics; feedback URL.
