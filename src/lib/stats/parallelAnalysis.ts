import type { Engine } from '../webr/engine'

export interface ParallelAnalysisResult {
  retain: number
  observed: number[]
  simP95: number[]
}

// Horn (1965) parallel analysis.
// kind='pca': uses the standard correlation matrix (1s on diagonal) — the components-based approach.
// kind='fa':  uses the reduced correlation matrix (SMC on diagonal), matching psych::fa.parallel(fa="fa").
// Both use the same retain criterion: count leading components where observed > 95th-pct simulated.
// Env: x = numeric matrix (N × p), nsim = number of simulations (default 500), seed = RNG seed.
export const R_PARALLEL_ANALYSIS = String.raw`
library(psych)
kind <- if (exists("kind")) kind else "pca"
nsim <- if (exists("nsim")) as.integer(nsim) else 500L
seed <- if (exists("seed")) as.integer(seed) else 20260619L
set.seed(seed)

n <- nrow(x)
p <- ncol(x)
R <- cor(x)

# Observed eigenvalues
if (kind == "fa") {
  # Reduced matrix: SMC (squared multiple correlations) on the diagonal, matching psych's fa path.
  # Clamp to [0,1]: smc() can return values outside [0,1] on ill-conditioned matrices, which
  # corrupts the eigendecomposition. psych::fa.parallel clamps before substituting.
  smc_vals <- smc(R)
  smc_vals <- pmin(pmax(smc_vals, 0), 1)
  diag(R) <- smc_vals
}
observed <- sort(eigen(R, symmetric = TRUE, only.values = TRUE)$values, decreasing = TRUE)

# Simulate: for each of nsim replicates, draw an N×p random-normal matrix,
# compute its correlation matrix (same diagonal adjustment for fa), extract eigenvalues.
sim_eigs <- matrix(0, nrow = nsim, ncol = p)
for (i in seq_len(nsim)) {
  rx <- matrix(rnorm(n * p), nrow = n, ncol = p)
  Rsim <- cor(rx)
  if (kind == "fa") {
    smc_sim <- smc(Rsim)
    smc_sim <- pmin(pmax(smc_sim, 0), 1)
    diag(Rsim) <- smc_sim
  }
  sim_eigs[i, ] <- sort(eigen(Rsim, symmetric = TRUE, only.values = TRUE)$values, decreasing = TRUE)
}

# 95th percentile per component across simulations
sim_p95 <- apply(sim_eigs, 2, quantile, probs = 0.95)

# retain = number of leading components where observed > threshold; stop at first failure
retain <- 0L
for (i in seq_len(p)) {
  if (observed[i] > sim_p95[i]) retain <- retain + 1L else break
}

list(retain = retain, observed = as.numeric(observed), simP95 = as.numeric(sim_p95))
`

/** Run parallel analysis using the Engine. x is passed as env-bound variable via R matrix literal. */
export async function runParallelAnalysis(
  engine: Engine,
  kind: 'fa' | 'pca' = 'pca',
  nsim = 500,
  seed = 20260619,
): Promise<ParallelAnalysisResult> {
  // Load HolzingerSwineford1939 from lavaan and extract x1..x9 as the matrix x.
  // The engine already has lavaan loaded; this runner is the HS-fixture convenience for tests.
  // Callers passing real data should use engine.runJson directly with R_PARALLEL_ANALYSIS and x bound.
  const rBlock = `
library(lavaan)
x <- as.matrix(HolzingerSwineford1939[, c("x1","x2","x3","x4","x5","x6","x7","x8","x9")])
kind <- ${JSON.stringify(kind)}
nsim <- ${nsim}L
seed <- ${seed}L
${R_PARALLEL_ANALYSIS}
`
  return engine.runJson<ParallelAnalysisResult>(rBlock)
}
