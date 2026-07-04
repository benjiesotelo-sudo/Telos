import { useSession } from '../../state/session'
import { WELCOME_COPY, LINKEDIN_URL, CREDIT_SUFFIX } from '../../content/copy'

const PRIVACY = 'Your data never leaves your browser.'
const BYLINE = 'Built by Benjamin Sotelo'

/** Split the spec-pinned paragraph for layout WITHOUT changing a word of it (spec F1a):
 *  body ¶ = everything before the privacy sentence · subline = the privacy sentence ·
 *  credit = the byline (+ the new CREDIT_SUFFIX) with the LinkedIn link. */
function segments() {
  const [body, tail] = WELCOME_COPY.split(PRIVACY)
  return { body: body.trim(), tail: tail.trim() } // tail = 'Built by Benjamin Sotelo — linkedin…'
}

export function WelcomeScreen() {
  const goTo = useSession((s) => s.goTo)
  const { body } = segments()
  return (
    <section style={{ textAlign: 'center', paddingTop: 40 }}>
      <div className="eyebrow">In-browser statistics for thesis students</div>
      <h1 className="title" style={{ fontSize: 46, margin: '10px 0 0' }}>Telos<span className="dot" style={{ color: 'var(--accent)' }}>.</span></h1>
      <svg viewBox="0 0 420 64" width="100%" height="64" aria-hidden="true" style={{ maxWidth: 420, display: 'block', margin: '14px auto 2px' }}>
        <path d="M8 58 C 90 58, 140 10, 210 10 C 280 10, 330 58, 412 58" fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity=".85" />
        <g fill="var(--accent)">
          <circle cx="60" cy="52" r="2.1" opacity=".45" /><circle cx="105" cy="40" r="2.1" opacity=".55" />
          <circle cx="150" cy="22" r="2.1" opacity=".7" /><circle cx="210" cy="13" r="2.4" opacity=".95" />
          <circle cx="268" cy="21" r="2.1" opacity=".7" /><circle cx="318" cy="41" r="2.1" opacity=".55" />
          <circle cx="362" cy="53" r="2.1" opacity=".45" />
        </g>
      </svg>
      <p className="prose" style={{ maxWidth: 520, margin: '8px auto 4px', textAlign: 'center' }}>{body}</p>
      <p className="hint" style={{ margin: '2px 0 22px' }}>{PRIVACY}</p>
      <button className="btn" onClick={() => goTo('upload')}>Get started</button>
      <br />
      <span className="credit-line">{BYLINE} · {CREDIT_SUFFIX} · <a href={LINKEDIN_URL} target="_blank" rel="noopener">linkedin.com/in/benjaminsotelo1</a></span>
    </section>
  )
}
