import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface CronbachResult {
  omega: number
  omegaCi: [number, number]
  alpha: number
  stdAlpha: number
  alphaCi: [number, number]
  nItems: number
  nCases: number
  /** true when the standardized alpha option is active (affects which α the builder displays in T1) */
  useStandardizedAlpha: boolean
  /** item-total statistics; empty array when drop-item option is off */
  itemTotal: { item: string; r: number; alphaDropped: number }[]
  /** undefined when drop-item option is off */
  figItemTotalPng: Uint8Array | undefined
}

// R block: psych::alpha for α + Feldt CI + item-total stats;
// 1-factor lavaan CFA (ML, no bootstrap SE needed for point ω) + semTools::compRelSEM for ω;
// ω CI: lavaan::bootstrapLavaan (ordinary bootstrap, R=nboot, sequential).
//
// Design rationale: cfa() uses ML (default) for the point estimate — adding se='bootstrap' would
// slow the fit by nboot CFA refits without improving the ω point estimate (compRelSEM uses only the
// structural parameters). The bootstrap CI is obtained separately via bootstrapLavaan, which refits
// the CFA nboot times on bootstrap samples and calls compRelSEM on each.
// In production nboot=2000; in tests nboot=200 keeps wall-clock manageable under WebR WASM.
//
// Env bindings (all flat / scalar — safe for WebR env binding):
//   `cols_flat`  numeric vector: all item columns concatenated, column-major (col1 then col2 …)
//   `items`      character vector of item names (length p)
//   `n`          integer: number of cases (rows after listwise deletion)
//   `seed`       integer RNG seed
//   `nboot`      integer bootstrap replicates for ω CI
//
// α CI: Feldt (1965) exact confidence interval.
// ω: single-factor CFA (std.lv=TRUE, ML) + semTools::compRelSEM(fit)$f.
const R_STATS = String.raw`
library(psych)
library(lavaan)
library(semTools)

set.seed(seed)

p <- length(items)

# Rebuild data frame from flat column-major array
d <- as.data.frame(
  lapply(seq_len(p), function(i) cols_flat[((i - 1) * n + 1):(i * n)])
)
colnames(d) <- items

# ---- Cronbach's α via psych::alpha ----
a_obj <- psych::alpha(d, warnings = FALSE)
alpha_val     <- a_obj$total$raw_alpha
std_alpha_val <- a_obj$total$std.alpha
alpha_lo   <- a_obj$feldt$lower.ci$raw_alpha
alpha_hi   <- a_obj$feldt$upper.ci$raw_alpha
r_drop     <- as.numeric(a_obj$item.stats$r.drop)
alpha_drop <- as.numeric(a_obj$alpha.drop$raw_alpha)

item_total <- lapply(seq_along(items), function(i) {
  list(item = items[i], r = r_drop[i], alphaDropped = alpha_drop[i])
})

# ---- McDonald's ω via 1-factor lavaan CFA + semTools::compRelSEM ----
# ML fit (no se='bootstrap') — compRelSEM uses only structural parameters, not SEs.
model <- paste0("f =~ ", paste(items, collapse = " + "))
fit <- lavaan::cfa(model, data = d, std.lv = TRUE)

omega_val <- as.numeric(semTools::compRelSEM(fit)$f)

# ω CI: bootstrap distribution via bootstrapLavaan (sequential, parallel='no' default)
boot_omegas <- lavaan::bootstrapLavaan(fit, R = nboot, FUN = function(bfit) {
  tryCatch(as.numeric(semTools::compRelSEM(bfit)$f), error = function(e) NA_real_)
})
omega_ci <- quantile(boot_omegas, c(0.025, 0.975), na.rm = TRUE)

list(
  omega     = omega_val,
  omegaCiLo = unname(omega_ci[1]),
  omegaCiHi = unname(omega_ci[2]),
  alpha     = alpha_val,
  stdAlpha  = std_alpha_val,
  alphaCiLo = unname(alpha_lo),
  alphaCiHi = unname(alpha_hi),
  nItems    = p,
  nCases    = n,
  itemTotal = item_total,
  rDrop     = r_drop
)
`

// ggplot2 horizontal bar chart of corrected item-total r per item.
// Env: `items` (character), `r_drop_vals` (numeric, same length/order as items).
const R_FIG = String.raw`
d_plot <- data.frame(
  item = factor(items, levels = rev(items)),
  r    = r_drop_vals
)
print(ggplot2::ggplot(d_plot, ggplot2::aes(x = r, y = item)) +
  ggplot2::geom_col(fill = "#0c447c") +
  ggplot2::geom_vline(xintercept = 0.3, linetype = "dashed", colour = "#9cc2ec") +
  ggplot2::labs(x = "Corrected item-total r", y = NULL))
`

interface RawStats {
  omega: number
  omegaCiLo: number
  omegaCiHi: number
  alpha: number
  stdAlpha: number
  alphaCiLo: number
  alphaCiHi: number
  nItems: number
  nCases: number
  itemTotal: { item: string; r: number; alphaDropped: number }[]
  rDrop: number[]
}

/** Listwise-delete rows where any item column is not a finite number. */
function listwise(data: Dataset, items: string[]): Record<string, unknown>[] {
  return data.rows.filter((row) =>
    items.every((col) => typeof row[col] === 'number' && Number.isFinite(row[col] as number)),
  )
}

export async function runCronbachsAlpha(
  engine: Engine,
  data: Dataset,
  items: string[],
  seed = 20260619,
  nboot = 2000,
  standardizedAlpha = false,
  dropItem = true,
): Promise<CronbachResult> {
  const rows = listwise(data, items)
  const n = rows.length
  // Column-major flat array: all values for item[0], then item[1], etc.
  const cols_flat = items.flatMap((col) => rows.map((r) => r[col] as number))

  const env = { cols_flat, items, n, seed, nboot }

  const raw = await engine.runJson<RawStats>(R_STATS, env)

  // The figure is only generated when the drop-item option is on
  let figItemTotalPng: Uint8Array | undefined
  if (dropItem) {
    const figEnv = { items, r_drop_vals: raw.rDrop }
    figItemTotalPng = await engine.capturePlot(R_FIG, 600, 450, figEnv)
  }

  return {
    omega: raw.omega,
    omegaCi: [raw.omegaCiLo, raw.omegaCiHi],
    alpha: raw.alpha,
    stdAlpha: raw.stdAlpha,
    alphaCi: [raw.alphaCiLo, raw.alphaCiHi],
    nItems: raw.nItems,
    nCases: raw.nCases,
    useStandardizedAlpha: standardizedAlpha,
    itemTotal: dropItem ? raw.itemTotal : [],
    figItemTotalPng,
  }
}
