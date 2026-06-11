import { Engine } from './engine'
let enginePromise: Promise<Engine> | null = null
export const getEngine = (onStatus?: (m: string) => void) =>
  (enginePromise ??= (async () => { const e = new Engine(); await e.init(onStatus); return e })())
