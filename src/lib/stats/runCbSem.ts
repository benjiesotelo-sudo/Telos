import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import type { TestSetup, Construct, StructuralPath } from '../../state/session'
import type { RunProgress } from '../results/builders'
import { runCfaReliability, type CfaConstructResult } from './cfaReliability'
import { isSaturated } from './semSaturation'
import { lvNames } from './lvName'

export interface CbSemResult {
  mode: 'full' | 'cfa-only' | 'path'
  saturated: boolean
  efaSuitability?: Record<string, number>
  efaLoadings?: unknown
  cfaLoadings: Array<Record<string, unknown>>
  reliability: Array<Record<string, unknown>>
  fit?: Record<string, number>
  structural?: Array<Record<string, unknown>>
  rsquare?: Record<number, number>
  indirect?: Array<Record<string, unknown>>
  fornellLarcker: number[][]
  htmt: number[][]
  corLvP: number[][]
  discriminantLabels: string[]
  estimates: {
    paths: Array<{ from: number; to: number; beta: number }>
    loadings: Record<string, number>
    r2: Record<number, number>
  }
  itemStats: ItemStat[]
}

export interface ItemStat { construct: string; item: string; mean: number; sd: number; n: number }

function sampleMeanSd(values: number[]): { mean: number; sd: number } {
  const n = values.length
  const mean = values.reduce((a, b) => a + b, 0) / n
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1) // matches R's sd() (n-1)
  return { mean, sd: Math.sqrt(variance) }
}

/** The ONLY missing-data handling CB-SEM's fit itself performs today: the R_STATS block below calls
 *  lavaan::sem() with no `missing=` argument (both here and in the export emitter), so lavaan falls back
 *  to ITS OWN default -- listwise deletion. This is the single source of truth for that fact: the UI's
 *  missing-data dropdown default (SemControls.tsx) and computeItemStats' own fallback (below) both read
 *  this constant, so an untouched dropdown never overstates what the model actually does. Selecting a
 *  different mode only changes Table 1 item Mean/SD until the fit itself is wired to `missing=`
 *  (known gap, tracked separately -- not a stats change here). */
export const CB_SEM_DEFAULT_MISSING = 'listwise'

/** Table 1 item Mean/SD (design §A1). listwise → the SAME estimation-sample rows the model fit uses
 *  (single shared N); fiml/mi/pairwise → each item's own observed (non-null, finite) values from the
 *  RAW dataset, independent per item (N varies by item). Does not change how the model itself is fit
 *  (known gap, tracked separately -- the fit is always listwise today regardless of this setting). */
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

// Resolve the structural mode (design §3.4). EFA toggling lives in the builder/emitter; the stats core
// always fits CFA + structure for 'full', CFA-only when structure is off, observed-only for 'path'.
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
//   has_indirect logical(1): whether any := indirect def exists
//   nboot        integer: bootstrap resamples (single awaited call)
//   ci_type      character(1): 'perc' (percentile, default) | 'bca'
//   is_path      logical(1): observed-only mode (no =~; suppress loadings/reliability)
//
// standardizedSolution(): est.std/se/z/pvalue/ci.lower/ci.upper. parameterEstimates(boot.ci.type=ci_type)
// supplies the bootstrapped indirect CI. lavInspect(fit,'rsquare') gives endogenous R² by latent name.
const R_STATS = String.raw`
library(lavaan)

p_all <- length(all_cols)
d <- as.data.frame(lapply(seq_len(p_all), function(i) item_cols_flat[((i - 1) * n + 1):(i * n)]))
colnames(d) <- all_cols

# Single awaited fit with bootstrap SE/CI for mediation (no RNG chunking — preserves WebR≡native parity).
gc()
set.seed(20260620)
if (has_indirect) {
  fit <- lavaan::sem(model_str, data = d, se = "bootstrap", bootstrap = as.integer(nboot))
  pe <- lavaan::parameterEstimates(fit, boot.ci.type = ci_type, level = 0.95)
} else {
  fit <- lavaan::sem(model_str, data = d)
  pe <- lavaan::parameterEstimates(fit, level = 0.95)
}
gc()

ss <- lavaan::standardizedSolution(fit)
df_val <- as.numeric(lavaan::fitMeasures(fit, "df"))

# id↔name lookup
name2id <- setNames(as.integer(con_ids), con_names)

# --- Fit indices (always computed; builder/emitter suppress when df==0) ---
fm <- lavaan::fitMeasures(fit, c("chisq","df","pvalue","cfi","tli","rmsea",
                                 "rmsea.ci.lower","rmsea.ci.upper","srmr"))
fit_list <- list(
  chisq = as.numeric(fm["chisq"]), df = as.numeric(fm["df"]), pvalue = as.numeric(fm["pvalue"]),
  cfi = as.numeric(fm["cfi"]), tli = as.numeric(fm["tli"]), rmsea = as.numeric(fm["rmsea"]),
  rmseaLower = as.numeric(fm["rmsea.ci.lower"]), rmseaUpper = as.numeric(fm["rmsea.ci.upper"]),
  srmr = as.numeric(fm["srmr"])
)

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
rsq <- tryCatch(lavInspect(fit, "rsquare"), error = function(e) numeric(0))
struct_rows <- lapply(seq_along(path_from), function(k) {
  fid <- as.integer(path_from[k]); tid <- as.integer(path_to[k])
  fnm <- con_names[match(fid, con_ids)]; tnm <- con_names[match(tid, con_ids)]
  i <- which(ss$lhs[reg_idx] == tnm & ss$rhs[reg_idx] == fnm)[1]
  gi <- reg_idx[i]
  m <- which(pe_reg$lhs == tnm & pe_reg$rhs == fnm)[1]
  r2_val <- if (tnm %in% names(rsq)) as.numeric(rsq[tnm]) else NA_real_
  list(
    from = fid, to = tid,
    fromName = con_display[match(fid, con_ids)], toName = con_display[match(tid, con_ids)],
    b = as.numeric(pe_reg$est[m]), se = as.numeric(pe_reg$se[m]),
    z = as.numeric(pe_reg$z[m]), p = as.numeric(pe_reg$pvalue[m]),
    stdBeta = as.numeric(ss$est.std[gi]),
    ciLower = as.numeric(ss$ci.lower[gi]), ciUpper = as.numeric(ss$ci.upper[gi]),
    r2 = r2_val
  )
})

# R² by construct id (endogenous only)
rsq_ids <- list()
for (nm in names(rsq)) {
  if (nm %in% names(name2id)) rsq_ids[[as.character(name2id[[nm]])]] <- as.numeric(rsq[nm])
}

# --- Indirect effects (:= defined; bootstrap percentile CI) ---
ind_idx <- which(pe$op == ":=")
ss_def  <- ss[ss$op == ":=", ]
indirect_rows <- lapply(ind_idx, function(i) {
  lbl <- pe$lhs[i]
  sm <- which(ss_def$lhs == lbl)[1]
  list(
    label = lbl,
    est = as.numeric(pe$est[i]),
    stdEst = if (length(sm)) as.numeric(ss_def$est.std[sm]) else NA_real_,
    se = as.numeric(pe$se[i]),
    ciLower = as.numeric(pe$ci.lower[i]),
    ciUpper = as.numeric(pe$ci.upper[i]),
    p = as.numeric(pe$pvalue[i])
  )
})

# --- Estimates block for the canvas overlay (loadings keyed by item name) ---
est_loadings <- list()
if (!is_path) {
  for (i in load_idx) est_loadings[[ss$rhs[i]]] <- as.numeric(ss$est.std[i])
}
est_paths <- lapply(struct_rows, function(r) list(from = r$from, to = r$to, beta = r$stdBeta))

list(
  fit = fit_list,
  df = df_val,
  cfaLoadings = cfa_rows,
  structural = struct_rows,
  rsquareIds = rsq_ids,
  indirect = indirect_rows,
  estLoadings = est_loadings,
  estPaths = est_paths
)
`

/** Build the full lavaan model string: =~ measurement (latent only) + ~ structural + auto := indirect defs.
 *  rNameOf gives the SANITIZED lavaan identifier per construct id (display names with spaces are illegal
 *  `=~`/`~` tokens); chainNames stay DISPLAY names — they feed the UI-facing indirect-effect labels only. */
function buildModel(
  constructs: Construct[],
  paths: StructuralPath[],
  isPath: boolean,
  rNameOf: (id: number) => string,
): { model: string; hasIndirect: boolean; indirectDefs: Array<{ label: string; chainNames: string[] }> } {
  const byId = new Map(constructs.map((c) => [c.id, c]))
  const nameOf = (id: number) => byId.get(id)!.name
  const lines: string[] = []

  // Measurement model (latent mode only; path mode regresses observed columns directly)
  if (!isPath) {
    for (const c of constructs) lines.push(`${rNameOf(c.id)} =~ ${c.items.join(' + ')}`)
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

  return { model: lines.join('\n'), hasIndirect: indirectDefs.length > 0, indirectDefs }
}

interface RawResult {
  fit: Record<string, number>
  df: number
  cfaLoadings: Array<Record<string, unknown>>
  structural: Array<Record<string, unknown>>
  rsquareIds: Record<string, number>
  indirect: Array<Record<string, unknown>>
  estLoadings: Record<string, number>
  estPaths: Array<{ from: number; to: number; beta: number }>
}

export async function runCbSem(
  engine: Engine,
  data: Dataset,
  setup: TestSetup,
  onProgress?: RunProgress,
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
  const rows = listwise(data, usedCols)
  const n = rows.length
  const item_cols_flat = usedCols.flatMap((col) => rows.map((r) => r[col] as number))
  const itemStats = isPath
    ? []
    : computeItemStats(data, constructs, rows, String(setup.options['missing'] ?? CB_SEM_DEFAULT_MISSING))

  // R-side column names: in path mode the model tokens are the SANITIZED construct names, so the data
  // frame columns must carry the same sanitized names; latent mode keeps the raw item columns.
  const rCols = isPath
    ? usedCols.map((col) => rNameOf(constructs.find((c) => c.name === col)!.id))
    : usedCols

  const { model, hasIndirect, indirectDefs } = buildModel(constructs, paths, isPath, rNameOf)
  const nboot = Number(setup.options['nboot'] ?? 5000)
  const ci_type = setup.options['ciType'] === 'bca' ? 'bca' : 'perc'

  onProgress?.({
    message: hasIndirect
      ? `Fitting CB-SEM and bootstrapping indirect effects (${nboot.toLocaleString()} resamples)…`
      : 'Fitting CB-SEM…',
    estMs: hasIndirect ? Math.round((nboot / 5000) * 162_000) : undefined, // spike: 5k mediation ≈ 2.7 min
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
    has_indirect: hasIndirect,
    nboot,
    ci_type,
    is_path: isPath,
  }

  const raw = await engine.runJson<RawResult>(R_STATS, env)

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

  // Attach the construct-name chain (pathLabel) to each indirect row by its lavaan := label, so the
  // builder renders "ind60 → dem60 → dem65" instead of the internal "ie_1_2_3". Pure additive field.
  const labelToChain = new Map(indirectDefs.map((d) => [d.label, d.chainNames.join(' → ')]))
  const indirect = hasIndirect
    ? raw.indirect.map((row) => ({ ...row, pathLabel: labelToChain.get(String(row.label)) }))
    : undefined

  return {
    mode,
    saturated: isSaturated(raw.df),
    cfaLoadings: raw.cfaLoadings,
    reliability,
    fit: raw.fit,
    structural: raw.structural,
    rsquare,
    indirect,
    fornellLarcker,
    htmt,
    corLvP,
    discriminantLabels,
    estimates: {
      paths: raw.estPaths,
      loadings: raw.estLoadings,
      r2: rsquare,
    },
    itemStats,
  }
}
