import { useState } from 'react'
import { useSession } from '../../state/session'
import { SPECS } from '../../lib/registry/catalog'
import { buildBundle } from '../../lib/export/bundle'
import { captureNode } from '../../lib/export/capture'
import { FEEDBACK_URL } from '../../content/copy'
import { ResultPreviewCard } from '../ResultPreviewCard'
import { ResultBoundary } from '../ResultBoundary'
import { BUILDERS } from '../../lib/results/builders'

const saveBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}

export function ResultsScreen() {
  const s = useSession()
  const [formats, setFormats] = useState({ tables: false, figures: true })
  const [downloading, setDownloading] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const fresh = s.selection.filter((id) => s.runs[id] && !s.runs[id].stale)
  const running = s.runStatus === 'running'

  const download = async () => {
    setDownloading(true); setExportError(null)
    try {
      const files: Record<string, Uint8Array> = {}
      for (const id of fresh) {
        const spec = SPECS[id]!; const folder = `${String(s.selection.indexOf(id) + 1).padStart(2, '0')}_${id}/`
        const content = BUILDERS[id](spec, s.runs[id].result)
        if (formats.tables) for (const t of content.tables) files[`${folder}table_${t.spec.id}.png`] = await captureNode(`table-${t.spec.domId ?? t.spec.id}`)
        if (formats.figures) for (const fig of content.figures) files[`${folder}figure_${fig.type}.png`] = fig.png
      }
      const names = Object.keys(files)
      if (names.length === 1) saveBlob(new Blob([files[names[0]] as Uint8Array<ArrayBuffer>], { type: 'image/png' }), names[0].split('/')[1])
      else saveBlob(new Blob([buildBundle(files)], { type: 'application/zip' }), 'telos-results.zip')
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e)) // a silent no-op Download is indistinguishable from a dead button
    } finally { setDownloading(false) }
  }

  return (
    <section>
      <div className="eyebrow">Results</div>
      <h1 className="title">Results</h1>

      <div className="card">
        <div className="eyebrow">Export &amp; download · tick one or more</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
          {[['PDF report', 'APA-7 tables, figures, how-to-read text — in selection order'], ['LaTeX file (.tex)', 'the same report as a LaTeX source'], ['R script (.R)', 'reproduces every computation & figure, same sequence · ships with the cleaned dataset']].map(([lbl, why]) => (
            <label key={lbl} className="hint" title={why} style={{ opacity: 0.5 }}>
              <input type="checkbox" disabled /> {lbl} <em>(coming in a later slice)</em>
            </label>
          ))}
          <label title="each test's tables as standalone images"><input type="checkbox" checked={formats.tables} onChange={(e) => setFormats({ ...formats, tables: e.target.checked })} /> Table images (.png)</label>
          <label title="each test's graphs / diagrams as standalone images"><input type="checkbox" checked={formats.figures} onChange={(e) => setFormats({ ...formats, figures: e.target.checked })} /> Figure images (.png)</label>
          <button className="btn" style={{ marginLeft: 'auto' }} disabled={running || downloading || !fresh.length || (!formats.tables && !formats.figures)}
            onClick={() => { void download() }}>{downloading ? 'Preparing…' : 'Download'}</button>
        </div>
        {exportError && <div className="error-box" role="alert">Export failed: {exportError}</div>}
      </div>

      {running && <p className="hint" role="status">{s.runPhase ?? 'Running…'}</p>}
      {s.runStatus === 'error' && (
        <div className="error-box" role="alert">Error: {s.runError}{' '}
          <button type="button" disabled={running} onClick={() => { void s.runAll() }}>Try again</button></div>
      )}

      {s.selection.map((id, i) => {
        const spec = SPECS[id]
        if (!spec) return null
        const nn = String(i + 1).padStart(2, '0')
        if (s.errors[id]) return ( // per-test readable error card; other tests' results stay intact (spec run-state rule)
          <section key={id} className="card">
            <div className="eyebrow">{nn} · {spec.name}</div>
            <div className="error-box" role="alert">This test failed: {s.errors[id]}{' '}
              <button type="button" disabled={running} onClick={() => { void s.runAll() }}>Try again</button></div>
          </section>
        )
        const run = s.runs[id]
        if (!run) return running ? (
          <section key={id} className="card"><div className="eyebrow">{nn} · {spec.name}</div>
            <p className="hint" role="status">{s.runPhase ?? 'Running…'}</p></section>
        ) : null
        // builder runs inside the boundary (via BuiltCard) so one card's display error can't erase the others
        return <ResultBoundary key={id} label={`${nn} · ${spec.name}`}><BuiltCard id={id} index={i + 1} /></ResultBoundary>
      })}

      <p className="hint" style={{ textAlign: 'center', marginTop: 18, marginBottom: 6 }}>
        After export · optional feedback — an anonymous, optional satisfaction survey — opens a short Google Form in a new tab
      </p>
      <p style={{ textAlign: 'center', marginTop: 0 }}>
        <a className="pill" href={FEEDBACK_URL} target="_blank" rel="noopener">How did it go? — Share feedback →</a>
      </p>
    </section>
  )
}

function BuiltCard({ id, index }: { id: string; index: number }) {
  const s = useSession()
  const spec = SPECS[id]!
  const run = s.runs[id]!
  const content = BUILDERS[id](spec, run.result)
  return <ResultPreviewCard index={index} name={spec.name} question={spec.question} content={content}
    stale={run.stale} running={s.runStatus === 'running'} onRerun={() => { void s.runAll() }} />
}
