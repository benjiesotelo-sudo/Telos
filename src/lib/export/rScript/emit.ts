import type { TestSpec } from '../../registry/types'
import type { TestSetup } from '../../../state/session'
import type { Dataset } from '../../stats/types'
import { EMITTERS, PACKAGES } from './emitters'
import { header, readData, factorLines } from './helpers'

/** Assemble the full reproducible R script for the selected tests, in selection order. */
export function emitRScript(
  selection: string[],
  setups: Record<string, TestSetup>,
  specs: Record<string, TestSpec>,
  dataset: Dataset,
): string {
  const pkgs = [...new Set(selection.flatMap((id) => PACKAGES[id] ?? []))]
  const factors = [...new Set(selection.flatMap((id) => factorLines(setups[id], specs[id], dataset).split('\n')))]
    .filter(Boolean)
    .join('\n')

  const blocks = selection.map((id, i) => {
    const nn = String(i + 1).padStart(2, '0')
    const body = EMITTERS[id] ? EMITTERS[id](specs[id], setups[id], dataset) : '# (emitter pending)'
    return `\n# === ${nn} · ${specs[id]?.name ?? id} ===\n${body}`
  })

  return [header(pkgs), readData(), ...(factors ? [factors] : []), ...blocks].join('\n')
}
