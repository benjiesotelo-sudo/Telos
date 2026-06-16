import type { Emitter } from './index'
import { modelsummaryCall } from '../helpers'

// ── shared option helpers (mirror builders.ts threading exactly) ───────────────
const q = (s: string) => `"${s}"`
const cols = (cs: string[]) => cs.map(q).join(', ')
// ci pill "95%" → 0.95 (mirrors format/apa ciLevel)
const ciOf = (v: unknown) => { const n = Number(String(v ?? '95').replace('%', '')); return Number.isFinite(n) && n > 0 ? n / 100 : 0.95 }
// 2-level → the "positive" level coded 1 (mirrors stats/binaryCoding positiveLevel): known positive token, else
// larger numeric, else alphabetically-later level. Best-effort from the dataset's distinct values.
const POSITIVE = /^(1|true|yes|y|t|post|after|treated|treatment|on|present|positive|high|enrolled)$/i
const positiveLevel = (levels: string[]): string => {
  if (levels.every((l) => l.trim() !== '' && Number.isFinite(Number(l)))) return [...levels].sort((a, b) => Number(a) - Number(b))[1]
  const hit = levels.find((l) => POSITIVE.test(l.trim()))
  if (hit) return hit
  return [...levels].sort()[1]
}
const distinctLevels = (dataset: { rows: Record<string, unknown>[] }, col: string): string[] =>
  [...new Set(dataset.rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '').map(String))].sort()

// House styling reused across the econometrics figures (matches the stats modules).
const BLUE = '#0c447c', LIGHT = '#9cc2ec', ORANGE = '#c8781e'

// ── emitters ───────────────────────────────────────────────────────────────────
export const regressionEmitters: Record<string, Emitter> = {
  'simple-linear-regression': (_spec, setup) => {
    const y = setup.roles['outcome'][0], x = setup.roles['predictor'][0]
    return [
      `m <- lm(${y} ~ ${x}, data = d)`,
      modelsummaryCall('m', { gof: 'lm' }),
      `print(ggplot(d, aes(${x}, ${y})) + geom_point() + geom_smooth(method = "lm"))`,
    ].join('\n')
  },

  // lm() additive model → canonical modelsummary coef table + residual diagnostics + standardized-β coefficient plot.
  // β via parameters::standardise_parameters (refit); VIF via car::vif — mirrors multipleLinearRegression.ts.
  'multiple-linear-regression': (_spec, setup, _ds) => {
    const y = setup.roles['outcome'][0], preds = setup.roles['predictors']
    const level = ciOf(setup.options['ci'])
    const rhs = preds.join(' + ')
    return [
      `m <- lm(${y} ~ ${rhs}, data = d)`,
      modelsummaryCall('m', { gof: 'lm' }),
      `# standardized betas + VIF (display extras)`,
      `print(parameters::standardise_parameters(m, method = "refit"))`,
      // car::vif needs >= 2 predictor TERMS (mirrors multipleLinearRegression.ts: length(prednames) >= 2);
      // with a single categorical predictor coef(m) >= 3 but there is only ONE term, which car::vif rejects.
      ...(preds.length >= 2 ? [`print(car::vif(m))`] : []),
      `# Figure 1 — residual diagnostics (fitted-vs-residual + Normal Q-Q)`,
      `r <- residuals(m); fv <- fitted(m); nn <- length(r)`,
      `panels <- rbind(`,
      `  data.frame(panel = "Residuals vs fitted", x = fv, y = r),`,
      `  data.frame(panel = "Normal Q-Q", x = qnorm(ppoints(nn)), y = sort(r)))`,
      `panels$panel <- factor(panels$panel, levels = c("Residuals vs fitted", "Normal Q-Q"))`,
      `qs <- quantile(r, c(0.25, 0.75)); zs <- qnorm(c(0.25, 0.75)); slope <- diff(qs) / diff(zs)`,
      `refs <- data.frame(panel = factor(c("Residuals vs fitted", "Normal Q-Q"), levels = levels(panels$panel)),`,
      `                   slope = c(0, slope), intercept = c(0, qs[1] - slope * zs[1]))`,
      `print(ggplot(panels, aes(x, y)) +`,
      `  geom_abline(data = refs, aes(slope = slope, intercept = intercept), colour = "${LIGHT}", linetype = "dashed") +`,
      `  geom_point(colour = "${BLUE}") + facet_wrap(~panel, scales = "free") + labs(x = NULL, y = NULL))`,
      `# Figure 2 — standardized coefficient plot (95% CI), intercept excluded`,
      `sp <- parameters::standardise_parameters(m, method = "refit", ci = ${level})`,
      `sp <- sp[sp$Parameter != "(Intercept)", ]`,
      `sp$Parameter <- factor(sp$Parameter, levels = rev(sp$Parameter))`,
      `print(ggplot(sp, aes(x = Std_Coefficient, y = Parameter)) +`,
      `  geom_vline(xintercept = 0, colour = "${LIGHT}", linetype = "dashed") +`,
      `  geom_pointrange(aes(xmin = CI_low, xmax = CI_high), colour = "${BLUE}") +`,
      `  labs(x = paste0("Standardized \\u03b2 (", round(${level} * 100), "% CI)"), y = NULL))`,
    ].join('\n')
  },

  // glm(family=binomial), event re-levelled to the SECOND factor level → OR via the exponentiated modelsummary
  // variant; hand classification table + pROC ROC/AUC figure. Mirrors logisticRegression.ts.
  'logistic-regression': (_spec, setup, ds) => {
    const y = setup.roles['outcome'][0], preds = setup.roles['predictors']
    const rhs = preds.join(' + ')
    // event: the chosen positive level (B2 level-select); fall back to the second distinct level.
    const event = String(setup.options['event'] ?? distinctLevels(ds, y)[1] ?? '')
    return [
      `# re-level the outcome so the chosen event becomes glm's SECOND factor level`,
      `oth <- setdiff(sort(unique(as.character(d$${y}))), ${q(event)})`,
      `d$${y} <- factor(as.character(d$${y}), levels = c(oth, ${q(event)}))`,
      `m <- glm(${y} ~ ${rhs}, family = binomial, data = d)`,
      modelsummaryCall('m', { gof: 'glm', exponentiate: true }),
      `# omnibus chi-square + pseudo-R2 (report-only footer stats)`,
      `# single overall likelihood-ratio omnibus: null - residual deviance (mirrors logisticRegression.ts)`,
      `omnibus <- m$null.deviance - m$deviance`,
      `omnibus_df <- m$df.null - m$df.residual`,
      `omnibus_p <- pchisq(omnibus, omnibus_df, lower.tail = FALSE)`,
      `print(c(omnibus_chisq = omnibus, df = omnibus_df, p = omnibus_p))`,
      `print(performance::r2_nagelkerke(m))`,
      `# Classification table — cutoff P(event) >= 0.5, rows = predicted level`,
      `p <- fitted(m)`,
      `pred <- factor(ifelse(p >= 0.5, ${q(event)}, oth[1]), levels = levels(d$${y}))`,
      `print(table(pred, d$${y}))`,
      `# ROC curve + AUC`,
      `roc_obj <- pROC::roc(d$${y}, p, quiet = TRUE)`,
      `auc_val <- as.numeric(pROC::auc(roc_obj))`,
      `print(ggplot(data.frame(fpr = 1 - roc_obj$specificities, tpr = roc_obj$sensitivities), aes(fpr, tpr)) +`,
      `  geom_abline(slope = 1, intercept = 0, colour = "${LIGHT}", linetype = "dashed") +`,
      `  geom_line(colour = "${BLUE}", linewidth = 0.8) +`,
      `  annotate("text", x = 0.7, y = 0.15, label = sprintf("AUC = %.3f", auc_val)) +`,
      `  coord_equal() + labs(x = "1 - Specificity", y = "Sensitivity"))`,
    ].join('\n')
  },

  // glm(family=poisson) or MASS::glm.nb; optional log-exposure offset; IRR via exponentiated modelsummary.
  // Dispersion: Poisson → performance::check_overdispersion ratio; NB → m$theta. Mirrors poissonNegativeBinomial.ts.
  'poisson-negative-binomial': (_spec, setup) => {
    const y = setup.roles['outcome'][0], preds = setup.roles['predictors']
    const exposure = setup.roles['exposure']?.[0] ?? null
    const negbin = String(setup.options['model'] ?? 'Poisson') === 'negative binomial'
    const rhs = exposure ? `${preds.join(' + ')} + offset(log(${exposure}))` : preds.join(' + ')
    const fit = negbin
      ? `m <- MASS::glm.nb(${y} ~ ${rhs}, data = d)`
      : `m <- glm(${y} ~ ${rhs}, family = poisson, data = d)`
    const disp = negbin
      ? `m$theta  # negative-binomial dispersion (theta)`
      : `performance::check_overdispersion(m)$dispersion_ratio  # Poisson dispersion ratio`
    return [
      fit,
      modelsummaryCall('m', { gof: 'glm', exponentiate: true }),
      `# dispersion`,
      `print(${disp})`,
      `# Figure — fitted vs. Pearson residuals`,
      `pd <- data.frame(fitted = fitted(m), resid = residuals(m, type = "pearson"))`,
      `print(ggplot(pd, aes(fitted, resid)) +`,
      `  geom_hline(yintercept = 0, colour = "${LIGHT}", linetype = "dashed") +`,
      `  geom_point(colour = "${BLUE}") + labs(x = "Fitted values", y = "Pearson residuals"))`,
    ].join('\n')
  },

  // forecast::auto.arima (auto) or arima() with the manual (p,d,q)(P,D,Q)[s] order; confint, Ljung-Box, forecast,
  // autoplot + residual diagnostics. Mirrors arimaSarima.ts.
  'arima-sarima': (_spec, setup) => {
    const time = setup.roles['time'][0], series = setup.roles['series'][0]
    const auto = String(setup.options['order'] ?? 'auto-select') !== 'manual'
    const p = Number(setup.options['order.p'] ?? 0), dd = Number(setup.options['order.d'] ?? 0), qq = Number(setup.options['order.q'] ?? 0)
    const P = Number(setup.options['order.P'] ?? 0), D = Number(setup.options['order.D'] ?? 0), Q = Number(setup.options['order.Q'] ?? 0)
    const sPeriod = Number(setup.options['seasonalPeriod'] ?? 1)
    const horizon = Number(setup.options['horizon'] ?? 12)
    const level = ciOf(setup.options['ci'])
    const fitExpr = auto
      ? `fit <- forecast::auto.arima(x_ts)`
      : `fit <- arima(x_ts, order = c(${p}, ${dd}, ${qq}), seasonal = list(order = c(${P}, ${D}, ${Q}), period = ${sPeriod}))`
    return [
      `# sort by time so the series is in order`,
      `dd_ord <- d[order(d$${time}), ]`,
      `x_ts <- ts(dd_ord$${series}, frequency = ${sPeriod})`,
      fitExpr,
      `print(fit)`,
      `print(confint(fit, level = ${level}))`,
      `print(Box.test(residuals(fit), type = "Ljung-Box"))`,
      `print(c(AIC = AIC(fit), BIC = BIC(fit), logLik = as.numeric(logLik(fit)), sigma2 = fit$sigma2))`,
      `# Forecast table + figure`,
      `fc <- forecast::forecast(fit, h = ${horizon}, level = c(80, 95))`,
      `print(fc)`,
      `print(forecast::autoplot(fc) + labs(x = "${time}", y = "${series}") + theme_minimal())`,
      `# Residual diagnostics — residual ACF + Normal Q-Q`,
      `r <- as.numeric(residuals(fit)); nn <- length(r); ac <- acf(r, plot = FALSE)`,
      `panels <- rbind(`,
      `  data.frame(panel = "Residual ACF", x = as.numeric(ac$lag[-1]), y = as.numeric(ac$acf[-1])),`,
      `  data.frame(panel = "Normal Q-Q", x = qnorm(ppoints(nn)), y = sort(r)))`,
      `panels$panel <- factor(panels$panel, levels = c("Residual ACF", "Normal Q-Q"))`,
      `qs <- quantile(r, c(0.25, 0.75)); zs <- qnorm(c(0.25, 0.75)); slope <- diff(qs) / diff(zs)`,
      `refs <- data.frame(panel = factor(c("Residual ACF", "Normal Q-Q"), levels = levels(panels$panel)),`,
      `                   slope = c(0, slope), intercept = c(0, qs[1] - slope * zs[1]))`,
      `print(ggplot(panels, aes(x, y)) +`,
      `  geom_abline(data = refs, aes(slope = slope, intercept = intercept), colour = "${LIGHT}", linetype = "dashed") +`,
      `  geom_point(colour = "${BLUE}") + facet_wrap(~panel, scales = "free") + labs(x = NULL, y = NULL))`,
    ].join('\n')
  },

  // tseries ADF + KPSS + PP on ts(); series (level + first-difference) + ACF/PACF figures. Mirrors stationarityTests.ts.
  'stationarity-tests': (_spec, setup) => {
    const time = setup.roles['time'][0], series = setup.roles['series'][0]
    return [
      `dd_ord <- d[order(d$${time}), ]`,
      `x_ts <- ts(dd_ord$${series}, frequency = 1)`,
      `print(tseries::adf.test(x_ts))`,
      `print(tseries::kpss.test(x_ts))`,
      `print(tseries::pp.test(x_ts))`,
      `# Figure 1 — level + first-difference series`,
      `nn <- length(x_ts); idx <- seq_len(nn); dx <- c(NA_real_, diff(as.numeric(x_ts)))`,
      `sdf <- rbind(data.frame(panel = "Level", t = idx, y = as.numeric(x_ts)),`,
      `             data.frame(panel = "First diff.", t = idx, y = dx))`,
      `sdf$panel <- factor(sdf$panel, levels = c("Level", "First diff."))`,
      `print(ggplot(sdf, aes(t, y)) + geom_line(colour = "${BLUE}") +`,
      `  facet_wrap(~panel, scales = "free_y", ncol = 1) + labs(x = "${time}", y = NULL) + theme_minimal())`,
      `# Figure 2 — ACF + PACF`,
      `ci <- qnorm(0.975) / sqrt(nn); ac <- acf(x_ts, plot = FALSE); pac <- pacf(x_ts, plot = FALSE)`,
      `adf2 <- rbind(data.frame(panel = "ACF", lag = as.numeric(ac$lag[-1]), value = as.numeric(ac$acf[-1])),`,
      `              data.frame(panel = "PACF", lag = as.numeric(pac$lag), value = as.numeric(pac$acf)))`,
      `adf2$panel <- factor(adf2$panel, levels = c("ACF", "PACF"))`,
      `print(ggplot(adf2, aes(x = lag, y = value)) +`,
      `  geom_hline(yintercept = c(ci, -ci), linetype = "dashed", colour = "${LIGHT}") +`,
      `  geom_hline(yintercept = 0, colour = "grey50") +`,
      `  geom_segment(aes(xend = lag, yend = 0), colour = "${BLUE}") +`,
      `  facet_wrap(~panel, ncol = 1, scales = "free_y") + labs(x = "Lag", y = NULL) + theme_minimal())`,
    ].join('\n')
  },

  // lmtest::grangertest both directions; cross-series time plot. Mirrors grangerCausality.ts.
  'granger-causality': (_spec, setup) => {
    const time = setup.roles['time'][0], x = setup.roles['seriesX'][0], y = setup.roles['seriesY'][0]
    const maxLag = Number(setup.options['maxLag'] ?? 4)
    return [
      `dd_ord <- d[order(d$${time}), ]`,
      `# X -> Y: does ${x} Granger-cause ${y}?`,
      `print(lmtest::grangertest(d$${y} ~ d$${x}, order = ${maxLag}))`,
      `# Y -> X: does ${y} Granger-cause ${x}?`,
      `print(lmtest::grangertest(d$${x} ~ d$${y}, order = ${maxLag}))`,
      `# Figure — cross-series time plot`,
      `nn <- nrow(dd_ord); idx <- seq_len(nn)`,
      `gdf <- rbind(data.frame(t = idx, value = dd_ord$${x}, series = "${x}"),`,
      `             data.frame(t = idx, value = dd_ord$${y}, series = "${y}"))`,
      `gdf$series <- factor(gdf$series, levels = c("${x}", "${y}"))`,
      `print(ggplot(gdf, aes(x = t, y = value, colour = series)) + geom_line() +`,
      `  scale_colour_manual(values = c("${BLUE}", "#e07020")) +`,
      `  labs(x = "${time}", y = NULL, colour = NULL) + theme_minimal() + theme(legend.position = "top"))`,
    ].join('\n')
  },

  // vars::VARselect (AIC) → vars::VAR; per-equation summary/confint; fevd + roots stability; IRF plot. Mirrors var.ts.
  'var': (_spec, setup) => {
    const time = setup.roles['time'][0], series = setup.roles['series']
    const irfH = Number(setup.options['irfHorizon'] ?? 10)
    return [
      `dd_ord <- d[order(d$${time}), ]`,
      `vdf <- dd_ord[, c(${cols(series)})]`,
      `# Lag selection (search bound capped so models stay identified)`,
      `safe_max <- max(1L, min(10L, floor((nrow(vdf) - 1L) / ncol(vdf))))`,
      `sel <- vars::VARselect(vdf, lag.max = safe_max, type = 'const')`,
      `print(sel$selection); print(sel$criteria)`,
      `selected_lag <- as.integer(which.min(sel$criteria[1, ]))  # AIC minimum`,
      `fit <- vars::VAR(vdf, p = selected_lag, type = 'const')`,
      `# Per-equation coefficients (each equation is an lm)`,
      `for (eq in names(fit$varresult)) { cat("\\n== Equation:", eq, "==\\n"); print(summary(fit$varresult[[eq]])$coefficients); print(confint(fit$varresult[[eq]])) }`,
      `# Forecast-error variance decomposition at the IRF horizon`,
      `print(vars::fevd(fit, n.ahead = ${irfH}))`,
      `# Stability — max companion-eigenvalue modulus (< 1 = stable)`,
      `print(max(vars::roots(fit)))`,
      `# Figure — impulse-response functions`,
      `plot(vars::irf(fit, n.ahead = ${irfH}, boot = TRUE))`,
    ].join('\n')
  },

  // plm within (entity/time/twoways) + clustered (arellano/HC1) or classical SE via coeftest; poolability F.
  // Mirrors fixedEffects.ts.
  'fixed-effects': (_spec, setup) => {
    const entity = setup.roles['entity'][0], time = setup.roles['time'][0]
    const y = setup.roles['outcome'][0], regs = setup.roles['regressors']
    const rhs = regs.join(' + ')
    const effectMap: Record<string, string> = { entity: 'individual', time: 'time', 'two-way': 'twoways' }
    const effect = effectMap[String(setup.options['effects'] ?? 'entity')] ?? 'individual'
    const clustered = setup.options['se'] !== 'classical'
    const vcov = clustered
      ? `V <- plm::vcovHC(fit, method = 'arellano', type = 'HC1', cluster = 'group')`
      : `V <- stats::vcov(fit)`
    return [
      `pdat <- plm::pdata.frame(d, index = c(${q(entity)}, ${q(time)}))`,
      `fit <- plm::plm(${y} ~ ${rhs}, data = pdat, model = 'within', effect = '${effect}')`,
      vcov,
      `print(lmtest::coeftest(fit, vcov. = V))`,
      `print(lmtest::coefci(fit, vcov. = V, level = 0.95))`,
      `print(summary(fit))`,
      `# Poolability F-test (within vs pooled OLS)`,
      `print(plm::pFtest(fit, plm::plm(${y} ~ ${rhs}, data = pdat, model = 'pooling')))`,
      `# Figure — within-estimate coefficient plot (95% CI)`,
      `ci <- lmtest::coefci(fit, vcov. = V, level = 0.95); est <- coef(fit); labs <- names(est)`,
      `pf <- data.frame(term = factor(labs, levels = rev(labs)), b = unname(est), lo = ci[, 1], hi = ci[, 2])`,
      `print(ggplot(pf, aes(x = b, y = term)) +`,
      `  geom_vline(xintercept = 0, colour = "${LIGHT}", linetype = "dashed") +`,
      `  geom_pointrange(aes(xmin = lo, xmax = hi), colour = "${BLUE}") +`,
      `  labs(x = "Within estimate (95% CI)", y = NULL))`,
    ].join('\n')
  },

  // plm random (Swamy-Arora) + clustered/classical SE via coeftest. Mirrors randomEffects.ts.
  'random-effects': (_spec, setup) => {
    const entity = setup.roles['entity'][0], time = setup.roles['time'][0]
    const y = setup.roles['outcome'][0], regs = setup.roles['regressors']
    const rhs = regs.join(' + ')
    const clustered = setup.options['se'] !== 'classical'
    const vcov = clustered
      ? `V <- plm::vcovHC(fit, method = 'arellano', type = 'HC1', cluster = 'group')`
      : `V <- stats::vcov(fit)`
    return [
      `pdat <- plm::pdata.frame(d, index = c(${q(entity)}, ${q(time)}))`,
      `fit <- plm::plm(${y} ~ ${rhs}, data = pdat, model = 'random')`,
      vcov,
      `print(lmtest::coeftest(fit, vcov. = V))`,
      `print(lmtest::coefci(fit, vcov. = V, level = 0.95))`,
      `print(summary(fit))`,
      `# Figure — coefficient plot (95% CI), intercept excluded`,
      `ci <- lmtest::coefci(fit, vcov. = V, level = 0.95); est <- coef(fit); labs <- names(est)`,
      `keep <- labs != "(Intercept)"`,
      `pf <- data.frame(term = factor(labs[keep], levels = rev(labs[keep])), b = unname(est[keep]), lo = ci[keep, 1], hi = ci[keep, 2])`,
      `print(ggplot(pf, aes(x = b, y = term)) +`,
      `  geom_vline(xintercept = 0, colour = "${LIGHT}", linetype = "dashed") +`,
      `  geom_pointrange(aes(xmin = lo, xmax = hi), colour = "${BLUE}") +`,
      `  labs(x = "Estimate (95% CI)", y = NULL))`,
    ].join('\n')
  },

  // FE + RE + plm::phtest; clustered (arellano/HC1) CIs per model; side-by-side dodged coefficient plot. Mirrors hausmanTest.ts.
  'hausman-test': (_spec, setup) => {
    const entity = setup.roles['entity'][0], time = setup.roles['time'][0]
    const y = setup.roles['outcome'][0], regs = setup.roles['regressors']
    const rhs = regs.join(' + ')
    return [
      `pdat <- plm::pdata.frame(d, index = c(${q(entity)}, ${q(time)}))`,
      `fe <- plm::plm(${y} ~ ${rhs}, data = pdat, model = 'within')`,
      `re <- plm::plm(${y} ~ ${rhs}, data = pdat, model = 'random')`,
      `print(plm::phtest(fe, re))`,
      `# clustered (arellano/HC1) SE + 95% CI per model on the common FE slopes`,
      `fe_vc <- plm::vcovHC(fe, method = 'arellano', type = 'HC1', cluster = 'group')`,
      `re_vc <- plm::vcovHC(re, method = 'arellano', type = 'HC1', cluster = 'group')`,
      `terms <- names(coef(fe))`,
      `fe_ci <- lmtest::coefci(fe, vcov. = fe_vc, level = 0.95)`,
      `re_ci <- lmtest::coefci(re, vcov. = re_vc, level = 0.95)`,
      `cmp <- data.frame(term = terms, FE = unname(coef(fe)[terms]), RE = unname(coef(re)[terms]),`,
      `                  Difference = unname(coef(fe)[terms] - coef(re)[terms]))`,
      `print(cmp)`,
      `# Figure — side-by-side FE vs RE coefficient plot (clustered 95% CIs, dodged)`,
      `pdat2 <- rbind(`,
      `  data.frame(term = terms, model = "FE", est = unname(coef(fe)[terms]), lo = fe_ci[terms, 1], hi = fe_ci[terms, 2]),`,
      `  data.frame(term = terms, model = "RE", est = unname(coef(re)[terms]), lo = re_ci[terms, 1], hi = re_ci[terms, 2]))`,
      `pdat2$term <- factor(pdat2$term, levels = rev(terms))`,
      `print(ggplot(pdat2, aes(x = est, y = term, colour = model)) +`,
      `  geom_vline(xintercept = 0, colour = "${LIGHT}", linetype = "dashed") +`,
      `  geom_pointrange(aes(xmin = lo, xmax = hi), position = position_dodge(width = 0.4)) +`,
      `  scale_colour_manual(values = c(FE = "${BLUE}", RE = "${ORANGE}")) +`,
      `  labs(x = "Estimate (95% CI)", y = NULL, colour = NULL))`,
    ].join('\n')
  },

  // DiD = Option-B entity FE: code treated/post to 0/1 by the positive level, plm within on po + po:tr with
  // clustered/classical SE; parallel-trends plot. Mirrors did.ts.
  'did': (_spec, setup, ds) => {
    const y = setup.roles['outcome'][0], tr = setup.roles['treatment'][0], po = setup.roles['period'][0]
    const entity = setup.roles['entity'][0], time = setup.roles['time'][0]
    const trPos = positiveLevel(distinctLevels(ds, tr))
    const poPos = positiveLevel(distinctLevels(ds, po))
    const clustered = setup.options['se'] !== 'classical'
    const vcov = clustered
      ? `V <- plm::vcovHC(fit, method = 'arellano', type = 'HC1', cluster = 'group')`
      : `V <- stats::vcov(fit)`
    return [
      `# code treated/post to 0/1 by the positive level (avoids the pre<post sign flip)`,
      `d$tr <- ifelse(as.character(d$${tr}) == ${q(trPos)}, 1, 0)`,
      `d$po <- ifelse(as.character(d$${po}) == ${q(poPos)}, 1, 0)`,
      `pdat <- plm::pdata.frame(data.frame(.entity = d$${entity}, .timev = d$${time}, ${y} = d$${y}, po = d$po, tr = d$tr), index = c(".entity", ".timev"))`,
      `fit <- plm::plm(${y} ~ po + po:tr, data = pdat, model = 'within')`,
      vcov,
      `print(lmtest::coeftest(fit, vcov. = V))`,
      `print(lmtest::coefci(fit, vcov. = V, level = 0.95))`,
      `print(summary(fit))`,
      `# Figure — parallel-trends plot (group means over time, treatment onset marked)`,
      `# mirror did.ts: aggregate over LISTWISE-complete rows; rank a non-numeric time axis to integer order`,
      `keep <- is.finite(suppressWarnings(as.numeric(d$${y}))) &`,
      `  !is.na(d$${tr}) & trimws(as.character(d$${tr})) != "" &`,
      `  !is.na(d$${po}) & trimws(as.character(d$${po})) != "" &`,
      `  !is.na(d$${entity}) & trimws(as.character(d$${entity})) != "" &`,
      `  !is.na(d$${time}) & trimws(as.character(d$${time})) != ""`,
      `df_t <- d[keep, ]`,
      `raw_time <- df_t$${time}`,
      `tt <- if (is.numeric(raw_time) && all(is.finite(raw_time))) raw_time else match(as.character(raw_time), sort(unique(as.character(raw_time))))`,
      `agg <- aggregate(yy ~ tt + grp, data = data.frame(yy = df_t$${y}, tt = tt, grp = ifelse(df_t$tr == 1, "Treated", "Control")), FUN = mean)`,
      `onset <- min(tt[df_t$po == 1])`,
      `print(ggplot(agg, aes(x = tt, y = yy, colour = grp, group = grp)) +`,
      `  geom_vline(xintercept = onset, colour = "${LIGHT}", linetype = "dashed") +`,
      `  geom_line() + geom_point() +`,
      `  scale_colour_manual(values = c(Control = "${BLUE}", Treated = "${ORANGE}")) +`,
      `  labs(x = "Time", y = "Mean outcome", colour = NULL))`,
    ].join('\n')
  },

  // rdrobust::rdrobust (Conventional point estimate + robust inference) + rdplot. Mirrors rdd.ts.
  'rdd': (_spec, setup) => {
    const y = setup.roles['outcome'][0], run = setup.roles['running'][0]
    const cutoff = Number(setup.options['cutoff'] ?? 50)
    const poly = parseInt(String(setup.options['poly'] ?? '1'), 10) || 1
    // The RDD card has NO ci pill (only cutoff / bandwidth-display / polynomial); builders.ts passes no ciLevel,
    // so runRdd defaults to 95. Mirror that fixed level rather than threading a non-existent option.
    return [
      `rd <- rdrobust::rdrobust(d$${y}, d$${run}, c = ${cutoff}, p = ${poly}, level = 95)`,
      `print(summary(rd))`,
      `# Figure — RD plot (binned scatter + fitted lines either side of the cutoff)`,
      `print(rdrobust::rdplot(d$${y}, d$${run}, c = ${cutoff}, hide = TRUE)$rdplot)`,
    ].join('\n')
  },

  // ivreg::ivreg (.y ~ endo + ctrl | instr + ctrl) + matching OLS; robust (sandwich/HC1) or classical SE; first
  // stage lm + diagnostics; OLS-vs-2SLS coefficient plot. Mirrors ivTwoStage.ts.
  'iv-2sls': (_spec, setup) => {
    const y = setup.roles['outcome'][0]
    const endo = setup.roles['endogenous'], instr = setup.roles['instruments']
    const ctrl = setup.roles['controls'] ?? []
    const rhs = [...endo, ...ctrl].join(' + ')
    const ivpart = [...instr, ...ctrl].join(' + ')
    const robust = setup.options['se'] !== 'classical'
    const vcovIv = robust ? `sandwich::vcovHC(iv, type = 'HC1')` : `stats::vcov(iv)`
    const vcovOls = robust ? `sandwich::vcovHC(ols, type = 'HC1')` : `stats::vcov(ols)`
    return [
      `iv  <- ivreg::ivreg(${y} ~ ${rhs} | ${ivpart}, data = d)`,
      `ols <- lm(${y} ~ ${rhs}, data = d)`,
      `V  <- ${vcovIv}`,
      `Vo <- ${vcovOls}`,
      `print(lmtest::coeftest(iv, vcov. = V))`,
      `print(lmtest::coefci(iv, vcov. = V, level = 0.95))`,
      `print(lmtest::coeftest(ols, vcov. = Vo))`,
      `# First stage (instrument strength) — partial F = (t-stat)^2`,
      `fs <- lm(${endo[0]} ~ ${ivpart}, data = d)`,
      `print(summary(fs)$coefficients)`,
      `# Diagnostics: weak instruments F, Wu-Hausman, Sargan (when over-identified)`,
      `print(summary(iv, diagnostics = TRUE))`,
      `# Figure — OLS vs 2SLS coefficient plot (endogenous regressors)`,
      `terms <- c(${cols(endo)})`,
      `ivc <- lmtest::coefci(iv, vcov. = V, level = 0.95); olc <- lmtest::coefci(ols, vcov. = Vo, level = 0.95)`,
      `pdat <- rbind(`,
      `  data.frame(term = terms, model = "OLS", est = unname(coef(ols)[terms]), lo = olc[terms, 1], hi = olc[terms, 2]),`,
      `  data.frame(term = terms, model = "2SLS", est = unname(coef(iv)[terms]), lo = ivc[terms, 1], hi = ivc[terms, 2]))`,
      `pdat$term <- factor(pdat$term, levels = rev(terms))`,
      `print(ggplot(pdat, aes(x = est, y = term, colour = model)) +`,
      `  geom_vline(xintercept = 0, colour = "${LIGHT}", linetype = "dashed") +`,
      `  geom_pointrange(aes(xmin = lo, xmax = hi), position = position_dodge(width = 0.4)) +`,
      `  scale_colour_manual(values = c(OLS = "${BLUE}", "2SLS" = "${ORANGE}")) +`,
      `  labs(x = "Estimate (endogenous regressor)", y = NULL, colour = NULL))`,
    ].join('\n')
  },

  // MatchIt::matchit nearest (ratio[, caliper]); balance from summary(); ATT via weighted lm with clustered SE;
  // hand-rolled love plot. Mirrors propensityScoreMatching.ts.
  'propensity-score-matching': (_spec, setup, ds) => {
    const y = setup.roles['outcome'][0], tr = setup.roles['treatment'][0], covs = setup.roles['covariates']
    const trPos = positiveLevel(distinctLevels(ds, tr))
    const ratio = parseInt(String(setup.options['ratio'] ?? '1'), 10) || 1
    const calRaw = Number(setup.options['caliper'])
    const caliper = Number.isFinite(calRaw) ? calRaw : 0
    const covRhs = covs.join(' + ')
    const matchit = caliper > 0
      ? `m <- MatchIt::matchit(treat ~ ${covRhs}, data = md0, method = 'nearest', ratio = ${ratio}, caliper = ${caliper})`
      : `m <- MatchIt::matchit(treat ~ ${covRhs}, data = md0, method = 'nearest', ratio = ${ratio})`
    return [
      `# code treatment to 0/1 by the positive level`,
      `md0 <- d; md0$treat <- ifelse(as.character(d$${tr}) == ${q(trPos)}, 1, 0)`,
      matchit,
      `print(summary(m))  # covariate balance (before / after)`,
      `# ATT via weighted lm on matched data with subclass-clustered SE`,
      `md <- MatchIt::match.data(m)`,
      `att <- lm(${y} ~ treat, data = md, weights = md$weights)`,
      `V <- sandwich::vcovCL(att, cluster = md$subclass)`,
      `print(lmtest::coeftest(att, vcov. = V))`,
      `print(lmtest::coefci(att, vcov. = V, level = 0.95))`,
      `# Figure — love plot (|SMD| per covariate, unmatched vs matched, ref line at 0.1)`,
      `sm <- summary(m); covn <- c(${cols(covs)})`,
      `lp <- data.frame(cov = rep(covn, 2),`,
      `  smd = abs(c(sm$sum.all[covn, "Std. Mean Diff."], sm$sum.matched[covn, "Std. Mean Diff."])),`,
      `  sample = factor(rep(c("Unmatched", "Matched"), each = length(covn)), levels = c("Unmatched", "Matched")))`,
      `lp$cov <- factor(lp$cov, levels = rev(covn))`,
      `print(ggplot(lp, aes(x = smd, y = cov, colour = sample)) +`,
      `  geom_vline(xintercept = 0.1, colour = "${LIGHT}", linetype = "dashed") +`,
      `  geom_point(size = 3) +`,
      `  scale_colour_manual(values = c(Unmatched = "${ORANGE}", Matched = "${BLUE}")) +`,
      `  labs(x = "|Standardized mean difference|", y = NULL, colour = NULL))`,
    ].join('\n')
  },
}

export const regressionPackages: Record<string, string[]> = {
  'simple-linear-regression': ['modelsummary', 'ggplot2'],
  'multiple-linear-regression': ['modelsummary', 'ggplot2', 'parameters', 'car'],
  'logistic-regression': ['modelsummary', 'ggplot2', 'performance', 'pROC'],
  'poisson-negative-binomial': ['modelsummary', 'ggplot2', 'MASS', 'performance'],
  'arima-sarima': ['forecast', 'ggplot2'],
  'stationarity-tests': ['tseries', 'ggplot2'],
  'granger-causality': ['lmtest', 'ggplot2'],
  'var': ['vars'],
  'fixed-effects': ['plm', 'lmtest', 'ggplot2'],
  'random-effects': ['plm', 'lmtest', 'ggplot2'],
  'hausman-test': ['plm', 'lmtest', 'ggplot2'],
  'did': ['plm', 'lmtest', 'ggplot2'],
  'rdd': ['rdrobust'],
  'iv-2sls': ['ivreg', 'sandwich', 'lmtest', 'ggplot2'],
  'propensity-score-matching': ['MatchIt', 'sandwich', 'lmtest', 'ggplot2'],
}
