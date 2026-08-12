import { useEffect, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Button, Field, Input, Select, Spinner, Toggle } from '../../components/ui/primitives'
import { api, errorMessage } from '../../lib/api'
import { useToast } from '../../components/ui/Toast'

const BLANK = {
  enabled: false,
  endpoint: '',
  region: '',
  bucket: '',
  access_key: '',
  secret_key: '',
  public_url: '',
  media_delivery: 'base64',
  retention_days: 30,
  path_style: false,
}

export function S3Modal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [form, setForm] = useState(BLANK)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setLoading(true)
    api
      .getS3Config()
      .then((data) => {
        if (cancelled || !data) return
        setConfigured(Boolean(data.enabled || data.endpoint || data.bucket))
        setForm({
          enabled: data.enabled ?? false,
          endpoint: data.endpoint ?? '',
          region: data.region ?? '',
          bucket: data.bucket ?? '',
          // The API masks the stored key; never echo the mask back into the form.
          access_key: data.access_key === '***' ? '' : (data.access_key ?? ''),
          secret_key: '',
          public_url: data.public_url ?? '',
          media_delivery: data.media_delivery ?? 'base64',
          retention_days: data.retention_days ?? 30,
          path_style: data.path_style ?? false,
        })
      })
      .catch(() => {
        if (!cancelled) {
          setConfigured(false)
          setForm(BLANK)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open])

  const update = <K extends keyof typeof BLANK>(key: K, value: (typeof BLANK)[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: '' }))
  }

  const save = async () => {
    const found: Record<string, string> = {}
    if (form.enabled) {
      if (!form.bucket.trim()) found.bucket = 'Informe o bucket.'
      if (!form.access_key.trim()) found.access_key = 'Informe a access key.'
      // An existing secret stays on the server, so only demand one on first setup.
      if (!form.secret_key.trim() && !configured) found.secret_key = 'Informe a secret key.'
    }
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setBusy(true)
    try {
      await api.setS3Config({
        ...form,
        media_delivery: form.media_delivery as 'base64' | 's3' | 'both',
        retention_days: Number(form.retention_days) || 30,
      })
      toast.success('Armazenamento salvo.')
      setConfigured(true)
      onSaved()
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    setTesting(true)
    try {
      await api.testS3()
      toast.success('Conexão com o bucket funcionando.')
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setTesting(false)
    }
  }

  const remove = async () => {
    try {
      await api.deleteS3Config()
      toast.success('Configuração de armazenamento removida.')
      setForm(BLANK)
      setConfigured(false)
      setConfirmingDelete(false)
      onSaved()
      onClose()
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Armazenamento de mídia"
        description="Guarda os arquivos recebidos em um bucket S3 em vez de trafegar tudo em base64."
        footer={
          <>
            {configured && (
              <Button
                variant="ghost"
                className="mr-auto text-down hover:bg-down-soft"
                onClick={() => setConfirmingDelete(true)}
              >
                Remover
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={test} loading={testing} disabled={!configured}>
              Testar conexão
            </Button>
            <Button variant="primary" onClick={save} loading={busy} disabled={loading}>
              Salvar
            </Button>
          </>
        }
      >
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner className="size-5" />
          </div>
        ) : (
          <div className="space-y-5">
            <Toggle
              checked={form.enabled}
              onChange={(next) => update('enabled', next)}
              label="Enviar mídias para o S3"
              hint="Compatível com AWS S3, MinIO, DigitalOcean Spaces e afins."
            />

            {form.enabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Endpoint"
                  className="sm:col-span-2"
                  hint="Na AWS pode ficar vazio. No MinIO, use o endereço do seu servidor."
                >
                  <Input
                    value={form.endpoint}
                    onChange={(event) => update('endpoint', event.target.value)}
                    placeholder="https://s3.amazonaws.com"
                  />
                </Field>

                <Field label="Access key" required error={errors.access_key}>
                  <Input
                    value={form.access_key}
                    onChange={(event) => update('access_key', event.target.value)}
                    className="font-mono text-[12px]"
                  />
                </Field>

                <Field
                  label="Secret key"
                  required={!configured}
                  error={errors.secret_key}
                  hint={configured ? 'Deixe vazio para manter a chave atual.' : undefined}
                >
                  <Input
                    type="password"
                    value={form.secret_key}
                    onChange={(event) => update('secret_key', event.target.value)}
                    placeholder={configured ? '••••••••' : ''}
                    className="font-mono text-[12px]"
                  />
                </Field>

                <Field label="Bucket" required error={errors.bucket}>
                  <Input
                    value={form.bucket}
                    onChange={(event) => update('bucket', event.target.value)}
                  />
                </Field>

                <Field label="Região" hint="Obrigatória na AWS.">
                  <Input
                    value={form.region}
                    onChange={(event) => update('region', event.target.value)}
                    placeholder="us-east-1"
                  />
                </Field>

                <Field label="URL pública" className="sm:col-span-2" hint="Se o acesso for por CDN.">
                  <Input
                    value={form.public_url}
                    onChange={(event) => update('public_url', event.target.value)}
                    placeholder="https://cdn.exemplo.com"
                  />
                </Field>

                <Field label="Entrega da mídia no webhook">
                  <Select
                    value={form.media_delivery}
                    onChange={(event) => update('media_delivery', event.target.value)}
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
                    value={form.retention_days}
                    onChange={(event) =>
                      update('retention_days', Number(event.target.value) || 30)
                    }
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Toggle
                    checked={form.path_style}
                    onChange={(next) => update('path_style', next)}
                    label="Forçar path style"
                    hint="Necessário no MinIO e em alguns provedores compatíveis."
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={remove}
        title="Remover armazenamento"
        description="As credenciais do bucket serão apagadas desta instância. Os arquivos já enviados continuam no S3."
        confirmLabel="Remover"
        destructive
      />
    </>
  )
}
