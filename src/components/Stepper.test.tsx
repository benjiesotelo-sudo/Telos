import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StepperUI } from './Stepper'
import type { RailModel } from '../state/stages'

const model: RailModel = {
  fraction: 0.6, frac: '5 / 7',
  stages: [
    { id: 'upload', label: 'Upload', state: 'done', enabled: true, firstStep: 'upload', sub: [], sublabel: null },
    { id: 'data', label: 'Data', state: 'done', enabled: true, firstStep: 'guide', sub: [], sublabel: null },
    { id: 'pick', label: 'Pick tests', state: 'done', enabled: true, firstStep: 'pick-tests', sub: [], sublabel: null },
    { id: 'configure', label: 'Configure', state: 'current', enabled: true, firstStep: 'test:independent-t-test',
      sub: [
        { step: 'test:independent-t-test', label: 'Independent t', state: 'done', enabled: true },
        { step: 'test:one-way-anova', label: 'One-way ANOVA', state: 'current', enabled: true },
      ], sublabel: 'One-way ANOVA · 2 of 2' },
    { id: 'results', label: 'Results', state: 'todo', enabled: false, firstStep: null, sub: [], sublabel: null },
  ],
}
const html = () => renderToStaticMarkup(<StepperUI model={model} onGo={() => {}} />)

describe('StepperUI (stage rail)', () => {
  it('is the Progress nav with five stage buttons', () => {
    const h = html()
    expect(h).toContain('aria-label="Progress"')
    expect(h).toContain('aria-label="Configure"')
    for (const l of ['Upload', 'Data', 'Pick tests', 'Configure', 'Results']) expect(h).toContain(l)
  })
  it('marks done/current stages and disables unreachable ones', () => {
    const h = html()
    expect(h).toContain('aria-current="step"')
    // "stage done" now lands on the outer <span>, not a <button> - the stage itself is no longer clickable markup.
    expect(h.match(/class="stage done"/g)?.length).toBe(3)
    expect(h).toContain('disabled')
  })
  it('renders sub-dots with test-name labels and the counter', () => {
    const h = html()
    expect(h).toContain('aria-label="Independent t"')
    expect(h).toContain('aria-label="One-way ANOVA"')
    expect(h).toContain('One-way ANOVA · 2 of 2')
  })
  it('sub-dots render as real, focusable buttons (not nested inside the stage button)', () => {
    const h = html()
    expect(h).toMatch(/<button type="button" class="subdot done"[^>]*>/)
    expect(h).toMatch(/<button type="button" class="subdot current"[^>]*>/)
  })
  it('the fill width follows the fraction and the compact fraction renders', () => {
    const h = html()
    expect(h).toContain('width:60%')
    expect(h).toContain('5 / 7')
  })
})
