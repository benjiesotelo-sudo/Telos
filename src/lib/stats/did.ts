import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import { binaryCode, positiveLevel } from './binaryCoding'

export interface DidCoefRow { term: string; b: number; se: number; t: number; p: number; ciLow: number; ciHigh: number }
export interface DidResult {
  coefRows: DidCoefRow[]   // (Intercept), tr, po, tr:po — builder relabels
  seType: 'clustered' | 'classical'
  ciLevel: number; alpha: number
  nObs: number; nExcluded: number
  figTrendsPng: Uint8Array<ArrayBuffer>
}

// lm(.y ~ tr * po); clustered-by-entity SE via sandwich::vcovCL. tr/po are 0/1 (second level = 1).
const R_DID = String.raw`
d <- data.frame(.y = y, tr = tr, po = po, .cluster = cluster, stringsAsFactors = FALSE)
fit <- lm(.y ~ tr * po, data = d)
V  <- if (se_clustered) sandwich::vcovCL(fit, cluster = d$.cluster) else stats::vcov(fit)
ct <- lmtest::coeftest(fit, vcov. = V)
ci <- lmtest::coefci(fit, vcov. = V, level = ci_level)
labs <- rownames(ct)
coef_rows <- lapply(seq_along(labs), function(i) list(
  term = labs[i], b = ct[i, 1], se = ct[i, 2], t = ct[i, 3], p = ct[i, 4], ciLow = ci[i, 1], ciHigh = ci[i, 2]))
list(coef_rows = coef_rows, n_obs = nrow(d))`

// Parallel-trends plot: mean outcome over time by treatment group, with treatment onset marked.
const R_TRENDS = String.raw`
agg <- aggregate(yy ~ tt + grp, data = data.frame(yy = y, tt = timev, grp = ifelse(tr == 1, 'Treated', 'Control')), FUN = mean)
onset <- min(timev[po == 1])
print(ggplot2::ggplot(agg, ggplot2::aes(x = tt, y = yy, colour = grp, group = grp)) +
  ggplot2::geom_vline(xintercept = onset, colour = '#9cc2ec', linetype = 'dashed') +
  ggplot2::geom_line() + ggplot2::geom_point() +
  ggplot2::scale_colour_manual(values = c(Control = '#0c447c', Treated = '#c8781e')) +
  ggplot2::labs(x = 'Time', y = 'Mean outcome', colour = NULL))`

interface RawDid { coef_rows: DidCoefRow[]; n_obs: number }

const levelsOf = (data: Dataset, col: string): string[] =>
  [...new Set(data.rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined && String(v).trim() !== '').map(String))].sort()

export async function runDid(
  engine: Engine, data: Dataset, outcomeCol: string, treatmentCol: string, periodCol: string, entityCol: string, timeCol: string,
  opts: { seClustered?: boolean; ciLevel?: number; alpha?: number } = {},
): Promise<DidResult> {
  const seClustered = opts.seClustered ?? true
  const ciLvl = opts.ciLevel ?? 0.95
  const alpha = opts.alpha ?? 0.05
  const present = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== ''
  const trLevels = levelsOf(data, treatmentCol)
  const poLevels = levelsOf(data, periodCol)
  if (trLevels.length !== 2) throw new Error('Difference-in-differences needs a treatment with exactly 2 groups.')
  if (poLevels.length !== 2) throw new Error('Difference-in-differences needs a pre/post period with exactly 2 levels.')
  const rows = data.rows.filter((r) =>
    typeof r[outcomeCol] === 'number' && Number.isFinite(r[outcomeCol] as number)
    && present(r[treatmentCol]) && present(r[periodCol]) && present(r[entityCol]) && present(r[timeCol]))
  const nExcluded = data.rows.length - rows.length
  // Code treatment + period to 0/1 by the POSITIVE level (treated / post), not alphabetical order — "pre"/"post"
  // sorts post<pre, which would flip the DiD sign. binaryCode handles 0/1, yes/no, pre/post, treated/control.
  const trPos = positiveLevel(trLevels); const poPos = positiveLevel(poLevels)
  const tr = rows.map((r) => binaryCode(r[treatmentCol], trPos))
  const po = rows.map((r) => binaryCode(r[periodCol], poPos))
  // 2×2 structural guard: every treat×post cell populated
  const cells = new Set(rows.map((_, i) => `${tr[i]}-${po[i]}`))
  if (cells.size < 4) throw new Error('Difference-in-differences needs observations in all four treated×period cells.')
  // Ordered numeric x-axis for the trends plot: the real value when every time is numeric (e.g. year), else the
  // rank of each distinct value in sorted order — so ISO-date strings / ordinal labels plot in order, not as NaN.
  const rawTime = rows.map((r) => r[timeCol])
  const allNumericTime = rawTime.every((v) => typeof v === 'number' && Number.isFinite(v))
  const timeOrder = allNumericTime ? null : [...new Set(rawTime.map(String))].sort()
  const env = {
    y: rows.map((r) => r[outcomeCol] as number),
    tr, po,
    cluster: rows.map((r) => String(r[entityCol])),
    timev: allNumericTime ? (rawTime as number[]) : rawTime.map((v) => timeOrder!.indexOf(String(v)) + 1),
    se_clustered: seClustered, ci_level: ciLvl,
  }
  const raw = await engine.runJson<RawDid>(R_DID, env)
  const figTrendsPng = await engine.capturePlot(R_TRENDS, 600, 450, env)
  return {
    coefRows: raw.coef_rows, seType: seClustered ? 'clustered' : 'classical',
    ciLevel: ciLvl, alpha, nObs: raw.n_obs, nExcluded, figTrendsPng,
  }
}
