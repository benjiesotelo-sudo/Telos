/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react'

export function dismissHint(storageKey: string) { try { sessionStorage.setItem(storageKey, '1') } catch { /* SSR/no storage: hint just shows again */ } }
const seen = (k: string) => { try { return sessionStorage.getItem(k) !== null } catch { return false } }

/** Spec R2: one-time disclosure that the rail is navigation. Session-scoped on purpose. */
export function HintBar({ text, storageKey }: { text: string; storageKey: string }) {
  const [hidden, setHidden] = useState(() => seen(storageKey))
  if (hidden) return null
  return (
    <div className="hintbar" role="note">
      <span aria-hidden="true">💡</span>
      <span>{text}</span>
      <button type="button" className="hintbar-x" aria-label="Dismiss tip"
        onClick={() => { dismissHint(storageKey); setHidden(true) }}>✕</button>
    </div>
  )
}
