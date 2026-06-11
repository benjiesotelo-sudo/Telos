import { useEffect, useState } from 'react'
import { useSession } from '../state/session'
import { INDEPENDENT_T_TEST as spec } from '../lib/registry/independentTTest'
import { ApaTable } from './ApaTable'

const minus = (s: string) => s.replace(/-/g, '−')                                  // U+2212, as the card typesets negatives
const f = (n: number) => minus(n.toFixed(2))
const f1 = (n: number) => minus(n.toFixed(1))                                      // APA-sentence M/SD, per the card
const fdf = (n: number) => (Number.isInteger(n) ? String(n) : f(n))                // 't(58)' pooled · 't(9.68)' Welch
const fp = (p: number) => (p < 0.001 ? '<.001' : p.toFixed(3).replace(/^0/, ''))
const fx = (n: number | null, fmt: (v: number) => string) => (n == null || !Number.isFinite(n) ? '—' : fmt(n))

export function ResultCard() {
  const { result, status, error } = useSession()
  const [figureUrl, setFigureUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!result) { setFigureUrl(null); return }
    const url = URL.createObjectURL(new Blob([result.figurePng], { type: 'image/png' }))
    setFigureUrl(url)
    return () => URL.revokeObjectURL(url) // revoke on result change/unmount — no blob leaks (StrictMode-safe)
  }, [result])
  if (status === 'error') return <p role="alert">Error: {error}</p>
  if (!result) return null
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
    <section className="card" style={{ padding: 16 }}>
      <h2 className="display">{spec.name}</h2>
      <p style={{ color: 'var(--muted)' }}>{spec.question}</p>
      <p><b>Table 1.</b> {spec.tables[0].title}</p>
      <ApaTable id={`table-${spec.tables[0].id}`} spec={spec.tables[0]} rows={t1Rows} />
      <p><b>Table 2.</b> {spec.tables[1].title}</p>
      <ApaTable id={`table-${spec.tables[1].id}`} spec={spec.tables[1]} rows={t2Rows} />
      <p style={{ fontSize: 11, color: 'var(--muted)' }}>{spec.assumptionNote} (Levene F={fx(result.levene.F, f)}, p={fx(result.levene.p, fp)} · {result.test} test)</p>
      {result.nExcluded > 0 && <p style={{ fontSize: 11, color: 'var(--muted)' }}>{result.nExcluded} rows excluded (missing values)</p>}
      <p><b>Figure.</b> {spec.figure.caption}</p>
      {figureUrl && <img src={figureUrl} alt="boxplot of the outcome by group" width={480} />}
      <h3 className="display">How to read this test</h3>
      <p>{spec.howToRead}</p>
      <p>APA: {apa}</p>
    </section>
  )
}
