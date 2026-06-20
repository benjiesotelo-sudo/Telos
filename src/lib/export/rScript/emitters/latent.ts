import type { Emitter } from './index'
import type { Construct } from '../../../../state/session'
import { MAKECLUSTER_SHIM } from '../../../webr/parallelShim'

// Latent variable / SEM family. Mirrors the stats modules' R verbatim — same calls, same design rationale.
// Convention (McNeish 2018): ω (McDonald's) is the headline coefficient; α (Cronbach's) is retained as secondary.
// NEVER call semTools::reliability() — deprecated 2022. Use compRelSEM() for ω/α-equivalent.

export const latentEmitters: Record<string, Emitter> = {
  // lavaan::cfa (multi-construct) + semTools::AVE/compRelSEM/htmt → convergent + discriminant validity.
  // NEVER call semTools::reliability() — deprecated 2022.
  // T1: Construct / AVE / CR / ω / α
  // T2: Fornell-Larcker matrix (√AVE diagonal; latent correlations off-diagonal)
  // T3: HTMT matrix
  // Figure: AVE / CR bar chart (ggplot2)
  'ave': (_spec, setup) => {
    const constructs: { name: string; items: string[] }[] = setup.constructs ?? []
    const k = constructs.length
    if (k === 0) return '# No constructs defined — nothing to run for AVE.'

    const constructNamesR = `c(${constructs.map((c) => `"${c.name}"`).join(', ')})`
    const modelLines = constructs.map((c) => `${c.name} =~ ${c.items.join(' + ')}`).join('\n')
    const constructItemsFlat = constructs.flatMap((c) => c.items)
    const constructItemsFlatR = `c(${constructItemsFlat.map((v) => `"${v}"`).join(', ')})`
    const constructItemsLensR = `c(${constructs.map((c) => c.items.length).join(', ')})`

    const lines: string[] = [
      '# ---- AVE / CR / ω / α via lavaan + semTools + psych ----',
      `construct_names <- ${constructNamesR}`,
      `k <- length(construct_names)`,
      '',
      `model_str <- "${modelLines.replace(/\n/g, '\\n')}"`,
      '',
      '# Fit CFA',
      'fit <- lavaan::cfa(model_str, data = d, std.lv = FALSE)',
      '',
      '# AVE and composite reliability (ω) per construct',
      '# Do NOT call semTools::reliability() — deprecated 2022.',
      'ave_vec <- semTools::AVE(fit)',
      'cr_vec  <- unlist(semTools::compRelSEM(fit))',
      '',
      '# Per-construct Cronbach\'s α via psych::alpha',
      `construct_items_flat <- ${constructItemsFlatR}`,
      `construct_items_lens <- ${constructItemsLensR}`,
      'alpha_vec <- numeric(k)',
      'item_start <- 1L',
      'for (ci in seq_len(k)) {',
      '  len <- construct_items_lens[ci]',
      '  citems <- construct_items_flat[item_start:(item_start + len - 1L)]',
      '  item_start <- item_start + len',
      '  a_obj <- psych::alpha(d[, citems, drop = FALSE], warnings = FALSE)',
      '  alpha_vec[ci] <- a_obj$total$raw_alpha',
      '}',
      '',
      '# Print T1: Convergent validity',
      'cat("\\n--- Table 1: Convergent validity ---\\n")',
      'for (ci in seq_len(k)) {',
      '  nm <- construct_names[ci]',
      '  cat(sprintf("  %s: AVE=%.3f CR=%.3f omega=%.3f alpha=%.3f\\n",',
      '              nm, ave_vec[nm], cr_vec[nm], cr_vec[nm], alpha_vec[ci]))',
      '}',
    ]

    if (k >= 2) {
      lines.push(
        '',
        '# Fornell-Larcker matrix: diagonal = sqrt(AVE), off-diagonal = latent correlations',
        'cor_lv <- lavInspect(fit, "cor.lv")',
        'ave_ordered <- ave_vec[construct_names]',
        'fl <- cor_lv[construct_names, construct_names]',
        'for (ci in seq_len(k)) diag(fl)[ci] <- sqrt(ave_ordered[ci])',
        'cat("\\n--- Table 2: Fornell-Larcker matrix ---\\n")',
        'print(round(fl, 3))',
        '',
        '# HTMT matrix',
        'htmt_mat <- semTools::htmt(model_str, data = d)',
        'htmt_ordered <- htmt_mat[construct_names, construct_names]',
        'cat("\\n--- Table 3: HTMT matrix ---\\n")',
        'print(round(htmt_ordered, 3))',
      )
    }

    lines.push(
      '',
      '# Figure: AVE / CR bar chart',
      `d_plot <- data.frame(`,
      `  construct = rep(factor(construct_names, levels = rev(construct_names)), 2),`,
      `  metric    = c(rep("AVE", k), rep("CR", k)),`,
      `  value     = c(as.numeric(ave_vec[construct_names]), as.numeric(cr_vec[construct_names]))`,
      `)`,
      `print(`,
      `  ggplot2::ggplot(d_plot, ggplot2::aes(x = value, y = construct, fill = metric)) +`,
      `  ggplot2::geom_col(position = "dodge") +`,
      `  ggplot2::geom_vline(xintercept = 0.5, linetype = "dashed", colour = "#9cc2ec") +`,
      `  ggplot2::scale_fill_manual(values = c(AVE = "#0c447c", CR = "#5b9bd5")) +`,
      `  ggplot2::labs(x = NULL, y = NULL, fill = NULL) +`,
      `  ggplot2::theme(legend.position = "top")`,
      `)`,
    )

    return lines.join('\n')
  },

  // psych::alpha → α + item-total stats (Feldt CI for α);
  // 1-factor lavaan::cfa (std.lv=TRUE, ML) + semTools::compRelSEM → ω + bootstrap 95% CI;
  // ggplot2 item-total bar chart.
  'cronbachs-alpha': (_spec, setup) => {
    const items = setup.roles['items'] ?? []
    const itemsR = `c(${items.map((v) => `"${v}"`).join(', ')})`
    const useStd = setup.options['standardizedAlpha'] === true
    const dropItem = setup.options['dropItem'] !== false
    const alphaCol = useStd ? 'std.alpha' : 'raw_alpha'
    const lines: string[] = [
      `items <- ${itemsR}`,
      `d_items <- d[, items, drop = FALSE]`,
      '',
      '# ---- Cronbach\'s α ----',
      `a_obj <- psych::alpha(d_items, warnings = FALSE)`,
      'print(a_obj$total)',
      `cat("alpha (${useStd ? 'standardized' : 'raw'}):", a_obj$total$${alphaCol}, "\\n")`,
      'cat("alpha CI:", a_obj$feldt$lower.ci$raw_alpha, a_obj$feldt$upper.ci$raw_alpha, "\\n")',
    ]
    if (dropItem) {
      lines.push(
        '',
        '# ---- Drop-item statistics ----',
        'print(a_obj$item.stats)',
        'print(a_obj$alpha.drop)',
      )
    }
    lines.push(
      '',
      '# ---- McDonald\'s ω via 1-factor CFA + semTools::compRelSEM ----',
      '# Do NOT call semTools::reliability() — deprecated 2022.',
      `model <- paste0("f =~ ", paste(items, collapse = " + "))`,
      `fit <- lavaan::cfa(model, data = d_items, std.lv = TRUE)`,
      `omega_val <- as.numeric(semTools::compRelSEM(fit)$f)`,
      'cat("omega:", omega_val, "\\n")',
      '',
      '# Bootstrap 95% CI for ω (sequential; nboot=2000 for final reporting)',
      'set.seed(20260619)',
      `boot_omegas <- lavaan::bootstrapLavaan(fit, R = 2000, FUN = function(bfit) {`,
      `  tryCatch(as.numeric(semTools::compRelSEM(bfit)$f), error = function(e) NA_real_)`,
      `})`,
      `omega_ci <- quantile(boot_omegas, c(0.025, 0.975), na.rm = TRUE)`,
      'cat("omega 95% CI:", omega_ci[1], omega_ci[2], "\\n")',
    )
    if (dropItem) {
      lines.push(
        '',
        '# ---- Item-total bar chart ----',
        `r_drop <- a_obj$item.stats$r.drop`,
        `d_plot <- data.frame(item = factor(items, levels = rev(items)), r = r_drop)`,
        `print(ggplot2::ggplot(d_plot, ggplot2::aes(x = r, y = item)) +`,
        `  ggplot2::geom_col(fill = "#0c447c") +`,
        `  ggplot2::geom_vline(xintercept = 0.3, linetype = "dashed", colour = "#9cc2ec") +`,
        `  ggplot2::labs(x = "Corrected item-total r", y = NULL))`,
      )
    }
    return lines.join('\n')
  },

  // lavaan::cfa + semTools::compRelSEM/AVE + psych::alpha → CR / ω / AVE / α per construct.
  // NEVER call semTools::reliability() — deprecated 2022.
  // T1: Construct / CR / AVE / ω / α (CR = ω for congeneric — identical columns; correct)
  // Figure: CR bar chart (ggplot2)
  'composite-reliability': (_spec, setup) => {
    const constructs: { name: string; items: string[] }[] = setup.constructs ?? []
    const k = constructs.length
    if (k === 0) return '# No constructs defined — nothing to run for Composite Reliability.'

    const constructNamesR = `c(${constructs.map((c) => `"${c.name}"`).join(', ')})`
    const modelLines = constructs.map((c) => `${c.name} =~ ${c.items.join(' + ')}`).join('\n')
    const constructItemsFlat = constructs.flatMap((c) => c.items)
    const constructItemsFlatR = `c(${constructItemsFlat.map((v) => `"${v}"`).join(', ')})`
    const constructItemsLensR = `c(${constructs.map((c) => c.items.length).join(', ')})`

    const lines: string[] = [
      '# ---- Composite Reliability (CR) / ω / AVE / α via lavaan + semTools + psych ----',
      `construct_names <- ${constructNamesR}`,
      `k <- length(construct_names)`,
      '',
      `model_str <- "${modelLines.replace(/\n/g, '\\n')}"`,
      '',
      '# Fit CFA',
      'fit <- lavaan::cfa(model_str, data = d, std.lv = FALSE)',
      '',
      '# CR (= ω for congeneric) and AVE per construct',
      '# Do NOT call semTools::reliability() — deprecated 2022.',
      'cr_vec  <- unlist(semTools::compRelSEM(fit))',
      'ave_vec <- semTools::AVE(fit)',
      '',
      '# Per-construct Cronbach\'s α via psych::alpha',
      `construct_items_flat <- ${constructItemsFlatR}`,
      `construct_items_lens <- ${constructItemsLensR}`,
      'alpha_vec <- numeric(k)',
      'item_start <- 1L',
      'for (ci in seq_len(k)) {',
      '  len <- construct_items_lens[ci]',
      '  citems <- construct_items_flat[item_start:(item_start + len - 1L)]',
      '  item_start <- item_start + len',
      '  a_obj <- psych::alpha(d[, citems, drop = FALSE], warnings = FALSE)',
      '  alpha_vec[ci] <- a_obj$total$raw_alpha',
      '}',
      '',
      '# Print T1: Composite reliability',
      'cat("\\n--- Table 1: Composite reliability ---\\n")',
      'for (ci in seq_len(k)) {',
      '  nm <- construct_names[ci]',
      '  cat(sprintf("  %s: CR=%.3f AVE=%.3f omega=%.3f alpha=%.3f\\n",',
      '              nm, cr_vec[nm], ave_vec[nm], cr_vec[nm], alpha_vec[ci]))',
      '}',
      '',
      '# Figure: CR bar chart',
      `d_plot <- data.frame(`,
      `  construct = factor(construct_names, levels = rev(construct_names)),`,
      `  value     = as.numeric(cr_vec[construct_names])`,
      `)`,
      `print(`,
      `  ggplot2::ggplot(d_plot, ggplot2::aes(x = value, y = construct)) +`,
      `  ggplot2::geom_col(fill = "#0c447c") +`,
      `  ggplot2::geom_vline(xintercept = 0.7, linetype = "dashed", colour = "#9cc2ec") +`,
      `  ggplot2::labs(x = "CR", y = NULL) +`,
      `  ggplot2::theme(legend.position = "none")`,
      `)`,
    ]

    return lines.join('\n')
  },

  // psych::KMO() + cortest.bartlett() → suitability · parallel analysis → retention
  // psych::fa() → rotated loadings + communalities + Phi (oblimin) · ggplot2 → scree figure
  'efa': (_spec, setup) => {
    const items: string[] = setup.roles['items'] ?? []
    if (items.length < 3) return '# Need ≥ 3 items for EFA.'
    const itemsR = `c(${items.map((v) => `"${v}"`).join(', ')})`
    const extraction = setup.options['extraction'] === 'ML' ? 'ml' : 'pa'
    const rotation = setup.options['rotation'] === 'varimax' ? 'varimax' : 'oblimin'
    const retentionOpt = String(setup.options['retention'] ?? 'parallel')
    const retention = retentionOpt === 'Kaiser' ? 'kaiser' : retentionOpt === 'fixed-n' ? 'fixed' : 'parallel'
    const nFactors = Number(setup.options['nFactors'] ?? 2)

    const lines: string[] = [
      `items <- ${itemsR}`,
      `d_items <- d[, items, drop = FALSE]`,
      `n <- nrow(d_items)`,
      '',
      '# ---- EFA: suitability ----',
      `library(psych)`,
      `R_cor <- cor(d_items)`,
      `kmo_val <- psych::KMO(R_cor)$MSA`,
      `cat("KMO:", round(kmo_val, 3), "\\n")`,
      `bart_obj <- psych::cortest.bartlett(R_cor, n = n)`,
      `cat("Bartlett chisq:", round(bart_obj$chisq, 1), "df:", bart_obj$df, "p:", bart_obj$p.value, "\\n")`,
      '',
    ]

    if (retention === 'parallel') {
      lines.push(
        '# ---- Parallel analysis for retention ----',
        `x <- as.matrix(d_items); nsim <- 500L; seed <- 20260619L; kind <- "fa"`,
        `set.seed(seed)`,
        `n_pa <- nrow(x); p_pa <- ncol(x)`,
        `R_pa <- cor(x); smc_v <- psych::smc(R_pa); smc_v <- pmin(pmax(smc_v, 0), 1); diag(R_pa) <- smc_v`,
        `obs_eig <- sort(eigen(R_pa, symmetric = TRUE, only.values = TRUE)$values, decreasing = TRUE)`,
        `sim_e <- matrix(0, nsim, p_pa)`,
        `for (i in seq_len(nsim)) {`,
        `  rx <- matrix(rnorm(n_pa * p_pa), n_pa, p_pa)`,
        `  Rs <- cor(rx); sv <- psych::smc(Rs); sv <- pmin(pmax(sv, 0), 1); diag(Rs) <- sv`,
        `  sim_e[i, ] <- sort(eigen(Rs, symmetric = TRUE, only.values = TRUE)$values, decreasing = TRUE)`,
        `}`,
        `sim_p95 <- apply(sim_e, 2, quantile, probs = 0.95)`,
        `k_retain <- 0L`,
        `for (i in seq_len(p_pa)) { if (obs_eig[i] > sim_p95[i]) k_retain <- k_retain + 1L else break }`,
        `cat("Parallel analysis retain:", k_retain, "\\n")`,
        '',
      )
    } else if (retention === 'kaiser') {
      lines.push(
        '# ---- Kaiser eigenvalue > 1 retention ----',
        `k_retain <- sum(eigen(R_cor, only.values = TRUE)$values > 1)`,
        `cat("Kaiser retain:", k_retain, "\\n")`,
        '',
      )
    } else {
      lines.push(
        `k_retain <- ${nFactors}L`,
        `cat("Fixed retain:", k_retain, "\\n")`,
        '',
      )
    }

    lines.push(
      '# ---- psych::fa ----',
      `fm_method <- "${extraction}"`,
      `fa_obj <- psych::fa(d_items, nfactors = k_retain, fm = fm_method, rotate = "${rotation}")`,
      `cat("\\n--- Table 2: Variance explained ---\\n")`,
      `print(round(fa_obj$Vaccounted, 3))`,
      `cat("\\n--- Table 3: Rotated loadings + communalities ---\\n")`,
      `load_mat <- unclass(fa_obj$loadings)`,
      `h2 <- fa_obj$communality`,
      `out_mat <- cbind(load_mat, communality = h2)`,
      `print(round(out_mat, 3))`,
    )

    if (rotation === 'oblimin') {
      lines.push(
        '',
        '# ---- Phi: interfactor correlations (oblique) ----',
        `if (!is.null(fa_obj$Phi)) {`,
        `  cat("\\n--- Table 4: Interfactor correlations (Phi) ---\\n")`,
        `  print(round(fa_obj$Phi, 3))`,
        `}`,
      )
    }

    return lines.join('\n')
  },

  // lavaan::sem from constructs (=~) + structural paths (~) + auto := indirect defs.
  // Single bootstrap fit for mediation (percentile CI, design D7/D10 — no RNG chunking). Diagram = semPlot::semPaths.
  // Fit table suppressed strictly when fitMeasures(fit,"df") == 0 (shared df==0 predicate; design §3.6/§5.1).
  'cb-sem': (_spec, setup) => {
    const constructs: { id: number; name: string; items: string[] }[] =
      (setup.constructs as { id: number; name: string; items: string[] }[]) ?? []
    const paths: { from: number; to: number }[] =
      (setup.paths as { from: number; to: number }[]) ?? []
    const isPath = setup.modelKind === 'path'
    if (constructs.length === 0) return '# No constructs defined — nothing to run for CB-SEM.'

    const nameOf = (id: number) => constructs.find((c) => c.id === id)!.name
    const nboot = Number(setup.options['nboot'] ?? 5000)
    const ciType = setup.options['ciType'] === 'bca' ? 'bca' : 'perc'

    // Model lines: measurement (latent only) + structural + auto indirect defs.
    const lines: string[] = []
    if (!isPath) for (const c of constructs) lines.push(`${c.name} =~ ${c.items.join(' + ')}`)
    const targets = [...new Set(paths.map((p) => p.to))]
    for (const t of targets) {
      const rhs = paths.filter((p) => p.to === t)
        .map((p) => `p_${p.from}_${p.to}*${nameOf(p.from)}`).join(' + ')
      lines.push(`${nameOf(t)} ~ ${rhs}`)
    }
    const sources = new Set(paths.map((p) => p.from))
    let hasIndirect = false
    for (const ab of paths) {
      if (!sources.has(ab.to)) continue
      for (const bc of paths.filter((p) => p.from === ab.to)) {
        lines.push(`ie_${ab.from}_${ab.to}_${bc.to} := p_${ab.from}_${ab.to}*p_${bc.from}_${bc.to}`)
        hasIndirect = true
      }
    }
    const modelR = lines.join('\\n')

    const out: string[] = [
      '# ---- CB-SEM via lavaan::sem (measurement + structural + indirect) ----',
      `model_str <- "${modelR}"`,
      '',
      '# Single awaited bootstrap fit for mediation (no RNG chunking — preserves WebR≡native parity).',
      'gc()',
      'set.seed(20260620)',
    ]
    if (hasIndirect) {
      out.push(
        `fit <- lavaan::sem(model_str, data = d, se = "bootstrap", bootstrap = ${nboot})`,
        `pe  <- lavaan::parameterEstimates(fit, boot.ci.type = "${ciType}", level = 0.95)`,
      )
    } else {
      out.push(
        'fit <- lavaan::sem(model_str, data = d)',
        'pe  <- lavaan::parameterEstimates(fit, level = 0.95)',
      )
    }
    out.push(
      'gc()',
      'ss <- lavaan::standardizedSolution(fit)',
      '',
    )

    if (!isPath) {
      out.push(
        '# ---- Table 3: Measurement model (CFA) — B / SE / z / p / Std. loading ----',
        'cat("\\n--- Table 3: Measurement model (CFA) ---\\n")',
        'print(ss[ss$op == "=~", c("lhs","rhs","est.std")])',
        '',
        '# ---- Table 4: Reliability & validity — CR / AVE / ω / α ----',
        '# Do NOT call semTools::reliability() — deprecated 2022.',
        'cr_vec  <- unlist(semTools::compRelSEM(fit))',
        'ave_vec <- semTools::AVE(fit)',
        'cat("\\n--- Table 4: Reliability & validity ---\\n")',
        'print(round(rbind(CR = cr_vec, AVE = ave_vec[names(cr_vec)]), 3))',
        '',
      )
    }

    out.push(
      '# ---- Table 5: Fit indices (suppressed strictly when df == 0 — saturated) ----',
      'df_val <- as.numeric(lavaan::fitMeasures(fit, "df"))',
      'if (df_val == 0) {',
      '  cat("\\nModel is saturated (df == 0): fit indices suppressed.\\n")',
      '} else {',
      '  fm <- lavaan::fitMeasures(fit, c("chisq","df","pvalue","cfi","tli","rmsea",',
      '                                   "rmsea.ci.lower","rmsea.ci.upper","srmr"))',
      '  cat("\\n--- Table 5: Fit indices ---\\n")',
      '  print(round(fm, 3))',
      '}',
      '',
      '# ---- Table 6: Structural paths (standardized β + 95% CI + R²) ----',
      'cat("\\n--- Table 6: Structural paths ---\\n")',
      'print(ss[ss$op == "~", c("lhs","rhs","est.std","se","z","pvalue","ci.lower","ci.upper")])',
      'cat("\\n--- R-square (endogenous) ---\\n")',
      'print(round(lavInspect(fit, "rsquare"), 3))',
    )

    if (hasIndirect) {
      out.push(
        '',
        '# ---- Table 7: Indirect effects (bootstrap percentile 95% CI) ----',
        'cat("\\n--- Table 7: Indirect effects ---\\n")',
        'print(pe[pe$op == ":=", c("lhs","est","se","ci.lower","ci.upper","pvalue")])',
      )
    }

    out.push(
      '',
      '# ---- Figure: path diagram (reproducible stand-in for the app-drawn annotated SVG) ----',
      'semPlot::semPaths(fit, what = "std", layout = "tree", edge.label.cex = 0.9,',
      '                  nodeLabels = NULL, residuals = FALSE, intercepts = FALSE)',
    )

    return out.join('\n')
  },

  // prcomp(scale.=TRUE) → eigenvalues · parallel analysis (kind="pca") → retention
  // correlation-scaled loadings (rotation × sdev) → T2 (NO communality — PCA is data reduction)
  // ggplot2 → scree figure
  'pca': (_spec, setup) => {
    const variables: string[] = setup.roles['variables'] ?? []
    if (variables.length < 2) return '# Need ≥ 2 variables for PCA.'
    const varsR = `c(${variables.map((v) => `"${v}"`).join(', ')})`
    const retentionOpt = String(setup.options['retention'] ?? 'parallel')
    const retention = retentionOpt === 'Kaiser' ? 'kaiser' : retentionOpt === 'fixed-n' ? 'fixed' : 'parallel'
    const nComponents = Number(setup.options['nComponents'] ?? 2)
    const standardize = setup.options['standardize'] !== false

    const lines: string[] = [
      `variables <- ${varsR}`,
      `d_pca <- d[, variables, drop = FALSE]`,
      `d_pca <- d_pca[complete.cases(d_pca), ]`,
      `n <- nrow(d_pca)`,
      '',
      '# ---- PCA via prcomp ----',
      `prcomp_obj <- prcomp(d_pca, scale. = ${standardize ? 'TRUE' : 'FALSE'}, center = TRUE)`,
      `eigenvalues <- prcomp_obj$sdev^2`,
      `pct_var <- eigenvalues / sum(eigenvalues)`,
      `cumulative <- cumsum(pct_var)`,
      '',
    ]

    if (retention === 'parallel') {
      lines.push(
        '# ---- Parallel analysis for retention (kind="pca": standard correlation matrix) ----',
        `x <- as.matrix(d_pca)`,
        `if (${standardize ? 'TRUE' : 'FALSE'}) x <- scale(x)`,
        `nsim <- 500L; seed <- 20260619L; kind <- "pca"`,
        `set.seed(seed)`,
        `n_pa <- nrow(x); p_pa <- ncol(x)`,
        `R_pa <- cor(x)`,
        `obs_eig <- sort(eigen(R_pa, symmetric = TRUE, only.values = TRUE)$values, decreasing = TRUE)`,
        `sim_e <- matrix(0, nsim, p_pa)`,
        `for (i in seq_len(nsim)) {`,
        `  rx <- matrix(rnorm(n_pa * p_pa), n_pa, p_pa)`,
        `  sim_e[i, ] <- sort(eigen(cor(rx), symmetric = TRUE, only.values = TRUE)$values, decreasing = TRUE)`,
        `}`,
        `sim_p95 <- apply(sim_e, 2, quantile, probs = 0.95)`,
        `k_retain <- 0L`,
        `for (i in seq_len(p_pa)) { if (obs_eig[i] > sim_p95[i]) k_retain <- k_retain + 1L else break }`,
        `k_retain <- max(1L, k_retain)`,
        `cat("Parallel analysis retain:", k_retain, "\\n")`,
        '',
      )
    } else if (retention === 'kaiser') {
      lines.push(
        '# ---- Kaiser eigenvalue > 1 retention ----',
        `k_retain <- sum(eigenvalues > 1)`,
        `k_retain <- max(1L, k_retain)`,
        `cat("Kaiser retain:", k_retain, "\\n")`,
        '',
      )
    } else {
      lines.push(
        `k_retain <- ${nComponents}L`,
        `k_retain <- max(1L, k_retain)`,
        `cat("Fixed retain:", k_retain, "\\n")`,
        '',
      )
    }

    lines.push(
      '# ---- Table 1: Variance explained ----',
      `cat("\\n--- Table 1: Variance explained ---\\n")`,
      `for (ci in seq_len(k_retain)) {`,
      `  cat(sprintf("  PC%d: eigenvalue=%.3f pctVar=%.1f%% cumulative=%.1f%%\\n",`,
      `              ci, eigenvalues[ci], pct_var[ci]*100, cumulative[ci]*100))`,
      `}`,
      '',
      '# ---- Table 2: Correlation-scaled loadings (NO communality — PCA is data reduction) ----',
      `# Correlation-scaled loading = eigenvector × sqrt(eigenvalue) = rotation col × sdev`,
      `load_mat <- sweep(prcomp_obj$rotation[, seq_len(k_retain), drop = FALSE], 2, prcomp_obj$sdev[seq_len(k_retain)], "*")`,
      `cat("\\n--- Table 2: Component loadings (correlation-scaled) ---\\n")`,
      `print(round(load_mat, 3))`,
    )

    return lines.join('\n')
  },

  // seminr PLS-SEM: estimate_pls + bootstrap_model (serial-cluster shim — WASM has no PSOCK sockets).
  // Reliability raw order is alpha/rhoC/AVE/rhoA → printed reordered to α/ρ_A/CR/AVE.
  // Reflective = composite(..., weights = mode_A); formative = mode_B (weights + VIF, AVE suppressed).
  // Bootstrap CI = percentile (seminr default); indirect via specific_effect_significance.
  'pls-sem': (_spec, setup) => {
    const constructs: Construct[] = (setup.constructs ?? []) as Construct[]
    if (constructs.length === 0) return '# No constructs defined — nothing to run for PLS-SEM.'
    const byId = new Map(constructs.map((c) => [c.id, c.name]))
    const paths = setup.paths ?? []
    const nboot = Number(setup.options['nboot'] ?? 5000)

    const mmLines = constructs
      .map((c) => {
        const items = `c(${c.items.map((it) => `"${it}"`).join(', ')})`
        const wt = c.mode === 'formative' ? 'mode_B' : 'mode_A'
        return `  composite("${c.name}", ${items}, weights = ${wt})`
      })
      .join(',\n')
    const smLines = paths
      .map((p) => `  paths(from = "${byId.get(p.from) ?? p.from}", to = "${byId.get(p.to) ?? p.to}")`)
      .join(',\n')
    const formativeR = `c(${constructs.filter((c) => c.mode === 'formative').map((c) => `"${c.name}"`).join(', ')})`

    const lines: string[] = [
      '# ---- PLS-SEM via seminr (estimate_pls + bootstrap_model) ----',
      '# WebR/WASM has no PSOCK sockets — install the serial-cluster shim before seminr bootstraps.',
      MAKECLUSTER_SHIM,
      'library(seminr)',
      '',
      '# Measurement model (reflective = mode_A; formative = mode_B)',
      `mm <- constructs(`,
      mmLines,
      `)`,
      '',
      '# Structural model (paths by construct name)',
      `sm <- relationships(`,
      smLines,
      `)`,
      '',
      '# Estimate + bootstrap (percentile CI; serial cores under the shim)',
      'gc()',
      'pls <- estimate_pls(data = d, measurement_model = mm, structural_model = sm)',
      's <- summary(pls)',
      'set.seed(20260620)',
      `bo <- bootstrap_model(seminr_model = pls, nboot = ${nboot}, cores = 1)`,
      'sb <- summary(bo)',
      'gc()',
      '',
      '# Table 1: Outer model (loadings/weights + t/p)',
      'cat("\\n--- Table 1: Outer model ---\\n")',
      'print(round(sb$bootstrapped_loadings, 3))',
      'print(round(sb$bootstrapped_weights, 3))',
      '',
      '# Table 2: Reliability — raw seminr order alpha/rhoC/AVE/rhoA → display α / ρ_A / CR / AVE',
      'cat("\\n--- Table 2: Reliability & convergent validity (alpha / rhoA / rhoC=CR / AVE) ---\\n")',
      'rel <- s$reliability[, c("alpha", "rhoA", "rhoC", "AVE"), drop = FALSE]',
      `formative_names <- ${formativeR}`,
      'if (length(formative_names)) rel[rownames(rel) %in% formative_names, "AVE"] <- NA',
      'print(round(rel, 4))',
      '',
      '# Table 3: Discriminant validity (HTMT)',
      'cat("\\n--- Table 3: HTMT ---\\n")',
      'print(round(s$validity$htmt, 3))',
      '',
      '# Table 4: Structural paths (β + t/p + 95% CI + f²)',
      'cat("\\n--- Table 4: Structural paths ---\\n")',
      'print(round(sb$bootstrapped_paths, 4))',
      'cat("\\n--- f-squared ---\\n")',
      'print(round(s$fSquare, 4))',
      '',
      '# Table 5: Structural quality (R² / R²adj / Q²)',
      'cat("\\n--- Table 5: Structural quality (R^2 / AdjR^2) ---\\n")',
      'print(round(s$paths[c("R^2", "AdjR^2"), , drop = FALSE], 4))',
      '',
      '# Table 6: Indirect effects (specific_effect_significance over each mediated triple)',
      'cat("\\n--- Table 6: Indirect effects ---\\n")',
      'cn <- pls$constructs',
      'adj <- matrix(FALSE, length(cn), length(cn), dimnames = list(cn, cn))',
    ]
    paths.forEach((p) => {
      lines.push(`adj["${byId.get(p.from) ?? p.from}", "${byId.get(p.to) ?? p.to}"] <- TRUE`)
    })
    lines.push(
      'for (a in cn) for (z in cn) if (a != z) {',
      '  for (m in cn[adj[a, ] & adj[, z]]) {',
      '    sig <- tryCatch(specific_effect_significance(bo, from = a, through = m, to = z, alpha = 0.05),',
      '                    error = function(e) NULL)',
      '    if (!is.null(sig)) { cat(sprintf("  %s -> %s -> %s: ", a, m, z)); print(round(sig, 4)) }',
      '  }',
      '}',
      '',
      '# Figure: path diagram — semPaths stand-in (the app exports the annotated SVG via html-to-image)',
      'cat("\\n--- Figure: PLS path diagram (semPaths reproducible stand-in) ---\\n")',
      'tryCatch(print(plot(pls)), error = function(e) cat("(diagram skipped:", conditionMessage(e), ")\\n"))',
    )
    return lines.join('\n')
  },
}

export const latentPackages: Record<string, string[]> = {
  'ave': ['lavaan', 'semTools', 'psych', 'ggplot2'],
  'composite-reliability': ['lavaan', 'semTools', 'psych', 'ggplot2'],
  'cronbachs-alpha': ['psych', 'lavaan', 'semTools', 'ggplot2'],
  'efa': ['psych', 'ggplot2'],
  'pca': ['ggplot2'],
  'cb-sem': ['lavaan', 'semTools', 'psych', 'semPlot'],
  'pls-sem': ['seminr'],
}
