import { useEffect, useState } from 'react'
import type { CardContent } from '../lib/results/builders'
import { ApaTable } from './ApaTable'

export function ResultPreviewCard({ index, name, question, content, stale, running, onRerun }:
  { index: number; name: string; question: string; content: CardContent; stale: boolean; running: boolean; onRerun: () => void }) {
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    const u = content.figures.map((fig) => URL.createObjectURL(new Blob([fig.png as Uint8Array<ArrayBuffer>], { type: 'image/png' })))
    setUrls(u)
    return () => u.forEach((x) => URL.revokeObjectURL(x))
  }, [content])
  return (
    <section className="card">
      <div className="eyebrow">{String(index).padStart(2, '0')} · {name}</div>
      {stale && (
        <div className="error-box">Stale — the configuration changed since this ran.{' '}
          <button type="button" disabled={running} onClick={onRerun}>Run analysis again</button></div>
      )}
      <p style={{ color: 'var(--muted)' }}>{question}</p>
      {content.tables.map((t, i) => (
        <div key={t.spec.id}>
          <p><b>{t.spec.captionStyle === 'bare' ? 'Table.' : `Table ${i + 1}.`}</b> {t.spec.title}</p>
          <ApaTable id={`table-${t.spec.domId ?? t.spec.id}`} spec={t.spec} rows={t.rows} />
        </div>
      ))}
      {content.note && <p style={{ fontSize: 11, color: 'var(--muted)' }}>{content.note.text}</p>}
      {content.nExcluded > 0 && <p style={{ fontSize: 11, color: 'var(--muted)' }}>{content.nExcluded} rows excluded (missing values)</p>}
      {content.figures.map((fig, i) => (
        <div key={`${fig.type}-${i}`}>
          <p><b>Figure.</b> {fig.caption}</p>
          {urls[i] && <img src={urls[i]} alt={`${fig.type} — ${fig.caption}`} width={480} />}
        </div>
      ))}
      <h3 style={{ fontSize: 15, margin: '16px 0 4px' }}>How to read this test</h3>
      <p>{content.howToRead}</p>
      <p>APA: {content.apa}</p>
    </section>
  )
}
