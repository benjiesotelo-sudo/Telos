import { readFileSync } from 'node:fs'

export const readSpec = (file: 'telos_ui_spec.html' | 'telos_test_inputs.html' | 'telos_test_outputs.html') =>
  readFileSync(file, 'utf8')

export const decode = (s: string) => s
  .replace(/&mdash;/g, '—').replace(/&minus;/g, '−').replace(/&middot;/g, '·')
  .replace(/&rarr;/g, '→').replace(/&alpha;/g, 'α').replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
  .replace(/&hellip;/g, '…').replace(/&times;/g, '×').replace(/&ndash;/g, '–').replace(/&deg;/g, '°')
  .replace(/&amp;/g, '&')

export const strip = (s: string) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
