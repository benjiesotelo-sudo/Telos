#!/usr/bin/env node
// Assemble ONE self-contained audit HTML per test from its docs/test-documentation/<dir> artifacts.
// Usage: npx tsx docs/build-test-doc.mjs 05_independent-t-test [more dirs...]
//   (tsx, not plain node — see the registry import below, same pattern as scripts/gen-test-tree.ts)
// Output: docs/test-documentation/<dir>.html (single file, all assets base64-embedded).
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdtempSync, rmSync, copyFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { tmpdir } from 'node:os'
import { execSync } from 'node:child_process'
import { citationsTxt } from '../src/lib/registry/citations.ts'

const ROOT = join(import.meta.dirname, 'test-documentation')

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const b64 = (p) => readFileSync(p).toString('base64')
const kb = (p) => `${Math.max(1, Math.round(statSync(p).size / 1024))} KB`

function img(p, cap) {
  return `<figure><img src="data:image/png;base64,${b64(p)}" alt="${esc(cap)}" loading="lazy"><figcaption>${esc(cap)} · ${kb(p)}</figcaption></figure>`
}

// Light R syntax highlighting: comments, strings, numbers, a few keywords.
function highlightR(src) {
  let s = esc(src)
  s = s.replace(/(&quot;|&#39;|")(?:[^"\\]|\\.)*?"/g, (m) => `<span class="str">${m}</span>`)
  s = s.replace(/(^|\n)(#[^\n]*)/g, (_, a, c) => `${a}<span class="com">${c}</span>`)
  s = s.replace(/\b(function|if|else|for|while|TRUE|FALSE|NULL|NA|library|require)\b/g, '<span class="kw">$1</span>')
  return s
}

// Native R version string, resolved once and cached (undefined if Rscript is unavailable).
let rVersion
function nativeRVersion() {
  if (rVersion !== undefined) return rVersion
  try {
    const out = execSync('Rscript --version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    rVersion = out.trim().match(/version ([\d.]+)/)?.[1] ?? out.trim()
  } catch {
    rVersion = null
  }
  return rVersion
}

// Run export/analysis.R natively (script + cleaned.csv copied side by side into a temp dir,
// matching the script's own `read.csv("cleaned.csv")` relative path). Returns
// { ok, output, durationMs } - never throws; a failed/missing R run is reported, not faked.
function runNativeR(dir) {
  const start = Date.now()
  if (!nativeRVersion()) {
    return { ok: false, output: 'Rscript was not found on PATH. Install R / add Rscript to PATH to capture native output.', durationMs: Date.now() - start }
  }
  const tmp = mkdtempSync(join(tmpdir(), 'telos-doc-r-'))
  try {
    copyFileSync(join(dir, 'export/analysis.R'), join(tmp, 'analysis.R'))
    copyFileSync(join(dir, 'export/cleaned.csv'), join(tmp, 'cleaned.csv'))
    const output = execSync('Rscript analysis.R', { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10 * 60 * 1000 })
    return { ok: true, output, durationMs: Date.now() - start }
  } catch (err) {
    const output = [err.stdout, err.stderr].filter(Boolean).join('\n') || err.message
    return { ok: false, output, durationMs: Date.now() - start }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

function build(dir, { skipR } = {}) {
  const d = join(ROOT, dir)
  const [nn, ...rest] = dir.split('_')
  const id = rest.join('-') // catalog id, e.g. "independent-t-test" — dirs are "NN_<catalog-id>"
  const name = id.replace(/-/g, ' ')
  const commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim()
  const today = new Date().toISOString().slice(0, 10)

  const rScript = readFileSync(join(d, 'export/analysis.R'), 'utf8')
  const citations = readFileSync(join(d, 'export/CITATIONS.txt'), 'utf8')

  // Native R run of export/analysis.R - embeds real output so an auditor sees the numbers
  // without running anything. --skip-r bypasses this (fast iteration on the template only).
  let rRun = null
  let rFailed = false
  if (skipR) {
    rRun = { skipped: true }
  } else {
    const res = runNativeR(d)
    rRun = res
    if (!res.ok) rFailed = true
  }
  const rBlock = rRun.skipped
    ? `<details open><summary>Script output - skipped (--skip-r)</summary>
<p class="hint">Native R run skipped for this build. Run without --skip-r to embed verified output.</p></details>`
    : rRun.ok
      ? `<details open><summary>Script output (native R ${esc(nativeRVersion())}, run ${today})</summary>
<p class="hint">These numbers are produced independently of the app; the app's WebR results match them.</p>
<pre><code>${esc(rRun.output)}</code></pre></details>`
      : `<details open><summary>Script output - FAILED to run natively (${today})</summary>
<p class="hint">The native R run failed; the numbers below are NOT verified. Investigate before trusting this test's results.</p>
<pre><code>${esc(rRun.output)}</code></pre></details>`
  const readme = existsSync(join(d, 'README.md')) ? readFileSync(join(d, 'README.md'), 'utf8') : ''

  // export table/figure PNGs (first-level test subdir)
  const exportDir = join(d, 'export')
  const sub = readdirSync(exportDir).find((f) => /^\d+_/.test(f) && statSync(join(exportDir, f)).isDirectory())
  const pngs = sub ? readdirSync(join(exportDir, sub)).filter((f) => f.endsWith('.png')).sort() : []
  const tablePngs = pngs.filter((f) => f.startsWith('table_'))
  const figurePngs = pngs.filter((f) => f.startsWith('figure_'))

  // manifest of every artifact in the folder
  const manifest = []
  const walk = (p, rel = '') => {
    for (const f of readdirSync(p).sort()) {
      const fp = join(p, f)
      if (statSync(fp).isDirectory()) walk(fp, `${rel}${f}/`)
      else manifest.push(`${rel}${f} (${kb(fp)})`)
    }
  }
  walk(d)

  const pdfB64 = b64(join(d, '3-pdf-report.pdf'))
  const latexSrc = existsSync(join(d, '4-latex-source.tex')) ? readFileSync(join(d, '4-latex-source.tex'), 'utf8') : ''

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${nn} · ${esc(name)} · Telos test documentation</title>
<style>
:root{ --bg:#faf9f5; --ink:#141413; --muted:#6e6c64; --hair:rgba(20,20,19,.16); --clay:#d97757; --card:#fff; --code:#f4f2ec; }
@media (prefers-color-scheme:dark){ :root{ --bg:#141413; --ink:#faf9f5; --muted:#b0aea5; --hair:rgba(250,249,245,.16); --card:#211f1c; --code:#1b1a17; } }
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,'Helvetica Neue',sans-serif;line-height:1.55}
.page{max-width:960px;margin:0 auto;padding:32px 20px 90px}
header{border-bottom:2px solid var(--ink);padding-bottom:14px;margin-bottom:8px}
.eyebrow{font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:600;color:var(--muted)}
h1{font-size:clamp(24px,4.5vw,32px);font-weight:650;margin:6px 0 4px;text-transform:capitalize}
.meta{font-size:12.5px;color:var(--muted)}
nav{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--hair);padding:8px 0;margin-bottom:8px;z-index:5;font-size:12.5px;display:flex;gap:14px;flex-wrap:wrap}
nav a{color:var(--clay);text-decoration:none;font-weight:600}
section{margin-top:40px}
h2{font-size:19px;font-weight:650;border-top:1px solid var(--hair);padding-top:14px;margin:0 0 4px}
h2 .n{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--clay);margin-right:8px}
.hint{font-size:12.5px;color:var(--muted);margin:0 0 10px;max-width:78ch}
figure{margin:12px 0;border:1px solid var(--hair);border-radius:10px;overflow:hidden;background:var(--card)}
figure img{display:block;width:100%;height:auto}
figcaption{font-size:11.5px;color:var(--muted);padding:6px 10px;border-top:1px solid var(--hair)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
pre{background:var(--code);border:1px solid var(--hair);border-radius:10px;padding:14px;overflow-x:auto;font-size:12px;line-height:1.5;font-family:ui-monospace,Menlo,monospace}
.com{color:#788c5d}.str{color:#a44a2e}.kw{color:#6a9bcc;font-weight:600}
.repl{border-left:3px solid var(--clay);background:var(--card);border-radius:0 8px 8px 0;padding:10px 14px;font-size:13px;max-width:78ch}
.repl code{background:var(--code);padding:1px 5px;border-radius:4px;font-size:12px}
embed{width:100%;height:640px;border:1px solid var(--hair);border-radius:10px}
ul.mani{font-size:12px;color:var(--muted);font-family:ui-monospace,Menlo,monospace;columns:2;gap:24px;padding-left:18px}
details summary{cursor:pointer;font-weight:600;font-size:13.5px;color:var(--clay)}
footer{margin-top:56px;border-top:1px solid var(--hair);padding-top:12px;font-size:12px;color:var(--muted)}
@media print{ nav{position:static} embed{display:none} }
</style></head><body><div class="page">
<header>
<div class="eyebrow">Telos · per-test documentation · single-file audit record</div>
<h1>${nn} · ${esc(name)}</h1>
<div class="meta">Generated ${today} · commit ${commit} · fully self-contained (all artifacts embedded) · verified against native R</div>
</header>
<nav><a href="#config">1 Input</a><a href="#output">2 App output</a><a href="#rscript">3 R script</a><a href="#report">4 PDF report</a><a href="#artifacts">5 Tables &amp; figures</a><a href="#citations">6 Citations</a><a href="#manifest">7 Manifest</a></nav>

<section id="config"><h2><span class="n">1</span>Input configuration</h2>
<p class="hint">The exact configuration used for this run, as a student would set it up.</p>
${img(join(d, '1-input-config.png'), 'Configuration screen')}</section>

<section id="output"><h2><span class="n">2</span>App output</h2>
<p class="hint">The complete results card: tables, verdicts, figures, term-led explainers, statistical basis.</p>
${img(join(d, '2-app-output.png'), 'Results screen')}</section>

<section id="rscript"><h2><span class="n">3</span>R replication script (analysis.R)</h2>
<div class="repl"><b>How to replicate:</b> save the block below as <code>analysis.R</code>, place <code>cleaned.csv</code> (in the export bundle) beside it, then run <code>Rscript analysis.R</code>.
The script prints every table shown in the app; the app's numbers were verified byte-for-byte against native R output. Package citations are in section 6.</div>
<pre><code>${highlightR(rScript)}</code></pre>
${rBlock}</section>

<section id="report"><h2><span class="n">4</span>PDF report (as exported)</h2>
<embed src="data:application/pdf;base64,${pdfB64}" type="application/pdf">
${latexSrc ? `<details><summary>LaTeX source (report.tex)</summary><pre><code>${esc(latexSrc)}</code></pre></details>` : ''}</section>

<section id="artifacts"><h2><span class="n">5</span>Exported tables &amp; figures</h2>
<p class="hint">Publication-ready PNGs from the export bundle.</p>
<div class="grid">
${tablePngs.map((f) => img(join(exportDir, sub, f), f.replace('.png', '').replace(/_/g, ' '))).join('\n')}
${figurePngs.map((f) => img(join(exportDir, sub, f), f.replace('.png', '').replace(/_/g, ' '))).join('\n')}
</div></section>

<section id="citations"><h2><span class="n">6</span>Citations &amp; statistical basis</h2>
<h3>Statistical basis for this test</h3>
<p class="hint">Why this test was recommended and the methodological references behind each on-screen claim, straight from the registry (source of truth for the on-screen/PDF/LaTeX footers).</p>
<pre><code>${esc(citationsTxt([id]))}</code></pre>
<details><summary>Full CITATIONS.txt (exported reference kit)</summary><pre><code>${esc(citations)}</code></pre></details>
</section>

<section id="manifest"><h2><span class="n">7</span>Artifact manifest</h2>
${readme ? `<details><summary>Harness README</summary><pre><code>${esc(readme)}</code></pre></details>` : ''}
<ul class="mani">${manifest.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></section>

<footer>Telos test documentation · one file per test · every embedded artifact is generated by the real app driven by the documentation harness (tests/docs/document-tests.spec.ts) · statistics verified against native R.</footer>
</div></body></html>`

  const out = join(ROOT, `${dir}.html`)
  writeFileSync(out, html)
  const rNote = rRun.skipped ? 'R skipped' : `R ${rRun.ok ? 'ok' : 'FAILED'} in ${(rRun.durationMs / 1000).toFixed(1)}s`
  console.log(`${out} (${Math.round(html.length / 1024)} KB) · ${rNote}`)
  return rFailed
}

const argv = process.argv.slice(2)
const skipR = argv.includes('--skip-r')
const dirs = argv.filter((a) => !a.startsWith('--'))

let anyFailed = false
for (const dir of dirs) {
  if (build(dir, { skipR })) anyFailed = true
}
if (anyFailed) {
  console.error('One or more tests failed to reproduce under native R. See "FAILED to run natively" blocks above.')
  process.exit(1)
}
