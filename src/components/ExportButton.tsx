import { toPng } from 'html-to-image'
import { useSession } from '../state/session'
import { buildBundle } from '../lib/export/bundle'
import { INDEPENDENT_T_TEST as spec } from '../lib/registry/independentTTest'

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.split(',')[1]); const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
const capture = async (id: string) =>
  dataUrlToBytes(await toPng(document.getElementById(id)!, { pixelRatio: 2, backgroundColor: getComputedStyle(document.body).backgroundColor }))

export function ExportButton() {
  const { result, status } = useSession()
  if (!result || status !== 'done') return null
  const download = async () => {
    const folder = `01_${spec.id}/` // per the ui spec bundle tree: each test's images in an NN_<id>/ folder
    const files: Record<string, Uint8Array> = {}
    for (const t of spec.tables) files[`${folder}table_${t.id}.png`] = await capture(`table-${t.id}`)
    files[`${folder}figure_${spec.figure.type}.png`] = result.figurePng
    const url = URL.createObjectURL(new Blob([buildBundle(files)], { type: 'application/zip' }))
    const a = document.createElement('a'); a.href = url; a.download = 'telos-results.zip'; a.click(); URL.revokeObjectURL(url)
  }
  return <button onClick={download}>Download results (.zip)</button>
}
