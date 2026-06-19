import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import { R_PARALLEL_ANALYSIS } from './parallelAnalysis'

export interface PcaVarianceRow {
  component: string
  eigenvalue: number
  pctVar: number
  cumPct: number
}

export interface PcaLoadingRow {
  variable: string
  loadings: number[] // correlation-scaled (eigenvector × sqrt(eigenvalue)), length = retain
}

export interface PcaResult {
  retain: number
  varianceExplained: PcaVarianceRow[]
  loadings: PcaLoadingRow[]
  figScreePng: Uint8Array
  nCases: number
}

interface RawStats {
  retain: number
  eigenvalues: number[]
  pctVar: number[]
  cumulative: number[]
  loadMat: number[] // column-major: p rows × p cols (all components); correlation-scaled
  simP95: number[]
  nCases: number
  nVars: number
}

function listwise(data: Dataset, variables: string[]): Record<string, unknown>[] {
  return data.rows.filter((row) =>
    variables.every((col) => typeof row[col] === 'number' && Number.isFinite(row[col] as number)),
  )
}

export async function runPca(
  engine: Engine,
  data: Dataset,
  variables: string[],
  opts: {
    retention?: 'parallel' | 'kaiser' | 'fixed'
    nComponents?: number
    standardize?: boolean
    seed?: number
    nsim?: number
  } = {},
): Promise<PcaResult> {
  const retention = opts.retention ?? 'parallel'
  const nComponents = opts.nComponents ?? 2
  const standardize = opts.standardize !== false // default true
  const seed = opts.seed ?? 20260619
  const nsim = opts.nsim ?? 500

  const rows = listwise(data, variables)
  const n = rows.length
  const cols_flat = variables.flatMap((col) => rows.map((r) => r[col] as number))

  const scaleR = standardize ? 'TRUE' : 'FALSE'

  const retentionBlock =
    retention === 'fixed'
      ? String(nComponents) + 'L'
      : retention === 'kaiser'
        ? '{ eig_obs_k <- prcomp_obj$sdev^2; as.integer(sum(eig_obs_k > 1)) }'
        : '{ x <- as.matrix(d); nsim <- ' + nsim + 'L; seed <- ' + seed + 'L; kind <- "pca"\n' + R_PARALLEL_ANALYSIS + '\nas.integer(retain) }'

  const rBlock = [
    'p <- length(variables)',
    'd <- as.data.frame(lapply(seq_len(p), function(i) cols_flat[((i - 1) * n + 1):(i * n)]))',
    'colnames(d) <- variables',
    '',
    '# PCA via prcomp',
    'prcomp_obj <- prcomp(d, scale. = ' + scaleR + ', center = TRUE)',
    '',
    '# Eigenvalues (variance per component)',
    'eigenvalues <- prcomp_obj$sdev^2',
    'pct_var <- eigenvalues / sum(eigenvalues)',
    'cumulative <- cumsum(pct_var)',
    '',
    '# Retention: ' + retention,
    'k_retain <- ' + retentionBlock,
    'k_retain <- max(1L, min(k_retain, p))',
    '',
    '# Correlation-scaled loadings = rotation (eigenvectors) × sqrt(eigenvalue) = rotation × sdev',
    '# This gives loadings on the correlation scale (equivalent to psych::principal loadings with rotate="none")',
    'rotation_full <- prcomp_obj$rotation  # p × p matrix of eigenvectors',
    'sdev_full <- prcomp_obj$sdev          # sqrt(eigenvalues)',
    '# Scale each column (component) by its sdev',
    'load_mat_full <- sweep(rotation_full, 2, sdev_full, "*")',
    '',
    '# Parallel analysis for scree figure (always run)',
    '{',
    '  x2 <- as.matrix(d)',
    '  if (' + scaleR + ') x2 <- scale(x2)',
    '  set.seed(' + seed + 'L)',
    '  n2 <- nrow(x2); p2 <- ncol(x2)',
    '  R2 <- cor(x2)',
    '  obs2 <- sort(eigen(R2, symmetric = TRUE, only.values = TRUE)$values, decreasing = TRUE)',
    '  sim2 <- matrix(0, nrow = ' + nsim + 'L, ncol = p2)',
    '  for (i in seq_len(' + nsim + 'L)) {',
    '    rx <- matrix(rnorm(n2 * p2), n2, p2)',
    '    sim2[i, ] <- sort(eigen(cor(rx), symmetric = TRUE, only.values = TRUE)$values, decreasing = TRUE)',
    '  }',
    '  sim_p95_vec <- apply(sim2, 2, quantile, probs = 0.95)',
    '}',
    '',
    'list(',
    '  retain      = k_retain,',
    '  eigenvalues = as.numeric(eigenvalues),',
    '  pctVar      = as.numeric(pct_var),',
    '  cumulative  = as.numeric(cumulative),',
    '  loadMat     = as.numeric(load_mat_full),',
    '  simP95      = sim_p95_vec,',
    '  nCases      = n,',
    '  nVars       = p',
    ')',
  ].join('\n')

  const env = { cols_flat, variables, n }
  const raw = await engine.runJson<RawStats>(rBlock, env)

  const k = raw.retain

  // Build variance explained rows (components 1..k)
  const varianceExplained: PcaVarianceRow[] = []
  let cumSum = 0
  for (let ci = 0; ci < k; ci++) {
    cumSum += raw.pctVar[ci] * 100
    varianceExplained.push({
      component: `PC${ci + 1}`,
      eigenvalue: raw.eigenvalues[ci],
      pctVar: raw.pctVar[ci] * 100,
      cumPct: cumSum,
    })
  }

  // Build loading rows — only the retained k columns; column-major layout: col ci has rows [ci*p .. ci*p + p - 1]
  const loadings: PcaLoadingRow[] = variables.map((variable, ri) => ({
    variable,
    loadings: Array.from({ length: k }, (_, ci) => raw.loadMat[ci * raw.nVars + ri]),
  }))

  // Scree plot
  const screeBlock = [
    'library(ggplot2)',
    'p <- length(variables)',
    'd <- as.data.frame(lapply(seq_len(p), function(i) cols_flat[((i - 1) * n + 1):(i * n)]))',
    'colnames(d) <- variables',
    'obs_eig <- prcomp(d, scale. = ' + scaleR + ', center = TRUE)$sdev^2',
    'n_obs <- length(obs_eig)',
    'df_plot <- data.frame(component = seq_len(n_obs), observed = obs_eig, sim_p95 = sim_p95_vals)',
    'print(',
    '  ggplot2::ggplot(df_plot, ggplot2::aes(x = component)) +',
    '  ggplot2::geom_line(ggplot2::aes(y = observed), colour = "#0c447c") +',
    '  ggplot2::geom_point(ggplot2::aes(y = observed), colour = "#0c447c", size = 2) +',
    '  ggplot2::geom_line(ggplot2::aes(y = sim_p95), colour = "#c0392b", linetype = "dashed") +',
    '  ggplot2::geom_point(ggplot2::aes(y = sim_p95), colour = "#c0392b", size = 1.5, shape = 21, fill = "white") +',
    '  ggplot2::geom_hline(yintercept = 1, linetype = "dotted", colour = "#888") +',
    '  ggplot2::labs(x = "Component", y = "Eigenvalue", caption = "Solid: observed  ·  Dashed: parallel analysis 95th pct  ·  Dotted: eigenvalue = 1") +',
    '  ggplot2::theme_minimal(base_size = 11)',
    ')',
  ].join('\n')

  const figScreePng = await engine.capturePlot(screeBlock, 600, 400, {
    cols_flat,
    variables,
    n,
    sim_p95_vals: raw.simP95,
  })

  return {
    retain: k,
    varianceExplained,
    loadings,
    figScreePng,
    nCases: raw.nCases,
  }
}
