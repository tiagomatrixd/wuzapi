import { Webhook } from 'lucide-react'
import type { Instance } from '../../lib/types'
import { STATE_LABEL, cn, formatPhone, sessionState, truncateMiddle } from '../../lib/utils'
import { SignalBars } from '../../components/StatusSignal'
import { Button } from '../../components/ui/primitives'
import { RowMenu } from './RowMenu'
import type { SessionActions } from './actions'

/** Desktop presentation: one dense row per session, scannable top to bottom. */
export function SessionTable({
  instances,
  actions,
  isAdmin,
}: {
  instances: Instance[]
  actions: SessionActions
  isAdmin: boolean
}) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-line bg-surface shadow-card md:block">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            {['Status', 'Instância', 'Número', 'Webhook', ''].map((heading, index) => (
              <th
                key={heading || index}
                scope="col"
                className={cn(
                  'px-4 py-2.5 text-[11px] font-medium tracking-[0.08em] text-faint uppercase',
                  index === 4 && 'w-px',
                )}
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {instances.map((instance) => {
            const state = sessionState(instance)
            const busy = actions.busy.has(instance.id)

            return (
              <tr
                key={instance.id}
                className="group border-b border-line/60 transition-colors last:border-0 hover:bg-surface-2/60"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <SignalBars state={state} />
                    <span
                      className={cn(
                        'text-[13px] whitespace-nowrap',
                        state === 'online' ? 'text-muted' : 'font-medium text-text',
                      )}
                    >
                      {STATE_LABEL[state]}
                    </span>
                  </div>
                </td>

                <td className="max-w-0 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => actions.open(instance)}
                    className="block max-w-full truncate text-left font-medium text-text hover:text-accent hover:underline underline-offset-2"
                  >
                    {instance.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => actions.copy(instance.id, 'ID copiado')}
                    title="Copiar ID"
                    className="mt-0.5 block max-w-full truncate font-mono text-[11px] text-faint transition-colors hover:text-muted"
                  >
                    {instance.id}
                  </button>
                </td>

                <td className="px-4 py-3 whitespace-nowrap">
                  {instance.jid ? (
                    <span className="tnum text-[13px] text-muted">
                      {formatPhone(instance.jid)}
                    </span>
                  ) : (
                    <span className="text-[13px] text-faint">não pareado</span>
                  )}
                </td>

                <td className="max-w-[220px] px-4 py-3">
                  {instance.webhook ? (
                    <span
                      className="flex items-center gap-1.5 text-[13px] text-muted"
                      title={instance.webhook}
                    >
                      <Webhook className="size-3.5 shrink-0 text-faint" aria-hidden />
                      <span className="truncate">{truncateMiddle(instance.webhook, 32)}</span>
                    </span>
                  ) : (
                    <span className="text-[13px] text-faint">—</span>
                  )}
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={busy}
                      onClick={() => actions.open(instance)}
                    >
                      Abrir
                    </Button>
                    <RowMenu instance={instance} actions={actions} isAdmin={isAdmin} />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
