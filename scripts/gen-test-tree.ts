/**
 * Generates docs/TEST_CATALOG.md — a mermaid overview + a detailed nested tree of every
 * test: how it is configured (roles + options) and what it outputs (tables, figures, note,
 * APA template, R map). Source of truth = the registries, so the doc cannot drift.
 *
 * Run:  npx tsx scripts/gen-test-tree.ts   (writes docs/TEST_CATALOG.md)
 */
import { writeFileSync } from 'node:fs'
import { CATALOG, SPECS, FAMILIES } from '../src/lib/registry/catalog.ts'
import { figuresOf } from '../src/lib/registry/types.ts'
import type { TestSpec } from '../src/lib/registry/types.ts'

const col = (c: { label: string; sub?: string; suffix?: string }) =>
  `${c.label}${c.sub ? `_${c.sub}` : ''}${c.suffix ? ` ${c.suffix}` : ''}`

function optionStr(o: TestSpec['options'][number]): string {
  const k = o.kind
  if (k === 'display') return `${o.label} — fixed display: \`${o.value}\``
  if (k === 'number') return `${o.label} — number input (default ${o.default ?? o.value})`
  if (k === 'toggle') return `${o.label} — toggle (default ${o.default ? 'on' : 'off'})`
  if (k === 'select') return `${o.label} — select: ${(o.choices ?? []).join(' / ')} (default ${o.default ?? o.value})`
  if (k === 'level-select') return `${o.label} — select a category of the assigned \`${o.fromRole}\` column (default: 2nd level)`
  if (k === 'proportions') return `${o.label} — equal vs. custom per-category proportions (must sum to 1)`
  return `${o.label} — ${k}`
}

const note = (s: TestSpec): string | null =>
  s.assumptionNote ? s.assumptionNote : s.tableNote ? s.tableNote.text : null

function treeFor(id: string): string {
  const s = SPECS[id]
  const c = CATALOG.find((e) => e.id === id)!
  const L: string[] = []
  L.push(`### ${s.name}`)
  L.push(`*${c.family}${c.subfamily ? ` › ${c.subfamily}` : ''}* — ${s.question}`)
  L.push('')
  L.push('- **Configure**')
  L.push('  - Roles (drag columns in):')
  for (const r of s.roles) L.push(`    - **${r.label}** — \`${r.levels}\` · *${r.arity}*${r.hint ? ` — _${r.hint}_` : ''}`)
  if (s.options.length) {
    L.push('  - Options:')
    for (const o of s.options) L.push(`    - ${optionStr(o)}`)
  }
  L.push('- **Outputs**')
  s.tables.forEach((t, i) => {
    const num = s.tables.length > 1 ? ` ${i + 1}` : ''
    if (t.kind === 'coef') {
      // modelsummary coef table: stacked estimate/(SE)/[CI] per term across model column(s) + a GOF footer
      const cols = [...(t.models ?? []), ...(t.extraCols ?? [])].map((c) => c.label).join(' · ')
      const gof = (t.gof ?? []).map((g) => g.label).join(' · ')
      L.push(`  - **Table${num} — ${t.title}** (coefficients · estimate / (SE) / [CI]): ${cols}${gof ? ` — _GOF footer:_ ${gof}` : ''}`)
    } else {
      L.push(`  - **Table${num} — ${t.title}**: ${t.columns.map(col).join(' · ')}`)
    }
  })
  const figs = figuresOf(s)
  const seenCap = new Set<string>()
  for (const f of figs) {
    if (seenCap.has(f.caption)) continue
    seenCap.add(f.caption)
    const same = figs.filter((x) => x.caption === f.caption)
    const panels = same.length > 1 ? ` (${same.length} exported panels: ${same.map((x) => x.file ?? x.type).join(', ')})` : ''
    L.push(`  - *Figure* — ${f.caption}: ${f.type}${panels}`)
  }
  const n = note(s)
  if (n) L.push(`  - *Assumption / note* — ${n}`)
  L.push(`  - *APA template* — "${s.apaTemplate}"`)
  L.push(`  - *R map* — ${s.rMap}`)
  L.push('')
  return L.join('\n')
}

// ── Build the document ──
const liveByFamily = new Map<string, typeof CATALOG>()
for (const fam of FAMILIES) liveByFamily.set(fam, CATALOG.filter((c) => c.family === fam && c.status === 'available' && SPECS[c.id]))
const laterByFamily = new Map<string, typeof CATALOG>()
for (const fam of FAMILIES) laterByFamily.set(fam, CATALOG.filter((c) => c.family === fam && c.status !== 'available'))

const liveCount = CATALOG.filter((c) => c.status === 'available' && SPECS[c.id]).length

const out: string[] = []
out.push('# Telos — Test Catalog & Output Tree')
out.push('')
out.push('> **Auto-generated** from the registries (`src/lib/registry/*.ts`) via `npx tsx scripts/gen-test-tree.ts` — do not hand-edit; regenerate after registry changes.')
out.push('>')
out.push(`> Purpose: a single reviewable breakdown of every test — **how it is configured** (role slots + options) and **what it outputs** (tables, figures, assumption notes, APA write-up, R map) — for completeness review. **${liveCount} of ${CATALOG.length} tests run live**; the rest are drawn in the picker but greyed ("arrives in a later slice").`)
out.push('')
out.push('## Flow')
out.push('')
out.push('```mermaid')
out.push('flowchart LR')
out.push('  U[Upload CSV/Excel] --> G[Terms guide] --> C[Configure data<br/>type + level per column] --> P[Pick a test] --> R[Configure test<br/>drag columns into roles + options] --> X[Results<br/>APA tables · figures · how-to-read] --> E[Export<br/>PNG tables/figures zip]')
out.push('```')
out.push('')
out.push('## Family → test overview (live tests)')
out.push('')
out.push('```mermaid')
out.push('flowchart TD')
out.push('  T([Telos])')
let fi = 0
for (const fam of FAMILIES) {
  const live = liveByFamily.get(fam)!
  if (!live.length) continue
  fi++
  const fid = `F${fi}`
  out.push(`  T --> ${fid}[${fam}]`)
  live.forEach((c, j) => {
    const nid = `${fid}_${j}`
    out.push(`  ${fid} --> ${nid}["${c.name}"]`)
  })
}
out.push('```')
out.push('')
out.push('---')
out.push('')
out.push('## Detailed tree — configuration & outputs per test')
out.push('')
for (const fam of FAMILIES) {
  const live = liveByFamily.get(fam)!
  if (!live.length) continue
  out.push(`## ${fam}`)
  out.push('')
  for (const c of live) out.push(treeFor(c.id))
}
out.push('---')
out.push('')
out.push('## Not yet live (drawn in the picker, greyed)')
out.push('')
for (const fam of FAMILIES) {
  const later = laterByFamily.get(fam)!
  if (!later.length) continue
  out.push(`- **${fam}** — ${later.map((c) => c.name).join(', ')}`)
}
out.push('')

writeFileSync('docs/TEST_CATALOG.md', out.join('\n'))
console.log(`Wrote docs/TEST_CATALOG.md — ${liveCount} live tests detailed`)
