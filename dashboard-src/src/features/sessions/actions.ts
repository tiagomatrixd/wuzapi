import type { Instance } from '../../lib/types'

export interface SessionActions {
  open: (instance: Instance) => void
  connect: (instance: Instance) => void
  disconnect: (instance: Instance) => void
  logout: (instance: Instance) => void
  remove: (instance: Instance) => void
  copy: (value: string, label: string) => void
  /** Ids with a request in flight, so buttons can show a spinner. */
  busy: Set<string>
}
