import type { Emitter } from './index'

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
}

export const latentPackages: Record<string, string[]> = {
  'ave': ['lavaan', 'semTools', 'psych', 'ggplot2'],
  'composite-reliability': ['lavaan', 'semTools', 'psych', 'ggplot2'],
  'cronbachs-alpha': ['psych', 'lavaan', 'semTools', 'ggplot2'],
}
