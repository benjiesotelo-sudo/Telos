import { describe, it, expect, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { HintBar } from './HintBar'
import { dismissHint, hintSeen } from './hintStorage'

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
  it('renders the tip with a dismiss button', () => {
    const html = renderToStaticMarkup(<HintBar text="Tip: hello" onDismiss={() => {}} />)
    expect(html).toContain('hintbar')
    expect(html).toContain('Tip: hello')
    expect(html).toContain('aria-label="Dismiss tip"')
  })
})

describe('hintStorage', () => {
  it('is false initially, true after dismissHint', () => {
    expect(hintSeen(KEY)).toBe(false)
    dismissHint(KEY)
    expect(hintSeen(KEY)).toBe(true)
  })
})
