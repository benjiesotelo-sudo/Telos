import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import type { TestSetup, Construct, StructuralPath, Moderation } from '../../state/session'
import type { RunProgress } from '../results/builders'
import { runCfaReliability, type CfaConstructResult } from './cfaReliability'
import { isSaturated } from './semSaturation'
import { lvNames } from './lvName'
import { semFitArgs, semFitMeasureNames, type SemFitArgs, type SemEstimator } from './semFitArgs'
import { semEndogeneity } from './semEndogeneity'
import {
  validateModerations, buildModerationLines, moderationIndProdEnv, INDPROD_R,
  MODERATION_DISCLOSURE, type ModerationDef,
} from './moderationModel'
import { renderInteractionPlotFigure, CB_INTERACTION_POINTS_R } from './interactionPlot'
import { EFA_STAGE_STATS_R, type EfaStageSuitability, type RawEfaStage } from './semEfaStage'
import { orderFactors } from './factorOrder'
import type { EfaLoadingRow } from './efa'

/** One interaction-term row per moderation (design §A7). `disclosure` is populated ONLY when
 *  `matched` is false (unequal indicator counts -> indProd(match=FALSE), see MODERATION_DISCLOSURE). */
export interface ModerationRow {
  moderatorName: string; pathLabel: string
  /** IV (source construct) display name, from ModerationDef.sourceDisplay (T5/R5, board-clearing
   *  slice): the measurement table labels the interaction construct's group header
   *  '<sourceDisplay>×<moderatorName> (product indicators)' - INT_<id> has no entry in the R side's
   *  con_ids/con_names display map, so its cfaLoadings rows come back with construct = null. */
  sourceDisplay: string
  b: number; se: number; z: number; p: number; stdBeta: number
  ciPercLower: number; ciPercUpper: number; ciBcLower: number; ciBcUpper: number
  matched: boolean; disclosure?: string
}

/** Simple slope at one of the three Aiken & West (1991) probing levels, from the `:=` defined
 *  parameter fit inside the SAME bootstrap run as the interaction term (design §A7 / U2-T5).
 *  `modId`/`label` disambiguate rows across MULTIPLE moderation edges (fix round, U5-T2 regression):
 *  with 2+ moderations, `moderation.slopes` holds 3 rows PER edge, all sharing the same 3 `level`
 *  values -- modId groups them back to their edge and label ("<pathLabel> × <moderatorName>",
 *  COMPOSED here because it is the slope row's only label field - unlike ModerationRow, which keeps
 *  pathLabel BARE and lets the builder compose) is what the figure facets on / the table shows when
 *  disambiguation is needed. Single-moderation callers ignore both fields (still just 3 rows). */
export interface SlopeRow {
  level: '-1SD' | 'mean' | '+1SD'
  modId: number; label: string
  b: number; se: number; p: number; z: number
  ciPercLower: number; ciPercUpper: number; ciBcLower: number; ciBcUpper: number
}

export interface CbSemResult {
  mode: 'full' | 'cfa-only' | 'path'
  saturated: boolean
  /** E1/E2 EFA preamble stage (R1, board-clearing slice): populated ONLY when the run's efa toggle
   *  was on (latent mode) - the builder renders Tables E1/E2 exactly when these are present, and
   *  omits them otherwise (the card note's promised behavior). Loading rows reuse the standalone EFA
   *  card's row shape (item + per-factor loadings + communality, factors in deterministic descending
   *  SS-loadings order via orderFactors, same as efa.ts). */
  efaSuitability?: EfaStageSuitability
  efaLoadings?: EfaLoadingRow[]
  cfaLoadings: Array<Record<string, unknown>>
  reliability: Array<Record<string, unknown>>
  fit?: Record<string, number>
  structural?: Array<Record<string, unknown>>
  rsquare?: Record<number, number>
  indirect?: Array<Record<string, unknown>>
  moderation?: { rows: ModerationRow[]; slopes: SlopeRow[] }
  /** Two-line interaction chart (R4, board-clearing slice - replaces the U5-T2 whisker figure),
   *  app-drawn via engine.capturePlot from R-computed predicted points that derive from the SAME fitted
   *  quantities as the conditional-effects table (identical numbers by construction). Present only when
   *  moderation ran; absent otherwise (optional FigureSpec). */
  figModSlopesPng?: Uint8Array
  fornellLarcker: number[][]
  htmt: number[][]
  corLvP: number[][]
  discriminantLabels: string[]
  /** Construct-level composite descriptives for the R11 combined correlation matrix (board-clearing
   *  slice, owner ruling - Huang Table 3 arrangement): per construct, the composite score of each case
   *  is the UNWEIGHTED mean of its raw items (rowMeans), computed on the listwise-complete rows over
   *  ALL used items - the SAME estimation sample cfaReliability.ts fits the discriminant matrices on -
   *  with n-1 sample SD (matches R's sd()). Construct order = discriminantLabels order. Pure TS
   *  assembly (computeConstructStats below), NO new R - the correlations + √AVE diagonal already live
   *  in fornellLarcker. Optional so existing hand-built CbSemResult fixtures need no change; the
   *  builder omits the table when absent. Empty/absent in path mode (no measurement model). */
  constructStats?: ConstructStat[]
  estimates: {
    paths: Array<{ from: number; to: number; beta: number }>
    loadings: Record<string, number>
    r2: Record<number, number>
    /** Canvas moderation-arrow overlay only (distinct from the top-level `moderation` reporting
     *  field above): one interaction beta per drawn moderation edge, keyed by moderatorId +
     *  pathIndex so SemCanvas can annotate the dashed arrow post-run. Populated by Task 5.3. */
    moderation?: Array<{ moderatorId: number; pathIndex: number; beta: number }>
  }
  itemStats: ItemStat[]
  /** The missing-data setting the run actually used (drives Table 1's item Mean/SD sample-size note,
   *  U3-T1). Optional so existing hand-built CbSemResult fixtures need no change; defaults to
   *  CB_SEM_DEFAULT_MISSING in the builder. */
  missing?: string
  /** The bootstrap resample count the run actually used (drives Table 5's Andrews & Buchinsky <7,000
   *  disclosure, U3-T3). Optional so existing hand-built CbSemResult fixtures need no change; defaults
   *  to 5000 in the builder (the app's own default). */
  nboot?: number
  /** Whether the R fit actually used se="bootstrap" -- true iff (hasIndirect || moderations present)
   *  AND the estimator is ML (H1 wiring: bootstrap runs under ML only, semFitArgs.ts's needsBootstrap;
   *  mirrors the runner's own `needsBootstrap` gate below EXACTLY; not recomputed independently).
   *  Drives Table 5's CI honesty (fix round, U3-T3): a direct-paths-only model, or any MLR/WLSMV model,
   *  never bootstraps, so its ciBcLower/ciBcUpper come back null and its ciPercLower/ciPercUpper are
   *  delta-method (Wald) CIs, not bootstrap percentile CIs -- the builder must not render fabricated BC
   *  values or claim a bootstrap provenance that never happened. Optional so existing hand-built
   *  CbSemResult fixtures need no change; defaults to true in the builder (matches every existing
   *  fixture, which is always bootstrap-shaped). */
  bootstrapped?: boolean
  /** The estimator the run actually used (H1 wiring, semFitArgs.ts). Optional so existing hand-built
   *  CbSemResult fixtures need no change; defaults to 'ML' in the builder (matches every existing
   *  fixture, which predates the estimator dropdown being wired). */
  estimator?: SemEstimator
  /** Raw indicator names lavaan treated as ordinal via `ordered = c(...)` -- non-empty only under
   *  WLSMV (the card discloses exactly which indicators were auto-declared, design §H1 ruling 2).
   *  Optional so existing hand-built CbSemResult fixtures need no change; defaults to an empty list. */
  orderedItems?: string[]
  /** Path mode only (Amendment B, docs/superpowers/specs/2026-07-11-path-mode-wlsmv-design.md): raw
   *  names of PLACED ordinal columns that are NOT endogenous in the drawn paths (no path's `to` is
   *  their construct id). lavaan only applies ordered-threshold semantics to endogenous variables --
   *  an exogenous ordinal column declared in `ordered=` produces a "no thresholds" warning and enters
   *  the fit numerically anyway (T1 spike evidence: estimates identical to ~9 sig figs with/without
   *  ordered= on an exogenous variable) -- so these are excluded from `orderedItems`/`ordered=c(...)`
   *  and disclosed separately here instead. Optional/absent so latent mode and every pre-Amendment-B
   *  fixture need no change; empty when every placed ordinal column happens to be endogenous. */
  exogenousOrdinals?: string[]
  /** What indirect/moderation CIs in this run actually are: 'bootstrap' (percentile/BCa, ML only) or
   *  'delta' (Wald, MLR/WLSMV -- mirrors `bootstrapped: false`'s CI-honesty contract above). Optional
   *  so existing hand-built CbSemResult fixtures need no change; defaults to 'bootstrap' in the builder. */
  ciMethod?: 'bootstrap' | 'delta'
}

export interface ItemStat { construct: string; item: string; mean: number; sd: number; n: number }
export interface ConstructStat { construct: string; mean: number; sd: number }

/** R11 combined correlation matrix's Mean/SD columns: one composite per construct = the unweighted
 *  mean of its raw items per case (rowMeans), over the given listwise-complete rows (see the
 *  CbSemResult.constructStats doc above for the full definition/provenance). */
export function computeConstructStats(
  constructs: Construct[],
  listwiseRows: Record<string, unknown>[],
): ConstructStat[] {
  return constructs.map((c) => {
    const composites = listwiseRows.map(
      (row) => c.items.reduce((sum, item) => sum + (row[item] as number), 0) / c.items.length,
    )
    const { mean, sd } = sampleMeanSd(composites)
    return { construct: c.name, mean, sd }
  })
}

function sampleMeanSd(values: number[]): { mean: number; sd: number } {
  const n = values.length
  const mean = values.reduce((a, b) => a + b, 0) / n
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) // matches R's sd() (n-1)
  return { mean, sd: Math.sqrt(variance) }
}

/** CB-SEM's default missing-data handling: listwise deletion, lavaan::sem()'s own default when no
 *  `missing=` argument is supplied. This is the single source of truth for that default: the UI's
 *  missing-data dropdown default (SemControls.tsx) and computeItemStats' own fallback (below) both
 *  read this constant, so an untouched dropdown never overstates what the model actually does.
 *  Selecting fiml/pairwise now genuinely changes the fit itself too (H1 wiring, semFitArgs.ts is the
 *  single source of truth for the estimator/missing argument fragment) -- not just Table 1 below. */
export const CB_SEM_DEFAULT_MISSING = 'listwise'

/** Table 1 item Mean/SD (design §A1). listwise → the SAME estimation-sample rows the model fit uses
 *  (single shared N); fiml/pairwise → each item's own observed (non-null, finite) values from the
 *  RAW dataset, independent per item (N varies by item). The model fit itself now honors this SAME
 *  missing setting too (H1 wiring, semFitArgs.ts): fiml/pairwise both flow into lavaan's own `missing=`
 *  handling, not just this display table. */
export function computeItemStats(
  data: Dataset,
  constructs: Construct[],
  listwiseRows: Record<string, unknown>[],
  missing: string,
): ItemStat[] {
  const useListwise = missing === 'listwise'
  return constructs.flatMap((c) =>
    c.items.map((item) => {
      const values = useListwise
        ? (listwiseRows.map((r) => r[item]) as number[])
        : (data.rows.map((r) => r[item]).filter(
            (v): v is number => typeof v === 'number' && Number.isFinite(v),
          ))
      const { mean, sd } = sampleMeanSd(values)
      return { construct: c.name, item, mean, sd, n: values.length }
    }),
  )
}

// Resolve the structural mode (design §3.4). The optional EFA preamble stage is orthogonal to this
// mode (its own gated engine call below, R1 board-clearing slice); the stats core always fits CFA +
// structure for 'full', CFA-only when structure is off, observed-only for 'path'.
type Mode = 'full' | 'cfa-only' | 'path'
function resolveMode(setup: TestSetup): Mode {
  if (setup.modelKind === 'path') return 'path'
  if ((setup.paths?.length ?? 0) === 0) return 'cfa-only'
  return 'full'
}

// Listwise-delete rows where any used column is not a finite number.
function listwise(data: Dataset, cols: string[]): Record<string, unknown>[] {
  return data.rows.filter((row) =>
    cols.every((c) => typeof row[c] === 'number' && Number.isFinite(row[c] as number)),
  )
}

// R block. Env bindings:
//   model_str    character(1): the full lavaan model (=~ measurement [non-path], ~ structural, := indirect defs)
//   item_cols_flat numeric: all used columns concatenated column-major
//   all_cols     character: column names matching item_cols_flat order
//   n            integer: rows after listwise deletion
//   path_from / path_to   integer: structural path construct-ids (parallel; one per ~ path), display order
//   con_ids / con_names   integer / character: construct id↔name map (for id-keyed rsquare + structural rows).
//     con_names are SANITIZED R identifiers (lvName) matching the model tokens; con_display carries the
//     original user-typed display names (same order) for every UI-facing name in the returned tables.
//   has_indirect logical(1): whether bootstrap SE/CI is needed -- true when a := indirect def exists
//     OR when any moderation is present (moderation ALWAYS bootstraps, design §A7; the TS call site
//     widens this beyond a literal "has an indirect chain" reading, name kept for minimal diff) --
//     now gated additionally on the estimator being ML (H1 wiring: bootstrap runs under ML only,
//     semFitArgs.ts's needsBootstrap). Dual CIs (percentile + bca.simple) are computed unconditionally
//     from the SAME bootstrap draws whenever has_indirect is true.
//   nboot        integer: bootstrap resamples (single awaited call)
//   is_path      logical(1): observed-only mode (no =~; suppress loadings/reliability)
//   mod_ids etc. numeric/character: moderation env (see moderationIndProdEnv) -- empty on non-moderation runs
//
// standardizedSolution(): est.std/se/z/pvalue/ci.lower/ci.upper (point-only; unaffected by CI-type
// choice). parameterEstimates() is called TWICE on the same fitted object -- once with
// boot.ci.type="perc", once with "bca.simple" -- to supply both CI columns on the UNSTANDARDIZED
// structural/indirect estimates; this recomputes CIs from the bootstrap draws already stored on
// fit@boot, so it does not re-run the bootstrap ("ONE bootstrap run" per spec). lavInspect(fit,'rsquare')
// gives endogenous R² by latent name.
/** Estimator-conditional fit-index extraction (H1 wiring; spike-verified key names, docs/superpowers/
 *  reviews/2026-07-10-h1-estimator-spike.md Q1). ML has no `.scaled`/`.robust` suffixed names at all.
 *  MLR exposes BOTH families, populated -- this uses `.robust` for cfi/tli/rmsea (chisq/df/pvalue only
 *  ever exist as `.scaled`; lavaan never publishes a `chisq.robust`). WLSMV's `.robust` keys EXIST but
 *  are ALWAYS NA (spike-verified), so WLSMV uses the `.scaled` family throughout. Every branch maps its
 *  estimator-specific names back onto the SAME stable fit_list keys (chisq/df/pvalue/cfi/tli/rmsea/
 *  rmseaLower/rmseaUpper/srmr) so the builder's shape never changes across estimators; fit_list$robust
 *  flags the non-ML branches for the builder's estimator-aware labeling (a later task). The ML branch's
 *  text is BYTE-IDENTICAL to the pre-H1 script (fixtures/runCbSemPreH1.r.txt) -- the default cell must
 *  never change. */
function fitListBlock(estimator: SemEstimator): string {
  // Names sourced from semFitArgs.ts's semFitMeasureNames - the SAME estimator-conditional list the
  // export emitter's Table 5 fit block consumes (H1 wiring final-review fix, Important I1), so an
  // exported script prints the identical scaled/robust measures this card shows.
  const [chisqN, dfN, pvalueN, cfiN, tliN, rmseaN, rmseaLowerN, rmseaUpperN, srmrN] = semFitMeasureNames(estimator).request
  if (estimator === 'ML') {
    return String.raw`fm <- lavaan::fitMeasures(fit, c("${chisqN}","${dfN}","${pvalueN}","${cfiN}","${tliN}","${rmseaN}",
                                 "${rmseaLowerN}","${rmseaUpperN}","${srmrN}"))
fit_list <- list(
  chisq = as.numeric(fm["${chisqN}"]), df = as.numeric(fm["${dfN}"]), pvalue = as.numeric(fm["${pvalueN}"]),
  cfi = as.numeric(fm["${cfiN}"]), tli = as.numeric(fm["${tliN}"]), rmsea = as.numeric(fm["${rmseaN}"]),
  rmseaLower = as.numeric(fm["${rmseaLowerN}"]), rmseaUpper = as.numeric(fm["${rmseaUpperN}"]),
  srmr = as.numeric(fm["${srmrN}"])
)`
  }
  return String.raw`fm <- lavaan::fitMeasures(fit, c("${chisqN}","${dfN}","${pvalueN}","${cfiN}",
                                 "${tliN}","${rmseaN}","${rmseaLowerN}","${rmseaUpperN}","${srmrN}"))
fit_list <- list(
  chisq = as.numeric(fm["${chisqN}"]), df = as.numeric(fm["${dfN}"]), pvalue = as.numeric(fm["${pvalueN}"]),
  cfi = as.numeric(fm["${cfiN}"]), tli = as.numeric(fm["${tliN}"]), rmsea = as.numeric(fm["${rmseaN}"]),
  rmseaLower = as.numeric(fm["${rmseaLowerN}"]), rmseaUpper = as.numeric(fm["${rmseaUpperN}"]),
  srmr = as.numeric(fm["${srmrN}"])
)
fit_list$robust <- TRUE`
}

// R script factory (H1 wiring): the estimator/missing/ordered argument fragment and the fit-index
// extraction both come from the SAME SemFitArgs the export emitter consumes (semFitArgs.ts), so app and
// export stay byte-identical by construction. `frag` is '' exactly for ML + listwise (the byte-pin) --
// both sem() lines below then read identically to the pre-H1 script.
const rStats = (fitArgs: SemFitArgs): string => {
  const frag = fitArgs.fragment ? ', ' + fitArgs.fragment : ''
  const fitBlock = fitListBlock(fitArgs.estimator)
  return String.raw`
library(lavaan)

p_all <- length(all_cols)
d <- as.data.frame(lapply(seq_len(p_all), function(i) item_cols_flat[((i - 1) * n + 1):(i * n)]))
colnames(d) <- all_cols

# Latent moderation (design §A7): fold double-mean-centered product-indicator columns into d BEFORE
# the fit, one indProd() call per moderation edge. No-op (mod_ids empty) on every non-moderation run.
${INDPROD_R}

# Single awaited fit with bootstrap SE/CI for mediation (no RNG chunking — preserves WebR≡native parity).
gc()
set.seed(20260620)
if (has_indirect) {
  fit <- lavaan::sem(model_str, data = d, se = "bootstrap", bootstrap = as.integer(nboot)${frag})
  pe_perc <- lavaan::parameterEstimates(fit, boot.ci.type = "perc", level = 0.95)
  pe_bc   <- lavaan::parameterEstimates(fit, boot.ci.type = "bca.simple", level = 0.95)
  pe <- pe_perc # pe stays the primary table (est/se/z/p unaffected by CI-type choice)
} else {
  fit <- lavaan::sem(model_str, data = d${frag})
  pe <- lavaan::parameterEstimates(fit, level = 0.95)
  pe_bc <- pe # no bootstrap -> no distinct BC column; ci.lower/upper below are simply absent (NA)
}
gc()

ss <- lavaan::standardizedSolution(fit)
df_val <- as.numeric(lavaan::fitMeasures(fit, "df"))

# id↔name lookup
name2id <- setNames(as.integer(con_ids), con_names)

# --- Fit indices (always computed; builder/emitter suppress when df==0) ---
${fitBlock}

# --- CFA loadings (measurement; empty in path mode) ---
if (is_path) {
  cfa_rows <- list()
} else {
  load_idx <- which(ss$op == "=~")
  pe_load  <- pe[pe$op == "=~", ]
  cfa_rows <- lapply(load_idx, function(i) {
    lhs <- ss$lhs[i]; rhs <- ss$rhs[i]
    m <- which(pe_load$lhs == lhs & pe_load$rhs == rhs)[1]
    list(
      construct = con_display[match(lhs, con_names)], item = rhs,
      b = as.numeric(pe_load$est[m]), se = as.numeric(pe_load$se[m]),
      z = as.numeric(pe_load$z[m]), p = as.numeric(pe_load$pvalue[m]),
      stdLoading = as.numeric(ss$est.std[i]),
      rhs = rhs
    )
  })
}

# --- Structural paths (id-keyed from/to, display order from path_from/path_to) ---
reg_idx <- which(ss$op == "~")
pe_reg  <- pe[pe$op == "~", ]
pe_bc_reg <- pe_bc[pe_bc$op == "~", ]
rsq <- tryCatch(lavInspect(fit, "rsquare"), error = function(e) numeric(0))
struct_rows <- lapply(seq_along(path_from), function(k) {
  fid <- as.integer(path_from[k]); tid <- as.integer(path_to[k])
  fnm <- con_names[match(fid, con_ids)]; tnm <- con_names[match(tid, con_ids)]
  i <- which(ss$lhs[reg_idx] == tnm & ss$rhs[reg_idx] == fnm)[1]
  gi <- reg_idx[i]
  m <- which(pe_reg$lhs == tnm & pe_reg$rhs == fnm)[1]
  mb <- which(pe_bc_reg$lhs == tnm & pe_bc_reg$rhs == fnm)[1]
  r2_val <- if (tnm %in% names(rsq)) as.numeric(rsq[tnm]) else NA_real_
  list(
    from = fid, to = tid,
    fromName = con_display[match(fid, con_ids)], toName = con_display[match(tid, con_ids)],
    b = as.numeric(pe_reg$est[m]), se = as.numeric(pe_reg$se[m]),
    z = as.numeric(pe_reg$z[m]), p = as.numeric(pe_reg$pvalue[m]),
    stdBeta = as.numeric(ss$est.std[gi]),
    ciLower = as.numeric(ss$ci.lower[gi]), ciUpper = as.numeric(ss$ci.upper[gi]),
    ciPercLower = as.numeric(pe_reg$ci.lower[m]), ciPercUpper = as.numeric(pe_reg$ci.upper[m]),
    ciBcLower = if (has_indirect) as.numeric(pe_bc_reg$ci.lower[mb]) else NA_real_,
    ciBcUpper = if (has_indirect) as.numeric(pe_bc_reg$ci.upper[mb]) else NA_real_,
    r2 = r2_val
  )
})

# R² by construct id (endogenous only)
rsq_ids <- list()
for (nm in names(rsq)) {
  if (nm %in% names(name2id)) rsq_ids[[as.character(name2id[[nm]])]] <- as.numeric(rsq[nm])
}

# --- Indirect effects (:= defined; bootstrap percentile + bca.simple CIs from the same run) ---
# Filtered to the "ie_" label prefix ONLY -- moderation's own := defs ("slope_lo_<id>" etc., extracted
# separately below into moderation.slopes) must NOT be conflated into this table (design §A7/U2-T5).
ind_idx <- which(pe$op == ":=" & grepl("^ie_", pe$lhs))
ss_def  <- ss[ss$op == ":=", ]
pe_bc_def <- pe_bc[pe_bc$op == ":=", ]
indirect_rows <- lapply(ind_idx, function(i) {
  lbl <- pe$lhs[i]
  sm <- which(ss_def$lhs == lbl)[1]
  mb <- which(pe_bc_def$lhs == lbl)[1]
  list(
    label = lbl,
    est = as.numeric(pe$est[i]),
    stdEst = if (length(sm)) as.numeric(ss_def$est.std[sm]) else NA_real_,
    se = as.numeric(pe$se[i]),
    ciLower = as.numeric(pe$ci.lower[i]),
    ciUpper = as.numeric(pe$ci.upper[i]),
    ciPercLower = as.numeric(pe$ci.lower[i]), ciPercUpper = as.numeric(pe$ci.upper[i]),
    ciBcLower = if (has_indirect) as.numeric(pe_bc_def$ci.lower[mb]) else NA_real_,
    ciBcUpper = if (has_indirect) as.numeric(pe_bc_def$ci.upper[mb]) else NA_real_,
    p = as.numeric(pe$pvalue[i])
  )
})

# --- Moderation: one interaction-term row per moderation edge, plus its three := simple-slope rows
# (-1SD/mean/+1SD, design §A7/U2-T5). Matched by structural NAME (target/predictor), same convention
# as struct_rows above -- NOT by lavaan label, matching the existing struct_rows lookup style. Bootstrap
# columns (pe/pe_bc) are indexed by structural name here too, never by ParTable row position (the
# moderation spike's real footgun -- see docs/superpowers/reviews/2026-07-06-moderation-spike.md §5.3).
# ciBc* are guarded by has_indirect exactly like struct_rows/indirect_rows above (H1 wiring: moderation
# under MLR is legal but never bootstraps, so pe_bc is just pe aliased back -- Wald CIs, not BC -- and
# must read as NA here, not silently masquerade as a bootstrap BC interval).
mod_rows <- list()
slope_rows <- list()
if (length(mod_ids) > 0) {
  for (mi in seq_along(mod_ids)) {
    mid <- mod_ids[mi]
    tnm <- mod_target[mi]
    intnm <- paste0("INT_", mid)
    gi <- which(ss$lhs == tnm & ss$rhs == intnm & ss$op == "~")[1]
    m  <- which(pe$lhs == tnm & pe$rhs == intnm & pe$op == "~")[1]
    mb <- which(pe_bc$lhs == tnm & pe_bc$rhs == intnm & pe_bc$op == "~")[1]
    mod_rows[[mi]] <- list(
      id = as.integer(mid),
      b = as.numeric(pe$est[m]), se = as.numeric(pe$se[m]),
      z = as.numeric(pe$z[m]), p = as.numeric(pe$pvalue[m]),
      stdBeta = as.numeric(ss$est.std[gi]),
      ciPercLower = as.numeric(pe$ci.lower[m]), ciPercUpper = as.numeric(pe$ci.upper[m]),
      ciBcLower = if (has_indirect) as.numeric(pe_bc$ci.lower[mb]) else NA_real_,
      ciBcUpper = if (has_indirect) as.numeric(pe_bc$ci.upper[mb]) else NA_real_
    )
    for (lvl in c("lo", "mid", "hi")) {
      lbl <- paste0("slope_", lvl, "_", mid)
      i  <- which(pe$lhs == lbl & pe$op == ":=")[1]
      ib <- which(pe_bc$lhs == lbl & pe_bc$op == ":=")[1]
      if (!is.na(i)) slope_rows[[length(slope_rows) + 1]] <- list(
        modId = as.integer(mid), level = lvl,
        est = as.numeric(pe$est[i]), se = as.numeric(pe$se[i]),
        z = as.numeric(pe$z[i]), p = as.numeric(pe$pvalue[i]),
        ciPercLower = as.numeric(pe$ci.lower[i]), ciPercUpper = as.numeric(pe$ci.upper[i]),
        ciBcLower = if (has_indirect) as.numeric(pe_bc$ci.lower[ib]) else NA_real_,
        ciBcUpper = if (has_indirect) as.numeric(pe_bc$ci.upper[ib]) else NA_real_
      )
    }
  }
}

# --- Estimates block for the canvas overlay (loadings keyed by item name) ---
est_loadings <- list()
if (!is_path) {
  for (i in load_idx) est_loadings[[ss$rhs[i]]] <- as.numeric(ss$est.std[i])
}
est_paths <- lapply(struct_rows, function(r) list(from = r$from, to = r$to, beta = r$stdBeta))

# Canvas moderation-arrow overlay (Task 5.3): one interaction beta per moderation edge, in mod_ids
# order (the SAME id ordering moderations[] uses TS-side -- see moderationIndProdEnv). INT_<mid> is
# the interaction construct's R-side name per moderationModel.ts's buildModerationLines. R only
# computes the beta; moderatorId/pathIndex are filled TS-side by zipping this array against
# moderationDefs, mirroring how est_paths above is derived from struct_rows rather than requiring R to
# know about canvas ids.
est_moderation <- list()
if (length(mod_ids) > 0) {
  for (mi in seq_along(mod_ids)) {
    int_name <- paste0("INT_", mod_ids[mi])
    gi <- which(ss$op == "~" & ss$rhs == int_name)[1]
    est_moderation[[mi]] <- list(beta = as.numeric(ss$est.std[gi]))
  }
}

# --- Interaction-plot predicted points (R4): outcome at IV -1SD/+1SD x moderator -1SD/+1SD, from the
# SAME fitted quantities as the slope := defs (pe) - the chart cannot disagree with Table 6 ---
${CB_INTERACTION_POINTS_R}
plot_rows <- list()
if (length(mod_ids) > 0) {
  for (mi in seq_along(mod_ids)) plot_rows[[mi]] <- list(
    modId = as.integer(mod_ids[mi]),
    yLoLo = ip_y_lo_lo[mi], yHiLo = ip_y_hi_lo[mi], yLoHi = ip_y_lo_hi[mi], yHiHi = ip_y_hi_hi[mi]
  )
}

list(
  fit = fit_list,
  df = df_val,
  cfaLoadings = cfa_rows,
  structural = struct_rows,
  rsquareIds = rsq_ids,
  indirect = indirect_rows,
  moderationRows = mod_rows,
  slopeRows = slope_rows,
  estLoadings = est_loadings,
  estPaths = est_paths,
  estModeration = est_moderation,
  plotPoints = plot_rows
)
`
}

/** Build the full lavaan model string: =~ measurement (latent only) + ~ structural + auto := indirect defs.
 *  rNameOf gives the SANITIZED lavaan identifier per construct id (display names with spaces are illegal
 *  `=~`/`~` tokens); chainNames stay DISPLAY names — they feed the UI-facing indirect-effect labels only. */
export function buildModel(
  constructs: Construct[],
  paths: StructuralPath[],
  isPath: boolean,
  rNameOf: (id: number) => string,
  moderations: Moderation[] = [],
  /** Maps a raw/display item name to its sanitized R-side identifier (lvNames-derived; display names
   *  with spaces are illegal `=~` RHS tokens). Defaults to identity so the export emitter's existing
   *  call site (item-level export sanitization is a separate follow-on task) is unaffected. */
  itemNameOf: (raw: string) => string = (raw) => raw,
): {
  model: string
  hasIndirect: boolean
  indirectDefs: Array<{ label: string; chainNames: string[] }>
  moderationDefs: ModerationDef[]
} {
  const byId = new Map(constructs.map((c) => [c.id, c]))
  const nameOf = (id: number) => byId.get(id)!.name
  const lines: string[] = []

  // Measurement model (latent mode only; path mode regresses observed columns directly)
  if (!isPath) {
    for (const c of constructs) lines.push(`${rNameOf(c.id)} =~ ${c.items.map(itemNameOf).join(' + ')}`)
  }

  // Structural model: one regression per endogenous target, predictors labeled for := defs.
  // Label scheme: p_<from>_<to> so chained paths can be multiplied into indirect effects.
  const targets = [...new Set(paths.map((p) => p.to))]
  for (const t of targets) {
    const preds = paths.filter((p) => p.to === t)
    const rhs = preds.map((p) => `p_${p.from}_${p.to}*${rNameOf(p.from)}`).join(' + ')
    lines.push(`${rNameOf(t)} ~ ${rhs}`)
  }

  // Auto indirect defs: every chained A→B→C (a path whose target is itself a source) → := a*b.
  // Capture the construct-name chain alongside each := label so the builder can render NAMES, not ids.
  const sources = new Set(paths.map((p) => p.from))
  const indirectDefs: Array<{ label: string; chainNames: string[] }> = []
  for (const ab of paths) {
    if (!sources.has(ab.to)) continue // ab.to is not a mediator
    for (const bc of paths.filter((p) => p.from === ab.to)) {
      const label = `ie_${ab.from}_${ab.to}_${bc.to}`
      lines.push(`${label} := p_${ab.from}_${ab.to}*p_${bc.from}_${bc.to}`)
      indirectDefs.push({ label, chainNames: [nameOf(ab.from), nameOf(ab.to), nameOf(bc.to)] })
    }
  }

  // Latent moderation (design §A7): guards from moderationModel.ts, then the interaction construct +
  // auto-injected moderator main effect + variance lines, spliced onto the existing structural target
  // lines assembled above. `buildModel` delegates to the shared module so the SAME text also feeds the
  // cb-sem R-script export emitter later (export ≡ app, one source of truth).
  validateModerations(moderations, paths, isPath)
  const { lines: modLines, moderationDefs, targetLineExtras } = buildModerationLines(constructs, paths, rNameOf, moderations, itemNameOf)
  for (const [pathIndex, extra] of targetLineExtras) {
    const path = paths[pathIndex]
    const targetLineIdx = lines.findIndex((l) => l.startsWith(`${rNameOf(path.to)} ~ `))
    lines[targetLineIdx] += extra
  }
  lines.push(...modLines)

  return { model: lines.join('\n'), hasIndirect: indirectDefs.length > 0, indirectDefs, moderationDefs }
}

interface RawModerationRow {
  id: number; b: number; se: number; z: number; p: number; stdBeta: number
  ciPercLower: number; ciPercUpper: number; ciBcLower: number; ciBcUpper: number
}
interface RawSlopeRow {
  modId: number; level: 'lo' | 'mid' | 'hi'
  est: number; se: number; z: number; p: number
  ciPercLower: number; ciPercUpper: number; ciBcLower: number; ciBcUpper: number
}

interface RawResult {
  fit: Record<string, number>
  df: number
  cfaLoadings: Array<Record<string, unknown>>
  structural: Array<Record<string, unknown>>
  rsquareIds: Record<string, number>
  indirect: Array<Record<string, unknown>>
  moderationRows: RawModerationRow[]
  slopeRows: RawSlopeRow[]
  estLoadings: Record<string, number>
  estPaths: Array<{ from: number; to: number; beta: number }>
  /** One entry per moderation edge, in mod_ids order (see moderationIndProdEnv). Absent from older/
   *  mocked fixtures that predate Task 5.3 -- optional so those keep passing unmodified. */
  estModeration?: Array<{ beta: number }>
  /** R4 interaction-plot points: one entry per moderation edge, in mod_ids order (like estModeration).
   *  The four predicted outcomes at IV -1SD/+1SD x moderator -1SD/+1SD (CB_INTERACTION_POINTS_R).
   *  Optional so older/mocked fixtures degrade to "no figure" instead of throwing. */
  plotPoints?: Array<{ modId: number; yLoLo: number; yHiLo: number; yLoHi: number; yHiHi: number }>
}

const SLOPE_LEVEL: Record<RawSlopeRow['level'], SlopeRow['level']> = { lo: '-1SD', mid: 'mean', hi: '+1SD' }

export async function runCbSem(
  engine: Engine,
  data: Dataset,
  setup: TestSetup,
  onProgress?: RunProgress,
  /** Raw dataset column name -> Configure-data measurement level (any string; only 'ordinal' matters
   *  here). Covers the WHOLE dataset, not just this model's used columns -- the runner filters down to
   *  usedCols itself before handing indicatorLevels to semFitArgs (an ordinal column outside this model
   *  must never leak into lavaan's `ordered = c(...)`). Optional, defaults to empty: with no known
   *  levels WLSMV's own guard correctly refuses ("at least one ordinal indicator") rather than silently
   *  guessing. Wired in production by session.ts's runAll (ColumnMeta[] -> name->level map) through
   *  builders.ts's Runner 5th argument. */
  columnLevels: Record<string, string> = {},
): Promise<CbSemResult> {
  const mode = resolveMode(setup)
  const isPath = mode === 'path'
  const constructs = setup.constructs ?? []
  const paths = setup.paths ?? []

  // Sanitized R identifiers per construct (display names with spaces are illegal lavaan tokens);
  // deduped deterministically in construct order. Display names stay UI-only (con_display below).
  const rNames = lvNames(constructs.map((c) => c.name))
  const rNameById = new Map(constructs.map((c, i) => [c.id, rNames[i]]))
  const rNameOf = (id: number) => rNameById.get(id)!

  // Used columns: items in latent mode; the construct "names" ARE the observed columns in path mode.
  const usedCols = isPath
    ? [...new Set(constructs.map((c) => c.name))]
    : [...new Set(constructs.flatMap((c) => c.items))]
  const missingSetting = String(setup.options['missing'] ?? CB_SEM_DEFAULT_MISSING)

  // Path mode: construct.name -> construct (id = the column's placed index, per withPathModeConstructs)
  // so a raw used column resolves back to the SAME construct token rCols/rNameOf produce below.
  const constructByName = new Map(constructs.map((c) => [c.name, c]))

  // Sanitized R-side item identifiers (lavaan `=~` RHS tokens are illegal with spaces), one call across
  // ALL used items so cross-construct collisions after sanitizing still dedupe correctly (same approach
  // as cfaReliability.ts); empty in path mode, where usedCols already holds sanitized construct names,
  // not items.
  //
  // itemNameOf must map a raw used column to whatever sanitized token the FITTED DATA FRAME actually
  // uses for that column: latent mode's data frame columns are the sanitized ITEM tokens (rItemNames);
  // path mode's data frame columns are the sanitized CONSTRUCT tokens (rCols, via rNameOf) -- identity
  // is wrong there (the H1-ledgered naming mismatch: semFitArgs' orderedR is built by mapping
  // orderedRaw through this function, so an identity itemNameOf would carry RAW column names into
  // `ordered = c(...)` while the data frame's columns are sanitized). Falls back to identity for
  // anything outside usedCols (defensive; shouldn't happen since usedCols is exactly the item/column
  // universe in either mode).
  const rItemNames = isPath ? [] : lvNames(usedCols)
  const itemMap = new Map(usedCols.map((raw, i) => [raw, rItemNames[i]]))
  const itemNameOf = isPath
    ? (raw: string) => rNameOf(constructByName.get(raw)!.id)
    : (raw: string) => itemMap.get(raw) ?? raw
  const rawOfItem = new Map(rItemNames.map((san, i) => [san, usedCols[i]])) // sanitized -> raw, for mapping R output back to display names

  // R-side column names: in path mode the model tokens are the SANITIZED construct names; latent mode
  // uses the SANITIZED item columns (matching the measurement model's =~ RHS built via itemNameOf below).
  const rCols = isPath
    ? usedCols.map((col) => rNameOf(constructByName.get(col)!.id))
    : rItemNames

  const { model, hasIndirect, indirectDefs, moderationDefs } = buildModel(constructs, paths, isPath, rNameOf, setup.moderations ?? [], itemNameOf)

  // Fit parameterization (H1 wiring, docs/superpowers/specs/2026-07-10-h1-estimator-missing-wiring-
  // design.md): semFitArgs.ts is the SINGLE source of truth for estimator/missing/ordered, shared with
  // the export emitter, so app and export arguments are byte-identical by construction. All guards
  // (FIML needs ML-family, WLSMV needs >=1 ordinal indicator, moderation forces ML-family, MLR rejects
  // pairwise) live there and throw synchronously here, before any engine call -- replaces the old
  // inline moderation-WLSMV-only throw. indicatorLevels is filtered to usedCols (path mode: the
  // observed columns; latent mode: the items) so a dataset column outside this model never reaches
  // lavaan's `ordered = c(...)`.
  //
  // Amendment B (path mode only): the exogenous-ordinal downgrade + disclosure derivation lives in
  // semEndogeneity.ts (T11/R13) - the ONE source shared with the export emitter, so app and export
  // downgrade the SAME columns by construction. Latent mode is unaffected (untouched H1 behavior).
  const { indicatorLevels, exogenousOrdinals } = semEndogeneity({
    isPath, constructs, paths, domain: usedCols, columnLevels,
  })
  const fitArgs = semFitArgs({
    estimator: String(setup.options['estimator'] ?? 'ML'),
    missing: missingSetting,
    indicatorLevels,
    itemNameOf,
    hasModeration: moderationDefs.length > 0,
    wantsBootstrap: hasIndirect || moderationDefs.length > 0,
  })

  // Data path (H1 wiring): listwise stays the shared estimation-sample rows; fiml/pairwise pass the
  // FULL rows (with genuine holes) so lavaan's own `missing=` handling actually runs on incomplete
  // cases instead of this runner silently listwise-deleting them first. A JS NaN placed in a numeric env
  // array marshals to R as a proper NA -- the SAME mechanism engine.runJson uses in production, not a
  // test-only path (spike-verified, docs/superpowers/reviews/2026-07-10-h1-estimator-spike.md Q5).
  // computeItemStats keeps receiving the LISTWISE rows for its own listwise branch regardless of the
  // fit's missing setting (Table 1 display concern, computed separately from the fit's rows).
  const listwiseRows = listwise(data, usedCols)
  const rows = fitArgs.passFullRows ? data.rows : listwiseRows
  const n = rows.length
  const item_cols_flat = usedCols.flatMap((col) =>
    rows.map((r) => {
      const v = r[col]
      return typeof v === 'number' && Number.isFinite(v) ? v : NaN
    }),
  )
  const itemStats = isPath ? [] : computeItemStats(data, constructs, listwiseRows, fitArgs.missing)
  // R11: composite Mean/SD always on the LISTWISE rows (the discriminant matrices' own CFA sample,
  // cfaReliability.ts), independent of the fit's missing setting - unlike itemStats' per-item branch.
  const constructStats = isPath ? undefined : computeConstructStats(constructs, listwiseRows)

  const nboot = Number(setup.options['nboot'] ?? 5000)

  // EFA preamble stage (R1, board-clearing slice): its own SEPARATE engine call, gated on the card's
  // efa toggle and latent mode, so the byte-pinned main R block below never changes shape. Always runs
  // on the LISTWISE rows regardless of the fit's own missing setting (cor()/psych::fa need complete
  // cases - the same sample rule the standalone EFA card applies). Factor count = number of constructs;
  // factors reordered TS-side by descending SS-loadings (orderFactors, the deterministic display rule
  // shared with efa.ts), items mapped back to their raw display names.
  let efaSuitability: EfaStageSuitability | undefined
  let efaLoadings: EfaLoadingRow[] | undefined
  if (!isPath && Boolean(setup.options['efa'])) {
    onProgress?.({ message: 'Running the EFA stage (KMO, Bartlett, rotated loadings)…' })
    const efaN = listwiseRows.length
    const efa_cols_flat = usedCols.flatMap((col) => listwiseRows.map((r) => r[col] as number))
    const rawEfa = await engine.runJson<RawEfaStage>(EFA_STAGE_STATS_R, {
      efa_cols_flat, efa_items: rItemNames, efa_n: efaN, efa_k: constructs.length,
    })
    // .telos_json flattens an R length-1 vector to a bare scalar (engine.ts) - normalize.
    const asArray = (v: number[] | number): number[] => (Array.isArray(v) ? v : [v])
    const loadMat = asArray(rawEfa.loadMat)
    const h2Vec = asArray(rawEfa.h2Vec)
    const order = orderFactors(asArray(rawEfa.ssPerFactor))
    const p = usedCols.length
    efaSuitability = {
      kmo: rawEfa.kmo, bartlettChisq: rawEfa.bartlettChisq,
      bartlettDf: rawEfa.bartlettDf, bartlettP: rawEfa.bartlettP,
    }
    efaLoadings = usedCols.map((item, ri) => ({
      item, // raw display name - usedCols order is exactly the R block's efa_items (rItemNames) order
      loadings: order.map((fi) => loadMat[fi * p + ri]),
      communality: h2Vec[ri],
    }))
  }

  // Bootstrap runs under estimator ML only (H1 wiring ruling 3); MLR/WLSMV report their own robust SEs
  // and delta-method CIs for indirect effects/moderation, flowing through the EXISTING bootstrapped:false
  // machinery below. moderationDefs.length is folded into wantsBootstrap above (moderation ALWAYS wants
  // to bootstrap, design §A7), so needsBootstrap here mirrors the old hasIndirect||moderation gate exactly
  // when estimator is ML, and is forced false otherwise.
  const needsBootstrap = fitArgs.needsBootstrap
  const bootstrapLabel = hasIndirect && moderationDefs.length > 0
    ? 'indirect effects and moderation slopes'
    : moderationDefs.length > 0 ? 'moderation slopes' : 'indirect effects'

  onProgress?.({
    message: needsBootstrap
      ? `Fitting CB-SEM and bootstrapping ${bootstrapLabel} (${nboot.toLocaleString()} resamples)…`
      : 'Fitting CB-SEM…',
    estMs: needsBootstrap ? Math.round((nboot / 5000) * 162_000) : undefined, // spike: 5k mediation ≈ 2.7 min
  })

  const env = {
    model_str: model,
    item_cols_flat,
    all_cols: rCols,
    n,
    path_from: paths.map((p) => p.from),
    path_to: paths.map((p) => p.to),
    con_ids: constructs.map((c) => c.id),
    con_names: rNames,
    con_display: constructs.map((c) => c.name),
    has_indirect: needsBootstrap,
    nboot,
    is_path: isPath,
    // Only sent when non-empty: an empty JS array crashes webR's env marshalling (it misdetects []
    // as tabular "array of row-objects" data -- see the guard comment in moderationModel.ts's
    // INDPROD_R, which defines these as R empty vectors itself when they're absent from the env).
    ...(moderationDefs.length ? moderationIndProdEnv(moderationDefs) : {}),
  }

  const raw = await engine.runJson<RawResult>(rStats(fitArgs), env)

  // Integrity guard (U2-T6, reviewer-recommended): a requested moderation must never silently vanish.
  // The R side always pushes one mod_rows entry per mod_ids element and up to 3 slope_rows per moderation
  // (dropped only if a `:=` label lookup misses, see the R comment above) -- either count drifting from
  // moderationDefs means a moderation or one of its simple slopes was silently lost between R and TS.
  // Checked here, fail-fast, before the (unrelated) CFA reliability round-trip below.
  if (moderationDefs.length > 0) {
    if (raw.moderationRows.length !== moderationDefs.length) {
      throw new Error(
        `Moderation runner integrity: expected ${moderationDefs.length} moderation row(s), got ${raw.moderationRows.length} -- a requested moderation edge vanished.`,
      )
    }
    if (raw.slopeRows.length !== moderationDefs.length * 3) {
      throw new Error(
        `Moderation runner integrity: expected ${moderationDefs.length * 3} simple-slope row(s) (-1SD/mean/+1SD per moderation), got ${raw.slopeRows.length}.`,
      )
    }
    // Same guard, extended to the canvas-overlay array (Task 5.3's estModeration): a mismatched count
    // would otherwise index out-of-bounds silently below (moderationDefs.map -> raw.estModeration![i]).
    // Only checked when the field is present at all -- older/mocked RawResult fixtures that predate
    // Task 5.3 legitimately omit it and degrade to `undefined` (see the estModeration derivation below).
    if (raw.estModeration !== undefined && raw.estModeration.length !== moderationDefs.length) {
      throw new Error(
        `Moderation runner integrity: expected ${moderationDefs.length} estModeration canvas-overlay entry(ies), got ${raw.estModeration.length}.`,
      )
    }
  }

  // CFA reliability (ω/α/AVE/CR) — reuse Slice A; skipped in path mode (no measurement model).
  let reliability: Array<Record<string, unknown>> = []
  let fornellLarcker: number[][] = []
  let htmt: number[][] = []
  let corLvP: number[][] = []
  let discriminantLabels: string[] = []
  if (!isPath) {
    const cfa = await runCfaReliability(engine, data, constructs.map((c) => ({ name: c.name, items: c.items })))
    reliability = cfa.perConstruct.map((c: CfaConstructResult) => ({
      construct: c.name, cr: c.cr, ave: c.ave, omega: c.omega, alpha: c.alpha,
    }))
    fornellLarcker = cfa.fornellLarcker
    htmt = cfa.htmt
    corLvP = cfa.corLvP
    discriminantLabels = cfa.labels
  }

  const rsquare: Record<number, number> = {}
  for (const [k, v] of Object.entries(raw.rsquareIds)) rsquare[Number(k)] = v

  // Restore raw/display item names: the fitted lavaan model only ever saw the SANITIZED item token
  // (rItemNames, via itemNameOf above), so both item-level output surfaces -- Table 2's CFA loadings
  // and the canvas overlay's estimates.loadings (keyed by SemCanvas against raw Construct.items) --
  // need the sanitized->raw reverse map applied before they reach TS callers. No-op in path mode
  // (rawOfItem is empty there; both raw.cfaLoadings/raw.estLoadings are already empty).
  const cfaLoadings = raw.cfaLoadings.map((row) => ({ ...row, item: rawOfItem.get(String(row.item)) ?? row.item }))
  const estLoadings = Object.fromEntries(
    Object.entries(raw.estLoadings).map(([k, v]) => [rawOfItem.get(k) ?? k, v]),
  )

  // Attach the construct-name chain (pathLabel) to each indirect row by its lavaan := label, so the
  // builder renders "ind60 → dem60 → dem65" instead of the internal "ie_1_2_3". Pure additive field.
  const labelToChain = new Map(indirectDefs.map((d) => [d.label, d.chainNames.join(' → ')]))
  const indirect = hasIndirect
    ? raw.indirect.map((row) => ({ ...row, pathLabel: labelToChain.get(String(row.label)) }))
    : undefined

  // Moderation: one interaction-term row per moderation edge (b/se/z/p/stdBeta + dual CIs), keyed back
  // to its ModerationDef by id for moderatorName/pathLabel/matched/disclosure (design §A7). `disclosure`
  // is populated ONLY when `!matched` (unequal indicator counts -> indProd(match=FALSE), U2-T4 ruling).
  const modDefById = new Map(moderationDefs.map((d) => [d.id, d]))
  const moderation = moderationDefs.length
    ? {
        rows: raw.moderationRows.map((row): ModerationRow => {
          const def = modDefById.get(row.id)!
          return {
            moderatorName: def.moderatorName,
            // BARE path label ("SN → TI") - the builder composes "<pathLabel> × <moderatorName>"
            // (buildCbSem.ts Table 5); pre-composing here doubled the moderator in the rendered row.
            pathLabel: def.pathLabel,
            sourceDisplay: def.sourceDisplay,
            b: row.b, se: row.se, z: row.z, p: row.p, stdBeta: row.stdBeta,
            ciPercLower: row.ciPercLower, ciPercUpper: row.ciPercUpper,
            ciBcLower: row.ciBcLower, ciBcUpper: row.ciBcUpper,
            matched: def.matched,
            ...(def.matched ? {} : { disclosure: MODERATION_DISCLOSURE }),
          }
        }),
        slopes: raw.slopeRows.map((row): SlopeRow => {
          const def = modDefById.get(row.modId)!
          return {
            level: SLOPE_LEVEL[row.level],
            modId: row.modId, label: `${def.pathLabel} × ${def.moderatorName}`,
            b: row.est, se: row.se, p: row.p, z: row.z,
            ciPercLower: row.ciPercLower, ciPercUpper: row.ciPercUpper,
            ciBcLower: row.ciBcLower, ciBcUpper: row.ciBcUpper,
          }
        }),
      }
    : undefined

  // Canvas moderation-arrow overlay (Task 5.3, distinct from the `moderation` reporting block above):
  // one beta per moderation edge, keyed back to the moderatorId/pathIndex the canvas drew it with, so
  // SemCanvas can annotate the dashed arrow post-run. moderationDefs/raw.estModeration are both in
  // mod_ids order (see moderationIndProdEnv). `raw.estModeration` is guarded separately from
  // `moderationDefs.length` so older/mocked RawResult fixtures that predate this field degrade to
  // `undefined` instead of throwing.
  const modInputById = new Map((setup.moderations ?? []).map((m) => [m.id, m]))
  const estModeration = moderationDefs.length && raw.estModeration
    ? moderationDefs.map((def, i) => {
        const input = modInputById.get(def.id)!
        return { moderatorId: input.moderatorId, pathIndex: input.pathIndex, beta: raw.estModeration![i].beta }
      })
    : undefined

  // Moderation figure (R4, board-clearing slice - owner ruling): the classic two-line Aiken-West
  // interaction chart replaces the whiskered simple-slopes plot. The four predicted points per edge
  // (raw.plotPoints, in mod_ids order like estModeration) were computed R-side from the SAME fitted
  // quantities as the conditional-effects table (CB_INTERACTION_POINTS_R), so chart and table cannot
  // disagree. Drawing lives in the shared `interactionPlot.ts` module - PLS-SEM's runner calls the SAME
  // function with its own R-computed points, so there are not two copies of the plot text.
  const figModSlopesPng = await renderInteractionPlotFigure(
    engine,
    moderationDefs.length && raw.plotPoints
      ? moderationDefs.map((def, i) => ({
          label: `${def.pathLabel} × ${def.moderatorName}`,
          ivName: def.sourceDisplay, dvName: def.targetDisplay, modName: def.moderatorName,
          yLoLo: raw.plotPoints![i].yLoLo, yHiLo: raw.plotPoints![i].yHiLo,
          yLoHi: raw.plotPoints![i].yLoHi, yHiHi: raw.plotPoints![i].yHiHi,
        }))
      : [],
  )

  return {
    mode,
    saturated: isSaturated(raw.df),
    efaSuitability,
    efaLoadings,
    cfaLoadings,
    reliability,
    fit: raw.fit,
    structural: raw.structural,
    rsquare,
    indirect,
    moderation,
    fornellLarcker,
    htmt,
    corLvP,
    discriminantLabels,
    constructStats,
    estimates: {
      paths: raw.estPaths,
      loadings: estLoadings,
      r2: rsquare,
      moderation: estModeration,
    },
    itemStats,
    missing: fitArgs.missing,
    nboot,
    bootstrapped: needsBootstrap,
    figModSlopesPng,
    estimator: fitArgs.estimator,
    orderedItems: fitArgs.orderedRaw,
    exogenousOrdinals: exogenousOrdinals.length ? exogenousOrdinals : undefined,
    ciMethod: fitArgs.ciMethod,
  }
}
