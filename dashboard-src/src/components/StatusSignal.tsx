import { STATE_LABEL, STATE_STYLES, cn } from '../lib/utils'
import type { SessionState } from '../lib/types'

/**
 * A three-bar reception glyph. Reading a session's health should not require
 * reading words: full bars = online, two bars = waiting for a QR scan, one
 * hollow bar = offline. Colour reinforces it, but shape carries the meaning on
 * its own, which keeps it legible for colour-blind operators.
 */
export function SignalBars({
  state,
  className,
}: {
  state: SessionState
  className?: string
}) {
  const filled = state === 'online' ? 3 : state === 'pairing' ? 2 : 1
  const styles = STATE_STYLES[state]

  return (
    <span
      className={cn('inline-flex items-end gap-0.5', className)}
      role="img"
      aria-label={STATE_LABEL[state]}
      title={STATE_LABEL[state]}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={cn(
            'w-1 rounded-[1px] transition-colors',
            index === 0 && 'h-1.5',
            index === 1 && 'h-2.5',
            index === 2 && 'h-3.5',
            index < filled ? styles.bar : 'bg-line-strong opacity-50',
          )}
        />
      ))}
    </span>
  )
}

/** Dot + label. The halo animates only while the session is genuinely live. */
export function StatusDot({
  state,
  className,
}: {
  state: SessionState
  className?: string
}) {
  const styles = STATE_STYLES[state]
  return (
    <span className={cn('relative inline-flex', styles.ring, className)}>
      <span className={cn('size-2 rounded-full', styles.dot)} />
      {state === 'online' && <span className="pulse-ring absolute inset-0" aria-hidden />}
    </span>
  )
}

export function StatusPill({ state, className }: { state: SessionState; className?: string }) {
  const styles = STATE_STYLES[state]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium',
        styles.bg,
        styles.text,
        className,
      )}
    >
      <StatusDot state={state} />
      {STATE_LABEL[state]}
    </span>
  )
}
