import type { TestSpec } from '../../registry/types'
import type { TestSetup } from '../../../state/session'
import type { Dataset } from '../../stats/types'
import { EMITTERS, PACKAGES, getItemDomain, getRenameEntries } from './emitters'
import { header, readData, factorLines } from './helpers'
import { lvNames } from '../../stats/lvName'

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

  // Selection-global item map: ONE lvNames() call over the union of every SEM-family test's raw item
  // domain across the WHOLE selection (U10 fix) — every SEM emitter below looks up this SAME map instead
  // of re-deriving its own locally from just its own domain, so a raw column that collides with a
  // DIFFERENT partner in another test's domain (e.g. 'a.b' vs 'a b') still resolves to the identical safe
  // token everywhere it's referenced. Union preserves first-selection-order per raw string, deduped so a
  // raw column shared by two tests is sanitized exactly once. For a single selected test this union
  // equals that test's own domain, so the map — and every emitted token — is unchanged (byte-identical).
  const rawUnion: string[] = []
  const seenRaw = new Set<string>()
  for (const id of selection) {
    for (const raw of getItemDomain(id, setups[id], specs[id])) {
      if (!seenRaw.has(raw)) {
        seenRaw.add(raw)
        rawUnion.push(raw)
      }
    }
  }
  const safeUnion = lvNames(rawUnion)
  const itemMap = new Map(rawUnion.map((raw, i) => [raw, safeUnion[i]]))

  // Raw CSV column -> sanitized R token, unioned across the selection, resolved against itemMap above.
  // Empty for a selection with no SEM-family tests, so readData() falls back to its un-parameterized,
  // byte-identical form.
  const renameMap = new Map<string, string>()
  for (const id of selection) {
    for (const [raw, safe] of getRenameEntries(id, setups[id], specs[id], itemMap)) renameMap.set(raw, safe)
  }
  const rename = [...renameMap.entries()] as [string, string][]

  const blocks = selection.map((id, i) => {
    const nn = String(i + 1).padStart(2, '0')
    const body = EMITTERS[id] ? EMITTERS[id](specs[id], setups[id], dataset, itemMap) : '# (emitter pending)'
    return `\n# === ${nn} · ${specs[id]?.name ?? id} ===\n${body}`
  })

  return [header(pkgs), readData(rename.length ? rename : undefined), ...(factors ? [factors] : []), ...blocks].join('\n')
}
