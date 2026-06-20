# Spike 0b — single 5000-resample bootstrap, run IDENTICALLY in native R 4.6.0 and WebR 0.6.0.
# Confirms: (1) one awaited call completes in WASM (no RNG chunking), (2) percentile CIs match native,
# (3) per-resample wall-time for the progress estimate. set.seed makes the shared Mersenne-Twister bit-reproducible.
options(warn = 1)
suppressMessages({ library(lavaan); library(seminr) })
NB <- 5000
emit <- function(tag, v) cat(sprintf("%s=%s\n", tag, paste(formatC(v, format='g', digits=10), collapse=',')))

# ---- CB-SEM mediation: X -> M -> Y indirect, percentile bootstrap CI ----
# PoliticalDemocracy: ind60 (x1-x3) -> dem60 (y1-y4) -> dem65 (y5-y8).
# Full latent variable model: measurement + structural mediation.
set.seed(20260620)
pd <- PoliticalDemocracy
med.model <- '
  # Measurement
  ind60 =~ x1 + x2 + x3
  dem60 =~ y1 + y2 + y3 + y4
  dem65 =~ y5 + y6 + y7 + y8
  # Structural (mediation)
  dem60 ~ a*ind60
  dem65 ~ b*dem60 + cp*ind60
  # Indirect effect
  ind := a*b
'
gc()
t0 <- Sys.time()
fit <- sem(med.model, data = pd, se = "bootstrap", bootstrap = NB)
cb_secs <- as.numeric(difftime(Sys.time(), t0, units = "secs"))
gc()
pe <- parameterEstimates(fit, boot.ci.type = "perc", level = 0.95)
ind <- pe[pe$label == "ind", ]
emit("cb_indirect_est", ind$est); emit("cb_indirect_se", ind$se)
emit("cb_indirect_ci", c(ind$ci.lower, ind$ci.upper)); emit("cb_indirect_p", ind$pvalue)
emit("cb_nboot", NB); emit("cb_secs", round(cb_secs, 2))

# ---- PLS-SEM: seminr bootstrap, percentile CI (default), mobi ----
set.seed(20260620)
mm <- constructs(
  composite("Image",        multi_items("IMAG", 1:5)),
  composite("Expectation",  multi_items("CUEX", 1:3)),
  composite("Satisfaction", multi_items("CUSA", 1:3))
)
sm <- relationships(
  paths(from = c("Image","Expectation"), to = "Satisfaction"),
  paths(from = "Image", to = "Expectation")
)
gc()
t1 <- Sys.time()
est <- estimate_pls(data = mobi, measurement_model = mm, structural_model = sm)
bo  <- bootstrap_model(seminr_model = est, nboot = NB, cores = 1)
pls_secs <- as.numeric(difftime(Sys.time(), t1, units = "secs"))
gc()
sb <- summary(bo, alpha = 0.05)   # seminr CIs are percentile by construction
bp <- sb$bootstrapped_paths
emit("pls_path_labels", rownames(bp))
emit("pls_path_beta", bp[, "Original Est."])
emit("pls_path_ci_low", bp[, "2.5% CI"]); emit("pls_path_ci_high", bp[, "97.5% CI"])
emit("pls_nboot", NB); emit("pls_secs", round(pls_secs, 2))
