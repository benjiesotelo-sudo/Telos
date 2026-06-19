import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import { R_PARALLEL_ANALYSIS } from './parallelAnalysis'
import { orderFactors } from './factorOrder'

export interface EfaVarianceRow {
  factor: string
  eigenvalue: number
  pctVar: number
  cumPct: number
}

export interface EfaLoadingRow {
  item: string
  loadings: number[]
  communality: number
}

export interface EfaResult {
  kmo: number
  bartlettChisq: number
  bartlettDf: number
  bartlettP: number
  retain: number
  varianceExplained: EfaVarianceRow[]
  loadings: EfaLoadingRow[]
  phi: number[][] | null
  figScreePng: Uint8Array
  nCases: number
  rotation: string
  extraction: string
}

interface RawStats {
  kmo: number
  bartlettChisq: number
  bartlettDf: number
  bartlettP: number
  retain: number
  loadMat: number[]
  h2Vec: number[]
  ssPerFactor: number[]
  eigFactors: number[]
  pctVar: number[]
  cumulative: number[]
  phiMat: number[]
  simP95: number[]
  nCases: number
  nItems: number
}

function listwise(data: Dataset, items: string[]): Record<string, unknown>[] {
  return data.rows.filter((row) =>
    items.every((col) => typeof row[col] === 'number' && Number.isFinite(row[col] as number)),
  )
}

export async function runEfa(
  engine: Engine,
  data: Dataset,
  items: string[],
  opts: {
    extraction?: 'pa' | 'ml'
    rotation?: 'oblimin' | 'varimax'
    retention?: 'parallel' | 'kaiser' | 'fixed'
    nFactors?: number
    seed?: number
    nsim?: number
  } = {},
): Promise<EfaResult> {
  const extraction = opts.extraction ?? 'pa'
  const rotation = opts.rotation ?? 'oblimin'
  const retention = opts.retention ?? 'parallel'
  const nFactors = opts.nFactors ?? 1
  const seed = opts.seed ?? 20260619
  const nsim = opts.nsim ?? 500

  const rows = listwise(data, items)
  const n = rows.length
  const cols_flat = items.flatMap((col) => rows.map((r) => r[col] as number))

  // Build the full R block as a JS string (array-join avoids nested backtick issues with R_PARALLEL_ANALYSIS)
  const retentionBlock =
    retention === 'fixed'
      ? String(nFactors) + 'L'
      : retention === 'kaiser'
        ? '{ eig_obs <- eigen(R_cor, symmetric = TRUE, only.values = TRUE)$values; as.integer(sum(eig_obs > 1)) }'
        : '{ x <- as.matrix(d); nsim <- ' + nsim + 'L; seed <- ' + seed + 'L; kind <- "fa"\n' + R_PARALLEL_ANALYSIS + '\nas.integer(retain) }'

  const rBlock = [
    'library(psych)',
    'set.seed(' + seed + 'L)',
    'p <- length(items)',
    'd <- as.data.frame(lapply(seq_len(p), function(i) cols_flat[((i - 1) * n + 1):(i * n)]))',
    'colnames(d) <- items',
    '',
    '# Suitability',
    'R_cor <- cor(d)',
    'kmo_val <- as.numeric(psych::KMO(R_cor)$MSA)',
    'bart_obj <- psych::cortest.bartlett(R_cor, n = n)',
    'bart_chisq <- as.numeric(bart_obj$chisq)',
    'bart_df    <- as.integer(bart_obj$df)',
    'bart_p     <- as.numeric(bart_obj$p.value)',
    '',
    '# Retention: ' + retention,
    'k_retain <- ' + retentionBlock,
    'k_retain <- max(1L, k_retain)',
    '',
    '# EFA',
    'fm_method <- if ("' + extraction + '" == "ml") "ml" else "pa"',
    'fa_obj <- psych::fa(d, nfactors = k_retain, fm = fm_method, rotate = "' + rotation + '")',
    '',
    'load_mat <- unclass(fa_obj$loadings)',
    'h2_vec   <- as.numeric(fa_obj$communality)',
    'ss_per_factor <- colSums(load_mat^2)',
    'vaccounted <- fa_obj$Vaccounted',
    'pct_var    <- as.numeric(vaccounted["Proportion Var", ])',
    'cumulative <- as.numeric(vaccounted["Cumulative Var", ])',
    'eig_factors <- as.numeric(vaccounted["SS loadings", ])',
    'phi_mat <- if (!is.null(fa_obj$Phi)) fa_obj$Phi else NULL',
    '',
    '# Parallel analysis for scree figure (always run regardless of retention method)',
    '{',
    '  x2 <- as.matrix(d)',
    '  set.seed(' + seed + 'L)',
    '  n2 <- nrow(x2); p2 <- ncol(x2)',
    '  R2 <- cor(x2)',
    '  smc_v <- psych::smc(R2); smc_v <- pmin(pmax(smc_v, 0), 1); diag(R2) <- smc_v',
    '  obs2 <- sort(eigen(R2, symmetric = TRUE, only.values = TRUE)$values, decreasing = TRUE)',
    '  sim2 <- matrix(0, nrow = ' + nsim + 'L, ncol = p2)',
    '  for (i in seq_len(' + nsim + 'L)) {',
    '    rx <- matrix(rnorm(n2 * p2), n2, p2)',
    '    Rs <- cor(rx); sv <- psych::smc(Rs); sv <- pmin(pmax(sv, 0), 1); diag(Rs) <- sv',
    '    sim2[i, ] <- sort(eigen(Rs, symmetric = TRUE, only.values = TRUE)$values, decreasing = TRUE)',
    '  }',
    '  sim_p95_vec <- apply(sim2, 2, quantile, probs = 0.95)',
    '}',
    '',
    'list(',
    '  kmo           = kmo_val,',
    '  bartlettChisq = bart_chisq,',
    '  bartlettDf    = bart_df,',
    '  bartlettP     = bart_p,',
    '  retain        = k_retain,',
    '  loadMat       = as.numeric(load_mat),',
    '  h2Vec         = h2_vec,',
    '  ssPerFactor   = as.numeric(ss_per_factor),',
    '  eigFactors    = eig_factors,',
    '  pctVar        = pct_var,',
    '  cumulative    = cumulative,',
    '  phiMat        = if (!is.null(phi_mat)) as.numeric(phi_mat) else numeric(0),',
    '  simP95        = sim_p95_vec,',
    '  nCases        = n,',
    '  nItems        = p',
    ')',
  ].join('\n')

  const env = { cols_flat, items, n }
  const raw = await engine.runJson<RawStats>(rBlock, env)

  const k = raw.retain
  const p = raw.nItems

  const order = orderFactors(raw.ssPerFactor)

  const loadings: EfaLoadingRow[] = items.map((item, ri) => ({
    item,
    loadings: order.map((fi) => raw.loadMat[fi * p + ri]),
    communality: raw.h2Vec[ri],
  }))

  // Reorder variance explained; recalculate cumulative after reordering
  const varianceExplained: EfaVarianceRow[] = []
  let cumSum = 0
  for (let newIdx = 0; newIdx < k; newIdx++) {
    const fi = order[newIdx]
    cumSum += raw.pctVar[fi] * 100
    varianceExplained.push({
      factor: `F${newIdx + 1}`,
      eigenvalue: raw.eigFactors[fi],
      pctVar: raw.pctVar[fi] * 100,
      cumPct: cumSum,
    })
  }

  // Phi: reorder rows and columns; only for oblique rotation
  let phi: number[][] | null = null
  if (raw.phiMat.length === k * k && rotation !== 'varimax') {
    // phiMat is column-major k×k from R (as.numeric(phi_mat))
    phi = order.map((ri) => order.map((ci) => raw.phiMat[ci * k + ri]))
  }

  // Scree figure
  const screeBlock = [
    'library(psych)',
    'library(ggplot2)',
    'p <- length(items)',
    'd <- as.data.frame(lapply(seq_len(p), function(i) cols_flat[((i - 1) * n + 1):(i * n)]))',
    'colnames(d) <- items',
    'obs_eig <- sort(eigen(cor(d), symmetric = TRUE, only.values = TRUE)$values, decreasing = TRUE)',
    'n_obs <- length(obs_eig)',
    'df_plot <- data.frame(factor = seq_len(n_obs), observed = obs_eig, sim_p95 = sim_p95_vals)',
    'print(',
    '  ggplot2::ggplot(df_plot, ggplot2::aes(x = factor)) +',
    '  ggplot2::geom_line(ggplot2::aes(y = observed), colour = "#0c447c") +',
    '  ggplot2::geom_point(ggplot2::aes(y = observed), colour = "#0c447c", size = 2) +',
    '  ggplot2::geom_line(ggplot2::aes(y = sim_p95), colour = "#c0392b", linetype = "dashed") +',
    '  ggplot2::geom_point(ggplot2::aes(y = sim_p95), colour = "#c0392b", size = 1.5, shape = 21, fill = "white") +',
    '  ggplot2::geom_hline(yintercept = 1, linetype = "dotted", colour = "#888") +',
    '  ggplot2::labs(x = "Factor", y = "Eigenvalue", caption = "Solid: observed  ·  Dashed: parallel analysis 95th pct  ·  Dotted: eigenvalue = 1") +',
    '  ggplot2::theme_minimal(base_size = 11)',
    ')',
  ].join('\n')

  const figScreePng = await engine.capturePlot(screeBlock, 600, 400, {
    cols_flat,
    items,
    n,
    sim_p95_vals: raw.simP95,
  })

  return {
    kmo: raw.kmo,
    bartlettChisq: raw.bartlettChisq,
    bartlettDf: raw.bartlettDf,
    bartlettP: raw.bartlettP,
    retain: raw.retain,
    varianceExplained,
    loadings,
    phi,
    figScreePng,
    nCases: raw.nCases,
    rotation,
    extraction,
  }
}
