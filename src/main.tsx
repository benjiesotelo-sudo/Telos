import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import App from './App.tsx'

// Set before first paint so a saved Dark choice doesn't flash light on load.
document.documentElement.dataset.theme = localStorage.getItem('telos-theme') ?? 'light'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
