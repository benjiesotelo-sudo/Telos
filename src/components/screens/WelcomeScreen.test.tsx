import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { WelcomeScreen } from './WelcomeScreen'
import { CREDIT_SUFFIX } from '../../content/copy'

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
})
