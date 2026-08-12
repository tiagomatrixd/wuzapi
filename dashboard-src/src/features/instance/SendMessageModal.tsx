import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button, Field, Input, Textarea } from '../../components/ui/primitives'
import { api, errorMessage } from '../../lib/api'
import { useToast } from '../../components/ui/Toast'
import { uuid } from '../../lib/utils'

export function SendMessageModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const [phone, setPhone] = useState('')
  const [body, setBody] = useState('')
  const [sentId, setSentId] = useState('')
  const [busy, setBusy] = useState(false)

  const close = () => {
    setPhone('')
    setBody('')
    setSentId('')
    onClose()
  }

  const send = async () => {
    const digits = phone.replace(/\D/g, '')
    if (!digits) {
      toast.error('Informe o número de destino.')
      return
    }
    if (!body.trim()) {
      toast.error('Escreva a mensagem.')
      return
    }

    setBusy(true)
    try {
      const result = await api.sendText(digits, body, uuid())
      setSentId(result?.Id ?? '')
      toast.success('Mensagem enviada.')
      setBody('')
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
      title="Enviar mensagem"
      description="Teste rápido de envio por esta instância."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Fechar
          </Button>
          <Button variant="primary" onClick={send} loading={busy}>
            Enviar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Destino" required hint="Com código do país e DDD. Ex.: 5511999998888">
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="5511999998888"
            inputMode="numeric"
            className="tnum font-mono"
          />
        </Field>

        <Field label="Mensagem" required>
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            placeholder="Escreva a mensagem…"
          />
        </Field>

        {sentId && (
          <p className="rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-xs text-muted">
            Última mensagem enviada com o ID{' '}
            <span className="font-mono text-text">{sentId}</span>
          </p>
        )}
      </div>
    </Modal>
  )
}
