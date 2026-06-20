# Spike 0c: PLS Extras — Finding Report
**Date:** 2026-06-20  
**Status:** DONE — success bar MET, PARITY-OK

## Summary

All four extraction recipes (f², Q²_predict, indirect-effect bootstrap CI, mixed formative) run successfully under **both native R 4.6.0 and WebR 0.6.0** and produce **bit-for-bit identical values** across all 30 output lines. MAKECLUSTER_SHIM was required (bootstrap_model in seminr always builds a PSOCK cluster). Timing: WebR run=17.7s / total=57.2s for nboot=500, consistent with spike 0b timing data.

---

## 1. f² (Cohen's f-squared) — EXTRACTED, PARITY-OK

**Accessor:** `summary(est)$fSquare` — returns a predictor × outcome matrix.

```
fsquare_dimnames = Image|Expectation|Satisfaction
fsquare_vals     = 0, 0, 0, 0.3505897754, 0, 0, 0.5128647213, 0.0705561085, 0
```

The 3×3 matrix rows=Image/Expectation/Satisfaction, cols=same; off-diagonal entries are f² for each predictor→outcome path. Only the lower-left triangle has non-zero values (Image→Expectation=0.351, Image→Satisfaction=0.513, Expectation→Satisfaction=0.071); diagonal and impossible paths are zero.

**Build recipe for Unit 7 / table 4:**
```r
s <- summary(est)
f2_matrix <- s$fSquare   # dim: [constructs × constructs]; row=predictor, col=outcome
```

**Fallback (not needed):** If `$fSquare` were absent, hand-roll: `f2 = R2_full - R2_restricted` / `(1 - R2_full)` by re-estimating without each predictor. Not needed — `$fSquare` is present and verified.

---

## 2. Q² — DECISION: PLSpredict Q²_predict (column label `Q²_predict`)

### 2a. Classic blindfolding Q² (Stone-Geisser)

`q2_classic_source=absent` — `blindfold()` is NOT exported from the `seminr` namespace in the version available under WebR 0.6.0. Classic Q² is **unavailable** without hand-rolling the omission procedure.

### 2b. PLSpredict Q²_predict (Shmueli et al. 2019) — AVAILABLE, PARITY-OK

`predict_pls()` IS available and runs cleanly. The `summary()` output structure requires care:
- `summary(pp)$PLS_out_of_sample` is indexed by **RMSE/MAE × item** — there is NO `Q2_predict` column.
- Correct extraction: `Q²_predict per indicator = 1 − PLS_RMSE² / LM_RMSE²`

```r
sp       <- summary(pp)
q2_pred  <- 1 - sp$PLS_out_of_sample["RMSE",]^2 / sp$LM_out_of_sample["RMSE",]^2
# Per-construct mean (for table column):
mean(q2_pred[indicator_names_for_construct])
```

Values confirmed identical native ≡ WebR:
```
q2predict_items             = CUEX1|CUEX2|CUEX3|CUSA1|CUSA2|CUSA3
q2predict_vals              = 0.071, 0.077, -0.019, 0.020, 0.053, 0.042
q2predict_mean_Expectation  = 0.043
q2predict_mean_Satisfaction = 0.039
```

### Q² RULING (per spec §5.2 / owner ruling 5)

> **Build path: PLSpredict `Q²_predict`.** Classic blindfolding is absent from seminr under WebR. The §5.2 table 5 column label will be **`Q²_predict`**. The cutoff is the Shmueli (2019) benchmark: `Q²_predict > 0` indicates predictive relevance beyond the LM naïve baseline. The spec explicitly permits this relabeled form; it is NOT omitted and NOT hand-rolled.

---

## 3. Indirect-effect significance — CI CONFIRMED, PARITY-OK

`specific_effect_significance()` returns a **matrix** (class `matrix array table_output`) with columns:

```
indirect_colnames = Original Est.|Bootstrap Mean|Bootstrap SD|T Stat.|2.5% CI|97.5% CI|Bootstrap P Val
```

The **2.5% CI** and **97.5% CI** columns are present as named matrix columns — the card promise "bootstrap 95% CI" is satisfied directly.

**Extraction recipe (column indexing, not `names()` which returns NULL on a matrix):**
```r
bo  <- bootstrap_model(seminr_model = est, nboot = NB, cores = 1)
ind <- specific_effect_significance(bo, from="X", through="M", to="Y", alpha=0.05)
ci_lo <- ind[, "2.5% CI"]
ci_hi <- ind[, "97.5% CI"]
est   <- ind[, "Original Est."]
p     <- ind[, "Bootstrap P Val"]
```

Values confirmed identical native ≡ WebR:
```
indirect_original = 0.11040891
indirect_ci_lo    = 0.03609102011
indirect_ci_hi    = 0.1760749992
indirect_p        = 0.004
```

---

## 4. Mixed reflective+formative model — ALL EXTRACTABLE, PARITY-OK

A model with Image as mode_B (formative) and Expectation/Satisfaction as mode_A (reflective).

### 4a. Formative weights
```r
s2      <- summary(est2)
img_wt  <- s2$weights[s2$weights[,"Image"] != 0, "Image"]
```
Values: IMAG1=0.305, IMAG2=0.318, IMAG3=0.132, IMAG4=0.347, IMAG5=0.315 — confirmed identical.

### 4b. Indicator VIF
`s2$validity$vif_items` is a **named list** (keyed by construct name), NOT a matrix. Correct extraction:
```r
img_vif <- s2$validity$vif_items[["Image"]]   # named numeric vector
```
Values: IMAG1=1.468, IMAG2=1.225, IMAG3=1.259, IMAG4=1.510, IMAG5=1.403 — all < 3 cutoff, confirmed identical.

### 4c. Reflective fallback loadings (≥.50)
```r
img_ld <- s2$loadings[s2$loadings[,"Image"] != 0, "Image"]
```
Values: IMAG1=0.753, IMAG2=0.650, IMAG3=0.503, IMAG4=0.767, IMAG5=0.733 — all ≥ 0.50, confirmed identical.

### 4d. Redundancy analysis convergent validity
`cor(est2$construct_scores[,"Image"], mobi[,"IMAG1"])` = **0.753** — confirmed identical.

> **Note:** The spec's "≥.70" convergent validity threshold uses `IMAG1` as a single-item global proxy. Here r=0.753 passes. The production build should use a purpose-built single global item or the first indicator per convention (Hair et al. 2019, §4 formative path). The redundancy-analysis path is feasible under WebR — no fallback triggered.

---

## Parity evidence

```
diff /tmp/0c-n.txt /tmp/0c-w.txt
(exit 0 after excluding [webr] timing header line)
PARITY-OK
```

All 28 value/name output lines are **bit-for-bit identical** between native R 4.6.0 and WebR 0.6.0.

---

## Implementation notes for Unit 7 / Sub-slice B build

| Item | Accessor | Caveats |
|---|---|---|
| f² | `summary(est)$fSquare` — matrix [pred×outcome] | None |
| Q²_predict | `1 - sp$PLS_out_of_sample["RMSE",]^2 / sp$LM_out_of_sample["RMSE",]^2` | No direct column in summary; must compute from RMSE |
| Indirect CI | `specific_effect_significance(bo,...)[, "2.5% CI"]` etc. | Use `[, colname]` matrix indexing, NOT `names()` |
| Formative VIF | `summary(est2)$validity$vif_items[["ConstructName"]]` | vif_items is a LIST, not a matrix |
| Formative weights | `summary(est2)$weights[rows, "ConstructName"]` | Standard matrix indexing |
| Reflective loadings fallback | `summary(est2)$loadings[rows, "ConstructName"]` | Standard matrix indexing |
| Redundancy r | `cor(est2$construct_scores[,"C"], mobi[,"global_item"])` | Global proxy item is a design choice |

---

## Success bar

- [x] `$fSquare` extracted + parity
- [x] Q² flavor decided: **PLSpredict `Q²_predict`** (blindfold absent); column label pinned for §5.2 table 5
- [x] `specific_effect_significance` returns **2.5% CI / 97.5% CI** columns — not just p
- [x] Mixed formative model produces weights, VIF, redundancy r, reflective loadings — all extractable + parity
- [x] `diff` clean: PARITY-OK
- [x] No fallback triggered for formative validity

**Status: SUCCESS — all four extraction recipes confirmed, PARITY-OK, Q² decision made.**
