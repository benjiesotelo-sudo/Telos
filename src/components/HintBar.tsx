/** Spec R2: one-time disclosure that the rail is navigation. Session-scoped on purpose. */
export function HintBar({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <div className="hintbar" role="note">
      <span aria-hidden="true">💡</span>
      <span>{text}</span>
      <button type="button" className="hintbar-x" aria-label="Dismiss tip" onClick={onDismiss}>✕</button>
    </div>
  )
}
