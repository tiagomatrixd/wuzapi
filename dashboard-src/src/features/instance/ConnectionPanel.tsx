import { useState } from 'react'
import { Copy, LogOut, Plug, PlugZap, QrCode, Smartphone } from 'lucide-react'
import type { Instance } from '../../lib/types'
import { copyToClipboard, formatPhone, sessionState } from '../../lib/utils'
import { StatusPill } from '../../components/StatusSignal'
import { Button } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/Toast'

/**
 * The instance header. When the session is waiting to be paired, the QR takes
 * over the right half — at that moment it is the only thing the operator needs.
 */
export function ConnectionPanel({
  instance,
  qrcode,
  busy,
  onConnect,
  onDisconnect,
  onLogout,
  onPairByPhone,
}: {
  instance: Instance
  /** Read fresh from /session/qr; falls back to the cached status value. */
  qrcode: string
  busy: boolean
  onConnect: () => void
  onDisconnect: () => void
  onLogout: () => void
  onPairByPhone: () => void
}) {
  const toast = useToast()
  const state = sessionState(instance)
  const [copied, setCopied] = useState(false)

  const copyToken = async () => {
    if (await copyToClipboard(instance.token)) {
      setCopied(true)
      toast.success('Token copiado.')
      window.setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error('Não foi possível copiar o token.')
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:gap-10">
        <div className="min-w-0">
          <StatusPill state={state} />

          <h1 className="mt-3 truncate font-display text-2xl font-semibold text-text">
            {instance.name}
          </h1>

          <dl className="mt-4 grid gap-x-8 gap-y-2.5 text-[13px] sm:grid-cols-2">
            <div className="flex items-baseline gap-2">
              <dt className="w-20 shrink-0 text-xs text-faint">Número</dt>
              <dd className="tnum min-w-0 truncate text-muted">
                {instance.jid ? formatPhone(instance.jid) : 'não pareado'}
              </dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="w-20 shrink-0 text-xs text-faint">ID</dt>
              <dd className="min-w-0 truncate font-mono text-[11px] text-muted">{instance.id}</dd>
            </div>
            <div className="flex items-baseline gap-2 sm:col-span-2">
              <dt className="w-20 shrink-0 text-xs text-faint">Token</dt>
              <dd className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 truncate font-mono text-[11px] text-muted">
                  {instance.token}
                </span>
                <button
                  type="button"
                  onClick={copyToken}
                  aria-label="Copiar token"
                  className="grid size-6 shrink-0 place-items-center rounded text-faint transition-colors hover:text-text"
                >
                  <Copy className="size-3.5" aria-hidden />
                </button>
                {copied && <span className="shrink-0 text-[11px] text-up">copiado</span>}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-wrap gap-2">
            {state === 'offline' ? (
              <Button variant="primary" onClick={onConnect} loading={busy}>
                <PlugZap className="size-4" aria-hidden />
                Conectar
              </Button>
            ) : (
              <Button variant="secondary" onClick={onDisconnect} loading={busy}>
                <Plug className="size-4" aria-hidden />
                Desconectar
              </Button>
            )}

            {state === 'pairing' && (
              <Button variant="secondary" onClick={onPairByPhone}>
                <Smartphone className="size-4" aria-hidden />
                Parear por código
              </Button>
            )}

            {instance.loggedIn && (
              <Button variant="ghost" onClick={onLogout} className="text-down hover:bg-down-soft">
                <LogOut className="size-4" aria-hidden />
                Encerrar sessão
              </Button>
            )}
          </div>
        </div>

        {/* QR panel — only meaningful while the session is unauthenticated. */}
        {!instance.loggedIn && (
          <div className="lg:w-[19rem]">
            <div className="rounded-xl border border-line bg-surface-2 p-4">
              {qrcode ? (
                <>
                  {/* The server encodes at 256px. Rendering at exactly 256px
                      means no resampling at all, which is what keeps the code
                      readable by a phone camera. */}
                  <div className="mx-auto w-fit rounded-lg bg-white p-3">
                    <img
                      src={qrcode}
                      alt="QR code para conectar o WhatsApp"
                      width={256}
                      height={256}
                      className="qr-crisp block size-64 max-w-full"
                    />
                  </div>
                  <ol className="mt-3.5 space-y-1 text-xs leading-relaxed text-muted">
                    <li>1. Abra o WhatsApp no celular</li>
                    <li>2. Toque em Dispositivos conectados</li>
                    <li>3. Toque em Conectar um dispositivo e aponte para o código</li>
                  </ol>
                  <p className="mt-2 text-xs text-faint">
                    O código se renova sozinho a cada poucos segundos.
                  </p>
                </>
              ) : (
                <div className="flex h-full min-h-52 flex-col items-center justify-center text-center">
                  <QrCode className="size-8 text-faint" aria-hidden />
                  <p className="mt-3 text-[13px] font-medium text-text">
                    {state === 'offline' ? 'Sessão desconectada' : 'Gerando o código…'}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {state === 'offline'
                      ? 'Conecte a instância para gerar o QR code.'
                      : 'O código aparece aqui em alguns segundos.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
