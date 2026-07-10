# scripts/spikes/pathwlsmv-pin-values.R
# Path-mode WLSMV slice, Task 6 RE-PIN (Amendment B): native-R pins for the path-analysis WLSMV
# cells. SUPERSEDES the original Task 1 models (`cont2 ~ a1 + b1` [+ `cont1 ~ cont2`]), which the
# controller found were NOT achievable app states: neither model has an ordinal ENDOGENOUS
# variable, so under Amendment B (ordered= follows endogeneity - a placed ordinal column is
# declared ordered only when a drawn path points INTO it) both would synthesize an EMPTY
# ordered= at runtime and never actually exercise WLSMV's threshold machinery. See
# docs/superpowers/plans/2026-07-11-path-mode-wlsmv.md, Amendment B, and
# .superpowers/sdd/pw-task-1-report.md (the original pins + their now-superseded warning
# investigation).
#
# Reuses tests/e2e/fixtures/likert5-missing.csv (H1 Task 4 fixture, unchanged; a1..a3/b1..b3
# Likert-5-able, cont1/cont2 continuous, 1% seeded NA holes in a1..b3).
#
# Two models, both with an ordinal ENDOGENOUS variable (a path drawn INTO it), per the controller's
# re-pin spec:
#   SAT:    b1 ~ a1 + cont1                 (ordered = c("b1") only; a1 is ordinal but PURELY
#                                             EXOGENOUS here - it never appears as a response - so
#                                             per Amendment B it is NOT declared ordered and enters
#                                             numerically. This is the disclosure case: "ordinal
#                                             predictors enter the model numerically". df=0/saturated
#                                             is fine per the plan - structural estimates still pin.)
#   STRUCT: b1 ~ a1 + cont1 ; b2 ~ b1        (ordered = c("b1","b2") - b2 is now also ordinal
#                                             ENDOGENOUS (b1 -> b2), a1 stays numeric/exogenous as
#                                             above. Non-saturated (df=2), a genuine fit-indices-
#                                             bearing pin.)
#
# WARNING CHECK: unlike the original (superseded) models, NEITHER model below declares an
# exogenous variable as ordered (a1 is deliberately left out of ordered= in both), so the
# "exogenous variable(s) declared as ordered" / "parameter table does not contain thresholds"
# warning class from the original pins does NOT fire here (verified below - both PROPER: TRUE with
# zero warnings). The old scripts/spikes/pathwlsmv-warning-check.txt investigation is now
# historical only (it was scoped to the superseded models) and has been removed; if warnings
# reappear on a future regeneration of THESE models, investigate before pinning, same discipline
# as before.
#
# PROPER-SOLUTION GUARANTEE (same discipline as h1-likert-missing-pin-values.R): each fit is
# verified to pass lavaan's post.check AND to raise NO warning at all (tighter than the original
# script's allow-list, since these models are not expected to hit the benign exogenous-ordered
# class). If either model prints PROPER: FALSE, do not pin from that run.
#
# Run: Rscript scripts/spikes/pathwlsmv-pin-values.R > scripts/spikes/pathwlsmv-pin-values.txt 2>&1
library(lavaan)
options(scipen = 999)
cat("lavaan", as.character(packageVersion("lavaan")), " R", R.version.string, "\n")

data <- read.csv("tests/e2e/fixtures/likert5-missing.csv")

fmt <- function(x) if (is.na(x)) "NA" else sprintf("%.8f", x)

fit_and_report <- function(label, model, ordered_cols) {
  warns <- character(0)
  fit <- withCallingHandlers(
    lavaan::sem(model, data = data, estimator = "WLSMV", ordered = ordered_cols),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") }
  )
  post_ok <- isTRUE(suppressWarnings(lavaan::lavInspect(fit, "post.check")))
  proper <- post_ok && length(warns) == 0
  cat("\n#### ", label, "\n")
  cat("PROPER:", proper, "\n")
  if (length(warns)) cat("WARNINGS (raw):", paste(unique(warns), collapse = " | "), "\n")
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

fit_and_report("Saturated: b1 ~ a1 + cont1 (ordered=c(\"b1\") only; a1 exogenous ordinal stays numeric)", "b1 ~ a1 + cont1", c("b1"))
fit_and_report("Non-saturated: b1 ~ a1 + cont1 ; b2 ~ b1 (ordered=c(\"b1\",\"b2\"))", "b1 ~ a1 + cont1\nb2 ~ b1", c("b1", "b2"))
