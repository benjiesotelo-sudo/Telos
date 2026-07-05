export function dismissHint(storageKey: string) { try { sessionStorage.setItem(storageKey, '1') } catch { /* SSR/no storage: hint just shows again */ } }
export function hintSeen(storageKey: string) { try { return sessionStorage.getItem(storageKey) !== null } catch { return false } }
