# Regression Slice Spike Report — WebR ≡ native R + package ladder verdicts

Date: 2026-06-12. Fixture: /tmp/regression-spike/regression.csv (set.seed(2026), n=40, RNG draw order
fixed; see fixture.R — **the frozen CSV is the ground truth, not the seed**).
Engines: native R 4.6.0 (macOS arm64, AUTHORITY; parameters/performance/pROC in
/tmp/regression-spike/Rlib) vs webr 0.6.0 (R 4.6.0 WASM, Node, npm-pinned sandbox
/tmp/regression-spike/webr/). ONE shared battery (battery.R) sourced VERBATIM by both.
Tolerance: |a−b| ≤ max(1e-9, 1e-6·max(|a|,|b|)) via compare.mjs (full log: compare-output.txt).

## Headline verdict

**343 keys compared; 0 mismatches; 0 one-sided keys.** Every table cell of all four tests reproduces
identically: lm fit + coefficients + t-CIs + β, GVIF structure + values + the k=1 error string,
logistic −2LL/AIC/Nagelkerke/omnibus/profile-OR-CIs/classification cells/AUC under BOTH event
categories, Poisson + NB (±offset) fits incl. dispersion ratio, theta±SE, profile IRR CIs. The single
sub-tolerance observation: `sl_beta_int_param` (standardized intercept) is −2.6e-18 native vs
−3.9e-17 webr — numerically zero in both; the card's ghost row renders β blank for the intercept
anyway.

| Battery section | Keys | Result |
|---|---|---|
| 1. Simple linear (fit, coefs, CIs, β param+hand) | 22 | PASS — all match |
| 2. Multiple linear (fit, 6 coef rows, β, GVIF, k=1 error) | 78 | PASS — all match (incl. strings) |
| 3. Logistic, event = 'yes' (fit, ORs, classification, ROC/AUC) | 57 | PASS — all match |
| 4. Logistic, event = 'no' (same battery releveled) | 57 | PASS — all match |
| 5. Poisson ±offset + glm.nb ±offset (fit, dispersion, theta, IRRs) | 128 | PASS — all match |
| meta (n) | 1 | PASS |

## Ladder verdicts (D1–D4) + package load checks under webr 0.6.0

All six ladder packages **install AND `library()` successfully** — no PMCMRplus/rcompanion-style
casualty this slice. Closure MiB = sum of new tgz sizes on repo.r-wasm.org (LOWER BOUNDS where the
installed version string ≠ repo filename, e.g. Rcpp 1.1.1 → `Rcpp_1.1.1-1.1.tgz`; misses listed in
webr-meta.json).

| Package | Version (webr) | Install | Closure | `library()` | Verdict |
|---|---|---|---|---|---|
| pROC | 1.19.0.1 | 2.5 s, +2 pkgs (Rcpp) | 2.54 MiB (0.56 + Rcpp 1.98, hand-checked) | ok 0.2 s | **D1: SHIP pROC.** AUC ≡ native ≡ hand rank identity. Card R map unchanged. |
| parameters | 0.29.1 | 1.9 s, +4 pkgs (insight, datawizard, bayestestR) | 4.35 MiB | ok 0.2 s | **D2: SHIP parameters.** β refit ≡ native; hand identity pinned (see below). |
| performance | 0.17.0 | 0.6 s, +1 pkg | 2.36 MiB | ok 0.0 s | **D3: SHIP performance.** r2_nagelkerke ≡ hand formula; check_overdispersion ≡ hand ratio. |
| caret | 7.0.1 | 49.5 s, +51 pkgs | ≥ 26.79 MiB (16 size misses) | ok 2.6 s | **D4: loads, but DO NOT ship.** Classification is hand-computed (convention 8); the 51-package closure is indefensible for an unused dep. Card's `caret::confusionMatrix()` R-map line → one-line truth-fix, flag to Benjie at slice end per D4. |
| MASS | 7.3.65 | preinstalled (ships with R) | — | ok 0.0 s | glm.nb works incl. in-formula offset; profile confint converges. Load-listed only. |
| broom | 1.0.13 | 5.4 s, +21 pkgs (dplyr/tidyr/tibble stack) | 23.05 MiB | ok 0.8 s | Loads fine. Named on the simple-linear card R map (B4); nothing in the battery *needs* it (all values come from summary/confint). Ship-or-truth-fix is a plan/B4 cost call — flag the 23 MiB closure. |
| car | 3.1.5 | 5.5 s, +27 pkgs | ≥ 10.31 MiB | ok 0.0 s | Already ships in the app; sandbox re-install just confirms 0.6.0 health. vif values ≡ native. |
| ggplot2 | 4.0.3 | (arrived inside caret's closure in this run order; ships in the app already) | — | ok | All four figures render via the engine.ts base `png()` device pattern. |

webr first-init + all installs ≈ 2 min in Node (no cache); the 343-key battery runs in 0.6 s.

## Conventions pinned (native = webr = these exact values)

1. **GVIF (multiple linear).** With any multi-df term, `car::vif(m)` returns a **matrix** with columns
   exactly `GVIF | Df | GVIF^(1/(2*Df))` (pinned string key `ml_vif_structure`). Table convention
   proven: report **(GVIF^(1/(2·Df)))²** for every term — for 1-df terms this is identically the plain
   GVIF (pre_score 1.249106308, age 1.414860417, group 1.037328861), for `method` (Df=2): GVIF
   1.556348368, GVIF^(1/4) 1.116931923, squared → **1.247536921** on the VIF scale. Every dummy row of
   one factor shows its parent term's value (vif is per-TERM: rownames pre_score/age/group/method).
2. **car::vif with exactly 1 predictor ERRORS** — message verbatim, both engines:
   `"model contains fewer than 2 terms"` → VIF cells render em-dash.
3. **Dummy term names** (R glued, pinned verbatim): coefficient rownames are
   `(Intercept)|pre_score|age|groupb|methodonline|methodworkshop` — reference levels 'a' and
   'lecture' (first-alphabetical). Mapping for the builder: strip the column-name prefix from the
   glued name → `group: b`, `method: online`, `method: workshop` rows.
4. **β refit semantics (the spike's one plan-relevant surprise).**
   `parameters::standardise_parameters(m, method='refit')`:
   - numeric terms: β = B·sd(x)/sd(y) EXACTLY (sl: 0.812044727 = hand; ml pre 0.7754218548, age
     0.0275933575 = hand).
   - **dummy terms: β = B/sd(y)** (response-only standardization; factors are NOT rescaled by refit):
     methodonline −0.216138004 = B/sd(y); the B·sd(dummy)/sd(y) candidate gives −0.107234480 — NO
     match. **Spec convention 2's hand-fallback wording ("dummy terms standardized the same way")
     must read B/SD(y) for dummies.** Moot for shipping (D2 ships parameters) but the plan should
     embed the corrected identity.
   - standardized intercept ≈ 0 (≤1e-17) → β intercept cell renders blank/em-dash per the ghost row.
5. **Model-fit SE (simple linear Table 1)** = `summary(m)$sigma` = 5.605309647.
6. **Logistic fit identities.** −2LL = −2·logLik = 45.90868521; omnibus χ² = null−residual deviance =
   9.543089235, df 3, p 0.02287735406; **Nagelkerke: performance::r2_nagelkerke ≡ hand formula
   (1−exp((D−D₀)/n))/(1−exp(−D₀/n)) = 0.2830028701 — identical to full precision** in both engines.
7. **Both event categories (logistic, releveled so the chosen level is glm's second).** Pinned exact
   symmetry, native ≡ webr on every key both ways:
   - B flips sign exactly (pre_score 0.07919051907 ↔ −0.07919051907).
   - OR inverts exactly (group b: 3.456845371 ↔ 0.2892810909 = 1/3.456845371).
   - Profile CI bounds swap AND invert (orlo_no = 1/orhi_yes: 1/15.44299562 = 0.06475427595).
   - −2LL, AIC (53.90868521), omnibus χ², Nagelkerke: INVARIANT.
   - **AUC: INVARIANT at 0.76 (not 1−AUC)** — the predictor (fitted P(event)) flips with the event,
     so the ROC is identical; pROC default direction is `<` under both relevels.
8. **Classification table (cutoff: P(event) ≥ 0.5 → event; rows = PREDICTED levels per the drawn
   `Predicted \ Observed` header).** Event 'yes': pred-no row = 13 obs-no / 7 obs-yes (65.0% correct);
   pred-yes row = 7 / 13 (65.0% correct). % correct is per-PREDICTED-row: 100·diag/rowsum. Event 'no'
   mirrors exactly. Hand 2×2 tabulation — caret never consulted.
9. **ROC/AUC equivalences (all = 0.76 in both engines, both event levels):** pROC::auc (default AND
   explicit levels/direction) ≡ hand rank/Mann–Whitney identity
   `(sum(rank(p)[event]) − n1(n1+1)/2)/(n1·n0)` ≡ trapezoid over the hand threshold sweep. Hand
   recipe: thresholds = −Inf, midpoints of sorted unique fitted probs, +Inf (41 points = pROC's own
   threshold count); tpr = mean(p[event] ≥ t), fpr = mean(p[other] ≥ t). Hand curve evaluated at
   pROC's thresholds: **max |Δsens|, |Δspec| = 0 exactly** (`roc_trace_maxabsdiff`).
10. **Poisson dispersion ≡:** hand `sum(residuals(m,'pearson')²)/df.residual` ≡
    `performance::check_overdispersion(m)$dispersion_ratio` to full precision — 2.107972385 (no
    offset), 1.686886555 (offset). Mild overdispersion as designed.
11. **glm.nb:** accepts `offset(log(months_observed))` IN-FORMULA (converged, no warnings, profile
    CIs fine). theta = 4.474253358 (SE 2.011765930) no-offset; 9.000773027 (SE 5.999165069) with
    offset. theta from `m$theta`, SE from `m$SE.theta`.
12. **Profile-likelihood CIs** (`confint` on glm/glm.nb, MASS profile) need
    `suppressMessages()` ("Waiting for profiling to be done…") — identical values both engines;
    OR/IRR CIs = `exp(confint(m))`.

## Figure recipes (rendered under webr 0.6.0 to the virtual FS — figures/, all verified visually)

Device = the app's engine.ts pattern: `png(path, width, height, res=110); tryCatch({print(p)},
finally=dev.off())`. Exact ggplot recipes in figures.R.

- **figure_fitted_line.png** — `geom_point` + `geom_smooth(method='lm', formula=y~x, se=TRUE)`. ✓
- **figure_residuals.png** — **RECOMMENDED composition: ONE file, one ggplot, `facet_wrap(~panel,
  scales='free')` over a stacked long data frame** (panel 1: fitted vs residuals; panel 2: Normal
  Q-Q with hand quantiles `qnorm(ppoints(n))` vs `sort(resid)`); per-panel reference lines via
  `geom_abline(data=refs)` (y=0 line and the quartile qqline: slope = IQR(resid)/IQR(z),
  intercept = q25 − slope·z25). No patchwork, no gridExtra, no extra install — pure ggplot2. ✓
- **figure_fitted_vs_residual.png** (Poisson/NB) — fitted vs Pearson residuals + dashed y=0. ✓
- **figure_roc.png** — `geom_line` over the hand ROC points (consecutive points differ in one
  coordinate, so the polyline IS the staircase), dashed diagonal, `annotate('text', label=
  sprintf('AUC = %.3f', auc))`, `coord_equal()`. Identical recipe in both D1 branches (points are
  hand-computed even though pROC ships — one code path, pROC only cross-checks AUC). ✓

## Known answers (native R 4.6.0 ground truth ≡ webr; implementation test targets)

Full machine-readable values: native.json / webr.json (10 sig digits via .telos_json);
side-by-side per-test CSVs in ground-truth/.

| Test | Key targets |
|---|---|
| Simple linear | R² 0.6594166388 · adj 0.6504539188 · F(1,38) 73.57327202 · p 2.024931906e-10 · sigma 5.605309647 · B_pre 0.6418170797 (SE 0.0748257769, t 8.577486346, CI 0.4903402136–0.7932939457) · β_pre 0.8120447271 |
| Multiple linear | R² 0.7502235119 · adj 0.7134916754 · F(5,34) 20.42433986 · p 2.245462388e-9 · sigma 5.074765894 · B: pre 0.612871402, age 0.01824257864, group:b 5.353172626, method:online −2.049172535, method:workshop −3.247840455 · VIF(adj): pre 1.249106308, age 1.414860417, group 1.037328861, method 1.247536921 |
| Logistic (event yes) | −2LL 45.90868521 · AIC 53.90868521 · Nagelkerke 0.2830028701 · omnibus χ²(3) 9.543089235 p 0.02287735406 · OR_pre 1.082410522 (profile CI 1.012732368–1.176927471) · OR_group:b 3.456845371 (0.8667073079–15.44299562) · classification 13/7/7/13, 65%/65% · AUC 0.76 |
| Logistic (event no) | B_pre −0.07919051907 · OR_pre 0.923863894 (0.8496700306–0.9874277069) · OR_group:b 0.2892810909 (0.06475427595–1.153792048) · AUC 0.76 · fit rows invariant |
| Poisson | no-offset: AIC 222.3674874, dev 87.56444 (df 37), dispersion 2.107972385, IRR_age 1.010654733 (1.001083633–1.02030167) · offset: AIC 202.3685105, dispersion 1.686886555, IRR_age 1.013346767 |
| Negative binomial | no-offset: AIC 211.2230262, theta 4.474253358 (SE 2.011765930), IRR_age 1.010798495 · offset: AIC 200.0961134, theta 9.000773027 (SE 5.999165069), IRR_age 1.013285719 (1.001024427–1.025753033) |

## Exact R recipes the plan should embed

```r
d$group <- factor(d$group); d$method <- factor(d$method)         # alphabetical refs: 'a', 'lecture'

# 1 — simple linear
m <- lm(post_score ~ pre_score, data = d)
s <- summary(m)   # s$r.squared, s$adj.r.squared, s$fstatistic (value,numdf,dendf), s$sigma
# p(model) = pf(f[1], f[2], f[3], lower.tail = FALSE); coefs = s$coefficients; CI = confint(m)
parameters::standardise_parameters(m, method = 'refit')$Std_Coefficient   # β (hand: B*sd(x)/sd(y))

# 2 — multiple linear (+ GVIF convention)
m <- lm(post_score ~ pre_score + age + group + method, data = d)
v <- car::vif(m)                                # matrix when any Df>1; plain vector when all Df==1
vif_per_term <- if (is.matrix(v)) v[, 3]^2 else v          # (GVIF^(1/(2*Df)))^2 ≡ GVIF for Df==1
# k=1: car::vif errors 'model contains fewer than 2 terms' -> em-dash cells

# 3 — logistic, event category = chosen level modeled as glm's SECOND factor level
y <- factor(d$passed, levels = c(setdiff(levels(factor(d$passed)), event), event))
m <- glm(y ~ pre_score + age + group, family = binomial, data = d)
# -2*logLik(m); AIC(m); omnibus = m$null.deviance - m$deviance, df = m$df.null - m$df.residual
# Nagelkerke = performance::r2_nagelkerke(m); OR table = exp(cbind(OR = coef(m), suppressMessages(confint(m))))
p <- fitted(m); pred <- factor(ifelse(p >= 0.5, event, other), levels = levels(y))
tab <- table(pred, y); pct_correct <- 100 * diag(tab) / rowSums(tab)      # rows = predicted
rk <- rank(p); auc <- (sum(rk[y == event]) - n1*(n1+1)/2) / (n1*n0)       # ≡ pROC::auc(pROC::roc(y, p, quiet=TRUE))
u <- sort(unique(p)); th <- c(-Inf, (u[-1]+u[-length(u)])/2, Inf)         # ROC points for the figure

# 4 — Poisson / NB (offset in-formula when Exposure assigned)
m  <- glm(complaints ~ age + group + offset(log(months_observed)), family = poisson, data = d)
dispersion <- sum(residuals(m, 'pearson')^2) / m$df.residual              # ≡ performance::check_overdispersion
mnb <- MASS::glm.nb(complaints ~ age + group + offset(log(months_observed)), data = d)
# mnb$theta, mnb$SE.theta; IRR table = exp(cbind(IRR = coef(m), suppressMessages(confint(m))))
```

## Surprises / risks for the plan

1. **β hand-identity for dummies is B/SD(y), not B·SD(dummy)/SD(y)** — convention 2's fallback
   wording needs that one-word fix in the plan (parameters ships, so it's documentation-grade).
2. **caret: loads fine but stays out** (51-pkg / ≥26.8 MiB closure, 49.5 s install). D4 truth-fix to
   the card's `caret::confusionMatrix()` R-map line goes on the slice-end ratify list.
3. **broom costs 23.05 MiB / 21 packages** and no computed value needs it — B4 ship decision should
   weigh that; if dropped, the simple-linear card R-map line naming broom gets the same one-line
   truth-fix treatment.
4. **AUC is event-invariant** (0.76 both ways) — the e2e "switch event category" assertion should
   target sign-flipped B / inverted OR, NOT a changed AUC.
5. Closure sizes from repo HEAD lookups are lower bounds when the wasm repo version string carries a
   build suffix (Rcpp_1.1.1-1.1.tgz); pROC's true closure hand-verified at 2.54 MiB.
6. `performance::check_overdispersion` returns its statistic as `$dispersion_ratio` — equal to the
   hand Pearson ratio to full precision, so either source is safe; ship the hand formula only if
   you want to skip the (cheap) performance call.
7. Profile CIs (`confint` on glm/glm.nb) emit "Waiting for profiling…" messages — wrap in
   `suppressMessages` to keep engine output JSON-clean.

## Artifacts (/tmp/regression-spike/)

regression.csv (frozen fixture) · fixture.R · battery.R (shared, sourced verbatim by both engines) ·
run-native.R · run-webr.mjs · compare.mjs · native.json · webr.json · webr-meta.json (ladder
install/load timings + closures) · compare-output.txt (343-line log) ·
ground-truth/{simple-linear,multiple-linear,logistic-event-yes,logistic-event-no,poisson-nb,meta}.csv
+ comparisons-summary.txt · figures.R + figures/{figure_fitted_line,figure_residuals,
figure_fitted_vs_residual,figure_roc}.png (rendered under webr 0.6.0, visually verified) ·
Rlib (native parameters/performance/pROC) · webr/ (npm sandbox, webr@0.6.0).
