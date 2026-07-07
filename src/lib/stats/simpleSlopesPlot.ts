import type { Engine } from '../webr/engine'

/** One whiskered point on the simple-slopes figure - generic across CB-SEM (lavaan `:=` defined
 *  parameters) and PLS-SEM (seminr bootstrap draws): the plotting code has zero CB/PLS-specific logic,
 *  it just takes {level, b, ciLower, ciUpper}[] (design §U6-T5, moved out of runCbSem.ts's Task 5.2
 *  inline copy so both runners call the SAME R text instead of keeping two copies). `modId`/`label`
 *  disambiguate rows across MULTIPLE moderation edges (see runCbSem.ts's SlopeRow doc comment) - with
 *  2+ moderations, the array holds 3 rows PER edge, all sharing the same 3 `level` values.
 */
export interface SimpleSlopePoint {
  level: '-1SD' | 'mean' | '+1SD'
  modId: number
  label: string
  b: number
  ciLower: number
  ciUpper: number
}

/** ggplot2-in-R block for the whiskered simple-slopes figure (design §U5-T2): three points (-1SD/mean/
 *  +1SD), CI whiskers, no continuous band. `levels`/`mods`/`bs`/`los`/`his` are env-bound parallel arrays
 *  (see `renderSimpleSlopesFigure` below). Byte-for-byte the text runCbSem.ts's Task 5.2 inline copy used -
 *  moving it here must not change a single character, or the CB-SEM figure output stops being byte-equivalent. */
export const SIMPLE_SLOPES_PLOT_R = [
  'library(ggplot2)',
  'df_plot <- data.frame(',
  '  level = factor(levels, levels = c("-1SD", "mean", "+1SD")),',
  '  moderation = factor(mods, levels = unique(mods)),',
  '  b = bs, lo = los, hi = his',
  ')',
  'p_slopes <- ggplot2::ggplot(df_plot, ggplot2::aes(x = level, y = b)) +',
  '  ggplot2::geom_point(size = 3, colour = "#d97757") +',
  '  ggplot2::geom_errorbar(ggplot2::aes(ymin = lo, ymax = hi), width = 0.15, colour = "#d97757") +',
  '  ggplot2::geom_hline(yintercept = 0, linetype = "dotted", colour = "#888") +',
  '  ggplot2::labs(x = NULL, y = "Conditional effect (simple slope)") +',
  '  ggplot2::theme_minimal(base_size = 11)',
  'if (length(unique(mods)) > 1) p_slopes <- p_slopes + ggplot2::facet_wrap(~ moderation, ncol = 1)',
  'print(p_slopes)',
].join('\n')

/** Renders the whiskered simple-slopes figure via `engine.capturePlot`, given a runner's already-shaped
 *  slope rows (CB-SEM maps `ciPercLower`/`ciPercUpper`; PLS-SEM maps its own bootstrap-percentile CI -
 *  see each runner's call site). Returns `undefined` when there is nothing to plot (no moderation ran).
 *  Height grows with the distinct-moderation count so stacked facet panels (ncol=1) stay legible;
 *  single-moderation runs keep the original 380px (no facet strip, pixel-identical to the pre-shared-module
 *  figure - same width/height/args as before the U6-T5 extraction). */
export async function renderSimpleSlopesFigure(
  engine: Engine,
  slopes: SimpleSlopePoint[],
): Promise<Uint8Array | undefined> {
  if (!slopes.length) return undefined
  const distinctMods = new Set(slopes.map((s) => s.modId)).size
  const height = distinctMods > 1 ? 220 * distinctMods + 60 : 380
  return engine.capturePlot(SIMPLE_SLOPES_PLOT_R, 500, height, {
    levels: slopes.map((s) => s.level),
    mods: slopes.map((s) => s.label),
    bs: slopes.map((s) => s.b),
    los: slopes.map((s) => s.ciLower),
    his: slopes.map((s) => s.ciUpper),
  })
}
