import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { AncovaResult } from '../stats/ancova'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa, fx } from '../format/apa'
import { posthocTableRows } from '../stats/posthoc'
import { verdictClause, verdictFromBoolean } from '../format/verdict'

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
    .replace('{plo}', f(firstFactorRow.pesLow)).replace('{phi}', f(firstFactorRow.pesHigh))

  // Note: card text + slopes per-term + Levene + residual Shapiro (audit gap, STANDARD)
  const slopesStr = r.slopes.map((s) => `slopes p(${s.term})=${fp(s.p)}`).join(' · ')
  const levStr = `Levene F=${fx(r.levene.F, f)}, p=${fx(r.levene.p, fp)}`
  const shStr = `Shapiro W=${fx(r.shapiro.W, f)}, p=${fx(r.shapiro.p, fp)}`
  // Audit V (2026-07-06 completeness audit): plain-language verdicts for all three reported checks.
  const slopesViolated = r.slopes.some((s) => s.p != null && s.p < r.alpha)
  const slopesVerdict = verdictFromBoolean(slopesViolated,
    'the regression slopes look homogeneous across groups',
    "at least one covariate's slope differs across groups; the adjusted-means comparison may not be valid")
  const leveneVerdict = verdictClause(r.levene.p, r.alpha, 'equal variances look reasonable',
    'equal variances look doubtful; interpret the F-tests with extra caution')
  const shapiroVerdict = verdictClause(r.shapiro.p, r.alpha, 'residual normality looks reasonable',
    'residual normality looks doubtful; interpret the F-tests with extra caution')
  const noteText = `${spec.tableNote!.text} (${slopesStr} · ${levStr} · ${shStr})${slopesVerdict}${leveneVerdict}${shapiroVerdict}`

  const fig = figuresOf(spec)[0]

  const t0cols = spec.tables[0].columns.map((c) => c.key === 'ci' ? { ...c, label: ciLabel } : c)
  const t2cols = spec.tables[2].columns.map((c) => c.key === 'ci' ? { ...c, label: ciLabel } : c)
  // partial-η² header: registry holds the 95% default literal; swap in the adjustable level (mirrors the CI columns).
  const t1cols = spec.tables[1].columns.map((c) => c.key === 'pes' ? { ...c, label: c.label.replace('95% CI', ciLabel) } : c)
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
        spec: { ...spec.tables[1], columns: t1cols },
        rows: r.rows.map((row) => ({
          source: row.source,
          ss: f(row.ss),
          df: fdf(row.df),
          ms: f(row.ms),
          f: f(row.f),
          p: fp(row.p),
          pes: `${f(row.pes)} [${f(row.pesLow)}, ${f(row.pesHigh)}]`,
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
    // U8-T4: keyed to match the 'ancova' EXPLAINERS entries in registry/explainers.ts.
    // Headline = firstFactorRow (already computed above for the APA sentence).
    values: {
      source: firstFactorRow.source, ss: f(firstFactorRow.ss), df: fdf(firstFactorRow.df),
      ms: f(firstFactorRow.ms), f: f(firstFactorRow.f),
      p: fpApa(firstFactorRow.p), pSig: firstFactorRow.p < r.alpha ? 'below' : 'at or above', alpha: String(r.alpha),
      pes: f01(firstFactorRow.pes), pesLow: f01(firstFactorRow.pesLow), pesHigh: f01(firstFactorRow.pesHigh),
      nGroups: String(r.adjusted.length),
    },
  }
}
