# scripts/spikes/h1-likert-missing-pin-values.R
# Task 4 (H1 fixtures + native-R pins) amendment: the spike's docs/testing/likert5.csv has NO NA
# holes (see docs/superpowers/reviews/2026-07-10-h1-estimator-spike.md Q3 note), so its WLSMV
# listwise and pairwise fits are byte-identical -- useless for pinning cells 6/7 of the 7-cell
# estimator/missing matrix (WLSMV x {listwise, pairwise}). This script:
#   1. Regenerates the EXACT SAME base likert data as h1-estimator-spike.R (same set.seed(20260710)
#      generator, unchanged) -- so this is genuinely the same underlying fixture, not a new dataset.
#   2. Punches deterministic NA holes into a1..b3 ONLY (cont1/cont2 untouched) under a SEPARATE,
#      documented seed step: set.seed(20260711), 1% of cells per column (300 * 0.01 = 3 rows/col).
#      RECONDITIONED (controller ruling, 2026-07-10): the first cut used a 5% hole rate, which
#      pushed BOTH WLSMV fits into improper (Heywood) solutions - lavaan's post-check flagged
#      negative estimated lv variances and the structural SEs blew up 1-2 orders of magnitude
#      above the estimates. Pins must never encode an improper solution as ground truth. A
#      deterministic sweep over the controller's levers, run with EXACTLY this script's eager
#      generation order (base seed 20260710, then set.seed(20260711), then sample() per column),
#      found: 3% leaves the LISTWISE cell improper, 2% leaves the PAIRWISE cell improper, and
#      raising n to 500 (a different base draw) is improper at 2/3/5% for both cells - 1% at the
#      unchanged n=300 base is the mildest change where BOTH cells pass lavaan's post-check
#      cleanly, with no warnings and structural SEs the same order as the estimates (matching the
#      spike's clean holeless cells). Same seeds, same base data - only the hole rate changed.
#   3. Writes docs/testing/likert5-missing.csv (mirrors where the complete-data likert5.csv lives).
#   4. Re-fits WLSMV under missing="listwise" and missing="pairwise" on the missing variant and
#      prints fitMeasures + structural (B ~ A, B ~ C) rows at 8dp via sprintf, matching the
#      transcription style of h1-pin-values.R.
# Run: Rscript scripts/spikes/h1-likert-missing-pin-values.R > scripts/spikes/h1-pin-values-likert-missing.txt 2>&1
library(lavaan)
options(scipen = 999)

# --- Step 1: same generator as h1-estimator-spike.R (seed 20260710), verbatim ---
set.seed(20260710)
n <- 300
lv <- rnorm(n)
lik <- function(x) cut(x + rnorm(n, sd = .8), breaks = c(-Inf, -1, -.3, .3, 1, Inf), labels = FALSE)
likert <- data.frame(a1 = lik(lv), a2 = lik(lv), a3 = lik(lv),
                     b1 = lik(-lv), b2 = lik(-lv), b3 = lik(-lv),
                     cont1 = lv + rnorm(n, sd = .5), cont2 = lv + rnorm(n, sd = .5))

# --- Step 2: punch NA holes, a1..b3 ONLY, cont1/cont2 untouched, separate seed ---
set.seed(20260711)
ord_cols <- c("a1", "a2", "a3", "b1", "b2", "b3")
hole_size <- round(n * 0.01) # 3 rows per column (see RECONDITIONED note above: 5% -> Heywood)
for (col in ord_cols) {
  idx <- sample(seq_len(n), size = hole_size)
  likert[idx, col] <- NA
}
cat("Holes punched per column (expect", hole_size, "each):\n")
print(sapply(likert[ord_cols], function(col) sum(is.na(col))))
cat("cont1/cont2 NA count (expect 0, 0):", sum(is.na(likert$cont1)), sum(is.na(likert$cont2)), "\n")

# DEVIATION from h1-estimator-spike.R's write.csv(likert5.csv) default: this fixture is loaded via
# csvFixture.ts's loadCsvFixture (plain comma-split, no quote handling; empty cell -> null -> NaN in
# R), which mirrors the OTHER tests/e2e/fixtures/*.csv convention (unquoted headers, no literal "NA"
# text) rather than the quoted-header/literal-"NA" default write.csv() uses for likert5.csv itself.
# quote = FALSE (unquoted headers, matches e.g. polidemocracy.csv) and na = "" (empty cell, so
# loadCsvFixture's `v === ''` branch converts it to `null`, which runCbSem.ts already marshals to
# NaN for FIML/full-rows -- see runCbSem.test.ts's 'fiml full-rows path' test) -- no numeric value
# changes, formatting only.
write.csv(likert, "docs/testing/likert5-missing.csv", row.names = FALSE, quote = FALSE, na = "")

# --- Step 3: re-fit WLSMV listwise + pairwise on the MISSING variant ---
mixed_model <- '
  A =~ a1 + a2 + a3
  C =~ cont1 + cont2
  B =~ b1 + b2 + b3
  B ~ A + C
'
fmt <- function(x) if (is.na(x)) "NA" else sprintf("%.8f", x)
headline_w <- c("chisq", "df", "pvalue", "cfi", "tli", "rmsea", "srmr", "wrmr",
                "chisq.scaled", "df.scaled", "pvalue.scaled", "cfi.scaled", "tli.scaled", "rmsea.scaled",
                "cfi.robust", "tli.robust", "rmsea.robust")
# Conditioning check (controller ruling): each fit must be a PROPER solution - lavaan's
# post-check passes (no negative lv variances, positive-definite lv covariance) AND no warning of
# any kind fires during fitting. PROPER: TRUE printed per cell below is the machine-checkable
# proof in this capture; if either cell ever prints FALSE, the pins in src/lib/stats/h1Pins.ts
# must NOT be regenerated from that run - recondition the fixture first.
for (miss in c("listwise", "pairwise")) {
  warns <- character(0)
  fit <- withCallingHandlers(
    lavaan::sem(mixed_model, data = likert, estimator = "WLSMV",
                ordered = ord_cols, missing = miss),
    warning = function(w) { warns <<- c(warns, conditionMessage(w)); invokeRestart("muffleWarning") }
  )
  proper <- isTRUE(suppressWarnings(lavaan::lavInspect(fit, "post.check"))) && length(warns) == 0
  fm <- lavaan::fitMeasures(fit)
  cat("\n#### WLSMV /", miss, "(likert5-missing)\n")
  cat("PROPER:", proper, "\n")
  if (length(warns)) cat("WARNINGS:", paste(unique(warns), collapse = " | "), "\n")
  stopifnot(proper)
  for (nm in headline_w) {
    if (nm %in% names(fm)) cat(sprintf("%-16s %s\n", nm, fmt(fm[[nm]])))
  }
  pe <- lavaan::parameterEstimates(fit)
  br <- pe[pe$lhs == "B" & pe$op == "~", c("lhs", "op", "rhs", "est", "se")]
  for (i in seq_len(nrow(br))) {
    r <- br[i, ]
    cat(sprintf("PE struct  %s %s %s   est=%s se=%s\n", r$lhs, r$op, r$rhs, fmt(r$est), fmt(r$se)))
  }
}

# --- Step 4: degeneracy guard -- confirm listwise and pairwise now genuinely differ ---
fit_lw <- lavaan::sem(mixed_model, data = likert, estimator = "WLSMV", ordered = ord_cols, missing = "listwise")
fit_pw <- lavaan::sem(mixed_model, data = likert, estimator = "WLSMV", ordered = ord_cols, missing = "pairwise")
chisq_lw <- lavaan::fitMeasures(fit_lw)[["chisq.scaled"]]
chisq_pw <- lavaan::fitMeasures(fit_pw)[["chisq.scaled"]]
cat("\nDegeneracy guard: chisq.scaled listwise =", fmt(chisq_lw), " pairwise =", fmt(chisq_pw),
    " differ =", !isTRUE(all.equal(chisq_lw, chisq_pw)), "\n")
