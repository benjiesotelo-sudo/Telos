import type { TestSpec } from '../registry/types'
import { figuresOf } from '../registry/types'
import type { MancovaResult } from '../stats/mancova'
import type { CardContent } from './builders'
import { f, f01, fdf, fp, fpApa, fx } from '../format/apa'
import { verdictClause, verdictFromBoolean } from '../format/verdict'

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
    .replace('{mpes}', f01(factorRow.mpes)).replace('{mpeslo}', f01(factorRow.mpesLow)).replace('{mpeshi}', f01(factorRow.mpesHigh))
  // Note: card's assume text + Box's M (homogeneity of covariance matrices) + per-covariate slopes appended
  const slopesClause = r.slopes.map((s) => `slopes p(${s.term})=${fp(s.p)}`).join(' · ')
  const boxClause = `Box's M χ²(${fx(r.boxM.df, fdf)})=${fx(r.boxM.chisq, f)}, p=${fx(r.boxM.p, fp)}`
  const inner = [boxClause, slopesClause].filter(Boolean).join(' · ')
  // Audit V (2026-07-06 completeness audit): plain-language verdicts for both reported checks.
  const boxMVerdict = verdictClause(r.boxM.p, r.alpha, 'covariance matrices look homogeneous',
    "covariance matrices look heterogeneous; interpret with extra caution (Pillai's trace is comparatively robust to this violation)")
  const slopesViolated = r.slopes.some((s) => s.p != null && s.p < r.alpha)
  const slopesVerdict = verdictFromBoolean(slopesViolated,
    'the regression slopes look homogeneous across groups',
    "at least one covariate's slope differs across groups; the covariate adjustment may not be valid")
  const noteText = `${spec.tableNote!.text} (${inner})${boxMVerdict}${slopesVerdict}`
  const fig = figuresOf(spec)[0]
  return {
    tables: [
      { spec: spec.tables[0], rows: r.multivariate.map((m) => ({
        effect: m.effect, stat: f(m.stat), f: f(m.f), df1: fdf(m.df1), df2: fdf(m.df2), p: fp(m.p),
        mpes: `${f(m.mpes)} [${f(m.mpesLow)}, ${f(m.mpesHigh)}]`,
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
    // U8-T4: keyed to match the 'mancova' EXPLAINERS entries in registry/explainers.ts.
    // Headline = factorRow (already computed above for the APA sentence).
    values: {
      effect: factorRow.effect, stat: f(factorRow.stat), statLabel,
      f: f(factorRow.f), df1: fdf(factorRow.df1), df2: fdf(factorRow.df2),
      p: fpApa(factorRow.p), pSig: factorRow.p < r.alpha ? 'below' : 'at or above', alpha: String(r.alpha),
      mpes: f01(factorRow.mpes), mpesLow: f01(factorRow.mpesLow), mpesHigh: f01(factorRow.mpesHigh),
      nDVs: String(r.followups.length),
    },
  }
}
