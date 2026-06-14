# Telos Dogfood Audit — Severity-Ranked Findings (for Triage)

**Scope:** All 29 live tests across 5 families (Descriptive, Group comparisons/core tests, ANOVA, Association, Regression), each driven through 1–3 realistic scenarios on the real fixtures against the production preview, plus the app shell. **Screenshots:** per-test under `/tmp/telos-audit/shots/<test-id>/`; shell/journey under `/tmp/telos-audit/shots/_shell/`. **Headline (44 confirmed of 109 raw, post adversarial verification):** 0 Blockers · 4 Majors · 28 Minors · 12 Polish. Nothing has been fixed, pushed, or deployed.

---

## Blockers

None. No finding makes a result numerically wrong or blocks the core upload→analyze→download flow.

---

## Majors (4)

### M1. Distribution & normality histogram is useless for small samples (bins=30 hardcoded → every bar = height 1)
- **Test/screen:** `distribution-normality` — `/tmp/telos-audit/shots/distribution-normality/s1.png`, `s2.png`
- **What's wrong:** `distributionNormality.ts` line 20 hardcodes `geom_histogram(bins = 30)`. At thesis-typical N (10–30), nearly every occupied bin holds exactly one observation, so every bar reaches 1.00 and the histogram looks uniform regardless of the true distribution. The codebase already refutes this choice: `oneSampleTTest.ts` uses `nclass.Sturges` (5 bins at N=14) and `summaryStatistics.ts` uses `bins=12`.
- **Why it matters:** The histogram is a required deliverable figure whose entire purpose — showing distributional shape — fails for any realistic sample under ~60. The Q-Q plot still works, but a student who reads the histogram is misled.
- **Fix:** Replace `bins = 30` with an adaptive rule, e.g. `bins = max(5L, min(30L, ceiling(log2(n) + 1)))` using the already-available `n`.

### M2. Stepper overflows and clips early/active steps when 8+ nodes are active
- **Test/screen:** shell — `/tmp/telos-audit/shots/_shell/stepper-8steps-results.png`, corroborated by `06-results-3cards.png`
- **What's wrong:** With 3 tests selected the stepper has 8 nodes; `scrollWidth` 721px vs rendered 560px (`max-width:560px; overflow-x:auto` in `tokens.css` line 32). `Stepper.tsx` has no scroll-into-view logic. At the Results step the visible strip starts at "Configure data" — "Upload"/"Guide" are clipped left **and the active "Results" node is off-screen right**, with no fade/scroll affordance.
- **Why it matters:** The stepper's only job is "you are here" orientation; on the very screen a student lands at the end of the flow, the active node is invisible.
- **Fix:** Auto-scroll the active node into view, OR collapse/abbreviate completed fixed steps, OR allow wrap to two rows with scroll affordances on overflow.

### M3. Factorial ANOVA "How to read" references an A×B row and interaction plot that don't exist when interactions=OFF
- **Test/screen:** `factorial-anova` — `/tmp/telos-audit/shots/factorial-anova/s2.png`
- **What's wrong:** With interactions OFF, Table 2 is titled "ANOVA (main effects)" with only `group`/`gender` rows and no figure — yet the unchanged "How to read" still says "the A×B row tests whether the effect of one factor depends on the other" and "read it from the interaction plot before the main effects." Root cause: `buildFactorialAnova.ts` line 62 sets `howToRead: spec.howToRead` unconditionally, never branching on the `hasInteractions` boolean already computed on line 19 (and used to gate the figure/table title).
- **Why it matters:** A student is told to look for two elements that are not on their screen.
- **Fix:** Supply a trimmed `howToRead` when `hasInteractions` is false, omitting the A×B-row and interaction-plot sentences.

### M4. Multiple-linear-regression CI label hardcoded "95% CI" in **two** places (table header + figure axis)
- **Test/screen:** `multiple-linear-regression` — `/tmp/telos-audit/shots/multiple-linear-regression/s1.png`, `s2.png` (both default 95%, so latent)
- **What's wrong:** Coefficients column header is the static `'95% CI'` (`multipleLinearRegression.ts` line 36) **and** the coefficient-plot x-axis is the literal `'Standardized β (95% CI)'` (`multipleLinearRegression.ts` line 112). The `level` is correctly threaded into `confint()`/error bars, so at 90% or 99% the **intervals are right but both labels still say 95%** — a direct contradiction in a research output, in both a table and a figure.
- **Why it matters:** A thesis student selecting 90% CI would compute and then mis-cite the confidence level in print, in two visible places.
- **Fix:** Thread the resolved CI percentage into the builder: override the column label and interpolate the figure x-axis (`paste0('Standardized β (', round(level*100), '% CI)')`).

> **Note on M4:** This is the most visible instance of the app-wide "hardcoded 95% CI" pattern — see **Cross-cutting C1**. The same root issue appears at *minor* severity in 9 other tests; it is rated *major* here only because it duplicates into a figure axis as well as a header.

---

## Minors (28)

### Cross-cutting CI-label group (rated minor per test) — see C1
The single highest-leverage cluster. Hardcoded `"95% CI"` (or `"95% CI (OR)"`, `"95% CI (IRR)"`) in column headers / APA strings / how-to-read prose that do **not** update when the user picks 90% or 99%, even though the computed bounds do change. Confirmed individually in:

| Test | Where hardcoded | Screenshots |
|---|---|---|
| `independent-t-test` | header + howToRead (`independentTTest.ts` L31, L37) | `independent-t-test/s1,s2` |
| `one-sample-t-test` | header + howToRead (`oneSampleTTest.ts` L29, L35) | `one-sample-t-test/s1,s2` |
| `paired-t-test` | header (`pairedTTest.ts` L29) | `paired-t-test/s1` |
| `one-way-anova` | header + post-hoc CI level not passed to emmeans (see M-adjacent below) | `one-way-anova/s1,s2` |
| `ancova` | two tables: adjusted means + post-hoc (`ancova.ts` L35,L53) | `ancova/s1` |
| `pearson` | header + APA template (`pearson.ts` L27,L35) | `pearson/s1` |
| `logistic-regression` | header `95% CI (OR)` + APA (`logisticRegression.ts` L41,L50) | `logistic-regression/s1,s2` |
| `poisson-negative-binomial` | header `95% CI (IRR)` + APA (`poissonNegativeBinomial.ts` L38,L48) | `poisson-negative-binomial/s1,s2` |

**Why it matters:** values correct, label stale → a student who deviates from the 95% default mis-reports the confidence level. **Latent** (default is 95%, so not visible in screenshots) but confirmed by code. **Fix (one architectural change):** pass the resolved CI level into the builders and derive labels (`${Math.round(level*100)}% CI`) instead of static strings; the builders currently receive only `(spec, result)` and never see the CI option.

### One-way ANOVA — post-hoc CIs always 95% regardless of selector (a real number bug, not just a label)
- `one-way-anova` — `s1.png`, `s2.png` (latent at default). `posthoc.ts` line 11 calls `summary(pairs(emm, adjust=adjust), infer=TRUE)` with **no `level=` argument**, so emmeans returns 0.95 CIs even when the figure's error bars use the chosen level. At 90%/99% the post-hoc table CIs are silently wrong **and** the header still says 95%. **Fix:** add `level = level` to the `summary()` call in `POSTHOC_EMM_R`. *(This is distinct from C1 — here the numbers, not just the label, are wrong off-default.)*

### Frequencies & cross-tabs — bar chart y-axis clipped below data max
- `frequencies-crosstabs` — `s1.png`. Both bars (n=7) run flush to the top edge; last gridline is at 6, no headroom. `R_BAR` (`frequenciesCrosstabs.ts` L37–39) has no y-limit/expand override. Table above shows correct counts, so no data is hidden — aesthetics only. **Fix:** `scale_y_continuous(expand = expansion(mult = c(0, 0.10)))`.

### Frequencies & cross-tabs — APA renders "Table 1" instead of the spec's "Table X" placeholder
- `frequencies-crosstabs` — `s1.png`, `s2.png`. `buildFrequenciesCrosstabs.ts` L14 does `.replace('{n}', '1')`; the spec (and the parallel summary-statistics card) preserve the editable "Table X". A student copying the sentence hardcodes the wrong table number. **Fix:** switch the registry token to `{x}` and substitute literal `'X'`, mirroring summary-statistics.

### Distribution & normality — table note promises skewness & kurtosis "alongside" but they appear nowhere on the card
- `distribution-normality` — `s1.png`, `s2.png`. Note says "skewness & kurtosis are reported alongside" but they live only in the separate Summary-statistics card; nothing on this card shows them. (Note text is spec-faithful, so this is a spec-level wording gap.) A student running only this test scans and finds nothing. **Fix:** reword to "…reported in the Summary statistics card," or add the columns here.

### Distribution & normality — sticky stepper overlaps the normality table (2-variable case)
- `distribution-normality` — `s2.png`. Sticky stepper (`tokens.css` L32, `z-index:20`, opaque bg) overlays the anxiety K-S row at the default scroll position. The prior "sticky clearance" commit (`b0e6fda`) only added `scroll-padding-top` (anchor-nav) + a shadow — it does **not** prevent free-scroll overlap; the workflow's SKIP note ("already fixed in backbone") was premature. *(Same root mechanism as M2's overflow but a separate symptom — overlap vs clipping; reported twice in the raw set, merged here.)* **Fix:** add top padding/scroll-margin to result cards equal to stepper height.

### Independent t-test — Cohen's d formatted with `f01()`, drops leading zero when |d|<1
- `independent-t-test` — latent (current `d=−3.45`). `buildIndependentTTest.ts` L13 uses `f01(r.cohensD)`; d is unbounded so APA 7 keeps the leading zero (spec shows `d=−0.83`). Sibling builders use `f()`. **Fix:** change to `f()`; check `buildPairedTTest.ts`/`buildOneSampleTTest.ts`.

### Repeated-measures ANOVA — "post-hoc table follows" note prints *after* the post-hoc table (uncorrected scenario)
- `repeated-measures-anova` — `s2.png`. When the sphericity table is omitted the note loses its `afterTableId` and falls to the bottom (`buildRepeatedMeasuresAnova.ts` L52–53 + `ResultPreviewCard.tsx` fallback), so "post-hoc table follows" reads backwards. **Fix:** move the note between the ANOVA and post-hoc tables, or strip "post-hoc table follows" when sphericity is omitted.

### Repeated-measures ANOVA — sphericity note persists when sphericity=none
- `repeated-measures-anova` — `s2.png`. With `sphericity=none` the GG/HF note still shows even though no correction is applied — misleading. Same builder always passes `noteBase` through. **Fix:** suppress/replace the note when `sphericityChoice==='none'`, extending the existing 2-level suppression. *(Related to the note above; both stem from the same builder's note handling.)*

### Repeated-measures ANOVA — post-hoc CI labelled "95% CI" but intervals are Bonferroni-adjusted (wider)
- `repeated-measures-anova` — `s1.png`, `s2.png`. emmeans `infer=TRUE` with Bonferroni yields family-corrected (~98.3% for 3 comparisons) bounds, but the header says 95%. Confirmed arithmetically (half-width 1.035, t*≈2.46). Same in `mixedAnova.ts`. **Fix:** relabel "Adj. 95% CI"/add a note, or compute CIs at the unadjusted level separately from the p-adjustment.

### Mixed ANOVA — assumption note renders after the post-hoc table instead of after the Sphericity table
- `mixed-anova` — `s1.png`. `buildMixedAnova.ts` L20–23 builds the note with no `afterTableId`; the sister `buildRepeatedMeasuresAnova.ts` L53 sets `afterTableId:'sphericity'` correctly. **Fix:** mirror the sibling pattern.

### Nested ANOVA — table note starts lowercase for random nesting, uppercase for fixed
- `nested-anova` — `s1.png` ("under random nesting…") vs `s2.png` ("Under fixed nesting…"). Registry string (`nestedAnova.ts` L36) stores the random note lowercase; fixed branch is hardcoded uppercase. Reads as a typo. **Fix:** capitalize the random note.

### MANCOVA — adjusted-means figure error bars have no legend/label
- `mancova` — `s1.png`. Bars are emmeans default 95% CIs but nothing on the card says so; unlike ANCOVA there's no CI selector or "± CI" caption. A student can't tell SE from CI. **Fix:** add a figure note ("Error bars = 95% CI").

### Pearson — CI bounds in APA sentence keep the leading zero (should drop it)
- `pearson` — `s1.png` shows `r(38)=.70 … 95% CI [0.50, 0.83]`. r uses `f01()` but the bounds use `f()` (`buildPearson.ts` L12); r-CI bounds are in [−1,1] so the bounded-stat rule applies. Mid-sentence inconsistency. **Fix:** use `f01()` for `ciLow`/`ciHigh` (note: OR/IRR CI bounds correctly keep `f()` since they're unbounded).

### Kendall's tau — APA sentence is a grammatical fragment
- `kendalls-tau` — `s1.png` renders "Kendall's τ=.75, p < .001, N=40." — no subject/verb, unlike Spearman's "A Spearman correlation gave ρ=…". Spec-level (`kendallsTau.ts` L31 mirrors `telos_test_outputs.html` L627). A student can't paste it directly. **Fix:** "A Kendall's tau correlation gave τ={tau}, p {p}, N={n}." (update spec card too).

### Simple linear regression — two figures carry identical "Figure. Fit & residuals" captions
- `simple-linear-regression` — `s1.png`. Two consecutive identical headings (one for the fit scatter, one for residual diagnostics) because `ResultPreviewCard.tsx` L36 emits a heading per `content.figures` entry and both entries share the caption. **Fix:** rename the second to "Residual diagnostics," or render one grouping heading.

### Poisson/NB — dispersion note reads as Poisson advice even in NB mode
- `poisson-negative-binomial` — `s2.png`. In NB mode the Dispersion cell shows theta (9.00) but the static note still says "switch to negative binomial … rather than this ratio," reading as an unresolved recommendation referring to a "ratio" the student isn't seeing. **Fix:** make the note model-aware.

### Shell — export/download bar is not sticky on long results pages
- shell — `/tmp/telos-audit/shots/_shell/06-results-3cards.png`. 3 tests ≈ 4900px tall; only the stepper is sticky. A student reading the last card must scroll back to the top to download. Spec doesn't mandate sticky, so downgraded from major. **Fix:** make the export bar sticky, or add a bottom Download / floating action button.

### Shell — feedback link is an unfilled placeholder
- shell — `/tmp/telos-audit/shots/_shell/10c-results-footer.png`. `copy.ts` L2 `…/forms/REPLACE_WITH_YOUR_FORM` (the only feedback channel). Known tracked pre-launch item (ROADMAP Phase 4). **Fix:** drop in the real form ID before any public share.

### Shell — browser tab title is "telos-app" (raw Vite default)
- shell — `index.html` L7. Appears in tab/task-switcher; reads unfinished. **Fix:** set a real `<title>`.

### Shell — CB-SEM / PLS-SEM picker entries have multi-line developer-note descriptions
- shell — `/tmp/telos-audit/shots/_shell/05b-pick-test-bottom-latent.png`. All other "arrives in a later slice" leaves are one line; these wrap 2–3 lines of jargon ("pipeline stages," "bootstrapped CIs"). Visual asymmetry / unscannable. **Fix:** truncate to one line; move detail to a tooltip.

### Shell — blob URL 404s (`ERR_FILE_NOT_FOUND`) on every analysis run
- `one-way-anova` console (6× across two sessions). **Confirmed real but the original cause theory was wrong:** not WebR plumbing — it's an un-memoized builder call in `BuiltCard` (`ResultsScreen.tsx` L103) creating a new `content` object on every render, so `ResultPreviewCard`'s `[content]` effect re-fires, revoking and recreating figure blob URLs; a transient state change (checkbox) races the `<img>` src. **Zero user-visible impact** — all figures render. *(Caution: several other "blob 404" raw findings were refuted as harness artifacts / download-anchor noise — see Refuted. This one is the genuine instance, but impact is still cosmetic.)* **Fix:** memoize the builder result so `content` identity is stable across re-renders.

---

## Polish (12)

- **Summary statistics — histogram y-axis has no label; non-integer count ticks (0.5, 1.5).** `summary-statistics/s1.png`; `summaryStatistics.ts` L21 `labs(y=NULL)`. Add `y='Count'` + integer breaks.
- **Distribution & normality — histogram/Q-Q have no axis labels.** `distribution-normality/s1,s2`; `distributionNormality.ts` L21,L26. Restore `'Count'` / `'Theoretical quantiles'` / `'Sample quantiles'`.
- **One-sample t-test — APA sentence missing spaces around `=` for M, t, d.** `one-sample-t-test/s1,s2` ("M=70.3", "t(5)=-3.64", "d=-1.49"); spec uses spaced `=`. Add spaces in `apaTemplate` (also paired/independent).
- **One-sample t-test — Shapiro-Wilk W shown with leading zero (W=0.99, should be .99).** `s1.png`; `buildOneSampleTTest.ts` L17 uses `f` not `f01`. One-char fix.
- **One-sample t-test — "How to read" hardcodes "95% CI"** (prose twin of C1). `s1,s2`. Genericize or interpolate.
- **One-way ANOVA — "How to read" mentions ω² but only η² is in the table.** `s1,s2`; `oneWayAnova.ts` L41. Reword or add ω² column.
- **Welch ANOVA — "How to read" never tells the student to compare p to α.** `welch-anova/s1.png`. (Shared pattern with one-way / Kruskal-Wallis.) Append a "compare p to your α" sentence.
- **MANCOVA — slope-test p in table note uses non-APA `p(...)=.421` (no spaces).** `mancova/s1.png`; `buildMancova.ts` L21 uses `fp()`+hardcoded `=`. Use `fpApa()` + spacing (same in `buildAncova.ts`).
- **Kendall's tau — no table note explaining the absent CI** (Spearman has one). Spec gap. Add the parity note.
- **Logistic regression — extreme intercept CI `[4.11, 476670.30]` has no thousands separator.** `s2.png`; only in the event-switched scenario, intercept never cited in APA. Consider `toLocaleString()`/exponential ≥1000.

*(Two further polish items — the one-sample-t "How to read 95% CI" and the welch/one-way α-comparison wording — overlap the cross-cutting prose patterns above.)*

---

## Cross-cutting vs per-test (highest-leverage first)

**C1 — Hardcoded "95% CI" labels (≈11 tests).** The single biggest lever. Confirmed in independent-t, one-sample-t, paired-t, one-way ANOVA, ANCOVA, Pearson, logistic, Poisson/NB, **and** multiple-linear (M4, the only one that also corrupts a figure axis). The builders receive `(spec, result)` and never see the CI option, so **no** dynamic-label plumbing exists anywhere. One architectural fix (thread the resolved level into builders, derive labels) closes the table-header, APA-sentence, and how-to-read variants in one pass. **Important nuance:** for **one-way ANOVA** the post-hoc CIs are *also numerically* 95%-only (emmeans missing `level=`) — that's a real number bug to fix alongside the labels.

**C2 — Static table-note placement / conditionality.** Notes that don't adapt to the active toggle: factorial-ANOVA how-to-read (M3), repeated-measures note position + persistence, mixed-ANOVA note position, Poisson/NB dispersion note, distribution-normality "alongside." Pattern: builders emit static notes without branching on the option that changed the card. Fix family = make notes option-aware.

**C3 — Sticky stepper.** Overflow-clipping (M2) and content-overlap (distribution-normality) are two symptoms of one sticky-stepper layout gap; one layout fix (scroll-into-view + content top-padding/scroll-margin) addresses both. The prior "fix" was incomplete.

**C4 — Figure axis labels (`labs(x=NULL, y=NULL)`).** Appears app-wide. Flagged at polish only for distribution-normality and summary-statistics (where the count axis is genuinely ambiguous). **Deliberately NOT flagged per-test elsewhere** — it's a consistent house style (see Refuted). Decide once: keep the convention or add labels globally.

**Per-test (genuinely local):** M1 bins=30 (distribution-normality only), M3 factorial how-to-read, frequencies y-clip + Table-X, Cohen's-d `f01`, Pearson CI-bounds `f01`, Kendall fragment, nested-ANOVA capitalization, simple-linear duplicate captions, Shapiro W leading zero, shell items (tab title, feedback URL, export-bar sticky, SEM picker copy).

---

## Refuted / non-issues (sampled — 65 raw findings dismissed)

- **`labs(x=NULL, y=NULL)` "missing axis labels" on boxplots/bar charts/scatter** (Kruskal-Wallis, Mann-Whitney, independent-t, chi-square ×2, Fisher's ×3, factorial interaction plot, ANCOVA x-axis, Friedman, Spearman). **House-wide intentional style** across 20+ stat files; spec cards don't require labels; figures are contextualized by caption + table. *(Distinct from the polish items kept only where the count axis is genuinely ambiguous.)*
- **Continuity-correction / exact-path toggles "produce no visible change"** (Mann-Whitney ×2, Wilcoxon ×3). **By design** — R auto-selects the exact path at small N where `correct=` is inert; documented in registry comments + unit tests; the toggle works on the asymptotic path.
- **Mann-Whitney Z and p "don't reconcile."** Spec-locked owner decision: Z from `coin::wilcox_test` (asymptotic), p from `wilcox.test` (exact); both correct from their own distributions.
- **MANOVA "stale APA / Table 2 / figure across Pillai↔Wilks" (5 findings).** Refuted: same dataset, only the multivariate statistic toggles. APA always reports Pillai by recorded decision 1; Pillai trace, univariate follow-ups (df2=N−g=57), and raw-means figure are mathematically identical across scenarios. Reviewer's N=59 inference was a df-formula error (N=60). The "Pillai/Wilks" header and "alpha" prose are spec-faithful.
- **Multiple-linear "coefficient plot renders with standardize OFF / β absent" (3 findings).** By design: standardize masks only the β *table column* (owner ruling R1); β is always computed; the forest plot is a permanent figure (owner ruling #11) and β is visible there.
- **Most blob-URL 404 reports (4 findings).** Harness artifacts / fire-and-forget download-anchor revocation; counts partly inflated by an audit-script self-mutating push bug. *(One genuine instance survived — see Minors — but still zero user impact.)*
- **Chi-square: Cramér's V from uncorrected χ² while reported χ² uses Yates.** Deliberate, documented, matches `rcompanion::cramerV`; reproducible in R.
- **Repeated-measures: GG-corrected MS ≠ SS/displayed-df.** Correct — MS uses full-precision ε; displayed df is rounded (same as SPSS/JASP/R).
- **Spec-faithful wording/structure** ("APA template:" label, unnumbered "Figure.", "Dispersion" header static for NB, Welch F compact spacing, "passed" variable mid-sentence, Wilcoxon V omitted from APA, summary grouped-histogram pooled, eyebrow off-by-one, LinkedIn inline credit, no TOC, dark-mode chart panels / button accent, "how-to-read says p tests significance"). All reproduce the approved spec / prior owner rulings.

---

## Coverage & gaps

- **Drove cleanly:** all 5 families exercised; association family drove with **0 failed requests** (cleanest). Every results card rendered correctly in every screenshot, including the runs that logged blob 404s.
- **"Failed requests" counts (per family: core-paired 3, core-study 4, anova-a 6, descriptive 15, anova-b 6, regression 8):** these are the blob `ERR_FILE_NOT_FOUND` console/network events, **not** app failures. Confirmed as the un-memoized-builder race (one genuine) plus harness/download-anchor noise (refuted). No scenario failed to produce a correct card; **no drive-recipe failed to drive a test.** The descriptive count (15) is inflated by the audit-script self-mutating push bug noted in Refuted.
- **No test failed to load or analyze.** The only "missing output" cases (factorial interactions-OFF figure, NB theta vs ratio) are by-design, not drive artifacts.
- **B-list status:** the one explicit B-list SKIP carried into this run — the sticky-stepper overlap "already fixed in backbone" — is **not actually fixed** (M2 + the distribution-normality overlap). The feedback-URL placeholder and PDF/R-script "coming soon" exports remain tracked, intentional pre-launch items (ROADMAP Phase 4), not regressions.

---

## Triage note

Nothing has been fixed, pushed, or deployed. 0 Blockers · 4 Majors · 28 Minors · 12 Polish, with three cross-cutting clusters (CI labels, note conditionality, sticky stepper) carrying the most leverage. Awaiting your call on what to fix and in what order.