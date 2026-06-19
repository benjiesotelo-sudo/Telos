# SEM feasibility spike — identical script run in BOTH native R 4.6.0 and WebR 0.6.0.
# Goal: prove the SEM packages load + run, and that WebR == native R within tolerance,
# on each package's built-in datasets (no external fixtures needed).
options(warn = 1)
say <- function(...) cat(..., "\n")
hr  <- function(t)  cat("\n========== ", t, " ==========\n")
sect <- function(t, body) tryCatch({ hr(t); body() },
          error = function(e) cat("\n!!! SECTION ERROR [", t, "]:", conditionMessage(e), "\n"))
rn <- function(df, k = 4) { ix <- vapply(df, is.numeric, logical(1)); df[ix] <- lapply(df[ix], round, k); df }

sect("VERSIONS / LOAD", function() {
  for (p in c("lavaan","semTools","psych","seminr","GPArotation")) {
    ok <- requireNamespace(p, quietly = TRUE)
    say(sprintf("pkg %-12s %s", p, if (ok) as.character(packageVersion(p)) else "FAILED-TO-LOAD"))
  }
})
suppressMessages({ library(lavaan); library(psych) })
has_semTools <- requireNamespace("semTools", quietly = TRUE)
has_seminr   <- requireNamespace("seminr",   quietly = TRUE)
HS <- HolzingerSwineford1939
efa.dat <- HS[, paste0("x", 1:9)]

sect("CFA (HolzingerSwineford1939, 3-factor; lavaan)", function() {
  HS.model <- ' visual  =~ x1 + x2 + x3
                textual =~ x4 + x5 + x6
                speed   =~ x7 + x8 + x9 '
  fit <- cfa(HS.model, data = HS)
  assign("HS.model", HS.model, envir = .GlobalEnv); assign("cfa.fit", fit, envir = .GlobalEnv)
  fm <- fitMeasures(fit, c("chisq","df","pvalue","cfi","tli","rmsea",
                           "rmsea.ci.lower","rmsea.ci.upper","srmr"))
  say("fit indices:"); print(round(fm, 4))
  ss <- standardizedSolution(fit)
  say("standardized loadings:")
  print(rn(subset(ss, op == "=~")[, c("lhs","rhs","est.std","se","z","pvalue")]))
})

sect("RELIABILITY / VALIDITY (semTools on the CFA)", function() {
  if (!has_semTools) { say("semTools NOT available"); return(invisible()) }
  fit <- get("cfa.fit", envir = .GlobalEnv)
  say("compRelSEM omega:")        # returns a verbose per-factor list -> unlist to a numeric vector
  print(round(unlist(semTools::compRelSEM(fit)), 4))
  say("compRelSEM alpha (tau.eq=TRUE):")
  print(round(unlist(semTools::compRelSEM(fit, tau.eq = TRUE)), 4))
  say("AVE:")
  print(round(semTools::AVE(fit), 4))
  say("HTMT:")
  print(round(semTools::htmt(get("HS.model", envir = .GlobalEnv), data = HS), 4))
})

sect("RELIABILITY (psych::alpha + psych::omega)", function() {
  a <- psych::alpha(HS[, c("x1","x2","x3")])
  say("psych alpha (visual items):", round(a$total$raw_alpha, 4))
  om <- tryCatch(psych::omega(HS[, c("x1","x2","x3","x4","x5","x6")], nfactors = 2, plot = FALSE),
                 error = function(e) NULL)
  if (!is.null(om)) say("psych omega_h:", round(om$omega_h, 4), " omega_tot:", round(om$omega.tot, 4))
})

sect("EFA (psych::fa, oblimin, parallel analysis)", function() {
  km <- psych::KMO(efa.dat); say("KMO overall MSA:", round(km$MSA, 4))
  b  <- psych::cortest.bartlett(cor(efa.dat), n = nrow(efa.dat))
  say("Bartlett chisq:", round(b$chisq, 2), " df:", b$df, " p:", signif(b$p.value, 3))
  pa <- tryCatch(fa.parallel(efa.dat, fa = "fa", plot = FALSE), error = function(e) NULL)
  if (!is.null(pa)) say("parallel-analysis suggested factors:", pa$nfact)
  faf <- fa(efa.dat, nfactors = 3, rotate = "oblimin", fm = "pa")
  say("EFA pattern loadings:"); print(round(unclass(faf$loadings), 3))
  say("communalities h2:"); print(round(faf$communality, 3))
  say("interfactor correlations (Phi):"); print(round(faf$Phi, 3))
})

sect("PCA (prcomp + psych::principal)", function() {
  pc <- prcomp(efa.dat, scale. = TRUE)
  say("eigenvalues (sdev^2):"); print(round(pc$sdev^2, 3))
  say("cumulative proportion:"); print(round(cumsum(pc$sdev^2) / sum(pc$sdev^2), 3))
  pr <- psych::principal(efa.dat, nfactors = 3, rotate = "none")
  say("principal() loadings:"); print(round(unclass(pr$loadings), 3))
})

sect("CB-SEM + MEDIATION (PoliticalDemocracy; bootstrap=200)", function() {
  set.seed(20260618)
  pd.model <- '
    ind60 =~ x1 + x2 + x3
    dem60 =~ y1 + y2 + y3 + y4
    dem65 =~ y5 + y6 + y7 + y8
    dem60 ~ a*ind60
    dem65 ~ b*dem60 + c*ind60
    ind   := a*b
    total := c + a*b '
  t0 <- Sys.time()
  fit <- sem(pd.model, data = PoliticalDemocracy, se = "bootstrap", bootstrap = 200)
  say("bootstrap(200) elapsed sec:", round(as.numeric(Sys.time() - t0, units = "secs"), 1))
  say("fit indices:")
  print(round(fitMeasures(fit, c("chisq","df","pvalue","cfi","tli","rmsea","srmr")), 4))
  pe <- parameterEstimates(fit, ci = TRUE, boot.ci.type = "perc")
  say("structural paths:")
  print(rn(subset(pe, op == "~")[, c("lhs","rhs","est","se","z","pvalue","ci.lower","ci.upper")]))
  say("defined effects (indirect/total) with bootstrap CI:")
  print(rn(subset(pe, op == ":=")[, c("lhs","est","se","ci.lower","ci.upper","pvalue")]))
})

sect("PATH ANALYSIS (observed-only; saturated df=0 check)", function() {
  pd <- PoliticalDemocracy
  pd$X <- rowMeans(pd[, c("x1","x2","x3")])
  pd$M <- rowMeans(pd[, c("y1","y2","y3","y4")])
  pd$Y <- rowMeans(pd[, c("y5","y6","y7","y8")])
  set.seed(20260618)
  fitp <- sem('M ~ a*X
               Y ~ b*M + cp*X
               ind := a*b', data = pd, se = "bootstrap", bootstrap = 200)
  dfp <- as.numeric(fitMeasures(fitp, "df"))
  say("path-model df =", dfp, "  (expect 0 = saturated → fit indices uninformative)")
  say("chisq:", round(as.numeric(fitMeasures(fitp, "chisq")), 4),
      " cfi:", round(as.numeric(fitMeasures(fitp, "cfi")), 4),
      " rmsea:", round(as.numeric(fitMeasures(fitp, "rmsea")), 4))
  pep <- parameterEstimates(fitp, ci = TRUE, boot.ci.type = "perc")
  say("indirect effect (bootstrap CI):")
  print(rn(subset(pep, op == ":=")[, c("lhs","est","se","ci.lower","ci.upper")]))
})

sect("PLS-SEM (seminr 'mobi' example; bootstrap=200)", function() {
  if (!has_seminr) { say("seminr NOT available"); return(invisible()) }
  suppressMessages(library(seminr))
  mm <- constructs(
    composite("Image",        multi_items("IMAG", 1:5)),
    composite("Expectation",  multi_items("CUEX", 1:3)),
    composite("Quality",      multi_items("PERQ", 1:7)),
    composite("Value",        multi_items("PERV", 1:2)),
    composite("Satisfaction", multi_items("CUSA", 1:3)),
    composite("Complaints",   single_item("CUSCO")),
    composite("Loyalty",      multi_items("CUSL", 1:3)))
  sm <- relationships(
    paths(from = "Image",        to = c("Expectation","Satisfaction","Loyalty")),
    paths(from = "Expectation",  to = c("Quality","Value","Satisfaction")),
    paths(from = "Quality",      to = c("Value","Satisfaction")),
    paths(from = "Value",        to = "Satisfaction"),
    paths(from = "Satisfaction", to = c("Complaints","Loyalty")),
    paths(from = "Complaints",   to = "Loyalty"))
  pls <- estimate_pls(data = mobi, measurement_model = mm, structural_model = sm)
  s <- summary(pls)
  say("reliability (alpha / rhoC / AVE / rhoA):"); print(round(s$reliability, 4))
  say("R^2 / adjR^2:"); print(round(s$paths[c("R^2","AdjR^2"), ], 4))
  say("HTMT:"); print(round(s$validity$htmt, 3))
  set.seed(20260618)
  t0 <- Sys.time()
  bo <- bootstrap_model(seminr_model = pls, nboot = 200, cores = 1)
  say("seminr bootstrap(200) elapsed sec:", round(as.numeric(Sys.time() - t0, units = "secs"), 1))
  sb <- summary(bo)
  say("bootstrapped paths:"); print(round(sb$bootstrapped_paths, 4))
})

hr("DONE")
