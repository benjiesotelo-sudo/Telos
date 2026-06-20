# Spike 0c — PLS "extras" not covered by the feasibility spike: f^2, Q^2 (both flavors), indirect-effect
# bootstrap CI, and a MIXED reflective+formative model. Run IDENTICALLY native R 4.6.0 + WebR 0.6.0.
# nboot is reduced (500) — 0b owns the 5000-resample timing/parity; 0c verifies the EXTRACTION SURFACE + parity.
options(warn = 1)
suppressMessages(library(seminr))
NB <- 500
emit  <- function(tag, v)  cat(sprintf("%s=%s\n", tag, paste(formatC(v, format='g', digits=10), collapse=',')))
emitc <- function(tag, v)  cat(sprintf("%s=%s\n", tag, paste(as.character(v), collapse=',')))
set.seed(20260620)

# ---- (A) Reflective model: f^2, classic blindfolding Q^2, PLSpredict Q^2_predict, indirect CI ----
mm <- constructs(
  composite("Image",        multi_items("IMAG", 1:5)),
  composite("Expectation",  multi_items("CUEX", 1:3)),
  composite("Satisfaction", multi_items("CUSA", 1:3))
)
sm <- relationships(
  paths(from = "Image",       to = "Expectation"),
  paths(from = "Expectation", to = "Satisfaction"),
  paths(from = "Image",       to = "Satisfaction")
)
est <- estimate_pls(data = mobi, measurement_model = mm, structural_model = sm)
s   <- summary(est)
emitc("fsquare_dimnames", paste(dimnames(s$fSquare)[[1]], collapse="|"))
emit("fsquare_vals", as.numeric(s$fSquare))   # f^2 matrix (predictor x outcome)

# classic blindfolding Q^2: present if seminr exposes it cheaply
q2_classic <- tryCatch({
  if (exists("blindfold", where = asNamespace("seminr"))) {
    bf  <- seminr::blindfold(est, omission = 7)
    sbf <- summary(bf)
    emitc("q2_classic_source", "blindfold")
    as.numeric(sbf$Q2)
  } else {
    emitc("q2_classic_source", "absent")
    NA_real_
  }
}, error = function(e) {
  emitc("q2_classic_source", paste0("error:", conditionMessage(e)))
  NA_real_
})
emit("q2_classic", q2_classic)

# PLSpredict Q^2_predict (out-of-sample, Shmueli 2019).
# Extraction: Q2_predict per indicator = 1 - SSE_PLS_oos / SSE_LM_oos
# Summary$PLS_out_of_sample has NO Q2_predict column — must compute from residuals or RMSE^2.
pp <- tryCatch({
  predict_pls(model = est, technique = predict_DA, noFolds = 5, reps = 1)
}, error = function(e) {
  emitc("plspredict_source", paste0("error:", conditionMessage(e)))
  NULL
})
if (!is.null(pp)) {
  emitc("plspredict_source", "predict_pls")
  sp <- summary(pp)
  # Q2_predict = 1 - PLS_RMSE^2 / LM_RMSE^2  (equivalent to SSE ratio; both metrics confirmed equal)
  pls_rmse <- sp$PLS_out_of_sample["RMSE", ]
  lm_rmse  <- sp$LM_out_of_sample["RMSE",  ]
  q2_pred  <- 1 - pls_rmse^2 / lm_rmse^2
  emitc("q2predict_items", paste(colnames(sp$PLS_out_of_sample), collapse="|"))
  emit("q2predict_vals",   as.numeric(q2_pred))
  # Mean per construct (for table column)
  constructs_in_scope <- list(
    Expectation  = c("CUEX1","CUEX2","CUEX3"),
    Satisfaction = c("CUSA1","CUSA2","CUSA3")
  )
  for (cn in names(constructs_in_scope)) {
    items_cn <- intersect(constructs_in_scope[[cn]], names(q2_pred))
    emit(paste0("q2predict_mean_", cn), mean(q2_pred[items_cn]))
  }
}

# indirect effect (Image -> Expectation -> Satisfaction) significance WITH a bootstrap CI, not just p
bo  <- bootstrap_model(seminr_model = est, nboot = NB, cores = 1)
ind <- specific_effect_significance(bo, from = "Image", through = "Expectation",
                                    to = "Satisfaction", alpha = 0.05)
# ind is a matrix; colnames carry the field names (incl. "2.5% CI" and "97.5% CI")
emitc("indirect_colnames",  paste(colnames(ind), collapse="|"))
emitc("indirect_rownames",  paste(rownames(ind), collapse="|"))
emit("indirect_original",   ind[, "Original Est."])
emit("indirect_ci_lo",      ind[, "2.5% CI"])
emit("indirect_ci_hi",      ind[, "97.5% CI"])
emit("indirect_p",          ind[, "Bootstrap P Val"])

# ---- (B) MIXED reflective + formative model: weights, indicator VIF, redundancy, loading>=.50 ----
mm2 <- constructs(
  composite("Image",        multi_items("IMAG", 1:5), weights = mode_B),   # FORMATIVE
  composite("Expectation",  multi_items("CUEX", 1:3)),                     # reflective (mode_A default)
  composite("Satisfaction", multi_items("CUSA", 1:3))                      # reflective
)
est2 <- estimate_pls(data = mobi, measurement_model = mm2, structural_model = sm)
s2   <- summary(est2)

# Formative weights (non-zero rows in the Image column)
img_wt_rows <- s2$weights[, "Image"] != 0
emitc("formative_weight_items", paste(rownames(s2$weights)[img_wt_rows], collapse="|"))
emit("formative_weights",       as.numeric(s2$weights[img_wt_rows, "Image"]))

# Indicator VIF (stored in validity$vif_items — it's a LIST keyed by construct name, not a matrix)
img_vif  <- s2$validity$vif_items[["Image"]]
emitc("vif_dimnames",  paste(names(img_vif), collapse="|"))
emit("formative_vif",  as.numeric(img_vif))   # VIF (<3 cutoff)

# Reflective fallback loadings (>=.50 threshold)
img_ld_rows <- s2$loadings[, "Image"] != 0
emitc("formative_loading_items", paste(rownames(s2$loadings)[img_ld_rows], collapse="|"))
emit("formative_loadings",       as.numeric(s2$loadings[img_ld_rows, "Image"]))

# Redundancy convergent validity: cor(formative composite, single-item global proxy)
# Using IMAG1 as the global single-item proxy (first indicator)
redun <- tryCatch({
  g    <- mobi[, "IMAG1"]
  comp <- est2$construct_scores[, "Image"]
  cor(comp, g)
}, error = function(e) {
  emitc("redundancy_source", paste0("error:", conditionMessage(e)))
  NA_real_
})
emitc("redundancy_source", "cor_imag1")
emit("redundancy_r",  redun)
