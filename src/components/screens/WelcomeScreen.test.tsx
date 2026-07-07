import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { WelcomeScreen } from './WelcomeScreen'
import { CREDIT_SUFFIX, WELCOME_COPY } from '../../content/copy'

const h = () => renderToStaticMarkup(<WelcomeScreen />)

describe('WelcomeScreen (redesign)', () => {
  it('wordmark carries the clay full stop', () => {
    expect(h()).toMatch(/Telos<span class="dot"[^>]*>\.<\/span>/)
  })
  it('renders the settling-curve svg gesture', () => {
    expect(h()).toContain('<svg')
    expect(h()).toContain('aria-hidden="true"')
  })
  it('shows the approved copy verbatim across paragraph, subline and credit', () => {
    const html = h().replace(/<[^>]+>/g, '')
    // every sentence of WELCOME_COPY appears (split across the layout, nothing dropped or rewritten)
    for (const part of ['Telos runs your statistics', 'Your data never leaves your browser', 'Built by Benjamin Sotelo'])
      expect(html).toContain(part)
    expect(html).toContain(CREDIT_SUFFIX)
  })
  it('has exactly one CTA: Get started', () => {
    expect(h().match(/class="btn(?:\s|")/g)).toHaveLength(1)
    expect(h()).toContain('Get started')
    expect(h()).not.toContain('How it works')
  })
  it('carries the entrance-stagger classes (motion register R3a)', () => {
    const html = h()
    for (const c of ['enter-1', 'enter-2', 'enter-3', 'enter-4']) expect(html).toContain(c)
  })
  it('splits the body into two scannable paragraphs (F1) without losing or rewording WELCOME_COPY', () => {
    const html = h()
    // structural break landed: the body renders as its own group with >1 paragraph, not one wall <p>
    expect(html).toContain('class="welcome-copy')
    const wrapper = html.match(/<div class="welcome-copy[^"]*"[^>]*>(.*?)<\/div>/s)![1]
    const paras = [...wrapper.matchAll(/<p[^>]*>(.*?)<\/p>/gs)].map((m) => m[1])
    expect(paras.length).toBeGreaterThan(1)
    // every word of the pre-privacy body survives the split, in order, verbatim
    const privacy = 'Your data never leaves your browser.'
    const body = WELCOME_COPY.split(privacy)[0].trim()
    const reassembled = paras.join(' ').replace(/\s+/g, ' ').trim()
    expect(reassembled).toBe(body)
  })
})
