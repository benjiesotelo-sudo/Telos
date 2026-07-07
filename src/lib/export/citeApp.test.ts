import { describe, it, expect } from 'vitest'
import { version } from '../../../package.json'
import { CITE_APP_TEXT, ZENODO_DOI_PLACEHOLDER } from './citeApp'

describe('CITE_APP_TEXT (kit Section 1)', () => {
  it('is an APA-style software citation naming Sotelo, B. and the current package.json version', () => {
    expect(CITE_APP_TEXT).toContain('Sotelo, B.')
    expect(CITE_APP_TEXT).toContain(`Telos (v${version})`)
    expect(CITE_APP_TEXT).toContain('[Computer software]')
  })
  it('carries a clearly-marked DOI placeholder (owner fills in after minting the Zenodo release)', () => {
    expect(ZENODO_DOI_PLACEHOLDER).toContain('PLACEHOLDER')
    expect(CITE_APP_TEXT).toContain(ZENODO_DOI_PLACEHOLDER)
  })
  it('includes a retrieval-URL fallback line for citing the app before the DOI resolves', () => {
    expect(CITE_APP_TEXT.toLowerCase()).toContain('retrieval')
  })
})
