import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { CardContent } from '../lib/results/builders'
import { ApaTable } from './ApaTable'

export function ResultPreviewCard({ index, name, question, content, stale, running, onRerun, figureSlot }:
  { index: number; name: string; question: string; content: CardContent; stale: boolean; running: boolean; onRerun: () => void; figureSlot?: ReactNode }) {
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    const u = content.figures.map((fig) => URL.createObjectURL(new Blob([fig.png as Uint8Array<ArrayBuffer>], { type: 'image/png' })))
    setUrls(u)
    return () => u.forEach((x) => URL.revokeObjectURL(x))
  }, [content])
  // Canonical numbering (U3-T4): a preamble table (EFA stage, captionStyle:'preamble') prints its fixed
  // preambleLabel (e.g. "Table E1.") and is skipped by this running counter, so the first non-preamble
  // table on the card always starts the card's canonical "Table 1." — regardless of how many preamble
  // tables precede it (or whether EFA was deselected and none do). The .map callback below shares this
  // enclosing scope, so it accumulates across the single forward pass exactly like the old `i` did.
  let canonical = 0
  return (
    <section className="card">
      <div className="eyebrow">{String(index).padStart(2, '0')} · {name}</div>
      {stale && (
        <div className="error-box">Stale — the configuration changed since this ran.{' '}
          <button type="button" disabled={running} onClick={onRerun}>Run analysis again</button></div>
      )}
      <p style={{ color: 'var(--muted)' }}>{question}</p>
      {content.tables.map((t) => {
        const spec = t.spec
        const isPreamble = spec.captionStyle === 'preamble'
        if (!isPreamble) canonical += 1
        const caption = spec.captionStyle === 'bare' ? 'Table.'
          : isPreamble ? `Table ${spec.preambleLabel}.`
            : `Table ${canonical}.`
        return (
          <div key={t.matrix ? t.matrix.id : t.spec.id}>
            {t.matrix
              ? (
                <>
                  <p><b>{caption}</b> {t.matrix.caption}</p>
                  {/* domId from the spec (Task-33 collision override) keeps the matrix table's DOM id in
                      sync with the exporter's captureNode(`table-${spec.domId ?? spec.id}`) lookup. */}
                  <ApaTable matrix={t.matrix} domId={t.spec.domId} />
                  {content.note && content.note.afterTableId === t.matrix.id && (
                    <p style={{ fontSize: 11, color: 'var(--muted)' }}>{content.note.text}</p>
                  )}
                </>
              )
              : (
                <>
                  <p><b>{caption}</b> {t.spec.title}</p>
                  <ApaTable id={`table-${t.spec.domId ?? t.spec.id}`} spec={t.spec} rows={t.rows} />
                  {content.note && content.note.afterTableId === t.spec.id && (
                    <p style={{ fontSize: 11, color: 'var(--muted)' }}>{content.note.text}</p>
                  )}
                </>
              )}
          </div>
        )
      })}
      {content.note && !content.tables.some((t) => (t.matrix ? t.matrix.id : t.spec.id) === content.note!.afterTableId) && (
        <p style={{ fontSize: 11, color: 'var(--muted)' }}>{content.note.text}</p>
      )}
      {content.nExcluded > 0 && <p style={{ fontSize: 11, color: 'var(--muted)' }}>{content.nExcluded} rows excluded (missing values)</p>}
      {/* sem-canvas tests draw the figure live (the annotated path diagram is the export source —
          captureNode rasters it from this DOM node), so the slot replaces the placeholder <img>. */}
      {figureSlot
        ? content.figures.map((fig, i) => (
            <div key={`${fig.type}-${i}`}>
              <p><b>Figure.</b> {fig.caption}</p>
              {figureSlot}
            </div>
          ))
        : content.figures.map((fig, i) => (
            <div key={`${fig.type}-${i}`}>
              <p><b>Figure.</b> {fig.caption}</p>
              {urls[i] && <img src={urls[i]} alt={`${fig.type} — ${fig.caption}`} width={480} />}
            </div>
          ))}
      <h3 style={{ fontSize: 15, margin: '16px 0 4px' }}>How to read this test</h3>
      <p className="prose">{content.howToRead}</p>
      <p><b>APA template:</b> {content.apa}</p>
    </section>
  )
}
