import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const html = readFileSync('telos_test_inputs.html', 'utf8')
const cbCard = html.slice(
  html.indexOf('<div class="ttl">CB-SEM</div>'),
  html.indexOf("<div class=\"ttl\">Cronbach's alpha</div>"),
)
const plsCard = html.slice(
  html.indexOf('<div class="ttl">PLS-SEM</div>'),
  html.indexOf('FAMILY 7 · ASSUMPTION DIAGNOSTICS'),
)
const legend = html.slice(html.indexOf('<div class="legend">'), html.indexOf('</div>\n\n</div>\n</body>'))
const subNote = html.slice(html.indexOf('<p class="sub-note">'), html.indexOf('</p>', html.indexOf('<p class="sub-note">')))

const amosbar = (card: string) => {
  const at = card.indexOf('<div class="amosbar">')
  return card.slice(at, card.indexOf('</div>', at))
}

describe('SEM-B input cards realize the hybrid decision (form defines constructs, canvas draws paths only)', () => {
  it('CB-SEM card no longer tells the student to drag items onto a construct', () => {
    expect(cbCard).not.toContain('drag items from the palette onto a construct')
    expect(cbCard).not.toContain('drag an item onto a construct to build the measurement model')
    expect(cbCard).not.toContain('drag the items that belong together into each construct')
  })
  it('CB-SEM card defines constructs in a construct-slots form below the canvas', () => {
    expect(cbCard).toContain('cs-slots')
    expect(cbCard).toContain('<span class="zone-tag" style="margin-top:13px;">2 · define the constructs (name each, check its items)</span>')
    expect(cbCard).toContain('draw arrows between constructs to build the structural model')
  })
  it('CB-SEM amosbar drops "+ Construct", defaults to Draw path, and offers zoom/fit/resize', () => {
    const bar = amosbar(cbCard)
    expect(bar).not.toContain('Construct')
    expect(bar).toContain('<span class="amospill on">&rarr; Draw path</span>')
    expect(bar).toContain('Move')
    expect(bar).toContain('Delete')
    expect(bar).toContain('Fit')
    expect(bar).toContain('resize')
  })
  it('PLS-SEM card no longer tells the student to drag items onto a construct', () => {
    expect(plsCard).not.toContain('drag items onto a construct')
    expect(plsCard).not.toContain("drag each construct's items together")
    expect(plsCard).not.toContain('drag items from the palette onto a construct')
  })
  it('PLS-SEM card defines constructs in a construct-slots form and sets reflective/formative per construct in the form', () => {
    expect(plsCard).toContain('cs-slots')
    expect(plsCard).toContain('<span class="zone-tag" style="margin-top:13px;">2 · define the constructs (name each, check its items, set reflective / formative)</span>')
    expect(plsCard).toContain('class="cs-mode"')
  })
  it('PLS-SEM amosbar drops "+ Construct" and defaults to Draw path', () => {
    const bar = amosbar(plsCard)
    expect(bar).not.toContain('Construct')
    expect(bar).toContain('<span class="amospill on">&rarr; Draw path</span>')
  })
  it('inputs legend describes form-defines + paths-only canvas, not drag-items-into-constructs', () => {
    expect(legend).not.toContain('the student drags items into constructs and draws the paths')
    expect(legend).toContain('they define their constructs (name + items) in a form, then draw the structural paths on the canvas')
  })
  it('page sub-note describes the canvas as paths-only (constructs defined in a form)', () => {
    expect(subNote).toContain('use a model-building canvas where the student draws the structural paths between constructs they define in a form')
  })
})
