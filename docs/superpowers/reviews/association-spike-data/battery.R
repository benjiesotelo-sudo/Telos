# Shared association battery — sourced VERBATIM by native R and WebR.
# Defines battery() returning ONE FLAT named list (numerics + two statistic-name strings).
battery <- function(csv_path = '/tmp/assoc-spike/fixture.csv') {
  d <- read.csv(csv_path, stringsAsFactors = FALSE)
  N <- nrow(d)
  res <- list()

  ## 1. Pearson ---------------------------------------------------------------
  ct <- cor.test(d$x, d$y)
  res$pearson_r <- unname(ct$estimate)
  res$pearson_t <- unname(ct$statistic)
  res$pearson_df <- unname(ct$parameter)
  res$pearson_p <- ct$p.value
  res$pearson_ci95_lo <- ct$conf.int[1]; res$pearson_ci95_hi <- ct$conf.int[2]
  c90 <- cor.test(d$x, d$y, conf.level = 0.90)
  res$pearson_ci90_lo <- c90$conf.int[1]; res$pearson_ci90_hi <- c90$conf.int[2]
  c99 <- cor.test(d$x, d$y, conf.level = 0.99)
  res$pearson_ci99_lo <- c99$conf.int[1]; res$pearson_ci99_hi <- c99$conf.int[2]
  res$pearson_p_greater <- cor.test(d$x, d$y, alternative = 'greater')$p.value

  ## 2. Spearman (exact = FALSE both runs) -------------------------------------
  sc <- suppressWarnings(cor.test(d$x, d$y, method = 'spearman', exact = FALSE))
  res$spearman_cont_rho <- unname(sc$estimate)
  res$spearman_cont_S <- unname(sc$statistic)
  res$spearman_cont_p <- sc$p.value
  st <- suppressWarnings(cor.test(d$ord1, d$ord2, method = 'spearman', exact = FALSE))
  res$spearman_tied_rho <- unname(st$estimate)
  res$spearman_tied_S <- unname(st$statistic)
  res$spearman_tied_p <- st$p.value

  ## 3. Kendall (exact = FALSE both runs) --------------------------------------
  kc <- suppressWarnings(cor.test(d$x, d$y, method = 'kendall', exact = FALSE))
  res$kendall_cont_tau <- unname(kc$estimate)
  res$kendall_cont_z <- unname(kc$statistic)
  res$kendall_cont_p <- kc$p.value
  res$kendall_cont_statname <- names(kc$statistic)
  kt <- suppressWarnings(cor.test(d$ord1, d$ord2, method = 'kendall', exact = FALSE))
  res$kendall_tied_tau <- unname(kt$estimate)
  res$kendall_tied_z <- unname(kt$statistic)
  res$kendall_tied_p <- kt$p.value
  res$kendall_tied_statname <- names(kt$statistic)

  ## 4. Chi-square goodness of fit on table(cat3) ------------------------------
  tab <- table(d$cat3)  # alphabetical: alpha, beta, gamma
  g <- chisq.test(tab)
  res$gof_eq_chisq <- unname(g$statistic)
  res$gof_eq_df <- unname(g$parameter)
  res$gof_eq_p <- g$p.value
  res$gof_eq_stdres_alpha <- unname(g$stdres['alpha'])
  res$gof_eq_stdres_beta <- unname(g$stdres['beta'])
  res$gof_eq_stdres_gamma <- unname(g$stdres['gamma'])
  res$gof_eq_w <- effectsize::cohens_w(tab)$Cohens_w
  pc <- c(0.5, 0.3, 0.2)  # alphabetical category order
  gc <- chisq.test(tab, p = pc)
  res$gof_cust_chisq <- unname(gc$statistic)
  res$gof_cust_df <- unname(gc$parameter)
  res$gof_cust_p <- gc$p.value
  res$gof_cust_stdres_alpha <- unname(gc$stdres['alpha'])
  res$gof_cust_stdres_beta <- unname(gc$stdres['beta'])
  res$gof_cust_stdres_gamma <- unname(gc$stdres['gamma'])
  res$gof_cust_w <- effectsize::cohens_w(tab, p = pc)$Cohens_w
  res$gof_cust_w_hand <- sqrt(unname(gc$statistic) / sum(tab))

  ## 5. Chi-square independence + Cramer's V -----------------------------------
  t22 <- table(d$bin1, d$bin2)
  i22c <- suppressWarnings(chisq.test(t22))            # Yates by default for 2x2
  res$ind22_corr_chisq <- unname(i22c$statistic)
  res$ind22_corr_df <- unname(i22c$parameter)
  res$ind22_corr_p <- i22c$p.value
  i22u <- suppressWarnings(chisq.test(t22, correct = FALSE))
  res$ind22_unc_chisq <- unname(i22u$statistic)
  res$ind22_unc_p <- i22u$p.value
  res$ind22_V_hand_unc <- sqrt(unname(i22u$statistic) / N)   # min(r-1,c-1)=1
  res$ind22_V_hand_corr <- sqrt(unname(i22c$statistic) / N)
  t32 <- table(d$cat3, d$bin1)
  i32 <- suppressWarnings(chisq.test(t32))             # no Yates for 3x2
  res$ind32_chisq <- unname(i32$statistic)
  res$ind32_df <- unname(i32$parameter)
  res$ind32_p <- i32$p.value
  res$ind32_V_hand <- sqrt(unname(i32$statistic) / (N * 1))  # min(r-1,c-1)=min(2,1)=1
  res$ind32_minExpected <- min(i32$expected)
  rc_ok <- isTRUE(tryCatch({ library(rcompanion); TRUE }, error = function(e) FALSE))
  if (rc_ok) {
    res$ind22_V_rcompanion <- as.numeric(suppressWarnings(rcompanion::cramerV(t22)))
    res$ind32_V_rcompanion <- as.numeric(suppressWarnings(rcompanion::cramerV(t32)))
  }

  ## 6. Fisher's exact ----------------------------------------------------------
  f22 <- fisher.test(t22)
  res$fish22_p <- f22$p.value
  res$fish22_or <- unname(f22$estimate)
  res$fish22_ci_lo <- f22$conf.int[1]; res$fish22_ci_hi <- f22$conf.int[2]
  res$fish22_p_greater <- fisher.test(t22, alternative = 'greater')$p.value
  res$fish22_p_less <- fisher.test(t22, alternative = 'less')$p.value
  t33 <- table(d$cat3, d$cat3b)
  res$fish33_p <- fisher.test(t33)$p.value

  res
}
