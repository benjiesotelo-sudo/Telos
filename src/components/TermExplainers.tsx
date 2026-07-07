import type { Explainer, ResultValues } from '../lib/registry/explainers'

/** A5: renders one term-led paragraph per explainer - bold term, one-sentence meaning, then the
 * live-value interpretation for this run - under a card's "Understanding the numbers" heading.
 * U8-T3: a card's `values` can be populated yet still miss the specific key(s) one explainer needs
 * (e.g. CB-SEM's fit indices when the model is saturated) - interpret() would then weave a literal
 * "undefined"/"NaN" into the sentence. Rather than render that, the affected line is skipped outright;
 * the heading itself lives in here too so an all-skipped card renders no orphan heading either. */
export function TermExplainers({ items, values }: { items: Explainer[]; values: ResultValues }) {
  const rendered = items
    .map((ex) => ({ ex, text: ex.interpret(values) }))
    .filter(({ text }) => !/undefined|NaN/.test(text))
  if (rendered.length === 0) return null
  return (
    <>
      <h3 style={{ fontSize: 15, margin: '16px 0 4px' }}>Understanding the numbers</h3>
      <div className="term-explainers">
        {rendered.map(({ ex, text }) => (
          <p key={ex.key} className="prose"><b>{ex.term}.</b> {ex.meaning} {text}</p>
        ))}
      </div>
    </>
  )
}
