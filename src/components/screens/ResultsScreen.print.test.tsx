import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ResultsScreen, printReport } from './ResultsScreen'

// jsdom is not installed and the suite runs in the `node` environment, so printReport()
// takes injectable doc/win (defaulting to the real globals) and we drive it with fakes here.
const fakeEnv = () => {
  let cls = new Set<string>()
  const handlers: Record<string, () => void> = {}
  const doc = { body: { classList: {
    add: (c: string) => { cls.add(c) }, remove: (c: string) => { cls.delete(c) },
    contains: (c: string) => cls.has(c),
  } } }
  const win = {
    print: vi.fn(),
    addEventListener: (e: string, h: () => void) => { handlers[e] = h },
    removeEventListener: (e: string) => { delete handlers[e] },
  }
  return { doc, win, handlers, has: (c: string) => cls.has(c) }
}

describe('print export (Task 7)', () => {
  it('the export/download bar and its controls are marked data-noprint', () => {
    const html = renderToStaticMarkup(<ResultsScreen />)
    expect(html).toContain('data-noprint')
  })

  it('printReport adds the printing class, calls window.print, and afterprint removes it', () => {
    const { doc, win, handlers, has } = fakeEnv()
    printReport(doc as unknown as Document, win as unknown as Window)
    expect(has('printing')).toBe(true)
    expect(win.print).toHaveBeenCalledOnce()
    expect(handlers.afterprint).toBeTypeOf('function')
    handlers.afterprint()
    expect(has('printing')).toBe(false)
  })
})
