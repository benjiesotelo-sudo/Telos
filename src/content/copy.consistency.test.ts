import { describe, it, expect } from 'vitest'
import { readSpec, strip } from '../lib/registry/specHtml'
import { WELCOME_COPY, TERMS_COPY, SIZE_WARN } from './copy'

const html = readSpec('telos_ui_spec.html')
const block = (from: string, to: string) => html.slice(html.indexOf(from), html.indexOf(to))
const explainP = (s: string) => strip(s.match(/<div class="explain"[^>]*>.*?<p>(.*?)<\/p>/s)![1])

describe('app copy stays faithful to the ui-spec DRAFT blocks', () => {
  it('welcome copy equals the spec paragraph (the spec wraps it in curly quotes)', () => {
    expect(explainP(block('1 · Welcome / about', 'Click "Get started"'))).toBe(`“${WELCOME_COPY}”`)
  })
  it('terms copy segments reassemble the spec paragraph exactly', () => {
    const joined = TERMS_COPY.map((s) => s.b ?? s.t).join('').replace(/\s+/g, ' ').trim()
    expect(explainP(block('3 · Terms guide', 'Click "Continue"'))).toBe(`“${joined}”`)
  })
  it('upload rules + size guidance appear in the spec upload block', () => {
    const upload = strip(block('2 · Upload data', 'File parsed'))
    expect(upload).toContain('(.csv · .xlsx · .xls)')
    expect(upload).toContain('header row assumed to be row 1')
    expect(upload).toContain(`warn above ${SIZE_WARN.mb} MB or ${SIZE_WARN.rows.toLocaleString('en-US')} rows`)
  })
})
