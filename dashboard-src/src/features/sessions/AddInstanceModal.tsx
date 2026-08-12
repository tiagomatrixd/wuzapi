import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button, Field, Input, Select, Toggle } from '../../components/ui/primitives'
import { EventPicker } from '../../components/EventPicker'
import { api, errorMessage, type CreateInstancePayload } from '../../lib/api'
import { useToast } from '../../components/ui/Toast'

function randomToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const SECTION = 'border-t border-line pt-5 mt-5 first:mt-0 first:border-0 first:pt-0'
const LEGEND = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-faint mb-3'

export function AddInstanceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const toast = useToast()

  const [name, setName] = useState('')
  const [token, setToken] = useState(randomToken)
  const [webhook, setWebhook] = useState('')
  const [events, setEvents] = useState<string[]>(['All'])

  const [proxyEnabled, setProxyEnabled] = useState(false)
  const [proxyUrl, setProxyUrl] = useState('')

  const [s3Enabled, setS3Enabled] = useState(false)
  const [s3, setS3] = useState({
    endpoint: '',
    region: '',
    bucket: '',
    accessKey: '',
    secretKey: '',
    publicUrl: '',
    mediaDelivery: 'base64',
    retentionDays: 30,
    pathStyle: false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const reset = () => {
    setName('')
    setToken(randomToken())
    setWebhook('')
    setEvents(['All'])
    setProxyEnabled(false)
    setProxyUrl('')
    setS3Enabled(false)
    setS3({
      endpoint: '',
      region: '',
      bucket: '',
      accessKey: '',
      secretKey: '',
      publicUrl: '',
      mediaDelivery: 'base64',
      retentionDays: 30,
      pathStyle: false,
    })
    setErrors({})
  }

  const close = () => {
    reset()
    onClose()
  }

  const validate = (): boolean => {
    const found: Record<string, string> = {}
    if (!name.trim()) found.name = 'Dê um nome para reconhecer a instância na lista.'
    if (!token.trim()) found.token = 'O token autentica as chamadas dessa instância.'
    if (events.length === 0) found.events = 'Escolha ao menos um evento, ou marque "Todos".'

    if (webhook.trim() && !/^https?:\/\//i.test(webhook.trim())) {
      found.webhook = 'A URL precisa começar com http:// ou https://.'
    }
    if (proxyEnabled) {
      if (!proxyUrl.trim()) found.proxyUrl = 'Informe a URL do proxy.'
      else if (!/^(https?|socks5):\/\//i.test(proxyUrl.trim())) {
        found.proxyUrl = 'Use http://, https:// ou socks5://.'
      }
    }
    if (s3Enabled) {
      if (!s3.bucket.trim()) found.bucket = 'Informe o bucket.'
      if (!s3.accessKey.trim()) found.accessKey = 'Informe a access key.'
      if (!s3.secretKey.trim()) found.secretKey = 'Informe a secret key.'
    }

    setErrors(found)
    return Object.keys(found).length === 0
  }

  const submit = async () => {
    if (!validate()) return

    const payload: CreateInstancePayload = {
      name: name.trim(),
      token: token.trim(),
      events: events.join(','),
      webhook: webhook.trim(),
      expiration: 0,
      proxyConfig: {
        enabled: proxyEnabled,
        proxyURL: proxyEnabled ? proxyUrl.trim() : '',
      },
      s3Config: {
        enabled: s3Enabled,
        endpoint: s3Enabled ? s3.endpoint.trim() : '',
        region: s3Enabled ? s3.region.trim() : '',
        bucket: s3Enabled ? s3.bucket.trim() : '',
        accessKey: s3Enabled ? s3.accessKey.trim() : '',
        secretKey: s3Enabled ? s3.secretKey.trim() : '',
        pathStyle: s3Enabled ? s3.pathStyle : false,
        publicURL: s3Enabled ? s3.publicUrl.trim() : '',
        mediaDelivery: s3Enabled ? s3.mediaDelivery : 'base64',
        retentionDays: s3Enabled ? s3.retentionDays : 30,
      },
    }

    setBusy(true)
    try {
      await api.createInstance(payload)
      toast.success(`Instância “${payload.name}” criada.`)
      onCreated()
      close()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Nova instância"
      description="Cada instância é um número de WhatsApp independente."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={submit} loading={busy}>
            Criar instância
          </Button>
        </>
      }
    >
      <div className={SECTION}>
        <p className={LEGEND}>Identificação</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" required error={errors.name}>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Atendimento comercial"
            />
          </Field>

          <Field
            label="Token"
            required
            error={errors.token}
            hint="Usado no header Token das chamadas dessa instância."
          >
            <div className="flex gap-1.5">
              <Input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                className="font-mono text-[12px]"
                spellCheck={false}
              />
              <Button
                type="button"
                size="icon"
                onClick={() => setToken(randomToken())}
                title="Gerar novo token"
                aria-label="Gerar novo token"
              >
                <RefreshCw className="size-3.5" aria-hidden />
              </Button>
            </div>
          </Field>
        </div>
      </div>

      <div className={SECTION}>
        <p className={LEGEND}>Notificações</p>
        <Field
          label="URL do webhook"
          error={errors.webhook}
          hint="Deixe vazio para não enviar notificações."
          className="mb-4"
        >
          <Input
            value={webhook}
            onChange={(event) => setWebhook(event.target.value)}
            placeholder="https://seu-sistema.com/webhook"
            inputMode="url"
          />
        </Field>

        <p className="mb-2 text-[13px] font-medium text-text">
          Eventos {errors.events && <span className="ml-1 text-xs text-down">{errors.events}</span>}
        </p>
        <EventPicker selected={events} onChange={setEvents} />
      </div>

      <div className={SECTION}>
        <p className={LEGEND}>Proxy</p>
        <Toggle
          checked={proxyEnabled}
          onChange={setProxyEnabled}
          label="Conectar através de um proxy"
          hint="Útil quando o servidor tem saída de rede restrita."
        />
        {proxyEnabled && (
          <Field label="URL do proxy" required error={errors.proxyUrl} className="mt-4">
            <Input
              value={proxyUrl}
              onChange={(event) => setProxyUrl(event.target.value)}
              placeholder="socks5://usuario:senha@host:1080"
              className="font-mono text-[12px]"
              spellCheck={false}
            />
          </Field>
        )}
      </div>

      <div className={SECTION}>
        <p className={LEGEND}>Armazenamento de mídia</p>
        <Toggle
          checked={s3Enabled}
          onChange={setS3Enabled}
          label="Guardar mídias em um bucket S3"
          hint="Compatível com AWS S3, MinIO, DigitalOcean Spaces e afins."
        />

        {s3Enabled && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Endpoint" className="sm:col-span-2">
              <Input
                value={s3.endpoint}
                onChange={(event) => setS3({ ...s3, endpoint: event.target.value })}
                placeholder="https://s3.amazonaws.com"
              />
            </Field>
            <Field label="Access key" required error={errors.accessKey}>
              <Input
                value={s3.accessKey}
                onChange={(event) => setS3({ ...s3, accessKey: event.target.value })}
                className="font-mono text-[12px]"
              />
            </Field>
            <Field label="Secret key" required error={errors.secretKey}>
              <Input
                type="password"
                value={s3.secretKey}
                onChange={(event) => setS3({ ...s3, secretKey: event.target.value })}
                className="font-mono text-[12px]"
              />
            </Field>
            <Field label="Bucket" required error={errors.bucket}>
              <Input
                value={s3.bucket}
                onChange={(event) => setS3({ ...s3, bucket: event.target.value })}
              />
            </Field>
            <Field label="Região" hint="Obrigatória na AWS, opcional no MinIO.">
              <Input
                value={s3.region}
                onChange={(event) => setS3({ ...s3, region: event.target.value })}
                placeholder="us-east-1"
              />
            </Field>
            <Field label="URL pública" className="sm:col-span-2" hint="Se o acesso for por um CDN.">
              <Input
                value={s3.publicUrl}
                onChange={(event) => setS3({ ...s3, publicUrl: event.target.value })}
                placeholder="https://cdn.exemplo.com"
              />
            </Field>
            <Field label="Entrega da mídia no webhook">
              <Select
                value={s3.mediaDelivery}
                onChange={(event) => setS3({ ...s3, mediaDelivery: event.target.value })}
              >
                <option value="base64">Base64 no corpo</option>
                <option value="s3">Apenas o link do S3</option>
                <option value="both">Base64 e link</option>
              </Select>
            </Field>
            <Field label="Retenção (dias)">
              <Input
                type="number"
                min={1}
                value={s3.retentionDays}
                onChange={(event) =>
                  setS3({ ...s3, retentionDays: Number(event.target.value) || 30 })
                }
              />
            </Field>
            <div className="sm:col-span-2">
              <Toggle
                checked={s3.pathStyle}
                onChange={(next) => setS3({ ...s3, pathStyle: next })}
                label="Forçar path style"
                hint="Necessário no MinIO e em alguns provedores compatíveis."
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
