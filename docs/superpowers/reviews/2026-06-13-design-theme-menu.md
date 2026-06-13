I have everything I need to write this report. The input is a complete, verified set of 45 themes with full analysis. My job is to synthesize them into a clean DECISIONS-FOR-OWNER markdown menu, deduplicating the overlapping raw findings (many themes are the same root issue raised multiple times) and ranking by importance × leverage.

Let me synthesize this directly — no file reads needed since the analysis is all provided.

# Telos — Decisions for the Owner

This is a **design-decision menu, not a bug list.** Nothing here is broken or has been changed. Each item is a place where the app *imposes a choice, declares a verdict, or limits flexibility* — and each is yours to rule on. Grouped by theme; the two you already flagged come first, then new themes ranked by importance × leverage.

---

## PART 1 — The two themes you already raised

### A. The α / CI / tails "forcing" — display pills that only pretend to be settings

**Current behavior.** Every one of the 29 tests carries `{ id:'alpha', value:'0.05', kind:'display' }` and (on parametric tests) `{ id:'ci', value:'95%', kind:'display' }`, plus `tails:'two'` on t-tests/Pearson/Mann-Whitney/Wilcoxon/Fisher. These are **read-only cosmetic pills** — `kind:'display'` options are filtered out of `freshSetup()` (`session.ts:93`) so they are never even stored. The R runners hardcode the convention structurally: `confint(m)` with no `level=` (`simpleLinearRegression.ts:29`, `logisticRegression.ts:32`, `multipleLinearRegression.ts:28`), `t.test()`/`cor.test()` with no `conf.level=` or `alternative=` (`independentTTest.ts:13`, `pearson.ts:13`), `qt(0.975,…)` (`oneWayAnova.ts:39`). The 95% / two-tailed level is baked into R, not merely "displayed." Column-header labels like `'95% CI (OR)'` are string literals too (`logisticRegression.ts:41`, `chiSquareIndependence.ts:41`).

**Why it's set that way (steelman).** Thesis students near-universally work at α=0.05, two-tailed, 95% CI — the APA 7 / intro-methods default. Removing the dials shrinks the config surface, removes a class of copy-paste mismatches, and — most importantly — closes a **p-hacking vector**: a student who can lower α to 0.10 or flip to one-tailed until a result "lands" is a real risk in unsupervised student work. The Association slice ratified this explicitly ("house convention: α / CI pills are display-only," `simpleLinearRegression.ts:16`).

**The catch.** Three real student cases are blocked: 90% CIs (economics/policy), α=0.01 (clinical/neuroimaging/genetics), and legitimate **pre-registered one-tailed** hypotheses. Worse, a non-interactive pill that *looks* like a setting is a small UX lie — the student may believe they "chose" two-tailed when it was never theirs to choose.

**Options**

| Option | Tradeoff |
|---|---|
| **A. Honesty-only (no new capability).** Either relabel pills `two-tailed · fixed` / `α 0.05 · fixed`, or consolidate them into one disclosure at the guide step and drop the per-card pill. | Zero runner change. Kills the "looks-clickable" illusion. Does nothing for the student who genuinely needs a different convention. **Effort S.** |
| **B. Make tails interactive (only).** Add a `select` (two-tailed / one-tailed-greater / one-tailed-less), thread `alternative=` into ~8 runners. Gate behind a "my hypothesis is pre-registered and directional" acknowledgment. | Covers the most *legitimate* customization a thesis student needs. The runner change is mechanical plumbing. The confirmation gate keeps the p-hacking door mostly shut. **Effort S.** |
| **C. Session-level α/CI override.** One control on the configure-data screen, applied globally (default 0.05 / 95%), threaded into every runner via `conf.level=` / `level=` and into a real `significant-at-α` field. | Full flexibility for the legitimate edge cases without 29 per-card dials. Reopens the p-hacking vector — pair with a written warning. Feeds Theme B's conditional verdicts. **Effort M.** |
| **D. Per-test interactive α + CI everywhere.** | Maximum flexibility, maximum surface, maximum p-hacking exposure. Likely over-engineered for this audience. **Effort L.** |

**My recommendation.** Do **A unconditionally** right now — the pills must stop implying a choice they don't offer, and `conf.level=`/`level=` should be passed explicitly even at 95% so any future change flows through instead of relying on R's default accidentally matching the label. Then **B (interactive tails behind a pre-registration gate)** as the one *capability* add worth making: one-tailed is the only fixed convention that blocks a *correct, common* design rather than an exotic one. Hold α/CI interactivity (C) unless an advisor demand actually surfaces — for this audience the p-hacking risk outweighs the flexibility, and "honest documentation" covers the rare α=0.01 case. **Effort: S now (A), S next (B).**

---

### B. Report-vs-declare — APA templates assert a verdict the app never computed

> *This is the single highest-integrity-risk theme in the app, and it is the same root decision as Part 1's α: "the app decides for you" vs "the app reports and you decide."*

**Current behavior.** Many `apaTemplate` strings hardcode a significance verdict as **literal text**, never compared to any p-value:
- `simpleLinearRegression.ts:44` — "The predictor **significantly** predicted the outcome"
- `multipleLinearRegression.ts:49` — "predictor X **was significant**"
- `chiSquareIndependence.ts:39` — "**was significant**"
- `factorialAnova.ts:44` — "found a **significant** A×B interaction"
- `mixedAnova.ts:51` — "found a **significant** group × time interaction"
- Plus the whole ANOVA family ("found an effect of group," "found a difference"): `oneWayAnova.ts:43`, `ancova.ts:63`, `manova.ts:50`, `mancova.ts:54`, `nestedAnova.ts:40`, `kruskalWallis.ts:38`, `friedman.ts:37`, `repeatedMeasuresAnova.ts:44`.

The word is interpolated *alongside* the live p — but never *against* it. **The app is already inconsistent:** `logisticRegression.ts:50` and `poissonNegativeBinomial.ts:48` say neutral "was associated with"; `pearson.ts:35` says "were correlated." So GLM/correlation tests report; regression and ANOVA tests *declare*. The `howToRead` layer compounds it ("A p below alpha means significant" — `oneSampleTTest.ts:34`, `independentTTest.ts:36`, `pairedTTest.ts:38`, `chiSquareGof.ts:32`, `mannWhitneyU.ts:34`), training a binary threshold mindset.

**Why it's set that way (steelman).** APA example sentences use past-tense significance language verbatim, the templates were transcribed from the drawn spec cards (consistency tests lock them to the HTML), and the implicit assumption is "the student only uses the template when the result *was* significant." Hardcoded text is simpler than a conditional engine.

**The catch.** A student with **p=0.18** who copies the template verbatim — which the "ready-to-paste" framing *invites* — submits *"The predictor significantly predicted the outcome, B=0.42, t(28)=1.38, p=.18, R²=.06"*: a flat falsehood in a thesis. An advisor flags it; confidence in the tool collapses. This is your stated instinct ("we should be reporting numbers") made concrete.

**Options**

| Option | Tradeoff |
|---|---|
| **1. Neutral templates — strip every verdict word.** "The predictor predicted the outcome, B={b}, t({df})={t}, p={p}, R²={r2}." | Always correct for any p. Makes the whole suite consistent with the *already-neutral* logistic/Poisson/Pearson templates. Pure registry text edit (+ consistency-test update, + spec-HTML gate since cards are spec-locked). Students write their own interpretation — arguably the right pedagogy. **Effort S.** |
| **2. Conditional verdict.** Builder compares stored p against α and injects "significantly" / "did not significantly." | Reads naturally either way and is copy-paste-safe. **Requires α to be a real runtime value (depends on Part 1 / Option C).** Risks reifying nulls; hardcodes the very verdict logic you flagged as the problem. **Effort M.** |
| **3. Dual block.** Neutral APA statistics line + a separate, explicitly conditional plain-language interpretation note. | Highest educational value; keeps the machine line clean. More screen real estate and build cost. **Effort M.** |

**My recommendation.** **Option 1 — purge verdict words from all ~10–14 affected templates** and bring them in line with the neutral style the app *already uses* for logistic/Poisson/Pearson. It is a few string edits per file, costs nothing at runtime, eliminates the false-statement risk entirely, and is the cleanest expression of "report the numbers." Selectively soften the `howToRead` binary sentences too (demote "p below alpha means X" beneath a "p is the probability of a result this extreme by chance" framing) — same gate, same spirit. **Do not do Option 2 before Part 1 makes α a real value.** This is the highest-importance item in the whole report. **Effort S.** (Note: spec-HTML must change first since consistency tests are spec-locked — that's your gate to open.)

---

### C. One model instance per test — no model comparison, no what-if rerun

**Current behavior.** `session.selection` is a flat `string[]` keyed by test id (`session.ts:25`); `setups` and `runs` are `Record<string, …>` keyed by the same id (`session.ts:26–27`). `toggleSelection` (`session.ts:168–172`) adds-or-removes — a duplicate id is a **no-op**. `stepsOf` maps one id → one step (`session.ts:49`). Any upstream edit marks *all* runs stale (`session.ts:125`), so re-configuring **destroys the previous run**. There is structurally no way to run two specifications of the same test.

**Why it's set that way (steelman).** The linear wizard (welcome → upload → configure → pick → configure-each → results) maps cleanly to one card / one result per test. Multiple instances need namespaced step ids, multi-card results layout, and an instance-naming UX — a large, genuinely hard refactor touching `stepsOf`, `canEnter`, `gateOk`, `freshSetup`, and zip export. For a student running one pre-specified model per research question, the constraint rarely binds.

**The catch.** It blocks the **most common thesis regression workflow there is**: hierarchical / nested regression (base model A,B vs. extended A,B,C → report ΔR² and its F-test). Also blocked: Poisson-vs-NB AIC comparison (which your *own* Poisson `howToRead` recommends), logistic exposure-definition A/B, sensitivity analyses, and the universal "what happens to R² if I drop this covariate?" Today the answer is "run the app twice and compare from screenshots." Competitors (SPSS, jamovi) all do two-block entry.

**Options**

| Option | Tradeoff |
|---|---|
| **1. Instance-keyed state.** `selection` → `{instanceId, testId}[]`; setups/runs keyed by instance; SPECS still keyed by testId; UI labels "Model 1/2." | The complete, general fix — enables every comparison scenario. Touches the whole state/routing/results/export spine. **Effort L.** Deserves its own design sprint. |
| **2. Block entry on multiple-linear only.** A second optional "Block 2 predictors" role slot → second `lm()` → auto `anova(m1,m2)` reporting ΔR², ΔF, Δp. | Solves the single most common use case (psych hierarchical regression) **without touching the session-key architecture** — it's just a second role slot + a conditional second model call. Bounded, learnable, well-defined output. **Effort M.** |
| **3. Snapshot / history.** A "snapshot before re-config" + last-N-runs panel per test, using stale run entries. | No state-model change. Directly kills the "I lost my previous run" pain. No true side-by-side / no automated ΔF test. **Effort M (lower than 1).** |

**My recommendation.** Ship **Option 2 (block entry for multiple linear)** in the regression slice — it delivers the highest-ROI thesis workflow at bounded cost and zero architectural risk. Add **Option 3 (snapshot)** as a cheap safety net against losing a run on re-config. **Design Option 1 now even if it ships later** — retrofitting instance-keying after more tests are built only gets more expensive, and `stepsOf`/`canEnter`/zip-export are the three places it lands. **Effort: M (block) + M (snapshot); L for the eventual general fix.**

---

## PART 2 — New themes, ranked by importance × leverage

> **Two root decisions generate most of these.** (i) *"Declare vs report"* (Theme B above) also drives the diagnostics/audit-transparency cluster. (ii) *"One opinionated default, no dial"* drives the post-hoc / effect-size / threshold / reference-level cluster. Where several themes share a root, I say so.

### 1. Silent dummy-coding reference level for categorical predictors — invisible *and* uncontrollable *(HIGH leverage, S)*

**What it is.** All regression runners wrap categorical predictors in `factor()` with no `levels=` / `relevel()` (`multipleLinearRegression.ts:25`, `logisticRegression.ts:28`, `poissonNegativeBinomial.ts:21`, `simpleLinearRegression.ts:26`). R then makes the **alphabetically-first** level the reference — silently determining the intercept, every dummy B, and (for logistic) every OR. It appears **nowhere in the UI.** Sharp asymmetry: logistic lets you pick the *outcome* event level (`logisticRegression.ts:23`) but never the *predictor* reference.

**Who it affects.** Anyone whose control group isn't alphabetically first — groups `{High, Low, Medium}` silently reference "High"; `{placebo, standard care, treatment}` references "placebo." The thesis then reads "compared to [wrong baseline]" and the student can't answer "what's your reference group?" without re-running in R.

**Options.** (1) **Display** the reference level in a table note per categorical predictor — JS can compute it by finding the level absent from the term names; zero R change. (2) Add a **per-predictor reference `level-select`** (the `level-select` infra already exists for the logistic event). (3) Add a tableNote warning telling students to reorder the CSV.

**Recommendation.** **Option 1 now** — showing the reference level is a *correctness obligation*, not a feature; it's a builder-only change. Stage **Option 2** into the regression slice since the level-select infra already exists. **Effort S (display) / M (picker).**

---

### 2. Welch ANOVA reports **no effect size at all** — the only inferential test in the suite that doesn't *(correctness gap, S)*

**What it is.** Every other test reports an effect size; `welchAnova.ts` has no effect-size column and the runner makes no `effectsize` call (`WelchAnovaResult` has no `eta2`/`omega2` field). `oneway.test()` returns only F/df/p, and adding ω²/η² needs a secondary `lm()` call that wasn't in the original design.

**Who it affects.** Anyone whose groups have unequal variance (exactly the case Welch ANOVA exists for) must hand-compute or fetch the effect size elsewhere.

**Recommendation.** **Close the gap** — secondary `lm()` → `omega_squared()`/`eta_squared()` (dependency already in scope), add the column. This is a plain correctness fix, not a debate. **Effort S.** (Bundle with the η²/ω² consistency item below.)

---

### 3. Post-hoc correction is a real *select* for one-way ANOVA but a hardcoded *pill* everywhere else *(consistency + flexibility, S)*

**What it is — one root, several faces.** One-way ANOVA exposes Tukey/Bonferroni/Scheffé (`oneWayAnova.ts:16–18`). But:
- **RM ANOVA & Mixed ANOVA** hardcode `'bonferroni'` in the R string (`repeatedMeasuresAnova.ts:39`, `mixedAnova.ts:56`) — the toggle only turns the table on/off, not the method.
- **Kruskal-Wallis** shows pill "Dunn's test" but silently runs Holm adjustment (`kruskalWallis.ts:21`), disclosed nowhere.
- **Friedman** (Nemenyi), **Welch ANOVA** (Games-Howell), **factorial** (Tukey), **ANCOVA** (Tukey, `ancova.ts:41`) are all display-only pills.

**Who it affects.** An advisor specifying Holm for a 5-level RM design, or Bonferroni for a Dunn follow-up, can't comply. A student can't even *report* the Dunn adjustment method because the pill doesn't name it — an incomplete APA methods section, and a mismatch vs SPSS (which defaults Dunn to Bonferroni).

**Options.** (1) **Disclose** — rename pills to include the method ("Dunn / Holm," "Bonferroni"); zero runner change, unblocks reporting immediately. (2) **Add a method `select`** to RM/Mixed/KW/Friedman mirroring one-way (Bonferroni/Holm/FDR or test-appropriate), threading one string into `.telos_posthoc()`. (3) Remove the one-way select for "consistency" — *wrong direction*, don't.

**Recommendation.** **Option 1 immediately for all** (disclosure is free and fixes the reporting gap), then **Option 2 for RM + Mixed** as the highest-value parity add (Holm is strictly more powerful than Bonferroni at no assumption cost). KW/Friedman selectors are a fast follow. **Effort S.**

---

### 4. Logistic classification threshold hardcoded at 0.5 — silent, unlabeled *(imposed-choice, S)*

**What it is.** The confusion matrix / %-correct use `ifelse(p >= 0.5, …)` (`logisticRegression.ts:50`), and 0.5 appears nowhere in the UI, options, note, or `howToRead`. The ROC curve is threshold-free (correct), but the classification table beneath it silently picks one operating point and doesn't mark it on the ROC.

**Who it affects.** Anyone with imbalanced outcomes (e.g. 80–90% non-event): 0.5 classifies nearly everything as the majority class, inflating apparent accuracy. A clinical/screening student gets a table that misrepresents real performance and can't answer "why 0.5?"

**Recommendation.** **Label it now** in the table note ("classification threshold: 0.5") and mark the operating point on the ROC. Add a **threshold `number` option (default 0.5)** as a follow-on — logistic already has the most options of any test, so one more is proportionate. **Effort S.**

---

### 5. Missing-data transparency + the "impute" trap *(debatable-default, S–M)*

**What it is — two linked issues.** (a) The default `'leave'` (`session.ts:132`) does **per-test listwise** silently, so each test's N can differ with no cross-test reconciliation — a student citing "N=200" from demographics whose regression shows N=180 gets flagged. The label "leave" *sounds* like "use all rows." (b) The `'impute'` option does **global mean/mode single imputation** before any test (`missing.ts:22–37`), `droppedCount=0`, no disclosure of count or method. Mean imputation biases SEs downward, attenuates associations toward zero, and produces non-integer values on Likert/ordinal columns — a methodologist on the committee will ask about it.

**Who it affects.** Survey-data students (global `'drop'` can silently lose far more rows than per-test listwise); anyone who picks "impute" for convenience and reports p=0.04 that should've been p=0.09.

**Options.** (1) **Missing-data audit on results** — per-test N used / N excluded / which columns drove exclusions, + a cross-test N note. Zero statistical risk; do it regardless. (2) **Rename** options honestly ("per-test listwise (default)," "global listwise," "mean/mode fill — single imputation") and warn on impute select + ordinal columns. (3) Remove impute for inferential tests / add MICE (L, out of scope for v1).

**Recommendation.** **Option 1 (audit) + Option 2 (rename + impute warning)** together — both S, both transparency-only, neither changes the default. "leave" actively misleads and the silent imputation is a real reproducibility hazard. Defer MICE. **Effort S–M.**

---

### 6. Regression diagnostics are visual-only — no formal heteroscedasticity / autocorrelation / influence statistics *(flexibility-gap, M)*

**What it is.** Simple & multiple linear produce a 2-panel residual figure (Fitted-vs-Residuals + Q-Q). VIF is numeric. But no Breusch-Pagan, no Durbin-Watson, no Cook's distance / leverage — and no Scale-Location panel. The tableNote *names* homoscedasticity as a check but only barely provides a visual means for it.

**Why (steelman).** Formal diagnostic tests are themselves contested (Shapiro/BP reject trivially at large n); the ggplot2-only recorded decision avoids `check_model()` complexity; visual inspection is many methodologists' preference.

**Recommendation.** **Add a Scale-Location panel + a Cook's distance panel** to the existing figure — stays inside the ggplot2-only constraint, needs no new packages, materially improves coverage without importing a "what do I do with a significant BP?" interpretation burden. **Effort M.** (Quick interim: one tableNote sentence pointing to BP/Durbin-Watson.)

---

### 7. MANOVA/MANCOVA: Pillai-vs-Wilks select that the APA template ignores *(imposed-choice, S)*

**What it is.** Both expose a Pillai/Wilks `select`, but the APA template is hardcoded to Pillai (`manova.ts:50`, `mancova.ts:54`) and the runner always carries Pillai fields. Pick Wilks → the table shows Wilks but the APA sentence still says "Pillai's V" with the Wilks number. A line-by-line advisor check flags the contradiction; the select creates a false expectation.

**Recommendation.** Make the template **adapt to the choice** (Pillai → "Pillai's V={v}"; Wilks → "Wilks' Λ={v}") — the runner already computes both, so `{v}` just resolves to the chosen statistic. Small builder change. **Effort S.**

---

### 8. MANOVA/MANCOVA follow-up ANOVAs have no multiplicity correction — the `howToRead` tells the student to do Bonferroni by hand *(flexibility-gap, S)*

**What it is.** The univariate-followup table reports raw per-DV p (`manova.ts:37–46`); the `howToRead` says "divide alpha by the number of outcomes" but the app doesn't compute it, and the APA template only templates the omnibus. A student with 4 DVs reading "p below alpha means significant" reports two raw p<.05 as significant when α/4=.0125 makes none so.

**Recommendation.** Add a **corrected-α callout** ("with {n} DVs, Bonferroni α = {α/n}") — UI-layer only, does the arithmetic for the student. A `p_adj` column is the fuller follow-up. **Effort S.**

---

### 9. Mixed ANOVA post-hoc gives only condition-marginal comparisons — no interaction simple effects *(flexibility-gap, M)*

**What it is.** The runner calls `emmeans(m, ~condition)` only (`mixedAnova.ts:56`) — averaging over groups. When the group×condition interaction is significant (usually the whole point of a mixed design), the `howToRead` literally tells the student to "read the profile plot" because the marginal comparisons mislead — but offers no quantified simple effects. Factorial ANOVA *does* generate `~f1|f2` simple effects, so the capability exists in the codebase.

**Recommendation.** When the interaction is significant (or whenever post-hoc is on), add `emmeans(m, ~condition|group)` simple effects — the one set of contrasts committees most often demand. One extra emmeans call; WebR is already running. **Effort M.**

---

### 10. Sphericity correction defaults to GG with no Mauchly-aware advisory *(debatable-default, S)*

**What it is.** RM/Mixed default to GG correction regardless of Mauchly's result (`repeatedMeasuresAnova.ts:22–25`). A student with sphericity met (Mauchly p=.62) still reports GG-corrected fractional df (odd-looking, slightly less powerful); one with severe violation where HF is closer to truth still gets GG. The Mauchly table is output-only.

**Recommendation.** **Post-hoc advisory** in the assumption note: flag when GG was applied but Mauchly was non-significant, or when ε>.75 suggests HF. Keeps user choice, keeps reporting accurate, no re-run, no auto-switching the analysis under them. **Effort S.**

---

### 11. ANCOVA renders a full post-hoc table even when homogeneity-of-slopes fails *(imposed-choice + silent-assumption, S)*

**What it is.** Tukey is hardcoded (`ancova.ts:41`) with no method select, and the adjusted-means post-hoc table renders **regardless** of whether the factor×covariate slope-homogeneity check passed (`ancova.ts:42–50`). The `howToRead` says the adjusted means are invalid if slopes differ — but the table appears anyway. A student who skims reports invalid comparisons.

**Recommendation.** Add a **warning banner on the post-hoc table when any slope-homogeneity p<.05** (prevents silently-invalid inference; UI-layer only) and a **Tukey/Bonferroni select** for parity. Both S, do together. **Effort S.**

---

### 12. Effect-size metric varies across the ANOVA family with no rationale and no choice *(consistency, S–M)*

**What it is.** One-way uses η²; factorial/RM/Mixed/ANCOVA use partial η²; nested uses ω²; KW uses ε²; Friedman uses Kendall's W; Welch uses none (Theme 2). SPSS-faithful but philosophically incoherent — a student running one-way + factorial in one thesis reports two different metrics. The one-way `howToRead` even says "η² (or ω²)" though only η² is computed.

**Recommendation.** **Fix Welch (Theme 2) first.** Then either standardize the parametric family to partial η² (numerically identical to η² for one-factor, so transparent) **or** add an η²/ω² select on one-way (ω² corrects the small-sample upward bias many guidelines now prefer; dependency already present). At minimum, document in each `howToRead` which metric is reported and why. **Effort S–M.**

---

### 13. Standardize toggle is incoherent across the regression family *(consistency, S)*

**What it is.** Simple linear always shows β; multiple linear has a toggle defaulting **off** (`multipleLinearRegression.ts:20`); logistic/Poisson show none. The real bug-flavored inconsistency: the multiple-linear **coefficient plot always plots standardized β with CIs even when the toggle is off** (`multipleLinearRegression.ts:85–112`) — so the table shows em-dashes while the plot shows the very thing the table is hiding. Within one card, plot and table contradict.

**Recommendation.** Resolve the plot/table contradiction first — either default the toggle on (the plot is effectively always-on anyway) or make the plot honor the toggle. Add a note to logistic/Poisson explaining standardized log-odds aren't reported. **Effort S.**

---

### 14. Poisson-vs-NB is a manual switch with no dispersion-driven nudge *(debatable-default, S)*

**What it is.** Model select defaults to Poisson (`poissonNegativeBinomial.ts:17`); the dispersion ratio is reported but the table gives no signal that dispersion=3.7 means "switch to NB." Compounded by the single-instance limit (Theme C) — you can't run both and compare AICs in one session.

**Recommendation.** **Conditional dispersion warning** in the builder ("Dispersion = {x} — consider negative binomial") at a documented heuristic threshold (~2). Flags without deciding; decision authority stays with the researcher. **Effort S.**

---

### 15. Welch t-test default vs pooled one-way ANOVA default — inconsistent variance philosophy *(consistency, S)*

**What it is.** Independent t-test defaults to **Welch** (unequal variance, your explicit ruling — `independentTTest.ts:15`); one-way ANOVA runs the **pooled** equal-variance F with Welch ANOVA as a separate catalog entry the student must discover. A student escalating from 2 groups to k groups silently flips variance handling.

**Recommendation.** Surface Levene's result inline on one-way ANOVA + a "switch to Welch's ANOVA" callout when Levene's p<.05. Respects card-per-test, gives a concrete decision path, avoids merging catalog entries. **Effort S.**

---

### 16. No session persistence — a refresh destroys all work *(flexibility-gap, M)*

**What it is.** Zustand `create()` with no persist middleware (`session.ts:138`); only theme is persisted (`App.tsx:16`). A refresh/crash/tab-close wipes the dataset, column classifications, selections, configs, and results; WebR re-inits cold. The R-script export (the reproducibility artifact) is also still "coming in a later slice."

**Why (steelman).** Simplest Zustand setup; "data never leaves the browser" is cleaner to reason about with no serialization layer; persisting Uint8Array figure PNGs is awkward.

**Recommendation.** Ship the **R-script export** (already roadmapped — solves reproducibility independently). Add **explicit JSON save/load** of config (selection + setups + column metadata, *not* raw rows or figures) for the multi-day revision cycle — privacy-safe and avoids the "which slices to persist" question. A `beforeunload` warning is a cheap immediate safety net. (Auto-persist to localStorage, excluding Uint8Array figures, is the best UX if you want it later.) **Effort M.**

---

## PART 3 — The one coherent stance I'd pick

The app currently **straddles** "report vs decide," and the straddle is the real problem — not any single default:

- **Reports neutrally:** logistic, Poisson, Pearson templates ("was associated with," "were correlated").
- **Declares a verdict:** simple/multiple linear, chi-square, all of ANOVA ("significantly," "found an effect") — none computed against α.
- **Pretends to offer a choice it doesn't:** α/CI/tails pills; Pillai/Wilks select ignored by the template; "Dunn's test" pill hiding its Holm adjustment.
- **Decides silently and invisibly:** alphabetical reference level, 0.5 classification threshold, global mean imputation, GG-always.

**The stance: Telos reports numbers and discloses every choice it makes; it never declares a verdict the researcher should declare, and it never shows a control that isn't real.** Concretely that implies:

1. **Strip all verdict words** from templates → neutral everywhere (Theme B / Option 1). The app computes statistics; the student writes the claim.
2. **Every silent decision becomes visible:** reference level (Theme 1), classification threshold (Theme 4), missing-data audit + method disclosure (Theme 5), post-hoc adjustment method in the pill text (Theme 3), GG-vs-Mauchly advisory (Theme 10). Disclosure is almost always S-effort and almost never controversial.
3. **No fake controls:** a pill is either a real setting or relabeled `· fixed` / consolidated into a single guide-step disclosure (Theme A); a select that the output ignores is made to actually drive the output (Theme 7).
4. **Real choices follow disclosure where the need is genuine and the misuse risk is low** — tails behind a pre-registration gate (Theme B/Option B), post-hoc method selects (Theme 3), reference-level picker (Theme 1). Hold α-interactivity (p-hacking risk) until an advisor demand actually surfaces.

This single stance resolves the integrity risk, the consistency complaints, and the "imposed choice" complaints simultaneously — and most of its moves are S-effort text-and-disclosure changes, not architecture.

---

## PART 4 — Checked & set aside (intentional v1 cuts / defensible-as-is)

- **Welch t-test as the independent-samples default** — your explicit robustness ruling; correct, kept (only the *cross-test* inconsistency with one-way ANOVA is flagged, Theme 15).
- **Two-tailed as the *default*** — correct for exploratory thesis work; the issue is only the *fake pill* and the lack of a gated one-tailed escape hatch, not the default itself.
- **`'leave'` (per-test listwise) as the missing-data default** — methodologically correct (matches SPSS/R/Stata); only the *label* and the *impute sibling* need work (Theme 5).
- **Card-per-test catalog structure / linear wizard** — sound v1 architecture; the instance-keying limit (Theme C) is a deliberate, documented v1 cut with a clear v2 path.
- **ggplot2-only figures (recorded decision 9)** — kept; diagnostics improvement (Theme 6) stays inside it.
- **Pillai as the *recommended* multivariate default** — defensible; only the template-ignores-the-select contradiction needs fixing (Theme 7).
- *(No themes were dropped as false positives — all 45 raw findings survived adversarial verification and collapse into the ~22 distinct decisions above.)*

---

## Closing

**These are decisions for you, not bug fixes — nothing here has been changed.** The 45 verified raw findings collapse into ~22 distinct decisions; the highest-leverage one is the verdict-language purge (Part 1B, Option 1, S-effort, integrity-critical), and the cheapest broad win is the disclosure sweep that makes every silent decision visible (Part 3). Once you rule on each — keep / strip-verdicts / disclose / make-real / defer — they fold into the same fix-loop as the audit triage, gated as usual (and remember several template edits need the spec-HTML gate opened first, since consistency tests are spec-locked).