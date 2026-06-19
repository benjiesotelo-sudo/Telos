# SEM Reporting Convention — Recommendation for Owner Go/No-Go

> **Provenance:** Produced 2026-06-18 by research workflow `wf_f39bf0ab-147` (9 topic researchers with web sources + 14 independent verifiers that confirmed/refuted each contested cutoff & citation against a primary source + synthesis). Every numeric threshold below carries its verification verdict — **[V]** = Confirmed, **[V*]** = Nuanced (corrected value used). This is the document the owner reads to approve ONE citable standard per track before the "Latent variables & SEM" slice (ROADMAP #1: Cronbach's alpha, AVE, CR, EFA, PCA, CB-SEM, PLS-SEM, mediation) is built. NOTHING built or committed against this yet — convention approval is the gate.

> **✅ APPROVED by Benjie — 2026-06-18.** Rulings of record: **(1)** two-track convention adopted (Track A CB-SEM/CFA/EFA/reliability; Track B PLS-SEM; PCA as data reduction). **(2)** Judgment calls: reliability headline = **McDonald's ω with Cronbach's α as a secondary column**; **HTMT primary** for discriminant validity (Fornell-Larcker legacy); **bootstrap default = 5,000 for both tracks** (confirmed 2026-06-19: manual control with 1,000 / 5,000 / 10,000 presets + custom entry + progress bar + time disclaimer; 10,000 = "publication-grade final" option — see §4f UPDATE); **PCA filed under "data reduction,"** not latent variables. **(3)** Path analysis = a **test-picker entry routed to an auto-detected observed-only mode of the CB-SEM card** (§7D). **(4)** **Multigroup analysis = a FOLLOW-ON slice** after the 7 base cards land — §6 is held for that slice, not built now. **Next:** WebR feasibility spike (do lavaan / semTools / psych / seminr load under WebR and match native R 4.6.0?), then spec → plan → build. §5 gaps + §7 path-analysis adaptations fold into the spec.

---

## 1. Recommended convention (the headline)

**Plain-language statement to say yes/no to:** *For the SEM slice we adopt a TWO-TRACK citable standard. Covariance-based work (Cronbach's alpha, AVE, CR, EFA, CB-SEM, mediation) follows the APA SEM reporting module (JARS-Quant, Appelbaum et al. 2018) for WHAT to report and Kline's textbook (5th ed., 2023) for HOW, with Hu & Bentler (1999) supplying the fit-index benchmarks — reported as labelled guidelines, not pass/fail gates (Marsh, Hau & Wen 2004). Variance-based PLS-SEM follows a single named guide, Hair, Risher, Sarstedt & Ringle (2019), "When to use and how to report the results of PLS-SEM." PCA is reported as a data-reduction method per Jolliffe & Cadima (2016), explicitly NOT as a latent-variable model. We keep modelsummary/datasummary for non-SEM tables but adopt dedicated SEM table tooling (lavaan accessors + semTools + a tidy table package) for these cards, exactly as we made the datasummary_balance exception for group descriptives.*

Two tracks because CB-SEM and PLS-SEM are different paradigms with different fit logic (CB-SEM has global fit indices; PLS-SEM deliberately has none).

### Track A — CB-SEM / CFA / EFA / reliability (covariance-based)

| Role | Standard | Authors / year / title / venue | Link |
|---|---|---|---|
| **Primary — what to report** | APA JARS-Quant SEM module (Table 7) | Appelbaum, Cooper, Kline, Mayo-Wilson, Nezu & Rao (2018). *Journal article reporting standards for quantitative research in psychology.* American Psychologist, 73(1), 3–25. | https://doi.org/10.1037/amp0000191 |
| **Primary — how to report** | Kline textbook (latest ed.) | Kline, R. B. (2023). *Principles and Practice of Structural Equation Modeling* (5th ed.). Guilford Press. ISBN 978-1462551910. | https://www.guilford.com/books/Principles-and-Practice-of-Structural-Equation-Modeling/Rex-Kline/9781462551910 |
| **Fit-index benchmarks** | Hu & Bentler | Hu, L. & Bentler, P. M. (1999). *Cutoff criteria for fit indexes…* Structural Equation Modeling, 6(1), 1–55. | https://doi.org/10.1080/10705519909540118 |
| **RMSEA bands + 90% CI rationale** | MacCallum/Browne/Sugawara | MacCallum, Browne & Sugawara (1996). *Power analysis…* Psychological Methods, 1(2), 130–149. | https://doi.org/10.1037/1082-989X.1.2.130 |
| **Cutoffs-not-golden-rules caveat** | Marsh/Hau/Wen | Marsh, Hau & Wen (2004). *In search of golden rules…* SEM, 11(3), 320–341. | https://doi.org/10.1207/s15328007sem1103_2 |
| **AVE / convergent / Fornell-Larcker** | Fornell & Larcker | Fornell & Larcker (1981). *Evaluating structural equation models…* J. Marketing Research, 18(1), 39–50. | https://doi.org/10.1177/002224378101800104 |
| **Reliability (omega over alpha)** | McNeish | McNeish, D. (2018). *Thanks coefficient alpha, we'll take it from here.* Psychological Methods, 23(3), 412–433. | https://doi.org/10.1037/met0000144 |
| **EFA best practice** | Watkins; Fabrigar et al.; Costello & Osborne | Watkins (2018), J. Black Psychology, 44(3), 219–246; Fabrigar et al. (1999), Psych. Methods, 4(3), 272–299. | https://doi.org/10.1177/0095798418771807 · https://doi.org/10.1037/1082-989X.4.3.272 |
| **Mediation (bootstrap indirect)** | Cheung & Lau (CB-SEM-specific); Preacher & Hayes | Cheung & Lau (2008), Org. Research Methods, 11(2), 296–325; Preacher & Hayes (2008), Behavior Research Methods, 40(3), 879–891. | https://doi.org/10.1177/1094428107300343 · https://doi.org/10.3758/BRM.40.3.879 |
| **Tooling** | lavaan + semTools + tidySEM | Rosseel (2012), JSS 48(2); Jorgensen et al. (2022) semTools; van Lissa (2023) tidySEM. | https://doi.org/10.18637/jss.v048.i02 |

### Track B — PLS-SEM (variance-based)

| Role | Standard | Authors / year / title / venue | Link |
|---|---|---|---|
| **Primary — single guide** | Hair, Risher, Sarstedt & Ringle | Hair, Risher, Sarstedt & Ringle (2019). *When to use and how to report the results of PLS-SEM.* European Business Review, 31(1), 2–24. | https://doi.org/10.1108/EBR-11-2018-0203 |
| **Discriminant validity (HTMT)** | Henseler/Ringle/Sarstedt | Henseler, Ringle & Sarstedt (2015). *A new criterion for assessing discriminant validity…* JAMS, 43(1), 115–135. | https://doi.org/10.1007/s11747-014-0403-8 |
| **rho_A reliability** | Dijkstra & Henseler | Dijkstra & Henseler (2015). *Consistent Partial Least Squares Path Modeling.* MIS Quarterly, 39(2), 297–316. | https://doi.org/10.25300/MISQ/2015/39.2.02 |
| **Predictive power (PLSpredict)** | Shmueli et al. | Shmueli et al. (2019). *Predictive model assessment in PLS-SEM.* European J. Marketing, 53(11), 2322–2347. | https://doi.org/10.1108/EJM-02-2019-0189 |
| **R implementation / workbook** | Hair et al. workbook | Hair, Hult, Ringle, Sarstedt, Danks & Ray (2021). *PLS-SEM Using R: A Workbook.* Springer (open access). | https://doi.org/10.1007/978-3-030-80519-7 |
| **Tooling** | seminr | Ray, Danks & Calero Valdez (2021). seminr R package. | https://cran.r-project.org/package=seminr |

### Track C (cross-cutting) — PCA reported as data reduction, NOT a latent model

| Role | Standard | Authors / year / title / venue | Link |
|---|---|---|---|
| **Primary** | Jolliffe & Cadima | Jolliffe & Cadima (2016). *Principal component analysis: a review and recent developments.* Phil. Trans. R. Soc. A, 374, 20150202. | https://doi.org/10.1098/rsta.2015.0202 |
| **PCA-is-not-EFA caution** | Frick et al. | Frick, Killisch, Bißantz & Wetzel (2025). *PCA Is Not EFA.* European J. Psychological Assessment, 41(6), 425–426. | https://doi.org/10.1027/1015-5759/a000938 |
| **Retention rules (primaries)** | Kaiser; Cattell; Horn | Kaiser (1960); Cattell (1966); Horn (1965). | https://doi.org/10.1007/BF02289447 (Horn) |

---

## 2. Per-card reporting spec

Cutoffs are tagged **[V]** verified-Confirmed, **[V*]** verified-Nuanced (corrected value used), so you can see which numbers survived adversarial checking.

### Card 1 — Cronbach's alpha / reliability
- **Report:** Table 1 — reliability coefficient, 95% CI, N items, N cases. Table 2 — corrected item-total r and "alpha-if-dropped" per item; item-total bar chart.
- **Recommendation (judgment call, see §4a):** lead with **McDonald's omega** as the headline reliability coefficient and show **Cronbach's alpha as a secondary/legacy column**. Omega assumes only a congeneric one-factor model; alpha assumes tau-equivalence (equal loadings) and is a lower bound (McNeish 2018). **[V*]** — verification confirms McNeish argues alpha is obsolete *but does NOT crown omega specifically* (he lists omega, Revelle's omega, GLB, Coefficient H on equal footing). So phrase the on-card note as "omega-type model-based coefficient preferred over alpha," not "omega is the one true successor."
- **Cutoff:** ≥ .70 acceptable; ≥ .80 good; > .95 suggests redundancy. Guideline, not gate. Source: McNeish (2018); common convention.
- **Tooling note (code requirement):** emit `semTools::compRelSEM()` (omega; `tau.eq=TRUE` for alpha) and `psych::omega`/`psych::alpha`. **Do NOT call `semTools::reliability()` — deprecated 2022.**
- **APA sentence:** "Internal consistency was high, ω = .__ (95% CI [.__, .__]); Cronbach's α = .__." (If owner keeps alpha as headline: swap leading term.)

### Card 2 — AVE / convergent validity
- **Report:** Table 1 — Construct / AVE / CR / alpha (and omega). Table 2 — Fornell-Larcker matrix with sqrt(AVE) on the diagonal. **Add HTMT matrix** (see §4c, §5).
- **Cutoffs:** AVE **≥ .50** **[V]** (construct explains ≥ half of indicator variance; Fornell & Larcker 1981). CR **≥ .70 [V*]** — *note: the ≥ .70 norm is Nunnally (1978) / Bagozzi & Yi (1988), NOT Fornell & Larcker; do not mis-cite F&L for .70.* The documented F&L caveat (AVE < .50 still adequate if CR > .60) is **real but was framed by F&L as a caution, not a lenient pass rule** **[V*]** — surface it as a footnote, not a relaxed threshold.
- **APA sentence:** "Convergent validity was supported: all AVE ≥ .50 and CR ≥ .70." (Report-only framing: state the numbers; the how-to-read layer explains the benchmark.)

### Card 3 — Composite reliability
- **Report:** Construct / CR / AVE / alpha (+ omega) + CR bar chart.
- **Cutoff:** CR **≥ .70 [V*]** (Nunnally/Bagozzi-Yi; .60 tolerable in exploratory work; > .95 redundant).
- **Tooling:** `semTools::compRelSEM()`. CR, omega, and Raykov's rho are the same coefficient for a unidimensional congeneric model.
- **APA sentence:** "Composite reliability was satisfactory (CR = .__ ≥ .70)."

### Card 4 — EFA
- **Report:** Table 1 suitability (KMO, Bartlett χ²/df/p). Table 2 variance explained (eigenvalue / %var / cumulative %, **labelled before-vs-after rotation**). Table 3 rotated **pattern** loadings (Item / F1 / F2… / communality). Scree plot with **parallel analysis**. **Add: interfactor correlation matrix** (oblimin default → required by Watkins). Optionally per-factor reliability (omega).
- **Cutoffs / rules:**
  - KMO **≥ .60** acceptable, ≥ .70 preferred; verbal labels (.90s marvelous … <.50 unacceptable) **[V*]** — labels are correct but **mis-attributed in the literature to "Kaiser (1974)"; the KMO labels are Kaiser & Rice (1974) / Kaiser (1975), NOT the Kaiser 1974 IFS paper.** Cite correctly in CITATIONS.txt.
  - Bartlett significant (p < .05, usually < .001) **[V]**.
  - **Factor retention: parallel analysis (Horn 1965), NOT Kaiser eigenvalue>1 [V]** — K1 systematically over-extracts; PA corrects an upward bias (Zwick & Velicer 1986). Best practice = PA + scree + interpretability.
  - Salient loading |.32| (~10% variance, Tabachnick & Fidell) or |.40|; report the complete pattern matrix or state the suppression cutoff; flag cross-loaders (≥ .32 on 2+ factors).
- **Tooling note:** the on-card "extraction = default" pill must be replaced by the **actual estimator** (`psych::fa` default is minres; expose PAF/ML, choose ML when multivariate-normal else PAF).
- **APA sentence:** "EFA (KMO = .__, Bartlett's χ²(__) = __, p < .001) with parallel analysis retained __ factors explaining __% of variance (oblimin rotation)."

### Card 5 — PCA
- **Report:** Table 1 variance explained (eigenvalue / %var / cumulative %, **state correlation vs covariance matrix**). Table 2 component loadings (**state whether raw eigenvector coefficients or correlation-scaled loadings, and any rotation**). Scree and/or biplot.
- **Critical framing [V]:** components are weighted composites, NOT latent factors; PCA fits no model, has no model fit, and (in the EFA sense) **no communalities**. The existing PCA card already nails this — keep it. Ensure a PCA export does NOT surface `psych::principal()`'s `h2` "communality" column.
- **Cutoffs / rules:** Kaiser eigenvalue > 1 (name it, do not rely on it alone); scree elbow; **parallel analysis preferred [V]**; ~70% cumulative variance is an explicitly subjective heuristic (Jolliffe & Cadima 2016). State loading-suppression cutoff if used.
- **APA sentence:** "PCA (correlation matrix; parallel analysis) retained __ components explaining __% of total variance."

### Card 6 — CB-SEM
- **Report (two-step, Anderson & Gerbing 1988 [V]):** measurement model first, then structural.
  - Table 3 measurement model: Construct→Item / **standardized loading + unstandardized estimate (B)** / SE / z / p (see §5 — JARS requires BOTH metrics).
  - Table 4 reliability & validity: Construct / CR / AVE / omega (+ alpha).
  - Table 5 global fit: χ²(df, **exact p**) / χ²:df / CFI / TLI / RMSEA **[90% CI]** / SRMR.
  - Table 6 structural paths: Path / **std β + unstandardized B** / SE / z / p / 95% CI / R² per endogenous construct.
  - Table 7 indirect effects: Path / estimate (std + unstd) / SE / **bootstrap 95% CI** / p; disclose resample count and CI type.
  - semPaths diagram (ovals = latent, rectangles = observed).
- **Cutoffs:**
  - CFI/TLI ≥ .95, RMSEA ≤ .06, SRMR ≤ .08 **[V*]** — values & attribution correct, but Hu & Bentler stated them as "close to" approximations applied via a **two-index strategy** (an incremental index ~.95 paired with EITHER SRMR ~.08 OR RMSEA ~.06), NOT a single conjunction of all three; in the strict combinational rule SRMR is ~.09. Phrase as labelled guideline (Marsh/Hau/Wen 2004), not a pass/fail gate (§4b).
  - **RMSEA 90% CI (not 95%) [V*]** — convention is correct; the one-sided close-fit test at α=.05 motivates 90%. Nuance: the .05/.08/.10 bands (MacCallum et al. 1996) are *point-estimate* cutoffs; judging the CI upper bound against .08/.10 is a related but distinct heuristic. RMSEA can be inflated with small df / small N — note this.
  - WLSMV for ordinal indicators; Hu & Bentler cutoffs were derived under ML/continuous-normal and may not transfer.
- **Mediation:** test the indirect effect (ab) directly via **bias-corrected bootstrap CI excluding zero** (Cheung & Lau 2008 for latent variables; Zhao/Lynch/Chen 2010 typology). Do NOT require a significant total effect first.
- **Tooling (code requirements):** `lavaan::sem/cfa`; report standardized estimates with correct SE/z/p via `standardizedSolution()` (NOT std.all paired with unstandardized SE); RMSEA CI from `fitMeasures(..., 'rmsea.ci.lower/upper')`; `semTools::compRelSEM()`/`AVE()`. **Feasibility risk: confirm lavaan loads in WebR and WebR ≡ native-R (the project's hard gate).**
- **APA sentence:** "The model fit the data well, χ²(__) = __, p = .__, CFI = .__, TLI = .__, RMSEA = .__ (90% CI [.__, .__]), SRMR = .__. The path X→Y was significant, β = .__ (B = .__), p = .__."

### Card 7 — PLS-SEM
- **Report (two-stage, Hair et al. 2019 — and report metrics in the prescribed order; do NOT report CB-SEM global fit):**
  - Table 1 outer loadings/weights: Construct→Item / loading-or-weight / t / p (bootstrap).
  - Table 2 reliability & convergent: Construct / **Cronbach's α + rho_A + CR (rho_C)** / AVE (§5 — show all three reliability columns).
  - Table 3 HTMT matrix (discriminant).
  - Table 4 structural paths: Path / β / t / p / 95% CI / f².
  - Table 5 quality: Construct / R² / adj R² / Q².
  - Table 6 indirect effects (mediation, bootstrap CI).
  - Path diagram with loadings/path coeffs/R².
- **Cutoffs:**
  - Loading **≥ .708** (rounded .70; loading² ≥ .50) **[V]**; .40–.708 retain only if deletion raises CR/AVE; < .40 delete **[V]**.
  - α/rho_A/rho_C between .70 and .90 (.60 tolerable exploratory; > .95 problematic).
  - AVE **≥ .50 [V]**.
  - **HTMT < .85 (conceptually distinct) / < .90 (conceptually similar) [V*]** — values & attribution (Henseler/Ringle/Sarstedt 2015) correct; the .85/.90 choice is **driven by construct similarity, stated a priori**, with .85 the general default. Prefer bootstrap-CI inference (Franke & Sarstedt 2019).
  - VIF ideally < 3, critical ≥ 5 (Hair 2019 tightened the old < 5/< 10).
  - f² **.02 / .15 / .35 = small / medium / large [V]** (Cohen 1988; applies to f²).
  - R² .25 / .50 / .75 weak/moderate/substantial (discipline-dependent benchmark).
  - **Q² > 0 = predictive relevance (blindfolding) [V]**; modern best practice is **PLSpredict** for out-of-sample (Shmueli et al. 2019) — blindfolding Q² is NOT out-of-sample.
- **Formative constructs:** suppress AVE/HTMT; instead report redundancy-analysis convergent validity (≥ .70), indicator VIF (< 3), and weight significance (loading ≥ .50 fallback).
- **Tooling:** `seminr::estimate_pls` + `bootstrap_model(nboot = 5000–10000)`.
- **APA sentence:** "The path X→Y was significant, β = .__, t = __, p = .__ (bootstrap 95% CI [.__, .__]); R²_Y = .__."

---

## 3. The verified numbers (quick-reference)

| Cutoff | Verdict | Corrected / precise value | Source |
|---|---|---|---|
| CFI / TLI ≥ .95 | **Nuanced** | "close to .95"; two-index strategy, not single conjunction | Hu & Bentler 1999 |
| RMSEA ≤ .06 | **Nuanced** | "close to .06"; .05 close-fit (MacCallum); .05–.08 fair, .08–.10 mediocre, >.10 poor | Hu & Bentler 1999; MacCallum/Browne/Sugawara 1996 |
| SRMR ≤ .08 | **Nuanced** | "close to .08" standalone; **~.09** in the paired combinational rule | Hu & Bentler 1999 |
| RMSEA reported with **90% CI** (not 95%) | **Nuanced** | Correct (one-sided close-fit test); CI-upper-bound-vs-.08/.10 is a distinct heuristic from the point-estimate bands | MacCallum/Browne/Sugawara 1996 |
| HTMT < .85 / < .90 | **Nuanced** | Correct; .85 distinct constructs (default), .90 similar constructs, chosen a priori | Henseler/Ringle/Sarstedt 2015 |
| AVE ≥ .50 | **Confirmed (Nuanced on F&L caveat)** | ≥ .50; AVE<.50/CR>.60 caveat is a caution, not a lenient rule | Fornell & Larcker 1981 |
| CR ≥ .70 | **Nuanced (attribution)** | ≥ .70 correct, but the .70 norm is **Nunnally 1978 / Bagozzi & Yi 1988**, not Fornell & Larcker | Nunnally 1978; Bagozzi & Yi 1988 |
| f² .02 / .15 / .35 | **Confirmed** | small / medium / large (f² specifically) | Cohen 1988 |
| KMO ≥ .60 | **Nuanced (attribution)** | ≥ .50 floor / ≥ .60 common min / ≥ .70 preferred; verbal labels are **Kaiser & Rice 1974**, NOT the Kaiser 1974 IFS paper | Kaiser 1970; Kaiser & Rice 1974 |
| Loading ≥ .70 (reflective) | **Confirmed** | ≥ **.708** (rounds to .70; loading² ≥ .50); .40–.70 conditional; < .40 delete | Hair et al. 2019 |
| Q² > 0 | **Confirmed** | predictive relevance (blindfolding); PLSpredict for out-of-sample | Stone 1974 / Geisser 1974; Shmueli et al. 2019 |
| Omega over alpha | **Nuanced** | McNeish recommends *a* congeneric/model-based coefficient (omega, Revelle's ω, GLB, H) — not omega specifically | McNeish 2018 |
| Parallel analysis > Kaiser>1 | **Confirmed** | PA corrects K1's systematic over-extraction | Horn 1965; Zwick & Velicer 1986 |
| Two-step (measurement → structural) | **Confirmed** | — | Anderson & Gerbing 1988 |
| PLS guide / APA JARS / Kline 5th ed. (2023, ISBN 978-1462551910) | **Confirmed** | citations exact | Hair et al. 2019; Appelbaum et al. 2018; Kline 2023 |

---

## 4. Contested / judgment calls for the owner to rule on

**(a) Cronbach's alpha vs McDonald's omega.** *Recommend: omega as headline, alpha as secondary column.* Rationale: alpha assumes tau-equivalence and under-estimates; omega/CR derive from the CFA loadings (McNeish 2018). Caveat (verified): McNeish does not single out omega over other congeneric coefficients, so phrase the note as "model-based coefficient preferred," and keep alpha visible because reviewers still ask for it.

**(b) Fit cutoffs as guidelines vs golden rules.** *Recommend: report the numbers, label them "conventional benchmarks (Hu & Bentler 1999), not pass/fail thresholds," with a Marsh/Hau/Wen (2004) footnote — and never let the card "declare" fit.* Rationale: matches both JARS ("criteria justified by citation," no fixed cutoff) and your existing report-only policy. This is the single most important wording call.

**(c) Fornell-Larcker vs HTMT for discriminant validity.** *Recommend: HTMT as primary, Fornell-Larcker as legacy/secondary.* Rationale: simulation evidence (Henseler 2015; Voorhees 2016) shows Fornell-Larcker fails to detect violations; HTMT is the modern default. Implication: the AVE card must add an HTMT matrix (currently only Fornell-Larcker is specced — §5).

**(d) Parallel analysis vs Kaiser eigenvalue>1.** *Recommend: parallel analysis as the default retention rule for EFA AND PCA; mention Kaiser>1 only with the over-extraction caveat.* Rationale: verified — K1 systematically over-extracts (Zwick & Velicer 1986). The EFA scree is already annotated "with parallel analysis"; align the PCA how-to-read text (it still lists "eigenvalue > 1 (Kaiser)" as a "standard rule" without caveat).

**(e) PCA-vs-EFA conflation.** *Recommend: keep PCA out of the "Latent variables" heading in the UI taxonomy; present it under "data reduction / dimension reduction."* Rationale: PCA is the one item in the bundle that is explicitly NOT a latent-variable method (Frick et al. 2025). The card content is already correct; this is a section-label fix only.

**(f) Bootstrap resample count.** *Recommend: 5,000 minimum for CB-SEM mediation (Hayes/PROCESS default; verified 1,000 floor / 5,000 for final), and 10,000 for PLS-SEM final reporting (Hair et al. 2019).* Rationale: PLS guidance specifically prescribes 10,000 for final results; our spec default of 5,000 is fine for CB-SEM but slightly low for PLS final reporting — let the owner pick whether to bump PLS to 10,000 or keep 5,000 with a note.

> **UPDATE (2026-06-18, post-spike + bootstrap-count verification `wf_9e0d7733-50d`):** "2,000" is **NOT** a named convention. Verified citable anchors: **1,000** = practical minimum / initial-assessment pass (Efron & Tibshirani 1994; SmartPLS "initial"; Hair 2nd-ed primer used 500); **5,000** = long-standing standard for BOTH tracks (Preacher & Hayes 2008 for mediation; Hayes/PROCESS default; Hair *Primer*: "as a rule, 5,000 bootstrap samples are recommended"); **10,000** = current PLS *final-reporting* recommendation (Hair et al. 2019/2022; Streukens & Leroi-Werelds 2016, doi:10.1016/j.emj.2016.06.003: "at least 10,000"). Accuracy basis (Andrews & Buchinsky, via Streukens): ~2,522 resamples suffice for **percentile** CIs but ~6,962 for **bias-corrected (BCa)** CIs. WASM cost (from the feasibility spike): 5k ≈ ~8.5 min PLS / ~2.7 min CB-SEM; 10k ≈ ~17 min PLS. **DESIGN (owner-approved 2026-06-19; default = 5,000 CONFIRMED):** a manual bootstrap-count control with presets — **1,000 "Quick draft"** · **5,000 "Standard (recommended)"** ← default · **10,000 "Publication-grade final"** — plus free numeric entry, each with a live time-estimate disclaimer + progress bar. The resample count + CI type print in the output (provenance) so any run is transparently citable. **Default = 5,000 for BOTH tracks** (Benjie's call, 2026-06-19 — citable + publication-defensible; supersedes the original §4f "10,000 PLS default"); 10,000 remains available as the "Publication-grade final" preset. CI-type/accuracy note to settle in the spec: pair **percentile** CIs at 5k for cross-track consistency, OR keep BCa and steer the 10k preset for BCa accuracy (~7k).

**(g) Modelsummary for SEM tables.** *Recommend: adopt dedicated SEM tooling (lavaan accessors + tidySEM/semTable) for these cards, NOT modelsummary.* Rationale: modelsummary has no native lavaan support (only via broom, which yields a thinner table). This mirrors the datasummary_balance exception you already approved — consistent precedent, not a policy break.

**(h) BC vs percentile bootstrap (minor).** *Recommend: bias-corrected bootstrap as default, disclose the type.* Rationale: BC has highest power (MacCallum et al. 2004), though some recent work flags inflated Type I error; disclosing the CI type satisfies JARS either way.

---

## 5. Gaps between our spec and the convention

Concrete items to adjust before building. Grouped by severity.

**Missing outputs the convention expects:**
1. **HTMT discriminant-validity matrix** — the AVE card (and PLS card text) currently specs only the Fornell-Larcker matrix. Convention (Henseler 2015; Voorhees 2016) requires HTMT as the primary criterion; add an HTMT matrix to Card 2 and Card 7, ideally with a bootstrap CI (matches your "effect sizes with CIs everywhere" rule).
2. **Unstandardized estimates alongside standardized** — Card 6 tables show only Std.loading / Std.β / standardized indirect. JARS Table 7 requires BOTH unstandardized (B) and standardized for ALL parameters. Add a B column to measurement, structural, and indirect-effects tables.
3. **rho_A and Cronbach's α in the PLS reliability table** — Card 7 outputs currently surface CR/AVE but the inputs card mentions rho_A; Hair et al. (2019) prescribe **all three** (α, rho_A, rho_C). Make the reliability table three columns; the two specs are currently inconsistent.
4. **EFA interfactor correlation matrix** — oblimin is the default, so Watkins (2018) requires the factor-correlation matrix (`psych::fa()$Phi`). Not in the current bundle.
5. **Omega in the reliability/EFA cards** — ROADMAP enumerates "alpha, AVE/CR" but not omega/Raykov's rho. Add omega as the headline reliability coefficient (per §4a).

**Code-correctness requirements (will break or mis-report if ignored):**
6. **Do NOT emit `semTools::reliability()`** — deprecated 2022. Emit `compRelSEM()` (omega; `tau.eq=TRUE` for alpha) and `AVE()`.
7. **Standardized SE/CI must come from `standardizedSolution()`**, not std.all paired with the unstandardized SE — the single most common SEM reporting bug.
8. **RMSEA 90% CI** must be emitted and labelled 90% (not the 95% used elsewhere in Telos) — a subtle, easy-to-miss divergence from house convention.

**Framing / labelling fixes:**
9. **Fit cutoffs reframed** as labelled guidelines with Hu & Bentler citation + Marsh/Hau/Wen caveat (§4b) — current "good fit guideline: CFI/TLI ≥ .95…" reads as a golden rule.
10. **EFA "extraction = default" pill** is vague — expose/state PAF vs ML (the R map's `psych::fa` default is minres, which the label hides).
11. **PCA section label** — file under "data reduction," not "latent variables" (§4e); update the PCA how-to-read to caveat Kaiser>1.
12. **PCA loadings table** must state raw eigenvector coefficients vs correlation-scaled loadings — `prcomp()` and `psych::principal()` give materially different "loadings"; pick one and state it. Ensure no EFA-style communality column leaks into a PCA export.

**Citation provenance (CITATIONS.txt additions):**
13. Add SEM package citations: lavaan (doi:10.18637/jss.v048.i02), semTools, tidySEM/semTable, semPlot, seminr, broom; plus methodological primaries (Hu & Bentler 1999, MacCallum et al. 1996, Fornell & Larcker 1981, McNeish 2018, Henseler 2015, Hair et al. 2019, Anderson & Gerbing 1988, Cheung & Lau 2008, Watkins 2018, Jolliffe & Cadima 2016).
14. **Fix two attribution traps surfaced by verification:** (a) cite CR ≥ .70 to Nunnally 1978 / Bagozzi & Yi 1988, NOT Fornell & Larcker; (b) cite KMO verbal labels to Kaiser & Rice (1974) / Kaiser (1975), NOT the Kaiser (1974) "factorial simplicity" paper.

**Feasibility risk to confirm before committing the slice:**
15. **lavaan/seminr under WebR** — must verify both load in WebR and that WebR ≡ native-R 4.6.0 (the project's hard gate, e.g. `runs-in-r.test.ts`). This is the main technical risk for the slice; flag it in the design spike.
16. **Two-step flow vs single-card pattern** — CB-SEM produces measurement + structural + mediation reports together, which the current one-card-per-test flow does not cover. Decide composite card vs sub-cards before building.

---

---

## 6. Multigroup analysis (optional, both tracks)

> Added 2026-06-18 from supplementary verified research workflow `wf_9661f84c-757` (owner flagged multigroup + path analysis after the core convention). Tags as before: **[V]** Confirmed / **[V*]** Nuanced-corrected.

Multigroup analysis answers the moderation question every thesis eventually asks: *does my model work the same way for men and women / treatment and control / region A and region B?* It is an OPTIONAL extension on top of a model that already fits well in the pooled sample. The user supplies exactly one new input — a categorical **grouping variable** — and the app emits the complete invariance assessment and cross-group comparison automatically. The machinery is track-specific: CB-SEM tests invariance of a common-factor measurement model (MGCFA); PLS-SEM tests invariance of composites (MICOM). They are NOT interchangeable and live in separate emitters.

### 6A. Track A — CB-SEM / CFA measurement invariance (MGCFA via lavaan)

**The nested invariance hierarchy** (Vandenberg & Lance 2000; Putnick & Bornstein 2016):

| Level | Constrained equal across groups | Licenses |
|---|---|---|
| **Configural** | Same factor *pattern*; loadings/intercepts/residuals free per group | Baseline — same form in each group |
| **Metric** (weak) | + factor **loadings** | Comparing unstandardized structural paths across groups |
| **Scalar** (strong) | + indicator **intercepts** | Comparing **latent means** across groups |
| **Strict** (residual) | + residual **variances** | Comparing composite reliabilities / sum-score differences |

`configural → metric → scalar` is the standard reported sequence; **strict is optional and widely regarded as overly stringent** — offer it, never force it. Firm prerequisite rule: **metric** invariance before comparing paths; **scalar** before comparing latent means **[V]**. A well-fitting baseline CFA must hold in each group; if the configural model fits poorly the ladder stops (the construct is structurally different — no comparison defensible).

**Decision criteria** (change-in-fit is PRIMARY; Δχ² is over-powered at large N):
- **Cheung & Rensvold (2002): ΔCFI ≤ −.01** — invariance rejected when CFI drops by more than .01 between adjacent nested models. **[V] Confirmed** (doi:10.1207/S15328007SEM0902_5).
- **Chen (2007): supplement with ΔRMSEA + ΔSRMR, conjunctively, on TWO sample-size regimes [V*] Nuanced-corrected** (doi:10.1080/10705510701301834). The field repeats only the large-sample set; the small/unequal set is a *distinct* table the emitter must branch to by reading per-group n:

  | Sample regime | Metric | Scalar & Strict |
  |---|---|---|
  | **n > 300/group** | ΔCFI ≥ \|.010\| **and** ΔRMSEA ≥ .015 **and** ΔSRMR ≥ .030 | ΔCFI ≥ \|.010\| **and** ΔRMSEA ≥ .015 **and** ΔSRMR ≥ .010 |
  | **n ≤ 300/group (or unequal)** | ΔCFI ≥ \|.005\| **and** ΔRMSEA ≥ .010 **and** ΔSRMR ≥ .025 | ΔCFI ≥ \|.005\| **and** ΔRMSEA ≥ .010 **and** ΔSRMR ≥ .005 |

  Corrections to encode: (a) the lower ΔSRMR = .010 applies to *both* scalar AND strict; (b) the emitter MUST read per-group n, branch between the two threshold sets, and label which it used and why.
- **Δχ² (lavTestLRT)** reported as a supplement, not the deciding criterion (Cheung & Rensvold 2002; Putnick & Bornstein 2016, doi:10.1016/j.dr.2016.06.004).

**Partial invariance** (only if a level fails): locate offending parameter(s) via modification indices, free with `group.partial` (Byrne, Shavelson & Muthén 1989, doi:10.1037/0033-2909.105.3.456); report which parameters were freed, for which group, and the justifying diagnostic. ≥ 2 invariant indicators per factor required.

**WLSMV / ordinal (code-correctness):** for Likert/ordinal indicators the manual `group.equal` sequence mis-handles thresholds — route through `semTools::measEq.syntax(..., ID.cat='Wu.Estabrook.2016')` with WLSMV. Do NOT call the deprecated `semTools::measurementInvariance()` batch helper.

**What to report (Track A):** invariance summary table (one row/level: χ²/df/p/CFI/RMSEA/RMSEA 90% CI/SRMR) + delta columns (Δχ², Δdf, p, ΔCFI, ΔRMSEA, ΔSRMR) + per-comparison RETAINED/REJECTED verdict naming the criterion + per-group n (REQUIRED — sets which Chen table was used) + freed-parameter list for partial models + cross-group path/mean comparison table (per-group std + unstd estimate, SE, z/p, CI, equality test) + estimator/identification disclosure + APA narrative.

**R impl:** `cfa(model, data, group='G')` → add `group.equal='loadings'` → `c('loadings','intercepts')` → `c(...,'residuals')`; `lavTestLRT`; `semTools::compareFit`; `measEq.syntax` (ordinal); `standardizedSolution` for the cross-group table.

### 6B. Track B — PLS-SEM composite invariance (MICOM) + PLS-MGA

PLS constructs are composites, not factors → CFA invariance doesn't apply. Use MICOM (Henseler, Ringle & Sarstedt 2016, doi:10.1108/IMR-09-2014-0304) as a strict run-in-order sequence (maps perfectly onto the one-step-at-a-time WebR constraint).

**Phase 1 — MICOM, three hierarchical steps [V] Confirmed:**
1. **Configural** (qualitative, no test) — identical indicators / data treatment / algorithm settings across groups. In Telos this holds *by construction* → surface as a confirmation statement, not a "Step 1 p-value."
2. **Compositional invariance** (permutation test, ≥ 5,000) — c = cor(group-1-weighted, group-2-weighted composite); holds if observed c exceeds the 5% permutation quantile (95% CI for c includes 1).
3. **Equality of composite means & variances** (permutation) — each holds if its 95% CI includes zero.

**Decision tree:** Step 1 fails → not comparable, analyze separately. 1+2 pass, 3 fails → **partial invariance → MGA permitted, pooling NOT permitted** (partial is the practical minimum that licenses MGA). 1+2+3 → full invariance → MGA + pooling.

**Phase 2 — PLS-MGA** (only after Phase 1 licenses it): bootstrap each group; per path report β₁, β₂, |β₁−β₂| with **nonparametric** tests (Hair et al. 2019 prefer these over parametric/Welch which inflate Type I error):
- **Henseler's PLS-MGA** (2009, doi:10.1108/S1474-7979(2009)0000020014): significant at 5% if one-tailed p < 0.05 OR > 0.95. **[V*] Nuanced** — PLS-MGA is one *specific* nonparametric test; Hair's taxonomy = 1 parametric + 3 nonparametric (bootstrap-CI, permutation, PLS-MGA). Encode as "p < 0.05 OR > 0.95" and show direction so students aren't confused.
- **Permutation test** (Chin & Dibbern 2010): significant if p < 0.05.

**What to report (Track B):** MICOM Step 1 confirmation statement; Step 2 table (Construct/c/perm 95% CI/invariant?); Step 3a means + 3b variances tables; full/partial/none verdict per construct with consequence; PLS-MGA table (Path/β₁/β₂/|Δ|/p/sig?); provenance (resamples, permutation count, CI type, seed); APA sentences.

**R impl + tooling decision for the spike:** `seminr::estimate_pls_mga()` gives Henseler's PLS-MGA but **seminr has NO MICOM function.** Two paths: (A) add **cSEM** (`testMICOM`, `testMGD`); or (B) hand-code MICOM permutations against the 2016 paper. cSEM ships `.R=499` defaults — **below** the ≥ 5,000 recommendation → Telos must override to 5,000 (MICOM/permutation), 5,000–10,000 (final MGA bootstrap). Prototype cSEM-in-WebR first; fall back to hand-coded MICOM + `estimate_pls_mga` if cSEM fails the parity gate.

### 6C. Sequencing — a HARD implementation requirement (both tracks)

WebR is single-threaded WASM with finite memory; multigroup fits + 5,000-iteration permutation/bootstrap loops are the heaviest ops in the app. Multigroup MUST run **one model/step at a time as discrete, awaited jobs** — never the whole ladder at once:
- **Track A:** fit configural → extract `fitMeasures` row → `gc()` + discard the fitted object → fit metric → extract → discard → … → assemble the table from *saved rows*, never several live lavaan objects. No one-shot batch helper.
- **Track B:** five discrete awaited jobs — full-sample estimate, per-group estimates, MICOM Step 2, MICOM Step 3, PLS-MGA bootstrap — cached, never concurrent.
- **Bootstrap/permutation chunked**, fixed seed (WebR ≡ native-R parity), **progress indicator between steps**, warn large runs are slow.
- **Feasibility gate (design spike, before committing the slice):** confirm `measEq.syntax`/`compareFit` (A) and seminr/cSEM (B) load under WebR AND match native R for a 2-group fit — multigroup is the main memory risk.
- **Edge cases:** group too small (warn/collapse); configural failure (stop ladder); non-convergence/Heywood at a constrained level (report → partial); 2-indicator factors (no meaningful partial); MICOM is 2-group → handle >2 groups as pairwise with Holm/Bonferroni.

### 6D. Telos UX (both tracks)

Output stays **report-only**. The only new input is a **grouping-variable picker** (plus, Track A, an optional invariance-depth selector metric/scalar/strict). The app then auto-runs the sequence one step at a time, auto-selects the Chen threshold set from per-group n and labels it, auto-runs partial invariance if a level fails and **prints which parameters it freed and why**, **gates the UI on the decision tree** (configural/Step-1-2 failure → no MGA table, recommend separate analyses), and emits the invariance table + per-group paths + annotated diagram (both groups' β) + APA + full/partial/none verdict.

---

## 7. Path analysis (observed-variable SEM, a mode of CB-SEM)

**Definition.** Path analysis is SEM restricted to **observed variables**: simultaneous regressions among manifest (usually composite/scale-sum) scores, with **no latent constructs and no measurement model** (Kline 2023, Ch. 8; Streiner 2005, doi:10.1177/070674370505000207). A mode of CB-SEM (same lavaan engine) with the measurement layer absent.

**How its report differs from latent SEM.** No measurement model → the entire measurement apparatus is **suppressed and never emitted**: no loadings, no AVE/CR, no Fornell-Larcker/HTMT, no α/ω, no `=~` lines; the diagram draws **all rectangles, never ovals**. Kept: global fit (conditionally — §7A), path-coefficient table, R² per endogenous variable, indirect/total effects, diagram.

**vs k separate regressions:** path analysis adds (a) simultaneous estimation, (b) direct/indirect/total decomposition with bootstrap CIs for the indirect effect, (c) a global model-fit test of the omitted paths — the latter is the entire payoff over regression.

### 7A. The saturated-model (df = 0) rule — a correctness requirement [V]

A path model with **df = 0 is just-identified / saturated**: it reproduces the covariance matrix perfectly by construction, forcing χ²=0, CFI=TLI=1.000, RMSEA=SRMR=0.000. These are **mathematically forced and carry zero information**; reporting them as "excellent fit" is a textbook error. **[V] Nuanced-corrected:** rule confirmed (Kline 2023; Kenny; UCLA OARC) with one precision — the operative condition is *saturated*, **not "recursive."** A recursive model is always identified but often over-identified (positive df, fit IS informative); only a *fully* saturated model has df=0. **The gate keys on df, not recursiveness.**

Renderer MUST read `df <- fitMeasures(fit,'df')` and branch:
- **df = 0 (the DEFAULT for single-mediator X→M→Y):** SUPPRESS the global-fit table; emit a saturation flag ("just-identified, df=0; fit indices uninformative; interpret paths, R², indirect effects"). **Load-bearing, tested code path** — the canonical mediation chain is exactly saturated, so build/test this branch first; a consistency test must assert a df=0 fixture emits NO CFI/RMSEA cells.
- **df > 0 (over-identified):** report χ²(df,p), CFI, TLI, RMSEA **90% CI**, SRMR — Hu & Bentler benchmarks as guidelines not gates; caveat RMSEA instability at df = 1–2.

### 7B. Mediation as observed-variable path analysis

The dominant thesis use (the lavaan equivalent of PROCESS). Modern practice:
- **Bootstrap the indirect effect** (ab); support when the **bootstrap CI excludes zero** (Preacher & Hayes 2008, doi:10.3758/BRM.40.3.879; Hayes 2009, doi:10.1080/03637750903310360). B ≥ 5,000 final; disclose percentile vs BCa.
- **Do NOT** require a significant total effect, the Baron-Kenny steps, or the Sobel test (Hayes 2009).
- **Classify with Zhao-Lynch-Chen (2010, doi:10.1086/651257)** — complementary/competitive/indirect-only/direct-only/no-effect — not "full/partial mediation" (show that only as a legacy label if at all).
- **Correctness gate:** standardized indirect/total bootstrap CIs are NOT produced by `standardizedSolution()` (delta-method SE only); require `semboottools::standardizedSolution_boot()`. Emitter must call the helper; consistency test must check it. Never pair `std.all` with a delta-method SE.

**Alongside latent-SEM mediation:** observed-score path analysis is the lightweight default for composites; it ignores measurement error and can bias indirect effects. Latent SEM mediation *corrects* for measurement error when raw items exist → the more rigorous option; path analysis is the appropriate simpler choice when only scale scores exist. Same indirect-effect/bootstrap-CI logic.

### 7C. lavaan implementation + APA

```r
set.seed(123)                                  # WebR ≡ native-R parity
model <- 'M ~ a*X
          Y ~ b*M + c*X
          ind   := a*b
          total := c + a*b'
fit <- lavaan::sem(model, data=d, se='bootstrap', bootstrap=5000, fixed.x=TRUE)
df <- lavaan::fitMeasures(fit,'df')            # THE saturation gate
parameterEstimates(fit, standardized=TRUE, ci=TRUE, boot.ci.type='bca.simple', rsquare=TRUE)
semboottools::standardizedSolution_boot(fit)   # standardized indirect/total bootstrap CIs
semPlot::semPaths(fit, whatLabels='std')       # all manifest → rectangles
```
Estimator ML default; MLR nonnormal; WLSMV+`ordered=` if endogenous ordinal. `missing='fiml'`. Default recursive (always identified); a drawn feedback loop (nonrecursive) needs instruments → flag out-of-scope for the first slice. JARS requires BOTH unstandardized and standardized for every path.

**Report order:** T1 paths [B, β, SE, z, p, CI] → T2 R² per endogenous → T3 indirect & total (bootstrap CI) → T4 global fit **only if df > 0** else saturation flag → Fig diagram. Reuse `multipleLinearRegression.ts` coef/extraCols/gof for T1; T3 + conditional fit are bespoke emitters (SEM tooling exception — lavaan accessors, not modelsummary).

### 7D. Telos UX — recommendation (this revises §3-Card-6 / my earlier "separate picker item" lean)

**Recommendation: path analysis as an *auto-detected mode* of the CB-SEM card, surfaced in the test picker for discoverability but NOT a duplicated config card.** When the user assigns *every* canvas node to a dataset column (no `=~` latent factors), the model is observed-only → the app flips to path-analysis mode: hides reflective/formative + indicator-assignment UI, draws rectangles, suppresses measurement/reliability/AVE/CR tables, arms the df=0 branch. Rationale: same engine + same canvas + same inputs (a separate config card duplicates everything for no analytical gain); the mode is unambiguously detectable; it matches how students think ("draw your model, get your report"); the only genuinely new code (df=0 suppression, rectangle-only diagram) is renderer adaptation the CB-SEM emitter reads off the fit anyway. The §6 cross-group machinery is reused directly for multigroup path analysis (skipping the loading/intercept ladder — no latent indicators).

---

*Sources are cited inline with working DOIs/links; all numeric thresholds reflect the independent-verification verdicts (Confirmed / Nuanced-with-correction). The owner's go/no-go is on §1 (the two-track standard) and the §4 judgment calls; §5–§7 (gaps, multigroup, path analysis) become the build punch-list once approved.*
