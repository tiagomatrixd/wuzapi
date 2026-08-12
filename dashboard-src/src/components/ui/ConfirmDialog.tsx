import { useState } from 'react'
import { Modal } from './Modal'
import { Button, Input } from './primitives'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description: string
  confirmLabel?: string
  destructive?: boolean
  /**
   * When set, the operator must type this exact text to enable the confirm
   * button. Reserved for actions that cannot be undone, like deleting an
   * instance along with its WhatsApp device registration.
   */
  confirmPhrase?: string
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  destructive,
  confirmPhrase,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)

  const locked = Boolean(confirmPhrase) && typed.trim() !== confirmPhrase

  const close = () => {
    setTyped('')
    onClose()
  }

  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      setTyped('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={confirm}
            loading={busy}
            disabled={locked}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-muted">{description}</p>
      {confirmPhrase && (
        <div className="mt-4 space-y-1.5">
          <p className="text-[13px] text-text">
            Digite <span className="font-mono font-medium text-down">{confirmPhrase}</span> para
            confirmar.
          </p>
          <Input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={confirmPhrase}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      )}
    </Modal>
  )
}
