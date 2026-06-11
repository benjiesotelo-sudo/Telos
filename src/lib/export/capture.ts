import { toPng } from 'html-to-image'

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.split(',')[1]); const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export const captureNode = async (id: string) =>
  dataUrlToBytes(await toPng(document.getElementById(id)!, { pixelRatio: 2, backgroundColor: getComputedStyle(document.body).backgroundColor }))
