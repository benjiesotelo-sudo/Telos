import type { Engine } from '../webr/engine'
import type { Dataset } from './types'
import { runCfaReliability, type CfaReliabilityResult } from './cfaReliability'

export interface CompositeReliabilityResult {
  cfa: CfaReliabilityResult
  figReliabilityPng: Uint8Array
}

// ggplot2 CR bar chart per construct (single metric — simpler than the AVE/CR side-by-side).
// Env: `construct_names` (character), `cr_vals` (numeric)
const R_FIG = String.raw`
k <- length(construct_names)
d_plot <- data.frame(
  construct = factor(construct_names, levels = rev(construct_names)),
  value     = cr_vals
)
print(
  ggplot2::ggplot(d_plot, ggplot2::aes(x = value, y = construct)) +
  ggplot2::geom_col(fill = "#0c447c") +
  ggplot2::geom_vline(xintercept = 0.7, linetype = "dashed", colour = "#9cc2ec") +
  ggplot2::labs(x = "CR", y = NULL) +
  ggplot2::theme(legend.position = "none")
)
`

export async function runCompositeReliability(
  engine: Engine,
  data: Dataset,
  constructs: { name: string; items: string[] }[],
): Promise<CompositeReliabilityResult> {
  const cfa = await runCfaReliability(engine, data, constructs)

  const figEnv = {
    construct_names: cfa.labels,
    cr_vals: cfa.perConstruct.map((c) => c.cr),
  }
  const figReliabilityPng = await engine.capturePlot(R_FIG, 600, 400, figEnv)

  return { cfa, figReliabilityPng }
}
