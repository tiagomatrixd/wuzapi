import { cn } from '../lib/utils'

/**
 * The mark is three ascending bars — the same signal glyph used for session
 * status, so the product's logo and its core reading are literally the same
 * shape.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span className="flex items-end gap-0.5" aria-hidden>
        <span className="h-2 w-1 rounded-[1px] bg-up/50" />
        <span className="h-3 w-1 rounded-[1px] bg-up/75" />
        <span className="h-4 w-1 rounded-[1px] bg-up" />
      </span>
      <span className="font-display text-[15px] font-semibold tracking-tight text-text">
        WuzAPI
      </span>
    </span>
  )
}
