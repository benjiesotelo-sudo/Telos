# Telos Dogfood Audit — Severity-Ranked Findings

**Scope:** All 29 live tests across 5 families (Descriptive, Group comparisons/core tests, ANOVA, Association, Regression), each driven through 1–3 realistic scenarios on real fixtures against the production preview, plus a shell/journey pass. **Coverage:** 29 tests driven; 57 of 136 raw findings confirmed after adversarial verification. **Screenshots:** `/tmp/telos-audit/shots/<test-id>/` and `/tmp/telos-audit/shots/_shell/`. **Headline:** 0 blockers · 6 majors · 38 minors · 13 polish. **Nothing has been fixed, pushed, or deployed — this is for your triage.**

---

## Blockers

None. No finding corrupts a computed statistic, crashes a session, or blocks the journey end-to-end.

---

## Majors (6)

These are write-up-correctness errors: a thesis student copying the rendered APA sentence verbatim would submit a false or mismatched statistical claim. All six are in the APA/output layer, not the numbers — the tables and computations are correct.

### M1. APA sentence asserts "significant" regardless of the actual p-value
**Tests:** `chi-square-independence`, `factorial-anova`, (and the same hardcode pattern in `welch-anova` — see note). **Evidence:** `/tmp/telos-audit/shots/chi-square-independence/s1.png` (p=.086) & `s2.png` (p=.057); `/tmp/telos-audit/shots/factorial-anova/s1.png` (interaction p=.093).
**What's wrong:** The `apaTemplate` strings bake in outcome language — "A chi-square test of independence **was significant**…", "A two-way ANOVA found a **significant** A×B interaction…" — with no significance branch in the builder. In every driven scenario these tests landed non-significant, so the APA sentence directly contradicts the p-value printed one line above it.
**Why it matters:** This is the exact harm Telos exists to prevent — a student pastes "was significant, χ²(2)=4.90, p=.086" into their thesis and reports a false positive.
**Fix:** Branch in the builder on `r.p` vs `alpha` (default 0.05): substitute "was not significant" / "found no significant…" when `p ≥ alpha`. Note: the spec HTML itself hardcodes "significant," so the spec card needs the same correction.
**Triage note:** `welch-anova` ("found an effect of group" at p=.089) shares this pattern but the verifier downgraded it to minor because (a) it is spec-faithful and (b) a true fix is a cross-cutting policy decision across all ~47 templates. Your call whether to treat the "significant"-assertion family as one policy fix or as targeted per-test fixes.

### M2. Factorial ANOVA: APA reports the wrong row and wrong wording when interactions are OFF
**Test:** `factorial-anova`. **Evidence:** `/tmp/telos-audit/shots/factorial-anova/s2.png`.
**What's wrong:** Two compounding bugs. (1) With interactions toggled OFF there is no `×` row, so `buildFactorialAnova.ts` line 19 falls back to `r.rows[r.rows.length - 1]` — the **last** row (gender, the secondary factor), silently skipping the primary `group` factor. (2) The template still says "found a significant A×B interaction" even though no interaction term was modeled. Result in s2: "…significant A×B interaction, F(1,56)=2.70, p=.106…" — those are gender's numbers, labeled as an interaction.
**Why it matters:** A student fitting an additive model gets an APA sentence claiming an interaction that does not exist and reporting the wrong factor's statistic; their primary research question (`group`) is omitted from the write-up.
**Fix:** When the interaction row is absent, use a main-effects template branch and anchor to the first factor row (or lowest-p row), not the last.

### M3. MANOVA: APA reports Pillai values when Wilks is the selected statistic, with no disclosure
**Test:** `manova`. **Evidence:** `/tmp/telos-audit/shots/manova/s2.png`.
**What's wrong:** In the Wilks scenario, Table 1 correctly shows Wilks (0.72, F=5.11, df2=112, p<.001), but the APA sentence reads "Pillai's V=0.29, F(4,114)=4.74, p=.001." All five values differ from the table the student just read. This is by design ("APA always from Pillai" — recorded decision 1 in `buildManova.ts`), but there is **zero in-card disclosure** of the convention.
**Why it matters:** A student who selects Wilks, reads Table 1, and copies the APA sentence reports Pillai statistics while claiming a Wilks test — an internally contradictory write-up.
**Fix:** Either add a one-line note ("APA reports Pillai's trace, the most robust statistic, regardless of the table selection"), or make the APA template reflect the selected statistic.

### M4. Repeated-measures ANOVA: APA always says "(GG-corrected)" even when sphericity = none
**Test:** `repeated-measures-anova`. **Evidence:** `/tmp/telos-audit/shots/repeated-measures-anova/s2.png`.
**What's wrong:** The F/df are correctly uncorrected when the user picks sphericity=none (df 2 / 118), but the hardcoded apaTemplate still reads "A repeated-measures ANOVA **(GG-corrected)** found an effect of condition, F(2,118)=78.51…". The correction label never reflects the user's choice.
**Why it matters:** A student who explicitly opted out of correction copies a sentence misreporting their method as Greenhouse–Geisser corrected.
**Fix:** Parameterize the parenthetical on the sphericity choice: GG → "(GG-corrected)", HF → "(HF-corrected)", none → "(uncorrected)" or omit. (The related "Mauchly table still shows when none is selected" observation is informative-only, not a bug — the real defect is this label.)

### M5. One-way ANOVA: APA hardcodes "Tukey" regardless of the selected post-hoc method
**Test:** `one-way-anova`. **Evidence:** `/tmp/telos-audit/shots/one-way-anova/s2.png`.
**What's wrong:** The post-hoc table correctly switches to Bonferroni (padj capped at 1.000, wider CIs) when selected, but the APA sentence still ends "…**Tukey** post-hoc tests showed…". The template has no `{posthoc}` placeholder.
**Why it matters:** A student selecting Bonferroni or Scheffé copies a sentence naming the wrong correction method. Note: the spec HTML also hardcodes Tukey, so the spec is wrong here too.
**Fix:** Interpolate the selected post-hoc method name into the template.

### M6. Nested ANOVA: table note describes random-nesting error structure even when fixed nesting is selected
**Test:** `nested-anova`. **Evidence:** `/tmp/telos-audit/shots/nested-anova/s2.png`.
**What's wrong:** The static note ends "…so the two F rows do not share the same denominator." That is true only for random nesting. The computation correctly switches under fixed nesting (school F changes 1.48→2.95; both rows now use the residual), but the note is unconditional, so a fixed-nesting user reads a denominator description that is the opposite of what their output did.
**Why it matters:** A student reads a note contradicting their own F-ratio construction — directly misleading for the assumption they just configured.
**Fix:** Make the note conditional on the nesting option (random vs fixed error-term explanation).

---

## Minors (38)

Grouped by theme. The single biggest cluster is the cross-cutting "How to read / APA prose loses rich formatting" issue — see **Cross-cutting** below; it is listed once there rather than repeated per test.

### APA number formatting

- **`p<.001` rendered without spaces around the operator** — `paired-t-test`, `friedman`, `one-sample-t-test` (and systemically every builder that calls `fp()`: chi-square GoF/independence, Welch ANOVA, RM-ANOVA, Wilcoxon, Fisher's, one-way ANOVA — see Cross-cutting). APA 7 requires `p < .001`. Evidence: `/tmp/telos-audit/shots/paired-t-test/s1.png`, `/tmp/telos-audit/shots/friedman/s1.png`, `/tmp/telos-audit/shots/one-sample-t-test/s2.png`. Fix: change `fp()` to return `'< .001'` and the APA substitution to `'p < .001'`. *(Note: for in-table cells the no-space `<.001` is the accepted house style and was refuted — the fix is for the running APA sentence only.)*
- **Leading zero not dropped for bounded statistics** — `distribution-normality` (W, D: "W 0.96", "W = 0.96") and `one-way-anova` (η²: "0.09" while p is correctly ".069"). APA 7 §4.31/§7.36 drops the leading zero for stats that can't exceed 1.0. Evidence: `/tmp/telos-audit/shots/distribution-normality/s1.png`, `/tmp/telos-audit/shots/one-way-anova/s1.png`. Fix: add an `f01`/effect-size formatter and apply it to W, D, η², ω², R², etc. *(Distinct from the MANOVA "0.09" item, which was refuted — there the zeros are present and correct.)*

### Sign / value correctness in tables

- **Games-Howell post-hoc M_diff sign inverted vs Tukey for identical pairs** — `welch-anova`. control−drug_a shows −1.37 in one-way ANOVA but +1.37 in Welch; CIs swap correspondingly. Root cause: `rstatix::games_howell_test()` defines `estimate` as `mean(group2)−mean(group1)`, but the pair label is built `group1 − group2`. Evidence: `/tmp/telos-audit/shots/welch-anova/s1.png` vs `/tmp/telos-audit/shots/one-way-anova/s1.png`. Fix: flip the sign so the displayed M_diff matches the label order.
- **Intercept OR truncates to 0.00** — `logistic-regression`. exp(−6.59)≈0.00137 → "0.00", CI lower also 0.00, indistinguishable from a degenerate model. Evidence: `/tmp/telos-audit/shots/logistic-regression/s1.png`. Fix: switch to `<0.01` or scientific notation when `|or| < 0.01`. *(The large-OR / wide-CI intercept items were refuted as mathematically correct.)*
- **SE rounds to 0.00** — `poisson-negative-binomial`. age SE=0.004920 → "0.00", making the row look internally inconsistent (z=2.69 with SE 0.00). Evidence: `/tmp/telos-audit/shots/poisson-negative-binomial/s1.png`. Fix: use 3-decimal or scientific fallback for SE. *(Lower-impact: z and p in the same row signal a valid significant result.)*

### Wrong/mismatched labels & templates

- **Mixed ANOVA APA hardcodes "time" while Table 2 says "Condition"** — `mixed-anova`. APA: "group × time"; table: "group × Condition". Evidence: `sect_top.png` / `sect_bot.png`. Fix: interpolate the actual within-factor name (or use "condition" to match).
- **Mixed ANOVA Source column casing: "group" vs "Condition"** — `mixed-anova`. Between-factor echoes the raw lowercase column name; within-factor is title-cased. Spec ghost rows use "Group". Evidence: `sect_top.png`. Fix: normalize casing in the stats runner.
- **Mixed ANOVA appends a Levene parenthetical not in the spec** — `mixed-anova`. "(Levene on subject means F=0.60, p=.553)" is dynamically appended after the sphericity sentence with no label. Evidence: `sect_mid.png`. Fix: either add it to the approved spec or remove it; if kept, label it as a between-groups check.

### Layout / placement

- **Inter-table note rendered after all tables instead of in its spec position** — `ancova` (note belongs between Table 2 and Table 3) and `repeated-measures-anova` (note belongs between Table 3 and Table 4; its own text says "post-hoc table follows," which is backwards once it trails Table 4). Evidence: `/tmp/telos-audit/shots/ancova/s1.png`, `/tmp/telos-audit/shots/repeated-measures-anova/s1.png`. Cause: `ResultPreviewCard.tsx` line 27 renders the note after the tables `.map()`. Fix: add a `noteAfterTableId`/`noteAfterIndex` field so the note renders inline after the anchored table.
- **Factorial ANOVA Table 2 title keeps "+ interaction" when interactions are OFF** — `factorial-anova`. Title promises an interaction row the table doesn't show. Evidence: `/tmp/telos-audit/shots/factorial-anova/s2.png`. Fix: drop "+ interaction" from the title when the toggle is off.
- **Factorial ANOVA interaction figure + "Interaction" caption persist when interactions are OFF** — `factorial-anova`. Same crossing-lines plot and caption render even though no interaction was modeled. Evidence: `/tmp/telos-audit/shots/factorial-anova/s2.png`. Fix: suppress/replace the figure and caption in the main-effects-only branch.

### Figures

- **Histogram bars all identical height (y=1.00); distribution shape invisible** — `distribution-normality`. `geom_histogram(bins=30)` on N≈14 over range ~22 puts ≤1 obs per bin, so every bar is count=1. Evidence: `s1.png`, `s2.png`. Fix: use `nclass.Sturges(x)` (as `oneSampleTTest.ts` already does) instead of a hardcoded 30. *(Lower-impact: the "How to read" text directs the user to the Q–Q plot, which renders correctly.)*
- **Profile plot clips the lower CI whisker for the first condition** — `repeated-measures-anova` (also visible on one-way & Welch lowest-mean groups). The y-axis floor sits above the true lower CI bound, so the whisker cap is hidden, making the first condition's uncertainty look smaller. Evidence: `s1.png`/`s2.png`. Fix: add `coord_cartesian(ylim=…)` padding to the shared `geom_pointrange` figure.
- **Two figures share the identical caption "Figure. Fit & residuals"** — `simple-linear-regression`. The fitted-line scatter and the residual-diagnostic panel are indistinguishable by caption. Evidence: `/tmp/telos-audit/shots/simple-linear-regression/s1.png`. Fix: append a disambiguating suffix (the registry already has separate `fit`/`residuals` keys).

### Table display / readability

- **Wilcoxon: Sum-of-ranks shows "0.00" while Mean rank shows "—" for N=0 rows** — `wilcoxon-signed-rank`. Mixed em-dash/zero in the same empty-group row looks inconsistent. Evidence: `/tmp/telos-audit/shots/wilcoxon-signed-rank/s1.png`. Fix: guard `sumRanks` with the same `n===0 → '—'` rule. *(Mathematically correct as-is; this is a UX-consistency ruling for you.)*
- **`chisq.test()` / `correct=FALSE` rendered as plain prose, not monospace** — `chi-square-independence`. Spec wraps them in `<code>`. Evidence: `/tmp/telos-audit/shots/chi-square-independence/s1.png`. Fix: support an inline-code/HTML note kind. *(Related to the cross-cutting prose-formatting issue.)*
- **Independent t-test: "welch test" not capitalized** — `independent-t-test`. Assumption note reads "(Levene F=0.38, p=.550 · welch test)"; "Welch" is a proper name. Evidence: `/tmp/telos-audit/shots/independent-t-test/s1.png`. Fix: capitalize at the display layer.

### Shell / journey

- **Sticky stepper overlaps card content on scroll** — `shell` and `distribution-normality` (taller two-variable card). `position:sticky; top:0; z-index:20` with only 24px `<main>` padding-top, so the stepper paints over the export bar, card eyebrow, and table-note rows. Evidence: `/tmp/telos-audit/shots/_shell/sticky-overlap-200.png`, `sticky-overlap-300.png`, `/tmp/telos-audit/shots/distribution-normality/s2.png`. Fix: add `scroll-padding-top`/clearance equal to the stepper height (~57–64px).
- **Welcome promises "PDF, R script, figures" but those rows are disabled** — `shell`. Export bar shows PDF/LaTeX/R script as "(coming in a later slice)"; only PNG tables/figures are live. Evidence: `/tmp/telos-audit/shots/_shell/01-welcome.png`, `07-export-crop.png`. **Known B-list item, owner-decided copy.** Fix: qualify the Welcome copy or badge the disabled rows.
- **Feedback link points at a placeholder URL** — `shell`. `href` is `…/forms/REPLACE_WITH_YOUR_FORM`. Evidence: `/tmp/telos-audit/shots/_shell/10-feedback-scrolled.png`. **Known, tracked pre-launch item.** Fix: wire the real form ID or hide the section.
- **Pick-test intro is DRAFT developer prose** — `shell`. Renders "registry-defined · DRAFT — confirm…", "arity", "registry-defined" to students. Evidence: `/tmp/telos-audit/shots/_shell/05-pick-test-top.png`. Fix: replace with plain-language copy.

---

## Polish (13)

Low-impact cosmetic/clarity items; safe to defer.

- **"How to read" key terms not bold / APA symbols not italic** — the spec wraps key terms (mean, median, SD, p, r, R², β, F, etc.) in `<b>`/`<i>`; the app renders prose as plain text. Confirmed individually on `summary-statistics`, `one-sample-t-test`, `repeated-measures-anova`, `simple-linear-regression`, `multiple-linear-regression`, `logistic-regression`, and others. **This is one cross-cutting issue — see below.**
- **APA label reads "APA:" instead of "APA template:"** — `frequencies-crosstabs` (global, `ResultPreviewCard.tsx` line 37). The shortened, un-bold label could read as a completed citation rather than a fill-in template.
- **APA paragraph lacks visual separation/label styling** — `repeated-measures-anova`. "APA:" is inline plain text under the "How to read" prose, so the most copyable output doesn't read as a distinct element.
- **"Table." / "Figure." caption labels bold-only, not bold-italic** — `pearson`. Spec CSS sets them italic; app omits italic. APA convention is bold-italic.
- **Configure-data helper text "disabled until every used column has a level" shows even when the button is enabled** — `shell`. False-signal hint. Fix: conditional render. *(The "misaligned" part of the original finding was a misread; alignment is correct.)*
- **Terms guide references "step 4a"** — `shell`. No "4a" sub-step exists in the UI; dangling developer shorthand. Fix: reference "the Configure data step".

---

## Cross-cutting vs per-test (highest leverage)

Three issues recur across many tests; fixing the shared code path resolves them everywhere at once:

1. **"How to read" / APA prose loses all rich formatting (bold, italic, subscript).** The spec authors bold key terms and italic statistical symbols (and `rₛ`, `d_z` subscripts) throughout; `howToRead`/`apa` are typed `string` and `ResultPreviewCard.tsx` lines 36–37 render them as plain text nodes. Confirmed on **~10+ tests**, and the architecture means it affects **all ~47**. The consistency tests `strip()` HTML before comparing, so they pass while silently dropping the markup. **Leverage:** one renderer change (sanitized HTML or a tiny markdown/italic pass) + registry markup fixes every card. *Severity is minor/polish — the text is fully readable and students re-format in Word/LaTeX anyway — but it is the single largest cluster.*

2. **`p<.001` missing spaces in the running APA sentence.** The same `fp()`/`'p<.001'` hardcode is in **every builder** (paired-t, friedman, one-sample, chi-square GoF/independence, Welch ANOVA, RM-ANOVA, Wilcoxon, Fisher's, one-way ANOVA). One `fp()` change fixes the APA-sentence case across all of them. (In-table `<.001` is accepted house style and stays.)

3. **"APA always asserts significant/effect" template family.** M1 (chi-square independence, factorial), M5 (one-way Tukey), and the refuted-to-minor Welch/Wilcoxon/mixed cases all stem from unconditional outcome wording in the templates. Deciding this as **one policy** (significance-conditional APA language vs. clearly-labeled "template, adjust to your result") is the highest-leverage call here, because it touches all ~47 tests and is the closest thing to an academic-integrity risk.

**Per-test (not cross-cutting):** M2 factorial fallback-row, M3 MANOVA Pillai/Wilks, M4 RM-ANOVA GG label, M6 nested-ANOVA note, Welch sign inversion, logistic/Poisson rounding, distribution histogram bins, the inter-table note placements, and the factorial interactions-OFF figure/title. These are targeted single-builder fixes.

---

## Refuted / non-issues (checked and ruled out)

~79 raw findings were dismissed under adversarial verification. The notable categories:

- **All blob:/ERR_FILE_NOT_FOUND/ERR_ABORTED "errors"** (independent-t, summary-stats, one-sample-t, shell, regression, etc.) — **test-harness artifacts**, not app bugs: Playwright's `requestfailed`/console listeners catching React's normal `revokeObjectURL` blob-lifecycle race and WebR worker teardown. Figures render correctly in every screenshot; a real user never sees these. The regression script even double-counts via a self-mutating array push (`regression.cjs` lines 279–280).
- **Missing y-axis labels on figures** (histograms, means plots, profile plots — ~8 tests) — **deliberate house convention** (`labs(y = NULL)` everywhere); spec never requires axis titles; caption + table column supply context.
- **Histogram y-axis 0.00–1.00 / "forced scale"** — ggplot2 auto-scaling for small-N count data, not a rendering bug (the real, actionable sibling — bin count — is captured as a minor above).
- **Eyebrow step-number off-by-one** — confirmed **known/by-design** (eyebrow counts the Welcome node); must not be reported as a bug.
- **Single-table renumbering, "Table 1" vs "Table 2"** (frequencies-crosstabs) — by-design: each run emits exactly one table, always numbered from 1.
- **Continuity-correction toggle "no-op" at small N** (Mann-Whitney, Wilcoxon) — statistically correct: R takes the exact path and ignores `correct=`; unit tests confirm the toggle works on the asymptotic path.
- **Static "How to read" using generic role labels ("Factor", "Pillai's trace")** (ancova, manova) — intentional static/generic explainer layer; never interprets the student's own numbers.
- **MANOVA/MANCOVA "no active-statistic label," "0.09 missing leading zero"** — refuted: the slash header is spec-drawn, the APA sentence names the statistic, and the zeros are actually present and correct.
- **ω² identical across random/fixed nesting, exact-vs-asymptotic p≠2·Φ(Z), GG df-rounding "inconsistency"** — all mathematically correct per spec.
- **Welcome copy DRAFT, browser tab title, dark-mode connector color, LaTeX-not-on-Welcome, "no card TOC," slot re-drag "stuck"** — refuted: spec-faithful, by-design, or based on a misread (e.g. the × remove button exists; the stepper IS the navigation; connector and dot share one color token).
- **Slot re-drag / "no path but reload"** — refuted: every assigned chip has an × remove button; the timeout was a drive-recipe gap, not a UX dead-end.

---

## Coverage & gaps

- **Drove cleanly:** All 29 live tests rendered results and produced screenshots across 1–3 scenarios each. The `anova-b` family (6 tests) drove with **zero failed requests** — cleanest run. No test failed to produce an output card.
- **Failed-request counts are drive-recipe / harness artifacts, not app bugs.** The reported failures (descriptive 15, regression 12, anova-a 6, core-study 4, etc.) are the blob:/ERR_FILE_NOT_FOUND lifecycle races and WebR worker-teardown events described under Refuted. They correlate with re-run/scenario counts (≈2 per re-run × figure cards) and produced **zero visible UI impact**. The regression family's count is additionally inflated ~2× by the self-mutating array bug in `regression.cjs` lines 279–280 — a **bug in the audit script**, not the app.
- **One drive-recipe gap worth noting:** the `chi-square-independence` slot re-drag timeout was a missing "click × before re-drag" step in the harness, not an app dead-end (the × remove affordance exists and works).
- **Known B-list status:** Two long-standing, owner-decided items resurfaced exactly as previously tracked and remain **open by your decision** — the Welcome export promise vs. disabled rows, and the placeholder feedback-form URL. Neither is a regression; both await your pre-launch call. The eyebrow off-by-one was re-confirmed as intentional and correctly excluded.

---

## Close

Nothing has been fixed, edited, committed, pushed, or deployed. The repo is clean on `main`. The highest-leverage decisions for you are the three cross-cutting calls (APA prose formatting, `p < .001` spacing, and the "always-significant" template policy) and the six majors — all of which live in the APA/output layer while the computed statistics themselves verified correct. Awaiting your triage before any change is made.