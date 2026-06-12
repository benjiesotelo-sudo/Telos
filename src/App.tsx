import { useEffect, useState } from 'react'
import { useSession } from './state/session'
import { Stepper } from './components/Stepper'
import { ResultBoundary } from './components/ResultBoundary'
import { WelcomeScreen } from './components/screens/WelcomeScreen'
import { UploadScreen } from './components/screens/UploadScreen'
import { GuideScreen } from './components/screens/GuideScreen'
import { ConfigureDataScreen } from './components/screens/ConfigureDataScreen'
import { PickTestsScreen } from './components/screens/PickTestsScreen'
import { TestConfigScreen } from './components/screens/TestConfigScreen'
import { ResultsScreen } from './components/screens/ResultsScreen'

const THEMES = [['light', 'Default'], ['dark', 'Dark'], ['auto', 'Automatic']] as const

function ThemeSelect() {
  const [theme, setTheme] = useState(() => localStorage.getItem('telos-theme') ?? 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('telos-theme', theme)
  }, [theme])
  return (
    <select className="theme-select" aria-label="Theme" value={theme} onChange={(e) => setTheme(e.target.value)}>
      {THEMES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  )
}

export default function App() {
  const step = useSession((s) => s.step)
  return (
    <main className="screen">
      <ThemeSelect />
      <Stepper />
      {step === 'welcome' ? <WelcomeScreen /> : step === 'upload' ? <UploadScreen />
        : step === 'guide' ? <GuideScreen /> : step === 'configure-data' ? <ConfigureDataScreen />
        : step === 'pick-tests' ? <PickTestsScreen />
        : step === 'results' ? <ResultBoundary><ResultsScreen /></ResultBoundary>
        : <TestConfigScreen testId={step.slice(5)} />}
    </main>
  )
}
