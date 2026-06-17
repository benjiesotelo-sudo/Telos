import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { NestedAnovaResult } from '../stats/nestedAnova'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa, fx } from '../format/apa'

export function buildNestedAnova(spec: TestSpec, r: NestedAnovaResult): CardContent {
  const { factor, nested } = r
  const rowA = r.rows[0]
  const rowB = r.rows[1]

  // Display source labels: A → factor column name, B → "nested (nested in factor)"
  const sourceA = factor
  const sourceB = `${nested} (nested in ${factor})`

  // ω² cell: render as `ω² [lo, hi]` (effectsize one-sided CI); em-dash the whole cell when ω² is not estimable.
  const omega2Cell = (row: typeof rowA) =>
    row.omega2 == null ? '—' : `${f(row.omega2)} [${fx(row.omega2Low, f)}, ${fx(row.omega2High, f)}]`

  const tableRows = [
    {
      source: sourceA, ss: f(rowA.ss), df: fdf(rowA.df), ms: f(rowA.ms),
      f: f(rowA.f), p: fp(rowA.p), omega2: omega2Cell(rowA),
    },
    {
      source: sourceB, ss: f(rowB.ss), df: fdf(rowB.df), ms: f(rowB.ms),
      f: f(rowB.f), p: fp(rowB.p), omega2: omega2Cell(rowB),
    },
  ]

  // Descriptives by top-level (factor) group: N / M / SD
  const descRows = r.desc.map((g) => ({ group: g.group, n: g.n, m: f(g.m), sd: f(g.sd) }))

  // APA from row A with its errDf; ω² + its one-sided CI use the leading-zero-drop f01 (bounded statistic) and em-dash when not estimable.
  const apa = spec.apaTemplate
    .replace('{df1}', fdf(rowA.df))
    .replace('{df2}', fdf(rowA.errDf))
    .replace('{f}', f(rowA.f))
    .replace('{p}', fpApa(rowA.p))
    .replace('{o2}', fx(rowA.omega2, f01))
    .replace('{lo}', fx(rowA.omega2Low, f01))
    .replace('{hi}', fx(rowA.omega2High, f01))

  // Table note: conditional on nesting mode (audit finding).
  // The registry's assume text = random-nesting denominator explanation + the shared assumption-checks sentence;
  // for fixed nesting we swap the denominator explanation but keep the SAME assumption-checks sentence.
  const assumeSentence = "Assumption checks: Levene's (equal variances across top-level groups) & normality of residuals (Shapiro-Wilk)."
  const randomNoteText = spec.tableNote!.text
  const fixedNoteText = 'Under fixed nesting both F rows are tested against the residual mean square — the two F rows share the same denominator. Variance components (or ω²) are reported as the effect size where estimable. ' + assumeSentence
  const baseNoteText = r.nesting === 'random' ? randomNoteText : fixedNoteText

  // Crossed-data warning when applicable (design §5.4)
  const crossedWarning = r.crossed.length > 0
    ? ` — ${nested} labels repeat across ${factor} levels; results assume distinct groups within each ${factor} — check your coding`
    : ''
  // Runtime assumption statistics (mirror buildOneWayAnova's note style; em-dash NA via fx()).
  const assumeStats = ` (Levene F=${fx(r.levene.F, f)}, p=${fx(r.levene.p, fp)} · Shapiro W=${fx(r.shapiro.W, f)}, p=${fx(r.shapiro.p, fp)})`
  const noteText = baseNoteText + assumeStats + crossedWarning

  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: descRows },
      { spec: spec.tables[1], rows: tableRows },
    ],
    note: { kind: 'assume', text: noteText },
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
