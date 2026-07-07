import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TermExplainers } from './TermExplainers'
import type { Explainer } from '../lib/registry/explainers'

const items: Explainer[] = [
  { key: 'r', term: "Pearson's r", meaning: 'The strength and direction of the linear relationship, from -1 to +1.',
    interpret: (v) => `Here, r = ${v.r}, a ${Number(v.r) >= 0 ? 'positive' : 'negative'} relationship.` },
]

describe('TermExplainers (A5)', () => {
  it('renders bold term, meaning, and the live-value interpretation', () => {
    const html = renderToStaticMarkup(<TermExplainers items={items} values={{ r: 0.42 }} />)
    // React SSR HTML-escapes the literal apostrophe in "Pearson's r" to `&#x27;` (renders correctly in
    // a real browser; this is just the raw markup form) - match that instead of a bare single-char wildcard.
    expect(html).toMatch(/<b>Pearson&#x27;s r\.?<\/b>/)
    expect(html).toContain('The strength and direction')
    expect(html).toContain('r = 0.42')
  })
  it('renders nothing for an empty item list', () => {
    expect(renderToStaticMarkup(<TermExplainers items={[]} values={{}} />)).toBe('')
  })
})
