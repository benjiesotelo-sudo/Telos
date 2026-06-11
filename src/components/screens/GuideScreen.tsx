import { useSession } from '../../state/session'
import { TERMS_COPY } from '../../content/copy'

export function GuideScreen() {
  const { visitGuide, goTo } = useSession()
  return (
    <section>
      <div className="eyebrow">Step 3</div>
      <h1 className="title">Terms guide</h1>
      <div className="card"><p style={{ margin: 0, lineHeight: 1.8 }}>
        {TERMS_COPY.map((seg, i) => (seg.b ? <b key={i}>{seg.b}</b> : <span key={i}>{seg.t}</span>))}
      </p></div>
      <div className="btn-row"><button className="btn" onClick={() => { visitGuide(); goTo('configure-data') }}>Continue</button></div>
    </section>
  )
}
