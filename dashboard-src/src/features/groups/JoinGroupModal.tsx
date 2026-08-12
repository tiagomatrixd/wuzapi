import { useState } from 'react'
import { Users } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button, Field, Input } from '../../components/ui/primitives'
import { api, errorMessage } from '../../lib/api'
import { useToast } from '../../components/ui/Toast'
import type { GroupInfo } from '../../lib/types'

/** Accepts either a full chat.whatsapp.com link or the bare invite code. */
function extractCode(input: string): string {
  const trimmed = input.trim()
  const match = trimmed.match(/chat\.whatsapp\.com\/(?:invite\/)?([A-Za-z0-9]+)/i)
  return match ? match[1] : trimmed
}

export function JoinGroupModal({
  open,
  onClose,
  onJoined,
}: {
  open: boolean
  onClose: () => void
  onJoined: () => void
}) {
  const toast = useToast()
  const [input, setInput] = useState('')
  const [preview, setPreview] = useState<GroupInfo | null>(null)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)

  const close = () => {
    setInput('')
    setPreview(null)
    onClose()
  }

  const check = async () => {
    const code = extractCode(input)
    if (!code) {
      toast.error('Cole o link ou o código do convite.')
      return
    }

    setChecking(true)
    setPreview(null)
    try {
      setPreview(await api.inviteInfo(code))
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setChecking(false)
    }
  }

  const join = async () => {
    const code = extractCode(input)
    if (!code) {
      toast.error('Cole o link ou o código do convite.')
      return
    }

    setBusy(true)
    try {
      await api.joinGroup(code)
      toast.success('Você entrou no grupo.')
      onJoined()
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
      title="Entrar em um grupo"
      description="Use um link de convite do WhatsApp."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button onClick={check} loading={checking}>
            Ver o grupo
          </Button>
          <Button variant="primary" onClick={join} loading={busy}>
            Entrar
          </Button>
        </>
      }
    >
      <Field
        label="Link ou código do convite"
        required
        hint="Ex.: https://chat.whatsapp.com/AbCdEf123456"
      >
        <Input
          value={input}
          onChange={(event) => {
            setInput(event.target.value)
            setPreview(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') check()
          }}
          placeholder="https://chat.whatsapp.com/…"
          className="font-mono text-[12px]"
          spellCheck={false}
        />
      </Field>

      {preview && (
        <div className="animate-in mt-4 flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface text-muted">
            <Users className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-text">{preview.Name}</p>
            <p className="tnum text-[13px] text-muted">
              {preview.Participants?.length ?? 0} participantes
            </p>
            {preview.Topic && (
              <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-muted">
                {preview.Topic}
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
