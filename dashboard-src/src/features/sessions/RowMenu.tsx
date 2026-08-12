import { useEffect, useRef, useState } from 'react'
import {
  Copy,
  LogOut,
  MoreHorizontal,
  Plug,
  PlugZap,
  Trash2,
} from 'lucide-react'
import type { Instance } from '../../lib/types'
import { cn, sessionState } from '../../lib/utils'
import type { SessionActions } from './actions'

/** Overflow menu for the actions that are not the primary "Abrir". */
export function RowMenu({
  instance,
  actions,
  isAdmin,
}: {
  instance: Instance
  actions: SessionActions
  isAdmin: boolean
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const state = sessionState(instance)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const run = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  const items = [
    state === 'offline'
      ? { icon: PlugZap, label: 'Conectar', onClick: run(() => actions.connect(instance)) }
      : { icon: Plug, label: 'Desconectar', onClick: run(() => actions.disconnect(instance)) },
    {
      icon: Copy,
      label: 'Copiar token',
      onClick: run(() => actions.copy(instance.token, 'Token copiado')),
    },
    {
      icon: Copy,
      label: 'Copiar ID',
      onClick: run(() => actions.copy(instance.id, 'ID copiado')),
    },
    ...(instance.loggedIn
      ? [
          {
            icon: LogOut,
            label: 'Encerrar sessão do WhatsApp',
            onClick: run(() => actions.logout(instance)),
            danger: true,
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            icon: Trash2,
            label: 'Excluir instância',
            onClick: run(() => actions.remove(instance)),
            danger: true,
          },
        ]
      : []),
  ]

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Mais ações para ${instance.name}`}
        className={cn(
          'grid size-8 place-items-center rounded-lg transition-colors',
          open ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2 hover:text-text',
        )}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-scale-in absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={item.onClick}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
                'danger' in item && item.danger
                  ? 'text-down hover:bg-down-soft'
                  : 'text-text hover:bg-surface-2',
              )}
            >
              <item.icon className="size-3.5 shrink-0" aria-hidden />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
