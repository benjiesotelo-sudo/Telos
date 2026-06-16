# modelsummary table-format slice — Task 1 ground-truth spike

**Date:** 2026-06-16 · native R 4.6.0 · modelsummary 2.6.0 · plm/AER/MASS/rdrobust/MatchIt present
Verifies the one new model (entity-FE DiD = Option B), the new GOF-row recipes + which rows are meaningful per model family, and the canonical `modelsummary()` call for the exported R script. All numbers below are verbatim native-R output on the committed fixtures.

## 1. Entity-fixed-effects DiD (#8 = Option B) — `tests/e2e/fixtures/panel.csv`

```r
d  <- read.csv("tests/e2e/fixtures/panel.csv")           # firm,year,roa,leverage,rd_spend,size,treated,post (96 rows)
pd <- plm::pdata.frame(d, index=c("firm","year"))
m  <- plm::plm(roa ~ post + treated:post, data=pd, model="within")
vc <- plm::vcovHC(m, method="arellano", type="HC1", cluster="group")
lmtest::coeftest(m, vcov.=vc); lmtest::coefci(m, vcov.=vc)
```

| Term | Estimate | Clustered SE | 95% CI |
|---|---|---|---|
| Post | 2.015083 | 0.086275 | [1.843456, 2.186711] |
| Treated × Post (`post:treated`) | **1.525625** | 0.116532 | [1.293806, 1.757444] |

Within R² = **0.8406621** · adj within R² = 0.8154012 · N = **96** · N entities = **12** · balanced (4 cells × 24).
The time-invariant `treated` main effect is **absorbed** by the within transform — only `post` + `post:treated` are estimated (the drawn card's "Treated absorbed" note is now true). DiD effect 1.5256 matches the prior plain-`lm` build (CI slightly tighter).

## 2. New GOF rows — recipe + meaningfulness per model family

Generic (likelihood models): `Num.Obs = nobs(m)`; `RMSE = sqrt(mean(residuals(m, type="response")^2))`; `AIC(m)`; `BIC(m)`; `as.numeric(logLik(m))`.

| Family (tests) | Footer rows to show | OMIT (no method / not meaningful) |
|---|---|---|
| **lm** (simple, multiple linear) | Num.Obs, R², R² Adj., F, RMSE, AIC, BIC, Log.Lik. | — |
| **glm logistic** | Num.Obs, AIC, BIC, Log.Lik. + kept Nagelkerke R²/omnibus χ²/−2LL | R²/Adj.R² (undefined → use Nagelkerke); F (cautious) |
| **glm poisson / glm.nb** | Num.Obs, AIC, BIC, Log.Lik. + kept dispersion/theta/resid-deviance | R²/Adj.R², F |
| **ARIMA** (`forecast::Arima`) | Num.Obs + existing AIC/BIC/Log.Lik./σ²/Ljung–Box | R²/F (n/a) |
| **VAR per-equation** (each is an `lm`) | per-eq R², R² Adj., RMSE, Log.Lik. + Num.Obs; selected-lag p + max-root-modulus + stable flag | — |
| **plm within** (FE, RE, Hausman, **DiD**) | Num.Obs, N entities, within R² (`rsq`), adj within R² (`adjrsq`), F (`summary(m)$fstatistic`) | **AIC/BIC/Log.Lik. — no `logLik` method for `plm`** |
| **AER::ivreg** (IV/2SLS) | Num.Obs, RMSE, structural R²/Adj.R² (caveat), **structural Wald F = `summary(.,diagnostics=T)$waldtest[1]`**, diagnostics (weak-IV F, Wu-Hausman, Sargan) | AIC/BIC/Log.Lik. — no method |
| **rdrobust** (RDD) | effective N within bw (`N_h` L/R = 22/22), total N L/R (101/99), bandwidth `h` | R²/AIC/BIC/Log.Lik./RMSE — no method (local nonparametric) |
| **MatchIt** (PSM) | matched N (134 = 67+67), treated/control matched (67/67) | R²/AIC/BIC/Log.Lik./RMSE — matching is preprocessing, not a fit |

Verified values (regression.csv lm): N=40, RMSE=5.437965, AIC=256.9875, BIC=263.743, logLik=−124.4937. IV diagnostics (causal.csv, just-identified): weak-IV F=438.50, Wu-Hausman=1022.75, Sargan NA. **IV gotcha:** `summary(.,diagnostics=TRUE)$waldtest` is `c(stat, p, df1, df2)` → structural **F = waldtest[1]** (not [2]).

## 3. Canonical exported-script `modelsummary()` call

One signature, parameterized by family (the ONLY per-family deltas: `exponentiate=TRUE` + drop `std.error` for glm odds-ratio tests). `stars=FALSE` + `statistic=c("std.error","conf.int")` is the report-only contract. Verified to render no stars, SE in parens + CI `[lo,hi]` beneath, for lm / glm-exponentiated / plm-within.

```r
library(modelsummary)
gof <- c("nobs","r.squared","adj.r.squared","aic","bic","logLik","rmse")  # rows a family lacks are silently dropped
# lm / plm within:
modelsummary(list("(1)" = model), statistic=c("std.error","conf.int"), stars=FALSE, fmt=3, gof_map=gof, output="markdown")
# glm odds-ratio (logistic) / IRR (poisson):
modelsummary(list("Odds ratio" = model), exponentiate=TRUE, statistic="conf.int", stars=FALSE, fmt=3, gof_map=gof, output="markdown")
```

## 4. Caveats

- **Extreme exponentiated values** (near-separation) print in scientific notation (e.g. an OR of 1.56e8 when a predictor perfectly separates) — `fmt` can't force fixed decimals at that magnitude. This is real data, not a format bug; Telos already guards logistic (quasi-)separation with a stop() message (commit `963fcf6`). No new action.
- **RMSE for glm/glm.nb** uses response-scale residuals (the interpretable form).
- **plm/ivreg/rdrobust/matchit have no `logLik`** → never call AIC/BIC/logLik on them (see table).
