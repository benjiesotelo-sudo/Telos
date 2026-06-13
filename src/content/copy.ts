export const LINKEDIN_URL = 'https://www.linkedin.com/in/benjaminsotelo1/'
export const FEEDBACK_URL = 'https://docs.google.com/forms/REPLACE_WITH_YOUR_FORM' // standing open item

export const WELCOME_COPY =
  'Telos runs your statistics in the browser — built for thesis students. Upload your data, get guided to the right tests, ' +
  'and read APA-7 results with plain-language explainers. Export your tables and figures as images (PDF and R-script export are coming soon). ' +
  'Your data never leaves your browser. Built by Benjamin Sotelo — linkedin.com/in/benjaminsotelo1.'

// Rendered with <b> on the b-segments, exactly as the spec draws emphasis.
export const TERMS_COPY: { b?: string; t?: string }[] = [
  { b: 'Type vs level:' }, { t: ' the type is how a column is stored (numbers, text, dates); the level is what its values mean for analysis — you set the level. ' },
  { b: 'Nominal' }, { t: ' — named categories with no order (gender, region). ' },
  { b: 'Ordinal' }, { t: ' — ordered categories with uneven steps (a 1–5 satisfaction rating). ' },
  { b: 'Interval' }, { t: ' — equal steps but no true zero (temperature in °C). ' },
  { b: 'Ratio' }, { t: ' — equal steps and a true zero (income, test score). ' },
  { b: 'Missing data:' }, { t: ' empty cells — by default each test simply skips the rows that are incomplete for its own columns (the Configure data step lets you change this).' },
]

export const UPLOAD_ACCEPT = '.csv,.xlsx,.xls'
export const UPLOAD_NOTE = '.csv · .xlsx · .xls — header row assumed to be row 1'
export const SIZE_WARN = { mb: 20, rows: 100_000 } // ui-spec DRAFT: 'warn above 20 MB or 100,000 rows'
export const SIZE_WARN_TEXT = 'Large file — analysis may be slow in the browser.' // wording ours (DRAFT review happens rendered)
