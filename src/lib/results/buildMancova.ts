import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { MancovaResult } from '../stats/mancova'
import type { CardContent } from './builders'
import { f, fdf, fp } from '../format/apa'

export function buildMancova(spec: TestSpec, r: MancovaResult): CardContent {
  // APA always from the first FACTOR row's Pillai fields (recorded decision 1).
  // "First factor row" = the first row in multivariate whose effect matches a factor name
  // (after covariate rows). In our sequential manova formula the factor row comes last.
  // Find the first non-covariate row (heuristic: last row is the factor in the single-factor case).
  // More robustly: the last row of multivariate is the factor (formula: covs + factors).
  const factorRow = r.multivariate[r.multivariate.length - 1]
  const apa = spec.apaTemplate
    .replace('{v}', f(factorRow.pillai))
    .replace('{df1}', fdf(factorRow.pillaiDf1))
    .replace('{df2}', fdf(factorRow.pillaiDf2))
    .replace('{f}', f(factorRow.pillaiF))
    .replace('p={p}', factorRow.pillaiP < 0.001 ? 'p<.001' : `p=${fp(factorRow.pillaiP)}`)
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
        dv: u.dv, f: f(u.f), df1: fdf(u.df1), df2: fdf(u.df2), p: fp(u.p), pes: f(u.pes),
      })) },
    ],
    note: { kind: 'assume', text: noteText },
    figures: [{ caption: fig.caption, type: fig.type, png: r.figurePng }],
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
