import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import { lvNames } from './lvName'

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
  corLvP: number[][]
}

// R block: multi-construct CFA via lavaan; AVE/compRelSEM/alpha per construct; Fornell-Larcker + HTMT matrices.
//
// Env bindings:
//   model_str   character(1): the lavaan measurement model string (one line per construct)
//   construct_names  character vector: SANITIZED construct identifiers (lvName; k of them) — these match
//     the model tokens and index every fitted object. display_names (same order) carry the original
//     user-typed names for the UI-facing perConstruct/labels fields.
//   display_names    character vector: original display names (k of them, construct order)
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

# Latent correlation p-values (ψ block): standardizedSolution() op=="~~" rows among the k constructs.
ss <- lavaan::standardizedSolution(fit)
p_mat <- matrix(NA_real_, k, k, dimnames = list(construct_names, construct_names))
for (i in seq_len(k)) for (j in seq_len(k)) {
  if (i == j) next
  ni <- construct_names[i]; nj <- construct_names[j]
  row <- ss[ss$op == "~~" & ((ss$lhs == ni & ss$rhs == nj) | (ss$lhs == nj & ss$rhs == ni)), ]
  if (nrow(row) > 0) p_mat[i, j] <- as.numeric(row$pvalue[1])
}
corlvp_rows <- lapply(seq_len(k), function(i) as.numeric(p_mat[i, ]))

# per-construct list (name = the ORIGINAL display name; nm indexes the fitted objects)
per_construct <- lapply(seq_len(k), function(ci) {
  nm <- construct_names[ci]
  omega_val <- as.numeric(cr_vec[nm])
  list(
    name  = display_names[ci],
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
  labels         = as.character(display_names),
  corLvP         = corlvp_rows
)
`

/** Listwise-delete rows where any item (across all constructs) is not a finite number. */
function listwise(data: Dataset, items: string[]): Record<string, unknown>[] {
  return data.rows.filter((row) =>
    items.every((col) => typeof row[col] === 'number' && Number.isFinite(row[col] as number)),
  )
}

/** Build the lavaan measurement model string from constructs, using the SANITIZED identifiers
 *  (display names with spaces are illegal lavaan `=~` tokens) for BOTH the construct token and its
 *  items, via the raw-item -> sanitized-item `itemMap`. */
function buildModel(constructs: { items: string[] }[], rNames: string[], itemMap: Map<string, string>): string {
  return constructs
    .map((c, i) => `${rNames[i]} =~ ${c.items.map((it) => itemMap.get(it)!).join(' + ')}`)
    .join('\n')
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

  // Sanitize the FULL flattened item list in ONE call, so items belonging to different constructs
  // that happen to collide after sanitizing (e.g. "q 1" from two constructs) still dedupe correctly
  // against each other; raw display names stay untouched everywhere else (labels, colnames lookups
  // from JS-side code, etc).
  const rAllItems = lvNames(allItems)
  const itemMap = new Map(allItems.map((raw, i) => [raw, rAllItems[i]]))

  // Per-construct item list (flat + lens) for alpha computation in R, sanitized so it indexes
  // d_all's (now-sanitized) colnames.
  const construct_items_flat = constructs.flatMap((c) => c.items.map((it) => itemMap.get(it)!))
  const construct_items_lens = constructs.map((c) => c.items.length)

  const rNames = lvNames(constructs.map((c) => c.name))

  const env = {
    model_str: buildModel(constructs, rNames, itemMap),
    construct_names: rNames,
    display_names: constructs.map((c) => c.name),
    item_cols_flat,
    all_items: rAllItems,
    n,
    construct_items_flat,
    construct_items_lens,
  }

  interface RawResult {
    perConstruct: CfaConstructResult[]
    fornellLarcker: number[][]
    htmt: number[][]
    labels: string[]
    corLvP: number[][]
  }

  return engine.runJson<RawResult>(R_STATS, env)
}
