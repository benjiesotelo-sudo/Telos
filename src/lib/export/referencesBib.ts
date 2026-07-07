// references.bib: BibTeX for the export kit's tiers 1+2 (the app citation + the selected tests'
// deduped reference list) — tier 4 (R packages) stays plain text in CITATIONS.txt, no bib entries.
// Mechanical, best-effort transcription from each Ref's structured {authors,year,title,source,doi?}
// fields — uniformly @misc (no attempt to distinguish @article/@book semantics; none of our source
// text contains a literal brace or '@', so no escaping is needed).
import { version } from '../../../package.json'
import { CITATIONS, type Ref } from '../registry/citations'
import { APP_YEAR, ZENODO_DOI_PLACEHOLDER } from './citeApp'

function firstAuthorWord(authors: string): string {
  return authors.split(',')[0].trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') || 'ref'
}

function citeKey(authors: string, year: string, used: Set<string>): string {
  const base = `${firstAuthorWord(authors)}${year}`
  let key = base
  let n = 0
  while (used.has(key)) { n++; key = `${base}${String.fromCharCode(96 + n)}` } // base, basea, baseb, ...
  used.add(key)
  return key
}

function bibEntry(key: string, fields: Record<string, string | undefined>): string {
  const body = Object.entries(fields)
    .filter((kv): kv is [string, string] => Boolean(kv[1]))
    .map(([k, v]) => `  ${k} = {${v}}`)
    .join(',\n')
  return `@misc{${key},\n${body}\n}`
}

// Every whyThisTest + statisticalBasis ref for the selection, de-duplicated by exact text (the same
// Ref constant, reused across tests, collapses to one entry) — mirrors citationsText's section-2 dedup.
function collectRefs(selection: string[]): Ref[] {
  const byText = new Map<string, Ref>()
  for (const id of selection) {
    const c = CITATIONS[id]
    if (!c) continue
    for (const ref of [...c.whyThisTest.refs, ...c.statisticalBasis.map((b) => b.ref)]) {
      if (!byText.has(ref.text)) byText.set(ref.text, ref)
    }
  }
  return [...byText.values()]
}

export function referencesBibText(selection: string[]): string {
  const used = new Set<string>()
  const entries: string[] = []

  entries.push(bibEntry(citeKey('Sotelo', String(APP_YEAR), used), {
    author: 'Sotelo, B.',
    title: `Telos (v${version}) [Computer software]`,
    year: String(APP_YEAR),
    doi: ZENODO_DOI_PLACEHOLDER,
  }))

  for (const ref of collectRefs(selection)) {
    entries.push(bibEntry(citeKey(ref.authors, ref.year, used), {
      author: ref.authors,
      title: ref.title || undefined,
      year: ref.year,
      note: ref.source || undefined,
      doi: ref.doi,
      url: ref.doi ? undefined : ref.url, // avoid a redundant doi+url pair when the url IS the doi
    }))
  }

  return entries.join('\n\n') + '\n'
}
