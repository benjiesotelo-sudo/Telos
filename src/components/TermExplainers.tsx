import type { Explainer, ResultValues } from '../lib/registry/explainers'

/** A5: renders one term-led paragraph per explainer - bold term, one-sentence meaning, then the
 * live-value interpretation for this run - under a card's "Understanding the numbers" heading. */
export function TermExplainers({ items, values }: { items: Explainer[]; values: ResultValues }) {
  if (items.length === 0) return null
  return (
    <div className="term-explainers">
      {items.map((ex) => (
        <p key={ex.key} className="prose"><b>{ex.term}.</b> {ex.meaning} {ex.interpret(values)}</p>
      ))}
    </div>
  )
}
