/**
 * localStorage with a TTL, matching the behaviour the old dashboard relied on
 * (tokens expired after 6h) but namespaced so it cannot collide with anything
 * else served from the same origin.
 */
const PREFIX = 'wuzapi.'

interface Stored<T> {
  value: T
  expiry: number | null
}

export function setStored<T>(key: string, value: T, hours: number | null = 6): void {
  try {
    const item: Stored<T> = {
      value,
      expiry: hours === null ? null : Date.now() + hours * 3_600_000,
    }
    localStorage.setItem(PREFIX + key, JSON.stringify(item))
  } catch {
    // Private mode / quota exceeded — the app still works, it just forgets.
  }
}

export function getStored<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null

    const item = JSON.parse(raw) as Stored<T>
    if (item.expiry !== null && Date.now() > item.expiry) {
      localStorage.removeItem(PREFIX + key)
      return null
    }
    return item.value ?? null
  } catch {
    return null
  }
}

export function removeStored(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    /* nothing to clean up */
  }
}
