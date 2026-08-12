import { useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { EVENT_GROUPS } from '../lib/events'
import { cn } from '../lib/utils'
import { Input } from './ui/primitives'

/**
 * Replaces the 50-option <select multiple>. "Todos os eventos" is modelled as a
 * master switch rather than one more option in the list, because on the server
 * `All` overrides every other value — showing it as a peer invites mistakes.
 */
export function EventPicker({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const all = selected.includes('All')

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return EVENT_GROUPS
    return EVENT_GROUPS.map((group) => ({
      ...group,
      events: group.events.filter(
        (event) =>
          event.label.toLowerCase().includes(needle) ||
          event.value.toLowerCase().includes(needle),
      ),
    })).filter((group) => group.events.length > 0)
  }, [query])

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected.filter((item) => item !== 'All'), value],
    )
  }

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={() => onChange(all ? [] : ['All'])}
        aria-pressed={all}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors',
          all
            ? 'border-accent bg-accent-soft'
            : 'border-line bg-surface hover:border-line-strong',
        )}
      >
        <span
          className={cn(
            'grid size-4 shrink-0 place-items-center rounded border transition-colors',
            all ? 'border-accent bg-accent text-accent-contrast' : 'border-line-strong',
          )}
        >
          {all && <Check className="size-3" strokeWidth={3} />}
        </span>
        <span className="min-w-0">
          <span className={cn('block text-[13px] font-medium', all ? 'text-accent' : 'text-text')}>
            Todos os eventos
          </span>
          <span className="block text-xs text-muted">
            Recebe tudo. Substitui qualquer seleção individual.
          </span>
        </span>
      </button>

      {!all && (
        <>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar evento"
              className="h-8 pl-8 text-[13px]"
              aria-label="Buscar evento"
            />
          </div>

          <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-line bg-surface p-3">
            {groups.length === 0 && (
              <p className="py-4 text-center text-[13px] text-muted">
                Nenhum evento corresponde a “{query}”.
              </p>
            )}
            {groups.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 text-[10px] font-semibold tracking-[0.12em] text-faint uppercase">
                  {group.label}
                </p>
                <div className="grid gap-0.5 sm:grid-cols-2">
                  {group.events.map((event) => {
                    const active = selected.includes(event.value)
                    return (
                      <button
                        key={event.value}
                        type="button"
                        onClick={() => toggle(event.value)}
                        aria-pressed={active}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors',
                          active ? 'text-text' : 'text-muted hover:bg-surface-2 hover:text-text',
                        )}
                      >
                        <span
                          className={cn(
                            'grid size-3.5 shrink-0 place-items-center rounded-[4px] border transition-colors',
                            active
                              ? 'border-accent bg-accent text-accent-contrast'
                              : 'border-line-strong',
                          )}
                        >
                          {active && <Check className="size-2.5" strokeWidth={3.5} />}
                        </span>
                        <span className="truncate">{event.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted">
            {selected.length === 0
              ? 'Nenhum evento selecionado — o webhook não será chamado.'
              : `${selected.length} ${selected.length === 1 ? 'evento selecionado' : 'eventos selecionados'}.`}
          </p>
        </>
      )}
    </div>
  )
}
