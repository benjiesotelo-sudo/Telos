# Telos spec completeness review — Part 1 (the three HTML specs)

**Date:** 2026-06-11 · **Method:** 6-lens workflow sweep (master flow, inputs cards, outputs cards, cross-file consistency, HTML validity, builder's critic), every finding adversarially verified by an independent refuter. Run `wf_d82dcb79-2eb` (63 agents; survived one rate-limit cutoff via resume).

**Verdict: the specs are structurally complete and in very good shape.** Both companion files contain the identical 46-test set (+1 shared anatomy/rule card each — the working '47 cards' = 46 tests + 1 anatomy card). All 46 input cards are fully drawn (94/94 role slots with hints + constraints, 46/46 option strips, config guides, produces rows; zero TODO/stub text). All 46 output cards have every required section. Zero HTML parse errors, zero duplicate IDs, all relative links resolve. The 3 example bundle trees match their output cards exactly.

**Findings: 49 confirmed** (2 blocker, 36 gap, 11 polish) · 8 refuted as false positives. Severity: **blocker** = needs an author decision before a builder can proceed; **gap** = missing/inconsistent spec content with an obvious fix; **polish** = cosmetic/wording.

Nothing has been changed in any spec file — findings only, per the decision protocol.

## Blockers — need Benjie’s decision (2)

### B1. telos_test_outputs.html — CB-SEM card (lines 1091-1118) and PLS-SEM card (lines 1121-1146); vs telos_ui_spec.html lines 265-266, 313 and telos_test_inputs.html lines 2484, 2516, 2853
*Lens: cross-file*

Mediation/moderation output is promised by the master spec and configurable on both SEM canvases, but neither SEM output card defines any mediation/moderation table (no indirect-effects, no bootstrapped-CI, no interaction table). A builder cannot render results for a drawn mediation path without an author decision (own table vs rows in the structural-paths table, and with what columns).

> **Evidence:** ui_spec line 313: 'a single SEM selection expands into EFA → CFA → fit → structural → mediation/moderation'; lines 265-266: CB-SEM/PLS-SEM 'includes path analysis & mediation/moderation'. Inputs CB-SEM canvas caption (2484): '+ optional mediation / moderation'; both guides say 'including any mediation or moderation'. Grep of telos_test_outputs.html for 'mediat|moderat|indirect' returns zero hits; CB-SEM stage note (1094) lists only 'EFA → CFA → fit → structural', and CB-SEM Tables 1-6 / PLS-SEM Tables 1-5 contain only direct paths.

### B2. telos_ui_spec.html — Step 4a missing-data handling (line 174)
*Lens: builder-critic*

The global missing-data control's semantics are undefined: 'Impute' is the default but no imputation method is specified anywhere (mean? median? mode for categoricals?), and 'Leave as-is' has no defined run-time behavior per test (does each test listwise-delete its own role columns? what N is reported?). This default silently shapes every number in the report and the contents of data/cleaned.csv, and only the SEM card defines its own handling.

> **Evidence:** Line 174: 'Drop rows · Impute (default) · Leave as-is' is the entire specification. grep for 'imput' across all three files finds no method anywhere except SEM's 'MI — multiple imputation, pooled' (inputs line 2509), which is SEM-only.

## Gaps — missing/inconsistent content, obvious fixes (36)

### G1. telos_test_inputs.html — AVE toolbar ~2582, CR toolbar ~2638 vs CB-SEM ~2442 / PLS-SEM ~2795
*Lens: inputs-cards*

The AVE and CR measurement-only canvases omit the '× Delete' pill that the CB-SEM and PLS-SEM toolbars include (they show only Move, + Construct, and a dimmed Draw path), leaving no drawn way to remove a mis-dropped item or construct on those two cards. Unclear if intentional.

> **Evidence:** Line 2442 (CB-SEM): pills Move, → Draw path, × Delete, + Construct. Line 2582 (AVE) and 2638 (CR): pills Move, + Construct, dimmed → Draw path only — no Delete.
>
> *Verifier recalibrated severity polish → gap.*

### G2. telos_test_inputs.html — CB-SEM (~2436–2524), AVE (~2576–2630), CR (~2632–2685), PLS-SEM (~2789–2859) vs shared rule (~183–184) and legend (~2870–2872)
*Lens: inputs-cards*

The four canvas cards show no column/item palette and never say where the student drags items FROM. The shared-rule card promises every configure screen has '① a palette of the Used, level-compatible columns', and the bottom legend says only the role slots are replaced by the canvas — so by the file's own claims the palette should still exist on these cards, but it is absent and its placement/content is unspecified.

> **Evidence:** Line 184: 'Every configure screen has the same four parts: ① a palette of the Used, level-compatible columns …'; line 2872: 'Latent-variable models (CB-SEM, PLS-SEM, AVE, CR) replace the role slots with a model-building canvas'; CB-SEM card body (2440–2485) contains only the amosbar toolbar + SVG + caption 'drag an item onto a construct' with no palette or drag-source statement; same for AVE, CR, PLS-SEM.

### G3. telos_test_inputs.html — Cronbach's alpha (~2539–2553), Repeated-measures ANOVA (~660–672), Friedman (~1172–1184)
*Lens: inputs-cards*

Three cards grey chips for reasons the stated slot constraints cannot compute, so a builder cannot derive the greying from the spec. Cronbach's alpha greys pu1 as 'belongs to a different construct', but nothing upstream (step 4 or this card) defines where item-to-construct membership comes from at configure time. RM-ANOVA and Friedman grey 'group' as 'between-subjects label / single grouping column' even though their Subject ID slots state 'any level · exactly 1', which group satisfies. The greying rule for ID-like and construct-membership semantics is unspecified.

> **Evidence:** Line 2541: greyed 'pu1 — belongs to a different construct' vs line 2550 slot cons 'ordinal / interval · 2 or more · one construct' (no membership source defined). Line 662: greyed 'group — between-subjects label, not a repeated measure' vs line 671 Subject ID cons 'any level · exactly 1'. Line 1174: greyed 'group — single grouping column, not repeated measures' vs line 1183 Subject ID cons 'any level · exactly 1'.

### G4. telos_test_inputs.html — Greyed-palette reasons: Cronbach's alpha (line 2541), Friedman (lines 1174–1175), RM-ANOVA (line 662)
*Lens: builder-critic*

Several drawn grey-out reasons require semantic knowledge the data model cannot provide: 'pu1 belongs to a different construct' (no construct membership exists before the student defines constructs), 'satisfaction — measured once, not across time' and 'group — between-subjects label, not a repeated measure' (nothing identifies which columns are repeated measures of the same variable). The actual computable greying rule for these cards — versus these illustrative captions — is unspecified.

> **Evidence:** Line 2541: '<span class="colchip greyed">pu1 <span class="reason">belongs to a different construct</span>'; line 1175: 'satisfaction — measured once, not across time'. No file defines a mechanism (e.g. step-4 scale grouping) that would make these reasons derivable.

### G5. telos_test_inputs.html — PLS-SEM Produces row (line 2856); vs telos_test_outputs.html PLS-SEM Tables 1-5 (lines 1124-1134)
*Lens: cross-file*

The PLS-SEM input preview lists four tables but the output card defines five — 'Table 5. Structural model quality (per endogenous construct)' (R², R²adj, Q²) is not fronted, and Q² appears nowhere in the input card. This breaks the agreed convention that the preview fronts every table the output produces (R² is even attributed to the structural-paths item, but in outputs R² lives in Table 5, not Table 4).

> **Evidence:** Inputs 2856: 'Produces — tables: outer loadings/weights, reliability & validity (CR/AVE/ρA), HTMT discriminant validity, structural paths (β, R², f²)' — 4 items. Outputs 1131-1134: 'Table 4. Structural paths' (β, t, p, CI, f²) AND 'Table 5. Structural model quality (per endogenous construct)' (R², R²adj, Q²); bundle (1143) includes a fifth table file 'table_structural-quality.png'.

### G6. telos_test_inputs.html — PLS-SEM card, options strip ~2846–2849
*Lens: inputs-cards*

PLS-SEM's options are only 'weighting' and 'bootstrap'; the card is silent on missing-data handling, while CB-SEM devotes an optpill plus a full open estimator-aware dropdown to it. A builder cannot tell whether PLS-SEM follows the global step-4a setting, uses a PLS-specific default (e.g. mean replacement/pairwise), or should also get a dropdown.

> **Evidence:** Lines 2846–2849 show only <span class="optpill">weighting · path</span> and <span class="optpill">bootstrap · 5000</span>; CB-SEM by contrast has 'missing · MI' (2503), the ddcap/ddmenu (2506–2512), and the step-4a warning note (2523). The PLS-SEM guide (2853) never mentions missing data.

### G7. telos_test_inputs.html — PLS-SEM options strip (lines 2844-2850); vs telos_ui_spec.html SEM branch (line 324)
*Lens: cross-file*

ui_spec's missing-data branch is scoped to 'if SEM is selected', but the PLS-SEM input card defines no missing-data control and no step-4a warning (options are only weighting + bootstrap; all missing-data UI lives in the CB-SEM card). A builder cannot tell whether PLS-SEM participates in the SEM missing-data branch or silently uses the global step-4a setting.

> **Evidence:** ui_spec 324: 'Branch · if SEM is selected — SEM runs its own missing-data path ... warns if it differs from your global (step 4a) setting'. Inputs PLS-SEM optstrip (2846-2849) contains only 'weighting: path' and 'bootstrap: 5000'; grep for 'missing' in the inputs file hits only CSS (141) and the CB-SEM card (2503-2523), never PLS-SEM.

### G8. telos_test_inputs.html — Poisson/NB (~1719, 1732), ARIMA/econometrics Time slots (~1787, 1797, 1839), RM-ANOVA/Friedman id chips (~655, 1167), Nested ANOVA (~716)
*Lens: inputs-cards*

Slot constraints and chips use measurement levels a student cannot set in step 4a: 'count · non-negative integers' (Poisson outcome), 'datetime / ordered' (all Time slots), 'id' (subject identifiers), 'nom·nested' (classroom). The master spec's step-4d offers only nominal/ordinal/interval/ratio (auto-detected dtypes are read-only). No mapping rule says how step-6 eligibility — and therefore the step-6 'blocked because roles cannot be filled' rule — is computed for these slot types.

> **Evidence:** Inputs line 1732: cons 'count · non-negative integers · exactly 1'; line 1797: cons 'datetime / ordered · exactly 1'; line 655 chip 'participant_id (id)'; line 716 chip 'classroom (nom·nested)'. Master spec telos_ui_spec.html line 180: 'Student sets measurement level… nominal · ordinal · interval · ratio · exclude toggle'; line 178: auto-detected types are read-only.

### G9. telos_test_inputs.html — Slot constraints across cards: RM-ANOVA (line 655), Nested ANOVA (line 716), Poisson/NB (lines 1719, 1732), ARIMA (lines 1787, 1797), Fixed effects (line 1839) — vs telos_ui_spec.html step 4d (line 180)
*Lens: builder-critic*

The eligibility/level system is unimplementable as written: step 4d lets the student assign only nominal/ordinal/interval/ratio, but the role-slot constraints and palette chips use level tags that don't exist in that vocabulary — 'id', 'nom·nested', 'count · non-negative integers', 'datetime / ordered', 'ordered'. There is no rule for how a column acquires these levels (auto-derived from dtype? assignable at step 4? inferred from data values?), so the grey-out/blocking engine for ~a third of the tests cannot be built without the author.

> **Evidence:** ui_spec line 180: 'nominal · ordinal · interval · ratio · exclude toggle' is the entire level-setting UI. inputs line 655: 'participant_id <span class="lv">id</span>'; line 1732: 'count · non-negative integers · exactly 1'; line 1797: 'datetime / ordered · exactly 1'; line 716: 'classroom <span class="lv">nom·nested</span>'. No file defines how these map onto or extend the four step-4 levels.
>
> *Verifier recalibrated severity blocker → gap.*

### G10. telos_test_inputs.html — Summary statistics card, ~lines 225–244 and 258
*Lens: inputs-cards*

The only category column drawn (group) is greyed with reason 'categorical → use Frequencies', yet the card's own optional 'Group by' slot accepts 'nominal / ordinal · 0 or 1' and the config guide tells the student to drag a category column there. This directly violates the house rule (grey only if a column fits NO role on the card) and leaves the depicted screen with no draggable column for its Group-by role.

> **Evidence:** Line 227: <span class="colchip greyed">group <span class="reason">categorical → use Frequencies</span></span>; lines 240–242: slot 'Group by (optional)' with cons 'nominal / ordinal · 0 or 1' and hint 'e.g. optional category to split by — gender'; line 258 guide: 'Optionally drag one category column into Group by'.

### G11. telos_test_outputs.html — ANCOVA card, lines 396-415 (note line 404, R map line 411, bundle line 412)
*Lens: outputs-cards*

Same pattern: the assumption note promises 'post-hoc on adjusted means' and the R map maps 'emmeans -> adjusted means & post-hoc', but no post-hoc table skeleton is drawn and the bundle (table_adjusted-means.png, table_ancova.png, figure_adjusted-means.png) contains no posthoc file.

> **Evidence:** Line 404: 'assumption checks: homogeneity of regression slopes ... & Levene's; post-hoc on adjusted means.' Line 411: 'emmeans -> adjusted means & post-hoc'. Only Tables 1-2 exist on the card.

### G12. telos_test_outputs.html — CB-SEM card (lines 1090–1118) and PLS-SEM card (lines 1120–1146) vs telos_ui_spec.html lines 265–266, 313 and telos_test_inputs.html line 2484
*Lens: builder-critic*

Mediation/moderation is promised three times (step-5 tree notes, step-7 'expands into … structural → mediation/moderation', canvas caption '+ optional mediation / moderation') but is specified nowhere: the canvas interaction defines only item-drag and two-construct paths — no mechanism for declaring a moderator/interaction — and neither SEM outputs card has an indirect-effects or moderation table (CB-SEM ends at Table 6 structural paths).

> **Evidence:** ui_spec line 313: 'a single SEM selection expands into EFA → CFA → fit → structural → mediation/moderation'; inputs line 2484: 'click two constructs to draw a structural path · + optional mediation / moderation' (no further mechanism); outputs CB-SEM tables are EFA suitability/loadings, CFA loadings, reliability, fit, structural paths only — grep 'indirect' returns nothing.

### G13. telos_test_outputs.html — CB-SEM card, lines 1090-1118 (how-to-read line 1111, Table 6 lines 1105-1106, R map line 1114)
*Lens: outputs-cards*

The how-to-read text tells the student to read R-squared ('R2 shows variance explained in each outcome construct'), but no CB-SEM table carries R-squared (Table 6 structural paths has Path/Std. beta/SE/z/p/CI only), and the R map has no entry producing it (e.g. lavInspect(fit, 'rsquare')). Either add R-squared to a table or drop the sentence. PLS-SEM, by contrast, has a dedicated R2/Q2 table.

> **Evidence:** Line 1111: '...R2 shows variance explained in each outcome construct.' Table 6 header (line 1106): Path, Std. beta, SE, z, p, 95% CI. R map (line 1114) lists no R-squared source.

### G14. telos_test_outputs.html — Nested ANOVA card, lines 354-371 (table line 359, note line 360, R map line 367)
*Lens: outputs-cards*

The table note promises an effect size ('Variance components (or omega-squared) are reported as the effect size where estimable') but the single table has no effect-size column, no separate variance-components table is drawn, and the R map has no function producing it (only aov() -> table, ggplot2 -> figure). A builder does not know where this value renders or how it is computed.

> **Evidence:** Line 359 table headers are Source/SS/df/MS/F/p only. Line 360: 'Variance components (or omega-squared) are reported as the effect size where estimable.' Line 367 R map lists only aov() and ggplot2.

### G15. telos_test_outputs.html — Pearson correlation card, APA template, line 559
*Lens: outputs-cards*

The APA write-up template hard-codes concrete variable names 'post and pre scores' instead of generic placeholders, even though the independent t-test is the single designated exemplar. Other templates use generic forms (e.g. Fisher's '[Var1] by [Var2]', 'Predictor X'). Obvious fix: '[X] and [Y] were correlated, r(__)=__, ...'.

> **Evidence:** Line 559: 'APA template: "post and pre scores were correlated, r(__)=__, p=__, 95% CI [__, __]."' No exemplar tag on this card; line 236 marks only the independent t-test as 'exemplar - illustrative numbers'.

### G16. telos_test_outputs.html — Repeated-measures ANOVA card (lines 332-352); vs telos_test_inputs.html RM-ANOVA Produces row (line 699)
*Lens: cross-file*

The inputs preview promises a post-hoc table and the output card itself says 'post-hoc table follows' and maps emmeans → post-hoc, but the card defines no post-hoc table skeleton and the bundle omits table_posthoc.png. Every other ANOVA-family card (one-way, factorial, Welch, Kruskal-Wallis, Friedman) defines the post-hoc table and bundles it. Obvious fix: add a Table 4 post-hoc (like one-way ANOVA's Table 3) and table_posthoc.png.

> **Evidence:** Inputs line 699: 'Produces — tables: descriptives, RM-ANOVA, sphericity, post-hoc'. Outputs define only Table 1 Condition descriptives, Table 2 RM ANOVA, Table 3 Sphericity; note at line 341 says '...post-hoc table follows'; R map (348) includes 'emmeans → post-hoc'; bundle (349) is 'table_descriptives.png · table_rm-anova.png · table_sphericity.png · figure_profile.png' — no posthoc file.

### G17. telos_test_outputs.html — Repeated-measures ANOVA card, lines 331-352 (note line 341, R map line 348, bundle line 349)
*Lens: outputs-cards*

A post-hoc table is promised but never drawn: the table note says 'post-hoc table follows' and the R map includes 'emmeans -> post-hoc', yet there is no post-hoc table skeleton with columns, and the bundle (table_descriptives.png, table_rm-anova.png, table_sphericity.png, figure_profile.png) has no posthoc file. Every other ANOVA-family card (one-way, factorial, Welch, Kruskal-Wallis, Friedman) draws its post-hoc skeleton as a numbered table.

> **Evidence:** Line 341: 'when sphericity is violated the F-test uses the Greenhouse-Geisser / Huynh-Feldt correction; post-hoc table follows.' Line 348 R map: 'emmeans -> post-hoc'. Card has only Tables 1-3 (descriptives, RM-ANOVA, sphericity); bundle line 349 lists no table_posthoc.png.

### G18. telos_test_outputs.html — Runtime note (line 113) and all table cards
*Lens: builder-critic*

Number-formatting rules for filling the '—' cells are nowhere specified: decimals per statistic, p-value formatting (exact vs 'p < .001' floor, 3 decimals, leading-zero policy for p/r/η²), CI bracket style, and how the fill-in-the-blank APA templates get their values formatted. The t-test exemplar implies conventions (72.40, .002, [−10.6, −2.4]) but its CI uses 1 decimal while means use 2 — the builder needs an explicit rule set.

> **Evidence:** Line 113: 'cells display "—" because they are filled at runtime from the student's data' with no formatting spec; grep 'round|decimal|leading zero' returns only CSS. Exemplar rows (lines 241, 244) are the only precedent and are internally inconsistent on decimal places.

### G19. telos_test_outputs.html — Whole file / run pipeline (engine section of telos_ui_spec.html lines 373–381)
*Lens: builder-critic*

No run-time failure or edge states anywhere: what the results page and PDF show when a test errors (SEM/ARIMA non-convergence, singular regression, zero-variance column, Fisher's exact on a huge table), no per-test minimum-N rules (the eligibility rules are level/arity only, so a 2-row dataset passes), no all-values-missing column behavior, and no step-5 state for 'every test greyed out'. A builder must invent the entire error layer.

> **Evidence:** grep across all three files for 'fail', 'error', 'converge', 'invalid', 'too few' returns no run-time handling. The only blocking concept specified is role-fill blocking (ui_spec line 282); outputs file line 113 only says cells are 'filled at runtime'.

### G20. telos_ui_spec.html — 'Branch · if SEM is selected' card (line 324); vs telos_test_inputs.html CB-SEM missing-data control (lines 2503-2512, 2523)
*Lens: cross-file*

ui_spec says 'SEM runs its own missing-data path (FIML)', but the decided/drawn control is an estimator-aware dropdown (FIML / MI / pairwise / listwise) whose drawn default is MI (because the example uses WLSMV, where FIML is unavailable). The '(FIML)' wording is stale and would mislead a builder reading only the master spec. Obvious fix: reword to 'estimator-aware missing-data path (FIML / MI)'.

> **Evidence:** ui_spec 324: 'SEM runs its own missing-data path (FIML) / warns if it differs from your global (step 4a) setting'. Inputs 2506: 'missing-data method · follows your estimator (here ordinal → WLSMV → MI; FIML needs ML/MLR)'; 2508: FIML row marked 'off' / 'not available with WLSMV'; 2509: 'MI ✓' selected.

### G21. telos_ui_spec.html — Coral 'Branch · if SEM is selected' node, line 324
*Lens: master-flow*

The SEM missing-data node is stale relative to the decided design and oddly placed. It says SEM 'runs its own missing-data path (FIML)' — hardcoding FIML — whereas the decided (and inputs-companion-confirmed) design is an estimator-aware control (FIML for ML/MLR, MI for WLSMV, etc.) that auto-follows the estimator. The node also hangs off the flow AFTER step 7 Results, though the control actually lives in step-6 SEM configuration. Obvious fix: reword to 'estimator-aware missing-data handling' and anchor it to step 6.

> **Evidence:** Line 324: 'SEM runs its own missing-data path (FIML)<br/>warns if it differs from your global (step 4a) setting', rendered as the last node after the step-7 rcard. telos_test_inputs.html says 'missing-data handling follows the estimator (FIML / MI) (warns if it differs from your global step-4a setting…)'.

### G22. telos_ui_spec.html — Dynamic navigator caption line 156 and step gating notes lines 181, 282
*Lens: master-flow*

Back navigation is explicitly allowed ('back steps clickable') but downstream-invalidation behavior is unspecified: what happens to picked tests, completed per-test configurations, and already-rendered results if the student goes back and changes a column's level/Use toggle at step 4 or the test selection at step 5 (e.g., a configured test's role column becomes excluded). Reset, partial invalidation, or warn-and-keep is a flow-level decision the builder would have to invent.

> **Evidence:** Line 156: 'Sticky · back steps clickable · each test step opens only once the steps before it are complete' — forward gating is defined, but no rule covers editing an earlier completed step after later steps exist.

### G23. telos_ui_spec.html — Navigator caption (line 156) and step-6 note (line 282)
*Lens: builder-critic*

Back-navigation invalidation is unspecified: 'back steps clickable' but nothing says what happens to downstream state when an upstream step changes (new upload, level change, step-4a change, test re-selection) — are test configs preserved, partially invalidated, or wiped? Relatedly, a test blocked at step 6 plus 'Run analysis stays disabled until each one is fully configured' is a dead end with no specified affordance to deselect/skip the blocked test from step 6.

> **Evidence:** Line 156: 'Sticky · back steps clickable · each test step opens only once the steps before it are complete'. Line 282: blocked test 'is blocked here with the reason' — no removal/skip control is described anywhere, and no file mentions state invalidation on edits.

### G24. telos_ui_spec.html — Results — engine & formats (our side), lines 371-392, vs analytics note line 320 and zip rules line 366
*Lens: master-flow*

Fundamental contradiction about where the R pipeline runs. The engine section says 'the backend container ships Quarto + TinyTeX + the R packages' (line 391) and the zip rules say analysis.R runs 'on the student's own machine — not just on the server' (line 366), both implying server-side compute with the data; but the analytics note (line 320) promises 'the uploaded dataset never leaves the browser'. 'WebR' appears nowhere in any of the three spec files (grep confirms zero hits), so the in-browser half of the supposed R/WebR architecture is entirely unspecified. A builder cannot start the engine without the author resolving browser-vs-server.

> **Evidence:** Line 320: 'no personal data; the uploaded dataset never leaves the browser'. Line 391: 'the backend container ships Quarto + TinyTeX + the R packages'. Line 366: 'so analysis.R runs via a relative path on the student's own machine — not just on the server'. grep -ri 'webr' over all three HTML files returns nothing.
>
> *Verifier recalibrated severity blocker → gap.*

### G25. telos_ui_spec.html — Step 1 Welcome (line 163) and step 3 Terms guide (line 169)
*Lens: builder-critic*

Two whole content screens have no authored copy anywhere in the three files: the Welcome/about text ('what Telos is, services, analysis types, credits') and the step-3 educational guide ('Type vs level · the 4 levels · missing-data handling'). Unlike the how-to-read layer (fully drafted per test in the outputs file), this copy must come from the author.

> **Evidence:** Line 169: '3 · Terms guide — Type vs level · the 4 levels · missing-data handling' is the entire specification of that screen; no body text for it or for the Welcome screen exists in any of the three files.

### G26. telos_ui_spec.html — Step 2 Upload (line 166) and step 4b file summary (line 176)
*Lens: builder-critic*

Upload is one line with no operational detail: accepted extensions (.xls vs .xlsx?), Excel multi-sheet workbooks (which sheet? a picker?), CSV delimiter/decimal-separator/encoding rules (4b displays 'encoding' read-only but nothing says what encodings parse), header-row assumption, and any file-size/row/column limits. Parse-failure UI is unspecified.

> **Evidence:** Line 166: 'Choose CSV or Excel file, auto-detect on parse' is the full upload spec. grep for 'sheet', 'delimiter', 'header', 'MB', 'limit' across all three files returns no upload-related hits.

### G27. telos_ui_spec.html — Step 2 · Upload data, lines 166-167
*Lens: master-flow*

The upload step specifies only the happy path: 'Choose CSV or Excel file, auto-detect on parse' with transition 'File parsed'. No parse-failure state (corrupt/unsupported/empty file), no file-size limit, and no Excel multi-sheet handling (which sheet is parsed, or whether the student picks one). A builder must invent the entire error/edge branch of the very first data interaction.

> **Evidence:** Lines 166-167: '<div class="t">2 · Upload data</div><div class="s">Choose CSV or Excel file, auto-detect on parse</div>' followed by '<span class="lbl">File parsed</span>' — the only specified transition; no other states exist for this step.

### G28. telos_ui_spec.html — Step 4c/4d (lines 178–181)
*Lens: builder-critic*

No rule connecting auto-detected dtype to the student-set level: does 4d pre-fill a suggested level per dtype, or start empty? Is there a dtype→level compatibility constraint (e.g. can an 'object' column be set to ratio)? And the detected type is read-only with no override, so a numeric column parsed as object (stray text, '1,5' decimals) can never become usable — no correction path is specified.

> **Evidence:** Line 178: 'Auto-detected type per column (read-only) — int64 · float64 · object · bool · datetime64'; line 180: 'Student sets measurement level + name + Use'. No mapping, default, or override rule appears in any file (grep 'detect', 'default level', 'suggest').

### G29. telos_ui_spec.html — Step 5 tree, CB-SEM leaf (line 265); vs telos_test_inputs.html CB-SEM pipeline strip (lines 2490-2500)
*Lens: cross-file*

ui_spec says CB-SEM 'auto-runs EFA → CFA → structural', which contradicts the decided and drawn pipeline-stage selector where EFA and structural are optional (CFA + fit locked on). Obvious fix: reword the leaf note to reflect selectable stages with full pipeline as default.

> **Evidence:** ui_spec 265: 'CB-SEM — auto-runs EFA → CFA → structural; includes path analysis & mediation/moderation'. Inputs 2490: 'pipeline — stages to run · CFA & fit always on; EFA & structural optional'; 2500: 'deselect EFA for a confirmatory-only run ... deselect structural to stop at the measurement model'.

### G30. telos_ui_spec.html — Step 6 config card (line 281) and step 7 results card (lines 287-321); also telos_test_inputs.html companion line (163)
*Lens: cross-file*

telos_test_outputs.html is unreachable from the other two files: ui_spec links only to telos_test_inputs.html (step 6) and gives the step-7 results section no companion pointer, and the inputs file links only to telos_ui_spec.html. Only the outputs file cross-links both siblings. Obvious fix: add an outputs link in ui_spec step 7 (mirroring the step-6 pattern) and in the inputs companion banner.

> **Evidence:** Grep of hrefs: ui_spec has only 'telos_test_inputs.html' (281), a LinkedIn URL, and the Google-form placeholder; inputs has only 'telos_ui_spec.html' (163); outputs links both files (112, 1157). All existing links resolve to files present in /Users/benjie/Documents/Telos/, but no path leads to telos_test_outputs.html.

### G31. telos_ui_spec.html — Step 6 options summary (line 279) vs logistic regression card (telos_test_inputs.html lines 1656–1708) and multiple regression (lines 1550–1602)
*Lens: builder-critic*

The master spec promises a 'reference group' option among test-specific options, but no card in the inputs file has one. Concretely needed: logistic regression has no control for which outcome category is the modeled event (OR direction is undefined for 'passed'), and regression cards say categorical predictors 'are dummy-coded for you' with no reference-level rule (first alphabetical? most frequent?).

> **Evidence:** ui_spec line 279: 'alpha · one- / two-tailed · CI % · post-hoc method · reference group · etc.'. grep 'reference group|reference categ|event level' finds zero occurrences in telos_test_inputs.html; logistic options (lines 1694–1698) are only α / CI / report-odds-ratios.

### G32. telos_ui_spec.html — Step 7 feedback block, line 318, vs Open items section lines 394-398
*Lens: master-flow*

The feedback button's href is still the literal placeholder 'https://docs.google.com/forms/REPLACE_WITH_YOUR_FORM', an author-supplied value that does not yet exist — while the Open items section claims 'None currently outstanding'. The real Google Form URL is an outstanding item the builder cannot invent.

> **Evidence:** Line 318: '<a href="https://docs.google.com/forms/REPLACE_WITH_YOUR_FORM" target="_blank" ...>How did it go? — Share feedback'. Line 397: '<i>None currently outstanding.</i>'.

### G33. telos_ui_spec.html — Step 7 feedback card (line 318)
*Lens: builder-critic*

The feedback link is an explicit placeholder URL; the real Google Form link must be supplied before build/ship.

> **Evidence:** Line 318: href="https://docs.google.com/forms/REPLACE_WITH_YOUR_FORM".
>
> *Verifier recalibrated severity polish → gap.*

### G34. telos_ui_spec.html — Step 7 results card, lines 287-321; only companion link is in step 6 at line 281
*Lens: master-flow*

telos_test_outputs.html is never referenced or linked anywhere in the master spec. Step 6 links telos_test_inputs.html for per-test configuration, but step 7's per-test preview block ('NN · Test name' placeholder, lines 304-312) has no pointer to the companion that defines all 46 output cards. A builder reading the master alone would not know the per-test tables/figures/how-to-read content is fully specified elsewhere. Obvious fix: add a parallel 'see telos_test_outputs.html' link in the step-7 card.

> **Evidence:** grep -c 'telos_test_inputs.html' returns 1 (line 281); grep -c 'telos_test_outputs.html' returns 0. Line 281: 'see telos_test_inputs.html · CB-SEM gets its own model-building canvas' — no equivalent for outputs.

### G35. telos_ui_spec.html — Step 7 results note (line 320) vs 'Results — bundle' and 'Results — engine & formats' (lines 366, 391)
*Lens: builder-critic*

Direct architecture contradiction: the results card claims the dataset never leaves the browser, but the engine section specifies a server-side render (backend container with Quarto/TinyTeX/R) and the bundle section says analysis.R runs 'not just on the server'. A builder cannot decide client-side vs server-side compute, where parsing/type-detection runs (the dtype vocabulary at line 178 is pandas-style, yet the engine is R), or what is actually uploaded.

> **Evidence:** Line 320: 'the uploaded dataset never leaves the browser'. Line 391: 'the backend container ships Quarto + TinyTeX + the R packages'. Line 366: 'so analysis.R runs via a relative path on the student's own machine — not just on the server'.
>
> *Verifier recalibrated severity blocker → gap.*

### G36. telos_ui_spec.html — Transition between step 6 and step 7, line 285
*Lens: master-flow*

The 'Click "Run analysis"' arrow goes straight to the Results page with no intermediate state: no run-in-progress/loading indication (SEM or multi-test runs will take noticeable time) and no run-failure state (e.g., model non-convergence) at the flow level. The builder must invent what the screen shows between click and rendered preview, and where a failed run lands.

> **Evidence:** Line 285: '<div class="arrow"><span class="lbl">Click "Run analysis"</span></div>' immediately followed by the step-7 rcard (line 287); no other state is described anywhere between steps 6 and 7.

## Polish — cosmetic/wording (11)

### P1. telos_test_inputs.html — Example-dataset note, line 204, vs ~10 non-econometrics cards
*Lens: inputs-cards*

The intro claims only econometrics screens use their own alternate columns, but many non-econometrics cards also introduce columns outside the declared example dataset: RM-ANOVA (participant_id, score_t1–t3), Friedman (rating_t1–t3), Nested ANOVA (school, classroom), MANOVA/MANCOVA (wellbeing), Logistic (passed), Poisson (complaints, months_observed), RDD (test_score, exam_mark, school), IV (wage, schooling, distance_to_school, region), PSM (earnings, treated, baseline_score), PCA (x1–x5, region). Obvious fix: broaden the ds-note to 'some tests show their own illustrative columns'.

> **Evidence:** Line 204: 'Econometrics screens assume a time-indexed / panel dataset instead — those screens show their own columns (e.g. month, sales, firm_id, year, treated, post).' vs e.g. line 655 'participant_id', 716 'classroom (nom·nested)', 888 'wellbeing', 1665 'passed', 1719 'complaints (count)', 2745–2749 'x1…x5' — none in the example dataset at lines 192–203.
>
> *Verifier recalibrated severity gap → polish.*

### P2. telos_test_inputs.html — Produces meta-rows: Chi-square goodness-of-fit (1484), Kendall's tau (1435), RDD (2298), CB-SEM (2519), Poisson (1766), IV (2363); vs corresponding outputs cards
*Lens: cross-file*

Produces-label granularity is inconsistent with the one-item-per-table convention: chi-square GOF says singular 'table:' yet fronts two output tables; Kendall and RDD say 'table(s)' but front one; CB-SEM's single item 'EFA' fronts two output tables (Table 1 EFA suitability + Table 2 EFA rotated loadings); Poisson's 'dispersion check' and IV's 'diagnostics' are listed under 'tables:' but are delivered in outputs as a column/inline note, not tables.

> **Evidence:** Inputs 1484: 'Produces — table: observed vs expected, χ²' vs outputs Table 1 Observed vs. expected + Table 2 Goodness-of-fit test. Inputs 2519: 'tables: EFA, CFA loadings, ...' vs outputs Tables 1-2 both EFA. Inputs 1766: 'tables: coefficients (rate ratios), fit, dispersion check' vs outputs Table 1's 'Dispersion' column + tbl-note (743); inputs 2363: 'tables: first-stage + 2SLS coefficients, diagnostics' vs outputs tbl-note (930): 'diagnostics: weak-instrument..., Wu–Hausman..., Sargan...'.

### P3. telos_test_outputs.html — 'Where we are' navbar (lines 117-124, 'Configure each test' at 121)
*Lens: cross-file*

The outputs navigator shows a single static 'Configure each test' step, which matches neither ui_spec navbar state (5 plain steps before selection; expanded per-test pills after selection) nor the inputs file's navbar, which correctly shows the pill group. By step 7 the bar should show the per-test pills.

> **Evidence:** Outputs 121: '<span class="nstep">Configure each test</span>'. ui_spec 147: 'the moment tests are picked at step 5, the bar expands — every selected test becomes its own configure step'; inputs 172 renders the ngroup pills ('① selected test ② … ③ …').

### P4. telos_test_outputs.html — CB-SEM bundle (lines 1094 vs 1115); Summary statistics (155 vs 161); Chi-square independence (613 vs 619); Fisher's exact (655 vs 661); PCA (1079 vs 1085)
*Lens: outputs-cards*

Bundle filename lists do not reflect conditional or alternative outputs: CB-SEM's stage-conditional note says EFA/structural tables are omitted per stage selection but the bundle lists all seven files unconditionally; Summary statistics' histogram is '(optional)' yet always in the bundle; cards offering either/or figure types ('mosaic or grouped bar chart', 'scree plot / biplot') hardcode a single filename matching only one alternative (figure_mosaic.png, figure_scree.png).

> **Evidence:** Line 1094: 'if EFA was deselected, Tables 1-2 are omitted...' vs line 1115 bundle listing table_efa-suitability.png and table_efa-loadings.png unconditionally. Line 613: 'type: mosaic or grouped bar chart' vs line 619 'figure_mosaic.png'.

### P5. telos_test_outputs.html — Card names Mann–Whitney U (459) and Kruskal–Wallis (500); vs telos_test_inputs.html (994, 1105) and telos_ui_spec.html tree (211, 213, 202) vs inputs/outputs card title 'One-way ANOVA + post-hoc' (inputs 429, outputs 286)
*Lens: cross-file*

Test-name strings drift across files: outputs use en-dashes ('Mann–Whitney U', 'Kruskal–Wallis') where inputs and ui_spec use hyphens; and the step-5 tree leaf is 'One-way ANOVA' while both companion cards are titled 'One-way ANOVA + post-hoc'. Matters because the build plan derives a registry from these HTML specs, so name strings may serve as keys.

> **Evidence:** Outputs 459: rt-name 'Mann&ndash;Whitney U'; inputs 994: ttl 'Mann-Whitney U'; ui_spec 211: leaf 'Mann-Whitney U'. ui_spec 202: 'One-way ANOVA' vs inputs 429 / outputs 286: 'One-way ANOVA + post-hoc'.

### P6. telos_test_outputs.html — EFA Table 3 (1056-1057), PCA Table 2 (1076-1077), AVE Fornell-Larcker Table 2 (1014-1015), PLS-SEM HTMT Table 3 (1128-1129)
*Lens: outputs-cards*

Matrix-style tables show fixed example columns (Factor 1/Factor 2, PC1-PC3, C1-C3) without the 'columns expand to the number of factors/constructs' note that the equivalent expandable tables carry elsewhere (cross-tab line 176, contingency line 611). The expansion is inferable, but the spec states it explicitly for the other r-x-c tables.

> **Evidence:** Line 176: 'cross-tab columns expand to the number of categories...'; line 611: 'columns expand to the number of categories...'. No analogous note under EFA/PCA loadings, Fornell-Larcker, or HTMT matrices; HTMT note (1130) only says it is 'a construct-by-construct matrix'.

### P7. telos_test_outputs.html — One-sample t-test (line 221) and Independent t-test (line 243) vs Paired t-test (271), One-way post-hoc (294), Factorial (317), Welch (382)
*Lens: outputs-cards*

Inconsistent column-header formatting for the mean difference: 'Mdiff' rendered plain on the one-sample and independent t-test tables but as 'M<sub>diff</sub>' (subscript) on the paired t-test, one-way/factorial post-hoc, and Welch Games-Howell tables.

> **Evidence:** Line 221/243: '<th>Mdiff</th>'; line 271/294/317/382: '<th>M<sub>diff</sub></th>'.

### P8. telos_test_outputs.html — PLS-SEM card, table notes at lines 1130 and 1135
*Lens: outputs-cards*

Duplicated guidance: the note under Table 3 already states 'HTMT < .85/.90 supports discriminant validity', and the note under Table 5 repeats the identical sentence.

> **Evidence:** Line 1130: 'HTMT is a construct-by-construct matrix...; HTMT < .85/.90 supports discriminant validity.' Line 1135: 'significance from bootstrapping; HTMT < .85/.90 supports discriminant validity; R2 and Q2 assess the structural model.'

### P9. telos_test_outputs.html — sub-note (line 111) and legend (line 1157); vs telos_test_inputs.html meta-row tags (e.g. 261, 422)
*Lens: cross-file*

The outputs file twice calls the inputs rows 'the one-line "Outputs" rows', but the inputs file consistently labels them 'Produces —' meta-rows; no row in the inputs file is labelled 'Outputs'.

> **Evidence:** Outputs 111/1157: 'This is the detailed home for the one-line "Outputs" rows in the test config / in telos_test_inputs.html'. Inputs tags all read 'Produces — table(s)/tables: ...' (grep shows 46 'Produces' tags, zero 'Outputs' row labels).

### P10. telos_ui_spec.html — SEM branch card (line 324) vs telos_test_inputs.html CB-SEM missing dropdown (lines 2502–2512)
*Lens: builder-critic*

Stale cross-file summary: the master spec's SEM branch says 'SEM runs its own missing-data path (FIML)', but the decided design in the inputs file is an estimator-aware dropdown whose default here is MI (FIML is disabled under WLSMV). The '(FIML)' label should read estimator-aware (FIML/MI).

> **Evidence:** ui_spec line 324: 'SEM runs its own missing-data path (FIML)'; inputs line 2506: 'follows your estimator (here ordinal → WLSMV → MI; FIML needs ML/MLR)' with the FIML row marked off (line 2508).

### P11. telos_ui_spec.html — Step 5 CB-SEM leaf line 265, step 6 companion note line 281, step 7 preview repeat note line 313
*Lens: master-flow*

Three one-line summaries are stale relative to the decided SEM design: line 265 says CB-SEM 'auto-runs EFA → CFA → structural' and line 313 says a SEM selection always 'expands into EFA → CFA → fit → structural → mediation/moderation', but the decided design is a pipeline-stage selector (EFA optional, CFA + fit locked, structural optional), so the expansion is conditional; and line 281 says only 'CB-SEM gets its own model-building canvas' though PLS-SEM, AVE and CR also get canvases per the inputs companion (4 amoscanvas blocks). Wording-level fixes; the linked companion carries the correct detail.

> **Evidence:** Line 265: 'CB-SEM — auto-runs EFA → CFA → structural; includes path analysis & mediation/moderation'. Line 313: 'a single SEM selection expands into EFA → CFA → fit → structural → mediation/moderation'. Line 281: 'CB-SEM gets its own model-building canvas'. telos_test_inputs.html contains 4 class="amoscanvas" diagrams and a stage selector ('…or the structural stage to validate the measurement model on its own').

## Refuted findings (8) — checked and dismissed

- **(inputs-cards)** Depiction of incompatible columns is inconsistent: equally incompatible Used columns are sometimes greyed with a reason and sometimes simply omitted from the card. Chi-square independence greys post_s
  - *Refuted because:* The cited facts check out (chi-square at telos_test_inputs.html ~1284-1293 greys only post_score; the t-test palette at ~378-388 omits age), but the alleged "inconsistency" is the document's uniform drawing convention, not a defect. Every one of the 22 "Greyed (why)" sections abbreviates: Summary statistics (~220-228) greys only group while omitting method/gender/satisfaction, and the nine ordinal
- **(inputs-cards)** Both nonparametric cards reuse the parametric hint 'e.g. the numeric result you measured — test score, income' on an Outcome slot whose constraint allows ordinal and whose drawn example drops the ordi
  - *Refuted because:* Quoted text verified at telos_test_inputs.html lines 1016/1127, but the claim misreads intent. The 'numeric result' hint over an 'ordinal / interval / ratio' cons with a satisfaction-dropping demo is a consistent house style, not parametric copy-paste: Spearman (1354-1356) and Kendall's tau (1409-1411) use the identical pattern (plain 'numeric' hint, ordinal-permitting cons, satisfaction demo). Th
- **(inputs-cards)** The file contains 46 test configuration cards plus 1 shared-rule anatomy card (47 config blocks total). This matches the master spec's step-5 tree (exactly 46 leaves) and the outputs file (46 test car
  - *Refuted because:* The claim's census is factually correct (verified by grep: inputs has 47 config divs with the first being the shared-rule card at telos_test_inputs.html lines 179-187, so 46 test cards; telos_ui_spec.html has exactly 46 class="leaf" entries; telos_test_outputs.html has 47 rt-name spans with the first being 'Anatomy of a results card' line 128, so 46 test cards — all three registries match one-for-
- **(outputs-cards)** The project-wide count of '47 test cards' actually includes one non-test card: the file contains 46 distinct test output cards plus the anatomy explainer. This is not a missing test - the inputs file 
  - *Refuted because:* The reviewer's counts are factually correct (47 div.rtest in telos_test_outputs.html = anatomy explainer at line 128 + 46 tests; 47 div.config in telos_test_inputs.html = shared-rule header at line 180 + the same 46 tests, mirroring 1:1), but the alleged defect does not exist in any reviewable artifact. The string '47' never appears as a count in any of the three spec files — every grep hit is a C
- **(cross-file)** ui_spec says only 'CB-SEM gets its own model-building canvas', omitting that PLS-SEM shares the same canvas and that AVE/CR get measurement-only canvases — under-describes the decided canvas design re
  - *Refuted because:* The cited ui_spec line 281 is a pointer box that explicitly defers per-test configuration detail to telos_test_inputs.html; 'CB-SEM gets its own model-building canvas' is a one-line teaser there, not an enumeration of canvas-bearing tests. The allegedly-omitted content exists in full in the companion file the pointer links to: inputs line ~2840 sem-cap ('same canvas as CB-SEM', per-construct refle
- **(builder-critic)** PLS-SEM has no missing-data control at all — its options are only weighting and bootstrap — while CB-SEM gets the full estimator-aware FIML/MI/pairwise/listwise dropdown, and the master spec's SEM bra
  - *Refuted because:* The cited facts are accurate (PLS-SEM optstrip at telos_test_inputs.html:2846-2849 has only weighting + bootstrap; the missing-data dropdown appears only on CB-SEM at lines 2503-2523), but the builder is not left without an answer. (1) Master spec step 4a (telos_ui_spec.html:174) defines a GLOBAL missing-data control (Drop rows / Impute default / Leave as-is) and line 284 states step 4 'prepares t
- **(builder-critic)** Whether the same test can run more than once is unspecified. The checkbox tree implies exactly one instance per test, but a thesis student routinely needs e.g. three independent t-tests on three DVs, 
  - *Refuted because:* The reviewer's factual observations check out (no 'run the same test twice' rule is written anywhere; grep across all three files confirms it), but the spec is not ambiguous on this point — it uniformly and determinately encodes 'at most one instance per test per analysis run' at every layer, so a builder can proceed without asking the author. Evidence: (1) Step 5 is a checkbox tree — telos_ui_spe
- **(builder-critic)** The 'expected proportions' option says the student can 'set the proportions yourself', but no input UI is drawn or described for entering k per-category proportions (and no validation rule that they s
  - *Refuted because:* The cited lines exist as described (telos_test_inputs.html:1475 pill 'expected proportions: equal' and :1481 'set the proportions yourself'), but the claim's premise that every other option is a simple dropdown is false, and the omission is the spec's uniform fidelity convention, not a gap unique to this card. Multiple other option pills require custom user-entered values with no entry UI drawn: R

## Lens statistics (sweep agents' censuses)

```json
{
  "master-flow": {
    "master_spec_lines_read": 403,
    "step5_tree_leaves": 46,
    "inputs_companion_test_cards": 46,
    "outputs_companion_test_cards": 46,
    "outputs_extra_card": "Anatomy of a results card exemplar",
    "links_to_inputs_companion": 1,
    "links_to_outputs_companion": 0
  },
  "inputs-cards": {
    "config_blocks_in_file": 47,
    "test_cards": 46,
    "shared_rule_anatomy_cards": 1,
    "test_families": 6,
    "family7_assumption_note_inline": true,
    "slot_based_cards": 42,
    "sem_canvas_cards": 4,
    "cards_with_greyed_sections": 21,
    "role_slots": 94,
    "slots_with_eg_hints": 94,
    "slots_with_constraints": 94,
    "option_strips": 46,
    "config_guides": 46,
    "produces_meta_rows": 46,
    "todo_or_stub_text_found": 0,
    "master_spec_step5_leaves": 46,
    "outputs_file_test_cards": 46,
    "registry_match_across_three_files": true
  },
  "outputs-cards": {
    "rtest_divs_total": 47,
    "test_output_cards": 46,
    "non_test_cards": 1,
    "cards_with_all_required_sections": 46,
    "cards_missing_sections": 0,
    "apa_tables_total_across_cards": 95,
    "table_header_vs_row_cell_mismatches": 0,
    "inputs_file_test_cards": 46,
    "input_output_name_matches": 46,
    "cb_sem_stage_conditional_efa_tables_present": true,
    "pls_sem_structural_quality_table_present": true,
    "pls_sem_htmt_table_present": true,
    "exemplar_cards": 1,
    "files_read_fully": [
      "/Users/benjie/Documents/Telos/telos_test_outputs.html"
    ]
  },
  "cross-file": {
    "test_cards_in_inputs": 46,
    "test_cards_in_outputs": 46,
    "card_containers_per_file": 47,
    "note_on_count": "47 containers per file = 46 test cards + 1 shared-rule/anatomy card; the two files contain the identical 46-test set with identical family grouping",
    "produces_rows_compared": 46,
    "bundle_folders_checked_against_ui_spec_tree": 3,
    "bundle_folder_mismatches": 0,
    "design_language_mismatches": 0
  },
  "html-validity": {
    "files_checked": 3,
    "telos_ui_spec_lines": 403,
    "telos_test_inputs_lines": 2877,
    "telos_test_outputs_lines": 1162,
    "start_tags_parsed": 6970,
    "duplicate_ids": 0,
    "tag_balance_errors": 0,
    "internal_hash_anchors": 0,
    "svg_url_refs_checked": 4,
    "broken_svg_url_refs": 0,
    "script_blocks": 0,
    "relative_file_links_all_resolve": true
  },
  "builder-critic": {
    "input_config_cards_seen": 46,
    "output_result_cards_seen": 46,
    "step5_tree_tests": 46,
    "note": "46 tests are fully consistent across tree/inputs/outputs; the 47th .config/.rtest div in each companion file is the shared-rule/anatomy card, not a test"
  }
}
```
