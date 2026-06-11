import { Component, type ReactNode } from 'react'
import { useSession } from './state/session'
import { Stepper } from './components/Stepper'
import { WelcomeScreen } from './components/screens/WelcomeScreen'
import { UploadScreen } from './components/screens/UploadScreen'
import { GuideScreen } from './components/screens/GuideScreen'
import { ConfigureDataScreen } from './components/screens/ConfigureDataScreen'
import { PickTestsScreen } from './components/screens/PickTestsScreen'
import { TestConfigScreen } from './components/screens/TestConfigScreen'
import { ResultsScreen } from './components/screens/ResultsScreen'

class ResultBoundary extends Component<{ children: ReactNode }, { msg: string | null }> {
  state = { msg: null as string | null }
  static getDerivedStateFromError(e: unknown) { return { msg: e instanceof Error ? e.message : String(e) } }
  render() { return this.state.msg ? <p role="alert">Display error: {this.state.msg}</p> : this.props.children }
}

export default function App() {
  const step = useSession((s) => s.step)
  return (
    <main className="screen">
      <Stepper />
      {step === 'welcome' ? <WelcomeScreen /> : step === 'upload' ? <UploadScreen />
        : step === 'guide' ? <GuideScreen /> : step === 'configure-data' ? <ConfigureDataScreen />
        : step === 'pick-tests' ? <PickTestsScreen />
        : step === 'results' ? <ResultBoundary><ResultsScreen /></ResultBoundary>
        : <TestConfigScreen testId={step.slice(5)} />}
    </main>
  )
}
