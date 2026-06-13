import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { PairedTTestResult } from '../stats/pairedTTest'
import type { CardContent } from './builders'
import { f, f1, fdf, fp, fpApa } from '../format/apa'

export function buildPairedTTest(spec: TestSpec, r: PairedTTestResult): CardContent {
  const apa = spec.apaTemplate
    .replace('{mdiff}', f1(r.meanDiff))
    .replace('{df}', fdf(r.df)).replace('{t}', f(r.t))
    .replace('{p}', fpApa(r.p))
    .replace('{dz}', f(r.dz))
  return {
    tables: [
      { spec: spec.tables[0], rows: r.conditions.map((c) => ({ condition: c.condition, n: c.n, mean: f(c.mean), sd: f(c.sd) })) },
      { spec: spec.tables[1], rows: [{ pair: r.pair, t: f(r.t), df: fdf(r.df), p: fp(r.p), mdiff: f(r.meanDiff), ci: `[${f(r.ci[0])}, ${f(r.ci[1])}]`, d: f(r.dz) }] },
    ],
    note: spec.tableNote ?? null, // the card's static text — no computed values (the card draws no blanks)
    figures: figuresOf(spec).map((fg) => ({ caption: fg.caption, type: fg.type, png: r.figurePng })),
    howToRead: spec.howToRead,
    apa,
    nExcluded: r.nExcluded,
  }
}
