import type { Emitter } from './index'

// Latent variable / SEM family. Mirrors the stats modules' R verbatim — same calls, same design rationale.
// Convention (McNeish 2018): ω (McDonald's) is the headline coefficient; α (Cronbach's) is retained as secondary.
// NEVER call semTools::reliability() — deprecated 2022. Use compRelSEM() for ω/α-equivalent.

export const latentEmitters: Record<string, Emitter> = {
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
}

export const latentPackages: Record<string, string[]> = {
  'cronbachs-alpha': ['psych', 'lavaan', 'semTools', 'ggplot2'],
}
