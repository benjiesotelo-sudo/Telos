# scripts/spikes/pathwlsmv-pin-values.R
# Path-mode WLSMV slice, Task 1: native-R pins for the path-analysis WLSMV cell (a plain
# structural-regression fit, no latent constructs, distinct from H1's cells 6-7 which are
# CB-SEM/CFA-style fits on the SAME fixture). Reuses tests/e2e/fixtures/likert5-missing.csv
# (already committed by H1 Task 4 -- same file, no regeneration) unchanged.
#
# Two models per the spec (docs/superpowers/specs/2026-07-11-path-mode-wlsmv-design.md, scope
# item 5) and the plan (.superpowers/sdd/task-1-brief.md):
#   1. Saturated:      cont2 ~ a1 + b1                    (df=0; structural estimates still pin,
#                       fit indices are saturation-suppressed -- printed anyway for completeness,
#                       NA/degenerate ones omitted from the TS pins per the H1 convention)
#   2. Non-saturated:  cont2 ~ a1 + b1 ; cont1 ~ cont2      (df>0; a genuine fit-indices-bearing pin)
# Both: estimator = "WLSMV", ordered = c("a1","b1"), missing default (listwise).
#
# PROPER-SOLUTION GUARANTEE (same discipline as h1-likert-missing-pin-values.R): each fit is
# verified to pass lavaan's post.check AND to raise no warning OTHER than one specific, benign,
# EXPECTED class documented below. If either model prints PROPER: FALSE, do not pin from that
# run -- adjust the model choice minimally (e.g. swap which columns are ordered) rather than
# pinning a degenerate/improper fit.
#
# EXPECTED WARNING CLASS (verified benign, not a sign of a degenerate fit -- see
# scripts/spikes/pathwlsmv-warning-check.txt for the full investigation): a1/b1 here are PURELY
# exogenous predictors (they only ever appear on the RHS of `~`, never as a response and never as
# an indicator of a latent factor via `=~`). This is new relative to H1's WLSMV cells 6-7, whose
# ordinal items (a1..a3, b1..b3) were always endogenous measurement-model indicators (`A =~ a1 +
# a2 + a3`) and so never hit this path. lavaan warns
# "exogenous variable(s) declared as ordered in data" / "parameter table does not contain
# thresholds" for such variables because it cannot estimate a threshold structure for a variable
# that is never modeled as a response -- it simply uses a1/b1's raw values directly as regressors,
# same as if `ordered=` had omitted them. CONFIRMED (see scripts/spikes/pathwlsmv-warning-check.txt):
# the shared structural estimates (cont2~a1, cont2~b1, cont2~~cont2) agree to ~9 significant digits
# whether or not a1/b1 are declared ordered in this exact model (the ~1e-9 residual is optimizer-path
# rounding, not a real difference) -- the declaration is a documented no-op for a purely exogenous
# ordinal predictor under WLSMV, not a sign of misspecification. lavInspect(fit,
# "post.check") is TRUE for both models below. This is the intended production scenario (spec
# item 5's own example: "ordinal used only as a predictor"), so the model is NOT swapped to dodge
# the warning -- that would stop testing the feature being shipped. Any OTHER warning text below
# fails the stopifnot() and must not be pinned.
#
# Run: Rscript scripts/spikes/pathwlsmv-pin-values.R > scripts/spikes/pathwlsmv-pin-values.txt 2>&1
library(lavaan)
options(scipen = 999)
cat("lavaan", as.character(packageVersion("lavaan")), " R", R.version.string, "\n")

data <- read.csv("tests/e2e/fixtures/likert5-missing.csv")

fmt <- function(x) if (is.na(x)) "NA" else sprintf("%.8f", x)

# Benign, expected warning fragments for a purely-exogenous ordinal predictor (see the header
# note above) -- any warning NOT matching one of these substrings is treated as fatal.
EXPECTED_WARNING_FRAGMENTS <- c(
  "exogenous variable\\(s\\) declared as ordered",
  "parameter table does not contain thresholds"
)

fit_and_report <- function(label, model, ordered_cols) {
  warns <- character(0)
  fit <- withCallingHandlers(
    lavaan::sem(model, data = data, estimator = "WLSMV", ordered = ordered_cols),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") }
  )
  post_ok <- isTRUE(suppressWarnings(lavaan::lavInspect(fit, "post.check")))
  unexpected <- warns[!vapply(warns, function(w) any(vapply(EXPECTED_WARNING_FRAGMENTS, grepl, logical(1), x = w)), logical(1))]
  proper <- post_ok && length(unexpected) == 0
  cat("\n#### ", label, "\n")
  cat("PROPER:", proper, "\n")
  if (length(warns)) cat("WARNINGS (raw):", paste(unique(warns), collapse = " | "), "\n")
  if (length(unexpected)) cat("UNEXPECTED WARNINGS:", paste(unique(unexpected), collapse = " | "), "\n")
  stopifnot(proper)

  fm <- lavaan::fitMeasures(fit)
  headline <- c("chisq", "df", "pvalue", "cfi", "tli", "rmsea", "srmr", "wrmr",
                "chisq.scaled", "df.scaled", "pvalue.scaled", "cfi.scaled", "tli.scaled", "rmsea.scaled",
                "cfi.robust", "tli.robust", "rmsea.robust")
  for (nm in headline) {
    if (nm %in% names(fm)) cat(sprintf("%-16s %s\n", nm, fmt(fm[[nm]])))
  }

  pe <- lavaan::parameterEstimates(fit)
  reg <- pe[pe$op == "~", c("lhs", "op", "rhs", "est", "se")]
  for (i in seq_len(nrow(reg))) {
    r <- reg[i, ]
    cat(sprintf("PE struct  %s %s %s   est=%s se=%s\n", r$lhs, r$op, r$rhs, fmt(r$est), fmt(r$se)))
  }
  invisible(fit)
}

fit_and_report("Saturated: cont2 ~ a1 + b1", "cont2 ~ a1 + b1", c("a1", "b1"))
fit_and_report("Non-saturated: cont2 ~ a1 + b1 ; cont1 ~ cont2", "cont2 ~ a1 + b1\ncont1 ~ cont2", c("a1", "b1"))
