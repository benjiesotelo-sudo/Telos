import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { AncovaResult } from '../stats/ancova'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa, fx } from '../format/apa'
import { posthocTableRows } from '../stats/posthoc'

export function buildAncova(spec: TestSpec, r: AncovaResult): CardContent {
  const pct = Math.round(r.ciLevel * 100)
  const ciLabel = `${pct}% CI`
  // APA from the first FACTOR row + dfRes.
  // Row order from car::Anova(type=3): covariates first, then factors, then interactions.
  // Interaction rows contain ' × ' (from gsub(':', ' × ', t)).
  // The first FACTOR row is the first non-interaction row after any covariate rows.
  // Simple heuristic: among non-interaction rows, take the last one (factor appears after covariates).
  const nonInteractionRows = r.rows.filter((row) => !row.source.includes(' × '))
  const firstFactorRow = nonInteractionRows[nonInteractionRows.length - 1] ?? r.rows[0]

  const apa = spec.apaTemplate
    .replace('{df1}', fdf(firstFactorRow.df))
    .replace('{df2}', fdf(r.dfRes))
    .replace('{f}', f(firstFactorRow.f))
    .replace('{p}', fpApa(firstFactorRow.p))
    .replace('{pes}', f01(firstFactorRow.pes))

  // Note: card text + slopes per-term + Levene
  const slopesStr = r.slopes.map((s) => `slopes p(${s.term})=${fp(s.p)}`).join(' · ')
  const levStr = `Levene F=${fx(r.levene.F, f)}, p=${fx(r.levene.p, fp)}`
  const noteText = `${spec.tableNote!.text} (${slopesStr} · ${levStr})`

  const fig = figuresOf(spec)[0]

  const t0cols = spec.tables[0].columns.map((c) => c.key === 'ci' ? { ...c, label: ciLabel } : c)
  const t2cols = spec.tables[2].columns.map((c) => c.key === 'ci' ? { ...c, label: ciLabel } : c)
  return {
    tables: [
      {
        spec: { ...spec.tables[0], columns: t0cols },
        rows: r.adjusted.map((a) => ({
          group: a.group,
          adjm: f(a.mean),
          se: f(a.se),
          ci: `[${f(a.ciLo)}, ${f(a.ciHi)}]`,
        })),
      },
      {
        spec: spec.tables[1],
        rows: r.rows.map((row) => ({
          source: row.source,
          ss: f(row.ss),
          df: fdf(row.df),
          ms: f(row.ms),
          f: f(row.f),
          p: fp(row.p),
          pes: f(row.pes),
        })),
      },
      {
        spec: { ...spec.tables[2], columns: t2cols },
        rows: posthocTableRows(r.posthoc, { f, fp }),
      },
    ],
    note: { kind: 'assume', text: noteText, afterTableId: spec.tableNote?.afterTableId },
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
