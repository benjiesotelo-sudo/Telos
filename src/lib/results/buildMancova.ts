import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { MancovaResult } from '../stats/mancova'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa } from '../format/apa'

export function buildMancova(spec: TestSpec, r: MancovaResult): CardContent {
  // APA from the SELECTED statistic's fields of the first FACTOR row (owner ruling: option b).
  // The last row of multivariate is the factor (formula: covs + factors).
  const factorRow = r.multivariate[r.multivariate.length - 1]
  const statLabel = r.statistic === 'Wilks' ? "Wilks' Λ" : "Pillai's V"
  const apa = spec.apaTemplate
    .replace("Pillai's V", statLabel)
    .replace('{v}', f01(factorRow.stat))
    .replace('{df1}', fdf(factorRow.df1))
    .replace('{df2}', fdf(factorRow.df2))
    .replace('{f}', f(factorRow.f))
    .replace('{p}', fpApa(factorRow.p))
  // Note: card's assume text + per-covariate slopes appended
  const slopesClause = r.slopes.map((s) => `slopes p(${s.term})=${fp(s.p)}`).join(' · ')
  const noteText = `${spec.tableNote!.text}${slopesClause ? ` (${slopesClause})` : ''}`
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: r.multivariate.map((m) => ({
        effect: m.effect, stat: f(m.stat), f: f(m.f), df1: fdf(m.df1), df2: fdf(m.df2), p: fp(m.p),
      })) },
      { spec: spec.tables[1], rows: r.followups.map((u) => ({
        dv: u.dv, f: f(u.f), df1: fdf(u.df1), df2: fdf(u.df2), p: fp(u.p),
        // partial η² with its one-sided CI (upper pinned at 1.00 — effectsize variance-explained convention)
        pes: `${f(u.pes)} [${f(u.pesLow)}, ${f(u.pesHigh)}]`,
      })) },
    ],
    note: { kind: 'assume', text: noteText },
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
  }
}
