#!/usr/bin/env node
// Build docs/test-documentation/index.html - a single self-contained entry point linking all 48
// per-test audit docs (built by build-test-doc.mjs). Sources number/name/question/scenario from
// the harness-generated docs/test-documentation/README.md (scripts/gen-doc-readmes.mjs), and the
// file size straight off disk. No images - pure links + a small table per family.
// Usage: node docs/build-doc-index.mjs
import { readFileSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = join(import.meta.dirname, 'test-documentation')
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const kb = (p) => `${Math.max(1, Math.round(statSync(p).size / 1024))} KB`

const readme = readFileSync(join(ROOT, 'README.md'), 'utf8')

// Parse `## Family` headers followed by `| # | Test | Question | Scenario |` markdown tables.
const families = []
const lines = readme.split('\n')
let current = null
for (const line of lines) {
  const h2 = line.match(/^## (.+)$/)
  if (h2) { current = { name: h2[1], rows: [] }; families.push(current); continue }
  const row = line.match(/^\| (\d+) \| \[([^\]]+)\]\((\d+_[a-z0-9-]+)\/\) \| ([^|]+) \| ([^|]+) \|$/)
  if (row && current) {
    const [, nn, name, dir, question, scenario] = row
    current.rows.push({ nn, name: name.trim(), dir: dir.trim(), question: question.trim(), scenario: scenario.trim() })
  }
}

const total = families.reduce((n, f) => n + f.rows.length, 0)
const commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim()
const today = new Date().toISOString().slice(0, 10)

const section = (f) => `<section id="${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">
<h2>${esc(f.name)}</h2>
<table>
<thead><tr><th>#</th><th>Test</th><th>Scenario</th><th>Size</th></tr></thead>
<tbody>
${f.rows.map((r) => {
  const htmlFile = `${r.dir}.html`
  const path = join(ROOT, htmlFile)
  const size = existsSync(path) ? kb(path) : '-'
  const link = existsSync(path) ? `<a href="${htmlFile}">${esc(r.name)}</a>` : esc(r.name)
  return `<tr><td class="n">${r.nn}</td><td>${link}</td><td class="scenario">${esc(r.scenario)}</td><td class="size">${size}</td></tr>`
}).join('\n')}
</tbody>
</table>
</section>`

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Telos test documentation - index</title>
<style>
:root{ --bg:#faf9f5; --ink:#141413; --muted:#6e6c64; --hair:rgba(20,20,19,.16); --clay:#d97757; --card:#fff; --code:#f4f2ec; }
@media (prefers-color-scheme:dark){ :root{ --bg:#141413; --ink:#faf9f5; --muted:#b0aea5; --hair:rgba(250,249,245,.16); --card:#211f1c; --code:#1b1a17; } }
*{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,'Helvetica Neue',sans-serif;line-height:1.55}
.page{max-width:960px;margin:0 auto;padding:32px 20px 90px}
header{border-bottom:2px solid var(--ink);padding-bottom:14px;margin-bottom:8px}
.eyebrow{font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:600;color:var(--muted)}
h1{font-size:clamp(24px,4.5vw,32px);font-weight:650;margin:6px 0 4px}
.meta{font-size:12.5px;color:var(--muted)}
nav{position:sticky;top:0;background:var(--bg);border-bottom:1px solid var(--hair);padding:8px 0;margin-bottom:8px;z-index:5;font-size:12.5px;display:flex;gap:14px;flex-wrap:wrap}
nav a{color:var(--clay);text-decoration:none;font-weight:600}
section{margin-top:40px}
h2{font-size:19px;font-weight:650;border-top:1px solid var(--hair);padding-top:14px;margin:0 0 12px}
table{width:100%;border-collapse:collapse;font-size:13px}
thead th{text-align:left;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);padding:0 10px 8px;border-bottom:1px solid var(--hair)}
tbody td{padding:9px 10px;border-bottom:1px solid var(--hair);vertical-align:top}
tbody tr:hover{background:var(--code)}
td.n{font-family:ui-monospace,Menlo,monospace;color:var(--clay);white-space:nowrap}
td.size{color:var(--muted);white-space:nowrap;text-align:right;font-family:ui-monospace,Menlo,monospace;font-size:12px}
td.scenario{color:var(--muted)}
a{color:var(--ink);text-decoration:none;font-weight:600}
a:hover{color:var(--clay);text-decoration:underline}
footer{margin-top:56px;border-top:1px solid var(--hair);padding-top:12px;font-size:12px;color:var(--muted)}
</style></head><body><div class="page">
<header>
<div class="eyebrow">Telos · per-test documentation · index</div>
<h1>Telos test documentation</h1>
<div class="meta">Generated ${today} · commit ${commit} · ${total} tests · each row links to a self-contained single-file audit record (config, output, R script, PDF report, exported tables/figures, citations, manifest)</div>
</header>
<nav>${families.map((f) => `<a href="#${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">${esc(f.name)}</a>`).join('')}</nav>
${families.map(section).join('\n')}
<footer>Telos test documentation · one file per test · every embedded artifact is generated by the real app driven by the documentation harness (tests/docs/document-tests.spec.ts) · statistics verified against native R.</footer>
</div></body></html>`

writeFileSync(join(ROOT, 'index.html'), html)
console.log(`${join(ROOT, 'index.html')} (${Math.round(html.length / 1024)} KB) · ${total} tests linked`)
