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

  // U8-T4 post-review MUSTS: regression coverage for the skip-a-line and no-orphan-heading behavior the
  // component's own doc comment describes (values can be populated yet still miss the specific key(s)
  // one explainer needs - e.g. CB-SEM's fit indices when the model is saturated, or
  // multiple-linear-regression's beta when standardize is off).
  it('skips one explainer line (but keeps the others) when its interpret() would render "undefined" for a missing value', () => {
    const mixed: Explainer[] = [
      { key: 'r', term: "Pearson's r", meaning: 'meaning r', interpret: (v) => `Here, r = ${v.r}.` },
      { key: 'ci', term: 'CI', meaning: 'meaning ci', interpret: (v) => `Here, the CI is ${v.ci}.` },
    ]
    const html = renderToStaticMarkup(<TermExplainers items={mixed} values={{ r: 0.42 }} />)
    expect(html).toContain('r = 0.42')
    expect(html).not.toContain('meaning ci')
    expect(html).not.toContain('undefined')
  })

  it('skips a line whose interpret() would render "NaN" for an unparseable value', () => {
    const items: Explainer[] = [
      { key: 'z', term: 'z', meaning: 'meaning z', interpret: (v) => `Here, z = ${Number(v.z)}.` },
    ]
    const html = renderToStaticMarkup(<TermExplainers items={items} values={{}} />)
    expect(html).toBe('')
  })

  it('renders no orphan "Understanding the numbers" heading when every item is skipped', () => {
    const items: Explainer[] = [
      { key: 'r', term: "Pearson's r", meaning: 'meaning r', interpret: (v) => `Here, r = ${v.r}.` },
    ]
    const html = renderToStaticMarkup(<TermExplainers items={items} values={{}} />)
    expect(html).toBe('')
    expect(html).not.toContain('Understanding the numbers')
  })

  it('renders the heading once when at least one item survives, even if others are skipped', () => {
    const items: Explainer[] = [
      { key: 'r', term: "Pearson's r", meaning: 'meaning r', interpret: (v) => `Here, r = ${v.r}.` },
      { key: 'ci', term: 'CI', meaning: 'meaning ci', interpret: (v) => `Here, the CI is ${v.ci}.` },
    ]
    const html = renderToStaticMarkup(<TermExplainers items={items} values={{ r: 0.42 }} />)
    expect(html).toContain('Understanding the numbers')
    expect((html.match(/Understanding the numbers/g) ?? []).length).toBe(1)
  })
})
