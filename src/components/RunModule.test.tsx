import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RunModule } from './RunModule'

describe('RunModule', () => {
  it('renders nothing when idle', () => {
    expect(renderToStaticMarkup(<RunModule phase={null} progress={null} testsDone={0} testsTotal={2} />)).toBe('')
  })
  it('engine phase: title, indeterminate fill, narrated list with engine current', () => {
    const h = renderToStaticMarkup(<RunModule phase="Loading R engine…" progress={null} testsDone={0} testsTotal={2} />)
    expect(h).toContain('Loading R engine')
    expect(h).toContain('run-fill indeterminate')
    expect(h).toContain('Reading your data')
    expect(h).toMatch(/now[^>]*>[^<]*Loading the R engine/)
    expect(h).toContain('Running 2 tests')
  })
  it('test phase with estimate: percentage fill and tests phase current', () => {
    const h = renderToStaticMarkup(<RunModule phase="Running PLS-SEM…" progress={{ message: 'bootstrap', elapsedMs: 30000, estMs: 60000 }} testsDone={1} testsTotal={2} />)
    expect(h).toContain('width:50%')
    expect(h).toContain('50%')
    expect(h).toMatch(/now[^>]*>[^<]*Running 2 tests/)
    expect(h).toMatch(/ok[^>]*>[^<]*Loading the R engine/)
  })
  it('the phase title carries the live-region role, and the track carries progressbar semantics', () => {
    const idle = renderToStaticMarkup(<RunModule phase="Loading R engine…" progress={null} testsDone={0} testsTotal={2} />)
    expect(idle).toContain('role="status" aria-live="polite"')
    expect(idle).toContain('role="progressbar"')
    expect(idle).toContain('aria-valuemin="0"')
    expect(idle).toContain('aria-valuemax="100"')
    expect(idle).not.toContain('aria-valuenow')
    const withPct = renderToStaticMarkup(<RunModule phase="Running PLS-SEM…" progress={{ message: 'bootstrap', elapsedMs: 30000, estMs: 60000 }} testsDone={1} testsTotal={2} />)
    expect(withPct).toContain('aria-valuenow="50"')
  })
})
