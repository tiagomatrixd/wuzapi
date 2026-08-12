import { useCallback, useMemo, useState } from 'react'
import {
  Download,
  HardDrive,
  MessageSquare,
  Network,
  Search,
  Send,
  Trash2,
  Webhook,
} from 'lucide-react'
import { api, errorMessage } from '../lib/api'
import { usePolling } from '../hooks/usePolling'
import { useToast } from '../components/ui/Toast'
import { Skeleton } from '../components/ui/primitives'
import { ConnectionPanel } from '../features/instance/ConnectionPanel'
import { PairPhoneModal } from '../features/instance/PairPhoneModal'
import { WebhookModal } from '../features/instance/WebhookModal'
import { ProxyModal } from '../features/instance/ProxyModal'
import { S3Modal } from '../features/instance/S3Modal'
import { SendMessageModal } from '../features/instance/SendMessageModal'
import { DeleteMessageModal } from '../features/instance/DeleteMessageModal'
import { LookupModal } from '../features/instance/LookupModal'
import { parseEvents } from '../lib/events'
import { downloadJson, jidToPhone, sessionState } from '../lib/utils'

type Dialog =
  | 'pair'
  | 'webhook'
  | 'proxy'
  | 's3'
  | 'send'
  | 'delete-message'
  | 'lookup'
  | null

function ActionCard({
  icon: Icon,
  title,
  value,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  value: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-4 text-left shadow-card transition-all hover:border-line-strong hover:shadow-pop"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted transition-colors group-hover:text-accent">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-text">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted">{value}</span>
      </span>
    </button>
  )
}

export function Instance({ token }: { token: string }) {
  const toast = useToast()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [busy, setBusy] = useState(false)

  const { data, error, loading, refresh } = usePolling(
    useCallback(() => api.status(token), [token]),
    // While a session is unpaired the QR rotates, so poll faster until it is in.
    3000,
  )

  const instance = data
  const state = instance ? sessionState(instance) : 'offline'

  /*
   * /session/status serves `qrcode` out of userinfocache, which still holds the
   * code from the previous connect attempt during the first seconds after
   * reconnecting — scanning that one always fails. /session/qr reads the users
   * row directly, and that column is cleared on disconnect, so it is either
   * empty or current. Errors ("not connected", "already logged in") are
   * expected here, so they are swallowed rather than surfaced.
   */
  const { data: qrPayload } = usePolling(
    useCallback(() => api.qr(token).catch(() => null), [token]),
    2000,
    state === 'pairing',
  )

  const qrcode = qrPayload?.QRCode || instance?.qrcode || ''

  const run = useCallback(
    async (task: () => Promise<unknown>, success: string) => {
      setBusy(true)
      try {
        await task()
        toast.success(success)
        await refresh()
      } catch (caught) {
        toast.error(errorMessage(caught))
      } finally {
        setBusy(false)
      }
    },
    [refresh, toast],
  )

  const exportContacts = useCallback(async () => {
    try {
      const contacts = await api.contacts()
      const rows = Object.entries(contacts ?? {}).map(([jid, contact]) => ({
        Phone: jidToPhone(jid),
        FullName: contact.FullName ?? '',
        PushName: contact.PushName ?? '',
      }))
      if (rows.length === 0) {
        toast.info('Nenhum contato sincronizado ainda.')
        return
      }
      downloadJson(rows, 'contatos.json')
      toast.success(`${rows.length} contatos exportados.`)
    } catch (caught) {
      toast.error(errorMessage(caught))
    }
  }, [toast])

  const webhookSummary = useMemo(() => {
    if (!instance?.webhook) return 'Nenhuma URL configurada'
    const events = parseEvents(instance.events)
    if (events.includes('All')) return 'Todos os eventos'
    if (events.length === 0) return 'Nenhum evento selecionado'
    return `${events.length} ${events.length === 1 ? 'evento' : 'eventos'}`
  }, [instance])

  if (loading && !instance) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-56 rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!instance) {
    return (
      <p className="rounded-xl border border-down/30 bg-down-soft px-4 py-3 text-sm text-down">
        {error ?? 'Não foi possível carregar esta instância.'}
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-lg border border-down/30 bg-down-soft px-3.5 py-2.5 text-[13px] text-down">
          {error} Mostrando os últimos dados recebidos.
        </p>
      )}

      <ConnectionPanel
        instance={instance}
        qrcode={qrcode}
        busy={busy}
        onConnect={() => run(() => api.connect(token), 'Conectando a instância.')}
        onDisconnect={() => run(() => api.disconnect(token), 'Instância desconectada.')}
        onLogout={() => run(() => api.logout(token), 'Sessão do WhatsApp encerrada.')}
        onPairByPhone={() => setDialog('pair')}
      />

      <section>
        <h2 className="mb-2.5 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
          Configuração
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard
            icon={Webhook}
            title="Notificações"
            value={webhookSummary}
            onClick={() => setDialog('webhook')}
          />
          <ActionCard
            icon={Network}
            title="Proxy"
            value={
              instance.proxy_config?.enabled
                ? (instance.proxy_config.proxy_url || 'Ativo')
                : 'Desativado'
            }
            onClick={() => setDialog('proxy')}
          />
          <ActionCard
            icon={HardDrive}
            title="Armazenamento de mídia"
            value={
              instance.s3_config?.enabled
                ? `Bucket ${instance.s3_config.bucket || 'configurado'}`
                : 'Base64 no webhook'
            }
            onClick={() => setDialog('s3')}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-2.5 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
          Ferramentas
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ActionCard
            icon={Send}
            title="Enviar mensagem"
            value="Teste de envio de texto"
            onClick={() => setDialog('send')}
          />
          <ActionCard
            icon={Search}
            title="Consultar número"
            value="Perfil e foto públicos"
            onClick={() => setDialog('lookup')}
          />
          <ActionCard
            icon={Download}
            title="Exportar contatos"
            value="Baixar como JSON"
            onClick={exportContacts}
          />
          <ActionCard
            icon={Trash2}
            title="Apagar mensagem"
            value="Pelo ID da mensagem"
            onClick={() => setDialog('delete-message')}
          />
        </div>
      </section>

      {state !== 'online' && (
        <p className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-[13px] text-muted">
          <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden />
          As ferramentas de envio só funcionam com a sessão online.
        </p>
      )}

      <PairPhoneModal open={dialog === 'pair'} onClose={() => setDialog(null)} token={token} />
      <WebhookModal
        open={dialog === 'webhook'}
        onClose={() => setDialog(null)}
        onSaved={refresh}
      />
      <ProxyModal
        open={dialog === 'proxy'}
        onClose={() => setDialog(null)}
        onSaved={refresh}
        instance={instance}
      />
      <S3Modal open={dialog === 's3'} onClose={() => setDialog(null)} onSaved={refresh} />
      <SendMessageModal open={dialog === 'send'} onClose={() => setDialog(null)} />
      <DeleteMessageModal
        open={dialog === 'delete-message'}
        onClose={() => setDialog(null)}
      />
      <LookupModal open={dialog === 'lookup'} onClose={() => setDialog(null)} />
    </div>
  )
}
