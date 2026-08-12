import { useCallback, useEffect, useState } from 'react'

/**
 * Hash routing rather than the History API: the dashboard is served by Go's
 * http.FileServer, which would answer 404 for a deep path like /dashboard/groups
 * on a hard refresh. The hash never reaches the server.
 */
export function useHashRoute(fallback = '/sessions') {
  const read = useCallback(
    () => window.location.hash.replace(/^#/, '') || fallback,
    [fallback],
  )
  const [route, setRoute] = useState(read)

  useEffect(() => {
    const onChange = () => setRoute(read())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [read])

  const navigate = useCallback((next: string, { replace = false } = {}) => {
    const target = `#${next}`
    if (window.location.hash === target) return
    if (replace) {
      window.history.replaceState(null, '', target)
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    } else {
      window.location.hash = next
    }
  }, [])

  return { route, navigate }
}
