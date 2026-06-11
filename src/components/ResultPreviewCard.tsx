import { useEffect, useState } from 'react'
import type { TestSpec } from '../lib/registry/types'
import type { TTestResult } from '../lib/stats/types'
import { ApaTable } from './ApaTable'
import { f, f1, fdf, fp, fx } from '../lib/format/apa'

export function ResultPreviewCard({ index, spec, result, stale, running, onRerun }:
  { index: number; spec: TestSpec; result: TTestResult; stale: boolean; running: boolean; onRerun: () => void }) {
  const [figureUrl, setFigureUrl] = useState<string | null>(null)
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([result.figurePng], { type: 'image/png' }))
    setFigureUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [result])
  const [g1, g2] = result.groupStats
  const t1Rows = result.groupStats.map((g) => ({ group: g.group, n: g.n, mean: f(g.mean), sd: f(g.sd), se: f(g.se) }))
  const t2Rows = [{ contrast: result.contrast, t: f(result.t), df: fdf(result.df), p: fp(result.p),
    mdiff: f(result.meanDiff), ci: `[${f(result.ci[0])}, ${f(result.ci[1])}]`, d: f(result.cohensD) }]
  const apa = spec.apaTemplate
    .replace('{g1}', g1.group).replace('{m1}', f1(g1.mean)).replace('{sd1}', f1(g1.sd))
    .replace('{g2}', g2.group).replace('{m2}', f1(g2.mean)).replace('{sd2}', f1(g2.sd))
    .replace('{df}', fdf(result.df)).replace('{t}', f(result.t))
    .replace('p={p}', result.p < 0.001 ? 'p<.001' : `p=${fp(result.p)}`)
    .replace('{d}', f(result.cohensD))
  return (
    <section className="card">
      <div className="eyebrow">{String(index).padStart(2, '0')} · {spec.name}</div>
      {stale && (
        <div className="error-box">Stale — the configuration changed since this ran.{' '}
          <button type="button" disabled={running} onClick={onRerun}>Run analysis again</button></div>
      )}
      <p style={{ color: 'var(--muted)' }}>{spec.question}</p>
      <p><b>Table 1.</b> {spec.tables[0].title}</p>
      <ApaTable id={`table-${spec.tables[0].id}`} spec={spec.tables[0]} rows={t1Rows} />
      <p><b>Table 2.</b> {spec.tables[1].title}</p>
      <ApaTable id={`table-${spec.tables[1].id}`} spec={spec.tables[1]} rows={t2Rows} />
      <p style={{ fontSize: 11, color: 'var(--muted)' }}>{spec.assumptionNote} (Levene F={fx(result.levene.F, f)}, p={fx(result.levene.p, fp)} · {result.test} test)</p>
      {result.nExcluded > 0 && <p style={{ fontSize: 11, color: 'var(--muted)' }}>{result.nExcluded} rows excluded (missing values)</p>}
      <p><b>Figure.</b> {spec.figure.caption}</p>
      {figureUrl && <img src={figureUrl} alt="boxplot of the outcome by group" width={480} />}
      <h3 style={{ fontSize: 15, margin: '16px 0 4px' }}>How to read this test</h3>
      <p>{spec.howToRead}</p>
      <p>APA: {apa}</p>
    </section>
  )
}
