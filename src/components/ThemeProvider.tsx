'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { applyTheme, DEFAULT_THEME, storedTheme, THEME_KEY, type Theme } from '@/lib/theme'

interface ThemeValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

export function useTheme(): ThemeValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>')
  return value
}

// Holds the dashboard's theme for the session and keeps <html> in step.
//
// The inline head script has already set the attribute by the time this mounts
// on a fresh load, so the work here is the other two cases: arriving from the
// landing page through a client-side navigation, where the document was pinned
// dark and nothing has re-read the preference yet, and the toggle itself.
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME)

  useEffect(() => {
    const next = storedTheme() ?? DEFAULT_THEME
    setThemeState(next)
    applyTheme(next)
    // Leaving the dashboard puts the document back the way the rest of the
    // product expects it. Without this, walking from a light dashboard out to
    // the landing page would light a design that has no light version.
    return () => applyTheme('dark')
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    applyTheme(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // Not remembered, but the rest of this session still follows.
    }
    // The cross-fade is switched on only for the moment of the switch, so a
    // page load never animates its own colours in.
    const root = document.documentElement
    root.classList.add('theme-switching')
    window.setTimeout(() => root.classList.remove('theme-switching'), 220)
  }, [])

  const toggle = useCallback(
    () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    [theme, setTheme],
  )

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>
  )
}
