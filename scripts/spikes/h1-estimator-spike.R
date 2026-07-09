# scripts/spikes/h1-estimator-spike.R
# Q1: exact fitMeasures names available under MLR and WLSMV (robust vs scaled)
# Q2: missing="ml"/"pairwise"/"listwise" all run under sem() for ML and MLR
# Q3: WLSMV with mixed ordered= + continuous indicators fits
# Q4: parameterEstimates() CIs without bootstrap are delta-method (documents cell 4-8 CI provenance)
# Q5 lives in the WebR twin: NaN in the data.frame is treated as missing (is.na(NaN) is TRUE)
library(lavaan)

# DEVIATION from brief transcription: two mechanical problems with the
# transcribed round()+print() calls below, discovered by actually running
# the script:
# (1) round() cannot be applied directly to a parameterEstimates() data.frame
#     the way the brief writes it: subsetting columns still leaves the
#     lavaan.data.frame S3 class attached in some cases, and current R's
#     Math.data.frame generic errors on the character id columns (lhs, op,
#     rhs) in others ("non-numeric-alike variable(s) in data frame").
# (2) lavaan's own print.lavaan.vector / print.lavaan.data.frame S3 methods
#     hardcode `nd = 3L` (see getS3method("print","lavaan.vector")), so even
#     after round(x, 8) the printed text is truncated back down to 3 decimal
#     places - options(digits=...) does not affect it either, since nd is a
#     literal default, not tied to getOption("digits").
# Fix: pass nd = 8 straight into print() and drop the separate round() call
# entirely (the print method rounds internally to `nd`). This changes only
# how many decimals are displayed - no computed value, estimator name, seed,
# or threshold from the brief is altered.
print8 <- function(x) print(x, nd = 8)

data(PoliticalDemocracy)
model <- '
  ind60 =~ x1 + x2 + x3
  dem60 =~ y1 + y2 + y3 + y4
  dem60 ~ ind60
'
# Punch deterministic holes for the missing cells (seeded, ~8% of cells in y1..y4)
set.seed(20260710)
pd <- PoliticalDemocracy
for (col in c("y1","y2","y3","y4")) {
  idx <- sample(seq_len(nrow(pd)), size = 6)
  pd[idx, col] <- NA
}
write.csv(pd, "scripts/spikes/politicalDemocracy-missing.csv", row.names = FALSE)

cells <- list(
  list(est = "ML",    miss = "listwise"),
  list(est = "ML",    miss = "ml"),
  list(est = "ML",    miss = "pairwise"),
  list(est = "MLR",   miss = "listwise"),
  list(est = "MLR",   miss = "ml"),
  list(est = "MLR",   miss = "pairwise")
)
# DEVIATION from brief transcription: wrap fit in tryCatch so a single failing
# cell (see MLR/pairwise below) does not abort the whole spike; every other
# cell's output still gets captured, and the failure itself is a Q2 finding.
for (c_ in cells) {
  cat("=== ", c_$est, "/", c_$miss, " ===\n")
  fit <- tryCatch(
    lavaan::sem(model, data = pd, estimator = c_$est, missing = c_$miss),
    error = function(e) { cat("CELL FAILED:", conditionMessage(e), "\n"); NULL }
  )
  if (is.null(fit)) next
  print8(lavaan::fitMeasures(fit))          # Q1: dump EVERY name; note .scaled/.robust
  print8(lavaan::parameterEstimates(fit)[, c("lhs","op","rhs","est","se","ci.lower","ci.upper")])
}

# Q3: WLSMV, mixed ordinal + continuous (likert5 fixture written here too)
set.seed(20260710)
n <- 300
lv <- rnorm(n)
lik <- function(x) cut(x + rnorm(n, sd = .8), breaks = c(-Inf, -1, -.3, .3, 1, Inf), labels = FALSE)
likert <- data.frame(a1 = lik(lv), a2 = lik(lv), a3 = lik(lv),
                     b1 = lik(-lv), b2 = lik(-lv), b3 = lik(-lv),
                     cont1 = lv + rnorm(n, sd = .5), cont2 = lv + rnorm(n, sd = .5))
write.csv(likert, "docs/testing/likert5.csv", row.names = FALSE)
mixed_model <- '
  A =~ a1 + a2 + a3
  C =~ cont1 + cont2
  B =~ b1 + b2 + b3
  B ~ A + C
'
for (miss in c("listwise", "pairwise")) {
  fit <- lavaan::sem(mixed_model, data = likert, estimator = "WLSMV",
                     ordered = c("a1","a2","a3","b1","b2","b3"), missing = miss)
  cat("=== WLSMV /", miss, " ===\n")
  print8(lavaan::fitMeasures(fit))
  print8(lavaan::parameterEstimates(fit)[, c("lhs","op","rhs","est","se")])
}
