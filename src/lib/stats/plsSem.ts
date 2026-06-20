import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import type { Construct, StructuralPath, TestSetup } from '../../state/session'
import type { RunProgress } from '../results/builders'
import { MAKECLUSTER_SHIM } from '../webr/parallelShim'

export interface PlsSemResult {
  outer: Array<Record<string, unknown>>
  reliability: Array<Record<string, unknown>>
  htmt: { labels: string[]; cells: (number | null)[][] }
  structural: Array<Record<string, unknown>>
  quality: Array<Record<string, unknown>>
  indirect?: Array<Record<string, unknown>>
  estimates: {
    paths: Array<{ from: number; to: number; beta: number }>
    loadings: Record<string, number>
    r2: Record<number, number>
  }
}

// PLS-SEM via seminr: measurement model (composite reflective/formative) + structural paths.
// estimate_pls → summary (reliability/htmt/R²/fSquare); bootstrap_model (serial shim) → t/p/CI;
// specific_effect_significance → indirect effects. Reliability raw order is alpha/rhoC/AVE/rhoA →
// the R block SELECTS + REORDERS to the display tuple α/ρ_A/CR/AVE. Formative constructs:
// outer = WEIGHTS + indicator VIF; AVE/HTMT row suppressed (NA → null in JSON).
//
// seminr quirks pinned by spike 0c + Task-25 verification against authoritative seminr::mobi:
//   - bootstrapped_loadings / bootstrapped_weights rows are keyed ITEM-FIRST: "IMAG1  ->  Image"
//     (NOT "Image  ->  IMAG1"); bootstrapped_paths rows are construct-first: "Image  ->  Expectation".
//   - $validity$vif_items is a NAMED LIST keyed by construct name (vif_items[["Name"]][item]), not a matrix.
//   - $fSquare is a predictor×outcome matrix (fSquare[from, to]).
//   - $reliability raw columns are alpha / rhoC / AVE / rhoA (indexed by name).
//   - $validity$htmt is lower-triangle populated: htmt[row=later, col=earlier].
//
// Env bindings:
//   item_cols_flat  numeric vector: all indicator columns concatenated column-major (union, listwise-clean)
//   all_items       character vector: indicator names for item_cols_flat (same order)
//   n               integer: rows after listwise deletion
//   mm_lines        character vector: one seminr `composite(...)` call per construct (R source text)
//   sm_lines        character vector: one seminr `paths(from=, to=)` call per edge (R source text)
//   path_from       integer vector: source construct id per edge (same order as the structural table)
//   path_to         integer vector: target construct id per edge
//   path_from_name  character vector: source construct name per edge
//   path_to_name    character vector: target construct name per edge
//   nboot           integer: bootstrap resamples (5000 default; the test passes 300)
//   seed            integer: RNG seed (deterministic native parity)
//   is_formative_flags logical vector (one per construct, construct order): TRUE = formative
//     (AVE/HTMT suppressed; outer = weight + VIF). A per-construct flag — never an empty array — because
//     webr 0.6.0's env conversion throws "Cannot convert undefined or null to object" on an empty JS [].
const R_STATS = (shim: string) => String.raw`
${shim}
library(seminr)

# Rebuild the indicator data frame from the flat column-major array
p_all <- length(all_items)
d_all <- as.data.frame(lapply(seq_len(p_all), function(i) item_cols_flat[((i - 1) * n + 1):(i * n)]))
colnames(d_all) <- all_items

# Measurement + structural model from emitted seminr source lines
mm <- eval(parse(text = paste0("constructs(", paste(mm_lines, collapse = ", "), ")")))
sm <- eval(parse(text = paste0("relationships(", paste(sm_lines, collapse = ", "), ")")))

gc()
pls <- estimate_pls(data = d_all, measurement_model = mm, structural_model = sm)
s   <- summary(pls)

set.seed(seed)
bo  <- bootstrap_model(seminr_model = pls, nboot = nboot, cores = 1)
sb  <- summary(bo)
gc()

construct_names <- pls$constructs
# is_formative_flags is bound in the SAME order constructs were passed to constructs(); seminr preserves
# that order in pls$constructs, so a positional map is exact.
is_formative <- as.logical(is_formative_flags)

# ---- Reliability: raw seminr order alpha/rhoC/AVE/rhoA → display α/ρ_A/CR/AVE; AVE NA for formative ----
rel <- s$reliability
reliability <- lapply(seq_along(construct_names), function(i) {
  nm <- construct_names[i]
  ave_v <- if (is_formative[i]) NA else as.numeric(rel[nm, "AVE"])
  list(
    construct = nm,
    alpha = as.numeric(rel[nm, "alpha"]),
    rhoA  = as.numeric(rel[nm, "rhoA"]),
    cr    = as.numeric(rel[nm, "rhoC"]),
    ave   = ave_v
  )
})

# ---- Outer model: reflective = loading; formative = weight + VIF; t/p from the bootstrap ----
# seminr keys bootstrap rows ITEM-FIRST ("IMAG1  ->  Image"); vif_items is a named LIST per construct.
vifs <- tryCatch(s$validity$vif_items, error = function(e) NULL)
loadings_named <- list()
outer <- list()
for (ci in seq_along(construct_names)) {
  nm <- construct_names[ci]
  items_ci <- pls$mmMatrix[pls$mmMatrix[, "construct"] == nm, "measurement"]
  for (it in items_ci) {
    key <- paste0(it, "  ->  ", nm)
    if (is_formative[ci]) {
      w <- as.numeric(sb$bootstrapped_weights[key, "Original Est."])
      tval <- as.numeric(sb$bootstrapped_weights[key, "T Stat."])
      vif_v <- if (!is.null(vifs) && nm %in% names(vifs) && it %in% names(vifs[[nm]])) as.numeric(vifs[[nm]][it]) else NA
      outer[[length(outer) + 1]] <- list(construct = nm, item = it,
        weight = w, loading = NA, vif = vif_v, t = tval, p = 2 * pnorm(-abs(tval)))
    } else {
      l <- as.numeric(sb$bootstrapped_loadings[key, "Original Est."])
      tval <- as.numeric(sb$bootstrapped_loadings[key, "T Stat."])
      loadings_named[[it]] <- l
      outer[[length(outer) + 1]] <- list(construct = nm, item = it,
        weight = NA, loading = l, vif = NA, t = tval, p = 2 * pnorm(-abs(tval)))
    }
  }
}

# ---- HTMT matrix (reflective only): square, construct order, lower triangle; formative rows/cols NA ----
htmt_raw <- s$validity$htmt
k <- length(construct_names)
htmt_cells <- lapply(seq_len(k), function(i) {
  lapply(seq_len(k), function(j) {
    if (j >= i) return(NA)
    if (is_formative[i] || is_formative[j]) return(NA)
    as.numeric(htmt_raw[construct_names[i], construct_names[j]])
  })
})

# ---- Structural paths: β + t/p + 95% CI (percentile) + f² ----
bp <- sb$bootstrapped_paths       # rows "From  ->  To"
fsq <- s$fSquare                   # square matrix: fSquare[from, to]
estimate_paths <- list()
structural <- lapply(seq_along(path_from), function(e) {
  fr <- path_from_name[e]; to <- path_to_name[e]
  key <- paste0(fr, "  ->  ", to)
  beta <- as.numeric(bp[key, "Original Est."])
  estimate_paths[[length(estimate_paths) + 1]] <<- list(from = path_from[e], to = path_to[e], beta = beta)
  list(
    path = paste0(fr, " → ", to),
    beta = beta,
    t = as.numeric(bp[key, "T Stat."]),
    p = 2 * pnorm(-abs(as.numeric(bp[key, "T Stat."]))),
    ciLower = as.numeric(bp[key, "2.5% CI"]),
    ciUpper = as.numeric(bp[key, "97.5% CI"]),
    fSquare = as.numeric(fsq[fr, to])
  )
})

# ---- Structural quality: R² / R²adj / Q² (per §5.2 — endogenous constructs only) ----
paths_tbl <- s$paths               # has "R^2" and "AdjR^2" rows; cols = endogenous constructs
endo <- colnames(paths_tbl)
r2_named <- list()
quality <- lapply(endo, function(nm) {
  r2v <- as.numeric(paths_tbl["R^2", nm]); r2a <- as.numeric(paths_tbl["AdjR^2", nm])
  cid <- path_to[match(nm, path_to_name)]
  if (!is.na(cid)) r2_named[[as.character(cid)]] <<- r2v
  q2v <- tryCatch(as.numeric(s$validity$q2[nm]), error = function(e) NA)
  list(construct = nm, r2 = r2v, r2adj = r2a, q2 = q2v)
})

# ---- Indirect effects: every from->...->to with an intermediate, via specific_effect_significance ----
# specific_effect_significance returns a NAMED VECTOR/matrix — index by name ("2.5% CI"), not positionally.
indirect <- list()
adj <- matrix(FALSE, k, k, dimnames = list(construct_names, construct_names))
for (e in seq_along(path_from_name)) adj[path_from_name[e], path_to_name[e]] <- TRUE
for (a in construct_names) for (z in construct_names) {
  if (a == z) next
  mids <- construct_names[adj[a, ] & adj[, z]]
  for (m in mids) {
    sig <- tryCatch(
      specific_effect_significance(bo, from = a, through = m, to = z, alpha = 0.05),
      error = function(e) NULL)
    if (!is.null(sig)) {
      indirect[[length(indirect) + 1]] <- list(
        path = paste0(a, " → ", m, " → ", z),
        est = as.numeric(sig["Original Est."]),
        se = as.numeric(sig["Bootstrap SD"]),
        ciLower = as.numeric(sig["2.5% CI"]),
        ciUpper = as.numeric(sig["97.5% CI"]),
        t = as.numeric(sig["T Stat."]),
        p = 2 * pnorm(-abs(as.numeric(sig["T Stat."])))
      )
    }
  }
}

list(
  outer = outer,
  reliability = reliability,
  htmt = list(labels = as.character(construct_names), cells = htmt_cells),
  structural = structural,
  quality = quality,
  indirect = indirect,
  estimates = list(
    paths = estimate_paths,
    loadings = loadings_named,
    r2 = r2_named
  )
)
`

/** Listwise-delete rows where any indicator is not a finite number. */
function listwise(data: Dataset, items: string[]): Record<string, unknown>[] {
  return data.rows.filter((row) =>
    items.every((col) => typeof row[col] === 'number' && Number.isFinite(row[col] as number)),
  )
}

/** seminr `composite("Name", c("item",...), weights = mode_A|mode_B)` source line per construct. */
function measurementLine(c: Construct): string {
  const items = `c(${c.items.map((it) => `"${it}"`).join(', ')})`
  const wt = c.mode === 'formative' ? ', weights = mode_B' : ', weights = mode_A'
  return `composite("${c.name}", ${items}${wt})`
}

/** seminr `paths(from="A", to="B")` source line per edge. */
function structuralLine(from: string, to: string): string {
  return `paths(from = "${from}", to = "${to}")`
}

export async function runPlsSem(
  engine: Engine,
  data: Dataset,
  setup: TestSetup,
  onProgress?: RunProgress,
): Promise<PlsSemResult> {
  const constructs = setup.constructs ?? []
  const paths: StructuralPath[] = setup.paths ?? []
  const byId = new Map(constructs.map((c) => [c.id, c]))

  const allItems = [...new Set(constructs.flatMap((c) => c.items))]
  const rows = listwise(data, allItems)
  const n = rows.length
  const item_cols_flat = allItems.flatMap((col) => rows.map((r) => r[col] as number))

  const nboot = Number(setup.options['nboot'] ?? 5000)
  const fromName = (id: number) => byId.get(id)?.name ?? String(id)

  // seminr is lazy-installed (Engine.ensureSeminr — NOT part of init()'s eager preload). init() also applies
  // the detectCores + makeCluster serial shims that bootstrap_model needs under WASM (no sockets). Both must
  // run before the R block's library(seminr)/bootstrap_model; both are idempotent so this is safe per call.
  await engine.init()
  await engine.ensureSeminr()

  onProgress?.({ message: `Bootstrapping PLS-SEM (${nboot.toLocaleString()} resamples)…`, elapsedMs: 0 })

  const env = {
    item_cols_flat,
    all_items: allItems,
    n,
    mm_lines: constructs.map(measurementLine),
    sm_lines: paths.map((p) => structuralLine(fromName(p.from), fromName(p.to))),
    path_from: paths.map((p) => p.from),
    path_to: paths.map((p) => p.to),
    path_from_name: paths.map((p) => fromName(p.from)),
    path_to_name: paths.map((p) => fromName(p.to)),
    nboot,
    seed: 20260620,
    // Per-construct flag (construct order) — never an empty array (webr 0.6.0 cannot convert []).
    is_formative_flags: constructs.map((c) => c.mode === 'formative'),
  }

  return engine.runJson<PlsSemResult>(R_STATS(MAKECLUSTER_SHIM), env)
}
