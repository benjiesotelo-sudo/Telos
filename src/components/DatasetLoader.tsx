import { useSession } from '../state/session'
import { SAMPLE } from '../lib/data/sample'
import { parseCsv } from '../lib/data/parseCsv'
export function DatasetLoader() {
  const { dataset, setDataset } = useSession()
  return (
    <section>
      <button onClick={() => setDataset(SAMPLE)}>Load sample data</button>
      <input type="file" accept=".csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setDataset(parseCsv(await f.text())) }} />
      {dataset && <p>{dataset.rows.length} rows · {dataset.columns.join(', ')}</p>}
    </section>
  )
}
