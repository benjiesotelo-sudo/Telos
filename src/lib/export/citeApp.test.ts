import { describe, it, expect } from 'vitest'
import { version } from '../../../package.json'
import { CITE_APP_TEXT, ZENODO_DOI, APP_RETRIEVAL_URL } from './citeApp'

describe('CITE_APP_TEXT (kit Section 1)', () => {
  it('is an APA-style software citation naming Sotelo, B. and the current package.json version', () => {
    expect(CITE_APP_TEXT).toContain('Sotelo, B.')
    expect(CITE_APP_TEXT).toContain(`Telos (v${version})`)
    expect(CITE_APP_TEXT).toContain('[Computer software]')
  })
  it('carries the real Zenodo concept DOI (minted 2026-07-09 for the v1.0.0 release), no placeholders', () => {
    expect(ZENODO_DOI).toMatch(/^10\.5281\/zenodo\.\d+$/)
    expect(CITE_APP_TEXT).toContain(`https://doi.org/${ZENODO_DOI}`)
    expect(CITE_APP_TEXT).not.toContain('PLACEHOLDER')
  })
  it('includes the public source repository URL', () => {
    expect(APP_RETRIEVAL_URL).toBe('https://github.com/benjiesotelo-sudo/Telos')
    expect(CITE_APP_TEXT).toContain(APP_RETRIEVAL_URL)
  })
})
