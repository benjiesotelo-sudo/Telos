import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { WelchAnovaResult } from '../stats/welchAnova'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa, fx } from '../format/apa'
import { verdictClause } from '../format/verdict'

export function buildWelchAnova(spec: TestSpec, r: WelchAnovaResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{df1}', fdf(r.df1)).replace('{df2}', fdf(r.df2)).replace('{f}', f(r.f))
    .replace('{p}', fpApa(r.p))
    .replace('{omega2}', f01(r.omega2)).replace('{omega2lo}', f01(r.omega2Low)).replace('{omega2hi}', f01(r.omega2High))
  const fig = figuresOf(spec)[0]
  // Normality is checked per group; flag a violation if ANY group's Shapiro is significant (audit V).
  const shapiroPs = r.shapiro.map((s) => s.p).filter((p): p is number => p != null)
  const shapiroMinP = shapiroPs.length > 0 ? Math.min(...shapiroPs) : null
  const shapiroVerdict = verdictClause(shapiroMinP, r.alpha, 'normality looks reasonable across groups',
    'normality looks doubtful in at least one group; interpret the post-hoc comparisons with extra caution')
  return {
    tables: [
      { spec: spec.tables[0], rows: r.desc.map((g) => ({ group: g.group, n: g.n, m: f(g.m), sd: f(g.sd) })) },
      { spec: spec.tables[1], rows: [{ f: f(r.f), df1: fdf(r.df1), df2: fdf(r.df2), p: fp(r.p), omega2: `${f01(r.omega2)} [${f01(r.omega2Low)}, ${f01(r.omega2High)}]` }] },
      { spec: spec.tables[2], rows: r.posthoc.map((row) => ({
          pair: row.pair,
          mdiff: f(row.diff),
          padj: fp(row.pAdj),
          ci: `[${f(row.ciLo)}, ${f(row.ciHi)}]`,
        })) },
    ],
    note: { kind: 'assume', text: `${spec.tableNote!.text} (Shapiro per group: ${r.shapiro.map((s) => `${s.group} W=${fx(s.W, f)}, p=${fx(s.p, fp)}`).join('; ')})${shapiroVerdict}` }, // mirror buildOneWayAnova: static tableNote + computed per-group W/p, em-dash NA via fx()
    figures: [{ caption: fig.caption, type: fig.type, file: fig.file, png: r.figurePng }],
    howToRead: spec.howToRead + ` Your significance threshold (α) is ${r.alpha}.`,
    apa,
    nExcluded: r.nExcluded,
    // U8-T4: keyed to match the 'welch-anova' EXPLAINERS entries in registry/explainers.ts.
    values: {
      f: f(r.f), df1: fdf(r.df1), df2: fdf(r.df2),
      p: fpApa(r.p), pSig: r.p < r.alpha ? 'below' : 'at or above', alpha: String(r.alpha),
      omega2: f01(r.omega2), omega2Low: f01(r.omega2Low), omega2High: f01(r.omega2High),
      nGroups: String(r.desc.length),
    },
  }
}
