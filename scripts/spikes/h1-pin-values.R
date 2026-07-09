# scripts/spikes/h1-pin-values.R
# Transcription aid for docs/superpowers/reviews/2026-07-10-h1-estimator-spike.md:
# regenerates every pinned 8dp value in that doc's tables via sprintf("%.8f", ...) in a
# clean, unwrapped format (lavaan's console printer wraps wide numeric vectors, which is
# error-prone to hand-copy). Every value printed here must match the corresponding entry
# in scripts/spikes/h1-spike-native.txt (the primary provenance artifact).
# Run: Rscript scripts/spikes/h1-pin-values.R > scripts/spikes/h1-pin-values.txt 2>&1
library(lavaan)
options(scipen = 999)
data(PoliticalDemocracy)
model <- '
  ind60 =~ x1 + x2 + x3
  dem60 =~ y1 + y2 + y3 + y4
  dem60 ~ ind60
'
set.seed(20260710)
pd <- PoliticalDemocracy
for (col in c("y1","y2","y3","y4")) {
  idx <- sample(seq_len(nrow(pd)), size = 6)
  pd[idx, col] <- NA
}

fmt <- function(x) sprintf("%.8f", x)

cells <- list(
  list(est = "ML",  miss = "listwise"),
  list(est = "ML",  miss = "ml"),
  list(est = "ML",  miss = "pairwise"),
  list(est = "MLR", miss = "listwise"),
  list(est = "MLR", miss = "ml")
)
headline <- c("chisq","df","pvalue","cfi","tli","rmsea","srmr",
              "chisq.scaled","df.scaled","pvalue.scaled","cfi.scaled","tli.scaled","rmsea.scaled",
              "cfi.robust","tli.robust","rmsea.robust")
for (c_ in cells) {
  fit <- lavaan::sem(model, data = pd, estimator = c_$est, missing = c_$miss)
  fm <- lavaan::fitMeasures(fit)
  cat("\n#### ", c_$est, "/", c_$miss, "\n")
  for (nm in headline) {
    if (nm %in% names(fm)) cat(sprintf("%-16s %s\n", nm, fmt(fm[[nm]])))
  }
  pe <- lavaan::parameterEstimates(fit)
  rows <- pe[4:8, c("lhs","op","rhs","est","se","ci.lower","ci.upper")]
  for (i in seq_len(nrow(rows))) {
    r <- rows[i,]
    cat(sprintf("PE row%d  %s %s %s   est=%s se=%s ci=[%s, %s]\n",
        i + 3, r$lhs, r$op, r$rhs, fmt(r$est), fmt(r$se), fmt(r$ci.lower), fmt(r$ci.upper)))
  }
}

cat("\n\n=== MLR/pairwise ===\nCELL FAILS (see h1-estimator-spike.R output and h1-mlr-pairwise-corroboration.R)\n")

# WLSMV Q3 section (same likert5 fixture generation as h1-estimator-spike.R, same seed)
mixed_model <- '
  A =~ a1 + a2 + a3
  C =~ cont1 + cont2
  B =~ b1 + b2 + b3
  B ~ A + C
'
set.seed(20260710)
n <- 300
lv <- rnorm(n)
lik <- function(x) cut(x + rnorm(n, sd = .8), breaks = c(-Inf, -1, -.3, .3, 1, Inf), labels = FALSE)
likert <- data.frame(a1 = lik(lv), a2 = lik(lv), a3 = lik(lv),
                     b1 = lik(-lv), b2 = lik(-lv), b3 = lik(-lv),
                     cont1 = lv + rnorm(n, sd = .5), cont2 = lv + rnorm(n, sd = .5))
headline_w <- c("chisq","df","pvalue","cfi","tli","rmsea","srmr","wrmr",
                "chisq.scaled","df.scaled","pvalue.scaled","cfi.scaled","tli.scaled","rmsea.scaled",
                "cfi.robust","tli.robust","rmsea.robust")
for (miss in c("listwise","pairwise")) {
  fit <- lavaan::sem(mixed_model, data = likert, estimator = "WLSMV",
                     ordered = c("a1","a2","a3","b1","b2","b3"), missing = miss)
  fm <- lavaan::fitMeasures(fit)
  cat("\n#### WLSMV /", miss, "\n")
  for (nm in headline_w) {
    if (nm %in% names(fm)) {
      v <- fm[[nm]]
      cat(sprintf("%-16s %s\n", nm, if (is.na(v)) "NA" else fmt(v)))
    }
  }
  pe <- lavaan::parameterEstimates(fit)
  br <- pe[pe$lhs == "B" & pe$op == "~", c("lhs","op","rhs","est","se")]
  for (i in seq_len(nrow(br))) {
    r <- br[i,]
    cat(sprintf("PE struct  %s %s %s   est=%s se=%s\n", r$lhs, r$op, r$rhs, fmt(r$est), fmt(r$se)))
  }
}
