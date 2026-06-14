import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { NestedAnovaResult } from '../stats/nestedAnova'
import type { CardContent } from './builders'
import { f, fdf, fp, fpApa, fx } from '../format/apa'

export function buildNestedAnova(spec: TestSpec, r: NestedAnovaResult): CardContent {
  const { factor, nested } = r
  const rowA = r.rows[0]
  const rowB = r.rows[1]

  // Display source labels: A → factor column name, B → "nested (nested in factor)"
  const sourceA = factor
  const sourceB = `${nested} (nested in ${factor})`

  const tableRows = [
    {
      source: sourceA, ss: f(rowA.ss), df: fdf(rowA.df), ms: f(rowA.ms),
      f: f(rowA.f), p: fp(rowA.p), omega2: fx(rowA.omega2, f),
    },
    {
      source: sourceB, ss: f(rowB.ss), df: fdf(rowB.df), ms: f(rowB.ms),
      f: f(rowB.f), p: fp(rowB.p), omega2: fx(rowB.omega2, f),
    },
  ]

  // APA from row A with its errDf
  const apa = spec.apaTemplate
    .replace('{df1}', fdf(rowA.df))
    .replace('{df2}', fdf(rowA.errDf))
    .replace('{f}', f(rowA.f))
    .replace('{p}', fpApa(rowA.p))

  // Table note: conditional on nesting mode (audit finding)
  const randomNoteText = spec.tableNote!.text
  const fixedNoteText = 'Under fixed nesting both F rows are tested against the residual mean square — the two F rows share the same denominator. Variance components (or ω²) are reported as the effect size where estimable.'
  const baseNoteText = r.nesting === 'random' ? randomNoteText : fixedNoteText

  // Plain note: base text + crossed-data warning when applicable (design §5.4)
  const crossedWarning = r.crossed.length > 0
    ? ` — ${nested} labels repeat across ${factor} levels; results assume distinct groups within each ${factor} — check your coding`
    : ''
  const noteText = baseNoteText + crossedWarning

  const fig = figuresOf(spec)[0]
  return {
    tables: [{ spec: spec.tables[0], rows: tableRows }],
    note: { kind: 'plain', text: noteText },
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
