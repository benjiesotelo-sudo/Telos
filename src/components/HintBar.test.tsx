import { describe, it, expect, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { HintBar, dismissHint } from './HintBar'

const KEY = 'telos-hint-rail'
const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  globalThis.sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0,
  } as Storage
})

describe('HintBar (spec R2)', () => {
  it('renders the tip with a dismiss button on first run', () => {
    const html = renderToStaticMarkup(<HintBar text="Tip: hello" storageKey={KEY} />)
    expect(html).toContain('hintbar')
    expect(html).toContain('Tip: hello')
    expect(html).toContain('aria-label="Dismiss tip"')
  })
  it('renders nothing once dismissed', () => {
    dismissHint(KEY)
    expect(renderToStaticMarkup(<HintBar text="Tip: hello" storageKey={KEY} />)).toBe('')
  })
})
