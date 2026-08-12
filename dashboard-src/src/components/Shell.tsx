import type { ReactNode } from 'react'
import { ChevronLeft, LogOut, ShieldCheck, Smartphone } from 'lucide-react'
import { useAuth } from '../app/auth'
import { cn } from '../lib/utils'
import { Badge } from './ui/primitives'
import { ThemeToggle } from './ThemeToggle'
import { Wordmark } from './Wordmark'

export interface Tab {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export function Shell({
  children,
  tabs,
  activeTab,
  onTab,
  onBack,
  contextLabel,
}: {
  children: ReactNode
  tabs?: Tab[]
  activeTab?: string
  onTab?: (id: string) => void
  onBack?: () => void
  contextLabel?: string
}) {
  const { role, logout } = useAuth()

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="-ml-2 flex items-center gap-1 rounded-lg py-1.5 pr-2.5 pl-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
            >
              <ChevronLeft className="size-4" aria-hidden />
              <span className="hidden sm:inline">Sessões</span>
            </button>
          ) : (
            <Wordmark />
          )}

          {contextLabel && (
            <>
              <span className="text-line-strong" aria-hidden>
                /
              </span>
              <span className="min-w-0 truncate font-display text-sm font-semibold text-text">
                {contextLabel}
              </span>
            </>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Badge tone={role === 'admin' ? 'accent' : 'neutral'} className="hidden sm:inline-flex">
              {role === 'admin' ? (
                <ShieldCheck className="size-3" aria-hidden />
              ) : (
                <Smartphone className="size-3" aria-hidden />
              )}
              {role === 'admin' ? 'Admin' : 'Instância'}
            </Badge>
            <ThemeToggle />
            <button
              type="button"
              onClick={logout}
              title="Sair"
              aria-label="Sair"
              className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-down"
            >
              <LogOut className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        {tabs && tabs.length > 0 && (
          <nav
            className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 sm:px-6"
            aria-label="Seções da instância"
          >
            {tabs.map((tab) => {
              const active = tab.id === activeTab
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTab?.(tab.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors',
                    active
                      ? 'border-accent text-text'
                      : 'border-transparent text-muted hover:text-text',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-7">{children}</main>
    </div>
  )
}
