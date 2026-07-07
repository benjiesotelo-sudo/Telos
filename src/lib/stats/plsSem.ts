import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import type { Construct, StructuralPath, TestSetup } from '../../state/session'
import type { RunProgress } from '../results/builders'
import { MAKECLUSTER_SHIM } from '../webr/parallelShim'
import { BC_CI_R } from './plsBcCi'
import { renderSimpleSlopesFigure } from './simpleSlopesPlot'
import { lvNames } from './lvName'

/** Simple slope at one of the three Aiken & West (1991) probing levels (U6-T5), derived from seminr's
 *  ESTIMATED interaction coefficient rather than a lavaan `:=` defined parameter (PLS has no latent-
 *  variance label to scale by - the moderator SD is the OBSERVED composite score's SD, per Aiken & West
 *  applied to the composite/summed-indicator metric, the standard PLS treatment; see plsSem.ts's R block).
 *  `modId`/`label` disambiguate rows across multiple moderation edges, mirroring CbSemResult.SlopeRow. */
export interface PlsSlopeRow {
  level: '-1SD' | 'mean' | '+1SD'
  modId: number; label: string
  b: number; se: number; t: number; p: number
  ciLower: number; ciUpper: number
}

export interface PlsSemResult {
  outer: Array<Record<string, unknown>>
  reliability: Array<Record<string, unknown>>
  htmt: { labels: string[]; cells: (number | null)[][] }
  /** Structural paths - INCLUDING any moderation interaction path(s) (U6-T4). Unlike CB-SEM (which
   *  hand-builds indProd + a `:=`-defined interaction and reports it through a SEPARATE `moderation`
   *  field/table section), seminr's `interaction_term(iv=, moderator=, method=two_stage)` is modeled as
   *  an ordinary construct + `paths(from="{iv}*{moderator}", to="{target}")` - so its row falls out of
   *  THIS SAME array with no special extraction. There is deliberately no `moderation.rows` field here;
   *  a moderation edge just adds one more `structural[]` entry named "{iv}*{moderator} → {target}". */
  structural: Array<Record<string, unknown>>
  quality: Array<Record<string, unknown>>
  indirect?: Array<Record<string, unknown>>
  /** Conditional effects at -1SD/mean/+1SD per moderation edge (U6-T5); absent when no moderation ran.
   *  Feeds BOTH the conditional-effects table (buildPlsSem.ts) and figModSlopesPng below - same numbers. */
  slopes?: PlsSlopeRow[]
  /** Whiskered simple-slopes figure (U6-T5), app-drawn via the SAME shared `simpleSlopesPlot.ts` module
   *  CB-SEM uses, from the SAME `slopes[]` array that feeds the conditional-effects table. */
  figModSlopesPng?: Uint8Array
  estimates: {
    paths: Array<{ from: number; to: number; beta: number }>
    loadings: Record<string, number>
    r2: Record<number, number>
    /** Canvas moderation-arrow overlay (U6-T5, mirrors CbSemResult.estimates.moderation): one beta per
     *  moderation edge, keyed back to the moderatorId/pathIndex the canvas drew it with, so SemCanvas can
     *  annotate the dashed arrow post-run - the render path already reads `estimates.moderation`
     *  structurally (SemCanvas.tsx casts `run.result` to `{ estimates?: CbSemResult['estimates'] }`, which
     *  is a runtime-only cast; this field's identical shape is all that's needed for it to pick PLS up too). */
    moderation?: Array<{ moderatorId: number; pathIndex: number; beta: number }>
  }
  /** Bootstrap resamples actually used (added client-side, mirroring CbSemResult.nboot — Andrews &
   *  Buchinsky (2000) BC-CI-count disclosure needs this in buildPlsSem, which never sees TestSetup).
   *  Optional so pre-existing hand-built PlsSemResult fixtures (predating U6-T3) keep passing unmodified;
   *  buildPlsSem defaults it to 5000, same as CbSemResult's convention. */
  nboot?: number
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
//   construct_names_real character vector: the DRAWN construct names (construct order - excludes any
//     derived interaction constructs seminr appends for moderation edges, U6-T4)
//   is_formative_flags logical vector (one per construct, construct order): TRUE = formative
//     (AVE/HTMT suppressed; outer = weight + VIF). A per-construct flag — never an empty array — because
//     webr 0.6.0's env conversion throws "Cannot convert undefined or null to object" on an empty JS [].
const R_STATS = (shim: string) => String.raw`
${shim}
library(seminr)

# Hand-rolled z0-adjusted percentile BC (U6-T3) — reused verbatim from the CB-SEM/lavaan-verified text
# (src/lib/stats/plsBcCi.ts); seminr has no built-in bca.simple, so bc_ci() runs here against bo$boot_paths'
# raw draws (a [from, to, boot_index] 3D array — confirmed via str(bootstrap_model(...))).
${BC_CI_R}

# Rebuild the indicator data frame from the flat column-major array
p_all <- length(all_items)
d_all <- as.data.frame(lapply(seq_len(p_all), function(i) item_cols_flat[((i - 1) * n + 1):(i * n)]))
colnames(d_all) <- all_items

# Item Mean/SD (measurement table, U6-T1) — on the estimation sample (d_all is already the listwise-
# clean frame the model fits on; PLS has no separate missing-data toggle, matching CB-SEM's item-stats
# convention when the fit itself is always listwise).
item_means <- sapply(all_items, function(it) mean(d_all[[it]], na.rm = TRUE))
item_sds   <- sapply(all_items, function(it) sd(d_all[[it]], na.rm = TRUE))

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

# The DRAWN construct names, bound from TS in the same order as is_formative_flags (positional map exact
# by construction). NOT pls$constructs: with a moderation edge (U6-T4), seminr appends the derived
# interaction construct ("{iv}*{moderator}", a two-stage product score) there too - it is not a measured
# construct, carries no meaningful alpha/AVE/HTMT/outer rows, and must not enter measurement reporting or
# the mediation enumeration below. Its structural row still flows through the path loop (bp/fsq/boot_paths
# are keyed by NAME, and path_*_name include the interaction edge).
construct_names <- as.character(construct_names_real)
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
        weight = w, loading = NA, vif = vif_v, t = tval, p = 2 * pnorm(-abs(tval)),
        mean = as.numeric(item_means[[it]]), sd = as.numeric(item_sds[[it]]))
    } else {
      l <- as.numeric(sb$bootstrapped_loadings[key, "Original Est."])
      tval <- as.numeric(sb$bootstrapped_loadings[key, "T Stat."])
      loadings_named[[it]] <- l
      outer[[length(outer) + 1]] <- list(construct = nm, item = it,
        weight = NA, loading = l, vif = NA, t = tval, p = 2 * pnorm(-abs(tval)),
        mean = as.numeric(item_means[[it]]), sd = as.numeric(item_sds[[it]]))
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

# ---- Structural paths: β + t/p + dual 95% CI (percentile + hand-rolled BC) + f² ----
bp <- sb$bootstrapped_paths       # rows "From  ->  To"
fsq <- s$fSquare                   # square matrix: fSquare[from, to]
estimate_paths <- list()
structural <- lapply(seq_along(path_from), function(e) {
  fr <- path_from_name[e]; to <- path_to_name[e]
  key <- paste0(fr, "  ->  ", to)
  beta <- as.numeric(bp[key, "Original Est."])
  estimate_paths[[length(estimate_paths) + 1]] <<- list(from = path_from[e], to = path_to[e], beta = beta)
  # bc_ci() (spliced in above from BC_CI_R) on this path's raw bootstrap draws — bo$boot_paths is a
  # [from, to, boot_index] 3D array (NOT the sb summary object, which only carries the percentile CI).
  bcc <- bc_ci(bo$boot_paths[fr, to, ], beta)
  list(
    path = paste0(fr, " → ", to),
    beta = beta,
    t = as.numeric(bp[key, "T Stat."]),
    p = 2 * pnorm(-abs(as.numeric(bp[key, "T Stat."]))),
    ciLower = as.numeric(bp[key, "2.5% CI"]),
    ciUpper = as.numeric(bp[key, "97.5% CI"]),
    ciBcLower = as.numeric(bcc[1]),
    ciBcUpper = as.numeric(bcc[2]),
    fSquare = as.numeric(fsq[fr, to])
  )
})

# ---- Q²_predict (PLSpredict, Shmueli et al. 2019; spike 0c §2 ruling) ----
# seminr has no $validity$q2 and blindfold() is absent under WebR. Compute Q²_predict per indicator as
# 1 − PLS_RMSE² / LM_RMSE² (out-of-sample); a construct's Q²_predict = mean over its indicators. predict_pls
# runs once; set.seed right before it makes the CV folds deterministic → WebR≡native parity. Only ENDOGENOUS
# indicators appear in the PLSpredict tables (exogenous have no out-of-sample column), so a missing item → NA.
q2_items <- tryCatch({
  set.seed(seed)
  pp <- predict_pls(pls)
  sp <- summary(pp)
  1 - sp$PLS_out_of_sample["RMSE", ]^2 / sp$LM_out_of_sample["RMSE", ]^2
}, error = function(e) NULL)

# ---- Structural quality: R² / R²adj / Q²_predict (per §5.2 — endogenous constructs only) ----
paths_tbl <- s$paths               # has "R^2" and "AdjR^2" rows; cols = endogenous constructs
endo <- colnames(paths_tbl)
r2_named <- list()
quality <- lapply(endo, function(nm) {
  r2v <- as.numeric(paths_tbl["R^2", nm]); r2a <- as.numeric(paths_tbl["AdjR^2", nm])
  cid <- path_to[match(nm, path_to_name)]
  if (!is.na(cid)) r2_named[[as.character(cid)]] <<- r2v
  # mean Q²_predict over this construct's indicators (NA if predict_pls failed or items absent)
  items_nm <- pls$mmMatrix[pls$mmMatrix[, "construct"] == nm, "measurement"]
  q2v <- if (is.null(q2_items)) NA else {
    vals <- q2_items[items_nm[items_nm %in% names(q2_items)]]
    if (length(vals) == 0) NA else mean(vals)
  }
  list(construct = nm, r2 = r2v, r2adj = r2a, q2 = q2v)
})

# ---- Indirect effects: every from->...->to with an intermediate, via specific_effect_significance ----
# specific_effect_significance returns a 1×7 MATRIX (class matrix/array/table_output) — a matrix has NO
# names(), only colnames(). Index by MATRIX COLUMN: sig[1, "Original Est."] etc. (sig["..."] is all-NA).
indirect <- list()
adj <- matrix(FALSE, k, k, dimnames = list(construct_names, construct_names))
# Interaction edges ("{iv}*{moderator}" -> target, U6-T4) are skipped: the interaction construct is not a
# dimname of adj, and a moderation term never participates in a mediation chain (no incoming paths).
for (e in seq_along(path_from_name)) {
  if (path_from_name[e] %in% construct_names && path_to_name[e] %in% construct_names) {
    adj[path_from_name[e], path_to_name[e]] <- TRUE
  }
}
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
        est = as.numeric(sig[1, "Original Est."]),
        se = as.numeric(sig[1, "Bootstrap SD"]),
        ciLower = as.numeric(sig[1, "2.5% CI"]),
        ciUpper = as.numeric(sig[1, "97.5% CI"]),
        t = as.numeric(sig[1, "T Stat."]),
        p = 2 * pnorm(-abs(as.numeric(sig[1, "T Stat."])))
      )
    }
  }
}

# ---- Simple slopes (U6-T5): -1SD/mean/+1SD conditional effects on each moderation edge, from the SAME
# bootstrap draws that produced the interaction path's own CI (bo$boot_paths, the same [from, to, boot_index]
# 3D array BC_CI_R reads above). mod_sd is the moderator's OBSERVED composite-score SD (pls$construct_scores) -
# PLS-PM's estimation algorithm scales every composite to unit variance by construction, so mod_sd is always
# ~1, but it is computed generically per Aiken & West (1991) applied to the composite/summed-indicator
# metric (the standard PLS treatment, since there is no latent-variance label to scale by as CB-SEM's lavaan
# ":=" form does). The level is fixed at the ORIGINAL mod_sd for every bootstrap draw (not re-derived per
# draw) - draws differ only in b_main/b_int, so the CI is a plain percentile interval (stats::quantile,
# matching seminr's OWN percentile-CI convention in conf_int(), confirmed via the installed package source)
# on the per-draw slope = b_main_draw + b_int_draw * level.
if (!exists('mod_ids', inherits = FALSE)) {
  mod_ids <- integer(0); mod_iv_name <- character(0); mod_name <- character(0)
  mod_int_name <- character(0); mod_target_name <- character(0)
}
slopes <- list()
if (length(mod_ids) > 0) {
  for (mi in seq_along(mod_ids)) {
    mod_sd <- stats::sd(pls$construct_scores[, mod_name[mi]])
    key_main <- paste0(mod_iv_name[mi], "  ->  ", mod_target_name[mi])
    key_int  <- paste0(mod_int_name[mi], "  ->  ", mod_target_name[mi])
    b_main <- as.numeric(bp[key_main, "Original Est."])
    b_int  <- as.numeric(bp[key_int, "Original Est."])
    main_draws <- bo$boot_paths[mod_iv_name[mi], mod_target_name[mi], ]
    int_draws  <- bo$boot_paths[mod_int_name[mi], mod_target_name[mi], ]
    levels <- c("-1SD" = -mod_sd, "mean" = 0, "+1SD" = mod_sd)
    for (lvl_name in names(levels)) {
      lvl <- levels[[lvl_name]]
      draws <- main_draws + int_draws * lvl
      se <- stats::sd(draws)
      qs <- stats::quantile(draws, probs = c(0.025, 0.975))
      slopes[[length(slopes) + 1]] <- list(
        modId = mod_ids[mi], level = lvl_name,
        b = b_main + b_int * lvl, se = se, t = (b_main + b_int * lvl) / se,
        p = 2 * min(mean(draws <= 0), mean(draws > 0)),
        ciLower = as.numeric(qs[1]), ciUpper = as.numeric(qs[2])
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
  slopes = slopes,
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

/** seminr `composite("Name", c("item",...), weights = mode_A|mode_B)` source line per construct.
 *  Uses the SANITIZED item name (itemNameOf) for the quoted string arguments too — seminr's composite()
 *  key must match `colnames(d_all)` exactly (also sanitized), even though these are string literals,
 *  not R identifiers, so the display name would technically parse fine but silently mismatch the data
 *  frame's columns for any item containing a space. */
function measurementLine(c: Construct, itemNameOf: (raw: string) => string): string {
  const items = `c(${c.items.map((it) => `"${itemNameOf(it)}"`).join(', ')})`
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

  // Sanitized R-side item identifiers: seminr's composite() item strings must match `colnames(d_all)`
  // exactly, and raw/display names can contain spaces (one call across ALL items so cross-construct
  // collisions after sanitizing still dedupe correctly, same approach as cfaReliability.ts/runCbSem.ts).
  const rAllItems = lvNames(allItems)
  const itemMap = new Map(allItems.map((raw, i) => [raw, rAllItems[i]]))
  const itemNameOf = (raw: string) => itemMap.get(raw) ?? raw
  const rawOfItem = new Map(rAllItems.map((san, i) => [san, allItems[i]])) // sanitized -> raw, for mapping R output back to display names

  const nboot = Number(setup.options['nboot'] ?? 5000)
  const fromName = (id: number) => byId.get(id)?.name ?? String(id)

  // U6-T4 moderation: seminr's interaction_term takes CONSTRUCT names directly (iv=/moderator=) - no
  // item-level product-indicator bookkeeping the way CB-SEM's indProd needs. The moderated path's source
  // construct (paths[m.pathIndex].from) is the iv; m.moderatorId resolves to the moderator; the
  // interaction's own construct name is always seminr's literal "{iv}*{moderator}" convention (confirmed
  // in the spike: "Image*Expectation") - no TS-side naming scheme needed. Each moderation contributes one
  // `interaction_term(...)` line (spliced into the SAME constructs(...) call as the composite() lines)
  // and one structural `paths(from="{iv}*{moderator}", to="{target}")` line, where {target} is the
  // ORIGINAL moderated path's target (paths[m.pathIndex].to) - mirroring the spike's mobi_sm exactly.
  const moderations = setup.moderations ?? []
  const modInteractions = moderations.map((m) => {
    const p = paths[m.pathIndex]
    const ivName = fromName(p.from)
    const modName = fromName(m.moderatorId)
    return { ivName, modName, name: `${ivName}*${modName}`, targetId: p.to, targetName: fromName(p.to) }
  })
  const modLines = modInteractions.map(
    ({ ivName, modName }) => `interaction_term(iv = "${ivName}", moderator = "${modName}", method = two_stage, weights = mode_A)`,
  )

  // seminr is lazy-installed (Engine.ensureSeminr — NOT part of init()'s eager preload). init() also applies
  // the detectCores + makeCluster serial shims that bootstrap_model needs under WASM (no sockets). Both must
  // run before the R block's library(seminr)/bootstrap_model; both are idempotent so this is safe per call.
  await engine.init()
  await engine.ensureSeminr()

  onProgress?.({ message: `Bootstrapping PLS-SEM (${nboot.toLocaleString()} resamples)…`, elapsedMs: 0 })

  const env = {
    item_cols_flat,
    all_items: rAllItems,
    n,
    // Moderation lines append (never replace) both the constructs(...) and relationships(...) source -
    // the interaction row then flows through the SAME path_from/path_to/*_name arrays and the structural
    // extraction loop below, right alongside every ordinary drawn path.
    mm_lines: [...constructs.map((c) => measurementLine(c, itemNameOf)), ...modLines],
    sm_lines: [
      ...paths.map((p) => structuralLine(fromName(p.from), fromName(p.to))),
      ...modInteractions.map((m) => structuralLine(m.name, m.targetName)),
    ],
    // Interaction "constructs" have no real numeric construct id; `-m.id` is a harmless, collision-free
    // sentinel for estimates.paths' `from` - used both to keep the sentinel unique across edges AND (U6-T5)
    // to pick the interaction path's own beta back out of estimate_paths for the canvas overlay below.
    path_from: [...paths.map((p) => p.from), ...moderations.map((m) => -m.id)],
    path_to: [...paths.map((p) => p.to), ...modInteractions.map((m) => m.targetId)],
    path_from_name: [...paths.map((p) => fromName(p.from)), ...modInteractions.map((m) => m.name)],
    path_to_name: [...paths.map((p) => fromName(p.to)), ...modInteractions.map((m) => m.targetName)],
    nboot,
    seed: 20260620,
    // The DRAWN construct names (same order as is_formative_flags) - the R block reports measurement/HTMT/
    // indirect over these only, excluding seminr's derived interaction constructs (see comment in R_STATS).
    construct_names_real: constructs.map((c) => c.name),
    // Per-construct flag (construct order) — never an empty array (webr 0.6.0 cannot convert []).
    is_formative_flags: constructs.map((c) => c.mode === 'formative'),
    // U6-T5 simple-slopes env - OMITTED entirely on a no-moderation run (never an empty JS array; webr's
    // env marshalling mis-detects [] as tabular row-object data, see moderationModel.ts's INDPROD_R comment
    // for the same guard on the CB-SEM side). R defines its own empty defaults when these are absent.
    ...(moderations.length
      ? {
          mod_ids: moderations.map((m) => m.id),
          mod_iv_name: modInteractions.map((m) => m.ivName),
          mod_name: modInteractions.map((m) => m.modName),
          mod_int_name: modInteractions.map((m) => m.name),
          mod_target_name: modInteractions.map((m) => m.targetName),
        }
      : {}),
  }

  const raw = await engine.runJson<PlsSemResult>(R_STATS(MAKECLUSTER_SHIM), env)

  // Restore raw/display item names: seminr's fitted model only ever saw the SANITIZED item token
  // (rAllItems, via itemNameOf above), so both item-level output surfaces -- the outer-model table's
  // `item` cell and the canvas overlay's estimates.loadings (keyed by SemCanvas against raw
  // Construct.items) -- need the sanitized->raw reverse map applied before they reach TS callers.
  const outer = raw.outer.map((row) => ({ ...row, item: rawOfItem.get(String(row.item)) ?? row.item }))
  const loadings = Object.fromEntries(
    Object.entries(raw.estimates.loadings).map(([k, v]) => [rawOfItem.get(k) ?? k, v]),
  )

  // Simple-slopes (U6-T5): TS-shape the R block's `slopes[]` with a human label ("<iv> -> <target> x
  // <moderator>", same convention as CbSemResult.SlopeRow.label), then render the SAME shared figure
  // CB-SEM uses (simpleSlopesPlot.ts) from those exact rows.
  const modLabelById = new Map(
    moderations.map((m, i) => [m.id, `${modInteractions[i].ivName} → ${modInteractions[i].targetName} × ${modInteractions[i].modName}`]),
  )
  const slopes = moderations.length && raw.slopes?.length
    ? raw.slopes.map((row): PlsSlopeRow => ({
        level: row.level, modId: row.modId, label: modLabelById.get(row.modId)!,
        b: row.b, se: row.se, t: row.t, p: row.p, ciLower: row.ciLower, ciUpper: row.ciUpper,
      }))
    : undefined
  const figModSlopesPng = await renderSimpleSlopesFigure(
    engine,
    (slopes ?? []).map((s) => ({ level: s.level, modId: s.modId, label: s.label, b: s.b, ciLower: s.ciLower, ciUpper: s.ciUpper })),
  )

  // Canvas moderation-arrow overlay (U6-T5, mirrors runCbSem.ts's estModeration): the interaction path's
  // own beta, keyed back to the moderatorId/pathIndex the canvas drew it with. estimate_paths carries one
  // entry per path_from/path_to pair in order, so the moderation edges are its LAST `moderations.length`
  // entries - found here by the negative `-m.id` sentinel rather than by position, so this stays correct
  // even if the R block's iteration order ever changes.
  const betaByNegId = new Map(raw.estimates.paths.filter((p) => p.from < 0).map((p) => [p.from, p.beta]))
  const estModeration = moderations.length
    ? moderations.map((m) => ({ moderatorId: m.moderatorId, pathIndex: m.pathIndex, beta: betaByNegId.get(-m.id)! }))
    : undefined

  // nboot is attached client-side (mirrors runCbSem.ts) — the R block itself never echoes it back.
  return {
    ...raw, outer, nboot, slopes, figModSlopesPng,
    estimates: { ...raw.estimates, loadings, moderation: estModeration },
  }
}
