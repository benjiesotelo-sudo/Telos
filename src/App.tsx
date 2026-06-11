import { Component, type ReactNode } from 'react'
import { DatasetLoader } from './components/DatasetLoader'
import { TestConfig } from './components/TestConfig'
import { ResultCard } from './components/ResultCard'
import { ExportButton } from './components/ExportButton'

class ResultBoundary extends Component<{ children: ReactNode }, { msg: string | null }> {
  state = { msg: null as string | null }
  static getDerivedStateFromError(e: unknown) { return { msg: e instanceof Error ? e.message : String(e) } }
  render() { return this.state.msg ? <p role="alert">Display error: {this.state.msg}</p> : this.props.children }
}

export default function App() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1 className="display">Telos</h1>
      <DatasetLoader /><TestConfig />
      <ResultBoundary><ResultCard /><ExportButton /></ResultBoundary>
    </main>
  )
}
