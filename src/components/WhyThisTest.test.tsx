import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { WhyThisTest } from './WhyThisTest'

describe('WhyThisTest (A4 config-screen line)', () => {
  it('renders the text in a quiet hint line', () => {
    const html = renderToStaticMarkup(<WhyThisTest text="do two groups' means differ?" />)
    expect(html).toMatch(/do two groups.*means differ/)
    expect(html).toMatch(/class="hint"/)
  })
  it('renders nothing for empty text', () => {
    expect(renderToStaticMarkup(<WhyThisTest text="" />)).toBe('')
  })
})
