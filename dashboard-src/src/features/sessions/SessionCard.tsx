import { Webhook } from 'lucide-react'
import type { Instance } from '../../lib/types'
import { STATE_LABEL, cn, formatPhone, sessionState, truncateMiddle } from '../../lib/utils'
import { SignalBars } from '../../components/StatusSignal'
import { Button } from '../../components/ui/primitives'
import { RowMenu } from './RowMenu'
import type { SessionActions } from './actions'

/** Mobile presentation: the same information reflowed so nothing is cut off. */
export function SessionCardList({
  instances,
  actions,
  isAdmin,
}: {
  instances: Instance[]
  actions: SessionActions
  isAdmin: boolean
}) {
  return (
    <div className="space-y-2 md:hidden">
      {instances.map((instance) => {
        const state = sessionState(instance)
        const busy = actions.busy.has(instance.id)

        return (
          <article
            key={instance.id}
            className="rounded-xl border border-line bg-surface p-3.5 shadow-card"
          >
            <div className="flex items-start gap-3">
              <SignalBars state={state} className="mt-1" />

              <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium text-text">{instance.name}</h3>
                <p
                  className={cn(
                    'mt-0.5 text-xs',
                    state === 'online' ? 'text-muted' : 'font-medium text-text',
                  )}
                >
                  {STATE_LABEL[state]}
                </p>
              </div>

              <RowMenu instance={instance} actions={actions} isAdmin={isAdmin} />
            </div>

            <dl className="mt-3 space-y-1.5 border-t border-line pt-3 text-[13px]">
              <div className="flex items-baseline gap-2">
                <dt className="w-16 shrink-0 text-xs text-faint">Número</dt>
                <dd className="tnum min-w-0 truncate text-muted">
                  {instance.jid ? formatPhone(instance.jid) : 'não pareado'}
                </dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="w-16 shrink-0 text-xs text-faint">ID</dt>
                <dd className="min-w-0 truncate font-mono text-[11px] text-muted">
                  {instance.id}
                </dd>
              </div>
              {instance.webhook && (
                <div className="flex items-baseline gap-2">
                  <dt className="w-16 shrink-0 text-xs text-faint">Webhook</dt>
                  <dd className="flex min-w-0 items-center gap-1 truncate text-muted">
                    <Webhook className="size-3 shrink-0 text-faint" aria-hidden />
                    {truncateMiddle(instance.webhook, 26)}
                  </dd>
                </div>
              )}
            </dl>

            <Button
              size="sm"
              variant="secondary"
              loading={busy}
              onClick={() => actions.open(instance)}
              className="mt-3 w-full"
            >
              Abrir instância
            </Button>
          </article>
        )
      })}
    </div>
  )
}
