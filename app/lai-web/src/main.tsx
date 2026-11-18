import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LanguageProvider } from './i18n.tsx'
import { App } from './App.tsx'
import './styles.css'

const rootElement = document.getElementById('root')
if (rootElement === null) throw new Error('console root element missing')
createRoot(rootElement).render(
  <StrictMode>
    <LanguageProvider><App /></LanguageProvider>
  </StrictMode>,
)
