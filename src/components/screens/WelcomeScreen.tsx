import { useSession } from '../../state/session'
import { WELCOME_COPY, LINKEDIN_URL, CREDIT_SUFFIX } from '../../content/copy'

const PRIVACY = 'Your data never leaves your browser.'
const BYLINE = 'Built by Benjamin Sotelo'

// Splits the body itself into two short paragraphs at its existing sentence boundary (F1
// readability sweep) - no word added, removed, or reordered, just a mid-sentence-space cut.
const EXPORT_SENTENCE = 'Export everything'

/** Split the spec-pinned paragraph for layout WITHOUT changing a word of it (spec F1a):
 *  body ¶ = everything before the privacy sentence · subline = the privacy sentence ·
 *  credit = the byline (+ the new CREDIT_SUFFIX) with the LinkedIn link.
 *  body is then split into intro/capability paragraphs at EXPORT_SENTENCE (F1). */
function segments() {
  const body = WELCOME_COPY.split(PRIVACY)[0].trim()
  const cut = body.indexOf(EXPORT_SENTENCE)
  return { intro: body.slice(0, cut).trim(), capability: body.slice(cut).trim() }
}

export function WelcomeScreen() {
  const goTo = useSession((s) => s.goTo)
  const { intro, capability } = segments()
  return (
    <section style={{ textAlign: 'center', paddingTop: 40 }}>
      <div className="eyebrow enter-1">In-browser statistics for thesis students</div>
      {/* W1 wordmark (brand kit): Crimson Pro at weight 620 with the clay full stop - the wordmark
        * is live text, never an image (docs/brand/README.md). The settling curve below stays by
        * owner ruling B (hero board, 2026-07-11): the mark lives in the favicon/README/docs, the
        * curve remains the app's own interior gesture. */}
      <h1 className="title enter-2" style={{ fontFamily: 'var(--font-prose)', fontWeight: 620, fontSize: 46, margin: '10px 0 0' }}>Telos<span className="dot" style={{ color: 'var(--accent)' }}>.</span></h1>
      <svg className="enter-3" viewBox="0 0 420 64" width="100%" height="64" aria-hidden="true" style={{ maxWidth: 420, display: 'block', margin: '14px auto 2px' }}>
        <path d="M8 58 C 90 58, 140 10, 210 10 C 280 10, 330 58, 412 58" fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity=".85" />
        <g fill="var(--accent)">
          <circle cx="60" cy="52" r="2.1" opacity=".45" /><circle cx="105" cy="40" r="2.1" opacity=".55" />
          <circle cx="150" cy="22" r="2.1" opacity=".7" /><circle cx="210" cy="13" r="2.4" opacity=".95" />
          <circle cx="268" cy="21" r="2.1" opacity=".7" /><circle cx="318" cy="41" r="2.1" opacity=".55" />
          <circle cx="362" cy="53" r="2.1" opacity=".45" />
        </g>
      </svg>
      <div className="welcome-copy enter-4" style={{ maxWidth: 520, margin: '8px auto 4px' }}>
        <p className="prose" style={{ margin: 0, textAlign: 'center' }}>{intro}</p>
        <p className="prose" style={{ margin: '8px 0 0', textAlign: 'center' }}>{capability}</p>
      </div>
      <p className="hint" style={{ margin: '2px 0 22px' }}>{PRIVACY}</p>
      <button className="btn enter-5" onClick={() => goTo('upload')}>Get started</button>
      <br />
      <span className="credit-line enter-5">{BYLINE} · {CREDIT_SUFFIX} · <a href={LINKEDIN_URL} target="_blank" rel="noopener">linkedin.com/in/benjaminsotelo1</a></span>
    </section>
  )
}
