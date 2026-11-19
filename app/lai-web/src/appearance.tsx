import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type ThemeMode = 'dark' | 'light' | 'system'
const KEY = 'dsh-console-theme'
function initialMode(): ThemeMode {
  try { const value = localStorage.getItem(KEY); if (value === 'light' || value === 'system') return value } catch { /* Keep the default when storage is blocked. */ }
  return 'dark'
}
const Appearance = createContext<{ mode: ThemeMode; resolvedTheme: 'light' | 'dark'; setMode: (mode: ThemeMode) => void }>({ mode: 'dark', resolvedTheme: 'dark', setMode: () => {} })
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(initialMode)
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(media.matches)
    update(); media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  const resolvedTheme = mode === 'system' ? systemDark ? 'dark' : 'light' : mode
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    try { localStorage.setItem(KEY, mode) } catch { /* The setting still applies for this visit. */ }
  }, [mode, resolvedTheme])
  return <Appearance.Provider value={{ mode, resolvedTheme, setMode }}>{children}</Appearance.Provider>
}
export const useAppearance = () => useContext(Appearance)
