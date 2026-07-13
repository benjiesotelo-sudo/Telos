import type { Engine } from '../webr/engine'

/** One moderation edge on the two-line interaction chart (R4, board-clearing slice - owner ruling:
 *  the classic Aiken & West (1991) chart REPLACES the whiskered simple-slopes figure on CB-SEM and
 *  PLS-SEM, app + export + report.tex). Generic across the two runners: each edge carries the four
 *  predicted outcome values (IV at -1SD/+1SD crossed with moderator at -1SD/+1SD, computed R-side from
 *  the SAME fitted quantities as the conditional-effects table, so chart and table cannot disagree)
 *  plus the display names the chart labels itself with. One edge = one panel (multi-moderation runs
 *  stack panels, like the old figure's facets). */
export interface InteractionPlotEdge {
  /** Panel title for multi-edge runs, "<IV> → <target> × <moderator>" (same composition as the
   *  conditional-effects table's Moderation column). */
  label: string
  ivName: string
  dvName: string
  modName: string
  /** Predicted outcome at IV -1SD, moderator -1SD. */
  yLoLo: number
  /** Predicted outcome at IV +1SD, moderator -1SD. */
  yHiLo: number
  /** Predicted outcome at IV -1SD, moderator +1SD. */
  yLoHi: number
  /** Predicted outcome at IV +1SD, moderator +1SD. */
  yHiHi: number
}

/** Base-R block for the two-line interaction chart: x-axis = IV at -1SD/+1SD (ticks labelled with the
 *  IV construct name), one line per moderator level (-1SD solid line + filled point, +1SD dashed line +
 *  square point), legend naming the moderator levels, y label = outcome construct name. DEFAULT R
 *  styling only - NO custom colors (the owner explicitly cancelled recoloring, R4). Env-bound parallel
 *  arrays, one entry per moderation edge: ip_edge_labels / ip_iv_names / ip_dv_names / ip_mod_names +
 *  the four ip_y_* predicted-outcome vectors. The SAME text is embedded in the exported analysis.R
 *  (emitters/latent.ts, both SEM branches) - export = app. */
export const INTERACTION_PLOT_R = [
  'n_edges <- length(ip_edge_labels)',
  'if (n_edges > 1) par(mfrow = c(n_edges, 1))',
  'for (ei in seq_len(n_edges)) {',
  '  ys <- c(ip_y_lo_lo[ei], ip_y_hi_lo[ei], ip_y_lo_hi[ei], ip_y_hi_hi[ei])',
  '  plot(c(-1, 1), ys[1:2], type = "o", pch = 16, lty = 1,',
  '       xlim = c(-1.4, 1.4), ylim = grDevices::extendrange(ys),',
  '       xaxt = "n", xlab = NA, ylab = ip_dv_names[ei],',
  '       main = if (n_edges > 1) ip_edge_labels[ei] else NA)',
  '  lines(c(-1, 1), ys[3:4], type = "o", pch = 15, lty = 2)',
  '  axis(1, at = c(-1, 1), labels = paste(ip_iv_names[ei], c("-1 SD", "+1 SD")))',
  '  legend("topleft", legend = paste(ip_mod_names[ei], c("-1 SD", "+1 SD")),',
  '         lty = c(1, 2), pch = c(16, 15), bty = "n")',
  '}',
  'if (n_edges > 1) par(mfrow = c(1, 1))',
].join('\n')

/** CB-SEM predicted-point extraction (R text), shared VERBATIM by the app runner's R_STATS block
 *  (runCbSem.ts) and the cb-sem export emitter (emitters/latent.ts) so export = app by construction.
 *  Consumes: `mod_ids` / `mod_source_name` / `mod_main_label` (moderationIndProdEnv), the fitted `fit`,
 *  and the percentile parameter table `pe`. The predicted outcome at (iv, mod) is
 *  iv*slope(mod) + b_mod*mod with slope(mod) read from the SAME slope_lo/slope_hi := defined parameters
 *  the conditional-effects table prints, sd(moderator) = sqrt(vmod_<id>) exactly as the := defs use,
 *  and sd(IV) = the model-implied latent SD (lavInspect cov.lv). */
export const CB_INTERACTION_POINTS_R = String.raw`ip_y_lo_lo <- numeric(0); ip_y_hi_lo <- numeric(0); ip_y_lo_hi <- numeric(0); ip_y_hi_hi <- numeric(0)
if (length(mod_ids) > 0) {
  ip_cov_lv <- lavaan::lavInspect(fit, "cov.lv")
  for (mi in seq_along(mod_ids)) {
    ip_sd_iv <- sqrt(ip_cov_lv[mod_source_name[mi], mod_source_name[mi]])
    ip_sd_mod <- sqrt(pe$est[which(pe$label == paste0("vmod_", mod_ids[mi]) & pe$op == "~~")[1]])
    ip_b_mod <- pe$est[which(pe$label == mod_main_label[mi] & pe$op == "~")[1]]
    ip_slope_lo <- pe$est[which(pe$lhs == paste0("slope_lo_", mod_ids[mi]) & pe$op == ":=")[1]]
    ip_slope_hi <- pe$est[which(pe$lhs == paste0("slope_hi_", mod_ids[mi]) & pe$op == ":=")[1]]
    ip_y_lo_lo <- c(ip_y_lo_lo, -ip_sd_iv * ip_slope_lo - ip_b_mod * ip_sd_mod)
    ip_y_hi_lo <- c(ip_y_hi_lo,  ip_sd_iv * ip_slope_lo - ip_b_mod * ip_sd_mod)
    ip_y_lo_hi <- c(ip_y_lo_hi, -ip_sd_iv * ip_slope_hi + ip_b_mod * ip_sd_mod)
    ip_y_hi_hi <- c(ip_y_hi_hi,  ip_sd_iv * ip_slope_hi + ip_b_mod * ip_sd_mod)
  }
}`

/** Renders the two-line interaction chart via `engine.capturePlot` from the runner's already-shaped
 *  edges. Returns `undefined` when there is nothing to plot (no moderation ran). Height grows with the
 *  edge count so stacked panels (par mfrow) stay legible. */
export async function renderInteractionPlotFigure(
  engine: Engine,
  edges: InteractionPlotEdge[],
): Promise<Uint8Array | undefined> {
  if (!edges.length) return undefined
  const height = edges.length > 1 ? 320 * edges.length : 420
  return engine.capturePlot(INTERACTION_PLOT_R, 560, height, {
    ip_edge_labels: edges.map((e) => e.label),
    ip_iv_names: edges.map((e) => e.ivName),
    ip_dv_names: edges.map((e) => e.dvName),
    ip_mod_names: edges.map((e) => e.modName),
    ip_y_lo_lo: edges.map((e) => e.yLoLo),
    ip_y_hi_lo: edges.map((e) => e.yHiLo),
    ip_y_lo_hi: edges.map((e) => e.yLoHi),
    ip_y_hi_hi: edges.map((e) => e.yHiHi),
  })
}
