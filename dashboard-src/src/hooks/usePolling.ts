import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../lib/api'

interface PollingState<T> {
  data: T | null
  error: string | null
  loading: boolean
  lastUpdated: number | null
}

/**
 * Re-runs `fetcher` on an interval and swaps the result in place. The previous
 * data stays visible while a refresh is in flight, so filters, scroll position
 * and text selection survive every tick — the old dashboard rebuilt its whole
 * table every 5s and lost all of it.
 *
 * Polling pauses while the tab is hidden and resumes with an immediate fetch.
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  enabled = true,
): PollingState<T> & { refresh: () => Promise<void> } {
  const [state, setState] = useState<PollingState<T>>({
    data: null,
    error: null,
    loading: true,
    lastUpdated: null,
  })

  // Keeping the fetcher in a ref lets callers pass an inline closure without
  // restarting the interval on every render.
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const data = await fetcherRef.current()
      if (!mounted.current) return
      setState({ data, error: null, loading: false, lastUpdated: Date.now() })
    } catch (error) {
      if (!mounted.current) return
      // Keep the last good data on screen; a blip should not blank the board.
      setState((current) => ({
        ...current,
        error: errorMessage(error),
        loading: false,
      }))
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    let timer = 0
    let cancelled = false

    const tick = async () => {
      if (cancelled) return
      if (!document.hidden) await refresh()
      if (cancelled) return
      timer = window.setTimeout(tick, intervalMs)
    }

    tick()

    const onVisible = () => {
      if (!document.hidden) refresh()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, intervalMs, refresh])

  return { ...state, refresh }
}
