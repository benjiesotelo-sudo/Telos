import type { TestSpec } from '../registry/types'
import type { TTestResult } from '../stats/types'
import type { CardContent } from './builders'
import { f, f1, fdf, fp, fpApa, fx } from '../format/apa'

const tailsNote = (t: string) => t === 'two.sided' ? '' : ` This was a one-tailed test (${t}).`

export function buildIndependentTTest(spec: TestSpec, r: TTestResult): CardContent {
  const [g1, g2] = r.groupStats
  const pct = Math.round(r.ciLevel * 100)
  const ciLabel = `${pct}% CI`
  const apa = spec.apaTemplate
    .replace('{g1}', g1.group).replace('{m1}', f1(g1.mean)).replace('{sd1}', f1(g1.sd))
    .replace('{g2}', g2.group).replace('{m2}', f1(g2.mean)).replace('{sd2}', f1(g2.sd))
    .replace('{df}', fdf(r.df)).replace('{t}', f(r.t))
    .replace('{p}', fpApa(r.p))
    .replace('{d}', f(r.cohensD)).replace('{dlo}', f(r.cohensDLow)).replace('{dhi}', f(r.cohensDHigh))
  // Both CI columns (mean-diff + effect-size) follow the same pattern: registry holds the 95% default literal, the builder swaps in the adjustable level.
  const t2cols = spec.tables[1].columns.map((c) => c.key === 'ci' ? { ...c, label: ciLabel } : c.key === 'd' ? { ...c, label: c.label.replace('95% CI', ciLabel) } : c)
  return {
    tables: [
      { spec: spec.tables[0], rows: r.groupStats.map((g) => ({ group: g.group, n: g.n, mean: f(g.mean), sd: f(g.sd), se: f(g.se) })) },
      { spec: { ...spec.tables[1], columns: t2cols }, rows: [{ contrast: r.contrast, t: f(r.t), df: fdf(r.df), p: fp(r.p), mdiff: f(r.meanDiff), ci: `[${f(r.ci[0])}, ${f(r.ci[1])}]`, d: `${f(r.cohensD)} [${f(r.cohensDLow)}, ${f(r.cohensDHigh)}]` }] },
    ],
    note: { kind: 'assume', text: `${spec.assumptionNote} (Levene F=${fx(r.levene.F, f)}, p=${fx(r.levene.p, fp)} · ${r.shapiroByGroup.map((s) => `Shapiro ${s.group} W=${fx(s.W, f)}, p=${fx(s.p, fp)}`).join('; ')} · ${r.test === 'welch' ? 'Welch' : 'pooled'} test)` },
    figures: [{ caption: spec.figure!.caption, type: spec.figure!.type, png: r.figurePng }],
    howToRead: spec.howToRead.replace('95% CI', ciLabel).replace('(e.g. .05)', `(e.g. ${r.alpha})`) + tailsNote(r.tails),
    apa,
    nExcluded: r.nExcluded,
    // U8-T3/U8-T4: same numbers already formatted above for the table/apa strings, keyed to match the
    // 'independent-t-test' EXPLAINERS entries (t, p, d, n, mean, sd, se, df, mdiff, ci) in
    // registry/explainers.ts. n/mean/sd/se are per-group (the card is always exactly 2 groups —
    // TTestResult.groupStats is a fixed [GroupStat, GroupStat] tuple), so both groups' numbers and
    // names are carried under suffixed keys (g1/g2/n1/n2/...) for the interpret() functions to weave.
    values: {
      g1: g1.group, g2: g2.group,
      n1: g1.n, n2: g2.n, mean1: f(g1.mean), mean2: f(g2.mean), sd1: f(g1.sd), sd2: f(g2.sd), se1: f(g1.se), se2: f(g2.se),
      df: fdf(r.df), t: f(r.t), p: fpApa(r.p), d: f(r.cohensD), dlo: f(r.cohensDLow), dhi: f(r.cohensDHigh),
      mdiff: f(r.meanDiff), ci: `[${f(r.ci[0])}, ${f(r.ci[1])}]`, ciPct: pct,
    },
  }
}
