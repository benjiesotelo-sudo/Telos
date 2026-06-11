import { useState } from 'react'
import { useSession } from '../../state/session'
import { parseCsv } from '../../lib/data/parseCsv'
import { listSheets, parseExcelSheet } from '../../lib/data/parseExcel'
import { UPLOAD_ACCEPT, UPLOAD_NOTE, SIZE_WARN, SIZE_WARN_TEXT } from '../../content/copy'
import type { Dataset } from '../../lib/stats/types'

export function UploadScreen() {
  const { loadDataset, goTo } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [warn, setWarn] = useState<string | null>(null)
  const [pending, setPending] = useState<{ name: string; size: number; bytes: ArrayBuffer; sheets: string[]; sheet: string } | null>(null)

  const finish = (ds: Dataset, name: string, sizeBytes: number, encoding: string) => {
    if (!ds.columns.length || !ds.rows.length) { setError(`${name} parsed but contains no data rows — fix the file and re-upload.`); return }
    loadDataset(ds, { name, rows: ds.rows.length, cols: ds.columns.length, encoding })
    const big = sizeBytes > SIZE_WARN.mb * 1024 * 1024 || ds.rows.length > SIZE_WARN.rows
    if (big) setWarn(SIZE_WARN_TEXT) // stay so the warning is read; Continue proceeds
    else goTo('guide')
  }
  const onFile = async (f: File) => {
    setError(null); setWarn(null); setPending(null)
    try {
      if (/\.(xlsx|xls)$/i.test(f.name)) {
        const bytes = await f.arrayBuffer()
        const sheets = listSheets(bytes)
        if (sheets.length > 1) { setPending({ name: f.name, size: f.size, bytes, sheets, sheet: sheets[0] }); return }
        finish(parseExcelSheet(bytes, sheets[0]), f.name, f.size, 'UTF-8')
      } else {
        // ui-spec DRAFT: UTF-8 and Latin-1 accepted — strict-UTF-8 first, fall back to windows-1252, report honestly in the banner
        const buf = await f.arrayBuffer()
        let text = '', encoding = 'UTF-8'
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf) }
        catch { text = new TextDecoder('windows-1252').decode(buf); encoding = 'Latin-1' }
        finish(parseCsv(text), f.name, f.size, encoding)
      }
    } catch (e) { setError(`Couldn't parse ${f.name}: ${e instanceof Error ? e.message : String(e)} — fix the file and re-upload.`) }
  }

  return (
    <section>
      <div className="eyebrow">Step 2</div>
      <h1 className="title">Upload data</h1>
      <label className="slot" style={{ display: 'block', textAlign: 'center', padding: '30px 16px', cursor: 'pointer' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) void onFile(f) }}>
        Drop a file here or <b style={{ color: 'var(--accent)' }}>browse</b>
        <div className="hint" style={{ marginTop: 6 }}>{UPLOAD_NOTE}</div>
        <input type="file" accept={UPLOAD_ACCEPT} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f) }} />
      </label>
      {pending && (
        <div className="card">
          {pending.name} · {pending.sheets.length} sheets →{' '}
          <label>Sheet:{' '}
            <select value={pending.sheet} onChange={(e) => setPending({ ...pending, sheet: e.target.value })}>
              {pending.sheets.map((s) => <option key={s}>{s}</option>)}
            </select></label>{' '}
          <span className="hint">(default: first)</span>
          <button className="btn" style={{ marginLeft: 12 }}
            onClick={() => { try { finish(parseExcelSheet(pending.bytes, pending.sheet), pending.name, pending.size, 'UTF-8') } catch (e) { setError(`Couldn't parse sheet "${pending.sheet}": ${e instanceof Error ? e.message : String(e)}`) } }}>
            Use this sheet</button>
        </div>
      )}
      {warn && (
        <div className="card">
          <div className="error-box" style={{ marginTop: 0 }}>{warn}</div>
          <div className="btn-row"><button className="btn" onClick={() => goTo('guide')}>Continue</button></div>
        </div>
      )}
      {error && <div className="error-box" role="alert">{error}</div>}
    </section>
  )
}
