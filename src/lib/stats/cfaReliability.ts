import type { Engine } from '../webr/engine'
import type { Dataset } from './types'

export interface CfaConstructResult {
  name: string
  ave: number
  cr: number
  omega: number
  alpha: number
}

export interface CfaReliabilityResult {
  perConstruct: CfaConstructResult[]
  fornellLarcker: number[][]
  htmt: number[][]
  labels: string[]
}

// R block: multi-construct CFA via lavaan; AVE/compRelSEM/alpha per construct; Fornell-Larcker + HTMT matrices.
//
// Env bindings:
//   model_str   character(1): the lavaan measurement model string (one line per construct)
//   construct_names  character vector: construct names (k of them)
//   item_cols_flat   numeric vector: all item columns concatenated column-major over ALL items (union)
//   all_items   character vector: item names for all_cols_flat (same order)
//   n           integer: number of cases after listwise deletion
//   construct_items_flat  character vector: item names per construct, concatenated (construct boundaries from construct_items_lens)
//   construct_items_lens  integer vector: number of items per construct (length k)
//
// compRelSEM returns a named list (one element per factor); unlist() to get a named numeric vector.
// AVE() returns a named numeric vector (one per factor).
// htmt() returns a k×k matrix; lavInspect(fit,"cor.lv") returns the latent correlation matrix.
// Fornell-Larcker: diagonal = sqrt(AVE[i]); off-diagonal = cor.lv[i,j].
const R_STATS = String.raw`
library(lavaan)
library(semTools)
library(psych)

k <- length(construct_names)

# Rebuild full item data frame from flat column-major array
p_all <- length(all_items)
d_all <- as.data.frame(lapply(seq_len(p_all), function(i) item_cols_flat[((i - 1) * n + 1):(i * n)]))
colnames(d_all) <- all_items

# Fit CFA
fit <- lavaan::cfa(model_str, data = d_all, std.lv = FALSE)

# AVE and omega (=CR) per construct
ave_vec <- semTools::AVE(fit)             # named numeric vector, one per construct
cr_vec  <- unlist(semTools::compRelSEM(fit))  # named numeric after unlist

# Per-construct alpha via psych::alpha
# Rebuild items per construct from the flat + lens vectors
alpha_vec <- numeric(k)
item_start <- 1L
for (ci in seq_len(k)) {
  len <- construct_items_lens[ci]
  cname <- construct_names[ci]
  citems <- construct_items_flat[item_start:(item_start + len - 1L)]
  item_start <- item_start + len
  a_obj <- psych::alpha(d_all[, citems, drop = FALSE], warnings = FALSE)
  alpha_vec[ci] <- a_obj$total$raw_alpha
}

# Fornell-Larcker matrix: diagonal = sqrt(AVE), off-diagonal = latent correlations
cor_lv <- lavInspect(fit, "cor.lv")   # k×k matrix, construct order matches fit
ave_ordered <- ave_vec[construct_names]
fl <- cor_lv[construct_names, construct_names]
for (ci in seq_len(k)) diag(fl)[ci] <- sqrt(ave_ordered[ci])

# HTMT matrix
htmt_mat <- semTools::htmt(model_str, data = d_all)
htmt_ordered <- htmt_mat[construct_names, construct_names]

# per-construct list
per_construct <- lapply(seq_len(k), function(ci) {
  nm <- construct_names[ci]
  omega_val <- as.numeric(cr_vec[nm])
  list(
    name  = nm,
    ave   = as.numeric(ave_ordered[nm]),
    cr    = omega_val,
    omega = omega_val,
    alpha = alpha_vec[ci]
  )
})

# Flatten matrices to row-major list of lists
fl_rows <- lapply(seq_len(k), function(i) as.numeric(fl[i, ]))
htmt_rows <- lapply(seq_len(k), function(i) as.numeric(htmt_ordered[i, ]))

list(
  perConstruct   = per_construct,
  fornellLarcker = fl_rows,
  htmt           = htmt_rows,
  labels         = as.character(construct_names)
)
`

/** Listwise-delete rows where any item (across all constructs) is not a finite number. */
function listwise(data: Dataset, items: string[]): Record<string, unknown>[] {
  return data.rows.filter((row) =>
    items.every((col) => typeof row[col] === 'number' && Number.isFinite(row[col] as number)),
  )
}

/** Build the lavaan measurement model string from constructs. */
function buildModel(constructs: { name: string; items: string[] }[]): string {
  return constructs.map((c) => `${c.name} =~ ${c.items.join(' + ')}`).join('\n')
}

export async function runCfaReliability(
  engine: Engine,
  data: Dataset,
  constructs: { name: string; items: string[] }[],
): Promise<CfaReliabilityResult> {
  const allItems = [...new Set(constructs.flatMap((c) => c.items))]
  const rows = listwise(data, allItems)
  const n = rows.length

  // Column-major flat array over all items
  const item_cols_flat = allItems.flatMap((col) => rows.map((r) => r[col] as number))

  // Per-construct item list (flat + lens) for alpha computation in R
  const construct_items_flat = constructs.flatMap((c) => c.items)
  const construct_items_lens = constructs.map((c) => c.items.length)

  const env = {
    model_str: buildModel(constructs),
    construct_names: constructs.map((c) => c.name),
    item_cols_flat,
    all_items: allItems,
    n,
    construct_items_flat,
    construct_items_lens,
  }

  interface RawResult {
    perConstruct: CfaConstructResult[]
    fornellLarcker: number[][]
    htmt: number[][]
    labels: string[]
  }

  return engine.runJson<RawResult>(R_STATS, env)
}
