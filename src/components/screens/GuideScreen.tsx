import { useSession } from '../../state/session'
import { TERMS_COPY } from '../../content/copy'

// TERMS_COPY is a flat run of (label, text) segments meant to read as one flowing paragraph
// (spec-pinned, byte-unchanged). For the screen we regroup it into label/definition pairs -
// same words, same order, none dropped or reworded - so it can render as scannable structure
// instead of one long wall (F1). Fixed shape: intro pair, 4 measurement-level pairs, 1 trailing
// "Missing data" pair - matches the TERMS_COPY comment ("rendered with <b> on the b-segments").
function pairs(): { label: string; text: string }[] {
  const out: { label: string; text: string }[] = []
  for (const seg of TERMS_COPY) {
    if (seg.b) out.push({ label: seg.b, text: '' })
    else if (seg.t && out.length) out[out.length - 1].text += seg.t
  }
  return out
}

export function GuideScreen() {
  const { visitGuide, goTo } = useSession()
  const [intro, nominal, ordinal, interval, ratio, missing] = pairs()
  const levels = [nominal, ordinal, interval, ratio]
  return (
    <section>
      <div className="eyebrow">Data · guide</div>
      <h1 className="title">Terms guide</h1>
      <div className="card guide-card">
        <p className="prose guide-intro" style={{ margin: 0 }}><b>{intro.label}</b>{intro.text}</p>
        <dl className="terms-list">
          {levels.map((lvl) => (
            <div className="terms-list-row" key={lvl.label}>
              <dt><b>{lvl.label}</b></dt>
              <dd>{lvl.text}</dd>
            </div>
          ))}
        </dl>
        <p className="hint guide-note" role="note" style={{ marginBottom: 0 }}><b>{missing.label}</b>{missing.text}</p>
      </div>
      <div className="btn-row"><button className="btn" onClick={() => { visitGuide(); goTo('configure-data') }}>Continue</button></div>
    </section>
  )
}
