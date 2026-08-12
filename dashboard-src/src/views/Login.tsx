import { useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound, ShieldCheck, Smartphone } from 'lucide-react'
import { useAuth } from '../app/auth'
import { errorMessage } from '../lib/api'
import { Button, Input } from '../components/ui/primitives'
import { ThemeToggle } from '../components/ThemeToggle'
import { Wordmark } from '../components/Wordmark'
import { cn } from '../lib/utils'

type Mode = 'admin' | 'user'

const COPY: Record<Mode, { title: string; hint: string; placeholder: string }> = {
  admin: {
    title: 'Token de administrador',
    hint: 'O mesmo valor de WUZAPI_ADMIN_TOKEN no seu .env. Dá acesso a todas as sessões.',
    placeholder: 'Cole o token de administrador',
  },
  user: {
    title: 'Token da instância',
    hint: 'O token criado para uma única sessão. Abre apenas essa sessão.',
    placeholder: 'Cole o token da instância',
  },
}

export function Login() {
  const { loginAsAdmin, loginAsUser } = useAuth()
  const [mode, setMode] = useState<Mode>('admin')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const value = token.trim()
    if (!value) {
      setError('Informe o token para continuar.')
      return
    }

    setBusy(true)
    setError('')
    try {
      if (mode === 'admin') await loginAsAdmin(value)
      else await loginAsUser(value)
    } catch (caught) {
      setError(errorMessage(caught))
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between px-5 py-4">
        <Wordmark />
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-semibold text-text">Entrar no console</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Escolha o tipo de acesso e informe o token correspondente.
          </p>

          {/* Segmented control — the two access levels are mutually exclusive,
              so a switch reads truer than two separate buttons. */}
          <div
            role="tablist"
            aria-label="Tipo de acesso"
            className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface-2 p-1"
          >
            {(['admin', 'user'] as Mode[]).map((option) => {
              const Icon = option === 'admin' ? ShieldCheck : Smartphone
              const active = mode === option
              return (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setMode(option)
                    setError('')
                  }}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all',
                    active
                      ? 'bg-surface text-text shadow-card'
                      : 'text-muted hover:text-text',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {option === 'admin' ? 'Administrador' : 'Instância'}
                </button>
              )
            })}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            <div className="space-y-1.5">
              <label htmlFor="token" className="block text-[13px] font-medium text-text">
                {COPY[mode].title}
              </label>
              <div className="relative">
                <KeyRound
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
                  aria-hidden
                />
                <Input
                  id="token"
                  type="password"
                  value={token}
                  onChange={(event) => {
                    setToken(event.target.value)
                    setError('')
                  }}
                  placeholder={COPY[mode].placeholder}
                  className="h-11 pl-9 font-mono text-[13px]"
                  autoComplete="off"
                  autoFocus
                  spellCheck={false}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'token-error' : 'token-hint'}
                />
              </div>
              {error ? (
                <p id="token-error" className="text-xs text-down" role="alert">
                  {error}
                </p>
              ) : (
                <p id="token-hint" className="text-xs leading-relaxed text-muted">
                  {COPY[mode].hint}
                </p>
              )}
            </div>

            <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">
              Entrar
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
