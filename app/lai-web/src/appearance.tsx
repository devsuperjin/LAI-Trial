import { MotionConfig } from 'motion/react'
import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

export type ThemeMode = 'dark' | 'light' | 'system'
const KEY = 'dsh-console-theme'
function initialMode(): ThemeMode {
  try { const value = localStorage.getItem(KEY); if (value === 'light' || value === 'system') return value } catch { /* Keep the default when storage is blocked. */ }
  return 'dark'
}
const MOTION_KEY = 'lai-web-reduce-motion'
function initialReducedMotion() {
  try { const saved = localStorage.getItem(MOTION_KEY); if (saved !== null) return saved === 'true' } catch {}
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
const Appearance = createContext<{ mode: ThemeMode; resolvedTheme: 'light' | 'dark'; setMode: (mode: ThemeMode) => void; reduceMotion: boolean; setReduceMotion: (value: boolean) => void }>({ mode: 'dark', resolvedTheme: 'dark', setMode: () => {}, reduceMotion: false, setReduceMotion: () => {} })
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [reduceMotion, setReduceMotion] = useState(initialReducedMotion)
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion)
    try { localStorage.setItem(MOTION_KEY, String(reduceMotion)) } catch {}
  }, [reduceMotion])
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
  return <Appearance.Provider value={{ mode, resolvedTheme, setMode, reduceMotion, setReduceMotion }}><MotionConfig reducedMotion={reduceMotion ? 'always' : 'never'}>{children}</MotionConfig></Appearance.Provider>
}
export const useAppearance = () => useContext(Appearance)
