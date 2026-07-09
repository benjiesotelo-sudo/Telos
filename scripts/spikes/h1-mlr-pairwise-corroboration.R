# scripts/spikes/h1-mlr-pairwise-corroboration.R
# Corroboration for the Q2 finding in docs/superpowers/reviews/2026-07-10-h1-estimator-spike.md:
# the MLR + missing="pairwise" hard error is NOT specific to the PoliticalDemocracy fixture.
# A fresh, clean n=5000 two-factor model with 5% MCAR holes scattered across all 6 indicators
# (different seed, no overlap with the spike fixture) hits the same error from the same
# internal step (lav_model_vcov -> eigen).
# Run: Rscript scripts/spikes/h1-mlr-pairwise-corroboration.R > scripts/spikes/h1-mlr-pairwise-corroboration.txt 2>&1
library(lavaan)
set.seed(1)
n <- 5000
lv <- rnorm(n)
df <- data.frame(
  x1 = lv + rnorm(n, sd = .3), x2 = lv + rnorm(n, sd = .3), x3 = lv + rnorm(n, sd = .3),
  y1 = 0.6 * lv + rnorm(n, sd = .5), y2 = 0.6 * lv + rnorm(n, sd = .5), y3 = 0.6 * lv + rnorm(n, sd = .5)
)
# scatter missing completely at random, low rate (5% per column)
for (col in names(df)) {
  idx <- sample(seq_len(n), size = round(n * 0.05))
  df[idx, col] <- NA
}
model <- "
  X =~ x1 + x2 + x3
  Y =~ y1 + y2 + y3
  Y ~ X
"
fit <- tryCatch(
  lavaan::sem(model, data = df, estimator = "MLR", missing = "pairwise"),
  error = function(e) { cat("ERROR:", conditionMessage(e), "\n"); NULL }
)
cat("MLR + pairwise succeeded:", !is.null(fit), "\n")
# Sanity check: the same data/model runs fine under the two supported missing modes.
for (miss in c("listwise", "ml")) {
  fit2 <- tryCatch(
    lavaan::sem(model, data = df, estimator = "MLR", missing = miss),
    error = function(e) { cat("ERROR (", miss, "):", conditionMessage(e), "\n"); NULL }
  )
  cat("MLR +", miss, "succeeded:", !is.null(fit2), "\n")
}
