import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { OptionRows } from './OptionRows'
import { optionGroup } from '../lib/registry/optionGroups'

describe('optionGroup', () => {
  it('maps known ids, display kind, and the fallback', () => {
    expect(optionGroup({ id: 'tails', kind: 'select' })).toBe('Hypothesis')
    expect(optionGroup({ id: 'equal-variance', kind: 'toggle' })).toBe('Variances')
    expect(optionGroup({ id: 'alpha', kind: 'display' })).toBe('Display')
    expect(optionGroup({ id: 'anything-else', kind: 'number' })).toBe('Settings')
  })
})

describe('OptionRows', () => {
  it('buckets children under uppercase group labels, preserving group order of first appearance', () => {
    const h = renderToStaticMarkup(<OptionRows children={[
      { group: 'Hypothesis', node: <span key="a">two-tailed</span> },
      { group: 'Display', node: <span key="b">alpha</span> },
      { group: 'Hypothesis', node: <span key="c">one-tailed</span> },
    ]} />)
    expect(h.indexOf('Hypothesis')).toBeLessThan(h.indexOf('Display'))
    expect(h.match(/opt-label/g)).toHaveLength(2)
    expect(h.indexOf('two-tailed')).toBeLessThan(h.indexOf('one-tailed'))
  })
})
