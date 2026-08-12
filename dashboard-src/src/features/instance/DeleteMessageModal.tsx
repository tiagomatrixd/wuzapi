import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button, Field, Input } from '../../components/ui/primitives'
import { api, errorMessage } from '../../lib/api'
import { useToast } from '../../components/ui/Toast'

export function DeleteMessageModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast()
  const [phone, setPhone] = useState('')
  const [id, setId] = useState('')
  const [busy, setBusy] = useState(false)

  const close = () => {
    setPhone('')
    setId('')
    onClose()
  }

  const remove = async () => {
    const digits = phone.replace(/\D/g, '')
    if (!digits || !id.trim()) {
      toast.error('Informe o destino e o ID da mensagem.')
      return
    }

    setBusy(true)
    try {
      await api.deleteMessage(digits, id.trim())
      toast.success('Mensagem apagada para todos.')
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
      title="Apagar mensagem"
      description="Só funciona em mensagens enviadas por esta instância."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={remove} loading={busy}>
            Apagar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Destino" required>
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="5511999998888"
            inputMode="numeric"
            className="tnum font-mono"
          />
        </Field>

        <Field label="ID da mensagem" required hint="O Id devolvido no envio ou no webhook.">
          <Input
            value={id}
            onChange={(event) => setId(event.target.value)}
            placeholder="3EB0…"
            className="font-mono text-[12px]"
            spellCheck={false}
          />
        </Field>
      </div>
    </Modal>
  )
}
