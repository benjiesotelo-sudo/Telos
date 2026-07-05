import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TestSwitcher } from './TestSwitcher'

const tests = [
  { id: 'independent-t-test', label: 'Independent t', n: 1, state: 'done' as const, enabled: true },
  { id: 'one-way-anova', label: 'One-way ANOVA', n: 2, state: 'current' as const, enabled: true },
  { id: 'kruskal-wallis', label: 'Kruskal-Wallis', n: 3, state: 'todo' as const, enabled: false },
]
const h = () => renderToStaticMarkup(<TestSwitcher tests={tests} onGo={() => {}} />)

describe('TestSwitcher (spec R1)', () => {
  it('renders one button per test in order, numbered, with state classes', () => {
    const html = h()
    expect(html.match(/tswitch-pill/g)!.length).toBeGreaterThanOrEqual(3)
    expect(html.indexOf('Independent t')).toBeLessThan(html.indexOf('One-way ANOVA'))
    expect(html).toContain('tswitch-pill done')
    expect(html).toContain('tswitch-pill current')
    expect(html).toContain('aria-current="true"')
  })
  it('done tests carry the check, disabled tests are real disabled buttons', () => {
    const html = h()
    expect(html).toContain('tick')
    expect(html).toContain('✓')
    expect(html).toContain('disabled')
  })
  it('renders nothing for a single test', () => {
    expect(renderToStaticMarkup(<TestSwitcher tests={tests.slice(0, 1)} onGo={() => {}} />)).toBe('')
  })
})
