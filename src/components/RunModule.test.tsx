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
})
