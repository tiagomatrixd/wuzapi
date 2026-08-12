import { RefreshCw } from 'lucide-react'
import { STATE_STYLES, cn, formatRelative } from '../lib/utils'
import type { SessionState } from '../lib/types'
import { StatusDot } from './StatusSignal'

export interface FleetCounts {
  online: number
  pairing: number
  offline: number
  total: number
}

const ORDER: SessionState[] = ['online', 'pairing', 'offline']

const LABEL: Record<SessionState, string> = {
  online: 'online',
  pairing: 'aguardando leitura',
  offline: 'offline',
}

/**
 * The board's headline. Instead of four identical number tiles, one
 * proportional bar shows the shape of the whole fleet at a glance, and each
 * segment doubles as the status filter — so the summary and the control that
 * acts on it are the same object.
 */
export function FleetBar({
  counts,
  filter,
  onFilter,
  lastUpdated,
  refreshing,
  onRefresh,
}: {
  counts: FleetCounts
  filter: SessionState | 'all'
  onFilter: (next: SessionState | 'all') => void
  lastUpdated: number | null
  refreshing?: boolean
  onRefresh: () => void
}) {
  const { total } = counts

  return (
    <section className="rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-[0.14em] text-faint uppercase">Frota</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="tnum font-display text-3xl leading-none font-semibold text-text sm:text-4xl">
              {total}
            </span>
            <span className="text-sm text-muted">
              {total === 1 ? 'sessão' : 'sessões'}
              {filter !== 'all' && (
                <>
                  {' · '}
                  <button
                    type="button"
                    onClick={() => onFilter('all')}
                    className="text-accent underline underline-offset-2 hover:no-underline"
                  >
                    limpar filtro
                  </button>
                </>
              )}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-text"
          title="Atualizar agora"
        >
          <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin-slow')} aria-hidden />
          <span className="tnum">{formatRelative(lastUpdated)}</span>
        </button>
      </div>

      {/* Proportional bar */}
      <div
        className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={`${counts.online} online, ${counts.pairing} aguardando leitura, ${counts.offline} offline`}
      >
        {total === 0 ? (
          <div className="w-full bg-line" />
        ) : (
          ORDER.map((state) => {
            const value = counts[state]
            if (value === 0) return null
            return (
              <button
                key={state}
                type="button"
                onClick={() => onFilter(filter === state ? 'all' : state)}
                style={{ width: `${(value / total) * 100}%` }}
                title={`${value} ${LABEL[state]}`}
                aria-label={`Filtrar por ${LABEL[state]}`}
                className={cn(
                  'h-full min-w-1 transition-opacity hover:opacity-80',
                  STATE_STYLES[state].bar,
                  filter !== 'all' && filter !== state && 'opacity-25',
                )}
              />
            )
          })
        )}
      </div>

      {/* Counts double as filter chips */}
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {ORDER.map((state) => {
          const active = filter === state
          return (
            <button
              key={state}
              type="button"
              onClick={() => onFilter(active ? 'all' : state)}
              aria-pressed={active}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[13px] transition-all',
                active
                  ? 'border-line-strong bg-surface-2 text-text'
                  : 'border-transparent text-muted hover:bg-surface-2 hover:text-text',
              )}
            >
              <StatusDot state={state} />
              <span className="tnum font-display font-semibold">{counts[state]}</span>
              <span>{LABEL[state]}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
