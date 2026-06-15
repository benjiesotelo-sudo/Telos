import { readFileSync } from 'node:fs'

export const readSpec = (file: 'telos_ui_spec.html' | 'telos_test_inputs.html' | 'telos_test_outputs.html') =>
  readFileSync(file, 'utf8')

export const decode = (s: string) => s
  .replace(/&mdash;/g, '—').replace(/&minus;/g, '−').replace(/&middot;/g, '·')
  .replace(/&rarr;/g, '→').replace(/&alpha;/g, 'α').replace(/&ldquo;/g, '“').replace(/&rdquo;/g, '”')
  .replace(/&hellip;/g, '…').replace(/&times;/g, '×').replace(/&ndash;/g, '–').replace(/&deg;/g, '°')
  .replace(/&mu;/g, 'μ').replace(/&#8320;/g, '₀').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  // ANOVA-family cards (decode list grows per slice; &amp; stays last)
  .replace(/&eta;/g, 'η').replace(/&omega;/g, 'ω').replace(/&epsilon;/g, 'ε').replace(/&chi;/g, 'χ')
  .replace(/&sup2;/g, '²').replace(/&eacute;/g, 'é').replace(/&plusmn;/g, '±')
  // Association-family cards
  .replace(/&rho;/g, 'ρ').replace(/&tau;/g, 'τ').replace(/&ge;/g, '≥').replace(/&lt;/g, '<')
  // Regression-family cards
  .replace(/&beta;/g, 'β')
  // Econometrics time-series cards (ARIMA σ²; τ already covered above)
  .replace(/&sigma;/g, 'σ')
  .replace(/&amp;/g, '&')

export const strip = (s: string) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
