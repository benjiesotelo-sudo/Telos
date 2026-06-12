import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { FactorialAnovaResult } from '../stats/factorialAnova'
import type { CardContent } from './builders'
import { f, fdf, fp, fx } from '../format/apa'
import type { PosthocRow } from '../stats/posthoc'

/** Render simple-effects rows using the 'contrast' key (column key on Table 3). */
const seTableRows = (rows: (PosthocRow & { term: string })[], fmt: { f: (n: number) => string; fp: (p: number) => string }) =>
  rows.map((r) => ({ contrast: r.pair, mdiff: fmt.f(r.diff), se: fmt.f(r.se), padj: fmt.fp(r.pAdj), ci: `[${fmt.f(r.ciLo)}, ${fmt.f(r.ciHi)}]` }))

export function buildFactorialAnova(spec: TestSpec, r: FactorialAnovaResult): CardContent {
  // Residual df: (totalN - 1) - sum of all effect dfs (balanced between-subjects factorial).
  const totalN = r.desc.reduce((s, c) => s + c.n, 0)
  const sumEffectDf = r.rows.reduce((s, row) => s + row.df, 0)
  const dfRes = totalN - 1 - sumEffectDf

  // APA from the interaction row (A×B); fall back to the last row if no interaction term.
  const interactionRow = r.rows.find((row) => row.source.includes('×')) ?? r.rows[r.rows.length - 1]
  const apa = spec.apaTemplate
    .replace('{df1}', fdf(interactionRow.df)).replace('{df2}', String(dfRes))
    .replace('{f}', f(interactionRow.f))
    .replace('p={p}', interactionRow.p < 0.001 ? 'p<.001' : `p=${fp(interactionRow.p)}`)
    .replace('{pes}', f(interactionRow.pes))

  const noteText = `${spec.tableNote!.text} (Levene F=${fx(r.levene.F, f)}, p=${fx(r.levene.p, fp)} · Shapiro W=${fx(r.shapiro.W, f)}, p=${fx(r.shapiro.p, fp)})`

  // Decision 2: include simple-effects rows only for significant terms (p < .05).
  // Marginal rows for factor X: included only if X's ANOVA row p < .05.
  // Interaction rows: included only if the interaction ANOVA row p < .05.
  // If nothing passes the filter, omit Table 3 entirely.
  const sigSources = new Set(r.rows.filter((row) => row.p < 0.05).map((row) => row.source))
  const filteredSE = r.simpleEffects.filter((seRow) => sigSources.has(seRow.term))

  const table1 = { spec: spec.tables[0], rows: r.desc.map((c) => ({ cell: c.cell, n: c.n, m: f(c.m), sd: f(c.sd) })) }
  const table2 = { spec: spec.tables[1], rows: r.rows.map((row) => ({
    source: row.source, ss: f(row.ss), df: fdf(row.df),
    ms: f(row.ms), f: f(row.f), p: fp(row.p), pes: f(row.pes),
  })) }
  const fig = figuresOf(spec)[0]

  const base = {
    note: { kind: 'assume' as const, text: noteText },
    figures: [{ caption: fig.caption, type: fig.type, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }

  if (filteredSE.length === 0) {
    // Decision 2: nothing significant — omit Table 3 entirely
    return { tables: [table1, table2], ...base }
  }

  const table3 = { spec: spec.tables[2], rows: seTableRows(filteredSE, { f, fp }) }
  return { tables: [table1, table2, table3], ...base }
}
