import { useState } from 'react'
import { useSession, workingDataset, type SessionState } from '../../state/session'
import { SPECS } from '../../lib/registry/catalog'
import { buildBundle } from '../../lib/export/bundle'
import { captureNode } from '../../lib/export/capture'
import { emitRScript } from '../../lib/export/rScript/emit'
import { toCsv } from '../../lib/export/cleanedCsv'
import { emitLatex } from '../../lib/export/latex'
import { licensesText } from '../../lib/export/licenses'
import { citationsText } from '../../lib/export/citations'
import { FEEDBACK_URL } from '../../content/copy'
import { ResultPreviewCard } from '../ResultPreviewCard'
import { ResultBoundary } from '../ResultBoundary'
import { BUILDERS } from '../../lib/results/builders'

const saveBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}

// MIME for a single saved file, derived from its extension (a future non-PNG single file isn't mislabeled).
const MIME_BY_EXT: Record<string, string> = { png: 'image/png', tex: 'text/x-tex', csv: 'text/csv', r: 'text/plain', txt: 'text/plain' }
const mimeFor = (name: string) => MIME_BY_EXT[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'

export interface ExportFormats { tables: boolean; figures: boolean; pdf: boolean; latex: boolean; r: boolean }
const enc = (str: string): Uint8Array => new TextEncoder().encode(str)

// PURE file-map assembly for the export bundle (no DOM): the byte/string artifacts only.
// Table PNGs need captureNode (async, DOM-bound) so the component layers those on top —
// keeping this testable in the node env. Over the fresh tests (non-stale runs, in selection
// order; folder NN = 1-based padded):
//   figures → NN_id/figure_<file??type>.png · latex → ALSO figures/NN_id/...png (so report.tex
//   resolves) + report.tex · r → analysis.R + cleaned.csv · r|latex → LICENSES.txt + CITATIONS.txt
//   (both scoped to the formats whose bundled R packages/fonts they credit/cite — note for review).
export function buildExportFiles(s: SessionState, formats: ExportFormats): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {}
  const fresh = s.selection.filter((id) => s.runs[id] && !s.runs[id].stale)
  for (const id of fresh) {
    const spec = SPECS[id]!; const folder = `${String(s.selection.indexOf(id) + 1).padStart(2, '0')}_${id}/`
    const content = BUILDERS[id](spec, s.runs[id].result)
    for (const fig of content.figures) {
      const name = `figure_${fig.file ?? fig.type}.png`
      if (formats.figures) files[`${folder}${name}`] = fig.png
      if (formats.latex) files[`figures/${folder}${name}`] = fig.png // emitLatex \includegraphics path
    }
  }
  // Pass the FULL selection (not `fresh`): emitLatex numbers figure folders by the full-selection index
  // and skips non-fresh ids itself, so its \includegraphics NN matches the figure PNG keys written above.
  if (formats.latex) files['report.tex'] = enc(emitLatex(s.selection, s.setups, SPECS, s.runs))
  if (formats.r) { files['analysis.R'] = enc(emitRScript(fresh, s.setups, SPECS, workingDataset(s))); files['cleaned.csv'] = enc(toCsv(workingDataset(s))) }
  if (formats.r || formats.latex) files['LICENSES.txt'] = enc(licensesText())
  if (formats.r || formats.latex) files['CITATIONS.txt'] = enc(citationsText())
  return files
}

// Browser print-to-PDF: print.css's @media print + body.printing rules do the layout
// (hide [data-noprint], full-width avoid-break cards, page-break between results).
// doc/win are injectable so this is testable in the node environment (no jsdom). Dormant —
// Task 10 wires it to the PDF download path.
export function printReport(doc: Document = document, win: Window = window) {
  doc.body.classList.add('printing')
  const done = () => { doc.body.classList.remove('printing'); win.removeEventListener('afterprint', done) }
  win.addEventListener('afterprint', done, { once: true }) // {once} so repeated Download clicks don't stack listeners
  win.print()
}

export function ResultsScreen() {
  const s = useSession()
  const [formats, setFormats] = useState<ExportFormats>({ tables: false, figures: true, pdf: false, latex: false, r: false })
  const [downloading, setDownloading] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const fresh = s.selection.filter((id) => s.runs[id] && !s.runs[id].stale)
  const running = s.runStatus === 'running'
  const anyFormat = formats.tables || formats.figures || formats.pdf || formats.latex || formats.r

  const download = async () => {
    setDownloading(true); setExportError(null)
    try {
      const files = buildExportFiles(s, formats) // pure byte/string artifacts; table PNGs (DOM) layered on below
      if (formats.tables) for (const id of fresh) {
        const spec = SPECS[id]!; const folder = `${String(s.selection.indexOf(id) + 1).padStart(2, '0')}_${id}/`
        for (const t of BUILDERS[id](spec, s.runs[id].result).tables) files[`${folder}table_${t.spec.id}.png`] = await captureNode(`table-${t.spec.domId ?? t.spec.id}`)
      }
      const names = Object.keys(files)
      if (names.length === 1) { const fname = names[0].split('/').pop()!; saveBlob(new Blob([files[names[0]] as Uint8Array<ArrayBuffer>], { type: mimeFor(fname) }), fname) }
      else if (names.length) saveBlob(new Blob([buildBundle(files)], { type: 'application/zip' }), 'telos-export.zip')
      if (formats.pdf) printReport() // browser print-to-PDF; the only artifact when PDF is the sole tick
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e)) // a silent no-op Download is indistinguishable from a dead button
    } finally { setDownloading(false) }
  }

  return (
    <section>
      <div className="eyebrow">Results</div>
      <h1 className="title">Results</h1>

      <div className="card" data-noprint>
        <div className="eyebrow">Export &amp; download · tick one or more</div>
        <div data-noprint style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
          {([['pdf', 'PDF report', 'APA-7 tables, figures, how-to-read text — in selection order'], ['latex', 'LaTeX file (.tex)', 'the same report as a LaTeX source'], ['r', 'R script (.R)', 'reproduces every computation & figure, same sequence · ships with the cleaned dataset']] as [keyof ExportFormats, string, string][]).map(([key, lbl, why]) => (
            <label key={key} title={why}>
              <input type="checkbox" checked={formats[key]} onChange={(e) => setFormats({ ...formats, [key]: e.target.checked })} /> {lbl}
            </label>
          ))}
          <label title="each test's tables as standalone images"><input type="checkbox" checked={formats.tables} onChange={(e) => setFormats({ ...formats, tables: e.target.checked })} /> Table images (.png)</label>
          <label title="each test's graphs / diagrams as standalone images"><input type="checkbox" checked={formats.figures} onChange={(e) => setFormats({ ...formats, figures: e.target.checked })} /> Figure images (.png)</label>
          <button className="btn" data-noprint style={{ marginLeft: 'auto' }} disabled={running || downloading || !fresh.length || !anyFormat}
            onClick={() => { void download() }}>{downloading ? 'Preparing…' : 'Download'}</button>
        </div>
        {exportError && <div className="error-box" role="alert">Export failed: {exportError}</div>}
      </div>

      {running && <p className="hint" role="status">{s.runPhase ?? 'Running…'}</p>}
      {s.runStatus === 'error' && (
        <div className="error-box" role="alert">Error: {s.runError}{' '}
          <button type="button" disabled={running} onClick={() => { void s.runAll() }}>Try again</button></div>
      )}

      <div className="results-cards">{s.selection.map((id, i) => {
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
      })}</div>

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
