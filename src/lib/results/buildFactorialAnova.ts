import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { FactorialAnovaResult } from '../stats/factorialAnova'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa, fx } from '../format/apa'
import type { PosthocRow } from '../stats/posthoc'

/** Render simple-effects rows using the 'contrast' key (column key on Table 3). */
const seTableRows = (rows: (PosthocRow & { term: string })[], fmt: { f: (n: number) => string; fp: (p: number) => string }) =>
  rows.map((r) => ({ contrast: r.pair, mdiff: fmt.f(r.diff), se: fmt.f(r.se), padj: fmt.fp(r.pAdj), ci: `[${fmt.f(r.ciLo)}, ${fmt.f(r.ciHi)}]` }))

export function buildFactorialAnova(spec: TestSpec, r: FactorialAnovaResult): CardContent {
  const pct = Math.round(r.ciLevel * 100)
  const ciLabel = `${pct}% CI`
  // Residual df: (totalN - 1) - sum of all effect dfs (balanced between-subjects factorial).
  const totalN = r.desc.reduce((s, c) => s + c.n, 0)
  const sumEffectDf = r.rows.reduce((s, row) => s + row.df, 0)
  const dfRes = totalN - 1 - sumEffectDf

  // Detect whether the model included an interaction term.
  const hasInteractions = r.rows.some((row) => row.source.includes('×'))

  // Build APA sentence.
  let apa: string
  if (hasInteractions) {
    // Use the interaction row (A×B) from the template.
    const interactionRow = r.rows.find((row) => row.source.includes('×'))!
    apa = spec.apaTemplate
      .replace('{df1}', fdf(interactionRow.df)).replace('{df2}', String(dfRes))
      .replace('{f}', f(interactionRow.f))
      .replace('{p}', fpApa(interactionRow.p))
      .replace('{pes}', f01(interactionRow.pes))
  } else {
    // Interactions OFF: report main effects only (first factor row anchors the sentence).
    const rows = r.rows
    const apaRows = rows.map((row) =>
      `${row.source}, F(${fdf(row.df)},${dfRes})=${f(row.f)}, p ${fpApa(row.p)}, partial η²=${f01(row.pes)}`
    )
    apa = `A two-way ANOVA gave main effects of ${apaRows.join('; ')}.`
  }

  const noteText = `${spec.tableNote!.text} (Levene F=${fx(r.levene.F, f)}, p=${fx(r.levene.p, fp)} · Shapiro W=${fx(r.shapiro.W, f)}, p=${fx(r.shapiro.p, fp)})`

  // Decision 2: include simple-effects rows only for significant terms (p < .05).
  // Marginal rows for factor X: included only if X's ANOVA row p < .05.
  // Interaction rows: included only if the interaction ANOVA row p < .05.
  // If nothing passes the filter, omit Table 3 entirely.
  const sigSources = new Set(r.rows.filter((row) => row.p < 0.05).map((row) => row.source))
  const filteredSE = r.simpleEffects.filter((seRow) => sigSources.has(seRow.term))

  const table1 = { spec: spec.tables[0], rows: r.desc.map((c) => ({ cell: c.cell, n: c.n, m: f(c.m), sd: f(c.sd) })) }
  // Table 2 title reflects whether interactions were modelled.
  const anovaTableTitle = hasInteractions ? spec.tables[1].title : 'ANOVA (main effects)'
  const table2 = { spec: { ...spec.tables[1], title: anovaTableTitle }, rows: r.rows.map((row) => ({
    source: row.source, ss: f(row.ss), df: fdf(row.df),
    ms: f(row.ms), f: f(row.f), p: fp(row.p), pes: f(row.pes),
  })) }
  const fig = figuresOf(spec)[0]

  const base = {
    note: { kind: 'assume' as const, text: noteText },
    // Suppress the interaction figure when interactions are not modelled.
    figures: hasInteractions ? [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }] : [],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }

  if (filteredSE.length === 0) {
    // Decision 2: nothing significant — omit Table 3 entirely
    return { tables: [table1, table2], ...base }
  }

  const t3cols = spec.tables[2].columns.map((c) => c.key === 'ci' ? { ...c, label: ciLabel } : c)
  const table3 = { spec: { ...spec.tables[2], columns: t3cols }, rows: seTableRows(filteredSE, { f, fp }) }
  return { tables: [table1, table2, table3], ...base }
}
