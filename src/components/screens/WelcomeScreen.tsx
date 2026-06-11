import { useSession } from '../../state/session'
import { WELCOME_COPY, LINKEDIN_URL } from '../../content/copy'

export function WelcomeScreen() {
  const goTo = useSession((s) => s.goTo)
  const [before, after] = WELCOME_COPY.split('linkedin.com/in/benjaminsotelo1')
  return (
    <section style={{ textAlign: 'center', paddingTop: 48 }}>
      <h1 className="title" style={{ fontSize: 44 }}>Telos</h1>
      <div className="card" style={{ textAlign: 'left', maxWidth: 520, margin: '0 auto' }}>
        <p style={{ margin: 0, lineHeight: 1.8 }}>{before}<a href={LINKEDIN_URL} target="_blank" rel="noopener">linkedin.com/in/benjaminsotelo1</a>{after}</p>
      </div>
      <div style={{ marginTop: 22 }}><button className="btn" onClick={() => goTo('upload')}>Get started</button></div>
    </section>
  )
}
