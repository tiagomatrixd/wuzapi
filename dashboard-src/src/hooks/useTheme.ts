import { useCallback, useEffect, useState } from 'react'
import { getStored, setStored } from '../lib/storage'
import type { Theme } from '../lib/types'

const KEY = 'theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

function apply(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && media().matches)
  document.documentElement.classList.toggle('dark', dark)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#0b0f14' : '#f7f8fa')
}

/**
 * Three-state theme: light, dark, or follow the OS. The initial class is set by
 * an inline script in index.html so there is no flash before hydration.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getStored<Theme>(KEY) ?? 'system')

  useEffect(() => {
    apply(theme)
    if (theme !== 'system') return

    const listener = () => apply('system')
    const query = media()
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    // Never expires: a display preference should outlive the session token.
    setStored(KEY, next, null)
    setThemeState(next)
  }, [])

  return { theme, setTheme }
}
