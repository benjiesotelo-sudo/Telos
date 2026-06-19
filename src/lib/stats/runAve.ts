import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import { runCfaReliability, type CfaReliabilityResult } from './cfaReliability'

export interface AveResult {
  cfa: CfaReliabilityResult
  figValidityPng: Uint8Array
}

// ggplot2 side-by-side AVE / CR bar chart per construct.
// Env: `construct_names` (character), `ave_vals` (numeric), `cr_vals` (numeric)
const R_FIG = String.raw`
k <- length(construct_names)
d_plot <- data.frame(
  construct = rep(factor(construct_names, levels = rev(construct_names)), 2),
  metric    = c(rep("AVE", k), rep("CR", k)),
  value     = c(ave_vals, cr_vals)
)
print(
  ggplot2::ggplot(d_plot, ggplot2::aes(x = value, y = construct, fill = metric)) +
  ggplot2::geom_col(position = "dodge") +
  ggplot2::geom_vline(xintercept = 0.5, linetype = "dashed", colour = "#9cc2ec") +
  ggplot2::scale_fill_manual(values = c(AVE = "#0c447c", CR = "#5b9bd5")) +
  ggplot2::labs(x = NULL, y = NULL, fill = NULL) +
  ggplot2::theme(legend.position = "top")
)
`

export async function runAve(
  engine: Engine,
  data: Dataset,
  constructs: { name: string; items: string[] }[],
): Promise<AveResult> {
  const cfa = await runCfaReliability(engine, data, constructs)

  const figEnv = {
    construct_names: cfa.labels,
    ave_vals: cfa.perConstruct.map((c) => c.ave),
    cr_vals: cfa.perConstruct.map((c) => c.cr),
  }
  const figValidityPng = await engine.capturePlot(R_FIG, 600, 400, figEnv)

  return { cfa, figValidityPng }
}
