// Section 1 of the exported CITATIONS.txt reference kit ("CITE THIS APP"). The version is read
// from package.json so it can never drift from what's actually shipped. Zenodo only assigns a DOI
// once a release is minted there, so this ships with a clearly-marked placeholder the owner fills
// in after minting; the retrieval-URL line below is the citable fallback until then.
import { version } from '../../../package.json'

export const APP_YEAR = 2026
// <-- fill in with the real suffix once the Zenodo DOI is minted for this release
export const ZENODO_DOI_PLACEHOLDER = '10.5281/zenodo.PLACEHOLDER'
// <-- fill in with the app's permanent hosted URL (repo or deployment) once one exists
export const APP_RETRIEVAL_URL_PLACEHOLDER = 'https://github.com/PLACEHOLDER/telos'

export const CITE_APP_TEXT =
  `Sotelo, B. (${APP_YEAR}). Telos (v${version}) [Computer software]. https://doi.org/${ZENODO_DOI_PLACEHOLDER}\n` +
  `  Retrieval-URL fallback (use until the DOI above resolves): ${APP_RETRIEVAL_URL_PLACEHOLDER}`
