import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { GuideScreen } from './GuideScreen'
import { TERMS_COPY } from '../../content/copy'

const h = () => renderToStaticMarkup(<GuideScreen />)

describe('GuideScreen (F1 readability sweep)', () => {
  it('breaks the terms wall into a labelled definition list', () => {
    const html = h()
    // structural break landed: intro paragraph + a real <dl> of label/definition rows, not one <p>
    expect(html).toContain('class="terms-list')
    const rows = [...html.matchAll(/<div class="terms-list-row"[^>]*>/g)]
    expect(rows.length).toBe(4) // Nominal, Ordinal, Interval, Ratio
    expect(html).toMatch(/<dt><b>Nominal<\/b><\/dt>/)
    expect(html).toMatch(/<dt><b>Ratio<\/b><\/dt>/)
  })
  it('reassembles to TERMS_COPY verbatim - no word dropped or reworded', () => {
    const html = h()
    const flat = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const wanted = TERMS_COPY.map((s) => s.b ?? s.t).join('').replace(/\s+/g, ' ').trim()
    expect(flat).toContain(wanted)
  })
  it('still has the Continue button wired to the guide-visit + navigation', () => {
    expect(h()).toContain('Continue')
  })
})
