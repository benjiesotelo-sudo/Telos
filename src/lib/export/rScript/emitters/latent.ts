import type { Emitter } from './index'
import type { TestSpec } from '../../../registry/types'
import type { Construct, StructuralPath, TestSetup } from '../../../../state/session'
import { MAKECLUSTER_SHIM } from '../../../webr/parallelShim'
import { R_SATURATED_PREDICATE } from '../../../stats/semSaturation'
import { lvNames } from '../../../stats/lvName'
import { buildModel } from '../../../stats/runCbSem'
import { moderationIndProdEnv, INDPROD_R, MODERATION_DISCLOSURE } from '../../../stats/moderationModel'
import { BC_CI_R } from '../../../stats/plsBcCi'
import { SIMPLE_SLOPES_PLOT_R } from '../../../stats/simpleSlopesPlot'

// Latent variable / SEM family. Mirrors the stats modules' R verbatim — same calls, same design rationale.
// Convention (McNeish 2018): ω (McDonald's) is the headline coefficient; α (Cronbach's) is retained as secondary.
// NEVER call semTools::reliability() — deprecated 2022. Use compRelSEM() for ω/α-equivalent.

/** Raw CSV column universe for the given SEM-family test id (before sanitizing) — the SAME domain each
 *  app-side runner uses for its own lvNames() call (cfaReliability.ts for ave/composite-reliability,
 *  runCbSem.ts for cb-sem/path-analysis, plsSem.ts for pls-sem, cronbachsAlpha.ts for cronbachs-alpha).
 *  Every other test id returns `[]`. This is the single place that knows "what counts as a raw column"
 *  per id — both latentRenameEntries below and emit.ts's cross-selection union call this, so there is
 *  exactly ONE definition of each id's domain (root-cause fix for U10: previously this list existed only
 *  implicitly, duplicated inline inside each emitter). */
export function latentItemDomain(id: string, setup: TestSetup, spec?: TestSpec): string[] {
  if (id === 'cronbachs-alpha' || id === 'efa') return [...new Set(setup.roles['items'] ?? [])]
  if (id === 'ave' || id === 'composite-reliability' || id === 'pls-sem') {
    const constructs = (setup.constructs ?? []) as { items: string[] }[]
    return [...new Set(constructs.flatMap((c) => c.items))]
  }
  if (id === 'cb-sem' || id === 'path-analysis') {
    const constructs = (setup.constructs ?? []) as { name: string; items: string[] }[]
    const isPath = setup.modelKind === 'path' || spec?.modelKind === 'path'
    return isPath ? [...new Set(constructs.map((c) => c.name))] : [...new Set(constructs.flatMap((c) => c.items))]
  }
  return []
}

/** Raw CSV column -> sanitized R-side token, for the readData() rename table. `globalMap` is the ONE
 *  lvNames() call over the union of every SEM-family id's domain across the WHOLE selection (built by
 *  emit.ts) — looked up here, never re-derived, so a raw column that collides with a different partner
 *  in another test's domain still resolves to the SAME safe token everywhere it's referenced (U10 fix:
 *  previously each id computed its OWN local lvNames() over its OWN domain, so the same raw column could
 *  sanitize to different tokens across two selected tests). Returns only entries that actually changed;
 *  an id with an empty domain (every non-SEM id) falls through to `[]` (readData() then no-ops, byte-
 *  identical script). For a lone selected test, its own domain IS the whole union, so this is byte-
 *  identical to sanitizing locally. */
export function latentRenameEntries(
  id: string,
  setup: TestSetup,
  spec: TestSpec | undefined,
  globalMap: Map<string, string>,
): [string, string][] {
  return latentItemDomain(id, setup, spec)
    .map((raw) => [raw, globalMap.get(raw) ?? raw] as [string, string])
    .filter(([raw, safe]) => raw !== safe)
}

/** Shared raw-column -> R-token lookup for every SEM-family emitter below. When `globalMap` is supplied
 *  (the real emitRScript path), every raw column is looked up in that ONE shared map instead of being
 *  re-sanitized from this emitter's own local `domain` — the fix for U10 (an emitter used to call
 *  lvNames() on its OWN item list, which drifts from a DIFFERENT selected test's sanitization of the
 *  same raw column when a collision partner exists in only one of the two domains). When no `globalMap`
 *  is supplied (an emitter invoked directly, outside emitRScript — every emitter unit test does this),
 *  falls back to deriving the map from `domain` alone: for a single test this is exactly what the global
 *  map reduces to anyway (its own domain IS the whole union), so both paths stay byte-identical. */
export function buildItemMap(domain: string[], globalMap?: Map<string, string>): (raw: string) => string {
  if (globalMap) return (raw) => globalMap.get(raw) ?? raw
  const safe = lvNames(domain)
  const localMap = new Map(domain.map((raw, i) => [raw, safe[i]]))
  return (raw) => localMap.get(raw) ?? raw
}

export const latentEmitters: Record<string, Emitter> = {
  // lavaan::cfa (multi-construct) + semTools::AVE/compRelSEM/htmt → convergent + discriminant validity.
  // NEVER call semTools::reliability() — deprecated 2022.
  // T1: Construct / AVE / CR / ω / α
  // T2: Fornell-Larcker matrix (√AVE diagonal; latent correlations off-diagonal)
  // T3: HTMT matrix
  // Figure: AVE / CR bar chart (ggplot2)
  'ave': (_spec, setup, _dataset, itemMap) => {
    const constructs: { name: string; items: string[] }[] = setup.constructs ?? []
    const k = constructs.length
    if (k === 0) return '# No constructs defined — nothing to run for AVE.'

    // Sanitized identifiers (lvNames) — display names with spaces are illegal lavaan `=~` tokens,
    // and every fitted object below is indexed by construct_names (same fix as cfaReliability.ts).
    const rNames = lvNames(constructs.map((c) => c.name))
    const constructNamesR = `c(${rNames.map((n) => `"${n}"`).join(', ')})`

    // Sanitized item identifiers — looked up in the shared selection-global map (falls back to a local
    // lvNames call across the full flattened+deduped item set, mirroring cfaReliability.ts's
    // runCfaReliability exactly, when this emitter is invoked directly without a global map).
    const allItems = [...new Set(constructs.flatMap((c) => c.items))]
    const itemNameOf = buildItemMap(allItems, itemMap)

    const modelLines = constructs.map((c, i) => `${rNames[i]} =~ ${c.items.map(itemNameOf).join(' + ')}`).join('\n')
    const constructItemsFlat = constructs.flatMap((c) => c.items.map(itemNameOf))
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
  'cronbachs-alpha': (_spec, setup, _dataset, itemMap) => {
    const items = setup.roles['items'] ?? []
    // Sanitized item identifiers — `items` below feeds a bare lavaan `=~` formula string (model <-
    // paste0("f =~ ", ...)), and R's read.csv() default check.names mangling means even the plain
    // `d[, items]` string index would miss a spaced column post-rename; looked up in the shared
    // selection-global map (falls back to cronbachsAlpha.ts's own lvNames(items) call exactly).
    const itemNameOf = buildItemMap(items, itemMap)
    const rItems = items.map(itemNameOf)
    const itemsR = `c(${rItems.map((v) => `"${v}"`).join(', ')})`
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
      // Axis labels use the RAW display names (items_display), never the sanitized lavaan-safe token
      // `items` — mirrors cronbachsAlpha.ts's R_FIG figEnv, which passes the original `items` param
      // (not its own sanitized rItems) for the exact same reason.
      const itemsDisplayR = `c(${items.map((v) => `"${v}"`).join(', ')})`
      lines.push(
        '',
        '# ---- Item-total bar chart ----',
        `items_display <- ${itemsDisplayR}`,
        `r_drop <- a_obj$item.stats$r.drop`,
        `d_plot <- data.frame(item = factor(items_display, levels = rev(items_display)), r = r_drop)`,
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
  'composite-reliability': (_spec, setup, _dataset, itemMap) => {
    const constructs: { name: string; items: string[] }[] = setup.constructs ?? []
    const k = constructs.length
    if (k === 0) return '# No constructs defined — nothing to run for Composite Reliability.'

    // Sanitized identifiers (lvNames) — same rationale as the 'ave' emitter above.
    const rNames = lvNames(constructs.map((c) => c.name))
    const constructNamesR = `c(${rNames.map((n) => `"${n}"`).join(', ')})`

    // Sanitized item identifiers — same shared-map rationale as 'ave' above.
    const allItems = [...new Set(constructs.flatMap((c) => c.items))]
    const itemNameOf = buildItemMap(allItems, itemMap)

    const modelLines = constructs.map((c, i) => `${rNames[i]} =~ ${c.items.map(itemNameOf).join(' + ')}`).join('\n')
    const constructItemsFlat = constructs.flatMap((c) => c.items.map(itemNameOf))
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
  'efa': (_spec, setup, _dataset, itemMap) => {
    const items: string[] = setup.roles['items'] ?? []
    if (items.length < 3) return '# Need ≥ 3 items for EFA.'
    // Sanitized item identifiers: no formula string here, but R's read.csv() default check.names
    // mangling means even this plain `d[, items]` string index would miss a spaced column post-rename
    // (colnames(d) is renamed to the sanitized token by readData(), never left as the raw display name).
    // Looked up in the shared selection-global map (falls back to a local lvNames call otherwise).
    const itemNameOf = buildItemMap(items, itemMap)
    const itemsR = `c(${items.map((v) => `"${itemNameOf(v)}"`).join(', ')})`
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

  // lavaan::sem from constructs (=~) + structural paths (~) + auto := indirect defs + latent moderation
  // (interaction construct + := simple slopes, design §A7/U5-T4). buildModel is the SAME function
  // runCbSem.ts calls — one source of truth for the full model string, so export ≡ app without
  // re-deriving any model-assembly logic here.
  // Single bootstrap fit for mediation/moderation (percentile + bias-corrected CI from the SAME draws,
  // design D7/D10/§A2/§A7 — no RNG chunking). Diagram = semPlot::semPaths.
  // Fit table suppressed strictly when fitMeasures(fit,"df") == 0 (shared df==0 predicate; design §3.6/§5.1).
  'cb-sem': (spec, setup, _dataset, itemMap) => {
    const constructs: { id: number; name: string; items: string[] }[] =
      (setup.constructs as { id: number; name: string; items: string[] }[]) ?? []
    const paths: { from: number; to: number }[] =
      (setup.paths as { from: number; to: number }[]) ?? []
    // Path mode (observed-only): from the setup OR the spec (path-analysis reuses this emitter, spec.modelKind='path').
    const isPath = setup.modelKind === 'path' || spec?.modelKind === 'path'
    if (constructs.length === 0) return '# No constructs defined — nothing to run for CB-SEM.'

    // Sanitized lavaan identifiers per construct (display names with spaces are illegal `=~`/`~` tokens)
    // — the SAME lvNames the app runner (runCbSem.ts) uses, so export ≡ app. In LATENT mode these are
    // pure model-internal labels that never touch an actual CSV column, so no cross-test consistency
    // need (kept local, like before). In PATH mode the construct "names" themselves ARE the observed CSV
    // columns (mirrors runCbSem.ts's usedCols) — routed through the shared selection-global map like
    // every other SEM-family raw column, so two selected path-mode tests never collide on the same fix
    // this file applies everywhere else (U10).
    const nameDomain = [...new Set(constructs.map((c) => c.name))]
    const nameOf = buildItemMap(nameDomain, isPath ? itemMap : undefined)
    const rNameById = new Map(constructs.map((c) => [c.id, nameOf(c.name)]))
    const rNameOf = (id: number) => rNameById.get(id)!
    const nboot = Number(setup.options['nboot'] ?? 5000)
    const moderations = setup.moderations ?? []

    // Sanitized item identifiers (latent mode only — path mode's "items" are each construct's own raw
    // name, already carried by rNameOf/the readData() rename above) — mirrors runCbSem.ts's
    // usedCols/itemNameOf exactly, looked up in the shared selection-global map.
    const usedCols = isPath ? [] : [...new Set(constructs.flatMap((c) => c.items))]
    const itemNameOf = buildItemMap(usedCols, itemMap)

    // Model text (measurement + structural + auto indirect defs + moderation, already spliced onto its
    // target's structural line) + moderationDefs (needed for the indProd data-prep block below). Guards
    // (self/duplicate/path-mode) live in validateModerations, called by buildModel itself — a bad
    // moderation setup throws here exactly like it would in the app runner, never reaching a bad script.
    const { model, hasIndirect, moderationDefs } = buildModel(constructs, paths, isPath, rNameOf, moderations, itemNameOf)
    const hasModeration = moderationDefs.length > 0
    // Moderation ALWAYS bootstraps (design §A7), independent of any indirect-effect chain — same widened
    // gate as runCbSem.ts's `needsBootstrap` (Task 4.4).
    const needsBootstrap = hasIndirect || hasModeration
    const modelR = model.replace(/\n/g, '\\n')

    const out: string[] = [
      '# ---- CB-SEM via lavaan::sem (measurement + structural + indirect + moderation) ----',
      `model_str <- "${modelR}"`,
    ]

    // Latent moderation (design §A7): indProd double-mean-centered product-indicator columns, built
    // BEFORE the fit. model_str above already carries the interaction construct + := simple-slope defs
    // (assembled by the SAME buildModel() the WebR runner uses); this block only builds the data.
    if (hasModeration) {
      const env = moderationIndProdEnv(moderationDefs)
      out.push(
        '',
        '# ---- Latent moderation: indProd double-mean-centering data prep ----',
        `mod_ids <- c(${env.mod_ids.join(', ')})`,
        `mod_var1_flat <- c(${env.mod_var1_flat.map((s) => `"${s}"`).join(', ')})`,
        `mod_var1_lens <- c(${env.mod_var1_lens.join(', ')})`,
        `mod_var2_flat <- c(${env.mod_var2_flat.map((s) => `"${s}"`).join(', ')})`,
        `mod_var2_lens <- c(${env.mod_var2_lens.join(', ')})`,
        `mod_matched <- c(${env.mod_matched.map((b) => (b ? 'TRUE' : 'FALSE')).join(', ')})`,
        INDPROD_R,
      )
      if (moderationDefs.some((d) => !d.matched)) out.push(`# ${MODERATION_DISCLOSURE}`)
    }

    out.push(
      '',
      '# Single awaited bootstrap fit for mediation/moderation (no RNG chunking — preserves WebR≡native parity).',
      'gc()',
      'set.seed(20260620)',
    )
    if (needsBootstrap) {
      out.push(
        `fit <- lavaan::sem(model_str, data = d, se = "bootstrap", bootstrap = ${nboot})`,
        '# Dual CI (percentile + bias-corrected) from the SAME bootstrap draws — both recompute CIs off',
        '# fit@boot without re-running the bootstrap (design §A2; matches runCbSem.ts exactly).',
        'pe_perc <- lavaan::parameterEstimates(fit, boot.ci.type = "perc", level = 0.95)',
        'pe_bc   <- lavaan::parameterEstimates(fit, boot.ci.type = "bca.simple", level = 0.95)',
        'pe <- pe_perc',
      )
    } else {
      out.push(
        'fit <- lavaan::sem(model_str, data = d)',
        'pe  <- lavaan::parameterEstimates(fit, level = 0.95)',
        '# No bootstrap -> no BC column; keep pe_bc shaped the same as pe but with the CI blanked out',
        '# (never fabricate a bias-corrected interval that was never bootstrapped).',
        'pe_bc <- pe; pe_bc$ci.lower <- NA_real_; pe_bc$ci.upper <- NA_real_',
      )
    }
    out.push(
      'gc()',
      'ss <- lavaan::standardizedSolution(fit)',
      '',
      '# Row alignment by (lhs, rhs) key WITHIN an op-filtered subset, never by row position -- pe/pe_bc',
      '# are TWO separate parameterEstimates() calls (perc vs bca.simple); the moderation spike (docs/',
      '# superpowers/reviews/2026-07-06-moderation-spike.md §5.3) found position drift is not safe to',
      '# assume across them. Scoped to a single op (e.g. "~") so the key is unique -- keying the FULL',
      '# table would collide on every unlabeled row (label == "" for most non-structural parameters).',
      'pair_key <- function(dfr) paste(dfr$lhs, dfr$rhs, sep = "\\u0001")',
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
      '# Shared predicate: byte-identical to the app screen (src/lib/stats/semSaturation.ts R_SATURATED_PREDICATE).',
      `if (!(${R_SATURATED_PREDICATE})) {`,
      '  fm <- lavaan::fitMeasures(fit, c("chisq","df","pvalue","cfi","tli","rmsea",',
      '                                   "rmsea.ci.lower","rmsea.ci.upper","srmr"))',
      '  cat("\\n--- Table 5: Fit indices ---\\n")',
      '  print(round(fm, 3))',
      '} else {',
      '  cat("\\n--- Model is saturated (df = 0): fit indices not reported ---\\n")',
      '}',
      '',
      '# ---- Table 6: Structural paths (B / SE / z / p / std.β + dual 95% CI: percentile & bias-corrected) ----',
      '# Scoped to the DRAWN paths\' own p_<from>_<to> labels (buildModel labels every drawn structural path',
      '# this way, and ONLY those) -- matches runCbSem.ts\'s struct_rows, which iterates the drawn path_from/',
      '# path_to arrays rather than filtering by bare op == "~".',
      ...(hasModeration
        ? [
            '# Moderation note: bare `op == "~"` would ALSO match the interaction row (already reported in',
            '# Table 8) and, when the moderator is not itself a drawn path, an auto-injected moderator',
            '# main-effect covariate row that the app never surfaces anywhere -- this scoping excludes both,',
            '# mirroring the app exactly (that covariate is part of the fitted model but reported in no table).',
          ]
        : []),
      'pe_reg <- pe[pe$op == "~" & grepl("^p_", pe$label), ]',
      'pe_bc_reg <- pe_bc[pe_bc$op == "~" & grepl("^p_", pe_bc$label), ]',
      'ss_reg <- ss[ss$op == "~" & grepl("^p_", ss$label), ]',
      'reg_key <- pair_key(pe_reg)',
      'rownames(pe_bc_reg) <- pair_key(pe_bc_reg); rownames(ss_reg) <- pair_key(ss_reg)',
      'struct_tab <- data.frame(',
      '  lhs = pe_reg$lhs, rhs = pe_reg$rhs, label = pe_reg$label,',
      '  est = pe_reg$est, se = pe_reg$se, z = pe_reg$z, pvalue = pe_reg$pvalue,',
      '  std = ss_reg[reg_key, "est.std"],',
      '  perc.lower = pe_reg$ci.lower, perc.upper = pe_reg$ci.upper,',
      '  bc.lower = pe_bc_reg[reg_key, "ci.lower"], bc.upper = pe_bc_reg[reg_key, "ci.upper"]',
      ')',
      'cat("\\n--- Table 6: Structural paths ---\\n")',
      'print(struct_tab)',
      'cat("\\n--- R-square (endogenous) ---\\n")',
      'print(round(lavInspect(fit, "rsquare"), 3))',
    )

    if (hasIndirect) {
      out.push(
        '',
        '# ---- Table 7: Indirect effects (bootstrap percentile + bias-corrected 95% CI) ----',
        '# := defs have no free-parameter label -- their lhs (e.g. "ie_1_2_3") is itself the unique key.',
        'pe_def <- pe[pe$op == ":=" & grepl("^ie_", pe$lhs), ]',
        'pe_bc_def <- pe_bc[pe_bc$op == ":=" & grepl("^ie_", pe_bc$lhs), ]',
        'rownames(pe_bc_def) <- pe_bc_def$lhs',
        'indirect_tab <- data.frame(',
        '  lhs = pe_def$lhs, est = pe_def$est, se = pe_def$se, pvalue = pe_def$pvalue,',
        '  perc.lower = pe_def$ci.lower, perc.upper = pe_def$ci.upper,',
        '  bc.lower = pe_bc_def[pe_def$lhs, "ci.lower"], bc.upper = pe_bc_def[pe_def$lhs, "ci.upper"]',
        ')',
        'cat("\\n--- Table 7: Indirect effects ---\\n")',
        'print(indirect_tab)',
      )
    }

    if (hasModeration) {
      out.push(
        '',
        '# ---- Table 8: Moderation (interaction-term B / SE / z / p / std.β + dual 95% CI) ----',
        'pe_mod <- pe[pe$op == "~" & grepl("^INT_", pe$rhs), ]',
        'pe_bc_mod <- pe_bc[pe_bc$op == "~" & grepl("^INT_", pe_bc$rhs), ]',
        'ss_mod <- ss[ss$op == "~" & grepl("^INT_", ss$rhs), ]',
        'mod_key <- pair_key(pe_mod)',
        'rownames(pe_bc_mod) <- pair_key(pe_bc_mod); rownames(ss_mod) <- pair_key(ss_mod)',
        'mod_tab <- data.frame(',
        '  lhs = pe_mod$lhs, rhs = pe_mod$rhs, label = pe_mod$label,',
        '  est = pe_mod$est, se = pe_mod$se, z = pe_mod$z, pvalue = pe_mod$pvalue,',
        '  std = ss_mod[mod_key, "est.std"],',
        '  perc.lower = pe_mod$ci.lower, perc.upper = pe_mod$ci.upper,',
        '  bc.lower = pe_bc_mod[mod_key, "ci.lower"], bc.upper = pe_bc_mod[mod_key, "ci.upper"]',
        ')',
        'cat("\\n--- Table 8: Moderation ---\\n")',
        'print(mod_tab)',
        '',
        '# ---- Table 9: Conditional effects (simple slopes at -1SD/mean/+1SD, percentile 95% CI) ----',
        '# Percentile CI only (binding contract, matches the app\'s conditional-effects table exactly).',
        'slope_tab <- pe[pe$op == ":=" & grepl("^slope_", pe$lhs), c("lhs", "est", "se", "pvalue", "ci.lower", "ci.upper")]',
        'names(slope_tab)[names(slope_tab) == "ci.lower"] <- "perc.lower"',
        'names(slope_tab)[names(slope_tab) == "ci.upper"] <- "perc.upper"',
        'cat("\\n--- Table 9: Conditional effects (simple slopes) ---\\n")',
        'print(slope_tab)',
      )
    }

    out.push(
      '',
      '# ---- Figure: path diagram (reproducible stand-in for the app-drawn annotated SVG) ----',
      'semPlot::semPaths(fit, what = "std", layout = "tree", edge.label.cex = 0.9,',
      '                  nodeLabels = NULL, residuals = FALSE, intercepts = FALSE)',
      '',
    )
    out.push(
      ...(hasModeration
        ? [
            '# Note: semPaths draws the interaction construct\'s own path like any other structural path (no',
            '# distinct "moderation" edge style) -- this is the closest reproducible native-R rendering; the app\'s',
            '# live canvas draws it as a dashed clay arrow (see figure_path-diagram.png from the app export).',
          ]
        : [
            '# Note: this is the closest reproducible native-R rendering of the path diagram; the app\'s live',
            '# canvas draws the same structural paths (see figure_path-diagram.png from the app export).',
          ]),
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
  // U6 reshape parity (mirrors buildPlsSem.ts / runPlsSem.ts EXACTLY, same table numbering as the app card):
  //   Table 1: Measurement model (merged construct alpha/rhoA/CR/AVE + per-item mean/sd/loading-or-weight/t/p)
  //   Table 2: HTMT
  //   Table 3: Structural paths (β + t/p + dual 95% CI - percentile from seminr + hand-rolled BC via BC_CI_R)
  //   Table 4: Structural quality (R² / R²adj / Q²_predict)
  //   Table 5: Indirect effects
  //   Table 6: Conditional effects (simple slopes) - only when a moderation edge is present
  // Latent moderation (U6-T4/T5): seminr's interaction_term(iv=, moderator=, method=two_stage) is spliced
  // into the SAME constructs()/relationships() calls as an ordinary construct + path (mirrors plsSem.ts's
  // TS assembly verbatim - no item-level product-indicator bookkeeping the way CB-SEM's indProd needs).
  'pls-sem': (_spec, setup, _dataset, itemMap) => {
    const constructs: Construct[] = (setup.constructs ?? []) as Construct[]
    if (constructs.length === 0) return '# No constructs defined — nothing to run for PLS-SEM.'
    const byId = new Map(constructs.map((c) => [c.id, c.name]))
    const paths: StructuralPath[] = (setup.paths ?? []) as StructuralPath[]
    const nboot = Number(setup.options['nboot'] ?? 5000)
    const fromName = (id: number) => byId.get(id) ?? String(id)

    // Sanitized item identifiers — mirrors plsSem.ts's allItems/itemMap exactly, looked up in the shared
    // selection-global map. seminr's composite() item strings are string literals, not R identifiers,
    // but they must still match `colnames(d)` (renamed to the sanitized token by readData()) exactly, so
    // a raw item with a space would otherwise silently miss the data frame's actual column.
    const allItems = [...new Set(constructs.flatMap((c) => c.items))]
    const itemNameOf = buildItemMap(allItems, itemMap)

    const constructLines = constructs.map((c) => {
      const items = `c(${c.items.map((it) => `"${itemNameOf(it)}"`).join(', ')})`
      const wt = c.mode === 'formative' ? 'mode_B' : 'mode_A'
      return `  composite("${c.name}", ${items}, weights = ${wt})`
    })
    const pathLines = paths.map((p) => `  paths(from = "${fromName(p.from)}", to = "${fromName(p.to)}")`)
    const formativeR = `c(${constructs.filter((c) => c.mode === 'formative').map((c) => `"${c.name}"`).join(', ')})`

    // Moderation (U6-T4): same {ivName, modName, interaction-name, target} derivation as runPlsSem.ts -
    // the moderated path's source construct is the iv, m.moderatorId resolves to the moderator, and
    // seminr's literal "{iv}*{moderator}" naming convention needs no TS-side scheme of its own.
    const moderations = setup.moderations ?? []
    const modInteractions = moderations.map((m) => {
      const p = paths[m.pathIndex]
      const ivName = fromName(p.from)
      const modName = fromName(m.moderatorId)
      return { ivName, modName, name: `${ivName}*${modName}`, targetName: fromName(p.to) }
    })
    const hasModeration = modInteractions.length > 0
    if (hasModeration) {
      constructLines.push(
        ...modInteractions.map(
          ({ ivName, modName }) =>
            `  interaction_term(iv = "${ivName}", moderator = "${modName}", method = two_stage, weights = mode_A)`,
        ),
      )
      pathLines.push(...modInteractions.map(({ name, targetName }) => `  paths(from = "${name}", to = "${targetName}")`))
    }

    const lines: string[] = [
      '# ---- PLS-SEM via seminr (estimate_pls + bootstrap_model) ----',
      '# WebR/WASM has no PSOCK sockets — install the serial-cluster shim before seminr bootstraps.',
      MAKECLUSTER_SHIM,
      'library(seminr)',
      '',
      '# Hand-rolled z0-adjusted percentile BC (U6-T3) - reused verbatim from the lavaan-verified text',
      '# (src/lib/stats/plsBcCi.ts); seminr has no built-in bca.simple, so bc_ci() runs here against',
      '# bo$boot_paths\' raw draws (a [from, to, boot_index] 3D array).',
      BC_CI_R,
      '',
      '# Measurement model (reflective = mode_A; formative = mode_B)',
      `mm <- constructs(`,
      constructLines.join(',\n'),
      `)`,
      '',
      '# Structural model (paths by construct name)',
      `sm <- relationships(`,
      pathLines.join(',\n'),
      `)`,
      '',
      ...(hasModeration
        ? [
            '# Moderation (U6-T4): interaction_term construct(s) added to the measurement model above.',
            ...modInteractions.map(
              ({ ivName, modName }) =>
                `cat("interaction_term(iv = \\"${ivName}\\", moderator = \\"${modName}\\", method = two_stage)\\n")`,
            ),
            '',
          ]
        : []),
      '# Estimate + bootstrap (percentile CI; serial cores under the shim)',
      'gc()',
      'pls <- estimate_pls(data = d, measurement_model = mm, structural_model = sm)',
      's <- summary(pls)',
      'set.seed(20260620)',
      `bo <- bootstrap_model(seminr_model = pls, nboot = ${nboot}, cores = 1)`,
      'sb <- summary(bo)',
      'gc()',
      '',
      "# The DRAWN construct names only - excludes seminr's derived interaction construct (no meaningful",
      '# alpha/AVE/HTMT/outer rows; its structural row still flows through the path loop below).',
      `construct_names <- c(${constructs.map((c) => `"${c.name}"`).join(', ')})`,
      `formative_names <- ${formativeR}`,
      '',
      '# ---- Table 1: Measurement model (construct alpha/rhoA/CR/AVE + item mean/sd/loading-or-weight/t/p) ----',
      '# Raw seminr reliability order is alpha/rhoC/AVE/rhoA - reordered here to the display tuple.',
      'rel <- s$reliability[, c("alpha", "rhoA", "rhoC", "AVE"), drop = FALSE]',
      'if (length(formative_names)) rel[rownames(rel) %in% formative_names, "AVE"] <- NA',
      'cat("\\n--- Table 1: Measurement model ---\\n")',
      'for (nm in construct_names) {',
      '  is_form <- nm %in% formative_names',
      '  cat(sprintf("%s: alpha=%.3f rhoA=%.3f CR=%.3f AVE=%s\\n",',
      '              nm, rel[nm, "alpha"], rel[nm, "rhoA"], rel[nm, "rhoC"],',
      '              if (is_form) "NA" else sprintf("%.3f", rel[nm, "AVE"])))',
      '  items_nm <- pls$mmMatrix[pls$mmMatrix[, "construct"] == nm, "measurement"]',
      '  for (it in items_nm) {',
      '    key <- paste0(it, "  ->  ", nm)',
      '    m <- mean(d[[it]], na.rm = TRUE); sdv <- sd(d[[it]], na.rm = TRUE)',
      '    if (is_form) {',
      '      w <- as.numeric(sb$bootstrapped_weights[key, "Original Est."])',
      '      tval <- as.numeric(sb$bootstrapped_weights[key, "T Stat."])',
      '      cat(sprintf("  %s: weight=%.3f t=%.3f p=%.4f mean=%.3f sd=%.3f\\n",',
      '                  it, w, tval, 2 * pnorm(-abs(tval)), m, sdv))',
      '    } else {',
      '      l <- as.numeric(sb$bootstrapped_loadings[key, "Original Est."])',
      '      tval <- as.numeric(sb$bootstrapped_loadings[key, "T Stat."])',
      '      cat(sprintf("  %s: loading=%.3f t=%.3f p=%.4f mean=%.3f sd=%.3f\\n",',
      '                  it, l, tval, 2 * pnorm(-abs(tval)), m, sdv))',
      '    }',
      '  }',
      '}',
      '',
      '# ---- Table 2: HTMT ----',
      'cat("\\n--- Table 2: HTMT ---\\n")',
      'print(round(s$validity$htmt[construct_names, construct_names, drop = FALSE], 3))',
      '',
      '# ---- Table 3: Structural paths (β + t/p + dual 95% CI: percentile & hand-rolled BC) ----',
      'bp <- sb$bootstrapped_paths',
      'fsq <- s$fSquare',
    ]

    const pathFromNames = [...paths.map((p) => fromName(p.from)), ...modInteractions.map((m) => m.name)]
    const pathToNames = [...paths.map((p) => fromName(p.to)), ...modInteractions.map((m) => m.targetName)]
    lines.push(
      `path_from_all <- c(${pathFromNames.map((n) => `"${n}"`).join(', ')})`,
      `path_to_all   <- c(${pathToNames.map((n) => `"${n}"`).join(', ')})`,
      'struct_beta <- numeric(length(path_from_all)); struct_t <- numeric(length(path_from_all))',
      'struct_p <- numeric(length(path_from_all))',
      'struct_perc_lo <- numeric(length(path_from_all)); struct_perc_hi <- numeric(length(path_from_all))',
      'struct_bc_lo <- numeric(length(path_from_all)); struct_bc_hi <- numeric(length(path_from_all))',
      'for (e in seq_along(path_from_all)) {',
      '  fr <- path_from_all[e]; to <- path_to_all[e]',
      '  key <- paste0(fr, "  ->  ", to)',
      '  beta_e <- as.numeric(bp[key, "Original Est."])',
      '  tval_e <- as.numeric(bp[key, "T Stat."])',
      '  bcc <- bc_ci(bo$boot_paths[fr, to, ], beta_e)',
      '  struct_beta[e] <- beta_e; struct_t[e] <- tval_e; struct_p[e] <- 2 * pnorm(-abs(tval_e))',
      '  struct_perc_lo[e] <- as.numeric(bp[key, "2.5% CI"]); struct_perc_hi[e] <- as.numeric(bp[key, "97.5% CI"])',
      '  struct_bc_lo[e] <- as.numeric(bcc[1]); struct_bc_hi[e] <- as.numeric(bcc[2])',
      '}',
      'struct_tab <- data.frame(',
      '  h = paste0("H", seq_along(path_from_all)),',
      '  path = paste(path_from_all, "->", path_to_all),',
      '  beta = struct_beta, t = struct_t, pvalue = struct_p,',
      '  perc.lower = struct_perc_lo, perc.upper = struct_perc_hi,',
      '  bc.lower = struct_bc_lo, bc.upper = struct_bc_hi',
      ')',
      'cat("\\n--- Table 3: Structural paths ---\\n")',
      'print(struct_tab)',
      '',
      '# ---- Table 4: Structural quality (R² / R²adj / Q²_predict) ----',
      'paths_tbl <- s$paths',
      'endo <- colnames(paths_tbl)',
      'set.seed(20260620)',
      'q2_pred <- tryCatch({',
      '  pp <- predict_pls(pls)',
      '  sp <- summary(pp)',
      '  1 - sp$PLS_out_of_sample["RMSE", ]^2 / sp$LM_out_of_sample["RMSE", ]^2',
      '}, error = function(e) NULL)',
      'quality_tab <- data.frame(',
      '  construct = endo,',
      '  r2 = as.numeric(paths_tbl["R^2", endo]), r2adj = as.numeric(paths_tbl["AdjR^2", endo]),',
      '  q2 = sapply(endo, function(nm) {',
      '    if (is.null(q2_pred)) return(NA)',
      '    its <- pls$mmMatrix[pls$mmMatrix[, "construct"] == nm, "measurement"]',
      '    its <- its[its %in% names(q2_pred)]',
      '    if (length(its)) mean(q2_pred[its]) else NA',
      '  })',
      ')',
      'cat("\\n--- Table 4: Structural quality (R^2 / AdjR^2 / Q^2_predict) ---\\n")',
      'print(round(quality_tab[, c("r2", "r2adj", "q2")], 4))',
      '',
      '# ---- Table 5: Indirect effects (specific_effect_significance over each mediated triple) ----',
      '# Interaction edges are skipped: the interaction construct is not a dimname of adj and never',
      '# participates in a mediation chain (no incoming paths) - matches plsSem.ts\'s R block exactly.',
      'cat("\\n--- Table 5: Indirect effects ---\\n")',
      'k_cn <- length(construct_names)',
      'adj <- matrix(FALSE, k_cn, k_cn, dimnames = list(construct_names, construct_names))',
    )
    paths.forEach((p) => {
      lines.push(`adj["${fromName(p.from)}", "${fromName(p.to)}"] <- TRUE`)
    })
    lines.push(
      'for (a in construct_names) for (z in construct_names) if (a != z) {',
      '  for (m in construct_names[adj[a, ] & adj[, z]]) {',
      '    sig <- tryCatch(specific_effect_significance(bo, from = a, through = m, to = z, alpha = 0.05),',
      '                    error = function(e) NULL)',
      '    if (!is.null(sig)) { cat(sprintf("  %s -> %s -> %s: ", a, m, z)); print(round(sig, 4)) }',
      '  }',
      '}',
    )

    if (hasModeration) {
      lines.push(
        '',
        '# ---- Table 6: Conditional effects (simple slopes at -1SD/mean/+1SD, percentile 95% CI) ----',
        '# Same derivation as plsSem.ts\'s R block: mod_sd is the moderator\'s OBSERVED composite-score SD',
        '# (Aiken & West 1991 applied to the composite/summed-indicator metric); levels are fixed at the',
        '# original mod_sd for every bootstrap draw (draws differ only in the main/interaction path terms).',
        `mod_iv_name <- c(${modInteractions.map((m) => `"${m.ivName}"`).join(', ')})`,
        `mod_name    <- c(${modInteractions.map((m) => `"${m.modName}"`).join(', ')})`,
        `mod_int_name <- c(${modInteractions.map((m) => `"${m.name}"`).join(', ')})`,
        `mod_target_name <- c(${modInteractions.map((m) => `"${m.targetName}"`).join(', ')})`,
        'slope_levels <- character(0); slope_mods <- character(0)',
        'slope_bs <- numeric(0); slope_los <- numeric(0); slope_his <- numeric(0)',
        'cat("\\n--- Table 6: Conditional effects (simple slopes) ---\\n")',
        'for (mi in seq_along(mod_iv_name)) {',
        '  mod_sd <- stats::sd(pls$construct_scores[, mod_name[mi]])',
        '  key_main <- paste0(mod_iv_name[mi], "  ->  ", mod_target_name[mi])',
        '  key_int  <- paste0(mod_int_name[mi], "  ->  ", mod_target_name[mi])',
        '  b_main <- as.numeric(bp[key_main, "Original Est."])',
        '  b_int  <- as.numeric(bp[key_int, "Original Est."])',
        '  main_draws <- bo$boot_paths[mod_iv_name[mi], mod_target_name[mi], ]',
        '  int_draws  <- bo$boot_paths[mod_int_name[mi], mod_target_name[mi], ]',
        '  levels <- c("-1SD" = -mod_sd, "mean" = 0, "+1SD" = mod_sd)',
        '  for (lvl_name in names(levels)) {',
        '    lvl <- levels[[lvl_name]]',
        '    draws <- main_draws + int_draws * lvl',
        '    se <- stats::sd(draws)',
        '    qs <- stats::quantile(draws, probs = c(0.025, 0.975))',
        '    b_lvl <- b_main + b_int * lvl',
        '    p_lvl <- 2 * min(mean(draws <= 0), mean(draws > 0))', // Same bootstrap-proportion p as plsSem.ts's app-side slope runner (matches exactly, no normal-theory approximation).
        '    cat(sprintf("  %s (%s): b=%.6f se=%.6f p=%.6f ci=[%.6f, %.6f]\\n",',
        '                mod_int_name[mi], lvl_name, b_lvl, se, p_lvl, qs[1], qs[2]))',
        '    slope_levels <- c(slope_levels, lvl_name); slope_mods <- c(slope_mods, mod_int_name[mi])',
        '    slope_bs <- c(slope_bs, b_lvl); slope_los <- c(slope_los, as.numeric(qs[1])); slope_his <- c(slope_his, as.numeric(qs[2]))',
        '  }',
        '}',
        '',
        '# ---- Figure: whiskered simple-slopes plot (same R text as simpleSlopesPlot.ts - export = app) ----',
        'levels <- slope_levels; mods <- slope_mods; bs <- slope_bs; los <- slope_los; his <- slope_his',
        SIMPLE_SLOPES_PLOT_R,
      )
    }

    lines.push(
      '',
      '# Figure: path diagram — semPaths stand-in (the app exports the annotated SVG via html-to-image)',
      'cat("\\n--- Figure: PLS path diagram (semPaths reproducible stand-in) ---\\n")',
      'tryCatch(print(plot(pls)), error = function(e) cat("(diagram skipped:", conditionMessage(e), ")\\n"))',
    )
    return lines.join('\n')
  },
}

// Path analysis = observed-only CB-SEM: same emitter (the cb-sem branch keys off setup.modelKind === 'path',
// which path-analysis always carries) and same R packages. Aliased so emitRScript resolves EMITTERS['path-analysis'].
latentEmitters['path-analysis'] = latentEmitters['cb-sem']

export const latentPackages: Record<string, string[]> = {
  'ave': ['lavaan', 'semTools', 'psych', 'ggplot2'],
  'composite-reliability': ['lavaan', 'semTools', 'psych', 'ggplot2'],
  'cronbachs-alpha': ['psych', 'lavaan', 'semTools', 'ggplot2'],
  'efa': ['psych', 'ggplot2'],
  'pca': ['ggplot2'],
  'cb-sem': ['lavaan', 'semTools', 'psych', 'semPlot'],
  'pls-sem': ['seminr', 'ggplot2'],
  'path-analysis': ['lavaan', 'semTools', 'psych', 'semPlot'],
}
