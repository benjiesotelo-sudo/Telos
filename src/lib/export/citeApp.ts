// Section 1 of the exported CITATIONS.txt reference kit ("CITE THIS APP"). The version is read
// from package.json so it can never drift from what's actually shipped. The DOI is the Zenodo
// CONCEPT DOI (cite-all-versions), which permanently resolves to the latest archived release, so
// it stays correct across version bumps without editing this file.
import { version } from '../../../package.json'

export const APP_YEAR = 2026
export const ZENODO_DOI = '10.5281/zenodo.21281648'
export const APP_RETRIEVAL_URL = 'https://github.com/benjiesotelo-sudo/Telos'

export const CITE_APP_TEXT =
  `Sotelo, B. (${APP_YEAR}). Telos (v${version}) [Computer software]. https://doi.org/${ZENODO_DOI}\n` +
  `  Source code: ${APP_RETRIEVAL_URL}`
