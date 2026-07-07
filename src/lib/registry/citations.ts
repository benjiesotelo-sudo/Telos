// Citation registry (A4): for each catalog test, the "Why this test" line (config screen, U7 T3) and
// the "statistical basis" footer claims (results card + LaTeX/PDF footer, U7 T4). This is a CONSOLIDATION,
// not new authorship - every reference below already appears in one of: the exported CITATIONS.txt
// package references (src/lib/export/citations.ts REFS, reproduced verbatim below with the CRAN suffix
// split into `url`), an inline citation already sitting in that test's own registry file (grep'd per
// test), or the two-track SEM convention docs (docs/superpowers/reviews/2026-06-18-sem-reporting-
// convention.md and 2026-07-06-moderation-spike.md). No new claims are introduced.

import { CATALOG } from './catalog'

export interface Ref { text: string; url?: string }
export interface TestCitations {
  whyThisTest: { text: string; refs: Ref[] } // rendered verbatim as the config-screen "Why this test" line
  statisticalBasis: { claim: string; ref: Ref }[] // rendered as the results-card footer + LaTeX/PDF footer
}

// ---------------------------------------------------------------------------
// Shared academic references, reused verbatim across entries (single point of truth).
// ---------------------------------------------------------------------------
const STUDENT_1908: Ref = { text: 'Student (1908). "The probable error of a mean." Biometrika, 6(1), 1-25.', url: 'https://doi.org/10.1093/biomet/6.1.1' }
const WELCH_1947: Ref = { text: "Welch, B. L. (1947). \"The generalization of Student's problem when several different population variances are involved.\" Biometrika, 34(1-2), 28-35.", url: 'https://doi.org/10.1093/biomet/34.1-2.28' }
// Welch's OTHER paper: the k-sample (one-way ANOVA) generalization, distinct from the 1947 two-sample
// paper above. Provenance-audit fix round (2026-07-07): welch-anova cites this one, not 1947.
const WELCH_1951: Ref = { text: 'Welch, B. L. (1951). "On the comparison of several mean values: an alternative approach." Biometrika, 38(3-4), 330-336.', url: 'https://doi.org/10.1093/biomet/38.3-4.330' }
const COHEN_1988: Ref = { text: 'Cohen, J. (1988). Statistical Power Analysis for the Behavioral Sciences (2nd ed.). Routledge.' }
const FISHER_1925: Ref = { text: 'Fisher, R. A. (1925). Statistical Methods for Research Workers. Oliver & Boyd.' }
const GREENHOUSE_GEISSER_1959: Ref = { text: 'Greenhouse, S. W., Geisser, S. (1959). "On methods in the analysis of profile data." Psychometrika, 24(2), 95-112.' }
const HUYNH_FELDT_1976: Ref = { text: 'Huynh, H., Feldt, L. S. (1976). "Estimation of the Box correction for degrees of freedom from sample data in randomized block and split-plot designs." Journal of Educational Statistics, 1(1), 69-82.' }
const PILLAI_1955: Ref = { text: 'Pillai, K. C. S. (1955). "Some new test criteria in multivariate analysis." Annals of Mathematical Statistics, 26(1), 117-121.' }
// Audit fix (U9-T3 wave B, 2026-07-06 completeness audit): the app's Levene test is actually the
// median-centered Brown-Forsythe variant (aov(abs(y - group median) ~ group)), so both are cited
// together wherever the homogeneity-of-variance test is rendered (one-sample/independent-t siblings,
// one-way/factorial/nested/mixed/ancova ANOVA family).
const LEVENE_1960: Ref = { text: 'Levene, H. (1960). "Robust tests for equality of variances." In I. Olkin (Ed.), Contributions to Probability and Statistics (pp. 278-292). Stanford University Press.' }
const BROWN_FORSYTHE_1974: Ref = { text: 'Brown, M. B., Forsythe, A. B. (1974). "Robust tests for the equality of variances." Journal of the American Statistical Association, 69(346), 364-367.', url: 'https://doi.org/10.2307/2285659' }
const MAUCHLY_1940: Ref = { text: 'Mauchly, J. W. (1940). "Significance test for sphericity of a normal n-variate distribution." The Annals of Mathematical Statistics, 11(2), 204-209.', url: 'https://doi.org/10.1214/aoms/1177731915' }
const BOX_1949: Ref = { text: 'Box, G. E. P. (1949). "A general distribution theory for a class of likelihood criteria." Biometrika, 36(3-4), 317-346.', url: 'https://doi.org/10.2307/2332671' }
const DUNN_1961: Ref = { text: 'Dunn, O. J. (1961). "Multiple comparisons among means." Journal of the American Statistical Association, 56(293), 52-64.', url: 'https://doi.org/10.2307/2282330' }
const SCHEFFE_1953: Ref = { text: 'Scheffé, H. (1953). "A method for judging all contrasts in the analysis of variance." Biometrika, 40(1-2), 87-104.', url: 'https://doi.org/10.2307/2333100' }
const TUKEY_1949: Ref = { text: 'Tukey, J. W. (1949). "Comparing individual means in the analysis of variance." Biometrics, 5(2), 99-114.' }
const PEARSON_1895: Ref = { text: 'Pearson, K. (1895). "Note on regression and inheritance in the case of two parents." Proceedings of the Royal Society of London, 58, 240-242.' }
const OBRIEN_2007: Ref = { text: 'O’Brien, R. M. (2007). "A caution regarding rules of thumb for variance inflation factors." Quality & Quantity, 41(5), 673-690.', url: 'https://doi.org/10.1007/s11135-006-9018-6' }
const CROISSANT_MILLO_2008: Ref = { text: 'Croissant, Y., Millo, G. (2008). "Panel Data Econometrics in R: The plm Package." Journal of Statistical Software, 27(2), 1-43.', url: 'https://doi.org/10.18637/jss.v027.i02' }
const BERTRAND_DUFLO_MULLAINATHAN_2004: Ref = { text: 'Bertrand, M., Duflo, E., Mullainathan, S. (2004). "How Much Should We Trust Differences-in-Differences Estimates?" Quarterly Journal of Economics, 119(1), 249-275.' }
const HU_BENTLER_1999: Ref = { text: 'Hu, L., Bentler, P. M. (1999). "Cutoff criteria for fit indexes in covariance structure analysis: Conventional criteria versus new alternatives." Structural Equation Modeling, 6(1), 1-55.', url: 'https://doi.org/10.1080/10705519909540118' }
// Two distinct real Marsh (2004) papers - do not conflate: MARSH_HAU_WEN_2004 (author order Marsh, Hau,
// Wen) is the "golden rules" fit-index cutoff commentary; MARSH_WEN_HAU_2004 (author order Marsh, Wen,
// Hau, defined further below near the moderation additions) is the latent-interactions estimation paper.
const MARSH_HAU_WEN_2004: Ref = { text: 'Marsh, H. W., Hau, K. T., Wen, Z. (2004). "In search of golden rules: Comment on hypothesis-testing approaches to setting cutoff values for fit indices." Structural Equation Modeling, 11(3), 320-341.', url: 'https://doi.org/10.1207/s15328007sem1103_2' }
const MACCALLUM_1996: Ref = { text: 'MacCallum, R. C., Browne, M. W., Sugawara, H. M. (1996). "Power analysis and determination of sample size for covariance structure modeling." Psychological Methods, 1(2), 130-149.', url: 'https://doi.org/10.1037/1082-989X.1.2.130' }
const FORNELL_LARCKER_1981: Ref = { text: 'Fornell, C., Larcker, D. F. (1981). "Evaluating structural equation models with unobservable variables and measurement error." Journal of Marketing Research, 18(1), 39-50.', url: 'https://doi.org/10.1177/002224378101800104' }
const MCNEISH_2018: Ref = { text: "McNeish, D. (2018). \"Thanks coefficient alpha, we'll take it from here.\" Psychological Methods, 23(3), 412-433.", url: 'https://doi.org/10.1037/met0000144' }
const ROSSEEL_2012: Ref = { text: 'Rosseel, Y. (2012). "lavaan: An R Package for Structural Equation Modeling." Journal of Statistical Software, 48(2), 1-36.', url: 'https://doi.org/10.18637/jss.v048.i02' }
const APPELBAUM_2018: Ref = { text: 'Appelbaum, M., Cooper, H., Kline, R. B., Mayo-Wilson, E., Nezu, A. M., Rao, S. M. (2018). "Journal article reporting standards for quantitative research in psychology." American Psychologist, 73(1), 3-25.', url: 'https://doi.org/10.1037/amp0000191' }
const KLINE_2023: Ref = { text: 'Kline, R. B. (2023). Principles and Practice of Structural Equation Modeling (5th ed.). Guilford Press.' }

// Nonparametric / categorical primaries (registry files' own howToRead/tableNote prose names these
// methods; full bibliographic form supplied here for the footer).
const SHAPIRO_WILK_1965: Ref = { text: 'Shapiro, S. S., Wilk, M. B. (1965). "An analysis of variance test for normality (complete samples)." Biometrika, 52(3/4), 591-611.' }
const WILKS_1932: Ref = { text: 'Wilks, S. S. (1932). "Certain generalized distributions in multivariate analysis." Biometrika, 24(3/4), 471-494.' }
const MANN_WHITNEY_1947: Ref = { text: 'Mann, H. B., Whitney, D. R. (1947). "On a test of whether one of two random variables is stochastically larger than the other." Annals of Mathematical Statistics, 18(1), 50-60.' }
const WILCOXON_1945: Ref = { text: 'Wilcoxon, F. (1945). "Individual comparisons by ranking methods." Biometrics Bulletin, 1(6), 80-83.' }
const KRUSKAL_WALLIS_1952: Ref = { text: 'Kruskal, W. H., Wallis, W. A. (1952). "Use of ranks in one-criterion variance analysis." Journal of the American Statistical Association, 47(260), 583-621.' }
const FRIEDMAN_1937: Ref = { text: 'Friedman, M. (1937). "The use of ranks to avoid the assumption of normality implicit in the analysis of variance." Journal of the American Statistical Association, 32(200), 675-701.' }
const SPEARMAN_1904: Ref = { text: 'Spearman, C. (1904). "The proof and measurement of association between two things." American Journal of Psychology, 15(1), 72-101.' }
const KENDALL_1938: Ref = { text: 'Kendall, M. G. (1938). "A new measure of rank correlation." Biometrika, 30(1/2), 81-93.' }
const PEARSON_1900: Ref = { text: 'Pearson, K. (1900). "On the criterion that a given system of deviations from the probable in the case of a correlated system of variables is such that it can be reasonably supposed to have arisen from random sampling." Philosophical Magazine, 50(302), 157-175.' }
const FISHER_1922: Ref = { text: 'Fisher, R. A. (1922). "On the interpretation of χ² from contingency tables, and the calculation of P." Journal of the Royal Statistical Society, 85(1), 87-94.' }

// Econometrics primaries.
const DICKEY_FULLER_1979: Ref = { text: 'Dickey, D. A., Fuller, W. A. (1979). "Distribution of the estimators for autoregressive time series with a unit root." Journal of the American Statistical Association, 74(366a), 427-431.' }
const KWIATKOWSKI_1992: Ref = { text: 'Kwiatkowski, D., Phillips, P. C. B., Schmidt, P., Shin, Y. (1992). "Testing the null hypothesis of stationarity against the alternative of a unit root." Journal of Econometrics, 54(1-3), 159-178.' }
const PHILLIPS_PERRON_1988: Ref = { text: 'Phillips, P. C. B., Perron, P. (1988). "Testing for a unit root in time series regression." Biometrika, 75(2), 335-346.' }
const GRANGER_1969: Ref = { text: 'Granger, C. W. J. (1969). "Investigating causal relations by econometric models and cross-spectral methods." Econometrica, 37(3), 424-438.' }
const LUTKEPOHL_2005: Ref = { text: 'Lütkepohl, H. (2005). New Introduction to Multiple Time Series Analysis. Springer-Verlag, Berlin.' } // named alongside Pfaff (2008) in var.ts's own howToRead
const HAUSMAN_1978: Ref = { text: 'Hausman, J. A. (1978). "Specification tests in econometrics." Econometrica, 46(6), 1251-1271.' }
const CALONICO_CATTANEO_TITIUNIK_2014: Ref = { text: 'Calonico, S., Cattaneo, M. D., Titiunik, R. (2014). "Robust Nonparametric Confidence Intervals for Regression-Discontinuity Designs." Econometrica, 82(6), 2295-2326.' } // rdd.ts's own howToRead names Calonico, Cattaneo & Titiunik (2014, 2015)
const STOCK_YOGO_2005: Ref = { text: 'Stock, J. H., Yogo, M. (2005). "Testing for Weak Instruments in Linear IV Regression." In Identification and Inference for Econometric Models (Andrews & Stock, eds.), Cambridge University Press, 80-108.' } // named in ivTwoStage.ts's own howToRead
const AUSTIN_2011: Ref = { text: 'Austin, P. C. (2011). "An Introduction to Propensity Score Methods for Reducing the Effects of Confounding in Observational Studies." Multivariate Behavioral Research, 46(3), 399-424.' } // named in propensityScoreMatching.ts's own howToRead

// Reliability / factor-analysis mis-citation-trap references (convention doc §5 item 14).
const NUNNALLY_1978: Ref = { text: 'Nunnally, J. C. (1978). Psychometric Theory (2nd ed.). McGraw-Hill.' }
const BAGOZZI_YI_1988: Ref = { text: 'Bagozzi, R. P., Yi, Y. (1988). "On the evaluation of structural equation models." Journal of the Academy of Marketing Science, 16(1), 74-94.' }
const KAISER_RICE_1974: Ref = { text: 'Kaiser, H. F., Rice, J. (1974). "Little Jiffy, Mark IV." Educational and Psychological Measurement, 34(1), 111-117.' } // KMO verbal labels - NOT the Kaiser (1974) "factorial simplicity" paper
const HORN_1965: Ref = { text: 'Horn, J. L. (1965). "A rationale and test for the number of factors in factor analysis." Psychometrika, 30(2), 179-185.', url: 'https://doi.org/10.1007/BF02289447' }
const ZWICK_VELICER_1986: Ref = { text: 'Zwick, W. R., Velicer, W. F. (1986). "Comparison of five rules for determining the number of components to retain." Psychological Bulletin, 99(3), 432-442.' }
const WATKINS_2018: Ref = { text: 'Watkins, M. W. (2018). "Exploratory Factor Analysis: A Guide to Best Practice." Journal of Black Psychology, 44(3), 219-246.', url: 'https://doi.org/10.1177/0095798418771807' }
const JOLLIFFE_CADIMA_2016: Ref = { text: 'Jolliffe, I. T., Cadima, J. (2016). "Principal component analysis: a review and recent developments." Philosophical Transactions of the Royal Society A, 374, 20150202.', url: 'https://doi.org/10.1098/rsta.2015.0202' }
const FRICK_2025: Ref = { text: 'Frick, S., Killisch, R., Bißantz, N., Wetzel, E. (2025). "PCA Is Not EFA." European Journal of Psychological Assessment, 41(6), 425-426.', url: 'https://doi.org/10.1027/1015-5759/a000938' }
const HAIR_2019: Ref = { text: 'Hair, J. F., Risher, J. J., Sarstedt, M., Ringle, C. M. (2019). "When to use and how to report the results of PLS-SEM." European Business Review, 31(1), 2-24.', url: 'https://doi.org/10.1108/EBR-11-2018-0203' }
const HENSELER_2015: Ref = { text: 'Henseler, J., Ringle, C. M., Sarstedt, M. (2015). "A new criterion for assessing discriminant validity in variance-based structural equation modeling." Journal of the Academy of Marketing Science, 43(1), 115-135.', url: 'https://doi.org/10.1007/s11747-014-0403-8' }

// Moderation additions (spike doc 2026-07-06-moderation-spike.md §4 - conventioned, web-verified ×2).
const MARSH_WEN_HAU_2004: Ref = { text: 'Marsh, H. W., Wen, Z., Hau, K. T. (2004). "Structural equation models of latent interactions: evaluation of alternative estimation strategies and indicator construction." Psychological Methods, 9(3), 275-300.' } // precursor mean-centering strategy the 2010 Lin et al. paper refines
const LIN_2010: Ref = { text: 'Lin, G. C., Wen, Z., Marsh, H. W., Lin, H. S. (2010). "Structural equation models of latent interactions: Clarification of orthogonalizing and double-mean-centering strategies." Structural Equation Modeling, 17(3), 374-391.' } // semTools::indProd(doubleMC=TRUE)
const AIKEN_WEST_1991: Ref = { text: 'Aiken, L. S., West, S. G. (1991). Multiple Regression: Testing and Interpreting Interactions. Sage.' } // simple slopes at -1SD/mean/+1SD
const HENSELER_CHIN_2010: Ref = { text: 'Henseler, J., Chin, W. W. (2010). "A comparison of approaches for the analysis of interaction effects between latent variables using partial least squares path modeling." Structural Equation Modeling, 17(1), 82-109.' } // seminr::two_stage

// Path-analysis specific (already inline in pathAnalysis.ts's own tableNote/howToRead).
const KENNY_KANISKAN_MCCOACH_2015: Ref = { text: 'Kenny, D. A., Kaniskan, B., McCoach, D. B. (2015). "The performance of RMSEA in models with small degrees of freedom." Sociological Methods & Research, 44(3), 486-507.' }
const MACKINNON_2004: Ref = { text: 'MacKinnon, D. P., Lockwood, C. M., Williams, J. (2004). "Confidence limits for the indirect effect: Distribution of the product and resampling methods." Multivariate Behavioral Research, 39(1), 99-128.' }

// ---------------------------------------------------------------------------
// R package references, transcribed verbatim from src/lib/export/citations.ts's REFS dict (CRAN
// suffix split into `url` since Ref already carries a separate url field).
// ---------------------------------------------------------------------------
const PARAMETERS_REF: Ref = { text: 'Lüdecke D, Ben-Shachar MS, Patil I, Makowski D (2020). "Extracting, Computing and Exploring the Parameters of Statistical Models using R." Journal of Open Source Software, 5(53), 2445.', url: 'https://CRAN.R-project.org/package=parameters' }
const PERFORMANCE_REF: Ref = { text: 'Lüdecke D, Ben-Shachar MS, Patil I, Waggoner P, Makowski D (2021). "performance: An R Package for Assessment, Comparison and Testing of Statistical Models." Journal of Open Source Software, 6(60), 3139.', url: 'https://CRAN.R-project.org/package=performance' }
const CAR_REF: Ref = { text: 'Fox J, Weisberg S (2019). An R Companion to Applied Regression, Third edition. Sage, Thousand Oaks CA.', url: 'https://CRAN.R-project.org/package=car' }
const PROC_REF: Ref = { text: 'Robin X, Turck N, Hainard A, et al. (2011). "pROC: an open-source package for R and S+ to analyze and compare ROC curves." BMC Bioinformatics, 12, 77.', url: 'https://CRAN.R-project.org/package=pROC' }
const MASS_REF: Ref = { text: 'Venables WN, Ripley BD (2002). Modern Applied Statistics with S, Fourth edition. Springer, New York.', url: 'https://CRAN.R-project.org/package=MASS' }
const FORECAST_REF: Ref = { text: 'Hyndman R, Athanasopoulos G, Bergmeir C, et al. (2024). forecast: Forecasting functions for time series and linear models. R package.', url: 'https://CRAN.R-project.org/package=forecast' }
const TSERIES_REF: Ref = { text: 'Trapletti A, Hornik K (2024). tseries: Time Series Analysis and Computational Finance. R package.', url: 'https://CRAN.R-project.org/package=tseries' }
const LMTEST_REF: Ref = { text: 'Zeileis A, Hothorn T (2002). "Diagnostic Checking in Regression Relationships." R News, 2(3), 7-10.', url: 'https://CRAN.R-project.org/package=lmtest' }
const VARS_REF: Ref = { text: 'Pfaff B (2008). "VAR, SVAR and SVEC Models: Implementation Within R Package vars." Journal of Statistical Software, 27(4).', url: 'https://CRAN.R-project.org/package=vars' }
const RDROBUST_REF: Ref = { text: 'Calonico S, Cattaneo MD, Farrell MH, Titiunik R (2017). "rdrobust: Software for Regression-Discontinuity Designs." The Stata Journal, 17(2), 372-404.', url: 'https://CRAN.R-project.org/package=rdrobust' }
const IVREG_REF: Ref = { text: 'Fox J, Kleiber C, Zeileis A (2024). ivreg: Instrumental-Variables Regression by 2SLS, 2SM, or 2SMM, with Diagnostics. R package.', url: 'https://CRAN.R-project.org/package=ivreg' }
const SANDWICH_REF: Ref = { text: 'Zeileis A, Köll S, Graham N (2020). "Various Versatile Variances: An Object-Oriented Implementation of Clustered Covariances in R." Journal of Statistical Software, 95(1), 1-36.', url: 'https://CRAN.R-project.org/package=sandwich' }
const MATCHIT_REF: Ref = { text: 'Ho DE, Imai K, King G, Stuart EA (2011). "MatchIt: Nonparametric Preprocessing for Parametric Causal Inference." Journal of Statistical Software, 42(8), 1-28.', url: 'https://CRAN.R-project.org/package=MatchIt' }
const PSYCH_REF: Ref = { text: 'Revelle W (2024). psych: Procedures for Psychological, Psychometric, and Personality Research. Northwestern University, Evanston.', url: 'https://CRAN.R-project.org/package=psych' }
const EFFECTSIZE_REF: Ref = { text: 'Ben-Shachar MS, Lüdecke D, Makowski D (2020). "effectsize: Estimation of Effect Size Indices and Standardized Parameters." Journal of Open Source Software, 5(56), 2815.', url: 'https://CRAN.R-project.org/package=effectsize' }
const EMMEANS_REF: Ref = { text: 'Lenth RV (2024). emmeans: Estimated Marginal Means, aka Least-Squares Means. R package.', url: 'https://CRAN.R-project.org/package=emmeans' }
const RSTATIX_REF: Ref = { text: 'Kassambara A (2023). rstatix: Pipe-Friendly Framework for Basic Statistical Tests. R package.', url: 'https://CRAN.R-project.org/package=rstatix' }
const NORTEST_REF: Ref = { text: 'Gross J, Ligges U (2015). nortest: Tests for Normality. R package.', url: 'https://CRAN.R-project.org/package=nortest' }
const SEMINR_REF: Ref = { text: 'Ray S, Danks N, Calero Valdéz A (2021). seminr: Domain-Specific Language for Building PLS Structural Equation Models. R package.', url: 'https://CRAN.R-project.org/package=seminr' }
const JANITOR_REF: Ref = { text: 'Firke S (2023). janitor: Simple Tools for Examining and Cleaning Dirty Data. R package.', url: 'https://CRAN.R-project.org/package=janitor' }

// Provenance-audit fix round (U9-T3 wave C, 2026-07-06 completeness audit): Kendall's W and the Nemenyi
// post-hoc, both rendered on the friedman card but previously uncited.
const KENDALL_1948: Ref = { text: 'Kendall, M. G. (1948). Rank Correlation Methods. Charles Griffin & Company.' }
const NEMENYI_1963: Ref = { text: 'Nemenyi, P. B. (1963). Distribution-free multiple comparisons [Doctoral dissertation, Princeton University].' }
// Wu-Hausman endogeneity test and the Sargan over-identification test, both rendered on the iv-2sls card
// (summary(ivreg, diagnostics=TRUE)) but previously uncited (a hole the U7 citation-coverage gate misses,
// since it only checks that an entry EXISTS per card, not that every rendered diagnostic has a claim).
const WU_1973: Ref = { text: 'Wu, D. M. (1973). "Alternative tests of independence between stochastic regressors and disturbances." Econometrica, 41(4), 733-750.', url: 'https://doi.org/10.2307/1914093' }
const SARGAN_1958: Ref = { text: 'Sargan, J. D. (1958). "The estimation of economic relationships using instrumental variables." Econometrica, 26(3), 393-415.', url: 'https://doi.org/10.2307/1907619' }

// R language itself (used for the base OLS coefficient claim, matching the brief's worked example).
const R_CORE_REF: Ref = { text: 'R Core Team (2026). R: A Language and Environment for Statistical Computing. R Foundation for Statistical Computing, Vienna.' }

export const CITATIONS: Record<string, TestCitations> = {
  'summary-statistics': {
    whyThisTest: {
      text: 'Recommended when you want to summarize the central tendency and spread of one or more numeric variables.',
      refs: [PSYCH_REF],
    },
    statisticalBasis: [
      // Provenance-audit fix (U9-T3 wave C): the app computes these via psych::describe (Revelle) — the
      // export script's modelsummary::datasummary_skim is a documented, separate reporting-convention path
      // (assocDesc.ts), not what the ON-SCREEN card actually runs. Re-attributed to the true computation.
      { claim: 'Descriptive statistics table (mean, SD, median, min/max, N, skew, kurtosis)', ref: PSYCH_REF },
    ],
  },
  'frequencies-crosstabs': {
    whyThisTest: {
      text: 'Recommended when you want counts and cross-tabulations for one or more categorical variables.',
      refs: [JANITOR_REF],
    },
    statisticalBasis: [
      // Provenance-audit fix (U9-T3 wave C): the app computes these via janitor::tabyl (Firke), not modelsummary.
      { claim: 'Frequency counts and cross-tabulations', ref: JANITOR_REF },
    ],
  },
  'distribution-normality': {
    whyThisTest: {
      text: 'Recommended when you want to check whether a numeric variable is approximately normally distributed.',
      refs: [SHAPIRO_WILK_1965],
    },
    statisticalBasis: [
      { claim: 'Shapiro-Wilk test for normality (3-5000 cases)', ref: SHAPIRO_WILK_1965 },
      { claim: 'Additional normality tests (Lilliefors and related)', ref: NORTEST_REF },
    ],
  },
  'one-sample-t-test': {
    whyThisTest: {
      text: 'Recommended when you compare the mean of one numeric variable to a fixed reference value.',
      refs: [STUDENT_1908],
    },
    statisticalBasis: [
      { claim: 'One-sample t-test', ref: STUDENT_1908 },
      { claim: "Cohen's d effect-size benchmarks (.2/.5/.8)", ref: COHEN_1988 },
    ],
  },
  'independent-t-test': {
    whyThisTest: {
      text: 'Recommended when you compare the means of two independent groups on one numeric outcome.',
      refs: [STUDENT_1908, WELCH_1947],
    },
    statisticalBasis: [
      { claim: 'Independent-samples t-test (pooled variance)', ref: STUDENT_1908 },
      { claim: "Welch's correction (unequal variances, the app's default)", ref: WELCH_1947 },
      { claim: "Cohen's d effect-size benchmarks (.2/.5/.8)", ref: COHEN_1988 },
      { claim: "Levene's test for equal variances (Brown-Forsythe median-centered variant)", ref: LEVENE_1960 },
      { claim: 'Brown-Forsythe median-centered variant of the homogeneity-of-variance test', ref: BROWN_FORSYTHE_1974 },
    ],
  },
  'paired-t-test': {
    whyThisTest: {
      text: 'Recommended when you compare two related (repeated or matched) measurements on the same subjects.',
      refs: [STUDENT_1908],
    },
    statisticalBasis: [
      { claim: 'Paired-samples t-test', ref: STUDENT_1908 },
      { claim: "Cohen's dz effect size", ref: COHEN_1988 },
      { claim: 'Paired correlation (Pearson r) between the two conditions', ref: PEARSON_1895 },
    ],
  },
  'one-way-anova': {
    whyThisTest: {
      text: 'Recommended when you compare the means of three or more independent groups on one numeric outcome.',
      refs: [FISHER_1925],
    },
    statisticalBasis: [
      { claim: 'F-test for equality of several means (ANOVA)', ref: FISHER_1925 },
      { claim: 'Tukey HSD post-hoc comparison', ref: TUKEY_1949 },
      { claim: "Bonferroni-corrected post-hoc comparison (a 'posthoc' choice)", ref: DUNN_1961 },
      { claim: "Scheffé-corrected post-hoc comparison (a 'posthoc' choice)", ref: SCHEFFE_1953 },
      { claim: "Levene's test for equal variances (Brown-Forsythe median-centered variant)", ref: LEVENE_1960 },
      { claim: 'Brown-Forsythe median-centered variant of the homogeneity-of-variance test', ref: BROWN_FORSYTHE_1974 },
      { claim: 'η² effect-size benchmarks', ref: COHEN_1988 },
    ],
  },
  'factorial-anova': {
    whyThisTest: {
      text: 'Recommended when you test the main effects and interaction of two or more independent factors on one numeric outcome.',
      refs: [FISHER_1925],
    },
    statisticalBasis: [
      { claim: 'Factorial ANOVA (main effects + interaction)', ref: FISHER_1925 },
      { claim: 'Estimated marginal means for interaction / simple-effects follow-up', ref: EMMEANS_REF },
      { claim: 'η² effect-size benchmarks', ref: COHEN_1988 },
    ],
  },
  'repeated-measures-anova': {
    whyThisTest: {
      text: 'Recommended when you compare three or more conditions measured on the same subjects.',
      refs: [FISHER_1925],
    },
    statisticalBasis: [
      { claim: 'Repeated-measures ANOVA (F-test for within-subjects conditions)', ref: FISHER_1925 },
      { claim: "Mauchly's test of sphericity (rendered above the correction)", ref: MAUCHLY_1940 },
      { claim: 'Greenhouse-Geisser correction (sphericity violated)', ref: GREENHOUSE_GEISSER_1959 },
      { claim: 'Huynh-Feldt correction (sphericity violated)', ref: HUYNH_FELDT_1976 },
      { claim: 'Estimated marginal means for post-hoc comparisons', ref: EMMEANS_REF },
    ],
  },
  'mixed-anova': {
    whyThisTest: {
      text: 'Recommended when you combine a between-groups factor with a repeated-measures factor on one numeric outcome.',
      refs: [FISHER_1925],
    },
    statisticalBasis: [
      { claim: 'Mixed (split-plot) ANOVA', ref: FISHER_1925 },
      { claim: "Mauchly's test of sphericity (rendered above the correction)", ref: MAUCHLY_1940 },
      { claim: 'Greenhouse-Geisser correction (sphericity violated)', ref: GREENHOUSE_GEISSER_1959 },
      { claim: 'Huynh-Feldt correction (sphericity violated)', ref: HUYNH_FELDT_1976 },
      { claim: "Levene's test for equal variances between groups (Brown-Forsythe median-centered variant)", ref: LEVENE_1960 },
      { claim: 'Brown-Forsythe median-centered variant of the homogeneity-of-variance test', ref: BROWN_FORSYTHE_1974 },
      { claim: 'Estimated marginal means for post-hoc comparisons', ref: EMMEANS_REF },
    ],
  },
  'nested-anova': {
    whyThisTest: {
      text: 'Recommended when one factor is nested within another rather than fully crossed with it.',
      refs: [FISHER_1925],
    },
    statisticalBasis: [
      { claim: 'Nested ANOVA (upper factor tested against the nested-unit mean square)', ref: FISHER_1925 },
      { claim: 'ω² effect size', ref: EFFECTSIZE_REF },
    ],
  },
  'welch-anova': {
    whyThisTest: {
      text: 'Recommended when you compare three or more group means without assuming equal variances.',
      refs: [WELCH_1951],
    },
    statisticalBasis: [
      { claim: "Welch's ANOVA (heteroscedasticity-robust F, fractional df)", ref: WELCH_1951 },
      { claim: 'Games-Howell post-hoc comparisons (also variance-robust)', ref: RSTATIX_REF },
      { claim: 'ω² effect size (F-to-omega² conversion, no fitted aov model needed)', ref: EFFECTSIZE_REF },
    ],
  },
  ancova: {
    whyThisTest: {
      text: 'Recommended when you compare group means on one numeric outcome while statistically controlling for a covariate.',
      refs: [FISHER_1925],
    },
    statisticalBasis: [
      { claim: 'ANCOVA (group means adjusted for a covariate)', ref: FISHER_1925 },
      { claim: 'Type III sums of squares (car::Anova)', ref: CAR_REF },
      { claim: 'Estimated marginal (covariate-adjusted) means', ref: EMMEANS_REF },
      { claim: 'Partial η² effect-size benchmarks', ref: COHEN_1988 },
    ],
  },
  manova: {
    whyThisTest: {
      text: 'Recommended when you compare groups on two or more numeric outcomes at once.',
      refs: [PILLAI_1955, WILKS_1932],
    },
    statisticalBasis: [
      { claim: "Pillai's trace multivariate test (headline statistic)", ref: PILLAI_1955 },
      { claim: "Wilks' Lambda multivariate test", ref: WILKS_1932 },
      { claim: "Box's M test of homogeneity of covariance matrices", ref: BOX_1949 },
      { claim: 'Multivariate effect size (partial η² from the multivariate approx. F)', ref: EFFECTSIZE_REF },
    ],
  },
  mancova: {
    whyThisTest: {
      text: 'Recommended when you compare groups on two or more numeric outcomes while controlling for a covariate.',
      refs: [PILLAI_1955, WILKS_1932],
    },
    statisticalBasis: [
      { claim: "Pillai's trace multivariate test (headline statistic, covariate-adjusted)", ref: PILLAI_1955 },
      { claim: "Wilks' Lambda multivariate test (covariate-adjusted)", ref: WILKS_1932 },
      { claim: "Box's M test of homogeneity of covariance matrices", ref: BOX_1949 },
      { claim: 'Multivariate effect size (partial η² from the multivariate approx. F)', ref: EFFECTSIZE_REF },
      { claim: 'Estimated marginal (covariate-adjusted) means', ref: EMMEANS_REF },
    ],
  },
  'mann-whitney-u': {
    whyThisTest: {
      text: 'Recommended when you compare two independent groups on one numeric or ordinal outcome without assuming normality.',
      refs: [MANN_WHITNEY_1947],
    },
    statisticalBasis: [
      { claim: 'Mann-Whitney U test', ref: MANN_WHITNEY_1947 },
      { claim: 'Rank-biserial effect size r', ref: EFFECTSIZE_REF },
    ],
  },
  'wilcoxon-signed-rank': {
    whyThisTest: {
      text: 'Recommended when you compare two related measurements without assuming normally distributed differences.',
      refs: [WILCOXON_1945],
    },
    statisticalBasis: [
      { claim: 'Wilcoxon signed-rank test', ref: WILCOXON_1945 },
      { claim: 'Matched-pairs rank-biserial effect size', ref: EFFECTSIZE_REF },
    ],
  },
  'kruskal-wallis': {
    whyThisTest: {
      text: 'Recommended when you compare three or more independent groups without assuming normality.',
      refs: [KRUSKAL_WALLIS_1952],
    },
    statisticalBasis: [
      { claim: 'Kruskal-Wallis H test (nonparametric counterpart to one-way ANOVA)', ref: KRUSKAL_WALLIS_1952 },
      { claim: "Dunn's post-hoc pairwise comparisons", ref: RSTATIX_REF },
      // Provenance-audit fix (U9-T3 wave C): ε² is effectsize::rank_epsilon_squared, not a Kruskal-Wallis
      // primary — cited to the package that supplies it (mirrors nested-anova's ω² precedent).
      { claim: 'ε² effect size', ref: EFFECTSIZE_REF },
    ],
  },
  friedman: {
    whyThisTest: {
      text: 'Recommended when you compare three or more related conditions without assuming normality.',
      refs: [FRIEDMAN_1937],
    },
    statisticalBasis: [
      { claim: 'Friedman rank test (nonparametric counterpart to repeated-measures ANOVA)', ref: FRIEDMAN_1937 },
      { claim: "Kendall's W effect size (agreement among rankings)", ref: KENDALL_1948 },
      { claim: 'Nemenyi post-hoc pairwise comparisons', ref: NEMENYI_1963 },
    ],
  },
  pearson: {
    whyThisTest: {
      text: 'Recommended when you measure the strength and direction of a LINEAR relationship between two numeric variables.',
      refs: [PEARSON_1895],
    },
    statisticalBasis: [
      { claim: 'Pearson product-moment correlation coefficient (r)', ref: PEARSON_1895 },
      { claim: 'r effect-size benchmarks (.1/.3/.5)', ref: COHEN_1988 },
    ],
  },
  spearman: {
    whyThisTest: {
      text: 'Recommended when you measure a monotonic (rank-based) association between two ordinal or non-normal numeric variables.',
      refs: [SPEARMAN_1904],
    },
    statisticalBasis: [
      { claim: "Spearman's rank correlation (ρ)", ref: SPEARMAN_1904 },
    ],
  },
  'kendalls-tau': {
    whyThisTest: {
      text: 'Recommended when you measure rank association between two variables and want a coefficient robust to tied ranks.',
      refs: [KENDALL_1938],
    },
    statisticalBasis: [
      { claim: "Kendall's tau-b rank correlation (tie-corrected)", ref: KENDALL_1938 },
    ],
  },
  'chi-square-independence': {
    whyThisTest: {
      text: 'Recommended when you test whether two categorical variables are related.',
      refs: [PEARSON_1900],
    },
    statisticalBasis: [
      { claim: 'Chi-square test of independence', ref: PEARSON_1900 },
      { claim: "Cramér's V effect size (w-family; Cohen, 1988)", ref: COHEN_1988 },
    ],
  },
  'chi-square-goodness-of-fit': {
    whyThisTest: {
      text: 'Recommended when you test whether observed category counts match an expected distribution.',
      refs: [PEARSON_1900],
    },
    statisticalBasis: [
      { claim: 'Chi-square goodness-of-fit test', ref: PEARSON_1900 },
      { claim: "Cohen's w effect-size benchmark", ref: COHEN_1988 },
    ],
  },
  'fishers-exact': {
    whyThisTest: {
      text: 'Recommended when you test association between two categorical variables in a small sample or sparse table.',
      refs: [FISHER_1922],
    },
    statisticalBasis: [
      { claim: "Fisher's exact test (conditional MLE odds ratio for 2x2 tables)", ref: FISHER_1922 },
      // Provenance-audit fix (U9-T3 wave C): Cramér's V (larger-than-2x2 tables) is effectsize::cramers_v,
      // previously rendered on-card but uncited.
      { claim: "Cramér's V effect size (larger-than-2×2 tables)", ref: EFFECTSIZE_REF },
    ],
  },
  'simple-linear-regression': {
    whyThisTest: {
      text: 'Recommended when you predict one numeric outcome from a single numeric predictor.',
      refs: [PARAMETERS_REF],
    },
    statisticalBasis: [
      { claim: 'Ordinary least squares regression coefficient (B), SE, CI', ref: R_CORE_REF },
      { claim: 'Standardized coefficient (β)', ref: PARAMETERS_REF },
    ],
  },
  'multiple-linear-regression': {
    whyThisTest: {
      text: 'Recommended when you predict one numeric outcome from two or more predictors and want each predictor’s independent contribution.',
      refs: [OBRIEN_2007],
    },
    statisticalBasis: [
      { claim: 'Ordinary least squares regression coefficients (B), SE, CI', ref: R_CORE_REF },
      { claim: 'Standardized coefficients (β)', ref: PARAMETERS_REF },
      { claim: 'Variance inflation factor (VIF) cutoff guidance', ref: OBRIEN_2007 },
    ],
  },
  'logistic-regression': {
    whyThisTest: {
      text: 'Recommended when you predict a binary (yes/no) outcome from one or more predictors.',
      refs: [PERFORMANCE_REF],
    },
    statisticalBasis: [
      { claim: 'Logistic regression coefficients (log-odds / odds ratios)', ref: R_CORE_REF },
      { claim: 'Nagelkerke pseudo-R²', ref: PERFORMANCE_REF },
      { claim: 'ROC curve / AUC', ref: PROC_REF },
    ],
  },
  'poisson-negative-binomial': {
    whyThisTest: {
      text: 'Recommended when you predict a count outcome from one or more predictors.',
      refs: [MASS_REF],
    },
    statisticalBasis: [
      { claim: 'Poisson regression (incidence-rate ratios)', ref: R_CORE_REF },
      { claim: 'Negative binomial regression (glm.nb) for overdispersed counts', ref: MASS_REF },
      { claim: 'Overdispersion check', ref: PERFORMANCE_REF },
    ],
  },
  'arima-sarima': {
    whyThisTest: {
      text: 'Recommended when you model and forecast a single time series with trend and/or seasonality.',
      refs: [FORECAST_REF],
    },
    statisticalBasis: [
      { claim: 'ARIMA/SARIMA model selection and forecasting', ref: FORECAST_REF },
    ],
  },
  'stationarity-tests': {
    whyThisTest: {
      text: 'Recommended when you test whether a time series is stationary before further time-series modeling.',
      refs: [DICKEY_FULLER_1979],
    },
    statisticalBasis: [
      { claim: 'Augmented Dickey-Fuller unit-root test', ref: DICKEY_FULLER_1979 },
      { claim: 'KPSS stationarity test', ref: KWIATKOWSKI_1992 },
      { claim: 'Phillips-Perron unit-root test', ref: PHILLIPS_PERRON_1988 },
      { claim: 'Implementation (tseries package)', ref: TSERIES_REF },
    ],
  },
  'granger-causality': {
    whyThisTest: {
      text: 'Recommended when you test whether past values of one series help predict another series.',
      refs: [GRANGER_1969],
    },
    statisticalBasis: [
      { claim: 'Granger causality F-test', ref: GRANGER_1969 },
      { claim: 'Implementation (lmtest::grangertest)', ref: LMTEST_REF },
    ],
  },
  var: {
    whyThisTest: {
      text: 'Recommended when you model several interrelated time series jointly, each as a function of its own and the others’ past values.',
      refs: [VARS_REF],
    },
    statisticalBasis: [
      { claim: 'Vector autoregression (VAR) estimation', ref: VARS_REF },
      { claim: 'VAR modeling framework and impulse-response interpretation', ref: LUTKEPOHL_2005 },
    ],
  },
  'fixed-effects': {
    whyThisTest: {
      text: 'Recommended when you estimate a panel regression that controls for unobserved, time-invariant entity characteristics.',
      refs: [CROISSANT_MILLO_2008],
    },
    statisticalBasis: [
      { claim: 'Fixed-effects (within) panel estimator', ref: CROISSANT_MILLO_2008 },
    ],
  },
  'random-effects': {
    whyThisTest: {
      text: 'Recommended when you estimate a panel regression assuming entity effects are uncorrelated with the predictors.',
      refs: [CROISSANT_MILLO_2008],
    },
    statisticalBasis: [
      { claim: 'Random-effects (GLS) panel estimator', ref: CROISSANT_MILLO_2008 },
    ],
  },
  'hausman-test': {
    whyThisTest: {
      text: 'Recommended when you need to choose between fixed-effects and random-effects panel models.',
      refs: [HAUSMAN_1978],
    },
    statisticalBasis: [
      { claim: 'Hausman specification test', ref: HAUSMAN_1978 },
      { claim: 'Implementation (plm package)', ref: CROISSANT_MILLO_2008 },
    ],
  },
  did: {
    whyThisTest: {
      text: 'Recommended when you estimate a policy/treatment effect from before/after outcomes in a treated vs. control group.',
      refs: [CROISSANT_MILLO_2008, BERTRAND_DUFLO_MULLAINATHAN_2004],
    },
    statisticalBasis: [
      { claim: 'Difference-in-differences via entity fixed effects (plm within estimator)', ref: CROISSANT_MILLO_2008 },
      { claim: 'Clustered standard errors / parallel-trends interpretation', ref: BERTRAND_DUFLO_MULLAINATHAN_2004 },
    ],
  },
  rdd: {
    whyThisTest: {
      text: 'Recommended when you estimate a treatment effect at a cutoff that assigns treatment.',
      refs: [RDROBUST_REF],
    },
    statisticalBasis: [
      { claim: 'Robust bias-corrected local-polynomial regression discontinuity inference', ref: CALONICO_CATTANEO_TITIUNIK_2014 },
      { claim: 'Implementation (rdrobust package)', ref: RDROBUST_REF },
    ],
  },
  'iv-2sls': {
    whyThisTest: {
      text: 'Recommended when you estimate a causal effect in the presence of an endogenous predictor, using an instrument.',
      refs: [IVREG_REF],
    },
    statisticalBasis: [
      { claim: 'Two-stage least squares (2SLS) estimation', ref: IVREG_REF },
      { claim: 'Weak-instrument first-stage F rule of thumb', ref: STOCK_YOGO_2005 },
      { claim: 'Heteroscedasticity-robust standard errors', ref: SANDWICH_REF },
      // Provenance-audit fix (U9-T3 wave C): Wu-Hausman endogeneity + Sargan over-identification are
      // rendered as diagnostic span rows (summary(ivreg, diagnostics=TRUE)) but were previously uncited.
      { claim: 'Wu-Hausman endogeneity test', ref: WU_1973 },
      { claim: 'Sargan over-identification test', ref: SARGAN_1958 },
    ],
  },
  'propensity-score-matching': {
    whyThisTest: {
      text: 'Recommended when you estimate a treatment effect by matching treated and control units on their propensity to receive treatment.',
      refs: [MATCHIT_REF],
    },
    statisticalBasis: [
      { claim: 'Propensity score matching', ref: MATCHIT_REF },
      { claim: 'Covariate-balance diagnostics', ref: AUSTIN_2011 },
    ],
  },
  'cronbachs-alpha': {
    whyThisTest: {
      text: 'Recommended when you assess the internal consistency of a single multi-item scale.',
      refs: [MCNEISH_2018],
    },
    statisticalBasis: [
      { claim: "Cronbach's alpha (tau-equivalent reliability)", ref: PSYCH_REF },
      { claim: "McDonald's omega as the headline reliability coefficient (preferred over alpha when loadings differ)", ref: MCNEISH_2018 },
    ],
  },
  ave: {
    whyThisTest: {
      text: 'Recommended when you assess how well a set of indicators converges on its intended latent construct and is distinct from other constructs.',
      refs: [FORNELL_LARCKER_1981],
    },
    statisticalBasis: [
      { claim: 'AVE (average variance extracted) convergent validity, ≥ .50', ref: FORNELL_LARCKER_1981 },
      // NOTE: the ≥ .70 CR threshold is commonly mis-cited to Fornell & Larcker; the correct primary is
      // Nunnally (1978)'s general reliability-coefficient cutoff, corroborated independently below by
      // Bagozzi & Yi (1988). Keep NUNNALLY_1978 (not FORNELL_LARCKER_1981) as this claim's ref.
      { claim: 'CR (composite reliability) ≥ .70 acceptable', ref: NUNNALLY_1978 },
      { claim: 'CR ≥ .70 threshold, independent corroboration', ref: BAGOZZI_YI_1988 },
      { claim: 'HTMT < .85 discriminant validity (primary criterion)', ref: HENSELER_2015 },
      { claim: 'Reliability preference (ω over α)', ref: MCNEISH_2018 },
    ],
  },
  'composite-reliability': {
    whyThisTest: {
      text: 'Recommended when you assess how reliably a set of items measures its latent construct.',
      refs: [NUNNALLY_1978],
    },
    statisticalBasis: [
      // NOTE: same mis-citation trap as the ave entry above - the ≥ .70 CR threshold is commonly
      // mis-cited to Fornell & Larcker; Nunnally (1978) is the correct primary.
      { claim: 'CR (composite reliability) ≥ .70 acceptable', ref: NUNNALLY_1978 },
      { claim: 'CR ≥ .70 threshold, independent corroboration', ref: BAGOZZI_YI_1988 },
      { claim: 'AVE shown alongside for convergent-validity reference (≥ .50)', ref: FORNELL_LARCKER_1981 },
      { claim: 'α retained as a secondary/legacy coefficient (lower bound when loadings differ)', ref: MCNEISH_2018 },
    ],
  },
  efa: {
    whyThisTest: {
      text: 'Recommended when you want to discover the underlying factor structure behind a set of observed variables.',
      refs: [WATKINS_2018],
    },
    statisticalBasis: [
      // NOTE: the KMO verbal labels are commonly mis-cited to "Kaiser (1974)" (the factorial-simplicity
      // paper); the correct primary is Kaiser & Rice (1974) "Little Jiffy, Mark IV", a distinct paper.
      { claim: 'KMO sampling-adequacy verbal labels (≥ .60 acceptable, ≥ .70 preferred)', ref: KAISER_RICE_1974 },
      { claim: 'Parallel analysis as the preferred factor-retention rule', ref: HORN_1965 },
      { claim: 'Kaiser eigenvalue > 1 rule systematically over-extracts', ref: ZWICK_VELICER_1986 },
      { claim: 'EFA best-practice reporting standard', ref: WATKINS_2018 },
    ],
  },
  'cb-sem': {
    whyThisTest: {
      text: 'Recommended when you test a theory-specified measurement + structural model among latent constructs (confirmatory, not exploratory).',
      refs: [KLINE_2023, APPELBAUM_2018],
    },
    statisticalBasis: [
      { claim: 'Model estimation (lavaan)', ref: ROSSEEL_2012 },
      { claim: 'Fit-index cutoffs (CFI/TLI ≥ .95, RMSEA ≤ .06, SRMR ≤ .08)', ref: HU_BENTLER_1999 },
      { claim: 'Cutoffs are guidelines, not pass/fail gates', ref: MARSH_HAU_WEN_2004 },
      { claim: 'RMSEA 90% confidence interval', ref: MACCALLUM_1996 },
      { claim: 'AVE / Fornell-Larcker discriminant validity', ref: FORNELL_LARCKER_1981 },
      { claim: 'Reliability preference (ω over α)', ref: MCNEISH_2018 },
      { claim: 'Reporting standard (APA JARS-Quant)', ref: APPELBAUM_2018 },
      { claim: 'Double-mean-centering for latent moderation (semTools::indProd)', ref: LIN_2010 },
      { claim: 'Mean-centering strategy for latent interactions (precursor)', ref: MARSH_WEN_HAU_2004 },
      { claim: 'Simple slopes at -1SD/mean/+1SD', ref: AIKEN_WEST_1991 },
    ],
  },
  'pls-sem': {
    whyThisTest: {
      text: 'Recommended when you test a variance-based structural model among latent constructs, especially with smaller samples or formative constructs.',
      refs: [HAIR_2019],
    },
    statisticalBasis: [
      { claim: 'PLS-SEM estimation (seminr)', ref: SEMINR_REF },
      { claim: 'Discriminant validity via HTMT < .85/.90', ref: HENSELER_2015 },
      { claim: 'f² effect-size benchmarks (.02/.15/.35)', ref: COHEN_1988 },
      { claim: 'PLS-SEM reporting standard (no global fit indices; judge by reliability/validity then R²/Q²/f²)', ref: HAIR_2019 },
      { claim: 'Two-stage latent moderation via an interaction construct', ref: HENSELER_CHIN_2010 },
      { claim: 'Simple slopes at -1SD/mean/+1SD', ref: AIKEN_WEST_1991 },
    ],
  },
  'path-analysis': {
    whyThisTest: {
      text: 'Recommended when you model directed relationships (including mediation) among observed variables without a latent measurement model.',
      refs: [ROSSEEL_2012],
    },
    statisticalBasis: [
      { claim: 'Path model estimation (lavaan::sem, observed variables only)', ref: ROSSEEL_2012 },
      { claim: 'RMSEA interpreted cautiously at small df / small N for over-identified models', ref: KENNY_KANISKAN_MCCOACH_2015 },
      { claim: 'Bootstrap percentile CIs for indirect (mediated) effects', ref: MACKINNON_2004 },
    ],
  },
  pca: {
    whyThisTest: {
      text: 'Recommended when you want to reduce a set of correlated variables to a smaller number of composite components.',
      refs: [JOLLIFFE_CADIMA_2016],
    },
    statisticalBasis: [
      { claim: 'Principal component analysis as a data-reduction method (not a latent-variable model)', ref: JOLLIFFE_CADIMA_2016 },
      { claim: 'PCA is not EFA - components are composites, not reflective factors', ref: FRICK_2025 },
      { claim: 'Kaiser eigenvalue > 1 rule tends to over-extract', ref: ZWICK_VELICER_1986 },
    ],
  },
}

// Renders the "why this test" + "statistical basis" section of the export bundle's CITATIONS.txt for
// the given selection (catalog ids, in selection order). The existing package-references section
// (src/lib/export/citations.ts's citationsText) is untouched and appends this output after its own.
export function citationsTxt(selection: string[]): string {
  const lines: string[] = []
  lines.push('Statistical basis (why each test was recommended, and its methodological references)')
  lines.push('='.repeat(88))
  lines.push('')
  for (const id of selection) {
    const c = CITATIONS[id]
    if (!c) continue
    const name = CATALOG.find((x) => x.id === id)?.name ?? id
    lines.push(name)
    lines.push(`  Why this test: ${c.whyThisTest.text}`)
    for (const r of c.whyThisTest.refs) lines.push(`    ${r.text}${r.url ? ' ' + r.url : ''}`)
    lines.push('  Statistical basis:')
    for (const b of c.statisticalBasis) {
      lines.push(`    ${b.claim}`)
      lines.push(`      ${b.ref.text}${b.ref.url ? ' ' + b.ref.url : ''}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
