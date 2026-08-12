import { useEffect, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button, Field, Input, Spinner } from '../../components/ui/primitives'
import { EventPicker } from '../../components/EventPicker'
import { api, errorMessage } from '../../lib/api'
import { useToast } from '../../components/ui/Toast'

export function WebhookModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setLoading(true)
    api
      .getWebhook()
      .then((data) => {
        if (cancelled) return
        setUrl(data?.webhook ?? '')
        setEvents(data?.subscribe ?? [])
      })
      .catch((caught) => {
        if (!cancelled) toast.error(errorMessage(caught))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, toast])

  const save = async () => {
    const trimmed = url.trim()
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      setError('A URL precisa começar com http:// ou https://.')
      return
    }

    setBusy(true)
    setError('')
    try {
      await api.setWebhook(trimmed, events)
      toast.success('Webhook salvo.')
      onSaved()
      onClose()
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Notificações"
      description="Para onde o WuzAPI envia os eventos desta instância."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
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
          <Field
            label="URL do webhook"
            error={error}
            hint="Deixe vazio para parar de enviar notificações."
          >
            <Input
              value={url}
              onChange={(event) => {
                setUrl(event.target.value)
                setError('')
              }}
              placeholder="https://seu-sistema.com/webhook"
              inputMode="url"
            />
          </Field>

          <div>
            <p className="mb-2 text-[13px] font-medium text-text">Eventos</p>
            <EventPicker selected={events} onChange={setEvents} />
          </div>
        </div>
      )}
    </Modal>
  )
}
