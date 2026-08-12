import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button, Field, Input } from '../../components/ui/primitives'
import { ContactPicker, type PickedContact } from './ContactPicker'
import { api, errorMessage } from '../../lib/api'
import { useToast } from '../../components/ui/Toast'
import { GROUP_NAME_MAX } from '../../lib/utils'

export function CreateGroupModal({
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
  const [participants, setParticipants] = useState<PickedContact[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const close = () => {
    setName('')
    setParticipants([])
    setError('')
    onClose()
  }

  const create = async () => {
    if (!name.trim()) {
      setError('Dê um nome ao grupo.')
      return
    }
    if (participants.length === 0) {
      setError('Escolha ao menos um participante.')
      return
    }

    setBusy(true)
    try {
      await api.createGroup(
        name.trim(),
        participants.map((contact) => contact.phone),
      )
      toast.success(`Grupo “${name.trim()}” criado.`)
      onCreated()
      close()
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Criar grupo"
      description="Você entra como administrador."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={create} loading={busy}>
            Criar grupo
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field
          label="Nome do grupo"
          required
          error={error && !name.trim() ? error : ''}
          hint={`${name.length}/${GROUP_NAME_MAX} caracteres`}
        >
          <Input
            value={name}
            onChange={(event) => {
              setName(event.target.value.slice(0, GROUP_NAME_MAX))
              setError('')
            }}
            placeholder="Equipe de vendas"
            maxLength={GROUP_NAME_MAX}
          />
        </Field>

        <div>
          <p className="mb-2 text-[13px] font-medium text-text">
            Participantes <span className="text-down">*</span>
            {error && participants.length === 0 && (
              <span className="ml-2 text-xs text-down">{error}</span>
            )}
          </p>
          <ContactPicker selected={participants} onChange={setParticipants} />
        </div>
      </div>
    </Modal>
  )
}
